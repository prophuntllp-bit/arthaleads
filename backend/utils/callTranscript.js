// utils/callTranscript.js — who said what on a recorded call (27 Oct 2026).
//
// Whisper (whisper-1) turned calls into one block of text that often looped
// ("hello hello hello...", a Hindi phrase forty times), echoed its own prompt
// back as the transcript, or wrote a Marathi call in Telugu script. Tested on
// real Prophunt calls: gpt-transcribe gets the words and the script right, but
// a mixed (mono) recording cannot say reliably who spoke.
//
//  * Stereo recordings (Plivo: one channel per party) are split by channel.
//    Each channel's speech is found by its loudness, cut into utterances,
//    transcribed, and the two sides are merged by time into turns with exact
//    speakers and timestamps.
//  * Mono recordings (EnableX) are transcribed whole, then an AI splits the
//    text into agent / customer turns, copying the words exactly. When the
//    split does not reproduce the text word for word it is dropped and the
//    plain text is kept.
const { toFile } = require("openai");
const { getClient } = require("./openai");

const STT_MODEL = process.env.CALL_STT_MODEL || "gpt-transcribe";
const SPLIT_MODEL = process.env.CALL_SPLIT_MODEL || "gpt-4.1";

// ── WAV in and out ────────────────────────────────────────────────────────────
function ulaw(b) {
  b = ~b & 0xff;
  const t = (((b & 0x0f) << 3) + 0x84) << ((b & 0x70) >> 4);
  return b & 0x80 ? 0x84 - t : t - 0x84;
}
function alaw(b) {
  b ^= 0x55;
  let t = (b & 0x0f) << 4;
  const seg = (b & 0x70) >> 4;
  t = seg === 0 ? t + 8 : seg === 1 ? t + 0x108 : (t + 0x108) << (seg - 1);
  return b & 0x80 ? t : -t;
}

