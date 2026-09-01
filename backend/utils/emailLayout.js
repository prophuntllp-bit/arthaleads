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
// The same file the marketing site's nav and footer use, so the brand is one
// asset rather than three that drift. Override with EMAIL_LOGO_URL if email
// ever needs its own.
const LOGO_URL = process.env.EMAIL_LOGO_URL || `${SITE}/logo-lockup.png`;
const LOGO_DARK_URL = process.env.EMAIL_LOGO_DARK_URL || `${SITE}/logo-lockup-dark.png`;

// The header and footer bands.
//
// Brand orange was the obvious choice and was wrong twice over: white on
// #ff6b00 is 2.86:1, which fails for the footer's small print, and the logo's
// "Into Value" is itself orange, so the tagline vanished into the band. A dark
// neutral fixes both — white text reads at about 15:1, and the orange in the
// mark and the tagline is the only warm colour on it, which is what makes it
// carry.
const BAND = "#1b1f24";

// Social icons.
//
// White glyphs with their counters knocked out to transparency rather than
// filled with BAND, so they still read if the band ever changes shade. Drawn
// at 66px and shown at 22 so they stay sharp on a retina screen.
//
// The accessible name lives on the <a> as aria-label, and the <img> carries
// alt="". Putting the name in the alt instead looked more correct and rendered
// badly: with images off, a 22x22 box clips "Instagram" to two letters, so the
// footer became three unreadable stubs. An empty alt collapses to nothing, and
// the aria-label still gives a screen reader something to announce.
const SOCIAL = [
  ["Instagram", "https://www.instagram.com/arthaleads.crm/", "social-instagram.png"],
  ["Facebook", "https://www.facebook.com/profile.php?id=61589532765469", "social-facebook.png"],
  ["LinkedIn", "https://www.linkedin.com/company/arthaleads/", "social-linkedin.png"],
];

// One logo, not a light/dark pair. Swapping on prefers-color-scheme looked
// right in theory and was wrong on screen: the card this sits on is always
// light, so a dark-mode reader got light-on-light and the wordmark vanished.
// The email declares itself light-only instead.
//
// The supplied artwork is a 2080x2080 canvas that is mostly padding; it is
// trimmed to its content by scripts/trim-logo.js, giving 1574x471. Shown at
// 170x51 that is far more resolution than a retina screen needs, which is what
// keeps it sharp. Width and height are attributes as well as CSS because
// Outlook ignores the CSS and would draw it at full size.
const LOGO_W = 170;
const LOGO_H = 51;

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
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>${esc(title)}</title>
</head>
<body style="margin:0;padding:0;background:${PAGE};">
  <div style="display:none;font-size:1px;color:${PAGE};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${esc(preheader)}</div>
  <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" bgcolor="${PAGE}" style="background:${PAGE};padding:32px 12px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" role="presentation" style="width:100%;max-width:600px;border:1px solid ${BORDER};border-radius:12px;overflow:hidden;">

          <!-- Brand band. Deliberately not #ff6b00: white on the brand orange
               is 2.9:1, and the logo's own tagline is orange too. -->
          <tr>
            <td bgcolor="${BAND}" style="background:${BAND};padding:20px 28px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
                <tr>
                  <td align="left" valign="middle">
                    <img src="${LOGO_DARK_URL}" width="${LOGO_W}" height="${LOGO_H}" alt="Arthaleads"
                      style="display:block;border:0;color:#ffffff;font-family:${FONT};font-size:19px;font-weight:700;" />
                  </td>
                  <td align="right" valign="middle">
                    <table cellpadding="0" cellspacing="0" border="0" role="presentation">
                      <tr>
                        <td bgcolor="#ffffff" style="border-radius:6px;">
                          <a href="${SITE}/login" style="display:inline-block;padding:9px 18px;font-family:${FONT};font-size:13px;font-weight:600;color:${BAND};text-decoration:none;border-radius:6px;">Log in</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td bgcolor="${CARD}" style="background:${CARD};padding:34px 32px 30px;">
              ${eyebrow ? `<p style="margin:0 0 10px;font-family:${FONT};font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${BRAND};">${esc(eyebrow)}</p>` : ""}
              ${title ? `<h1 style="margin:0 0 18px;font-family:${FONT};font-size:23px;font-weight:700;line-height:1.3;color:${HEADING};">${esc(title)}</h1>` : ""}
              ${bodyHtml}
            </td>
          </tr>

          <tr>
            <td bgcolor="${BAND}" style="background:${BAND};padding:22px 28px;">
              ${footerNote ? `<p style="margin:0 0 10px;font-family:${FONT};font-size:12px;line-height:1.6;color:#ffffff;opacity:.85;">${esc(footerNote)}</p>` : ""}
              <table cellpadding="0" cellspacing="0" border="0" role="presentation" style="margin:0 0 14px;">
                <tr>${SOCIAL.map(([name, href, file]) => `
                  <td style="padding:0 14px 0 0;">
                    <a href="${href}" aria-label="${name}" title="${name}"><img src="${SITE}/${file}" width="22" height="22" alt=""
                      style="display:block;border:0;" /></a>
                  </td>`).join("")}
                </tr>
              </table>
              <p style="margin:0 0 6px;font-family:${FONT};font-size:12px;line-height:1.7;color:#ffffff;">
                <a href="${SITE}/privacy" style="color:#ffffff;text-decoration:underline;">Privacy Policy</a>
                &nbsp;&middot;&nbsp;
                <a href="${SITE}/terms" style="color:#ffffff;text-decoration:underline;">Terms of Service</a>
                &nbsp;&middot;&nbsp;
                <a href="mailto:contact@arthaleads.com" style="color:#ffffff;text-decoration:underline;">contact@arthaleads.com</a>
              </p>
              <p style="margin:0;font-family:${FONT};font-size:12px;color:#ffffff;">
                &copy; ${new Date().getFullYear()} Arthaleads &middot; Pune, India
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

