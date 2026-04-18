const express = require("express");
const automationController = require("../controllers/automationController");
const { protect, authorize } = require("../middlewares/auth");
const validate = require("../middlewares/validate");
const { createAutomationSchema, updateAutomationSchema } = require("../validations/schemas");

const router = express.Router();

router.get("/facebook/connect", automationController.facebookConnect);
router.get("/facebook/callback", automationController.facebookCallback);
router.get("/facebook/result", automationController.getFacebookResult);

router.use(protect, authorize("admin", "manager"));

router.get("/website/token", automationController.getWebsiteToken);
router.post("/website/create", automationController.createWebsiteConnection);

router.route("/")
  .get(automationController.list)
  .post(validate(createAutomationSchema), automationController.create);

router.route("/:id")
  .patch(validate(updateAutomationSchema), automationController.update)
  .delete(automationController.remove);

module.exports = router;
