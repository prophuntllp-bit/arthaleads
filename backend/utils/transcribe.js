// utils/transcribe.js — a customer's WhatsApp voice note as text.
//
// Until 23 Oct 2026 the bot answered every voice note with "I can't play voice
// notes here, please type", and the lead score couldn't tell "I want a visit
// on Saturday" from "wrong number". The text is saved on the message
// (WaMessage.transcript): the bot replies to what was said, the AI score and
// the lead-details reader read it, and the team sees it under the player.
// Returns "" when there is no AI key (staging), the file is unusable, or the
// call fails: the voice note is then handled as before.
const OpenAI = require("openai");

const MODEL = process.env.TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe";
const EXT = { "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/aac": "aac", "audio/amr": "amr", "audio/wav": "wav", "audio/webm": "webm" };
let client = null;
let call = async (buffer, contentType) => {
  if (!client) client = new OpenAI({ timeout: 30000, maxRetries: 1 });
  const ext = EXT[contentType] || "ogg";
  const file = await OpenAI.toFile(buffer, `voice-note.${ext}`, { type: contentType || "audio/ogg" });
  // No language given: customers speak Hindi, Marathi, English or a mix.
  const res = await client.audio.transcriptions.create({ file, model: MODEL });
  return res?.text || "";
};

async function transcribe(buffer, contentType) {
  if (!buffer?.length || (!process.env.OPENAI_API_KEY && call.real)) return "";
  try {
    return String(await call(buffer, contentType) || "").replace(/\s+/g, " ").trim().slice(0, 2000);
  } catch (err) {
    console.error("[WhatsApp] voice note transcription failed:", err?.status || "", err.message);
    return "";
  }
}
call.real = true;

module.exports = { transcribe, _setCall: (fn) => { call = fn; } };
