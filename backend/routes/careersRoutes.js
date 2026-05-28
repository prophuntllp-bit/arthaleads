const express = require("express");
const router  = express.Router();
const { submitApplication } = require("../controllers/careersController");

router.post("/apply", submitApplication);

module.exports = router;
