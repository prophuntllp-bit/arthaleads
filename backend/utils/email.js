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
<body style="margin:0;padding:0;background:#0f0f13;font-family:'Segoe UI',Inter,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f13;padding:48px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:540px;">

          <!-- Top logo -->
          <tr>
            <td align="center" style="padding-bottom:28px;">
              <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td style="vertical-align:middle;padding-right:10px;">
                    <div style="width:38px;height:38px;border-radius:10px;background:linear-gradient(135deg,#c05200,#ff6b00);display:inline-block;text-align:center;line-height:38px;">
                      <span style="color:#fff;font-weight:900;font-size:19px;font-family:'Segoe UI',Arial,sans-serif;">A</span>
                    </div>
                  </td>
                  <td style="vertical-align:middle;">
                    <span style="color:#ffffff;font-weight:700;font-size:20px;font-family:'Segoe UI',Arial,sans-serif;">Artha</span><span style="color:#ff6b00;font-weight:700;font-size:20px;font-family:'Segoe UI',Arial,sans-serif;">leads</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#1a1a24;border-radius:20px;border:1px solid #2a2a38;overflow:hidden;">

              <!-- Card header band -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:linear-gradient(135deg,#1e1030 0%,#1a1520 50%,#0f1020 100%);padding:36px 40px 32px;border-bottom:1px solid #2a2a38;">
                    <!-- Shield icon -->
                    <table cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
                      <tr>
                        <td>
                          <div style="width:56px;height:56px;border-radius:16px;background:linear-gradient(135deg,#2a1500,#3d2000);border:1px solid rgba(255,107,0,0.25);display:inline-block;text-align:center;line-height:56px;">
                            <span style="font-size:26px;line-height:56px;display:inline-block;margin-top:2px;">🔑</span>
                          </div>
                        </td>
                      </tr>
                    </table>
                    <h1 style="margin:0 0 10px;font-size:26px;font-weight:800;color:#ffffff;letter-spacing:-0.6px;line-height:1.2;">Reset your password</h1>
                    <p style="margin:0;font-size:14px;color:#8b8fa8;line-height:1.6;">
                      Hi <strong style="color:#c8cade;">${toName || "there"}</strong> — we received a request to reset your Arthaleads CRM password.
                    </p>
                  </td>
                </tr>

                <!-- Body -->
                <tr>
                  <td style="padding:32px 40px;">
                    <p style="margin:0 0 28px;font-size:14px;color:#8b8fa8;line-height:1.75;">
                      Click the button below to choose a new password. This link will expire in <span style="color:#ff8a3d;font-weight:600;">1 hour</span> for your security.
                    </p>

                    <!-- CTA -->
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="padding-bottom:32px;">
                          <a href="${resetUrl}"
                            style="display:inline-block;background:linear-gradient(135deg,#d95e00,#ff6b00);color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:16px 48px;border-radius:12px;letter-spacing:0.3px;box-shadow:0 0 0 1px rgba(255,107,0,0.4),0 8px 24px rgba(255,107,0,0.25);">
                            Reset Password &nbsp;&rarr;
                          </a>
                        </td>
                      </tr>
                    </table>

                    <!-- Divider -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                      <tr>
                        <td style="border-top:1px solid #2a2a38;font-size:0;line-height:0;">&nbsp;</td>
                      </tr>
                    </table>

                    <!-- Security note -->
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="background:#13131c;border-radius:12px;border:1px solid #252535;padding:16px 18px;">
                          <p style="margin:0;font-size:12.5px;color:#6b6f88;line-height:1.65;">
                            <span style="color:#ff8a3d;font-weight:700;">⚠&nbsp; Didn't request this?</span><br/>
                            If you didn't ask to reset your password, no action is needed — your account is safe and your password remains unchanged.
                          </p>
                        </td>
                      </tr>
                    </table>

                    <!-- Fallback URL -->
                    <p style="margin:22px 0 0;font-size:11px;color:#3d3f52;line-height:1.7;word-break:break-all;">
                      If the button isn't working, paste this link into your browser:<br/>
                      <a href="${resetUrl}" style="color:#ff6b00;text-decoration:none;opacity:0.8;">${resetUrl}</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding:28px 0 8px;">
              <p style="margin:0 0 4px;font-size:11.5px;color:#3d3f52;">
                © ${new Date().getFullYear()} Arthaleads &nbsp;·&nbsp; Prophunt LLP &nbsp;·&nbsp; Pune, India
              </p>
              <p style="margin:0;font-size:11px;color:#2e3040;">
                This email was sent because a password reset was requested for your account.
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
