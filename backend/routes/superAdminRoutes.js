// routes/superAdminRoutes.js - only accessible by super_admin role
const express = require("express");
const router  = express.Router();
const { protect, authorize } = require("../middlewares/auth");
const ctrl = require("../controllers/superAdminController");

router.use(protect, authorize("super_admin"));

router.get("/orgs",                     ctrl.listOrgs);
router.get("/orgs/:id",               ctrl.getOrgDetail);
router.patch("/orgs/:id",             ctrl.updateOrg);
router.patch("/orgs/:id/logo",        ctrl.updateLogo);
router.patch("/orgs/:id/storage",     ctrl.updateStorage);
router.patch("/orgs/:id/whatsapp-credits", ctrl.updateWhatsAppCredits);
router.patch("/orgs/:id/referral-reward", ctrl.markReferralRewardGiven);
router.patch("/orgs/:id/extend-trial", ctrl.extendTrial);
router.post("/orgs/:id/approve",      ctrl.approveOrg);
router.post("/orgs/:id/reject",       ctrl.rejectOrg);
router.post("/orgs/:id/impersonate",  ctrl.impersonate);
router.get("/audit",                  ctrl.listAudit);
router.get("/users",                  ctrl.listUsers);
router.post("/backup",                ctrl.triggerBackup);

// POST /api/super-admin/migrate-logos
// One-time migration: uploads all base64 org logos to Cloudinary.
// Safe to call multiple times — skips orgs that already have Cloudinary URLs.
router.post("/migrate-logos", ctrl.migrateLogos);

// ── Ticket management (super admin sees all tickets) ──────────────────────────
router.get("/tickets",              ctrl.listTickets);
router.get("/tickets/:id/thread",   ctrl.getTicketThread);
router.patch("/tickets/:id",        ctrl.updateTicket);
router.post("/tickets/:id/reply",   ctrl.replyTicket);
router.post("/broadcast",           ctrl.broadcast);
router.get("/insights",             ctrl.insights);

// Book a Demo requests from the website (/book-demo)
const demo = require("../controllers/demoRequestController");
router.get("/demo-requests",        demo.listDemoRequests);
router.patch("/demo-requests/:id",  demo.updateDemoRequest);

// Artha conversations from the marketing website, newest first. ?q= searches
// the text, ?before= (ISO lastAt) pages back.
const BS = String.fromCharCode(92);              // a backslash, spelled so no escaping can eat it
const SPECIAL = ".*+?^${}()|[]/" + BS;            // regex metacharacters, escaped in ?q=
router.get("/website-chats", async (req, res, next) => {
  try {
    const WebsiteChat = require("../models/WebsiteChat");
    const filter = {};
    const q = String(req.query.q || "").trim().slice(0, 80);
    if (q) filter["messages.text"] = { $regex: q.split("").map((c) => (SPECIAL.includes(c) ? BS + c : c)).join(""), $options: "i" };
    if (req.query.before) { const d = new Date(req.query.before); if (!isNaN(d)) filter.lastAt = { $lt: d }; }
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [items, total, week] = await Promise.all([
      WebsiteChat.find(filter).sort({ lastAt: -1 }).limit(50).lean(),
      WebsiteChat.countDocuments({}),
      WebsiteChat.countDocuments({ lastAt: { $gte: since } }),
    ]);
    res.json({ success: true, items, total, week });
  } catch (err) { next(err); }
});

module.exports = router;
