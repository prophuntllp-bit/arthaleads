const followupService = require("../services/followupService");

const followupController = {
  async get(req, res, next) {
    try {
      const { section = "present", from, to, page, limit, sort } = req.query;
      const result = await followupService.get(req.user, { section, from, to, page, limit, sort });
      res.json({ success: true, ...result });
    } catch (err) { next(err); }
  },
};

module.exports = followupController;
