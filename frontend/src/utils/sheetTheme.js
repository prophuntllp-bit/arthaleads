// The look of every Excel download (21 Oct 2026): ArthaLeads orange header,
// filter buttons on every column, the header and Name column frozen, and the
// Source / Status / Priority cells coloured exactly like their pills in the
// Leads table, so a sheet reads like the app. Optionally a "Summary" sheet in
// front with counts by source, status, priority, project and team member.
//
// Takes the ExcelJS module as an argument so the browser can load it only when
// someone downloads, and a script can build the same file outside the browser.

const BRAND = "FF6B00";      // --app-primary
const BRAND_DEEP = "A04100"; // --app-primary-deep
const INK = "1F2937";
const MUTED = "9CA3AF";
const ZEBRA = "FFF7F0";      // a whisper of the brand orange on every other row
const RULE = "E2CDB9";      // cell borders: a warm grey-brown that reads on white and on the orange tint
const HEAD_RULE = "D45A00";  // lines between the orange header cells

// Same colours as SOURCE_COLORS in constants.js (solid pill, white text).
export const SOURCE_FILL = {
  Facebook: "1877F2", Google: "4285F4", WhatsApp: "2AB540", Manual: "64748B",
  Website: "F88025", Custom: "14B8A6", Referral: "9333EA", "Walk-in": "D97706",
  PropTiger: "DC2626", "99acres": "65A30D", MagicBricks: "4F46E5", "QR Code": "1F2937",
  Other: "6B7280",
};
// The Vistrow Voice pill is a purple to pink gradient.
const VOICE_GRADIENT = ["9333EA", "D946EF", "EC4899"];

// STATUS_COLORS / PRIORITY_COLORS from constants.js, one shade stronger for the
// fill: the app's 50 shades are almost white on a printed or projected sheet.
const STATUS_STYLE = {
  New: ["DBEAFE", "1D4ED8"], Contacted: ["FEF3C7", "B45309"], "Site Visit": ["EDE9FE", "6D28D9"],
  Negotiation: ["FFEDD5", "C2410C"], "Closed Won": ["DCFCE7", "15803D"], "Closed Lost": ["FEE2E2", "B91C1C"],
};
const PRIORITY_STYLE = {
  Low: ["F3F4F6", "374151"], Medium: ["E0F2FE", "0369A1"], High: ["FFEDD5", "C2410C"], Hot: ["FEE2E2", "B91C1C"],
};
const STATUS_COLUMNS = new Set(["Status", "Contact Status", "PipelineStatus"]);

// Readable headings. The importer ignores spaces and dashes in headings, so a
// downloaded sheet still imports back exactly as before.
const LABELS = {
  LeadSource: "Lead Source", PageURL: "Page URL", PropertyType: "Property Type",
  BudgetMin: "Budget Min", BudgetMax: "Budget Max", FollowUpDate: "Follow-up Date",
  FollowUpDate2: "Follow-up Date 2", FollowUpNote: "Follow-up Note", AssignedTo: "Assigned To",
  CreatedAt: "Created On", AddedOn: "Added On", PipelineStatus: "Pipeline Status", BookingStatus: "Booking Status",
  Campaign: "Campaign / Ad", LeadAgeDays: "Lead Age (days)", FirstContacted: "First Contacted",
  ResponseHours: "Response Time", SiteVisitDate: "Site Visit", VisitDone: "Visit Done",
  PreferredLocation: "Preferred Location", LastCall: "Last Call",
};
const WIDTHS = {
  "#": 6, Name: 24, Phone: 18, WhatsApp: 18, Email: 28, Source: 15, LeadSource: 32, Campaign: 28, Website: 24,
  Page: 22, PageURL: 36, Status: 14, "Contact Status": 16, PipelineStatus: 16, Priority: 12, PropertyType: 16,
  BHK: 9, Purpose: 12, BudgetMin: 15, BudgetMax: 15, FollowUpNote: 36, Remark: 36, Remark1: 36, Remark2: 36,
  Remark3: 36, Remark4: 36, "Remark 1": 36, "Remark 2": 36, "Lead Outcome": 16, BookingStatus: 16,
  AssignedTo: 18, Project: 26, Reason: 13, CreatedAt: 21, FirstContacted: 21, SiteVisitDate: 21,
  LeadAgeDays: 17, ResponseHours: 17, VisitDone: 13, City: 16, PreferredLocation: 22, Timeline: 16,
  Calls: 9, LastCall: 24, Tags: 22,
};
const DATE_COLUMNS = new Set(["FollowUpDate", "FollowUpDate2", "CreatedAt", "AddedOn", "FirstContacted", "SiteVisitDate"]);
const MONEY_COLUMNS = new Set(["BudgetMin", "BudgetMax"]);
const CENTER_COLUMNS = new Set(["BHK", "Calls", "LeadAgeDays", "ResponseHours", "VisitDone", "#"]);
const ALWAYS_SHOWN = new Set(["Name", "Phone", "Status", "Priority", "Project", "AssignedTo", "Source"]);
const TEXT_DEFAULT = ["Phone", "WhatsApp"];
const ODD_BUDGET = 100000; // under ₹1 lakh is almost always a typing slip

