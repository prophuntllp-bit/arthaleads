// utils/email.js — Email via Resend HTTP API (no SMTP, works on Railway)
const { Resend } = require("resend");

function getResend() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY environment variable is not set");
  }
  return new Resend(process.env.RESEND_API_KEY);
}

const FROM_ADDRESS = process.env.SMTP_FROM || "Arthaleads <onboarding@resend.dev>";

// ── Password reset email ──────────────────────────────────────────────────────
async function sendPasswordResetEmail(toEmail, toName, resetUrl) {
  const resend = getResend();

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reset your password</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Inter,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:520px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:#0d0d1a;padding:28px 32px;text-align:center;">
              <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td style="vertical-align:middle;padding-right:10px;">
                    <div style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#a04100,#ff6b00);display:inline-block;text-align:center;line-height:36px;">
                      <span style="color:#fff;font-weight:900;font-size:18px;">A</span>
                    </div>
                  </td>
                  <td style="vertical-align:middle;">
                    <span style="color:#ffffff;font-weight:700;font-size:20px;">Artha</span><span style="color:#ff6b00;font-weight:700;font-size:20px;">leads</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 32px 28px;">
              <h1 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#111827;">Reset your password</h1>
              <p style="margin:0 0 20px;font-size:14px;color:#6b7280;line-height:1.6;">
                Hi ${toName || "there"},<br/>
                We received a request to reset the password for your Arthaleads account. Click the button below to set a new password.
              </p>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 24px;">
                    <a href="${resetUrl}"
                      style="display:inline-block;background:#ff6b00;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:12px;">
                      Reset Password →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 8px;font-size:12px;color:#9ca3af;line-height:1.6;">
                This link expires in <strong>1 hour</strong>. If you didn't request a password reset, you can safely ignore this email.
              </p>

              <hr style="border:none;border-top:1px solid #f0f0f0;margin:20px 0;" />

              <p style="margin:0;font-size:11px;color:#d1d5db;word-break:break-all;">
                If the button doesn't work, copy and paste this URL:<br/>
                <a href="${resetUrl}" style="color:#ff6b00;">${resetUrl}</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;padding:16px 32px;text-align:center;border-top:1px solid #f0f0f0;">
              <p style="margin:0;font-size:11px;color:#9ca3af;">
                © ${new Date().getFullYear()} Arthaleads · Prophunt LLP · Pune, India
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const { data, error } = await resend.emails.send({
    from:    FROM_ADDRESS,
    to:      toEmail,
    subject: "Reset your Arthaleads password",
    html,
    text: `Hi ${toName || "there"},\n\nReset your Arthaleads password:\n${resetUrl}\n\nThis link expires in 1 hour.\n\n— Arthaleads Team`,
  });

  if (error) throw new Error(error.message || "Resend API error");
  return data;
}

module.exports = { sendPasswordResetEmail };
