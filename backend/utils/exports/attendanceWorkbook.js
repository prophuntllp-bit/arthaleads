// The attendance download as an Excel file in the ArthaLeads look (owner,
// 29 Oct 2026), replacing the plain CSV on the web: a Summary sheet with one
// row per team member, then every record with real dates and durations, the
// day type and status as coloured pills, map links, and the clock-in and
// clock-out selfies embedded in their cells (a CSV cannot hold pictures).
// Colours match ./sheetTheme.js (generated from the web's sheetTheme.js).
const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");
const storage = require("../storage");
const logger = require("../../config/logger");

const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const BRAND = "FF6B00", BRAND_DEEP = "A04100", INK = "1F2937", MUTED = "6B7280";
const ZEBRA = "FFF7F0", RULE = "E2CDB9", HEAD_RULE = "D45A00";
const IST_MS = 5.5 * 3600000;
// The selfies are shown in their cells, large enough to recognise the person
// without opening anything (owner, 29 Oct 2026). Up to this many records carry
// pictures; past it a cell says to narrow the dates, so a year of a big team
// still downloads in a reasonable time and size.
const MAX_PHOTO_ROWS = 1000;
const PHOTO_PX = 112;

const argb = (hex) => `FF${hex}`;
const solid = (hex) => ({ type: "pattern", pattern: "solid", fgColor: { argb: argb(hex) } });
const box = (hex) => { const s = { style: "thin", color: { argb: argb(hex) } }; return { top: s, left: s, bottom: s, right: s }; };

let logoCache;
function logoBase64() {
  if (logoCache === undefined) {
    try { logoCache = fs.readFileSync(path.join(__dirname, "..", "..", "assets", "excel-logo.png")).toString("base64"); } catch { logoCache = null; }
  }
  return logoCache;
}

// Excel stores a date-time with no zone and shows it as written, so an IST
// clock time is written as IST wall time.
const istWall = (d) => (d ? new Date(new Date(d).getTime() + IST_MS) : null);
const dayDate = (ymd) => (ymd ? new Date(`${ymd}T00:00:00Z`) : null);
// Minutes as an Excel duration (fraction of a day), shown as 7:32.
const dur = (mins) => (mins == null || mins === "" ? null : Number(mins) / 1440);

const DAY_TYPE = { full: ["Full day", ["DCFCE7", "15803D"]], half: ["Half day", ["FEF3C7", "B45309"]], short: ["Short day", ["FEE2E2", "B91C1C"]] };

function statusOf(r) {
  if (!r.clockIn) return ["Absent", ["F3F4F6", "374151"]];
  if (r.clockOut && r.autoClosed) return ["Auto closed", ["FEF3C7", "B45309"]];
  if (r.clockOut) return ["Done", ["DBEAFE", "1D4ED8"]];
  if (Date.now() - new Date(r.clockIn) < 24 * 3600000) return ["Clocked in", ["DCFCE7", "15803D"]];
  return ["No clock-out", ["FEE2E2", "B91C1C"]];
}

function pill(cell, [bg, fg]) {
  cell.fill = solid(bg);
  cell.font = { bold: true, color: { argb: argb(fg) }, size: 10 };
  cell.alignment = { vertical: "middle", horizontal: "center" };
}

// Brand-orange heading row with white bold text.
function header(ws, rowNo, labels, fill = BRAND) {
  const row = ws.getRow(rowNo);
  labels.forEach((l, i) => {
    const c = row.getCell(i + 1);
    c.value = l;
    c.fill = solid(fill);
    c.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    c.alignment = { vertical: "middle", horizontal: "left", indent: 1, wrapText: true };
    c.border = { ...box(HEAD_RULE), bottom: { style: "medium", color: { argb: argb(BRAND_DEEP) } } };
  });
  row.height = 30;
  return row.number;
}

function bodyCell(cell, zebra) {
  cell.font = { color: { argb: argb(INK) }, size: 10 };
  cell.alignment = { vertical: "middle", indent: 1 };
  cell.border = box(RULE);
  if (zebra) cell.fill = solid(ZEBRA);
}

async function bytesOf(url) {
  const key = storage.keyFromUrl(url);
  if (!key) return null;
  try {
    const { body, contentType } = await storage.getObject(key);
    const buf = Buffer.from(await body.transformToByteArray());
    const type = String(contentType || "").toLowerCase();
    const extension = type.includes("png") ? "png" : type.includes("jpeg") || type.includes("jpg") ? "jpeg" : type.includes("gif") ? "gif" : null;
    return extension ? { buffer: buf, extension } : null; // Excel cannot show webp
  } catch (e) {
    logger.warn(`[attendance export] photo not loaded (${key}): ${e.message}`);
    return null;
  }
}

