// routes/projectRoutes.js
const express = require("express");
const router = express.Router();
const projectController = require("../controllers/projectController");
const { protect, authorize } = require("../middlewares/auth");

router.use(protect);

// Project CRUD
router.get("/",    projectController.getAll);
router.post("/",   authorize("admin", "manager"), projectController.create);
router.get("/:id", projectController.getById);
router.put("/:id", authorize("admin", "manager"), projectController.update);
router.delete("/:id", authorize("admin", "manager"), projectController.remove);

// Project leads - specific paths before :leadId
router.post("/:id/leads/import", authorize("admin", "manager"), projectController.importLeads);
router.get("/:id/leads",          projectController.getLeads);
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

    const lead = await ProjectLead.findOne({ _id: req.params.leadId, project: req.params.id }).lean();
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

module.exports = router;
