import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Check, Zap, Users, Target, ChevronDown, ArrowRight, Sparkles } from "lucide-react";
import PublicNav from "../components/PublicNav";
import PublicFooter from "../components/PublicFooter";
import { usePublicTheme } from "../context/PublicThemeContext";
import { useSEO } from "../utils/useSEO";

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    tagline: "For solo brokers and small channel partner teams",
    color: "#3b82f6",
    maxMembers: 3,
    userLimit: "Up to 3 members",
    groups: [
      { label: "Lead Management", items: [
        "Unlimited lead imports (CSV / Excel)",
        "Lead pipeline - Kanban (6 stages)",
        "Follow-up scheduling & reminders",
        "Lead source tracking",
        "Push notifications & new lead alerts",
      ] },
      { label: "Integrations", items: [
        "Facebook Lead Ads auto-import",
        "WhatsApp capture",
        "Website / WordPress plugin",
      ] },
      { label: "Support", items: ["Email support"] },
    ],
    cta: "Get Started",
    ctaAction: "contact",
  },
  {
    id: "growth",
    name: "Growth",
    tagline: "For active real estate teams that need automation and insights",
    color: "#ff6b00",
    popular: true,
    maxMembers: 20,
    userLimit: "Up to 20 members",
    groups: [
      { label: "Everything in Starter, plus", items: [
        "Multiple project pipelines",
        "Duplicate lead detection",
        "Auto round-robin lead assignment",
        "Bulk lead export",
        "Campaign routing rules",
      ] },
      { label: "Team & Roles", items: [
        "Role-based access (Admin / Manager / Agent)",
        "Attendance tracking",
        "Team performance dashboard",
      ] },
      { label: "Analytics", items: [
        "Advanced analytics & conversion reports",
        "Booking rate & call-back metrics",
        "Individual agent response tracking",
      ] },
      { label: "Support", items: ["Priority support"] },
    ],
    cta: "Start Free Trial",
    ctaAction: "signup",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    tagline: "For large developers, franchise networks and multi-branch orgs",
    color: "#a855f7",
    maxMembers: Infinity,
    userLimit: "Unlimited members",
    groups: [
      { label: "Everything in Growth, plus", items: [
        "Google Ads integration",
        "Custom webhook & API access",
        "Multi-org management",
        "Advanced automation management",
      ] },
      { label: "Customisation", items: [
        "Custom branding & white-label",
        "Custom reporting",
        "On-site onboarding & training",
      ] },
      { label: "Account", items: [
        "Dedicated account manager",
        "SLA-backed uptime",
      ] },
    ],
    cta: "Contact Sales",
    ctaAction: "contact",
  },
];

const FAQS = [
  ["Is there a free trial?", "Yes. The Growth plan comes with a 14-day free trial that includes every Growth feature. No credit card is required, and you can upgrade or cancel anytime."],
  ["How is pricing calculated?", "Pricing is tailored to your team size and the plan you choose. Use the team-size slider above to see which plan fits, then contact us for exact numbers - there are no hidden fees."],
  ["Can I change plans later?", "Absolutely. You can upgrade or downgrade at any time. When you upgrade, you get instant access to the new features; when you downgrade, the change applies from your next billing cycle."],
  ["What happens to my data if I cancel?", "Your data stays yours. You can export all your leads as CSV or Excel at any time. After cancellation we retain your data per our Refund & Cancellation Policy before secure deletion."],
  ["Do you offer annual billing discounts?", "Yes. Switching to annual billing gives you roughly two months free compared to paying monthly. Toggle the billing switch above to see the effective saving."],
  ["Which payment methods do you accept?", "We accept all major credit/debit cards, UPI, and net banking for Indian businesses. Enterprise customers can also pay via invoice."],
];

