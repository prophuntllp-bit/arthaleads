// utils/flowAnswer.js — reading a typed reply as an answer to a button question.
//
// Customers often type instead of tapping: "1.5 cr" under the budget buttons,
// "next month" under the timeline ones (22 Oct 2026: "1.5 cr" ended the
// Khopoli flow at the budget question). Used by every agent's button flow
// (services/ctwaFlowService.js), whatever its questions are, so new agents
// get it with nothing to configure.
//
//   readAmount(text)            "1.5 cr" -> { min: 15000000, max: 15000000 }
//   optionRange(option)         the rupee range a budget button stands for
//   matchBudget(text, options)  { option } for the button the amount falls in,
//                               { amount } when it fits none, or null
//   aiMatch(...)                a small model call mapping other typed replies
//                               to one on-screen option, only when clear
//   looksLikeQuestion(text)     the customer asked something
const { parseIndianCurrencyRange } = require("./formFieldMapper");

const CR = 1e7, LAKH = 1e5;

// One number with its unit: "1.5 cr", "95 lac", "150 lakhs", "90L", "1 crore".
function unitAmount(num, unit) {
  const n = Number(num);
  if (!Number.isFinite(n) || n <= 0) return null;
  const u = String(unit || "").toLowerCase();
  if (/^(cr|crs|crore|crores|c)$/.test(u)) return n * CR;
  if (/^(l|lac|lacs|lakh|lakhs|lk)$/.test(u)) return n * LAKH;
  if (/^(k|thousand)$/.test(u)) return n * 1000;
  return null;
}

const BARE_BUDGET = /^(my )?(budget|around|approx\.?|approximately|about|roughly|upto|up to|under|below|max|maximum)?( is| of)?\s*\d+(\.\d+)?\s*(-|to)?\s*(\d+(\.\d+)?)?\s*$/;

/** A rupee amount (or range) in a typed reply, or null. */
function readAmount(text) {
  const s = String(text || "").toLowerCase().replace(/,/g, "").replace(/₹|rs\.?|inr/g, " ").trim();
  if (!s) return null;
  // Ranges and the common forms the form mapper already understands.
  const known = parseIndianCurrencyRange(s);
  if (known && known.max > 0) return known;
  const re = /(\d+(?:\.\d+)?)\s*(crores?|crs?|c|lakhs?|lacs?|lac|lk|l|k|thousand)?\b/g;
  const found = [];
  let m;
  while ((m = re.exec(s))) found.push({ n: m[1], unit: m[2] });
  if (!found.length) return null;
  // "1 - 1.5 cr": the unit written once applies to both numbers.
  const unitFor = (i) => found[i].unit || found.slice(i + 1).find((f) => f.unit)?.unit;
  const values = found.map((f, i) => {
    const withUnit = unitAmount(f.n, unitFor(i));
    if (withUnit) return withUnit;
    // A bare number under a budget question: below 20 means crores ("1.5"),
    // 20 to 999 means lakhs ("90"); anything else isn't a budget. Only when
    // the reply is just that number ("1.5", "budget is 1.4", "around 90"):
    // "I am looking at 3 plots" is not a ₹3 Cr budget.
    if (!BARE_BUDGET.test(s)) return null;
    const n = Number(f.n);
    if (n > 0 && n < 20) return n * CR;
    if (n >= 20 && n < 1000) return n * LAKH;
    return null;
  }).filter(Boolean).slice(0, 2);
  if (!values.length) return null;
  const min = Math.min(...values), max = Math.max(...values);
  // "under 1 cr", "below 90 lakh": an upper limit only.
  if (/\b(under|below|less than|upto|up to|within|max|maximum)\b/.test(s) && values.length === 1) return { min: 0, max };
  return { min, max };
}

/** The range a budget button covers: its saved min/max, else read from its label. */
function optionRange(option) {
  if (option && (option.min > 0 || option.max > 0)) return { min: option.min || 0, max: option.max || 0 };
  const label = String(option?.label || "");
  const r = readAmount(label);
  if (!r) return null;
  if (/\+|above|plus|more|and up/i.test(label)) return { min: r.max, max: 0 };
  if (/under|below|upto|up to|less/i.test(label)) return { min: 0, max: r.max };
  return r;
}

