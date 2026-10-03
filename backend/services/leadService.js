// services/leadService.js
const Lead = require("../models/Lead");
const ProjectLead = require("../models/ProjectLead");
const { projectLeadFromLead } = require("../utils/projectLeadFromLead");
const Project = require("../models/Project");
const User = require("../models/User");
const Organization = require("../models/Organization");
const WaConversation = require("../models/WaConversation");
const WaMessage = require("../models/WaMessage");
const { AppError } = require("../middlewares/errorHandler");
const { sendPushToUser } = require("../utils/push");
const { getNextAssignee } = require("../utils/assignLead");
const { formatISTDate, istDateKey, startOfISTDay, endOfISTDay } = require("../utils/datetime");
const OPTS = require("../constants/leadOptions");

// ── Analytics cache (in-memory, 60-second TTL per org+range) ─────────────────
// Prevents repeated heavy 18-facet aggregations on every dashboard load.
// Agents get their own cache key since their data is scoped to assignedTo.
const _analyticsCache = new Map();
const ANALYTICS_TTL = 60_000; // 60 seconds

function _analyticsKey(user, query) {
  const range = query.dateRange || `${query.from || ""}_${query.to || ""}`;
  const scope = user.role === "agent" ? String(user._id) : String(user.orgId);
  return `${scope}:${range}`;
}

// Call this from lead write paths to bust the cache for the org immediately.
function invalidateAnalyticsCache(orgId) {
  for (const key of _analyticsCache.keys()) {
    if (key.startsWith(String(orgId) + ":") || key.includes(String(orgId))) {
      _analyticsCache.delete(key);
    }
  }
}

// Escape special regex characters in user-supplied search strings to prevent ReDoS
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// All of this codebase's customers read dates in IST, so a boundary like
// "today" or "this month" has to mean the IST calendar day, not whatever day
// the server's own clock is on. Railway runs this process in UTC (no TZ env
// var set), so the previous version — plain `new Date()` plus `setHours` —
// was quietly anchoring every preset 5:30 hours early: "today" started at
// 5:30am IST, and the tail end of yesterday (IST) still read as today.
//
// Calendar arithmetic (add N days, first-of-month, day-of-week) is done on a
// UTC-midnight stand-in for the IST calendar date, which keeps it immune to
// the server's own timezone and to DST-style surprises. The real +05:30
// offset is applied exactly once, at the end, via startOfISTDay/endOfISTDay.
const keyToAnchor = (key) => new Date(`${key}T00:00:00Z`);
const anchorToKey = (d) => d.toISOString().slice(0, 10);
const shiftKey = (key, days) => {
  const d = keyToAnchor(key);
  d.setUTCDate(d.getUTCDate() + days);
  return anchorToKey(d);
};

const getDateRangeFilter = (dateRange, from, to) => {
  if (from || to) {
    const createdAt = {};
    if (from) createdAt.$gte = startOfISTDay(from);
    if (to)   createdAt.$lte = endOfISTDay(to);
    return Object.keys(createdAt).length ? createdAt : null;
  }

  if (!dateRange) return null;

  const todayKey = istDateKey();

  switch (dateRange) {
    case "today":
      return { $gte: startOfISTDay(todayKey), $lte: endOfISTDay(todayKey) };
    case "yesterday": {
      const y = shiftKey(todayKey, -1);
      return { $gte: startOfISTDay(y), $lte: endOfISTDay(y) };
    }
    case "todayYesterday":
      return { $gte: startOfISTDay(shiftKey(todayKey, -1)), $lte: endOfISTDay(todayKey) };
    case "last7days":
      return { $gte: startOfISTDay(shiftKey(todayKey, -6)), $lte: endOfISTDay(todayKey) };
    case "last14days":
      return { $gte: startOfISTDay(shiftKey(todayKey, -13)), $lte: endOfISTDay(todayKey) };
    case "last28days":
      return { $gte: startOfISTDay(shiftKey(todayKey, -27)), $lte: endOfISTDay(todayKey) };
    case "last30days":
      return { $gte: startOfISTDay(shiftKey(todayKey, -29)), $lte: endOfISTDay(todayKey) };
    case "thisweek": {
      const dow = keyToAnchor(todayKey).getUTCDay(); // 0=Sun..6=Sat, calendar-pure
      return { $gte: startOfISTDay(shiftKey(todayKey, -dow)), $lte: endOfISTDay(todayKey) };
    }
    case "lastweek": {
      const dow = keyToAnchor(todayKey).getUTCDay();
      const lsKey = shiftKey(todayKey, -dow - 7);
      return { $gte: startOfISTDay(lsKey), $lte: endOfISTDay(shiftKey(lsKey, 6)) };
    }
    case "thismonth": {
      const a = keyToAnchor(todayKey);
      const firstKey = `${a.getUTCFullYear()}-${String(a.getUTCMonth() + 1).padStart(2, "0")}-01`;
      return { $gte: startOfISTDay(firstKey), $lte: endOfISTDay(todayKey) };
    }
    case "lastmonth": {
      const a = keyToAnchor(todayKey);
      const y = a.getUTCFullYear(), m = a.getUTCMonth(); // 0-based current month
      const firstOfLast = anchorToKey(new Date(Date.UTC(y, m - 1, 1)));
      const lastOfLast  = anchorToKey(new Date(Date.UTC(y, m, 0))); // day 0 = last day of prev month
      return { $gte: startOfISTDay(firstOfLast), $lte: endOfISTDay(lastOfLast) };
    }
    case "thisyear": {
      const firstKey = `${keyToAnchor(todayKey).getUTCFullYear()}-01-01`;
      return { $gte: startOfISTDay(firstKey), $lte: endOfISTDay(todayKey) };
    }
    case "lastyear": {
      const y = keyToAnchor(todayKey).getUTCFullYear() - 1;
      return { $gte: startOfISTDay(`${y}-01-01`), $lte: endOfISTDay(`${y}-12-31`) };
    }
    default:
      return null;
  }
};

// Helper: log an activity on a lead (call before saving)
const logActivity = (lead, type, description, user, meta = {}) => {
  lead.activities.push({
    type,
    description,
    performedBy: user._id,
    performedByName: user.name,
    meta,
  });
};

// WhatsApp marketing consent is stamped here, never trusted from the client.
// capturedAt and source only move when the status itself changes, so saving an
// unrelated field on the lead form cannot quietly rewrite when consent was
// really given. Every change goes into the activity log: consent with no
// record of who recorded it, and when, is not evidence of anything.
const CONSENT_VERB = { granted: "recorded as given", denied: "recorded as refused", unknown: "cleared" };
function applyConsent(lead, incoming, user, defaultSource = "manual") {
  const next = incoming?.status;
  if (!CONSENT_VERB[next]) return;
  const prev = lead.whatsappConsent?.status || "unknown";
  if (next === prev) return;
  const source = next === "unknown" ? "" : (incoming.source || defaultSource);
  lead.whatsappConsent = { status: next, source, capturedAt: next === "unknown" ? null : new Date() };
  logActivity(lead, "consent_changed", "WhatsApp marketing consent " + CONSENT_VERB[next], user,
    { from: prev, to: next, source });
}

// Last-10-digits match so "+91 98765 43210", "09876543210" and "9876543210" are
// all recognised as the same number regardless of how each source formatted it.
function normalizePhone(phone) {
  return String(phone || "").replace(/\D/g, "").slice(-10);
}

// "shaporjipallonji.com/shapoorji-pallonji-plot-khopoli" — host without www,
// path without its trailing slash; "/" is the bare domain.
function sitePageKey(url) {
  try {
    const u = new URL(String(url).trim());
    const domain = u.hostname.toLowerCase().replace(/^www\./, "");
    const path = u.pathname.replace(/\/+$/, "") || "/";
    return { key: domain + (path === "/" ? "" : path.toLowerCase()), domain, path };
  } catch { return null; }
}

// Matches one page with or without www, trailing slash, query string or hash —
// and nothing deeper, so the bare domain does not swallow every sub-page.
function sitePageCondition(key) {
  const k = String(key).trim().toLowerCase();
  const slash = k.indexOf("/");
  const domain = slash === -1 ? k : k.slice(0, slash);
  const path = slash === -1 ? "" : k.slice(slash).replace(/\/+$/, "");
  return { sourcePage: { $regex: `^https?://(www\\.)?${escapeRegex(domain)}${escapeRegex(path)}/?(?:[?#]|$)`, $options: "i" } };
}

