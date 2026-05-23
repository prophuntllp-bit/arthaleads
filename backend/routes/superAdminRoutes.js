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

// POST /api/super-admin/migrate-logos
// One-time migration: uploads all base64 org logos to Cloudinary.
// Safe to call multiple times — skips orgs that already have Cloudinary URLs.
router.post("/migrate-logos", ctrl.migrateLogos);

module.exports = router;
