// components/AttendanceCapture.jsx
// Selfie + GPS capture modal for attendance clock-in / clock-out.
// Renders via portal so it can be triggered from the Sidebar or the Attendance page.
import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { Camera, MapPin, RefreshCw, X, Check, Loader2, AlertTriangle } from "lucide-react";

export default function AttendanceCapture({ open, mode = "in", required = true, submitting = false, onClose, onConfirm }) {
  const videoRef  = useRef(null);
  const streamRef = useRef(null);

  const [phase, setPhase]         = useState("camera"); // "camera" | "preview"
  const [photo, setPhoto]         = useState(null);     // dataURL
  const [loc, setLoc]             = useState(null);     // { lat, lng, accuracy }
  const [locStatus, setLocStatus] = useState("idle");   // idle | fetching | ok | denied | error
  const [camStatus, setCamStatus] = useState("idle");   // idle | starting | ok | denied | error
  const [camError, setCamError]   = useState("");

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    setCamStatus("starting");
    setCamError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setCamStatus("ok");
    } catch (err) {
      const denied = err?.name === "NotAllowedError" || err?.name === "SecurityError";
      setCamStatus(denied ? "denied" : "error");
      setCamError(
        denied
          ? "Camera permission was denied. Enable it in your browser settings."
          : "No camera found or it could not be started."
      );
    }
  }, []);

  const fetchLocation = useCallback(() => {
    if (!navigator.geolocation) { setLocStatus("error"); return; }
    setLocStatus("fetching");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
        setLocStatus("ok");
      },
      (err) => setLocStatus(err.code === err.PERMISSION_DENIED ? "denied" : "error"),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
    );
  }, []);

  // Start camera + location when the modal opens; tear down on close
  useEffect(() => {
    if (!open) return;
    setPhase("camera");
    setPhoto(null);
    setLoc(null);
    setLocStatus("idle");
    startCamera();
    fetchLocation();
    return () => stopCamera();
  }, [open, startCamera, fetchLocation, stopCamera]);

  const capture = () => {
    const video = videoRef.current;
    if (!video || camStatus !== "ok") return;
    const size = Math.min(video.videoWidth, video.videoHeight) || 600;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    // Center-crop to a square, mirror horizontally so it looks like a normal selfie
    const sx = (video.videoWidth - size) / 2;
    const sy = (video.videoHeight - size) / 2;
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, sx, sy, size, size, 0, 0, canvas.width, canvas.height);
    setPhoto(canvas.toDataURL("image/jpeg", 0.8));
    setPhase("preview");
  };

  const retake = () => { setPhoto(null); setPhase("camera"); };

  const handleConfirm = () => {
    onConfirm({
      selfie: photo,
      lat: loc?.lat ?? null,
      lng: loc?.lng ?? null,
      accuracy: loc?.accuracy ?? null,
    });
  };

  if (!open) return null;

  const hasPhoto = !!photo;
  const hasLoc   = locStatus === "ok";
  const canConfirm = required ? (hasPhoto && hasLoc) : true;
  const title = mode === "in" ? "Clock In" : "Clock Out";

  const locPill = {
    idle:     { text: "Locating…",            cls: "text-app-soft" },
    fetching: { text: "Getting location…",    cls: "text-app-soft" },
    ok:       { text: loc ? `±${Math.round(loc.accuracy)}m accuracy` : "Located", cls: "text-green-600" },
    denied:   { text: "Location denied",       cls: "text-red-500" },
    error:    { text: "Location unavailable",  cls: "text-red-500" },
  }[locStatus];

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={(e) => { if (e.target === e.currentTarget && !submitting) onClose(); }}>
      <div className="w-full max-w-sm rounded-3xl p-5 shadow-2xl"
        style={{ background: "var(--app-surface-high)", border: "1px solid var(--app-border)", backdropFilter: "blur(24px)" }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-app flex items-center gap-2">
            <Camera className="w-4 h-4 text-orange-500" /> {title}
          </h2>
          <button onClick={() => !submitting && onClose()}
            className="p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-app-soft cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Camera / preview frame */}
        <div className="relative w-full aspect-square rounded-2xl overflow-hidden mb-3"
          style={{ background: "#000", border: "1px solid var(--app-border)" }}>
          {/* Live video (hidden while previewing) */}
          <video
            ref={videoRef}
            playsInline muted
            className="absolute inset-0 w-full h-full object-cover"
            style={{ transform: "scaleX(-1)", display: phase === "camera" && camStatus === "ok" ? "block" : "none" }}
          />
          {/* Captured preview */}
          {phase === "preview" && photo && (
            <img src={photo} alt="Selfie preview" className="absolute inset-0 w-full h-full object-cover" />
          )}
          {/* Camera status overlays */}
          {phase === "camera" && camStatus !== "ok" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-6">
              {camStatus === "starting" && <><Loader2 className="w-6 h-6 text-white/70 animate-spin" /><p className="text-xs text-white/70">Starting camera…</p></>}
              {(camStatus === "denied" || camStatus === "error") && (
                <>
                  <AlertTriangle className="w-7 h-7 text-amber-400" />
                  <p className="text-xs text-white/80">{camError}</p>
                  <button onClick={startCamera} className="mt-1 text-xs font-semibold text-orange-400 hover:underline">Retry camera</button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Location status */}
        <div className="flex items-center gap-2 mb-4 px-1">
          <MapPin className={`w-4 h-4 shrink-0 ${locPill.cls}`} />
          <span className={`text-xs font-medium ${locPill.cls}`}>{locPill.text}</span>
          {(locStatus === "denied" || locStatus === "error") && (
            <button onClick={fetchLocation} className="ml-auto text-xs font-semibold text-orange-500 hover:underline">Retry</button>
          )}
        </div>

        {/* Required-but-missing hint */}
        {required && !canConfirm && (camStatus === "denied" || locStatus === "denied") && (
          <p className="text-[11px] text-red-500 mb-3 px-1">
            Your organisation requires a selfie and location to record attendance. Please allow access.
          </p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          {phase === "camera" ? (
            <button
              onClick={capture}
              disabled={camStatus !== "ok"}
              className="btn-primary flex-1 justify-center disabled:opacity-50">
              <Camera className="w-4 h-4" /> Capture
            </button>
          ) : (
            <button onClick={retake} disabled={submitting}
              className="btn-secondary flex-1 justify-center">
              <RefreshCw className="w-4 h-4" /> Retake
            </button>
          )}
          <button
            onClick={handleConfirm}
            disabled={!canConfirm || submitting}
            className="btn-primary flex-1 justify-center disabled:opacity-50">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {title}
          </button>
        </div>

        {/* Optional skip when org doesn't require capture */}
        {!required && (
          <button onClick={handleConfirm} disabled={submitting}
            className="w-full text-center text-xs text-app-soft hover:text-app mt-3">
            Skip selfie &amp; location
          </button>
        )}
      </div>
    </div>,
    document.body
  );
}