// Several sources ticked at once in the Leads page's Source tree.
// `sourceSel` is a comma-separated list of tokens, each URI-encoded:
//   src:<source>  every lead from that source (e.g. src:WhatsApp)
//   dom:<domain>  website leads from that domain
//   page:<key>    website leads from that one page ("host/path")
// A lead matches if it matches ANY token. Returns null when nothing usable.
function sourceSelectionCondition(sel) {
  if (!sel) return null;
  const tokens = String(sel).split(",").map((t) => t.trim()).filter(Boolean).map((t) => {
    const i = t.indexOf(":");
    let v = "";
    try { v = decodeURIComponent(t.slice(i + 1)); } catch { v = t.slice(i + 1); }
    return { kind: t.slice(0, i), value: v.trim() };
  }).filter((t) => t.value && ["src", "dom", "page"].includes(t.kind)).slice(0, 100);
  if (!tokens.length) return null;
  const or = [];
  const srcs = tokens.filter((t) => t.kind === "src").map((t) => t.value);
  const srcClause = srcs.length ? { source: { $in: srcs } } : null;
  for (const t of tokens.filter((x) => x.kind === "dom")) {
    const d = t.value.toLowerCase().replace(/^www\./, "");
    or.push({ sourceDomain: d });
    or.push({ sourcePage: { $regex: `^https?://(www\\.)?${escapeRegex(d)}(?:[/?#:]|$)`, $options: "i" } });
  }
  for (const t of tokens.filter((x) => x.kind === "page")) or.push(sitePageCondition(t.value));
  // For project leads a ticked source only counts leads that were moved into
  // a project (as when browsing normally), never the bulk-imported contacts;
  // only a ticked website or page reaches those.
  const build = (importsToo) => ({ $or: [
    ...(srcClause ? [importsToo ? srcClause : { ...srcClause, fromLeadId: { $ne: null } }] : []),
    ...or,
  ] });
  return { cond: build(true), projCond: (importsToo) => build(importsToo), hasSites: or.length > 0 };
}

