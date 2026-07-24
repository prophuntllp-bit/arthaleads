// ── EnableX Video API — audio rooms for the in-app soft phone ─────────────────
// The browser soft phone joins an EnableX "room" over WebRTC and dials the lead's
// PSTN number INTO that room (client-side room.makeOutboundCall). This is
// EnableX's Video API product and uses its OWN App ID / App Key
// (org.enablex.webrtc.videoAppId / videoAppKey) — separate from the Voice API
// credentials used by the DID dial-bridge flow, so enabling this never disturbs
// the working PSTN calling path.
//
// Endpoint shapes below are taken verbatim from EnableX's official sample server
// (github.com/EnableX/One-to-One-Video-Sample-Web-Application-with-annotation,
// server/vcxroom.js): host api.enablex.io, POST /v1/rooms and
// POST /v1/rooms/{roomId}/tokens, Basic auth with appId:appKey.
const axios = require("axios");

const VIDEO_BASE = process.env.ENABLEX_VIDEO_BASE || "https://api.enablex.io/v1";

function videoAuth(creds) {
  // creds = { videoAppId, videoAppKey }
  return { auth: { username: creds.videoAppId, password: creds.videoAppKey } };
}

// Create a short-lived room the agent's browser joins. Voice-only is a client-side
// join option ({ audio:true, video:false }) — the room itself has no audio/video
// flag; we just keep it a small 2-party, active-talker room.
async function createRoom(creds, { name, ownerRef }) {
  const payload = {
    name: name || `crm-call-${Date.now()}`,
    owner_ref: ownerRef,
    settings: {
      description:    "Arthaleads in-app call",
      scheduled:      false,
      scheduled_time: "",
      participants:   "2",
      duration:       "60",
      auto_recording: false,
      active_talker:  true,
      wait_moderator: false,
      quality:        "SD",
      adhoc:          false,
      mode:           "group",
      canvas:         false,
    },
    sip: { enabled: false },
  };
  const resp = await axios.post(`${VIDEO_BASE}/rooms`, payload, {
    ...videoAuth(creds),
    timeout: 15000,
  });
  // EnableX returns { result, room: { room_id, ... } }.
  const room = resp.data?.room || resp.data;
  const roomId = room?.room_id || room?.roomId || room?.id;
  if (!roomId) {
    const err = new Error("EnableX room creation returned no room_id");
    err.enablexBody = resp.data;
    throw err;
  }
  return { roomId, raw: room };
}

// Mint a join token scoped to one room for one agent. The App Key never reaches
// the browser — only this token does.
async function createToken(creds, roomId, { name, userRef, role = "moderator" }) {
  const payload = { roomId, name: name || "agent", role, user_ref: userRef };
  const resp = await axios.post(`${VIDEO_BASE}/rooms/${roomId}/tokens`, payload, {
    ...videoAuth(creds),
    timeout: 15000,
  });
  // EnableX returns { result, token: "..." }.
  const token = resp.data?.token || resp.data?.result?.token;
  if (!token) {
    const err = new Error("EnableX token creation returned no token");
    err.enablexBody = resp.data;
    throw err;
  }
  return token;
}

module.exports = { createRoom, createToken, VIDEO_BASE };
