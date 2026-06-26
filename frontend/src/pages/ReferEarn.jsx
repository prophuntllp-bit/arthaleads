import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Gift, Copy, Check, Share2, MessageCircle, Mail, ArrowRight,
  UserPlus, CreditCard, Sparkles, Users,
} from "lucide-react";
import PublicNav from "../components/PublicNav";
import PublicFooter from "../components/PublicFooter";
import { usePublicTheme } from "../context/PublicThemeContext";
import { useAuth } from "../context/AuthContext";
import { useSEO } from "../utils/useSEO";

const STEPS = [
  { icon: Share2,   title: "Share your link",  desc: "Send your unique referral link to other real estate teams, brokers, or channel partners." },
  { icon: UserPlus, title: "They sign up",     desc: "When they create an Arthaleads account using your link, we tag them as your referral." },
  { icon: CreditCard, title: "They subscribe", desc: "Once they upgrade to any paid plan and complete their first payment, the reward unlocks." },
  { icon: Gift,     title: "You both earn",    desc: "You get 1 free month added to your plan — and they get 1 free month too. Everybody wins." },
];

// ── Interactive referral link box ─────────────────────────────────────────────
function ReferralBox() {
  const { isDark } = usePublicTheme();
  const { org, user } = useAuth();
  const [copied, setCopied] = useState(false);

  const code = useMemo(() => {
    if (org?._id) return String(org._id).slice(-6).toUpperCase();
    if (org?.name) return org.name.replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toUpperCase();
    return null;
  }, [org]);

  const link = code ? `https://arthaleads.com/signup?ref=${code}` : "";

  const cardBg = isDark ? "rgba(255,255,255,0.03)" : "#ffffff";
  const border = isDark ? "rgba(255,255,255,0.1)" : "#e5e7eb";
  const text   = isDark ? "#fff" : "#111827";
  const soft   = isDark ? "rgba(255,255,255,0.55)" : "#6b7280";

  const copy = () => {
    navigator.clipboard?.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareWhatsApp = () => {
    const msg = encodeURIComponent(`I use Arthaleads to manage my real estate leads — it's brilliant. Sign up with my link and we both get a free month: ${link}`);
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  };
  const shareEmail = () => {
    const subject = encodeURIComponent("Try Arthaleads CRM — we both get a free month");
    const body = encodeURIComponent(`Hi,\n\nI use Arthaleads to manage my real estate leads and thought you'd find it useful. Sign up with my link and we both get a free month:\n\n${link}\n\nCheers,\n${user?.name || ""}`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  // Logged-out state — invite them to sign in
  if (!code) {
    return (
      <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 16, padding: "2rem", textAlign: "center" }}>
        <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4" style={{ background: "rgba(255,107,0,0.1)" }}>
          <Gift className="w-6 h-6 text-[#ff6b00]" />
        </div>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: text, marginBottom: 8 }}>Get your referral link</h3>
        <p style={{ fontSize: 14, color: soft, marginBottom: 20, maxWidth: 360, marginInline: "auto" }}>
          Log in to your Arthaleads account to generate your unique referral link and start earning free months.
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Link to="/login" className="px-5 py-2.5 rounded-xl text-sm font-semibold" style={{ border: `1px solid ${border}`, color: text }}>Log In</Link>
          <Link to="/signup" className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#ff6b00] hover:bg-[#e05f00] transition-colors">Create Account</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 16, padding: "1.75rem" }}>
      <div className="flex items-center gap-2 mb-1.5">
        <Sparkles className="w-4 h-4 text-[#ff6b00]" />
        <span style={{ fontSize: 13, fontWeight: 700, color: text }}>Your referral link</span>
      </div>
      <p style={{ fontSize: 13, color: soft, marginBottom: 14 }}>Share this link. You both get a free month when they subscribe.</p>

      <div className="flex items-stretch gap-2 mb-4">
        <div style={{ flex: 1, minWidth: 0, padding: "12px 14px", borderRadius: 10, border: `1px solid ${border}`, background: isDark ? "rgba(255,255,255,0.05)" : "#f9fafb", color: text, fontSize: 13, display: "flex", alignItems: "center", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
          {link}
        </div>
        <button
          onClick={copy}
          className="flex items-center gap-2 px-4 rounded-xl text-sm font-semibold text-white cursor-pointer transition-colors"
          style={{ background: copied ? "#22c55e" : "#ff6b00" }}
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button onClick={shareWhatsApp} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer transition-opacity hover:opacity-90" style={{ background: "#25D366" }}>
          <MessageCircle className="w-4 h-4" /> WhatsApp
        </button>
        <button onClick={shareEmail} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold cursor-pointer transition-colors" style={{ border: `1px solid ${border}`, color: text }}>
          <Mail className="w-4 h-4" /> Email
        </button>
      </div>
    </div>
  );
}

// ── Interactive earnings calculator ───────────────────────────────────────────
function EarningsCalculator() {
  const { isDark } = usePublicTheme();
  const [count, setCount] = useState(3);

  const cardBg = isDark ? "rgba(255,255,255,0.03)" : "#ffffff";
  const border = isDark ? "rgba(255,255,255,0.1)" : "#e5e7eb";
  const text   = isDark ? "#fff" : "#111827";
  const soft   = isDark ? "rgba(255,255,255,0.55)" : "#6b7280";

  const months = count; // 1 free month per converted referral
  const capped = Math.min(months, 6); // matches the 6-month annual cap

  return (
    <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 16, padding: "1.75rem" }}>
      <h3 style={{ fontSize: 16, fontWeight: 700, color: text, marginBottom: 4 }}>How much can you earn?</h3>
      <p style={{ fontSize: 13, color: soft, marginBottom: 20 }}>Drag to see your free months based on how many teams you refer.</p>

      <div className="flex items-center justify-between mb-2">
        <span style={{ fontSize: 13, color: soft }}>Referrals who subscribe</span>
        <span style={{ fontSize: 20, fontWeight: 800, color: "#ff6b00" }}>{count}</span>
      </div>
      <input
        type="range" min="1" max="12" value={count}
        onChange={(e) => setCount(Number(e.target.value))}
        style={{ width: "100%", accentColor: "#ff6b00", cursor: "pointer" }}
      />

      <div className="mt-6 p-5 rounded-xl text-center" style={{ background: "rgba(255,107,0,0.08)", border: "1px solid rgba(255,107,0,0.2)" }}>
        <div style={{ fontSize: 13, color: soft, marginBottom: 4 }}>You could earn</div>
        <div style={{ fontSize: 32, fontWeight: 900, color: "#ff6b00" }}>{capped} free month{capped !== 1 ? "s" : ""}</div>
        {months > 6 && (
          <div style={{ fontSize: 12, color: soft, marginTop: 6 }}>
            (Capped at 6 free months per year — but keep referring, it resets annually!)
          </div>
        )}
      </div>
    </div>
  );
}

