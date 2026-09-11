// Catches the things Meta actually rejects templates for, before you submit.
//
// Meta's rejection notices are terse and arrive minutes later ("INVALID_FORMAT"),
// by which point the person who wrote the template has moved on. Every rule here
// exists because it is a documented Meta requirement or a repeated real-world
// rejection cause — not because it is tidier.
//
// Returns a flat list of { level, message }. "block" stops submission;
// "warn" is advice you can ignore.

export const VAR_RX = /\{\{\s*(\d+)\s*\}\}/g;
export const NAME_RX = /^[a-z0-9][a-z0-9_]*$/;

/** Distinct variable numbers in a string, ascending. */
export const varNumbers = (text) =>
  [...new Set((String(text || "").match(VAR_RX) || []).map((m) => Number(m.replace(/\D/g, ""))))]
    .sort((a, b) => a - b);

// Words that make Meta reclassify a template as marketing. Sending promotional
// content under a UTILITY category is the single most common rejection we can
// predict from the text alone.
const PROMO_WORDS = /\b(offer|discount|sale|deal|free|limited|hurry|book now|exclusive|off|cashback|bonus|lowest price|best price)\b/i;

export function lintTemplate(draft, { existingNames = [] } = {}) {
  const { name = "", category = "", body = "", footer = "", headerText = "", examples = [], buttons = [] } = draft;
  const out = [];
  const block = (message) => out.push({ level: "block", message });
  const warn  = (message) => out.push({ level: "warn", message });

  // ── Name ────────────────────────────────────────────────────────────────────
  if (!name.trim()) block("Give the template a name.");
  else if (!NAME_RX.test(name)) block("The name can only use lowercase letters, numbers and underscores, and cannot start with an underscore.");
  else if (existingNames.includes(name)) block(`You already have a template called "${name}". Names must be unique on your WhatsApp account.`);

  // ── Body ────────────────────────────────────────────────────────────────────
  const text = body.trim();
  if (!text) { block("Add the message body."); return out; }

  const nums = varNumbers(text);

  // Meta requires 1..n with no gaps. {{1}} and {{3}} is rejected outright.
  const expected = nums.map((_, i) => i + 1);
  if (nums.length && nums.join() !== expected.join()) {
    block(`Variables must be numbered {{1}} to {{${nums.length}}} with no gaps. Right now you have ${nums.map((n) => `{{${n}}}`).join(", ")}.`);
  }

  // A template that opens or closes on a placeholder is rejected — Meta cannot
  // tell what the message says when the variable is empty.
  if (/^\s*\{\{\s*\d+\s*\}\}/.test(text)) block("The message cannot start with a variable. Put some text before it.");
  if (/\{\{\s*\d+\s*\}\}\s*$/.test(text))  block("The message cannot end with a variable. Add text after it, or move it earlier.");

  // Two placeholders touching read as one blank to Meta's reviewer.
  if (/\{\{\s*\d+\s*\}\}[\s,.-]{0,2}\{\{\s*\d+\s*\}\}/.test(text)) {
    warn("Two variables sit next to each other with almost no text between them. Meta often rejects this.");
  }

  // Examples are mandatory whenever there are variables.
  if (nums.length) {
    const missing = [];
    for (let i = 0; i < nums.length; i++) {
      if (!String(examples[i] ?? "").trim()) missing.push(`{{${i + 1}}}`);
    }
    if (missing.length) {
      block(`Meta needs a sample value for every variable. Still empty: ${missing.join(", ")}.`);
    }
  }

  // Mostly-placeholder templates get rejected as having no reviewable content.
  const literal = text.replace(VAR_RX, "").replace(/\s+/g, " ").trim();
  if (nums.length >= 3 && literal.length < nums.length * 20) {
    warn("There is very little fixed text around the variables. Meta rejects templates it cannot read as a real message.");
  }

  if (text.length > 1024) block("The body is over Meta's 1024-character limit.");
  if (footer.length > 60) block("The footer is over Meta's 60-character limit.");
  if (headerText.length > 60) block("The header is over Meta's 60-character limit.");

  // ── Category ────────────────────────────────────────────────────────────────
  if (category === "UTILITY" || category === "AUTHENTICATION") {
    const hit = text.match(PROMO_WORDS) || footer.match(PROMO_WORDS) || headerText.match(PROMO_WORDS);
    if (hit) {
      warn(`"${hit[0]}" reads as promotional. Meta will likely reclassify this as Marketing, or reject it under ${category.toLowerCase()}.`);
    }
  }
  if (category === "MARKETING") {
    warn("Marketing templates can only go to leads who have recorded opt-in, and cost more per message than utility.");
  }

  // ── Buttons ─────────────────────────────────────────────────────────────────
  const quick = buttons.filter((b) => b.type === "QUICK_REPLY");
  const urls  = buttons.filter((b) => b.type === "URL");
  const phones = buttons.filter((b) => b.type === "PHONE_NUMBER");
  if (quick.length > 10) block("WhatsApp allows at most 10 quick reply buttons.");
  if (urls.length > 2)   block("WhatsApp allows at most 2 link buttons.");
  if (phones.length > 1) block("WhatsApp allows at most 1 call button.");

  buttons.forEach((b, i) => {
    const where = `Button ${i + 1}`;
    if (!String(b.text || "").trim()) block(`${where} has no label.`);
    else if (b.text.length > 25) block(`${where}'s label is over Meta's 25-character limit.`);
    if (b.type === "URL" && !String(b.url || "").trim()) block(`${where} is a link button with no URL.`);
    if (b.type === "URL" && b.url && !/^https?:\/\//i.test(b.url)) block(`${where}'s URL must start with http:// or https://`);
    if (b.type === "PHONE_NUMBER" && !String(b.phone_number || "").trim()) block(`${where} is a call button with no phone number.`);
  });

  return out;
}

export const hasBlockers = (issues) => issues.some((i) => i.level === "block");
