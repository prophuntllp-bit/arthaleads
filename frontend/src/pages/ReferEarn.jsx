// pages/ReferEarn.jsx - /refer on the shared marketing theme (components/site/*).
// The referral link is built from the signed-in org (useAuth); logged-out
// visitors see a log in / sign up card. Share buttons only touch window on click.
import { useState, useMemo } from "react";
import { CRM_LOGIN_URL, CRM_SIGNUP_URL, CRM_LINK_PROPS } from "../utils/crmLinks";
import {
  Gift, Copy, Check, Share2, Mail,
  UserPlus, CreditCard, Sparkles, Users,
} from "lucide-react";
import { SitePage, Section, Container, SectionHeader, Card, SiteButton } from "../components/site/Site";
import { PageHero, ClosingCta } from "../components/site/Blocks";
import { WhatsAppLogo } from "../components/site/BrandLogos";
import { Reveal } from "../components/motion/Motion";
import { useAuth } from "../context/AuthContext";
import { useSEO } from "../utils/useSEO";

const STEPS = [
  { icon: Share2,   title: "Share your link",  desc: "Send your unique referral link to other real estate teams, brokers, or channel partners." },
  { icon: UserPlus, title: "They sign up",     desc: "When they create an Arthaleads account using your link, we tag them as your referral." },
  { icon: CreditCard, title: "They subscribe", desc: "Once they upgrade to any paid plan and complete their first payment, the reward unlocks." },
  { icon: Gift,     title: "You both earn",    desc: "You get 1 free month added to your plan, and they get 1 free month too. Everybody wins." },
];

const TERMS = [
  "Both the referrer and the referred organisation receive 1 free month, credited after the referred org completes its first paid subscription.",
  "Rewards are issued as account credit (free months) — they are not redeemable for cash.",
  "The referred organisation must be a new Arthaleads account, not an existing or previously paid customer.",
  "A maximum of 6 free months can be earned per organisation per calendar year. This resets every year.",
  "Referral links must not be used in paid advertising (Google/Facebook ads) or spam.",
  "Arthaleads reserves the right to withhold rewards for fraudulent or abusive referrals.",
];

const iconTile = { background: "rgba(255,107,0,0.10)", boxShadow: "inset 0 0 0 1px rgba(255,107,0,0.22)" };
const brandInk = { color: "var(--site-brand-ink)" };

