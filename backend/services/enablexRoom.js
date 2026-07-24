// ── EnableX Video API — SIP-enabled audio rooms for the in-app soft phone ──────
// The browser soft phone works by joining an EnableX "room" over WebRTC and then
// dialing the lead's PSTN number INTO that room (client-side room.makeOutboundCall,
// or the dial-out below). This is EnableX's Video API product and uses its OWN
// App ID / App Key (org.enablex.webrtc.videoAppId / videoAppKey) — deliberately
// separate from the Voice API credentials used by the DID dial-bridge flow, so
// enabling this never disturbs the working PSTN calling path.
//
// Docs: https://developer.enablex.io/video/api-reference.html (Rooms + Tokens).
const axios = require("axios");

const VIDEO_BASE = process.env.ENABLEX_VIDEO_BASE || "https://api.enablex.io/video/v1";

function videoAuth(creds) {
  // creds = { videoAppId, videoAppKey }
  return { auth: { username: creds.videoAppId, password: creds.videoAppKey } };
}

// Create a short-lived, audio-only room the agent's browser will join. Kept small
// (2 participants: the agent's browser + the dialed-in lead) and voice-only.
async function createRoom(creds, { name, ownerRef }) {
  const payload = {
    name: name || `crm-call-${Date.now()}`,
    owner_ref: ownerRef,
    settings: {
      description: "Arthaleads in-app call",
      mode: "group",
      participants: 2,
      // Audio-only soft phone — no camera. video:false keeps it a voice call.
      audio: true,
      video: false,
      // Auto-recording is enabled at the room level; the recorded file is fetched
      // separately (follow-up). Two-way audio is the primary deliverable here.
      auto_recording: false,
    },
  };
  const resp = await axios.post(`${VIDEO_BASE}/rooms`, payload, {
    ...videoAuth(creds),
    timeout: 15000,
  });
  // EnableX returns { result, room: { room_id, ... } }
  const room = resp.data?.room || resp.data;
  const roomId = room?.room_id || room?.roomId || room?.id;
  if (!roomId) {
    const err = new Error("EnableX room creation returned no room_id");
    err.enablexBody = resp.data;
    throw err;
  }
  return { roomId, raw: room };
}

// Mint a join token scoped to one room for one agent. This is what the browser
// SDK authenticates with — the App Key never reaches the browser.
async function createToken(creds, roomId, { name, userRef, role = "participant" }) {
  const payload = {
    name: name || "agent",
    role,               // "participant" | "moderator"
    user_ref: userRef,
  };
  const resp = await axios.post(`${VIDEO_BASE}/rooms/${roomId}/tokens`, payload, {
    ...videoAuth(creds),
    timeout: 15000,
  });
  const token = resp.data?.token || resp.data?.result?.token;
  if (!token) {
    const err = new Error("EnableX token creation returned no token");
    err.enablexBody = resp.data;
    throw err;
  }
  return token;
}

// Server-side dial-out of a PSTN number into an existing room. Optional: the
// client SDK's room.makeOutboundCall() can do this from the browser instead. Kept
// here so the backend can drive it if the client path is unavailable on the plan.
async function dialOutToRoom(creds, roomId, phone) {
  const resp = await axios.post(
    `${VIDEO_BASE}/rooms/${roomId}/dialout`,
    { numbers: [phone] },
    { ...videoAuth(creds), timeout: 15000 }
  );
  return resp.data;
}

module.exports = { createRoom, createToken, dialOutToRoom, VIDEO_BASE };
