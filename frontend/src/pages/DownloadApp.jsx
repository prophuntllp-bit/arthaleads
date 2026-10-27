// pages/DownloadApp.jsx - /download-app on the shared marketing theme
// (components/site/*). The phone is a coded illustration, not a screenshot.
import { useState, useEffect } from "react";
import { CRM_SIGNUP_URL, CRM_LINK_PROPS } from "../utils/crmLinks";
import {
  Download, ArrowRight, ShieldCheck, Bell, MapPin, Phone, WifiOff, CheckCircle2, AlertTriangle,
} from "lucide-react";
import { SitePage, Section, Container, SectionHeader, Card, SiteButton } from "../components/site/Site";
import { PageHero, FaqSection } from "../components/site/Blocks";
import { Reveal } from "../components/motion/Motion";
import { useSEO } from "../utils/useSEO";
import api from "../services/api";

// The APK is not on Google Play, so the install runs through Android's
// "unknown sources" warning. That prompt is where people give up, so it gets a
// step of its own with the exact wording they will see, rather than a breezy
// "just tap install".
const INSTALL_STEPS = [
  {
    title: "Tap Download",
    desc: "Chrome may warn that this type of file can harm your device. That warning appears for every APK downloaded outside the Play Store. Choose Download anyway.",
  },
  {
    title: "Open the file",
    desc: "Pull down your notifications and tap the finished download, or find the arthaleads APK in your Files app under Downloads.",
  },
  {
    title: "Allow the install",
    desc: 'Android will say "For your security, your phone is not allowed to install unknown apps from this source." Tap Settings, turn on Allow from this source, then press back.',
  },
  {
    title: "Install and sign in",
    desc: "Tap Install, then Open. Sign in with the same email and password you use on the web dashboard, or tap Sign up to create an account from the phone.",
  },
];

const FEATURES = [
  { icon: Bell,      title: "Instant lead alerts",   desc: "A push notification the moment a lead lands, so the first call goes out in minutes rather than hours." },
  { icon: Phone,     title: "Call from the app",     desc: "Dial a lead, and the call is logged against them automatically with duration and recording." },
  { icon: MapPin,    title: "Attendance with location", desc: "Field staff clock in with a selfie and location, so site visits are recorded where they happened." },
  { icon: WifiOff,   title: "Built for weak signal", desc: "Screens load from cache first, so a lead list still opens in a basement showroom." },
];

const FAQS = [
  {
    q: "Why is this not on the Google Play Store?",
    a: "It is on the way. Until then the app is distributed directly from this page, which is why Android shows the unknown-sources warning during install. The file is signed with our release key, and updates arrive in the app itself.",
  },
  {
    q: "Is there an iPhone version?",
    a: "Not yet. Arthaleads on iOS runs in the browser at app.arthaleads.com, which supports everything except push notifications and call logging.",
  },
  {
    q: "How do I get updates?",
    a: "The app checks on launch and tells you when a newer build is out, with a link to download it. You never need to come back to this page.",
  },
  {
    q: "Do I need a separate mobile account?",
    a: "No — one account covers both. You can create it on this site or in the app itself; either way the same email and password sign you in everywhere, and your role and permissions carry across, so an agent sees their leads and an admin sees the whole team.",
  },
  {
    q: "Will it work on my phone?",
    a: "Any phone running Android 7.0 or later, which covers effectively every device still receiving updates. There is one download for every phone — you do not have to work out which processor yours has.",
  },
];

// In the markup (not added by an effect) so the prerendered HTML carries it for crawlers that run no JS.
const FAQ_JSONLD = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": FAQS.map(({ q, a }) => ({ "@type": "Question", "name": q, "acceptedAnswer": { "@type": "Answer", "text": a } })),
}).replace(/</g, "\\u003c");

const iconTile = { background: "rgba(255,107,0,0.10)", boxShadow: "inset 0 0 0 1px rgba(255,107,0,0.22)" };

