// routes/projectRoutes.js
const express = require("express");
const router = express.Router();
const projectController = require("../controllers/projectController");
const { protect, authorize } = require("../middlewares/auth");
const { planGate } = require("../middlewares/planGate");

// Project pipelines are a Growth feature ("Multiple project pipelines").
// Leads do not depend on a project, so a Starter org keeps the full lead
// workflow; the callers that fetch projects for a dropdown already swallow the
// failure and render an empty list.
router.use(protect, planGate("growth"));

const ProjectLead = require("../models/ProjectLead");
const Project     = require("../models/Project");

// GET /api/projects/stats — per-project lead counts + pipeline value (admin/manager only)
router.get("/stats", authorize("admin", "manager"), async (req, res, next) => {
  try {
    const projects = await Project.find({ orgId: req.user.orgId, isArchived: { $ne: true } })
      .select("name location priceMin priceMax")
      .lean();

    const counts = await ProjectLead.aggregate([
      { $match: { orgId: req.user.orgId } },
      {
        $group: {
          _id: "$projectId",
          total: { $sum: 1 },
          closedWon: { $sum: { $cond: [{ $eq: ["$status", "Closed Won"] }, 1, 0] } },
        },
      },
    ]);

    const countMap = {};
    counts.forEach((c) => { countMap[String(c._id)] = c; });

    const stats = projects.map((p) => {
      const c = countMap[String(p._id)] || { total: 0, closedWon: 0 };
      return {
        _id: p._id,
        name: p.name,
        location: p.location,
        priceMin: p.priceMin,
        priceMax: p.priceMax,
        totalLeads: c.total,
        closedWon: c.closedWon,
        conversionRate: c.total > 0 ? Math.round((c.closedWon / c.total) * 100) : 0,
      };
    });

    res.json({ data: stats.sort((a, b) => b.totalLeads - a.totalLeads) });
  } catch (e) { next(e); }
});

// Project CRUD
router.get("/",    projectController.getAll);
router.post("/",   authorize("admin", "manager"), projectController.create);
router.get("/:id", projectController.getById);
router.put("/:id", authorize("admin", "manager"), projectController.update);
router.delete("/:id", authorize("admin", "manager"), projectController.remove);

// A PDF has no business sitting as base64 inside the Project document the
// way a compressed thumbnail does — this uploads it to B2 like an org logo
// and stores only the resulting URL. Same admin/manager gate as PUT /:id,
// since a brochure is exactly the kind of thing that ends up in a customer's
// hands via the AI agent (see shareBrochure on WaAgent).
router.post("/:id/brochure", authorize("admin", "manager"), async (req, res, next) => {
  try {
    const { dataUri } = req.body || {};
    if (!dataUri) return res.status(400).json({ success: false, message: "dataUri is required." });
    if (!dataUri.startsWith("data:application/pdf")) {
      return res.status(400).json({ success: false, message: "Only PDF files are accepted for a brochure." });
    }
    const project = await Project.findOne({ _id: req.params.id, orgId: req.user.orgId, isArchived: { $ne: true } });
    if (!project) return res.status(404).json({ success: false, message: "Project not found." });

    const { uploadProjectBrochure } = require("../utils/upload");
    const url = await uploadProjectBrochure(dataUri, project._id.toString());
    project.brochureUrl = url;
    await project.save();
    res.json({ success: true, brochureUrl: url });
  } catch (err) { next(err); }
});

router.delete("/:id/brochure", authorize("admin", "manager"), async (req, res, next) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, orgId: req.user.orgId, isArchived: { $ne: true } });
    if (!project) return res.status(404).json({ success: false, message: "Project not found." });
    const { deleteProjectBrochure } = require("../utils/upload");
    await deleteProjectBrochure(project._id.toString());
    project.brochureUrl = "";
    await project.save();
    res.json({ success: true });
  } catch (err) { next(err); }
});

