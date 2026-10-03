import { useEffect, useState, useCallback } from "react";
import { useOutletContext } from "react-router-dom";
import { Zap, Loader2, ArrowDownCircle, ArrowUpCircle, Info, Download, FileText, BarChart3 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
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

// Colours validated for both themes (see the dataviz palette check): marketing
// is the warm one because it is the one that costs the most per message.
const UTIL_COLORS = { marketing: "#ea580c", service: "#2563eb", other: "#0d9488" };
const UTIL_LABELS = { marketing: "Marketing", service: "Replies", other: "Utility & other" };
const RANGES = [["7", "Last 7 days"], ["30", "Last 30 days"], ["month", "This month"]];
const num = (n) => (n || 0).toLocaleString("en-IN");
// Per-message rates are fractions of a rupee (Meta's reply rate is ₹0.115), so they need a third decimal that the usual two-decimal money format would round away.
const ratePerMessage = (paise) =>
  `₹${((paise || 0) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 3 })}`;
const shortDay = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

function UtilTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((a, p) => a + (p.value || 0), 0);
  return (
    <div className="rounded-xl px-3 py-2 text-xs shadow-lg" style={{ background: "var(--app-surface-solid)", border: "1px solid var(--app-border)" }}>
      <p className="font-bold text-app mb-1">{shortDay(label)}</p>
      {payload.slice().reverse().map((p) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-5">
          <span className="flex items-center gap-1.5 text-app-soft">
            <span className="w-2 h-2 rounded-sm" style={{ background: p.color }} />{UTIL_LABELS[p.dataKey]}
          </span>
          <span className="text-app font-semibold tabular-nums">{num(p.value)}</span>
        </div>
      ))}
      <div className="flex items-center justify-between gap-5 mt-1 pt-1" style={{ borderTop: "1px solid var(--app-border)" }}>
        <span className="text-app-soft">Total</span><span className="text-app font-bold tabular-nums">{num(total)}</span>
      </div>
    </div>
  );
}