/**
 * A typed budget against budget buttons. { option } when the amount falls in
 * one (lower bound included, upper excluded, so "1.5 cr" picks "1.5Cr+" over
 * "1.25-1.5Cr"); { amount } when it is a real budget that fits none of them;
 * null when there is no amount in the text.
 */
function matchBudget(text, options) {
  const amount = readAmount(text);
  if (!amount) return null;
  const v = amount.min && amount.max ? (amount.min + amount.max) / 2 : amount.max || amount.min;
  for (const o of options || []) {
    const r = optionRange(o);
    if (!r) continue;
    if (v >= r.min && (r.max === 0 || v < r.max)) return { option: o, amount };
  }
  // Exactly on the top edge of the highest closed range ("1.25 cr" with
  // "₹89L – ₹1.25Cr" as the top button): that button.
  const edge = (options || []).find((o) => { const r = optionRange(o); return r && r.max && v === r.max; });
  if (edge) return { option: edge, amount };
  return { amount };
}

const QUESTION_START = /^(what|where|when|which|who|why|how|is|are|can|could|do|does|will|would|should|any|kya|kahan|kaha|kitna|kitne|kab|kaise|kaun|price|location|address|rate|cost|size)\b/i;
/** The customer asked something (a question mark, or it reads as a question). */
function looksLikeQuestion(text) {
  const s = String(text || "").trim();
  return s.includes("?") || QUESTION_START.test(s);
}

// ── AI fallback ──────────────────────────────────────────────────────────────
const MODEL = process.env.FLOW_MATCH_MODEL || "gpt-4o-mini";
let client = null;
async function defaultModel(messages, { maxTokens = 60 } = {}) {
  if (!client) client = require("./ai/gateway").chatClient({ timeout: 15000 });
  const res = await client.chat.completions.create({ model: MODEL, messages, temperature: 0, max_tokens: maxTokens, response_format: { type: "json_object" } });
  return { text: res.choices[0]?.message?.content || "", usage: res.usage };
}
let callModel = defaultModel;

/**
 * Which on-screen option a typed reply clearly means, or null. Never guesses:
 * a question, small talk or anything unclear is null. No key (staging): null.
 * onUsage(usage) is called for accounting.
 */
async function aiMatch(questionText, options, said, onUsage) {
  if (callModel === defaultModel && !process.env.OPENAI_API_KEY) return null;
  if (!options?.length || !String(said || "").trim()) return null;
  const list = options.map((o) => `${o.id}: ${o.label}`).join("\n");
  try {
    const out = await callModel([
      { role: "system", content: "A customer on WhatsApp was asked a question with buttons and typed a reply instead of tapping. Decide which button their reply clearly means. Replies may be in English, Hindi, Marathi or Hinglish. Answer only JSON: {\"option\":\"<button id>\"} or {\"option\":null}. Use null if the reply is a question, small talk, a refusal, or could mean more than one button." },
      { role: "user", content: `Question: ${questionText}\nButtons:\n${list}\nCustomer typed: ${String(said).slice(0, 300)}` },
    ]);
    onUsage?.(out.usage);
    const id = JSON.parse(String(out.text || "").replace(/^```(json)?|```$/g, "").trim())?.option;
    return options.find((o) => o.id === id) || null;
  } catch { return null; }
}

