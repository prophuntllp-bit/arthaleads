import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight, Check, Zap, Heart, Shield,
  MapPin, Users, BarChart3, Layers, Sparkles,
} from "lucide-react";
import PublicNav from "../components/PublicNav";
import PublicFooter from "../components/PublicFooter";
import { usePublicTheme } from "../context/PublicThemeContext";
import { useSEO } from "../utils/useSEO";

// ── Data ──────────────────────────────────────────────────────────────────────
const STATS = [
  { num: 500,   suffix: "+",   label: "Real Estate Teams",  color: "#ff6b00" },
  { num: 50000, suffix: "+",   label: "Leads Managed",      color: "#22c55e" },
  { num: 8,     suffix: "",    label: "Form Integrations",  color: "#3b82f6" },
  { num: 99,    suffix: ".9%", label: "Uptime",             color: "#a855f7" },
];

const VALUES = [
  {
    icon: Zap,
    color: "#ff6b00",
    title: "Speed",
    desc: "Every lead that comes in is captured instantly. Every follow-up reminder fires on time. We build for the urgency of property sales.",
  },
  {
    icon: Heart,
    color: "#ec4899",
    title: "Simplicity",
    desc: "Sales teams shouldn't need training to use their CRM. Arthaleads is intuitive enough for a telecaller on day one.",
  },
  {
    icon: Shield,
    color: "#22c55e",
    title: "Support",
    desc: "When your team is in the middle of a campaign and something goes wrong, we're there. Real support from people who understand real estate.",
  },
];

const STORY_POINTS = [
  { icon: Layers,   text: "Every lead source connected to one inbox: Facebook, Google, WhatsApp, forms, portals." },
  { icon: Users,    text: "Duplicate prevention so your team never wastes a call." },
  { icon: Shield,   text: "Role-based access so telecallers, managers, and admins each see exactly what they need." },
  { icon: BarChart3,text: "Real-time dashboards built for the pace of property sales campaigns." },
];

const TIMELINE = [
  { year: "2022", title: "The idea",         desc: "Watched real estate teams lose hot leads across WhatsApp groups and spreadsheets. Knew there had to be a better way." },
  { year: "2023", title: "First version",    desc: "Shipped the first version of Arthaleads to 5 teams in Pune. Immediate product-market fit. Teams never looked back at Excel." },
  { year: "2024", title: "Growing fast",     desc: "Expanded to 100+ teams across Maharashtra. Added Facebook Ads integration, pipeline view, and team analytics." },
  { year: "2025", title: "Scaling up",       desc: "500+ teams, 50,000+ leads managed monthly. Launching WordPress plugin and deepening integrations with Indian property portals." },
];

// ── Hooks ─────────────────────────────────────────────────────────────────────
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

