# Arthaleads CRM

Real-estate lead management SaaS for Indian brokerages and agencies. Manage leads, track pipelines, run automations, score prospects with AI, and close more deals.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + Tailwind CSS |
| Mobile | Capacitor (Android) |
| Backend | Express.js + Node.js |
| Database | MongoDB (Mongoose) |
| AI | OpenAI GPT-4o / 4o-mini |
| Push | Firebase Admin + Web Push (VAPID) |
| Storage | Cloudinary |
| Telephony | EnableX |
| Email | Nodemailer + Resend |
| Monitoring | Sentry |

---

## Project Structure

```
arthaleads/
├── frontend/          # React + Vite SPA
│   ├── src/
│   │   ├── pages/     # One file per route (Dashboard, Leads, Pipeline…)
│   │   ├── components/# Shared UI (CustomSelect, DateTimePicker…)
│   │   └── styles.css # Global CSS variables + keyframe animations
│   └── vite.config.js
├── backend/           # Express REST API
│   ├── routes/        # leadRoutes, projectRoutes, userRoutes…
│   ├── models/        # Mongoose schemas
│   ├── services/      # Business logic (leadService, projectService…)
│   └── utils/         # openai.js, push.js, seed.js…
└── package.json       # Workspace root
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- MongoDB (local or Atlas)
- `.env` files in `backend/` (see below)

### Install

```bash
# Frontend
cd frontend && npm install

# Backend
cd backend && npm install
```

### Run locally (Windows)

```bash
# From workspace root — starts both frontend and backend
npm run start:local
```

Or run each separately:

```bash
# Backend (http://localhost:5000)
cd backend && npm run dev

# Frontend (http://localhost:5173)
cd frontend && npm run dev
```

### Build for production

```bash
cd frontend && npm run build   # outputs to frontend/dist/
cd backend && npm start
```

---

## Environment Variables (`backend/.env`)

```env
MONGODB_URI=
JWT_SECRET=
OPENAI_API_KEY=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
FIREBASE_PROJECT_ID=
FIREBASE_PRIVATE_KEY=
FIREBASE_CLIENT_EMAIL=
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=
SENTRY_DSN=
RESEND_API_KEY=
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
ENABLEX_APP_ID=
ENABLEX_APP_KEY=
```

---

## Features

### Dashboard — Zoned Layout

Six clear zones, all fully responsive (mobile → tablet → desktop):

| Zone | Content |
|---|---|
| **Today at a Glance** | 6 KPI stat cards — Total Leads, Pipeline, New, Closed Won, Follow-ups due, Avg Response |
| **Action Required** | Overdue Follow-ups (left) · Hot Today AI card (right) · Upcoming 48 hrs |
| **Admin Intelligence** | Stale Leads · Revenue Forecast · Weekly Trend · Live Agent Status · Automation Health · Project Breakdown + Monthly Goal |
| **Performance** | Leads by Status bar chart · Leads by Source donut · Drop-off Funnel |
| **Team** | Top Agents leaderboard · Activity Feed |

**Hot Today** is the main AI differentiator — scores every lead 0–100 pts and ranks them so agents always know who to call first. Marked with an animated orange spinning border (the only card with this effect) and a live pulsing dot.

### Core Modules

- **Leads** — full CRUD, CSV/Excel import, bulk actions, AI scoring, call & WhatsApp in one click
- **Pipeline** — Kanban drag-and-drop across 6 stages
- **Follow-ups** — overdue flagged in red, today in amber, quick call/WhatsApp per row
- **Projects** — group leads under a real-estate project with its own pipeline and stats
- **Automation** — Facebook Lead Ads OAuth, WordPress webhook, round-robin routing rules
- **Calls** — EnableX telephony log with AI analysis (intent · sentiment · summary · next action)
- **Bookings & Invoices** — record closings, auto-calculate GST brokerage, generate PDF invoices
- **Attendance** — clock in/out, shift management, CSV reports
- **Performance** — per-agent conversion, response time, call count (admin/manager only)
- **Team** — invite members, assign roles (admin / manager / agent)

### AI Features

- **Hot Today scoring** — GPT-4o ranks leads by conversion likelihood
- **Artha AI help bot** — in-app assistant that answers questions about any feature
- **WhatsApp AI drafts** — one-click GPT-generated message tailored to lead context
- **Call analysis** — after every EnableX call: intent, sentiment, summary, key points, next action

### Roles

| Role | Access |
|---|---|
| `super_admin` | Everything including cross-org |
| `admin` | Full org access including Admin Intelligence zone |
| `manager` | Same as admin except team management |
| `agent` | Own leads only, no admin panels |

---

## Mobile (Android via Capacitor)

```bash
cd frontend
npm run build
npx cap sync android
npx cap open android   # opens Android Studio
```

Push notifications use Firebase Admin (server) + `@capacitor/push-notifications` (client).

---

## Git Workflow

All changes commit and push directly to `main`. No feature branches unless explicitly required.

---

## Key Files

| File | Purpose |
|---|---|
| `frontend/src/pages/Dashboard.jsx` | Most complex page — all dashboard widgets |
| `frontend/src/styles.css` | CSS variables, card styles, keyframe animations |
| `backend/routes/leadRoutes.js` | Lead CRUD + `/hot` + `/stale` + `/analytics` |
| `backend/services/leadService.js` | MongoDB `$facet` analytics aggregation |
| `backend/services/projectService.js` | Project logic + push notifications on lead import |
| `backend/utils/openai.js` | GPT prompts — Artha AI bot + WA draft |
| `backend/utils/push.js` | Web Push (VAPID) + Firebase push helpers |
