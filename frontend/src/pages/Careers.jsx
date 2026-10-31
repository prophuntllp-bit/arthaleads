// pages/Careers.jsx - /careers on the shared marketing theme (components/site/*).
// Applications post to POST /api/careers/apply (backend/controllers/careersController.js),
// which emails the application with the resume attached. The apply form opens
// in a modal only after a click, so nothing touches window during prerender.
import { useState, useEffect, useRef } from "react";
import { useSEO } from "../utils/useSEO";
import api from "../services/api";
import { track } from "../utils/analytics";
import {
  MapPin, Clock, Briefcase, ChevronDown,
  TrendingUp, Users, Zap, Heart, ArrowRight, Mail,
  Target, Handshake, Megaphone, X, CheckCircle, Loader,
  Paperclip, Upload, Eye, Lightbulb, Rocket,
} from "lucide-react";
import { SitePage, Section, Container, SectionHeader, Card, SiteButton } from "../components/site/Site";
import { PageHero, PhotoVisual } from "../components/site/Blocks";
import { Reveal, CountUp } from "../components/motion/Motion";

const JOBS = [
  {
    id: "dme",
    title: "Digital Marketing Executive",
    department: "Marketing",
    location: "Pune, Maharashtra",
    type: "Full-time",
    experience: "1 to 3 years",
    icon: Megaphone,
    tagline: "Drive our brand presence and lead-gen campaigns across digital channels.",
    about:
      "We're looking for a creative and data-driven Digital Marketing Executive to own our social media, paid ads, and content strategy. You'll work directly with the founding team to grow Arthaleads' brand among real estate professionals across India.",
    responsibilities: [
      "Plan, run, and optimise Facebook, Instagram, and Google Ads campaigns for lead generation",
      "Create engaging content (graphics, short videos, copy) for social media and email newsletters",
      "Manage SEO strategy: keyword research, on-page optimisation, blog content briefs",
      "Track campaign KPIs (CPL, CTR, ROAS) and present weekly performance reports",
      "Run email marketing campaigns via tools like Mailchimp or similar",
      "Coordinate with the design team to produce marketing collateral",
      "Monitor competitor activity and identify growth opportunities",
    ],
    requirements: [
      "1 to 3 years of hands-on digital marketing experience (agency or in-house)",
      "Proficiency in Meta Ads Manager and Google Ads",
      "Working knowledge of Google Analytics 4 and Search Console",
      "Basic design skills: Canva, Figma, or Adobe Suite",
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
    experience: "1 to 3 years",
    icon: Handshake,
    tagline: "Build relationships with real estate developers and channel partners across Maharashtra.",
    about:
      "We're hiring a driven Business Development Executive to grow Arthaleads' customer base. You'll identify, pitch, and onboard real estate developers, builders, and channel partner companies who need a modern CRM. This is a high-impact role with direct visibility to the founding team.",
    responsibilities: [
      "Identify and reach out to real estate developers, builders, and channel partner networks in Pune and Maharashtra",
      "Conduct product demos and pitches, online and in-person",
      "Build and manage a sales pipeline from cold outreach to closed deal",
      "Achieve monthly lead and revenue targets",
      "Maintain accurate records in the CRM (yes, you'll use Arthaleads itself)",
      "Collect customer feedback and relay product insights to the team",
      "Attend real estate expos, networking events, and developer meets",
    ],
    requirements: [
      "1 to 3 years of B2B sales or business development experience",
      "Excellent spoken and written communication in English, Hindi, and Marathi",
      "Strong interpersonal skills; you enjoy meeting people and building relationships",
      "Familiarity with real estate industry (developers, channel partners, RERA) is a big plus",
      "Self-motivated with the ability to work independently and hit targets",
      "Bonus: prior experience selling SaaS or tech products",
    ],
  },
];

const PERKS = [
  { icon: TrendingUp, title: "Growth-first culture",  desc: "Direct access to the founders." },
  { icon: Zap,        title: "Fast-moving team",      desc: "Small team, no bureaucracy." },
  { icon: Users,      title: "Real estate exposure",  desc: "Work with the builders who use it." },
  { icon: Heart,      title: "Competitive pay",       desc: "Market salary plus incentives." },
];

const EXP_OPTIONS = [
  "Less than 1 year",
  "1 to 2 years",
  "2 to 3 years",
  "3 to 5 years",
  "5+ years",
];

const STATS = [
  { label: "Open positions",   value: "2" },
  { label: "Minutes to apply", value: "5 min" },
  { label: "Full-time roles",  value: "2" },
  { label: "Based in",         value: "Pune" },
];

const CULTURE = [
  { icon: Rocket,     title: "Ship every week",            desc: "Ship, learn, improve." },
  { icon: Target,     title: "Direct ownership",            desc: "You own your work end to end." },
  { icon: Eye,        title: "Transparent by default",     desc: "Metrics and decisions shared with all." },
  { icon: Lightbulb,  title: "Build from first principles", desc: "If there is a better way, we take it." },
  { icon: TrendingUp, title: "Grow with us",                desc: "Early joiners shape the company." },
  { icon: Handshake,  title: "Customer-obsessed",           desc: "Ideas come from real estate teams." },
];

const iconTile = { background: "rgba(255,107,0,0.10)", boxShadow: "inset 0 0 0 1px rgba(255,107,0,0.22)" };
const brandInk = { color: "var(--site-brand-ink)" };
const inputCls = "w-full min-h-[46px] rounded-2xl px-4 py-3 text-base sm:text-sm leading-5 outline-none transition focus:ring-2 focus:ring-[color:var(--site-brand)]";
const inputStyle = { background: "var(--site-bg)", border: "1px solid var(--site-field-line)", color: "var(--site-ink)" };

const MAX_RESUME_BYTES = 5 * 1024 * 1024; // 5 MB

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // result is "data:application/pdf;base64,<data>"; strip the prefix
      const base64 = reader.result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function Field({ label, required, hint, children, htmlFor }) {
  return (
    <div className="min-w-0">
      <label htmlFor={htmlFor} className="block text-[13px] font-semibold site-ink mb-1.5">
        {label}{required && <span style={brandInk}> *</span>}
        {hint && <span className="font-normal site-muted"> ({hint})</span>}
      </label>
      {children}
    </div>
  );
}

// ── Apply Modal ───────────────────────────────────────────────────────────────
function ApplyModal({ job, onClose }) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", linkedin: "", experience: "", note: "" });
  const [resumeFile, setResumeFile] = useState(null);
  const [resumeError, setResumeError] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | success | error
  const [errorMsg, setErrorMsg] = useState("");
  const fileInputRef = useRef(null);

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
      track("generate_lead", { form: "careers" });
      setStatus("success");
    } catch (err) {
      setErrorMsg(err.response?.data?.message || "Something went wrong. Please try again.");
      setStatus("error");
    }
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <style>{`
        @keyframes careersModalIn {
          from { opacity: 0; transform: scale(0.96) translateY(12px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
      <div
        role="dialog" aria-modal="true" aria-labelledby="apply-title"
        className="w-full max-w-[560px] max-h-[90vh] overflow-y-auto rounded-[24px] border"
        style={{
          background: "var(--site-card)", borderColor: "var(--site-line)", color: "var(--site-text)",
          boxShadow: "var(--site-shadow-lg)", animation: "careersModalIn 0.25s cubic-bezier(0.2,0.7,0.2,1)",
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-6 pt-6 pb-5 border-b" style={{ borderColor: "var(--site-line)" }}>
          <div className="flex items-center gap-3">
            <span className="site-icon w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={iconTile}>
              <Briefcase className="w-5 h-5" style={brandInk} aria-hidden="true" />
            </span>
            <div>
              <h2 id="apply-title" className="site-h3">{job.title}</h2>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="w-11 h-11 -mr-2 -mt-2 flex items-center justify-center rounded-full shrink-0 site-muted hover:opacity-80">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success state */}
        {status === "success" ? (
          <div className="px-6 py-12 text-center" role="status">
            <span className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-5" style={{ background: "rgba(22,163,74,0.12)" }}>
              <CheckCircle className="w-8 h-8" style={{ color: "#16a34a" }} aria-hidden="true" />
            </span>
            <h3 className="site-h3 !mb-2.5">Application submitted</h3>
            <p className="text-[15px] leading-relaxed max-w-sm mx-auto mb-7">
              Thanks for applying for <strong className="site-ink">{job.title}</strong>. Our HR team will review your application and get back to you at <strong style={brandInk}>{form.email}</strong>.
            </p>
            <SiteButton onClick={onClose}>Close</SiteButton>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Full Name" required htmlFor="cr-name">
                <input id="cr-name" required type="text" placeholder="Rahul Sharma" autoComplete="name"
                  value={form.name} onChange={e => set("name", e.target.value)} className={inputCls} style={inputStyle} />
              </Field>
              <Field label="Email Address" required htmlFor="cr-email">
                <input id="cr-email" required type="email" placeholder="rahul@example.com" autoComplete="email"
                  value={form.email} onChange={e => set("email", e.target.value)} className={inputCls} style={inputStyle} />
              </Field>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Phone Number" htmlFor="cr-phone">
                <input id="cr-phone" type="tel" placeholder="+91 98765 43210" autoComplete="tel"
                  value={form.phone} onChange={e => set("phone", e.target.value)} className={inputCls} style={inputStyle} />
              </Field>
              <Field label="Years of Experience" htmlFor="cr-exp">
                <select id="cr-exp" value={form.experience} onChange={e => set("experience", e.target.value)}
                  className={`${inputCls} cursor-pointer`} style={inputStyle}>
                  <option value="">Select...</option>
                  {EXP_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </Field>
            </div>

            <Field label="LinkedIn Profile URL" required htmlFor="cr-linkedin">
              <input id="cr-linkedin" required type="url" placeholder="https://linkedin.com/in/yourname"
                value={form.linkedin} onChange={e => set("linkedin", e.target.value)} className={inputCls} style={inputStyle} />
            </Field>

            {/* Resume upload: required */}
            <Field label="Resume / CV" required htmlFor="cr-resume">
              <input
                id="cr-resume"
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={handleResumeChange}
                className="sr-only"
                tabIndex={-1}
              />
              <div
                role="button" tabIndex={0}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInputRef.current?.click(); } }}
                className="flex items-center gap-3 rounded-2xl px-4 py-3 cursor-pointer transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[color:var(--site-brand)]"
                style={{
                  background: "var(--site-bg)",
                  border: `1px dashed ${resumeFile ? "var(--site-brand)" : resumeError ? "#dc2626" : "var(--site-line-strong)"}`,
                }}
              >
                {resumeFile ? (
                  <>
                    <Paperclip className="w-4 h-4 shrink-0" style={brandInk} aria-hidden="true" />
                    <span className="flex-1 min-w-0 truncate text-[13px] site-ink">{resumeFile.name}</span>
                    <span className="text-xs site-muted shrink-0">{(resumeFile.size / 1024).toFixed(0)} KB</span>
                    <button
                      type="button" aria-label="Remove file"
                      onClick={e => { e.stopPropagation(); setResumeFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                      className="w-9 h-9 -my-2 -mr-2 flex items-center justify-center shrink-0 site-muted"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 shrink-0 site-muted" aria-hidden="true" />
                    <span className="text-[13px] site-muted">
                      Click to upload PDF, DOC, or DOCX
                      <span className="ml-1.5 text-xs">(max 5 MB)</span>
                    </span>
                  </>
                )}
              </div>
              {resumeError && <p role="alert" className="mt-1.5 text-xs" style={{ color: "#dc2626" }}>{resumeError}</p>}
            </Field>

            <Field label="Why are you a great fit?" hint="optional" htmlFor="cr-note">
              <textarea id="cr-note" rows={3} placeholder="Tell us about yourself and why you want to join Arthaleads..."
                value={form.note} onChange={e => set("note", e.target.value)}
                className={`${inputCls} resize-y leading-relaxed`} style={inputStyle} />
            </Field>

            {status === "error" && (
              <p role="alert" className="rounded-2xl px-4 py-3 text-[13px] font-medium"
                style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.25)", color: "#dc2626" }}>
                {errorMsg}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <SiteButton type="submit" disabled={status === "loading"} className="disabled:opacity-60 disabled:cursor-not-allowed">
                {status === "loading"
                  ? <><Loader className="w-4 h-4 animate-spin" /> Submitting...</>
                  : <><Mail className="w-4 h-4" /> Submit application</>}
              </SiteButton>
              <span className="text-xs site-muted">Sent to hr@arthaleads.com</span>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Job Card ──────────────────────────────────────────────────────────────────
function JobCard({ job, onApply }) {
  const [open, setOpen] = useState(false);
  const Icon = job.icon;
  const panelId = `job-${job.id}`;

  return (
    <Card raised className="overflow-hidden transition-[border-color] duration-200"
      style={open ? { borderColor: "rgba(255,107,0,0.35)" } : undefined}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        className="w-full text-left p-5 sm:p-7"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex gap-4 items-start min-w-0">
            <span className="site-icon w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={iconTile}>
              <Icon className="w-[22px] h-[22px]" style={brandInk} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold mb-1.5">
                <span style={brandInk}>{job.department}</span>
                <span className="site-muted"> · {job.type}</span>
              </p>
              <h3 className="site-h3 !mb-1.5">{job.title}</h3>
              <p className="text-[14px] leading-relaxed mb-3">{job.tagline}</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {[
                  [MapPin, job.location],
                  [Clock, `${job.experience} exp.`],
                  [Briefcase, job.type],
                ].map(([Ic, txt]) => (
                  <span key={txt} className="inline-flex items-center gap-1.5 text-[13px] site-muted">
                    <Ic className="w-3.5 h-3.5" aria-hidden="true" />{txt}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <span
            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-transform duration-300"
            style={{ background: open ? "rgba(255,107,0,0.12)" : "var(--site-chip)", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
          >
            <ChevronDown className="w-4 h-4" style={open ? brandInk : undefined} aria-hidden="true" />
          </span>
        </div>
      </button>

      {/* Expandable details */}
      <div
        id={panelId}
        style={{ maxHeight: open ? 1400 : 0, overflow: "hidden", transition: "max-height 0.5s cubic-bezier(0.4,0,0.2,1)" }}
      >
        <div className="border-t px-5 sm:px-7 pt-6 pb-7 sm:pb-8" style={{ borderColor: "var(--site-line)" }}>
          <p className="text-[15px] leading-relaxed mb-6">{job.about}</p>

          <div className="grid md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-7">
            {[
              { label: "Responsibilities", items: job.responsibilities },
              { label: "Requirements",     items: job.requirements },
            ].map(({ label, items }) => (
              <div key={label} className="min-w-0">
                <h4 className="site-h4 !mb-3">{label}</h4>
                <ul className="space-y-2">
                  {items.map(r => (
                    <li key={r} className="flex items-start gap-2.5 text-[14px] leading-relaxed">
                      <span className="shrink-0 mt-[9px] w-1.5 h-1.5 rounded-full" style={{ background: "var(--site-brand)" }} aria-hidden="true" />
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <SiteButton onClick={() => onApply(job)}>
              <Mail className="w-4 h-4" /> Apply now <ArrowRight className="w-4 h-4" />
            </SiteButton>
            <span className="text-xs site-muted">Takes ~5 minutes</span>
          </div>
        </div>
      </div>
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function Careers() {
  const [applyJob, setApplyJob] = useState(null);

  useSEO({
    title:       "Careers at Arthaleads | Join India's Real Estate CRM Team",
    description: "Build the future of real estate technology at Arthaleads. We’re hiring for marketing and sales roles on our real estate lead management CRM.",
    canonical:   "https://www.arthaleads.com/careers",
  });

  function scrollToPositions() {
    document.getElementById("open-positions")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <SitePage>
      <PageHero
        eyebrow="We're actively hiring"
        title={<>Build the future of <span className="site-dim">real estate tech</span></>}
        lede="A small, fast team building the CRM for property sales in Maharashtra. Join early."
        actions={
          <div className="mt-7 flex flex-wrap gap-2.5 sm:gap-3 justify-center lg:justify-start">
            <SiteButton onClick={scrollToPositions} className="!px-6 sm:!px-7 sm:min-h-[3.5rem] sm:text-base">
              View open positions <ArrowRight className="w-4 h-4" />
            </SiteButton>
            <SiteButton href="mailto:hr@arthaleads.com" variant="secondary" className="!px-6 sm:!px-7 sm:min-h-[3.5rem] sm:text-base">
              <Mail className="w-4 h-4" /> Say hello
            </SiteButton>
          </div>
        }
        trust={false}
        visual={
          <PhotoVisual name="partner" alt="Three colleagues in a small office working together at a laptop"
            cards={[
              { Icon: MapPin, title: "Pune, Maharashtra", sub: "Where the team works" },
              { Icon: Briefcase, iconColor: "#16a34a", iconBg: "rgba(22,163,74,0.12)", title: "2 Open Positions", sub: "Marketing and Sales" },
              { Icon: Clock, title: "Full-time Roles", sub: "Apply in about 5 minutes" },
            ]} />
        }
      />

      {/* Stats strip */}
      <Section tone="tint" className="!py-12 sm:!py-14">
        <Container>
          <ul className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {STATS.map(({ label, value }, i) => (
              <Reveal as="li" key={label} delay={i * 80} className="min-w-0">
                <Card glow className="h-full p-5 sm:p-6 text-center">
                  <p className="font-display text-[34px] sm:text-[42px] leading-none font-extrabold site-dim"><CountUp value={value} /></p>
                  <p className="mt-2.5 text-[13px] site-muted font-medium">{label}</p>
                </Card>
              </Reveal>
            ))}
          </ul>
        </Container>
      </Section>

      {/* Open positions */}
      <Section tone="white" id="open-positions">
        <Container>
          <SectionHeader eyebrow="2 positions open" title="Open positions" align="center"
            lede="Open a role for the details, then apply." />
          <div className="grid lg:grid-cols-2 gap-4 items-start">
            {JOBS.map((job, i) => (
              <Reveal key={job.id} delay={i * 120}>
                <JobCard job={job} onApply={setApplyJob} />
              </Reveal>
            ))}
          </div>
        </Container>
      </Section>

      {/* Culture: the page's signature sand band */}
      <Section tone="sand">
        <Container>
          <SectionHeader eyebrow="Life at Arthaleads" title="How we work" align="center" />
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {CULTURE.map(({ icon: Icon, title, desc }, i) => (
              <Reveal key={title} delay={(i % 3) * 80} className="min-w-0 flex">
                <Card glow className="w-full p-4 sm:p-7">
                  <span className="site-icon w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center mb-4 sm:mb-5" style={iconTile}>
                    <Icon className="w-5 h-5 sm:w-[22px] sm:h-[22px]" style={brandInk} aria-hidden="true" />
                  </span>
                  <h3 className="site-h4 !mb-1.5">{title}</h3>
                  <p className="text-[14px] sm:text-[15px] leading-relaxed">{desc}</p>
                </Card>
              </Reveal>
            ))}
          </div>
        </Container>
      </Section>

      {/* Perks */}
      <Section tone="white">
        <Container>
          <SectionHeader eyebrow="Why join us" align="center"
            title={<>Built for people who want to <span className="site-dim">make an impact</span></>}
            lede="Every person here shapes how the product works." />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {PERKS.map(({ icon: Icon, title, desc }, i) => (
              <Reveal key={title} delay={i * 80} className="min-w-0 flex">
                <Card glow className="w-full p-4 sm:p-6">
                  <span className="site-icon w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center mb-4 sm:mb-5" style={iconTile}>
                    <Icon className="w-5 h-5 sm:w-[22px] sm:h-[22px]" style={brandInk} aria-hidden="true" />
                  </span>
                  <h3 className="site-h4 !mb-1.5">{title}</h3>
                  <p className="text-[14px] sm:text-[15px] leading-relaxed">{desc}</p>
                </Card>
              </Reveal>
            ))}
          </div>
        </Container>
      </Section>

      {/* Open application */}
      <Section tone="tint">
        <Container>
          <Reveal>
            <Card raised className="overflow-hidden grid sm:grid-cols-[1fr_240px] lg:grid-cols-[1fr_320px]">
              <div className="p-6 sm:p-10">
                <h2 className="site-h2 !mb-3">
                  Don't see the right role?
                </h2>
                <p className="text-[15px] leading-relaxed mb-7 max-w-md">
                  Excited about real estate tech? Drop us a note. We read every one.
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <SiteButton href="mailto:hr@arthaleads.com?subject=General Application - Arthaleads">
                    <Mail className="w-4 h-4" /> Send us a note
                  </SiteButton>
                  <span className="text-sm">or email <a href="mailto:hr@arthaleads.com" className="site-link">hr@arthaleads.com</a></span>
                </div>
              </div>
              <ul className="hidden sm:flex flex-col items-center justify-center gap-5 p-6 border-l"
                style={{ background: "rgba(255,107,0,0.06)", borderColor: "var(--site-line)" }}>
                {[
                  { val: "Every", label: "Note gets a reply" },
                  { val: "Pune", label: "Office" },
                  { val: "Full-time", label: "Roles" },
                ].map(({ val, label }) => (
                  <li key={label} className="text-center">
                    <p className="site-h3 leading-none" style={brandInk}>{val}</p>
                    <p className="text-[13px] site-muted mt-1 font-medium">{label}</p>
                  </li>
                ))}
              </ul>
            </Card>
          </Reveal>
        </Container>
      </Section>

      {applyJob && <ApplyModal job={applyJob} onClose={() => setApplyJob(null)} />}
    </SitePage>
  );
}
