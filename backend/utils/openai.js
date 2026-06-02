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

module.exports = { draftWhatsAppMessage };
