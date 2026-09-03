// controllers/superAdminController.js
const mongoose    = require("mongoose");
const jwt         = require("jsonwebtoken");
const Organization = require("../models/Organization");
const User        = require("../models/User");
const Lead        = require("../models/Lead");
const Project     = require("../models/Project");
const Automation  = require("../models/Automation");
const Ticket      = require("../models/Ticket");
const AuditLog    = require("../models/AuditLog");
const AiUsage     = require("../models/AiUsage");
const { AppError } = require("../middlewares/errorHandler");
const { uploadOrgLogo, deleteOrgLogo } = require("../utils/upload");
const { sendSignupApprovedEmail, sendSignupRejectedEmail } = require("../utils/email");
const { runBackup } = require("../utils/backup");
const { subscriptionState } = require("../constants/planPricing");
const { invalidateOrgCache } = require("../middlewares/auth");
const { formatISTDateShort } = require("../utils/datetime");
const { layout, paragraph, esc } = require("../utils/emailLayout");

async function logAudit(action, req, opts = {}) {
  try {
    await AuditLog.create({
      action,
      performedBy:     req.user._id,
      performedByName: req.user.name,
      ip:              req.ip,
      ...opts,
    });
  } catch { /* non-blocking — never fail the main request */ }
}

// Helper - compute effective trial status for a single org doc
function trialStatus(org) {
  if (org.plan !== "trial") return null; // non-trial orgs don't have trial state
  if (!org.trialEndsAt) return "active";
  return new Date() > new Date(org.trialEndsAt) ? "expired" : "active";
}

