// ── EnableX Web SDK loader ────────────────────────────────────────────────────
// EnableX ships its browser SDK (EnxRtc.js) as a file you download from your
// dashboard — there is no clean web npm package. Drop that file at
//   frontend/public/vendor/EnxRtc.js
// and it is served at /vendor/EnxRtc.js. This loader injects it once, on demand
// (only when an agent actually starts an in-app call), so it never affects initial
// page load. It resolves with the global `EnxRtc` object the SDK defines.
//
// The load is lazy + cached: repeated calls return the same promise, and the
// <script> tag is only ever added once.

let _promise = null;

const SDK_URL = "/vendor/EnxRtc.js";

export function loadEnxRtc() {
  // Already available (SDK loaded, or a previous call resolved it).
  if (typeof window !== "undefined" && window.EnxRtc) {
    return Promise.resolve(window.EnxRtc);
  }
  if (_promise) return _promise;

  _promise = new Promise((resolve, reject) => {
    // Reuse an existing tag if one is already on the page.
    const existing = document.querySelector(`script[data-enx-sdk="1"]`);
    if (existing) {
      existing.addEventListener("load", () => finish(resolve, reject));
      existing.addEventListener("error", () => fail(reject));
      // If it already loaded before we attached listeners:
      if (window.EnxRtc) finish(resolve, reject);
      return;
    }

    const s = document.createElement("script");
    s.src = SDK_URL;
    s.async = true;
    s.dataset.enxSdk = "1";
    s.addEventListener("load", () => finish(resolve, reject));
    s.addEventListener("error", () => fail(reject));
    document.head.appendChild(s);
  });

  // Let a failed load be retried on the next call rather than caching the rejection.
  _promise.catch(() => { _promise = null; });
  return _promise;
}

function finish(resolve, reject) {
  if (window.EnxRtc) resolve(window.EnxRtc);
  else reject(new Error("EnxRtc.js loaded but window.EnxRtc is undefined"));
}

function fail(reject) {
  reject(new Error(
    "Could not load the EnableX calling SDK. The file /vendor/EnxRtc.js is missing — " +
    "download it from your EnableX dashboard and add it to frontend/public/vendor/."
  ));
}

// True when the browser can actually do WebRTC + mic capture. Used to hide the
// in-app call option on unsupported environments (old browsers, insecure origins).
export function webrtcSupported() {
  return !!(
    typeof navigator !== "undefined" &&
    navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === "function" &&
    (window.RTCPeerConnection || window.webkitRTCPeerConnection)
  );
}
