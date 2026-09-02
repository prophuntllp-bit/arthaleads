import { useState, useEffect } from "react";
import { CRM_SIGNUP_URL, CRM_LINK_PROPS } from "../utils/crmLinks";
import { Download, ArrowRight, ChevronDown, Smartphone, ShieldCheck, Bell,
         MapPin, Phone, WifiOff, CheckCircle2, AlertTriangle } from "lucide-react";
import PublicNav from "../components/PublicNav";
import PublicFooter from "../components/PublicFooter";
import { usePublicTheme } from "../context/PublicThemeContext";
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
    desc: "Pull down your notifications and tap the finished download, or find arthaleads.apk in your Files app under Downloads.",
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

function FAQItem({ q, a, isDark }) {
  const [open, setOpen] = useState(false);
  const border = isDark ? "rgba(255,255,255,0.08)" : "#e5e7eb";
  const text = isDark ? "#fff" : "#111827";
  const soft = isDark ? "rgba(255,255,255,0.55)" : "#6b7280";
  return (
    <div className="border rounded-2xl overflow-hidden" style={{ borderColor: border }}>
      <button type="button" onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left"
        aria-expanded={open}>
        <span className="font-semibold text-sm" style={{ color: text }}>{q}</span>
        <ChevronDown className="w-4 h-4 flex-shrink-0 transition-transform"
          style={{ color: soft, transform: open ? "rotate(180deg)" : "none" }} />
      </button>
      {open && (
        <p className="px-5 pb-4 text-sm leading-relaxed" style={{ color: soft }}>{a}</p>
      )}
    </div>
  );
}

