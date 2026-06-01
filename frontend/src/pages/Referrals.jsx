// pages/Referrals.jsx — in-app referral page (CRM layout, no PublicNav)
import { useState, useMemo } from "react";
import {
  Gift, Copy, Check, Share2, MessageCircle, Mail,
  UserPlus, CreditCard, Sparkles, Users,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

const STEPS = [
  { icon: Share2,    title: "Share your link",  desc: "Send your unique referral link to other real estate teams, brokers, or channel partners." },
  { icon: UserPlus,  title: "They sign up",     desc: "When they create an Arthaleads account using your link, we tag them as your referral." },
  { icon: CreditCard, title: "They subscribe",  desc: "Once they upgrade to any paid plan and complete their first payment, the reward unlocks." },
  { icon: Gift,      title: "You both earn",    desc: "You get 1 free month added to your plan — and they get 1 free month too. Everybody wins." },
];

export default function Referrals() {
  const { org, user } = useAuth();
  const [copied, setCopied]   = useState(false);
  const [calcCount, setCalcCount] = useState(3);

  const code = useMemo(() => {
    if (org?._id)  return String(org._id).slice(-6).toUpperCase();
    if (org?.name) return org.name.replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toUpperCase();
    return null;
  }, [org]);

  const link = code ? `https://arthaleads.com/signup?ref=${code}` : "";

  const copy = () => {
    navigator.clipboard?.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareWhatsApp = () => {
    const msg = encodeURIComponent(
      `I use Arthaleads to manage my real estate leads — it's brilliant. Sign up with my link and we both get a free month: ${link}`
    );
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  };

  const shareEmail = () => {
    const subject = encodeURIComponent("Try Arthaleads CRM — we both get a free month");
    const body    = encodeURIComponent(
      `Hi,\n\nI use Arthaleads to manage my real estate leads and thought you'd find it useful.\nSign up with my link and we both get a free month:\n\n${link}\n\nCheers,\n${user?.name || ""}`
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const earnedMonths = Math.min(calcCount, 6);

  return (
    <div className="stitch-page space-y-6">

      {/* ── Header ── */}
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(var(--app-primary-rgb),0.12)" }}>
          <Gift className="w-5 h-5" style={{ color: "var(--app-primary)" }} />
        </div>
        <div>
          <h1 className="text-xl font-black text-app leading-tight">Refer &amp; Earn</h1>
          <p className="text-sm text-app-soft mt-0.5">
            Invite real estate teams — you both get a free month when they subscribe.
          </p>
        </div>
      </div>

      {/* ── Referral link + calculator ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

        {/* Referral link card */}
        <div className="card p-5 space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4" style={{ color: "var(--app-primary)" }} />
              <span className="text-sm font-bold text-app">Your referral link</span>
            </div>
            <p className="text-xs text-app-soft">
              Share this link. When someone subscribes using it, you both get 1 free month.
            </p>
          </div>

          {/* Referral code badge */}
          {code && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-app-soft">Your code:</span>
              <span className="px-2.5 py-1 rounded-lg text-sm font-black tracking-widest"
                style={{ background: "rgba(var(--app-primary-rgb),0.12)", color: "var(--app-primary)" }}>
                {code}
              </span>
            </div>
          )}

          {/* Link input + copy */}
          <div className="flex items-stretch gap-2">
            <div className="flex-1 min-w-0 flex items-center px-3 py-2.5 rounded-xl text-xs truncate"
              style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)", color: "var(--app-text-soft, #6b7280)" }}>
              {link || "Sign in to generate your link"}
            </div>
            {link && (
              <button onClick={copy}
                className="flex items-center gap-1.5 px-4 rounded-xl text-sm font-semibold text-white cursor-pointer transition-colors flex-shrink-0"
                style={{ background: copied ? "#22c55e" : "var(--app-primary)" }}>
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? "Copied!" : "Copy"}
              </button>
            )}
          </div>

          {/* Share buttons */}
          {link && (
            <div className="flex gap-2">
              <button onClick={shareWhatsApp}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer hover:opacity-90 transition-opacity"
                style={{ background: "#25D366" }}>
                <MessageCircle className="w-4 h-4" /> WhatsApp
              </button>
              <button onClick={shareEmail}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold cursor-pointer transition-colors"
                style={{ border: "1px solid var(--app-border)", color: "var(--app-text, #111827)" }}>
                <Mail className="w-4 h-4" /> Email
              </button>
            </div>
          )}
        </div>

        {/* Earnings calculator */}
        <div className="card p-5 space-y-4">
          <div>
            <p className="text-sm font-bold text-app mb-0.5">How much can you earn?</p>
            <p className="text-xs text-app-soft">Drag to estimate free months based on referrals who subscribe.</p>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-app-soft">Referrals who subscribe</span>
            <span className="text-2xl font-black" style={{ color: "var(--app-primary)" }}>{calcCount}</span>
          </div>
          <input type="range" min="1" max="12" value={calcCount}
            onChange={(e) => setCalcCount(Number(e.target.value))}
            className="w-full cursor-pointer"
            style={{ accentColor: "var(--app-primary)" }} />

          <div className="p-4 rounded-xl text-center"
            style={{ background: "rgba(var(--app-primary-rgb),0.08)", border: "1px solid rgba(var(--app-primary-rgb),0.2)" }}>
            <p className="text-xs text-app-soft mb-1">You could earn</p>
            <p className="text-3xl font-black" style={{ color: "var(--app-primary)" }}>
              {earnedMonths} free month{earnedMonths !== 1 ? "s" : ""}
            </p>
            {calcCount > 6 && (
              <p className="text-[11px] text-app-soft mt-1.5">Capped at 6 per year — resets annually</p>
            )}
          </div>
        </div>
      </div>

      {/* ── How it works ── */}
      <div className="card p-5">
        <p className="text-sm font-bold text-app mb-4">How it works</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {STEPS.map((s, i) => (
            <div key={s.title} className="relative p-4 rounded-2xl"
              style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)" }}>
              <div className="absolute top-3 right-3 text-2xl font-black select-none"
                style={{ color: "rgba(var(--app-primary-rgb),0.08)" }}>{i + 1}</div>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
                style={{ background: "rgba(var(--app-primary-rgb),0.1)" }}>
                <s.icon className="w-4 h-4" style={{ color: "var(--app-primary)" }} />
              </div>
              <p className="text-xs font-bold text-app mb-1">{s.title}</p>
              <p className="text-xs text-app-soft leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Program terms ── */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-4 h-4" style={{ color: "var(--app-primary)" }} />
          <p className="text-sm font-bold text-app">Program terms</p>
        </div>
        <ul className="space-y-2.5">
          {[
            "Both the referrer and the referred organisation receive 1 free month, credited after the referred org completes its first paid subscription.",
            "Rewards are issued as account credit (free months) — not redeemable for cash.",
            "The referred organisation must be a new Arthaleads account, not an existing or previously paid customer.",
            "Maximum 6 free months per organisation per calendar year. Resets annually.",
            "Referral links must not be used in paid advertising (Google/Facebook Ads) or spam.",
            "Arthaleads reserves the right to withhold rewards for fraudulent or abusive referrals.",
          ].map((t) => (
            <li key={t} className="flex items-start gap-2.5">
              <Check className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: "var(--app-primary)" }} />
              <span className="text-xs text-app-soft leading-relaxed">{t}</span>
            </li>
          ))}
        </ul>
      </div>

    </div>
  );
}
