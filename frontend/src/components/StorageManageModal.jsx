// StorageManageModal.jsx — see what is using file space, free some up, or buy more.
// Everything here comes from /api/storage; prices and GST are the server's, so
// the number on screen is the number that gets charged.
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, HardDrive, Trash2, Zap, ShieldCheck, Minus, Plus } from "lucide-react";
import toast from "react-hot-toast";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { Modal } from "./UI";
import { formatBytes, upgradeTarget } from "../utils/plan";
import { loadRazorpay, RZP_LOAD_ERROR, UPI_FIRST_CONFIG } from "../utils/razorpay";

const rupees = (paise) =>
  `₹${((paise || 0) / 100).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const dateIN = (d) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

const CATEGORY_LABEL = {
  project_media: "Project photos, brochures and videos",
  recordings: "Call recordings",
  attendance: "Attendance photos",
  logo: "Logo",
  other: "Other files",
};
const AGE_CHOICES = [30, 90, 180, 365];
const TERMS = { 1: "1 month", 3: "3 months", 12: "12 months" };

export default function StorageManageModal({ open, onClose }) {
  const { user, org } = useAuth();
  const isAdmin = user?.role === "admin";
  const [ov, setOv] = useState(null);
  const [packs, setPacks] = useState(1);
  const [months, setMonths] = useState(12);
  const [quote, setQuote] = useState(null);
  const [busy, setBusy] = useState(false);
  const [clean, setClean] = useState(null);   // { category, days, preview, working }

  const load = useCallback(() => {
    api.get("/storage/overview").then((r) => setOv(r.data)).catch(() => {});
  }, []);
  useEffect(() => { if (open) { setClean(null); load(); } }, [open, load]);

  useEffect(() => {
    if (!open || !isAdmin) return undefined;
    let cancelled = false;
    api.get("/storage/quote", { params: { packs, months } })
      .then((r) => { if (!cancelled) setQuote(r.data); })
      .catch(() => { if (!cancelled) setQuote(null); });
    return () => { cancelled = true; };
  }, [open, isAdmin, packs, months]);

  const pickClean = async (category, days) => {
    setClean({ category, days, preview: null });
    try {
      const { data } = await api.post("/storage/free-up/preview", { category, olderThanDays: days });
      setClean((c) => (c && c.category === category && c.days === days ? { ...c, preview: data } : c));
    } catch { setClean(null); }
  };
  const confirmClean = async () => {
    if (!clean?.preview?.files) return;
    setClean((c) => ({ ...c, working: true }));
    try {
      const { data } = await api.post("/storage/free-up", { category: clean.category, olderThanDays: clean.days });
      toast.success(`Freed ${formatBytes(data.bytes)} (${data.files} file${data.files === 1 ? "" : "s"}).`);
      setClean(null);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Could not free up space.");
      setClean((c) => c && { ...c, working: false });
    }
  };

  const pay = async () => {
    if (busy || !quote) return;
    setBusy(true);
    try {
      if (!(await loadRazorpay())) throw new Error(RZP_LOAD_ERROR);
      const { data } = await api.post("/storage/order", { packs, months });
      await new Promise((resolve) => {
        const rzp = new window.Razorpay({
          key: data.keyId, order_id: data.orderId, amount: data.amountPaise, currency: "INR",
          name: "Arthaleads", image: `${window.location.origin}/apple-touch-icon.png`,
          description: `${data.gb} GB extra storage, ${TERMS[months]}`,
          prefill: { name: org?.name || data.orgName || "" },
          theme: { color: "#ff6b00" }, config: UPI_FIRST_CONFIG,
          handler: async (resp) => {
            try {
              await api.post("/storage/verify", resp);
              toast.success(`${data.gb} GB added to your storage.`);
            } catch {
              // The webhook is authoritative; this is only a reporting problem.
              toast.success("Payment received. Your space will appear shortly.");
            } finally { load(); resolve(); }
          },
          modal: { ondismiss: () => resolve() },
        });
        rzp.on("payment.failed", (e) => { toast.error(e?.error?.description || "Payment failed. You have not been charged."); resolve(); });
        rzp.open();
      });
    } catch (e) {
      toast.error(e?.response?.data?.message || e.message || "Could not start checkout.", { duration: 8000 });
    } finally { setBusy(false); }
  };

  const pct = ov ? Math.min(100, Math.round(ov.percent)) : 0;
  const cats = ov ? Object.entries(ov.byCategory || {}).filter(([, v]) => v.bytes > 0).sort((a, b) => b[1].bytes - a[1].bytes) : [];
  const next = upgradeTarget(org?.plan);
  const maxPacks = ov?.addon?.maxPacks || 50;

  const title = (
    <span className="flex items-center gap-2.5">
      <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: "rgba(var(--app-primary-rgb),0.12)" }}>
        <HardDrive className="w-4 h-4" style={{ color: "var(--app-primary)" }} />
      </span>
      Manage storage
    </span>
  );

  return (
    <Modal open={open} onClose={onClose} title={title} size="md">
      {!ov ? (
        <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-app-soft" /></div>
      ) : (
        <div className="space-y-6">
          {/* Meter */}
          <div className="rounded-2xl px-4 py-3.5 stitch-surface-muted">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-2xl font-bold text-app tabular-nums">{formatBytes(ov.usedBytes)}
                <span className="text-sm font-medium text-app-soft"> of {formatBytes(ov.limitBytes)}</span></p>
              <span className="text-sm font-semibold text-app tabular-nums">{pct}%</span>
            </div>
            <div className="mt-2 h-2.5 rounded-full overflow-hidden" style={{ background: "var(--app-border)" }}>
              <div className="h-full rounded-full" style={{ width: `${Math.max(pct, ov.usedBytes > 0 ? 1 : 0)}%`, background: ov.full ? "#dc2626" : ov.warn ? "#f59e0b" : "var(--app-primary)" }} />
            </div>
            <p className="mt-2 text-xs text-app-soft">
              {formatBytes(ov.baseBytes)} from your {ov.plan} plan
              {ov.extraBytes > 0 && <> + {formatBytes(ov.extraBytes)} granted</>}
              {ov.packBytes > 0 && <> + {formatBytes(ov.packBytes)} you added</>}.
              {ov.full && " Uploads are paused until you free some space or add more."}
            </p>
          </div>

          {/* What is using it */}
          <div>
            <p className="text-xs font-semibold text-app-soft mb-2">What is using your space</p>
            {cats.length === 0 ? (
              <p className="text-sm text-app-soft">Nothing stored yet.</p>
            ) : (
              <div className="space-y-3">
                {cats.map(([key, v]) => {
                  const canClear = isAdmin && (key === "recordings" || key === "attendance");
                  const active = clean?.category === key;
                  return (
                    <div key={key}>
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-app">{CATEGORY_LABEL[key] || key}
                          <span className="text-app-soft"> · {v.files.toLocaleString("en-IN")} file{v.files === 1 ? "" : "s"}</span></span>
                        <span className="font-semibold text-app tabular-nums shrink-0">{formatBytes(v.bytes)}</span>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--app-border)" }}>
                        <div className="h-full rounded-full" style={{ width: `${Math.max(2, (v.bytes / Math.max(ov.usedBytes, 1)) * 100)}%`, background: "var(--app-primary)", opacity: 0.75 }} />
                      </div>
                      {key === "project_media" && (
                        <p className="mt-1 text-[11px] text-app-soft">
                          Remove files from inside a project: open it from <Link to="/projects" onClick={onClose} className="font-semibold" style={{ color: "var(--app-primary)" }}>Projects</Link> and delete what you no longer use.
                        </p>
                      )}
                      {key === "recordings" && (
                        <p className="mt-1 text-[11px] text-app-soft">Recordings are removed on their own after {ov.recordingDays} days on your plan.</p>
                      )}
                      {canClear && (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] text-app-soft mr-1">Delete ones older than</span>
                          {AGE_CHOICES.map((d) => (
                            <button key={d} type="button" onClick={() => pickClean(key, d)}
                              className="px-2.5 py-1 rounded-full text-[11px] font-semibold cursor-pointer transition"
                              style={active && clean.days === d
                                ? { background: "rgba(var(--app-primary-rgb),0.14)", border: "1px solid var(--app-primary)", color: "var(--app-primary)" }
                                : { background: "var(--app-surface-low)", border: "1px solid var(--app-border)", color: "var(--app-text)" }}>
                              {d} days
                            </button>
                          ))}
                        </div>
                      )}
                      {active && (
                        <div className="mt-2 rounded-xl px-3 py-2.5 flex items-center justify-between gap-3"
                          style={{ background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.2)" }}>
                          {!clean.preview ? (
                            <span className="text-xs text-app-soft flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking</span>
                          ) : clean.preview.files === 0 ? (
                            <span className="text-xs text-app-soft">Nothing is older than {clean.days} days.</span>
                          ) : (
                            <>
                              <span className="text-xs text-app">
                                Delete <b>{clean.preview.files.toLocaleString("en-IN")}</b> file{clean.preview.files === 1 ? "" : "s"} ({formatBytes(clean.preview.bytes)})?
                                {" "}{key === "recordings" ? "The call, notes and summary stay; only the audio goes." : "The attendance records stay; only the photos go."} This can't be undone.
                              </span>
                              <button type="button" onClick={confirmClean} disabled={clean.working}
                                className="shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold text-white cursor-pointer disabled:opacity-50"
                                style={{ background: "#dc2626" }}>
                                {clean.working ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Delete
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Buy more */}
          {isAdmin ? (
            <div className="space-y-3">
              <div>
                <p className="text-sm font-bold text-app">Add more space</p>
                <p className="text-xs text-app-soft mt-0.5">
                  {ov.addon.gb} GB for {rupees(ov.addon.pricePerMonth * 100)} a month, plus GST. Added to your plan's space straight away.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="inline-flex items-center rounded-full" style={{ border: "1px solid var(--app-border)" }}>
                  <button type="button" aria-label="Fewer" onClick={() => setPacks((p) => Math.max(1, p - 1))}
                    className="w-9 h-9 flex items-center justify-center text-app-soft hover:text-app cursor-pointer"><Minus className="w-4 h-4" /></button>
                  <span className="w-20 text-center text-sm font-bold text-app tabular-nums">{packs * ov.addon.gb} GB</span>
                  <button type="button" aria-label="More" onClick={() => setPacks((p) => Math.min(maxPacks, p + 1))}
                    className="w-9 h-9 flex items-center justify-center text-app-soft hover:text-app cursor-pointer"><Plus className="w-4 h-4" /></button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {ov.addon.months.map((m) => (
                    <button key={m} type="button" onClick={() => setMonths(m)}
                      className="px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition"
                      style={months === m
                        ? { background: "rgba(var(--app-primary-rgb),0.14)", border: "1px solid var(--app-primary)", color: "var(--app-primary)" }
                        : { background: "var(--app-surface-low)", border: "1px solid var(--app-border)", color: "var(--app-text)" }}>
                      {TERMS[m] || `${m} months`}
                    </button>
                  ))}
                </div>
              </div>
              {quote && (
                <div className="rounded-2xl px-4 py-3 space-y-1.5 stitch-surface-muted text-sm">
                  <div className="flex justify-between"><span className="text-app-soft">{quote.gb} GB for {TERMS[quote.months]}</span><span className="text-app tabular-nums">{rupees(quote.basePaise)}</span></div>
                  <div className="flex justify-between"><span className="text-app-soft">GST ({quote.gstRate}%)</span><span className="text-app tabular-nums">{rupees(quote.gstPaise)}</span></div>
                  <div className="flex justify-between pt-1.5 font-bold" style={{ borderTop: "1px solid var(--app-border)" }}>
                    <span className="text-app">You pay</span><span className="text-app tabular-nums">{rupees(quote.amountPaise)}</span>
                  </div>
                </div>
              )}
              <button type="button" onClick={pay} disabled={busy || !quote || !ov.paymentsConfigured}
                className="btn-primary w-full rounded-full py-3 text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                {busy ? "Opening payment…" : quote ? `Pay ${rupees(quote.amountPaise)}` : "Choose an amount"}
              </button>
              {!ov.paymentsConfigured && <p className="text-xs text-red-500">Online payment is not set up yet. Write to contact@arthaleads.com.</p>}

              {ov.activePacks.length > 0 && (
                <div className="text-xs text-app-soft space-y-0.5">
                  {ov.activePacks.map((p, i) => <p key={i}>{p.gb} GB added, valid until {dateIN(p.expiresAt)}</p>)}
                  <p>When a block ends your files stay; you just can't upload more once you are over the limit.</p>
                </div>
              )}
              {next && (
                <p className="text-xs text-app-soft">Need a lot more, or other features too? <Link to="/plans" onClick={onClose} className="font-semibold" style={{ color: "var(--app-primary)" }}>Compare plans</Link></p>
              )}
              <p className="text-[11px] text-app-soft flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 shrink-0" style={{ color: "#15803d" }} />Secure checkout by Razorpay. UPI, cards and net banking.</p>
            </div>
          ) : (
            <p className="text-sm text-app-soft">Ask your admin to free up or add more space.</p>
          )}
        </div>
      )}
    </Modal>
  );
}
