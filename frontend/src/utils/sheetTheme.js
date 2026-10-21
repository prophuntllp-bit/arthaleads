// The look of every Excel download (21 Oct 2026): ArthaLeads orange header,
// filter buttons on every column, the header and Name column frozen, and the
// Source / Status / Priority cells coloured exactly like their pills in the
// Leads table, so a sheet reads like the app.
//
// Takes the ExcelJS module as an argument so the browser can load it only when
// someone downloads, and a script can build the same file outside the browser.

const BRAND = "FF6B00";      // --app-primary
const BRAND_DEEP = "A04100"; // --app-primary-deep
const INK = "1F2937";
const ZEBRA = "FFF7F0";      // a whisper of the brand orange on every other row
const RULE = "F3E3D6";

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
};
const WIDTHS = {
  "#": 6, Name: 24, Phone: 16, WhatsApp: 16, Email: 28, Source: 15, LeadSource: 30, Website: 24, Page: 22,
  PageURL: 36, Status: 14, "Contact Status": 15, PipelineStatus: 15, Priority: 11, PropertyType: 14, BHK: 9,
  Purpose: 10, BudgetMin: 14, BudgetMax: 14, FollowUpNote: 36, Remark: 36, Remark1: 36, Remark2: 36,
  "Remark 1": 36, "Remark 2": 36, "Lead Outcome": 16, BookingStatus: 16, AssignedTo: 18, Project: 26,
  Reason: 13,
};
const DATE_COLUMNS = new Set(["FollowUpDate", "FollowUpDate2", "CreatedAt", "AddedOn"]);
const MONEY_COLUMNS = new Set(["BudgetMin", "BudgetMax"]);
const TEXT_DEFAULT = ["Phone", "WhatsApp"];

// Rupees with Indian grouping: ₹45,00,000 and ₹1,20,00,000.
const RUPEES = '[>=10000000]"₹"##\\,##\\,##\\,##0;[>=100000]"₹"##\\,##\\,##0;"₹"#,##0';

const argb = (hex) => `FF${hex}`;
const solid = (hex) => ({ type: "pattern", pattern: "solid", fgColor: { argb: argb(hex) } });

// "2026-10-21" (an IST calendar day) to a date Excel shows as that same day,
// so the filter groups by year and month and the column sorts properly.
function asDate(v) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v || ""));
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null;
}

