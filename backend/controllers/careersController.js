const { Resend } = require("resend");
const logger = require("../config/logger");

function getResend() {
  if (!process.env.RESEND_API_KEY) throw new Error("RESEND_API_KEY not set");
  return new Resend(process.env.RESEND_API_KEY);
}

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

    const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#f0ede8;font-family:'Segoe UI',Inter,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0ede8;padding:48px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;">

        <tr>
          <td align="center" style="padding-bottom:24px;">
            <img src="https://www.arthaleads.com/logo.png" alt="Arthaleads" width="48" height="48"
              style="display:inline-block;border-radius:14px;border:0;" />
            <br/>
            <span style="display:inline-block;margin-top:10px;color:#111113;font-weight:800;font-size:20px;">Artha<span style="color:#ff6b00;">leads</span></span>
          </td>
        </tr>

        <tr>
          <td style="background:#1e1d20;border-radius:24px;border:1px solid rgba(255,107,0,0.18);box-shadow:0 20px 60px rgba(0,0,0,0.22);overflow:hidden;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:linear-gradient(160deg,rgba(255,107,0,0.12) 0%,rgba(30,29,32,0) 55%);padding:36px 40px 28px;border-bottom:1px solid rgba(255,255,255,0.06);">
                  <table cellpadding="0" cellspacing="0" style="margin:0 0 22px;">
                    <tr>
                      <td style="background:rgba(255,107,0,0.12);border:1px solid rgba(255,107,0,0.22);border-radius:14px;width:52px;height:52px;text-align:center;vertical-align:middle;">
                        <span style="font-size:24px;line-height:1;">💼</span>
                      </td>
                    </tr>
                  </table>
                  <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#ff6b00;text-transform:uppercase;letter-spacing:0.14em;">New Job Application</p>
                  <h1 style="margin:0 0 10px;font-size:24px;font-weight:800;color:#ededed;letter-spacing:-0.5px;line-height:1.25;">${role}</h1>
                  <p style="margin:0;font-size:13px;color:#969696;line-height:1.65;">
                    A new candidate has applied via <strong style="color:#ff8a3d;">arthaleads.com/careers</strong>
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding:32px 40px 36px;">
                  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:${note ? "24px" : "0"};">
                    <tr>
                      <td style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);border-radius:14px;padding:20px;">
                        <table width="100%" cellpadding="0" cellspacing="0">
                          ${rows.map(([lbl, val], i) => `
                          <tr>
                            <td style="font-size:12px;color:#666;padding-right:16px;padding-bottom:${i < rows.length - 1 ? "12px" : "0"};vertical-align:top;white-space:nowrap;">${lbl}</td>
                            <td style="font-size:13px;font-weight:600;color:#d4d4d4;padding-bottom:${i < rows.length - 1 ? "12px" : "0"};">${val}</td>
                          </tr>`).join("")}
                        </table>
                      </td>
                    </tr>
                  </table>

                  ${note ? `
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);border-radius:14px;padding:18px 20px;">
                        <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:#ff8a3d;text-transform:uppercase;letter-spacing:0.12em;">Cover Note</p>
                        <p style="margin:0;font-size:13px;color:#d4d4d4;line-height:1.75;white-space:pre-wrap;">${note}</p>
                      </td>
                    </tr>
                  </table>` : ""}

                  <p style="margin:24px 0 0;font-size:12px;color:#555;line-height:1.65;">
                    Reply to this email to contact <strong style="color:#969696;">${name}</strong> directly at
                    <a href="mailto:${email}" style="color:#ff6b00;text-decoration:none;">${email}</a>${phone ? ` or call <strong style="color:#969696;">${phone}</strong>` : ""}.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td align="center" style="padding:26px 0 8px;">
            <p style="margin:0 0 4px;font-size:11.5px;color:#999;">© ${YEAR} Arthaleads &nbsp;·&nbsp; Pune, India</p>
            <p style="margin:0;font-size:11px;color:#bbb;">Application submitted via arthaleads.com/careers</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();

    const confirmHtml = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#f0ede8;font-family:'Segoe UI',Inter,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0ede8;padding:48px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;">

        <tr>
          <td align="center" style="padding-bottom:24px;">
            <img src="https://www.arthaleads.com/logo.png" alt="Arthaleads" width="48" height="48"
              style="display:inline-block;border-radius:14px;border:0;" />
            <br/>
            <span style="display:inline-block;margin-top:10px;color:#111113;font-weight:800;font-size:20px;">Artha<span style="color:#ff6b00;">leads</span></span>
          </td>
        </tr>

        <tr>
          <td style="background:#1e1d20;border-radius:24px;border:1px solid rgba(255,107,0,0.18);box-shadow:0 20px 60px rgba(0,0,0,0.22);overflow:hidden;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:linear-gradient(160deg,rgba(255,107,0,0.12) 0%,rgba(30,29,32,0) 55%);padding:36px 40px 28px;border-bottom:1px solid rgba(255,255,255,0.06);">
                  <table cellpadding="0" cellspacing="0" style="margin:0 0 22px;">
                    <tr>
                      <td style="background:rgba(34,197,94,0.12);border:1px solid rgba(34,197,94,0.25);border-radius:14px;width:52px;height:52px;text-align:center;vertical-align:middle;">
                        <span style="font-size:24px;line-height:1;">✅</span>
                      </td>
                    </tr>
                  </table>
                  <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#ff6b00;text-transform:uppercase;letter-spacing:0.14em;">Application Received</p>
                  <h1 style="margin:0 0 10px;font-size:22px;font-weight:800;color:#ededed;letter-spacing:-0.5px;line-height:1.3;">Hi ${name}, your application is with us!</h1>
                  <p style="margin:0;font-size:13px;color:#969696;line-height:1.7;">
                    We've received your application for
                    <strong style="color:#ff8a3d;">${role}</strong>
                    at Arthaleads. Our team will review it and get back to you within <strong style="color:#d4d4d4;">48 hours</strong>.
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding:28px 40px 36px;">
                  <p style="margin:0;font-size:13px;color:#777;line-height:1.75;">
                    Questions? Simply reply to this email — we read every message.<br/>
                    You can also reach us at <a href="mailto:hr@arthaleads.com" style="color:#ff6b00;text-decoration:none;">hr@arthaleads.com</a>.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td align="center" style="padding:26px 0 8px;">
            <p style="margin:0 0 4px;font-size:11.5px;color:#999;">© ${YEAR} Arthaleads &nbsp;·&nbsp; Pune, India</p>
            <p style="margin:0;font-size:11px;color:#bbb;">You applied via arthaleads.com/careers</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();

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
