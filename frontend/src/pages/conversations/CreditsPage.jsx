import { useEffect, useState, useCallback } from "react";
import { useOutletContext } from "react-router-dom";
import { Zap, Loader2, ArrowDownCircle, ArrowUpCircle, Info } from "lucide-react";
import api from "../../services/api";
import toast from "react-hot-toast";
import CreditTopUpModal from "../../components/CreditTopUpModal";
import { useAuth } from "../../context/AuthContext";

const rupees = (paise) =>
  `₹${(Math.abs(paise) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const CATEGORY_LABEL = {
  marketing: "Marketing", utility: "Utility",
  authentication: "Authentication", service: "Reply",
};

function fmtDate(d) {
  return new Date(d).toLocaleString("en-IN", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

export default function CreditsPage() {
  const { credits, refreshCredits } = useOutletContext();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  const [rows, setRows]       = useState([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(1);
  const [loading, setLoading] = useState(true);
  const [showTopUp, setShowTopUp] = useState(false);

  // Auto-recharge form, seeded from the server once the balance call lands.
  const [ar, setAr] = useState(null);
  const [savingAr, setSavingAr] = useState(false);

  useEffect(() => {
    if (credits?.autoRecharge && !ar) setAr({ ...credits.autoRecharge });
  }, [credits, ar]);

  const loadLedger = useCallback((p) => {
    setLoading(true);
    api.get("/credits/ledger", { params: { page: p, limit: 25 } })
      .then(r => { setRows(r.data.rows || []); setTotal(r.data.total || 0); })
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

  const pages = Math.ceil(total / 25) || 1;

  return (
    <div className="stitch-page">
      <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
        <div>
          <h1 className="text-lg font-bold text-app">WhatsApp credits</h1>
          <p className="text-xs text-app-soft">
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

      {/* Balance summary */}
      <div className="grid gap-3 sm:grid-cols-3 mb-6">
        <div className="card p-5">
          <p className="text-xs text-app-soft mb-1">Available balance</p>
          <p className="text-2xl font-bold text-app">
            {credits ? rupees(credits.availablePaise) : "—"}
          </p>
          {credits?.reservedPaise > 0 && (
            <p className="text-[11px] text-app-soft mt-1">
              {rupees(credits.reservedPaise)} held for messages in flight
            </p>
          )}
        </div>
        <div className="card p-5">
          <p className="text-xs text-app-soft mb-1">Free replies left this month</p>
          <p className="text-2xl font-bold text-app">
            {credits?.freeService ? credits.freeService.remaining.toLocaleString("en-IN") : "—"}
          </p>
          <p className="text-[11px] text-app-soft mt-1">
            of {credits?.freeService?.limit?.toLocaleString("en-IN") || "1,000"} from Meta, resets monthly
          </p>
        </div>
        <div className="card p-5">
          <p className="text-xs text-app-soft mb-1">Your rates</p>
          {credits?.ratesPaise ? (
            <div className="space-y-0.5 mt-1">
              <p className="text-xs text-app"><span className="text-app-soft">Reply</span> {rupees(credits.ratesPaise.service)}</p>
              <p className="text-xs text-app"><span className="text-app-soft">Marketing</span> {rupees(credits.ratesPaise.marketing)}</p>
              <p className="text-xs text-app"><span className="text-app-soft">Utility</span> {rupees(credits.ratesPaise.utility)}</p>
            </div>
          ) : <p className="text-2xl font-bold text-app">—</p>}
          <p className="text-[11px] text-app-soft mt-1">per message, excl. GST</p>
        </div>
      </div>

      {/* Auto-recharge */}
      {isAdmin && ar && (
        <div className="card p-5 mb-6">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-base font-bold text-app">Auto-recharge</h2>
              <p className="text-xs text-app-soft mt-0.5">
                Get alerted before you run out, so replies never stop mid-conversation
              </p>
            </div>
            <button
              onClick={() => saveAutoRecharge({ ...ar, enabled: !ar.enabled })}
              disabled={savingAr}
              className="shrink-0 relative w-11 h-6 rounded-full transition disabled:opacity-50"
              style={{ background: ar.enabled ? "#22c55e" : "var(--app-border)" }}
              aria-label="Toggle auto-recharge">
              <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all"
                style={{ left: ar.enabled ? "1.375rem" : "0.125rem" }} />
            </button>
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
                      onChange={e => setAr({ ...ar, thresholdPaise: (parseInt(e.target.value, 10) || 0) * 100 })}
                      onBlur={() => saveAutoRecharge(ar)} />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-app-soft mb-1 block">Top up by</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-app-soft text-sm">₹</span>
                    <input type="number" min={500} step={500} className="input w-full pl-8"
                      value={Math.round(ar.rechargePaise / 100)}
                      onChange={e => setAr({ ...ar, rechargePaise: (parseInt(e.target.value, 10) || 0) * 100 })}
                      onBlur={() => saveAutoRecharge(ar)} />
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-app-soft mt-3 flex items-start gap-1.5">
                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                  We email you to top up when the balance falls below {rupees(ar.thresholdPaise)}.
                  Charging a card automatically needs a saved mandate, which is not set up yet.
                </span>
              </p>
            </>
          )}
        </div>
      )}

      {/* Statement */}
      <div className="card p-0 overflow-hidden">
        <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--app-border)" }}>
          <h2 className="text-base font-bold text-app">Statement</h2>
          <p className="text-xs text-app-soft mt-0.5">Every top-up and every message charged</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-5 h-5 animate-spin text-app-soft" />
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-16 px-6">
            <p className="text-sm text-app-soft">Nothing yet.</p>
            <p className="text-xs text-app-soft mt-1">
              Top-ups and message charges will appear here as they happen.
            </p>
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
                {rows.map(r => (
                  <tr key={r._id} style={{ borderBottom: "1px solid var(--app-border)" }}>
                    <td className="px-5 py-3 text-xs text-app-soft whitespace-nowrap">{fmtDate(r.createdAt)}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        {r.type === "topup"
                          ? <ArrowUpCircle className="w-3.5 h-3.5 shrink-0 text-green-500" />
                          : <ArrowDownCircle className="w-3.5 h-3.5 shrink-0 text-app-soft" />}
                        <span className="text-app text-xs">
                          {r.type === "topup" ? "Credit added" : CATEGORY_LABEL[r.category] || "Message"}
                        </span>
                        {r.freeTierApplied && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full"
                            style={{ background: "rgba(34,197,94,0.12)", color: "#15803d" }}>free</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right text-xs font-semibold whitespace-nowrap"
                      style={{ color: r.amountPaise >= 0 ? "#15803d" : "var(--app-text)" }}>
                      {r.amountPaise >= 0 ? "+" : "−"}{rupees(r.amountPaise)}
                    </td>
                    <td className="px-5 py-3 text-right text-xs text-app-soft whitespace-nowrap">
                      {rupees(r.balanceAfterPaise)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pages > 1 && (
          <div className="flex items-center justify-between px-5 py-3" style={{ borderTop: "1px solid var(--app-border)" }}>
            <span className="text-xs text-app-soft">Page {page} of {pages}</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                className="btn-secondary rounded-lg px-3 py-1 text-xs disabled:opacity-40">Previous</button>
              <button disabled={page >= pages} onClick={() => setPage(p => p + 1)}
                className="btn-secondary rounded-lg px-3 py-1 text-xs disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>

      <CreditTopUpModal
        open={showTopUp}
        onClose={() => setShowTopUp(false)}
        onSuccess={() => { refreshCredits(); loadLedger(1); setPage(1); }}
      />
    </div>
  );
}
