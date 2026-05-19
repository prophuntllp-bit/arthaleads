const { Resend } = require("resend");
const logger = require("../config/logger");

function getResend() {
  if (!process.env.RESEND_API_KEY) throw new Error("RESEND_API_KEY not set");
  return new Resend(process.env.RESEND_API_KEY);
}

const FROM_ADDRESS = process.env.SMTP_FROM || "Arthaleads <onboarding@resend.dev>";
const CONTACT_EMAIL = "contact@arthaleads.com";
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

    const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
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
                        <span style="font-size:24px;line-height:1;">✉️</span>
                      </td>
                    </tr>
                  </table>
                  <h1 style="margin:0 0 10px;font-size:26px;font-weight:800;color:#ededed;letter-spacing:-0.5px;line-height:1.2;">New Contact Form Submission</h1>
                  <p style="margin:0;font-size:14px;color:#969696;line-height:1.65;">
                    Someone has submitted the contact form on <strong style="color:#ff8a3d;">arthaleads.com</strong>.
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding:32px 40px 36px;">
                  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                    <tr>
                      <td style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);border-radius:14px;padding:20px 20px;">
                        <table width="100%" cellpadding="0" cellspacing="0">
                          ${[
                            ["Name", name],
                            ["Email", email],
                            phone ? ["Phone", phone] : null,
                            company ? ["Company", company] : null,
                          ].filter(Boolean).map(([lbl, val], i, arr) => `
                          <tr>
                            <td style="font-size:12px;color:#666;padding-right:16px;padding-bottom:${i < arr.length - 1 ? "12px" : "0"};vertical-align:top;white-space:nowrap;">${lbl}</td>
                            <td style="font-size:13px;font-weight:600;color:#d4d4d4;padding-bottom:${i < arr.length - 1 ? "12px" : "0"};">${val}</td>
                          </tr>`).join("")}
                        </table>
                      </td>
                    </tr>
                  </table>

                  ${message?.trim() ? `
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);border-radius:14px;padding:18px 20px;">
                        <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:#ff8a3d;text-transform:uppercase;letter-spacing:0.12em;">Message</p>
                        <p style="margin:0;font-size:13px;color:#d4d4d4;line-height:1.75;white-space:pre-wrap;">${message.trim()}</p>
                      </td>
                    </tr>
                  </table>` : ""}

                  <p style="margin:24px 0 0;font-size:12px;color:#555;line-height:1.65;">
                    Reply directly to this email to respond to <strong style="color:#969696;">${name}</strong> at <a href="mailto:${email}" style="color:#ff6b00;text-decoration:none;">${email}</a>.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td align="center" style="padding:26px 0 8px;">
            <p style="margin:0 0 4px;font-size:11.5px;color:#999;">© ${YEAR} Arthaleads &nbsp;·&nbsp; Prophunt LLP &nbsp;·&nbsp; Pune, India</p>
            <p style="margin:0;font-size:11px;color:#bbb;">This message was sent via the contact form on arthaleads.com</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();

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
