const express = require("express");
const router = express.Router();
const taskController = require("../controllers/taskController");
const { protect, authorize } = require("../middlewares/auth");

router.use(protect);

router.get("/",           taskController.list);
router.post("/",          authorize("admin", "manager"), taskController.create);
router.patch("/:id",      authorize("admin", "manager"), taskController.update);
router.delete("/:id",     authorize("admin", "manager"), taskController.remove);
router.patch("/:id/complete", taskController.complete);

module.exports = router;