// Where the messages and the money went. The Statement below lists charges one
// by one; this is the "what am I actually spending on" view.
function UtilizationSection() {
  const [range, setRange] = useState("30");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get("/credits/utilization", { params: { range } })
      .then((r) => setData(r.data))
      .catch(() => toast.error("Could not load usage"))
      .finally(() => setLoading(false));
  }, [range]);

  const direct = !!data?.billedDirectlyByMeta;
  const t = data?.totals;
  const sources = data?.sources;
  const sourceTotal = (sources?.bot || 0) + (sources?.team || 0) + (sources?.campaigns || []).reduce((a, c) => a + c.messages, 0);
  const pct = (n) => (sourceTotal ? Math.round((n / sourceTotal) * 100) : 0);

  return (
    <div className="card p-5 mb-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-bold text-app flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-app-soft" /> Credits utilization
          </h2>
          <p className="text-xs text-app-soft mt-0.5">
            {direct ? "What your WhatsApp messages are costing you, by type and by who sent them" : "Where your credits are going, by message type and by who sent them"}
          </p>
        </div>
        <div className="flex gap-1 p-1 rounded-full" style={{ background: "var(--app-surface-low)" }}>
          {RANGES.map(([k, label]) => (
            <button key={k} onClick={() => setRange(k)}
              className="px-3 py-1 rounded-full text-xs font-semibold transition"
              style={range === k ? { background: "var(--app-surface-solid)", color: "var(--app-text)", boxShadow: "0 1px 3px rgba(0,0,0,0.12)" } : { color: "var(--app-text-soft)" }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading && !data ? (
        <div className="flex items-center justify-center py-14"><Loader2 className="w-5 h-5 animate-spin text-app-soft" /></div>
      ) : data && (
        <div className={loading ? "opacity-60 transition" : "transition"}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
            {[
              ["Messages sent", num(t.messages), "all outgoing WhatsApp messages"],
              ["Free replies", num(t.free), "covered by the monthly allowance"],
              ["Paid messages", num(t.paid), "marketing, utility and replies past the allowance"],
              direct
                ? ["Estimated Meta charge", rupees(t.estMetaPaise), "before GST, on Meta's published rates"]
                : ["Credits spent", rupees(t.spentPaise), "taken from your wallet, before GST"],
            ].map(([label, value, hint]) => (
              <div key={label} className="rounded-2xl p-4 stitch-surface-muted">
                <p className="text-xs text-app-soft">{label}</p>
                <p className="text-2xl font-bold text-app mt-1 tabular-nums">{value}</p>
                <p className="text-[11px] text-app-soft mt-1">{hint}</p>
              </div>
            ))}
          </div>

          {t.messages === 0 ? (
            <p className="text-sm text-app-soft text-center py-10">No messages were sent in this period.</p>
          ) : (
            <>
              <div className="mt-6">
                <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                  <p className="text-xs font-semibold text-app-soft">Messages sent per day</p>
                  <div className="flex items-center gap-3 text-xs text-app-soft">
                    {Object.keys(UTIL_COLORS).map((k) => (
                      <span key={k} className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm" style={{ background: UTIL_COLORS[k] }} />{UTIL_LABELS[k]}
                      </span>
                    ))}
                  </div>
                </div>
                <div style={{ width: "100%", height: 200 }}>
                  <ResponsiveContainer>
                    <BarChart data={data.days} margin={{ top: 4, right: 4, left: -18, bottom: 0 }} barCategoryGap="22%">
                      <CartesianGrid vertical={false} stroke="var(--app-border)" />
                      <XAxis dataKey="date" tickFormatter={shortDay} interval="preserveStartEnd" minTickGap={28}
                        tick={{ fontSize: 11, fill: "var(--app-text-soft)" }} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--app-text-soft)" }} axisLine={false} tickLine={false} />
                      <Tooltip content={<UtilTooltip />} cursor={{ fill: "rgba(128,128,128,0.10)" }} />
                      {["service", "marketing", "other"].map((k) => (
                        <Bar key={k} dataKey={k} stackId="m" fill={UTIL_COLORS[k]} stroke="var(--app-surface-solid)" strokeWidth={2} isAnimationActive={false} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="overflow-x-auto mt-5">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left" style={{ borderBottom: "1px solid var(--app-border)" }}>
                      <th className="py-2 pr-3 text-xs font-semibold text-app-soft">Type</th>
                      <th className="py-2 px-3 text-xs font-semibold text-app-soft text-right">Sent</th>
                      <th className="py-2 px-3 text-xs font-semibold text-app-soft text-right">Free</th>
                      <th className="py-2 px-3 text-xs font-semibold text-app-soft text-right">Paid</th>
                      <th className="py-2 px-3 text-xs font-semibold text-app-soft text-right">{direct ? "Meta rate" : "Your rate"}</th>
                      <th className="py-2 pl-3 text-xs font-semibold text-app-soft text-right">{direct ? "Estimated charge" : "Credits spent"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.categories.map((c) => (
                      <tr key={c.category} style={{ borderBottom: "1px solid var(--app-border)" }}>
                        <td className="py-2.5 pr-3 text-xs text-app font-semibold">
                          <span className="inline-block w-2.5 h-2.5 rounded-sm mr-2 align-middle"
                            style={{ background: UTIL_COLORS[c.category === "marketing" || c.category === "service" ? c.category : "other"] }} />
                          {c.label}
                        </td>
                        <td className="py-2.5 px-3 text-xs text-app text-right tabular-nums">{num(c.messages)}</td>
                        <td className="py-2.5 px-3 text-xs text-app-soft text-right tabular-nums">{num(c.free)}</td>
                        <td className="py-2.5 px-3 text-xs text-app text-right tabular-nums">{num(c.paid)}</td>
                        <td className="py-2.5 px-3 text-xs text-app-soft text-right tabular-nums">
                          {c.category === "other" ? "—" : direct ? ratePerMessage(({ marketing: 86.31, service: 11.5, utility: 11.5, authentication: 11.5 })[c.category]) : ratePerMessage(c.ratePaise)}
                        </td>
                        <td className="py-2.5 pl-3 text-xs text-app font-bold text-right tabular-nums">
                          {c.category === "other" ? "—" : rupees(direct ? c.estMetaPaise : c.spentPaise)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold text-app-soft mb-2">Who sent them</p>
                  {[
                    ["Assistant and button flow", sources.bot],
                    ["Your team", sources.team],
                    ["Campaigns", (sources.campaigns || []).reduce((a, c) => a + c.messages, 0)],
                  ].map(([label, n]) => (
                    <div key={label} className="mb-2.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-app">{label}</span>
                        <span className="text-app-soft tabular-nums">{num(n)} · {pct(n)}%</span>
                      </div>
                      <div className="h-1.5 rounded-full mt-1 overflow-hidden" style={{ background: "var(--app-surface-low)" }}>
                        <div className="h-full rounded-full" style={{ width: `${pct(n)}%`, background: "var(--app-primary, #ea580c)" }} />
                      </div>
                    </div>
                  ))}
                </div>
                <div>
                  <p className="text-xs font-semibold text-app-soft mb-2">Campaigns in this period</p>
                  {(sources.campaigns || []).length === 0 ? (
                    <p className="text-xs text-app-soft">No campaign messages were sent.</p>
                  ) : (sources.campaigns || []).slice(0, 6).map((c) => (
                    <div key={c.name} className="flex items-center justify-between text-xs py-1.5" style={{ borderBottom: "1px solid var(--app-border)" }}>
                      <span className="text-app truncate pr-3">{c.name}</span>
                      <span className="text-app-soft tabular-nums shrink-0">{num(c.messages)} sent</span>
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-[11px] text-app-soft mt-4 flex items-start gap-1.5">
                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                  {direct
                    ? "Your messages are billed by Meta to your own account, not from this wallet. Estimates use Meta's published India rates before GST and assume each free reply is covered by the monthly allowance. Meta's invoice is the final figure."
                    : "Credits spent is what was taken from your wallet, before GST. Free replies use the monthly allowance and cost nothing."}
                  {" "}Messages that failed to send are not counted.
                </span>
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
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
            Separate from your Arthaleads subscription — these pay for WhatsApp messages
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
              style={{ background: "rgba(34,197,94,0.12)", color: "#15803d" }}>Included free</span>
          </div>
          <p className="text-3xl font-bold text-app mt-2 tabular-nums">
            {free ? free.remaining.toLocaleString("en-IN") : "—"}
            {free && <span className="text-xs font-normal text-app-soft ml-1.5">remaining</span>}
          </p>
          <div className="mt-auto pt-4 flex items-center justify-between text-[11px] text-app-soft">
            <span>of {free?.limit?.toLocaleString("en-IN") || "1,000"} included</span>
            <span>Resets on the 1st</span>
          </div>
        </div>

        <div className="card p-5 flex flex-col">
          <p className="text-xs text-app-soft">Your rates</p>
          {credits?.billedDirectlyByMeta ? (
            <p className="text-sm font-bold text-app mt-2 leading-relaxed">Billed directly to your own account — not through this wallet.</p>
          ) : credits?.ratesPaise ? (
            <div className="space-y-1 mt-2">
              {[["Reply", "service"], ["Marketing", "marketing"], ["Utility", "utility"]].map(([label, key]) => (
                <div key={key} className="flex items-center justify-between text-xs">
                  <span className="text-app-soft">{label}</span>
                  <span className="text-app font-bold tabular-nums">{rupees(credits.ratesPaise[key])}</span>
                </div>
              ))}
            </div>
          ) : <p className="text-3xl font-bold text-app mt-2">—</p>}
          {!credits?.billedDirectlyByMeta && <p className="mt-auto pt-4 text-[11px] text-app-soft">per message, excl. GST</p>}
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

      <UtilizationSection />

      <div className="card p-0 overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5 py-4 flex-wrap" style={{ borderBottom: "1px solid var(--app-border)" }}>
          <div>
            <h2 className="text-base font-bold text-app">Statement</h2>
            <p className="text-xs text-app-soft mt-0.5">
              {credits?.billedDirectlyByMeta
                ? "Meta bills your WhatsApp messages directly, so this wallet is not charged. The estimate is in Credits utilization above; the real figure is on Meta's invoice."
                : "Every top-up and every message charged"}
            </p>
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
                  // On a directly-billed account a send costs the wallet nothing:
                  // say who does bill it instead of a bare "−₹0.00".
                  const metaBilled = credits?.billedDirectlyByMeta && r.type === "debit" && !r.amountPaise;
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
                        style={{ color: credit ? "#15803d" : metaBilled ? "var(--app-text-soft)" : "var(--app-text)", fontWeight: metaBilled ? 500 : undefined }}>
                        {metaBilled ? "Billed by Meta" : `${credit ? "+" : "−"}${rupees(r.amountPaise)}`}
                      </td>
                      <td className="px-5 py-3 text-right text-xs text-app-soft whitespace-nowrap tabular-nums">
                        {metaBilled ? "—" : rupees(r.balanceAfterPaise)}
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
