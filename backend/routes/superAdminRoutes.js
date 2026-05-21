// routes/superAdminRoutes.js - only accessible by super_admin role
const express = require("express");
const router  = express.Router();
const { protect, authorize } = require("../middlewares/auth");
const ctrl = require("../controllers/superAdminController");

router.use(protect, authorize("super_admin"));

router.get("/orgs",                    ctrl.listOrgs);
router.patch("/orgs/:id",             ctrl.updateOrg);
router.patch("/orgs/:id/logo",        ctrl.updateLogo);
router.patch("/orgs/:id/extend-trial", ctrl.extendTrial);
router.get("/users",                  ctrl.listUsers);
router.post("/backup",                ctrl.triggerBackup);

module.exports = router;
