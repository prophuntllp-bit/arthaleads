// Middleware: API key authentication for external integrations (e.g. AI voice platform)
// Set VOICE_API_KEY in Railway environment variables

module.exports = function apiKeyAuth(req, res, next) {
  const key = req.headers["x-api-key"] || req.query.api_key;
  if (!process.env.VOICE_API_KEY) {
    return res.status(503).json({ success: false, message: "Voice API not configured" });
  }
  if (!key || key !== process.env.VOICE_API_KEY) {
    return res.status(401).json({ success: false, message: "Invalid or missing API key" });
  }
  next();
};
