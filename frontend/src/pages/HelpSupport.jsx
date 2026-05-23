// pages/HelpSupport.jsx
import { useEffect, useState } from "react";
import {
  ChevronDown, ChevronRight, ExternalLink, Headset, LifeBuoy, Mail,
  MessageSquareMore, PhoneCall, Shield, ShieldQuestion, TicketIcon,
  Plus, X, Clock, CheckCircle2, AlertCircle, Loader2, RefreshCw,
  ChevronLeft, ChevronRight as ChRight,
} from "lucide-react";
import api from "../services/api";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";

// ── Static data ──────────────────────────────────────────────────────────────
const supportCards = [
  {
    icon: PhoneCall,
    title: "Call Support",
    detail: "+91 70668 80808",
    note: "For urgent CRM access or lead routing issues.",
    href: "tel:+917066880808",
  },
  {
    icon: Mail,
    title: "Email Support",
    detail: "support@arthaleads.com",
    note: "Share screenshots or export files for faster debugging.",
    href: "https://mail.google.com/mail/?view=cm&to=support@arthaleads.com&su=Support%20Request",
  },
  {
    icon: MessageSquareMore,
    title: "WhatsApp Help",
    detail: "+91 744 743 0431",
    note: "Quick help for day-to-day sales team questions.",
    href: "https://wa.me/917447430431",
  },
];

const faqs = [
  ["How do I add a new team member?", "Go to the Team page, click Add Team Member, fill in their name and email, set a role (Agent, Manager, or Admin), and save. They will receive their login credentials and can sign in immediately."],
  ["How do I assign leads faster?", "Open the Leads table and click on any lead row to assign it directly. You can also drag and drop leads between stages in the Pipeline view. Use the bulk-select checkbox to assign multiple leads at once."],
  ["Who can change user roles?", "Only Admins can update user roles. Go to Team → click on a member → change their role. Managers can view performance reports but cannot modify roles or remove teammates."],
  ["How do Facebook leads get into Arthaleads?", "Connect your Facebook Page via Automation → Connect Facebook. Once connected, any lead submitted through your Facebook Lead Ad forms will automatically appear in the Leads section within seconds."],
  ["How do I export leads?", "Go to the Leads page and click the Export button (top right). You can export filtered leads as a CSV or Excel file for use in WhatsApp campaigns or external reporting."],
  ["What do the lead statuses mean?", "New = just arrived, not yet contacted. Contacted = call made or message sent. Site Visit = property visit scheduled or done. Negotiation = price or deal discussion ongoing. Converted = sale completed. Lost = lead dropped or unresponsive."],
];

const quickActions = [
  { title: "Need onboarding support?", body: "Ask your admin to add your profile, assign your role, and share your login credentials. Once added, sign in at arthaleads.com and you are ready to go.", action: { label: "Go to Sign In", href: "/login" } },
  { title: "Need missing lead data?", body: "Use the Import option on the Leads screen to upload a CSV. Export the current list first as a backup before doing bulk updates. Supported format: Name, Phone, Email, Source, Status.", action: { label: "Go to Leads", href: "/leads" } },
  { title: "Need admin access?", body: "Admins control roles and permissions. If you need elevated access, contact your system owner or reach out via WhatsApp support.", action: { label: "WhatsApp Support", href: "https://wa.me/917447430431", external: true } },
  { title: "How do I connect Facebook Lead Ads?", body: "Go to Automation in the sidebar, click Connect Facebook, approve the popup, then select your Page and Lead Ad Form. Leads will flow in automatically after setup.", action: { label: "Go to Automation", href: "/automation" } },
];

