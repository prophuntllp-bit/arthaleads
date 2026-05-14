// utils/email.js — Email via Resend HTTP API (no SMTP, works on Railway)
const { Resend } = require("resend");

function getResend() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY environment variable is not set");
  }
  return new Resend(process.env.RESEND_API_KEY);
}

const FROM_ADDRESS = process.env.SMTP_FROM || "Arthaleads <onboarding@resend.dev>";
const YEAR = new Date().getFullYear();
const DASHBOARD_URL = process.env.FRONTEND_URL
  ? `${process.env.FRONTEND_URL}/dashboard`
  : "https://www.arthaleads.com/dashboard";
const LOGIN_URL = process.env.FRONTEND_URL
  ? `${process.env.FRONTEND_URL}/login`
  : "https://www.arthaleads.com/login";

// ── Shared card wrapper ───────────────────────────────────────────────────────
// Builds the outer shell (background, logo, charcoal card) so each email
// only needs to supply the inner header + body HTML.
function cardEmail({ iconEmoji, headerHtml, bodyHtml, footerNote }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#f0ede8;font-family:'Segoe UI',Inter,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0ede8;padding:48px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;">

        <!-- Logo -->
        <tr>
          <td align="center" style="padding-bottom:24px;">
            <img src="https://www.arthaleads.com/logo.png" alt="Arthaleads" width="48" height="48"
              style="display:inline-block;border-radius:14px;border:0;" />
            <br/>
            <span style="display:inline-block;margin-top:10px;color:#111113;font-weight:800;font-size:20px;">Artha<span style="color:#ff6b00;">leads</span></span>
          </td>
        </tr>

        <!-- Card -->
        <tr>
          <td style="background:#1e1d20;border-radius:24px;border:1px solid rgba(255,107,0,0.18);box-shadow:0 0 0 1px rgba(255,107,0,0.06),0 20px 60px rgba(0,0,0,0.22),0 0 40px rgba(255,107,0,0.06);overflow:hidden;">
            <table width="100%" cellpadding="0" cellspacing="0">

              <!-- Card header -->
              <tr>
                <td style="background:linear-gradient(160deg,rgba(255,107,0,0.12) 0%,rgba(30,29,32,0) 55%);padding:36px 40px 28px;border-bottom:1px solid rgba(255,255,255,0.06);">
                  <table cellpadding="0" cellspacing="0" style="margin:0 0 22px;">
                    <tr>
                      <td style="background:rgba(255,107,0,0.12);border:1px solid rgba(255,107,0,0.22);border-radius:14px;width:52px;height:52px;text-align:center;vertical-align:middle;">
                        <span style="font-size:24px;line-height:1;">${iconEmoji}</span>
                      </td>
                    </tr>
                  </table>
                  ${headerHtml}
                </td>
              </tr>

              <!-- Card body -->
              <tr>
                <td style="padding:32px 40px 36px;">
                  ${bodyHtml}
                </td>
              </tr>

            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td align="center" style="padding:26px 0 8px;">
            <p style="margin:0 0 4px;font-size:11.5px;color:#999;">© ${YEAR} Arthaleads &nbsp;·&nbsp; Prophunt LLP &nbsp;·&nbsp; Pune, India</p>
            <p style="margin:0;font-size:11px;color:#bbb;">${footerNote}</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();
}

// ── Shared CTA button ─────────────────────────────────────────────────────────
function ctaButton(url, label) {
  return `
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding-bottom:32px;">
        <a href="${url}" style="display:inline-block;background:linear-gradient(135deg,#e05d00,#ff6b00);color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:15px 44px;border-radius:14px;letter-spacing:0.3px;box-shadow:0 4px 20px rgba(255,107,0,0.30),0 0 0 1px rgba(255,140,0,0.3);">
          ${label}
        </a>
      </td>
    </tr>
  </table>`;
}