// ── Interactive referral link box ─────────────────────────────────────────────
function ReferralBox() {
  const { org, user } = useAuth();
  const [copied, setCopied] = useState(false);

  const code = useMemo(() => {
    if (org?._id) return String(org._id).slice(-6).toUpperCase();
    if (org?.name) return org.name.replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toUpperCase();
    return null;
  }, [org]);

  const link = code ? `https://app.arthaleads.com/signup?ref=${code}` : "";

  const copy = () => {
    navigator.clipboard?.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareWhatsApp = () => {
    const msg = encodeURIComponent(`I use Arthaleads to manage my real estate leads. It's brilliant. Sign up with my link and we both get a free month: ${link}`);
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  };
  const shareEmail = () => {
    const subject = encodeURIComponent("Try Arthaleads CRM: we both get a free month");
    const body = encodeURIComponent(`Hi,\n\nI use Arthaleads to manage my real estate leads and thought you'd find it useful. Sign up with my link and we both get a free month:\n\n${link}\n\nCheers,\n${user?.name || ""}`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  // Logged-out state: invite them to sign in
  if (!code) {
    return (
      <Card raised className="h-full p-6 sm:p-8 text-center flex flex-col items-center justify-center">
        <span className="site-icon w-12 h-12 rounded-xl flex items-center justify-center mb-5" style={iconTile}>
          <Gift className="w-[22px] h-[22px]" style={brandInk} aria-hidden="true" />
        </span>
        <h2 className="font-display text-xl font-bold site-ink mb-2">Get your referral link</h2>
        <p className="text-[15px] leading-relaxed mb-6 max-w-sm">
          Log in to your Arthaleads account to generate your unique referral link and start earning free months.
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <SiteButton href={CRM_LOGIN_URL} {...CRM_LINK_PROPS} variant="secondary">Log In</SiteButton>
          <SiteButton href={CRM_SIGNUP_URL} {...CRM_LINK_PROPS}>Create Account</SiteButton>
        </div>
      </Card>
    );
  }

  return (
    <Card raised className="h-full p-6 sm:p-7">
      <div className="flex items-center gap-2 mb-1.5">
        <Sparkles className="w-4 h-4" style={brandInk} aria-hidden="true" />
        <h2 className="font-display text-[15px] font-bold site-ink">Your referral link</h2>
      </div>
      <p className="text-[14px] leading-relaxed mb-4">Share this link. You both get a free month when they subscribe.</p>

      <div className="flex items-stretch gap-2 mb-4">
        <div className="flex-1 min-w-0 flex items-center rounded-2xl px-4 py-3 text-[13px]"
          style={{ background: "var(--site-bg)", border: "1px solid var(--site-line-strong)", color: "var(--site-ink)" }}>
          <span className="truncate">{link}</span>
        </div>
        <SiteButton onClick={copy} className="shrink-0" style={copied ? { background: "#15803d" } : undefined}>
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          {copied ? "Copied" : "Copy"}
        </SiteButton>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <SiteButton variant="whatsapp" onClick={shareWhatsApp}>
          <WhatsAppLogo className="w-[18px] h-[18px]" color="#fff" /> WhatsApp
        </SiteButton>
        <SiteButton variant="secondary" onClick={shareEmail}>
          <Mail className="w-4 h-4" /> Email
        </SiteButton>
      </div>
    </Card>
  );
}

// ── Interactive earnings calculator ───────────────────────────────────────────
function EarningsCalculator() {
  const [count, setCount] = useState(3);

  const months = count; // 1 free month per converted referral
  const capped = Math.min(months, 6); // matches the 6-month annual cap

  return (
    <Card raised className="h-full p-6 sm:p-7">
      <h2 className="font-display text-[17px] font-bold site-ink mb-1">How much can you earn?</h2>
      <p className="text-[14px] leading-relaxed mb-5">Drag to see your free months based on how many teams you refer.</p>

      <div className="flex items-center justify-between mb-2">
        <label htmlFor="ref-count" className="text-[13px] site-muted">Referrals who subscribe</label>
        <span className="font-display text-xl font-extrabold" style={brandInk}>{count}</span>
      </div>
      <input
        id="ref-count"
        type="range" min="1" max="12" value={count}
        onChange={(e) => setCount(Number(e.target.value))}
        className="w-full cursor-pointer"
        style={{ accentColor: "#ff6b00" }}
      />

      <div className="mt-6 p-5 rounded-2xl text-center" style={{ background: "rgba(255,107,0,0.08)", boxShadow: "inset 0 0 0 1px rgba(255,107,0,0.22)" }}>
        <p className="text-[13px] site-muted mb-1">You could earn</p>
        <p className="font-display text-[30px] sm:text-[32px] font-extrabold leading-tight"><span className="site-dim">{capped} free month{capped !== 1 ? "s" : ""}</span></p>
        {months > 6 && (
          <p className="text-xs site-muted mt-1.5">
            (Capped at 6 free months per year, but keep referring: it resets annually!)
          </p>
        )}
      </div>
    </Card>
  );
}

export default function ReferEarn() {
  useSEO({
    title:       "Refer & Earn | Arthaleads Real Estate CRM",
    description: "Refer other real estate teams to Arthaleads and you both get a free month. Share your link, they subscribe, you earn. Simple, generous referral program.",
    canonical:   "https://www.arthaleads.com/refer",
  });

  return (
    <SitePage>
      <PageHero
        eyebrow="Refer and earn"
        title={<>Give a month, <span className="site-dim">get a month</span></>}
        lede="Love Arthaleads? Refer another real estate team. When they subscribe, you both get a free month. No limits on how many friends you invite."
        actions={[
          { label: "Get your referral link", href: "#refer" },
          { label: "How it works", href: "#how-it-works" },
        ]}
        trust={["A free month for you", "A free month for them"]}
      />

      {/* Referral box + calculator */}
      <Section tone="tint" id="refer" className="!pt-12 sm:!pt-16">
        <Container className="!max-w-[960px] grid md:grid-cols-2 gap-4 sm:gap-5 items-stretch">
          <Reveal className="min-w-0"><ReferralBox /></Reveal>
          <Reveal delay={100} className="min-w-0"><EarningsCalculator /></Reveal>
        </Container>
      </Section>

      {/* How it works */}
      <Section tone="white" id="how-it-works">
        <Container>
          <SectionHeader eyebrow="Four steps" title="How it works" align="center"
            lede="Four simple steps from sharing to earning." />
          <ol className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {STEPS.map((s, i) => (
              <Reveal as="li" key={s.title} delay={i * 80} className="min-w-0 flex">
                <Card glow className="w-full p-6">
                  <div className="flex items-center justify-between mb-5">
                    <span className="font-display w-10 h-10 rounded-full flex items-center justify-center text-base font-extrabold text-white"
                      style={{ background: "var(--brand-btn)", boxShadow: "0 12px 26px -12px rgba(204,75,0,0.7)" }}>{i + 1}</span>
                    <span className="site-icon w-10 h-10 rounded-xl flex items-center justify-center" style={iconTile}>
                      <s.icon className="w-5 h-5" style={brandInk} aria-hidden="true" />
                    </span>
                  </div>
                  <h3 className="font-display text-lg font-bold site-ink mb-2">{s.title}</h3>
                  <p className="text-[15px] leading-relaxed">{s.desc}</p>
                </Card>
              </Reveal>
            ))}
          </ol>
        </Container>
      </Section>

      {/* Terms */}
      <Section tone="tint">
        <Container narrow>
          <Reveal>
            <Card raised className="p-6 sm:p-9">
              <div className="flex items-center gap-3 mb-6">
                <span className="site-icon w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={iconTile}>
                  <Users className="w-5 h-5" style={brandInk} aria-hidden="true" />
                </span>
                <h2 className="font-display text-xl sm:text-2xl font-bold site-ink">Program terms</h2>
              </div>
              <ul className="space-y-3.5">
                {TERMS.map((t) => (
                  <li key={t} className="flex items-start gap-3">
                    <Check className="w-4 h-4 shrink-0 mt-1" style={{ color: "#16a34a" }} aria-hidden="true" />
                    <span className="text-[15px] leading-relaxed">{t}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </Reveal>
        </Container>
      </Section>

      <ClosingCta title="Start earning" dim="today."
        body="Log in to grab your link, or create an account to join the program." />
    </SitePage>
  );
}
