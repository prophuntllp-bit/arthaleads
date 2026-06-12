# WhatsApp Communication Inbox — Full Implementation Plan

## What We're Building

A Pronnel-style Communication Inbox inside Arthaleads CRM that:
- Receives and displays WhatsApp messages in real time
- Lets agents reply manually from inside the CRM
- Has an AI bot that handles follow-ups, reminders, and initial replies automatically
- Allows a human agent to "take over" a conversation and pause the bot
- Stores all conversation history per lead

---

## Phase 0 — WhatsApp Business API Setup (You do this, not code)

This must be done before any code is written.

### Steps
1. Go to **developers.facebook.com → My Apps → Create App → Business**
2. Add the **WhatsApp** product to your app
3. In WhatsApp → Getting Started, note:
   - `Phone Number ID` (looks like `123456789012345`)
   - `WhatsApp Business Account ID`
   - `Temporary Access Token` (replace with a **permanent System User token** — see step 5)
4. Add and verify your real business phone number (or use the sandbox test number first)
5. Create a **permanent token**: Business Settings → System Users → Add System User → Generate Token with `whatsapp_business_messaging` and `whatsapp_business_management` permissions
6. Under WhatsApp → Configuration → Webhook:
   - Callback URL: `https://yourapp.com/api/whatsapp/webhook`
   - Verify Token: any secret string you pick (e.g. `artha_wh_secret_2026`)
   - Subscribe to: `messages`

### Env vars to add to `.env`
```
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_VERIFY_TOKEN=artha_wh_secret_2026
WHATSAPP_BUSINESS_ACCOUNT_ID=
```

---

## Phase 1 — Database Schema

### New Collection: `conversations`
```js
{
  _id,
  orgId,           // tenant scoping
  leadId,          // ref to Lead (nullable — some messages arrive before lead exists)
  platform: "whatsapp",
  contactPhone,    // the customer's phone number in E.164 (+919876543210)
  contactName,     // from WhatsApp profile or lead name
  waContactId,     // WhatsApp's contact ID
  status: "open" | "resolved" | "bot",  // "bot" = AI is handling it
  botEnabled: true,
  assignedTo,      // agent userId
  lastMessageAt,
  lastMessagePreview,
  unreadCount,
  createdAt,
}
```

### New Collection: `messages`
```js
{
  _id,
  orgId,
  conversationId,  // ref to conversations
  waMsgId,         // WhatsApp message ID (for dedup + delivery tracking)
  direction: "inbound" | "outbound",
  sender: "bot" | "agent" | "customer",
  senderName,
  body,            // text content
  mediaType,       // "text" | "image" | "audio" | "document"
  mediaUrl,        // for media messages
  status: "sent" | "delivered" | "read" | "failed",
  timestamp,
  createdAt,
}
```

### Lead model — add field
```js
whatsappConversationId  // ref to conversations._id
```

---

## Phase 2 — Backend Routes

### 2.1 Webhook (`backend/routes/whatsappRoutes.js`)

```
GET  /api/whatsapp/webhook   → Meta webhook verification (echo hub.challenge)
POST /api/whatsapp/webhook   → Receive incoming messages from Meta
```

**Incoming message flow:**
1. Parse the message from Meta's payload
2. Find or create a `conversation` for this phone number
3. Save the `message` document
4. If `conversation.botEnabled === true` → trigger AI bot reply (async)
5. If `conversation.botEnabled === false` → emit a Socket.IO event so the agent's inbox updates in real time
6. Update `conversation.lastMessageAt`, `lastMessagePreview`, `unreadCount`

### 2.2 Conversations API

```
GET    /api/whatsapp/conversations          → list all (paginated, sorted by lastMessageAt)
GET    /api/whatsapp/conversations/:id      → single conversation
GET    /api/whatsapp/conversations/:id/messages  → message history (paginated)
PATCH  /api/whatsapp/conversations/:id      → update (assignedTo, status, botEnabled)
```

### 2.3 Send Message API

```
POST   /api/whatsapp/send
  body: { conversationId, body, mediaUrl? }
```