function DownloadAppInner() {
  const { isDark } = usePublicTheme();

  useSEO({
    title: "Download the Arthaleads Android App – Real Estate CRM on Your Phone",
    description: "Install the Arthaleads Android app to get instant lead alerts, call and log leads from your phone, and record site visits with location. Free with any Arthaleads account.",
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

  const bg = isDark ? "#0d0d1a" : "#ffffff";
  const altBg = isDark ? "#0a0a14" : "#f9fafb";
  const text = isDark ? "#ffffff" : "#111827";
  const soft = isDark ? "rgba(255,255,255,0.55)" : "#6b7280";
  const cardBg = isDark ? "rgba(255,255,255,0.04)" : "#ffffff";
  const cardBorder = isDark ? "rgba(255,255,255,0.08)" : "#e5e7eb";

  return (
    <div style={{ background: bg, color: text, fontFamily: "Inter, sans-serif" }} className="min-h-screen">
      <PublicNav />

      {/* ── Hero ── */}
      <section className="relative pt-28 pb-24 overflow-hidden text-center"
        style={{ background: isDark ? "#0d0d1a" : "linear-gradient(135deg, #fff7f0 0%, #fff 60%)" }}>
        <div className="absolute inset-0 pointer-events-none">
          <div style={{ position: "absolute", top: "25%", left: "25%", width: 384, height: 384, borderRadius: "50%", background: "rgba(255,107,0,0.10)", filter: "blur(60px)" }} />
          <div style={{ position: "absolute", bottom: "25%", right: "25%", width: 320, height: 320, borderRadius: "50%", background: "rgba(120,53,15,0.10)", filter: "blur(60px)" }} />
          <div style={{ position: "absolute", inset: 0, opacity: isDark ? 0.03 : 0.04, backgroundImage: "linear-gradient(rgba(255,107,0,1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,107,0,1) 1px,transparent 1px)", backgroundSize: "60px 60px" }} />
        </div>

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border mb-6"
            style={{ borderColor: "rgba(255,107,0,0.35)", background: "rgba(255,107,0,0.10)" }}>
            <Smartphone className="w-3.5 h-3.5 text-[#ff6b00]" />
            <span className="text-[#ff6b00] text-xs font-semibold uppercase tracking-wide">Android App</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.08] mb-6" style={{ color: text }}>
            Your Pipeline,<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff6b00] to-[#ffaa00]">
              In Your Pocket
            </span>
          </h1>
          <p className="text-lg leading-relaxed mb-8 max-w-xl mx-auto" style={{ color: soft }}>
            Get a push the moment a lead arrives, call them without leaving the app, and log site visits
            from where they happen. Free with any Arthaleads account.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {url ? (
              <a href={url}
                className="inline-flex items-center gap-2 text-white font-bold px-8 py-4 rounded-2xl transition-all duration-200 shadow-xl shadow-orange-500/30 hover:-translate-y-0.5"
                style={{ background: "linear-gradient(135deg,#e05d00,#ff6b00)" }}>
                <Download className="w-5 h-5" />
                Download for Android
              </a>
            ) : (
              // Never render a dead button. If the endpoint is unreachable or no
              // build is published, the page says so rather than offering a link
              // that goes nowhere.
              <span className="inline-flex items-center gap-2 font-semibold px-8 py-4 rounded-2xl border"
                style={{ borderColor: cardBorder, color: soft }}>
                {release === null ? "Checking for the latest build…" : "Download temporarily unavailable"}
              </span>
            )}
            <a href={CRM_SIGNUP_URL} {...CRM_LINK_PROPS}
              className="inline-flex items-center gap-2 font-semibold px-8 py-4 rounded-2xl border transition-all duration-200 hover:-translate-y-0.5"
              style={{ borderColor: cardBorder, color: text }}>
              Get Free CRM Account
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>

          <p className="mt-5 text-xs" style={{ color: soft }}>
            {[version && `v${version}`, build ? `build ${build}` : null, sizeMb ? `${sizeMb} MB` : null,
              `Android ${minAndroid}+`, "Free forever"].filter(Boolean).join("  ·  ")}
          </p>
        </div>
      </section>

      {/* ── Install steps ── */}
      <section className="py-20" style={{ background: altBg }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-black text-center mb-3" style={{ color: text }}>Installing it</h2>
          <p className="text-center text-sm mb-10 max-w-xl mx-auto" style={{ color: soft }}>
            Four steps, about a minute. Android asks for permission partway through because the app comes
            from us rather than the Play Store — that is expected.
          </p>

          <ol className="space-y-4">
            {INSTALL_STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-4 p-5 rounded-2xl border"
                style={{ background: cardBg, borderColor: cardBorder }}>
                <span className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-black text-white"
                  style={{ background: "linear-gradient(135deg,#e05d00,#ff6b00)" }}>{i + 1}</span>
                <div>
                  <p className="font-bold text-sm mb-1" style={{ color: text }}>{s.title}</p>
                  <p className="text-sm leading-relaxed" style={{ color: soft }}>{s.desc}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-6 flex gap-3 p-5 rounded-2xl border"
            style={{ background: "rgba(255,107,0,0.06)", borderColor: "rgba(255,107,0,0.25)" }}>
            <ShieldCheck className="w-5 h-5 flex-shrink-0 text-[#ff6b00]" />
            <p className="text-sm leading-relaxed" style={{ color: soft }}>
              <strong style={{ color: text }}>The warning is about the source, not the file.</strong> Android
              shows it for anything installed outside the Play Store. This build is signed with the Arthaleads
              release key, and the app verifies its own updates against our servers.
            </p>
          </div>
        </div>
      </section>

      {/* ── What it does ── */}
      <section className="py-20" style={{ background: bg }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-black text-center mb-12" style={{ color: text }}>
            What the app adds
          </h2>
          <div className="grid sm:grid-cols-2 gap-5">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="p-6 rounded-2xl border" style={{ background: cardBg, borderColor: cardBorder }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: "rgba(255,107,0,0.12)" }}>
                  <Icon className="w-5 h-5 text-[#ff6b00]" />
                </div>
                <p className="font-bold mb-1.5" style={{ color: text }}>{title}</p>
                <p className="text-sm leading-relaxed" style={{ color: soft }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Requirements ── */}
      <section className="py-16" style={{ background: altBg }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-black mb-6" style={{ color: text }}>Before you start</h2>
          <ul className="space-y-3">
            {[
              `An Android phone running ${minAndroid} or later`,
              "An Arthaleads account — sign in with yours, or create one in the app",
              "About 200 MB free, once installed",
              "Permission to install apps from your browser, granted during setup",
            ].map((r) => (
              <li key={r} className="flex gap-3 items-start">
                <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0 text-[#ff6b00]" />
                <span className="text-sm" style={{ color: soft }}>{r}</span>
              </li>
            ))}
          </ul>

          <div className="mt-6 flex gap-3 p-4 rounded-2xl border" style={{ borderColor: cardBorder }}>
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: soft }} />
            <p className="text-sm leading-relaxed" style={{ color: soft }}>
              iPhone users can run the full CRM in Safari at{" "}
              <a href={CRM_SIGNUP_URL} {...CRM_LINK_PROPS} style={{ color: "#ff6b00" }}>app.arthaleads.com</a>.
              Everything works except push notifications and call logging, which need the native app.
            </p>
          </div>
        </div>
      </section>

      {/* ── What's new ── */}
      {dl.releaseNotes && (
        <section className="py-16" style={{ background: bg }}>
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-black mb-4" style={{ color: text }}>
              What&rsquo;s new in {version ? `v${version}` : "the latest build"}
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: soft }}>{dl.releaseNotes}</p>
          </div>
        </section>
      )}

      {/* ── FAQ ── */}
      <section className="py-20" style={{ background: altBg }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-black text-center mb-10" style={{ color: text }}>Questions</h2>
          <div className="space-y-3">
            {FAQS.map((f) => <FAQItem key={f.q} {...f} isDark={isDark} />)}
          </div>
        </div>
      </section>

      {/* ── Close ── */}
      <section className="py-20 text-center" style={{ background: bg }}>
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-black mb-4" style={{ color: text }}>Put it on your team&rsquo;s phones</h2>
          <p className="text-sm mb-8" style={{ color: soft }}>
            Send them this page. They sign in with the account you already created for them.
          </p>
          {url && (
            <a href={url}
              className="inline-flex items-center gap-2 text-white font-bold px-8 py-4 rounded-2xl shadow-xl shadow-orange-500/30 transition-all duration-200 hover:-translate-y-0.5"
              style={{ background: "linear-gradient(135deg,#e05d00,#ff6b00)" }}>
              <Download className="w-5 h-5" />
              Download for Android
            </a>
          )}
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}

export default function DownloadApp() {
  return <DownloadAppInner />;
}
