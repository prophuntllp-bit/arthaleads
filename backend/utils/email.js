// utils/email.js — every transactional email Arthaleads sends.
//
// All of them are built from utils/emailLayout.js. The templates used to be
// split between a shared dark-card helper and several hand-rolled copies of
// the same markup, so a change to the header had to be made in five places and
// two of them had already drifted.
//
// Every send also carries a plain-text alternative. It is what a text-only
// client shows, and its absence is a spam-filter signal.

const { Resend } = require("resend");
const {
  layout, button, panel, row, codeBlock, paragraph, divider, esc, BRAND, HEADING, MUTED, FONT,
} = require("./emailLayout");

function getResend() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not configured");
  }
  return new Resend(process.env.RESEND_API_KEY);
}

const FROM_ADDRESS = process.env.SMTP_FROM || "Arthaleads <onboarding@resend.dev>";
const SITE_URL = (process.env.FRONTEND_URL || "https://www.arthaleads.com").replace(/\/$/, "");
const LOGIN_URL = `${SITE_URL}/login`;
const DASHBOARD_URL = `${SITE_URL}/dashboard`;
const SUPPORT = "contact@arthaleads.com";

const link = (href, text) =>
  `<a href="${href}" style="color:${BRAND};text-decoration:none;">${text}</a>`;
const strong = (t) => `<strong style="color:${HEADING};">${esc(t)}</strong>`;

/** Throws on a Resend error so callers do not silently believe a mail went out. */
async function send(payload) {
  const { data, error } = await getResend().emails.send({ from: FROM_ADDRESS, ...payload });
  if (error) throw new Error(error.message || "Resend API error");
  return data;
}

// ── Password reset ────────────────────────────────────────────────────────────
async function sendPasswordResetEmail(toEmail, toName, resetUrl) {
  const name = toName || "there";
  return send({
    to: toEmail,
    subject: "Reset your Arthaleads password",
    html: layout({
      preheader: "This link expires in 1 hour.",
      eyebrow: "Password reset",
      title: "Reset your password",
      bodyHtml: `
        ${paragraph(`Hi ${esc(name)}, we received a request to reset the password on your Arthaleads account.`)}
        ${paragraph(`Use the button below to choose a new one. The link expires in ${strong("1 hour")}.`)}
        ${button(resetUrl, "Reset password")}
        ${panel(`
          <p style="margin:0 0 6px;font-family:${FONT};font-size:13px;font-weight:600;color:${HEADING};">Didn't request this?</p>
          <p style="margin:0;font-family:${FONT};font-size:13px;line-height:1.6;color:${MUTED};">Nothing to do. Your password stays as it is and the link above can be ignored.</p>`)}
        <p style="margin:0;font-family:${FONT};font-size:12px;line-height:1.6;color:${MUTED};word-break:break-all;">
          If the button doesn't work, paste this into your browser:<br />${link(resetUrl, esc(resetUrl))}
        </p>`,
      footerNote: "You received this because a password reset was requested for your account.",
    }),
    text: `Hi ${name},\n\nReset your Arthaleads password:\n${resetUrl}\n\nThis link expires in 1 hour. If you didn't request it, you can ignore this email.\n\n— Arthaleads`,
  });
}

// ── Reset requested on a Google-only account ──────────────────────────────────
// There is no password to reset, so say that rather than send nothing. Safe
// against enumeration: only the owner of the address ever receives it, and the
// HTTP response is identical either way.
async function sendGoogleOnlyAccountEmail(toEmail, toName, loginUrl) {
  const name = toName || "there";
  return send({
    to: toEmail,
    subject: "Signing in to Arthaleads",
    html: layout({
      preheader: "This account signs in with Google — there's no password to reset.",
      eyebrow: "Sign in",
      title: 'Use "Sign in with Google"',
      bodyHtml: `
        ${paragraph(`Hi ${esc(name)}, you asked to reset your Arthaleads password.`)}
        ${paragraph("This account doesn't have one — it was created with Google, so there's nothing to reset. Use the Google button on the sign-in page and you'll go straight in.")}
        ${button(loginUrl, "Go to sign in")}
        ${paragraph(`Prefer a password as well? Sign in with Google, then open Settings and create one. Google sign-in keeps working either way.`, MUTED)}
        ${divider}
        <p style="margin:0;font-family:${FONT};font-size:12px;line-height:1.6;color:${MUTED};">
          If you didn't ask for this, you can ignore it — nothing about your account has changed.
        </p>`,
      footerNote: "You received this because a password reset was requested for this address.",
    }),
    text: `Hi ${name},\n\nYou asked to reset your Arthaleads password, but this account was created with Google and has no password.\n\nSign in with Google here: ${loginUrl}\n\nYou can add a password afterwards from Settings.\n\n— Arthaleads`,
  });
}

