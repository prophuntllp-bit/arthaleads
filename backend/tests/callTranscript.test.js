// Speaker-separated call transcripts (utils/callTranscript.js, 27 Oct 2026).
// A synthetic stereo call (left speaks, then right, then left) with OpenAI faked:
// each utterance is found on its own channel, transcribed, and merged by time
// into agent / customer turns. Mono recordings get the AI split, kept only when
// it reproduces the transcript word for word.
const { test, run, assert } = require("./helpers/harness");

const RATE = 8000;
// The fake transcriber names an utterance by its loudness.
const BY_AMP = { 3000: "Hello, Sheetal from PropHunt.", 6000: "Haan bataiye.", 9000: "Site visit kab karenge?" };
let sttCalls = 0;
let chatReply = () => ({});
const fake = {
  audio: { transcriptions: { create: async ({ file }) => {
    sttCalls++;
    const buf = Buffer.from(await file.arrayBuffer());
    if (buf.toString("ascii", 0, 4) !== "RIFF") return { text: "मोनो कॉल का पूरा पाठ। हाँ बताइए।" };
    let max = 0;
    for (let i = 44; i + 1 < buf.length; i += 2) max = Math.max(max, Math.abs(buf.readInt16LE(i)));
    const key = Object.keys(BY_AMP).map(Number).sort((a, b) => Math.abs(a - max) - Math.abs(b - max))[0];
    return { text: BY_AMP[key] };
  } } },
  chat: { completions: { create: async (req) => ({ choices: [{ message: { content: JSON.stringify(chatReply(req)) } }] }) } },
};
require("../utils/openai").getClient = () => fake;
const ct = require("../utils/callTranscript");

/** Stereo 16-bit PCM WAV; bursts: [{ch, from, to, amp}] in seconds. */
function stereoWav(seconds, bursts) {
  const frames = seconds * RATE;
  const data = Buffer.alloc(frames * 4);
  for (let f = 0; f < frames; f++) {
    const t = f / RATE;
    for (const ch of [0, 1]) {
      const b = bursts.find((x) => x.ch === ch && t >= x.from && t < x.to);
      const v = b ? Math.round(b.amp * Math.sin(2 * Math.PI * 300 * t)) : Math.round((Math.random() - 0.5) * 40);
      data.writeInt16LE(v, f * 4 + ch * 2);
    }
  }
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + data.length, 4); h.write("WAVE", 8); h.write("fmt ", 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22); h.writeUInt32LE(RATE, 24);
  h.writeUInt32LE(RATE * 4, 28); h.writeUInt16LE(4, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

test("parseWav reads both channels of a stereo file", () => {
  const w = ct.parseWav(stereoWav(1, [{ ch: 1, from: 0.2, to: 0.6, amp: 5000 }]));
  assert.equal(w.rate, RATE);
  assert.equal(w.channels.length, 2);
  assert.equal(w.channels[0].length, RATE);
});

test("speech is found where it is, not in the background noise", () => {
  const w = ct.parseWav(stereoWav(6, [{ ch: 0, from: 1, to: 2, amp: 3000 }, { ch: 0, from: 4, to: 4.6, amp: 3000 }]));
  const segs = ct.speechSegments(w.channels[0], RATE);
  assert.equal(segs.length, 2);
  assert.ok(Math.abs(segs[0].start - 0.84) < 0.2 && Math.abs(segs[0].end - 2.18) < 0.2, JSON.stringify(segs));
  assert.equal(ct.speechSegments(w.channels[1], RATE).length, 0, "the silent side has nothing");
});

test("stereo: each side transcribed separately and merged by time, agent side known", async () => {
  const wav = stereoWav(9, [
    { ch: 0, from: 0.5, to: 2.0, amp: 3000 },   // agent intro
    { ch: 1, from: 2.6, to: 3.6, amp: 6000 },   // customer
    { ch: 0, from: 4.5, to: 6.0, amp: 9000 },   // agent question
  ]);
  const out = await ct.transcribeCall(wav, { agentChannel: "left", agentName: "Sheetal" });
  assert.equal(out.method, "stereo");
  assert.deepEqual(out.turns.map((t) => [t.speaker, t.text]), [
    ["agent", "Hello, Sheetal from PropHunt."],
    ["customer", "Haan bataiye."],
    ["agent", "Site visit kab karenge?"],
  ]);
  assert.ok(out.turns[1].start > out.turns[0].start && out.turns[2].start > out.turns[1].start, "in time order");
  assert.match(out.text, /^Sheetal \(agent\): Hello/);
});

test("stereo: the agent side is worked out from what is said when not configured", async () => {
  chatReply = (req) => (req.response_format ? { agent: 1 } : {});
  const wav = stereoWav(5, [{ ch: 1, from: 0.5, to: 2, amp: 3000 }, { ch: 0, from: 2.6, to: 3.6, amp: 6000 }]);
  const out = await ct.transcribeCall(wav, { agentChannel: "" });
  assert.deepEqual(out.turns.map((t) => t.speaker), ["agent", "customer"]);
  assert.equal(out.agentChannel, "right");
});

test("stereo: no speech on either side is reported as no conversation, nothing transcribed", async () => {
  const before = sttCalls;
  const out = await ct.transcribeCall(stereoWav(4, []), {});
  assert.equal(out.noSpeech, true);
  assert.equal(sttCalls, before);
});

test("mono: the AI split is kept only when it copies the text exactly", async () => {
  chatReply = () => ({ turns: [{ speaker: "agent", text: "मोनो कॉल का पूरा पाठ।" }, { speaker: "customer", text: "हाँ बताइए।" }] });
  const ok = await ct.transcribeCall(Buffer.from("ID3 not a wav"), { filename: "r.mp3" });
  assert.equal(ok.method, "ai_split");
  assert.equal(ok.turns.length, 2);
  chatReply = () => ({ turns: [{ speaker: "agent", text: "Mono call full text (translated)." }] });
  const changed = await ct.transcribeCall(Buffer.from("ID3 not a wav"), { filename: "r.mp3" });
  assert.equal(changed.method, "plain", "a rewritten split is dropped");
  assert.equal(changed.turns.length, 0);
  assert.equal(changed.text, "मोनो कॉल का पूरा पाठ। हाँ बताइए।");
});

run("Call transcripts by speaker");
