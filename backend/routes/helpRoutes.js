// routes/helpRoutes.js — in-app help assistant (AI fallback)
const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/auth");
const { answerHelpQuestion } = require("../utils/openai");

router.use(protect);

// POST /api/help/ask — { question, page } → { answer }
router.post("/ask", async (req, res, next) => {
  try {
    const question = (req.body.question || "").toString().trim().slice(0, 500);
    const page = (req.body.page || "").toString().slice(0, 60);
    if (!question) return res.status(400).json({ success: false, message: "Please type a question." });

    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({
        success: false,
        message: "The AI assistant isn't configured yet. Try the quick answers, or contact support.",
      });
    }

    const answer = await answerHelpQuestion(question, page);
    res.json({ success: true, answer });
  } catch (err) {
    if (err.message?.includes("OPENAI_API_KEY")) {
      return res.status(503).json({ success: false, message: "The AI assistant isn't configured yet." });
    }
    next(err);
  }
});

module.exports = router;