function AnimCounter({ to, suffix = "", dur = 1600 }) {
  const ref = useRef(null);
  const [val, setVal] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      obs.disconnect();
      const fps = 60, steps = (dur / 1000) * fps;
      let s = 0;
      const id = setInterval(() => {
        s++;
        const p = 1 - Math.pow(1 - s / steps, 3);
        setVal(Math.round(p * to));
        if (s >= steps) clearInterval(id);
      }, 1000 / fps);
    }, { threshold: 0.5 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [to, dur]);
  const display = to >= 1000 ? val.toLocaleString("en-IN") : val;
  return <span ref={ref}>{display}{suffix}</span>;
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function AboutUs() {
  const { isDark } = usePublicTheme();

  useSEO({
    title: "About Arthaleads - Real Estate CRM Built for India",
    description: "Arthaleads is India's leading real estate CRM platform built for developers, brokers, and channel partners. Learn our mission to simplify property lead management.",
    canonical: "https://www.arthaleads.com/about-us",
  });

  const [statsRef,    statsVisible]    = useVisible(0.2);
  const [storyRef,    storyVisible]    = useVisible(0.12);
  const [missionRef,  missionVisible]  = useVisible(0.2);
  const [valuesRef,   valuesVisible]   = useVisible(0.1);
  const [timelineRef, timelineVisible] = useVisible(0.1);
  const [ctaRef,      ctaVisible]      = useVisible(0.2);

  const pageBg    = isDark ? "#0d0d1a" : "#f8fafc";
  const sectionBg = isDark ? "rgba(255,255,255,0.02)" : "#ffffff";
  const sectionBdr= isDark ? "rgba(255,255,255,0.06)" : "#e5e7eb";
  const heading   = isDark ? "#ffffff" : "#111827";
  const body      = isDark ? "rgba(255,255,255,0.55)" : "#6b7280";

  return (
    <div style={{ background: pageBg, minHeight: "100vh" }}>
      <style>{`
        .about-story-grid  { display: grid; grid-template-columns: 1fr 1fr; gap: 64px; align-items: center; }
        .about-stats-grid  { display: grid; grid-template-columns: repeat(4, 1fr); }
        .about-values-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
        .about-cta-grid    { display: grid; grid-template-columns: 1fr 1fr; }
        .about-cta-right   { display: flex; }
        @media (max-width: 900px) {
          .about-story-grid  { grid-template-columns: 1fr; gap: 40px; }
          .about-stats-grid  { grid-template-columns: repeat(2, 1fr); }
          .about-values-grid { grid-template-columns: repeat(2, 1fr); }
          .about-cta-grid    { grid-template-columns: 1fr; }
          .about-cta-right   { display: none; }
        }
        @media (max-width: 560px) {
          .about-stats-grid  { grid-template-columns: repeat(2, 1fr); }
          .about-values-grid { grid-template-columns: 1fr; }
        }
      `}</style>
      <PublicNav />

      {/* ── Hero ── */}
      <section style={{ position: "relative", overflow: "hidden", background: isDark ? "#0d0d1a" : "#f8fafc", paddingTop: 120, paddingBottom: 100 }}>
        {/* Blobs */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          <div style={{ position: "absolute", top: "-15%", right: "5%", width: 560, height: 560, borderRadius: "50%", background: isDark ? "radial-gradient(circle, rgba(255,107,0,0.2) 0%, transparent 70%)" : "radial-gradient(circle, rgba(255,107,0,0.12) 0%, transparent 70%)", filter: "blur(64px)", animation: "blobA 9s ease-in-out infinite" }} />
          <div style={{ position: "absolute", bottom: "-20%", left: "0%",  width: 480, height: 480, borderRadius: "50%", background: isDark ? "radial-gradient(circle, rgba(59,130,246,0.14) 0%, transparent 70%)" : "radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)", filter: "blur(72px)", animation: "blobB 11s ease-in-out infinite" }} />
          <div style={{ position: "absolute", inset: 0, opacity: isDark ? 0.04 : 0.025, backgroundImage: isDark ? "radial-gradient(rgba(255,255,255,0.9) 1px, transparent 1px)" : "radial-gradient(rgba(0,0,0,0.5) 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
        </div>

        <div style={{ maxWidth: 860, margin: "0 auto", padding: "0 24px", textAlign: "center", position: "relative" }}>
          {/* Badge */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 16px", borderRadius: 40, border: "1px solid rgba(255,107,0,0.35)", background: "rgba(255,107,0,0.1)", marginBottom: 28, animation: "fadeUp 0.6s ease both" }}>
            <MapPin style={{ width: 13, height: 13, color: "#ff6b00" }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: "#ff6b00", textTransform: "uppercase", letterSpacing: "0.1em" }}>Pune, India</span>
          </div>

          <h1 style={{ fontSize: "clamp(36px, 6vw, 64px)", fontWeight: 900, lineHeight: 1.1, color: heading, marginBottom: 20, animation: "fadeUp 0.7s ease 0.1s both" }}>
            Built for Real Estate.{" "}
            <span style={{ background: "linear-gradient(135deg, #ff6b00, #ffaa00)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Built for India.
            </span>
          </h1>

          <p style={{ fontSize: 18, lineHeight: 1.75, color: body, maxWidth: 580, margin: "0 auto 44px", animation: "fadeUp 0.7s ease 0.2s both" }}>
            We set out to solve a problem every Indian real estate team knows: leads slipping through the cracks across WhatsApp groups, Facebook campaigns, and forgotten spreadsheets.
          </p>

          {/* Floating chips */}
          <div style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap", animation: "fadeUp 0.6s ease 0.32s both" }}>
            {["500+ Teams", "Pune · Mumbai · Maharashtra", "Founded 2022"].map(txt => (
              <div key={txt} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 30, background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)", border: `1px solid ${isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)"}` }}>
                <span style={{ fontSize: 12, color: body, fontWeight: 500 }}>{txt}</span>
              </div>
            ))}
          </div>
        </div>

        <style>{`
          @keyframes fadeUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
          @keyframes blobA  { 0%,100% { transform:translate(0,0); }   50% { transform:translate(-28px, 18px); } }
          @keyframes blobB  { 0%,100% { transform:translate(0,0); }   50% { transform:translate(22px,-22px); } }
        `}</style>
      </section>

      {/* ── Stats strip ── */}
      <section ref={statsRef} style={{ background: sectionBg, borderTop: `1px solid ${sectionBdr}`, borderBottom: `1px solid ${sectionBdr}`, padding: "36px 24px" }}>
        <div className="about-stats-grid" style={{ maxWidth: 900, margin: "0 auto" }}>
          {STATS.map(({ num, suffix, label, color }, i) => (
            <div key={label} style={{
              textAlign: "center", padding: "14px 20px",
              borderRight: `1px solid ${sectionBdr}`,
              opacity: statsVisible ? 1 : 0,
              transform: statsVisible ? "translateY(0)" : "translateY(16px)",
              transition: `opacity 0.55s ease ${i * 0.1}s, transform 0.55s ease ${i * 0.1}s`,
            }}>
              <div style={{ fontSize: 38, fontWeight: 900, color, lineHeight: 1, marginBottom: 6 }}>
                <AnimCounter to={num} suffix={suffix} />
              </div>
              <div style={{ fontSize: 12, color: body, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.07em" }}>{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Our Story ── */}
      <section style={{ padding: "88px 24px" }}>
        <div ref={storyRef} className="about-story-grid" style={{ maxWidth: 1100, margin: "0 auto" }}>
          {/* Left */}
          <div style={{ opacity: storyVisible ? 1 : 0, transform: storyVisible ? "translateX(0)" : "translateX(-40px)", transition: "opacity 0.7s ease, transform 0.7s ease" }}>
            <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.14em", color: "#ff6b00", marginBottom: 12 }}>Our Story</div>
            <h2 style={{ fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 900, color: heading, lineHeight: 1.15, marginBottom: 20 }}>
              Why we built{" "}
              <span style={{ color: "#ff6b00" }}>Arthaleads</span>
            </h2>
            <p style={{ fontSize: 15, lineHeight: 1.8, color: body, marginBottom: 16 }}>
              Real estate sales teams in India work across multiple channels simultaneously: Facebook lead ads, Google campaigns, WhatsApp enquiries, walk-ins, and housing portals, all at once. Before Arthaleads, managing this meant juggling six different tabs, three WhatsApp groups, and a shared Excel sheet that nobody trusted.
            </p>
            <p style={{ fontSize: 15, lineHeight: 1.8, color: body, marginBottom: 16 }}>
              Hot leads would go cold because no one followed up in time. Telecallers would call the same number three times from different lists. Managers had no way to see what the team was actually doing.
            </p>
            <p style={{ fontSize: 15, lineHeight: 1.8, color: body }}>
              We built Arthaleads to be the single workspace where every property enquiry lands, gets assigned, gets called, and gets tracked. From first contact to closed deal.
            </p>
          </div>

          {/* Right — story points */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {STORY_POINTS.map(({ icon: Icon, text }, i) => (
              <div
                key={text}
                style={{
                  display: "flex", alignItems: "flex-start", gap: 14,
                  padding: "16px 18px", borderRadius: 14,
                  background: sectionBg,
                  border: `1px solid ${sectionBdr}`,
                  opacity: storyVisible ? 1 : 0,
                  transform: storyVisible ? "translateX(0)" : "translateX(40px)",
                  transition: `opacity 0.6s ease ${0.15 + i * 0.12}s, transform 0.6s ease ${0.15 + i * 0.12}s, border 0.2s, box-shadow 0.2s`,
                  cursor: "default",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(255,107,0,0.35)"; e.currentTarget.style.boxShadow = "0 6px 24px rgba(255,107,0,0.1)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = sectionBdr; e.currentTarget.style.boxShadow = "none"; }}
              >
                <div style={{ flexShrink: 0, width: 34, height: 34, borderRadius: 10, background: "rgba(255,107,0,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon style={{ width: 16, height: 16, color: "#ff6b00" }} />
                </div>
                <p style={{ fontSize: 14, lineHeight: 1.65, color: body }}>{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Mission ── */}
      <section ref={missionRef} style={{ background: isDark ? "#0d0d1a" : "#fff7f0", padding: "96px 24px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 700, height: 400, background: "radial-gradient(ellipse, rgba(255,107,0,0.12) 0%, transparent 70%)", filter: "blur(60px)" }} />
        </div>
        <div style={{ maxWidth: 760, margin: "0 auto", textAlign: "center", position: "relative" }}>
          <div style={{
            fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.14em",
            color: "#ff6b00", marginBottom: 16,
            opacity: missionVisible ? 1 : 0,
            transform: missionVisible ? "translateY(0)" : "translateY(12px)",
            transition: "opacity 0.6s ease, transform 0.6s ease",
          }}>Our Mission</div>
          <h2 style={{
            fontSize: "clamp(30px, 5vw, 52px)", fontWeight: 900, lineHeight: 1.15,
            background: isDark ? "linear-gradient(135deg, #ff6b00, #ffaa00, #ffffff)" : "linear-gradient(135deg, #ff6b00, #c94e00)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            marginBottom: 24,
            opacity: missionVisible ? 1 : 0,
            transform: missionVisible ? "translateY(0)" : "translateY(16px)",
            transition: "opacity 0.7s ease 0.12s, transform 0.7s ease 0.12s",
          }}>
            Turn every property enquiry into a closed deal.
          </h2>
          <p style={{
            fontSize: 16, lineHeight: 1.8, color: body, maxWidth: 540, margin: "0 auto",
            opacity: missionVisible ? 1 : 0,
            transform: missionVisible ? "translateY(0)" : "translateY(12px)",
            transition: "opacity 0.7s ease 0.22s, transform 0.7s ease 0.22s",
          }}>
            We believe the difference between a sale and a missed opportunity is usually just one thing: a timely, informed follow-up. Arthaleads exists to make sure that follow-up never gets missed.
          </p>
        </div>
      </section>

      {/* ── Values ── */}
      <section style={{ padding: "88px 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div ref={valuesRef} style={{
            textAlign: "center", marginBottom: 52,
            opacity: valuesVisible ? 1 : 0,
            transform: valuesVisible ? "translateY(0)" : "translateY(20px)",
            transition: "opacity 0.6s ease, transform 0.6s ease",
          }}>
            <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.14em", color: "#ff6b00", marginBottom: 10 }}>What We Stand For</div>
            <h2 style={{ fontSize: "clamp(26px, 4vw, 38px)", fontWeight: 900, color: heading, marginBottom: 12 }}>Three values we never compromise</h2>
            <p style={{ fontSize: 15, color: body, maxWidth: 460, margin: "0 auto" }}>
              Every decision, every feature, every customer interaction is shaped by these.
            </p>
          </div>

          <div className="about-values-grid">
            {VALUES.map(({ icon: Icon, color, title, desc }, i) => (
              <div
                key={title}
                style={{
                  padding: "28px 26px", borderRadius: 20,
                  background: sectionBg,
                  border: `1px solid ${sectionBdr}`,
                  opacity: valuesVisible ? 1 : 0,
                  transform: valuesVisible ? "translateY(0)" : "translateY(28px)",
                  transition: `opacity 0.6s ease ${i * 0.15}s, transform 0.6s ease ${i * 0.15}s, border 0.22s, box-shadow 0.22s`,
                  cursor: "default",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = color + "44"; e.currentTarget.style.boxShadow = `0 12px 36px ${color}1a`; e.currentTarget.style.transform = "translateY(-5px)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = sectionBdr; e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "translateY(0)"; }}
              >
                <div style={{ width: 48, height: 48, borderRadius: 14, background: color + "18", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                  <Icon style={{ width: 22, height: 22, color }} />
                </div>
                <div style={{ fontSize: 22, fontWeight: 900, color, marginBottom: 10 }}>{title}</div>
                <p style={{ fontSize: 14, lineHeight: 1.7, color: body }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Timeline ── */}
      <section style={{ background: isDark ? "#0d0d1a" : "#f1f5f9", padding: "88px 24px" }}>
        <div style={{ maxWidth: 860, margin: "0 auto" }}>
          <div ref={timelineRef} style={{ textAlign: "center", marginBottom: 56,
            opacity: timelineVisible ? 1 : 0, transform: timelineVisible ? "translateY(0)" : "translateY(20px)", transition: "opacity 0.6s ease, transform 0.6s ease",
          }}>
            <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.14em", color: "#ff6b00", marginBottom: 10 }}>Our Journey</div>
            <h2 style={{ fontSize: "clamp(26px, 4vw, 38px)", fontWeight: 900, color: heading }}>How we got here</h2>
          </div>

          <div style={{ position: "relative", paddingLeft: 28 }}>
            {/* Vertical line — solid with gradient */}
            <div style={{
              position: "absolute", left: 19, top: 20, bottom: 20, width: 2,
              background: "linear-gradient(180deg, #ff6b00 0%, rgba(255,107,0,0.3) 100%)",
              borderRadius: 2,
            }} />

            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {TIMELINE.map(({ year, title, desc }, i) => (
                <div
                  key={year}
                  style={{
                    display: "flex", gap: 24, alignItems: "flex-start",
                    opacity: timelineVisible ? 1 : 0,
                    transform: timelineVisible ? "translateX(0)" : "translateX(-30px)",
                    transition: `opacity 0.6s ease ${i * 0.15}s, transform 0.6s ease ${i * 0.15}s`,
                  }}
                >
                  {/* Dot */}
                  <div style={{ flexShrink: 0, zIndex: 1, marginLeft: -28 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: "50%",
                      background: i === TIMELINE.length - 1 ? "#ff6b00" : sectionBg,
                      border: "2px solid #ff6b00",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      transition: "background 0.2s, transform 0.2s, box-shadow 0.2s",
                      boxShadow: i === TIMELINE.length - 1 ? "0 0 16px rgba(255,107,0,0.4)" : "none",
                    }}
                    id={`timeline-dot-${i}`}
                    >
                      <span style={{
                        fontSize: 10, fontWeight: 900,
                        color: i === TIMELINE.length - 1 ? "#fff" : "#ff6b00",
                        letterSpacing: "-0.5px",
                      }}>{year.slice(2)}</span>
                    </div>
                  </div>

                  {/* Content card */}
                  <div
                    style={{
                      flex: 1,
                      background: sectionBg,
                      borderRadius: 16,
                      border: `1px solid ${sectionBdr}`,
                      padding: "18px 22px",
                      transition: "border-color 0.2s, box-shadow 0.2s, transform 0.2s",
                      cursor: "default",
                      position: "relative",
                      overflow: "hidden",
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = "rgba(255,107,0,0.35)";
                      e.currentTarget.style.boxShadow = "0 8px 28px rgba(255,107,0,0.1)";
                      e.currentTarget.style.transform = "translateY(-2px)";
                      const dot = document.getElementById(`timeline-dot-${i}`);
                      if (dot) { dot.style.background = "#ff6b00"; dot.style.boxShadow = "0 0 16px rgba(255,107,0,0.4)"; }
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = sectionBdr;
                      e.currentTarget.style.boxShadow = "none";
                      e.currentTarget.style.transform = "translateY(0)";
                      const dot = document.getElementById(`timeline-dot-${i}`);
                      if (dot && i !== TIMELINE.length - 1) { dot.style.background = sectionBg; dot.style.boxShadow = "none"; }
                    }}
                  >
                    {/* Left accent */}
                    <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: "#ff6b00", borderRadius: "16px 0 0 16px", opacity: 0.5 }} />
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 800, color: "#ff6b00", background: "rgba(255,107,0,0.1)", border: "1px solid rgba(255,107,0,0.2)", padding: "2px 10px", borderRadius: 20 }}>{year}</span>
                      <span style={{ fontSize: 16, fontWeight: 700, color: heading }}>{title}</span>
                    </div>
                    <p style={{ fontSize: 14, color: body, lineHeight: 1.7, margin: 0 }}>{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ padding: "80px 24px" }}>
        <div ref={ctaRef} style={{
          maxWidth: 1000, margin: "0 auto",
          borderRadius: 28, overflow: "hidden",
          background: isDark ? "#161620" : "#ffffff",
          border: `1px solid ${sectionBdr}`,
          boxShadow: isDark ? "0 24px 60px rgba(0,0,0,0.3)" : "0 24px 60px rgba(0,0,0,0.07)",
          position: "relative",
          opacity: ctaVisible ? 1 : 0,
          transform: ctaVisible ? "translateY(0)" : "translateY(28px)",
          transition: "opacity 0.7s ease, transform 0.7s ease",
        }}
        className="about-cta-grid"
        >
          {/* Orange top accent bar */}
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: "linear-gradient(90deg, #ff6b00, #ffaa00, #ff6b00)", backgroundSize: "200% 100%", animation: "shimmer 3s linear infinite" }} />

          {/* Left — headline + CTA */}
          <div style={{ padding: "52px 48px 52px 52px" }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 7,
              padding: "4px 12px", borderRadius: 20, marginBottom: 20,
              background: "rgba(255,107,0,0.1)", border: "1px solid rgba(255,107,0,0.2)",
            }}>
              <Sparkles style={{ width: 11, height: 11, color: "#ff6b00" }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: "#ff6b00", textTransform: "uppercase", letterSpacing: "0.1em" }}>500+ Teams Trust Us</span>
            </div>
            <h2 style={{ fontSize: "clamp(24px, 3.5vw, 36px)", fontWeight: 900, color: heading, lineHeight: 1.2, marginBottom: 14 }}>
              Start managing leads the smarter way
            </h2>
            <p style={{ fontSize: 15, color: body, lineHeight: 1.75, marginBottom: 32 }}>
              No spreadsheets. No missed follow-ups. Your whole team working from one place, set up in under 5 minutes.
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <Link
                to="/signup"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  background: "#ff6b00", color: "#fff",
                  borderRadius: 12, padding: "13px 24px", fontSize: 15, fontWeight: 700,
                  textDecoration: "none",
                  boxShadow: "0 8px 28px rgba(255,107,0,0.38)",
                  transition: "transform 0.18s, box-shadow 0.18s",
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 12px 36px rgba(255,107,0,0.55)"; }}
                onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 8px 28px rgba(255,107,0,0.38)"; }}
              >
                Start Free Trial
                <ArrowRight style={{ width: 16, height: 16 }} />
              </Link>
              <Link
                to="/#features"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  color: body, fontSize: 14, fontWeight: 600,
                  textDecoration: "none", transition: "color 0.18s",
                }}
                onMouseEnter={e => e.currentTarget.style.color = "#ff6b00"}
                onMouseLeave={e => e.currentTarget.style.color = body}
              >
                See all features →
              </Link>
            </div>
          </div>

          {/* Right — trust checklist */}
          <div className="about-cta-right" style={{
            background: isDark ? "rgba(255,107,0,0.05)" : "#fff7f0",
            borderLeft: `1px solid ${isDark ? "rgba(255,107,0,0.15)" : "rgba(255,107,0,0.12)"}`,
            flexDirection: "column", justifyContent: "center",
            padding: "52px 44px",
            gap: 18,
          }}>
            {[
              "Free 14-day trial, no credit card",
              "Set up in under 5 minutes",
              "All lead sources in one inbox",
              "Built for Indian real estate teams",
              "Cancel anytime, no lock-in",
            ].map((item) => (
              <div key={item} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ flexShrink: 0, width: 22, height: 22, borderRadius: "50%", background: "rgba(255,107,0,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Check style={{ width: 12, height: 12, color: "#ff6b00" }} />
                </div>
                <span style={{ fontSize: 14, color: heading, fontWeight: 500 }}>{item}</span>
              </div>
            ))}
          </div>

          <style>{`@keyframes shimmer { 0% { background-position: 0% 0%; } 100% { background-position: 200% 0%; } }`}</style>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