// Rupees with Indian grouping: ₹45,00,000 and ₹1,20,00,000.
const RUPEES = '[>=10000000]"₹"##\\,##\\,##\\,##0;[>=100000]"₹"##\\,##\\,##0;"₹"#,##0';
const DAY_FMT = "dd mmm yyyy";
const STAMP_FMT = "dd mmm yyyy, h:mm AM/PM";

const argb = (hex) => `FF${hex}`;
const solid = (hex) => ({ type: "pattern", pattern: "solid", fgColor: { argb: argb(hex) } });
const voiceFill = () => ({ type: "gradient", gradient: "angle", degree: 0,
  stops: VOICE_GRADIENT.map((hex, n) => ({ position: n / (VOICE_GRADIENT.length - 1), color: { argb: argb(hex) } })) });
const isEmpty = (v) => v === "" || v == null;
// A full box around a cell, every side the same.
const box = (hex, style = "thin") => {
  const side = { style, color: { argb: argb(hex) } };
  return { top: side, left: side, bottom: side, right: side };
};

// "2026-10-21" or "2026-10-21 14:30" (IST wall-clock) to a date Excel shows as
// exactly that, so filters group by year and month and the column sorts.
function asDate(v) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?$/.exec(String(v || ""));
  if (!m) return null;
  return { date: new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0))), timed: !!m[4] };
}

// 919958545000 -> "+91 99585 45000", 9958545000 -> "99585 45000". The space
// also stops Excel flagging every phone as "number stored as text".
export function prettyPhone(v) {
  const s = String(v ?? "").trim();
  const d = s.replace(/\D/g, "");
  if (!/^\+?[\d\s\-()]+$/.test(s) || d.length < 10) return s;
  if (d.length === 10) return `${d.slice(0, 5)} ${d.slice(5)}`;
  if (d.length === 12 && d.startsWith("91")) return `+91 ${d.slice(2, 7)} ${d.slice(7)}`;
  if (d.startsWith("0")) return `${d.slice(0, d.length - 10)} ${d.slice(-10, -5)} ${d.slice(-5)}`;
  return `+${d.slice(0, d.length - 10)} ${d.slice(-10, -5)} ${d.slice(-5)}`;
}

function sourcePill(cell, source) {
  cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
  cell.alignment = { vertical: "middle", horizontal: "center" };
  cell.fill = source === "Vistrow Voice" ? voiceFill() : solid(SOURCE_FILL[source] || SOURCE_FILL.Other);
}
function softPill(cell, [bg, fg]) {
  cell.fill = solid(bg);
  cell.font = { bold: true, color: { argb: argb(fg) }, size: 10 };
  cell.alignment = { vertical: "middle", horizontal: "center" };
}

