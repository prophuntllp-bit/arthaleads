// pages/BookDemo.jsx - /book-demo, the detailed demo request (26 Oct 2026).
//
// Every "Book a demo" button on the marketing site points here. Three short
// steps (you, your business, the demo) so a detailed form never feels long.
// Requests go to POST /api/demo-requests: saved as a DemoRequest for the super
// admin panel (Demo requests) and emailed to the super admins and
// contact@arthaleads.com; the visitor gets a confirmation email. Not a CRM lead.
// Rendered by entry-prerender.jsx too, so nothing touches window during render.
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, CircleCheck, Clock3, IndianRupee, Play, Sparkles } from "lucide-react";
import { SitePage, Section, Container, SiteButton, SiteImage, Card } from "../components/site/Site";
import { WhatsAppLogo } from "../components/site/BrandLogos";
import { useSEO } from "../utils/useSEO";
import { getRecaptchaToken } from "../utils/recaptcha";
import { waLink, WA_MESSAGES } from "../utils/crmLinks";
import { track } from "../utils/analytics";
import YouTubePlayer from "../components/site/YouTubePlayer";

// Must match the allowed values in backend/controllers/demoRequestController.js.
const ROLES = ["Owner / Director", "Sales head", "Marketing", "Broker", "Other"];
const BUSINESS = ["Builder / Developer", "Broker", "Channel partner"];
const TEAM = ["1-5", "6-10", "11-30", "31-100", "100+"];
const LEADS = ["Under 100", "100-500", "500-2,000", "2,000+"];
const SOURCES = ["Facebook", "Google", "WhatsApp", "Website", "Property portals", "Walk-ins"];
const TIMES = ["Morning (10 AM-1 PM)", "Afternoon (2-5 PM)", "Evening (5-7 PM)"];
const FORMATS = ["Video call", "Phone call", "In person (Pune)"];
const LANGS = ["English", "Hindi", "Marathi"];

const COVERS = [
  { Icon: Clock3, title: "30 minutes, at your time", body: "A short call on the day and time you pick, in English, Hindi or Marathi." },
  { Icon: Sparkles, title: "Your leads, your projects", body: "We set up the demo around how your team sells: your lead sources, projects and follow-ups." },
  { Icon: WhatsAppLogo, title: "The WhatsApp AI agent, live", body: "See it answer a buyer, ask the right questions and book a site visit." },
  { Icon: IndianRupee, title: "Pricing for your team", body: "A clear price for your team size, and help starting the 14-day free trial." },
];
const STEPS = ["About you", "Your business", "The demo"];

const EMPTY = {
  name: "", email: "", phone: "", city: "",
  company: "", role: "", businessType: "", teamSize: "", monthlyLeads: "", leadSources: [], currentTool: "",
  preferredDate: "", preferredTime: "", format: "Video call", language: "English", message: "",
};

// Next 7 days in IST, Sundays skipped. Built after mount (the prerender must not bake dates in).
function nextDays() {
  const out = [];
  const fmtYmd = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" });
  const fmtShow = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short" });
  const fmtDay = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kolkata", weekday: "short" });
  for (let i = 1; out.length < 7 && i < 14; i++) {
    const d = new Date(Date.now() + i * 86400000);
    if (fmtDay.format(d) === "Sun") continue;
    out.push({ value: fmtYmd.format(d), label: fmtShow.format(d) });
  }
  return out;
}

const inputCls = "w-full rounded-2xl px-4 py-3 text-sm outline-none transition-shadow focus:ring-2 focus:ring-[color:var(--site-brand)]";
const inputStyle = { background: "var(--site-bg)", border: "1px solid var(--site-line-strong)", color: "var(--site-ink)" };

function Field({ label, required, hint, children, htmlFor }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-[13px] font-semibold site-ink mb-1.5">
        {label}{required && <span style={{ color: "var(--site-brand-ink)" }}> *</span>}
        {hint && <span className="font-normal site-muted"> ({hint})</span>}
      </label>
      {children}
    </div>
  );
}