// ── Divider ───────────────────────────────────────────────────────────────────
const divider = `<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;"><tr><td style="border-top:1px solid rgba(255,255,255,0.06);font-size:0;line-height:0;">&nbsp;</td></tr></table>`;

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
<body style="margin:0;padding:0;background:#f0ede8;font-family:'Segoe UI',Inter,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0ede8;padding:48px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:520px;">

          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom:24px;">
              <img src="https://www.arthaleads.com/logo.png" alt="Arthaleads" width="48" height="48"
                style="display:inline-block;border-radius:14px;border:0;" />
              <br/>
              <span style="display:inline-block;margin-top:10px;color:#111113;font-weight:800;font-size:20px;font-family:'Segoe UI',Arial,sans-serif;">Artha<span style="color:#ff6b00;">leads</span></span>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#1e1d20;border-radius:24px;border:1px solid rgba(255,107,0,0.18);box-shadow:0 0 0 1px rgba(255,107,0,0.06),0 20px 60px rgba(0,0,0,0.22),0 0 40px rgba(255,107,0,0.06);overflow:hidden;">

              <!-- Header with orange gradient glow -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:linear-gradient(160deg,rgba(255,107,0,0.12) 0%,rgba(30,29,32,0) 55%);padding:36px 40px 28px;border-bottom:1px solid rgba(255,255,255,0.06);">

                    <!-- Icon badge -->
                    <table cellpadding="0" cellspacing="0" style="margin:0 0 22px;">
                      <tr>
                        <td style="background:rgba(255,107,0,0.12);border:1px solid rgba(255,107,0,0.22);border-radius:14px;width:52px;height:52px;text-align:center;vertical-align:middle;">
                          <span style="font-size:24px;line-height:1;">🔑</span>
                        </td>
                      </tr>
                    </table>

                    <h1 style="margin:0 0 10px;font-size:26px;font-weight:800;color:#ededed;letter-spacing:-0.5px;line-height:1.2;">Reset your password</h1>
                    <p style="margin:0;font-size:14px;color:#969696;line-height:1.65;">
                      Hi <strong style="color:#d4d4d4;">${toName || "there"}</strong> — we received a request to reset your Arthaleads CRM password.
                    </p>
                  </td>
                </tr>

                <!-- Body -->
                <tr>
                  <td style="padding:32px 40px 36px;">
                    <p style="margin:0 0 28px;font-size:14px;color:#969696;line-height:1.75;">
                      Click the button below to set a new password. This link will expire in <strong style="color:#ff8a3d;">1 hour</strong> for your security.
                    </p>

                    <!-- CTA Button -->
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="padding-bottom:32px;">
                          <a href="${resetUrl}"
                            style="display:inline-block;background:linear-gradient(135deg,#e05d00,#ff6b00);color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:15px 44px;border-radius:14px;letter-spacing:0.3px;box-shadow:0 4px 20px rgba(255,107,0,0.30),0 0 0 1px rgba(255,140,0,0.3);">
                            Reset Password &nbsp;&rarr;
                          </a>
                        </td>
                      </tr>
                    </table>

                    <!-- Divider -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                      <tr>
                        <td style="border-top:1px solid rgba(255,255,255,0.06);font-size:0;line-height:0;">&nbsp;</td>
                      </tr>
                    </table>

                    <!-- Security note -->
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);border-radius:14px;padding:16px 18px;">
                          <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#ff8a3d;">⚠ &nbsp;Didn't request this?</p>
                          <p style="margin:0;font-size:12px;color:#666;line-height:1.65;">
                            If you didn't ask to reset your password, no action is needed. Your account is safe and your password remains unchanged.
                          </p>
                        </td>
                      </tr>
                    </table>

                    <!-- Fallback URL -->
                    <p style="margin:22px 0 0;font-size:11px;color:#444;line-height:1.7;word-break:break-all;">
                      Button not working? Copy this link into your browser:<br/>
                      <a href="${resetUrl}" style="color:#ff6b00;text-decoration:none;">${resetUrl}</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding:26px 0 8px;">
              <p style="margin:0 0 4px;font-size:11.5px;color:#999;">
                © ${new Date().getFullYear()} Arthaleads &nbsp;·&nbsp; Prophunt LLP &nbsp;·&nbsp; Pune, India
              </p>
              <p style="margin:0;font-size:11px;color:#bbb;">
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