function addSheet(wb, title, rows, textColumns, tab) {
  const keys = Object.keys(rows[0] || {});
  const ws = wb.addWorksheet(title, {
    properties: { tabColor: { argb: argb(tab) }, defaultRowHeight: 20 },
    views: [{ state: "frozen", xSplit: keys.includes("Name") ? keys.indexOf("Name") + 1 : 0, ySplit: 1, showGridLines: false }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: "1:1" },
  });
  const text = new Set(textColumns);
  const label = (k) => LABELS[k] || k;
  const isForm = (k) => k.startsWith("Form: ");

  // Wide enough that the filter button never covers the heading.
  ws.columns = keys.map((k) => ({
    key: k,
    header: label(k),
    width: Math.max(label(k).length + 6, WIDTHS[k] || Math.min(40, Math.max(12,
      ...rows.slice(0, 300).map((r) => String(r[k] ?? "").length + 2)))),
  }));

  for (const r of rows) {
    const out = {};
    for (const k of keys) {
      let v = r[k];
      if (isEmpty(v)) v = null;
      else if (DATE_COLUMNS.has(k)) v = asDate(v)?.date || v;
      else if (MONEY_COLUMNS.has(k)) v = Number(v) || null; // 0 means "not given"
      else if (text.has(k)) v = prettyPhone(v);
      out[k] = v;
    }
    ws.addRow(out);
  }

  // Header: brand orange (form answers in the deeper orange, as one group),
  // white bold text, a darker line underneath.
  const head = ws.getRow(1);
  head.height = 28;
  head.eachCell((c, n) => {
    c.fill = solid(isForm(keys[n - 1]) ? BRAND_DEEP : BRAND);
    c.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    c.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    c.border = { ...box(HEAD_RULE), bottom: { style: "medium", color: { argb: argb(BRAND_DEEP) } } };
  });

  for (let i = 2; i <= rows.length + 1; i++) {
    const row = ws.getRow(i);
    row.height = 20;
    const zebra = i % 2 === 1;
    const src = rows[i - 2];
    for (let c = 1; c <= keys.length; c++) {
      const cell = row.getCell(c);
      const k = keys[c - 1];
      cell.font = { color: { argb: argb(INK) }, size: 10, ...(k === "Name" ? { bold: true } : {}) };
      cell.alignment = { vertical: "middle", indent: 1, ...(CENTER_COLUMNS.has(k) ? { horizontal: "center", indent: 0 } : {}) };
      cell.border = box(RULE);
      if (zebra) cell.fill = solid(ZEBRA);
      if (cell.value == null) continue;

      if (cell.value === "N/A") cell.font = { color: { argb: argb(MUTED) }, size: 10 };
      if (text.has(k)) cell.numFmt = "@";
      if (DATE_COLUMNS.has(k) && cell.value instanceof Date) {
        cell.numFmt = asDate(src[k])?.timed ? STAMP_FMT : DAY_FMT;
        cell.alignment = { vertical: "middle", horizontal: "center" };
      }
      if (MONEY_COLUMNS.has(k)) {
        cell.numFmt = RUPEES;
        cell.alignment = { vertical: "middle", horizontal: "right", indent: 1 };
        if (cell.value < ODD_BUDGET) {
          cell.fill = solid("FEF9C3");
          cell.font = { bold: true, color: { argb: "FFA16207" }, size: 10 };
          cell.note = "This budget looks too low. Please check it.";
        }
      }
      if (k === "Source") sourcePill(cell, cell.value);
      if (STATUS_COLUMNS.has(k) && STATUS_STYLE[cell.value]) softPill(cell, STATUS_STYLE[cell.value]);
      if (k === "Priority" && PRIORITY_STYLE[cell.value]) softPill(cell, PRIORITY_STYLE[cell.value]);
      if (k === "VisitDone") softPill(cell, cell.value === "Yes" ? ["DCFCE7", "15803D"] : ["F3F4F6", "6B7280"]);
      if (k === "ResponseHours") {
        // Green within the hour, amber within the day, red after that.
        cell.numFmt = '0.0" h"';
        const fg = cell.value <= 1 ? "15803D" : cell.value <= 24 ? "B45309" : "B91C1C";
        cell.font = { bold: true, color: { argb: argb(fg) }, size: 10 };
      }
      if (k === "PageURL" && /^https?:\/\//.test(String(cell.value))) {
        cell.value = { text: cell.value, hyperlink: cell.value };
        cell.font = { color: { argb: "FF2563EB" }, underline: true, size: 10 };
      }
    }
  }

  // A column with nothing in it on this sheet (Website on the WhatsApp sheet)
  // is hidden, not removed: one click on Unhide brings it back.
  keys.forEach((k, n) => {
    if (!ALWAYS_SHOWN.has(k) && rows.every((r) => isEmpty(r[k]))) ws.getColumn(n + 1).hidden = true;
  });

  // Filter buttons on every heading, ready to use.
  if (keys.length) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: keys.length } };
  return ws;
}

