// Dashboard - v2
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import StatusBreakdown from "../components/dashboard/StatusBreakdown";
import SourceDonut from "../components/dashboard/SourceDonut";
import AutomationHealth from "../components/dashboard/AutomationHealth";
import MorningBrief, { prefetchBrief } from "../components/dashboard/MorningBrief";
import { describeRange, analyticsRangeParams } from "../components/dashboard/range";
import { InfoTip } from "../components/Tooltip";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Calendar,
  Check,
  CheckCircle,
  ChevronDown,
  Clock3,
  Flame,
  MapPin,
  MessageCircle,
  Mic,
  Phone,
  Plus,
  Sparkles,
  ThumbsDown,
  X,
  Zap,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { PhoneActions } from "../components/UI";
import api from "../services/api";
import { canAccess } from "../utils/plan";
import DateRangePicker from "../components/DateRangePicker";
import OnboardingChecklist from "../components/OnboardingChecklist";
import AttendanceCapture from "../components/AttendanceCapture";


function PlatformLogo({ platform, size = 16 }) {
  const s = { width: size, height: size, flexShrink: 0, display: "block" };
  switch (platform) {
    case "Facebook": return (
      <svg viewBox="0 0 24 24" style={s} fill="#1877F2">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
      </svg>
    );
    case "Google": return (
      <svg viewBox="0 0 24 24" style={s}>
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      </svg>
    );
    case "WhatsApp": return (
      <svg viewBox="0 0 24 24" style={s} fill="#25D366">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
      </svg>
    );
    case "Website Form": return (
      <svg viewBox="0 0 24 24" style={s} fill="none" stroke="#8b5cf6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10A15.3 15.3 0 0 1 12 2z"/>
      </svg>
    );
    case "Vistrow Voice": return <Mic style={{ ...s, color: "#8b5cf6" }} strokeWidth={2} />;
    default: return (
      <svg viewBox="0 0 24 24" style={s} fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
      </svg>
    );
  }
}

// Each lead source counted in the hero: the source name the leads carry and
// the counter's colours. "Custom" counts every other source (manual,
// referral, walk-in, portals...).
const PLATFORM_CONFIG = {
  "Facebook":      { sourceKey: "Facebook",      pillTone: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  "Google":        { sourceKey: "Google",        pillTone: "bg-red-500/10 text-red-400 border-red-500/20" },
  "WhatsApp":      { sourceKey: "WhatsApp",      pillTone: "bg-green-500/10 text-green-400 border-green-500/20" },
  "Website Form":  { sourceKey: "Website",       pillTone: "bg-violet-500/10 text-violet-400 border-violet-500/20" },
  "Custom":        { sourceKey: "Other",         pillTone: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  "Vistrow Voice": { sourceKey: "Vistrow Voice", pillTone: "bg-violet-500/10 text-violet-400 border-violet-500/20" },
};

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 21) return "Good evening";
  return "Good night";
}

// Typewriter hook — reveals `text` char-by-char; `done` becomes true when finished
function useTypewriter(text, speed = 20, startDelay = 0) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!text) return;
    setDisplayed("");
    setDone(false);
    let i = 0;
    const kick = () => {
      const iv = setInterval(() => {
        i++;
        setDisplayed(text.slice(0, i));
        if (i >= text.length) { clearInterval(iv); setDone(true); }
      }, speed);
      return iv;
    };
    let iv;
    if (startDelay > 0) {
      const t = setTimeout(() => { iv = kick(); }, startDelay);
      return () => { clearTimeout(t); clearInterval(iv); };
    }
    iv = kick();
    return () => clearInterval(iv);
  }, [text, speed, startDelay]);
  return { displayed, done };
}

const INSIGHT_THEMES = [
  { bg: "rgba(34,197,94,0.08)",  border: "rgba(34,197,94,0.22)",  accent: "#22c55e",  arrow: "▲" },
  { bg: "rgba(249,115,22,0.08)", border: "rgba(249,115,22,0.22)", accent: "#f97316",  arrow: "→" },
];

function InsightCard({ text, index, startDelay }) {
  const { displayed, done } = useTypewriter(text, 20, startDelay);
  const theme = INSIGHT_THEMES[index % INSIGHT_THEMES.length];
  return (
    <div className="flex items-start gap-2" style={{ opacity: displayed ? 1 : 0, transition: "opacity 0.3s" }}>
      <span className="text-[9px] font-black mt-0.5 flex-shrink-0" style={{ color: theme.accent }}>{theme.arrow}</span>
      <p className="text-[11px] leading-snug text-app">
        {displayed}
        {!done && <span className="ai-cursor" style={{ background: theme.accent }} />}
      </p>
    </div>
  );
}