const superAdminController = {
  // GET /api/super-admin/orgs - list all orgs with live stats (paginated)
  async listOrgs(req, res, next) {
    try {
      const page  = Math.max(1, parseInt(req.query.page)  || 1);
      const limit = Math.min(200, parseInt(req.query.limit) || 50);
      const skip  = (page - 1) * limit;

      const [orgs, total] = await Promise.all([
        Organization.find()
          .sort({ createdAt: -1 }).skip(skip).limit(limit)
          .select("-__v") // exclude internal mongoose field; logo is included but every logo is a URL now (small strings)
          .lean(),
        Organization.countDocuments(),
      ]);

      // Attach user count + lead count + current-month AI usage per org
      const currentMonth = new Date().toISOString().slice(0, 7);
      const [userCounts, leadCounts, aiUsageDocs] = await Promise.all([
        User.aggregate([
          { $group: { _id: "$orgId", count: { $sum: 1 } } },
        ]),
        Lead.aggregate([
          { $match: { isDeleted: { $ne: true }, isArchived: { $ne: true } } },
          { $group: { _id: "$orgId", count: { $sum: 1 } } },
        ]),
        AiUsage.find({ month: currentMonth }).select("orgId calls totalTokens").lean(),
      ]);

      const userMap    = Object.fromEntries(userCounts.map((u) => [String(u._id), u.count]));
      const leadMap    = Object.fromEntries(leadCounts.map((l) => [String(l._id), l.count]));
      const aiUsageMap = Object.fromEntries(aiUsageDocs.map((a) => [String(a.orgId), { calls: a.calls, totalTokens: a.totalTokens }]));

      const enriched = orgs.map((org) => ({
        ...org,
        userCount:    userMap[String(org._id)] || 0,
        leadCount:    leadMap[String(org._id)] || 0,
        trialExpired: trialStatus(org) === "expired",
        aiCallsMonth: aiUsageMap[String(org._id)]?.calls       || 0,
        aiTokensMonth: aiUsageMap[String(org._id)]?.totalTokens || 0,
        // Same helper the customer-facing banner uses, so the admin panel and
        // the org see identical billing state rather than two calculations.
        subscription: subscriptionState(org),
      }));

      res.json({ success: true, total, page, pages: Math.ceil(total / limit), orgs: enriched });
    } catch (err) {
      next(err);
    }
  },

  // PATCH /api/super-admin/orgs/:id/logo - upload logo to object storage, store URL (logo:"" removes it)
  async updateLogo(req, res, next) {
    try {
      const { logo } = req.body;
      if (logo === undefined) return next(new AppError("logo field is required", 400));

      let logoUrl = "";

      if (logo !== "") {
        const isBase64 = logo.startsWith("data:image/");
        const isUrl    = logo.startsWith("https://") || logo.startsWith("http://");

        if (!isBase64 && !isUrl) {
          return next(new AppError("logo must be a data-URI or HTTPS URL", 400));
        }

        if (isBase64) {
          // Try object storage — fall back to storing base64 directly if not configured
          try {
            console.log(`[updateLogo] uploading logo to object storage for org ${req.params.id}`);
            logoUrl = await uploadOrgLogo(logo, req.params.id);
            console.log(`[updateLogo] ✅ stored at: ${logoUrl}`);
          } catch (cloudErr) {
            console.warn(`[updateLogo] object storage unavailable, storing base64 directly:`, cloudErr.message);
            logoUrl = logo; // store compressed base64 in MongoDB as fallback
          }
        } else {
          // Already a hosted URL (e.g. re-submitting the current one) - store as-is
          logoUrl = logo;
        }
      } else {
        // Empty string = remove logo - clean up the stored object too
        deleteOrgLogo(req.params.id); // fire-and-forget, don't block response
      }

      const org = await Organization.findByIdAndUpdate(
        req.params.id,
        { logo: logoUrl },
        { new: true }
      ).select("name logo");
      if (!org) return next(new AppError("Organization not found", 404));

      // The org record is cached for 60s on the auth path. Without this, an
      // org that just had its logo changed here keeps serving the old one to
      // its own users for up to a minute — the org-side upload route already
      // invalidates, so the two paths behaved differently.
      invalidateOrgCache(req.params.id);

      res.json({ success: true, org });
    } catch (err) {
      next(err);
    }
  },

  // PATCH /api/super-admin/orgs/:id - update plan / isActive
  async updateOrg(req, res, next) {
    try {
      // paidUntil is settable here because Enterprise — and any offline bank
      // transfer or UPI payment — is invoiced by hand and never passes through
      // checkout. Without it those orgs have no renewal date at all, so neither
      // they nor we can see when their term ends.
      const allowed = ["plan", "isActive", "name", "brandColor", "paidUntil", "seats", "billingCycle", "copilotWritesDisabled"];
      const update  = {};
      allowed.forEach((k) => { if (req.body[k] !== undefined) update[k] = req.body[k]; });

      if (update.paidUntil !== undefined) {
        if (update.paidUntil === null || update.paidUntil === "") {
          update.paidUntil = null;
        } else {
          const d = new Date(update.paidUntil);
          if (Number.isNaN(d.getTime())) {
            return next(new AppError("paidUntil must be a valid date.", 400));
          }
          update.paidUntil = d;
        }
      }

      // Validate brandColor if provided
      if (update.brandColor !== undefined && update.brandColor !== "") {
        if (!/^#[0-9A-Fa-f]{6}$/.test(update.brandColor)) {
          return next(new AppError("brandColor must be a valid 6-digit hex colour (e.g. #2563eb)", 400));
        }
      }

      const before = await Organization.findById(req.params.id).select("plan isActive name").lean();
      const org = await Organization.findByIdAndUpdate(req.params.id, update, { new: true });
      if (!org) return next(new AppError("Organization not found", 404));

      invalidateOrgCache(req.params.id);

      // When an org moves off trial onto a paid plan, schedule referral reward (7 days)
      if (update.plan && before?.plan !== update.plan) {
        logAudit("plan_change", req, { targetOrg: org._id, targetOrgName: org.name, details: { from: before.plan, to: update.plan } });
        const PAID = ["starter", "growth", "pro", "enterprise"];
        if (before?.plan === "trial" && PAID.includes(update.plan) && org.referredBy && !org.referralRewardAt) {
          await Organization.findByIdAndUpdate(org._id, {
            referralRewardAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          });
        }
      }
      if (update.isActive !== undefined && before?.isActive !== update.isActive)
        logAudit(update.isActive ? "org_activated" : "org_deactivated", req, { targetOrg: org._id, targetOrgName: org.name });
      if (update.name && before?.name !== update.name)
        logAudit("org_name_changed", req, { targetOrg: org._id, targetOrgName: update.name, details: { from: before.name, to: update.name } });
      if (update.brandColor !== undefined)
        logAudit("brand_color_changed", req, { targetOrg: org._id, targetOrgName: org.name, details: { color: update.brandColor } });

      res.json({ success: true, org });
    } catch (err) {
      next(err);
    }
  },

  // POST /api/super-admin/orgs/:id/approve — activate a pending trial request.
  // The 14-day clock starts HERE, not at signup, so a slow review doesn't eat
  // into the customer's trial.
  async approveOrg(req, res, next) {
    try {
      const org = await Organization.findById(req.params.id);
      if (!org) return next(new AppError("Organisation not found", 404));
      if (org.approvalStatus === "approved") {
        return next(new AppError("This organisation is already approved.", 400));
      }

      const trialDays = Number(req.body.trialDays) > 0 ? Math.min(Number(req.body.trialDays), 90) : 14;

      org.approvalStatus = "approved";
      org.approvedAt     = new Date();
      org.approvedBy     = req.user._id;
      org.rejectedReason = "";
      org.isActive       = true;
      org.trialEndsAt    = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000);
      await org.save({ validateBeforeSave: false });

      invalidateOrgCache(org._id);

      const admin = await User.findOne({ orgId: org._id, role: "admin" }).select("email name").lean();
      if (admin) {
        sendSignupApprovedEmail(admin.email, admin.name, org.name)
          .catch((e) => console.error("[approveOrg] email failed:", e.message));
      }

      logAudit("org_approved", req, {
        targetOrg: org._id, targetOrgName: org.name, details: { trialDays },
      });

      res.json({ success: true, org });
    } catch (err) { next(err); }
  },

  // POST /api/super-admin/orgs/:id/reject — decline a pending trial request.
  // Kept as a status rather than a delete so the record stays reviewable and
  // the same email can't immediately re-register.
  async rejectOrg(req, res, next) {
    try {
      const { reason } = req.body;
      const org = await Organization.findById(req.params.id);
      if (!org) return next(new AppError("Organisation not found", 404));

      org.approvalStatus = "rejected";
      org.rejectedReason = String(reason || "").slice(0, 500);
      org.isActive       = false;
      await org.save({ validateBeforeSave: false });

      invalidateOrgCache(org._id);

      const admin = await User.findOne({ orgId: org._id, role: "admin" }).select("email name").lean();
      if (admin) {
        sendSignupRejectedEmail(admin.email, admin.name, org.rejectedReason)
          .catch((e) => console.error("[rejectOrg] email failed:", e.message));
      }

      logAudit("org_rejected", req, {
        targetOrg: org._id, targetOrgName: org.name, details: { reason: org.rejectedReason },
      });

      res.json({ success: true, org });
    } catch (err) { next(err); }
  },

  // PATCH /api/super-admin/orgs/:id/extend-trial - extend an org's trial period
  async extendTrial(req, res, next) {
    try {
      const { days } = req.body;

      if (!days || typeof days !== "number" || days < 1 || days > 3650) {
        return next(new AppError("days must be a number between 1 and 3650", 400));
      }

      const org = await Organization.findById(req.params.id);
      if (!org) return next(new AppError("Organization not found", 404));

      // Start extension from today if trial already expired, otherwise extend from current end
      const base = (!org.trialEndsAt || new Date() > new Date(org.trialEndsAt))
        ? new Date()
        : new Date(org.trialEndsAt);

      const newTrialEndsAt = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);

      const updated = await Organization.findByIdAndUpdate(
        req.params.id,
        {
          trialEndsAt: newTrialEndsAt,
          plan:        org.plan === "trial" ? "trial" : org.plan, // keep plan as-is for non-trial
          isActive:    true, // re-activate if it was deactivated due to expiry
        },
        { new: true }
      );

      invalidateOrgCache(req.params.id);
      logAudit("trial_extended", req, { targetOrg: org._id, targetOrgName: org.name, details: { days, newTrialEndsAt } });

      res.json({
        success: true,
        org: {
          ...updated.toObject(),
          trialExpired: false,
        },
        message: `Trial extended by ${days} day${days > 1 ? "s" : ""} - new expiry: ${formatISTDateShort(newTrialEndsAt)}`,
      });
    } catch (err) {
      next(err);
    }
  },

  // GET /api/super-admin/users - list all users across all orgs
  async listUsers(req, res, next) {
    try {
      const page   = Math.max(1, parseInt(req.query.page)  || 1);
      const limit  = Math.min(200, parseInt(req.query.limit) || 100);
      const skip   = (page - 1) * limit;
      const search = req.query.search || "";

      const filter = { role: { $ne: "super_admin" } }; // hide super_admin accounts
      if (search) {
        const re = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
        filter.$or = [{ name: re }, { email: re }, { phone: re }];
      }

      const [users, total] = await Promise.all([
        User.find(filter)
          .populate("orgId", "name slug")
          .select("name email phone role isActive lastLogin createdAt orgId avatar")
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        User.countDocuments(filter),
      ]);

      res.json({ success: true, total, page, pages: Math.ceil(total / limit), users });
    } catch (err) {
      next(err);
    }
  },

  // POST /api/super-admin/backup - trigger a manual backup immediately
  async triggerBackup(req, res, next) {
    try {
      const result = await runBackup();
      if (result.skipped) {
        return res.status(400).json({ success: false, message: result.reason });
      }
      res.json({
        success: true,
        message: `Backup sent to ${process.env.BACKUP_EMAIL}`,
        stats:   result.stats,
        size:    result.gzipSize,
        docs:    result.totalDocs,
      });
    } catch (err) {
      next(err);
    }
  },

  // GET /api/super-admin/tickets/:id/thread - full ticket with replies (admin)
  async getTicketThread(req, res, next) {
    try {
      const ticket = await Ticket.findById(req.params.id).lean();
      if (!ticket) return next(new AppError("Ticket not found", 404));
      res.json({ success: true, ticket });
    } catch (err) {
      next(err);
    }
  },

  // GET /api/super-admin/tickets - list all support tickets across orgs
  async listTickets(req, res, next) {
    try {
      const page   = Math.max(1, parseInt(req.query.page)   || 1);
      const limit  = Math.min(100, parseInt(req.query.limit) || 50);
      const skip   = (page - 1) * limit;
      const status = req.query.status; // optional: "open" | "in-progress" | "resolved" | "closed"
      const search = req.query.search || "";

      const filter = {};
      if (status && status !== "all") filter.status = status;
      if (search) {
        const re = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
        filter.$or = [
          { ticketNumber: re },
          { subject: re },
          { orgName: re },
          { userName: re },
          { userEmail: re },
        ];
      }

      const [tickets, total] = await Promise.all([
        Ticket.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Ticket.countDocuments(filter),
      ]);

      // Summary counts for status badges
      const [statusCounts] = await Ticket.aggregate([
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]).then(rows => [Object.fromEntries(rows.map(r => [r._id, r.count]))]);

      res.json({
        success: true,
        total,
        page,
        pages: Math.ceil(total / limit),
        tickets,
        statusCounts: {
          open:        statusCounts.open        || 0,
          "in-progress": statusCounts["in-progress"] || 0,
          resolved:    statusCounts.resolved    || 0,
          closed:      statusCounts.closed      || 0,
        },
      });
    } catch (err) {
      next(err);
    }
  },

  // PATCH /api/super-admin/tickets/:id - update status / admin notes / priority
  async updateTicket(req, res, next) {
    try {
      const allowed = ["status", "adminNotes", "priority"];
      const update  = {};
      allowed.forEach((k) => { if (req.body[k] !== undefined) update[k] = req.body[k]; });

      if (!Object.keys(update).length) {
        return next(new AppError("No valid fields to update", 400));
      }

      const ticket = await Ticket.findByIdAndUpdate(req.params.id, update, { new: true });
      if (!ticket) return next(new AppError("Ticket not found", 404));

      res.json({ success: true, ticket });
    } catch (err) {
      next(err);
    }
  },

  // POST /api/super-admin/tickets/:id/reply - admin posts a reply visible to the user
  async replyTicket(req, res, next) {
    try {
      const { body, attachments } = req.body;
      if (!body?.trim()) return next(new AppError("Reply body is required", 400));

      const ticket = await Ticket.findById(req.params.id);
      if (!ticket) return next(new AppError("Ticket not found", 404));

      const sanitised = Array.isArray(attachments)
        ? attachments.slice(0, 3).map((a) => ({
            url:  String(a.url  || "").slice(0, 2_000_000),
            name: String(a.name || "attachment").slice(0, 200),
            size: Number(a.size || 0),
          })).filter((a) => a.url)
        : [];

      ticket.replies.push({
        body:        body.trim().slice(0, 3000),
        authorId:    req.user._id,
        authorName:  req.user.name,
        isAdmin:     true,
        attachments: sanitised,
        createdAt:   new Date(),
      });

      // Auto-move to in-progress when admin first replies from open
      if (ticket.status === "open") ticket.status = "in-progress";

      await ticket.save();
      res.json({ success: true, ticket });
    } catch (err) {
      next(err);
    }
  },

  // POST /api/super-admin/migrate-logos
  // Uploads every base64 org logo to object storage and replaces it with an HTTPS URL.
  async migrateLogos(req, res, next) {
    try {
      const orgs = await Organization.find({
        logo: { $regex: "^data:image/", $options: "i" },
      }).select("_id name logo");

      if (!orgs.length) {
        return res.json({ success: true, message: "No base64 logos found — nothing to migrate.", results: [] });
      }

      const results = [];
      for (const org of orgs) {
        try {
          const url = await uploadOrgLogo(org.logo, org._id.toString());
          await Organization.findByIdAndUpdate(org._id, { logo: url });
          results.push({ org: org.name, status: "ok", url });
        } catch (err) {
          results.push({ org: org.name, status: "failed", reason: err.message });
        }
      }

      const allOk = results.every((r) => r.status === "ok");
      res.json({
        success: allOk,
        message: `${results.filter(r => r.status === "ok").length}/${results.length} logo(s) migrated to Cloudinary.`,
        results,
      });
    } catch (err) {
      next(err);
    }
  },

  // POST /api/super-admin/broadcast — send email to all org admins (or filtered by plan)
  async broadcast(req, res, next) {
    try {
      const { subject, message, targetPlan } = req.body;
      if (!subject?.trim() || !message?.trim()) {
        return next(new AppError("Subject and message are required", 400));
      }

      // Find matching orgs
      const orgFilter = (targetPlan && targetPlan !== "all")
        ? { plan: targetPlan }
        : {};
      const orgs = await Organization.find(orgFilter).select("_id").lean();
      const orgIds = orgs.map(o => o._id);

      // Get one admin per org
      const admins = await User.find({
        role: "admin",
        isActive: true,
        orgId: { $in: orgIds },
      }).select("email name").lean();

      if (admins.length === 0) {
        return res.json({ success: true, sent: 0, failed: 0, total: 0 });
      }

      const { Resend } = require("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);
      const from   = process.env.SMTP_FROM || "Arthaleads <onboarding@resend.dev>";

      // Same shell as every other Arthaleads email — see utils/emailLayout.js.
      // Line breaks the admin typed are preserved; the message is escaped so a
      // stray < in someone's text cannot break the markup.
      const emailHtml = (name, body) => layout({
        preheader: subject.trim(),
        eyebrow: "Announcement",
        title: subject.trim(),
        bodyHtml:
          paragraph(`Hi ${esc(name || "there")},`) +
          paragraph(esc(body).replace(/\n/g, "<br />")),
        footerNote: "You received this because you administer an Arthaleads workspace.",
      });

      const sendResults = await Promise.allSettled(
        admins.map(admin =>
          resend.emails.send({
            from,
            to:      admin.email,
            subject: subject.trim(),
            html:    emailHtml(admin.name, message.trim()),
          })
        )
      );

      const sent   = sendResults.filter(r => r.status === "fulfilled").length;
      const failed = sendResults.filter(r => r.status === "rejected").length;

      res.json({ success: true, sent, failed, total: admins.length });
      if (sent > 0) logAudit("broadcast_sent", req, { details: { subject: subject.trim(), targetPlan, sent, failed } });
    } catch (err) {
      next(err);
    }
  },

  // GET /api/super-admin/orgs/:id — full org detail with users, lead stats, projects, automations
  async getOrgDetail(req, res, next) {
    try {
      const orgId = new mongoose.Types.ObjectId(req.params.id);

      const [org, users, leadStats, projectCount, automations, leadSizeAgg, userSizeAgg, aiUsageHistory] = await Promise.all([
        Organization.findById(orgId).lean(),
        User.find({ orgId }).select("name email role phone isActive lastLogin createdAt avatar").lean(),
        Lead.aggregate([
          { $match: { orgId, isDeleted: { $ne: true } } },
          { $group: { _id: "$status", count: { $sum: 1 } } },
        ]),
        Project.countDocuments({ orgId }),
        Automation.find({ orgId }).select("platform status pageId pageName createdAt updatedAt").lean(),
        Lead.aggregate([
          { $match: { orgId } },
          { $project: { s: { $bsonSize: "$$ROOT" } } },
          { $group: { _id: null, total: { $sum: "$s" } } },
        ]).catch(() => []),
        User.aggregate([
          { $match: { orgId } },
          { $project: { s: { $bsonSize: "$$ROOT" } } },
          { $group: { _id: null, total: { $sum: "$s" } } },
        ]).catch(() => []),
        AiUsage.find({ orgId }).sort({ month: -1 }).limit(6).lean().catch(() => []),
      ]);

      if (!org) return next(new AppError("Organisation not found", 404));

      const totalLeads   = leadStats.reduce((s, g) => s + g.count, 0);
      const leadByStatus = leadStats.reduce((acc, s) => { acc[s._id] = s.count; return acc; }, {});
      const storageBytes = (leadSizeAgg[0]?.total || 0) + (userSizeAgg[0]?.total || 0);

      // compute trial status
      const tStatus = trialStatus(org);

      res.json({
        success: true,
        org: { ...org, trialStatus: tStatus },
        users,
        leadByStatus,
        totalLeads,
        projectCount,
        automations,
        storageBytes,
        aiUsage: aiUsageHistory,
      });
    } catch (err) {
      next(err);
    }
  },

  // POST /api/super-admin/orgs/:id/impersonate — issue a 2-hour JWT for the org's admin
  async impersonate(req, res, next) {
    try {
      const org = await Organization.findById(req.params.id).select("name isActive").lean();
      if (!org)           return next(new AppError("Organisation not found", 404));
      if (!org.isActive)  return next(new AppError("Cannot impersonate an inactive organisation", 400));

      const admin = await User.findOne({ orgId: req.params.id, role: "admin", isActive: true })
        .select("_id name email");
      if (!admin) return next(new AppError("No active admin found for this organisation", 404));

      // Hand the super admin's own still-valid session token back to the
      // frontend before it gets overwritten below - "Exit Impersonation"
      // restores it via /auth/restore-admin-session instead of forcing a
      // fresh login.
      const superAdminToken = req.cookies?.crm_token || null;

      await logAudit("impersonate", req, {
        targetOrg:      org._id || req.params.id,
        targetOrgName:  org.name,
        targetUser:     admin._id,
        targetUserName: admin.name,
        details:        { adminEmail: admin.email },
      });

      const token = jwt.sign({ id: admin._id }, process.env.JWT_SECRET, { expiresIn: "2h" });

      res.cookie("crm_token", token, {
        httpOnly: true,
        secure:   process.env.NODE_ENV === "production",
        sameSite: "lax",
        domain:   process.env.NODE_ENV === "production" ? ".arthaleads.com" : undefined,
        maxAge:   2 * 60 * 60 * 1000,
      });

      res.json({ success: true, orgName: org.name, adminName: admin.name, adminEmail: admin.email, superAdminToken });
    } catch (err) {
      next(err);
    }
  },

  // GET /api/super-admin/audit — paginated audit log
  async listAudit(req, res, next) {
    try {
      const page  = Math.max(1, parseInt(req.query.page)  || 1);
      const limit = Math.min(100, parseInt(req.query.limit) || 50);
      const skip  = (page - 1) * limit;
      const filter = {};
      if (req.query.action) filter.action = req.query.action;
      if (req.query.orgId)  filter.targetOrg = req.query.orgId;

      const [logs, total] = await Promise.all([
        AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        AuditLog.countDocuments(filter),
      ]);

      res.json({ success: true, logs, total, pages: Math.ceil(total / limit) });
    } catch (err) {
      next(err);
    }
  },
  // GET /api/super-admin/insights — org health scores, feature adoption, churn signals
  async insights(req, res, next) {
    try {
      const Booking = mongoose.model("Booking");
      const orgs = await Organization.find().lean();
      const orgIds = orgs.map(o => o._id);

      const sevenDaysAgo    = new Date(Date.now() - 7  * 24 * 60 * 60 * 1000);
      const thirtyDaysAgo   = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const currentMonth    = new Date().toISOString().slice(0, 7);

      const [
        recentUsers,
        allUsers,
        leadsThisWeek,
        totalLeads,
        automationCounts,
        projectCounts,
        bookingCounts,
        aiUsageDocs,
      ] = await Promise.all([
        // Users who logged in within last 7 days
        User.aggregate([
          { $match: { orgId: { $in: orgIds }, lastLogin: { $gte: sevenDaysAgo } } },
          { $group: { _id: "$orgId", lastLogin: { $max: "$lastLogin" } } },
        ]),
        // Most recent login + user count per org
        User.aggregate([
          { $match: { orgId: { $in: orgIds } } },
          { $group: { _id: "$orgId", count: { $sum: 1 }, lastLogin: { $max: "$lastLogin" } } },
        ]),
        // Leads added in last 7 days
        Lead.aggregate([
          { $match: { orgId: { $in: orgIds }, createdAt: { $gte: sevenDaysAgo }, isDeleted: { $ne: true } } },
          { $group: { _id: "$orgId", count: { $sum: 1 } } },
        ]),
        // Total active leads
        Lead.aggregate([
          { $match: { orgId: { $in: orgIds }, isDeleted: { $ne: true }, isArchived: { $ne: true } } },
          { $group: { _id: "$orgId", count: { $sum: 1 } } },
        ]),
        // Active automations
        Automation.aggregate([
          { $match: { orgId: { $in: orgIds }, enabled: true } },
          { $group: { _id: "$orgId", count: { $sum: 1 } } },
        ]),
        // Projects
        Project.aggregate([
          { $match: { orgId: { $in: orgIds } } },
          { $group: { _id: "$orgId", count: { $sum: 1 } } },
        ]),
        // Bookings (closings recorded)
        Booking.aggregate([
          { $match: { orgId: { $in: orgIds } } },
          { $group: { _id: "$orgId", count: { $sum: 1 } } },
        ]).catch(() => []),
        // AI usage this month
        AiUsage.aggregate([
          { $match: { orgId: { $in: orgIds }, month: currentMonth } },
          { $group: { _id: "$orgId", calls: { $sum: "$callCount" }, tokens: { $sum: "$tokenCount" } } },
        ]).catch(() => []),
      ]);

      // Build lookup maps
      const toMap = (arr, val) => Object.fromEntries(arr.map(r => [String(r._id), typeof val === "function" ? val(r) : r[val] || 0]));
      const recentLoginSet  = new Set(recentUsers.map(r => String(r._id)));
      const allUserMap      = toMap(allUsers, r => r);
      const leadsWeekMap    = toMap(leadsThisWeek, "count");
      const totalLeadsMap   = toMap(totalLeads, "count");
      const automationMap   = toMap(automationCounts, "count");
      const projectMap      = toMap(projectCounts, "count");
      const bookingMap      = toMap(bookingCounts, "count");
      const aiUsageMap      = toMap(aiUsageDocs, r => r);

      const now = new Date();

      const result = orgs.map(org => {
        const id = String(org._id);
        const loginedRecently  = recentLoginSet.has(id);
        const userInfo         = allUserMap[id] || {};
        const leadsThisWeekN   = leadsWeekMap[id]  || 0;
        const totalLeadsN      = totalLeadsMap[id] || 0;
        const activeAutos      = automationMap[id] || 0;
        const projectCount     = projectMap[id]    || 0;
        const bookingCount     = bookingMap[id]    || 0;
        const aiUsage          = aiUsageMap[id]    || {};
        const hasWhatsApp      = !!org.whatsapp?.enabled;
        const hasTelephony     = !!org.enablex?.enabled;
        const hasProjects      = projectCount > 0;
        const hasBookings      = bookingCount > 0;
        const hasAi            = (aiUsage.calls || 0) > 0;
        const lastLoginAt      = userInfo.lastLogin || null;
        const daysSinceLogin   = lastLoginAt ? Math.floor((now - new Date(lastLoginAt)) / 86400000) : null;
        const isTrialExpired   = org.plan === "trial" && org.trialEndsAt && now > new Date(org.trialEndsAt);
        const daysToTrialEnd   = org.trialEndsAt ? Math.ceil((new Date(org.trialEndsAt) - now) / 86400000) : null;

        // Health score: sum of weighted signals (max 100)
        let healthScore = 0;
        if (loginedRecently)      healthScore += 30;
        if (leadsThisWeekN > 0)   healthScore += 20;
        if (activeAutos > 0)      healthScore += 15;
        if (hasWhatsApp)          healthScore += 10;
        if (hasTelephony)         healthScore += 10;
        if (hasProjects)          healthScore += 10;
        if (hasBookings)          healthScore += 5;
        healthScore = Math.min(100, healthScore);

        // Churn signals
        const churnSignals = [];
        if (daysSinceLogin === null || daysSinceLogin > 7)  churnSignals.push("No login in 7+ days");
        if (leadsThisWeekN === 0 && totalLeadsN < 5)        churnSignals.push("Less than 5 leads total");
        if (activeAutos === 0)                              churnSignals.push("No automations active");
        if (isTrialExpired)                                 churnSignals.push("Trial expired");
        else if (daysToTrialEnd !== null && daysToTrialEnd <= 3 && daysToTrialEnd > 0)
                                                            churnSignals.push(`Trial ends in ${daysToTrialEnd}d`);
        if (!hasWhatsApp && !hasTelephony)                  churnSignals.push("No integrations connected");

        return {
          _id: org._id,
          name: org.name,
          slug: org.slug,
          plan: org.plan,
          logo: org.logo,
          isActive: org.isActive,
          trialEndsAt: org.trialEndsAt,
          createdAt: org.createdAt,
          healthScore,
          features: {
            leads:       totalLeadsN > 0,
            aiBot:       hasAi,
            whatsapp:    hasWhatsApp,
            telephony:   hasTelephony,
            automations: activeAutos > 0,
            projects:    hasProjects,
            bookings:    hasBookings,
          },
          stats: {
            totalLeads: totalLeadsN,
            leadsThisWeek: leadsThisWeekN,
            activeAutomations: activeAutos,
            lastLoginAt,
            daysSinceLogin,
            userCount: userInfo.count || 0,
            aiCallsMonth: aiUsage.calls || 0,
          },
          churnSignals,
        };
      });

      // Sort: churn risk first, then at-risk, then healthy
      result.sort((a, b) => a.healthScore - b.healthScore);

      res.json({
        orgs: result,
        summary: {
          totalOrgs:     result.length,
          healthyOrgs:   result.filter(o => o.healthScore >= 70).length,
          atRiskOrgs:    result.filter(o => o.healthScore >= 40 && o.healthScore < 70).length,
          churnRiskOrgs: result.filter(o => o.healthScore < 40).length,
        },
      });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = superAdminController;
