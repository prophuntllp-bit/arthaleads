// pages/Referrals.jsx — in-app referral page (CRM layout)
import { useState, useMemo, useEffect } from "react";
import {
  Gift, Copy, Check, Share2, MessageCircle, Mail,
  UserPlus, CreditCard, Sparkles, Users, Clock, Star,
  RefreshCw,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";

const STEPS = [
  { icon: Share2,    title: "Share your link",  desc: "Send your unique referral link to other real estate teams, brokers, or channel partners." },
  { icon: UserPlus,  title: "They sign up",     desc: "When they create an Arthaleads account using your link, we tag them as your referral." },
  { icon: CreditCard, title: "They subscribe",  desc: "Once they upgrade to any paid plan and complete their first payment, the reward unlocks." },
  { icon: Gift,      title: "You both earn",    desc: "You get 1 free month added to your plan — and they get 1 free month too. Everybody wins." },
];

const STATUS_META = {
  signed_up:      { label: "Signed Up",      color: "#6b7280", bg: "rgba(107,114,128,0.10)" },
  subscribed:     { label: "Subscribed",      color: "#22c55e", bg: "rgba(34,197,94,0.10)"  },
  reward_pending: { label: "Reward Pending",  color: "#f59e0b", bg: "rgba(245,158,11,0.10)" },
  rewarded:       { label: "Rewarded ✓",      color: "#ff6b00", bg: "rgba(255,107,0,0.10)"  },
};

function daysUntil(date) {
  const diff = new Date(date).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function timeAgo(date) {
  const diff = Date.now() - new Date(date).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30)  return `${days}d ago`;
  return new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export default function Referrals() {
  const { org, user } = useAuth();
  const [copied, setCopied]     = useState(false);
  const [calcCount, setCalcCount] = useState(3);
  const [referrals, setReferrals] = useState(null);
  const [loading, setLoading]   = useState(true);

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

  const fetchReferrals = async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/referrals/mine");
      setReferrals(data.data);
    } catch {
      setReferrals({ list: [], summary: { total: 0, subscribed: 0, rewarded: 0, rewardPending: 0 } });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReferrals(); }, []);

  const { list = [], summary = {} } = referrals || {};

  return (
    <div className="stitch-page space-y-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
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
        <button onClick={fetchReferrals} title="Refresh"
          className="p-2 rounded-xl text-app-soft hover:text-app transition-colors"
          style={{ border: "1px solid var(--app-border)" }}>
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* ── Summary stats ── */}
      {referrals && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Referred",    value: summary.total,        icon: Users,   color: "#6b7280" },
            { label: "Subscribed",        value: summary.subscribed,   icon: CreditCard, color: "#22c55e" },
            { label: "Reward Pending",    value: summary.rewardPending, icon: Clock,   color: "#f59e0b" },
            { label: "Rewards Earned",    value: summary.rewarded,     icon: Star,    color: "#ff6b00" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="card p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: `${color}15` }}>
                <Icon className="w-4 h-4" style={{ color }} />
              </div>
              <div>
                <p className="text-xl font-black text-app leading-none">{value ?? "—"}</p>
                <p className="text-[11px] text-app-soft mt-0.5">{label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Referral link + calculator ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

        {/* Referral link */}
        <div className="card p-5 space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4" style={{ color: "var(--app-primary)" }} />
              <span className="text-sm font-bold text-app">Your referral link</span>
            </div>
            <p className="text-xs text-app-soft">Share this link — when they subscribe you both get 1 free month.</p>
          </div>

          {code && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-app-soft">Your code:</span>
              <span className="px-2.5 py-1 rounded-lg text-sm font-black tracking-widest"
                style={{ background: "rgba(var(--app-primary-rgb),0.12)", color: "var(--app-primary)" }}>
                {code}
              </span>
            </div>
          )}

          <div className="flex items-stretch gap-2">
            <div className="flex-1 min-w-0 flex items-center px-3 py-2.5 rounded-xl text-xs truncate"
              style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)", color: "var(--app-text-soft,#6b7280)" }}>
              {link || "No link available"}
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

          {link && (
            <div className="flex gap-2">
              <button onClick={shareWhatsApp}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer hover:opacity-90 transition-opacity"
                style={{ background: "#25D366" }}>
                <MessageCircle className="w-4 h-4" /> WhatsApp
              </button>
              <button onClick={shareEmail}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold cursor-pointer transition-colors"
                style={{ border: "1px solid var(--app-border)", color: "var(--app-text,#111827)" }}>
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

      {/* ── My referrals list ── */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--app-border)" }}>
          <div>
            <p className="text-sm font-bold text-app">My Referrals</p>
            <p className="text-xs text-app-soft mt-0.5">Teams that signed up using your link</p>
          </div>
          {list.length > 0 && (
            <span className="text-xs font-bold px-2.5 py-1 rounded-full"
              style={{ background: "rgba(var(--app-primary-rgb),0.1)", color: "var(--app-primary)" }}>
              {list.length} team{list.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 gap-2 text-app-soft text-sm">
            <RefreshCw className="w-4 h-4 animate-spin" />
            Loading…
          </div>
        ) : list.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 gap-3">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{ background: "rgba(var(--app-primary-rgb),0.08)" }}>
              <Gift className="w-6 h-6" style={{ color: "var(--app-primary)" }} />
            </div>
            <p className="text-sm font-semibold text-app">No referrals yet</p>
            <p className="text-xs text-app-soft text-center max-w-xs">
              Share your referral link above. When someone signs up using your link, they'll appear here with their status.
            </p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: "var(--app-border)" }}>
            {list.map((r) => {
              const meta = STATUS_META[r.status] || STATUS_META.signed_up;
              return (
                <div key={r._id} className="flex items-center gap-4 px-5 py-4">
                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                    style={{ background: "var(--app-primary)" }}>
                    {r.name?.[0]?.toUpperCase()}
                  </div>

                  {/* Name + join date */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-app truncate">{r.name}</p>
                    <p className="text-xs text-app-soft">Joined {timeAgo(r.joinedAt)}</p>
                  </div>

                  {/* Plan */}
                  <span className="text-[11px] font-semibold capitalize hidden sm:block"
                    style={{ color: "var(--app-text-soft,#6b7280)" }}>
                    {r.plan === "trial" ? "Free Trial" : r.plan}
                  </span>

                  {/* Status + countdown */}
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap"
                      style={{ background: meta.bg, color: meta.color }}>
                      {meta.label}
                    </span>
                    {r.status === "reward_pending" && r.referralRewardAt && (
                      <span className="text-[10px] text-app-soft">
                        {daysUntil(r.referralRewardAt)}d remaining
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
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

    </div>
  );
}