const PRIVACY_SECTIONS = [
  ["What data we collect", "Account info (name, email, phone, password), lead data (names, phones, emails, property preferences from Facebook Ads, Google, WhatsApp, or manual entry), Facebook Page/Form IDs and access tokens, and login/activity logs for audit."],
  ["How we use it", "To manage your CRM account, receive and store leads from ad platforms, assign leads to agents, send follow-up reminders, generate analytics reports, and maintain security."],
  ["Facebook data", "We connect to Meta's Graph API to retrieve lead submissions. We store Page Access Tokens securely. We do not sell or share Facebook lead data - it is used solely to operate the CRM for you. You can disconnect at any time from the Automation page."],
  ["Data storage & security", "Data is stored on MongoDB Atlas (AWS). We use HTTPS/TLS encryption, bcrypt-hashed passwords, JWT authentication, and role-based access control."],
  ["Data sharing", "We do not sell or share your data with third parties except infrastructure providers (database hosting). Lead data is never used for advertising."],
  ["Your rights", "You can access, correct, or delete your data at any time. You can export leads as CSV or Excel from the Leads page. Contact us to close your account and remove all data."],
  ["Contact", "Arthaleads · info@arthaleads.com · Last updated: 3 April 2026"],
];

const CATEGORIES = [
  { value: "general",          label: "General Enquiry" },
  { value: "technical",        label: "Technical Issue" },
  { value: "billing",          label: "Billing / Plan" },
  { value: "bug",              label: "Bug Report" },
  { value: "feature-request",  label: "Feature Request" },
];

const PRIORITIES = [
  { value: "low",    label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high",   label: "High" },
  { value: "urgent", label: "Urgent" },
];

// ── Helpers ──────────────────────────────────────────────────────────────────
function statusBadge(status) {
  const map = {
    "open":        { label: "Open",        cls: "bg-blue-500/10 text-blue-600 border-blue-500/25" },
    "in-progress": { label: "In Progress", cls: "bg-yellow-500/10 text-yellow-600 border-yellow-500/25" },
    "resolved":    { label: "Resolved",    cls: "bg-green-500/10 text-green-600 border-green-500/25" },
    "closed":      { label: "Closed",      cls: "bg-gray-500/10 text-gray-500 border-gray-500/25" },
  };
  const s = map[status] || map["open"];
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${s.cls}`}>
      {s.label}
    </span>
  );
}

function priorityBadge(priority) {
  const map = {
    "low":    "bg-gray-500/10 text-gray-500",
    "medium": "bg-blue-500/10 text-blue-600",
    "high":   "bg-orange-500/10 text-orange-600",
    "urgent": "bg-red-500/10 text-red-600",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${map[priority] || map.medium}`}>
      {priority}
    </span>
  );
}

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function FaqItem({ question, answer }) {
  const [open, setOpen] = useState(false);
  return (
    <button type="button" onClick={() => setOpen(v => !v)}
      className="w-full text-left rounded-[1.15rem] p-4 stitch-surface-muted transition-all hover:opacity-90 focus:outline-none">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-app">{question}</p>
        {open ? <ChevronDown className="h-4 w-4 shrink-0 text-orange-500" />
               : <ChevronRight className="h-4 w-4 shrink-0 text-app-soft" />}
      </div>
      {open && <p className="mt-3 text-sm text-app-soft leading-6">{answer}</p>}
    </button>
  );
}

function QuickActionItem({ title, body, action }) {
  return (
    <div className="rounded-[1.15rem] p-4 stitch-surface-muted space-y-2">
      <p className="text-sm font-semibold text-app">{title}</p>
      <p className="text-sm text-app-soft leading-6">{body}</p>
      {action && (
        action.external
          ? <a href={action.href} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-semibold text-orange-500 hover:underline mt-1">{action.label} →</a>
          : <a href={action.href}
              className="inline-flex items-center gap-1 text-xs font-semibold text-orange-500 hover:underline mt-1">{action.label} →</a>
      )}
    </div>
  );
}