Calls Meta's Cloud API:
```
POST https://graph.facebook.com/v19.0/{PHONE_NUMBER_ID}/messages
Authorization: Bearer {ACCESS_TOKEN}
{
  messaging_product: "whatsapp",
  to: "+919876543210",
  type: "text",
  text: { body: "Your message here" }
}
```

### 2.4 Bot Toggle API

```
POST /api/whatsapp/conversations/:id/bot-toggle
  body: { enabled: true | false }
```

When disabled → sets `botEnabled: false` and `status: "open"` (human takeover).
When enabled → sets `botEnabled: true` and `status: "bot"`.

---

## Phase 3 — AI Bot Logic

### 3.1 Auto-reply on Incoming Message

When a new inbound message arrives and `botEnabled: true`:

```js
async function botReply(conversation, inboundMessage) {
  // 1. Build context from lead history
  const lead = await Lead.findById(conversation.leadId);
  const recentMessages = await Message.find({ conversationId }).sort("-timestamp").limit(10);

  // 2. Ask OpenAI
  const response = await openai.chat.completions.create({
    model: "claude-sonnet-4-6",  // or whichever model
    messages: [
      { role: "system", content: WHATSAPP_BOT_SYSTEM_PROMPT },
      ...recentMessages.map(m => ({ role: m.direction === "inbound" ? "user" : "assistant", content: m.body })),
      { role: "user", content: inboundMessage.body }
    ]
  });

  // 3. Send via WhatsApp API
  await sendWhatsAppMessage(conversation.contactPhone, response.choices[0].message.content);
}
```

### 3.2 WHATSAPP_BOT_SYSTEM_PROMPT

```
You are a helpful real estate assistant for {orgName}. 
You handle initial inquiries, share property information, 
schedule site visits, and send reminders.

Rules:
- Keep replies short (2-3 sentences max for WhatsApp)
- Be warm and professional
- If the customer wants to talk to a human, say "Let me connect you with our agent" and stop replying (return the special token: [HUMAN_TAKEOVER])
- Never make up prices or availability — say "our agent will confirm shortly"
- Current lead status: {leadStatus}
- Lead name: {leadName}
```

When the bot returns `[HUMAN_TAKEOVER]`, automatically set `botEnabled: false` and notify the assigned agent.

### 3.3 Scheduled Follow-ups

A cron job (`node-cron`, runs every hour):

```js
// Find leads with follow-up dates due that have a linked conversation
const due = await Lead.find({
  followUpDate: { $lte: new Date(), $gte: dayAgo },
  whatsappConversationId: { $exists: true },
  followUpWhatsappSent: { $ne: true }
});

for (const lead of due) {
  const conv = await Conversation.findById(lead.whatsappConversationId);
  if (conv.botEnabled) {
    await sendWhatsAppMessage(conv.contactPhone,
      `Hi ${lead.name}, just checking in about your property enquiry. Are you available for a quick call today?`
    );
    lead.followUpWhatsappSent = true;
    await lead.save();
  }
}
```

### 3.4 Reminder Templates

Pre-built messages triggered by lead status changes:
- **Site Visit Confirmed** → "Your site visit is confirmed for {date} at {time}. Address: {address}. See you there! 🏠"
- **Follow-up Due** → "Hi {name}, following up on your property enquiry. Any questions we can help with?"
- **Quote Sent** → "Hi {name}, we've sent your property quote. Please review and let us know if you'd like to discuss."
- **Negotiation Stage** → "Hi {name}, would you like to schedule a call to finalise the details?"

These can be triggered manually by agents (one-click templates) or automatically by the bot.

---

## Phase 4 — Real-time (Socket.IO)

The inbox needs live updates without page refresh.

### Events emitted from server

```
whatsapp:new_message     → { conversationId, message }   // new inbound
whatsapp:status_update   → { waMsgId, status }            // delivered/read
whatsapp:conv_updated    → { conversationId, changes }    // unread count, last message
```

### Frontend listens

```js
socket.on("whatsapp:new_message", ({ conversationId, message }) => {
  if (activeConversationId === conversationId) {
    appendMessageToThread(message);
    markAsRead(conversationId);
  } else {
    incrementUnreadBadge(conversationId);
  }
});
```

The backend already uses Socket.IO (for notifications) — we extend the same instance.

---