// ── Welcome (account is live) ─────────────────────────────────────────────────
async function sendWelcomeEmail(toEmail, toName, orgName) {
  const firstName = toName?.split(" ")[0] || "there";
  return send({
    to: toEmail,
    subject: `Welcome to Arthaleads, ${firstName} — your workspace is ready`,
    html: layout({
      preheader: `${orgName} is set up and ready to use.`,
      eyebrow: "Welcome",
      title: "Your workspace is ready",
      bodyHtml: `
        ${paragraph(`Hi ${esc(firstName)}, ${strong(orgName)} is set up. You can manage property leads, track your team and run follow-ups from one place.`)}
        ${panel(`
          <p style="margin:0 0 12px;font-family:${FONT};font-size:13px;font-weight:600;color:${HEADING};">Three things worth doing first</p>
          <p style="margin:0 0 10px;font-family:${FONT};font-size:13px;line-height:1.6;color:${MUTED};"><span style="color:${HEADING};font-weight:600;">Bring your leads in.</span> Connect Facebook, Google or your website forms so enquiries arrive automatically.</p>
          <p style="margin:0 0 10px;font-family:${FONT};font-size:13px;line-height:1.6;color:${MUTED};"><span style="color:${HEADING};font-weight:600;">Add your team.</span> Invite agents and managers, then assign leads to them.</p>
          <p style="margin:0;font-family:${FONT};font-size:13px;line-height:1.6;color:${MUTED};"><span style="color:${HEADING};font-weight:600;">Set follow-up reminders.</span> Schedule them once and get notified on time.</p>`)}
        ${button(DASHBOARD_URL, "Open your dashboard")}
        ${divider}
        <p style="margin:0;font-family:${FONT};font-size:13px;line-height:1.6;color:${MUTED};">
          Stuck on anything? Reply to this email or write to ${link(`mailto:${SUPPORT}`, SUPPORT)}.
        </p>`,
      footerNote: "You received this because an Arthaleads account was created with this address.",
    }),
    text: `Hi ${firstName},\n\nWelcome to Arthaleads. Your workspace "${orgName}" is ready.\n\nOpen your dashboard: ${DASHBOARD_URL}\n\nNeed help? ${SUPPORT}\n\n— Arthaleads`,
  });
}

// ── Added to a workspace ──────────────────────────────────────────────────────
async function sendTeamInviteEmail(toEmail, toName, orgName, addedByName) {
  const firstName = toName?.split(" ")[0] || "there";
  const addedBy = addedByName || "An admin";
  return send({
    to: toEmail,
    subject: `You've been added to ${orgName} on Arthaleads`,
    html: layout({
      preheader: `${addedBy} added you to ${orgName}.`,
      eyebrow: "Team invite",
      title: "You've been added to a workspace",
      bodyHtml: `
        ${paragraph(`Hi ${esc(firstName)}, ${strong(addedBy)} added you to ${strong(orgName)} on Arthaleads.`)}
        ${paragraph("You now have access to the team's lead pipeline, follow-ups and property data. Sign in with the address this was sent to.")}
        ${panel(`
          <p style="margin:0 0 12px;font-family:${FONT};font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${MUTED};">Your sign-in details</p>
          ${row("Workspace", orgName)}
          ${row("Email", toEmail, true)}`)}
        ${button(LOGIN_URL, "Sign in to Arthaleads")}
        ${divider}
        <p style="margin:0;font-family:${FONT};font-size:13px;line-height:1.6;color:${MUTED};">
          Weren't expecting this? You can ignore this email, or tell us at ${link(`mailto:${SUPPORT}`, SUPPORT)}.
        </p>`,
      footerNote: `You received this because ${addedBy} added you to ${orgName}.`,
    }),
    text: `Hi ${firstName},\n\n${addedBy} added you to "${orgName}" on Arthaleads.\n\nSign in: ${LOGIN_URL}\nYour email: ${toEmail}\n\n— Arthaleads`,
  });
}

// ── Trial request received (awaiting approval) ────────────────────────────────
async function sendSignupPendingEmail(toEmail, toName, orgName) {
  const name = toName || "there";
  return send({
    to: toEmail,
    subject: "We've received your Arthaleads trial request",
    html: layout({
      preheader: "We review every request personally, usually within one working day.",
      eyebrow: "Request received",
      title: "You're almost in",
      bodyHtml: `
        ${paragraph(`Hi ${esc(name)}, thanks for requesting a trial of Arthaleads for ${strong(orgName)}.`)}
        ${paragraph("We review every trial request personally — usually within one working day. You'll get an email the moment your account is activated.")}
        ${panel(`<p style="margin:0;font-family:${FONT};font-size:13px;line-height:1.6;color:${MUTED};">Your 14-day trial starts when we activate it, not today — so none of it is spent waiting.</p>`)}
        <p style="margin:0;font-family:${FONT};font-size:13px;line-height:1.6;color:${MUTED};">
          Didn't request this? You can ignore this email — no account will be activated.
        </p>`,
      footerNote: "You received this because someone requested an Arthaleads trial with this address.",
    }),
    text: `Hi ${name},\n\nThanks for requesting a trial of Arthaleads for "${orgName}".\n\nWe review every request personally, usually within one working day. Your 14-day trial starts when we activate it, not today.\n\n— Arthaleads`,
  });
}

