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

// Project leads — specific paths before :leadId
router.post("/:id/leads/import", authorize("admin", "manager"), projectController.importLeads);
router.get("/:id/leads",          projectController.getLeads);
router.patch("/:id/leads/:leadId/remark", projectController.updateRemark);
router.delete("/:id/leads/bulk", projectController.bulkDeleteLeads);
router.patch("/:id/leads/:leadId",        projectController.updateLeadFields);
router.post("/:id/leads/:leadId/transfer", projectController.transferLead);
router.delete("/:id/leads/:leadId", projectController.deleteLead);

module.exports = router;
