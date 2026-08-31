// utils/emailLayout.js — the shell every Arthaleads email is built from.
//
// Written for email clients, not browsers. That constrains it more than a web
// page does:
//
//   * Outlook renders with Word, which drops gradients, box-shadow, border-
//     radius and flexbox. Anything that relies on them looks broken there, so
//     the design uses none of it — flat fills and a hairline border only.
//   * Layout is tables with inline styles. <style> blocks are stripped by
//     Gmail's clipper and several mobile clients.
//   * Emoji as an icon renders differently on every platform and reads as
//     unserious in a business inbox. A small uppercase label carries the same
//     signal and renders identically everywhere.
//
// The previous templates used a dark card on a light page, with orange glows
// and gradients. In clients that supported it, it was heavy against a normally
// white inbox; in Outlook the effects vanished and left a flat dark slab.

const BRAND = "#ff6b00";
const PAGE = "#f5f6f8";
const CARD = "#ffffff";
const BORDER = "#e4e7ec";
const HEADING = "#101828";
const BODY = "#475467";
const MUTED = "#667085";
const PANEL = "#f9fafb";

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

const SITE = (process.env.FRONTEND_URL || "https://www.arthaleads.com").replace(/\/$/, "");

// The mark, beside a live-text wordmark rather than baked into one image.
//
// Gmail and Outlook block remote images until the sender is trusted, and a
// header that is entirely an image renders as an empty box for those readers —
// which is most first-time recipients. Text beside the mark means the brand
// still reads when the image never loads, and the alt is empty so a blocked
// image leaves no broken-image placeholder next to it.
//
// logo.png is the 1.1 MB square app icon; apple-touch-icon.png is the same
// mark at 18 KB, which is what belongs in an email. To use the full horizontal
// lockup instead, drop it at frontend/public/email-logo.png, deploy, and point
// EMAIL_LOGO_URL at it — nothing else changes.
const LOGO_URL = process.env.EMAIL_LOGO_URL || "https://www.arthaleads.com/apple-touch-icon.png";

/** Escapes text interpolated into HTML. Names and org names are user input. */
function esc(v) {
  return String(v == null ? "" : v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * A button Outlook will actually render.
 *
 * A styled <a> alone collapses to plain text there. Wrapping it in a table
 * with a bgcolor gives Word something it understands, and the padding lives on
 * the anchor so the whole block stays clickable.
 */
function button(url, label) {
  return `
<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="margin:0 0 28px;">
  <tr>
    <td bgcolor="${BRAND}" style="border-radius:8px;">
      <a href="${url}" style="display:inline-block;padding:13px 28px;font-family:${FONT};font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">${label}</a>
    </td>
  </tr>
</table>`;
}

/** A quiet panel for supporting detail — login details, security notes. */
function panel(innerHtml) {
  return `
<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="margin:0 0 24px;">
  <tr>
    <td bgcolor="${PANEL}" style="border:1px solid ${BORDER};border-radius:8px;padding:18px 20px;">${innerHtml}</td>
  </tr>
</table>`;
}

/** A label/value line inside a panel. */
function row(label, value, last = false) {
  return `
<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
  <tr>
    <td style="font-family:${FONT};font-size:13px;color:${MUTED};padding:0 12px ${last ? "0" : "8px"} 0;white-space:nowrap;">${esc(label)}</td>
    <td align="right" style="font-family:${FONT};font-size:13px;font-weight:600;color:${HEADING};padding:0 0 ${last ? "0" : "8px"};">${esc(value)}</td>
  </tr>
</table>`;
}

/** The one-time code block. Letter-spaced, selectable, no image. */
function codeBlock(code) {
  return `
<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="margin:0 0 24px;">
  <tr>
    <td align="center" bgcolor="${PANEL}" style="border:1px solid ${BORDER};border-radius:8px;padding:22px 16px;">
      <div style="font-family:${FONT};font-size:32px;font-weight:700;letter-spacing:8px;color:${HEADING};line-height:1.1;">${esc(code)}</div>
    </td>
  </tr>
</table>`;
}

function paragraph(html, color = BODY) {
  return `<p style="margin:0 0 16px;font-family:${FONT};font-size:15px;line-height:1.65;color:${color};">${html}</p>`;
}

const divider = `
<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="margin:0 0 24px;">
  <tr><td style="border-top:1px solid ${BORDER};font-size:0;line-height:0;">&nbsp;</td></tr>
</table>`;

/**
 * @param {object}  o
 * @param {string}  o.preheader  the grey line shown next to the subject in the
 *                               inbox list. Without one, clients scrape the
 *                               first visible text, which is usually "View in
 *                               browser" or the logo alt text.
 * @param {string}  o.eyebrow    short uppercase label above the title
 * @param {string}  o.title      the one-line headline
 * @param {string}  o.bodyHtml   built from paragraph/panel/button/divider
 * @param {string} [o.footerNote] why this person received it
 */
function layout({ preheader = "", eyebrow = "", title = "", bodyHtml = "", footerNote = "" }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>${esc(title)}</title>
</head>
<body style="margin:0;padding:0;background:${PAGE};">
  <div style="display:none;font-size:1px;color:${PAGE};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${esc(preheader)}</div>
  <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" bgcolor="${PAGE}" style="background:${PAGE};padding:40px 12px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" role="presentation" style="width:100%;max-width:600px;">

          <tr>
            <td align="left" style="padding:0 4px 20px;">
              <table cellpadding="0" cellspacing="0" border="0" role="presentation">
                <tr>
                  <td style="padding-right:10px;" valign="middle">
                    <img src="${LOGO_URL}" width="34" height="34" alt=""
                      style="display:block;border:0;border-radius:8px;" />
                  </td>
                  <td valign="middle">
                    <span style="font-family:${FONT};font-size:19px;font-weight:700;color:${HEADING};">Artha<span style="color:${BRAND};">leads</span></span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td bgcolor="${CARD}" style="background:${CARD};border:1px solid ${BORDER};border-radius:12px;padding:36px 36px 32px;">
              ${eyebrow ? `<p style="margin:0 0 10px;font-family:${FONT};font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${BRAND};">${esc(eyebrow)}</p>` : ""}
              ${title ? `<h1 style="margin:0 0 18px;font-family:${FONT};font-size:23px;font-weight:700;line-height:1.3;color:${HEADING};">${esc(title)}</h1>` : ""}
              ${bodyHtml}
            </td>
          </tr>

          <tr>
            <td align="left" style="padding:20px 4px 0;">
              ${footerNote ? `<p style="margin:0 0 6px;font-family:${FONT};font-size:12px;line-height:1.6;color:${MUTED};">${esc(footerNote)}</p>` : ""}
              <p style="margin:0;font-family:${FONT};font-size:12px;color:${MUTED};">
                &copy; ${new Date().getFullYear()} Arthaleads &middot; Pune, India &middot;
                <a href="${SITE}" style="color:${MUTED};text-decoration:underline;">arthaleads.com</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

module.exports = {
  layout, button, panel, row, codeBlock, paragraph, divider, esc,
  BRAND, HEADING, BODY, MUTED, FONT, SITE, LOGO_URL,
};