/** Parses a WAV file into per-channel Int16 samples. Null when not a WAV we can read. */
function parseWav(buf) {
  if (buf.length < 44 || buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WAVE") return null;
  let off = 12, fmt = null, data = null;
  while (off + 8 <= buf.length) {
    const id = buf.toString("ascii", off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    const body = off + 8;
    if (id === "fmt ") fmt = { format: buf.readUInt16LE(body), channels: buf.readUInt16LE(body + 2), rate: buf.readUInt32LE(body + 4), bits: buf.readUInt16LE(body + 14) };
    if (id === "data") { data = buf.subarray(body, Math.min(buf.length, body + size)); break; }
    off = body + size + (size % 2);
  }
  if (!fmt || !data) return null;
  const { format, channels, rate, bits } = fmt;
  const decode = format === 1 && bits === 16 ? (i) => data.readInt16LE(i * 2)
    : format === 7 && bits === 8 ? (i) => ulaw(data[i])
    : format === 6 && bits === 8 ? (i) => alaw(data[i])
    : null;
  if (!decode || !channels) return null;
  const frames = Math.floor(data.length / ((bits / 8) * channels));
  const out = Array.from({ length: channels }, () => new Int16Array(frames));
  for (let f = 0; f < frames; f++) for (let c = 0; c < channels; c++) out[c][f] = decode(f * channels + c);
  return { rate, channels: out };
}

function wavBuffer(samples, rate) {
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) data.writeInt16LE(samples[i], i * 2);
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + data.length, 4); h.write("WAVE", 8);
  h.write("fmt ", 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write("data", 36); h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

// ── Finding speech on one channel ─────────────────────────────────────────────
// 20 ms frames; speech is well above the channel's own noise floor. Pauses up
// to 0.9 s stay in one utterance; utterances are capped at 25 s for the model.
// Anything from 0.1 s counts. The phone network gates the customer's side to
// digital silence and clips speech: a real customer's two "hello"s survived as
// 0.14 s and 0.22 s bursts (28 Oct 2026, owner listened) and were lost at 0.25 s.
// Clicks last 20-40 ms; anything else that slips through comes back empty or as
// filler and is dropped below.
function speechSegments(samples, rate) {
  const frame = Math.max(1, Math.round(rate * 0.02));
  const n = Math.floor(samples.length / frame);
  if (!n) return [];
  const energy = new Float64Array(n);
  for (let f = 0; f < n; f++) {
    let sum = 0;
    for (let i = f * frame; i < (f + 1) * frame; i++) sum += samples[i] * samples[i];
    energy[f] = Math.sqrt(sum / frame);
  }
  const sorted = Array.from(energy).sort((a, b) => a - b);
  const floor = sorted[Math.floor(n * 0.2)] || 0;
  const threshold = Math.max(floor * 3, 400);
  const segs = [];
  let start = -1, lastLoud = -1;
  const GAP = Math.round(0.9 / 0.02), MAX = Math.round(25 / 0.02);
  for (let f = 0; f < n; f++) {
    const loud = energy[f] >= threshold;
    if (loud) {
      if (start < 0) start = f;
      lastLoud = f;
    }
    const tooLong = start >= 0 && f - start >= MAX;
    if (start >= 0 && ((!loud && f - lastLoud > GAP) || tooLong || f === n - 1)) {
      const end = tooLong ? f : lastLoud;
      if ((end - start + 1) * 0.02 >= 0.1) segs.push({ start: Math.max(0, start - 8) * 0.02, end: Math.min(n, end + 9) * 0.02 });
      start = -1;
    }
  }
  return segs;
}

// Arabic script (Urdu) for what was Hindi: "nahi mera bilkul interest nahi hai"
// came back in Urdu letters on a real call (29 Oct 2026). Such a piece is asked
// again as Hindi, which keeps it in Devanagari.
const ARABIC = /[\u0600-\u06FF]/;
const DEVANAGARI = /[\u0900-\u097F]/;

async function transcribeBuffer(buf, filename, prompt) {
  const client = getClient();
  const ask = async (extra) => String((await client.audio.transcriptions.create({ file: await toFile(buf, filename), model: STT_MODEL, ...(prompt ? { prompt } : {}), ...extra })).text || "").trim();
  const text = await ask({});
  if (ARABIC.test(text) && !DEVANAGARI.test(text)) {
    const again = await ask({ language: "hi" }).catch(() => "");
    if (again && !ARABIC.test(again)) return again;
  }
  return text;
}

// The speech-to-text service did not answer (out of credits, outage). Not the same
// as a silent call: the caller saves it as "couldn't transcribe, try again".
class TranscriptionFailed extends Error {
  constructor(cause) { super(`transcription failed: ${cause?.message || cause}`); this.name = "TranscriptionFailed"; }
}

// Words a model invents on a breath or a click; a whole utterance of only these is dropped.
const FILLER_ONLY = /^(thank you\.?|thanks\.?|you\.?|bye\.?|\.+|-+)$/i;

/** Which channel is the agent: the side that introduces the company and the project. */
async function agentChannelByContent(lines, { agentName, company }) {
  const client = getClient();
  const sample = (ch) => lines.filter((l) => l.ch === ch).slice(0, 8).map((l) => l.text).join(" / ").slice(0, 1200);
  try {
    const res = await client.chat.completions.create({
      model: SPLIT_MODEL, temperature: 0, response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Two sides of a real estate sales phone call are given. One is the AGENT (a caller from the company who introduces themselves, the company and the project, asks about requirements and site visits); the other is the CUSTOMER. Answer as JSON {\"agent\":0|1}." },
        { role: "user", content: `Agent's name: ${agentName || "unknown"}. Company: ${company || "unknown"}.\n\nSIDE 0: ${sample(0)}\n\nSIDE 1: ${sample(1)}` },
      ],
    });
    const v = JSON.parse(res.choices[0].message.content || "{}").agent;
    return v === 1 ? 1 : 0;
  } catch {
    return 0;
  }
}

async function stereoTranscript(wav, opts) {
  const [left, right] = wav.channels;
  const pieces = [];
  for (const [ch, samples] of [[0, left], [1, right]]) {
    for (const s of speechSegments(samples, wav.rate)) pieces.push({ ch, ...s, samples: samples.subarray(Math.floor(s.start * wav.rate), Math.ceil(s.end * wav.rate)) });
  }
  const speechSeconds = pieces.reduce((t, p) => t + (p.end - p.start), 0);
  if (speechSeconds < 2) return { method: "stereo", text: "", turns: [], noSpeech: true };

  // Each side in order, with its previous words as context: short pieces on
  // their own drifted between Marathi and Hindi (real call, 27 Oct 2026). The
  // two sides run side by side. A piece that only repeats its context is dropped.
  const texts = new Array(pieces.length).fill("");
  let failed = 0, lastError = null;
  await Promise.all([0, 1].map(async (ch) => {
    let context = "";
    for (let i = 0; i < pieces.length; i++) {
      if (pieces[i].ch !== ch) continue;
      const audio = wavBuffer(pieces[i].samples, wav.rate);
      let text = await transcribeBuffer(audio, `seg-${i}.wav`, context.slice(-300))
        .catch((err) => { failed++; lastError = err; return null; });
      // A clipped one-word piece ("hello") sometimes comes back empty; one more try.
      if (text === "" && pieces[i].end - pieces[i].start < 0.8) text = await transcribeBuffer(audio, `seg-${i}b.wav`).catch(() => "");
      // Speech the model cannot make out still happened: shown as "(unclear)" so the
      // agent and the analysis know the person did say something (a 0.14 s clipped
      // "hello" under the agent's voice, 28 Oct 2026). A failed request stays empty.
      if (text === "") text = "(unclear)";
      text = text || "";
      if (text && context && context.includes(text) && text.length > 12) continue;
      texts[i] = text;
      if (text && text !== "(unclear)") context = `${context} ${text}`.trim();
    }
  }));
  // Speech was there but the service did not answer for most of it: a failure,
  // not an empty call (29 Oct 2026, out-of-credits calls were saved as silent).
  if (failed && failed * 2 >= pieces.length) throw new TranscriptionFailed(lastError);
  const lines = pieces.map((p, i) => ({ ch: p.ch, start: p.start, end: p.end, text: texts[i] }))
    .filter((l) => l.text && !FILLER_ONLY.test(l.text))
    .sort((a, b) => a.start - b.start);
  if (!lines.length || lines.every((l) => l.text === "(unclear)")) return { method: "stereo", text: "", turns: [], noSpeech: true };

  const agentCh = opts.agentChannel === "left" ? 0 : opts.agentChannel === "right" ? 1 : await agentChannelByContent(lines, opts);
  // Consecutive lines from the same side become one turn.
  const turns = [];
  for (const l of lines) {
    const speaker = l.ch === agentCh ? "agent" : "customer";
    const prev = turns[turns.length - 1];
    if (prev && prev.speaker === speaker && l.start - prev.end < 2) {
      prev.text = `${prev.text} ${l.text}`;
      prev.end = l.end;
    } else {
      turns.push({ speaker, start: Math.round(l.start * 10) / 10, end: Math.round(l.end * 10) / 10, text: l.text });
    }
  }
  turns.forEach((t) => { t.end = Math.round(t.end * 10) / 10; });
  return { method: "stereo", text: formatTurns(turns, opts), turns, agentChannel: agentCh === 0 ? "left" : "right" };
}

const norm = (s) => String(s).replace(/[\s\p{P}]+/gu, "").toLowerCase();

async function monoTranscript(buf, filename, opts) {
  const text = await transcribeBuffer(buf, filename).catch((err) => { throw new TranscriptionFailed(err); });
  // Letters plus combining marks: Devanagari vowel signs are marks, so
  // without \p{M} real Hindi and Marathi words did not count as words.
  const realWords = text.split(/\s+/).filter((t) => /[\p{L}\p{M}]{2,}/u.test(t));
  if (realWords.length < 4) return { method: "plain", text, turns: [], noSpeech: true };
  try {
    const client = getClient();
    const res = await client.chat.completions.create({
      model: SPLIT_MODEL, temperature: 0, response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You split a phone-call transcript into speaker turns. The call is between an AGENT (a real estate sales caller from the company, who introduces herself/himself and the project) and a CUSTOMER. Copy the transcript's words exactly, in order, in the original language and script. Do not translate, correct, summarise, add or drop anything. Only decide where each turn starts and who says it. Answer as JSON: {\"turns\":[{\"speaker\":\"agent\"|\"customer\",\"text\":\"...\"}]}" },
        { role: "user", content: `Agent's name: ${opts.agentName || "unknown"}. Company: ${opts.company || "unknown"}.\n\nTranscript:\n${text}` },
      ],
    });
    const turns = (JSON.parse(res.choices[0].message.content || "{}").turns || [])
      .filter((t) => t && (t.speaker === "agent" || t.speaker === "customer") && String(t.text || "").trim())
      .map((t) => ({ speaker: t.speaker, text: String(t.text).trim() }));
    if (turns.length && norm(turns.map((t) => t.text).join(" ")) === norm(text)) {
      return { method: "ai_split", text: formatTurns(turns, opts), turns };
    }
  } catch { /* plain text below */ }
  return { method: "plain", text, turns: [] };
}

function formatTurns(turns, { agentName } = {}) {
  const who = (s) => (s === "agent" ? (agentName ? `${agentName} (agent)` : "Agent") : "Customer");
  return turns.map((t) => `${who(t.speaker)}: ${t.text}`).join("\n");
}

/**
 * Transcribes a call recording. opts: { filename, agentName, company, agentChannel: "left"|"right"|"" }.
 * Returns { method: "stereo"|"ai_split"|"plain", text, turns: [{speaker, text, start?, end?}], noSpeech? }.
 */
async function transcribeCall(buf, opts = {}) {
  const wav = parseWav(buf);
  if (wav && wav.channels.length === 2) return stereoTranscript(wav, opts);
  return monoTranscript(buf, opts.filename || "recording.wav", opts);
}

module.exports = { transcribeCall, parseWav, speechSegments, wavBuffer, formatTurns, TranscriptionFailed, _norm: norm };
