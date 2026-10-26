// controllers/demoRequestController.js - "Book a Demo" requests from /book-demo.
//
// Public submit (reCAPTCHA + rate limit in server.js), stored as a DemoRequest,
// the team and super admins alerted by email, the visitor sent a confirmation.
// Super admins list and update them under /api/super-admin/demo-requests.
// (Live from the 26 Oct 2026 website release.)
const DemoRequest = require("../models/DemoRequest");
const { STATUSES } = require("../models/DemoRequest");
const { checkRecaptcha } = require("../utils/recaptcha");
const email = require("../utils/email");
const logger = require("../config/logger");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Allowed answers for the choice questions; anything else is rejected, so the
// admin list never fills with free text from a tampered request.
const CHOICES = {
  role: ["Owner / Director", "Sales head", "Marketing", "Broker", "Other"],
  businessType: ["Builder / Developer", "Broker", "Channel partner"],
  teamSize: ["1-5", "6-10", "11-30", "31-100", "100+"],
  monthlyLeads: ["", "Under 100", "100-500", "500-2,000", "2,000+"],
  preferredTime: ["", "Morning (10 AM-1 PM)", "Afternoon (2-5 PM)", "Evening (5-7 PM)"],
  format: ["", "Video call", "Phone call", "In person (Pune)"],
  language: ["", "English", "Hindi", "Marathi"],
};
const SOURCES = ["Facebook", "Google", "WhatsApp", "Website", "Property portals", "Walk-ins"];

const clean = (v, max = 200) => String(v ?? "").replace(/<[^>]*>/g, "").replace(/[\r\n]{3,}/g, "\n\n").trim().slice(0, max);

async function submitDemoRequest(req, res) {
  const raw = req.body || {};
  const verdict = await checkRecaptcha(raw.recaptchaToken, "demo");
  if (verdict === "bot") {
    return res.status(400).json({ success: false, message: "Verification failed. Please refresh and try again." });
  }

  const r = {
    name: clean(raw.name, 100),
    email: clean(raw.email, 254).toLowerCase(),
    phone: clean(raw.phone, 20),
    city: clean(raw.city, 80),
    company: clean(raw.company, 120),
    role: clean(raw.role, 60),
    businessType: clean(raw.businessType, 60),
    teamSize: clean(raw.teamSize, 20),
    monthlyLeads: clean(raw.monthlyLeads, 20),
    leadSources: (Array.isArray(raw.leadSources) ? raw.leadSources : []).map((s) => clean(s, 40)).filter((s) => SOURCES.includes(s)),
    currentTool: clean(raw.currentTool, 120),
    preferredDate: /^\d{4}-\d{2}-\d{2}$/.test(String(raw.preferredDate || "")) ? String(raw.preferredDate) : "",
    preferredTime: clean(raw.preferredTime, 30),
    format: clean(raw.format, 30),
    language: clean(raw.language, 20),
    message: clean(raw.message, 2000),
    source: clean(raw.source, 200),
  };

  const missing = ["name", "email", "phone", "city", "company", "role", "businessType", "teamSize"].filter((k) => !r[k]);
  if (missing.length) return res.status(400).json({ success: false, message: "Please fill in all the required fields." });
  if (!EMAIL_RE.test(r.email)) return res.status(400).json({ success: false, message: "Please enter a valid email address." });
  if ((r.phone.match(/\d/g) || []).length < 10) return res.status(400).json({ success: false, message: "Please enter a valid mobile number." });
  for (const [k, allowed] of Object.entries(CHOICES)) {
    if (!allowed.includes(r[k])) return res.status(400).json({ success: false, message: "Please choose from the options given." });
  }

  try {
    const doc = await DemoRequest.create(r);
    logger.info(`[demo] request ${doc._id} from ${r.email} (${r.company})`);
    // Emails must not decide whether the visitor sees success: the request is saved.
    email.notifyDemoRequest(r).catch((e) => logger.error(`[demo] team alert failed: ${e.message}`));
    email.sendDemoRequestConfirmation(r).catch((e) => logger.error(`[demo] confirmation failed: ${e.message}`));
    res.status(201).json({ success: true });
  } catch (err) {
    logger.error(`[demo] save failed: ${err.message}`);
    res.status(500).json({ success: false, message: "Could not send your request. Please try again." });
  }
}

// GET /api/super-admin/demo-requests?status=new
async function listDemoRequests(req, res, next) {
  try {
    const filter = STATUSES.includes(req.query.status) ? { status: req.query.status } : {};
    const [items, counts] = await Promise.all([
      DemoRequest.find(filter).sort({ createdAt: -1 }).limit(500).populate("handledBy", "name").lean(),
      DemoRequest.aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }]),
    ]);
    res.json({ success: true, items, counts: Object.fromEntries(counts.map((c) => [c._id, c.n])) });
  } catch (err) { next(err); }
}

// PATCH /api/super-admin/demo-requests/:id  { status?, notes? }
async function updateDemoRequest(req, res, next) {
  try {
    const set = { handledBy: req.user._id, handledAt: new Date() };
    if (req.body.status !== undefined) {
      if (!STATUSES.includes(req.body.status)) return res.status(400).json({ success: false, message: "Unknown status." });
      set.status = req.body.status;
    }
    if (req.body.notes !== undefined) set.notes = clean(req.body.notes, 2000);
    const doc = await DemoRequest.findByIdAndUpdate(req.params.id, set, { new: true }).populate("handledBy", "name").lean();
    if (!doc) return res.status(404).json({ success: false, message: "Request not found." });
    res.json({ success: true, item: doc });
  } catch (err) { next(err); }
}

module.exports = { submitDemoRequest, listDemoRequests, updateDemoRequest, CHOICES, SOURCES };
