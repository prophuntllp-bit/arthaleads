// Excel files in the ArthaLeads look, made on the server for the phone app
// (21 Oct 2026). The web builds the same files in the browser
// (frontend/src/pages/Leads.jsx exportRows + utils/sheetExport.js); the look
// itself is shared: ./sheetTheme.js is generated from the web's sheetTheme.js.
// The row shape below mirrors Leads.jsx exportRows column for column, so a
// download from the phone and one from the web are the same file.
const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");
const { buildThemedWorkbook } = require("./sheetTheme");
const scorer = require("../leadScorer");

const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

let logoCache;
function logoBase64() {
  if (logoCache === undefined) {
    try { logoCache = fs.readFileSync(path.join(__dirname, "..", "..", "assets", "excel-logo.png")).toString("base64"); } catch { logoCache = null; }
  }
  return logoCache;
}

const str = (v) => (v == null || v === "" ? "" : String(v));
const IST = 5.5 * 3600000;
// Calendar day and "YYYY-MM-DD HH:mm" in IST (the sheet turns them into real dates).
const istDay = (d) => (d ? new Date(new Date(d).getTime() + IST).toISOString().slice(0, 10) : "");
const istStamp = (d) => (d ? new Date(new Date(d).getTime() + IST).toISOString().slice(0, 16).replace("T", " ") : "");
const hoursBetween = (a, b) => (a && b ? Math.max(0, Math.round(((new Date(b) - new Date(a)) / 3600000) * 10) / 10) : "");
const fmtDate = (v) => new Date(v).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
function pagePath(url) {
  if (!url) return "";
  try { return new URL(url).pathname.replace(/\/+$/, ""); } catch { return ""; }
}

// Every call on the lead: team calls ("called" activities) and Vistrow Voice
// AI calls. The newest one is "Last Call".
function callsOf(lead) {
  const team = (lead.activities || []).filter((a) => a.type === "called").map((a) => ({
    at: a.createdAt, what: { answered: "Answered", missed: "Missed", initiated: "Dialled" }[a.meta?.status] || "Called",
  }));
  const ai = (lead.voiceCalls || []).map((c) => ({ at: c.createdAt, what: `AI call${c.sentiment ? `: ${c.sentiment}` : ""}` }));
  const all = [...team, ...ai].sort((x, y) => new Date(y.at || 0) - new Date(x.at || 0));
  return { count: all.length || "", last: all[0] ? `${all[0].what}${all[0].at ? `, ${fmtDate(all[0].at)}` : ""}` : "" };
}

