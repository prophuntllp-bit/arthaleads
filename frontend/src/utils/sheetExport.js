// Spreadsheet export/import shared by the Leads and Dump Leads pages.
//
// Phone numbers are the hard part. Excel reads any all-digit value in a CSV as
// a number, so 919689419804 shows as 9.19689E+11 and 07066880808 loses its
// leading zero, and saving the file again makes the damage permanent. In CSV
// those columns are written as ="07066880808", which Excel shows as the plain
// text 07066880808; parseCsv below unwraps it again on import.

const BOM = "﻿"; // tells Excel the file is UTF-8 (names in Hindi, emoji)

function csvCell(value, asText) {
  const s = value == null ? "" : String(value);
  if (asText && s !== "") return `="${s.replace(/"/g, '""')}"`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function toCsv(rows, { textColumns = ["Phone"] } = {}) {
  const cols = Object.keys(rows[0] || {});
  const text = new Set(textColumns);
  const lines = [cols.map((c) => csvCell(c, false)).join(",")];
  for (const r of rows) lines.push(cols.map((c) => csvCell(r[c], text.has(c))).join(","));
  return BOM + lines.join("\r\n");
}

export function downloadCsv(rows, filename, opts) {
  download(new Blob([toCsv(rows, opts)], { type: "text/csv;charset=utf-8" }), filename);
}

// The ArthaLeads logo for the Summary sheet. If it can't be fetched the sheet
// shows the name in text instead; a download never fails over a logo.
async function logoBase64() {
  try {
    const res = await fetch("/excel-logo.png");
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  } catch { return null; }
}

export function downloadXlsx(rows, filename, { sheetName = "Leads", ...opts } = {}) {
  return downloadXlsxSheets({ [sheetName]: rows }, filename, opts);
}

// One workbook with a sheet per name, e.g. { WhatsApp: [...], Website: [...] },
// in the ArthaLeads look (see sheetTheme.js). ExcelJS is large, so it is only
// fetched when someone actually downloads.
export async function downloadXlsxSheets(sheets, filename, opts = {}) {
  const [{ default: ExcelJS }, { buildThemedWorkbook }] = await Promise.all([import("exceljs"), import("./sheetTheme")]);
  // opts: textColumns (kept as text, default Phone/WhatsApp), summary (adds the Summary sheet).
  const wb = buildThemedWorkbook(ExcelJS, sheets, {
    ...(opts.textColumns ? { textColumns: opts.textColumns } : {}),
    summary: !!opts.summary,
    filtersText: opts.filtersText || "",
    forAgent: !!opts.forAgent,
    logo: opts.summary ? await logoBase64() : null,
  });
  const buf = await wb.xlsx.writeBuffer();
  download(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), filename);
}

// RFC 4180 CSV/TSV: quoted fields may contain commas, doubled quotes and line
// breaks (multi-line remarks), which a line-by-line split tears apart.
export function parseCsv(text) {
  const src = String(text || "").replace(/^﻿/, "");
  const firstLine = src.slice(0, src.search(/\r?\n/) === -1 ? src.length : src.search(/\r?\n/));
  const delim = firstLine.includes("\t") ? "\t" : ",";
  const records = [];
  let row = [], cur = "", inQuote = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuote) {
      if (ch === '"') {
        if (src[i + 1] === '"') { cur += '"'; i++; } else inQuote = false;
      } else cur += ch;
      continue;
    }
    if (ch === '"') { inQuote = true; continue; }
    if (ch === delim) { row.push(cur); cur = ""; continue; }
    if (ch === "\r") continue;
    if (ch === "\n") { row.push(cur); records.push(row); row = []; cur = ""; continue; }
    cur += ch;
  }
  if (cur !== "" || row.length) { row.push(cur); records.push(row); }
  const nonEmpty = records.filter((r) => r.some((v) => v.trim() !== ""));
  if (nonEmpty.length < 2) return [];
  // ="0123" (our own Excel-safe phone format) back to 0123. The quotes are
  // already gone by now, so it arrives as =0123.
  const unwrap = (v) => v.trim().replace(/^="?([^"]*)"?$/, "$1");
  const headers = nonEmpty[0].map((h) => h.trim());
  return nonEmpty.slice(1).map((vals) => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = unwrap(vals[i] || ""); });
    return obj;
  });
}
