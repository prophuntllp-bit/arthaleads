const { Resend } = require("resend");
const logger = require("../config/logger");

function getResend() {
  if (!process.env.RESEND_API_KEY) throw new Error("RESEND_API_KEY not set");
  return new Resend(process.env.RESEND_API_KEY);
}

const { layout, panel, row, paragraph, esc, nl2br, HEADING, BRAND } = require("../utils/emailLayout");

const link = (href, text) => `<a href="${href}" style="color:${BRAND};text-decoration:none;">${text}</a>`;

const FROM_ADDRESS = process.env.SMTP_FROM || "Arthaleads <onboarding@resend.dev>";
const HR_EMAIL = "prophuntllp@gmail.com";
const YEAR = new Date().getFullYear();

function sanitize(str, maxLen = 200) {
  return String(str || "")
    .replace(/<[^>]*>/g, "")
    .replace(/[\r\n]{3,}/g, "\n\n")
    .trim()
    .slice(0, maxLen);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

async function submitApplication(req, res) {
  const raw = req.body || {};

  const name           = sanitize(raw.name,           100);
  const email          = sanitize(raw.email,          254);
  const phone          = sanitize(raw.phone,           20);
  const role           = sanitize(raw.role,           120);
  const linkedin       = sanitize(raw.linkedin,       300);
  const experience     = sanitize(raw.experience,      50);
  const note           = sanitize(raw.note,          2000);
  const resumeBase64   = typeof raw.resumeBase64 === "string" ? raw.resumeBase64 : null;
  const resumeFilename = sanitize(raw.resumeFilename, 120) || "resume";
  const resumeMime     = sanitize(raw.resumeMime,      80);

  if (!name || !email || !role || !linkedin) {
    return res.status(400).json({ success: false, message: "Name, email, LinkedIn, and role are required." });
  }
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ success: false, message: "Invalid email address." });
  }
  if (!resumeBase64) {
    return res.status(400).json({ success: false, message: "Resume attachment is required." });
  }
  if (resumeMime && !ALLOWED_MIME.has(resumeMime)) {
    return res.status(400).json({ success: false, message: "Resume must be a PDF, DOC, or DOCX file." });
  }
  // Guard against oversized payloads slipping through (5 MB base64 ≈ 6.7 MB string)
  if (resumeBase64.length > 7 * 1024 * 1024) {
    return res.status(400).json({ success: false, message: "Resume file is too large (max 5 MB)." });
  }

  try {
    const resend = getResend();

    const rows = [
      ["Role Applied For", role],
      ["Full Name", name],
      ["Email", email],
      phone      ? ["Phone", phone]              : null,
      experience ? ["Experience", experience]    : null,
      linkedin   ? ["LinkedIn / Portfolio", `<a href="${linkedin}" style="color:#ff6b00;text-decoration:none;">${linkedin}</a>`] : null,
    ].filter(Boolean);

    // Both of these used to carry their own full copy of the markup, which is
    // how they ended up looking like a different product from every other
    // Arthaleads email. They are built from the shared layout now.
    const html = layout({
      preheader: `${name} applied for ${role}.`,
      eyebrow: "Careers",
      title: `New application — ${role}`,
      bodyHtml: `
        ${paragraph(`${esc(name)} applied for ${esc(role)}. The résumé is attached.`)}
        ${panel(
          row("Name", name) +
          row("Email", email) +
          (phone ? row("Phone", phone) : "") +
          (experience ? row("Experience", experience) : "") +
          (linkedin ? row("LinkedIn", linkedin) : "") +
          row("Role", role, true)
        )}
        ${note ? paragraph(`<strong style="color:${HEADING};">Cover note</strong><br />${nl2br(esc(note))}`) : ""}`,
      footerNote: "Sent to Arthaleads hiring.",
    });

    const confirmHtml = layout({
      preheader: `We have your application for ${role}.`,
      eyebrow: "Application received",
      title: "Your application is with us",
      bodyHtml: `
        ${paragraph(`Hi ${esc(name)}, thanks for applying for ${esc(role)} at Arthaleads.`)}
        ${paragraph("Our team will review it and come back to you within 48 hours.")}
        ${paragraph(`Questions? Reply to this email, or reach us at ${link("mailto:hr@arthaleads.com", "hr@arthaleads.com")}.`)}`,
      footerNote: "You applied via arthaleads.com/careers.",
    });

    await Promise.all([
      resend.emails.send({
        from:    FROM_ADDRESS,
        to:      HR_EMAIL,
        replyTo: email,
        subject: `Job Application: ${role} — ${name}`,
        html,
        text: `New Job Application\n\nRole: ${role}\nName: ${name}\nEmail: ${email}${phone ? `\nPhone: ${phone}` : ""}${experience ? `\nExperience: ${experience}` : ""}${linkedin ? `\nLinkedIn: ${linkedin}` : ""}${note ? `\n\nCover Note:\n${note}` : ""}\n\nResume attached.`,
        attachments: [{
          filename:     resumeFilename,
          content:      Buffer.from(resumeBase64, "base64"),
          content_type: resumeMime || "application/octet-stream",
        }],
      }),
      resend.emails.send({
        from:    FROM_ADDRESS,
        to:      email,
        subject: `Application received — ${role} | Arthaleads`,
        html:    confirmHtml,
        text:    `Hi ${name},\n\nYour application is with us!\n\nWe've received your application for ${role} at Arthaleads. Our team will review it and get back to you within 48 hours.\n\nQuestions? Reply to this email or reach us at hr@arthaleads.com.\n\n© ${YEAR} Arthaleads · Pune, India`,
      }),
    ]);

    logger.info(`[careers] Application from ${email} for "${role}"`);
    res.json({ success: true, message: "Application submitted successfully." });
  } catch (err) {
    logger.error(`[careers] Failed to send application: ${err.message}`);
    res.status(500).json({ success: false, message: "Failed to submit application. Please try again." });
  }
}

module.exports = { submitApplication };
