// routes/attendanceRoutes.js
const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/auth");
const { planGate } = require("../middlewares/planGate");
const ctrl = require("../controllers/attendanceController");

router.use(protect, planGate("growth"));

router.get  ("/status",     ctrl.status);
router.get  ("/team-today", ctrl.teamToday);
router.get  ("/",           ctrl.list);
router.post ("/clockin",    ctrl.clockIn);
router.post ("/clockout",   ctrl.clockOut);

module.exports = router;
