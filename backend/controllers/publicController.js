const Organization = require("../models/Organization");
const { shouldAutoAssign } = require("../utils/autoAssign");
const Project = require("../models/Project");
const Lead = require("../models/Lead");
const { getNextAssignee } = require("../utils/assignLead");
const { sendPushToAll } = require("../utils/push");
const { emitLeadCreated } = require("../utils/emitLeadCreated");
const { phoneKey, samePhone } = require("../utils/phone");
const { fileLeadInRoutedProject } = require("../utils/routingRules");
const OPTS = require("../constants/leadOptions");
const logger = require("../config/logger");

// The QR enquiry form (/form/:token on the website). A token is either the
// company's own QR (Organization.qrToken) or a project's (Project.qrToken).
// The org's public phone is shown on the thank-you screen (call / WhatsApp).
const ORG_FIELDS = "name logo brandColor isActive phone";

/** { org, project } for a token, or { status, message } when it can't be used. */
async function resolveToken(token, orgFields = ORG_FIELDS) {
  if (!token || typeof token !== "string" || token.length < 8) return { status: 400, message: "Invalid QR code" };
  let org = await Organization.findOne({ qrToken: token }).select(orgFields).lean();
  let project = null;
  if (!org) {
    project = await Project.findOne({ qrToken: token }).select("name orgId location images isArchived").lean();
    if (!project) return { status: 404, message: "Invalid or expired QR code" };
    org = await Organization.findById(project.orgId).select(orgFields).lean();
  }
  if (!org?.isActive) return { status: 403, message: "This company is not taking enquiries here right now." };
  // A printed poster for a project that has since been archived.
  if (project?.isArchived) return { status: 410, message: `Enquiries for ${project.name} are closed. Please contact ${org.name} directly.` };
  return { org, project };
}

// GET /api/public/form/:token
async function getForm(req, res, next) {
  try {
    const r = await resolveToken(req.params.token);
    if (r.status) return res.status(r.status).json({ success: false, message: r.message });
    const { org, project } = r;
    res.json({
      success: true,
      type: project ? "project" : "org",
      org: { _id: org._id, name: org.name, logo: org.logo, brandColor: org.brandColor, phone: org.phone || "" },
      project: project ? { _id: project._id, name: project.name, location: project.location, images: project.images } : null,
    });
  } catch (err) {
    next(err);
  }
}

const clip = (v, n) => String(v ?? "").trim().slice(0, n);