/** The Leads export rows, same keys and order as the web. */
function leadRows(source, now = Date.now()) {
  // Facebook / website form questions, one column each, in first-seen order.
  const formCols = [];
  for (const l of source) for (const f of l.formResponses || []) {
    const col = `Form: ${String(f.label || f.fieldKey).trim().slice(0, 60)}`;
    if (!formCols.includes(col) && formCols.length < 20) formCols.push(col);
  }
  return source.map((lead) => {
    const calls = callsOf(lead);
    const row = {
      Name:          str(lead.name),
      Phone:         str(lead.phone),
      Status:        str(lead.status),
      Priority:      str(lead.priority),
      // The Hot Today score (rules, plus the AI's read of the last 14 days).
      // Project leads are never scored.
      ...(() => {
        if (lead._type === "project") return { Score: "", AIReason: "" };
        const ai = scorer.aiSummary(lead);
        return { Score: scorer.scoreLead(lead), AIReason: ai ? `${ai.level[0].toUpperCase()}${ai.level.slice(1)}: ${ai.reason}` : "" };
      })(),
      Project:       str(lead.projectName),
      AssignedTo:    str(lead.assignedToName),
      Email:         str(lead.email),
      Source:        str(lead.source),
      LeadSource:    str(require("../siteName").originalSourceLabel(lead)), // never a placeholder like "WordPress Site 5"
      Campaign:      str(lead.campaignRef?.headline || require("../siteName").adFromPage(lead.sourcePage)),
      CreatedAt:     istStamp(lead.createdAt),
      LeadAgeDays:   lead.createdAt ? Math.floor((now - new Date(lead.createdAt)) / 86400000) : "",
      FirstContacted: istStamp(lead.firstContactedAt),
      ResponseHours: hoursBetween(lead.createdAt, lead.firstContactedAt),
      FollowUpDate:  istDay(lead.followUpDate),
      FollowUpDate2: istDay(lead.followUp2),
      FollowUpNote:  str(lead.followUpNote),
      SiteVisitDate: istStamp(lead.siteVisitDate),
      VisitDone:     lead.siteVisitDate ? (lead.siteVisitDone ? "Yes" : "No") : "",
      "Lead Outcome": str(lead.booking),
      PropertyType:  str(lead.propertyType),
      BHK:           str(lead.bhk),
      Purpose:       str(lead.purpose),
      BudgetMin:     lead.budget?.min ?? "",
      BudgetMax:     lead.budget?.max ?? "",
      City:          str(lead.city),
      PreferredLocation: str(lead.preferredLocation),
      Timeline:      str(lead.timeline),
      Calls:         calls.count,
      LastCall:      calls.last,
      Remark:        str(lead.remark),
      Remark1:       str(lead.remark1),
      Remark2:       str(lead.remark2),
      Remark3:       str(lead.remark3),
      Remark4:       str(lead.remark4),
      Tags:          (lead.tags || []).join(", "),
      Website:       str(lead.sourceDomain),
      Page:          pagePath(lead.sourcePage),
      PageURL:       lead.sourcePage ? String(lead.sourcePage).split("?")[0] : "",
    };
    for (const c of formCols) row[c] = "";
    for (const f of lead.formResponses || []) {
      const col = `Form: ${String(f.label || f.fieldKey).trim().slice(0, 60)}`;
      if (col in row) row[col] = str(f.value);
    }
    return row;
  });
}

// ── Dump Leads (frontend/src/pages/DumpLeads.jsx exportRows) ───────────────
function dumpRows(leads) {
  return leads.map((lead) => ({
    Name: lead.name,
    Phone: lead.phone,
    Email: lead.email || "",
    Source: lead.source || "",
    Project: lead.projectName || "",
    PipelineStatus: lead.status || "",
    BookingStatus: lead.booking || "",
    Reason: lead.isDeleted ? "Deleted" : "Closed Lost",
    AssignedTo: lead.assignedToName || "",
    Remark: lead.remark || "",
    Remark1: lead.remark1 || "",
    Remark2: lead.remark2 || "",
    AddedOn: istDay(lead.createdAt),
  }));
}