// ── Welcome email (new signup — email/password or Google) ─────────────────────
async function sendWelcomeEmail(toEmail, toName, orgName) {
  const resend = getResend();
  const firstName = toName?.split(" ")[0] || "there";

  const html = cardEmail({
    iconEmoji: "🎉",
    headerHtml: `
      <h1 style="margin:0 0 10px;font-size:26px;font-weight:800;color:#ededed;letter-spacing:-0.5px;line-height:1.2;">Welcome to Arthaleads!</h1>
      <p style="margin:0;font-size:14px;color:#969696;line-height:1.65;">
        Hi <strong style="color:#d4d4d4;">${firstName}</strong> — your workspace <strong style="color:#ff8a3d;">${orgName}</strong> is all set up and ready to go.
      </p>`,
    bodyHtml: `
      <p style="margin:0 0 24px;font-size:14px;color:#969696;line-height:1.75;">
        You can now manage all your property leads, track your team's performance, and run automated follow-ups — all from one place.
      </p>

      <!-- Feature highlights -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
        <tr>
          <td style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);border-radius:14px;padding:20px 18px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding-bottom:14px;">
                  <span style="font-size:16px;">📋</span>
                  <span style="font-size:13px;font-weight:600;color:#d4d4d4;margin-left:10px;">Manage Leads</span>
                  <p style="margin:4px 0 0 26px;font-size:12px;color:#666;line-height:1.5;">Capture leads from Facebook, Google, WhatsApp and walk-ins in one dashboard.</p>
                </td>
              </tr>
              <tr>
                <td style="padding-bottom:14px;border-top:1px solid rgba(255,255,255,0.05);padding-top:14px;">
                  <span style="font-size:16px;">👥</span>
                  <span style="font-size:13px;font-weight:600;color:#d4d4d4;margin-left:10px;">Add Your Team</span>
                  <p style="margin:4px 0 0 26px;font-size:12px;color:#666;line-height:1.5;">Invite agents and managers. Assign leads and track individual performance.</p>
                </td>
              </tr>
              <tr>
                <td style="border-top:1px solid rgba(255,255,255,0.05);padding-top:14px;">
                  <span style="font-size:16px;">🔔</span>
                  <span style="font-size:13px;font-weight:600;color:#d4d4d4;margin-left:10px;">Follow-up Reminders</span>
                  <p style="margin:4px 0 0 26px;font-size:12px;color:#666;line-height:1.5;">Never miss a follow-up. Schedule reminders and get notified right on time.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      ${ctaButton(DASHBOARD_URL, "Go to Dashboard &nbsp;&rarr;")}
      ${divider}
      <p style="margin:0;font-size:12px;color:#555;line-height:1.65;">
        Need help getting started? Reply to this email or reach us at
        <a href="mailto:contact@arthaleads.com" style="color:#ff6b00;text-decoration:none;">contact@arthaleads.com</a>
      </p>`,
    footerNote: "You're receiving this because you just created an Arthaleads account.",
  });

  const { data, error } = await resend.emails.send({
    from:    FROM_ADDRESS,
    to:      toEmail,
    subject: `Welcome to Arthaleads, ${firstName}! Your workspace is ready 🎉`,
    html,
    text: `Hi ${firstName},\n\nWelcome to Arthaleads! Your workspace "${orgName}" is ready.\n\nGo to your dashboard: ${DASHBOARD_URL}\n\nNeed help? Email us at contact@arthaleads.com\n\n— Arthaleads Team`,
  });

  if (error) throw new Error(error.message || "Resend API error");
  return data;
}

// ── Team invite email (admin adds an agent/manager to their org) ──────────────
async function sendTeamInviteEmail(toEmail, toName, orgName, addedByName) {
  const resend = getResend();
  const firstName = toName?.split(" ")[0] || "there";

  const html = cardEmail({
    iconEmoji: "🤝",
    headerHtml: `
      <h1 style="margin:0 0 10px;font-size:26px;font-weight:800;color:#ededed;letter-spacing:-0.5px;line-height:1.2;">You've been added to a workspace</h1>
      <p style="margin:0;font-size:14px;color:#969696;line-height:1.65;">
        Hi <strong style="color:#d4d4d4;">${firstName}</strong> — <strong style="color:#ff8a3d;">${addedByName || "An admin"}</strong> has added you to <strong style="color:#d4d4d4;">${orgName}</strong> on Arthaleads.
      </p>`,
    bodyHtml: `
      <p style="margin:0 0 24px;font-size:14px;color:#969696;line-height:1.75;">
        You now have access to the team's lead pipeline, follow-up schedules, and property data. Sign in with the email address this was sent to.
      </p>

      <!-- Login details box -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
        <tr>
          <td style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);border-radius:14px;padding:18px 20px;">
            <p style="margin:0 0 10px;font-size:11px;font-weight:700;color:#ff8a3d;text-transform:uppercase;letter-spacing:0.12em;">Your login details</p>
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="font-size:12px;color:#666;padding-right:12px;padding-bottom:6px;">Workspace</td>
                <td style="font-size:13px;font-weight:600;color:#d4d4d4;padding-bottom:6px;">${orgName}</td>
              </tr>
              <tr>
                <td style="font-size:12px;color:#666;padding-right:12px;">Email</td>
                <td style="font-size:13px;font-weight:600;color:#d4d4d4;">${toEmail}</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      ${ctaButton(LOGIN_URL, "Sign in to Arthaleads &nbsp;&rarr;")}
      ${divider}
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);border-radius:14px;padding:14px 16px;">
            <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#ff8a3d;">⚠ &nbsp;Wasn't expecting this?</p>
            <p style="margin:0;font-size:12px;color:#666;line-height:1.65;">
              If you weren't expecting to be added, you can ignore this email or contact <a href="mailto:contact@arthaleads.com" style="color:#ff6b00;text-decoration:none;">contact@arthaleads.com</a>.
            </p>
          </td>
        </tr>
      </table>`,
    footerNote: `You're receiving this because ${addedByName || "an admin"} added you to ${orgName} on Arthaleads.`,
  });

  const { data, error } = await resend.emails.send({
    from:    FROM_ADDRESS,
    to:      toEmail,
    subject: `You've been added to ${orgName} on Arthaleads`,
    html,
    text: `Hi ${firstName},\n\n${addedByName || "An admin"} has added you to "${orgName}" on Arthaleads.\n\nSign in at: ${LOGIN_URL}\nYour email: ${toEmail}\n\n— Arthaleads Team`,
  });

  if (error) throw new Error(error.message || "Resend API error");
  return data;
}

module.exports = { sendPasswordResetEmail, sendWelcomeEmail, sendTeamInviteEmail };