// ── Trial approved ────────────────────────────────────────────────────────────
async function sendSignupApprovedEmail(toEmail, toName, orgName) {
  const name = toName || "there";
  return send({
    to: toEmail,
    subject: "Your Arthaleads trial is live",
    html: layout({
      preheader: "Your 14-day trial starts now.",
      eyebrow: "Trial activated",
      title: "Your trial is live",
      bodyHtml: `
        ${paragraph(`Hi ${esc(name)}, the account for ${strong(orgName)} has been approved. Your 14-day free trial starts now.`)}
        ${button(LOGIN_URL, "Log in to your CRM")}
        ${paragraph("Sign in with the email and password you signed up with. Need a hand getting started? Just reply to this email.", MUTED)}`,
      footerNote: "Your 14-day trial started today.",
    }),
    text: `Hi ${name},\n\nThe account for "${orgName}" has been approved and your 14-day trial starts now.\n\nLog in: ${LOGIN_URL}\n\n— Arthaleads`,
  });
}

// ── Trial request declined ────────────────────────────────────────────────────
async function sendSignupRejectedEmail(toEmail, toName, reason) {
  const name = toName || "there";
  return send({
    to: toEmail,
    subject: "About your Arthaleads trial request",
    html: layout({
      preheader: "We couldn't activate this request.",
      eyebrow: "Trial request",
      title: "We couldn't activate this one",
      bodyHtml: `
        ${paragraph(`Hi ${esc(name)}, we weren't able to activate a trial for this request.`)}
        ${reason ? panel(`<p style="margin:0;font-family:${FONT};font-size:13px;line-height:1.6;color:${MUTED};">${esc(reason)}</p>`) : ""}
        <p style="margin:0;font-family:${FONT};font-size:15px;line-height:1.65;color:${MUTED};">
          If you think this was a mistake, reply to this email and we'll take another look.
        </p>`,
      footerNote: "Questions? Just reply to this email.",
    }),
    text: `Hi ${name},\n\nWe weren't able to activate a trial for this request.${reason ? `\n\n${reason}` : ""}\n\nIf you think that's a mistake, reply to this email and we'll take another look.\n\n— Arthaleads`,
  });
}

// ── Internal: a signup is waiting for review ──────────────────────────────────
async function notifySuperAdminsOfSignup({ name, email, phone, orgName }) {
  const User = require("../models/User");
  const admins = await User.find({ role: "super_admin", isActive: true }).select("email").lean();
  if (!admins.length) return;

  const reviewUrl = `${SITE_URL}/super-admin/orgs`;
  return send({
    to: admins.map((a) => a.email),
    subject: `New trial request: ${orgName}`,
    html: layout({
      preheader: `${name} — ${email}`,
      eyebrow: "Pending approval",
      title: "New trial request",
      bodyHtml: `
        ${panel(`
          ${row("Organisation", orgName)}
          ${row("Name", name)}
          ${row("Email", email)}
          ${row("Phone", phone || "not given", true)}`)}
        ${button(reviewUrl, "Review in admin panel")}
        <p style="margin:0;font-family:${FONT};font-size:13px;line-height:1.6;color:${MUTED};">
          Email verified by one-time code. Awaiting approval before the trial starts.
        </p>`,
      footerNote: "Sent to Arthaleads platform administrators.",
    }),
    text: `New trial request\n\nOrganisation: ${orgName}\nName: ${name}\nEmail: ${email}\nPhone: ${phone || "not given"}\n\nReview: ${reviewUrl}`,
  });
}

// ── One-time code (signup email verification) ─────────────────────────────────
async function sendOtpEmail(toEmail, code, minutes = 10) {
  return send({
    to: toEmail,
    subject: `${code} is your Arthaleads verification code`,
    html: layout({
      preheader: `Your code is ${code}. It expires in ${minutes} minutes.`,
      eyebrow: "Email verification",
      title: "Verify your email address",
      bodyHtml: `
        ${paragraph(`Use the code below to continue setting up your Arthaleads trial. It expires in ${strong(`${minutes} minutes`)}.`)}
        ${codeBlock(code)}
        <p style="margin:0;font-family:${FONT};font-size:13px;line-height:1.6;color:${MUTED};">
          Never share this code with anyone. Arthaleads will never ask you for it.
        </p>`,
      footerNote: "You received this because this address was used to start an Arthaleads signup.",
    }),
    text: `Your Arthaleads verification code is ${code}.\n\nIt expires in ${minutes} minutes. Never share this code — Arthaleads will never ask you for it.`,
  });
}

module.exports = {
  sendPasswordResetEmail,
  sendGoogleOnlyAccountEmail,
  sendWelcomeEmail,
  sendTeamInviteEmail,
  sendSignupPendingEmail,
  sendSignupApprovedEmail,
  sendSignupRejectedEmail,
  notifySuperAdminsOfSignup,
  sendOtpEmail,
};