export default function ReferEarn() {
  const { isDark } = usePublicTheme();

  useSEO({
    title:       "Refer & Earn | Arthaleads Real Estate CRM",
    description: "Refer other real estate teams to Arthaleads and you both get a free month. Share your link, they subscribe, you earn. Simple, generous referral program.",
    canonical:   "https://www.arthaleads.com/refer",
  });

  const bg         = isDark ? "#0d0d1a" : "#ffffff";
  const altBg      = isDark ? "#080810" : "#f9fafb";
  const textColor  = isDark ? "#ffffff" : "#111827";
  const softText   = isDark ? "rgba(255,255,255,0.55)" : "#6b7280";
  const cardBg     = isDark ? "rgba(255,255,255,0.02)" : "#ffffff";
  const cardBorder = isDark ? "rgba(255,255,255,0.08)" : "#e5e7eb";

  return (
    <div className="min-h-screen" style={{ background: bg, color: textColor, fontFamily: "Inter, sans-serif" }}>
      <PublicNav />

      {/* Hero */}
      <section className="relative pt-32 pb-12 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[300px] rounded-full blur-3xl" style={{ background: "rgba(255,107,0,0.06)" }} />
        </div>
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border mb-6" style={{ borderColor: "rgba(255,107,0,0.30)", background: "rgba(255,107,0,0.10)" }}>
            <Gift className="w-3.5 h-3.5 text-[#ff6b00]" />
            <span className="text-[#ff6b00] text-xs font-semibold uppercase tracking-wide">Refer & Earn</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black mb-5" style={{ color: textColor }}>
            Give a month,{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff6b00] to-[#ffaa00]">get a month</span>
          </h1>
          <p className="text-lg max-w-xl mx-auto" style={{ color: softText }}>
            Love Arthaleads? Refer another real estate team. When they subscribe, you both get a free month.
            No limits on how many friends you invite.
          </p>
        </div>
      </section>

      {/* Referral box + calculator */}
      <section className="pb-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-2 gap-5">
          <ReferralBox />
          <EarningsCalculator />
        </div>
      </section>

      {/* How it works */}
      <section className="py-16" style={{ background: altBg }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-3" style={{ color: textColor }}>How it works</h2>
            <p className="text-base max-w-lg mx-auto" style={{ color: softText }}>Four simple steps from sharing to earning.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {STEPS.map((s, i) => (
              <div key={s.title} className="p-6 rounded-2xl relative" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
                <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4" style={{ background: "rgba(255,107,0,0.1)" }}>
                  <s.icon className="w-5 h-5 text-[#ff6b00]" />
                </div>
                <div className="absolute top-5 right-5 text-2xl font-black" style={{ color: isDark ? "rgba(255,255,255,0.08)" : "#f3f4f6" }}>{i + 1}</div>
                <h3 className="font-semibold text-sm mb-2" style={{ color: textColor }}>{s.title}</h3>
                <p className="text-xs leading-relaxed" style={{ color: softText }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Terms */}
      <section className="py-16" style={{ background: bg }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 mb-6">
            <Users className="w-5 h-5 text-[#ff6b00]" />
            <h2 className="text-xl font-bold" style={{ color: textColor }}>Program terms</h2>
          </div>
          <ul className="space-y-3">
            {[
              "Both the referrer and the referred organisation receive 1 free month, credited after the referred org completes its first paid subscription.",
              "Rewards are issued as account credit (free months) — they are not redeemable for cash.",
              "The referred organisation must be a new Arthaleads account, not an existing or previously paid customer.",
              "A maximum of 6 free months can be earned per organisation per calendar year. This resets every year.",
              "Referral links must not be used in paid advertising (Google/Facebook ads) or spam.",
              "Arthaleads reserves the right to withhold rewards for fraudulent or abusive referrals.",
            ].map((t) => (
              <li key={t} className="flex items-start gap-3">
                <Check className="w-4 h-4 text-[#ff6b00] flex-shrink-0 mt-0.5" />
                <span className="text-sm leading-relaxed" style={{ color: softText }}>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16" style={{ background: altBg }}>
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl font-bold mb-3" style={{ color: textColor }}>Start earning today</h2>
          <p className="text-base mb-6" style={{ color: softText }}>Log in to grab your link, or create an account to join the program.</p>
          <Link to="/signup" className="inline-flex items-center gap-2 bg-[#ff6b00] hover:bg-[#e05f00] text-white font-bold px-6 py-3 rounded-xl transition-all duration-200 shadow-lg shadow-orange-500/25">
            Get Started Free
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
