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

  // Lead answered / media is flowing → mark active and start the timer.
  const markActive = useCallback(() => {
    if (connectedAtRef.current) return;        // already active
    connectedAtRef.current = Date.now();
    setStatus("active");
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - connectedAtRef.current) / 1000));
    }, 1000);
  }, []);

  // ── Attach EnableX room event listeners (real EnxRtc event names). ────────────
  const attachRoomListeners = useCallback((room) => {
    if (!room?.addEventListener) return;
    const on = (evt, fn) => { try { room.addEventListener(evt, fn); } catch { /* noop */ } };

    // A new stream (the dialed-in lead's audio) was added → subscribe to receive it.
    on("stream-added", (e) => {
      const stream = e?.stream || e?.data?.stream;
      try { if (stream) room.subscribe(stream); } catch (err) { console.error("[softphone] subscribe failed", err); }
    });

    // Subscription confirmed → play the lead's audio locally + mark connected.
    on("stream-subscribed", (e) => {
      const stream = e?.stream || e?.data?.stream;
      try { stream?.play?.(REMOTE_AUDIO_ID, { muted: false }); } catch { /* noop */ }
      markActive();
    });

    // Fallback signal that the lead is on the call.
    on("active-talkers-updated", (e) => {
      const list = e?.message?.activeList;
      if (Array.isArray(list) && list.length > 0) markActive();
      // Ensure any remote stream is playing (covers browsers that miss stream-subscribed).
      try {
        const streams = room.remoteStreams?.getAll?.() || {};
        Object.values(streams).forEach((st) => { try { st.play?.(REMOTE_AUDIO_ID, { muted: false }); } catch { /* noop */ } });
      } catch { /* noop */ }
    });

    // Outbound PSTN dial-out result events.
    on("outbound-call-state", (e) => console.info("[softphone] outbound-call-state", e?.message || e));
    on("outbound-call-success", () => console.info("[softphone] outbound-call placed"));
    on("outbound-call-failed", (e) => {
      console.error("[softphone] outbound-call-failed", e?.message || e);
      toast.error("The lead's number could not be reached.");
      endCall("error");
    });

    // Terminal events → clean up.
    on("room-disconnected", () => endCall("remote"));
    on("user-disconnected", () => endCall("remote"));
    on("stream-ended",      () => endCall("remote"));
    on("room-error",        (e) => { console.error("[softphone] room-error", e); endCall("error"); });
  }, [endCall, markActive]);

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

      const leadPhone = data.leadPhone;
      const callerId  = data.callerId || "";

      // joinRoom(token, config, callback) → returns the local (mic) stream. The
      // callback's `success` arg IS the room-connected signal — there is no
      // separate "room-connected" event.
      const localStream = rtc.joinRoom(data.token, config, (success, error) => {
        if (!success) {
          console.error("[softphone] joinRoom failed", error);
          toast.error("Couldn't connect the call.");
          endCall("error");
          return;
        }
        const room = success.room;
        roomRef.current = room;
        attachRoomListeners(room);

        // Subscribe to any streams already present (normally none for a fresh call).
        try { (success.streams || []).forEach((s) => room.subscribe(s)); } catch { /* noop */ }

        // Connected to the room → dial the lead's phone into it.
        setStatus("ringing");
        try {
          // makeOutboundCall(number, caller_id, options, callback). result===0 = initiated.
          room.makeOutboundCall(leadPhone, callerId, undefined, (resp) => {
            if (!resp || resp.result !== 0) {
              console.error("[softphone] makeOutboundCall rejected", resp);
              toast.error("Couldn't dial the lead's number (dial-out may not be enabled on EnableX).");
              endCall("error");
            }
          });
        } catch (e) {
          console.error("[softphone] makeOutboundCall threw", e);
          toast.error("Couldn't dial the lead. Ending call.");
          endCall("error");
        }
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
      {/* Off-screen sink for the lead's audio. Not display:none — some browsers
          won't autoplay media inside a display:none node. */}
      <div
        id={REMOTE_AUDIO_ID}
        style={{ position: "fixed", width: 1, height: 1, opacity: 0, overflow: "hidden", pointerEvents: "none", bottom: 0, left: 0 }}
      />
    </SoftPhoneContext.Provider>
  );
}