// ── Summary sheet ────────────────────────────────────────────────────────────
function addSummary(wb, allRows) {
  const ws = wb.addWorksheet("Summary", {
    properties: { tabColor: { argb: argb(BRAND) } },
    views: [{ showGridLines: false }],
    pageSetup: { orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  ws.columns = [{ width: 3 }, { width: 30 }, { width: 11 }, { width: 10 }, { width: 44 }];
  const total = allRows.length;
  const now = new Date(Date.now() + 5.5 * 3600000);
  const stamp = `${now.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" })}, ${now.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "UTC" }).toUpperCase()} IST`;

  ws.getCell("B2").value = "ArthaLeads";
  ws.getCell("B2").font = { bold: true, size: 22, color: { argb: argb(BRAND) } };
  ws.getRow(2).height = 34;
  ws.getCell("B3").value = `Leads report: ${total.toLocaleString("en-IN")} lead${total === 1 ? "" : "s"}, downloaded ${stamp}`;
  ws.getCell("B3").font = { size: 11, color: { argb: "FF6B7280" } };

  // Four headline numbers.
  const count = (pred) => allRows.filter(pred).length;
  const kpis = [
    ["Total leads", total],
    ["Not contacted yet", count((r) => r.Status === "New")],
    ["Site visits done", count((r) => r.VisitDone === "Yes" || r.Status === "Site Visit")],
    ["Closed won", count((r) => r.Status === "Closed Won")],
  ];
  let r = 5;
  ws.getRow(r).height = 18; ws.getRow(r + 1).height = 30;
  kpis.forEach(([name, value], i) => {
    // Two per line: B/C and D/E.
    const col = i % 2 === 0 ? 2 : 4;
    const row = r + Math.floor(i / 2) * 3;
    ws.getRow(row).height = 18; ws.getRow(row + 1).height = 30;
    ws.mergeCells(row, col, row, col + 1); ws.mergeCells(row + 1, col, row + 1, col + 1);
    const top = ws.getCell(row, col), big = ws.getCell(row + 1, col);
    top.value = name; big.value = value;
    top.font = { bold: true, size: 10, color: { argb: "FF6B7280" } };
    big.font = { bold: true, size: 20, color: { argb: argb(i === 0 ? BRAND : INK) } };
    // Each card is a box: light orange edges, a thick brand line along the bottom.
    const edge = { style: "thin", color: { argb: argb("F5C9A6") } };
    for (const c of [top, big]) { c.fill = solid("FFF4EB"); c.alignment = { vertical: "middle", horizontal: "left", indent: 1 }; }
    top.border = { top: edge, left: edge, right: edge };
    big.border = { left: edge, right: edge, bottom: { style: "medium", color: { argb: argb(BRAND) } } };
  });
  r += 7;

  const section = (title, key, styleOf, { limit = 12, blank = "Not set" } = {}) => {
    const tally = new Map();
    for (const row of allRows) {
      const v = isEmpty(row[key]) ? blank : String(row[key]);
      tally.set(v, (tally.get(v) || 0) + 1);
    }
    if (!tally.size || (tally.size === 1 && tally.has(blank) && key !== "AssignedTo")) return;
    let list = [...tally].sort((a, b) => b[1] - a[1]);
    if (list.length > limit) {
      const rest = list.slice(limit - 1).reduce((s, [, n]) => s + n, 0);
      list = [...list.slice(0, limit - 1), [`Others (${list.length - limit + 1})`, rest]];
    }
    const max = Math.max(...list.map(([, n]) => n));

    const h = ws.getRow(r);
    h.height = 24;
    [[2, title], [3, "Leads"], [4, "Share"], [5, ""]].forEach(([c, v]) => {
      const cell = h.getCell(c);
      cell.value = v;
      cell.font = { bold: true, size: 11, color: { argb: "FFFFFFFF" } };
      cell.fill = solid(BRAND);
      cell.alignment = { vertical: "middle", horizontal: c === 2 ? "left" : "center", indent: c === 2 ? 1 : 0 };
      cell.border = { ...box(HEAD_RULE), bottom: { style: "medium", color: { argb: argb(BRAND_DEEP) } } };
    });
    r++;
    for (const [name, n] of list) {
      const row = ws.getRow(r);
      row.height = 20;
      const [lab, num, pct, bar] = [2, 3, 4, 5].map((c) => row.getCell(c));
      lab.value = name; num.value = n; pct.value = total ? n / total : 0;
      for (const c of [lab, num, pct, bar]) c.border = box(RULE);
      lab.font = { bold: true, size: 10, color: { argb: argb(INK) } };
      lab.alignment = { vertical: "middle", indent: 1 };
      num.alignment = pct.alignment = { vertical: "middle", horizontal: "center" };
      num.font = { bold: true, size: 10, color: { argb: argb(INK) } };
      pct.numFmt = "0%"; pct.font = { size: 10, color: { argb: "FF6B7280" } };
      const colour = styleOf(name, lab);
      bar.value = "█".repeat(Math.max(1, Math.round((n / max) * 30)));
      bar.font = { size: 10, color: { argb: argb(colour) } };
      bar.alignment = { vertical: "middle" };
      r++;
    }
    // A total line closes each table.
    const foot = ws.getRow(r);
    foot.height = 22;
    [[2, "Total"], [3, total], [4, 1], [5, ""]].forEach(([c, v]) => {
      const cell = foot.getCell(c);
      cell.value = v;
      cell.fill = solid("FFF4EB");
      cell.font = { bold: true, size: 10, color: { argb: argb(INK) } };
      cell.alignment = { vertical: "middle", horizontal: c === 2 ? "left" : "center", indent: c === 2 ? 1 : 0 };
      cell.border = { ...box(RULE), top: { style: "medium", color: { argb: argb(BRAND) } }, bottom: { style: "medium", color: { argb: argb(BRAND) } } };
      if (c === 4) cell.numFmt = "0%";
    });
    r += 3;
  };

  section("By source", "Source", (name, cell) => {
    if (SOURCE_FILL[name] || name === "Vistrow Voice") { sourcePill(cell, name); cell.alignment = { vertical: "middle", indent: 1 }; }
    return SOURCE_FILL[name] || (name === "Vistrow Voice" ? VOICE_GRADIENT[1] : SOURCE_FILL.Other);
  });
  section("By status", "Status", (name, cell) => {
    if (STATUS_STYLE[name]) { softPill(cell, STATUS_STYLE[name]); cell.alignment = { vertical: "middle", indent: 1 }; }
    return STATUS_STYLE[name]?.[1] || BRAND;
  });
  section("By priority", "Priority", (name, cell) => {
    if (PRIORITY_STYLE[name]) { softPill(cell, PRIORITY_STYLE[name]); cell.alignment = { vertical: "middle", indent: 1 }; }
    return PRIORITY_STYLE[name]?.[1] || BRAND;
  });
  section("By project", "Project", () => BRAND, { blank: "No project" });
  section("By team member", "AssignedTo", () => BRAND, { blank: "Unassigned" });
  return ws;
}

// sheets: { "WhatsApp": [rows], "Website": [rows] } (one sheet per entry).
// Excel sheet names are at most 31 characters and cannot contain : \ / ? * [ ].
export function buildThemedWorkbook(ExcelJS, sheets, { textColumns = TEXT_DEFAULT, summary = false } = {}) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "ArthaLeads";
  wb.company = "ArthaLeads";
  wb.created = new Date();
  const used = new Set(summary ? ["summary"] : []);
  if (summary) addSummary(wb, Object.values(sheets).flat());
  for (const [name, rows] of Object.entries(sheets)) {
    let title = String(name).replace(/[:\\/?*[\]]/g, " ").trim().slice(0, 31) || "Leads";
    for (let i = 2; used.has(title.toLowerCase()); i++) title = `${title.slice(0, 28)} ${i}`;
    used.add(title.toLowerCase());
    addSheet(wb, title, rows, textColumns, SOURCE_FILL[name] || (name === "Vistrow Voice" ? VOICE_GRADIENT[0] : BRAND));
  }
  return wb;
}