## Phase 5 — Frontend Pages

### 5.1 New Route: `/inbox`

Add to sidebar nav with a green WhatsApp icon + unread badge.

### 5.2 Layout (like WhatsApp Web)

```
┌─────────────────────────────────────────────────────┐
│  INBOX                                              │
├──────────────────┬──────────────────────────────────┤
│ Search           │  [Lead Name]  ●Bot ON   [Takeover]│
│ ─────────────    │  ─────────────────────────────── │
│ ● Ramesh Kumar   │  [Customer bubble] Hi, I'm        │
│   Site visit?.. 2│  interested in 2BHK               │
│                  │                                  │
│ ● Priya S.       │  [Bot bubble] Great! We have     │
│   Confirmed! ✓   │  several options in your budget...│
│                  │                                  │
│ ○ Deepak M.      │  [Customer] Can I see tomorrow?  │
│   Ok thanks      │                                  │
│                  │  [Bot] Absolutely! Our agent will │
│                  │  confirm a slot. 🏠               │
│                  │  ─────────────────────────────── │
│                  │  [Type a message...]    [Send]   │
└──────────────────┴──────────────────────────────────┘
```

### 5.3 Key UI Components

- `ConversationList` — sorted by `lastMessageAt`, shows unread dot + count
- `ChatThread` — message bubbles (inbound left, outbound right), bot messages tagged with "🤖 Bot"
- `BotToggle` — pill switch "Bot ON" / "Take Over". When toggled off, shows blue agent indicator
- `MessageComposer` — text input + emoji + template picker dropdown + send
- `TemplateMenu` — quick-insert follow-up/reminder templates
- `LeadPreviewSidebar` — shows the linked lead's status, phone, last note (right panel)

### 5.4 Linking Conversations to Leads

When a new WhatsApp message arrives from an unknown number:
- Try to auto-match to a Lead by phone number
- If matched, link `conversation.leadId = lead._id`
- If unmatched, show a "Create Lead" button in the sidebar that pre-fills name + phone from WhatsApp profile

---

## Phase 6 — Human Takeover Flow

1. Agent sees active bot conversation in inbox
2. Clicks **Take Over** button
3. `botEnabled` set to `false` via API
4. Bot stops auto-replying immediately
5. Conversation status changes to `open`, assigned to agent
6. Agent can now type and send freely
7. Agent can re-enable bot with **Hand back to Bot** button
8. Bot re-enables and picks up context from message history

Visual indicator: Bot messages show `🤖` prefix tag. Human messages show agent avatar.

---

## Implementation Order (Phases)

| Phase | What | Time estimate |
|-------|------|--------------|
| 0 | WhatsApp API setup (you do this) | 1–2 days |
| 1 | DB schema + Mongoose models | 0.5 days |
| 2 | Webhook receive + send API | 1 day |
| 3 | Basic inbox UI (no bot yet) | 2 days |
| 4 | Real-time with Socket.IO | 0.5 days |
| 5 | AI bot auto-reply | 1 day |
| 6 | Scheduled follow-ups cron | 0.5 days |
| 7 | Human takeover + templates | 1 day |
| 8 | Link to lead, create lead flow | 0.5 days |
| 9 | Polish + mobile view | 1 day |

**Total: ~8–10 days of focused dev work**

---

## Dependencies to Install

```bash
# Backend
npm install @whiskeysockets/baileys  # NOT needed if using Cloud API
# We use Meta Cloud API directly (no extra SDK needed — just fetch/axios)
npm install node-cron                # scheduled follow-ups

# Frontend (nothing new — uses existing socket + api setup)
```

---

## What We Are NOT Building (scope boundary)

- Instagram DMs, Facebook Messenger (can add later same pattern)
- Voice/calling via WhatsApp
- WhatsApp template message approval flow (Meta requires approval for outbound to non-opted-in users — agent must message first or use approved templates)
- Multi-org WhatsApp numbers (one number per org for now)

---

## Next Step

Complete Phase 0 (get your WhatsApp Business API credentials from Meta Developer Portal), then share:
- Phone Number ID
- Permanent Access Token
- Business Account ID

Once you have those, we start with Phase 1 (models) + Phase 2 (webhook) immediately.
