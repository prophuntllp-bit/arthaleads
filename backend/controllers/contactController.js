const { Resend } = require("resend");
const logger = require("../config/logger");
const { verifyRecaptcha } = require("../utils/recaptcha");

function getResend() {
  if (!process.env.RESEND_API_KEY) throw new Error("RESEND_API_KEY not set");
  return new Resend(process.env.RESEND_API_KEY);
}

const { layout, panel, row, paragraph, esc, nl2br, HEADING, MUTED } = require("../utils/emailLayout");
const FROM_ADDRESS = process.env.SMTP_FROM || "Arthaleads <onboarding@resend.dev>";
const CONTACT_EMAIL = "prophuntllp@gmail.com";
const YEAR = new Date().getFullYear();

// Strip HTML tags and dangerous chars from user input
function sanitize(str, maxLen = 200) {
  return String(str || "")
    .replace(/<[^>]*>/g, "")          // strip HTML tags
    .replace(/[\r\n]{3,}/g, "\n\n")   // collapse excessive newlines
    .trim()
    .slice(0, maxLen);
}

// Simple RFC-5322 email check
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

async function sendContactForm(req, res) {
  const raw = req.body || {};

  const ok = await verifyRecaptcha(raw.recaptchaToken, "contact");
  if (!ok) return res.status(400).json({ success: false, message: "Verification failed. Please refresh and try again." });

  const name    = sanitize(raw.name,    100);
  const email   = sanitize(raw.email,   254);
  const phone   = sanitize(raw.phone,   20);
  const company = sanitize(raw.company, 100);
  const message = sanitize(raw.message, 2000);

  if (!name || !email) {
    return res.status(400).json({ success: false, message: "Name and email are required." });
  }
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ success: false, message: "Invalid email address." });
  }

  try {
    const resend = getResend();

    const html = layout({
      preheader: `${name}${company ? ` (${company})` : ""} sent an enquiry.`,
      eyebrow: "Website enquiry",
      title: `New enquiry from ${name}`,
      bodyHtml: `
        ${panel(
          row("Name", name) +
          row("Email", email) +
          (phone ? row("Phone", phone) : "") +
          (company ? row("Company", company) : "") +
          row("Received", new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }), true)
        )}
        ${message && message.trim() ? paragraph(`<strong style="color:${HEADING};">Message</strong><br />${nl2br(esc(message.trim()))}`) : ""}
        ${paragraph(`Reply to this email to answer ${esc(name)} directly.`, MUTED)}`,
      footerNote: "Sent to the Arthaleads contact inbox.",
    });

    await resend.emails.send({
      from:     FROM_ADDRESS,
      to:       CONTACT_EMAIL,
      replyTo:  email,
      subject:  `New enquiry from ${name}${company ? ` - ${company}` : ""}`,
      html,
      text: `New contact form submission\n\nName: ${name}\nEmail: ${email}${phone ? `\nPhone: ${phone}` : ""}${company ? `\nCompany: ${company}` : ""}${message ? `\n\nMessage:\n${message}` : ""}`,
    });

    logger.info(`[contact] Form submission from ${email} (${name})`);
    res.json({ success: true, message: "Message sent successfully." });
  } catch (err) {
    logger.error(`[contact] Failed to send: ${err.message}`);
    res.status(500).json({ success: false, message: "Failed to send message. Please try again." });
  }
}

module.exports = { sendContactForm };
