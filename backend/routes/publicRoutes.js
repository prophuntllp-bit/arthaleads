const express = require("express");
const router = express.Router();
const { getForm, submitLead } = require("../controllers/publicController");

router.get("/form/:token", getForm);
router.post("/form/:token", submitLead);

module.exports = router;
