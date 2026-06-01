// routes/ticketRoutes.js - support ticket routes for authenticated users
const express = require("express");
const router  = express.Router();
const { protect } = require("../middlewares/auth");
const ctrl = require("../controllers/ticketController");

router.use(protect);

router.post("/",           ctrl.create);    // POST /api/tickets
router.get("/",            ctrl.listMine);  // GET  /api/tickets
router.get("/:id",         ctrl.getOne);    // GET  /api/tickets/:id
router.post("/:id/reply",  ctrl.addReply);  // POST /api/tickets/:id/reply

module.exports = router;