// ── Raise Ticket Modal ────────────────────────────────────────────────────────
function RaiseTicketModal({ onClose, onSuccess }) {
  const [form, setForm] = useState({ subject: "", description: "", category: "general", priority: "medium" });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const e = {};
    if (!form.subject.trim()) e.subject = "Subject is required";
    if (!form.description.trim()) e.description = "Description is required";
    if (form.description.trim().length < 20) e.description = "Please describe the issue in more detail (min 20 characters)";
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    try {
      const { data } = await api.post("/tickets", form);
      onSuccess(data.ticket);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to submit ticket");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9990] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)" }}>
      <div className="w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden"
        style={{ background: "var(--app-surface)", border: "1px solid var(--app-border)" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b" style={{ borderColor: "var(--app-border)" }}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl" style={{ background: "rgba(var(--app-primary-rgb),0.10)" }}>
              <TicketIcon className="h-5 w-5" style={{ color: "var(--app-primary)" }} />
            </div>
            <div>
              <h2 className="text-base font-bold text-app">Raise a Support Ticket</h2>
              <p className="text-xs text-app-soft">We'll respond within 24 hours</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-app-soft hover:text-app hover:bg-black/5 dark:hover:bg-white/5 transition">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Subject */}
          <div>
            <label className="block text-xs font-semibold text-app-soft mb-1.5 uppercase tracking-wide">Subject *</label>
            <input
              type="text"
              className="input w-full"
              placeholder="Brief description of your issue…"
              value={form.subject}
              maxLength={200}
              onChange={e => { setForm(f => ({ ...f, subject: e.target.value })); setErrors(er => ({ ...er, subject: "" })); }}
            />
            {errors.subject && <p className="mt-1 text-xs text-red-500">{errors.subject}</p>}
          </div>

          {/* Category + Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-app-soft mb-1.5 uppercase tracking-wide">Category</label>
              <select className="input w-full" value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-app-soft mb-1.5 uppercase tracking-wide">Priority</label>
              <select className="input w-full" value={form.priority}
                onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-app-soft mb-1.5 uppercase tracking-wide">Description *</label>
            <textarea
              className="input w-full resize-none"
              rows={5}
              placeholder="Describe the issue in detail. Include steps to reproduce, what you expected, and what actually happened…"
              value={form.description}
              maxLength={3000}
              onChange={e => { setForm(f => ({ ...f, description: e.target.value })); setErrors(er => ({ ...er, description: "" })); }}
            />
            <div className="flex justify-between items-center mt-1">
              {errors.description
                ? <p className="text-xs text-red-500">{errors.description}</p>
                : <span />}
              <p className="text-[10px] text-app-soft">{form.description.length}/3000</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-3 rounded-2xl text-sm font-semibold text-app-soft transition hover:bg-black/5 dark:hover:bg-white/5"
              style={{ border: "1px solid var(--app-border)" }}>
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-3 rounded-2xl text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
              style={{ background: "var(--app-primary)" }}>
              {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Submitting…</> : "Submit Ticket"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Ticket Submitted Success Card ─────────────────────────────────────────────
function TicketSuccessModal({ ticket, onClose }) {
  return (
    <div className="fixed inset-0 z-[9990] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)" }}>
      <div className="w-full max-w-sm rounded-3xl p-8 text-center shadow-2xl"
        style={{ background: "var(--app-surface)", border: "1px solid var(--app-border)" }}>
        <div className="flex h-16 w-16 items-center justify-center rounded-full mx-auto mb-4"
          style={{ background: "rgba(34,197,94,0.12)" }}>
          <CheckCircle2 className="h-8 w-8 text-green-500" />
        </div>
        <h2 className="text-xl font-black text-app mb-1">Ticket Submitted!</h2>
        <p className="text-sm text-app-soft mb-4">Your ticket has been received. Our team will respond within 24 hours.</p>

        {/* Ticket number */}
        <div className="rounded-2xl px-5 py-4 mb-6" style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)" }}>
          <p className="text-xs text-app-soft mb-1">Your Ticket Number</p>
          <p className="text-xl font-black tracking-widest" style={{ color: "var(--app-primary)" }}>{ticket.ticketNumber}</p>
          <p className="text-xs text-app-soft mt-1">Save this for future reference</p>
        </div>

        <div className="text-left rounded-2xl px-4 py-3 mb-6 space-y-1.5" style={{ background: "var(--app-surface-low)" }}>
          <div className="flex justify-between text-xs">
            <span className="text-app-soft">Subject</span>
            <span className="text-app font-semibold text-right max-w-[60%] truncate">{ticket.subject}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-app-soft">Category</span>
            <span className="text-app font-semibold capitalize">{ticket.category.replace("-", " ")}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-app-soft">Priority</span>
            <span className="text-app font-semibold capitalize">{ticket.priority}</span>
          </div>
        </div>

        <button onClick={onClose}
          className="w-full py-3 rounded-2xl text-sm font-semibold text-white transition hover:opacity-90"
          style={{ background: "var(--app-primary)" }}>
          Done
        </button>
      </div>
    </div>
  );
}

