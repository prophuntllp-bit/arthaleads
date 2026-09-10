import { useState, useEffect } from "react";
import { Loader2, Zap, Info } from "lucide-react";
import api from "../services/api";
import toast from "react-hot-toast";
import { Modal } from "./UI";
import { loadRazorpay, RZP_LOAD_ERROR, UPI_FIRST_CONFIG } from "../utils/razorpay";

// Presets in rupees. The ₹500 floor matches the server's MIN_TOPUP_PAISE —
// the server re-validates, this is only so the buttons cannot offer something
// that will be refused.
const PRESETS = [500, 1000, 2500, 5000];

const rupees = (paise) => `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export default function CreditTopUpModal({ open, onClose, onSuccess, orgName }) {
  const [amount, setAmount]   = useState(1000);   // rupees
  const [quote, setQuote]     = useState(null);
  const [busy, setBusy]       = useState(false);
  const [balance, setBalance] = useState(null);

  useEffect(() => {
    if (!open) return;
    api.get("/credits/balance").then(r => setBalance(r.data)).catch(() => {});
  }, [open]);

  // Ask the server for the GST breakdown rather than computing 18% here — if
  // the rate ever changes it changes in one place, and the number on screen is
  // then the number that gets charged.
  useEffect(() => {
    if (!open || !amount || amount < 500) { setQuote(null); return; }
    let cancelled = false;
    api.get("/credits/topup/quote", { params: { creditPaise: Math.round(amount * 100) } })
      .then(r => { if (!cancelled) setQuote(r.data); })
      .catch(() => { if (!cancelled) setQuote(null); });
    return () => { cancelled = true; };
  }, [amount, open]);

  const pay = async () => {
    if (busy || !quote) return;
    setBusy(true);
    try {
      const ok = await loadRazorpay();
      if (!ok) throw new Error(RZP_LOAD_ERROR);

      const { data } = await api.post("/credits/topup/order", { creditPaise: quote.creditPaise });

      await new Promise((resolve) => {
        const rzp = new window.Razorpay({
          key: data.keyId,
          order_id: data.orderId,
          amount: data.amountPaise,
          currency: "INR",
          name: "Arthaleads",
          image: `${window.location.origin}/apple-touch-icon.png`,
          description: `WhatsApp credits — ${rupees(quote.creditPaise)}`,
          prefill: { name: orgName || "" },
          theme: { color: "#ff6b00" },
          // UPI first: it carries effectively zero MDR against ~2% on cards,
          // which on our margin is worth about three points.
          config: UPI_FIRST_CONFIG,
          handler: async (resp) => {
            try {
              const v = await api.post("/credits/topup/verify", resp);
              toast.success(`${rupees(quote.creditPaise)} of credits added.`);
              onSuccess?.(v.data);
              onClose?.();
            } catch {
              // The webhook is authoritative, so a failure here is a reporting
              // problem, not a lost payment. Say so rather than implying the
              // money vanished.
              toast.success("Payment received. Your credits will appear shortly.");
              onSuccess?.();
              onClose?.();
            } finally { resolve(); }
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
      toast.error(e?.response?.data?.message || e.message || "Could not start checkout.", { duration: 8000 });
    } finally { setBusy(false); }
  };

  const tooSmall = amount && amount < 500;

  return (
    <Modal open={open} onClose={onClose} title="Add WhatsApp credits" size="md">
      <div className="space-y-5">

        {balance && (
          <div className="rounded-2xl px-4 py-3" style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)" }}>
            <p className="text-xs text-app-soft">Current balance</p>
            <p className="text-2xl font-bold text-app">{rupees(balance.availablePaise)}</p>
            {balance.freeService?.remaining > 0 && (
              <p className="text-xs text-app-soft mt-1">
                Plus {balance.freeService.remaining.toLocaleString("en-IN")} free replies left this month
              </p>
            )}
          </div>
        )}

        <div>
          <label className="text-xs font-semibold text-app-soft mb-2 block">Amount to add</label>
          <div className="grid grid-cols-4 gap-2 mb-3">
            {PRESETS.map(p => (
              <button key={p} type="button" onClick={() => setAmount(p)}
                className="py-2 rounded-xl text-sm font-bold transition"
                style={amount === p
                  ? { background: "rgba(255,107,0,0.12)", border: "1.5px solid rgba(255,107,0,0.5)", color: "var(--app-primary)" }
                  : { background: "var(--app-surface-low)", border: "1px solid var(--app-border)", color: "var(--app-text)" }}>
                ₹{p.toLocaleString("en-IN")}
              </button>
            ))}
          </div>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-app-soft text-sm">₹</span>
            <input
              type="number" min={500} step={100}
              className="input w-full pl-8"
              value={amount}
              onChange={e => setAmount(e.target.value === "" ? "" : Math.max(0, parseInt(e.target.value, 10) || 0))}
            />
          </div>
          {tooSmall && <p className="text-xs text-red-500 mt-1">Minimum top-up is ₹500</p>}
        </div>

        {quote && (
          <div className="rounded-2xl px-4 py-3 space-y-2" style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)" }}>
            <div className="flex justify-between text-sm">
              <span className="text-app-soft">Credits added</span>
              <span className="text-app font-semibold">{rupees(quote.creditPaise)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-app-soft">GST ({quote.gstRate}%)</span>
              <span className="text-app font-semibold">{rupees(quote.gstPaise)}</span>
            </div>
            <div className="flex justify-between text-sm pt-2" style={{ borderTop: "1px solid var(--app-border)" }}>
              <span className="text-app font-bold">You pay</span>
              <span className="text-app font-bold">{rupees(quote.amountPaise)}</span>
            </div>
          </div>
        )}

        {balance?.ratesPaise && (
          <p className="text-xs text-app-soft flex items-start gap-1.5">
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>
              Replies cost {rupees(balance.ratesPaise.service)} each after your{" "}
              {balance.freeService?.limit?.toLocaleString("en-IN")} free monthly replies.
              Marketing messages are {rupees(balance.ratesPaise.marketing)} each.
            </span>
          </p>
        )}

        <button onClick={pay} disabled={busy || !quote || tooSmall}
          className="btn-primary w-full rounded-full py-3 text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          {busy ? "Opening payment…" : quote ? `Pay ${rupees(quote.amountPaise)}` : "Enter an amount"}
        </button>

        <p className="text-[11px] text-app-soft text-center">UPI, cards, net banking and wallets accepted.</p>
      </div>
    </Modal>
  );
}
