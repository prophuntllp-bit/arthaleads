const OpenAI = require("openai");

let _client = null;

function getClient() {
  if (!_client) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY environment variable is not set.");
    }
    _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _client;
}

function fmtBudget(lead) {
  const max = lead.budget?.max;
  if (!max) return "flexible budget";
  if (max >= 1e7) return `₹${(max / 1e7).toFixed(1)} Cr`;
  if (max >= 1e5) return `₹${(max / 1e5).toFixed(0)} L`;
  return `₹${max.toLocaleString("en-IN")}`;
}

async function draftWhatsAppMessage(lead, agentName) {
  const client = getClient();

  const firstName = (lead.name || "").split(" ")[0].trim() || "there";
  const propDesc = [
    lead.bhk && lead.bhk !== "N/A" ? lead.bhk : "",
    lead.propertyType || "property",
  ].filter(Boolean).join(" ");

  const lastNote = (lead.notes || []).slice(-1)[0]?.text?.slice(0, 120) || "";

  const prompt = `You are a warm, professional real estate sales consultant. Write a short WhatsApp message (2–3 sentences only) for the following lead.

Lead info:
- Name: ${lead.name} (call them "${firstName}")
- Property interest: ${propDesc}
- Budget: ${fmtBudget(lead)}
- Preferred location: ${lead.preferredLocation || "flexible"}
- Current status: ${lead.status}
- Purpose: ${lead.purpose || "Buy"}
${lastNote ? `- Recent note: "${lastNote}"` : ""}
- Your name: ${agentName || "your property consultant"}

Rules:
- Greet by first name with a friendly tone
- Mention their specific property interest and/or location naturally
- Ask if they're still looking or offer to help with next step
- Sign off with your name
- Max 3 sentences. No emojis. No placeholders. Output ONLY the message text.`;

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 180,
    temperature: 0.75,
  });

  return response.choices[0]?.message?.content?.trim() || "";
}

// ── Help Assistant ───────────────────────────────────────────────────────────
// Knowledge base describing every CRM feature so the AI answers are grounded in
// what Arthaleads can ACTUALLY do — it must never invent features.
const CRM_KNOWLEDGE = `
ARTHALEADS CRM — FEATURE REFERENCE (the assistant must only describe these real features)

DASHBOARD (/dashboard): Home screen. Shows total leads, new leads, closed won, follow-ups due today, pipeline value, conversion rate, lead source breakdown (Facebook/Google/WhatsApp/Website), a "Hot Today" widget ranking the highest-scored leads with one-tap Call/WhatsApp, leads-by-status bar chart, top agents leaderboard, and team activity feed. Date range filter is top-right. "New Lead" button is top-right.

LEADS (/leads): The master list of every lead. Add a lead with the "+ New Lead" / Add button. Each lead row shows name, phone, status, source, assigned agent. Click a lead to open its detail modal (info, notes, activity tabs, status dropdown, Call/WhatsApp/AI Draft buttons). Select multiple leads (checkboxes) to bulk assign, bulk change status, bulk WhatsApp, or bulk delete. Filter and search are at the top. Export to CSV/Excel is available. AI Draft button writes a personalized WhatsApp message.

PIPELINE (/pipeline): Visual Kanban board. Drag lead cards between columns (New → Contacted → Site Visit → Negotiation → Closed Won → Closed Lost) to update their status. Good for seeing where deals are stuck.

FOLLOW-UPS (/followups): All scheduled follow-ups. Shows overdue (red) and due-today (amber) reminders. Each has quick Call and WhatsApp buttons. Set a follow-up by opening a lead and choosing a follow-up date.

PROJECTS (/projects): Group leads by real-estate project/property. Open a project to see its own leads, details and stats.

AUTOMATION (/automation): Admin/Manager only. Connect lead sources: Facebook Lead Ads (auto-import every form submission), and the WordPress plugin for website forms (MetForm, Contact Form 7, WPForms, Elementor, Gravity Forms, etc.). Set up routing rules to auto-assign incoming leads.

PERFORMANCE (/performance): Admin/Manager only. Per-agent metrics — leads handled, conversions, response time, activity. Compare team members over a date range.

ATTENDANCE (/attendance): Clock in / clock out. Tracks work hours, late marks, half/full day. Admins can set shift timing & buffer in settings, add manual entries, and download a CSV attendance report.

TEAM (/team): Admin only. Invite agents, managers, admins. Each gets a role-based login. Manage or deactivate members here.

SETTINGS (/settings): Profile, password change, organisation logo & brand colour, notification preferences, integration API tokens.

REFERRALS (/referrals): Refer Arthaleads to others and track referral rewards.

DUMP LEADS (/dump-leads): Admin/Manager only. Deleted/archived leads can be viewed and restored here.

PLANS (/plans): View and upgrade subscription plan (Starter / Growth / Enterprise).

ROLES: Admin (full access incl. Team & Automation), Manager (no Team management), Agent (own leads, follow-ups, attendance only).

LEAD STATUSES: New, Contacted, Site Visit, Negotiation, Closed Won, Closed Lost.
LEAD SCORING: Each active lead gets a 0–100 "hotness" score from status, priority, budget, booking, follow-up urgency and engagement. The Dashboard "Hot Today" widget surfaces the highest.
`;

async function answerHelpQuestion(question, currentPage) {
  const client = getClient();

  const prompt = `You are the in-app help assistant for Arthaleads, a real estate CRM. Answer the user's question clearly and briefly so they know what to do and where to find it.

${CRM_KNOWLEDGE}

The user is currently on this page: ${currentPage || "unknown"}.

User question: "${question}"

Rules:
- Only describe features listed above. NEVER invent features that aren't listed. If something isn't in the CRM, say so and suggest the closest real feature.
- Be concise: 2–5 short sentences or a short numbered list of steps.
- When relevant, name the exact page (e.g. "go to the Leads page") and the button to click.
- If a feature is Admin/Manager only and the action requires it, mention that.
- Friendly, plain language. No markdown headings. You may use a simple numbered list.
- If the question is unrelated to the CRM, gently steer back to how you can help with Arthaleads.`;

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 350,
    temperature: 0.3,
  });

  return response.choices[0]?.message?.content?.trim() || "";
}

module.exports = { draftWhatsAppMessage, answerHelpQuestion };