/**
 * The stripped-back shell, for the one email a stranger gets before they have
 * any reason to trust the sender: signup verification.
 *
 * No bands, no social row, no navigation. Two reasons, and neither is taste:
 *
 *   * A verification mail that looks like a newsletter is a verification mail
 *     that lands in Promotions. Filters weigh image-heavy, link-heavy,
 *     multi-column markup; this one is a sentence, a button and a code.
 *   * The logo carries its own colour and font on the <img>, which is what a
 *     client uses to draw alt text. Every other template goes to someone who
 *     has already corresponded with us and has images switched on; this one
 *     does not, so a blocked image has to degrade to the wordmark in text
 *     rather than to an empty box.
 *
 * @param {object}  o
 * @param {string}  o.preheader  inbox preview line
 * @param {string}  o.title      the one-line headline
 * @param {string}  o.bodyHtml   built from paragraph/button/etc
 */
// Note LOGO_URL, not LOGO_DARK_URL -- this shell is white.
function plainLayout({ preheader = "", title = "", bodyHtml = "" }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>${esc(title)}</title>
</head>
<body style="margin:0;padding:0;background:#ffffff;">
  <div style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${esc(preheader)}</div>
  <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" bgcolor="#ffffff" style="background:#ffffff;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="440" cellpadding="0" cellspacing="0" border="0" role="presentation" style="width:100%;max-width:440px;">
          <tr>
            <td style="padding:0 0 28px;">
              <img src="${LOGO_URL}" width="150" height="45" alt="Arthaleads"
                style="display:block;border:0;color:${HEADING};font-family:${FONT};font-size:17px;font-weight:700;letter-spacing:-.01em;" />
            </td>
          </tr>
          <tr>
            <td>
              ${title ? `<h1 style="margin:0 0 16px;font-family:${FONT};font-size:21px;font-weight:700;line-height:1.35;color:${HEADING};">${esc(title)}</h1>` : ""}
              ${bodyHtml}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** The fallback code, shown inline rather than in a panel. */
function inlineCode(code) {
  return `<p style="margin:0 0 24px;font-family:${FONT};font-size:15px;line-height:1.65;color:${BODY};">
    Or enter this code: <strong style="font-size:19px;letter-spacing:3px;color:${HEADING};">${esc(code)}</strong>
  </p>`;
}

module.exports = {
  layout, plainLayout, button, panel, row, codeBlock, inlineCode, paragraph, divider, esc,
  BRAND, HEADING, BODY, MUTED, FONT, SITE, LOGO_URL, LOGO_DARK_URL, BAND, SOCIAL,
};
