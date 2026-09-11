import { useEffect, useState, useCallback } from "react";
import { useOutletContext } from "react-router-dom";
import { Zap, Loader2, ArrowDownCircle, ArrowUpCircle, Info, Download, FileText } from "lucide-react";
import api from "../../services/api";
import toast from "react-hot-toast";
import CreditTopUpModal from "../../components/CreditTopUpModal";

const TZ = "Asia/Kolkata";
const rupees = (paise) =>
  `₹${(Math.abs(paise || 0) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const CATEGORY_TEXT = {
  marketing: "Marketing message", utility: "Utility message",
  authentication: "Authentication message", service: "Reply",
};

const dayKey = (d) => new Date(d).toLocaleDateString("en-CA", { timeZone: TZ });
const clock = (d) => new Date(d)
  .toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: TZ })
  .replace(/am|pm/i, (m) => m.toUpperCase());

function fmtWhen(d) {
  const k = dayKey(d);
  if (k === dayKey(new Date())) return `Today, ${clock(d)}`;
  if (k === dayKey(Date.now() - 86400000)) return `Yesterday, ${clock(d)}`;
  return `${new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: TZ })}, ${clock(d)}`;
}

// What a ledger row means in words. The conversation is populated server-side
// so a charge reads "Reply to Pranav" rather than a bare category.
function describe(r) {
  const c = r.conversationId;
  const who = c?.contactName || (c?.contactPhone ? `+${c.contactPhone}` : "");
  if (r.type === "topup")      return r.razorpayPaymentId ? `Credits added · ${r.razorpayPaymentId}` : (r.note || "Credits added");
  if (r.type === "refund")     return `Refund${who ? ` · ${who}` : ""}`;
  if (r.type === "adjustment") return r.note || "Adjustment";
  return `${CATEGORY_TEXT[r.category] || "Message"}${who ? ` to ${who}` : ""}`;
}

export default function CreditsPage() {
  const { credits, refreshCredits, isAdmin } = useOutletContext();

  const [rows, setRows]         = useState([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [loading, setLoading]   = useState(true);
  const [exporting, setExporting] = useState(false);
  const [showTopUp, setShowTopUp] = useState(false);
  const [ar, setAr]             = useState(null);
  const [savingAr, setSavingAr] = useState(false);

  useEffect(() => {
    if (credits?.autoRecharge && !ar) setAr({ ...credits.autoRecharge });
  }, [credits, ar]);

  const loadLedger = useCallback((p) => {
    setLoading(true);
    api.get("/credits/ledger", { params: { page: p, limit: 25 } })
      .then((r) => { setRows(r.data.rows || []); setTotal(r.data.total || 0); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadLedger(page); }, [page, loadLedger]);

  const saveAutoRecharge = async (next) => {
    setSavingAr(true);
    try {
      const { data } = await api.patch("/credits/auto-recharge", next);
      setAr(data.autoRecharge);
      refreshCredits();
      toast.success("Auto-recharge updated");
    } catch (e) {
      toast.error(e.response?.data?.message || "Could not save");
    } finally { setSavingAr(false); }
  };

  // Pulls every page, not just what is on screen — a statement that silently
  // stops at 25 rows is the bug this app already had once on lead export.
  const exportCsv = async () => {
    setExporting(true);
    try {
      const all = [];
      for (let p = 1; p <= 50; p++) {
        const { data } = await api.get("/credits/ledger", { params: { page: p, limit: 200 } });
        all.push(...(data.rows || []));
        if (!data.rows?.length || all.length >= (data.total || 0)) break;
      }
      const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      const head = ["Date (IST)", "Type", "Description", "Amount excl. GST (INR)", "Balance after (INR)", "Free tier", "Razorpay payment"];
      const lines = [head.map(esc).join(",")].concat(all.map((r) => [
        fmtWhen(r.createdAt), r.type, describe(r),
        ((r.amountPaise || 0) / 100).toFixed(2), ((r.balanceAfterPaise || 0) / 100).toFixed(2),
        r.freeTierApplied ? "yes" : "", r.razorpayPaymentId || "",
      ].map(esc).join(",")));
      const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `whatsapp-credits-statement-${dayKey(new Date())}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Could not export the statement");
    } finally { setExporting(false); }
  };

  const pages = Math.ceil(total / 25) || 1;
  const free = credits?.freeService;

  return (
    <div className="stitch-page !pt-2">
      <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg font-bold text-app">WhatsApp credits</h1>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: "rgba(251,191,36,0.14)", color: "#b45309" }}>Prepaid wallet</span>
          </div>
          <p className="text-xs text-app-soft flex items-center gap-1.5 mt-0.5">
            <Info className="w-3.5 h-3.5 shrink-0" />
            Separate from your Arthaleads subscription — these pay Meta for messages
          </p>
        </div>
        {isAdmin && (
          <button onClick={() => setShowTopUp(true)}
            className="btn-primary rounded-full px-5 py-2.5 text-sm font-bold flex items-center gap-2">
            <Zap className="w-4 h-4" /> Add credits
          </button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3 mb-5">
        <div className="card p-5 flex flex-col">
          <div className="flex items-center justify-between">
            <p className="text-xs text-app-soft">Available balance</p>
            {credits && (
              <span className="w-2 h-2 rounded-full"
                style={{ background: credits.availablePaise > 0 ? "#22c55e" : "#b91c1c" }} />
            )}
          </div>
          <p className="text-3xl font-bold text-app mt-2 tabular-nums">{credits ? rupees(credits.availablePaise) : "—"}</p>
          <div className="mt-auto pt-4">
            {credits?.reservedPaise > 0 ? (
              <p className="text-[11px] text-app-soft flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#f59e0b" }} />
                {rupees(credits.reservedPaise)} held for messages in flight
              </p>
            ) : <p className="text-[11px] text-app-soft">Nothing held right now</p>}
          </div>
        </div>

        <div className="card p-5 flex flex-col">
          <div className="flex items-center justify-between">
            <p className="text-xs text-app-soft">Free replies left this month</p>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: "rgba(34,197,94,0.12)", color: "#15803d" }}>From Meta</span>
          </div>
          <p className="text-3xl font-bold text-app mt-2 tabular-nums">
            {free ? free.remaining.toLocaleString("en-IN") : "—"}
            {free && <span className="text-xs font-normal text-app-soft ml-1.5">remaining</span>}
          </p>
          <div className="mt-auto pt-4 flex items-center justify-between text-[11px] text-app-soft">
            <span>of {free?.limit?.toLocaleString("en-IN") || "1,000"} from Meta</span>
            <span>Resets on the 1st</span>
          </div>
        </div>

        <div className="card p-5 flex flex-col">
          <p className="text-xs text-app-soft">Your rates</p>
          {credits?.ratesPaise ? (
            <div className="space-y-1 mt-2">
              {[["Reply", "service"], ["Marketing", "marketing"], ["Utility", "utility"]].map(([label, key]) => (
                <div key={key} className="flex items-center justify-between text-xs">
                  <span className="text-app-soft">{label}</span>
                  <span className="text-app font-bold tabular-nums">{rupees(credits.ratesPaise[key])}</span>
                </div>
              ))}
            </div>
          ) : <p className="text-3xl font-bold text-app mt-2">—</p>}
          <p className="mt-auto pt-4 text-[11px] text-app-soft">per message, excl. GST</p>
        </div>
      </div>

      {isAdmin && ar && (
        <div className="card p-5 mb-5">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-base font-bold text-app">Auto-recharge</h2>
              <p className="text-xs text-app-soft mt-0.5">Get alerted before you run out, so replies never stop mid-conversation</p>
            </div>
            <div className="flex items-center gap-2.5 shrink-0">
              <span className="text-xs font-semibold" style={{ color: ar.enabled ? "#15803d" : "var(--app-text-soft)" }}>
                {ar.enabled ? "Enabled" : "Off"}
              </span>
              <button onClick={() => saveAutoRecharge({ ...ar, enabled: !ar.enabled })} disabled={savingAr}
                className="relative w-11 h-6 rounded-full transition disabled:opacity-50"
                style={{ background: ar.enabled ? "#22c55e" : "var(--app-border-strong)" }}
                aria-label="Toggle auto-recharge">
                <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all"
                  style={{ left: ar.enabled ? "1.375rem" : "0.125rem" }} />
              </button>
            </div>
          </div>

          {ar.enabled && (
            <>
              <div className="grid gap-3 sm:grid-cols-2 mt-4">
                <div>
                  <label className="text-xs font-semibold text-app-soft mb-1 block">When balance drops below</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-app-soft text-sm">₹</span>
                    <input type="number" min={100} step={100} className="input w-full pl-8"
                      value={Math.round(ar.thresholdPaise / 100)}
                      onChange={(e) => setAr({ ...ar, thresholdPaise: (parseInt(e.target.value, 10) || 0) * 100 })}
                      onBlur={() => saveAutoRecharge(ar)} />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-app-soft mb-1 block">Top up by</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-app-soft text-sm">₹</span>
                    <input type="number" min={500} step={500} className="input w-full pl-8"
                      value={Math.round(ar.rechargePaise / 100)}
                      onChange={(e) => setAr({ ...ar, rechargePaise: (parseInt(e.target.value, 10) || 0) * 100 })}
                      onBlur={() => saveAutoRecharge(ar)} />
                  </div>
                </div>
              </div>
              {/* Deliberately not "we charge your card": auto-debit needs a
                  saved mandate that does not exist yet, and saying otherwise
                  would leave a tenant surprised mid-campaign. */}
              <p className="text-[11px] text-app-soft mt-3 flex items-start gap-1.5">
                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                  We email your admins to top up when the balance falls below {rupees(ar.thresholdPaise)}.
                  Charging a card automatically needs a saved mandate, which is not set up yet.
                </span>
              </p>
            </>
          )}
        </div>
      )}

      <div className="card p-0 overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5 py-4 flex-wrap" style={{ borderBottom: "1px solid var(--app-border)" }}>
          <div>
            <h2 className="text-base font-bold text-app">Statement</h2>
            <p className="text-xs text-app-soft mt-0.5">Every top-up and every message charged</p>
          </div>
          {total > 0 && (
            <button onClick={exportCsv} disabled={exporting}
              className="btn-secondary rounded-full px-3.5 py-1.5 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50">
              {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              Export CSV
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-5 h-5 animate-spin text-app-soft" />
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-14 px-6">
            <div className="w-11 h-11 rounded-2xl mx-auto mb-3 flex items-center justify-center stitch-surface-muted">
              <FileText className="w-5 h-5 text-app-soft" />
            </div>
            <p className="text-sm font-bold text-app">Nothing yet.</p>
            <p className="text-xs text-app-soft mt-1">Top-ups and message charges will appear here as they happen.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left" style={{ borderBottom: "1px solid var(--app-border)" }}>
                  <th className="px-5 py-2.5 text-xs font-semibold text-app-soft">When</th>
                  <th className="px-5 py-2.5 text-xs font-semibold text-app-soft">What</th>
                  <th className="px-5 py-2.5 text-xs font-semibold text-app-soft text-right">Amount</th>
                  <th className="px-5 py-2.5 text-xs font-semibold text-app-soft text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const credit = r.amountPaise >= 0 && r.type !== "debit";
                  return (
                    <tr key={r._id} style={{
                      borderBottom: "1px solid var(--app-border)",
                      background: r.type === "topup" ? "rgba(34,197,94,0.05)" : undefined,
                    }}>
                      <td className="px-5 py-3 text-xs text-app-soft whitespace-nowrap">{fmtWhen(r.createdAt)}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          {credit
                            ? <ArrowUpCircle className="w-3.5 h-3.5 shrink-0 text-green-600" />
                            : <ArrowDownCircle className="w-3.5 h-3.5 shrink-0 text-app-soft" />}
                          <span className="text-app text-xs">{describe(r)}</span>
                          {r.freeTierApplied && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                              style={{ background: "rgba(34,197,94,0.12)", color: "#15803d" }}>free</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right text-xs font-bold whitespace-nowrap tabular-nums"
                        style={{ color: credit ? "#15803d" : "var(--app-text)" }}>
                        {credit ? "+" : "−"}{rupees(r.amountPaise)}
                      </td>
                      <td className="px-5 py-3 text-right text-xs text-app-soft whitespace-nowrap tabular-nums">
                        {rupees(r.balanceAfterPaise)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {pages > 1 && (
          <div className="flex items-center justify-between px-5 py-3" style={{ borderTop: "1px solid var(--app-border)" }}>
            <span className="text-xs text-app-soft">Page {page} of {pages}</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
                className="btn-secondary rounded-lg px-3 py-1 text-xs disabled:opacity-40">Previous</button>
              <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)}
                className="btn-secondary rounded-lg px-3 py-1 text-xs disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>

      <CreditTopUpModal
        open={showTopUp}
        onClose={() => setShowTopUp(false)}
        onSuccess={() => { refreshCredits(); setPage(1); loadLedger(1); }}
      />
    </div>
  );
}
