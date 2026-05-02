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
<body style="margin:0;padding:0;background:#f0f0f2;font-family:'Segoe UI',Inter,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f0f2;padding:48px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:520px;">

          <!-- Logo above card -->
          <tr>
            <td align="center" style="padding-bottom:24px;">
              <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td style="vertical-align:middle;padding-right:10px;">
                    <div style="width:40px;height:40px;border-radius:12px;background:linear-gradient(135deg,#b04500,#ff6b00);display:inline-block;text-align:center;line-height:40px;">
                      <span style="color:#fff;font-weight:900;font-size:20px;font-family:'Segoe UI',Arial,sans-serif;">A</span>
                    </div>
                  </td>
                  <td style="vertical-align:middle;">
                    <span style="color:#111827;font-weight:800;font-size:22px;font-family:'Segoe UI',Arial,sans-serif;">Artha</span><span style="color:#ff6b00;font-weight:800;font-size:22px;font-family:'Segoe UI',Arial,sans-serif;">leads</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main card -->
          <tr>
            <td style="background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.10);">

              <!-- Orange accent bar -->
              <div style="height:5px;background:linear-gradient(90deg,#ff6b00,#ff9a40);"></div>

              <!-- Body -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:40px 40px 32px;">

                    <!-- Icon -->
                    <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                      <tr>
                        <td>
                          <div style="width:52px;height:52px;border-radius:16px;background:#fff4ec;text-align:center;line-height:52px;font-size:26px;">
                            🔐
                          </div>
                        </td>
                      </tr>
                    </table>

                    <h1 style="margin:0 0 6px;font-size:24px;font-weight:800;color:#111827;letter-spacing:-0.5px;">Reset your password</h1>
                    <p style="margin:0 0 6px;font-size:15px;color:#374151;font-weight:500;">Hi ${toName || "there"},</p>
                    <p style="margin:0 0 28px;font-size:14px;color:#6b7280;line-height:1.7;">
                      We received a request to reset your Arthaleads password. Click the button below — the link is valid for <strong style="color:#374151;">1 hour</strong>.
                    </p>

                    <!-- CTA Button -->
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding-bottom:28px;">
                          <a href="${resetUrl}"
                            style="display:inline-block;background:linear-gradient(135deg,#e85d00,#ff6b00);color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:15px 36px;border-radius:14px;box-shadow:0 4px 16px rgba(255,107,0,0.35);letter-spacing:0.2px;">
                            Reset Password &rarr;
                          </a>
                        </td>
                      </tr>
                    </table>

                    <!-- Divider -->
                    <hr style="border:none;border-top:1px solid #f3f4f6;margin:0 0 20px;" />

                    <!-- Warning note -->
                    <table cellpadding="0" cellspacing="0" style="width:100%;background:#fafafa;border-radius:12px;border:1px solid #f0f0f0;">
                      <tr>
                        <td style="padding:14px 16px;">
                          <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6;">
                            🔒 If you didn't request this, you can safely ignore this email. Your password won't change.
                          </p>
                        </td>
                      </tr>
                    </table>

                    <!-- Fallback URL -->
                    <p style="margin:20px 0 0;font-size:11px;color:#d1d5db;line-height:1.6;word-break:break-all;">
                      Button not working? Copy this link:<br/>
                      <a href="${resetUrl}" style="color:#ff6b00;text-decoration:none;">${resetUrl}</a>
                    </p>

                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding:24px 0 8px;">
              <p style="margin:0;font-size:11px;color:#9ca3af;">
                © ${new Date().getFullYear()} <strong style="color:#6b7280;">Arthaleads</strong> · Prophunt LLP · Pune, India
              </p>
              <p style="margin:6px 0 0;font-size:11px;color:#c4c4c4;">
                You're receiving this because a password reset was requested for your account.
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
