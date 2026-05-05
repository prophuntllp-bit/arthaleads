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

module.exports = router;
