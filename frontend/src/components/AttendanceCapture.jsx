import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { Camera, MapPin, X, RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";
import { Spinner } from "./UI";

export default function AttendanceCapture({ open, mode, required, submitting, onClose, onConfirm }) {
  const videoRef   = useRef(null);
  const canvasRef  = useRef(null);
  const streamRef  = useRef(null);

  const [camError,   setCamError]   = useState("");
  const [locError,   setLocError]   = useState("");
  const [captured,   setCaptured]   = useState(null);  // base64 jpeg
  const [lat,        setLat]        = useState(null);
  const [lng,        setLng]        = useState(null);
  const [accuracy,   setAccuracy]   = useState(null);
  const [locLoading, setLocLoading] = useState(false);
  const [camReady,   setCamReady]   = useState(false);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    stopStream();
    setCamError("");
    setCamReady(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 640 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play().catch(() => {});
          setCamReady(true);
        };
      }
    } catch (err) {
      const msg = err.name === "NotAllowedError"
        ? "Camera permission was denied. Enable it in your browser settings."
        : err.name === "NotFoundError"
        ? "No camera found on this device."
        : "Camera could not be started. Please try again.";
      setCamError(msg);
    }
  }, [stopStream]);

  const fetchLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocError("Geolocation is not supported by your browser.");
      return;
    }
    setLocError("");
    setLocLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        setAccuracy(Math.round(pos.coords.accuracy));
        setLocLoading(false);
      },
      (err) => {
        const msg = err.code === 1
          ? "Location denied"
          : err.code === 2
          ? "Location unavailable"
          : "Location timed out";
        setLocError(msg);
        setLocLoading(false);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  }, []);

  useEffect(() => {
    if (!open) { stopStream(); setCaptured(null); setLat(null); setLng(null); setAccuracy(null); setCamError(""); setLocError(""); return; }
    startCamera();
    fetchLocation();
    return () => stopStream();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const takePhoto = () => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const size = Math.min(video.videoWidth, video.videoHeight, 640);
    canvas.width  = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    // Mirror horizontally (selfie mode)
    ctx.translate(size, 0);
    ctx.scale(-1, 1);
    const ox = (video.videoWidth  - size) / 2;
    const oy = (video.videoHeight - size) / 2;
    ctx.drawImage(video, ox, oy, size, size, 0, 0, size, size);
    setCaptured(canvas.toDataURL("image/jpeg", 0.82));
    stopStream();
  };

  const retake = () => {
    setCaptured(null);
    startCamera();
  };

  const canConfirm = !submitting && (captured || camError) && (lat !== null || locError);

  const handleConfirm = () => {
    if (!canConfirm) return;
    onConfirm({ selfie: captured || null, lat, lng, accuracy });
  };

  const handleSkip = () => {
    onConfirm({ selfie: null, lat: null, lng: null, accuracy: null });
  };

  if (!open) return null;

  const title = mode === "clockin" ? "Clock In" : "Clock Out";

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.65)" }}
      onClick={(e) => { if (e.target === e.currentTarget && !submitting) onClose(); }}>
      <div className="w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden"
        style={{ background: "var(--app-surface)", border: "1px solid var(--app-border)" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h2 className="text-base font-bold text-app flex items-center gap-2">
            <Camera className="w-4 h-4 text-orange-500" />
            {title}
          </h2>
          {!submitting && (
            <button onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-app-soft cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Camera area */}
        <div className="px-5">
          <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-black">
            {captured ? (
              <img src={captured} alt="selfie" className="w-full h-full object-cover" />
            ) : (
              <>
                <video ref={videoRef} className="w-full h-full object-cover" style={{ transform: "scaleX(-1)" }}
                  playsInline muted autoPlay />
                {!camReady && !camError && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Spinner size="lg" />
                  </div>
                )}
              </>
            )}
            <canvas ref={canvasRef} className="hidden" />

            {camError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 bg-black/80">
                <AlertTriangle className="w-8 h-8 text-amber-400" />
                <p className="text-white text-xs text-center leading-relaxed">{camError}</p>
                <button onClick={startCamera}
                  className="flex items-center gap-1.5 text-xs font-semibold text-orange-400 hover:text-orange-300 transition cursor-pointer">
                  <RefreshCw className="w-3.5 h-3.5" /> Retry camera
                </button>
              </div>
            )}
          </div>

          {/* Camera action */}
          <div className="flex justify-center mt-3">
            {captured ? (
              <button onClick={retake}
                className="flex items-center gap-1.5 text-xs font-semibold text-app-soft hover:text-orange-500 transition cursor-pointer">
                <RefreshCw className="w-3.5 h-3.5" /> Retake
              </button>
            ) : (
              <button onClick={takePhoto} disabled={!camReady || !!camError}
                className="flex items-center gap-2 px-5 py-2 rounded-2xl text-sm font-semibold text-white transition disabled:opacity-40 cursor-pointer"
                style={{ background: !camReady || camError ? "var(--app-surface-low)" : "var(--app-primary)" }}>
                <Camera className="w-4 h-4" /> Capture
              </button>
            )}
          </div>
        </div>

        {/* Location row */}
        <div className="px-5 mt-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className={`w-4 h-4 flex-shrink-0 ${lat !== null ? "text-green-500" : locError ? "text-red-400" : "text-app-soft"}`} />
            {locLoading ? (
              <span className="text-xs text-app-soft flex items-center gap-1.5"><Spinner size="sm" /> Getting location…</span>
            ) : lat !== null ? (
              <span className="text-xs text-green-500 font-semibold">
                {lat.toFixed(4)}, {lng.toFixed(4)} {accuracy ? `(±${accuracy}m)` : ""}
              </span>
            ) : (
              <span className="text-xs text-red-400">{locError || "Fetching location…"}</span>
            )}
          </div>
          {(locError || lat === null) && !locLoading && (
            <button onClick={fetchLocation}
              className="text-xs font-semibold text-orange-400 hover:text-orange-300 transition cursor-pointer">
              Retry
            </button>
          )}
          {lat !== null && (
            <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
          )}
        </div>

        {/* Warning when required and not ready */}
        {required && (!captured || lat === null) && (
          <div className="mx-5 mt-3 flex items-start gap-2 rounded-xl px-3 py-2 text-xs text-red-400"
            style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            Your organisation requires a selfie and location to record attendance. Please allow access.
          </div>
        )}

        {/* Footer */}
        <div className="px-5 pb-5 pt-4 flex items-center justify-between gap-3">
          {!required && (
            <button onClick={handleSkip} disabled={submitting}
              className="text-xs text-app-soft hover:text-app transition cursor-pointer disabled:opacity-40">
              Skip
            </button>
          )}
          <div className={`flex items-center gap-2 ${!required ? "" : "w-full"}`}>
            {required && (
              <button onClick={onClose} disabled={submitting}
                className="btn-secondary text-xs py-2 px-4 cursor-pointer">
                Cancel
              </button>
            )}
            <button onClick={handleConfirm}
              disabled={required ? !canConfirm : submitting}
              className="btn-primary text-xs py-2 px-5 flex items-center gap-2 flex-1 justify-center cursor-pointer">
              {submitting ? <><Spinner size="sm" /> {title}…</> : <><CheckCircle2 className="w-3.5 h-3.5" /> {title}</>}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