// ── My Tickets Section ────────────────────────────────────────────────────────
function MyTickets({ refreshTrigger }) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);

  const load = async (p = 1) => {
    setLoading(true);
    try {
      const { data } = await api.get(`/tickets?page=${p}&limit=10`);
      setTickets(data.tickets);
      setTotal(data.total);
      setPages(data.pages);
      setPage(p);
    } catch {
      toast.error("Failed to load tickets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(1); }, [refreshTrigger]);

  if (loading && tickets.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-app-soft" />
      </div>
    );
  }

  if (!loading && tickets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <TicketIcon className="h-10 w-10 text-app-soft/40 mb-3" />
        <p className="text-sm font-semibold text-app-soft">No tickets yet</p>
        <p className="text-xs text-app-soft/70 mt-1">Raise a ticket if you need help with anything</p>
      </div>
    );
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b" style={{ borderColor: "var(--app-border)" }}>
              {["Ticket #", "Subject", "Category", "Priority", "Status", "Raised On"].map(h => (
                <th key={h} className="text-left px-3 py-2.5 text-[10px] font-bold uppercase tracking-wide text-app-soft whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tickets.map(t => (
              <tr key={t._id} className="border-b hover:bg-black/2 dark:hover:bg-white/2 transition"
                style={{ borderColor: "var(--app-border)" }}>
                <td className="px-3 py-3">
                  <span className="font-mono text-xs font-bold" style={{ color: "var(--app-primary)" }}>{t.ticketNumber}</span>
                </td>
                <td className="px-3 py-3 max-w-[200px]">
                  <p className="text-xs font-semibold text-app truncate">{t.subject}</p>
                </td>
                <td className="px-3 py-3">
                  <span className="text-xs text-app-soft capitalize">{t.category.replace("-", " ")}</span>
                </td>
                <td className="px-3 py-3">{priorityBadge(t.priority)}</td>
                <td className="px-3 py-3">{statusBadge(t.status)}</td>
                <td className="px-3 py-3">
                  <span className="text-xs text-app-soft">{fmtDate(t.createdAt)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between px-3 py-3 border-t" style={{ borderColor: "var(--app-border)" }}>
          <p className="text-xs text-app-soft">{total} tickets total</p>
          <div className="flex items-center gap-2">
            <button disabled={page <= 1} onClick={() => load(page - 1)}
              className="p-1.5 rounded-lg text-app-soft hover:text-app hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-40 transition">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs text-app">{page} / {pages}</span>
            <button disabled={page >= pages} onClick={() => load(page + 1)}
              className="p-1.5 rounded-lg text-app-soft hover:text-app hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-40 transition">
              <ChRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function HelpSupport() {
  const { user } = useAuth();
  const [showRaiseModal, setShowRaiseModal]   = useState(false);
  const [successTicket,  setSuccessTicket]    = useState(null);
  const [ticketRefresh,  setTicketRefresh]    = useState(0);

  const handleTicketSuccess = (ticket) => {
    setShowRaiseModal(false);
    setSuccessTicket(ticket);
    setTicketRefresh(r => r + 1);
    toast.success(`Ticket ${ticket.ticketNumber} submitted!`);
  };

  return (
    <div className="stitch-page space-y-6">
      {/* Modals */}
      {showRaiseModal && (
        <RaiseTicketModal
          onClose={() => setShowRaiseModal(false)}
          onSuccess={handleTicketSuccess}
        />
      )}
      {successTicket && (
        <TicketSuccessModal
          ticket={successTicket}
          onClose={() => setSuccessTicket(null)}
        />
      )}

      {/* Header */}
      <section className="card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="stitch-kicker mb-2">Support Desk</p>
            <h1 className="text-3xl font-black tracking-tight text-app">Help & Support</h1>
            <p className="mt-2 max-w-2xl text-sm text-app-soft">Everything your team needs to get help, onboard faster, and understand how the CRM works.</p>
          </div>
          <button
            onClick={() => setShowRaiseModal(true)}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-semibold text-white transition hover:opacity-90 flex-shrink-0 shadow-lg"
            style={{ background: "var(--app-primary)", boxShadow: "0 4px 14px rgba(var(--app-primary-rgb),0.35)" }}
          >
            <Plus className="h-4 w-4" />
            Raise a Ticket
          </button>
        </div>
      </section>

      {/* Contact cards */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {supportCards.map(({ icon: Icon, title, detail, note, href }) => (
          <a key={title}
            href={href}
            target={href.startsWith("http") ? "_blank" : undefined}
            rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
            onClick={(e) => { if (!href.startsWith("http")) { e.preventDefault(); window.location.href = href; } }}
            className="card p-5 block cursor-pointer hover:ring-2 hover:ring-orange-500/30 hover:shadow-md transition-all">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-500">
              <Icon className="h-5 w-5" />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-app">{title}</h2>
            <p className="mt-2 text-sm font-medium text-orange-500">{detail}</p>
            <p className="mt-2 text-sm text-app-soft">{note}</p>
          </a>
        ))}
      </section>

      {/* My Tickets */}
      <section className="card overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b" style={{ borderColor: "var(--app-border)" }}>
          <div className="flex items-center gap-2 text-app">
            <TicketIcon className="h-5 w-5 text-orange-500" />
            <h2 className="text-xl font-bold">My Tickets</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTicketRefresh(r => r + 1)}
              className="p-2 rounded-xl text-app-soft hover:text-app hover:bg-black/5 dark:hover:bg-white/5 transition"
              title="Refresh">
              <RefreshCw className="h-4 w-4" />
            </button>
            <button
              onClick={() => setShowRaiseModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white transition hover:opacity-90"
              style={{ background: "var(--app-primary)" }}>
              <Plus className="h-3.5 w-3.5" />
              New Ticket
            </button>
          </div>
        </div>
        <MyTickets refreshTrigger={ticketRefresh} />
      </section>

      {/* FAQs + Quick actions */}
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.3fr,1fr]">
        <article className="card p-6 space-y-4">
          <div className="flex items-center gap-2 text-app">
            <ShieldQuestion className="h-5 w-5 text-orange-500" />
            <h2 className="text-xl font-bold">Frequently Asked Questions</h2>
          </div>
          <div className="space-y-3">
            {faqs.map(([question, answer]) => (
              <FaqItem key={question} question={question} answer={answer} />
            ))}
          </div>
        </article>

        <article className="card p-6 space-y-4">
          <div className="flex items-center gap-2 text-app">
            <LifeBuoy className="h-5 w-5 text-orange-500" />
            <h2 className="text-xl font-bold">Quick Actions</h2>
          </div>
          <div className="space-y-3 text-sm text-app-soft">
            {quickActions.map((item) => (
              <QuickActionItem key={item.title} {...item} />
            ))}
          </div>
          <div className="rounded-[1.25rem] border border-orange-500/20 bg-orange-500/5 p-4 text-sm text-app-soft">
            <div className="mb-2 flex items-center gap-2 text-app">
              <Headset className="h-4 w-4 text-orange-500" /> Dedicated support window
            </div>
            Support hours: Monday to Saturday, 10:00 AM to 7:00 PM IST.
          </div>
        </article>
      </section>

      {/* Privacy Policy */}
      <section className="card p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2 text-app">
            <Shield className="h-5 w-5 text-orange-500" />
            <h2 className="text-xl font-bold">Privacy Policy</h2>
          </div>
          <div className="flex items-center gap-2">
            <a href="/privacy" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 stitch-pill text-xs">
              <ExternalLink className="h-3.5 w-3.5" /> Privacy Policy
            </a>
            <a href="/terms" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 stitch-pill text-xs">
              <ExternalLink className="h-3.5 w-3.5" /> Terms of Service
            </a>
          </div>
        </div>
        <div className="space-y-3">
          {PRIVACY_SECTIONS.map(([q, a]) => (
            <FaqItem key={q} question={q} answer={a} />
          ))}
        </div>
      </section>
    </div>
  );
}
