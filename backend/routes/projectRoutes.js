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