const leadService = {
  // ── Duplicate check ────────────────────────────────────────────────────────
  // Used both by create() (to flag a new lead as a possible duplicate without
  // blocking it - agents may legitimately be logging a repeat inquiry) and by
  // the real-time /leads/check-duplicate endpoint the Add Lead form calls as
  // the agent types a phone number.
  async findDuplicateByPhone(phone, orgId, excludeId) {
    const last10 = normalizePhone(phone);
    if (last10.length < 10) return null;

    const filter = {
      orgId,
      isDeleted: { $ne: true },
      phone: { $regex: escapeRegex(last10) + "$" },
    };
    if (excludeId) filter._id = { $ne: excludeId };

    return Lead.findOne(filter)
      .select("name phone status assignedToName source createdAt")
      .sort({ createdAt: -1 })
      .lean();
  },

  // ── Create ─────────────────────────────────────────────────────────────────
  async create(data, user) {
    let assignedToName = "";

    if (data.assignedTo) {
      // Explicit assignment - validate the agent belongs to this org
      const agent = await User.findOne({ _id: data.assignedTo, orgId: user.orgId });
      if (!agent) throw new AppError("Assigned agent not found", 404);
      assignedToName = agent.name;
    } else {
      // No agent specified - auto-assign via round-robin if org has it enabled
      try {
        const org = await Organization.findById(user.orgId).select("autoAssign").lean();
        if (org?.autoAssign !== false) {
          const assignee = await getNextAssignee(user.orgId);
          data = { ...data, assignedTo: assignee._id };
          assignedToName = assignee.name;
        }
      } catch {
        // No active agents available - leave unassigned
      }
    }

    // Consent is stamped by applyConsent below rather than copied from the
    // request, so capturedAt is always server time.
    const { whatsappConsent: consentIn, ...leadData } = data;
    const lead = new Lead({
      ...leadData,
      orgId: user.orgId,
      createdBy: user._id,
      assignedToName,
    });

    logActivity(lead, "created", `Lead created by ${user.name}`, user);
    applyConsent(lead, consentIn, user);

    if (data.assignedTo) {
      logActivity(lead, "assigned", `Assigned to ${assignedToName}`, user, {
        agentId: data.assignedTo,
        agentName: assignedToName,
      });
    }

    // Flag (don't block) - an agent may legitimately be re-logging a repeat
    // inquiry, so the duplicate is only surfaced as a warning, not prevented.
    const duplicate = await leadService.findDuplicateByPhone(data.phone, user.orgId);
    if (duplicate) {
      logActivity(
        lead,
        "duplicate_flagged",
        `Possible duplicate of existing lead "${duplicate.name}" (same phone number, created ${formatISTDate(duplicate.createdAt)})`,
        user,
        { existingLeadId: duplicate._id }
      );
    }

    await lead.save();
    return { lead, duplicate };
  },

  // ── Website pages leads came from ────────────────────────────────────────
  // One domain often carries several projects' landing pages (shaporjipallonji.com
  // has Treetopia, Vanaha, Khopoli…), each with its own ad campaign. Grouped on
  // host + path with the query string dropped — every ad click appends its own
  // gclid, which would otherwise make each lead its own "page". Derived from the
  // leads themselves, so a new page shows up the moment its first lead lands.
  async getSitePages(user) {
    const strip = { $arrayElemAt: [{ $split: [{ $arrayElemAt: [{ $split: ["$sourcePage", "?"] }, 0] }, "#"] }, 0] };
    const leadMatch = { orgId: user.orgId, isArchived: { $ne: true }, isDeleted: { $ne: true }, sourcePage: { $nin: ["", null] } };
    const projMatch = { orgId: user.orgId, sourcePage: { $nin: ["", null] } };
    // Counts follow the same scope as the list an agent sees, or the number
    // beside a page would not match what clicking it shows.
    if (user.role === "agent") {
      leadMatch.$or = [{ assignedTo: user._id }, { createdBy: user._id }];
      const scoped = await Project.find({ orgId: user.orgId, assignedTo: user._id }).select("_id").lean();
      projMatch.project = { $in: scoped.map((p) => p._id) };
    }
    const group = { $group: { _id: strip, n: { $sum: 1 } } };
    const [a, b] = await Promise.all([
      Lead.aggregate([{ $match: leadMatch }, group]),
      ProjectLead.aggregate([{ $match: projMatch }, group]),
    ]);
    const byKey = new Map();
    for (const r of [...a, ...b]) {
      const k = sitePageKey(r._id);
      if (!k) continue;
      const cur = byKey.get(k.key) || { ...k, count: 0 };
      cur.count += r.n;
      byKey.set(k.key, cur);
    }
    return [...byKey.values()].sort((x, y) => x.domain.localeCompare(y.domain) || y.count - x.count);
  },

  // ── Distinct website domains — powers the "Website" source sub-menu on the
  // Leads page filter bar, so agents can pick a domain instead of typing it ──
  async getDomains(user) {
    const domains = await Lead.distinct("sourceDomain", {
      orgId: user.orgId,
      isDeleted: { $ne: true },
      sourceDomain: { $nin: ["", null] },
    });
    return domains.sort((a, b) => a.localeCompare(b));
  },

  // ── Real campaign/ad/form IDs already seen on this org's leads — powers the
  // Lead Routing form's quick-pick, same idea as getDomains/getSitePages but
  // for Facebook/WhatsApp/Google instead of Website: an admin building a rule
  // picks the actual campaign a lead came from instead of hunting the raw ID
  // down in Ads Manager by hand. Facebook's campaign_id/adset_id/ad_id only
  // started being recorded recently (see webhookRoutes.js's Facebook activity
  // meta), so those three stay empty until new leads arrive even though
  // form_id works immediately.
  async getCampaignOptions(user) {
    const base = { orgId: user.orgId, isDeleted: { $ne: true } };

    const fbField = async (metaKey) => Lead.aggregate([
      { $match: { ...base, source: "Facebook" } },
      { $unwind: "$activities" },
      { $match: { [`activities.meta.${metaKey}`]: { $nin: ["", null] } } },
      { $group: {
          _id: `$activities.meta.${metaKey}`,
          label: { $first: "$leadSourceLabel" },
          count: { $sum: 1 },
          lastSeen: { $max: "$createdAt" },
      } },
      { $sort: { lastSeen: -1 } },
      { $limit: 50 },
    ]);

    const [formId, campaignId, adsetId, adId, waAdId, googleCampaignId] = await Promise.all([
      fbField("formId"),
      fbField("campaignId"),
      fbField("adsetId"),
      fbField("adId"),
      Lead.aggregate([
        { $match: { ...base, source: "WhatsApp", "campaignRef.adId": { $nin: ["", null] } } },
        { $group: {
            _id: "$campaignRef.adId",
            label: { $first: "$campaignRef.headline" },
            count: { $sum: 1 },
            lastSeen: { $max: "$createdAt" },
        } },
        { $sort: { lastSeen: -1 } },
        { $limit: 50 },
      ]),
      Lead.aggregate([
        { $match: { ...base, source: "Google" } },
        { $unwind: "$activities" },
        { $match: { "activities.meta.campaignId": { $nin: ["", null] } } },
        { $group: {
            _id: "$activities.meta.campaignId",
            label: { $first: "$activities.meta.campaignName" },
            count: { $sum: 1 },
            lastSeen: { $max: "$createdAt" },
        } },
        { $sort: { lastSeen: -1 } },
        { $limit: 50 },
      ]),
    ]);

    const shape = (rows) => rows.map((r) => ({ value: r._id, label: r.label || r._id, count: r.count }));
    return {
      facebook: { form_id: shape(formId), campaign_id: shape(campaignId), adset_id: shape(adsetId), ad_id: shape(adId) },
      whatsapp: { ad_id: shape(waAdId) },
      google:   { campaign_id: shape(googleCampaignId) },
    };
  },

  // ── List with filters + pagination ─────────────────────────────────────────
  async getAll(query, user) {
    const {
      status, source, priority, booking, assignedTo,
      search, page = 1, limit = 20,
      sortBy = "createdAt", order = "desc",
      dateRange, from, to,
    } = query;

    const filter = { orgId: user.orgId, isArchived: { $ne: true }, isDeleted: { $ne: true } };
    const andConditions = [];

    // Agents always see only their own leads; myOnly lets admin/manager opt in to same scope
    if (user.role === "agent" || query.myOnly === "true") {
      andConditions.push({ $or: [{ assignedTo: user._id }, { createdBy: user._id }] });
    }

    if (status) filter.status = status;
    if (source) filter.source = source;
    if (priority) filter.priority = priority;
    if (booking) filter.booking = booking;
    if (assignedTo) filter.assignedTo = assignedTo;
    const createdAtFilter = getDateRangeFilter(dateRange, from, to);
    if (createdAtFilter) filter.createdAt = createdAtFilter;

    if (search) {
      const safeSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      andConditions.push({ $or: [
        { name: { $regex: safeSearch, $options: "i" } },
        { phone: { $regex: safeSearch, $options: "i" } },
        { email: { $regex: safeSearch, $options: "i" } },
        { preferredLocation: { $regex: safeSearch, $options: "i" } },
      ] });
    }
    if (query.siteFilter) {
      const rx = { $regex: escapeRegex(query.siteFilter), $options: "i" };
      andConditions.push({ $or: [{ leadSourceLabel: rx }, { sourcePage: rx }, { sourceDomain: rx }, { "notes.text": rx }] });
    }
    if (query.sitePage) andConditions.push(sitePageCondition(query.sitePage));

    if (andConditions.length) {
      filter.$and = andConditions;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOrder = order === "asc" ? 1 : -1;

    const [leads, total] = await Promise.all([
      Lead.find(filter)
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(parseInt(limit))
        .populate("createdBy", "name email")
        .populate("assignedTo", "name email")
        .lean(),
      Lead.countDocuments(filter),
    ]);

    return {
      leads,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
    };
  },

  // ── Get single ─────────────────────────────────────────────────────────────
  async getById(id, user) {
    const lead = await Lead.findOne({ _id: id, orgId: user.orgId })
      .populate("createdBy", "name email")
      .populate("assignedTo", "name email")
      .populate("notes.addedBy", "name")
      .populate("activities.performedBy", "name")
      .lean();

    if (!lead) throw new AppError("Lead not found", 404);

    // Agents can only view leads assigned to or created by them
    if (
      user.role === "agent" &&
      lead.createdBy?._id.toString() !== user._id.toString() &&
      lead.assignedTo?._id?.toString() !== user._id.toString()
    ) {
      throw new AppError("Access denied", 403);
    }

    return lead;
  },

  // Read-only WhatsApp chat history for a lead — lets an agent who's about to
  // call see exactly what the bot/human already discussed with this lead,
  // without digging through the Inbox. Same ownership rule as getById: an
  // agent can only read it for a lead assigned to or created by them.
  async getWhatsAppMessages(id, user) {
    const lead = await Lead.findOne({ _id: id, orgId: user.orgId }).select("assignedTo createdBy").lean();
    if (!lead) throw new AppError("Lead not found", 404);

    if (
      user.role === "agent" &&
      lead.createdBy?.toString() !== user._id.toString() &&
      lead.assignedTo?.toString() !== user._id.toString()
    ) {
      throw new AppError("Access denied", 403);
    }

    const conversation = await WaConversation.findOne({ orgId: user.orgId, leadId: id })
      .select("_id contactPhone status botEnabled assignedToName lastMessageAt")
      .lean();
    if (!conversation) return { conversation: null, messages: [] };

    const messages = await WaMessage.find({ conversationId: conversation._id })
      .sort({ timestamp: 1 })
      .select("direction sender senderName body mediaType mediaUrl interactiveOptions timestamp isGreeting")
      .lean();

    return { conversation, messages };
  },

  // ── Update ─────────────────────────────────────────────────────────────────
  async update(id, updates, user) {
    const lead = await Lead.findOne({ _id: id, orgId: user.orgId });
    if (!lead) throw new AppError("Lead not found", 404);

    // Agents can only modify leads assigned to or created by them
    if (
      user.role === "agent" &&
      lead.assignedTo?.toString() !== user._id.toString()
    ) {
      throw new AppError("Access denied", 403);
    }

    // Track status change
    if (updates.status && updates.status !== lead.status) {
      logActivity(
        lead,
        "status_changed",
        `Status changed from "${lead.status}" to "${updates.status}"`,
        user,
        { from: lead.status, to: updates.status }
      );
      // Record first time the lead is contacted (for response time tracking)
      if (updates.status === "Contacted" && !lead.firstContactedAt) {
        updates.firstContactedAt = new Date();
      }
    }

    // Handle assignment change
    if ("assignedTo" in updates) {
      if (updates.assignedTo) {
        if (updates.assignedTo !== lead.assignedTo?.toString()) {
          const agent = await User.findOne({ _id: updates.assignedTo, orgId: user.orgId });
          if (!agent) throw new AppError("Agent not found", 404);
          updates.assignedToName = agent.name;
          logActivity(lead, "assigned", `Assigned to ${agent.name}`, user, { agentId: agent._id, agentName: agent.name });
          sendPushToUser(agent._id, {
            type: "lead_assigned",
            title: "New Lead Assigned",
            body: `${user.name} has assigned a lead to you - ${lead.name}`,
            data: { leadId: lead._id },
          }).catch(() => {});
        }
      } else {
        // Unassign - clear the name too
        updates.assignedTo = null;
        updates.assignedToName = "";
        logActivity(lead, "assigned", "Unassigned", user, {});
      }
    }

    if (updates.followUpDate) {
      updates.followUpSetBy     = user._id;
      updates.followUpSetByName = user.name;
      logActivity(lead, "follow_up_set", `Follow-up set for ${new Date(updates.followUpDate).toDateString()}`, user);
    } else if (updates.followUpDate === null) {
      updates.followUpSetBy     = null;
      updates.followUpSetByName = "";
    }

    if ("whatsappConsent" in updates) {
      applyConsent(lead, updates.whatsappConsent, user);
      delete updates.whatsappConsent;
    }

    Object.assign(lead, updates);
    await lead.save();
    // Return a fresh read so the response always reflects what's in the DB
    return Lead.findById(lead._id).populate("assignedTo", "name").lean();
  },

  // ── Bulk status ───────────────────────────────────────────────────────────
  // Mirrors PATCH /api/leads/bulk-status, which is authorize("admin","manager").
  // The role check lives here so the copilot inherits it rather than
  // reimplementing it.
  //
  // Deliberately does not write a per-lead activity entry, matching the
  // existing REST behaviour. Worth revisiting: a bulk change is currently
  // invisible in each lead's timeline.
  async bulkUpdateStatus(ids, status, user) {
    if (user.role === "agent") throw new AppError("Agents cannot bulk-update leads", 403);
    if (!Array.isArray(ids) || ids.length === 0) throw new AppError("No leads selected", 400);
    if (!OPTS.STATUS.includes(status)) throw new AppError("Invalid status value", 400);

    const result = await Lead.updateMany(
      { _id: { $in: ids }, orgId: user.orgId },
      { $set: { status } }
    );
    return { matched: result.matchedCount, modified: result.modifiedCount };
  },

  // ── Bulk consent ──────────────────────────────────────────────────────────
  // Mirrors PATCH /api/leads/bulk-consent, authorize("admin","manager").
  //
  // Unlike bulkUpdateStatus above, this one CANNOT skip the per-lead activity
  // entry — consent with no record of who set it and when is not evidence of
  // anything (same reasoning as applyConsent's own comment). So this goes
  // through applyConsent + save per lead rather than a single updateMany, in
  // bounded-size batches so a few hundred leads doesn't open a few hundred
  // concurrent connections at once.
  async bulkUpdateConsent(ids, status, user, source = "manual") {
    if (user.role === "agent") throw new AppError("Agents cannot bulk-update leads", 403);
    if (!Array.isArray(ids) || ids.length === 0) throw new AppError("No leads selected", 400);
    if (!CONSENT_VERB[status]) throw new AppError("Invalid consent value", 400);

    const leads = await Lead.find({ _id: { $in: ids }, orgId: user.orgId }).select("whatsappConsent activities");
    let modified = 0;
    const BATCH = 25;
    for (let i = 0; i < leads.length; i += BATCH) {
      const batch = leads.slice(i, i + BATCH).filter((lead) => (lead.whatsappConsent?.status || "unknown") !== status);
      await Promise.all(batch.map((lead) => {
        applyConsent(lead, { status, source }, user);
        return lead.save();
      }));
      modified += batch.length;
    }
    return { matched: leads.length, modified };
  },

  // ── Delete ────────────────────────────────────────────────────────────────
  // super_admin → permanent hard delete; everyone else → soft delete (dump)
  async delete(id, user) {
    const lead = await Lead.findOne({ _id: id, orgId: user.orgId });
    if (!lead) throw new AppError("Lead not found", 404);

    // Agents can only delete leads assigned to or created by them
    if (
      user.role === "agent" &&
      lead.assignedTo?.toString() !== user._id.toString()
    ) {
      throw new AppError("Access denied", 403);
    }
    if (user.role === "super_admin") {
      await lead.deleteOne();
    } else {
      lead.isDeleted = true;
      lead.deletedAt = new Date();
      await lead.save({ validateBeforeSave: false });
    }
  },

  // ── Bulk Delete ───────────────────────────────────────────────────────────
  // super_admin → permanent hard delete; everyone else → soft delete (dump)
  async bulkDelete(ids, user) {
    // Agents can only delete leads assigned to them
    const ownerFilter = user.role === "agent"
      ? { assignedTo: user._id }
      : {};

    if (user.role === "super_admin") {
      const result = await Lead.deleteMany({ _id: { $in: ids }, orgId: user.orgId });
      return result.deletedCount;
    }
    const result = await Lead.updateMany(
      { _id: { $in: ids }, orgId: user.orgId, ...ownerFilter },
      { $set: { isDeleted: true, deletedAt: new Date() } }
    );
    return result.modifiedCount;
  },

  // ── Bulk Assign ───────────────────────────────────────────────────────────
  // Assign multiple leads to a single agent in one operation
  async bulkAssign(ids, agentId, user) {
    // Validate agent belongs to same org
    const agent = await User.findOne({ _id: agentId, orgId: user.orgId });
    if (!agent) throw new AppError("Agent not found", 404);

    const result = await Lead.updateMany(
      { _id: { $in: ids }, orgId: user.orgId },
      { $set: { assignedTo: agent._id, assignedToName: agent.name } }
    );
    return { modifiedCount: result.modifiedCount, agent };
  },

  // ── Add Note ───────────────────────────────────────────────────────────────
  async addNote(id, text, user) {
    const lead = await Lead.findOne({ _id: id, orgId: user.orgId });
    if (!lead) throw new AppError("Lead not found", 404);

    // Agents can only add notes to leads assigned to or created by them
    if (
      user.role === "agent" &&
      lead.assignedTo?.toString() !== user._id.toString()
    ) {
      throw new AppError("Access denied", 403);
    }

    lead.notes.push({ text, addedBy: user._id, addedByName: user.name });
    logActivity(lead, "note_added", `Note added by ${user.name}`, user);
    await lead.save();
    return lead;
  },

  // ── Edit / remove a note ──────────────────────────────────────────────────
  // A note carries a name and a timestamp, so it reads as a record of who said
  // what. An agent may correct their own; only an admin or manager may touch
  // somebody else's. Both leave an activity entry, because a note quietly
  // changing under a colleague is worse than the typo it fixed.
  async _noteFor(id, noteId, user) {
    const lead = await Lead.findOne({ _id: id, orgId: user.orgId });
    if (!lead) throw new AppError("Lead not found", 404);

    if (
      user.role === "agent" &&
      lead.assignedTo?.toString() !== user._id.toString()
    ) {
      throw new AppError("Access denied", 403);
    }

    const note = lead.notes.id(noteId);
    if (!note) throw new AppError("Note not found", 404);

    if (
      user.role === "agent" &&
      note.addedBy?.toString() !== user._id.toString()
    ) {
      throw new AppError("You can only change notes you wrote yourself", 403);
    }

    return { lead, note };
  },

  async updateNote(id, noteId, text, user) {
    const { lead, note } = await leadService._noteFor(id, noteId, user);
    note.text = text;
    logActivity(lead, "note_updated", `Note edited by ${user.name}`, user);
    await lead.save();
    return lead;
  },

  async deleteNote(id, noteId, user) {
    const { lead, note } = await leadService._noteFor(id, noteId, user);
    note.deleteOne();
    logActivity(lead, "note_deleted", `Note deleted by ${user.name}`, user);
    await lead.save();
    return lead;
  },

  // ── Assign Lead ────────────────────────────────────────────────────────────
  async assign(id, agentId, user) {
    if (user.role === "agent") throw new AppError("Agents cannot reassign leads", 403);

    const [lead, agent] = await Promise.all([
      Lead.findOne({ _id: id, orgId: user.orgId }),
      User.findOne({ _id: agentId, orgId: user.orgId }),
    ]);
    if (!lead) throw new AppError("Lead not found", 404);
    if (!agent) throw new AppError("Agent not found", 404);

    lead.assignedTo = agent._id;
    lead.assignedToName = agent.name;
    logActivity(lead, "assigned", `Assigned to ${agent.name} by ${user.name}`, user, {
      agentId: agent._id,
      agentName: agent.name,
    });
    await lead.save();

    sendPushToUser(agent._id, {
      type: "lead_assigned",
      title: "New Lead Assigned",
      body: `${user.name} has assigned a lead to you - ${lead.name}`,
      data: { leadId: lead._id },
    }).catch(() => {});

    return Lead.findById(lead._id).populate("assignedTo", "name").lean();
  },

  // ── Analytics ──────────────────────────────────────────────────────────────
  async bulkImport(leads, user) {
    // Normalize phone to digits only so format differences don't create false
    // duplicates, e.g. "+91 98765-43210", "9876543210", "098765 43210" all match
    // (mirrors projectService.importLeads' Prospective-leads dedup logic)
    const normalizePhone = (p) => String(p).replace(/\D/g, "").replace(/^91(\d{10})$/, "$1");

    // Fetch every phone already in this org for O(1) lookup
    const existing = await Lead.find({ orgId: user.orgId, isDeleted: { $ne: true } }, "phone").lean();
    const existingSet = new Set(existing.map((l) => normalizePhone(l.phone)));

    // Split: also deduplicate within the file itself (same number appearing twice)
    const seenInBatch = new Set();
    const newLeads = [];
    let duplicates = 0;

    for (const item of leads) {
      const norm = normalizePhone(item.phone);
      if (existingSet.has(norm) || seenInBatch.has(norm)) {
        duplicates++;
      } else {
        seenInBatch.add(norm);
        newLeads.push(item);
      }
    }

    if (!newLeads.length) return { inserted: [], duplicates };

    // Check if org has auto-assign enabled
    const org = await Organization.findById(user.orgId).select("autoAssign").lean();
    const shouldAutoAssign = org?.autoAssign !== false;

    // Phase 1: validate explicit assignees + pre-fetch auto-assignee if needed
    const assigneeCache = {};
    let autoAssignee = null;

    if (shouldAutoAssign) {
      try { autoAssignee = await getNextAssignee(user.orgId); } catch { /* no agents */ }
    }

    for (const item of newLeads) {
      if (item.assignedTo && !assigneeCache[item.assignedTo]) {
        const agent = await User.findOne({ _id: item.assignedTo, orgId: user.orgId });
        if (!agent) throw new AppError(`Assigned agent not found: ${item.assignedTo}`, 404);
        assigneeCache[item.assignedTo] = agent.name;
      }
    }

    // Phase 2: build all docs in memory
    const docs = newLeads.map((item) => {
      // Use explicit assignee if provided, otherwise auto-assign
      const effectiveAssignee = item.assignedTo
        ? { _id: item.assignedTo, name: assigneeCache[item.assignedTo] || "" }
        : autoAssignee || null;

      const assignedToName = effectiveAssignee?.name || "";
      const activities = [
        { type: "created", description: `Lead imported by ${user.name}`, performedBy: user._id, performedByName: user.name },
      ];
      if (effectiveAssignee) {
        activities.push({ type: "assigned", description: `Assigned to ${assignedToName}`, performedBy: user._id, performedByName: user.name, meta: { agentId: effectiveAssignee._id, agentName: assignedToName } });
      }
      return {
        ...item,
        assignedTo: effectiveAssignee?._id || item.assignedTo || null,
        budget: { min: item.budget?.min || 0, max: item.budget?.max || 0, currency: item.budget?.currency || "INR" },
        orgId: user.orgId,
        createdBy: user._id,
        assignedToName,
        activities,
      };
    });

    // Phase 3: insertMany is atomic per batch; if it throws, nothing is persisted
    const inserted = await Lead.insertMany(docs, { ordered: true });
    return { inserted, duplicates };
  },

  async getAllUnified(query, user) {
    const { search, status, source, priority, booking, projectId, page = 1, limit = 50, dateRange, from, to, followUpToday, siteFilter, sitePage, type } = query;
    // `type` opts a caller (the Pipeline board) into explicitly including
    // ProjectLeads across ALL projects, not just a specific `projectId` —
    // "leads" (default, unchanged) = plain Lead collection only, matching
    // every existing caller's behavior; "projects" = ProjectLead only;
    // "all" = both. Leads.jsx's browse-everything view deliberately still
    // skips ProjectLeads by default (see skipProjectLeads below) since they
    // have none of the pipeline fields and would show as blank rows there.
    const wantsProjectLeads = type === "projects" || type === "all";
    const wantsPlainLeads   = type !== "projects";
    // Accept both names — the Leads page filter sends `assignedTo`, some
    // internal callers still send the older `userId`.
    const agentId  = query.assignedTo || query.userId;
    const limitInt = parseInt(limit);
    const pageInt  = parseInt(page);
    const skip     = (pageInt - 1) * limitInt;
    // Cross-collection merge can't push skip/limit down to the DB, so each
    // side fetches its own top-N (sorted the same way) and we merge-sort in
    // memory. Capped so deep pagination can't force an unbounded scan.
    const fetchCap = Math.min(skip + limitInt, 2000);

    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd   = new Date(); todayEnd.setHours(23, 59, 59, 999);

    const createdAtFilter = getDateRangeFilter(dateRange, from, to);
    const consent = query.consent;

    // ── Lead filter ────────────────────────────────────────────────────────────
    const leadFilter = { orgId: user.orgId, isArchived: { $ne: true }, isDeleted: { $ne: true } };
    const andConditions = [];

    if (user.role === "agent" || query.myOnly === "true") {
      // An agent sees only what's actually assigned to (or created by) them —
      // strictly "mine", same as the /leads/hot widget already enforces.
      // This used to also let through any lead nobody owns yet, specifically
      // to cover org.autoAssign being off — but that meant every unassigned
      // lead in the org, whatever project or campaign it came from, was
      // visible (and click-to-callable) by every single agent, which is
      // exactly the leak: an agent with no relationship to a lead could open
      // and call it purely because nobody had assigned it yet. An admin or
      // manager assigning it explicitly is now the only way an agent sees a
      // previously-unassigned lead.
      andConditions.push({ $or: [{ assignedTo: user._id }, { createdBy: user._id }] });
    } else if (agentId && (user.role === "admin" || user.role === "manager")) {
      andConditions.push({ $or: [{ assignedTo: agentId }, { createdBy: agentId }] });
    }
    if (status)   leadFilter.status   = status;
    if (source)   leadFilter.source   = source;
    if (priority) leadFilter.priority = priority;
    // "Not Interested" is just a booking status now. It used to also remove the
    // lead from this list and move it to Dump, which meant marking someone Not
    // Interested made them vanish from the only screen an agent works from.
    if (booking)  leadFilter.booking  = booking;
    // "unknown" also has to match leads that predate the field entirely — every
    // lead created before consent existed has no whatsappConsent at all.
    if (consent === "unknown") leadFilter["whatsappConsent.status"] = { $nin: ["granted", "denied"] };
    else if (consent)          leadFilter["whatsappConsent.status"] = consent;
    if (createdAtFilter) leadFilter.createdAt = createdAtFilter;
    if (followUpToday === "true" || followUpToday === true) {
      leadFilter.followUpDate = { $gte: todayStart, $lte: todayEnd };
    }
    if (search) {
      const rx = { $regex: escapeRegex(search), $options: "i" };
      andConditions.push({ $or: [{ name: rx }, { phone: rx }, { email: rx }, { sourceDomain: rx }, { leadSourceLabel: rx }] });
    }
    if (siteFilter) {
      const rx = { $regex: escapeRegex(siteFilter), $options: "i" };
      andConditions.push({ $or: [{ leadSourceLabel: rx }, { sourcePage: rx }, { sourceDomain: rx }, { "notes.text": rx }] });
    }
    if (sitePage) andConditions.push(sitePageCondition(sitePage));
    const multiSource = sourceSelectionCondition(query.sourceSel);
    if (multiSource) andConditions.push(multiSource.cond);
    if (andConditions.length) leadFilter.$and = andConditions;

    // ── Project-lead filter ────────────────────────────────────────────────────
    // ProjectLead has no `priority` field, so it can never match a priority
    // filter — skip the collection entirely instead of silently contributing
    // zero matches to what looks like "no results".
    // Also skip when browsing "All Projects" with no explicit project AND no
    // domain search — Project Leads have no other pipeline fields
    // (requirements/budget/purpose) and were inflating the unfiltered list
    // with blank rows. An explicit project filter or a domain search both
    // count as deliberate intent to include them.
    // A lead that was moved into a project still counts as one of the org's
    // leads, so it stays in this list (with its details) and answers every
    // filter. Only bulk-imported contacts, which have none of the pipeline
    // fields, are kept out of the plain browse view.
    const transferredOnly = !wantsProjectLeads && !projectId && !siteFilter && !sitePage && !multiSource?.hasSites;
    let projLeads = [], projTotal = 0;
    let projFilterNoStatus = null;

    {
      const projFilter = { orgId: user.orgId };
      if (transferredOnly) projFilter.fromLeadId = { $ne: null };
      if (priority) projFilter.priority = priority;
      if (consent === "unknown") projFilter["whatsappConsent.status"] = { $nin: ["granted", "denied"] };
      else if (consent)          projFilter["whatsappConsent.status"] = consent;
      // A project lead with no status is shown as "New" (see the mapping
      // below), so the New filter has to find it too.
      if (status)  projFilter.status  = status === "New" ? { $in: ["New", "", null] } : status;
      if (source)  projFilter.source  = source;
      // Same rule as regular leads above.
      if (booking) projFilter.booking = booking;
      if (createdAtFilter) projFilter.createdAt = createdAtFilter;
      if (followUpToday === "true" || followUpToday === true) {
        projFilter.$or = [
          { followUp:  { $gte: todayStart, $lte: todayEnd } },
          { followUp2: { $gte: todayStart, $lte: todayEnd } },
        ];
      }
      const projAndConditions = [];
      if (search) {
        const rx = { $regex: escapeRegex(search), $options: "i" };
        projAndConditions.push({ $or: [{ name: rx }, { phone: rx }, { email: rx }, { sourceDomain: rx }, { leadSourceLabel: rx }] });
      }
      if (siteFilter) {
        const rx = { $regex: escapeRegex(siteFilter), $options: "i" };
        projAndConditions.push({ $or: [{ leadSourceLabel: rx }, { sourcePage: rx }, { sourceDomain: rx }, { "notes.text": rx }] });
      }
      if (sitePage) projAndConditions.push(sitePageCondition(sitePage));
      if (multiSource) projAndConditions.push(multiSource.projCond(wantsProjectLeads || !!projectId));
      if (projAndConditions.length) projFilter.$and = projAndConditions;

      // A project lead belongs to an agent when the agent is on the parent
      // Project (Project.assignedTo[]) or, for one moved in from Leads, when it
      // was assigned to them personally.
      const scopeAgentId = (user.role === "agent" || query.myOnly === "true")
        ? user._id
        : (agentId && (user.role === "admin" || user.role === "manager") ? agentId : null);
      if (scopeAgentId) {
        const scoped = await Project.find({ orgId: user.orgId, assignedTo: scopeAgentId }).select("_id").lean();
        projAndConditions.push({ $or: [{ project: { $in: scoped.map((p) => p._id) } }, { assignedTo: scopeAgentId }] });
        projFilter.$and = projAndConditions;
      }
      if (projectId) projFilter.project = projectId;
      projFilterNoStatus = { ...projFilter };
      delete projFilterNoStatus.status;

      [projLeads, projTotal] = await Promise.all([
        ProjectLead.find(projFilter)
          .populate({ path: "project", select: "name assignedTo", populate: { path: "assignedTo", select: "name" } })
          .sort({ createdAt: -1 }).limit(fetchCap).lean(),
        ProjectLead.countDocuments(projFilter),
      ]);
    }

    // Lead has no project association at all — a project filter can only
    // ever match ProjectLead documents, so skip the Lead query entirely.
    const [leads, leadTotal] = (projectId || !wantsPlainLeads)
      ? [[], 0]
      : await Promise.all([
          Lead.find(leadFilter).sort({ createdAt: -1 }).limit(fetchCap).lean(),
          Lead.countDocuments(leadFilter),
        ]);

    const taggedLeads = leads.map((l) => ({ ...l, _type: "lead" }));
    const taggedProjLeads = projLeads.map((pl) => ({
      _id:          pl._id,
      _type:        "project",
      projectId:    pl.project?._id || pl.project,
      projectName:  pl.project?.name || "",
      // ProjectLead has no per-lead assignee — it's assigned via the parent
      // project's agent(s), so surface those names in the same column the
      // unified list already uses for plain-lead assignment.
      assignedTo:     pl.assignedTo || null,
      assignedToName: pl.assignedToName || (pl.project?.assignedTo || []).map((u) => u.name).filter(Boolean).join(", "),
      name:         pl.name,
      phone:        pl.phone,
      email:        pl.email,
      source:       pl.source,
      fromLeadId:   pl.fromLeadId || null,
      leadSourceLabel: pl.leadSourceLabel, sourcePage: pl.sourcePage, sourceDomain: pl.sourceDomain,
      priority:     pl.priority,
      propertyType: pl.propertyType, bhk: pl.bhk, purpose: pl.purpose, budget: pl.budget,
      timeline:     pl.timeline, preferredLocation: pl.preferredLocation, city: pl.city, streetAddress: pl.streetAddress,
      requirements: pl.requirements, formResponses: pl.formResponses, tags: pl.tags,
      followUpNote: pl.followUpNote, campaignRef: pl.campaignRef,
      // ProjectLead.status defaults to "" (unset), not "New" — the Pipeline
      // board buckets strictly by the exact STATUS_OPTIONS names, so an
      // unset status matched none of them and the lead silently vanished
      // from every column instead of landing in "New".
      status:       pl.status || "New",
      remark:       pl.remark,
      remark1:      pl.remark1,
      remark2:      pl.remark2,
      followUpDate: pl.followUp,
      followUp2:    pl.followUp2,
      booking:      pl.booking,
      notes:        pl.notes,
      createdAt:    pl.createdAt,
    }));

    const merged = [...taggedLeads, ...taggedProjLeads]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(skip, skip + limitInt);

    const total = leadTotal + projTotal;

    // statusCounts=1: how many leads each status tab would show, with every
    // other active filter applied (so the tabs always add up to "All").
    // countDocuments, not an aggregate, so ids sent as strings (agent,
    // project) are cast exactly as they are for the list itself.
    let statusCounts;
    if (query.statusCounts === "1" || query.statusCounts === true) {
      const leadNoStatus = { ...leadFilter };
      delete leadNoStatus.status;
      const skipLeads = projectId || !wantsPlainLeads;
      const countFor = async (st) => {
        const [a, b] = await Promise.all([
          skipLeads ? 0 : Lead.countDocuments(st ? { ...leadNoStatus, status: st } : leadNoStatus),
          projFilterNoStatus ? ProjectLead.countDocuments(st ? { ...projFilterNoStatus, status: st === "New" ? { $in: ["New", "", null] } : st } : projFilterNoStatus) : 0,
        ]);
        return a + b;
      };
      const statuses = OPTS.STATUS;
      const counts = await Promise.all([countFor(null), ...statuses.map(countFor)]);
      statusCounts = { all: counts[0] };
      statuses.forEach((st, i) => { statusCounts[st] = counts[i + 1]; });
    }

    return { leads: merged, total, page: pageInt, pages: Math.ceil(total / limitInt), ...(statusCounts ? { statusCounts } : {}) };
  },

  async getAnalytics(user, query = {}) {
    // ── Cache check ───────────────────────────────────────────────────────────
    const cacheKey = _analyticsKey(user, query);
    const cached = _analyticsCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.data;

    // ── Base match (NO date filter - applied per-facet below) ─────────────────
    // Pipeline leads (Lead), plus leads that were moved into a project. A move
    // archives the original Lead and carries it on as a ProjectLead with
    // fromLeadId set, so without the second half every moved lead silently
    // vanished from the dashboard while still showing on the Leads page.
    // Contacts bulk-imported straight into a project (no fromLeadId) stay out:
    // they are a project's database, not leads that came in.
    const baseMatch = { orgId: user.orgId, isArchived: { $ne: true }, isDeleted: { $ne: true } };
    const movedMatch = { orgId: user.orgId, isDeleted: { $ne: true }, fromLeadId: { $ne: null } };
    if (user.role === "agent") {
      baseMatch.assignedTo = user._id;
      movedMatch.assignedTo = user._id;
    }

    // Date range stage - spread into facets that respect the selected period.
    // Follow-up counts intentionally skip this (they cover ALL scheduled follow-ups).
    const createdAtFilter = getDateRangeFilter(query.dateRange, query.from, query.to);
    const dateStage = createdAtFilter ? [{ $match: { createdAt: createdAtFilter } }] : [];

    // Every boundary below is the IST calendar day / month, not the server's
    // (UTC) one: "today" used to start at 5:30am IST and a month began 5:30
    // hours late, so early-morning figures were quietly wrong.
    const todayKey   = istDateKey();
    const todayStart = startOfISTDay(todayKey);
    const todayEnd   = endOfISTDay(todayKey);
    const nowAnchor  = keyToAnchor(todayKey);
    const yr = nowAnchor.getUTCFullYear(), mo = nowAnchor.getUTCMonth(), dom = nowAnchor.getUTCDate();
    const dayKey = (y, m, d) => anchorToKey(new Date(Date.UTC(y, m, d)));
    const thisMonthStart = startOfISTDay(dayKey(yr, mo, 1));
    const thisMonthEnd   = endOfISTDay(dayKey(yr, mo + 1, 0));
    const lastMonthStart = startOfISTDay(dayKey(yr, mo - 1, 1));
    const lastMonthEnd   = endOfISTDay(dayKey(yr, mo, 0));
    // The same number of days into last month, so a month that is two days old
    // is compared with two days of last month, not with all of it.
    const daysInLastMonth = new Date(Date.UTC(yr, mo, 0)).getUTCDate();
    const lastMonthSameDaysEnd = endOfISTDay(dayKey(yr, mo - 1, Math.min(dom, daysInLastMonth)));
    const next48hEnd     = new Date(todayEnd.getTime() + 48 * 60 * 60 * 1000);

    // The window just before the selected one, same length, for "vs previous
    // period". Only defined for a bounded range.
    let previousFilter = null;
    if (createdAtFilter?.$gte && createdAtFilter?.$lte) {
      const len = createdAtFilter.$lte.getTime() - createdAtFilter.$gte.getTime() + 1;
      previousFilter = { $gte: new Date(createdAtFilter.$gte.getTime() - len), $lte: new Date(createdAtFilter.$gte.getTime() - 1) };
    }
    // Trend buckets: per day for a range up to about three months, per month
    // beyond that (or for all time).
    const spanDays = previousFilter ? Math.round((createdAtFilter.$lte - createdAtFilter.$gte) / 86400000) + 1 : null;
    const trendBucket = spanDays && spanDays <= 92 ? "day" : "month";
    const toIstKey = (d) => (d ? new Date(d.getTime() + 5.5 * 3600000).toISOString().slice(0, 10) : null);

    // Single $facet aggregation — allowDiskUse prevents OOM on large orgs
    const [result] = await Lead.aggregate([
      { $match: baseMatch },
      { $unionWith: { coll: ProjectLead.collection.name, pipeline: [
        { $match: movedMatch },
        // A handful of moved records lost their status in the old transfer;
        // they were never worked on the project, so they count as New.
        { $set: { status: { $cond: [{ $in: [{ $ifNull: ["$status", ""] }, [""]] }, "New", "$status"] } } },
      ] } },
      {
        $facet: {
          // All-time totals — never date-filtered, always shows full pipeline
          allTimeTotal: [
            { $count: "count" },
          ],
          allTimeByStatus: [
            { $group: { _id: "$status", count: { $sum: 1 } } },
          ],

          // Period totals for the selected date range (trend/chart data)
          totalLeads: [
            ...dateStage,
            { $count: "count" },
          ],

          // Pipeline breakdown - date-range filtered
          byStatus: [
            ...dateStage,
            { $group: { _id: "$status",   count: { $sum: 1 } } },
          ],
          bySource: [
            ...dateStage,
            { $group: { _id: "$source",   count: { $sum: 1 } } },
          ],
          byPriority: [
            ...dateStage,
            { $group: { _id: "$priority", count: { $sum: 1 } } },
          ],

          // Top agents - date-range filtered, joined with users to skip deactivated agents
          byAgent: [
            ...dateStage,
            { $match: { assignedTo: { $ne: null } } },
            { $group: { _id: "$assignedTo", name: { $first: "$assignedToName" }, count: { $sum: 1 } } },
            { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "user" } },
            { $match: { "user.0": { $exists: true }, "user.0.isActive": { $ne: false } } },
            { $sort: { count: -1 } },
            { $limit: 10 },
            { $project: { _id: 1, name: 1, count: 1 } },
          ],

          // 5 most recent leads - date-range filtered
          recentLeads: [
            ...dateStage,
            { $sort: { createdAt: -1 } },
            { $limit: 5 },
            { $project: { name: 1, source: 1, status: 1, priority: 1, createdAt: 1, assignedToName: 1 } },
          ],

          // Follow-ups intentionally ignore the date-range filter -
          // agents need to see ALL scheduled follow-ups, not just ones
          // created in the last 30 days.
          todayFollowUps: [
            { $match: { followUpDate: { $gte: todayStart, $lte: todayEnd } } },
            { $count: "count" },
          ],
          totalFollowUps: [
            { $match: { followUpDate: { $ne: null } } },
            { $count: "count" },
          ],

          // ── New intelligence facets ──────────────────────────────────────
          // Pipeline value: budget.max sum for active (non-closed) leads
          pipelineValue: [
            { $match: { status: { $nin: ["Closed Won", "Closed Lost"] } } },
            { $group: { _id: null, total: { $sum: "$budget.max" }, count: { $sum: 1 } } },
          ],

          // Month-over-month comparisons
          thisMonthLeads: [
            { $match: { createdAt: { $gte: thisMonthStart, $lte: thisMonthEnd } } },
            { $count: "count" },
          ],
          lastMonthLeads: [
            { $match: { createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd } } },
            { $count: "count" },
          ],
          thisMonthClosedWon: [
            { $match: { status: "Closed Won", updatedAt: { $gte: thisMonthStart, $lte: thisMonthEnd } } },
            { $count: "count" },
          ],
          lastMonthClosedWon: [
            { $match: { status: "Closed Won", updatedAt: { $gte: lastMonthStart, $lte: lastMonthEnd } } },
            { $count: "count" },
          ],

          // ── Figures for the selected date range ──────────────────────────
          // The dashboard cards read these, so changing the range moves them.
          periodPipeline: [
            ...dateStage,
            { $match: { status: { $nin: ["Closed Won", "Closed Lost"] } } },
            { $group: { _id: null, total: { $sum: "$budget.max" }, count: { $sum: 1 } } },
          ],
          periodAvgResponse: [
            ...dateStage,
            { $match: { firstContactedAt: { $ne: null } } },
            { $project: { responseMs: { $subtract: ["$firstContactedAt", "$createdAt"] } } },
            { $group: { _id: null, avgMs: { $avg: "$responseMs" }, count: { $sum: 1 } } },
          ],
          previousPeriodLeads: previousFilter
            ? [{ $match: { createdAt: previousFilter } }, { $count: "count" }]
            : [{ $match: { _id: null } }],
          dailyLeads: [
            ...dateStage,
            { $group: {
              _id: { $dateToString: { format: trendBucket === "day" ? "%Y-%m-%d" : "%Y-%m", date: "$createdAt", timezone: "Asia/Kolkata" } },
              count: { $sum: 1 },
            }},
            { $sort: { "_id": 1 } },
          ],

          lastMonthSamePeriodLeads: [
            { $match: { createdAt: { $gte: lastMonthStart, $lte: lastMonthSameDaysEnd } } },
            { $count: "count" },
          ],
          lastMonthSamePeriodClosedWon: [
            { $match: { status: "Closed Won", updatedAt: { $gte: lastMonthStart, $lte: lastMonthSameDaysEnd } } },
            { $count: "count" },
          ],

          // Site visits scheduled inside the selected range (by visit date,
          // not by when the lead arrived), and how many of those happened.
          periodSiteVisits: [
            { $match: { siteVisitDate: createdAtFilter || { $ne: null } } },
            { $group: { _id: null, count: { $sum: 1 }, done: { $sum: { $cond: ["$siteVisitDone", 1, 0] } } } },
          ],

          // Per-source quality for the selected range, not just volume.
          sourcePerformance: [
            ...dateStage,
            { $group: {
              _id: "$source",
              leads: { $sum: 1 },
              contacted: { $sum: { $cond: [{ $in: [{ $ifNull: ["$status", "New"] }, ["New", ""]] }, 0, 1] } },
              visits: { $sum: { $cond: [{ $or: [
                { $eq: ["$siteVisitDone", true] },
                { $in: ["$status", ["Site Visit", "Negotiation", "Closed Won"]] },
                { $ne: [{ $ifNull: ["$siteVisitDate", null] }, null] },
              ] }, 1, 0] } },
              won: { $sum: { $cond: [{ $eq: ["$status", "Closed Won"] }, 1, 0] } },
            } },
            { $sort: { leads: -1 } },
          ],

          // Raw times for speed-to-lead (worked out below, with WhatsApp).
          periodLeadTimes: [
            ...dateStage,
            { $project: { k: { $ifNull: ["$fromLeadId", "$_id"] }, createdAt: 1, firstContactedAt: 1 } },
            { $limit: 5000 },
          ],

          // Today's new leads and site visits
          todayCreated: [
            { $match: { createdAt: { $gte: todayStart, $lte: todayEnd } } },
            { $count: "count" },
          ],
          todaySiteVisits: [
            { $match: { siteVisitDate: { $gte: todayStart, $lte: todayEnd } } },
            { $count: "count" },
          ],

          // Upcoming follow-ups and site visits in next 48h (after today)
          upcomingItems: [
            { $match: { $or: [
              { followUpDate: { $gt: todayEnd, $lte: next48hEnd } },
              { siteVisitDate: { $gt: todayEnd, $lte: next48hEnd } },
            ]}},
            { $sort: { followUpDate: 1 } },
            { $limit: 8 },
            { $project: { name: 1, phone: 1, followUpDate: 1, siteVisitDate: 1, status: 1, assignedToName: 1 } },
          ],

          // Daily lead counts for the last 7 days (for weekly trend chart)
          recentDailyLeads: [
            { $match: { createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } },
            { $group: {
              _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "Asia/Kolkata" } },
              count: { $sum: 1 },
            }},
            { $sort: { "_id": 1 } },
          ],

          // Recent activity feed — top 10 actions from 50 most recently modified leads
          recentActivity: [
            { $sort: { updatedAt: -1 } },
            { $limit: 50 },
            { $unwind: { path: "$activities", preserveNullAndEmptyArrays: false } },
            { $sort: { "activities.createdAt": -1 } },
            { $limit: 10 },
            { $project: {
              leadName: "$name",
              leadId: "$_id",
              type: "$activities.type",
              description: "$activities.description",
              performedByName: "$activities.performedByName",
              createdAt: "$activities.createdAt",
            }},
          ],

          // Average first response time (all-time)
          avgFirstResponse: [
            { $match: { firstContactedAt: { $ne: null } } },
            { $project: { responseMs: { $subtract: ["$firstContactedAt", "$createdAt"] } } },
            { $group: { _id: null, avgMs: { $avg: "$responseMs" } } },
          ],
        },
      },
    ], { allowDiskUse: true, maxTimeMS: 25000 });

    // ── Speed to lead ────────────────────────────────────────────────────────
    // Time from a lead arriving to the team's first human touch: a call, the
    // lead being marked Contacted, or an agent's own WhatsApp message. The
    // WhatsApp bot's instant replies deliberately don't count.
    let speedToLead = null;
    try {
      const rows = result.periodLeadTimes || [];
      if (rows.length) {
        const WaConversation = require("../models/WaConversation");
        const WaMessage = require("../models/WaMessage");
        const convs = await WaConversation.find({ orgId: user.orgId, leadId: { $in: rows.map((r) => r.k) } }).select("leadId").lean();
        const firstAgent = convs.length ? await WaMessage.aggregate([
          { $match: { conversationId: { $in: convs.map((c) => c._id) }, sender: "agent", direction: "outbound" } },
          { $group: { _id: "$conversationId", at: { $min: "$timestamp" } } },
        ]) : [];
        const convLead = new Map(convs.map((c) => [String(c._id), String(c.leadId)]));
        const waFirst = new Map();
        for (const f of firstAgent) {
          const lid = convLead.get(String(f._id));
          if (lid && (!waFirst.has(lid) || f.at < waFirst.get(lid))) waFirst.set(lid, f.at);
        }
        const gaps = [];
        let notContacted = 0;
        for (const r of rows) {
          const times = [r.firstContactedAt, waFirst.get(String(r.k))].filter(Boolean).map((d) => new Date(d).getTime());
          if (!times.length) { notContacted++; continue; }
          gaps.push(Math.max(0, Math.min(...times) - new Date(r.createdAt).getTime()));
        }
        gaps.sort((a, b) => a - b);
        speedToLead = {
          total: rows.length,
          contacted: gaps.length,
          notContacted,
          within5m: gaps.filter((g) => g <= 5 * 60000).length,
          within1h: gaps.filter((g) => g <= 3600000).length,
          medianMs: gaps.length ? gaps[Math.floor(gaps.length / 2)] : null,
        };
      }
    } catch { speedToLead = null; }

    const orgDoc = await Organization.findById(user.orgId, "monthlyClosingGoal");
    const orgGoal = orgDoc?.monthlyClosingGoal ?? 0;

    const toMap = (arr) => arr.reduce((acc, i) => { acc[i._id] = i.count; return acc; }, {});
    const sourceMap   = toMap(result.bySource);
    const allTimeStatus = toMap(result.allTimeByStatus);

    const analyticsData = {
      // All-time counts — used for the top stat cards so orgs with older leads don't see 0
      allTimeTotal:       result.allTimeTotal[0]?.count || 0,
      allTimeClosedWon:   allTimeStatus["Closed Won"]   || 0,
      allTimeNew:         allTimeStatus["New"]           || 0,

      // Period counts (date-range filtered) — kept for trend charts / source breakdown
      totalLeads:     result.totalLeads[0]?.count  || 0,
      byStatus:       toMap(result.byStatus),
      bySource:       sourceMap,
      byPriority:     toMap(result.byPriority),
      sourceHighlights: {
        facebook: sourceMap.Facebook || 0,
        google:   sourceMap.Google   || 0,
        whatsapp: sourceMap.WhatsApp || 0,
      },
      byAgent:        result.byAgent,
      recentLeads:    result.recentLeads,
      todayFollowUps: result.todayFollowUps[0]?.count || 0,
      totalFollowUps: result.totalFollowUps[0]?.count || 0,
      pipelineValue:      result.pipelineValue[0]?.total || 0,
      pipelineLeads:      result.pipelineValue[0]?.count || 0,
      thisMonthLeads:     result.thisMonthLeads[0]?.count || 0,
      lastMonthLeads:     result.lastMonthLeads[0]?.count || 0,
      thisMonthClosedWon: result.thisMonthClosedWon[0]?.count || 0,
      lastMonthClosedWon: result.lastMonthClosedWon[0]?.count || 0,
      lastMonthSamePeriodLeads:     result.lastMonthSamePeriodLeads[0]?.count || 0,
      lastMonthSamePeriodClosedWon: result.lastMonthSamePeriodClosedWon[0]?.count || 0,

      // For the selected range (see the facets above)
      periodPipelineValue: result.periodPipeline[0]?.total || 0,
      periodPipelineLeads: result.periodPipeline[0]?.count || 0,
      periodAvgResponseMs: result.periodAvgResponse[0]?.avgMs != null ? Math.max(0, result.periodAvgResponse[0].avgMs) : null,
      periodContacted:     result.periodAvgResponse[0]?.count || 0,
      previousPeriodLeads: previousFilter ? (result.previousPeriodLeads[0]?.count || 0) : null,
      dailyLeads:          result.dailyLeads || [],
      trendBucket,
      rangeStartKey: createdAtFilter?.$gte ? toIstKey(createdAtFilter.$gte) : null,
      rangeEndKey:   createdAtFilter?.$lte ? toIstKey(createdAtFilter.$lte) : null,
      conversionRate:     result.allTimeTotal[0]?.count
        ? Math.round((allTimeStatus["Closed Won"] || 0) / result.allTimeTotal[0].count * 1000) / 10
        : 0,
      todayCreated:       result.todayCreated[0]?.count || 0,
      todaySiteVisits:    result.todaySiteVisits[0]?.count || 0,
      upcomingItems:      result.upcomingItems || [],
      allTimeByStatus:    allTimeStatus,
      recentActivity:     result.recentActivity || [],
      recentDailyLeads:   result.recentDailyLeads || [],
      avgResponseMs:      result.avgFirstResponse[0]?.avgMs != null
        ? Math.max(0, result.avgFirstResponse[0].avgMs)
        : null,
      monthlyClosingGoal: orgGoal,
      periodSiteVisits:     result.periodSiteVisits[0]?.count || 0,
      periodSiteVisitsDone: result.periodSiteVisits[0]?.done || 0,
      sourcePerformance:    (result.sourcePerformance || []).map((r) => ({ source: r._id || "Unknown", leads: r.leads, contacted: r.contacted, visits: r.visits, won: r.won })),
      speedToLead,
    };

    _analyticsCache.set(cacheKey, { data: analyticsData, expiresAt: Date.now() + ANALYTICS_TTL });
    return analyticsData;
  },

  // ── Restore (undo soft delete) ────────────────────────────────────────────
  async restore(id, orgId) {
    const lead = await Lead.findOne({ _id: id, orgId });
    if (!lead) throw new AppError("Lead not found", 404);
    lead.isDeleted = false;
    lead.deletedAt = null;
    // The booking is left alone. It used to be cleared here because a lead
    // dumped via "Not Interested" would otherwise re-match the Dump filter the
    // moment it was restored -- but that also silently erased a real answer the
    // agent had recorded. Dump is deletions now, so there is nothing to undo.
    await lead.save({ validateBeforeSave: false });
    return lead;
  },

  // ── Permanent delete ──────────────────────────────────────────────────────
  async permanentDelete(id, orgId) {
    const lead = await Lead.findOneAndDelete({ _id: id, orgId });
    if (!lead) throw new AppError("Lead not found", 404);
  },

  // ── Follow-ups due: overdue + today, user-scoped ─────────────────────────
  // Used by the dashboard alert panel. Returns pipeline leads only (no project
  // leads) since those are handled separately in the Follow-ups page.
  // Agents see only their assigned/created leads; admins/managers see all org.
  async getFollowUpsDue(user) {
    // IST day, not the server's UTC one.
    const todayStart = startOfISTDay(istDateKey());
    const todayEnd   = endOfISTDay(istDateKey());

    const filter = {
      orgId:      user.orgId,
      isArchived: { $ne: true },
      isDeleted:  { $ne: true },
      status:     { $nin: ["Closed Won", "Closed Lost"] },
      followUpDate: { $ne: null, $lte: todayEnd },
    };

    if (user.role === "agent") {
      filter.assignedTo = user._id;
    }

    const leads = await Lead.find(filter)
      .sort({ followUpDate: 1 })
      .limit(25)
      .select("name phone source status followUpDate assignedToName")
      .lean();

    return leads.map((l) => ({
      _id:            l._id,
      name:           l.name,
      phone:          l.phone,
      source:         l.source,
      status:         l.status,
      followUpDate:   l.followUpDate,
      assignedToName: l.assignedToName,
      urgency:        l.followUpDate < todayStart ? "overdue" : "today",
      daysOverdue:    l.followUpDate < todayStart
        ? Math.ceil((todayStart - new Date(l.followUpDate)) / (1000 * 60 * 60 * 24))
        : 0,
    }));
  },

  // ── Automation Alerts - recent leads from all sources ────────────────────
  async getAlerts(user) {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const filter = { orgId: user.orgId, isDeleted: { $ne: true }, isArchived: { $ne: true }, createdAt: { $gte: since } };
    if (user.role === "agent") {
      filter.assignedTo = user._id;
    }
    return Lead.find(filter)
      .sort({ createdAt: -1 })
      .limit(50)
      .select("name phone source status createdAt assignedToName")
      .lean();
  },

  async transferToProject(leadId, toProjectId, user) {
    const lead = await Lead.findOne({ _id: leadId, orgId: user.orgId });
    if (!lead) throw new AppError("Lead not found", 404);
    const project = await Project.findOne({ _id: toProjectId, isArchived: { $ne: true }, orgId: user.orgId });
    if (!project) throw new AppError("Project not found", 404);
    // Everything on the lead comes across (see utils/projectLeadFromLead.js),
    // not just its contact details and remarks.
    const pl = await ProjectLead.create(projectLeadFromLead(lead, toProjectId, user, { projectName: project.name }));
    lead.isArchived = true;
    await lead.save({ validateBeforeSave: false });
    return pl;
  },

  // ── Bulk Transfer to Project ─────────────────────────────────────────────
  // Moves multiple leads into a project's lead list in one operation.
  // Preserves remarks/follow-ups/booking exactly like the single-lead
  // transfer above — only the container (Lead → ProjectLead) changes.
  async bulkTransferToProject(ids, toProjectId, user) {
    const project = await Project.findOne({ _id: toProjectId, isArchived: { $ne: true }, orgId: user.orgId });
    if (!project) throw new AppError("Project not found", 404);

    // The unified Leads list mixes plain Lead docs with ProjectLead docs
    // (already inside another project) — a bulk selection can contain both,
    // so look them up in parallel rather than assuming everything is a Lead.
    const [leadsToTransfer, projectLeadsToTransfer] = await Promise.all([
      Lead.find({ _id: { $in: ids }, orgId: user.orgId, isArchived: { $ne: true } }),
      ProjectLead.find({ _id: { $in: ids }, orgId: user.orgId }),
    ]);
    if (!leadsToTransfer.length && !projectLeadsToTransfer.length) {
      throw new AppError("No leads found to transfer", 404);
    }

    if (leadsToTransfer.length) {
      const docs = leadsToTransfer.map((lead) => projectLeadFromLead(lead, toProjectId, user, { projectName: project.name }));

      await ProjectLead.insertMany(docs);
      await Lead.updateMany(
        { _id: { $in: leadsToTransfer.map((l) => l._id) } },
        { $set: { isArchived: true } }
      );
    }

    // Already-project leads just move containers — flip `project` in place
    // so remarks/follow-ups/status/notes are untouched, same as the
    // single-lead project→project transfer in projectService.transferLead.
    if (projectLeadsToTransfer.length) {
      await ProjectLead.updateMany(
        { _id: { $in: projectLeadsToTransfer.map((l) => l._id) } },
        { $set: { project: toProjectId } }
      );
    }

    return { count: leadsToTransfer.length + projectLeadsToTransfer.length, project };
  },

  async getDump(user, { page = 1, limit = 50 } = {}) {
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const lim  = parseInt(limit);

    // A lead lands in Dump when it is soft-deleted or lost. It used to also
    // land here on booking "Not Interested", which is why an agent recording an
    // honest answer watched the lead disappear from their list.
    //
    // ProjectLead is no longer queried at all: it has no isDeleted field, so
    // with the booking rule gone there is nothing about a project lead that can
    // put it in Dump. Querying for something that cannot match would just be a
    // round trip that always returns zero.
    const leadFilter = {
      orgId: user.orgId,
      $or: [
        { isDeleted: true },
        { status: "Closed Lost" },
      ],
    };
    if (user.role === "agent") {
      leadFilter.assignedTo = user._id;
    }

    const [regularLeads, totalLeads] = await Promise.all([
      Lead.find(leadFilter)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(lim)
        .populate("assignedTo", "name email")
        .select("name phone email source status priority booking assignedToName assignedTo remark1 remark2 remark followUpDate followUp2 createdAt updatedAt isDeleted deletedAt")
        .lean(),
      Lead.countDocuments(leadFilter),
    ]);

    const combined = regularLeads.map((l) => ({ ...l, _type: "lead" }));

    const total = totalLeads;
    return {
      leads: combined,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / lim),
    };
  },
};

module.exports = leadService;
module.exports.invalidateAnalyticsCache = invalidateAnalyticsCache;
