import { useEffect, useState } from "react";
import { Check, Zap, Users, Star, MessageCircle, Mail, ArrowRight, Lock, Shield, Facebook, Bell, Layers } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { canAccess, planLabel, planLevel, upgradeTarget, PLAN_PRICING, formatINR } from "../utils/plan";

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    color: "#3b82f6",
    userLimit: "Up to 3 members",
    tagline: "For solo brokers and small channel partner teams",
    groups: [
      {
        label: "Lead Management",
        items: [
          "Unlimited lead imports (CSV / Excel)",
          "Lead pipeline - Kanban (6 stages)",
          "Follow-up scheduling & reminders",
          "Lead source tracking",
          "Push notifications & new lead alerts",
        ],
      },
      {
        label: "Integrations",
        items: [
          "Facebook Lead Ads auto-import",
          "WhatsApp capture",
          "Website / WordPress plugin",
        ],
      },
      { label: "Support", items: ["Email support"] },
    ],
    cta: "Contact Us to Upgrade",
    ctaSecondary: null,
  },
  {
    id: "growth",
    name: "Growth",
    color: "#ff6b00",
    popular: true,
    userLimit: "Up to 20 members",
    tagline: "For active real estate teams that need automation and insights",
    groups: [
      {
        label: "Everything in Starter, plus",
        items: [
          "Multiple project pipelines",
          "Duplicate lead detection",
          "Auto round-robin lead assignment",
          "Bulk lead export",
          "Campaign routing rules",
        ],
      },
      {
        label: "Team & Roles",
        items: [
          "Role-based access (Admin / Manager / Agent)",
          "Attendance tracking",
          "Team performance dashboard",
        ],
      },
      {
        label: "Analytics",
        items: [
          "Advanced analytics & conversion reports",
          "Booking rate & call-back metrics",
          "Individual agent response tracking",
        ],
      },
      { label: "Support", items: ["Priority support"] },
    ],
    cta: "Contact Us to Upgrade",
    ctaSecondary: null,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    color: "#a855f7",
    userLimit: "Unlimited members",
    tagline: "For large developers, franchise networks and multi-branch orgs",
    groups: [
      {
        label: "Everything in Growth, plus",
        items: [
          "Google Ads integration",
          "Custom webhook & API access",
          "Multi-org management",
          "Advanced automation management",
        ],
      },
      {
        label: "Customisation",
        items: [
          "Custom branding & white-label",
          "Custom reporting",
          "On-site onboarding & training",
        ],
      },
      {
        label: "Account",
        items: ["Dedicated account manager", "SLA-backed uptime"],
      },
    ],
    cta: "Contact Sales",
    ctaSecondary: null,
  },
];

