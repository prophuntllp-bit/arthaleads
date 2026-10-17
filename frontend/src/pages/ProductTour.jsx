// pages/ProductTour.jsx - /product-tour, the watch page for the 2-minute film.
//
// Google only puts a video in video results when it is the main thing on its
// page ("Video isn't on a watch page" in Search Console while the film lived on
// the home page alone). This page gives the film a home of its own: the player
// straight under the heading, clickable chapters (also sent to Google as key
// moments, see data/introFilm.js) and the full transcript, which is the text
// Google reads to understand what the video covers.
//
// History: first built 12 Oct 2026 (f8793a8) and removed the same evening at the
// owner's request (751dce3); restored 16 Oct 2026 with the owner's approval,
// kept out of the nav and footer, without the eyebrow pill.
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import PublicNav from "../components/PublicNav";
import PublicFooter from "../components/PublicFooter";
import IntroVideo from "../components/IntroVideo";
import WhatsAppLogo from "../components/WhatsAppLogo";
import { usePublicTheme } from "../context/PublicThemeContext";
import { useSEO } from "../utils/useSEO";
import { CRM_SIGNUP_URL, CRM_LINK_PROPS, waLink, WA_MESSAGES } from "../utils/crmLinks";
import { CHAPTERS, TRANSCRIPT, fmtTime } from "../data/introFilm";

export default function ProductTour() {
  const { isDark } = usePublicTheme();
  const [seek, setSeek] = useState(null);
  const jump = (t) => setSeek({ t, n: Date.now() });

  useSEO({
    title: "Arthaleads Product Tour: Real Estate CRM in 2 Minutes (Video)",
    description: "Watch how Arthaleads replies to property buyers on WhatsApp at 1 AM, books site visits, fills in every lead, scores it and tells your team who to call first.",
    canonical: "https://www.arthaleads.com/product-tour",
  });

  const bg = isDark ? "#0d0d1a" : "#ffffff";
  const altBg = isDark ? "#0a0a14" : "#f9fafb";
  const text = isDark ? "#ffffff" : "#111827";
  const soft = isDark ? "rgba(255,255,255,0.6)" : "#4b5563";
  const cardBg = isDark ? "rgba(255,255,255,0.04)" : "#ffffff";
  const cardBorder = isDark ? "rgba(255,255,255,0.08)" : "#e5e7eb";

  const stamp = "font-mono text-xs font-semibold tabular-nums px-2 py-1 rounded-md text-[color:var(--brand-text)] shrink-0";
  const stampBg = isDark ? "rgba(255,107,0,0.12)" : "#fff3ea";

  return (
    <div style={{ background: bg, color: text, fontFamily: "Inter, sans-serif" }} className="min-h-screen">
      <PublicNav />

      {/* ── Title + film ── */}
      <section className="pt-28 pb-14" style={{ background: isDark ? "#0d0d1a" : "linear-gradient(180deg, #fff7f0 0%, #fff 100%)" }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black leading-[1.1] max-w-4xl" style={{ color: text, textWrap: "balance" }}>
            Arthaleads in 2 minutes: the real estate CRM that answers buyers at 1 AM
          </h1>
          <p className="text-base sm:text-lg leading-relaxed mt-4 mb-6 max-w-2xl" style={{ color: soft }}>
            See the WhatsApp AI agent qualify a buyer and book the site visit, every answer land in the
            lead, and your team start the morning knowing exactly who to call. In English and Hindi.
          </p>
          <IntroVideo isDark={isDark} id="film" chapters seek={seek} />
        </div>
      </section>

      {/* ── Chapters ── */}
      <section className="py-16" style={{ background: bg }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-black mb-2" style={{ color: text }}>Chapters</h2>
          <p className="text-sm mb-8" style={{ color: soft }}>Jump straight to the part you care about.</p>
          <ol className="grid sm:grid-cols-2 gap-3">
            {CHAPTERS.map((c) => (
              <li key={c.t}>
                <button type="button" onClick={() => jump(c.t)}
                  className="w-full flex items-center gap-3 text-left px-4 py-3 rounded-2xl border transition-all duration-200 hover:border-[#ff6b00] hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ff6b00]"
                  style={{ background: cardBg, borderColor: cardBorder }}>
                  <span className={stamp} style={{ background: stampBg }}>{fmtTime(c.t)}</span>
                  <span className="text-sm font-semibold" style={{ color: text }}>{c.title}</span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Transcript ── */}
      <section className="py-16" style={{ background: altBg }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-black mb-8" style={{ color: text }}>Transcript</h2>
          <div className="space-y-5">
            {TRANSCRIPT.map((p) => (
              <div key={p.t} className="flex gap-4">
                <button type="button" onClick={() => jump(p.t)} aria-label={`Play from ${fmtTime(p.t)}`}
                  className={`${stamp} h-fit hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ff6b00]`}
                  style={{ background: stampBg }}>
                  {fmtTime(p.t)}
                </button>
                <p className="text-base leading-relaxed" style={{ color: isDark ? "rgba(255,255,255,0.8)" : "#374151" }}>{p.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Close ── */}
      <section className="py-20 text-center" style={{ background: bg }}>
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-black mb-4" style={{ color: text }}>See it with your own leads</h2>
          <p className="text-base mb-8" style={{ color: soft }}>
            Start the 14-day free trial, or message us on WhatsApp for a 15-minute demo on your projects.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href={CRM_SIGNUP_URL} {...CRM_LINK_PROPS}
              className="inline-flex items-center gap-2 text-white font-bold px-8 py-4 rounded-2xl shadow-xl shadow-orange-500/30 transition-all duration-200 hover:-translate-y-0.5"
              style={{ background: "linear-gradient(135deg,#e05d00,#ff6b00)" }}>
              Start free trial
              <ArrowRight className="w-4 h-4" />
            </a>
            <a href={waLink(WA_MESSAGES.demo)} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 font-semibold px-8 py-4 rounded-2xl border transition-all duration-200 hover:-translate-y-0.5"
              style={{ borderColor: cardBorder, color: text, background: cardBg }}>
              <WhatsAppLogo className="w-[18px] h-[18px]" />
              Book a demo on WhatsApp
            </a>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
