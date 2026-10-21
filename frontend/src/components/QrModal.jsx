import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import QRCode from "qrcode";
import { X, Download, RefreshCw, Copy, Check, Loader2, Printer } from "lucide-react";
import api from "../services/api";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";

/**
 * The one address a QR points at (21 Oct 2026). It used to be whatever site
 * the admin happened to be on (window.location.origin), so a QR made on an old
 * or preview address pointed there forever. Printed QRs must outlive hosts:
 * live QRs go to www.arthaleads.com, staging QRs to staging.arthaleads.com
 * (the /form route is served on every host), and local runs stay local.
 * The phone app builds the same address (mobile/lib/widgets/qr_sheet.dart).
 */
export function publicFormBase(host = window.location.hostname) {
  if (host === "localhost" || host === "127.0.0.1") return window.location.origin;
  if (host.includes("staging")) return "https://staging.arthaleads.com";
  return "https://www.arthaleads.com";
}

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export default function QrModal({ type, id, name, onClose }) {
  const { org } = useAuth();
  const canvasRef  = useRef(null);
  const [token, setToken]       = useState("");
  const [loading, setLoading]   = useState(true);
  const [regen, setRegen]       = useState(false);
  const [copied, setCopied]     = useState(false);
  const [problem, setProblem]   = useState("");

  const formUrl = token ? `${publicFormBase()}/form/${token}` : "";

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

  // Fetch the existing token, or make one the first time. Making one (and a
  // new one) is for admins on the company QR, admins and managers on a project
  // QR; anyone else is told who can, instead of a bare "Failed".
  const fetchOrCreate = async (force = false) => {
    const endpoint = type === "org" ? "/org/me/qr-token" : `/projects/${id}/qr-token`;
    const who = type === "org" ? "an admin" : "an admin or manager";
    try {
      setProblem("");
      if (force) setRegen(true); else setLoading(true);
      if (force) {
        const { data } = await api.post(endpoint);
        setToken(data.qrToken);
        toast.success("New QR code made. Old printed copies no longer work.");
        return;
      }
      const { data } = await api.get(endpoint);
      if (data.qrToken) {
        setToken(data.qrToken);
      } else {
        try {
          const { data: d2 } = await api.post(endpoint);
          setToken(d2.qrToken);
        } catch (err) {
          if (err.response?.status === 403) setProblem(`No QR code yet. Ask ${who} to open this once to create it.`);
          else throw err;
        }
      }
    } catch (err) {
      if (err.response?.status === 403) {
        if (force) toast.error(`Only ${who} can make a new QR code.`);
        else setProblem(`Only ${who} can see this QR code.`);
      } else {
        toast.error("Couldn't load the QR code. Check your connection and try again.");
      }
    } finally {
      setLoading(false);
      setRegen(false);
    }
  };

  useEffect(() => { fetchOrCreate(); }, [type, id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Draw QR on canvas whenever token changes
  useEffect(() => {
    if (!token || !canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, formUrl, {
      width: 280,
      margin: 2,
      color: { dark: "#111827", light: "#ffffff" },
    }).catch(() => {});
  }, [token, formUrl, loading, regen]);

  const handleDownload = () => {
    if (!canvasRef.current || !token) return;
    const url = canvasRef.current.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `qr-${name || type}.png`;
    a.click();
  };

  // An A4 poster for the site office or a hoarding: logo, the project (or
  // company) name, a big QR, the link written out for anyone whose camera
  // will not scan, and what to do. "Save as PDF" in the print dialog gives a
  // file for a print shop.
  const handlePoster = async () => {
    if (!token) return;
    const qr = await QRCode.toDataURL(formUrl, { width: 1000, margin: 1, color: { dark: "#111827", light: "#ffffff" } });
    const orgName = org?.name || "";
    const title = type === "project" && name ? name : (orgName || name || "Enquire now");
    const subtitle = type === "project" && orgName ? orgName : "";
    const logo = org?.logo && /^(data:image|https:)/.test(org.logo) ? `<img class="logo" src="${esc(org.logo)}" alt="" />` : "";
    const win = window.open("", "_blank");
    if (!win) { toast.error("Allow pop-ups for this site to print the poster."); return; }
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)} - enquiry poster</title>
      <style>
        @page { size: A4; margin: 0; }
        * { box-sizing: border-box; }
        body { margin: 0; font-family: Inter, Arial, sans-serif; color: #111827; }
        .page { width: 210mm; height: 297mm; padding: 22mm 18mm 16mm; display: flex; flex-direction: column; align-items: center; text-align: center; border-top: 10mm solid #FF6B00; }
        .logo { max-height: 22mm; max-width: 90mm; object-fit: contain; margin-bottom: 8mm; }
        .kicker { font-size: 13pt; font-weight: 700; letter-spacing: 3px; text-transform: uppercase; color: #FF6B00; margin: 0 0 3mm; }
        h1 { font-size: 34pt; line-height: 1.1; margin: 0 0 2mm; }
        .sub { font-size: 15pt; color: #4b5563; margin: 0 0 9mm; }
        .qr { width: 120mm; height: 120mm; padding: 4mm; border: 1.2mm solid #111827; border-radius: 6mm; }
        .cta { font-size: 22pt; font-weight: 800; margin: 9mm 0 2mm; }
        .how { font-size: 13pt; color: #4b5563; margin: 0; }
        .url { margin-top: 7mm; font-size: 11pt; color: #374151; word-break: break-all; }
        .foot { margin-top: auto; font-size: 9pt; color: #9ca3af; }
      </style></head><body><div class="page">
        ${logo}
        <p class="kicker">Scan to enquire</p>
        <h1>${esc(title)}</h1>
        ${subtitle ? `<p class="sub">${esc(subtitle)}</p>` : `<p class="sub">&nbsp;</p>`}
        <img class="qr" src="${qr}" alt="QR code" />
        <p class="cta">Point your phone camera here</p>
        <p class="how">Share your name and number in 30 seconds. Our team will call you back.</p>
        <p class="url">Or open ${esc(formUrl)}</p>
        <p class="foot">Powered by ArthaLeads</p>
      </div>
      <script>window.onload = () => { window.onafterprint = () => window.close(); setTimeout(() => window.print(), 300); };<\/script>
      </body></html>`);
    win.document.close();
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(formUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleRegen = () => {
    if (window.confirm("Make a new QR code? Every printed copy of the old one will stop working.")) {
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
          <button onClick={onClose} className="rounded-xl p-2 hover:bg-orange-500/10 transition" aria-label="Close">
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
            ) : problem ? (
              <div className="w-[280px] h-[280px] flex items-center justify-center p-6 text-center text-sm" style={{ color: "#4b5563" }}>
                {problem}
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
            <button onClick={handleCopy} className="flex-shrink-0 transition hover:opacity-70" aria-label="Copy link">
              {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5 text-app-soft" />}
            </button>
          </div>
        )}

        {/* Action buttons */}
        <div className="grid grid-cols-3 gap-2 px-6 pb-5">
          <button
            onClick={handlePoster}
            disabled={loading || !token}
            className="flex flex-col items-center gap-1.5 rounded-2xl py-3 text-xs font-semibold transition hover:opacity-80 disabled:opacity-40"
            style={{ background: "#FF6B00", color: "#fff" }}
          >
            <Printer className="h-4 w-4" />
            Print poster
          </button>
          <button
            onClick={handleDownload}
            disabled={loading || !token}
            className="flex flex-col items-center gap-1.5 rounded-2xl py-3 text-xs font-semibold transition hover:opacity-80 disabled:opacity-40"
            style={{ background: "rgba(255,107,0,0.1)", color: "#FF6B00" }}
          >
            <Download className="h-4 w-4" />
            QR image
          </button>
          <button
            onClick={handleRegen}
            disabled={regen || !token}
            className="flex flex-col items-center gap-1.5 rounded-2xl py-3 text-xs font-semibold transition hover:opacity-80 disabled:opacity-40"
            style={{ background: "var(--app-surface-low)", color: "var(--app-text-soft)" }}
          >
            <RefreshCw className={`h-4 w-4 ${regen ? "animate-spin" : ""}`} />
            New code
          </button>
        </div>

        <p className="text-center text-xs text-app-soft pb-5 px-6">
          Put this on posters, standees and brochures. Everyone who scans it lands in your Leads as a QR Code lead.
        </p>
      </div>
    </div>,
    document.body
  );
}
