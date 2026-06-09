const Organization = require("../models/Organization");
const Project = require("../models/Project");
const Lead = require("../models/Lead");
const { getNextAssignee } = require("../utils/assignLead");
const { sendPushToAll } = require("../utils/push");

// GET /api/public/form/:token
async function getForm(req, res, next) {
  try {
    const { token } = req.params;
    if (!token || token.length < 8) return res.status(400).json({ success: false, message: "Invalid token" });

    // Try org QR first, then project QR
    let org = await Organization.findOne({ qrToken: token })
      .select("name logo brandColor isActive")
      .lean();
    let project = null;
    let type = "org";

    if (!org) {
      project = await Project.findOne({ qrToken: token })
        .select("name orgId location images")
        .lean();
      if (!project) return res.status(404).json({ success: false, message: "Invalid or expired QR code" });
      org = await Organization.findById(project.orgId)
        .select("name logo brandColor isActive")
        .lean();
      type = "project";
    }

    if (!org?.isActive) {
      return res.status(403).json({ success: false, message: "Organization is inactive" });
    }

    res.json({ success: true, type, org, project });
  } catch (err) {
    next(err);
  }
}

// POST /api/public/form/:token
async function submitLead(req, res, next) {
  try {
    const { token } = req.params;
    if (!token || token.length < 8) return res.status(400).json({ success: false, message: "Invalid token" });

    const { name, phone, email, message, budget, propertyType } = req.body;

    if (!name?.trim()) return res.status(400).json({ success: false, message: "Name is required" });
    if (!phone?.trim()) return res.status(400).json({ success: false, message: "Phone is required" });

    // Find org and optional project
    let org = await Organization.findOne({ qrToken: token }).lean();
    let project = null;

    if (!org) {
      project = await Project.findOne({ qrToken: token }).lean();
      if (!project) return res.status(404).json({ success: false, message: "Invalid or expired QR code" });
      org = await Organization.findById(project.orgId).lean();
    }

    if (!org?.isActive) {
      return res.status(403).json({ success: false, message: "Organization is inactive" });
    }

    // Auto-assign via round-robin if enabled
    let assignedTo = null;
    let assignedToName = "";
    if (org.autoAssign !== false) {
      try {
        const assignee = await getNextAssignee(org._id);
        assignedTo = assignee._id;
        assignedToName = assignee.name;
      } catch { /* no agents configured */ }
    }

    const notes = [];
    if (message?.trim()) notes.push({ text: message.trim(), addedByName: "QR Form" });
    if (project) notes.push({ text: `Interested in project: ${project.name}`, addedByName: "QR Form" });

    const lead = await Lead.create({
      name: name.trim(),
      phone: phone.trim(),
      email: email?.trim() || "",
      budget: { min: budget ? Number(budget) : 0, max: budget ? Number(budget) : 0, currency: "INR" },
      propertyType: propertyType || "Apartment",
      source: "QR Code",
      orgId: org._id,
      assignedTo,
      assignedToName,
      notes,
      activities: [{
        type: "created",
        description: `Lead submitted via QR code${project ? ` for ${project.name}` : ""}`,
        performedByName: "QR Form",
        meta: {},
      }],
    });

    sendPushToAll({
      type: "new_lead",
      title: `New QR Lead: ${lead.name}`,
      body: project ? `Interested in ${project.name}` : "Submitted via QR code",
      data: { source: "QR Code" },
    }, org._id).catch(() => {});

    res.status(201).json({ success: true, message: "Your details have been submitted. We'll be in touch soon!" });
  } catch (err) {
    next(err);
  }
}

module.exports = { getForm, submitLead };
