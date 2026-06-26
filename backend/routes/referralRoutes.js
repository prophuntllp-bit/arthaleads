// routes/referralRoutes.js
const express = require("express");
const router  = express.Router();
const { protect } = require("../middlewares/auth");
const Organization = require("../models/Organization");

// GET /api/referrals/mine — list orgs referred by the current user's org
router.get("/mine", protect, async (req, res, next) => {
  try {
    const orgId = req.user.orgId;

    const referred = await Organization.find({ referredBy: orgId })
      .select("name slug plan referralRewardAt createdAt")
      .sort({ createdAt: -1 })
      .lean();

    const now = Date.now();
    const list = referred.map((o) => {
      let status;
      if (o.plan === "trial") {
        status = "signed_up";
      } else if (!o.referralRewardAt) {
        status = "subscribed";          // paid, reward not yet scheduled (manual flow)
      } else if (new Date(o.referralRewardAt).getTime() > now) {
        status = "reward_pending";      // reward scheduled, 7-day window not over
      } else {
        status = "rewarded";            // 7 days elapsed — reward credited
      }
      return {
        _id:              o._id,
        name:             o.name,
        plan:             o.plan,
        status,
        referralRewardAt: o.referralRewardAt,
        joinedAt:         o.createdAt,
      };
    });

    // Summary counts
    const summary = {
      total:         list.length,
      subscribed:    list.filter(r => r.status !== "signed_up").length,
      rewarded:      list.filter(r => r.status === "rewarded").length,
      rewardPending: list.filter(r => r.status === "reward_pending" || r.status === "subscribed").length,
    };

    res.json({ success: true, data: { list, summary } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