function Choice({ options, value, onChange, multi = false, name }) {
  const isOn = (o) => (multi ? value.includes(o) : value === o);
  const toggle = (o) => onChange(multi ? (value.includes(o) ? value.filter((x) => x !== o) : [...value, o]) : o);
  return (
    <div role={multi ? "group" : "radiogroup"} aria-label={name} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button key={o} type="button" role={multi ? "checkbox" : "radio"} aria-checked={isOn(o)} onClick={() => toggle(o)}
          className="rounded-full px-3.5 py-2 text-[13px] font-medium transition-colors"
          style={isOn(o)
            ? { background: "rgba(255,107,0,0.12)", color: "var(--site-brand-ink)", border: "1px solid var(--site-brand)" }
            : { background: "var(--site-bg)", color: "var(--site-text)", border: "1px solid var(--site-line-strong)" }}>
          {isOn(o) && <Check className="inline w-3.5 h-3.5 mr-1 -mt-0.5" aria-hidden="true" />}{o}
        </button>
      ))}
    </div>
  );
}

const INTRO_ID = "ZybPiXyK2vQ";
const INTRO_CHAPTERS = [
  ["0:00", "What is Arthaleads?"],
  ["0:24", "The receptionist who never sleeps: the WhatsApp AI agent"],
  ["0:46", "The register that never forgets: every lead in one place"],
  ["1:08", "The manager who keeps everyone on track"],
  ["1:35", "Start your 14-day free trial"],
];

/** The intro film, on the shared YouTube player (components/site/YouTubePlayer.jsx). */
function IntroFilm() {
  return (
    <div className="relative min-w-0">
      <div aria-hidden="true" className="hero-glass" />
      <div className="relative rounded-[22px] sm:rounded-[26px] p-1.5 sm:p-2" style={{ background: "var(--site-card)", border: "1px solid var(--site-line)", boxShadow: "var(--site-shadow-lg)" }}>
        <YouTubePlayer videoId={INTRO_ID} poster="/video/intro-film-poster-1280.webp"
          posterSet="/video/intro-film-poster-640.webp 640w, /video/intro-film-poster-1280.webp 1280w" name="intro"
          title="What is Arthaleads? The real estate CRM, explained in 2 minutes" badge="1:47 · English"
          className="rounded-[17px] sm:rounded-[20px]" />
      </div>
    </div>
  );
}