// POST /api/public/form/:token
async function submitLead(req, res, next) {
  try {
    const body = req.body || {};
    const thanks = { success: true, message: "Your details have been submitted. We'll be in touch soon!" };

    // Hidden field a person never sees: a bot that fills every input fills it
    // too. Answer as if it worked, so the bot learns nothing, and keep nothing.
    if (clip(body.company_website, 200)) {
      logger.info(`[qr form] honeypot hit on ${String(req.params.token).slice(0, 6)}…, ignored`);
      return res.status(201).json(thanks);
    }

    const name = clip(body.name, 80);
    const rawPhone = clip(body.phone, 30);
    const email = clip(body.email, 120);
    const message = clip(body.message, 1000);
    // Only an explicit tick counts. The box is unticked by default on the form,
    // and an absent value is recorded as nothing rather than as a refusal.
    const agreedToWhatsApp = ["true", "on", "1", "yes"].includes(String(body.whatsappConsent || "").toLowerCase());

    if (name.length < 2) return res.status(400).json({ success: false, message: "Please enter your name" });
    if (!phoneKey(rawPhone)) return res.status(400).json({ success: false, message: "Please enter a valid mobile number (10 digits)" });
    // Stored without spaces or brackets, the way the other lead sources keep it.
    const phone = rawPhone.replace(/[^\d+]/g, "");
    const cleanEmail = /^\S+@\S+\.\S+$/.test(email) ? email.toLowerCase() : "";
    const budgetNum = Number(String(body.budget ?? "").replace(/[^\d.]/g, ""));
    const budget = Number.isFinite(budgetNum) && budgetNum > 0 ? Math.min(budgetNum, 1e11) : 0;
    const propertyType = OPTS.PROPERTY_TYPE.includes(body.propertyType) ? body.propertyType : undefined;

    const r = await resolveToken(req.params.token, "name isActive autoAssign plan");
    if (r.status) return res.status(r.status).json({ success: false, message: r.message });
    const { org, project } = r;
    const forWhat = project ? ` for ${project.name}` : "";

    // Same person again (any stored format of the number): note it on their
    // lead instead of making a second one. A double tap within two minutes is
    // just the same submission twice.
    const existing = await Lead.findOne({ orgId: org._id, phone: samePhone(phone), isDeleted: { $ne: true } })
      .sort({ createdAt: -1 })
      .select("name phone email source leadSourceLabel assignedTo assignedToName createdAt orgId")
      .lean();
    if (existing) {
      if (Date.now() - new Date(existing.createdAt).getTime() < 2 * 60 * 1000) return res.status(201).json(thanks);
      const text = [`Enquired again via QR code${forWhat}.`, message].filter(Boolean).join(" ");
      await Lead.updateOne({ _id: existing._id }, {
        $push: {
          notes: { text, addedByName: "QR Form" },
          activities: { type: "note_added", description: `Enquired again via QR code${forWhat}`, performedByName: "QR Form", meta: {} },
        },
        ...(agreedToWhatsApp ? { $set: { whatsappConsent: { status: "granted", source: "qr-form", capturedAt: new Date() } } } : {}),
      });
      if (project && existing.assignedTo) {
        await fileLeadInRoutedProject({ assignToProject: project._id, assignTo: existing.assignedTo, assignToName: existing.assignedToName }, existing);
      }
      notify(org._id, existing, `${existing.name} enquired again${forWhat}`);
      logger.info(`[qr form] repeat enquiry folded into lead ${existing._id}`);
      return res.status(201).json(thanks);
    }

    let assignedTo = null;
    let assignedToName = "";
    if (shouldAutoAssign(org)) {
      try {
        const assignee = await getNextAssignee(org._id);
        assignedTo = assignee._id;
        assignedToName = assignee.name;
      } catch { /* no active agents: stays unassigned */ }
    }

    const notes = [];
    if (message) notes.push({ text: message, addedByName: "QR Form" });
    if (project) notes.push({ text: `Interested in project: ${project.name}`, addedByName: "QR Form" });

    const lead = await Lead.create({
      name,
      phone,
      email: cleanEmail,
      budget: { min: budget, max: budget, currency: "INR" },
      ...(propertyType ? { propertyType } : {}),
      source: "QR Code",
      leadSourceLabel: project ? `QR code · ${project.name}` : "QR code",
      orgId: org._id,
      ...(agreedToWhatsApp ? { whatsappConsent: { status: "granted", source: "qr-form", capturedAt: new Date() } } : {}),
      assignedTo,
      assignedToName,
      notes,
      activities: [{
        type: "created",
        description: `Lead submitted via QR code${forWhat}${agreedToWhatsApp ? ", agreed to WhatsApp updates" : ""}`,
        performedByName: "QR Form",
        meta: {},
      }],
    });

    // A project QR puts the lead in that project's own list too, like a
    // routing rule with a project does (it needs someone to file it as).
    if (project && assignedTo) {
      await fileLeadInRoutedProject({ assignToProject: project._id, assignTo: assignedTo, assignToName: assignedToName }, lead);
    }

    // New-lead hand-off to Vistrow (no-op unless the owner enabled it). Not awaited.
    emitLeadCreated(lead, { origin: "qr", project: project ? { id: project._id, name: project.name } : undefined });
    notify(org._id, lead, project ? `Interested in ${project.name}` : "Submitted via QR code");

    res.status(201).json(thanks);
  } catch (err) {
    logger.error(`[qr form] submit failed: ${err.message}`);
    next(err);
  }
}

// One push for the company; tapping it opens this lead (the app reads leadId).
function notify(orgId, lead, line) {
  sendPushToAll({
    type: "new_lead",
    title: `New QR Lead: ${lead.name}`,
    body: `${line}${lead.assignedToName ? ` · assigned to ${lead.assignedToName}` : ""}`,
    data: { url: "/leads", leadId: String(lead._id), leadName: lead.name, source: "QR Code" },
  }, orgId).catch(() => {});
}

module.exports = { getForm, submitLead };
