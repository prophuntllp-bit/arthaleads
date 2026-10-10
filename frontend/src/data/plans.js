// data/plans.js
//
// The three plans as sold. Used by the home page and /pricing so the two can
// never drift apart again (the home page used to show old seat limits and
// "pricing on request" while /pricing published per-seat prices).
// Prices live in utils/plan.js (PLAN_PRICING), which the billing code also uses.
import { PLAN_PRICING } from "../utils/plan";

export const PLANS = [
  {
    id: "starter",
    name: "Starter",
    tagline: "For solo brokers and small channel partner teams",
    color: "#3b82f6",
    maxMembers: PLAN_PRICING.starter.maxSeats,
    userLimit: "5 to 10 members",
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
        "WhatsApp Inbox with manual replies",
        "2 projects",
        "2 GB file storage, call recordings kept 30 days",
      ] },
      // Roles belong on Starter: the five-seat minimum is sold as one admin,
      // one manager and three agents, so the tier has to include the thing that
      // makes that a team rather than five logins. Attendance and the
      // performance dashboard stay on Growth — those are genuinely plan-gated
      // in the API, whereas authorize() has always applied on every plan.
      { label: "Team", items: [
        "Role-based access (Admin / Manager / Agent)",
      ] },
      { label: "Support", items: ["Email support"] },
    ],
    cta: "Start Free Trial",
    ctaAction: "signup",
  },
  {
    id: "growth",
    name: "Growth",
    tagline: "For active real estate teams that need automation and insights",
    color: "#ff6b00",
    popular: true,
    maxMembers: PLAN_PRICING.growth.maxSeats,
    userLimit: "5 to 30 members",
    groups: [
      { label: "Everything in Starter, plus", items: [
        "Unlimited projects",
        "WhatsApp AI agent",
        "WhatsApp templates and campaigns",
        "15 GB file storage, call recordings kept 90 days",
        "Duplicate lead detection",
        "Auto round-robin lead assignment",
        "Bulk lead export",
        "Campaign routing rules",
      ] },
      { label: "Team", items: [
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
    userLimit: "25+ members, unlimited",
    groups: [
      { label: "Everything in Growth, plus", items: [
        "Google Ads integration",
        "Custom webhook & API access",
        "WhatsApp button flow for click-to-WhatsApp ads",
        "Vistrow Voice AI calling",
        "100 GB file storage (more on request), call recordings kept 1 year",
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
    cta: "Talk to sales",
    ctaAction: "contact",
  },
];
