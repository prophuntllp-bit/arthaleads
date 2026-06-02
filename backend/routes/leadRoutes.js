// routes/leadRoutes.js
const express = require("express");
const router = express.Router();
const leadController = require("../controllers/leadController");
const { protect, authorize } = require("../middlewares/auth");
const validate = require("../middlewares/validate");
const { createLeadSchema, updateLeadSchema, addNoteSchema, assignLeadSchema, importLeadsSchema } = require("../validations/schemas");
const Lead = require("../models/Lead");
const Automation = require("../models/Automation");
const logger = require("../config/logger");
const { scoreLead, scoreLabel, nextBestAction } = require("../utils/leadScorer");
const { draftWhatsAppMessage } = require("../utils/openai");

// All lead routes require authentication
router.use(protect);

router.get("/analytics", leadController.getAnalytics);

// GET /api/leads/hot — top scored leads for the "Hot Today" dashboard widget
router.get("/hot", async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 8, 20);
    const filter = {
      orgId: req.user.orgId,
      isDeleted: { $ne: true },
      isArchived: { $ne: true },
      status: { $nin: ["Closed Won", "Closed Lost"] },
    };
    if (req.user.role === "agent") filter.assignedTo = req.user._id;

    const leads = await Lead.find(filter)
      .select("name phone status priority source budget booking siteVisitDone followUpDate firstContactedAt activities notes assignedToName assignedTo propertyType bhk preferredLocation purpose")
      .populate("assignedTo", "name")
      .lean();

    const scored = leads
      .map((l) => {
        const score = scoreLead(l);
        return { ...l, _score: score, _scoreLabel: scoreLabel(score), _nextAction: nextBestAction(l, score) };
      })
      .sort((a, b) => b._score - a._score)
      .slice(0, limit);

    res.json({ success: true, data: scored });
  } catch (err) { next(err); }
});
router.get("/dump", leadController.getDump);
router.get("/alerts", leadController.getAlerts);
router.get("/followups-due", leadController.getFollowUpsDue);
router.get("/unified", leadController.getAllUnified);
router.get("/export", leadController.exportLeads);
router.post("/import", authorize("admin", "manager"), validate(importLeadsSchema), leadController.bulkImport);
router.post("/bulk-assign", authorize("admin", "manager"), leadController.bulkAssign);
router.patch("/bulk-status", authorize("admin", "manager"), leadController.bulkUpdateStatus);
router.delete("/bulk", leadController.bulkDelete);

// POST /api/leads/backfill-source-domain  (admin only)
// One-time migration: scans notes for "Page: <url>" and populates sourcePage + sourceDomain
router.post("/backfill-source-domain", authorize("admin"), async (req, res, next) => {
  try {
    const leads = await Lead.find({
      orgId: req.user.orgId,
      sourcePage: { $in: ["", null] },
      "notes.0": { $exists: true },
    }).select("_id notes sourcePage sourceDomain");

    let updated = 0;
    const PAGE_RE = /(?:^|\n)Page:\s*(https?:\/\/\S+)/i;

    const ops = [];
    for (const lead of leads) {
      const noteText = (lead.notes || []).map((n) => n.text || "").join("\n");
      const match = noteText.match(PAGE_RE);
      if (!match) continue;
      const pageUrl = match[1].trim();
      let domain = "";
      try { domain = new URL(pageUrl).hostname.replace(/^www\./, ""); } catch {}
      ops.push({
        updateOne: {
          filter: { _id: lead._id },
          update: { $set: { sourcePage: pageUrl, sourceDomain: domain } },
        },
      });
      updated++;
    }

    if (ops.length) await Lead.bulkWrite(ops);
    res.json({ success: true, updated, message: `Backfilled ${updated} lead(s)` });
  } catch (err) { next(err); }
});

router.route("/")
  .get(leadController.getAll)
  .post(validate(createLeadSchema), leadController.create);

router.route("/:id")
  .get(leadController.getById)
  .put(validate(updateLeadSchema), leadController.update)
  .delete(leadController.delete);

