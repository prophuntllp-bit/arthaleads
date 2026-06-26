import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import QRCode from "qrcode";
import { X, Download, Printer, RefreshCw, Copy, Check, Loader2 } from "lucide-react";
import api from "../services/api";
import toast from "react-hot-toast";

const FORM_BASE = window.location.origin;

export default function QrModal({ type, id, name, onClose }) {
  const canvasRef  = useRef(null);
  const [token, setToken]       = useState("");
  const [loading, setLoading]   = useState(true);
  const [regen, setRegen]       = useState(false);
  const [copied, setCopied]     = useState(false);

  const formUrl = token ? `${FORM_BASE}/form/${token}` : "";

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  // Fetch existing token (or generate on first open)
  const fetchOrCreate = async (force = false) => {
    try {
      if (force) setRegen(true); else setLoading(true);
      const endpoint = type === "org" ? "/org/me/qr-token" : `/projects/${id}/qr-token`;

      if (force) {
        const { data } = await api.post(endpoint);
        setToken(data.qrToken);
      } else {
        const { data } = await api.get(endpoint);
        if (data.qrToken) {
          setToken(data.qrToken);
        } else {
          // Auto-generate on first use
          const { data: d2 } = await api.post(endpoint);
          setToken(d2.qrToken);
        }
      }
    } catch (err) {
      toast.error("Failed to load QR code");
    } finally {
      setLoading(false);
      setRegen(false);
    }
  };

  useEffect(() => { fetchOrCreate(); }, [type, id]);

  // Draw QR on canvas whenever token changes
  useEffect(() => {
    if (!token || !canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, formUrl, {
      width: 280,
      margin: 2,
      color: { dark: "#111827", light: "#ffffff" },
    }).catch(() => {});
  }, [token, formUrl]);

  const handleDownload = () => {
    if (!canvasRef.current || !token) return;
    const url = canvasRef.current.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `qr-${name || type}.png`;
    a.click();
  };

  const handlePrint = () => {
    if (!canvasRef.current || !token) return;
    const dataUrl = canvasRef.current.toDataURL("image/png");
    const win = window.open("", "_blank");
    win.document.write(`
      <html><head><title>QR Code – ${name || ""}</title>
      <style>
        body { margin: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; font-family: sans-serif; }
        img { width: 280px; height: 280px; }
        h2 { margin: 12px 0 4px; font-size: 18px; }
        p  { margin: 0; font-size: 13px; color: #6b7280; }
      </style></head>
      <body>
        <img src="${dataUrl}" />
        <h2>${name || "Scan to Enquire"}</h2>
        <p>Scan this QR code to submit your enquiry</p>
        <script>window.onload=()=>{ window.print(); window.close(); }<\/script>
      </body></html>
    `);
    win.document.close();
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(formUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleRegen = () => {
    if (window.confirm("Generate a new QR code? The old one will stop working.")) {
      fetchOrCreate(true);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="relative w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden"
        style={{ background: "var(--app-surface)", border: "1px solid var(--app-border)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <div>
            <h2 className="font-black text-app text-lg">QR Code</h2>
            <p className="text-xs text-app-soft mt-0.5 truncate max-w-[220px]">{name}</p>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 hover:bg-orange-500/10 transition">
            <X className="h-4 w-4 text-app-soft" />
          </button>
        </div>

        {/* QR area */}
        <div className="flex justify-center px-6 pb-2">
          <div className="rounded-2xl overflow-hidden p-3" style={{ background: "#fff", boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }}>
            {loading || regen ? (
              <div className="w-[280px] h-[280px] flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
              </div>
            ) : (
              <canvas ref={canvasRef} />
            )}
          </div>
        </div>

        {/* URL copy row */}
        {formUrl && !loading && (
          <div className="mx-6 mb-4 flex items-center gap-2 rounded-xl px-3 py-2"
            style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)" }}>
            <p className="flex-1 text-xs text-app-soft truncate">{formUrl}</p>
            <button onClick={handleCopy} className="flex-shrink-0 transition hover:opacity-70">
              {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5 text-app-soft" />}
            </button>
          </div>
        )}

        {/* Action buttons */}
        <div className="grid grid-cols-3 gap-2 px-6 pb-5">
          <button
            onClick={handleDownload}
            disabled={loading || !token}
            className="flex flex-col items-center gap-1.5 rounded-2xl py-3 text-xs font-semibold transition hover:opacity-80"
            style={{ background: "rgba(255,107,0,0.1)", color: "#FF6B00" }}
          >
            <Download className="h-4 w-4" />
            Download
          </button>
          <button
            onClick={handlePrint}
            disabled={loading || !token}
            className="flex flex-col items-center gap-1.5 rounded-2xl py-3 text-xs font-semibold transition hover:opacity-80"
            style={{ background: "var(--app-surface-low)", color: "var(--app-text-soft)" }}
          >
            <Printer className="h-4 w-4" />
            Print
          </button>
          <button
            onClick={handleRegen}
            disabled={regen}
            className="flex flex-col items-center gap-1.5 rounded-2xl py-3 text-xs font-semibold transition hover:opacity-80"
            style={{ background: "var(--app-surface-low)", color: "var(--app-text-soft)" }}
          >
            <RefreshCw className={`h-4 w-4 ${regen ? "animate-spin" : ""}`} />
            Regenerate
          </button>
        </div>

        <p className="text-center text-xs text-app-soft pb-5 px-6">
          Share this QR with sales staff. Leads who scan it fill the form directly into the CRM.
        </p>
      </div>
    </div>,
    document.body
  );
}
