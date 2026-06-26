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
const SupportAccess = require("../models/SupportAccess");
const { AppError } = require("../middlewares/errorHandler");
const { uploadOrgLogo, deleteOrgLogo } = require("../utils/upload");
const { runBackup } = require("../utils/backup");
const { invalidateOrgCache } = require("../middlewares/auth");

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
          .select("-__v") // exclude internal mongoose field; logo is included but now all logos are Cloudinary URLs (small strings)
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
      }));

      res.json({ success: true, total, page, pages: Math.ceil(total / limit), orgs: enriched });
    } catch (err) {
      next(err);
    }
  },

  // PATCH /api/super-admin/orgs/:id/logo - upload logo to Cloudinary, store URL (logo:"" removes it)
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
          // Try Cloudinary — fall back to storing base64 directly if not configured
          try {
            console.log(`[updateLogo] uploading logo to Cloudinary for org ${req.params.id}`);
            logoUrl = await uploadOrgLogo(logo, req.params.id);
            console.log(`[updateLogo] ✅ Cloudinary URL: ${logoUrl}`);
          } catch (cloudErr) {
            console.warn(`[updateLogo] Cloudinary unavailable, storing base64 directly:`, cloudErr.message);
            logoUrl = logo; // store compressed base64 in MongoDB as fallback
          }
        } else {
          // Already a hosted URL (e.g. re-submitting an existing Cloudinary URL) - store as-is
          logoUrl = logo;
        }
      } else {
        // Empty string = remove logo - clean up from Cloudinary too
        deleteOrgLogo(req.params.id); // fire-and-forget, don't block response
      }

      const org = await Organization.findByIdAndUpdate(
        req.params.id,
        { logo: logoUrl },
        { new: true }
      ).select("name logo");
      if (!org) return next(new AppError("Organization not found", 404));

      res.json({ success: true, org });
    } catch (err) {
      next(err);
    }
  },

  // PATCH /api/super-admin/orgs/:id - update plan / isActive
  async updateOrg(req, res, next) {
    try {
      const allowed = ["plan", "isActive", "name", "brandColor"];
      const update  = {};
      allowed.forEach((k) => { if (req.body[k] !== undefined) update[k] = req.body[k]; });

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
        message: `Trial extended by ${days} day${days > 1 ? "s" : ""} - new expiry: ${newTrialEndsAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`,
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
  // Uploads every base64 org logo to Cloudinary and replaces it with an HTTPS URL.
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

      const emailHtml = (name, body) => `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f0ede8;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0ede8;padding:48px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:500px;">
        <tr><td align="center" style="padding-bottom:24px;">
          <img src="https://www.arthaleads.com/logo.png" alt="Arthaleads" width="48" height="48"
            style="display:inline-block;border-radius:14px;border:0;" />
          <br/>
          <span style="display:inline-block;margin-top:10px;color:#111113;font-weight:800;font-size:20px;font-family:'Segoe UI',Arial,sans-serif;">Artha<span style="color:#ff6b00;">leads</span></span>
        </td></tr>
        <tr><td style="background:#1e1d20;border-radius:24px;border:1px solid rgba(255,107,0,0.18);box-shadow:0 0 0 1px rgba(255,107,0,0.06),0 20px 60px rgba(0,0,0,0.22);overflow:hidden;padding:40px 36px;">
          <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#ff6b00;letter-spacing:.08em;text-transform:uppercase;">Message from Arthaleads</p>
          <p style="margin:0 0 20px;font-size:15px;color:#969696;">Hi ${name},</p>
          <div style="font-size:15px;color:#ededed;line-height:1.7;white-space:pre-wrap;">${body}</div>
          <p style="margin:24px 0 0;font-size:13px;color:#555;">— Team Arthaleads</p>
        </td></tr>
        <tr><td style="padding:20px 0;text-align:center;">
          <p style="margin:0;font-size:12px;color:#a8a29e;">© ${new Date().getFullYear()} Arthaleads. All rights reserved.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

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

  // POST /api/super-admin/orgs/:id/request-access — create approval request, notify org admin via push
  async requestAccess(req, res, next) {
    try {

      const { reason, notes } = req.body;
      if (!reason) return next(new AppError("Reason is required", 400));

      const org = await Organization.findById(req.params.id).select("name isActive").lean();
      if (!org)          return next(new AppError("Organisation not found", 404));
      if (!org.isActive) return next(new AppError("Organisation is inactive", 400));

      const orgAdmin = await User.findOne({ orgId: req.params.id, role: "admin", isActive: true })
        .select("_id name email");
      if (!orgAdmin) return next(new AppError("No active admin found for this organisation", 404));

      const access = await SupportAccess.create({
        orgId:           req.params.id,
        requestedBy:     req.user._id,
        requestedByName: req.user.name,
        orgAdminId:      orgAdmin._id,
        reason,
        notes: notes || "",
        status:     "pending",
        notifiedAt: new Date(),
      });

      const REASON_LABELS = {
        customer_support:  "Customer Support",
        onboarding:        "Onboarding Assistance",
        bug_investigation: "Bug Investigation",
        data_migration:    "Data Migration",
        billing_issue:     "Billing Issue",
        other:             "Other",
      };

      const { sendPushToUser } = require("../utils/push");
      sendPushToUser(orgAdmin._id, {
        title: "Support Access Request",
        body:  `Arthaleads support (${req.user.name}) is requesting access — ${REASON_LABELS[reason]}. Tap to review.`,
        data:  { type: "support_access_request", requestId: String(access._id), url: "/settings?tab=security" },
      }).catch(() => {});

      await logAudit("support_access_request", req, {
        targetOrg:      org._id,
        targetOrgName:  org.name,
        targetUser:     orgAdmin._id,
        targetUserName: orgAdmin.name,
        details:        { reason, notes, requestId: String(access._id) },
      });

      res.json({ success: true, requestId: access._id, status: "pending" });
    } catch (err) { next(err); }
  },

  // GET /api/super-admin/orgs/:id/support-requests
  async listSupportRequests(req, res, next) {
    try {

      const requests = await SupportAccess.find({ orgId: req.params.id })
        .sort({ createdAt: -1 }).limit(20).lean();
      res.json({ success: true, requests });
    } catch (err) { next(err); }
  },

  // POST /api/super-admin/orgs/:id/impersonate — issue a 2-hour JWT for the org's admin
  async impersonate(req, res, next) {
    try {

      const { reason, notes, requestId } = req.body;
      if (!reason) return next(new AppError("Reason is required", 400));

      const org = await Organization.findById(req.params.id).select("name isActive").lean();
      if (!org)           return next(new AppError("Organisation not found", 404));
      if (!org.isActive)  return next(new AppError("Cannot impersonate an inactive organisation", 400));

      const admin = await User.findOne({ orgId: req.params.id, role: "admin", isActive: true })
        .select("_id name email");
      if (!admin) return next(new AppError("No active admin found for this organisation", 404));

      let accessRecord;
      if (requestId) {
        accessRecord = await SupportAccess.findById(requestId);
        if (!accessRecord || String(accessRecord.orgId) !== req.params.id)
          return next(new AppError("Invalid access request", 400));
        if (accessRecord.status !== "approved")
          return next(new AppError("Access request has not been approved yet", 403));
        accessRecord.status = "active";
        accessRecord.accessedAt = new Date();
        await accessRecord.save();
      } else {
        accessRecord = await SupportAccess.create({
          orgId:           req.params.id,
          requestedBy:     req.user._id,
          requestedByName: req.user.name,
          orgAdminId:      admin._id,
          reason,
          notes: notes || "",
          status:     "active",
          accessedAt: new Date(),
        });
      }

      await logAudit("impersonate", req, {
        targetOrg:      org._id || req.params.id,
        targetOrgName:  org.name,
        targetUser:     admin._id,
        targetUserName: admin.name,
        details:        { adminEmail: admin.email, reason, notes, requestId: String(accessRecord._id) },
      });

      await Organization.findByIdAndUpdate(req.params.id, {
        "activeSupportSession.active":         true,
        "activeSupportSession.reason":         reason,
        "activeSupportSession.superAdminName": req.user.name,
        "activeSupportSession.startedAt":      new Date(),
        "activeSupportSession.requestId":      accessRecord._id,
      });

      const token = jwt.sign(
        { id: admin._id, isSupportSession: true, supportRequestId: String(accessRecord._id) },
        process.env.JWT_SECRET,
        { expiresIn: "2h" }
      );

      res.cookie("crm_token", token, {
        httpOnly: true,
        secure:   process.env.NODE_ENV === "production",
        sameSite: "lax",
        domain:   process.env.NODE_ENV === "production" ? ".arthaleads.com" : undefined,
        maxAge:   2 * 60 * 60 * 1000,
      });

      res.json({
        success: true,
        orgName: org.name, adminName: admin.name, adminEmail: admin.email,
        requestId: String(accessRecord._id),
      });
    } catch (err) {
      next(err);
    }
  },

  // POST /api/super-admin/orgs/:id/end-support-session
  async endSupportSession(req, res, next) {
    try {

      const { requestId } = req.body;
      await Organization.findByIdAndUpdate(req.params.id, {
        "activeSupportSession.active":    false,
        "activeSupportSession.startedAt": null,
      });
      if (requestId) {
        await SupportAccess.findByIdAndUpdate(requestId, { status: "completed", endedAt: new Date() });
      }
      res.json({ success: true });
    } catch (err) { next(err); }
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
