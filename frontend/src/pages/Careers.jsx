import { useState, useEffect, useRef } from "react";
import { usePublicTheme } from "../context/PublicThemeContext";
import PublicNav from "../components/PublicNav";
import PublicFooter from "../components/PublicFooter";
import {
  MapPin, Clock, Briefcase, ChevronDown, ChevronUp,
  TrendingUp, Users, Zap, Heart, ArrowRight, Mail,
  BarChart3, Megaphone, Target, Handshake,
} from "lucide-react";

const JOBS = [
  {
    id: "dme",
    title: "Digital Marketing Executive",
    department: "Marketing",
    location: "Pune, Maharashtra",
    type: "Full-time",
    experience: "1–3 years",
    icon: Megaphone,
    color: "#ff6b00",
    tagline: "Drive our brand presence and lead-gen campaigns across digital channels.",
    about:
      "We're looking for a creative and data-driven Digital Marketing Executive to own our social media, paid ads, and content strategy. You'll work directly with the founding team to grow Arthaleads' brand among real estate professionals across India.",
    responsibilities: [
      "Plan, run, and optimise Facebook, Instagram, and Google Ads campaigns for lead generation",
      "Create engaging content (graphics, short videos, copy) for social media and email newsletters",
      "Manage SEO strategy — keyword research, on-page optimisation, blog content briefs",
      "Track campaign KPIs (CPL, CTR, ROAS) and present weekly performance reports",
      "Run email marketing campaigns via tools like Mailchimp or similar",
      "Coordinate with the design team to produce marketing collateral",
      "Monitor competitor activity and identify growth opportunities",
    ],
    requirements: [
      "1–3 years of hands-on digital marketing experience (agency or in-house)",
      "Proficiency in Meta Ads Manager and Google Ads",
      "Working knowledge of Google Analytics 4 and Search Console",
      "Basic design skills — Canva, Figma, or Adobe Suite",
      "Strong written English and Hindi communication",
      "Bonus: experience marketing a SaaS or B2B product",
    ],
  },
  {
    id: "bde",
    title: "Business Development Executive",
    department: "Sales",
    location: "Pune, Maharashtra",
    type: "Full-time",
    experience: "1–3 years",
    icon: Handshake,
    color: "#22c55e",
    tagline: "Build relationships with real estate developers and channel partners across Maharashtra.",
    about:
      "We're hiring a driven Business Development Executive to grow Arthaleads' customer base. You'll identify, pitch, and onboard real estate developers, builders, and channel partner companies who need a modern CRM. This is a high-impact role with direct visibility to the founding team.",
    responsibilities: [
      "Identify and reach out to real estate developers, builders, and channel partner networks in Pune and Maharashtra",
      "Conduct product demos and pitches — online and in-person",
      "Build and manage a sales pipeline from cold outreach to closed deal",
      "Achieve monthly lead and revenue targets",
      "Maintain accurate records in the CRM (yes, you'll use Arthaleads itself)",
      "Collect customer feedback and relay product insights to the team",
      "Attend real estate expos, networking events, and developer meets",
    ],
    requirements: [
      "1–3 years of B2B sales or business development experience",
      "Excellent spoken and written communication in English, Hindi, and Marathi",
      "Strong interpersonal skills — you enjoy meeting people and building relationships",
      "Familiarity with real estate industry (developers, channel partners, RERA) is a big plus",
      "Self-motivated with the ability to work independently and hit targets",
      "Bonus: prior experience selling SaaS or tech products",
    ],
  },
];

const PERKS = [
  { icon: TrendingUp, title: "Growth-first culture",  desc: "Direct access to founders. Your ideas ship, not sit in queues.",       color: "#ff6b00" },
  { icon: Zap,        title: "Fast-moving team",      desc: "Small team, big impact. No bureaucracy, no endless meetings.",         color: "#f59e0b" },
  { icon: Users,      title: "Real estate exposure",  desc: "Work with top developers and channel partners across Maharashtra.",     color: "#3b82f6" },
  { icon: Heart,      title: "Competitive pay",       desc: "Market-rate salary + performance incentives + growth track.",          color: "#ec4899" },
];

