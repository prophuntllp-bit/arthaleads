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
import AndroidLockScreen from "../components/site/AndroidLockScreen";

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
    desc: "Tap the finished download in your notifications, or find the arthaleads APK in Files under Downloads.",
  },
  {
    title: "Allow the install",
    desc: 'Android will say "For your security, your phone is not allowed to install unknown apps from this source." Tap Settings, turn on Allow from this source, then press back.',
  },
  {
    title: "Install and sign in",
    desc: "Tap Install, then Open. Sign in with your web dashboard email and password, or tap Sign up.",
  },
];

const FEATURES = [
  { icon: Bell,      title: "Instant lead alerts",   desc: "A push the moment a lead lands." },
  { icon: Phone,     title: "Call from the app",     desc: "Calls log themselves, with duration and recording." },
  { icon: MapPin,    title: "Attendance with location", desc: "Clock in with a selfie and location." },
  { icon: WifiOff,   title: "Built for weak signal", desc: "Lead lists open even in a basement showroom." },
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
    a: "No, one account covers both. You can create it on this site or in the app itself; either way the same email and password sign you in everywhere, and your role and permissions carry across, so an agent sees their leads and an admin sees the whole team.",
  },
  {
    q: "Will it work on my phone?",
    a: "Any phone running Android 7.0 or later, which covers effectively every device still receiving updates. There is one download for every phone, so you do not have to work out which processor yours has.",
  },
];

// In the markup (not added by an effect) so the prerendered HTML carries it for crawlers that run no JS.
const FAQ_JSONLD = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": FAQS.map(({ q, a }) => ({ "@type": "Question", "name": q, "acceptedAnswer": { "@type": "Answer", "text": a } })),
}).replace(/</g, "\\u003c");

// The Android app itself, for search engines. downloadUrl is the public repo's
// "latest release" link, which always points at the newest build (see
// backend/constants/appRelease.js), so it never goes stale.
const APP_JSONLD = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "MobileApplication",
  "@id": "https://www.arthaleads.com/download-app#app",
  "name": "Arthaleads for Android",
  "operatingSystem": "Android 7.0 or later",
  "applicationCategory": "BusinessApplication",
  "downloadUrl": "https://github.com/prophuntllp-bit/arthaleads-app/releases/latest",
  "installUrl": "https://www.arthaleads.com/download-app",
  "offers": { "@type": "Offer", "price": "0", "priceCurrency": "INR" },
  "publisher": { "@id": "https://www.arthaleads.com/#organization" },
}).replace(/</g, "\\u003c");

const iconTile = { background: "rgba(255,107,0,0.10)", boxShadow: "inset 0 0 0 1px rgba(255,107,0,0.22)" };

/** The hero phone: a realistic Android lock screen with arriving notifications. */
function PhoneAlerts() {
  return (
    <div className="relative mx-auto w-fit px-3 sm:px-6 lg:px-0">
      <div aria-hidden="true" className="hero-glass" />
      <div className="relative py-6"><AndroidLockScreen /></div>
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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: APP_JSONLD }} />

      <PageHero
        eyebrow="Android app"
        title={<>Your pipeline, <span className="site-dim">in your pocket</span></>}
        lede="Lead alerts, one-tap calls and site visits logged where they happen. Free with any Arthaleads account."
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
            `Android ${minAndroid}+`, "Free with any plan"].filter(Boolean).join(", ")}
        </p>
      </PageHero>

      {/* What it does */}
      <Section tone="tint">
        <Container>
          <SectionHeader eyebrow="What the app adds" title="Built for agents in the field" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {FEATURES.map(({ icon: Icon, title, desc }, i) => (
              <Reveal key={title} delay={i * 80} className="min-w-0 flex">
                <Card glow className="w-full p-4 sm:p-6">
                  <span className="site-icon w-11 h-11 rounded-xl flex items-center justify-center mb-4 sm:mb-5" style={iconTile}>
                    <Icon className="w-5 h-5" style={{ color: "var(--site-brand-ink)" }} aria-hidden="true" />
                  </span>
                  <h3 className="site-h4 mb-1.5">{title}</h3>
                  <p className="text-[14px] leading-snug sm:leading-relaxed">{desc}</p>
                </Card>
              </Reveal>
            ))}
          </div>
        </Container>
      </Section>

      {/* Install steps: the page's signature band */}
      <Section tone="sand">
        <Container className="grid lg:grid-cols-[0.8fr_1.2fr] gap-10 lg:gap-16">
          <div className="lg:sticky lg:top-28 self-start">
            <SectionHeader eyebrow="Installing it" title="Four steps, about a minute" className="!mb-6"
              lede="Android asks for permission partway through because the app is not from the Play Store. That is expected." />
            <Card className="p-5 flex gap-3" style={{ background: "rgba(255,107,0,0.06)", borderColor: "rgba(255,107,0,0.25)" }}>
              <ShieldCheck className="w-5 h-5 shrink-0 mt-0.5" style={{ color: "var(--site-brand-ink)" }} aria-hidden="true" />
              <p className="text-sm leading-relaxed">
                <strong className="site-ink">The warning is about the source, not the file.</strong> This build is signed with
                the Arthaleads release key, and the app checks its own updates against our servers.
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
                    <h3 className="site-h4 mb-1">{s.title}</h3>
                    <p className="text-[15px] leading-relaxed">{s.desc}</p>
                  </div>
                </Card>
              </Reveal>
            ))}
          </ol>
        </Container>
      </Section>

      {/* Requirements and release notes */}
      <Section tone="white">
        <Container>
          {/* max-w on Container itself is ignored (.site-container wins), so the narrower single card is a wrapper. */}
          <div className={dl.releaseNotes ? "grid gap-4 lg:grid-cols-2" : "max-w-3xl"}>
          <Card raised className="p-6 sm:p-8">
            <h2 className="site-h3 mb-5">Before you start</h2>
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
              <h2 className="site-h3 mb-4">What&rsquo;s new in {version ? `v${version}` : "the latest build"}</h2>
              <p className="text-[15px] leading-relaxed whitespace-pre-line">{dl.releaseNotes}</p>
            </Card>
          )}
          </div>
        </Container>
      </Section>

      <FaqSection title="Questions about the app" items={FAQS.map(({ q, a }) => [q, a])} tone="tint" />

      {/* Close */}
      <Section tone="white">
        <Container>
          <Reveal>
            <div className="site-cta-panel relative overflow-hidden rounded-[28px] sm:rounded-[32px] p-6 sm:p-12 text-center">
              <h2 className="site-h2">
                Put it on your <span className="site-dim">team&rsquo;s phones</span>
              </h2>
              <p className="mt-4 text-base sm:text-lg leading-relaxed max-w-xl mx-auto">Send them this page. They sign in with the account you already created for them.</p>
              <div className="mt-8 flex flex-wrap gap-3 justify-center">
                <DownloadButton url={url} release={release} />
                <SiteButton to="/book-demo" variant="secondary" className="!px-6 sm:!px-7 sm:min-h-[3.5rem] sm:text-base">Book a demo</SiteButton>
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
