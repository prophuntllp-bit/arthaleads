import { Headset, LifeBuoy, Mail, MessageSquareMore, PhoneCall, ShieldQuestion } from "lucide-react";

const supportCards = [
  {
    icon: PhoneCall,
    title: "Call Support",
    detail: "+91 98765 43210",
    note: "For urgent CRM access or lead routing issues.",
  },
  {
    icon: Mail,
    title: "Email Support",
    detail: "support@propcrm.in",
    note: "Share screenshots or export files for faster debugging.",
  },
  {
    icon: MessageSquareMore,
    title: "WhatsApp Help",
    detail: "+91 98765 43210",
    note: "Quick help for day-to-day sales team questions.",
  },
];

const faqs = [
  ["How do I add a new team member?", "Go to Team, click Add Team Member, set a role, and save the account."],
  ["How do I assign leads faster?", "Use the Leads table for direct assignment or move opportunities from the Pipeline screen."],
  ["Who can change user roles?", "Admins can update roles. Managers can track performance but cannot remove or re-role teammates."],
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
        {supportCards.map(({ icon: Icon, title, detail, note }) => (
          <article key={title} className="card p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-500">
              <Icon className="h-5 w-5" />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-app">{title}</h2>
            <p className="mt-2 text-sm font-medium text-orange-500">{detail}</p>
            <p className="mt-2 text-sm text-app-soft">{note}</p>
          </article>
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
              <div key={question} className="rounded-[1.15rem] p-4 stitch-surface-muted">
                <p className="text-sm font-semibold text-app">{question}</p>
                <p className="mt-2 text-sm text-app-soft">{answer}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="card p-6 space-y-4">
          <div className="flex items-center gap-2 text-app">
            <LifeBuoy className="h-5 w-5 text-orange-500" />
            <h2 className="text-xl font-bold">Quick Actions</h2>
          </div>
          <div className="space-y-3 text-sm text-app-soft">
            <div className="rounded-[1.15rem] p-4 stitch-surface-muted">
              <p className="font-semibold text-app">Need onboarding support?</p>
              <p className="mt-2">Ask your admin to add your profile, assign your role, and share your first login password.</p>
            </div>
            <div className="rounded-[1.15rem] p-4 stitch-surface-muted">
              <p className="font-semibold text-app">Need missing lead data?</p>
              <p className="mt-2">Use Import on the Leads screen or export the current list before bulk updates.</p>
            </div>
            <div className="rounded-[1.15rem] p-4 stitch-surface-muted">
              <p className="font-semibold text-app">Need admin access?</p>
              <p className="mt-2">Admins control roles. Reach out to the system owner before trying to change restricted permissions.</p>
            </div>
          </div>
          <div className="rounded-[1.25rem] border border-orange-500/20 bg-orange-500/5 p-4 text-sm text-app-soft">
            <div className="mb-2 flex items-center gap-2 text-app"><Headset className="h-4 w-4 text-orange-500" /> Dedicated support window</div>
            Support hours: Monday to Saturday, 10:00 AM to 7:00 PM IST.
          </div>
        </article>
      </section>
    </div>
  );
}