export default function BookDemo() {
  useSEO({
    title:       "Book a Demo | Arthaleads Real Estate CRM",
    description: "Book a free 30-minute demo of Arthaleads, the real estate CRM for builders, brokers and channel partners in India. See the WhatsApp AI agent live on your own leads.",
    canonical:   "https://www.arthaleads.com/book-demo",
  });

  const [step, setStep] = useState(0);
  const [f, setF] = useState(EMPTY);
  const [days, setDays] = useState([]);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  useEffect(() => setDays(nextDays()), []);
  // The Ask Artha pill would sit on the form's Next button on phones (styles.css).
  useEffect(() => {
    document.documentElement.classList.add("hide-chat-mobile");
    return () => document.documentElement.classList.remove("hide-chat-mobile");
  }, []);
  // A new step starts at the top of the form (on phones the button sits far below it).
  const toForm = () => {
    const el = document.getElementById("demo-form");
    if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v?.target ? v.target.value : v }));

  const stepError = useMemo(() => {
    if (step === 0) {
      if (!f.name.trim() || !f.email.trim() || !f.phone.trim() || !f.city.trim()) return "Please fill in your name, email, mobile and city.";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.trim())) return "Please enter a valid email address.";
      if ((f.phone.match(/\d/g) || []).length < 10) return "Please enter a valid 10-digit mobile number.";
    }
    if (step === 1 && (!f.company.trim() || !f.role || !f.businessType || !f.teamSize)) return "Please fill in your company, role, business type and team size.";
    return "";
  }, [step, f]);

  const next = () => { if (stepError) { setError(stepError); return; } setError(""); setStep((s) => s + 1); setTimeout(toForm, 0); };
  const back = () => { setError(""); setStep((s) => s - 1); setTimeout(toForm, 0); };

  const submit = async (e) => {
    e.preventDefault();
    if (step < 2) { next(); return; }
    setSending(true); setError("");
    const apiBase = (import.meta.env.VITE_API_URL || "http://localhost:5000/api").replace(/\/api$/, "");
    try {
      const recaptchaToken = await getRecaptchaToken("demo");
      const res = await fetch(`${apiBase}/api/demo-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...f, recaptchaToken, source: document.referrer ? new URL(document.referrer).pathname : "" }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) { track("generate_lead", { form: "book_demo" }); setDone(true); setTimeout(toForm, 0); }
      else setError(data.message || "Something went wrong. Please try again.");
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally { setSending(false); }
  };

  const dayLabel = days.find((d) => d.value === f.preferredDate)?.label;

  return (
    <SitePage>
      <Section tone="white" className="!pt-28 lg:!pt-32">
        <div aria-hidden="true" className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(50% 45% at 85% 20%, rgba(255,107,0,0.10), transparent 70%)" }} />
        {/* Desktop: heading + what the demo covers on the left, the form on the right.
            Phones: heading, then the form, then what the demo covers (DOM order). */}
        <Container className="relative grid lg:grid-cols-[0.9fr_1.1fr] lg:grid-rows-[auto_1fr] gap-x-14 gap-y-8 items-start">
          <div className="lg:col-start-1 lg:row-start-1">
            <p className="site-eyebrow mb-4">Book a demo</p>
            <h1 className="font-display site-ink font-extrabold tracking-[-0.02em] leading-[1.1] text-[32px] sm:text-[40px] lg:text-[44px]">
              See Arthaleads <span className="site-dim">on your own leads.</span>
            </h1>
            <p className="mt-5 text-base sm:text-[17px] leading-relaxed max-w-lg">
              Tell us a little about your team and pick a time. Someone from our team in Pune will confirm on WhatsApp or phone.
            </p>
          </div>
          <div className="lg:col-start-1 lg:row-start-2 order-last lg:order-none">
            <ul className="grid sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-3">
              {COVERS.map(({ Icon, title, body }) => (
                <li key={title} className="site-card p-4 flex gap-3">
                  <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(255,107,0,0.10)" }}>
                    {Icon === WhatsAppLogo ? <Icon className="w-[18px] h-[18px]" /> : <Icon className="w-[18px] h-[18px]" style={{ color: "var(--site-brand-ink)" }} aria-hidden="true" />}
                  </span>
                  <span>
                    <span className="block font-display text-[15px] font-bold site-ink leading-tight">{title}</span>
                    <span className="block mt-1 text-[13px] leading-snug">{body}</span>
                  </span>
                </li>
              ))}
            </ul>
            <div className="hidden lg:block mt-8 overflow-hidden rounded-[24px] border" style={{ borderColor: "var(--site-line)" }}>
              <SiteImage name="partner" width={1536} height={1024} sizes="520px" alt="Three colleagues in a small office working together at a laptop"
                className="block w-full h-auto aspect-[16/8] object-cover" />
            </div>
          </div>

          {/* Right: the form */}
          <Card raised id="demo-form" className="p-5 sm:p-8 scroll-mt-24 lg:col-start-2 lg:row-start-1 lg:row-span-2" style={{ background: "var(--site-card)" }}>
            {done ? (
              <div className="py-6 text-center" role="status">
                <span className="mx-auto w-14 h-14 rounded-full flex items-center justify-center mb-5" style={{ background: "rgba(22,163,74,0.12)" }}>
                  <CircleCheck className="w-7 h-7" style={{ color: "#16a34a" }} aria-hidden="true" />
                </span>
                <h2 className="font-display text-2xl font-extrabold site-ink">Request received</h2>
                <p className="mt-3 text-[15px] leading-relaxed max-w-md mx-auto">
                  Thanks, {f.name.split(" ")[0]}. We will contact you on {f.phone} to confirm
                  {dayLabel ? ` ${dayLabel}${f.preferredTime ? `, ${f.preferredTime.split(" (")[0].toLowerCase()}` : ""}` : " a time"}.
                  A confirmation is on its way to {f.email}.
                </p>
                <div className="mt-7 flex flex-wrap justify-center gap-3">
                  <SiteButton href={waLink(WA_MESSAGES.demo)} external variant="whatsapp"><WhatsAppLogo className="w-[18px] h-[18px]" color="#fff" /> Chat with us now</SiteButton>
                  <SiteButton to="/features" variant="secondary">Explore the features</SiteButton>
                </div>
              </div>
            ) : (
              <form onSubmit={submit} noValidate>
                {/* Progress */}
                <ol className="flex items-center gap-2 mb-7" aria-label="Form steps">
                  {STEPS.map((s, i) => (
                    <li key={s} className="flex-1">
                      <span className="block h-1.5 rounded-full" style={{ background: i <= step ? "var(--brand-btn)" : "var(--site-line-strong)" }} />
                      <span className={`block mt-2 text-[12px] font-semibold ${i === step ? "site-ink" : "site-muted"}`} aria-current={i === step ? "step" : undefined}>
                        {i + 1}. {s}
                      </span>
                    </li>
                  ))}
                </ol>

                {step === 0 && (
                  <div className="grid sm:grid-cols-2 gap-4">
                    <Field label="Full name" required htmlFor="bd-name"><input id="bd-name" className={inputCls} style={inputStyle} autoComplete="name" value={f.name} onChange={set("name")} placeholder="Rajesh Patil" /></Field>
                    <Field label="Work email" required htmlFor="bd-email"><input id="bd-email" type="email" className={inputCls} style={inputStyle} autoComplete="email" value={f.email} onChange={set("email")} placeholder="rajesh@company.com" /></Field>
                    <Field label="Mobile (WhatsApp)" required htmlFor="bd-phone"><input id="bd-phone" type="tel" className={inputCls} style={inputStyle} autoComplete="tel" value={f.phone} onChange={set("phone")} placeholder="+91 98765 43210" /></Field>
                    <Field label="City" required htmlFor="bd-city"><input id="bd-city" className={inputCls} style={inputStyle} autoComplete="address-level2" value={f.city} onChange={set("city")} placeholder="Pune" /></Field>
                  </div>
                )}

                {step === 1 && (
                  <div className="space-y-5">
                    <Field label="Company name" required htmlFor="bd-company"><input id="bd-company" className={inputCls} style={inputStyle} autoComplete="organization" value={f.company} onChange={set("company")} placeholder="Milestone Properties" /></Field>
                    <Field label="Your role" required><Choice name="Your role" options={ROLES} value={f.role} onChange={set("role")} /></Field>
                    <Field label="Type of business" required><Choice name="Type of business" options={BUSINESS} value={f.businessType} onChange={set("businessType")} /></Field>
                    <Field label="Sales team size" required><Choice name="Sales team size" options={TEAM} value={f.teamSize} onChange={set("teamSize")} /></Field>
                    <Field label="Leads per month" hint="optional"><Choice name="Leads per month" options={LEADS} value={f.monthlyLeads} onChange={set("monthlyLeads")} /></Field>
                    <Field label="Where your leads come from" hint="pick all that apply"><Choice multi name="Lead sources" options={SOURCES} value={f.leadSources} onChange={set("leadSources")} /></Field>
                    <Field label="What you use today" hint="optional" htmlFor="bd-tool"><input id="bd-tool" className={inputCls} style={inputStyle} value={f.currentTool} onChange={set("currentTool")} placeholder="Excel, another CRM (which one), nothing yet" /></Field>
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-5">
                    <Field label="Preferred day" hint="optional">
                      <Choice name="Preferred day" options={days.map((d) => d.label)} value={dayLabel || ""}
                        onChange={(lab) => set("preferredDate")(days.find((d) => d.label === lab)?.value || "")} />
                    </Field>
                    <Field label="Preferred time" hint="optional"><Choice name="Preferred time" options={TIMES} value={f.preferredTime} onChange={set("preferredTime")} /></Field>
                    <Field label="How should we meet?"><Choice name="Format" options={FORMATS} value={f.format} onChange={set("format")} /></Field>
                    <Field label="Language"><Choice name="Language" options={LANGS} value={f.language} onChange={set("language")} /></Field>
                    <Field label="Anything you want to see?" hint="optional" htmlFor="bd-msg">
                      <textarea id="bd-msg" rows={3} className={inputCls} style={inputStyle} value={f.message} onChange={set("message")} placeholder="For example: Facebook leads for two projects, the WhatsApp AI agent in Marathi" />
                    </Field>
                  </div>
                )}

                {error && <p role="alert" className="mt-5 text-sm font-medium" style={{ color: "#dc2626" }}>{error}</p>}

                <div className="mt-7 flex items-center justify-between gap-3">
                  {step > 0
                    ? <SiteButton variant="secondary" onClick={back}><ArrowLeft className="w-4 h-4" /> Back</SiteButton>
                    : <span className="text-[12px] site-muted">Takes about a minute</span>}
                  <SiteButton type="submit" disabled={sending} className="disabled:cursor-not-allowed">
                    {step < 2 ? <>Next <ArrowRight className="w-4 h-4" /></> : sending ? "Sending..." : <>Book my demo <ArrowRight className="w-4 h-4" /></>}
                  </SiteButton>
                </div>
                <p className="mt-5 text-[12px] site-muted leading-relaxed">
                  We use these details only to set up your demo. See our <Link to="/privacy" className="underline underline-offset-2">privacy policy</Link>.
                  Prefer WhatsApp? <a href={waLink(WA_MESSAGES.demo)} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">Message us</a>.
                </p>
              </form>
            )}
          </Card>
        </Container>
      </Section>

      {/* Watch first: the 2-minute intro film ("What is Arthaleads?", YouTube
          ZybPiXyK2vQ), different from the 1 AM tour film on the home page and
          /product-tour. A thumbnail until clicked, then YouTube's
          privacy-enhanced player, so nothing from YouTube loads by default. */}
      <Section tone="tint">
        <Container className="grid lg:grid-cols-[0.8fr_1.2fr] gap-8 lg:gap-14 items-center">
          <div className="min-w-0">
            <h2 className="font-display site-ink font-extrabold tracking-[-0.02em] leading-[1.1] text-[28px] sm:text-[36px]" style={{ textWrap: "balance" }}>
              What is Arthaleads? <span className="site-dim">Explained in 2 minutes.</span>
            </h2>
            <p className="mt-4 text-base sm:text-[17px] leading-relaxed max-w-lg">
              A WhatsApp AI agent that answers every enquiry, one list for every lead, and a clear view of what your team should do next.
            </p>
            <ol className="mt-6 space-y-2.5">
              {INTRO_CHAPTERS.map(([t, label]) => (
                <li key={t} className="flex items-center gap-3 text-[15px]">
                  <span className="font-mono text-xs font-semibold tabular-nums px-2 py-1 rounded-md shrink-0" style={{ background: "rgba(255,107,0,0.12)", color: "var(--site-brand-ink)" }}>{t}</span>
                  <span className="site-ink">{label}</span>
                </li>
              ))}
            </ol>
            <SiteButton href="#demo-form" className="mt-8">Book your demo <ArrowRight className="w-4 h-4" /></SiteButton>
          </div>
          <IntroFilm />
        </Container>
      </Section>
    </SitePage>
  );
}