// Floor plan: same shape as the brochure — a single PDF sent to customers.
router.post("/:id/floorplan", authorize("admin", "manager"), async (req, res, next) => {
  try {
    const { dataUri } = req.body || {};
    if (!dataUri) return res.status(400).json({ success: false, message: "dataUri is required." });
    if (!dataUri.startsWith("data:application/pdf")) {
      return res.status(400).json({ success: false, message: "Only PDF files are accepted for a floor plan." });
    }
    const project = await Project.findOne({ _id: req.params.id, orgId: req.user.orgId, isArchived: { $ne: true } });
    if (!project) return res.status(404).json({ success: false, message: "Project not found." });
    const { uploadProjectFloorPlan } = require("../utils/upload");
    project.floorPlanUrl = await uploadProjectFloorPlan(dataUri, project._id.toString());
    await project.save();
    res.json({ success: true, floorPlanUrl: project.floorPlanUrl });
  } catch (err) { next(err); }
});

router.delete("/:id/floorplan", authorize("admin", "manager"), async (req, res, next) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, orgId: req.user.orgId, isArchived: { $ne: true } });
    if (!project) return res.status(404).json({ success: false, message: "Project not found." });
    const { deleteProjectFloorPlan } = require("../utils/upload");
    await deleteProjectFloorPlan(project._id.toString());
    project.floorPlanUrl = "";
    await project.save();
    res.json({ success: true });
  } catch (err) { next(err); }
});

// Videos: the raw file is the request body (Content-Type: video/*), not a
// base64 JSON payload — the global JSON limit is 8MB and base64 adds a third.
// prepareVideo enforces the policy: <=10MB as-is, 10-20MB compressed to fit
// 10MB, >20MB rejected. WhatsApp only takes MP4 up to 16MB.
const MAX_VIDEOS_PER_PROJECT = 3;
router.post("/:id/videos", authorize("admin", "manager"),
  express.raw({ type: ["video/*", "application/octet-stream"], limit: "21mb" }),
  async (req, res, next) => {
    try {
      const project = await Project.findOne({ _id: req.params.id, orgId: req.user.orgId, isArchived: { $ne: true } });
      if (!project) return res.status(404).json({ success: false, message: "Project not found." });
      if ((project.videos || []).length >= MAX_VIDEOS_PER_PROJECT) {
        return res.status(400).json({ success: false, message: `A project can have up to ${MAX_VIDEOS_PER_PROJECT} videos. Remove one first.` });
      }
      const { prepareVideo, VideoError } = require("../utils/videoCompress");
      let prepared;
      try {
        prepared = await prepareVideo(Buffer.isBuffer(req.body) ? req.body : null);
      } catch (err) {
        if (err instanceof VideoError) return res.status(err.statusCode).json({ success: false, message: err.message });
        throw err;
      }
      const { uploadProjectVideo } = require("../utils/upload");
      const url = await uploadProjectVideo(prepared.buffer, project._id.toString());
      project.videos.push({ url, sizeBytes: prepared.sizeBytes, durationSec: Math.round(prepared.durationSec) });
      await project.save();
      res.json({
        success: true, videos: project.videos,
        compressed: prepared.compressed, originalBytes: prepared.originalBytes, sizeBytes: prepared.sizeBytes,
      });
    } catch (err) { next(err); }
  });

router.delete("/:id/videos", authorize("admin", "manager"), async (req, res, next) => {
  try {
    const url = req.body?.url || req.query.url;
    const project = await Project.findOne({ _id: req.params.id, orgId: req.user.orgId, isArchived: { $ne: true } });
    if (!project) return res.status(404).json({ success: false, message: "Project not found." });
    const before = project.videos.length;
    project.videos = project.videos.filter((v) => v.url !== url);
    if (project.videos.length === before) return res.status(404).json({ success: false, message: "Video not found." });
    await project.save();
    const { deleteProjectVideo } = require("../utils/upload");
    await deleteProjectVideo(url);
    res.json({ success: true, videos: project.videos });
  } catch (err) { next(err); }
});

