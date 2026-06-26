const express = require("express");
const router = express.Router();
const followupController = require("../controllers/followupController");
const { protect } = require("../middlewares/auth");

router.use(protect);
router.get("/", followupController.get);

module.exports = router;
