// utils/emailDomains.js
// Disposable / throwaway email domain screening for signup.
//
// Deliberately does NOT block free consumer mail (gmail, outlook, yahoo…):
// most genuine Indian real-estate brokers sign up with a personal Gmail, and
// blocking those would reject real customers along with the fakes.
// What it blocks is temp-mail services whose entire purpose is a throwaway
// inbox — the class that produced the "digeke4231@meikeya.com" bot signup.

// Exact domains. Kept as a Set for O(1) lookup.
const DISPOSABLE_DOMAINS = new Set([
  "0-mail.com", "10minutemail.com", "10minutemail.net", "20minutemail.com",
  "33mail.com", "guerrillamail.com", "guerrillamail.net", "guerrillamail.org",
  "sharklasers.com", "grr.la", "spam4.me", "mailinator.com", "mailinator.net",
  "notmailinator.com", "reallymymail.com", "trbvm.com", "binkmail.com",
  "bobmail.info", "chammy.info", "devnullmail.com", "letthemeatspam.com",
  "mailin8r.com", "mailnesia.com", "maildrop.cc", "harakirimail.com",
  "yopmail.com", "yopmail.fr", "yopmail.net", "cool.fr.nf", "jetable.fr.nf",
  "nospam.ze.tc", "nomail.xl.cx", "mega.zik.dj", "speed.1s.fr", "courriel.fr.nf",
  "moncourrier.fr.nf", "monemail.fr.nf", "monmail.fr.nf",
  "temp-mail.org", "temp-mail.io", "tempmail.com", "tempmail.net",
  "tempmailo.com", "tempr.email", "tmpmail.org", "tmpmail.net", "tmails.net",
  "throwawaymail.com", "throwam.com", "trashmail.com", "trashmail.de",
  "trashmail.net", "trash-mail.com", "wegwerfmail.de", "getnada.com",
  "nada.email", "dispostable.com", "fakeinbox.com", "fakemailgenerator.com",
  "emailondeck.com", "emailfake.com", "email-fake.com", "generator.email",
  "mohmal.com", "moakt.com", "moakt.ws", "tempsky.com", "disbox.net",
  "anonaddy.me", "anonaddy.com", "burnermail.io", "spambog.com", "spambog.de",
  "mytemp.email", "mailtemp.net", "inboxbear.com", "meikeya.com",
  "byom.de", "instant-mail.de", "spamgourmet.com", "mailcatch.com",
  "incognitomail.org", "one-time.email", "linshiyouxiang.net", "mailpoof.com",
  "vomoto.com", "mailbox52.ga", "1secmail.com", "1secmail.org", "1secmail.net",
  "kzccv.com", "qiott.com", "wuuvo.com", "icznn.com", "ezztt.com",
]);

// Substring patterns — catches the endless subdomain/rotating variants that
// temp-mail providers spin up faster than any exact list can track
// (e.g. "foo.tempmail.xyz", "mail.10minute-something.net").
const DISPOSABLE_PATTERNS = [
  "tempmail", "temp-mail", "tempemail", "temp-email",
  "throwaway", "throwmail", "trashmail", "trash-mail",
  "guerrillamail", "mailinator", "yopmail", "fakemail", "fake-mail",
  "disposable", "10minutemail", "minutemail", "burnermail", "spamgourmet",
  "getairmail", "mailnesia", "maildrop", "mohmal", "dispostable",
];

/**
 * True when the address belongs to a known throwaway-inbox service.
 * Returns false for anything unparseable — format validation is a separate
 * concern handled by the Joi schema, and this should never be the thing that
 * rejects a merely malformed address.
 */
function isDisposableEmail(email) {
  const at = String(email || "").toLowerCase().trim().lastIndexOf("@");
  if (at === -1) return false;
  const domain = String(email).toLowerCase().trim().slice(at + 1);
  if (!domain) return false;

  // Walk up the subdomain chain so "x.y.mailinator.com" is caught by the
  // plain "mailinator.com" entry above.
  const labels = domain.split(".");
  for (let i = 0; i < labels.length - 1; i++) {
    if (DISPOSABLE_DOMAINS.has(labels.slice(i).join("."))) return true;
  }
  return DISPOSABLE_PATTERNS.some((p) => domain.includes(p));
}

module.exports = { isDisposableEmail, DISPOSABLE_DOMAINS };