// ── A project's leads (frontend/src/pages/ProjectDetail.jsx exportLeads /
// exportProspective with buildExportRows): the CRM's own columns, then one
// column per field captured at import ("key: value · key: value" in
// remarkNote), then columns nobody filled are dropped. Copied as is.
const enIN = (v) => new Date(v).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" });
function excelSerialToDate(key, value) {
  if (!/date/i.test(key)) return value;
  if (!/^\d{5}$/.test(value)) return value;
  const serial = Number(value);
  if (serial < 20000 || serial > 60000) return value;
  const d = new Date((serial - 25569) * 86400000);
  return isNaN(d) ? value : d.toLocaleDateString("en-IN");
}
function parseRemarkNote(note) {
  const out = {};
  if (!note || typeof note !== "string") return out;
  for (const part of note.split(" · ")) {
    const idx = part.indexOf(": ");
    if (idx <= 0) continue;
    const key = part.slice(0, idx).replace(/\s+/g, " ").trim();
    const value = part.slice(idx + 2).trim();
    if (key) out[key] = excelSerialToDate(key, value);
  }
  return out;
}
function collectExtraColumns(leads) {
  const keys = [];
  const seen = new Set();
  for (const lead of leads) {
    for (const key of Object.keys(parseRemarkNote(lead.remarkNote))) {
      if (!seen.has(key)) { seen.add(key); keys.push(key); }
    }
  }
  return keys;
}
const extraColumnLabel = (key) => key.replace(/\b[a-z]/g, (c) => c.toUpperCase());
function buildExportRows(leads, baseRowFn) {
  const extraCols = collectExtraColumns(leads);
  const rows = leads.map((lead, i) => {
    const base = baseRowFn(lead, i);
    const extras = parseRemarkNote(lead.remarkNote);
    const reserved = new Set(Object.keys(base));
    const out = { ...base };
    for (const key of extraCols) {
      let label = extraColumnLabel(key);
      if (reserved.has(label)) label = `${label} (imported)`;
      out[label] = extras[key] ?? "";
    }
    out.Note = Object.keys(extras).length ? "" : (lead.remarkNote || "");
    return out;
  });
  const ALWAYS_KEEP = new Set(["#", "Name", "Phone"]);
  const allKeys = rows.length ? Object.keys(rows[0]) : [];
  const keep = allKeys.filter((k) => ALWAYS_KEEP.has(k) || rows.some((r) => String(r[k] ?? "").trim() !== ""));
  return rows.map((r) => Object.fromEntries(keep.map((k) => [k, r[k]])));
}
function projectRows(leads, { prospective = false } = {}) {
  return buildExportRows(leads, (lead, i) => ({
    "#": i + 1,
    Name: lead.name || "",
    Phone: lead.phone || "",
    WhatsApp: lead.whatsapp || "",
    Email: lead.email || "",
    Source: lead.source || "",
    "Contact Status": lead.status || "",
    "Lead Outcome": lead.booking || "",
    "Follow Up": lead.followUp ? enIN(lead.followUp) : "",
    "Follow Up 2": lead.followUp2 ? enIN(lead.followUp2) : "",
    "Remark 1": lead.remark1 || "",
    "Remark 2": lead.remark2 || "",
    ...(prospective ? {
      "Remark 3": lead.remark3 || "",
      "Remark 4": lead.remark4 || "",
      "Updated By": lead.remarkUpdatedBy?.name || "",
      "Updated At": lead.remarkUpdatedAt ? enIN(lead.remarkUpdatedAt) : "",
    } : {}),
  }));
}

/**
 * The Leads workbook: one sheet per source when there is more than one
 * (largest first), else one "Leads" sheet, with the Summary sheet first.
 */
function leadsWorkbook(leads, { filtersText = "", forAgent = false } = {}) {
  const rows = leadRows(leads);
  const bySource = rows.reduce((acc, r) => { (acc[r.Source || "Other"] ||= []).push(r); return acc; }, {});
  const names = Object.keys(bySource).sort((a, b) => bySource[b].length - bySource[a].length);
  const sheets = names.length > 1 ? Object.fromEntries(names.map((n) => [n, bySource[n]])) : { Leads: rows };
  return buildThemedWorkbook(ExcelJS, sheets, { summary: true, filtersText, forAgent, logo: logoBase64() });
}

/** Any rows in the look (Dump, project lists): { sheetName: rows[] }. */
function themedWorkbook(sheets, { textColumns, summary = false, filtersText = "", forAgent = false } = {}) {
  return buildThemedWorkbook(ExcelJS, sheets, {
    ...(textColumns ? { textColumns } : {}),
    summary,
    filtersText,
    forAgent,
    logo: summary ? logoBase64() : null,
  });
}

/** Sends a workbook as a download. */
async function sendWorkbook(res, wb, filename) {
  const buf = await wb.xlsx.writeBuffer();
  res.setHeader("Content-Type", XLSX_TYPE);
  res.setHeader("Content-Disposition", `attachment; filename="${String(filename).replace(/[^\w.\- ]/g, "_")}"`);
  res.setHeader("Content-Length", buf.length);
  return res.end(Buffer.from(buf));
}

module.exports = { leadRows, dumpRows, projectRows, leadsWorkbook, themedWorkbook, sendWorkbook, XLSX_TYPE };