/** Every photo in the records, fetched a few at a time. */
async function loadPhotos(records) {
  const urls = [];
  for (const r of records.slice(0, MAX_PHOTO_ROWS)) for (const u of [r.clockInSelfie, r.clockOutSelfie]) if (u) urls.push(u);
  const out = new Map();
  if (!storage.isConfigured()) return out;
  for (let i = 0; i < urls.length; i += 6) {
    const batch = urls.slice(i, i + 6);
    const got = await Promise.all(batch.map(bytesOf));
    batch.forEach((u, n) => { if (got[n]) out.set(u, got[n]); });
  }
  return out;
}

function addSummary(wb, records, { title, periodText, generatedText, logo }) {
  const ws = wb.addWorksheet("Summary", {
    properties: { tabColor: { argb: argb(BRAND) } },
    views: [{ showGridLines: false }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  ws.columns = [{ width: 26 }, { width: 13 }, ...Array(13).fill({ width: 13 })];
  if (logo) {
    const id = wb.addImage({ base64: logo, extension: "png" });
    // Same size as the leads Summary: the logo is 1116 x 220, kept in proportion.
    ws.addImage(id, { tl: { col: 0.1, row: 0.15 }, ext: { width: 233, height: 46 }, editAs: "absolute" });
  }
  ws.getRow(1).height = 46;
  ws.getCell("C1").value = title;
  ws.getCell("C1").font = { bold: true, size: 18, color: { argb: argb(INK) } };
  ws.getCell("C1").alignment = { vertical: "middle" };
  ws.getCell("A3").value = periodText;
  ws.getCell("A3").font = { size: 11, color: { argb: argb(INK) } };
  ws.getCell("A4").value = generatedText;
  ws.getCell("A4").font = { size: 10, color: { argb: argb(MUTED) } };

  const by = new Map();
  for (const r of records) {
    const name = r.userId?.name || "Former member";
    const m = by.get(name) || { name, role: r.userId?.role || "", present: 0, full: 0, half: 0, short: 0, late: 0, outside: 0, early: 0, auto: 0, open: 0, mins: 0, closedDays: 0, ot: 0, noPhoto: 0 };
    if (r.clockIn) m.present++;
    if (r.dayType === "full") m.full++;
    if (r.dayType === "half") m.half++;
    if (r.dayType === "short") m.short++;
    if (r.isLate) m.late++;
    if (r.outsideShift) m.outside++;
    if (r.isEarlyLeave) m.early++;
    if (r.autoClosed) m.auto++;
    if (r.clockIn && !r.clockOut) m.open++;
    if (r.totalMinutes != null) { m.mins += r.totalMinutes; m.closedDays++; }
    m.ot += r.overtimeMinutes || 0;
    if (r.clockIn && !r.clockInSelfie) m.noPhoto++;
    by.set(name, m);
  }
  const members = [...by.values()].sort((a, b) => a.name.localeCompare(b.name));
  const labels = ["Team member", "Role", "Days present", "Full days", "Half days", "Short days", "Late", "Outside shift", "Left early", "Auto closed", "No clock-out", "Total hours", "Avg hours / day", "Overtime", "No photo"];
  const hr = 6;
  header(ws, hr, labels);

  const totals = { present: 0, full: 0, half: 0, short: 0, late: 0, outside: 0, early: 0, auto: 0, open: 0, mins: 0, closedDays: 0, ot: 0, noPhoto: 0 };
  members.forEach((m, i) => {
    const row = ws.getRow(hr + 1 + i);
    const vals = [m.name, m.role, m.present, m.full, m.half, m.short, m.late, m.outside, m.early, m.auto, m.open,
      dur(m.mins), dur(m.closedDays ? Math.round(m.mins / m.closedDays) : 0), dur(m.ot), m.noPhoto];
    vals.forEach((v, n) => {
      const c = row.getCell(n + 1);
      c.value = v;
      bodyCell(c, i % 2 === 1);
      if (n >= 2) c.alignment = { vertical: "middle", horizontal: "center" };
      if (n >= 11 && n <= 13) c.numFmt = "[h]:mm";
    });
    row.getCell(1).font = { bold: true, color: { argb: argb(INK) }, size: 10 };
    row.getCell(2).value = m.role ? m.role[0].toUpperCase() + m.role.slice(1).replace("_", " ") : "";
    for (const k of Object.keys(totals)) totals[k] += m[k];
    row.height = 22;
  });
  const t = ws.getRow(hr + 1 + members.length);
  const tv = ["All members", "", totals.present, totals.full, totals.half, totals.short, totals.late, totals.outside, totals.early, totals.auto, totals.open,
    dur(totals.mins), dur(totals.closedDays ? Math.round(totals.mins / totals.closedDays) : 0), dur(totals.ot), totals.noPhoto];
  tv.forEach((v, n) => {
    const c = t.getCell(n + 1);
    c.value = v;
    c.fill = solid("FFE8D6");
    c.font = { bold: true, color: { argb: argb(INK) }, size: 10 };
    c.border = { ...box(RULE), top: { style: "medium", color: { argb: argb(BRAND) } } };
    c.alignment = n >= 2 ? { vertical: "middle", horizontal: "center" } : { vertical: "middle", indent: 1 };
    if (n >= 11 && n <= 13) c.numFmt = "[h]:mm";
  });
  t.height = 24;

  const note = ws.getRow(hr + 3 + members.length);
  note.getCell(1).value = "Hours count only finished days. Auto closed: nobody clocked out, so the day was closed at the shift's end. No photo: a photo was required but the person clocked in without one.";
  note.getCell(1).font = { italic: true, size: 9, color: { argb: argb(MUTED) } };
  ws.mergeCells(note.number, 1, note.number, 15);
  return ws;
}

function addRecords(wb, records, photos) {
  const ws = wb.addWorksheet("Attendance", {
    properties: { tabColor: { argb: argb(BRAND_DEEP) } },
    views: [{ state: "frozen", xSplit: 3, ySplit: 1, showGridLines: false }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: "1:1" },
  });
  const cols = [
    // Each at least its heading plus room for the filter button, so nothing wraps.
    ["Date", 15], ["Day", 9], ["Team member", 22], ["Role", 13], ["Clock in", 13], ["Clock out", 14], ["Hours", 11],
    ["Day type", 14], ["Status", 15], ["Late by", 12], ["Left early by", 18], ["Overtime", 14], ["Outside shift", 18],
    ["Photo in", 18], ["Photo out", 18], ["Location in", 17], ["Location out", 18], ["Note", 30], ["Email", 30],
  ];
  ws.columns = cols.map(([header, width]) => ({ header, width }));
  header(ws, 1, cols.map((c) => c[0]));
  const C = Object.fromEntries(cols.map(([h], i) => [h, i + 1]));

  records.forEach((r, i) => {
    const rowNo = i + 2;
    const row = ws.getRow(rowNo);
    const zebra = i % 2 === 1;
    const embed = i < MAX_PHOTO_ROWS;
    const hasPhoto = embed && (photos.has(r.clockInSelfie) || photos.has(r.clockOutSelfie));
    const values = {
      Date: dayDate(r.date),
      Day: dayDate(r.date),
      "Team member": r.userId?.name || "Former member",
      Role: r.userId?.role ? r.userId.role[0].toUpperCase() + r.userId.role.slice(1).replace("_", " ") : "",
      "Clock in": istWall(r.clockIn),
      "Clock out": istWall(r.clockOut),
      Hours: dur(r.totalMinutes),
      "Late by": r.isLate ? dur(r.lateByMinutes || 0) : null,
      "Left early by": r.isEarlyLeave ? dur(r.earlyLeaveByMinutes || 0) : null,
      Overtime: dur(r.overtimeMinutes || null),
      "Outside shift": r.outsideShift ? "Yes" : null,
      Note: r.note || null,
      Email: r.userId?.email || null,
    };
    for (const [h, n] of Object.entries(C)) {
      const cell = row.getCell(n);
      bodyCell(cell, zebra);
      if (values[h] != null) cell.value = values[h];
    }
    row.getCell(C["Team member"]).font = { bold: true, color: { argb: argb(INK) }, size: 10 };
    row.getCell(C.Date).numFmt = "dd mmm yyyy";
    row.getCell(C.Day).numFmt = "ddd";
    for (const h of ["Clock in", "Clock out"]) { row.getCell(C[h]).numFmt = "h:mm AM/PM"; row.getCell(C[h]).alignment = { vertical: "middle", horizontal: "center" }; }
    for (const h of ["Hours", "Late by", "Left early by", "Overtime"]) { row.getCell(C[h]).numFmt = "[h]:mm"; row.getCell(C[h]).alignment = { vertical: "middle", horizontal: "center" }; }
    if (r.isLate) row.getCell(C["Late by"]).font = { bold: true, color: { argb: "FFC2410C" }, size: 10 };
    if (r.isEarlyLeave) row.getCell(C["Left early by"]).font = { bold: true, color: { argb: "FF7C3AED" }, size: 10 };
    if (r.overtimeMinutes) row.getCell(C.Overtime).font = { bold: true, color: { argb: "FF4F46E5" }, size: 10 };
    if (r.outsideShift) pill(row.getCell(C["Outside shift"]), ["F3F4F6", "374151"]);
    if (!r.clockOut && r.clockIn) {
      const c = row.getCell(C["Clock out"]);
      c.value = "Not clocked out";
      c.font = { bold: true, color: { argb: "FFB91C1C" }, size: 10 };
    }
    if (DAY_TYPE[r.dayType]) { row.getCell(C["Day type"]).value = DAY_TYPE[r.dayType][0]; pill(row.getCell(C["Day type"]), DAY_TYPE[r.dayType][1]); }
    const [st, stStyle] = statusOf(r);
    row.getCell(C.Status).value = st;
    pill(row.getCell(C.Status), stStyle);

    // Photos: the picture in the cell; else a link to it; else why there is none.
    for (const [h, url, skipped] of [["Photo in", r.clockInSelfie, r.clockInProofSkipped], ["Photo out", r.clockOutSelfie, r.clockOutProofSkipped]]) {
      const cell = row.getCell(C[h]);
      const img = embed && url ? photos.get(url) : null;
      if (img) {
        const id = wb.addImage({ buffer: img.buffer, extension: img.extension });
        // The picture stays in the cell; clicking it, or the link under it,
        // opens the full-size photo (owner, 29 Oct 2026).
        ws.addImage(id, { tl: { col: C[h] - 1 + 0.08, row: rowNo - 1 + 0.04 }, ext: { width: PHOTO_PX, height: PHOTO_PX }, editAs: "oneCell",
          hyperlinks: { hyperlink: url, tooltip: "Open the full-size photo" } });
        cell.value = { text: "Open full photo", hyperlink: url };
        cell.font = { color: { argb: "FF2563EB" }, underline: true, size: 9 };
        cell.alignment = { vertical: "bottom", horizontal: "center" };
      } else if (url) {
        // Not loaded, or past the photo limit: say so plainly rather than link out.
        cell.value = embed ? "Photo not available" : "Narrow the dates to see";
        cell.font = { italic: true, color: { argb: argb(MUTED) }, size: 9 };
        cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      } else if (skipped) {
        cell.value = "No photo";
        pill(cell, ["FEE2E2", "B91C1C"]);
      }
    }
    for (const [h, lat, lng] of [["Location in", r.clockInLat, r.clockInLng], ["Location out", r.clockOutLat, r.clockOutLng]]) {
      if (lat == null || lng == null) continue;
      const cell = row.getCell(C[h]);
      cell.value = { text: "Open map", hyperlink: `https://maps.google.com/?q=${lat},${lng}` };
      cell.font = { color: { argb: "FF2563EB" }, underline: true, size: 10 };
    }
    row.getCell(C.Note).alignment = { vertical: "middle", indent: 1, wrapText: true };
    row.height = hasPhoto ? 104 : 22; // points: the 112 px photo, then its link underneath
  });

  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };
  return ws;
}

/**
 * The attendance report as an .xlsx buffer.
 * records: populated with userId (name, email, role), sorted as they should appear.
 */
async function attendanceWorkbook(records, { from, to, memberName, orgName } = {}) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "ArthaLeads";
  wb.company = "ArthaLeads";
  wb.created = new Date();
  const fmt = (ymd) => new Date(`${ymd}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  const period = from && to ? `${fmt(from)} to ${fmt(to)}` : from ? `From ${fmt(from)}` : to ? `Up to ${fmt(to)}` : "All time";
  const generated = new Date().toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" });
  // Newest first (owner, 29 Oct 2026), whatever order the caller used.
  records = [...records].sort((a, b) => String(b.date).localeCompare(String(a.date)) || new Date(b.clockIn || 0) - new Date(a.clockIn || 0));
  const photos = await loadPhotos(records);
  addSummary(wb, records, {
    title: `Attendance report${orgName ? `, ${orgName}` : ""}`,
    periodText: `Period: ${period} · ${memberName ? `Member: ${memberName}` : "All members"} · ${records.length} record${records.length === 1 ? "" : "s"}`,
    generatedText: `Generated ${generated} IST. Times are in IST.${records.length > MAX_PHOTO_ROWS ? ` Photos are shown for the first ${MAX_PHOTO_ROWS} records; choose a shorter date range to see the rest.` : ""}`,
    logo: logoBase64(),
  });
  addRecords(wb, records, photos);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

module.exports = { attendanceWorkbook, XLSX_TYPE, MAX_PHOTO_ROWS };