export default function Plans() {
  useEffect(() => { document.title = "Plans & Upgrade - Arthaleads CRM"; }, []);
  const { org } = useAuth();
  const [hoveredPlan, setHoveredPlan] = useState(null);

  const currentPlanId = org?.plan === "pro" ? "growth" : (org?.plan || "starter");
  const currentLevel  = planLevel(org?.plan);
  const next          = upgradeTarget(org?.plan);

  const openWhatsApp = () => {
    window.open("https://wa.me/918080197945?text=Hi%2C%20I%27d%20like%20to%20upgrade%20my%20Arthaleads%20plan.", "_blank");
  };
  const openEmail = () => {
    window.location.href = "mailto:sales@arthaleads.com?subject=Plan Upgrade Request&body=Hi, I'd like to upgrade my Arthaleads plan.";
  };

  return (
    <div className="stitch-page space-y-6">

      {/* Header */}
      <section className="card p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="stitch-kicker mb-1">Plans & Billing</p>
            <h1 className="text-2xl font-black text-app">Your Plan</h1>
            <p className="text-sm text-app-soft mt-1">
              Currently on <span className="font-semibold text-[#ff6b00]">{planLabel(org?.plan)}</span>
              {org?.plan === "trial" && org?.trialEndsAt && (() => {
                const days = Math.max(0, Math.ceil((new Date(org.trialEndsAt) - Date.now()) / 86400000));
                return <span className="ml-1 text-amber-500">· {days} day{days !== 1 ? "s" : ""} left in trial</span>;
              })()}
            </p>
          </div>
          {next && (
            <div className="flex items-center gap-3">
              <button onClick={openWhatsApp}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#ff6b00] text-white text-sm font-semibold hover:bg-[#e05f00] transition-colors cursor-pointer">
                <ArrowRight className="w-4 h-4" />
                Upgrade to {next}
              </button>
            </div>
          )}
        </div>

        {/* Current plan highlight bar */}
        <div className="mt-5 p-4 rounded-xl flex items-center gap-4 flex-wrap"
          style={{ background: "rgba(var(--app-primary-rgb),0.06)", border: "1px solid rgba(var(--app-primary-rgb),0.15)" }}>
          <div className="flex items-center gap-3 flex-1">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(var(--app-primary-rgb),0.12)" }}>
              <Zap className="w-4 h-4 text-[#ff6b00]" />
            </div>
            <div>
              <p className="font-bold text-sm text-app">{planLabel(org?.plan)} Plan</p>
              <p className="text-xs text-app-soft">
                {currentPlanId === "starter" && "3 team members · Basic features"}
                {(currentPlanId === "growth" || org?.plan === "trial" || org?.plan === "pro") && "20 team members · Full automation & analytics"}
                {currentPlanId === "enterprise" && "Unlimited members · All features"}
              </p>
            </div>
          </div>
          <span className="text-xs font-bold px-3 py-1.5 rounded-full"
            style={{ background: "rgba(var(--app-primary-rgb),0.12)", color: "var(--app-primary)" }}>
            Active
          </span>
        </div>
      </section>

      {/* Plans grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PLANS.map((plan) => {
          const isCurrent = plan.id === currentPlanId || (plan.id === "growth" && (org?.plan === "trial" || org?.plan === "pro"));
          const isLocked  = planLevel(plan.id === "growth" ? "growth" : plan.id) > currentLevel && !isCurrent;
          const isHovered = hoveredPlan === plan.id;

          return (
            <div key={plan.id}
              className="card flex flex-col overflow-hidden transition-all duration-300 cursor-default"
              style={{
                border: isCurrent
                  ? "1.5px solid rgba(var(--app-primary-rgb),0.5)"
                  : isHovered ? `1px solid ${plan.color}50` : undefined,
                boxShadow: isCurrent ? "0 0 0 3px rgba(var(--app-primary-rgb),0.06)" : undefined,
                transform: isHovered && !isCurrent ? "translateY(-2px)" : undefined,
              }}
              onMouseEnter={() => setHoveredPlan(plan.id)}
              onMouseLeave={() => setHoveredPlan(null)}>

              {/* Top color strip */}
              <div className="h-1 w-full" style={{ background: `linear-gradient(90deg,${plan.color},${plan.color}66)` }} />

              <div className="p-5 flex flex-col flex-1">
                {/* Plan name + badges */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: `${plan.color}18` }}>
                      <Zap className="w-4 h-4" style={{ color: plan.color }} />
                    </div>
                    <div>
                      <h3 className="font-black text-lg text-app leading-none">{plan.name}</h3>
                      <p className="text-[10px] text-app-soft mt-0.5">{plan.tagline}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0 ml-2">
                    {isCurrent && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: "rgba(var(--app-primary-rgb),0.12)", color: "var(--app-primary)" }}>
                        Current
                      </span>
                    )}
                    {plan.popular && !isCurrent && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#ff6b00] text-white">
                        Popular
                      </span>
                    )}
                    {isLocked && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1"
                        style={{ background: `${plan.color}18`, color: plan.color }}>
                        <Lock className="w-2.5 h-2.5" /> Upgrade
                      </span>
                    )}
                  </div>
                </div>

                {/* User limit */}
                <div className="inline-flex items-center gap-1.5 self-start px-2.5 py-1 rounded-lg mb-3"
                  style={{ background: `${plan.color}10`, border: `1px solid ${plan.color}20` }}>
                  <Users className="w-3 h-3" style={{ color: plan.color }} />
                  <span className="text-xs font-semibold" style={{ color: plan.color }}>{plan.userLimit}</span>
                </div>

                {/* Price */}
                {(() => {
                  const price = PLAN_PRICING[plan.id] || {};
                  if (price.custom) {
                    return (
                      <div className="mb-4">
                        <span className="text-2xl font-black text-app">Custom</span>
                        <p className="text-[11px] text-app-soft mt-0.5">Tailored quote · contact sales</p>
                      </div>
                    );
                  }
                  return (
                    <div className="mb-4">
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-black text-app">{formatINR(price.monthly)}</span>
                        <span className="text-xs text-app-soft">/ user / mo</span>
                      </div>
                      <p className="text-[11px] text-app-soft mt-0.5">
                        or {formatINR(price.annual)}/user/yr · save ~2 months · no setup fee
                      </p>
                    </div>
                  );
                })()}

                {/* Features */}
                <div className="flex flex-col gap-3 flex-1 mb-5">
                  {plan.groups.map((group) => (
                    <div key={group.label}>
                      <p className="text-[9px] font-bold uppercase tracking-widest text-app-muted mb-1.5">
                        {group.label}
                      </p>
                      <ul className="space-y-1">
                        {group.items.map((item) => (
                          <li key={item} className="flex items-start gap-2">
                            <div className="w-3.5 h-3.5 rounded-full flex items-center justify-center mt-0.5 flex-shrink-0"
                              style={{ background: `${plan.color}18` }}>
                              <Check className="w-2 h-2" style={{ color: plan.color }} />
                            </div>
                            <span className="text-xs text-app-soft leading-relaxed">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>

                {/* CTA */}
                {isCurrent ? (
                  <div className="w-full py-2.5 rounded-xl text-sm font-semibold text-center"
                    style={{ background: "rgba(var(--app-primary-rgb),0.08)", color: "var(--app-primary)" }}>
                    Your Current Plan
                  </div>
                ) : isLocked ? (
                  <button onClick={openWhatsApp}
                    className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-colors cursor-pointer hover:opacity-90"
                    style={{ background: plan.color }}>
                    Upgrade to {plan.name} →
                  </button>
                ) : (
                  <button onClick={openEmail}
                    className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer"
                    style={{ border: "1px solid var(--app-border)", color: "var(--app-text-soft)" }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = plan.color; e.currentTarget.style.color = plan.color; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--app-border)"; e.currentTarget.style.color = "var(--app-text-soft)"; }}>
                    {plan.cta}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Included in all plans */}
      <section className="card p-5">
        <p className="text-xs font-bold uppercase tracking-widest text-app-muted mb-4">Included in every plan</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            ["Mobile-friendly", Shield],
            ["Facebook Lead Ads", Facebook],
            ["WhatsApp capture", MessageCircle],
            ["Kanban pipeline", Layers],
            ["Push notifications", Bell],
            ["WordPress plugin", Zap],
          ].map(([label, Icon]) => (
            <div key={label} className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(var(--app-primary-rgb),0.08)" }}>
                <Icon className="w-3.5 h-3.5 text-[#ff6b00]" />
              </div>
              <span className="text-xs text-app-soft">{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Contact section */}
      <section className="card p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-app mb-1">Need help choosing a plan?</h3>
            <p className="text-sm text-app-soft">Talk to us - we'll find the right fit for your team size and workflow.</p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <button onClick={openWhatsApp}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer transition-opacity hover:opacity-90"
              style={{ background: "#25D366" }}>
              <MessageCircle className="w-4 h-4" />
              WhatsApp Us
            </button>
            <button onClick={openEmail}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold cursor-pointer transition-all"
              style={{ border: "1px solid var(--app-border)", color: "var(--app-text-soft)" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "#ff6b00"; e.currentTarget.style.color = "#ff6b00"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--app-border)"; e.currentTarget.style.color = "var(--app-text-soft)"; }}>
              <Mail className="w-4 h-4" />
              Email Us
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
