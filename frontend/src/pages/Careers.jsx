import { useState, useEffect, useRef } from "react";
import { usePublicTheme } from "../context/PublicThemeContext";
import PublicNav from "../components/PublicNav";
import PublicFooter from "../components/PublicFooter";
import api from "../services/api";
import {
  MapPin, Clock, Briefcase, ChevronDown, ChevronUp,
  TrendingUp, Users, Zap, Heart, ArrowRight, Mail,
  Target, Handshake, Megaphone, X, CheckCircle, Loader,
  Paperclip, Upload,
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

const EXP_OPTIONS = [
  "Less than 1 year",
  "1–2 years",
  "2–3 years",
  "3–5 years",
  "5+ years",
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

const MAX_RESUME_BYTES = 5 * 1024 * 1024; // 5 MB

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // result is "data:application/pdf;base64,<data>" — strip the prefix
      const base64 = reader.result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── Apply Modal ───────────────────────────────────────────────────────────────
function ApplyModal({ job, isDark, onClose }) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", linkedin: "", experience: "", note: "" });
  const [resumeFile, setResumeFile] = useState(null);
  const [resumeError, setResumeError] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | success | error
  const [errorMsg, setErrorMsg] = useState("");
  const fileInputRef = useRef(null);

  const heading  = isDark ? "#ffffff" : "#111827";
  const body     = isDark ? "rgba(255,255,255,0.55)" : "#6b7280";
  const inputBg  = isDark ? "rgba(255,255,255,0.05)" : "#f9fafb";
  const inputBdr = isDark ? "rgba(255,255,255,0.1)" : "#d1d5db";
  const modalBg  = isDark ? "#1a1a2e" : "#ffffff";

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  function set(field, val) {
    setForm(prev => ({ ...prev, [field]: val }));
  }

  function handleResumeChange(e) {
    const file = e.target.files?.[0];
    setResumeError("");
    if (!file) { setResumeFile(null); return; }
    const allowed = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    if (!allowed.includes(file.type)) {
      setResumeError("Only PDF, DOC, or DOCX files are accepted.");
      setResumeFile(null);
      return;
    }
    if (file.size > MAX_RESUME_BYTES) {
      setResumeError("File size must be under 5 MB.");
      setResumeFile(null);
      return;
    }
    setResumeFile(file);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.linkedin.trim()) return;
    if (!resumeFile) { setResumeError("Please attach your resume."); return; }
    setStatus("loading");
    setErrorMsg("");
    try {
      const resumeBase64 = await readFileAsBase64(resumeFile);
      await api.post("/careers/apply", {
        role:           job.title,
        name:           form.name.trim(),
        email:          form.email.trim(),
        phone:          form.phone.trim(),
        linkedin:       form.linkedin.trim(),
        experience:     form.experience,
        note:           form.note.trim(),
        resumeBase64,
        resumeFilename: resumeFile.name,
        resumeMime:     resumeFile.type,
      });
      setStatus("success");
    } catch (err) {
      setErrorMsg(err.response?.data?.message || "Something went wrong. Please try again.");
      setStatus("error");
    }
  }

  const inputStyle = {
    width: "100%",
    background: inputBg,
    border: `1px solid ${inputBdr}`,
    borderRadius: 10,
    padding: "10px 14px",
    fontSize: 14,
    color: heading,
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.2s",
    fontFamily: "inherit",
  };

  const labelStyle = {
    display: "block",
    fontSize: 12,
    fontWeight: 600,
    color: body,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  };

  const req = <span style={{ color: "#ef4444" }}>*</span>;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "16px",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: modalBg,
          borderRadius: 20,
          width: "100%",
          maxWidth: 540,
          maxHeight: "90vh",
          overflowY: "auto",
          border: `1px solid ${job.color}33`,
          boxShadow: `0 24px 60px rgba(0,0,0,0.35), 0 0 0 1px ${job.color}22`,
          animation: "modalIn 0.25s cubic-bezier(0.34,1.56,0.64,1)",
        }}
      >
        <style>{`
          @keyframes modalIn {
            from { opacity: 0; transform: scale(0.93) translateY(16px); }
            to   { opacity: 1; transform: scale(1) translateY(0); }
          }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>

        {/* Header */}
        <div style={{
          padding: "24px 24px 20px",
          borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.07)" : "#f3f4f6"}`,
          display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12,
        }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12, flexShrink: 0,
              background: job.color + "18",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Briefcase style={{ width: 20, height: 20, color: job.color }} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: job.color, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 2 }}>
                Apply Now
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: heading, lineHeight: 1.2 }}>{job.title}</div>
            </div>
          </div>
          <button onClick={onClose} style={{
            background: "none", border: "none", cursor: "pointer", padding: 4,
            color: body, flexShrink: 0, marginTop: 2,
          }}>
            <X style={{ width: 20, height: 20 }} />
          </button>
        </div>

        {/* Success state */}
        {status === "success" ? (
          <div style={{ padding: "48px 24px", textAlign: "center" }}>
            <div style={{
              width: 64, height: 64, borderRadius: "50%",
              background: "#22c55e18", display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 20px",
            }}>
              <CheckCircle style={{ width: 32, height: 32, color: "#22c55e" }} />
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: heading, marginBottom: 10 }}>Application Submitted!</div>
            <div style={{ fontSize: 14, color: body, lineHeight: 1.7, maxWidth: 340, margin: "0 auto 28px" }}>
              Thanks for applying for <strong style={{ color: heading }}>{job.title}</strong>. Our HR team will review your application and get back to you at <strong style={{ color: job.color }}>{form.email}</strong>.
            </div>
            <button
              onClick={onClose}
              style={{
                background: job.color, color: "#fff", border: "none",
                borderRadius: 10, padding: "10px 24px", fontSize: 14, fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ padding: "24px" }}>

            {/* Row 1: Name + Email */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>Full Name {req}</label>
                <input required type="text" placeholder="Rahul Sharma"
                  value={form.name} onChange={e => set("name", e.target.value)}
                  style={inputStyle}
                  onFocus={e => e.target.style.borderColor = job.color}
                  onBlur={e => e.target.style.borderColor = inputBdr}
                />
              </div>
              <div>
                <label style={labelStyle}>Email Address {req}</label>
                <input required type="email" placeholder="rahul@example.com"
                  value={form.email} onChange={e => set("email", e.target.value)}
                  style={inputStyle}
                  onFocus={e => e.target.style.borderColor = job.color}
                  onBlur={e => e.target.style.borderColor = inputBdr}
                />
              </div>
            </div>

            {/* Row 2: Phone + Experience */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>Phone Number</label>
                <input type="tel" placeholder="+91 98765 43210"
                  value={form.phone} onChange={e => set("phone", e.target.value)}
                  style={inputStyle}
                  onFocus={e => e.target.style.borderColor = job.color}
                  onBlur={e => e.target.style.borderColor = inputBdr}
                />
              </div>
              <div>
                <label style={labelStyle}>Years of Experience</label>
                <select value={form.experience} onChange={e => set("experience", e.target.value)}
                  style={{ ...inputStyle, cursor: "pointer" }}
                  onFocus={e => e.target.style.borderColor = job.color}
                  onBlur={e => e.target.style.borderColor = inputBdr}
                >
                  <option value="">Select...</option>
                  {EXP_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            </div>

            {/* LinkedIn — required */}
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>LinkedIn Profile URL {req}</label>
              <input required type="url" placeholder="https://linkedin.com/in/yourname"
                value={form.linkedin} onChange={e => set("linkedin", e.target.value)}
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = job.color}
                onBlur={e => e.target.style.borderColor = inputBdr}
              />
            </div>

            {/* Resume upload — required */}
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Resume / CV {req}</label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={handleResumeChange}
                style={{ display: "none" }}
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  background: inputBg,
                  border: `1px dashed ${resumeFile ? job.color : resumeError ? "#ef4444" : inputBdr}`,
                  borderRadius: 10,
                  padding: "12px 16px",
                  cursor: "pointer",
                  transition: "border-color 0.2s, background 0.2s",
                }}
                onMouseEnter={e => e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.08)" : "#f3f4f6"}
                onMouseLeave={e => e.currentTarget.style.background = inputBg}
              >
                {resumeFile ? (
                  <>
                    <Paperclip style={{ width: 16, height: 16, color: job.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: heading, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {resumeFile.name}
                    </span>
                    <span style={{ fontSize: 11, color: body, flexShrink: 0 }}>
                      {(resumeFile.size / 1024).toFixed(0)} KB
                    </span>
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); setResumeFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: body, flexShrink: 0 }}
                    >
                      <X style={{ width: 14, height: 14 }} />
                    </button>
                  </>
                ) : (
                  <>
                    <Upload style={{ width: 16, height: 16, color: body, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: body }}>
                      Click to upload PDF, DOC, or DOCX
                      <span style={{ marginLeft: 6, fontSize: 11, color: isDark ? "rgba(255,255,255,0.3)" : "#9ca3af" }}>
                        (max 5 MB)
                      </span>
                    </span>
                  </>
                )}
              </div>
              {resumeError && (
                <p style={{ margin: "6px 0 0", fontSize: 12, color: "#ef4444" }}>{resumeError}</p>
              )}
            </div>

            {/* Cover note */}
            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>
                Why are you a great fit?
                <span style={{ fontWeight: 400, textTransform: "none", marginLeft: 6, color: body, fontSize: 11 }}>(optional)</span>
              </label>
              <textarea rows={3} placeholder="Tell us about yourself and why you want to join Arthaleads..."
                value={form.note} onChange={e => set("note", e.target.value)}
                style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }}
                onFocus={e => e.target.style.borderColor = job.color}
                onBlur={e => e.target.style.borderColor = inputBdr}
              />
            </div>

            {status === "error" && (
              <div style={{
                background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10,
                padding: "10px 14px", fontSize: 13, color: "#dc2626", marginBottom: 16,
              }}>
                {errorMsg}
              </div>
            )}

            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <button
                type="submit"
                disabled={status === "loading"}
                style={{
                  background: status === "loading" ? job.color + "99" : job.color,
                  color: "#fff", border: "none", borderRadius: 10,
                  padding: "11px 24px", fontSize: 14, fontWeight: 600,
                  cursor: status === "loading" ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", gap: 8,
                  transition: "opacity 0.2s",
                }}
              >
                {status === "loading"
                  ? <><Loader style={{ width: 16, height: 16, animation: "spin 0.8s linear infinite" }} /> Submitting...</>
                  : <><Mail style={{ width: 16, height: 16 }} /> Submit Application</>
                }
              </button>
              <span style={{ fontSize: 12, color: body }}>Sent to hr@arthaleads.com</span>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Animated counter (reusable) ───────────────────────────────────────────────
