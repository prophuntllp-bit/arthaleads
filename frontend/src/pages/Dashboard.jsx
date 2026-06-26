// Dashboard - v2
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Building2,
  Calendar,
  Check,
  CheckCircle,
  ChevronDown,
  Clock3,
  Flame,
  Globe,
  IndianRupee,
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  X,
  Zap,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { PageLoader } from "../components/UI";
import api from "../services/api";
import { fmtDate } from "../utils/constants";
import DateRangePicker from "../components/DateRangePicker";
import OnboardingChecklist from "../components/OnboardingChecklist";
import AttendanceCapture from "../components/AttendanceCapture";

const STATUS_CHART_COLORS = ["#6366f1", "#f59e0b", "#8b5cf6", "#f97316", "#22c55e", "#ef4444"];
const SOURCE_CHART_COLORS = ["#3b82f6", "#ef4444", "#22c55e", "#06b6d4", "#f59e0b", "#8b5cf6", "#ec4899", "#f97316", "#14b8a6", "#6b7280"];

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
    default: return (
      <svg viewBox="0 0 24 24" style={s} fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
      </svg>
    );
  }
}

// Config for each platform - drives both header pills and source cards
const PLATFORM_CONFIG = {
  "Facebook":     { label: "Facebook Leads",  note: "Meta Lead Ads",        shortLabel: "FB",    sourceKey: "Facebook",  icon: TrendingUp,   tone: "from-blue-500/20 via-blue-500/10 to-transparent",   iconTone: "bg-blue-500/15 text-blue-400",   dot: "bg-blue-500",   pillTone: "bg-blue-500/10 text-blue-400 border-blue-500/20",   presetSource: "Facebook"  },
  "Google":       { label: "Google Leads",    note: "Ads and landing forms", shortLabel: "GGL",   sourceKey: "Google",    icon: Users,        tone: "from-red-500/20 via-red-500/10 to-transparent",     iconTone: "bg-red-500/15 text-red-400",     dot: "bg-red-500",    pillTone: "bg-red-500/10 text-red-400 border-red-500/20",     presetSource: "Google"    },
  "WhatsApp":     { label: "WhatsApp Leads",  note: "Chats and inquiries",   shortLabel: "WA",    sourceKey: "WhatsApp",  icon: MessageCircle, tone: "from-green-500/20 via-green-500/10 to-transparent",  iconTone: "bg-green-500/15 text-green-400", dot: "bg-green-500",  pillTone: "bg-green-500/10 text-green-400 border-green-500/20", presetSource: "WhatsApp"  },
  "Website Form": { label: "Website Leads",   note: "Landing page forms",    shortLabel: "WEB",   sourceKey: "Website",   icon: Globe,        tone: "from-violet-500/20 via-violet-500/10 to-transparent", iconTone: "bg-violet-500/15 text-violet-400", dot: "bg-violet-500", pillTone: "bg-violet-500/10 text-violet-400 border-violet-500/20", presetSource: "Website" },
  "Custom":       { label: "Custom Leads",    note: "Other integrations",    shortLabel: "OTHER", sourceKey: "Other",     icon: Zap,          tone: "from-amber-500/20 via-amber-500/10 to-transparent",  iconTone: "bg-amber-500/15 text-amber-400", dot: "bg-amber-500",  pillTone: "bg-amber-500/10 text-amber-400 border-amber-500/20", presetSource: "Other"    },
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
  const { user } = useAuth();
  const [insights, setInsights] = useState(null);
  const [error, setError]       = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [cardDelays, setCardDelays] = useState([]);
  const [open, setOpen] = useState(false);

  const allowed = user?.role === "admin" || user?.role === "manager" || user?.role === "super_admin";
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
        `New leads this period: ${data.totalLeads ?? 0}`,
        `This month new leads: ${data.thisMonthLeads ?? 0}, last month: ${data.lastMonthLeads ?? 0}`,
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

function DashboardClock() {
  const [now, setNow] = useState(() => new Date());
  const [clockStatus,   setClockStatus]   = useState(null);
  const [requireSelfie, setRequireSelfie] = useState(true);
  const [captureOpen,   setCaptureOpen]   = useState(false);
  const [captureMode,   setCaptureMode]   = useState("clockin");
  const [submitting,    setSubmitting]    = useState(false);

  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    api.get("/attendance/status")
      .then(r => { setClockStatus(r.data.data); setRequireSelfie(r.data.requireSelfie ?? true); })
      .catch(() => {});
  }, []);

  const tParts = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(now);
  const h = parseInt(tParts.find(p => p.type === "hour")?.value || "0");
  const m = parseInt(tParts.find(p => p.type === "minute")?.value || "0");
  const s = parseInt(tParts.find(p => p.type === "second")?.value || "0");

  const hourAngle   = ((h % 12) + m / 60) * 30;
  const minuteAngle = (m + s / 60) * 6;
  const secondAngle = s * 6;
  const SIZE = 80;
  const cx = SIZE / 2, cy = SIZE / 2, r = SIZE / 2 - 3;

  const mkHand = (angleDeg, length, width, color) => {
    const rad = (angleDeg - 90) * (Math.PI / 180);
    return (
      <line x1={cx} y1={cy}
        x2={cx + Math.cos(rad) * length} y2={cy + Math.sin(rad) * length}
        stroke={color} strokeWidth={width} strokeLinecap="round"
      />
    );
  };

  const digitalTime = now.toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true,
  }).toUpperCase();
  const dateStr = now.toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric",
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
      <div className="hidden lg:flex flex-col items-center justify-center gap-2 border-l"
        style={{ flex: "0 0 20%", width: "20%", borderColor: "var(--app-border)", paddingLeft: 20, paddingRight: 20 }}>
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          <circle cx={cx} cy={cy} r={r} fill="var(--app-surface-low)" stroke="var(--app-border)" strokeWidth="1.5" />
          {Array.from({ length: 12 }, (_, i) => {
            const a = (i * 30 - 90) * (Math.PI / 180);
            const isQ = i % 3 === 0;
            const outer = r - 3;
            const inner = outer - (isQ ? 6 : 3);
            return (
              <line key={i}
                x1={cx + Math.cos(a) * outer} y1={cy + Math.sin(a) * outer}
                x2={cx + Math.cos(a) * inner} y2={cy + Math.sin(a) * inner}
                stroke="var(--app-text-soft)" strokeWidth={isQ ? 2 : 1} strokeLinecap="round"
              />
            );
          })}
          {mkHand(hourAngle,   r * 0.50, 3,   "var(--app-text)")}
          {mkHand(minuteAngle, r * 0.70, 2,   "var(--app-text)")}
          {mkHand(secondAngle, r * 0.76, 1.2, "#f97316")}
          <circle cx={cx} cy={cy} r={3.5} fill="#f97316" />
        </svg>
        <p className="text-sm font-bold tabular-nums text-app leading-none">{digitalTime}</p>
        <p className="text-[10px] text-app-soft leading-none">{dateStr}</p>

        {isClockedOut ? (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-semibold text-app-soft w-full justify-center"
            style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)" }}>
            <Check className="w-3 h-3 flex-shrink-0" />
            Done for today
          </div>
        ) : (
          <button
            onClick={() => openCapture(isClockedIn ? "clockout" : "clockin")}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all"
            style={isClockedIn
              ? { background: "rgba(239,68,68,0.10)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }
              : { background: "#22c55e", color: "#fff", border: "1px solid #16a34a" }}>
            {isClockedIn
              ? <><span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse flex-shrink-0" /> Clock Out</>
              : <><Clock3 className="w-3 h-3 flex-shrink-0" /> Clock IN</>}
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

function fmtINR(val) {
  if (!val) return "₹0";
  if (val >= 1e7) return `₹${(val / 1e7).toFixed(1)}Cr`;
  if (val >= 1e5) return `₹${(val / 1e5).toFixed(1)}L`;
  return `₹${val.toLocaleString("en-IN")}`;
}

function calcDelta(current, previous) {
  if (!previous || previous === 0) return null;
  return Math.round((current - previous) / previous * 100);
}

function fmtResponseTime(ms) {
  if (!ms || ms <= 0) return "No data";
  const mins = Math.round(ms / 60000);
  if (mins < 1) return "< 1 min";
  if (mins < 60) return `${mins} min`;
  const hrs = ms / 3600000;
  if (hrs < 24) return `${hrs.toFixed(1)} hrs`;
  return `${(hrs / 24).toFixed(1)} days`;
}

export default function Dashboard() {
  useEffect(() => { document.title = "Dashboard - Arthaleads CRM"; }, []);
  const { user } = useAuth();
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
  const [refreshKey, setRefreshKey] = useState(0);
  const [agents, setAgents] = useState([]);
  const [goalOverride, setGoalOverride] = useState(null);
  const [analyticsError, setAnalyticsError] = useState(false);
  // Pre-fetched in parallel with analytics so Action Required renders immediately
  const [prefetchedFollowups, setPrefetchedFollowups] = useState(null);
  const [prefetchedHot, setPrefetchedHot] = useState(null);

  const fetchAnalytics = (retryCount = 0) => {
    if (retryCount === 0) setLoading(true);
    else setRetrying(true);
    setAnalyticsError(false);
    const rangeParams = dateRange && typeof dateRange === "object"
      ? { from: dateRange.from, to: dateRange.to }
      : { dateRange };
    api.get("/leads/analytics", { params: rangeParams, timeout: 30000 })
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
    api.get("/leads/hot", { params: { limit: 4 } })
      .then((r) => setPrefetchedHot(r.data.data || []))
      .catch(() => setPrefetchedHot([]));
  }, [dateRange, refreshKey]);

  useEffect(() => {
    api.get("/auth/agents").then((r) => setAgents(r.data.agents || [])).catch(() => {});
  }, []);

  // Fetch connected automations to drive dynamic source cards
  useEffect(() => {
    api.get("/automations")
      .then((res) => {
        const list = res.data.automations || [];
        setAllAutomations(list);
        const active = list.filter((a) => a.status === "connected" && a.isActive !== false);
        // Deduplicate by platform (multiple Facebook automations = one card)
        const seen = new Set();
        const unique = [];
        for (const a of active) {
          if (!seen.has(a.platform)) { seen.add(a.platform); unique.push(a.platform); }
        }
        setConnectedPlatforms(unique);
      })
      .catch(() => setConnectedPlatforms([])); // agents/errors → fall back to bySource
  }, []);

  if (loading || retrying) return <PageLoader />;

  const statusChartData = Object.entries(data?.byStatus || {}).map(([name, value]) => ({ name, value }));
  const sourceChartData = Object.entries(data?.bySource || {})
    .filter(([, value]) => value > 0)
    .map(([name, value]) => ({ name, value }));

  // Which platforms to show: connected automations first; fallback to platforms with lead data
  const activePlatforms = (connectedPlatforms && connectedPlatforms.length > 0)
    ? connectedPlatforms
    : Object.keys(PLATFORM_CONFIG).filter(
        (p) => (data?.bySource?.[PLATFORM_CONFIG[p].sourceKey] || 0) > 0
      );

  const monthlyGoal = goalOverride !== null ? goalOverride : (data?.monthlyClosingGoal || 0);

  return (
    <div className="stitch-page space-y-6">
      {/* Dashboard banner — custom flex, NOT stitch-topbar so we control the layout */}
      <header className="rounded-[1.75rem] p-4 sm:p-5 flex flex-col gap-3 lg:flex-row lg:items-stretch"
        style={{ background: "var(--app-surface)", border: "1px solid var(--app-border)", boxShadow: "var(--app-shadow)" }}>

        {/* Left 40%: platform pills + greeting */}
        <div className="flex flex-col gap-3 min-w-0 w-full lg:w-[40%] lg:flex-[0_0_40%]">
          {/* Pills row */}
          <div className="flex flex-wrap items-center gap-2">
            {activePlatforms.map((platform) => {
              const cfg = PLATFORM_CONFIG[platform];
              if (!cfg) return null;
              const count = data?.bySource?.[cfg.sourceKey] || 0;
              return (
                <div key={platform} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] font-bold ${cfg.pillTone}`}>
                  <PlatformLogo platform={platform} size={13} />
                  {count}
                </div>
              );
            })}
          </div>

          {/* Greeting */}
          <div>
            <p className="stitch-kicker mb-1">Overview</p>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-app">{greeting}, {user?.name?.split(" ")[0]}</h1>
            <p className="mt-1 max-w-2xl text-sm text-app-soft hidden sm:block">
              Track source performance, team momentum, and recent lead movement across all your active channels in real time.
            </p>
          </div>
        </div>

        {/* Middle 40%: date range + new lead + AI insights (stacked) */}
        <div className="flex flex-col justify-center gap-2 w-full lg:w-[40%] lg:flex-[0_0_40%] lg:border-l"
          style={{ borderColor: "var(--app-border)", paddingLeft: 0 }}>
          <div className="flex items-center gap-2 lg:pl-5">
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
          <div className="lg:pl-5">
            <SmartInsightsWidget data={data} />
          </div>
        </div>

        {/* Right: live clock panel */}
        <DashboardClock />
      </header>

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

      {/* ── Zone 2: Today at a Glance ─────────────────────────────────── */}
      <ZonedKPIRow data={data} navigate={navigate} />

      {/* ── Zone 3: Action Required ───────────────────────────────────── */}
      <div className="space-y-3">
        <ZoneHeader label="Action Required" color="amber" />
        {/* 2-col grid: overdue follow-ups left, hot leads right.
            Mobile (<640px): stacked 1 col. Tablet/desktop: side by side. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
          <FollowUpDuePanel user={user} navigate={navigate} prefetchedLeads={prefetchedFollowups} />
          <HotLeadsWidget navigate={navigate} limit={4} prefetchedLeads={prefetchedHot} />
        </div>
        <UpcomingSchedule items={data?.upcomingItems || []} navigate={navigate} />
      </div>

      {/* ── Zone 4: Admin Intelligence ───────────────────────────────── */}
      <AdminOnly role={user?.role}>
        <div className="space-y-3">
          <ZoneHeader label="Admin Intelligence" color="indigo" />
          <StaleLeadsWidget navigate={navigate} />
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <RevenueForecastWidget data={data} />
            <WeeklyTrendWidget data={data} />
          </div>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <LiveAgentStatusWidget navigate={navigate} />
            <AutomationHealthWidget automations={allAutomations} />
          </div>
          {/* Project breakdown + Monthly goal — side by side */}
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 items-start">
            <ProjectBreakdownWidget navigate={navigate} />
            <GoalMetricsRow
              goal={monthlyGoal}
              current={data?.thisMonthClosedWon || 0}
              avgResponseMs={null}
              role={user?.role}
              onGoalUpdate={(n) => setGoalOverride(n)}
            />
          </div>
        </div>
      </AdminOnly>

      {/* ── Zone 5: Performance ──────────────────────────────────────── */}
      <div className="space-y-3">
        <ZoneHeader label="Performance" />
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
          <section className="card p-3 xl:col-span-7">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <p className="stitch-kicker mb-0.5">Pipeline</p>
                <h3 className="text-sm font-bold text-app">Leads by Status</h3>
              </div>
              <div className="stitch-pill text-xs">Live</div>
            </div>
            <ResponsiveContainer width="100%" height={Math.max(70, statusChartData.length * 36)}>
              <BarChart
                data={statusChartData}
                layout="vertical"
                barCategoryGap="18%"
                margin={{ top: 0, right: 12, left: 0, bottom: 0 }}
                style={{ outline: "none" }}
              >
                <XAxis
                  type="number"
                  tick={{ fontSize: 10, fill: "var(--app-text-soft)" }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 11, fill: "var(--app-text-soft)" }}
                  axisLine={false}
                  tickLine={false}
                  width={78}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid var(--app-border)",
                    background: "var(--app-bg)",
                    color: "var(--app-text)",
                    boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
                    fontSize: 12,
                  }}
                  itemStyle={{ color: "var(--app-text)" }}
                  labelStyle={{ color: "var(--app-text)", fontWeight: 600 }}
                  cursor={{ fill: "rgba(255,255,255,0.04)" }}
                />
                <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                  {statusChartData.map((_, index) => (
                    <Cell key={index} fill={STATUS_CHART_COLORS[index % STATUS_CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </section>

          <section className="card p-3 xl:col-span-5">
            <div className="mb-2">
              <p className="stitch-kicker mb-0.5">Acquisition Mix</p>
              <h3 className="text-sm font-bold text-app">Leads by Source</h3>
            </div>
            {sourceChartData.length === 0 ? (
              <p className="py-8 text-center text-sm text-app-soft">No data yet</p>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="relative" style={{ WebkitTapHighlightColor: "transparent" }}>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart style={{ outline: "none" }}>
                      <Pie
                        data={sourceChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={58}
                        outerRadius={85}
                        dataKey="value"
                        labelLine={false}
                        paddingAngle={2}
                        strokeWidth={0}
                        isAnimationActive={false}
                        tabIndex={-1}
                      >
                        {sourceChartData.map((_, index) => (
                          <Cell key={index} fill={SOURCE_CHART_COLORS[index % SOURCE_CHART_COLORS.length]} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold text-app">
                      {sourceChartData.reduce((s, d) => s + d.value, 0)}
                    </span>
                    <span className="text-xs text-app-soft">Total</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  {sourceChartData.map(({ name, value }, index) => (
                    <div key={name} className="flex items-center gap-2 min-w-0">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: SOURCE_CHART_COLORS[index % SOURCE_CHART_COLORS.length] }}
                      />
                      <span className="truncate text-xs text-app-soft">{name}</span>
                      <span className="ml-auto text-xs font-semibold text-app">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
        <DropoffFunnel allTimeByStatus={data?.allTimeByStatus} />
      </div>

      {/* ── Zone 6: Team ─────────────────────────────────────────────── */}
      <div className="space-y-3">
        <ZoneHeader label="Team" />
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <section className="card p-6 xl:col-span-5">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="stitch-kicker mb-2">Team Focus</p>
                <h3 className="text-lg font-bold text-app">Top Agents</h3>
              </div>
              <div className="stitch-pill">Leaderboard</div>
            </div>
            <div className="space-y-4">
              {(data?.byAgent || []).slice(0, 5).map((agent, index) => (
                <button
                  key={agent._id}
                  type="button"
                  onClick={() => navigate("/performance", { state: { focusUserId: agent._id } })}
                  className="flex w-full items-center gap-4 rounded-[1.25rem] p-3 text-left stitch-surface-muted transition hover:-translate-y-0.5 hover:border-orange-500/30 hover:bg-orange-500/5"
                >
                  <span className="w-4 text-xs font-bold text-app-soft">{index + 1}</span>
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-500/10 text-sm font-bold text-orange-500">
                    {agent.name?.[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-app">{agent.name}</p>
                    <p className="text-xs text-app-soft">Active agent</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-app">{agent.count}</p>
                  <p className="text-xs text-app-soft">leads</p>
                </div>
              </button>
            ))}
            {(data?.byAgent || []).length === 0 && <p className="text-sm text-app-soft">No agent activity yet.</p>}
          </div>
        </section>

        <ActivityFeed items={data?.recentActivity || []} navigate={navigate} />
      </div>
      </div>{/* end Zone 6 */}

    </div>
  );
}

// ── Zone components ───────────────────────────────────────────────────────────
function ZoneHeader({ label, color = "default" }) {
  const colorMap = { amber: "#f59e0b", indigo: "#6366f1", green: "#22c55e", purple: "#a855f7" };
  const c = colorMap[color] || "var(--app-text-soft)";
  return (
    <div className="flex items-center gap-3 select-none">
      <div className="h-px flex-1" style={{ background: "var(--app-border)" }} />
      <span className="text-[9px] font-black uppercase tracking-[0.15em] shrink-0" style={{ color: c }}>{label}</span>
      <div className="h-px flex-1" style={{ background: "var(--app-border)" }} />
    </div>
  );
}

function ZonedKPIRow({ data, navigate }) {
  const delta = data ? calcDelta(data.thisMonthLeads, data.lastMonthLeads) : null;
  const stats = [
    {
      label: "Total Leads", value: data?.allTimeTotal ?? 0, color: "#f97316",
      sub: delta !== null ? `${delta >= 0 ? "↑" : "↓"} ${Math.abs(delta)}% vs last month` : "All time",
      subColor: delta !== null ? (delta >= 0 ? "#22c55e" : "#ef4444") : undefined,
      onClick: () => navigate("/leads"),
    },
    {
      label: "Pipeline", value: fmtINR(data?.pipelineValue), color: "var(--app-text)",
      sub: `${data?.pipelineLeads || 0} active leads`,
    },
    {
      label: "New", value: data?.allTimeNew ?? 0, color: "#6366f1",
      sub: "Uncontacted",
      onClick: () => navigate("/leads", { state: { presetStatus: "New" } }),
    },
    {
      label: "Closed Won", value: data?.allTimeClosedWon ?? 0, color: "#22c55e",
      sub: `${data?.conversionRate ?? 0}% conversion`,
      onClick: () => navigate("/leads", { state: { presetStatus: "Closed Won" } }),
    },
    {
      label: "Follow-ups", value: data?.todayFollowUps ?? 0, color: "#f59e0b",
      sub: "Due today",
      onClick: () => navigate("/leads", { state: { presetFollowUpToday: true } }),
    },
    {
      label: "Avg Response", value: fmtResponseTime(data?.avgResponseMs), color: "#22c55e",
      sub: "First contact",
    },
  ];
  return (
    <div data-tour="stat-cards" className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {stats.map((s) => {
          const inner = (
            <>
              <p className="text-[9px] text-app-soft uppercase tracking-wider font-semibold truncate leading-none">{s.label}</p>
              <p className="text-xl sm:text-2xl font-black leading-none truncate mt-1" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[9px] truncate mt-0.5" style={{ color: s.subColor || "var(--app-text-soft)" }}>{s.sub}</p>
            </>
          );
          return s.onClick ? (
            <button key={s.label} type="button" onClick={s.onClick}
              className="card p-3 flex flex-col gap-0 text-left hover:-translate-y-0.5 transition hover:border-orange-500/30">
              {inner}
            </button>
          ) : (
            <div key={s.label} className="card p-3 flex flex-col gap-0">
              {inner}
            </div>
          );
        })}
      </div>
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

// ── Goal Metrics Row ─────────────────────────────────────────────────────────
function GoalMetricsRow({ goal, current, avgResponseMs, role, onGoalUpdate }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState("");
  const [saving, setSaving] = useState(false);
  const canEdit = role === "admin" || role === "manager";
  const pct = goal > 0 ? Math.min(100, Math.round(current / goal * 100)) : 0;

  const save = async () => {
    const n = parseInt(val, 10);
    if (isNaN(n) || n < 1) return;
    setSaving(true);
    try {
      await api.patch("/org/me/goal", { monthlyClosingGoal: n });
      onGoalUpdate(n);
      setEditing(false);
    } catch { toast.error("Failed to save goal. Please try again."); } finally { setSaving(false); setEditing(false); }
  };

  if (goal === 0 && !canEdit) return null;

  return (
    <section className="card p-3 sm:p-4">
      <div className="flex flex-wrap items-center gap-3 sm:gap-5">
        <div className="flex items-center gap-2 shrink-0">
          <Target className="w-4 h-4 text-orange-500" />
          <span className="text-[11px] font-bold text-app uppercase tracking-wider">Monthly Goal</span>
        </div>

        {goal > 0 ? (
          <>
            <div className="flex items-center gap-2 flex-1 min-w-[140px]">
              <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--app-surface-low)" }}>
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${pct}%`, background: pct >= 100 ? "#22c55e" : "linear-gradient(90deg,#ff6b00,#ffaa00)" }} />
              </div>
              <span className={`text-xs font-bold shrink-0 ${pct >= 100 ? "text-emerald-400" : "text-orange-500"}`}>{pct}%</span>
            </div>
            <span className="text-xs text-app-soft shrink-0">
              <span className="font-bold text-app">{current}</span> / {goal} closings this month
            </span>
          </>
        ) : (
          <span className="text-xs text-app-soft flex-1">
            {canEdit ? "No goal set. Click the pencil to set a monthly closing target." : "No monthly goal set."}
          </span>
        )}

        {canEdit && (
          editing ? (
            <div className="flex items-center gap-2 shrink-0">
              <input type="number" min="1" value={val}
                onChange={(e) => setVal(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && save()}
                className="input w-20 text-center text-sm py-1" placeholder="Target"
                autoFocus />
              <button type="button" onClick={save} disabled={saving}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-500 text-white hover:bg-orange-600 transition">
                <Check className="w-3.5 h-3.5" />
              </button>
              <button type="button" onClick={() => setEditing(false)}
                className="flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-black/5 dark:hover:bg-white/5">
                <X className="w-3.5 h-3.5 text-app-soft" />
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => { setEditing(true); setVal(String(goal || "")); }}
              title="Set monthly goal"
              className="flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-black/5 dark:hover:bg-white/5 shrink-0">
              <Pencil className="w-3.5 h-3.5 text-app-soft" />
            </button>
          )
        )}

        {avgResponseMs !== null && avgResponseMs !== undefined && (
          <>
            <div className="hidden sm:block h-5 w-px shrink-0" style={{ background: "var(--app-border)" }} />
            <div className="flex items-center gap-2 shrink-0">
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-xs text-app-soft">Avg first response · </span>
              <span className="text-xs font-bold text-emerald-400">{fmtResponseTime(avgResponseMs)}</span>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

// ── Activity Feed ─────────────────────────────────────────────────────────────
function ActivityFeed({ items, navigate }) {
  function timeAgo(date) {
    const s = Math.floor((Date.now() - new Date(date)) / 1000);
    if (s < 60) return "just now";
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
  }
  const TYPE_COLOR = {
    status_changed: "#f59e0b", called: "#22c55e", site_visit: "#8b5cf6",
    note_added: "#06b6d4", assigned: "#3b82f6", follow_up_set: "#f97316",
    created: "#ff6b00", emailed: "#ec4899",
  };
  return (
    <section className="card p-6 xl:col-span-7">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="stitch-kicker mb-1">Live Feed</p>
          <h3 className="text-base font-bold text-app">Team Activity</h3>
        </div>
        <div className="stitch-pill text-xs">Last 10 actions</div>
      </div>
      {(!items || items.length === 0) ? (
        <p className="text-sm text-app-soft py-4">No activity recorded yet.</p>
      ) : (
        <div className="space-y-0.5">
          {items.map((item, i) => (
            <button key={i} type="button"
              onClick={() => navigate("/leads", { state: { openLeadId: item.leadId } })}
              className="w-full flex items-start gap-3 rounded-xl px-2 py-2 text-left hover:bg-orange-500/5 transition">
              <div className="mt-1.5 w-2 h-2 rounded-full shrink-0"
                style={{ background: TYPE_COLOR[item.type] || "#6b7280" }} />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-app leading-snug">
                  <span className="font-semibold">{item.performedByName || "System"}</span>
                  <span className="text-app-soft"> · {item.description}</span>
                </p>
                <p className="text-[10px] text-app-soft mt-0.5">{item.leadName} · {timeAgo(item.createdAt)}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

// ── Pipeline Drop-off Funnel ──────────────────────────────────────────────────
function DropoffFunnel({ allTimeByStatus }) {
  const STAGES = [
    { key: "New",         color: "#6366f1" },
    { key: "Contacted",   color: "#f59e0b" },
    { key: "Site Visit",  color: "#8b5cf6" },
    { key: "Negotiation", color: "#f97316" },
    { key: "Closed Won",  color: "#22c55e" },
    { key: "Closed Lost", color: "#ef4444" },
  ];
  const total = STAGES.reduce((s, st) => s + (allTimeByStatus?.[st.key] || 0), 0);
  if (!total) return null;
  return (
    <section className="card p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="stitch-kicker mb-1">Where leads get stuck</p>
          <h3 className="text-base font-bold text-app">Pipeline Drop-off</h3>
        </div>
        <div className="stitch-pill text-xs">{total} all-time</div>
      </div>
      <div className="space-y-2">
        {STAGES.map(({ key, color }) => {
          const count = allTimeByStatus?.[key] || 0;
          const pct = Math.round(count / total * 100);
          return (
            <div key={key} className="flex items-center gap-3">
              <div className="w-24 text-xs text-app-soft text-right shrink-0">{key}</div>
              <div className="flex-1 h-5 rounded-lg overflow-hidden" style={{ background: "var(--app-surface-low)" }}>
                <div className="h-full rounded-lg flex items-center px-2 transition-all duration-700"
                  style={{ width: pct > 0 ? `${Math.max(pct, 4)}%` : "0%", background: color }}>
                  {pct >= 8 && <span className="text-[10px] font-bold text-white">{count}</span>}
                </div>
              </div>
              <div className="w-10 text-xs font-semibold text-app text-right shrink-0">{pct}%</div>
            </div>
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
  const [minimized, setMinimized] = useState(
    () => localStorage.getItem("fup_panel_minimized") !== "0"
  );

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
            onClick={() => setMinimized((v) => { const next = !v; localStorage.setItem("fup_panel_minimized", next ? "1" : "0"); return next; })}
            title={minimized ? "Expand" : "Minimize"}
            className="flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-black/5 dark:hover:bg-white/5"
          >
            <ChevronDown className={`h-3.5 w-3.5 text-app-soft transition-transform duration-200 ${minimized ? "rotate-180" : ""}`} />
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

            {/* Call + WA - icon-only on mobile, label on sm+ */}
            {lead.phone && (
              <div className="flex items-center gap-1.5 shrink-0">
                <a
                  href={`tel:${lead.phone}`}
                  title={lead.phone}
                  className="flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-medium transition"
                  style={{ borderColor: "rgba(249,115,22,0.25)", color: "var(--app-primary)", background: "rgba(249,115,22,0.06)" }}
                >
                  <Phone className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{lead.phone}</span>
                </a>
                <a
                  href={`https://wa.me/${toWa(lead.phone)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="WhatsApp"
                  className="flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-medium transition"
                  style={{ borderColor: "rgba(34,197,94,0.25)", color: "#16a34a", background: "rgba(34,197,94,0.06)" }}
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  <span className="hidden xs:inline">WA</span>
                </a>
              </div>
            )}
          </div>
        ))}
      </div>}

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
  const [minimized, setMinimized] = useState(() => localStorage.getItem("hot_panel_minimized") === "1");

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
    if (icon === "phone")   return <Phone className="h-3 w-3" />;
    if (icon === "bell")    return <Bell className="h-3 w-3" />;
    if (icon === "map-pin") return <MapPin className="h-3 w-3" />;
    if (icon === "message") return <MessageCircle className="h-3 w-3" />;
    if (icon === "file")    return <ArrowRight className="h-3 w-3" />;
    if (icon === "handshake") return <CheckCircle className="h-3 w-3" />;
    return <Zap className="h-3 w-3" />;
  };

  const topScore = leads[0]?._score ?? null;

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
            <h3 className="text-sm font-bold text-app leading-tight">Hot Today</h3>
            <p className="text-[11px] text-app-soft truncate">
              {topScore !== null ? `Top score: ${topScore} pts · ${leads.length} ranked` : "AI-ranked leads to call first"}
            </p>
          </div>
        </div>

        {/* Controls — AI SCORED badge + chevron */}
        <div className="shrink-0 flex items-center gap-1">
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
            style={{ background: "linear-gradient(90deg, rgba(249,115,22,0.15), rgba(251,146,60,0.15))", border: "1px solid rgba(249,115,22,0.35)", color: "#fb923c" }}>
            <Sparkles className="h-2.5 w-2.5" />
            <span className="hidden sm:inline">AI Scored</span>
          </span>
          <button type="button"
            onClick={() => setMinimized((v) => { const next = !v; localStorage.setItem("hot_panel_minimized", next ? "1" : "0"); return next; })}
            title={minimized ? "Expand" : "Minimize"}
            className="flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-orange-500/10 cursor-pointer">
            <ChevronDown className={`h-3.5 w-3.5 text-orange-400 transition-transform duration-200 ${minimized ? "rotate-180" : ""}`} />
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
                <div className="shrink-0 flex h-9 w-9 flex-col items-center justify-center rounded-xl text-center"
                  style={{ background: ss.bg }}>
                  <span className="text-[11px] font-black leading-none" style={{ color: ss.color }}>{lead._score}</span>
                  <span className="text-[8px] font-semibold uppercase" style={{ color: ss.color }}>pts</span>
                </div>

                {/* Name + meta */}
                <button type="button"
                  onClick={() => navigate("/leads", { state: { openLeadId: lead._id } })}
                  className="text-left min-w-0 cursor-pointer">
                  <p className="text-sm font-semibold text-app truncate hover:text-orange-500 transition">{lead.name}</p>
                  <p className="text-[11px] text-app-soft truncate">
                    {[lead.status, lead.priority !== "Medium" ? lead.priority : null, lead.preferredLocation].filter(Boolean).join(" · ")}
                  </p>
                </button>
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
                  <a href={`tel:${lead.phone}`}
                    className="flex h-7 w-7 items-center justify-center rounded-lg transition cursor-pointer"
                    style={{ background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.2)", color: "var(--app-primary)" }}
                    title={`Call ${lead.phone}`}>
                    <Phone className="h-3.5 w-3.5" />
                  </a>
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

// ── Admin-only widget wrapper — renders null for agents ───────────────────────
function AdminOnly({ role, children }) {
  if (role !== "admin" && role !== "manager" && role !== "super_admin") return null;
  return children;
}

// ── 1. Revenue Forecast Widget ────────────────────────────────────────────────
function RevenueForecastWidget({ data }) {
  if (!data) return null;
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const dayOfMonth  = new Date().getDate();
  const pace        = dayOfMonth > 0 ? Math.round((data.thisMonthClosedWon / dayOfMonth) * daysInMonth) : 0;
  const goal        = data.monthlyClosingGoal || 0;
  const onTrack     = goal > 0 ? pace >= goal : null;
  const expectedRev = data.pipelineValue && data.conversionRate
    ? Math.round((data.pipelineValue * data.conversionRate) / 100)
    : 0;

  return (
    <section className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="stitch-kicker mb-1">Forecast</p>
          <h3 className="text-base font-bold text-app">Revenue & Closing Pace</h3>
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-xl shrink-0"
          style={{ background: "rgba(99,102,241,0.12)" }}>
          <TrendingUp className="h-4 w-4 text-indigo-400" />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card p-3 flex flex-col gap-1">
          <p className="text-[9px] text-app-soft uppercase tracking-wider font-semibold">Expected Revenue</p>
          <p className="text-lg font-black text-emerald-400 leading-none">{fmtINR(expectedRev)}</p>
          <p className="text-[9px] text-app-soft">At {data.conversionRate ?? 0}% conversion</p>
        </div>
        <div className="card p-3 flex flex-col gap-1">
          <p className="text-[9px] text-app-soft uppercase tracking-wider font-semibold">Month Leads</p>
          <p className="text-lg font-black text-indigo-400 leading-none">{data.thisMonthLeads || 0}</p>
          <p className={`text-[9px] font-semibold ${(data.thisMonthLeads || 0) >= (data.lastMonthLeads || 0) ? "text-emerald-400" : "text-red-400"}`}>
            {(data.lastMonthLeads || 0) === 0 ? "Last month: 0" : `${(data.thisMonthLeads || 0) >= (data.lastMonthLeads || 0) ? "↑" : "↓"} vs ${data.lastMonthLeads} last month`}
          </p>
        </div>
        <div className="card p-3 flex flex-col gap-1">
          <p className="text-[9px] text-app-soft uppercase tracking-wider font-semibold">Closings vs Last Month</p>
          <p className="text-lg font-black text-orange-500 leading-none">{data.thisMonthClosedWon || 0} <span className="text-sm font-normal text-app-soft">/ {data.lastMonthClosedWon || 0}</span></p>
          <p className="text-[9px] text-app-soft">This month / last month</p>
        </div>
        <div className="card p-3 flex flex-col gap-1">
          <p className="text-[9px] text-app-soft uppercase tracking-wider font-semibold">Projected Pace</p>
          <p className={`text-lg font-black leading-none ${onTrack === null ? "text-app" : onTrack ? "text-emerald-400" : "text-red-400"}`}>
            {pace}
          </p>
          <p className="text-[9px] text-app-soft flex items-center gap-0.5">
            {onTrack === null ? "No goal set" : onTrack
              ? <><span className="text-emerald-400">↑</span> On track</>
              : <><span className="text-red-400">↓</span> Behind pace</>}
          </p>
        </div>
      </div>
    </section>
  );
}

// ── 2. Stale Leads Alert Widget ───────────────────────────────────────────────
function StaleLeadsWidget({ navigate }) {
  const [leads, setLeads] = useState(null);
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem("stale_panel_dismissed") === "1"
  );
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("stale_panel_collapsed") === "1"
  );

  useEffect(() => {
    if (dismissed) return;
    api.get("/leads/stale").then((r) => setLeads(r.data.data || [])).catch(() => setLeads([]));
  }, [dismissed]);

  if (dismissed || leads === null || leads.length === 0) return null;

  function daysAgo(date) {
    return Math.floor((Date.now() - new Date(date)) / (1000 * 60 * 60 * 24));
  }

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("stale_panel_collapsed", next ? "1" : "0");
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
            <ChevronDown className={`h-4 w-4 text-app-soft transition-transform duration-200 ${collapsed ? "-rotate-90" : ""}`} />
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
                  <a href={`tel:${lead.phone}`}
                    className="flex h-7 w-7 items-center justify-center rounded-lg shrink-0 transition"
                    style={{ background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.2)", color: "var(--app-primary)" }}>
                    <Phone className="h-3.5 w-3.5" />
                  </a>
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

// ── 3. Project Breakdown Widget ───────────────────────────────────────────────
function ProjectBreakdownWidget({ navigate }) {
  const [projects, setProjects] = useState(null);
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("projects_panel_collapsed") === "1"
  );

  useEffect(() => {
    api.get("/projects/stats").then((r) => setProjects(r.data.data || [])).catch(() => setProjects([]));
  }, []);

  if (!projects || projects.length === 0) return null;

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("projects_panel_collapsed", next ? "1" : "0");
  }

  return (
    <section className="card overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: collapsed ? "none" : "1px solid var(--app-border)" }}>
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg shrink-0"
            style={{ background: "rgba(99,102,241,0.10)" }}>
            <Building2 className="h-3.5 w-3.5 text-indigo-400" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-app leading-tight">Project-wise Leads</p>
            <p className="text-[11px] text-app-soft">{projects.length} active project{projects.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button type="button" onClick={() => navigate("/projects")}
            className="flex items-center gap-1 text-[11px] font-semibold text-app-soft hover:text-app transition rounded-lg px-2.5 py-1"
            style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)" }}>
            View all <ArrowRight className="h-3 w-3" />
          </button>
          <button type="button" onClick={toggleCollapsed}
            className="flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-black/5 dark:hover:bg-white/5">
            <ChevronDown className={`h-4 w-4 text-app-soft transition-transform duration-200 ${collapsed ? "-rotate-90" : ""}`} />
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="p-3 space-y-1">
          {projects.slice(0, 6).map((p) => {
            const pct = p.totalLeads > 0 ? Math.min(100, Math.round((p.closedWon / p.totalLeads) * 100)) : 0;
            return (
              <button key={String(p._id)} type="button"
                onClick={() => navigate(`/projects/${p._id}`)}
                className="w-full flex items-center gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-orange-500/5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-sm font-semibold text-app truncate">{p.name}</p>
                    <span className="text-xs font-bold text-app shrink-0">{p.totalLeads} leads</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--app-surface-low)" }}>
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct >= 50 ? "#22c55e" : "#f97316" }} />
                    </div>
                    <span className="text-[10px] text-app-soft shrink-0">{pct}% won</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ── 4. Live Agent Status Widget ───────────────────────────────────────────────
function LiveAgentStatusWidget({ navigate }) {
  const [team, setTeam] = useState(null);

  useEffect(() => {
    api.get("/attendance/team-today").then((r) => setTeam(r.data.data || [])).catch(() => setTeam([]));
  }, []);

  if (!team || team.length === 0) return null;

  const clocked = team.filter((m) => m.attendance?.clockIn && !m.attendance?.clockOut);
  const done    = team.filter((m) => m.attendance?.clockIn && m.attendance?.clockOut);
  const absent  = team.filter((m) => !m.attendance?.clockIn);

  return (
    <section className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="stitch-kicker mb-1">Live</p>
          <h3 className="text-base font-bold text-app">Agent Status Today</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e" }}>
            {clocked.length} online
          </span>
          <button type="button" onClick={() => navigate("/attendance")}
            className="text-[11px] font-semibold text-app-soft hover:text-app transition rounded-lg px-2.5 py-1"
            style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)" }}>
            Attendance →
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {team.map((member) => {
          const isIn  = member.attendance?.clockIn && !member.attendance?.clockOut;
          const isDone = member.attendance?.clockIn && member.attendance?.clockOut;
          const clockInTime = member.attendance?.clockIn
            ? new Date(member.attendance.clockIn).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" })
            : null;
          return (
            <div key={member.user._id}
              className="flex items-center gap-2.5 p-2.5 rounded-xl"
              style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)" }}>
              <div className="relative flex-shrink-0">
                <div className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold"
                  style={{ background: isIn ? "rgba(34,197,94,0.15)" : isDone ? "rgba(99,102,241,0.12)" : "rgba(107,114,128,0.12)",
                           color: isIn ? "#22c55e" : isDone ? "#6366f1" : "#6b7280" }}>
                  {member.user.name?.[0]?.toUpperCase()}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2"
                  style={{ background: isIn ? "#22c55e" : isDone ? "#6366f1" : "#6b7280",
                           borderColor: "var(--app-surface-low)" }} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-app truncate">{member.user.name}</p>
                <p className="text-[10px] text-app-soft truncate">
                  {isIn ? `In since ${clockInTime}` : isDone ? "Done for today" : "Not checked in"}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ── 5. Weekly Trend Chart Widget ──────────────────────────────────────────────
function WeeklyTrendWidget({ data }) {
  if (!data?.recentDailyLeads) return null;

  const today = new Date();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (6 - i));
    return d.toISOString().slice(0, 10);
  });

  const countMap = {};
  data.recentDailyLeads.forEach((r) => { countMap[r._id] = r.count; });

  const chartData = days.map((date) => ({
    day: new Date(date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short" }),
    count: countMap[date] || 0,
  }));

  const total7 = chartData.reduce((s, d) => s + d.count, 0);
  const prev7  = data.lastMonthLeads || 0;
  const delta7 = data.thisMonthLeads > 0 ? null : null;

  return (
    <section className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="stitch-kicker mb-1">Trends</p>
          <h3 className="text-base font-bold text-app">Leads This Week</h3>
        </div>
        <div className="text-right">
          <p className="text-xl font-black text-app">{total7}</p>
          <p className="text-[10px] text-app-soft">last 7 days</p>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={100}>
        <LineChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <XAxis dataKey="day" tick={{ fontSize: 10, fill: "var(--app-text-soft)" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: "var(--app-text-soft)" }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip
            contentStyle={{ borderRadius: 12, border: "1px solid var(--app-border)", background: "var(--app-bg)", color: "var(--app-text)", fontSize: 12 }}
            cursor={{ stroke: "rgba(249,115,22,0.2)", strokeWidth: 2 }}
          />
          <Line type="monotone" dataKey="count" stroke="#f97316" strokeWidth={2} dot={{ fill: "#f97316", r: 3 }} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </section>
  );
}

// ── 6. Automation Health Widget ───────────────────────────────────────────────
function AutomationHealthWidget({ automations }) {
  if (!automations || automations.length === 0) return null;

  const active   = automations.filter((a) => a.status === "connected" && a.isActive !== false);
  const inactive = automations.filter((a) => a.status !== "connected" || a.isActive === false);

  return (
    <section className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="stitch-kicker mb-1">Integrations</p>
          <h3 className="text-base font-bold text-app">Automation Health</h3>
        </div>
        <div className="flex items-center gap-1.5">
          {active.length > 0 && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e" }}>
              {active.length} live
            </span>
          )}
          {inactive.length > 0 && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444" }}>
              {inactive.length} off
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {automations.slice(0, 6).map((a) => {
          const isLive = a.status === "connected" && a.isActive !== false;
          return (
            <div key={a._id} className="flex items-center gap-2.5 p-2.5 rounded-xl"
              style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)" }}>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl shrink-0">
                <PlatformLogo platform={a.platform} size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-app truncate">{a.name || a.platform}</p>
                <p className="text-[10px] text-app-soft">{a.platform}</p>
              </div>
              <span className="shrink-0 w-2 h-2 rounded-full" style={{ background: isLive ? "#22c55e" : "#ef4444" }} />
            </div>
          );
        })}
      </div>
    </section>
  );
}

function TopLeadSourceCard({ label, value, logo, note, tone, iconTone, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`card relative w-full overflow-hidden p-3 sm:p-6 bg-gradient-to-br text-left transition hover:-translate-y-1 hover:border-orange-500/30 ${tone}`}
    >
      <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-white/5 to-transparent dark:from-white/[0.04]" />
      <div className="relative flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="stitch-kicker mb-1 sm:mb-2 text-[8px] sm:text-[11px] truncate">{label}</p>
          <p className="text-2xl sm:text-4xl font-black tracking-tight text-app">{value}</p>
          <p className="mt-1 sm:mt-2 text-[9px] sm:text-xs text-app-soft hidden sm:block">{note}</p>
        </div>
        <div className={`shrink-0 flex h-8 w-8 sm:h-12 sm:w-12 items-center justify-center rounded-xl sm:rounded-2xl ${iconTone}`}>
          {logo}
        </div>
      </div>
    </button>
  );
}

