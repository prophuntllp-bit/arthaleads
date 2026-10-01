// Keeps the bot from sprinkling the same emoji on every message. The prompt
// asks the model to use them sparingly, but a model drifts back to its habit,
// so this enforces the two rules that matter to a reader: never an emoji on
// two replies in a row, and never an emoji already used in the last two bot
// messages.

const EMOJI_RE = /\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic})*/gu;
const ENDS_WITH_EMOJI_RE = /\p{Extended_Pictographic}️?\s*$/u;

function stripEmoji(text) {
  return text
    .replace(EMOJI_RE, "")
    .replace(/️/g, "")
    .replace(/[ \t]+([.,!?;:])/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function limitEmoji(reply, recentBotBodies = []) {
  const mine = String(reply || "").match(EMOJI_RE) || [];
  if (!mine.length) return reply;
  const lastTwo = recentBotBodies.filter(Boolean).slice(-2);
  if (!lastTwo.length) return reply;
  const recent = new Set(lastTwo.flatMap((b) => String(b).match(EMOJI_RE) || []));
  const previousEndedWithEmoji = ENDS_WITH_EMOJI_RE.test(String(lastTwo[lastTwo.length - 1]));
  if (previousEndedWithEmoji || mine.some((e) => recent.has(e))) return stripEmoji(reply);
  return reply;
}

module.exports = { limitEmoji };