// Generates a session-cached AI insight summary from live analytics data
// Only visible to admin and manager roles
function SmartInsightsWidget({ data }) {
  const { user, org } = useAuth();
  const [insights, setInsights] = useState(null);
  const [error, setError]       = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [cardDelays, setCardDelays] = useState([]);
  const [open, setOpen] = useState(false);

  // AI insights are Growth (Artha); Starter's dashboard doesn't show the strip.
  const allowed = user?.role === "super_admin" || ((user?.role === "admin" || user?.role === "manager") && canAccess(org, "growth"));
  if (!allowed) return null;

  const generate = async (force = false) => {
    if (!data) return;
    const cacheKey = "artha_insights_" + new Date().toISOString().slice(0, 10);
    if (!force) {
      try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          const bullets = JSON.parse(cached);
          setInsights(bullets);
          setCardDelays(bullets.map((_, i) => i === 0 ? 0 : bullets[0].length * 20 + 200));
          return;
        }
      } catch {}
    }
    setAiLoading(true);
    setInsights(null);
    setError(false);
    try {
      const topSource = Object.entries(data.bySource || {}).sort((a, b) => b[1] - a[1])[0];
      const summary = [
        `Total leads all-time: ${data.allTimeTotal ?? 0}`,
        `New leads this period: ${data.totalLeads ?? 0}${data.previousPeriodLeads != null ? `, previous period: ${data.previousPeriodLeads}` : ""}`,
        `This month new leads so far: ${data.thisMonthLeads ?? 0}, the same days last month: ${data.lastMonthSamePeriodLeads ?? 0}`,
        `Closed Won this month: ${data.thisMonthClosedWon ?? 0}`,
        `Conversion rate: ${data.conversionRate ?? 0}%`,
        `Follow-ups due today: ${data.todayFollowUps ?? 0}`,
        `Top lead source: ${topSource ? `${topSource[0]} (${topSource[1]} leads)` : "N/A"}`,
        `Pipeline value: ₹${data.pipelineValue ? (data.pipelineValue / 1e5).toFixed(0) + "L" : "0"}`,
      ].join(". ");

      const ANGLES = [
        "Focus your analysis on lead volume trends and source performance.",
        "Focus your analysis on conversion rate improvement and revenue potential.",
        "Focus your analysis on follow-up urgency and pipeline momentum.",
        "Focus your analysis on what the team should prioritise this week.",
        "Focus your analysis on pipeline value and closing opportunities.",
        "Focus your analysis on lead quality signals and agent efficiency.",
      ];
      const angle = ANGLES[Math.floor(Math.random() * ANGLES.length)];

      const { data: res } = await api.post("/help/ask", {
        question: `You are analysing a real estate CRM. Use ONLY these numbers (do not use any other data): ${summary}. ${angle} Give exactly 2 short bullet insights — one positive highlight, one actionable improvement. Each on its own line starting with "•". No intro, no sign-off. Max 15 words per bullet.`,
        page: "",
      });

      const bullets = (res.answer || "")
        .split("\n")
        .map(l => l.replace(/^[•\-*]\s*/, "").trim())
        .filter(Boolean)
        .slice(0, 2);

      setInsights(bullets);
      setCardDelays(bullets.map((_, i) => i === 0 ? 0 : bullets[0].length * 20 + 200));
      // Only cache the first auto-load (force=false), not manual refreshes
      if (!force) { try { sessionStorage.setItem(cacheKey, JSON.stringify(bullets)); } catch {} }
    } catch {
      setError(true);
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() => { generate(); }, [!!data]);

  const insightCount = insights?.length ?? 0;

  return (
    <div className="w-full rounded-xl overflow-hidden"
      style={{ background: "rgba(var(--app-primary-rgb),0.04)", border: "1px solid rgba(var(--app-primary-rgb),0.16)" }}>

      {/* Always-visible pill row */}
      <div className="flex items-center gap-2 px-3 py-2">
        <Sparkles className="ai-sparkle" style={{ width: 11, height: 11, color: "#f97316", flexShrink: 0 }} />
        <span className="text-[10px] font-black uppercase tracking-widest"
          style={{ background: "linear-gradient(90deg,#f97316,#fbbf24)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          Artha AI
        </span>
        <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
          style={{ background: "rgba(249,115,22,0.15)", color: "#f97316", border: "1px solid rgba(249,115,22,0.25)" }}>
          LIVE
        </span>

        {/* Status text when collapsed */}
        {!open && (
          <span className="text-[11px] text-app-soft flex-1 truncate ml-0.5">
            {aiLoading
              ? "Analysing pipeline…"
              : error
              ? "Could not load insights"
              : insights
              ? `${insightCount} insight${insightCount !== 1 ? "s" : ""} ready`
              : ""}
          </span>
        )}

        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          {open && (
            <button onClick={() => generate(true)} disabled={aiLoading}
              className="text-[10px] text-app-soft hover:text-app transition-all disabled:opacity-40 flex items-center gap-0.5 px-1.5 py-0.5 rounded-lg"
              style={{ background: "rgba(var(--app-primary-rgb),0.08)" }}>
              <Zap style={{ width: 8, height: 8 }} />
              {aiLoading ? "…" : "Refresh"}
            </button>
          )}
          <button onClick={() => setOpen(v => !v)}
            className="text-[10px] text-app-soft hover:text-app transition-all flex items-center gap-0.5 px-2 py-0.5 rounded-lg"
            style={{ background: "rgba(var(--app-primary-rgb),0.08)", border: "0.5px solid rgba(var(--app-primary-rgb),0.2)" }}>
            {open ? "Hide" : "View"}
            <ChevronDown style={{ width: 10, height: 10, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
          </button>
        </div>
      </div>

      {/* Expanded body */}
      {open && (
        <div className="px-3 pb-2.5 pt-1 flex flex-col gap-2"
          style={{ borderTop: "1px solid rgba(var(--app-primary-rgb),0.12)" }}>
          {aiLoading && (
            <>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse flex-shrink-0" />
                <span className="text-[10px] text-app-soft">Artha AI is analysing your pipeline…</span>
              </div>
              <div className="ai-shimmer-bar h-5 rounded-lg" />
              <div className="ai-shimmer-bar h-5 rounded-lg" style={{ animationDelay: "0.3s" }} />
            </>
          )}
          {error && <p className="text-[11px] text-app-soft pt-1">Could not generate insights right now.</p>}
          {insights && insights.map((line, i) => (
            <InsightCard key={i} text={line} index={i} startDelay={cardDelays[i] ?? 0} />
          ))}
        </div>
      )}
    </div>
  );
}

// Attendance in the hero: the time, the date and the Clock In / Out button.
// (Was a large analogue clock; same clock-in flow, a fraction of the space.)
function DashboardClock() {
  const [now, setNow] = useState(() => new Date());
  const [clockStatus,   setClockStatus]   = useState(null);
  const [requireSelfie, setRequireSelfie] = useState(true);
  const [captureOpen,   setCaptureOpen]   = useState(false);
  const [captureMode,   setCaptureMode]   = useState("clockin");
  const [submitting,    setSubmitting]    = useState(false);

  useEffect(() => {
    // Only hours and minutes are shown, so a few seconds of lag is invisible.
    const iv = setInterval(() => setNow(new Date()), 10000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    api.get("/attendance/status")
      .then(r => { setClockStatus(r.data.data); setRequireSelfie(r.data.requireSelfie ?? true); })
      .catch(() => {});
  }, []);

  const digitalTime = now.toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true,
  }).toUpperCase();
  const dateStr = now.toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short",
  });

  const isClockedIn  = !!(clockStatus?.clockIn && !clockStatus?.clockOut);
  const isClockedOut = !!(clockStatus?.clockIn && clockStatus?.clockOut);

  const openCapture = (mode) => { setCaptureMode(mode); setCaptureOpen(true); };

  const submitClock = async (captureData) => {
    setSubmitting(true);
    const isIn = captureMode === "clockin";
    try {
      const body = {};
      if (captureData?.selfie) body.selfie = captureData.selfie;
      else if (requireSelfie) body.proofUnavailable = true;   // no photo (camera unavailable or skipped): the server records that it was declared
      if (captureData?.lat != null) { body.lat = captureData.lat; body.lng = captureData.lng; body.accuracy = captureData.accuracy; }
      const r = await api.post(`/attendance/${isIn ? "clockin" : "clockout"}`, body);
      setClockStatus(r.data.data);
      toast.success(isIn ? "Clocked in!" : "Clocked out! Great work today.");
      setCaptureOpen(false);
    } catch (e) {
      toast.error(e.response?.data?.message || (isIn ? "Clock in failed" : "Clock out failed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="hidden lg:flex flex-col items-stretch justify-center gap-2 border-l shrink-0 pl-5"
        style={{ borderColor: "var(--app-border)", minWidth: 150 }}>
        <div className="text-center">
          <p className="text-lg font-bold tabular-nums text-app leading-none">{digitalTime}</p>
          <p className="mt-1 text-[11px] text-app-soft leading-none">{dateStr}</p>
        </div>

        {isClockedOut ? (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold text-app-soft justify-center"
            style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)" }}>
            <Check className="w-3 h-3 flex-shrink-0" />
            Done for today
          </div>
        ) : (
          <button
            type="button"
            onClick={() => openCapture(isClockedIn ? "clockout" : "clockin")}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition"
            style={isClockedIn
              ? { background: "rgba(239,68,68,0.10)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }
              : { background: "#22c55e", color: "#fff", border: "1px solid #16a34a" }}>
            {isClockedIn
              ? <><span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse flex-shrink-0" /> Clock Out</>
              : <><Clock3 className="w-3 h-3 flex-shrink-0" /> Clock In</>}
          </button>
        )}
      </div>

      <AttendanceCapture
        open={captureOpen}
        mode={captureMode}
        required={requireSelfie}
        submitting={submitting}
        onClose={() => setCaptureOpen(false)}
        onConfirm={submitClock}
      />
    </>
  );
}

function calcDelta(current, previous) {
  if (!previous || previous === 0) return null;
  return Math.round((current - previous) / previous * 100);
}

// Below 640px a button's text is hidden and only its icon shows (font-size 0
// hides the text node; the icons are sized in px, so they stay). The text stays
// in the DOM, so screen readers still read the label.
const ICON_ONLY_BELOW_SM = "max-sm:[&_button]:text-[0px] max-sm:[&_button]:gap-0 max-sm:[&_button>svg:last-child:not(:first-child)]:hidden";

// The Leads page reads these from navigation state, so a card clicked on the
// dashboard opens Leads showing exactly the leads the card counted.
function leadsRangeState(range) {
  if (range && typeof range === "object") return { presetFrom: range.from || "", presetTo: range.to || "" };
  return range ? { presetDateRange: range } : {};
}

// Short visible name for each source counter in the hero.
const PILL_NAME = { "Facebook": "Facebook", "Google": "Google", "WhatsApp": "WhatsApp", "Website Form": "Website", "Vistrow Voice": "Voice", "Custom": "Other" };

export default function Dashboard() {
  useEffect(() => { document.title = "Dashboard - Arthaleads CRM"; }, []);
  const { user, org } = useAuth();
  const hasGrowth = user?.role === "super_admin" || canAccess(org, "growth");
  useEffect(() => { prefetchBrief(user?._id || user?.id || "").catch(() => {}); }, []); // eslint-disable-line react-hooks/exhaustive-deps -- in parallel with the other cards
  const [greeting, setGreeting] = useState(getGreeting());

  useEffect(() => {
    const timer = setInterval(() => setGreeting(getGreeting()), 30 * 60 * 1000); // 30 min - greeting only changes AM/PM
    return () => clearInterval(timer);
  }, []);
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [dateRange, setDateRange] = useState("last30days");
  const [connectedPlatforms, setConnectedPlatforms] = useState(null); // null = loading
  const [allAutomations, setAllAutomations] = useState([]);
  const [refreshKey] = useState(0);
  const [analyticsError, setAnalyticsError] = useState(false);
  // Pre-fetched in parallel with analytics so Action Required renders immediately
  const [prefetchedFollowups, setPrefetchedFollowups] = useState(null);
  const [prefetchedHot, setPrefetchedHot] = useState(null);
  // Stale leads are fetched here too, so the whole page appears at once
  // instead of cards popping in one by one as their own requests finish.
  const [prefetchedStale, setPrefetchedStale] = useState(null);
  const [waLoaded, setWaLoaded] = useState(false);

  const fetchAnalytics = (retryCount = 0) => {
    if (retryCount === 0) setLoading(true);
    else setRetrying(true);
    setAnalyticsError(false);
    api.get("/leads/analytics", { params: analyticsRangeParams(dateRange), timeout: 30000 })
      .then((response) => { setData(response.data.data); setRetrying(false); })
      .catch((err) => {
        console.error("[analytics]", err?.response?.status, err?.message);
        const delays = [6000, 15000, 30000];
        if (retryCount < delays.length) {
          setTimeout(() => fetchAnalytics(retryCount + 1), delays[retryCount]);
        } else {
          setRetrying(false);
          setAnalyticsError(true);
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAnalytics();
    // Fire in parallel with analytics so Action Required cards have data ready
    if (sessionStorage.getItem("fup_panel_dismissed") !== "1") {
      api.get("/leads/followups-due")
        .then((r) => setPrefetchedFollowups(r.data.data || []))
        .catch(() => setPrefetchedFollowups([]));
    }
    else setPrefetchedFollowups([]);
    // Hot Today (AI lead scoring) is Growth: Starter doesn't ask for it.
    if (hasGrowth) api.get("/leads/hot", { params: { limit: 4 } })
      .then((r) => setPrefetchedHot(r.data.data || []))
      .catch(() => setPrefetchedHot([]));
    else setPrefetchedHot([]);
  }, [dateRange, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const T = { timeout: 12000 };
    if (sessionStorage.getItem("stale_panel_dismissed") === "1") setPrefetchedStale([]);
    else api.get("/leads/stale", T).then((r) => setPrefetchedStale(r.data.data || [])).catch(() => setPrefetchedStale([]));
  }, []);

  // WhatsApp is not an Automation (it is the org's own connection), so it never
  // showed up in the connected-sources list. Ask for its status separately.
  const [waConnected, setWaConnected] = useState(false);
  useEffect(() => {
    api.get("/whatsapp/status").then((r) => setWaConnected(!!r.data?.connected)).catch(() => {}).finally(() => setWaLoaded(true));
  }, []);

  // Fetch connected automations to drive the source counters
  useEffect(() => {
    api.get("/automations")
      .then((res) => {
        const list = res.data.automations || [];
        setAllAutomations(list);
        const active = list.filter((a) => a.status === "connected" && a.isActive !== false);
        // Deduplicate by platform (multiple Facebook automations = one counter)
        const seen = new Set();
        const unique = [];
        for (const a of active) {
          if (!seen.has(a.platform)) { seen.add(a.platform); unique.push(a.platform); }
        }
        setConnectedPlatforms(unique);
      })
      .catch(() => setConnectedPlatforms([])); // agents/errors → fall back to bySource
  }, []);

  const ready = !loading && !retrying && prefetchedFollowups !== null && prefetchedHot !== null
    && prefetchedStale !== null && connectedPlatforms !== null && waLoaded;
  if (!ready) return <DashboardSkeleton />;

  // Which source counters to show: every source that is connected OR has leads
  // in this period, in a fixed order. Anything that is not one of the named
  // sources (Manual, Referral, Walk-in, portals...) is counted together as Other.
  const connectedSet = new Set(connectedPlatforms || []);
  if (waConnected) connectedSet.add("WhatsApp");
  const bySrc = data?.bySource || {};
  const namedKeys = new Set(Object.values(PLATFORM_CONFIG).map((c) => c.sourceKey).filter((k) => k !== "Other"));
  const otherCount = Object.entries(bySrc).reduce((n, [k, v]) => (namedKeys.has(k) ? n : n + (v || 0)), 0);
  const pillCount = (p) => (p === "Custom" ? otherCount : (bySrc[PLATFORM_CONFIG[p].sourceKey] || 0));
  const activePlatforms = ["Facebook", "Google", "WhatsApp", "Website Form", "Vistrow Voice", "Custom"]
    .filter((p) => connectedSet.has(p) || pillCount(p) > 0);
  const scope = describeRange(dateRange);
  const isAdmin = ["admin", "manager", "super_admin"].includes(user?.role);

  return (
    <div className="stitch-page space-y-6">
      {/* Hero: greeting + new leads per source | date range, New Lead, Artha | attendance */}
      <header className="rounded-[1.75rem] p-4 sm:p-5 flex flex-col gap-4 lg:flex-row lg:items-stretch lg:gap-5"
        style={{ background: "var(--app-surface)", border: "1px solid var(--app-border)", boxShadow: "var(--app-shadow)" }}>

        <div className="flex flex-col justify-center gap-3 min-w-0 flex-1">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-app">{greeting}, {user?.name?.split(" ")[0]}</h1>

          {activePlatforms.length > 0 && (
            <div>
              <ul className="flex flex-wrap items-center gap-2" aria-label={`New leads by source, ${scope}`}>
                {activePlatforms.map((platform) => {
                  const cfg = PLATFORM_CONFIG[platform];
                  if (!cfg) return null;
                  const count = pillCount(platform);
                  const name = PILL_NAME[platform] || platform;
                  const tip = `${name}: ${count} new ${count === 1 ? "lead" : "leads"} ${scope}${platform === "Custom" ? " (manual, referral, portals and other sources)" : ""}`;
                  return (
                    <li key={platform} title={tip} aria-label={tip}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] font-bold ${cfg.pillTone}`}>
                      <PlatformLogo platform={platform} size={13} />
                      <span className="hidden sm:inline font-semibold">{name}</span>
                      <span className="tabular-nums">{count}</span>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-1.5 text-[11px] text-app-soft">New leads by source, {scope}</p>
            </div>
          )}
        </div>

        <div className="flex flex-col justify-center gap-2 w-full lg:w-[40%] lg:shrink-0 lg:border-l lg:pl-5"
          style={{ borderColor: "var(--app-border)" }}>
          <div className="flex items-center gap-2">
            <span data-tour="date-range">
              <DateRangePicker value={dateRange} onChange={setDateRange} compact />
            </span>
            <button type="button" data-tour="new-lead"
              onClick={() => navigate("/leads", { state: { openAddLead: true } })}
              className="btn-primary flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap flex-shrink-0">
              <Plus className="w-3.5 h-3.5 shrink-0" />
              <span>New Lead</span>
            </button>
          </div>
          <SmartInsightsWidget data={data} />
        </div>

        <DashboardClock />
      </header>

      <MorningBrief />

      {analyticsError && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-red-500/20 bg-red-500/5 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
            <p className="text-sm text-red-400">Couldn't load dashboard data. Check your connection.</p>
          </div>
          <button
            className="shrink-0 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-400 transition hover:bg-red-500/20"
            onClick={() => fetchAnalytics()}
          >
            Retry
          </button>
        </div>
      )}

      <OnboardingChecklist totalLeads={data?.allTimeTotal || 0} />

      {/* Agent — no leads yet */}
      {!loading && data && user?.role === "agent" && data.allTimeTotal === 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <div>
            <p className="text-sm font-semibold text-amber-300">No leads assigned to you yet</p>
            <p className="text-xs text-app-soft mt-0.5">Ask your manager to assign leads so they appear here.</p>
          </div>
        </div>
      )}

      {/* Stat cards: the period's totals live here and only here */}
      <ZonedKPIRow data={data} navigate={navigate} scope={scope} range={leadsRangeState(dateRange)} />

      {/* Action required: overdue follow-ups, Hot today, stale leads, broken sources, next 48 hours */}
      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
          <FollowUpDuePanel user={user} navigate={navigate} prefetchedLeads={prefetchedFollowups} />
          {hasGrowth && <HotLeadsWidget navigate={navigate} limit={4} prefetchedLeads={prefetchedHot} />}
        </div>
        {isAdmin && <StaleLeadsWidget navigate={navigate} prefetchedLeads={prefetchedStale} />}
        {isAdmin && <AutomationHealth automations={allAutomations} Logo={PlatformLogo} onlyProblems onOpen={() => navigate("/integrations")} />}
        <UpcomingSchedule items={data?.upcomingItems || []} navigate={navigate} />
      </div>

      {/* Pipeline: where the period's leads are, and where they came from */}
      <div className="grid grid-cols-1 items-stretch gap-3 xl:grid-cols-2">
        <StatusBreakdown byStatus={data?.byStatus} scope={scope}
          onSelect={(status) => navigate("/leads", { state: { ...leadsRangeState(dateRange), presetStatus: status } })} />
        <SourceDonut bySource={data?.bySource} scope={scope}
          onSelect={(source) => navigate("/leads", { state: { ...leadsRangeState(dateRange), presetSource: source } })} />
      </div>

      {/* Trends */}
      {isAdmin && <LeadsTrendWidget data={data} scope={scope} />}

      {isAdmin && data?.advanced !== false && (
        <button type="button" onClick={() => navigate("/performance")}
          className="flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left text-sm transition hover:border-orange-500/30 card">
          <span className="min-w-0">
            <span className="block font-semibold text-app">Team, sources and goals</span>
            <span className="block text-xs text-app-soft">Each person's numbers, source quality, top agents, team activity, projects and the monthly goal are on Performance.</span>
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-app-soft" />
        </button>
      )}

      {data?.advanced === false && (
        <section className="card p-5 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-bold text-app">Conversion reports, response times and agent performance</p>
            <p className="text-xs text-app-soft mt-0.5">Part of the Growth plan: which sources turn into site visits and deals, how fast each lead was answered, and each agent's numbers.</p>
          </div>
          <button type="button" onClick={() => navigate("/plans")} className="btn-primary rounded-full px-4 py-2 text-xs font-semibold">See plans</button>
        </section>
      )}
    </div>
  );
}

// Shown until every widget's data has arrived, so the page appears in one go.
function DashboardSkeleton() {
  const block = "rounded-2xl animate-pulse";
  const fill = { background: "var(--app-surface)", border: "1px solid var(--app-border)" };
  return (
    <div className="stitch-page space-y-6" aria-busy="true" aria-label="Loading dashboard">
      <div className={`${block} h-36`} style={fill} />
      <div className={`${block} h-24`} style={fill} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className={`${block} h-20`} style={fill} />)}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className={`${block} h-16`} style={fill} />
        <div className={`${block} h-16`} style={fill} />
      </div>
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <div className={`${block} h-56`} style={fill} />
        <div className={`${block} h-56`} style={fill} />
      </div>
    </div>
  );
}

function ZonedKPIRow({ data, navigate, scope = "", range = {} }) {
  // These follow the date range at the top of the page. The follow-ups card is
  // the one exception: it is always today's, because a follow-up that is due
  // today is due today whatever range is being looked at.
  const total = data?.totalLeads ?? 0;
  const delta = data && data.previousPeriodLeads != null ? calcDelta(total, data.previousPeriodLeads) : null;
  const closedWon = data?.byStatus?.["Closed Won"] ?? 0;
  const conversion = total ? Math.round((closedWon / total) * 1000) / 10 : 0;
  const speed = data?.speedToLead;
  const in1h = speed?.total ? Math.round((speed.within1h / speed.total) * 100) : null;
  const visits = (data?.sourcePerformance || []).reduce((n, r) => n + (r.visits || 0), 0);
  const stats = [
    {
      label: "Total Leads", value: total, color: "#f97316",
      sub: delta !== null ? `${delta >= 0 ? "↑" : "↓"} ${Math.abs(delta)}% vs previous period` : (scope ? `created ${scope}` : "All time"),
      subColor: delta !== null ? (delta >= 0 ? "#22c55e" : "#ef4444") : undefined,
      onClick: () => navigate("/leads", { state: { ...range } }),
      tip: "Leads that came in during the selected dates, including any later moved into a project.",
    },
    {
      label: "New", value: data?.byStatus?.New ?? 0, color: "#6366f1",
      sub: "Not contacted yet",
      onClick: () => navigate("/leads", { state: { ...range, presetStatus: "New" } }),
      tip: "Leads from these dates still in New: nobody has marked them contacted yet.",
    },
    {
      // Share of the period's leads a person reached within an hour (a call,
      // marked Contacted, or an agent's WhatsApp message; bot replies don't count).
      label: "Reached in 1 hr", value: in1h === null ? "—" : `${in1h}%`,
      color: in1h === null ? "var(--app-text-soft)" : in1h >= 60 ? "#22c55e" : in1h >= 30 ? "#f59e0b" : "#ef4444",
      sub: speed?.total ? `${speed.within5m} in 5 min · ${speed.notContacted} not yet` : "No leads in this period",
      tip: "Share of these leads a person reached within an hour of arriving: a call, marking them Contacted, or an agent's own WhatsApp message. The WhatsApp bot's replies don't count.",
    },
    {
      label: "Site Visits", value: visits, color: "#8b5cf6",
      sub: visits ? "Reached site visit or later" : "None yet this period",
      tip: "Leads from these dates at the Site Visit stage or later, or with a site visit date set.",
      onClick: () => navigate("/leads", { state: { ...range, presetStatus: "Site Visit" } }),
    },
    {
      label: "Closed Won", value: closedWon, color: "#22c55e",
      sub: closedWon ? `${conversion}% of leads ${scope}`.trim() : "None marked Closed Won",
      tip: "Leads from these dates marked Closed Won.",
      onClick: () => navigate("/leads", { state: { ...range, presetStatus: "Closed Won" } }),
    },
    {
      label: "Follow-ups", value: data?.todayFollowUps ?? 0, color: "#f59e0b",
      sub: "Due today, all leads",
      tip: "Follow-ups due today across all your leads. This one ignores the date range above.",
      onClick: () => navigate("/leads", { state: { presetFollowUpToday: true } }),
    },
  ];
  return (
    <div data-tour="stat-cards" className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {stats.map((s) => {
          const inner = (
            <>
              <p className="flex items-center justify-center gap-1 text-[9px] text-app-soft uppercase tracking-wider font-semibold leading-none">
                <span className="truncate">{s.label}</span>
                {s.tip && <InfoTip text={s.tip} size={12} />}
              </p>
              <p className="text-xl sm:text-2xl font-black leading-none truncate mt-1 text-center" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[9px] truncate mt-0.5 text-center" style={{ color: s.subColor || "var(--app-text-soft)" }} title={s.sub}>{s.sub}</p>
            </>
          );
          return s.onClick ? (
            <button key={s.label} type="button" onClick={s.onClick}
              className="card p-3 flex flex-col justify-center gap-0 text-center hover:-translate-y-0.5 transition hover:border-orange-500/30">
              {inner}
            </button>
          ) : (
            <div key={s.label} className="card p-3 flex flex-col justify-center gap-0 text-center">
              {inner}
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-app-soft">
        Showing leads created {scope || "in the selected period"}, using the date range above.
        {data?.allTimeTotal != null && <> {data.allTimeTotal.toLocaleString("en-IN")} leads in total.</>}
      </p>
    </div>
  );
}

// ── Upcoming Schedule ─────────────────────────────────────────────────────────
function UpcomingSchedule({ items, navigate }) {
  if (!items || items.length === 0) return null;
  return (
    <section className="card overflow-hidden">
      <div className="px-4 py-3 flex items-center gap-3" style={{ borderBottom: "1px solid var(--app-border)" }}>
        <Calendar className="h-4 w-4 text-indigo-400 shrink-0" />
        <span className="text-sm font-bold text-app">Upcoming 48 hours</span>
        <span className="badge bg-indigo-500/10 text-indigo-400 ml-auto">{items.length}</span>
      </div>
      <div className="divide-y" style={{ borderColor: "var(--app-border)" }}>
        {items.map((lead) => {
          const date = lead.followUpDate || lead.siteVisitDate;
          const type = lead.followUpDate ? "Follow-up" : "Site Visit";
          return (
            <button key={lead._id} type="button"
              onClick={() => navigate("/leads", { state: { openLeadId: lead._id } })}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-orange-500/5 transition">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-app truncate">{lead.name}</p>
                <p className="text-xs text-app-soft">{type} · {lead.assignedToName || "Unassigned"}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xs font-semibold text-indigo-400">
                  {new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                </p>
                <p className="text-[10px] text-app-soft">{lead.status}</p>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ── Follow-up Due Alert Panel ─────────────────────────────────────────────────
function FollowUpDuePanel({ user, navigate, prefetchedLeads }) {
  const [leads, setLeads] = useState(prefetchedLeads || []);
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem("fup_panel_dismissed") === "1"
  );
  // Every collapsible dashboard panel starts closed on each load; the
  // chevron opens it for this visit only (nothing is remembered).
  const [minimized, setMinimized] = useState(true);

  useEffect(() => {
    // Use pre-fetched data when provided — no duplicate network call
    if (prefetchedLeads !== null && prefetchedLeads !== undefined) {
      setLeads(prefetchedLeads);
      return;
    }
    if (dismissed) return;
    api.get("/leads/followups-due")
      .then((r) => setLeads(r.data.data || []))
      .catch(() => {});
  }, [dismissed, prefetchedLeads]);

  if (dismissed || !leads.length) return null;

  const canBulk = user?.role === "admin" || user?.role === "manager";
  const stale = leads.filter((l) => l.urgency === "overdue" && l.daysOverdue > 30);

  // Tomorrow 11:00 IST, whatever the browser's timezone.
  const tomorrowIST = () => {
    const ist = new Date(Date.now() + 5.5 * 3600000 + 86400000);
    return new Date(`${ist.toISOString().slice(0, 10)}T11:00:00+05:30`).toISOString();
  };
  const setFollowUp = async (lead, followUpDate) => {
    try {
      await api.patch(`/leads/${lead._id}`, { followUpDate });
      setLeads((prev) => prev.filter((l) => l._id !== lead._id));
      toast.success(followUpDate ? `${lead.name}: follow-up moved to tomorrow 11 AM` : `${lead.name}: follow-up cleared`);
    } catch {
      toast.error("Couldn't update that follow-up");
    }
  };
  const clearStale = async () => {
    if (!window.confirm("Clear every follow-up that is more than 30 days overdue? The leads stay as they are; only the old follow-up date is removed, and it is noted on each lead.")) return;
    try {
      const { data: r } = await api.post("/leads/followups/clear-stale", { olderThanDays: 30 });
      setLeads((prev) => prev.filter((l) => !(l.urgency === "overdue" && l.daysOverdue > 30)));
      toast.success(`Cleared ${r.cleared} old follow-up${r.cleared === 1 ? "" : "s"}`);
    } catch {
      toast.error("Couldn't clear old follow-ups");
    }
  };

  const overdue = leads.filter((l) => l.urgency === "overdue");
  const today   = leads.filter((l) => l.urgency === "today");

  const dismiss = () => {
    sessionStorage.setItem("fup_panel_dismissed", "1");
    setDismissed(true);
  };

  const toWa = (phone = "") => {
    const d = phone.replace(/\D/g, "");
    if (d.length === 10) return `91${d}`;
    if (d.length === 11 && d.startsWith("0")) return `91${d.slice(1)}`;
    return d;
  };

  const accentColor = overdue.length ? "#ef4444" : "#f59e0b";
  const accentBg    = overdue.length ? "rgba(239,68,68,0.08)" : "rgba(245,158,11,0.08)";
  const accentBorder= overdue.length ? "rgba(239,68,68,0.3)"  : "rgba(245,158,11,0.3)";

  return (
    <section className="card overflow-hidden" style={{ borderColor: accentBorder }}>

      {/* ── Header ── */}
      <div
        className="flex items-center gap-3 px-4 py-3"
        style={{ background: `linear-gradient(to right, ${accentBg}, transparent)`, borderBottom: "1px solid var(--app-border)" }}
      >
        {/* Col 1: Icon + text */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="shrink-0 flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: overdue.length ? "rgba(239,68,68,0.12)" : "rgba(245,158,11,0.12)" }}>
            <AlertTriangle className="h-4 w-4" style={{ color: accentColor }} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-app leading-tight">
              {overdue.length > 0 && today.length > 0
                ? `${overdue.length} overdue · ${today.length} due today`
                : overdue.length > 0
                ? `${overdue.length} overdue follow-up${overdue.length > 1 ? "s" : ""}`
                : `${today.length} follow-up${today.length > 1 ? "s" : ""} due today`}
            </p>
            <p className="text-[11px] text-app-soft">
              {user?.role === "agent" ? "Your action list" : "Across your team"}
            </p>
          </div>
        </div>

        {/* Controls — chevron | X */}
        <div className="shrink-0 flex items-center gap-1">
          <button
            type="button"
            onClick={() => setMinimized((v) => !v)}
            title={minimized ? "Expand" : "Minimize"}
            className="flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-black/5 dark:hover:bg-white/5"
          >
            <ChevronDown className={`h-3.5 w-3.5 text-app-soft transition-transform duration-200 ${minimized ? "" : "rotate-180"}`} />
          </button>
          <button
            type="button"
            onClick={dismiss}
            title="Dismiss"
            className="flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-black/5 dark:hover:bg-white/5"
          >
            <X className="h-3.5 w-3.5 text-app-soft" />
          </button>
        </div>
      </div>

      {/* ── Lead rows — fixed height, scroll reveals remaining ── */}
      {!minimized && <div className="divide-y overflow-y-auto" style={{ borderColor: "var(--app-border)", maxHeight: "280px" }}>
        {leads.map((lead) => (
          <div key={lead._id} className="flex items-center gap-2 px-4 py-2.5 transition hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">

            {/* Urgency badge - compact on mobile */}
            <span
              className="shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide whitespace-nowrap"
              style={
                lead.urgency === "overdue"
                  ? { background: "rgba(239,68,68,0.12)", color: "#ef4444" }
                  : { background: "rgba(245,158,11,0.12)", color: "#f59e0b" }
              }
            >
              {lead.urgency === "overdue" ? `${lead.daysOverdue}d` : "Today"}
            </span>

            {/* Name + meta */}
            <div className="min-w-0 flex-1">
              <button
                type="button"
                className="w-full text-left text-sm font-semibold text-app hover:text-orange-500 transition truncate block leading-tight"
                onClick={() => navigate("/leads", { state: { openLeadId: lead._id } })}
              >
                {lead.name}
              </button>
              <p className="text-[11px] text-app-soft truncate leading-tight mt-0.5">
                {[lead.source, lead.status, lead.assignedToName && user?.role !== "agent" ? lead.assignedToName : null]
                  .filter(Boolean).join(" · ")}
              </p>
            </div>

            {/* Reschedule / clear */}
            <div className="flex shrink-0 items-center gap-1">
              <button type="button" onClick={() => setFollowUp(lead, tomorrowIST())} title="Move to tomorrow 11 AM"
                className="rounded-lg border border-[color:var(--app-border)] px-2 py-1 text-[11px] font-medium text-app-soft transition hover:text-app">
                Tomorrow
              </button>
              <button type="button" onClick={() => setFollowUp(lead, null)} title="Clear this follow-up"
                className="flex h-[26px] w-[26px] items-center justify-center rounded-lg border border-[color:var(--app-border)] text-app-soft transition hover:text-red-500">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Call + WA - icon-only on mobile, label on sm+ */}
            {lead.phone && (
              <div className="flex items-center gap-1.5 shrink-0">
                {/* Phone number shows from sm up; on a phone it is the icon only
                    (the button keeps the number as its accessible name). */}
                <div className={`rounded-lg border px-2 py-1 ${ICON_ONLY_BELOW_SM}`}
                  style={{ borderColor: "rgba(249,115,22,0.25)", background: "rgba(249,115,22,0.06)" }}>
                  <PhoneActions phone={lead.phone} lead={lead} />
                </div>
                <a
                  href={`https://wa.me/${toWa(lead.phone)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="WhatsApp" aria-label={`WhatsApp ${lead.name}`}
                  className="flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-medium transition"
                  style={{ borderColor: "rgba(34,197,94,0.25)", color: "#16a34a", background: "rgba(34,197,94,0.06)" }}
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                </a>
              </div>
            )}
          </div>
        ))}
      </div>}

      {!minimized && canBulk && stale.length > 0 && (
        <div className="flex items-center justify-between gap-3 px-4 py-2" style={{ borderTop: "1px solid var(--app-border)" }}>
          <p className="text-[11px] text-app-soft">{stale.length} of these are more than 30 days overdue.</p>
          <button type="button" onClick={clearStale}
            className="shrink-0 rounded-lg border border-red-500/30 px-2.5 py-1 text-[11px] font-semibold text-red-500 transition hover:bg-red-500/10">
            Clear old follow-ups
          </button>
        </div>
      )}

      {/* Footer — scroll count hint when there are more than 5 leads */}
      {!minimized && leads.length > 5 && (
        <div className="px-4 py-2 text-center" style={{ borderTop: "1px solid var(--app-border)", background: "var(--app-surface-low)" }}>
          <button type="button" className="text-xs text-app-soft hover:text-orange-500 transition font-medium" onClick={() => navigate("/followups")}>
            Scroll to see all {leads.length} · View in Follow-ups →
          </button>
        </div>
      )}
    </section>
  );
}

// ── Hot Today Widget ──────────────────────────────────────────────────────────
function HotLeadsWidget({ navigate, limit = 6, prefetchedLeads }) {
  const [leads, setLeads] = useState(prefetchedLeads || []);
  const [loading, setLoading] = useState(prefetchedLeads === null || prefetchedLeads === undefined);
  // Every collapsible dashboard panel starts closed on each load; the
  // chevron opens it for this visit only (nothing is remembered).
  const [minimized, setMinimized] = useState(true);

  useEffect(() => {
    if (prefetchedLeads !== null && prefetchedLeads !== undefined) {
      setLeads(prefetchedLeads);
      setLoading(false);
      return;
    }
    api.get("/leads/hot", { params: { limit } })
      .then((r) => setLeads(r.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [prefetchedLeads]);

  if (loading) return null;
  if (!leads.length) return null;

  const toWaNum = (phone = "") => {
    const d = phone.replace(/\D/g, "");
    if (d.length === 10) return `91${d}`;
    if (d.length === 11 && d.startsWith("0")) return `91${d.slice(1)}`;
    return d;
  };

  const SCORE_STYLE = (score) => {
    if (score >= 80) return { bg: "rgba(239,68,68,0.12)", color: "#ef4444", label: "🔥" };
    if (score >= 60) return { bg: "rgba(249,115,22,0.12)", color: "#f97316", label: "⚡" };
    if (score >= 40) return { bg: "rgba(245,158,11,0.10)", color: "#f59e0b", label: "~" };
    return { bg: "rgba(107,114,128,0.10)", color: "#6b7280", label: "·" };
  };

  const ACTION_COLOR = {
    orange: { bg: "rgba(249,115,22,0.10)", color: "#f97316", border: "rgba(249,115,22,0.25)" },
    amber:  { bg: "rgba(245,158,11,0.10)", color: "#f59e0b", border: "rgba(245,158,11,0.25)" },
    indigo: { bg: "rgba(99,102,241,0.10)", color: "#6366f1", border: "rgba(99,102,241,0.25)" },
    violet: { bg: "rgba(139,92,246,0.10)", color: "#8b5cf6", border: "rgba(139,92,246,0.25)" },
    emerald:{ bg: "rgba(34,197,94,0.10)",  color: "#22c55e", border: "rgba(34,197,94,0.25)"  },
    green:  { bg: "rgba(22,163,74,0.10)",  color: "#16a34a", border: "rgba(22,163,74,0.25)"  },
    blue:   { bg: "rgba(59,130,246,0.10)", color: "#3b82f6", border: "rgba(59,130,246,0.25)" },
  };

  const ActionIcon = ({ icon }) => {
    if (icon === "sparkles") return <Sparkles className="h-3 w-3" />;
    if (icon === "phone")   return <Phone className="h-3 w-3" />;
    if (icon === "bell")    return <Bell className="h-3 w-3" />;
    if (icon === "map-pin") return <MapPin className="h-3 w-3" />;
    if (icon === "message") return <MessageCircle className="h-3 w-3" />;
    if (icon === "file")    return <ArrowRight className="h-3 w-3" />;
    if (icon === "handshake") return <CheckCircle className="h-3 w-3" />;
    return <Zap className="h-3 w-3" />;
  };

  const topScore = leads[0]?._score ?? null;
  const anyAi = leads.some((l) => l._ai);

  // "AI got it wrong" (or undo). Kept for review; the score itself is unchanged.
  const flagAi = async (lead, wrong) => {
    setLeads((ls) => ls.map((l) => (l._id === lead._id ? { ...l, _ai: { ...l._ai, wrong } } : l)));
    try { await api.post(`/leads/${lead._id}/ai-score/feedback`, { wrong }); }
    catch {
      setLeads((ls) => ls.map((l) => (l._id === lead._id ? { ...l, _ai: { ...l._ai, wrong: !wrong } } : l)));
      toast.error("Couldn't save that. Try again.");
    }
  };

  return (
    <div className="hot-ai-wrapper">{/* spinning conic-gradient border */}
    <section data-tour="hot-today" className="card overflow-hidden"
      style={{ borderColor: "transparent", borderRadius: "1rem", background: "var(--app-card-solid, var(--app-surface-solid))" }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3"
        style={{ borderBottom: minimized ? "none" : "1px solid rgba(249,115,22,0.12)" }}>

        {/* Icon + title + subtitle */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {/* Icon with pulsing live dot */}
          <div className="relative flex h-8 w-8 items-center justify-center rounded-xl shrink-0"
            style={{ background: "linear-gradient(135deg, rgba(249,115,22,0.18), rgba(251,146,60,0.14))", border: "1px solid rgba(249,115,22,0.3)" }}>
            <Flame className="h-4 w-4" style={{ color: "#f97316" }} />
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-70" style={{ background: "#f97316" }} />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full" style={{ background: "#f97316" }} />
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="flex items-center gap-1.5 text-sm font-bold text-app leading-tight">
              Hot Today
              <InfoTip text="Ranked by recent replies, how new the lead is, follow-ups due, budget and pipeline stage. For leads whose customer wrote or talked on a call in the last 14 days, AI also reads that chat and the call summaries and moves the score up or down by up to 20 points, with its reason shown. Leads tagged Not a buyer are left out." />
            </h3>
            <p className="text-[11px] text-app-soft truncate">
              {topScore !== null ? `Top score: ${topScore} pts · ${leads.length} ranked` : "Leads to call first"}
            </p>
          </div>
        </div>

        {/* Controls — AI SCORED badge + chevron */}
        <div className="shrink-0 flex items-center gap-1">
          {/* Only when the AI actually read at least one of these leads. */}
          {anyAi && (
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
              style={{ background: "linear-gradient(90deg, rgba(249,115,22,0.15), rgba(251,146,60,0.15))", border: "1px solid rgba(249,115,22,0.35)", color: "#fb923c" }}>
              <Sparkles className="h-2.5 w-2.5" />
              <span className="hidden sm:inline">AI Scored</span>
            </span>
          )}
          <button type="button"
            onClick={() => setMinimized((v) => !v)}
            title={minimized ? "Expand" : "Minimize"}
            className="flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-orange-500/10 cursor-pointer">
            <ChevronDown className={`h-3.5 w-3.5 text-orange-400 transition-transform duration-200 ${minimized ? "" : "rotate-180"}`} />
          </button>
        </div>
      </div>

      {/* Lead rows */}
      {!minimized && <div className="divide-y" style={{ borderColor: "rgba(249,115,22,0.08)" }}>
        {leads.map((lead, idx) => {
          const ss = SCORE_STYLE(lead._score);
          const ac = ACTION_COLOR[lead._nextAction?.color] || ACTION_COLOR.orange;
          return (
            <div key={lead._id}
              style={{ animation: "fadeSlideIn 0.3s ease both", animationDelay: `${idx * 55}ms` }}
              className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 px-4 py-3 transition hover:bg-orange-500/5">

              {/* Score badge */}
              <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                <div className="relative shrink-0 flex h-9 w-9 flex-col items-center justify-center rounded-xl text-center self-start"
                  style={{ background: ss.bg }}
                  title={lead._ai ? `Includes ${lead._ai.points > 0 ? "+" : ""}${lead._ai.points ?? lead._ai.adjust} from what the customer wrote` : "From the button answers and the team's updates"}>
                  <span className="text-[11px] font-black leading-none" style={{ color: ss.color }}>{lead._score}</span>
                  <span className="text-[8px] font-semibold uppercase" style={{ color: ss.color }}>pts</span>
                  {lead._ai && (
                    <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full"
                      style={{ background: "var(--app-card-solid, var(--app-surface-solid))", border: "1px solid rgba(249,115,22,0.4)" }}>
                      <Sparkles className="h-2 w-2" style={{ color: "#f97316" }} />
                    </span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  {/* Name + meta */}
                  <button type="button"
                    onClick={() => navigate("/leads", { state: { openLeadId: lead._id } })}
                    className="block max-w-full text-left min-w-0 cursor-pointer">
                    <p className="text-sm font-semibold text-app truncate hover:text-orange-500 transition">{lead.name}</p>
                    <p className="text-[11px] text-app-soft truncate">
                      {[lead.status, lead.priority !== "Medium" ? lead.priority : null, lead.preferredLocation].filter(Boolean).join(" · ")}
                    </p>
                  </button>
                  {/* What the AI read in the last 14 days, and a way to say it's wrong. */}
                  {lead._ai?.reason && (
                    <div className="mt-1 flex items-start gap-1.5">
                      <Sparkles className="mt-0.5 h-3 w-3 shrink-0" style={{ color: "#f97316" }} />
                      <p className={`min-w-0 text-[11px] leading-snug ${lead._ai.wrong ? "text-app-soft line-through" : "text-app"}`}
                        style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {lead._ai.reason}
                        {lead._ai.evidence?.[0] && <span className="text-app-soft"> &ldquo;{lead._ai.evidence[0]}&rdquo;</span>}
                      </p>
                      {/* A thumbs-down button, not text: "AI got it wrong" read as a verdict (owner, 28 Oct 2026). */}
                      <button type="button" onClick={() => flagAi(lead, !lead._ai.wrong)}
                        title={lead._ai.wrong ? "Marked as wrong. Click to undo." : "Mark this AI reason as wrong"}
                        aria-label={lead._ai.wrong ? "Undo: AI reason marked wrong" : "Mark this AI reason as wrong"}
                        aria-pressed={!!lead._ai.wrong}
                        className="shrink-0 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold transition"
                        style={lead._ai.wrong
                          ? { color: "#dc2626", background: "rgba(220,38,38,0.08)" }
                          : { color: "var(--app-text-soft)", border: "1px solid var(--app-border)" }}>
                        <ThumbsDown className="h-3 w-3" fill={lead._ai.wrong ? "currentColor" : "none"} />
                        {lead._ai.wrong && "Undo"}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Next best action + quick actions */}
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
                {/* NBA badge */}
                <span className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold whitespace-nowrap"
                  style={{ background: ac.bg, color: ac.color, border: `1px solid ${ac.border}` }}>
                  <ActionIcon icon={lead._nextAction?.icon} />
                  {lead._nextAction?.action}
                </span>

                {/* Call */}
                {lead.phone && (
                  <div className="h-7 w-7 rounded-lg"
                    style={{ background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.2)" }}>
                    <PhoneActions phone={lead.phone} lead={lead} compact />
                  </div>
                )}

                {/* WhatsApp */}
                {lead.phone && (
                  <a href={`https://wa.me/${toWaNum(lead.phone)}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex h-7 w-7 items-center justify-center rounded-lg transition cursor-pointer"
                    style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", color: "#16a34a" }}
                    title="WhatsApp">
                    <MessageCircle className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>}
    </section>
    </div>
  );
}

// ── Stale Leads Alert Widget ──────────────────────────────────────────────────
function StaleLeadsWidget({ navigate, prefetchedLeads }) {
  const [leads, setLeads] = useState(prefetchedLeads ?? null);
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem("stale_panel_dismissed") === "1"
  );
  // Every collapsible dashboard panel starts closed on each load; the
  // chevron opens it for this visit only (nothing is remembered).
  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => {
    if (dismissed || prefetchedLeads != null) return;
    api.get("/leads/stale").then((r) => setLeads(r.data.data || [])).catch(() => setLeads([]));
  }, [dismissed]);

  if (dismissed || leads === null || leads.length === 0) return null;

  function daysAgo(date) {
    return Math.floor((Date.now() - new Date(date)) / (1000 * 60 * 60 * 24));
  }

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
  }

  return (
    <section className="card overflow-hidden" style={{ borderColor: "rgba(245,158,11,0.3)" }}>
      <div className="flex items-center gap-3 px-4 py-3"
        style={{ background: "linear-gradient(to right, rgba(245,158,11,0.08), transparent)", borderBottom: collapsed ? "none" : "1px solid var(--app-border)" }}>
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl shrink-0"
            style={{ background: "rgba(245,158,11,0.12)" }}>
            <Clock3 className="h-4 w-4 text-amber-400" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-app leading-tight">
              {leads.length} stale lead{leads.length !== 1 ? "s" : ""} need attention
            </p>
            <p className="text-[11px] text-app-soft">No activity in 7+ days</p>
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-1">
          <button type="button" onClick={() => navigate("/leads")}
            className="rounded-lg px-2.5 py-1 text-[11px] font-semibold transition"
            style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)", color: "var(--app-text-soft)" }}>
            View all
          </button>
          <button type="button" onClick={toggleCollapsed}
            className="flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-black/5 dark:hover:bg-white/5">
            <ChevronDown className={`h-4 w-4 text-app-soft transition-transform duration-200 ${collapsed ? "" : "rotate-180"}`} />
          </button>
          <button type="button" onClick={() => { sessionStorage.setItem("stale_panel_dismissed", "1"); setDismissed(true); }}
            className="flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-black/5 dark:hover:bg-white/5">
            <X className="h-3.5 w-3.5 text-app-soft" />
          </button>
        </div>
      </div>

      {!collapsed && (
        <>
          <div className="divide-y" style={{ borderColor: "var(--app-border)" }}>
            {leads.slice(0, 8).map((lead) => (
              <div key={lead._id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-amber-500/5 transition">
                <span className="shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                  style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b" }}>
                  {daysAgo(lead.updatedAt)}d
                </span>
                <div className="min-w-0 flex-1">
                  <button type="button" onClick={() => navigate("/leads", { state: { openLeadId: lead._id } })}
                    className="text-sm font-semibold text-app hover:text-orange-500 transition truncate block leading-tight text-left">
                    {lead.name}
                  </button>
                  <p className="text-[11px] text-app-soft truncate">{[lead.status, lead.source, lead.assignedToName].filter(Boolean).join(" · ")}</p>
                </div>
                {lead.phone && (
                  <div className="h-7 w-7 rounded-lg shrink-0"
                    style={{ background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.2)" }}>
                    <PhoneActions phone={lead.phone} lead={lead} compact />
                  </div>
                )}
              </div>
            ))}
          </div>

          {leads.length > 8 && (
            <div className="px-4 py-2.5 text-center" style={{ borderTop: "1px solid var(--app-border)", background: "var(--app-surface-low)" }}>
              <button type="button" className="text-xs text-app-soft hover:text-orange-500 transition font-medium"
                onClick={() => navigate("/leads")}>
                +{leads.length - 8} more stale leads — view all
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

// ── Leads trend (follows the date range) ────────────────────────────────────
function LeadsTrendWidget({ data, scope = "" }) {
  if (!data?.dailyLeads) return null;

  const counts = Object.fromEntries(data.dailyLeads.map((r) => [r._id, r.count]));
  const monthly = data.trendBucket === "month";
  const keys = [];
  if (!monthly) {
    let k = data.rangeStartKey;
    const end = data.rangeEndKey;
    while (k && end && k <= end && keys.length < 120) {
      keys.push(k);
      const d = new Date(`${k}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1);
      k = d.toISOString().slice(0, 10);
    }
  } else {
    const present = Object.keys(counts).sort();
    const first = data.rangeStartKey?.slice(0, 7) || present[0];
    const last = data.rangeEndKey?.slice(0, 7) || present[present.length - 1];
    if (first && last) {
      let [y, m] = first.split("-").map(Number);
      const [ey, em] = last.split("-").map(Number);
      while ((y < ey || (y === ey && m <= em)) && keys.length < 60) {
        keys.push(`${y}-${String(m).padStart(2, "0")}`);
        m += 1; if (m > 12) { m = 1; y += 1; }
      }
    }
  }
  const label = (k) => monthly
    ? new Date(`${k}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" })
    : new Date(`${k}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
  const chartData = keys.map((k) => ({ key: k, day: label(k), count: counts[k] || 0 }));
  const total = chartData.reduce((sum, d) => sum + d.count, 0);

  return (
    <section className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="flex items-center gap-1.5 text-sm font-bold text-app">
          Leads over time
          <InfoTip text="New leads per day (per month for long ranges) in the dates picked at the top. The total is on the Total Leads card." />
        </h3>
        <span className="stitch-pill min-w-0 max-w-[60%] truncate text-xs">{scope || "in this period"}</span>
      </div>
      {chartData.length === 0 || total === 0 ? (
        <p className="text-sm text-app-soft py-8 text-center">No leads in this period.</p>
      ) : (
        <ResponsiveContainer width="100%" height={100}>
          <LineChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <XAxis dataKey="day" interval="preserveStartEnd" minTickGap={24} tick={{ fontSize: 10, fill: "var(--app-text-soft)" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "var(--app-text-soft)" }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip
              formatter={(v) => [`${v} ${v === 1 ? "lead" : "leads"}`, ""]}
              separator=""
              contentStyle={{ borderRadius: 12, border: "1px solid var(--app-border)", background: "var(--app-bg)", color: "var(--app-text)", fontSize: 12 }}
              cursor={{ stroke: "rgba(249,115,22,0.2)", strokeWidth: 2 }}
            />
            <Line type="monotone" dataKey="count" stroke="#f97316" strokeWidth={2} dot={chartData.length <= 14 ? { fill: "#f97316", r: 3 } : false} activeDot={{ r: 5 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </section>
  );
}