function AnimCounter({ to, suffix = "", dur = 1400 }) {
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
  return <span ref={ref}>{val}{suffix}</span>;
}

// ── Job Card ──────────────────────────────────────────────────────────────────
function JobCard({ job, isDark, index, onApply }) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [cardRef, cardVisible] = useVisible(0.08);
  const Icon = job.icon;

  const cardBg  = isDark ? "rgba(255,255,255,0.03)" : "#ffffff";
  const cardBdr = isDark ? "rgba(255,255,255,0.08)" : "#e5e7eb";
  const heading = isDark ? "#ffffff" : "#111827";
  const body    = isDark ? "rgba(255,255,255,0.55)" : "#6b7280";
  const divider = isDark ? "rgba(255,255,255,0.07)" : "#f3f4f6";

  return (
    <div
      ref={cardRef}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "relative",
        background: cardBg,
        border: `1px solid ${open || hovered ? job.color + "55" : cardBdr}`,
        boxShadow: open ? `0 20px 60px ${job.color}20` : hovered ? `0 8px 28px ${job.color}14` : "none",
        borderRadius: 20,
        opacity: cardVisible ? 1 : 0,
        transform: cardVisible ? "translateY(0)" : "translateY(32px)",
        transition: `opacity 0.65s ease ${index * 0.18}s, transform 0.65s ease ${index * 0.18}s, border 0.22s, box-shadow 0.22s`,
        overflow: "hidden",
      }}
    >
      {/* Colored top accent bar */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 3,
        background: `linear-gradient(90deg, ${job.color}, ${job.color}44)`,
        opacity: open || hovered ? 1 : 0,
        transition: "opacity 0.22s",
      }} />

      <button
        onClick={() => setOpen(o => !o)}
        className="w-full text-left"
        style={{ padding: "28px 28px 24px", cursor: "pointer" }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
            {/* Icon with glow */}
            <div style={{
              flexShrink: 0, width: 52, height: 52, borderRadius: 16,
              background: open || hovered ? job.color + "22" : job.color + "12",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: open || hovered ? `0 4px 20px ${job.color}35` : "none",
              transition: "background 0.22s, box-shadow 0.22s",
            }}>
              <Icon style={{ width: 24, height: 24, color: job.color }} />
            </div>
            <div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
                <span style={{
                  fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em",
                  padding: "3px 10px", borderRadius: 20,
                  background: job.color + "18", color: job.color,
                }}>{job.department}</span>
                <span style={{
                  fontSize: 11, padding: "3px 10px", borderRadius: 20,
                  background: isDark ? "rgba(255,255,255,0.07)" : "#f3f4f6", color: body,
                }}>{job.type}</span>
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 800, color: heading, marginBottom: 4, lineHeight: 1.2 }}>{job.title}</h3>
              <p style={{ fontSize: 13, color: body, marginBottom: 10 }}>{job.tagline}</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
                {[
                  [MapPin, job.location],
                  [Clock, `${job.experience} exp.`],
                  [Briefcase, job.type],
                ].map(([Ic, txt]) => (
                  <span key={txt} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: body }}>
                    <Ic style={{ width: 13, height: 13 }} />{txt}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Expand toggle */}
          <div style={{
            flexShrink: 0, width: 36, height: 36, borderRadius: "50%",
            background: open ? job.color + "18" : isDark ? "rgba(255,255,255,0.06)" : "#f3f4f6",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "background 0.2s, transform 0.3s",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}>
            <ChevronDown style={{ width: 16, height: 16, color: open ? job.color : body }} />
          </div>
        </div>
      </button>

      {/* Expandable details */}
      <div style={{
        maxHeight: open ? 1400 : 0,
        overflow: "hidden",
        transition: "max-height 0.5s cubic-bezier(0.4,0,0.2,1)",
      }}>
        <div style={{ borderTop: `1px solid ${divider}`, padding: "24px 28px 32px" }}>
          <p style={{ fontSize: 14, lineHeight: 1.75, color: body, marginBottom: 24 }}>{job.about}</p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 28 }}>
            {[
              { label: "Responsibilities", items: job.responsibilities },
              { label: "Requirements",     items: job.requirements },
            ].map(({ label, items }) => (
              <div key={label}>
                <div style={{
                  fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em",
                  color: job.color, marginBottom: 12,
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                  <span style={{ display: "inline-block", width: 16, height: 2, background: job.color, borderRadius: 2 }} />
                  {label}
                </div>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                  {items.map(r => (
                    <li key={r} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13, color: body, lineHeight: 1.6 }}>
                      <span style={{
                        flexShrink: 0, marginTop: 7, width: 6, height: 6, borderRadius: "50%",
                        background: job.color + "88",
                      }} />
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 28, display: "flex", alignItems: "center", gap: 12 }}>
            <button
              onClick={() => onApply(job)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                background: job.color, color: "#fff", border: "none",
                borderRadius: 12, padding: "11px 22px", fontSize: 14, fontWeight: 700,
                cursor: "pointer", transition: "transform 0.18s, box-shadow 0.18s",
                boxShadow: `0 4px 20px ${job.color}44`,
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `0 8px 28px ${job.color}55`; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = `0 4px 20px ${job.color}44`; }}
            >
              <Mail style={{ width: 15, height: 15 }} />
              Apply Now
              <ArrowRight style={{ width: 15, height: 15 }} />
            </button>
            <span style={{ fontSize: 12, color: body }}>Takes ~5 minutes</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
const STATS = [
  { label: "Open Positions",  to: 2,  suffix: "",   color: "#ff6b00" },
  { label: "Minutes to Apply",to: 5,  suffix: " min",color: "#f59e0b" },
  { label: "Response Time",   to: 48, suffix: "h",  color: "#22c55e" },
  { label: "Team Size",       to: 10, suffix: "+",  color: "#3b82f6" },
];

const CULTURE = [
  { emoji: "🚀", title: "Ship every week",         desc: "We don't wait for perfection. We ship, learn, and improve continuously." },
  { emoji: "🎯", title: "Direct ownership",         desc: "You own your work end-to-end. No hand-offs, no waiting for approvals." },
  { emoji: "💬", title: "Transparent by default",  desc: "All company metrics, decisions, and direction shared with the full team." },
  { emoji: "🏗️", title: "Build from first principles", desc: "We question everything. If there's a better way, we do it that way." },
  { emoji: "📈", title: "Grow with us",             desc: "Early team members have grown faster here than anywhere before." },
  { emoji: "🤝", title: "Customer-obsessed",        desc: "Our best ideas come from spending time with real estate teams in Pune." },
];

export default function Careers() {
  const { isDark } = usePublicTheme();
  const [applyJob, setApplyJob] = useState(null);
  const [statsRef, statsVisible] = useVisible(0.2);
  const [cultureRef, cultureVisible] = useVisible(0.1);
  const [perksRef, perksVisible] = useVisible(0.1);
  const [jobsRef, jobsVisible] = useVisible(0.08);
  const positionsRef = useRef(null);

  const pageBg    = isDark ? "#0d0d1a" : "#f8fafc";
  const sectionBg = isDark ? "rgba(255,255,255,0.02)" : "#ffffff";
  const sectionBdr= isDark ? "rgba(255,255,255,0.06)" : "#e5e7eb";
  const heading   = isDark ? "#ffffff" : "#111827";
  const body      = isDark ? "rgba(255,255,255,0.55)" : "#6b7280";

  useEffect(() => {
    document.title = "Careers — Arthaleads";
    return () => { document.title = "Arthaleads - Real Estate CRM"; };
  }, []);

  function scrollToPositions() {
    positionsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div style={{ background: pageBg, minHeight: "100vh" }}>
      <PublicNav />

      {/* ── Hero ── */}
      <section style={{
        position: "relative", overflow: "hidden",
        background: isDark ? "#0d0d1a" : "#f8fafc",
        paddingTop: 112, paddingBottom: 96,
      }}>
        {/* Background blobs */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          <div style={{
            position: "absolute", top: "-20%", right: "-10%",
            width: 600, height: 600, borderRadius: "50%",
            background: isDark ? "radial-gradient(circle, rgba(255,107,0,0.18) 0%, transparent 70%)" : "radial-gradient(circle, rgba(255,107,0,0.1) 0%, transparent 70%)",
            filter: "blur(60px)", animation: "orbDrift1 8s ease-in-out infinite",
          }} />
          <div style={{
            position: "absolute", bottom: "-30%", left: "-10%",
            width: 500, height: 500, borderRadius: "50%",
            background: isDark ? "radial-gradient(circle, rgba(59,130,246,0.14) 0%, transparent 70%)" : "radial-gradient(circle, rgba(59,130,246,0.07) 0%, transparent 70%)",
            filter: "blur(70px)", animation: "orbDrift2 10s ease-in-out infinite",
          }} />
          {/* Dot grid */}
          <div style={{
            position: "absolute", inset: 0, opacity: isDark ? 0.04 : 0.025,
            backgroundImage: isDark ? "radial-gradient(rgba(255,255,255,0.8) 1px, transparent 1px)" : "radial-gradient(rgba(0,0,0,0.5) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }} />
        </div>

        <div style={{ maxWidth: 800, margin: "0 auto", padding: "0 24px", textAlign: "center", position: "relative" }}>
          {/* Badge */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "6px 16px", borderRadius: 40,
            border: "1px solid rgba(255,107,0,0.35)",
            background: "rgba(255,107,0,0.1)",
            marginBottom: 28,
            animation: "fadeUp 0.6s ease both",
          }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e", animation: "pulse 2s infinite" }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: "#ff6b00", textTransform: "uppercase", letterSpacing: "0.1em" }}>
              We're Actively Hiring
            </span>
          </div>

          {/* Headline */}
          <h1 style={{
            fontSize: "clamp(36px, 6vw, 64px)", fontWeight: 900, lineHeight: 1.1,
            color: heading, marginBottom: 20,
            animation: "fadeUp 0.7s ease 0.1s both",
          }}>
            Build the future of{" "}
            <span style={{
              background: "linear-gradient(135deg, #ff6b00, #ffaa00)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>
              real estate tech
            </span>
          </h1>

          {/* Sub */}
          <p style={{
            fontSize: 17, lineHeight: 1.75, color: body,
            maxWidth: 560, margin: "0 auto 36px",
            animation: "fadeUp 0.7s ease 0.2s both",
          }}>
            We're a small, fast-moving team building the CRM that powers property sales
            across Maharashtra. Join us before we get big.
          </p>

          {/* CTA row */}
          <div style={{
            display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap",
            marginBottom: 52,
            animation: "fadeUp 0.6s ease 0.3s both",
          }}>
            <button
              onClick={scrollToPositions}
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                background: "#ff6b00", color: "#fff", border: "none",
                borderRadius: 12, padding: "13px 26px", fontSize: 15, fontWeight: 700,
                cursor: "pointer", boxShadow: "0 8px 32px rgba(255,107,0,0.4)",
                transition: "transform 0.18s, box-shadow 0.18s",
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 12px 40px rgba(255,107,0,0.5)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 8px 32px rgba(255,107,0,0.4)"; }}
            >
              View Open Positions
              <ArrowRight style={{ width: 16, height: 16 }} />
            </button>
            <a
              href="mailto:hr@arthaleads.com"
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                background: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)",
                color: body,
                border: `1px solid ${isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.10)"}`,
                borderRadius: 12, padding: "13px 26px", fontSize: 15, fontWeight: 600,
                textDecoration: "none", transition: "background 0.18s",
              }}
              onMouseEnter={e => e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.11)" : "rgba(0,0,0,0.08)"}
              onMouseLeave={e => e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)"}
            >
              <Mail style={{ width: 16, height: 16 }} />
              Say Hello
            </a>
          </div>

          {/* Floating info chips */}
          <div style={{
            display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap",
            animation: "fadeUp 0.6s ease 0.42s both",
          }}>
            {[
              { icon: MapPin,   txt: "Pune, Maharashtra",  clr: "#ff6b00" },
              { icon: Briefcase,txt: "2 Open Positions",   clr: "#22c55e", pulse: true },
              { icon: Clock,    txt: "Full-time Roles",    clr: "#3b82f6" },
            ].map(({ icon: Ic, txt, clr, pulse }) => (
              <div key={txt} style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "7px 14px", borderRadius: 30,
                background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)",
                border: `1px solid ${isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)"}`,
              }}>
                {pulse && <span style={{ width: 6, height: 6, borderRadius: "50%", background: clr, animation: "pulse 2s infinite" }} />}
                {!pulse && <Ic style={{ width: 12, height: 12, color: clr }} />}
                <span style={{ fontSize: 12, color: body, fontWeight: 500 }}>{txt}</span>
              </div>
            ))}
          </div>
        </div>

        <style>{`
          @keyframes fadeUp    { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
          @keyframes orbDrift1 { 0%,100% { transform:translate(0,0); } 50% { transform:translate(-30px,20px); } }
          @keyframes orbDrift2 { 0%,100% { transform:translate(0,0); } 50% { transform:translate(20px,-25px); } }
          @keyframes pulse     { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
        `}</style>
      </section>

      {/* ── Animated Stats Strip ── */}
      <section ref={statsRef} style={{
        background: isDark ? "rgba(255,255,255,0.02)" : "#fff",
        borderTop: `1px solid ${sectionBdr}`,
        borderBottom: `1px solid ${sectionBdr}`,
        padding: "32px 24px",
      }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 0 }}>
          {STATS.map(({ label, to, suffix, color }, i) => (
            <div key={label} style={{
              textAlign: "center", padding: "12px 20px",
              borderRight: i < STATS.length - 1 ? `1px solid ${sectionBdr}` : "none",
              opacity: statsVisible ? 1 : 0,
              transform: statsVisible ? "translateY(0)" : "translateY(16px)",
              transition: `opacity 0.55s ease ${i * 0.1}s, transform 0.55s ease ${i * 0.1}s`,
            }}>
              <div style={{ fontSize: 36, fontWeight: 900, color, lineHeight: 1, marginBottom: 6 }}>
                <AnimCounter to={to} suffix={suffix} />
              </div>
              <div style={{ fontSize: 12, color: body, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.07em" }}>{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Perks ── */}
      <section ref={perksRef} style={{ padding: "72px 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <div style={{
              fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.14em",
              color: "#ff6b00", marginBottom: 10,
            }}>Why join us</div>
            <h2 style={{ fontSize: "clamp(26px, 4vw, 38px)", fontWeight: 900, color: heading, marginBottom: 12 }}>
              Built for people who want to{" "}
              <span style={{ color: "#ff6b00" }}>make an impact</span>
            </h2>
            <p style={{ fontSize: 15, color: body, maxWidth: 480, margin: "0 auto" }}>
              Small team. Big real-estate market. Every person here shapes how the product works.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 16 }}>
            {PERKS.map(({ icon: Icon, title, desc, color }, i) => (
              <div key={title}
                style={{
                  padding: "24px 22px",
                  borderRadius: 18,
                  background: sectionBg,
                  border: `1px solid ${sectionBdr}`,
                  opacity: perksVisible ? 1 : 0,
                  transform: perksVisible ? "translateY(0) scale(1)" : "translateY(24px) scale(0.97)",
                  transition: `opacity 0.55s ease ${i * 0.1}s, transform 0.55s ease ${i * 0.1}s, box-shadow 0.22s, border 0.22s`,
                  cursor: "default",
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.boxShadow = `0 12px 36px ${color}22`;
                  e.currentTarget.style.borderColor = color + "44";
                  e.currentTarget.style.transform = "translateY(-4px) scale(1)";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.boxShadow = "none";
                  e.currentTarget.style.borderColor = sectionBdr;
                  e.currentTarget.style.transform = "translateY(0) scale(1)";
                }}
              >
                <div style={{
                  width: 44, height: 44, borderRadius: 14,
                  background: color + "18",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  marginBottom: 14,
                }}>
                  <Icon style={{ width: 20, height: 20, color }} />
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: heading, marginBottom: 6 }}>{title}</div>
                <div style={{ fontSize: 13, color: body, lineHeight: 1.65 }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Culture Grid ── */}
      <section ref={cultureRef} style={{
        background: isDark ? "#0d0d1a" : "#111827",
        padding: "72px 24px",
      }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 52 }}>
            <div style={{
              fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.14em",
              color: "#ff6b00", marginBottom: 10,
            }}>Life at Arthaleads</div>
            <h2 style={{ fontSize: "clamp(26px, 4vw, 38px)", fontWeight: 900, color: "#ffffff", marginBottom: 0 }}>
              How we work
            </h2>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
            {CULTURE.map(({ emoji, title, desc }, i) => (
              <div key={title}
                style={{
                  padding: "22px 20px",
                  borderRadius: 16,
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  opacity: cultureVisible ? 1 : 0,
                  transform: cultureVisible ? "translateY(0)" : "translateY(24px)",
                  transition: `opacity 0.55s ease ${i * 0.08}s, transform 0.55s ease ${i * 0.08}s, background 0.2s, border 0.2s`,
                  cursor: "default",
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = "rgba(255,107,0,0.07)";
                  e.currentTarget.style.borderColor = "rgba(255,107,0,0.22)";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
                }}
              >
                <div style={{ fontSize: 28, marginBottom: 12 }}>{emoji}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#ffffff", marginBottom: 6 }}>{title}</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.65 }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Open Positions ── */}
      <section ref={positionsRef} style={{ padding: "72px 24px" }}>
        <div style={{ maxWidth: 860, margin: "0 auto" }}>
          <div ref={jobsRef} style={{ textAlign: "center", marginBottom: 48,
            opacity: jobsVisible ? 1 : 0,
            transform: jobsVisible ? "translateY(0)" : "translateY(20px)",
            transition: "opacity 0.6s ease, transform 0.6s ease",
          }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "5px 14px", borderRadius: 30, marginBottom: 14,
              background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)",
            }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", animation: "pulse 2s infinite" }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: "#22c55e", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                2 Positions Open
              </span>
            </div>
            <h2 style={{ fontSize: "clamp(26px, 4vw, 40px)", fontWeight: 900, color: heading }}>
              Open Positions
            </h2>
            <p style={{ fontSize: 15, color: body, marginTop: 8 }}>
              Click a role to see the full details, then hit Apply Now.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {JOBS.map((job, i) => (
              <JobCard key={job.id} job={job} isDark={isDark} index={i} onApply={setApplyJob} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section style={{ padding: "0 24px 80px" }}>
        <div style={{ maxWidth: 700, margin: "0 auto" }}>
          <div style={{
            borderRadius: 28, padding: "52px 40px", textAlign: "center",
            background: "linear-gradient(135deg, #0d0d1a 0%, #1a0d00 100%)",
            border: "1px solid rgba(255,107,0,0.25)",
            boxShadow: "0 24px 60px rgba(255,107,0,0.12)",
            position: "relative", overflow: "hidden",
          }}>
            <div style={{
              position: "absolute", top: "-40%", left: "50%", transform: "translateX(-50%)",
              width: 400, height: 300,
              background: "radial-gradient(ellipse, rgba(255,107,0,0.18) 0%, transparent 70%)",
              pointerEvents: "none",
            }} />
            <div style={{
              position: "relative",
              width: 52, height: 52, borderRadius: 16,
              background: "rgba(255,107,0,0.15)",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 20px",
            }}>
              <Target style={{ width: 24, height: 24, color: "#ff6b00" }} />
            </div>
            <h3 style={{ fontSize: 26, fontWeight: 900, color: "#ffffff", marginBottom: 10, position: "relative" }}>
              Don't see the right role?
            </h3>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.55)", lineHeight: 1.75, marginBottom: 28, maxWidth: 420, margin: "0 auto 28px", position: "relative" }}>
              We're always open to hearing from talented people who are excited about real estate tech. Send us a note and we'll keep you in mind.
            </p>
            <a
              href="mailto:hr@arthaleads.com?subject=General Application — Arthaleads"
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                background: "#ff6b00", color: "#fff",
                borderRadius: 12, padding: "12px 24px", fontSize: 14, fontWeight: 700,
                textDecoration: "none",
                boxShadow: "0 6px 24px rgba(255,107,0,0.4)",
                transition: "transform 0.18s, box-shadow 0.18s",
                position: "relative",
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 10px 32px rgba(255,107,0,0.5)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 6px 24px rgba(255,107,0,0.4)"; }}
            >
              <Mail style={{ width: 15, height: 15 }} />
              hr@arthaleads.com
            </a>
          </div>
        </div>
      </section>

      <PublicFooter />

      {applyJob && (
        <ApplyModal job={applyJob} isDark={isDark} onClose={() => setApplyJob(null)} />
      )}
    </div>
  );
}