// A reply that only says no / not now / skip, in the languages customers use.
const REFUSAL_RE = /^(no+|nope|nahi+|nahin|nako|na|nai|not now|later|baad me(i|n)?|skip|cancel|don'?t|nothing|no thanks|no thank you|not interested|rehne do|chhodo)[\s.!]*$/i;
// "My name is Rahul" / "I am Rahul" / "This is Rahul": just the name.
const NAME_LEAD_IN_RE = /^(my name is|my name's|name is|i am|i'm|im|this is|it's|its|mera naam|maza nav|majhe nav|naam)\s+/i;

/**
 * What a customer typed after the bot asked them for something (a closing
 * button's "ask them to type something first": their name, email or a note),
 * read against the conversation so far.
 *   { kind: "answer", value }  the thing asked for
 *   { kind: "skip" }           won't give it, still wants what they chose
 *   { kind: "cancel", reply }  changed their mind about what they chose
 *   { kind: "other" }          a question or something else: answer it, ask again
 * 23 Oct 2026: "no" to "May I have your full name?" was saved as the name and
 * the seat confirmed to "Thanks no".
 * `recent` is the last few messages, [{ from: "customer"|"bot", text }].
 */
async function readTypedAnswer({ prompt, saveTo, said, recent = [], choice = "" }, onUsage) {
  const text = String(said || "").replace(/\s+/g, " ").trim();
  if (!text) return { kind: "other" };
  if (!(callModel === defaultModel && !process.env.OPENAI_API_KEY)) {
    try {
      const chat = recent.slice(-8).map((m) => `${m.from === "bot" ? "Business" : "Customer"}: ${String(m.text || "").slice(0, 200)}`).join("\n");
      const out = await callModel([
        { role: "system", content:
          "You read one WhatsApp reply for a real-estate business. The customer tapped a button, the business then asked them to type something, and this is their reply. " +
          "Replies may be in English, Hindi, Marathi or Hinglish. Answer only JSON: " +
          "{\"kind\":\"answer\",\"value\":\"...\"} when the reply gives what was asked (value: only that, e.g. just the person's name, properly capitalised); " +
          "{\"kind\":\"skip\"} when they won't give it but still want what they chose; " +
          "{\"kind\":\"cancel\",\"reply\":\"...\"} when they no longer want what they chose (reply: one short, warm sentence in their language, no dashes); " +
          "{\"kind\":\"other\"} for a question or anything else. A bare \"no\" to a request for their name usually means they would rather not share it: use skip unless the chat shows they changed their mind. " +
          "Never treat words like no, ok, yes, hi, or a question, as a name." },
        { role: "user", content: `Chat so far:\n${chat || "(none)"}\n\nThey tapped: ${choice}\nBusiness asked: ${prompt}\nAsked for: ${saveTo === "name" ? "their name" : saveTo === "email" ? "their email address" : "a short answer"}\nCustomer replied: ${text.slice(0, 300)}` },
      ], { maxTokens: 120 });
      onUsage?.(out.usage);
      const r = JSON.parse(String(out.text || "").replace(/^```(json)?|```$/g, "").trim());
      if (r?.kind === "answer" && String(r.value || "").trim()) return { kind: "answer", value: String(r.value).trim().slice(0, 120) };
      if (r?.kind === "skip") return { kind: "skip" };
      if (r?.kind === "cancel") return { kind: "cancel", reply: String(r.reply || "").trim().slice(0, 300) };
      if (r?.kind === "other") return { kind: "other" };
    } catch { /* the rules below */ }
  }
  // Rules, for when there is no AI (staging) or it failed.
  if (looksLikeQuestion(text)) return { kind: "other" };
  if (REFUSAL_RE.test(text)) return { kind: "skip" };
  if (saveTo === "email") {
    const m = text.match(/[^\s@]+@[^\s@]+\.[a-z]{2,}/i);
    return m ? { kind: "answer", value: m[0] } : { kind: "other" };
  }
  if (saveTo === "name") {
    const { looksLikeCallerName } = require("./personName");
    const name = text.replace(NAME_LEAD_IN_RE, "").replace(/[.!]+$/, "").trim();
    return name.split(" ").length <= 4 && looksLikeCallerName(name) ? { kind: "answer", value: name } : { kind: "other" };
  }
  return text.length <= 300 ? { kind: "answer", value: text } : { kind: "other" };
}

module.exports = {
  readAmount, optionRange, matchBudget, looksLikeQuestion, aiMatch, readTypedAnswer,
  _setModel: (fn) => { callModel = fn || defaultModel; },
};
