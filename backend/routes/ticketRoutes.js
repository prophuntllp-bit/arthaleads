// routes/ticketRoutes.js - support ticket routes for authenticated users
const express = require("express");
const router  = express.Router();
const { protect } = require("../middlewares/auth");
const ctrl = require("../controllers/ticketController");

router.use(protect);

router.post("/",   ctrl.create);   // POST /api/tickets
router.get("/",    ctrl.listMine); // GET  /api/tickets

module.exports = router;