export default function Pricing() {
  const { isDark } = usePublicTheme();
  const [annual, setAnnual]   = useState(true);
  const [members, setMembers] = useState(5);
  const [hovered, setHovered] = useState(null);
  const [openFaq, setOpenFaq] = useState(null);

  useSEO({
    title:       "Pricing | Arthaleads Real Estate CRM Plans",
    description: "Simple, transparent pricing for Arthaleads. Starter, Growth, and Enterprise plans for real estate teams of every size. 14-day free trial, no credit card required.",
    canonical:   "https://www.arthaleads.com/pricing",
  });

  const bg         = isDark ? "#0d0d1a" : "#ffffff";
  const altBg      = isDark ? "#080810" : "#f9fafb";
  const heading    = isDark ? "#ffffff" : "#111827";
  const body       = isDark ? "rgba(255,255,255,0.55)" : "#6b7280";
  const cardBg     = isDark ? "rgba(255,255,255,0.025)" : "#ffffff";
  const cardBdr    = isDark ? "rgba(255,255,255,0.06)" : "#e5e7eb";
  const popBg      = isDark ? "rgba(255,107,0,0.05)" : "#fffbf7";
  const taglineClr = isDark ? "rgba(255,255,255,0.38)" : "#9ca3af";
  const divBdr     = isDark ? "rgba(255,255,255,0.06)" : "#e5e7eb";
  const grpLabel   = isDark ? "rgba(255,255,255,0.28)" : "#9ca3af";
  const featClr    = isDark ? "rgba(255,255,255,0.72)" : "#374151";
  const altBtnClr  = isDark ? "rgba(255,255,255,0.70)" : "#374151";
  const altBtnBdr  = isDark ? "rgba(255,255,255,0.10)" : "#d1d5db";
  const trialBg    = isDark ? "rgba(34,197,94,0.1)" : "#f0fdf4";
  const trialBdr   = isDark ? "rgba(34,197,94,0.25)" : "#bbf7d0";
  const toggleTrack= isDark ? "rgba(255,255,255,0.10)" : "#e5e7eb";

  // Interactive: which plan does the chosen team size land in?
  const recommended = useMemo(() => {
    if (members <= 3)  return "starter";
    if (members <= 20) return "growth";
    return "enterprise";
  }, [members]);

  return (
    <div className="min-h-screen" style={{ background: bg, color: heading, fontFamily: "Inter, sans-serif" }}>
      <PublicNav />

      {/* Hero */}
      <section className="relative pt-32 pb-8 overflow-hidden">
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border mb-6"
            style={{ borderColor: "rgba(255,107,0,0.30)", background: "rgba(255,107,0,0.10)" }}>
            <Target className="w-3.5 h-3.5 text-[#ff6b00]" />
            <span className="text-[#ff6b00] text-xs font-semibold uppercase tracking-wide">Pricing Plans</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black mb-4" style={{ color: heading }}>
            Plans for every{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff6b00] to-[#ffaa00]">team size</span>
          </h1>
          <p className="text-base max-w-lg mx-auto" style={{ color: body }}>
            No hidden fees. Pricing tailored to your team - contact us for exact numbers.
          </p>
        </div>
      </section>

      {/* Interactive controls */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-4">
        {/* Billing toggle */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <span className="text-sm font-semibold" style={{ color: annual ? body : heading }}>Monthly</span>
          <button
            type="button"
            role="switch"
            aria-checked={annual}
            aria-label="Toggle annual billing"
            onClick={() => setAnnual((v) => !v)}
            className="relative w-14 h-7 rounded-full transition-colors duration-200 cursor-pointer flex-shrink-0"
            style={{ background: annual ? "#ff6b00" : toggleTrack }}
          >
            <span
              className="absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200"
              style={{ transform: annual ? "translateX(28px)" : "translateX(0)" }}
            />
          </button>
          <span className="text-sm font-semibold" style={{ color: annual ? heading : body }}>
            Annual
          </span>
          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold"
            style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e" }}>
            Save ~2 months
          </span>
        </div>

        {/* Team-size slider */}
        <div className="rounded-2xl border p-5 sm:p-6 mb-10"
          style={{ background: cardBg, borderColor: cardBdr }}>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-[#ff6b00]" />
              <p className="text-sm font-semibold" style={{ color: heading }}>
                How big is your team?
              </p>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-[#ff6b00]">
                {members >= 50 ? "50+" : members}
              </span>
              <span className="text-sm" style={{ color: body }}>members</span>
            </div>
          </div>

          <input
            type="range"
            min={1}
            max={50}
            value={members}
            onChange={(e) => setMembers(Number(e.target.value))}
            className="w-full accent-[#ff6b00] cursor-pointer"
            aria-label="Team size"
          />
          <div className="flex justify-between mt-1.5 text-[11px]" style={{ color: taglineClr }}>
            <span>1</span><span>10</span><span>20</span><span>30</span><span>40</span><span>50+</span>
          </div>

          <p className="mt-4 text-sm" style={{ color: body }}>
            Recommended plan:{" "}
            <span className="font-bold" style={{ color: PLANS.find((p) => p.id === recommended).color }}>
              {PLANS.find((p) => p.id === recommended).name}
            </span>
          </p>
        </div>

        {/* Free trial banner */}
        <div className="flex items-center justify-center mb-10">
          <div className="inline-flex items-center gap-3 px-5 py-3 rounded-2xl border"
            style={{ background: trialBg, borderColor: trialBdr }}>
            <div className="w-7 h-7 rounded-full bg-[#22c55e] flex items-center justify-center flex-shrink-0">
              <Check className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold" style={{ color: isDark ? "#4ade80" : "#15803d" }}>
                14-day free trial - includes all Growth features
              </p>
              <p className="text-xs" style={{ color: isDark ? "rgba(74,222,128,0.6)" : "#16a34a" }}>
                No credit card required. Upgrade or cancel anytime.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Plan cards */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
          {PLANS.map((plan) => {
            const isHovered = hovered === plan.id;
            const isPopular = plan.popular;
            const isReco    = recommended === plan.id;
            return (
              <div key={plan.id}
                className="relative flex flex-col rounded-2xl transition-all duration-300 overflow-hidden"
                style={{
                  background: isPopular ? popBg : cardBg,
                  border: isReco
                    ? `1.5px solid ${plan.color}`
                    : isPopular
                      ? "1.5px solid rgba(255,107,0,0.4)"
                      : `1px solid ${isHovered ? plan.color + "60" : cardBdr}`,
                  boxShadow: isReco
                    ? `0 16px 50px ${plan.color}26`
                    : isPopular
                      ? "0 20px 60px rgba(255,107,0,0.12)"
                      : isHovered ? `0 8px 30px ${plan.color}18` : "none",
                  transform: isPopular ? "translateY(-6px)" : isHovered ? "translateY(-3px)" : "none",
                }}
                onMouseEnter={() => setHovered(plan.id)}
                onMouseLeave={() => setHovered(null)}>

                {/* Top color bar */}
                <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${plan.color}, ${plan.color}88)` }} />

                {/* Badge */}
                {(isReco || isPopular) && (
                  <div className="absolute top-4 right-4">
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide shadow text-white"
                      style={{ background: isReco ? plan.color : "#ff6b00" }}>
                      {isReco ? "Your match" : "Most Popular"}
                    </span>
                  </div>
                )}

                <div className="p-6 flex flex-col flex-1">
                  {/* Plan header */}
                  <div className="mb-5">
                    <div className="flex items-center gap-2.5 mb-1.5">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: `${plan.color}18` }}>
                        <Zap className="w-4 h-4" style={{ color: plan.color }} />
                      </div>
                      <h2 className="font-black text-xl" style={{ color: heading }}>{plan.name}</h2>
                    </div>
                    <p className="text-xs leading-relaxed mt-1" style={{ color: taglineClr }}>{plan.tagline}</p>
                  </div>

                  {/* User limit pill */}
                  <div className="inline-flex items-center gap-2 self-start px-3 py-1.5 rounded-lg mb-5"
                    style={{ background: `${plan.color}12`, border: `1px solid ${plan.color}25` }}>
                    <Users className="w-3 h-3" style={{ color: plan.color }} />
                    <span className="text-xs font-semibold" style={{ color: plan.color }}>{plan.userLimit}</span>
                  </div>

                  {/* Pricing */}
                  <div className="flex items-center gap-2 mb-5 pb-5" style={{ borderBottom: `1px solid ${divBdr}` }}>
                    <span className="text-sm" style={{ color: body }}>
                      {annual ? "Annual billing - " : "Monthly billing - "}pricing on request
                    </span>
                  </div>

                  {/* Feature groups */}
                  <div className="flex flex-col gap-4 flex-1 mb-6">
                    {plan.groups.map((group) => (
                      <div key={group.label}>
                        <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: grpLabel }}>
                          {group.label}
                        </p>
                        <ul className="space-y-1.5">
                          {group.items.map((item) => (
                            <li key={item} className="flex items-start gap-2">
                              <div className="flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center mt-0.5"
                                style={{ background: `${plan.color}18` }}>
                                <Check className="w-2.5 h-2.5" style={{ color: plan.color }} />
                              </div>
                              <span className="text-xs leading-relaxed" style={{ color: featClr }}>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>

                  {/* CTA */}
                  {plan.ctaAction === "signup" ? (
                    <Link
                      to="/signup"
                      className="w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200 text-center"
                      style={{ background: "#ff6b00", color: "#fff", boxShadow: "0 4px 20px rgba(255,107,0,0.3)" }}
                    >
                      {plan.cta}
                    </Link>
                  ) : (
                    <Link
                      to="/contact"
                      className="w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200 text-center"
                      style={{ border: `1px solid ${altBtnBdr}`, color: altBtnClr, background: "transparent" }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = plan.color; e.currentTarget.style.color = plan.color; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = altBtnBdr; e.currentTarget.style.color = altBtnClr; }}
                    >
                      {plan.cta}
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Compare link */}
        <div className="text-center mt-8">
          <Link to="/compare" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#ff6b00] hover:underline">
            See how we compare to other CRMs <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-14" style={{ background: altBg }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border mb-4"
              style={{ borderColor: "rgba(255,107,0,0.30)", background: "rgba(255,107,0,0.10)" }}>
              <Sparkles className="w-3.5 h-3.5 text-[#ff6b00]" />
              <span className="text-[#ff6b00] text-xs font-semibold uppercase tracking-wide">FAQ</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black" style={{ color: heading }}>
              Pricing questions, answered
            </h2>
          </div>

          <div className="space-y-3">
            {FAQS.map(([q, a], i) => {
              const open = openFaq === i;
              return (
                <div key={i} className="rounded-2xl border overflow-hidden"
                  style={{ background: cardBg, borderColor: cardBdr }}>
                  <button
                    type="button"
                    onClick={() => setOpenFaq(open ? null : i)}
                    className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left"
                    aria-expanded={open}
                  >
                    <span className="text-sm font-semibold" style={{ color: heading }}>{q}</span>
                    <ChevronDown
                      className="w-4 h-4 shrink-0 transition-transform duration-200"
                      style={{ color: "#ff6b00", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
                    />
                  </button>
                  {open && (
                    <p className="px-5 pb-4 text-sm leading-relaxed" style={{ color: body }}>{a}</p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Bottom CTA */}
          <div className="text-center mt-10">
            <p className="text-sm mb-4" style={{ color: body }}>Still have questions about pricing?</p>
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm text-white transition-all duration-200 hover:-translate-y-0.5"
              style={{ background: "#ff6b00", boxShadow: "0 4px 20px rgba(255,107,0,0.3)" }}
            >
              Talk to our team <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
