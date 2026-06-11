import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { Camera, MapPin, X, RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";
import { Spinner } from "./UI";

function isAndroid() { return /Android/i.test(navigator.userAgent || ""); }
function isIOS()     { return /iPhone|iPad|iPod/i.test(navigator.userAgent || ""); }

function getCamPermissionHint() {
  if (isIOS())     return "Go to iPhone Settings → Safari → Camera → Allow.";
  if (isAndroid()) return "Tap the lock icon in Chrome's address bar → Permissions → Camera → Allow.";
  return "Click the camera icon in your browser's address bar to allow access.";
}
function getLocPermissionHint() {
  if (isIOS())     return "Go to iPhone Settings → Privacy → Location Services → Safari → While Using App.";
  if (isAndroid()) return "First enable Location in Android Settings → Location (device toggle). Then tap the lock icon in Chrome's address bar → Permissions → Location → Allow.";
  return "Click the lock icon in your browser's address bar → Permissions → Location → Allow.";
}
function getLocUnavailableMsg() {
  if (isAndroid()) return "Location is off. Enable it in Android Settings → Location, then tap Retry.";
  return "Location unavailable. Check that Location is enabled in your device settings, then retry.";
}

export default function AttendanceCapture({ open, mode, required, submitting, onClose, onConfirm }) {
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const [camError,   setCamError]   = useState("");
  const [camBlocked, setCamBlocked] = useState(false); // NotAllowedError — cannot retry, must go to settings
  const [locError,   setLocError]   = useState("");
  const [locBlocked, setLocBlocked] = useState(false);
  const [captured,   setCaptured]   = useState(null);
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
    setCamBlocked(false);
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
      if (err.name === "NotAllowedError") {
        setCamBlocked(true);
        setCamError(getCamPermissionHint());
      } else if (err.name === "NotFoundError") {
        setCamError("No camera found on this device. You can still clock in with location only.");
      } else {
        setCamError("Camera could not be started. Please try again.");
      }
    }
  }, [stopStream]);

  const fetchLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocError("Geolocation is not supported by your browser.");
      setLocBlocked(true);
      return;
    }
    setLocError("");
    setLocBlocked(false);
    setLocLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        setAccuracy(Math.round(pos.coords.accuracy));
        setLocLoading(false);
      },
      (err) => {
        if (err.code === 1) {
          setLocBlocked(true);
          setLocError(getLocPermissionHint());
        } else if (err.code === 2) {
          setLocError(getLocUnavailableMsg());
        } else {
          setLocError("Location timed out. Make sure Location is enabled in your device settings, then retry.");
        }
        setLocLoading(false);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  }, []);

  useEffect(() => {
    if (!open) {
      stopStream();
      setCaptured(null); setLat(null); setLng(null); setAccuracy(null);
      setCamError(""); setCamBlocked(false); setLocError(""); setLocBlocked(false);
      return;
    }
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
  const bothDenied = camBlocked && locBlocked;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end md:items-center justify-center md:p-4 p-0"
      style={{ background: "rgba(0,0,0,0.75)" }}
      onClick={(e) => { if (e.target === e.currentTarget && !submitting) onClose(); }}>
      <div className="w-full md:max-w-sm md:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-y-auto"
        style={{ background: "var(--app-surface)", border: "1px solid var(--app-border)" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 flex-shrink-0">
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
        <div className="px-4">
          <div className="relative w-full rounded-2xl overflow-hidden bg-black" style={{ aspectRatio: "1/1", maxHeight: "56vmin" }}>
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
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-5"
                style={{ background: "rgba(0,0,0,0.88)" }}>
                <AlertTriangle className="w-8 h-8 text-amber-400 flex-shrink-0" />
                <p className="text-white text-xs text-center leading-relaxed">{camError}</p>
                {!camBlocked && (
                  <button onClick={startCamera}
                    className="flex items-center gap-1.5 text-xs font-semibold text-orange-400 hover:text-orange-300 transition cursor-pointer">
                    <RefreshCw className="w-3.5 h-3.5" /> Retry camera
                  </button>
                )}
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
                style={{ background: !camReady || camError ? "var(--app-surface-high)" : "var(--app-primary)" }}>
                <Camera className="w-4 h-4" style={{ color: !camReady || camError ? "var(--app-text-soft)" : "white" }} />
                <span style={{ color: !camReady || camError ? "var(--app-text-soft)" : "white" }}>Capture</span>
              </button>
            )}
          </div>
        </div>

        {/* Location row */}
        <div className="px-4 mt-3">
          <div className="flex items-start justify-between gap-2 rounded-xl px-3 py-2.5"
            style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)" }}>
            <div className="flex items-start gap-2 min-w-0 flex-1">
              <MapPin className={`w-4 h-4 flex-shrink-0 mt-0.5 ${lat !== null ? "text-green-500" : locError ? "text-red-400" : "text-app-soft"}`} />
              {locLoading ? (
                <span className="text-xs text-app-soft flex items-center gap-1.5"><Spinner size="sm" /> Getting location…</span>
              ) : lat !== null ? (
                <span className="text-xs font-semibold" style={{ color: "#16a34a" }}>
                  {lat.toFixed(4)}, {lng.toFixed(4)}{accuracy ? ` ±${accuracy}m` : ""}
                </span>
              ) : (
                <span className="text-xs leading-snug" style={{ color: "var(--app-text)" }}>
                  <span className="font-semibold text-red-500">{locBlocked ? "Location blocked. " : "Location error. "}</span>
                  {locError}
                </span>
              )}
            </div>
            <div className="flex-shrink-0">
              {lat !== null ? (
                <CheckCircle2 className="w-4 h-4 text-green-500" />
              ) : !locLoading && (
                <button onClick={fetchLocation}
                  className="text-xs font-semibold text-orange-500 hover:text-orange-400 transition cursor-pointer whitespace-nowrap">
                  Retry
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Warning when both permissions denied — solid, readable background */}
        {bothDenied && (
          <div className="mx-4 mt-3 rounded-xl px-3 py-2.5"
            style={{ background: "#FEF3C7", border: "1px solid #FCD34D" }}>
            <p className="text-xs font-semibold text-amber-800 flex items-center gap-1.5 mb-1">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" /> Permissions required
            </p>
            <p className="text-[11px] text-amber-700 leading-snug">
              {isAndroid()
                ? "1. Enable Location in Android Settings → Location. 2. Tap the lock icon in Chrome's address bar → allow Camera and Location. Then tap Retry."
                : "Enable Camera and Location in your browser or device settings, then tap Retry camera and Retry above."}
            </p>
            <p className="text-[11px] text-amber-700 leading-snug mt-1 font-medium">
              You can still clock in — your admin will see that selfie &amp; location were unavailable.
            </p>
          </div>
        )}

        {/* Warning when only one is missing (and required) */}
        {required && !bothDenied && (!captured || lat === null) && (
          <div className="mx-4 mt-3 rounded-xl px-3 py-2.5"
            style={{ background: "#FFF7ED", border: "1px solid #FDBA74" }}>
            <p className="text-[11px] text-orange-700 leading-snug flex items-start gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-orange-500" />
              Your organisation requires a selfie and location for attendance.
              {!captured && !camBlocked && " Take a photo first."}
              {lat === null && !locBlocked && !locLoading && " Allow location access."}
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="px-4 pb-4 pt-3 flex items-center gap-3 flex-shrink-0">
          {!required ? (
            <>
              <button onClick={handleSkip} disabled={submitting}
                className="btn-secondary text-xs py-2 px-4 cursor-pointer disabled:opacity-40 flex-shrink-0">
                Skip
              </button>
              <button onClick={handleConfirm} disabled={!canConfirm}
                className="btn-primary text-xs py-2 px-5 flex items-center gap-2 flex-1 justify-center cursor-pointer">
                {submitting ? <><Spinner size="sm" /> {title}…</> : <><CheckCircle2 className="w-3.5 h-3.5" /> {title}</>}
              </button>
            </>
          ) : (
            <>
              <button onClick={onClose} disabled={submitting}
                className="btn-secondary text-xs py-2 px-4 cursor-pointer disabled:opacity-40 flex-shrink-0">
                Cancel
              </button>
              <button onClick={handleConfirm} disabled={!canConfirm}
                className="btn-primary text-xs py-2 px-5 flex items-center gap-2 flex-1 justify-center cursor-pointer">
                {submitting ? <><Spinner size="sm" /> {title}…</> : <><CheckCircle2 className="w-3.5 h-3.5" /> {title}</>}
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
