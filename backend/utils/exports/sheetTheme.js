// GENERATED from frontend/src/utils/sheetTheme.js by backend/scripts/syncSheetTheme.js.
// Do not edit here: change the web file and run the script.
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
const SOURCE_FILL = {
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
function prettyPhone(v) {
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
// Two columns of small tables, side by side in pairs that line up, then the wide tables: team performance and the hot leads
// nobody has called. Everything is counted from the rows in this download
// only, and the server only ever gives an agent their own leads; an agent's
// file also leaves out the team sections altogether.
const FUNNEL = ["New", "Contacted", "Site Visit", "Negotiation", "Closed Won"];
const LEFT = 2, RIGHT = 7; // column B and column G; F is the gap between them
const GREY = "6B7280";

function istKey(offsetDays = 0) {
  return new Date(Date.now() + 5.5 * 3600000 + offsetDays * 86400000).toISOString().slice(0, 10);
}

function addSummary(wb, allRows, { logo, filtersText = "", forAgent = false }) {
  const ws = wb.addWorksheet("Summary", {
    properties: { tabColor: { argb: argb(BRAND) } },
    views: [{ showGridLines: false }],
    pageSetup: { orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  ws.columns = [3, 26, 10, 10, 24, 3, 26, 10, 10, 24].map((width) => ({ width }));
  const total = allRows.length;
  const now = new Date(Date.now() + 5.5 * 3600000);
  const stamp = `${now.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" })}, ${now.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "UTC" }).toUpperCase()} IST`;
  const font = (extra = {}) => ({ size: 10, color: { argb: argb(INK) }, ...extra });
  const greyFont = (extra = {}) => ({ size: 10, color: { argb: argb(GREY) }, ...extra });

  // ── Logo, what this is, which filters ──
  // The logo (mark + wordmark, public/excel-logo.png, 1116 x 220). Without it,
  // the name in the logo's colours: "Artha" orange, "Leads" black.
  ws.getRow(2).height = 40;
  if (logo) {
    const id = wb.addImage({ base64: logo, extension: "png" });
    ws.addImage(id, { tl: { col: 1, row: 1.1 }, ext: { width: 233, height: 46 }, editAs: "absolute" });
  } else {
    ws.getCell("B2").value = { richText: [
      { text: "Artha", font: { bold: true, size: 22, color: { argb: argb(BRAND) } } },
      { text: "Leads", font: { bold: true, size: 22, color: { argb: "FF111111" } } },
    ] };
  }
  ws.getCell("B3").value = `Leads report: ${total.toLocaleString("en-IN")} lead${total === 1 ? "" : "s"}${forAgent ? " assigned to you" : ""}, downloaded ${stamp}`;
  ws.getCell("B3").font = { size: 11, color: { argb: argb(GREY) } };
  ws.getCell("B4").value = { richText: [
    { text: "Filters: ", font: { bold: true, size: 10, color: { argb: argb(BRAND_DEEP) } } },
    { text: filtersText || "All leads, no filters", font: greyFont() },
  ] };

  // ── Numbers used below ──
  const today = istKey(), in7 = istKey(7);
  const isOpen = (r) => r.Status !== "Closed Won" && r.Status !== "Closed Lost";
  const contacted = (r) => (r.Status && r.Status !== "New") || !isEmpty(r.FirstContacted);
  const visited = (r) => r.VisitDone === "Yes" || ["Site Visit", "Negotiation", "Closed Won"].includes(r.Status);
  // How far along the pipeline a lead got. A lost lead counts as contacted
  // when someone did reach it.
  const stage = (r) => {
    let s = r.Status === "Closed Lost" ? 0 : Math.max(0, FUNNEL.indexOf(r.Status));
    if (contacted(r)) s = Math.max(s, 1);
    if (r.VisitDone === "Yes") s = Math.max(s, 2);
    return s;
  };
  const fuDay = (r) => String(r.FollowUpDate || "").slice(0, 10);

  // ── Four headline cards ──
  const cards = [
    ["Total leads", total, BRAND],
    ["Not contacted yet", allRows.filter((r) => !contacted(r)).length, "B91C1C"],
    ["Site visits", allRows.filter(visited).length, INK],
    ["Closed won", allRows.filter((r) => r.Status === "Closed Won").length, "15803D"],
  ];
  const edge = { style: "thin", color: { argb: argb("F5C9A6") } };
  ws.getRow(6).height = 18; ws.getRow(7).height = 32;
  cards.forEach(([name, value, colour], i) => {
    const col = [2, 4, 7, 9][i];
    ws.mergeCells(6, col, 6, col + 1); ws.mergeCells(7, col, 7, col + 1);
    const top = ws.getCell(6, col), big = ws.getCell(7, col);
    top.value = name; big.value = value;
    top.font = greyFont({ bold: true });
    big.font = { bold: true, size: 22, color: { argb: argb(colour) } };
    for (const c of [top, big]) { c.fill = solid("FFF4EB"); c.alignment = { vertical: "middle", horizontal: "left", indent: 1 }; }
    // Each card is a box: light orange edges, a thick brand line along the bottom.
    top.border = { top: edge, left: edge, right: edge };
    big.border = { left: edge, right: edge, bottom: { style: "medium", color: { argb: argb(BRAND) } } };
  });

  // ── Cell styles shared by every table ──
  const headCell = (cell, value, left) => {
    cell.value = value;
    cell.font = { bold: true, size: 11, color: { argb: "FFFFFFFF" } };
    cell.fill = solid(BRAND);
    cell.alignment = { vertical: "middle", horizontal: left ? "left" : "center", indent: left ? 1 : 0 };
    cell.border = { ...box(HEAD_RULE), bottom: { style: "medium", color: { argb: argb(BRAND_DEEP) } } };
  };
  const footCell = (cell, value) => {
    cell.value = value;
    cell.fill = solid("FFF4EB");
    cell.font = font({ bold: true });
    cell.border = { ...box(RULE), top: { style: "medium", color: { argb: argb(BRAND) } }, bottom: { style: "medium", color: { argb: argb(BRAND) } } };
  };
  const bodyCell = (cell, value, f = font()) => {
    cell.value = value;
    cell.font = f;
    cell.border = box(RULE);
    cell.alignment = { vertical: "middle", horizontal: "center" };
  };

  // A small table: name | leads | share | bar.
  // items: [{ name, n, style(cell) -> bar colour, note }]. bodyRows: pad with
  // empty lines to this many, so two tables side by side end on the same row.
  const smallTable = (c0, r0, { title, head = ["Leads", "Share"], items, of = total, foot = "Total", footN = of }, bodyRows = items.length) => {
    let r = r0;
    ws.getRow(r).height = 24;
    headCell(ws.getCell(r, c0), title, true);
    headCell(ws.getCell(r, c0 + 1), head[0]);
    headCell(ws.getCell(r, c0 + 2), head[1]);
    headCell(ws.getCell(r, c0 + 3), "");
    r++;
    const max = Math.max(1, ...items.map((x) => x.n));
    for (const it of items) {
      ws.getRow(r).height = 20;
      const lab = ws.getCell(r, c0);
      bodyCell(lab, it.name, font({ bold: true }));
      lab.alignment = { vertical: "middle", indent: 1 };
      const colour = it.style ? it.style(lab) : BRAND;
      bodyCell(ws.getCell(r, c0 + 1), it.n, font({ bold: true }));
      const pct = ws.getCell(r, c0 + 2);
      bodyCell(pct, of ? it.n / of : 0, greyFont());
      pct.numFmt = "0%";
      const bar = ws.getCell(r, c0 + 3);
      bodyCell(bar, null);
      bar.alignment = { vertical: "middle" };
      const blocks = it.n ? "█".repeat(Math.max(1, Math.round((it.n / max) * 18))) : "";
      bar.value = { richText: [
        { text: blocks || " ", font: { size: 10, color: { argb: argb(colour) } } },
        ...(it.note ? [{ text: `  ${it.note}`, font: greyFont({ size: 9 }) }] : []),
      ] };
      r++;
    }
    for (let k = items.length; k < bodyRows; k++, r++) {
      ws.getRow(r).height = 20;
      for (let c = 0; c < 4; c++) bodyCell(ws.getCell(r, c0 + c), null);
    }
    if (foot) {
      ws.getRow(r).height = 22;
      footCell(ws.getCell(r, c0), foot);
      ws.getCell(r, c0).alignment = { vertical: "middle", indent: 1 };
      footCell(ws.getCell(r, c0 + 1), footN);
      footCell(ws.getCell(r, c0 + 2), of ? footN / of : 0);
      ws.getCell(r, c0 + 2).numFmt = "0%";
      footCell(ws.getCell(r, c0 + 3), "");
      for (const c of [1, 2]) ws.getCell(r, c0 + c).alignment = { vertical: "middle", horizontal: "center" };
      r++;
    }
    return r;
  };

  const tally = (key, blank) => {
    const m = new Map();
    for (const row of allRows) {
      const v = isEmpty(row[key]) ? blank : String(row[key]);
      m.set(v, (m.get(v) || 0) + 1);
    }
    return [...m].sort((a, b) => b[1] - a[1]);
  };
  const capped = (list, limit = 12) => list.length <= limit ? list
    : [...list.slice(0, limit - 1), [`Others (${list.length - limit + 1})`, list.slice(limit - 1).reduce((s, [, n]) => s + n, 0)]];
  const pillIn = (styles) => (name) => (cell) => {
    if (styles[name]) { softPill(cell, styles[name]); cell.alignment = { vertical: "middle", indent: 1 }; cell.border = box(RULE); }
    return styles[name]?.[1] || BRAND;
  };

  // ── The small tables ──
  const sections = [];

  // Pipeline: how many leads got at least this far, and how many dropped
  // since the step before.
  const reached = FUNNEL.map((_, i) => allRows.filter((r) => stage(r) >= i).length);
  const lost = allRows.filter((r) => r.Status === "Closed Lost").length;
  sections.push({
    title: "Pipeline", head: ["Reached", "Of all"], foot: "Closed lost", footN: lost,
    items: FUNNEL.map((name, i) => ({
      name, n: reached[i], style: pillIn(STATUS_STYLE)(name),
      note: i && reached[i - 1] > reached[i] ? `${reached[i - 1] - reached[i]} dropped` : "",
    })),
  });

  sections.push({
    title: "By status", items: tally("Status", "Not set").map(([name, n]) => ({ name, n, style: pillIn(STATUS_STYLE)(name) })),
  });

  // Follow-ups on leads still open (not won or lost).
  const open = allRows.filter(isOpen);
  const fu = [
    ["Overdue", open.filter((r) => fuDay(r) && fuDay(r) < today).length, ["FEE2E2", "B91C1C"]],
    ["Due today", open.filter((r) => fuDay(r) === today).length, ["FEF3C7", "B45309"]],
    ["Next 7 days", open.filter((r) => fuDay(r) > today && fuDay(r) <= in7).length, ["DBEAFE", "1D4ED8"]],
    ["Later", open.filter((r) => fuDay(r) > in7).length, ["F3F4F6", "374151"]],
    ["No follow-up set", open.filter((r) => !fuDay(r)).length, ["F3F4F6", GREY]],
  ];
  sections.push({
    title: "Follow-ups", of: open.length, foot: "Open leads",
    items: fu.map(([name, n, st]) => ({ name, n, style: (cell) => { softPill(cell, st); cell.alignment = { vertical: "middle", indent: 1 }; cell.border = box(RULE); return st[1]; } })),
  });

  sections.push({
    title: "By source",
    items: capped(tally("Source", "Not set")).map(([name, n]) => ({ name, n, style: (cell) => {
      if (SOURCE_FILL[name] || name === "Vistrow Voice") { sourcePill(cell, name); cell.alignment = { vertical: "middle", indent: 1 }; cell.border = box(RULE); }
      return SOURCE_FILL[name] || (name === "Vistrow Voice" ? VOICE_GRADIENT[1] : SOURCE_FILL.Other);
    } })),
  });

  const projects = tally("Project", "No project");
  if (!(projects.length === 1 && projects[0][0] === "No project")) {
    sections.push({ title: "By project", items: capped(projects).map(([name, n]) => ({ name, n })) });
  }

  sections.push({
    title: "By priority", items: tally("Priority", "Not set").map(([name, n]) => ({ name, n, style: pillIn(PRIORITY_STYLE)(name) })),
  });

  // Leads per day for the last 14 days of the period, newest first, days with
  // none included so gaps show.
  const days = allRows.map((r) => String(r.CreatedAt || "").slice(0, 10)).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  if (days.length) {
    const last = new Date(`${days[days.length - 1]}T00:00:00Z`);
    const first = new Date(Math.max(new Date(`${days[0]}T00:00:00Z`), last - 13 * 86400000));
    const perDay = [];
    for (let d = new Date(last); d >= first; d = new Date(d - 86400000)) {
      const key = d.toISOString().slice(0, 10);
      perDay.push({ name: d.toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short", timeZone: "UTC" }), n: days.filter((x) => x === key).length });
    }
    const shown = perDay.reduce((s, x) => s + x.n, 0);
    sections.push({ title: "Leads per day", items: perDay, foot: `Total, ${perDay.length} day${perDay.length === 1 ? "" : "s"}`, footN: shown });
  }

  // Side by side in pairs (Pipeline | Status, Follow-ups | Source, Project |
  // Priority, ...): both tables of a pair start on the same row and are
  // padded to the same height, so headings, rows and totals line up.
  let r = 10;
  for (let k = 0; k < sections.length; k += 2) {
    const pair = sections.slice(k, k + 2);
    const rows = Math.max(...pair.map((t) => t.items.length));
    const ends = pair.map((t, n) => smallTable(n ? RIGHT : LEFT, r, t, rows));
    r = Math.max(...ends) + 2; // two empty rows before the next pair
  }

  // ── Wide tables (columns B to J; F+G and I+J are joined where needed) ──
  // spec: [[fromCol, toCol, value], ...]
  const wide = (row, spec, styler) => {
    for (const [a, b, v] of spec) {
      if (b > a) ws.mergeCells(row, a, row, b);
      // Right to left: a write to the second half of a joined cell lands on
      // the first half, so the first half (with the real value) goes last.
      for (let c = b; c >= a; c--) styler(ws.getCell(row, c), c === a ? v : undefined, c);
    }
  };
  const sectionTitle = (text, sub) => {
    ws.getCell(r, 2).value = { richText: [
      { text, font: { bold: true, size: 13, color: { argb: argb(BRAND_DEEP) } } },
      ...(sub ? [{ text: `   ${sub}`, font: greyFont() }] : []),
    ] };
    ws.getRow(r).height = 22;
    r++;
  };

  if (!forAgent) {
    // Team performance: who has how many leads and how fast they reach them.
    const people = new Map();
    for (const row of allRows) {
      const who = isEmpty(row.AssignedTo) ? "Unassigned" : String(row.AssignedTo);
      if (!people.has(who)) people.set(who, []);
      people.get(who).push(row);
    }
    const stats = (rows) => {
      const times = rows.map((x) => x.ResponseHours).filter((h) => !isEmpty(h)).map(Number);
      return {
        leads: rows.length, contacted: rows.filter(contacted).length, visits: rows.filter(visited).length,
        won: rows.filter((x) => x.Status === "Closed Won").length,
        avg: times.length ? times.reduce((s, h) => s + h, 0) / times.length : null,
        fast: times.length ? times.filter((h) => h <= 1).length / times.length : null,
      };
    };
    const list = [...people].map(([who, rows]) => [who, stats(rows)]).sort((a, b) => b[1].leads - a[1].leads).slice(0, 25);
    sectionTitle("Team performance", "average response is from lead created to first contact");
    const cols = [[2, 2, "Team member"], [3, 3, "Leads"], [4, 4, "Contacted"], [5, 5, "Site visits"], [6, 7, "Closed won"], [8, 8, "Avg response"], [9, 9, "Within 1 h"], [10, 10, "Not contacted"]];
    ws.getRow(r).height = 24;
    wide(r, cols, (cell, v, c) => headCell(cell, v === undefined ? null : v, c === 2));
    r++;
    const line = (name, s, isFoot) => {
      ws.getRow(r).height = isFoot ? 22 : 20;
      const vals = [name, s.leads, s.contacted, s.visits, s.won, s.avg, s.fast, s.leads - s.contacted];
      wide(r, cols.map(([a, b], i) => [a, b, vals[i]]), (cell, v, c) => {
        if (isFoot) footCell(cell, v === undefined ? null : v); else bodyCell(cell, v === undefined ? null : v, font({ bold: c === 2 }));
        cell.alignment = c === 2 ? { vertical: "middle", indent: 1 } : { vertical: "middle", horizontal: "center" };
        if (v === null || v === undefined) return;
        if (c === 8) { cell.numFmt = '0.0" h"'; cell.font = font({ bold: true, color: { argb: argb(v <= 1 ? "15803D" : v <= 24 ? "B45309" : "B91C1C") } }); }
        if (c === 9) cell.numFmt = "0%";
        if (c === 10 && v > 0) cell.font = font({ bold: true, color: { argb: "FFB91C1C" } });
        if (c === 6 && v > 0) cell.font = font({ bold: true, color: { argb: "FF15803D" } });
      });
      r++;
    };
    for (const [who, s] of list) line(who, s, false);
    line("Total", stats(allRows), true);
    r += 2;
  }

  // Hot and high-priority leads nobody has contacted yet: who to call first.
  const waiting = allRows.filter((x) => (x.Priority === "Hot" || x.Priority === "High") && !contacted(x))
    .sort((a, b) => (a.Priority === "Hot" ? 0 : 1) - (b.Priority === "Hot" ? 0 : 1) || (Number(b.LeadAgeDays) || 0) - (Number(a.LeadAgeDays) || 0));
  sectionTitle("Hot and high leads not contacted yet", waiting.length > 10 ? `the 10 waiting longest of ${waiting.length}` : "");
  const hcols = [[2, 2, "Name"], [3, 4, "Phone"], [5, 5, "Priority"], [6, 7, "Source"], [8, 8, "Waiting (days)"], [9, 10, forAgent ? "Project" : "Assigned to"]];
  ws.getRow(r).height = 24;
  wide(r, hcols, (cell, v, c) => headCell(cell, v === undefined ? null : v, c === 2));
  r++;
  if (!waiting.length) {
    ws.mergeCells(r, 2, r, 10);
    // Right to left, so the message in the first cell is written last (see wide()).
    for (let c = 10; c >= 2; c--) bodyCell(ws.getCell(r, c), c === 2 ? "None. Every hot and high lead has been contacted." : null, font({ bold: true, color: { argb: "FF15803D" } }));
    ws.getCell(r, 2).alignment = { vertical: "middle", indent: 1 };
    ws.getRow(r).height = 22;
    r++;
  }
  for (const x of waiting.slice(0, 10)) {
    ws.getRow(r).height = 20;
    const vals = [x.Name, prettyPhone(x.Phone), x.Priority, x.Source, isEmpty(x.LeadAgeDays) ? null : Number(x.LeadAgeDays),
      forAgent ? (x.Project || "") : (x.AssignedTo || "Unassigned")];
    wide(r, hcols.map(([a, b], i) => [a, b, vals[i]]), (cell, v, c) => {
      bodyCell(cell, v === undefined ? null : v, font({ bold: c === 2 }));
      if (c === 2 || c === 3 || c === 9) cell.alignment = { vertical: "middle", indent: 1 };
      if (v === undefined || v === null || v === "") return;
      if (c === 5 && PRIORITY_STYLE[v]) softPill(cell, PRIORITY_STYLE[v]);
      if (c === 6) sourcePill(cell, v);
      if (c === 8 && v >= 2) cell.font = font({ bold: true, color: { argb: "FFB91C1C" } });
    });
    // The joined Source cell keeps its pill colour across both halves.
    ws.getCell(r, 7).fill = ws.getCell(r, 6).fill;
    r++;
  }

  r += 1;
  ws.getCell(r, 2).value = "Made with ArthaLeads · arthaleads.com";
  ws.getCell(r, 2).font = greyFont({ size: 9, italic: true });
  return ws;
}

// sheets: { "WhatsApp": [rows], "Website": [rows] } (one sheet per entry).
// Excel sheet names are at most 31 characters and cannot contain : \ / ? * [ ].
// logo: the PNG as base64, for the top of the Summary sheet.
// filtersText: which filters the download used. forAgent: the person
// downloading is an agent (their file leaves out the team sections).
function buildThemedWorkbook(ExcelJS, sheets, { textColumns = TEXT_DEFAULT, summary = false, logo = null, filtersText = "", forAgent = false } = {}) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "ArthaLeads";
  wb.company = "ArthaLeads";
  wb.created = new Date();
  const used = new Set(summary ? ["summary"] : []);
  if (summary) addSummary(wb, Object.values(sheets).flat(), { logo, filtersText, forAgent });
  for (const [name, rows] of Object.entries(sheets)) {
    let title = String(name).replace(/[:\\/?*[\]]/g, " ").trim().slice(0, 31) || "Leads";
    for (let i = 2; used.has(title.toLowerCase()); i++) title = `${title.slice(0, 28)} ${i}`;
    used.add(title.toLowerCase());
    addSheet(wb, title, rows, textColumns, SOURCE_FILL[name] || (name === "Vistrow Voice" ? VOICE_GRADIENT[0] : BRAND));
  }
  return wb;
}

module.exports = { SOURCE_FILL, prettyPhone, buildThemedWorkbook };
