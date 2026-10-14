// Artha's how-to knowledge, searched instead of sent whole.
//
// The old helpbot sent its entire 64,000-character guide (utils/openai.js,
// HELP_SYSTEM_PROMPT) with every message. Artha v2 splits the same guide into
// its sections (the ALL-CAPS headings) and the model asks for the few that
// match, so a "who should I call?" question doesn't pay for the whole manual.
// The guide itself stays where it is, so there is one copy to keep current.
const { __test: { HELP_SYSTEM_PROMPT } } = require("../utils/openai");

// Parts of the old prompt that are instructions to the old bot, not product knowledge.
const SKIP = /^(COPILOT|RESPONSE RULES|ANSWER FIRST)/;
const HEADING = /^[A-Z0-9][A-Z0-9 ,/&()'+.\-–]{4,}$/;

let sections = null;
function load() {
  if (sections) return sections;
  sections = [];
  let current = { title: "Overview", lines: [] };
  for (const raw of HELP_SYSTEM_PROMPT.split("\n")) {
    const line = raw.trim();
    if (HEADING.test(line) && line === line.toUpperCase() && /[A-Z]{3}/.test(line)) {
      if (current.lines.join("").trim()) sections.push(current);
      current = { title: line, lines: [] };
    } else {
      current.lines.push(raw);
    }
  }
  if (current.lines.join("").trim()) sections.push(current);
  sections = sections
    .filter((s) => !SKIP.test(s.title))
    .map((s) => {
      const text = s.lines.join("\n").trim();
      return { title: s.title, text, titleWords: new Set(tokens(s.title)), words: tokens(text) };
    });
  return sections;
}

const STOP = new Set(["the", "a", "an", "to", "of", "in", "on", "and", "or", "is", "i", "my", "how", "do", "can", "what", "for", "it", "with", "me", "from", "kaise", "kya", "ka", "ki", "ke", "hai", "karo", "karna"]);
function tokens(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9ऀ-ॿ ]+/g, " ").split(/\s+/).filter((w) => w.length > 1 && !STOP.has(w));
}

/** The best-matching guide sections for a question: [{ title, text }], at most `limit`. */
function searchHelp(query, limit = 3) {
  const q = [...new Set(tokens(query))];
  if (!q.length) return [];
  const match = (x, w) => x === w || (w.length > 3 && (x.startsWith(w) || w.startsWith(x)) && x.length > 3);
  const scored = load().map((s) => {
    let score = 0;
    for (const w of q) {
      if ([...s.titleWords].some((x) => match(x, w))) score += 3;           // the heading names it
      const hits = s.words.filter((x) => match(x, w)).length;
      if (hits) score += (1 + Math.log(hits)) / Math.log(10 + s.words.length / 40); // long sections don't win by length
    }
    return { s, score };
  }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, limit);
  return scored.map(({ s }) => ({ title: s.title, text: s.text.slice(0, 1800) }));
}

module.exports = { searchHelp, _sections: load };
