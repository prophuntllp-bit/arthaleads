const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { v2: cloudinary } = require("cloudinary");
const WebSocket = require("ws");

const Lead = require("../models/Lead");

const STREAM_PATH_PREFIX = "/audio/calls/";
const SAMPLE_RATE = 16000;
const activeTracks = new Map();

function diagnosticsEnabled() {
  return String(process.env.CALL_STREAM_DIAGNOSTICS_ENABLED || "").toLowerCase() === "true";
}

function signingSecret() {
  return process.env.CALL_STREAM_SECRET || process.env.JWT_SECRET || "";
}

function safeId(value) {
  return String(value || "unknown").replace(/[^a-zA-Z0-9_.-]/g, "_");
}

function streamSignature(orgId, ownerRef, voiceId) {
  const secret = signingSecret();
  if (!secret) throw new Error("CALL_STREAM_SECRET or JWT_SECRET is required");
  return crypto.createHmac("sha256", secret)
    .update(`${orgId}:${ownerRef}:${voiceId}`)
    .digest("hex");
}

function signaturesMatch(actual, expected) {
  const left = Buffer.from(String(actual || ""));
  const right = Buffer.from(expected);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function buildCallStreamUrl({ orgId, ownerRef, voiceId }) {
  const appUrl = process.env.APP_URL || "https://api.arthaleads.com";
  const wsBase = (process.env.CALL_STREAM_WS_BASE_URL || appUrl)
    .replace(/^http:/i, "ws:")
    .replace(/^https:/i, "wss:")
    .replace(/\/$/, "");
  const signature = streamSignature(orgId, ownerRef, voiceId);
  return `${wsBase}${STREAM_PATH_PREFIX}${encodeURIComponent(orgId)}/${encodeURIComponent(ownerRef)}/${encodeURIComponent(voiceId)}?signature=${signature}`;
}

function decodeMuLawSample(value) {
  const decoded = (~value) & 0xff;
  const sign = decoded & 0x80;
  const exponent = (decoded >> 4) & 0x07;
  const mantissa = decoded & 0x0f;
  const sample = (((mantissa << 3) + 0x84) << exponent) - 0x84;
  return sign ? -sample : sample;
}

function decodeMuLawToPcm16(input) {
  const output = Buffer.alloc(input.length * 2);
  for (let index = 0; index < input.length; index += 1) {
    output.writeInt16LE(decodeMuLawSample(input[index]), index * 2);
  }
  return output;
}

function resamplePcm16(input, fromRate, toRate) {
  if (!input.length || fromRate === toRate) return input;
  const inputSamples = Math.floor(input.length / 2);
  const outputSamples = Math.max(1, Math.floor((inputSamples * toRate) / fromRate));
  const output = Buffer.alloc(outputSamples * 2);
  for (let index = 0; index < outputSamples; index += 1) {
    const sourceIndex = (index * fromRate) / toRate;
    const low = Math.floor(sourceIndex);
    const high = Math.min(low + 1, inputSamples - 1);
    const ratio = sourceIndex - low;
    const first = input.readInt16LE(low * 2);
    const second = input.readInt16LE(high * 2);
    output.writeInt16LE(Math.round(first + (second - first) * ratio), index * 2);
  }
  return output;
}

function createWavBuffer(pcm) {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

async function saveDiagnosticResult(state, result) {
  const lead = await Lead.findOne({
    orgId: state.orgId,
    "activities.meta.ownerRef": state.ownerRef,
  });
  if (!lead) return;

  const activityIndex = lead.activities.findIndex(
    activity => activity.meta?.ownerRef === state.ownerRef
  );
  if (activityIndex < 0) return;

  const current = lead.activities[activityIndex].meta?.recordingDiagnostics || {};
  const tracks = Array.isArray(current.tracks) ? current.tracks : [];
  const nextTracks = tracks.filter(track => track.voiceId !== state.voiceId);
  nextTracks.push(result);
  lead.activities[activityIndex].meta = {
    ...lead.activities[activityIndex].meta,
    recordingDiagnostics: {
      ...current,
      status: "captured",
      updatedAt: new Date().toISOString(),
      tracks: nextTracks,
    },
  };
  lead.markModified("activities");
  await lead.save();
}

async function finalizeTrack(state) {
  if (state.finalizePromise) return state.finalizePromise;
  state.finalizePromise = (async () => {
    await state.writePromise;
    if (!state.bytes) return;
    const pcm = await fs.promises.readFile(state.pcmPath);
    await fs.promises.writeFile(state.wavPath, createWavBuffer(pcm));

    let trackUrl = null;
    if (process.env.CLOUDINARY_CLOUD_NAME) {
      try {
        const upload = await cloudinary.uploader.upload(state.wavPath, {
          resource_type: "video",
          folder: "arthaleads/call-recording-diagnostics",
          public_id: `${safeId(state.ownerRef)}/${safeId(state.voiceId)}`,
          overwrite: true,
        });
        trackUrl = upload.secure_url;
      } catch (error) {
        console.error("[call-stream] Cloudinary upload failed", state.voiceId, error.message);
      }
    }

    const result = {
      voiceId: state.voiceId,
      streamId: state.streamId || "",
      from: state.from || "",
      to: state.to || "",
      encoding: "pcm_s16le",
      sampleRate: SAMPLE_RATE,
      bytes: state.bytes,
      duration: Number((state.bytes / 2 / SAMPLE_RATE).toFixed(2)),
      trackUrl,
      capturedAt: new Date().toISOString(),
    };
    await saveDiagnosticResult(state, result);
    console.info("[call-stream] diagnostic track finalized", result);
    await Promise.allSettled([
      fs.promises.unlink(state.pcmPath),
      fs.promises.unlink(state.wavPath),
    ]);
  })().catch(error => {
    console.error("[call-stream] finalize failed", state.voiceId, error.message);
  }).finally(() => {
    activeTracks.delete(state.voiceId);
  });
  return state.finalizePromise;
}

async function stopCallStream(voiceId) {
  const state = activeTracks.get(String(voiceId || ""));
  if (!state) return false;
  await finalizeTrack(state);
  if (state.websocket.readyState === WebSocket.OPEN) state.websocket.close();
  return true;
}

function parseStreamRequest(request) {
  const url = new URL(request.url, "http://localhost");
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length !== 5 || parts[0] !== "audio" || parts[1] !== "calls") return null;
  const [orgId, ownerRef, voiceId] = parts.slice(2).map(decodeURIComponent);
  const expected = streamSignature(orgId, ownerRef, voiceId);
  if (!signaturesMatch(url.searchParams.get("signature"), expected)) return null;
  return { orgId, ownerRef, voiceId };
}

function attachCallStreamRecorder(server) {
  if (!diagnosticsEnabled()) {
    console.info("[call-stream] diagnostics disabled");
    return;
  }

  if (!signingSecret()) {
    console.error("[call-stream] diagnostics disabled: signing secret missing");
    return;
  }

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  const websocketServer = new WebSocket.Server({ noServer: true });
  server.on("upgrade", (request, socket, head) => {
    let identity = null;
    try { identity = parseStreamRequest(request); } catch {}
    if (!identity) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }
    websocketServer.handleUpgrade(request, socket, head, websocket => {
      websocketServer.emit("connection", websocket, request, identity);
    });
  });

  websocketServer.on("connection", (websocket, request, identity) => {
    const directory = path.join(os.tmpdir(), "arthaleads-call-streams", safeId(identity.ownerRef));
    fs.mkdirSync(directory, { recursive: true });
    const state = {
      ...identity,
      bytes: 0,
      frameCount: 0,
      writePromise: Promise.resolve(),
      websocket,
      pcmPath: path.join(directory, `${safeId(identity.voiceId)}.pcm`),
      wavPath: path.join(directory, `${safeId(identity.voiceId)}.wav`),
    };
    fs.writeFileSync(state.pcmPath, Buffer.alloc(0));
    activeTracks.set(identity.voiceId, state);
    console.info("[call-stream] websocket connected", identity);

    websocket.on("message", async message => {
      try {
        const event = JSON.parse(message.toString());
        if (event.event === "start_media") {
          state.streamId = event.stream_id || event.start?.stream_id || "";
          state.from = event.from || event.start?.from || "";
          state.to = event.to || event.start?.to || "";
          return;
        }
        if (event.event === "stop_media") {
          await finalizeTrack(state);
          websocket.close();
          return;
        }
        if (event.event !== "media" || !event.media?.payload) return;

        const format = event.media.format || {};
        const encoding = String(format.encoding || "ulaw").toLowerCase();
        const encoded = Buffer.from(event.media.payload, "base64");
        let pcm = /linear|pcm|l16|s16/.test(encoding)
          ? encoded
          : decodeMuLawToPcm16(encoded);
        const inputRate = Number(format.sample_rate || format.sampleRate || 8000);
        pcm = resamplePcm16(pcm, inputRate, SAMPLE_RATE);
        state.writePromise = state.writePromise.then(() => fs.promises.appendFile(state.pcmPath, pcm));
        await state.writePromise;
        state.bytes += pcm.length;
        state.frameCount += 1;
        if (state.frameCount === 1) {
          console.info("[call-stream] first audio frame received", {
            voiceId: state.voiceId,
            encoding,
            inputRate,
          });
        }
      } catch (error) {
        console.warn("[call-stream] ignored invalid frame", error.message);
      }
    });

    websocket.on("close", () => finalizeTrack(state));
    websocket.on("error", error => {
      console.warn("[call-stream] websocket error", identity.voiceId, error.message);
    });
  });

  console.info("[call-stream] diagnostic recorder attached", STREAM_PATH_PREFIX);
}

module.exports = {
  attachCallStreamRecorder,
  buildCallStreamUrl,
  diagnosticsEnabled,
  stopCallStream,
};
