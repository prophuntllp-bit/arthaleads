// utils/videoCompress.js
//
// Prepares a project video for WhatsApp. Meta accepts H.264/AAC MP4 up to 16MB;
// we cap at 10MB so a video is never near the limit and loads fast on mobile
// data. Policy (agreed with the team):
//   - up to 10MB and already H.264/AAC MP4 → stored untouched
//   - 10MB to 20MB (or a codec WhatsApp won't take) → re-encoded to fit 10MB
//   - over 20MB → rejected before any work is done
//
// ffmpeg comes from the ffmpeg-static package (a bundled binary), so the
// Railway image needs no extra system packages. Encoding is CPU heavy and this
// process also serves the WhatsApp webhook, so only one encode runs at a time.
const { spawn } = require("child_process");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const ffmpegPath = require("ffmpeg-static");

const MB = 1024 * 1024;
const MAX_UPLOAD_BYTES = 20 * MB;
const TARGET_MAX_BYTES = 10 * MB;
const AIM_BYTES = 9.2 * MB; // aim under the cap: rate control overshoots a little
const AUDIO_BPS = 96000;
const MIN_VIDEO_BPS = 200000; // below this the picture is unwatchable — ask for a shorter clip
const MAX_VIDEO_BPS = 3000000;

class VideoError extends Error {
  constructor(message, statusCode = 400) { super(message); this.statusCode = statusCode; }
}

function run(args) {
  return new Promise((resolve, reject) => {
    const p = spawn(ffmpegPath, args, { windowsHide: true });
    let err = "";
    p.stderr.on("data", (d) => { err += d.toString(); if (err.length > 200000) err = err.slice(-100000); });
    p.on("error", reject);
    p.on("close", (code) => resolve({ code, stderr: err }));
  });
}

async function probe(file) {
  // ffmpeg exits non-zero with no output file, but still prints the stream info.
  const { stderr } = await run(["-hide_banner", "-i", file]);
  const dur = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  return {
    durationSec: dur ? (+dur[1]) * 3600 + (+dur[2]) * 60 + parseFloat(dur[3]) : 0,
    video: (stderr.match(/Video:\s*([a-z0-9_]+)/i) || [])[1] || null,
    audio: (stderr.match(/Audio:\s*([a-z0-9_]+)/i) || [])[1] || null,
    isMp4: /Input #0,\s*(mov,mp4|mp4)/i.test(stderr),
    hasVideo: /Video:/.test(stderr),
  };
}

// One encode at a time — see the note at the top.
let chain = Promise.resolve();
function exclusive(fn) {
  const next = chain.then(fn, fn);
  chain = next.catch(() => {});
  return next;
}

async function encode(inFile, outFile, videoBps) {
  const { code, stderr } = await run([
    "-y", "-hide_banner", "-i", inFile,
    "-vf", "scale=w=1280:h=1280:force_original_aspect_ratio=decrease:force_divisible_by=2",
    "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p",
    "-b:v", String(Math.round(videoBps)), "-maxrate", String(Math.round(videoBps * 1.15)), "-bufsize", String(Math.round(videoBps * 2)),
    "-c:a", "aac", "-b:a", String(AUDIO_BPS), "-ac", "2",
    "-movflags", "+faststart", "-threads", "2",
    outFile,
  ]);
  if (code !== 0) throw new VideoError("That video couldn't be processed. Try exporting it as a standard MP4.", 422);
  return (await fs.stat(outFile)).size;
}

/**
 * @param {Buffer} buffer raw uploaded bytes
 * @returns {{buffer: Buffer, sizeBytes: number, originalBytes: number, compressed: boolean, durationSec: number}}
 */
function prepareVideo(buffer) {
  if (!buffer?.length) throw new VideoError("No video received.");
  if (buffer.length > MAX_UPLOAD_BYTES) {
    throw new VideoError(`Video is ${(buffer.length / MB).toFixed(1)}MB. Videos over 20MB can't be uploaded, please trim or shrink it first.`, 413);
  }
  return exclusive(async () => {
    const id = crypto.randomBytes(6).toString("hex");
    const inFile = path.join(os.tmpdir(), `pv-in-${id}`);
    const outFile = path.join(os.tmpdir(), `pv-out-${id}.mp4`);
    try {
      await fs.writeFile(inFile, buffer);
      const info = await probe(inFile);
      if (!info.hasVideo || !info.durationSec) throw new VideoError("That file doesn't look like a video.", 422);

      const compliant = info.isMp4 && info.video === "h264" && (!info.audio || info.audio === "aac");
      if (buffer.length <= TARGET_MAX_BYTES && compliant) {
        return { buffer, sizeBytes: buffer.length, originalBytes: buffer.length, compressed: false, durationSec: info.durationSec };
      }

      let bps = Math.min(MAX_VIDEO_BPS, (AIM_BYTES * 8) / info.durationSec - AUDIO_BPS);
      if (bps < MIN_VIDEO_BPS) {
        throw new VideoError("This video is too long to fit in 10MB at a watchable quality. Please keep it under about 3 minutes.", 422);
      }
      let size = await encode(inFile, outFile, bps);
      if (size > TARGET_MAX_BYTES) {
        bps *= 0.7;
        if (bps < MIN_VIDEO_BPS) throw new VideoError("Couldn't shrink this video under 10MB. Please upload a shorter clip.", 422);
        size = await encode(inFile, outFile, bps);
      }
      if (size > TARGET_MAX_BYTES) throw new VideoError("Couldn't shrink this video under 10MB. Please upload a shorter clip.", 422);
      return { buffer: await fs.readFile(outFile), sizeBytes: size, originalBytes: buffer.length, compressed: true, durationSec: info.durationSec };
    } finally {
      fs.rm(inFile, { force: true }).catch(() => {});
      fs.rm(outFile, { force: true }).catch(() => {});
    }
  });
}

module.exports = { prepareVideo, VideoError, MAX_UPLOAD_BYTES, TARGET_MAX_BYTES };
