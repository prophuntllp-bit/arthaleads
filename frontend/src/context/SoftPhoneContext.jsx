// ── In-app soft phone ─────────────────────────────────────────────────────────
// Turns the agent's browser into the phone: it joins an EnableX audio room over
// WebRTC and dials the lead's real number INTO that room. Because EnableX never
// calls the agent's mobile, this path is immune to the PSTN "instant no-answer"
// failure that affects the dial-bridge flow.
//
// This provider is ADDITIVE. It does nothing unless the org has opted in
// (org.enablex.webrtc.enabled) AND an agent explicitly starts an in-app call. The
// existing PSTN "Call" button keeps working exactly as before and is the default.
import { createContext, useContext, useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import api from "../services/api";
import { useAuth } from "./AuthContext";
import { loadEnxRtc, webrtcSupported } from "../utils/enxLoader";

const SoftPhoneContext = createContext(null);
export const useSoftPhone = () => useContext(SoftPhoneContext);

// Element the remote (lead) audio is played into. Rendered hidden by the provider.
const REMOTE_AUDIO_ID = "enx-remote-audio";

export function SoftPhoneProvider({ children }) {
  const { org } = useAuth();
  const enabled = !!org?.enablex?.webrtc?.enabled && webrtcSupported();

  // status: idle | connecting | ringing | active | ending
  const [status, setStatus] = useState("idle");
  const [call,   setCall]   = useState(null);   // { leadId, isProjectLead, activityId, leadName, leadPhone }
  const [muted,  setMuted]  = useState(false);
  const [elapsed, setElapsed] = useState(0);     // seconds, once connected

  const roomRef        = useRef(null);
  const localStreamRef = useRef(null);
  const timerRef       = useRef(null);
  const connectedAtRef = useRef(0);
  const endedRef       = useRef(false);          // guards against double-end
  const callRef        = useRef(null);           // latest call snapshot for async handlers

  useEffect(() => { callRef.current = call; }, [call]);

  // ── Cleanup: tear down room, mic, timer. Safe to call multiple times. ─────────
  const teardown = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    try { roomRef.current?.disconnect?.(); } catch { /* noop */ }
    try {
      const s = localStreamRef.current;
      // Stop the mic track so the browser's "recording" indicator clears.
      s?.stop?.();
      s?.getAudioTracks?.().forEach((t) => t.stop?.());
    } catch { /* noop */ }
    roomRef.current = null;
    localStreamRef.current = null;
    connectedAtRef.current = 0;
  }, []);

  // ── Report the call outcome to the backend (duration + connected). ────────────
  const reportEnd = useCallback(async (durationSec, connected) => {
    const c = callRef.current;
    if (!c?.activityId) return;
    try {
      await api.post(`/calls/webrtc/${c.leadId}/${c.activityId}/end`, {
        duration: Math.max(0, Math.round(durationSec || 0)),
        connected: !!connected,
      });
    } catch { /* best-effort; a late/duplicate report is ignored server-side */ }
  }, []);

  // ── End the current call (user hang-up, remote hang-up, or error). ────────────
  const endCall = useCallback((reason) => {
    if (endedRef.current) return;
    endedRef.current = true;
    setStatus("ending");

    const connected = connectedAtRef.current > 0;
    const durationSec = connected ? (Date.now() - connectedAtRef.current) / 1000 : 0;

    teardown();
    reportEnd(durationSec, connected);

    // Brief "ending" flash, then back to idle.
    setTimeout(() => {
      setStatus("idle");
      setCall(null);
      setMuted(false);
      setElapsed(0);
    }, 800);

    if (reason === "remote") toast("Call ended");
  }, [teardown, reportEnd]);

  // ── Attach EnableX room event listeners. Defensive — event names/shapes vary
  // slightly across SDK builds, so every handler is guarded. ────────────────────
  const attachRoomListeners = useCallback((room) => {
    if (!room?.addEventListener) return;

    const on = (evt, fn) => { try { room.addEventListener(evt, fn); } catch { /* noop */ } };

    // Room is up → dial the lead into it.
    on("room-connected", () => {
      setStatus("ringing");
      const c = callRef.current;
      try {
        // Documented Video client API: dial a PSTN number into the session.
        if (typeof room.makeOutboundCall === "function" && c?.leadPhone) {
          room.makeOutboundCall(c.leadPhone);
        }
      } catch (e) {
        console.error("[softphone] makeOutboundCall failed", e);
        toast.error("Couldn't dial the lead. Ending call.");
        endCall("error");
      }
    });

    // Lead answered / media is flowing → mark active and start the timer.
    const markActive = () => {
      if (connectedAtRef.current) return;      // already active
      connectedAtRef.current = Date.now();
      setStatus("active");
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - connectedAtRef.current) / 1000));
      }, 1000);
    };
    on("active-talkers-updated", markActive);
    on("stream-subscribed", (e) => {
      // Play the lead's audio locally.
      try { (e?.stream || e?.streams?.[0])?.play?.(REMOTE_AUDIO_ID); } catch { /* noop */ }
      markActive();
    });

    // Any terminal event → clean up.
    on("room-disconnected", () => endCall("remote"));
    on("user-disconnected", () => endCall("remote"));
    on("stream-ended",      () => endCall("remote"));
    on("room-error",        (e) => { console.error("[softphone] room-error", e); endCall("error"); });
  }, [endCall]);

  // ── Start an in-app call. target = { leadId?|projectLeadId?, name, phone }. ────
  const startCall = useCallback(async (target) => {
    if (!enabled) {
      toast.error("In-app calling isn't enabled for your workspace.");
      return false;
    }
    if (status !== "idle") {
      toast.error("You're already on a call.");
      return false;
    }

    const leadId        = target?.leadId || null;
    const projectLeadId = target?.projectLeadId || null;
    if (!leadId && !projectLeadId) return false;

    endedRef.current = false;
    setStatus("connecting");
    setElapsed(0);
    setMuted(false);

    try {
      // Ask for the mic up front so permission denial fails fast with a clear msg,
      // before we spin up an EnableX room we'd have to tear right back down.
      try {
        const probe = await navigator.mediaDevices.getUserMedia({ audio: true });
        probe.getTracks().forEach((t) => t.stop());
      } catch {
        setStatus("idle");
        toast.error("Microphone access is blocked. Allow the mic to call from the browser.");
        return false;
      }

      const { data } = await api.post("/calls/webrtc/session", { leadId, projectLeadId });
      if (!data?.success || !data.token) {
        setStatus("idle");
        toast.error(data?.message || "Couldn't start the call session.");
        return false;
      }

      setCall({
        leadId:        data.leadId,
        isProjectLead: data.isProjectLead,
        activityId:    data.activityId,
        leadName:      data.leadName || target?.name || "Lead",
        leadPhone:     data.leadPhone,
      });

      const EnxRtc = await loadEnxRtc();

      const config = { audio: true, video: false, data: false };
      // Across SDK builds joinRoom is exposed either statically (EnxRtc.joinRoom)
      // or on an instance (new EnxRtc().joinRoom) — support both.
      const rtc = typeof EnxRtc.joinRoom === "function" ? EnxRtc : new EnxRtc();
      if (typeof rtc.joinRoom !== "function") {
        throw new Error("EnableX SDK loaded but joinRoom is unavailable.");
      }
      // joinRoom(token, config, callback) → returns the local stream; the room
      // object arrives via the callback.
      const localStream = rtc.joinRoom(data.token, config, (roomMeta, error) => {
        if (error) {
          console.error("[softphone] joinRoom error", error);
          toast.error("Couldn't connect the call.");
          endCall("error");
          return;
        }
        const room = roomMeta?.room || roomMeta;
        roomRef.current = room;
        attachRoomListeners(room);
      });
      localStreamRef.current = localStream;

      return true;
    } catch (err) {
      console.error("[softphone] startCall failed", err);
      setStatus("idle");
      setCall(null);
      // Prefer the backend's explanatory message over the raw "status code NNN".
      toast.error(err?.response?.data?.message || err?.message || "Call failed to start.");
      teardown();
      return false;
    }
  }, [enabled, status, attachRoomListeners, endCall, teardown]);

  // ── Mute / unmute the agent's mic. ────────────────────────────────────────────
  const toggleMute = useCallback(() => {
    const s = localStreamRef.current;
    if (!s) return;
    try {
      if (muted) { s.unmuteAudio?.(); setMuted(false); }
      else       { s.muteAudio?.();   setMuted(true);  }
    } catch { /* noop */ }
  }, [muted]);

  const hangUp = useCallback(() => endCall("local"), [endCall]);

  // Tear down if the provider unmounts mid-call (e.g. logout).
  useEffect(() => () => teardown(), [teardown]);

  return (
    <SoftPhoneContext.Provider
      value={{ enabled, status, call, muted, elapsed, startCall, hangUp, toggleMute }}
    >
      {children}
      {/* Hidden sink for the lead's audio. */}
      <div id={REMOTE_AUDIO_ID} style={{ display: "none" }} />
    </SoftPhoneContext.Provider>
  );
}
