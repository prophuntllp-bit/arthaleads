import { useState } from "react";
import { ChevronDown, ChevronRight, ExternalLink, Headset, LifeBuoy, Mail, MessageSquareMore, PhoneCall, Shield, ShieldQuestion } from "lucide-react";

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
  [
    "How do I add a new team member?",
    "Go to the Team page, click Add Team Member, fill in their name and email, set a role (Agent, Manager, or Admin), and save. They will receive their login credentials and can sign in immediately.",
  ],
  [
    "How do I assign leads faster?",
    "Open the Leads table and click on any lead row to assign it directly. You can also drag and drop leads between stages in the Pipeline view. Use the bulk-select checkbox to assign multiple leads at once.",
  ],
  [
    "Who can change user roles?",
    "Only Admins can update user roles. Go to Team → click on a member → change their role. Managers can view performance reports but cannot modify roles or remove teammates.",
  ],
  [
    "How do Facebook leads get into Arthaleads?",
    "Connect your Facebook Page via Automation → Connect Facebook. Once connected, any lead submitted through your Facebook Lead Ad forms will automatically appear in the Leads section within seconds.",
  ],
  [
    "How do I export leads?",
    "Go to the Leads page and click the Export button (top right). You can export filtered leads as a CSV or Excel file for use in WhatsApp campaigns or external reporting.",
  ],
  [
    "What do the lead statuses mean?",
    "New = just arrived, not yet contacted. Contacted = call made or message sent. Site Visit = property visit scheduled or done. Negotiation = price or deal discussion ongoing. Converted = sale completed. Lost = lead dropped or unresponsive.",
  ],
];

const quickActions = [
  {
    title: "Need onboarding support?",
    body: "Ask your admin to add your profile, assign your role, and share your login credentials. Once added, sign in at arthaleads.com and you are ready to go.",
    action: { label: "Go to Sign In", href: "/login" },
  },
  {
    title: "Need missing lead data?",
    body: "Use the Import option on the Leads screen to upload a CSV. Export the current list first as a backup before doing bulk updates. Supported format: Name, Phone, Email, Source, Status.",
    action: { label: "Go to Leads", href: "/leads" },
  },
  {
    title: "Need admin access?",
    body: "Admins control roles and permissions. If you need elevated access, contact your system owner or reach out via WhatsApp support. Do not share admin credentials with team members.",
    action: { label: "WhatsApp Support", href: "https://wa.me/917447430431", external: true },
  },
  {
    title: "How do I connect Facebook Lead Ads?",
    body: "Go to Automation in the sidebar, click Connect Facebook, approve the popup, then select your Page and Lead Ad Form. Leads will flow in automatically after setup.",
    action: { label: "Go to Automation", href: "/automation" },
  },
];

function FaqItem({ question, answer }) {
  const [open, setOpen] = useState(false);
  return (
    <button
      type="button"
      onClick={() => setOpen((v) => !v)}
      className="w-full text-left rounded-[1.15rem] p-4 stitch-surface-muted transition-all hover:opacity-90 focus:outline-none"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-app">{question}</p>
        {open
          ? <ChevronDown className="h-4 w-4 shrink-0 text-orange-500" />
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
              className="inline-flex items-center gap-1 text-xs font-semibold text-orange-500 hover:underline mt-1">
              {action.label} →
            </a>
          : <a href={action.href}
              className="inline-flex items-center gap-1 text-xs font-semibold text-orange-500 hover:underline mt-1">
              {action.label} →
            </a>
      )}
    </div>
  );
}

const PRIVACY_SECTIONS = [
  ["What data we collect", "Account info (name, email, phone, password), lead data (names, phones, emails, property preferences from Facebook Ads, Google, WhatsApp, or manual entry), Facebook Page/Form IDs and access tokens, and login/activity logs for audit."],
  ["How we use it", "To manage your CRM account, receive and store leads from ad platforms, assign leads to agents, send follow-up reminders, generate analytics reports, and maintain security."],
  ["Facebook data", "We connect to Meta's Graph API to retrieve lead submissions. We store Page Access Tokens securely. We do not sell or share Facebook lead data — it is used solely to operate the CRM for you. You can disconnect at any time from the Automation page."],
  ["Data storage & security", "Data is stored on MongoDB Atlas (AWS). We use HTTPS/TLS encryption, bcrypt-hashed passwords, JWT authentication, and role-based access control."],
  ["Data sharing", "We do not sell or share your data with third parties except infrastructure providers (database hosting). Lead data is never used for advertising."],
  ["Your rights", "You can access, correct, or delete your data at any time. You can export leads as CSV or Excel from the Leads page. Contact us to close your account and remove all data."],
  ["Contact", "Arthaleads · info@arthaleads.com · Last updated: 3 April 2026"],
];

export default function HelpSupport() {
  return (
    <div className="stitch-page space-y-6">
      <section className="card p-6">
        <p className="stitch-kicker mb-2">Support Desk</p>
        <h1 className="text-3xl font-black tracking-tight text-app">Help & Support</h1>
        <p className="mt-2 max-w-2xl text-sm text-app-soft">Everything your team needs to get help, onboard faster, and understand how the CRM works.</p>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {supportCards.map(({ icon: Icon, title, detail, note, href }) => (
          <a key={title}
            href={href}
            target={href.startsWith("http") ? "_blank" : undefined}
            rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
            onClick={(e) => {
              if (!href.startsWith("http")) {
                e.preventDefault();
                window.location.href = href;
              }
            }}
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