// Project leads - specific paths before :leadId
router.post("/:id/leads/import", authorize("admin", "manager"), projectController.importLeads);
router.get("/:id/leads",          projectController.getLeads);
router.post("/:id/leads/:leadId/notes",   projectController.addNote);
router.patch("/:id/leads/:leadId/notes/:noteId",  projectController.updateNote);
router.delete("/:id/leads/:leadId/notes/:noteId", projectController.deleteNote);
router.patch("/:id/leads/:leadId/remark", projectController.updateRemark);
router.delete("/:id/leads/bulk", projectController.bulkDeleteLeads);
router.patch("/:id/leads/bulk-status",    projectController.bulkUpdateStatus);
router.patch("/:id/leads/:leadId",        projectController.updateLeadFields);
router.post("/:id/leads/:leadId/transfer", projectController.transferLead);
router.delete("/:id/leads/:leadId", projectController.deleteLead);

// POST /api/projects/:id/leads/:leadId/draft-message — AI WhatsApp draft for project leads
router.post("/:id/leads/:leadId/draft-message", async (req, res, next) => {
  try {
    const { draftWhatsAppMessage } = require("../utils/openai");
    const AiUsage = require("../models/AiUsage");
    const ProjectLead = require("../models/ProjectLead");

    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({ success: false, message: "AI drafting is not configured. Ask your admin to set the OPENAI_API_KEY." });
    }

    // Confirm the project belongs to the caller's org before reading a lead
    // out of it. Matching on :id alone let any authenticated Growth user pull
    // another tenant's lead by id — and because the AI usage below is billed to
    // req.user.orgId, it did so without leaving a trace on the victim's org.
    //
    // The check goes through the parent project rather than ProjectLead.orgId
    // because that field is not backfilled on older lead documents (see
    // projectService.updateRemark, which scopes the same way).
    const project = await Project.findOne({ _id: req.params.id, orgId: req.orgId })
      .select("_id").lean();
    if (!project) return res.status(404).json({ success: false, message: "Project not found." });

    const lead = await ProjectLead.findOne({ _id: req.params.leadId, project: project._id }).lean();
    if (!lead) return res.status(404).json({ success: false, message: "Lead not found." });

    const agentName = req.user.name || "";
    const result = await draftWhatsAppMessage(lead, agentName);

    const month = new Date().toISOString().slice(0, 7);
    AiUsage.findOneAndUpdate(
      { orgId: req.user.orgId, month },
      { $inc: { calls: 1, waDraftCalls: 1, totalTokens: result._usage?.total_tokens || 0, waDraftTokens: result._usage?.total_tokens || 0 } },
      { upsert: true, new: true }
    ).catch(() => {});

    res.json({ success: true, message: result.message });
  } catch (err) {
    next(err);
  }
});

// POST /api/projects/:id/qr-token — generate / regenerate project QR token (admin/manager)
router.post("/:id/qr-token", authorize("admin", "manager"), async (req, res, next) => {
  try {
    const crypto = require("crypto");
    const Project = require("../models/Project");
    const token = crypto.randomBytes(16).toString("hex");
    const project = await Project.findOneAndUpdate(
      { _id: req.params.id, orgId: req.orgId },
      { qrToken: token },
      { new: true }
    );
    if (!project) return res.status(404).json({ success: false, message: "Project not found" });
    res.json({ success: true, qrToken: project.qrToken });
  } catch (err) { next(err); }
});

// GET /api/projects/:id/qr-token — fetch current project QR token (admin/manager)
router.get("/:id/qr-token", authorize("admin", "manager"), async (req, res, next) => {
  try {
    const Project = require("../models/Project");
    const project = await Project.findOne({ _id: req.params.id, orgId: req.orgId }).select("qrToken").lean();
    if (!project) return res.status(404).json({ success: false, message: "Project not found" });
    res.json({ success: true, qrToken: project.qrToken || "" });
  } catch (err) { next(err); }
});

module.exports = router;
