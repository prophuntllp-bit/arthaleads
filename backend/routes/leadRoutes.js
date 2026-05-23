// routes/leadRoutes.js
const express = require("express");
const router = express.Router();
const leadController = require("../controllers/leadController");
const { protect, authorize } = require("../middlewares/auth");
const validate = require("../middlewares/validate");
const { createLeadSchema, updateLeadSchema, addNoteSchema, assignLeadSchema, importLeadsSchema } = require("../validations/schemas");

// All lead routes require authentication
router.use(protect);

router.get("/analytics", leadController.getAnalytics);
router.get("/dump", leadController.getDump);
router.get("/alerts", leadController.getAlerts);
router.get("/unified", leadController.getAllUnified);
router.get("/export", leadController.exportLeads);
router.post("/import", authorize("admin", "manager"), validate(importLeadsSchema), leadController.bulkImport);
router.delete("/bulk", leadController.bulkDelete);

router.route("/")
  .get(leadController.getAll)
  .post(validate(createLeadSchema), leadController.create);

router.route("/:id")
  .get(leadController.getById)
  .put(validate(updateLeadSchema), leadController.update)
  .delete(leadController.delete);

router.patch("/:id/restore", authorize("admin", "manager"), leadController.restore);
router.delete("/:id/permanent", authorize("admin", "manager"), leadController.permanentDelete);
router.post("/:id/notes",  validate(addNoteSchema),   leadController.addNote);
router.post("/:id/assign", authorize("admin", "manager"), validate(assignLeadSchema), leadController.assign);
router.post("/:id/transfer", authorize("admin", "manager"), leadController.transferLead);

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

    // Replace the error note text with a success message
    const noteIdx = lead.notes.findIndex((n) => n._id?.toString() === errorNote._id?.toString());
    const successText = `✅ Facebook lead data fetched successfully (retry).\nName: ${fetchedName || "-"}\nPhone: ${fetchedPhone || "-"}\nEmail: ${fetchedEmail || "-"}\nLead ID: ${leadgenId}`;
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

module.exports = router;