function addSheet(wb, title, rows, textColumns, tab) {
  const keys = Object.keys(rows[0] || {});
  const ws = wb.addWorksheet(title, {
    properties: { tabColor: { argb: argb(tab) }, defaultRowHeight: 20 },
    views: [{ state: "frozen", xSplit: keys.includes("Name") ? keys.indexOf("Name") + 1 : 0, ySplit: 1, showGridLines: false }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: "1:1" },
  });
  const text = new Set(textColumns);

  ws.columns = keys.map((k) => ({
    key: k,
    header: LABELS[k] || k,
    width: WIDTHS[k] || (DATE_COLUMNS.has(k) ? 15 : Math.min(40, Math.max(12, String(LABELS[k] || k).length + 4,
      ...rows.slice(0, 300).map((r) => String(r[k] ?? "").length + 2)))),
  }));

  for (const r of rows) {
    const out = {};
    for (const k of keys) {
      let v = r[k];
      if (v === "" || v == null) v = null;
      else if (DATE_COLUMNS.has(k)) v = asDate(v) || v;
      else if (MONEY_COLUMNS.has(k)) v = Number(v) || null; // 0 means "not given"
      else if (text.has(k)) v = String(v);
      out[k] = v;
    }
    ws.addRow(out);
  }

  // Header: brand orange, white bold text, a darker line underneath.
  const head = ws.getRow(1);
  head.height = 26;
  head.eachCell((c) => {
    c.fill = solid(BRAND);
    c.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    c.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    c.border = { bottom: { style: "medium", color: { argb: argb(BRAND_DEEP) } } };
  });

  const colOf = (k) => keys.indexOf(k) + 1;
  for (let i = 2; i <= rows.length + 1; i++) {
    const row = ws.getRow(i);
    row.height = 20;
    const zebra = i % 2 === 1;
    for (let c = 1; c <= keys.length; c++) {
      const cell = row.getCell(c);
      const k = keys[c - 1];
      cell.font = { color: { argb: argb(INK) }, size: 10 };
      cell.alignment = { vertical: "middle", indent: 1 };
      cell.border = { bottom: { style: "thin", color: { argb: argb(RULE) } } };
      if (zebra) cell.fill = solid(ZEBRA);
      if (text.has(k)) cell.numFmt = "@";
      if (DATE_COLUMNS.has(k)) { cell.numFmt = "dd mmm yyyy"; cell.alignment = { vertical: "middle", horizontal: "center" }; }
      if (MONEY_COLUMNS.has(k)) { cell.numFmt = RUPEES; cell.alignment = { vertical: "middle", horizontal: "right", indent: 1 }; }
    }
    const name = keys.includes("Name") && row.getCell(colOf("Name"));
    if (name) name.font = { bold: true, color: { argb: argb(INK) }, size: 10 };

    const pill = (cell, bg, fg, bold = true) => {
      if (cell.value == null) return;
      cell.fill = solid(bg);
      cell.font = { bold, color: { argb: argb(fg) }, size: 10 };
      cell.alignment = { vertical: "middle", horizontal: "center" };
    };
    if (keys.includes("Source")) {
      const cell = row.getCell(colOf("Source"));
      if (cell.value === "Vistrow Voice") {
        pill(cell, VOICE_GRADIENT[1], "FFFFFF");
        cell.fill = { type: "gradient", gradient: "angle", degree: 0,
          stops: VOICE_GRADIENT.map((hex, n) => ({ position: n / (VOICE_GRADIENT.length - 1), color: { argb: argb(hex) } })) };
      } else pill(cell, SOURCE_FILL[cell.value] || SOURCE_FILL.Other, "FFFFFF");
    }
    for (const k of keys) {
      if (STATUS_COLUMNS.has(k)) { const s = STATUS_STYLE[row.getCell(colOf(k)).value]; if (s) pill(row.getCell(colOf(k)), ...s); }
      if (k === "Priority") { const s = PRIORITY_STYLE[row.getCell(colOf(k)).value]; if (s) pill(row.getCell(colOf(k)), ...s); }
    }
    if (keys.includes("PageURL")) {
      const cell = row.getCell(colOf("PageURL"));
      if (/^https?:\/\//.test(String(cell.value || ""))) {
        cell.value = { text: cell.value, hyperlink: cell.value };
        cell.font = { color: { argb: "FF2563EB" }, underline: true, size: 10 };
      }
    }
  }

  // Filter buttons on every heading, ready to use.
  if (keys.length) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: keys.length } };
  return ws;
}

// sheets: { "WhatsApp": [rows], "Website": [rows] } (one sheet per entry).
// Excel sheet names are at most 31 characters and cannot contain : \ / ? * [ ].
export function buildThemedWorkbook(ExcelJS, sheets, { textColumns = TEXT_DEFAULT } = {}) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "ArthaLeads";
  wb.company = "ArthaLeads";
  wb.created = new Date();
  const used = new Set();
  for (const [name, rows] of Object.entries(sheets)) {
    let title = String(name).replace(/[:\\/?*[\]]/g, " ").trim().slice(0, 31) || "Leads";
    for (let i = 2; used.has(title.toLowerCase()); i++) title = `${title.slice(0, 28)} ${i}`;
    used.add(title.toLowerCase());
    addSheet(wb, title, rows, textColumns, SOURCE_FILL[name] || (name === "Vistrow Voice" ? VOICE_GRADIENT[0] : BRAND));
  }
  return wb;
}