function useVisible(threshold = 0.15) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVisible(true); obs.disconnect(); }
    }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return [ref, visible];
}

function JobCard({ job, isDark, index }) {
  const [open, setOpen] = useState(false);
  const [cardRef, cardVisible] = useVisible(0.1);
  const Icon = job.icon;

  const cardBg  = isDark ? "rgba(255,255,255,0.03)" : "#ffffff";
  const cardBdr = isDark ? "rgba(255,255,255,0.08)" : "#e5e7eb";
  const heading = isDark ? "#ffffff" : "#111827";
  const body    = isDark ? "rgba(255,255,255,0.55)" : "#6b7280";
  const divider = isDark ? "rgba(255,255,255,0.06)" : "#f3f4f6";

  return (
    <div
      ref={cardRef}
      style={{
        background: cardBg,
        border: `1px solid ${open ? job.color + "55" : cardBdr}`,
        boxShadow: open ? `0 12px 40px ${job.color}18` : "none",
        borderRadius: 20,
        opacity: cardVisible ? 1 : 0,
        transform: cardVisible ? "translateY(0)" : "translateY(28px)",
        transition: `opacity 0.6s ease ${index * 0.15}s, transform 0.6s ease ${index * 0.15}s, border 0.25s, box-shadow 0.25s`,
        overflow: "hidden",
      }}
    >
      {/* Card header — always visible */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full text-left p-6 sm:p-8"
        style={{ cursor: "pointer" }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div
              className="flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{ background: job.color + "18" }}
            >
              <Icon className="w-6 h-6" style={{ color: job.color }} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span
                  className="text-xs font-semibold uppercase tracking-wide px-2.5 py-0.5 rounded-full"
                  style={{ background: job.color + "18", color: job.color }}
                >
                  {job.department}
                </span>
                <span className="text-xs px-2.5 py-0.5 rounded-full" style={{
                  background: isDark ? "rgba(255,255,255,0.06)" : "#f3f4f6",
                  color: body,
                }}>
                  {job.type}
                </span>
              </div>
              <h3 className="text-xl font-bold mb-1" style={{ color: heading }}>{job.title}</h3>
              <p className="text-sm" style={{ color: body }}>{job.tagline}</p>
              <div className="flex flex-wrap gap-4 mt-3">
                <span className="flex items-center gap-1.5 text-xs" style={{ color: body }}>
                  <MapPin className="w-3.5 h-3.5" />{job.location}
                </span>
                <span className="flex items-center gap-1.5 text-xs" style={{ color: body }}>
                  <Clock className="w-3.5 h-3.5" />{job.experience} experience
                </span>
                <span className="flex items-center gap-1.5 text-xs" style={{ color: body }}>
                  <Briefcase className="w-3.5 h-3.5" />{job.type}
                </span>
              </div>
            </div>
          </div>
          <div
            className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center"
            style={{
              background: open ? job.color + "18" : isDark ? "rgba(255,255,255,0.06)" : "#f3f4f6",
              transition: "background 0.2s",
            }}
          >
            {open
              ? <ChevronUp className="w-4 h-4" style={{ color: job.color }} />
              : <ChevronDown className="w-4 h-4" style={{ color: body }} />
            }
          </div>
        </div>
      </button>

      {/* Expandable details */}
      <div style={{
        maxHeight: open ? 1200 : 0,
        overflow: "hidden",
        transition: "max-height 0.45s cubic-bezier(0.4,0,0.2,1)",
      }}>
        <div style={{ borderTop: `1px solid ${divider}`, padding: "0 32px 32px" }}>
          <p className="text-sm leading-relaxed mt-6 mb-6" style={{ color: body }}>{job.about}</p>

          <div className="grid sm:grid-cols-2 gap-8">
            <div>
              <h4 className="text-sm font-bold uppercase tracking-wide mb-3" style={{ color: job.color }}>
                Responsibilities
              </h4>
              <ul className="space-y-2">
                {job.responsibilities.map(r => (
                  <li key={r} className="flex items-start gap-2.5 text-sm" style={{ color: body }}>
                    <span className="flex-shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full" style={{ background: job.color }} />
                    {r}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-bold uppercase tracking-wide mb-3" style={{ color: job.color }}>
                Requirements
              </h4>
              <ul className="space-y-2">
                {job.requirements.map(r => (
                  <li key={r} className="flex items-start gap-2.5 text-sm" style={{ color: body }}>
                    <span className="flex-shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full" style={{ background: job.color }} />
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href={`mailto:careers@arthaleads.com?subject=Application: ${encodeURIComponent(job.title)}&body=Hi Arthaleads team,%0A%0AI'd like to apply for the ${encodeURIComponent(job.title)} role.%0A%0AName:%0ALinkedIn / Portfolio:%0AYears of experience:%0A%0AWhy I'm a great fit:%0A`}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold"
              style={{
                background: job.color,
                color: "#ffffff",
                textDecoration: "none",
                transition: "opacity 0.2s",
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = "0.88"}
              onMouseLeave={e => e.currentTarget.style.opacity = "1"}
            >
              <Mail className="w-4 h-4" />
              Apply Now
              <ArrowRight className="w-4 h-4" />
            </a>
            <span className="flex items-center text-xs px-4 py-2.5 rounded-xl" style={{
              background: isDark ? "rgba(255,255,255,0.05)" : "#f9fafb",
              color: body,
            }}>
              Send your resume to careers@arthaleads.com
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Careers() {
  const { isDark } = usePublicTheme();
  const [heroRef, heroVisible] = useVisible(0.1);
  const [perksRef, perksVisible] = useVisible(0.15);

  const bg      = isDark ? "#0d0d1a" : "#f8f9fa";
  const heading = isDark ? "#ffffff" : "#111827";
  const body    = isDark ? "rgba(255,255,255,0.55)" : "#6b7280";
  const perkBg  = isDark ? "rgba(255,255,255,0.03)" : "#ffffff";
  const perkBdr = isDark ? "rgba(255,255,255,0.07)" : "#e5e7eb";

  useEffect(() => {
    document.title = "Careers — Arthaleads";
    return () => { document.title = "Arthaleads - Real Estate CRM"; };
  }, []);

  return (
    <div style={{ background: bg, minHeight: "100vh" }}>
      <PublicNav />

      {/* Hero */}
      <section className="pt-28 pb-16 px-4" ref={heroRef}>
        <div className="max-w-3xl mx-auto text-center">
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#ff6b00]/30 bg-[#ff6b00]/10 mb-6"
            style={{
              opacity: heroVisible ? 1 : 0,
              transform: heroVisible ? "translateY(0)" : "translateY(-12px)",
              transition: "opacity 0.6s ease, transform 0.6s ease",
            }}
          >
            <Briefcase className="w-3.5 h-3.5 text-[#ff6b00]" />
            <span className="text-[#ff6b00] text-xs font-semibold uppercase tracking-wide">We're Hiring</span>
          </div>

          <h1
            className="text-4xl sm:text-5xl lg:text-6xl font-black mb-5 leading-tight"
            style={{
              color: heading,
              opacity: heroVisible ? 1 : 0,
              transform: heroVisible ? "translateY(0)" : "translateY(20px)",
              transition: "opacity 0.7s ease 0.1s, transform 0.7s ease 0.1s",
            }}
          >
            Build the future of{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff6b00] to-[#ffaa00]">
              real estate tech
            </span>
          </h1>

          <p
            className="text-lg leading-relaxed mb-8 max-w-xl mx-auto"
            style={{
              color: body,
              opacity: heroVisible ? 1 : 0,
              transform: heroVisible ? "translateY(0)" : "translateY(16px)",
              transition: "opacity 0.7s ease 0.2s, transform 0.7s ease 0.2s",
            }}
          >
            Arthaleads is a fast-growing real estate CRM used by teams across Maharashtra. We're a small, ambitious team that moves fast and ships every week. Come help us build something real.
          </p>

          <div
            className="flex items-center justify-center gap-3 flex-wrap"
            style={{
              opacity: heroVisible ? 1 : 0,
              transform: heroVisible ? "translateY(0)" : "translateY(12px)",
              transition: "opacity 0.6s ease 0.32s, transform 0.6s ease 0.32s",
            }}
          >
            <span className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-full" style={{
              background: isDark ? "rgba(255,107,0,0.1)" : "#fff7ed",
              color: "#ff6b00",
              border: "1px solid rgba(255,107,0,0.2)",
            }}>
              <MapPin className="w-3.5 h-3.5" /> Pune, Maharashtra
            </span>
            <span className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-full" style={{
              background: isDark ? "rgba(34,197,94,0.1)" : "#f0fdf4",
              color: "#22c55e",
              border: "1px solid rgba(34,197,94,0.2)",
            }}>
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse inline-block" />
              2 Open Positions
            </span>
          </div>
        </div>
      </section>

      {/* Perks */}
      <section className="pb-12 px-4" ref={perksRef}>
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {PERKS.map(({ icon: Icon, title, desc, color }, i) => (
              <div
                key={title}
                className="p-5 rounded-2xl"
                style={{
                  background: perkBg,
                  border: `1px solid ${perkBdr}`,
                  opacity: perksVisible ? 1 : 0,
                  transform: perksVisible ? "translateY(0)" : "translateY(20px)",
                  transition: `opacity 0.55s ease ${i * 0.1}s, transform 0.55s ease ${i * 0.1}s`,
                }}
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: color + "18" }}>
                  <Icon className="w-4.5 h-4.5" style={{ color, width: 18, height: 18 }} />
                </div>
                <div className="font-semibold text-sm mb-1" style={{ color: heading }}>{title}</div>
                <div className="text-xs leading-relaxed" style={{ color: body }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Open Positions */}
      <section className="pb-20 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <div className="flex-1 h-px" style={{ background: isDark ? "rgba(255,255,255,0.07)" : "#e5e7eb" }} />
            <span className="text-xs font-bold uppercase tracking-widest px-4" style={{ color: body }}>
              Open Positions
            </span>
            <div className="flex-1 h-px" style={{ background: isDark ? "rgba(255,255,255,0.07)" : "#e5e7eb" }} />
          </div>

          <div className="space-y-5">
            {JOBS.map((job, i) => (
              <JobCard key={job.id} job={job} isDark={isDark} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="pb-20 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <div
            className="rounded-3xl p-10"
            style={{
              background: isDark
                ? "linear-gradient(135deg, rgba(255,107,0,0.12), rgba(255,170,0,0.06))"
                : "linear-gradient(135deg, #fff7ed, #fffbeb)",
              border: "1px solid rgba(255,107,0,0.2)",
            }}
          >
            <div className="w-12 h-12 rounded-2xl bg-[#ff6b00]/15 flex items-center justify-center mx-auto mb-4">
              <Target className="w-6 h-6 text-[#ff6b00]" />
            </div>
            <h3 className="text-2xl font-black mb-3" style={{ color: heading }}>
              Don't see a fit? Reach out anyway.
            </h3>
            <p className="text-sm leading-relaxed mb-6" style={{ color: body }}>
              We're always open to meeting talented people who are excited about real estate tech. Send us a note and we'll keep you in mind for future openings.
            </p>
            <a
              href="mailto:careers@arthaleads.com?subject=General Application — Arthaleads"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm"
              style={{
                background: "#ff6b00",
                color: "#ffffff",
                textDecoration: "none",
                transition: "opacity 0.2s",
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = "0.88"}
              onMouseLeave={e => e.currentTarget.style.opacity = "1"}
            >
              <Mail className="w-4 h-4" />
              careers@arthaleads.com
            </a>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