// PATCH /api/leads/:id — partial field update for follow-up editing
router.patch("/:id", async (req, res, next) => {
  try {
    const ALLOWED = ["followUpDate", "remark1", "remark2", "booking", "remarkNote", "followUp2"];
    const update = {};
    ALLOWED.forEach((f) => { if (f in req.body) update[f] = req.body[f] ?? null; });
    if (!Object.keys(update).length) return res.status(400).json({ success: false, message: "No updatable fields" });
    const lead = await Lead.findOneAndUpdate(
      { _id: req.params.id, orgId: req.user.orgId },
      { $set: update },
      { new: true }
    );
    if (!lead) return res.status(404).json({ success: false, message: "Lead not found" });
    res.json({ success: true, data: lead });
  } catch (err) { next(err); }
});

router.patch("/:id/restore", authorize("admin", "manager"), leadController.restore);
router.delete("/:id/permanent", authorize("admin", "manager"), leadController.permanentDelete);
router.post("/:id/notes",  validate(addNoteSchema),   leadController.addNote);
router.post("/:id/assign", authorize("admin", "manager"), validate(assignLeadSchema), leadController.assign);
router.post("/:id/transfer", leadController.transferLead);

// POST /api/leads/:id/retry-facebook
// Re-fetches lead field data from Meta Graph API after a token has been reconnected.
// Scans the error note for the stored Lead ID, tries all active FB tokens for the org,
// and updates the lead's name/phone/email on success.
router.post("/:id/retry-facebook", async (req, res, next) => {
  try {
    const lead = await Lead.findOne({ _id: req.params.id, orgId: req.user.orgId });
    if (!lead) return res.status(404).json({ success: false, message: "Lead not found" });

    // Find the error note that contains the stored leadgen_id
    const errorNote = (lead.notes || []).find((n) =>
      n.text && n.text.includes("Lead ID:") && n.text.includes("Facebook lead received")
    );
    if (!errorNote) {
      return res.status(400).json({ success: false, message: "No Facebook error note found on this lead" });
    }

    const idMatch = errorNote.text.match(/Lead ID:\s*(\d+)/);
    if (!idMatch) {
      return res.status(400).json({ success: false, message: "Could not parse Facebook Lead ID from the note" });
    }
    const leadgenId = idMatch[1];

    // Try all active Facebook automations for this org
    const automations = await Automation.find({
      orgId: req.user.orgId,
      platform: "Facebook",
      isActive: true,
      accessToken: { $exists: true, $ne: "" },
    });

    if (!automations.length) {
      return res.status(400).json({
        success: false,
        message: "No active Facebook connection found. Please reconnect in Automation → Facebook.",
      });
    }

    let fieldData = null;
    let lastError = "All tokens failed";

    for (const auto of automations) {
      try {
        const params = new URLSearchParams({ access_token: auto.accessToken, fields: "field_data" });
        const resp = await fetch(`https://graph.facebook.com/v23.0/${leadgenId}?${params.toString()}`);
        const json = await resp.json();
        if (json.error) { lastError = json.error.message; continue; }
        if (json.field_data?.length) { fieldData = json.field_data; break; }
      } catch (e) {
        lastError = e.message;
      }

      // If access token is expired, try auto-refreshing via userToken
      if (!fieldData && auto.userToken && auto.pageId) {
        try {
          const rp = new URLSearchParams({ access_token: auto.userToken, fields: "access_token" });
          const rr = await fetch(`https://graph.facebook.com/v23.0/${auto.pageId}?${rp.toString()}`);
          const rj = await rr.json();
          if (rj.access_token) {
            await Automation.findByIdAndUpdate(auto._id, { accessToken: rj.access_token });
            const p2 = new URLSearchParams({ access_token: rj.access_token, fields: "field_data" });
            const r2 = await fetch(`https://graph.facebook.com/v23.0/${leadgenId}?${p2.toString()}`);
            const j2 = await r2.json();
            if (j2.field_data?.length) { fieldData = j2.field_data; break; }
          }
        } catch (e) {
          lastError = e.message;
        }
      }
    }

    if (!fieldData) {
      return res.status(400).json({
        success: false,
        message: `Could not fetch lead data: ${lastError}. The token may still be expired — please reconnect Facebook in Automation settings.`,
      });
    }

    // Map field_data array into a flat object
    const fm = Object.fromEntries(fieldData.map((f) => [f.name, f.values?.[0] || ""]));
    const fetchedName  = [fm.first_name, fm.last_name].filter(Boolean).join(" ") || fm.full_name || fm.name;
    const fetchedPhone = fm.phone_number || fm.phone;
    const fetchedEmail = fm.email;

    if (fetchedName)  lead.name  = fetchedName;
    if (fetchedPhone) lead.phone = fetchedPhone;
    if (fetchedEmail) lead.email = fetchedEmail;

    // Save custom form Q&A into formResponses (shown in Info tab "Form Questions")
    const STANDARD_FIELDS = new Set(["full_name","first_name","last_name","email","phone_number","phone","name"]);
    const customFields = fieldData.filter((f) => !STANDARD_FIELDS.has(f.name) && f.values?.[0]);
    if (customFields.length) {
      lead.formResponses = customFields.map((f) => ({
        fieldKey: f.name,
        label:    f.name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        value:    f.values?.[0] || "",
      }));
      // Also save as requirements string
      lead.requirements = customFields.map((f) => `${f.name.replace(/_/g," ")}: ${f.values?.[0]}`).join(" · ");
    }

    // Build success note with all fields including custom ones
    const customLines = customFields.map((f) => `${f.name.replace(/_/g," ").replace(/\b\w/g,(c)=>c.toUpperCase())}: ${f.values?.[0]}`).join("\n");
    const successText = [
      `✅ Facebook lead data fetched successfully (retry).`,
      `Name: ${fetchedName || "-"}`,
      `Phone: ${fetchedPhone || "-"}`,
      `Email: ${fetchedEmail || "-"}`,
      customLines ? `\nForm Answers:\n${customLines}` : "",
      `Lead ID: ${leadgenId}`,
    ].filter(Boolean).join("\n");

    // Replace the error note with the success note
    const noteIdx = lead.notes.findIndex((n) => n._id?.toString() === errorNote._id?.toString());
    if (noteIdx >= 0) {
      lead.notes[noteIdx].text = successText;
      lead.notes[noteIdx].addedByName = req.user.name || "System";
    } else {
      lead.notes.push({ text: successText, addedByName: req.user.name || "System", createdAt: new Date() });
    }

    await lead.save({ validateBeforeSave: false });
    logger.info(`[retry-facebook] Lead ${lead._id} updated from leadgen ${leadgenId} by ${req.user.name}`);
    res.json({ success: true, lead, message: "Lead data fetched and updated" });
  } catch (err) {
    next(err);
  }
});

// POST /api/leads/:id/draft-message — AI-drafted WhatsApp message via OpenAI
router.post("/:id/draft-message", async (req, res, next) => {
  try {
    const lead = await Lead.findOne({ _id: req.params.id, orgId: req.user.orgId })
      .select("name phone status priority source budget booking siteVisitDone followUpDate notes propertyType bhk preferredLocation purpose assignedToName")
      .lean();
    if (!lead) return res.status(404).json({ success: false, message: "Lead not found." });

    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({ success: false, message: "AI drafting is not configured. Ask your admin to set the OPENAI_API_KEY." });
    }

    const agentName = req.user.name || "";
    const message = await draftWhatsAppMessage(lead, agentName);
    res.json({ success: true, message });
  } catch (err) {
    if (err.message?.includes("OPENAI_API_KEY")) {
      return res.status(503).json({ success: false, message: "AI drafting is not configured. Ask your admin to set the OPENAI_API_KEY." });
    }
    next(err);
  }
});

module.exports = router;
