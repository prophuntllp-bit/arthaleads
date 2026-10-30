// pages/SuperAdminWebsiteChats.jsx - what visitors ask Artha on the website.
//
// Every conversation with the marketing-site chat (POST /api/public/chat) is
// saved as a WebsiteChat (backend/models/WebsiteChat.js): anonymous, one per
// visit, kept for a year. Read them here to see what buyers want to know and
// where Artha's answers fall short (its knowledge lives in
// backend/utils/openai.js, MARKETING_SYSTEM_PROMPT).
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { MessageCircle, RefreshCw, Search, X, Smartphone, Monitor } from "lucide-react";
import api from "../services/api";
import { Spinner } from "../components/UI";

const fmt = (iso) => new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const CTA_LABEL = { demo: "Book a Demo", signup: "Free trial", pricing: "Pricing", contact: "Contact" };

function Conversation({ chat, onClose }) {
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="modal-panel rounded-[1.5rem] w-full max-w-xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 p-5 border-b" style={{ borderColor: "var(--app-border)" }}>
          <div>
            <h2 className="text-lg font-black text-app">Conversation</h2>
            <p className="text-xs text-app-soft">Started on {chat.page || "/"} · {fmt(chat.createdAt)} · {chat.device}</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-app-soft hover:text-app" aria-label="Close"><X className="w-5 h-5" /></button>
        </div>
        <div className="overflow-y-auto p-5 space-y-3">
          {chat.messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${m.role === "user" ? "text-white" : "text-app"}`}
                style={m.role === "user" ? { background: "var(--app-primary)" } : { background: "var(--app-surface-low, rgba(0,0,0,0.04))", border: "1px solid var(--app-border)" }}>
                <p className="whitespace-pre-wrap">{m.text}</p>
                <p className={`text-[10px] mt-1 ${m.role === "user" ? "text-white/70" : "text-app-soft"}`}>
                  {fmt(m.at)}{m.cta ? ` · offered ${CTA_LABEL[m.cta] || m.cta}` : ""}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function SuperAdminWebsiteChats() {
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState({ total: 0, week: 0 });
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [open, setOpen] = useState(null);

  useEffect(() => { document.title = "Website chats · Arthaleads Admin"; }, []);

  const load = useCallback(async (before) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (before) params.set("before", before);
      const { data } = await api.get(`/super-admin/website-chats?${params}`);
      setItems((cur) => (before ? [...cur, ...data.items] : data.items));
      setStats({ total: data.total, week: data.week });
      setMore(data.items.length === 50);
    } catch { toast.error("Could not load website chats"); } finally { setLoading(false); }
  }, [query]);
  useEffect(() => { load(); }, [load]);

  const firstQuestion = (c) => c.messages.find((m) => m.role === "user")?.text || "";

  return (
    <div className="stitch-page">
      {open && <Conversation chat={open} onClose={() => setOpen(null)} />}
      <div className="mb-5">
        <h1 className="text-xl font-black text-app">Website chats</h1>
        <p className="text-xs text-app-soft mt-0.5">
          What visitors ask Artha on arthaleads.com. Anonymous, one row per visit, kept for a year. {stats.week} in the last 7 days, {stats.total} in all.
        </p>
      </div>

      <form className="flex items-center gap-2 mb-4" onSubmit={(e) => { e.preventDefault(); setQuery(q.trim()); }}>
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-app-soft" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search questions and answers" className="input !pl-9" />
        </div>
        <button type="submit" className="btn-secondary text-xs px-3 py-2">Search</button>
        <button type="button" onClick={() => load()} className="btn-secondary gap-1.5 text-xs px-3 py-2 ml-auto" title="Refresh"><RefreshCw className="w-3.5 h-3.5" /></button>
      </form>

      <div className="card overflow-hidden">
        {loading && !items.length ? (
          <div className="flex items-center justify-center py-20"><Spinner size="lg" /></div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <MessageCircle className="h-12 w-12 text-app-soft/30 mb-3" />
            <p className="text-sm font-semibold text-app-soft">{query ? `No chats mention "${query}"` : "No website chats yet"}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="stitch-table stitch-table-fixed min-w-[760px]" style={{ tableLayout: "fixed" }}>
              <colgroup><col style={{ width: 130 }} /><col /><col style={{ width: 90 }} /><col style={{ width: 150 }} /><col style={{ width: 60 }} /></colgroup>
              <thead>
                <tr><th>Last message</th><th>First question</th><th>Questions</th><th>Started on</th><th>Device</th></tr>
              </thead>
              <tbody>
                {items.map((c) => (
                  <tr key={c._id} className="cursor-pointer" onClick={() => setOpen(c)}>
                    <td className="text-xs text-app-soft whitespace-nowrap">{fmt(c.lastAt)}</td>
                    <td className="text-xs text-app truncate" title={firstQuestion(c)}>{firstQuestion(c)}</td>
                    <td className="text-xs text-app-soft">{c.questions}</td>
                    <td className="text-xs text-app-soft truncate">{c.page || "/"}</td>
                    <td className="text-app-soft">{c.device === "mobile" ? <Smartphone className="w-4 h-4" aria-label="Phone" /> : <Monitor className="w-4 h-4" aria-label="Computer" />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {more && (
        <div className="flex justify-center mt-4">
          <button type="button" className="btn-secondary text-xs px-4 py-2" disabled={loading} onClick={() => load(items[items.length - 1].lastAt)}>
            {loading ? "Loading…" : "Load older chats"}
          </button>
        </div>
      )}
    </div>
  );
}
