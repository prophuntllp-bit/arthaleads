import { useState, useEffect, useMemo, useCallback } from "react";
import { X, Loader2, ShieldCheck, Minus, Plus } from "lucide-react";
import api from "../services/api";
import { formatINR, freeMonths } from "../utils/plan";
import toast from "react-hot-toast";

/**
 * Razorpay Checkout for a plan subscription.
 *
 * The figures shown here are the figures the server quotes. The order response
 * carries its own quote, and that is what the customer confirms against — the
 * local estimate below is only so the seat stepper feels instant. If the two
 * ever disagreed, the server's number is the one that gets charged.
 */

const RZP_SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";

// Checkout.js is loaded on demand rather than in index.html: most sessions
// never open this modal, and it is a third-party script on every page load.
function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const existing = document.querySelector(`script[src="${RZP_SCRIPT}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(true));
      existing.addEventListener("error", () => resolve(false));
      return;
    }
    const s = document.createElement("script");
    s.src = RZP_SCRIPT;
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

export default function CheckoutModal({ open, planId, onClose, onSuccess, org }) {
  const [config, setConfig] = useState(null);
  const [cycle, setCycle] = useState("annual");
  const [seats, setSeats] = useState(5);
  const [busy, setBusy] = useState(false);
  const [loadErr, setLoadErr] = useState("");

  const plan = useMemo(
    () => config?.plans?.find((p) => p.id === planId) || null,
    [config, planId]
  );

  useEffect(() => {
    if (!open) return;
    setLoadErr("");
    api.get("/billing/plans")
      .then((r) => {
        setConfig(r.data);
        const p = r.data.plans?.find((x) => x.id === planId);
        if (p) setSeats((s) => Math.min(Math.max(s, p.minSeats), p.maxSeats));
      })
      .catch(() => setLoadErr("Could not load pricing. Please try again."));
  }, [open, planId]);

  const estimate = useMemo(() => {
    if (!plan) return null;
    const rate = cycle === "annual" ? plan.annual : plan.monthly;
    return { rate, total: rate * seats };
  }, [plan, cycle, seats]);

  const clampSeats = useCallback(
    (n) => {
      if (!plan) return n;
      return Math.min(Math.max(n, plan.minSeats), plan.maxSeats);
    },
    [plan]
  );

  const pay = async () => {
    if (!plan || busy) return;
    setBusy(true);
    try {
      const ok = await loadRazorpay();
      if (!ok) throw new Error("Could not reach the payment gateway. Check your connection and try again.");

      const { data } = await api.post("/billing/order", { plan: planId, seats, cycle });
      const { order, quote, keyId } = data;

      await new Promise((resolve) => {
        const rzp = new window.Razorpay({
          key: keyId,
          order_id: order.id,
          amount: order.amount,
          currency: order.currency,
          name: "Arthaleads",
          description: `${plan.id === "growth" ? "Growth" : "Starter"} · ${quote.seats} seats · ${quote.cycle}`,
          prefill: { name: org?.name || "", email: org?.email || "" },
          theme: { color: "#ff6b00" },
          handler: async (resp) => {
            try {
              await api.post("/billing/verify", resp);
              toast.success("Payment received. Your plan is active.");
              onSuccess?.();
              onClose?.();
            } catch {
              // The webhook is authoritative, so a failure here is a reporting
              // problem, not a lost payment. Say so rather than implying the
              // money vanished.
              toast.success("Payment received. Your plan will activate shortly.");
              onClose?.();
            } finally {
              resolve();
            }
          },
          modal: { ondismiss: () => resolve() },
        });
        rzp.on("payment.failed", (e) => {
          toast.error(e?.error?.description || "Payment failed. You have not been charged.");
          resolve();
        });
        rzp.open();
      });
    } catch (e) {
      toast.error(e?.response?.data?.message || e.message || "Could not start checkout.");
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  const free = freeMonths(planId);

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}>
      <div
        className="w-full sm:max-w-md bg-app-surface rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog" aria-modal="true" aria-label="Checkout"
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h2 className="text-lg font-black text-app">
            Subscribe to {planId === "growth" ? "Growth" : "Starter"}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-app-hover" aria-label="Close">
            <X className="w-4 h-4 text-app-soft" />
          </button>
        </div>

        {config?.testMode && (
          <div className="mx-5 mb-3 px-3 py-2 rounded-xl text-xs font-semibold"
            style={{ background: "rgba(234,179,8,0.12)", border: "1px solid rgba(234,179,8,0.4)", color: "#a16207" }}>
            Test mode — no real payment will be taken.
          </div>
        )}

        {loadErr && <p className="px-5 pb-4 text-sm text-red-500">{loadErr}</p>}

        {!config && !loadErr && (
          <div className="px-5 py-10 flex justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-app-soft" />
          </div>
        )}

        {plan && (
          <div className="px-5 pb-5 space-y-4">
            {/* Billing cycle */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-app-soft mb-2">Billing</p>
              <div className="grid grid-cols-2 gap-2">
                {["monthly", "annual"].map((c) => (
                  <button key={c} onClick={() => setCycle(c)}
                    className="px-3 py-2.5 rounded-xl text-sm font-semibold border transition-all text-left"
                    style={{
                      borderColor: cycle === c ? "#ff6b00" : "var(--border)",
                      background: cycle === c ? "rgba(255,107,0,0.08)" : "transparent",
                      color: cycle === c ? "#ff6b00" : "var(--text-soft)",
                    }}>
                    {c === "monthly" ? "Monthly" : "Annual"}
                    {c === "annual" && free ? (
                      <span className="block text-[10px] font-medium opacity-80">{free} months free</span>
                    ) : (
                      <span className="block text-[10px] font-medium opacity-80">Pay as you go</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Seats */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-app-soft mb-2">
                Team members
              </p>
              <div className="flex items-center gap-3">
                <button onClick={() => setSeats((s) => clampSeats(s - 1))}
                  disabled={seats <= plan.minSeats}
                  className="w-9 h-9 rounded-xl border flex items-center justify-center disabled:opacity-40"
                  style={{ borderColor: "var(--border)" }} aria-label="Remove a seat">
                  <Minus className="w-4 h-4" />
                </button>
                <input
                  type="number" value={seats}
                  min={plan.minSeats} max={plan.maxSeats}
                  onChange={(e) => setSeats(clampSeats(parseInt(e.target.value, 10) || plan.minSeats))}
                  className="input text-center flex-1" style={{ padding: "8px 12px" }}
                  aria-label="Number of team members"
                />
                <button onClick={() => setSeats((s) => clampSeats(s + 1))}
                  disabled={seats >= plan.maxSeats}
                  className="w-9 h-9 rounded-xl border flex items-center justify-center disabled:opacity-40"
                  style={{ borderColor: "var(--border)" }} aria-label="Add a seat">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[11px] text-app-soft mt-1.5">
                Minimum {plan.minSeats}, up to {plan.maxSeats} on this plan.
              </p>
            </div>

            {/* Total */}
            <div className="rounded-2xl p-4" style={{ background: "var(--surface-alt, rgba(0,0,0,0.03))" }}>
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-app-soft">
                  {formatINR(estimate.rate)} × {seats} {seats === 1 ? "member" : "members"}
                </span>
                <span className="text-2xl font-black text-app">{formatINR(estimate.total)}</span>
              </div>
              <p className="text-[11px] text-app-soft mt-1">
                Billed {cycle === "annual" ? "yearly" : "monthly"}. Taxes extra where applicable.
              </p>
            </div>

            <button onClick={pay} disabled={busy}
              className="w-full py-3.5 rounded-2xl font-bold text-white text-sm flex items-center justify-center gap-2 disabled:opacity-60"
              style={{ background: "#ff6b00", boxShadow: "0 4px 20px rgba(255,107,0,0.3)" }}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {busy ? "Opening checkout…" : `Pay ${formatINR(estimate.total)}`}
            </button>

            <p className="flex items-center justify-center gap-1.5 text-[11px] text-app-soft">
              <ShieldCheck className="w-3.5 h-3.5" />
              Secured by Razorpay · UPI, cards and net banking
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