/** A coded Android phone showing the alerts the app sends (an illustration, not a screenshot). */
function PhoneAlerts() {
  const alerts = [
    { Icon: Bell, color: "#ff6b00", bg: "rgba(255,107,0,0.14)", title: "New lead · Ananya Iyer", sub: "2 BHK · Aurum Heights · Facebook ad", time: "now" },
    { Icon: Phone, color: "#16a34a", bg: "rgba(22,163,74,0.14)", title: "Call logged · 4 min 12 sec", sub: "Raj Patil · recording saved", time: "9 min" },
    { Icon: MapPin, color: "#2563eb", bg: "rgba(37,99,235,0.14)", title: "Clocked in at Aurum Heights", sub: "Selfie and location recorded", time: "10:02" },
  ];
  return (
    <div className="relative mx-auto w-full max-w-[420px] px-3 sm:px-6 lg:px-0">
      <div aria-hidden="true" className="hero-glass" />
      <div className="relative mx-auto my-6 w-[264px] sm:w-[290px] rounded-[2.6rem] p-[10px]" role="img" aria-label="An Android phone showing Arthaleads alerts for a new lead, a logged call and a site attendance check-in"
        style={{ background: "linear-gradient(145deg,#2b2d35,#121318)", boxShadow: "0 40px 80px -30px rgba(0,0,0,0.55), inset 0 0 0 1.5px rgba(255,255,255,0.08)" }}>
        <div className="relative overflow-hidden rounded-[2.1rem] h-[540px] sm:h-[580px]"
          style={{ background: "radial-gradient(120% 70% at 20% 0%, #ff8a3d 0%, #c2410c 38%, #2a1206 100%)" }}>
          <span aria-hidden="true" className="absolute top-3 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-black/80" />
          <div className="px-6 pt-12 text-white">
            <p className="font-display text-[56px] leading-none font-bold tracking-tight">10:42</p>
            <p className="mt-1 text-sm text-white/80">Saturday</p>
          </div>
          <div className="absolute inset-x-3 bottom-6 space-y-2.5">
            {alerts.map(({ Icon, color, bg, title, sub, time }) => (
              <div key={title} className="rounded-2xl p-3 flex items-start gap-3" style={{ background: "rgba(255,255,255,0.92)", boxShadow: "0 10px 24px -14px rgba(0,0,0,0.6)" }}>
                <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: bg }}>
                  <Icon className="w-[18px] h-[18px]" style={{ color }} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-[10.5px] font-semibold text-[#6b7180]">Arthaleads</span>
                    <span className="text-[10px] text-[#6b7180]">{time}</span>
                  </span>
                  <span className="block text-[12.5px] font-semibold text-[#0f1222] leading-tight truncate">{title}</span>
                  <span className="block text-[11px] text-[#474d5c] leading-tight mt-0.5 truncate">{sub}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function DownloadButton({ url, release }) {
  if (url) return <SiteButton href={url} className="!px-6 sm:!px-7 sm:min-h-[3.5rem] sm:text-base"><Download className="w-5 h-5" /> Download for Android</SiteButton>;
  // Never render a dead button. If the endpoint is unreachable or no build is
  // published, the page says so rather than offering a link that goes nowhere.
  return (
    <span className="site-btn site-btn--secondary !px-6 sm:!px-7 sm:min-h-[3.5rem] cursor-default site-muted">
      {release === null ? "Checking for the latest build…" : "Download temporarily unavailable"}
    </span>
  );
}

function DownloadAppInner() {
  useSEO({
    title: "Arthaleads Android App: Real Estate CRM on Your Phone",
    description: "Get the Arthaleads Android app for instant lead alerts, calls logged from your phone and site visits recorded with location. Free with any account.",
    canonical: "https://www.arthaleads.com/download-app",
  });

  // Version, link and release notes come from the same endpoint the app itself
  // checks on launch, so this page cannot advertise a build the app does not
  // know about, or a link that has moved.
  const [release, setRelease] = useState(null);
  useEffect(() => {
    api.get("/public/app-version")
      .then(({ data }) => setRelease(data))
      .catch(() => setRelease({}));
  }, []);

  // `download`, not the flat fields — those drive the in-app update prompt and
  // are held back deliberately so existing phones are not nagged on every
  // build. Nobody reading this page has the app yet, so they get the newest
  // one. See backend/constants/appRelease.js.
  const dl = release?.download || {};
  const url = dl.url || "";
  const version = dl.version || "";
  const build = dl.build || 0;
  const minAndroid = dl.minAndroid || "7.0";
  const sizeMb = dl.sizeBytes ? Math.round(dl.sizeBytes / 1048576) : 0;

  return (
    <SitePage>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: FAQ_JSONLD }} />

      <PageHero
        eyebrow="Android app"
        title={<>Your pipeline, <span className="site-dim">in your pocket</span></>}
        lede="Get a push the moment a lead arrives, call them without leaving the app, and log site visits from where they happen. Free with any Arthaleads account."
        visual={<PhoneAlerts />}
        actions={
          <div className="mt-7 flex flex-wrap gap-2.5 sm:gap-3 justify-center lg:justify-start">
            <DownloadButton url={url} release={release} />
            <SiteButton href={CRM_SIGNUP_URL} external variant="secondary" className="!px-6 sm:!px-7 sm:min-h-[3.5rem] sm:text-base">Create a free account <ArrowRight className="w-4 h-4" /></SiteButton>
          </div>
        }
        trust={false}
      >
        <p className="mt-5 text-[13px] site-muted">
          {[version && `v${version}`, build ? `build ${build}` : null, sizeMb ? `${sizeMb} MB` : null,
            `Android ${minAndroid}+`, "Free with any plan"].filter(Boolean).join("  ·  ")}
        </p>
      </PageHero>

      {/* What it does */}
      <Section tone="tint">
        <Container>
          <SectionHeader eyebrow="What the app adds" title="Built for agents in the field" />
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {FEATURES.map(({ icon: Icon, title, desc }, i) => (
              <Reveal key={title} delay={i * 80} className="min-w-0 flex">
                <Card glow className="w-full p-6">
                  <span className="site-icon w-11 h-11 rounded-xl flex items-center justify-center mb-5" style={iconTile}>
                    <Icon className="w-5 h-5" style={{ color: "var(--site-brand-ink)" }} aria-hidden="true" />
                  </span>
                  <h3 className="font-display text-base font-bold site-ink mb-2">{title}</h3>
                  <p className="text-[14px] leading-relaxed">{desc}</p>
                </Card>
              </Reveal>
            ))}
          </div>
        </Container>
      </Section>

      {/* Install steps */}
      <Section tone="white">
        <Container className="grid lg:grid-cols-[0.8fr_1.2fr] gap-10 lg:gap-16">
          <div className="lg:sticky lg:top-28 self-start">
            <SectionHeader eyebrow="Installing it" title="Four steps, about a minute" className="!mb-6"
              lede="Android asks for permission partway through because the app comes from us rather than the Play Store. That is expected." />
            <Card className="p-5 flex gap-3" style={{ background: "rgba(255,107,0,0.06)", borderColor: "rgba(255,107,0,0.25)" }}>
              <ShieldCheck className="w-5 h-5 shrink-0 mt-0.5" style={{ color: "var(--site-brand-ink)" }} aria-hidden="true" />
              <p className="text-sm leading-relaxed">
                <strong className="site-ink">The warning is about the source, not the file.</strong> Android shows it for anything
                installed outside the Play Store. This build is signed with the Arthaleads release key, and the app verifies its own updates against our servers.
              </p>
            </Card>
          </div>
          <ol className="space-y-3 min-w-0">
            {INSTALL_STEPS.map((s, i) => (
              <Reveal as="li" key={s.title} delay={i * 80}>
                <Card glow className="flex gap-4 p-5 sm:p-6">
                  <span className="font-display shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-base font-extrabold text-white"
                    style={{ background: "var(--brand-btn)", boxShadow: "0 12px 26px -12px rgba(204,75,0,0.7)" }}>{i + 1}</span>
                  <div className="min-w-0">
                    <h3 className="font-display font-bold site-ink mb-1">{s.title}</h3>
                    <p className="text-[15px] leading-relaxed">{s.desc}</p>
                  </div>
                </Card>
              </Reveal>
            ))}
          </ol>
        </Container>
      </Section>

      {/* Requirements and release notes */}
      <Section tone="tint">
        <Container className={`grid gap-4 ${dl.releaseNotes ? "lg:grid-cols-2" : "max-w-3xl"}`}>
          <Card raised className="p-6 sm:p-8">
            <h2 className="font-display text-xl font-bold site-ink mb-5">Before you start</h2>
            <ul className="space-y-3">
              {[
                `An Android phone running ${minAndroid} or later`,
                "An Arthaleads account: sign in with yours, or create one in the app",
                "About 200 MB free, once installed",
                "Permission to install apps from your browser, granted during setup",
              ].map((r) => (
                <li key={r} className="flex gap-3 items-start text-[15px]">
                  <CheckCircle2 className="w-4 h-4 mt-1 shrink-0" style={{ color: "#16a34a" }} aria-hidden="true" />{r}
                </li>
              ))}
            </ul>
            <p className="mt-6 pt-5 text-sm leading-relaxed flex gap-3" style={{ borderTop: "1px solid var(--site-line)" }}>
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 site-muted" aria-hidden="true" />
              <span>
                iPhone users can run the full CRM in Safari at{" "}
                <a href={CRM_SIGNUP_URL} {...CRM_LINK_PROPS} className="font-semibold underline underline-offset-4" style={{ color: "var(--site-brand-ink)" }}>app.arthaleads.com</a>.
                Everything works except push notifications and call logging, which need the native app.
              </span>
            </p>
          </Card>
          {dl.releaseNotes && (
            <Card raised className="p-6 sm:p-8">
              <h2 className="font-display text-xl font-bold site-ink mb-4">What&rsquo;s new in {version ? `v${version}` : "the latest build"}</h2>
              <p className="text-[15px] leading-relaxed whitespace-pre-line">{dl.releaseNotes}</p>
            </Card>
          )}
        </Container>
      </Section>

      <FaqSection title="Questions about the app" items={FAQS.map(({ q, a }) => [q, a])} tone="white" />

      {/* Close */}
      <Section tone="white" className="!pt-0">
        <Container>
          <Reveal>
            <div className="site-cta-panel relative overflow-hidden rounded-[28px] sm:rounded-[32px] p-6 sm:p-12 text-center">
              <h2 className="font-display site-ink font-extrabold tracking-[-0.02em] leading-[1.1] text-[30px] sm:text-[40px]" style={{ textWrap: "balance" }}>
                Put it on your <span className="site-dim">team&rsquo;s phones</span>
              </h2>
              <p className="mt-4 text-base sm:text-lg leading-relaxed max-w-xl mx-auto">Send them this page. They sign in with the account you already created for them.</p>
              <div className="mt-8 flex flex-wrap gap-3 justify-center">
                <DownloadButton url={url} release={release} />
                <SiteButton to="/book-demo" variant="secondary" className="!px-6 sm:!px-7 sm:min-h-[3.5rem] sm:text-base">Book a Demo</SiteButton>
              </div>
            </div>
          </Reveal>
        </Container>
      </Section>
    </SitePage>
  );
}

export default function DownloadApp() {
  return <DownloadAppInner />;
}
