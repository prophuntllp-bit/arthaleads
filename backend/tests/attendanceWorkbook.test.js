// The attendance Excel report (29 Oct 2026): a Summary sheet per member and
// every record with the selfies embedded, read back with ExcelJS.
const { test, run, assert } = require("./helpers/harness");
const ExcelJS = require("exceljs");
const storage = require("../utils/storage");

// A 1x1 PNG stands in for a selfie; storage is faked so nothing leaves the machine.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
storage.isConfigured = () => true;
const fetched = [];
storage.getObject = async (key) => { fetched.push(key); return { body: { transformToByteArray: async () => PNG }, contentType: "image/png" }; };

const { attendanceWorkbook } = require("../utils/exports/attendanceWorkbook");
const media = (k) => `https://api.arthaleads.com/api/media/arthaleads/attendance/${k}.png`;
const asha = { name: "Asha Patil", email: "asha@example.com", role: "agent" };
const ravi = { name: "Ravi Shinde", email: "ravi@example.com", role: "manager" };
const records = [
  { date: "2026-10-27", userId: asha, clockIn: new Date("2026-10-27T04:35:00Z"), clockOut: new Date("2026-10-27T13:40:00Z"), totalMinutes: 545, dayType: "full",
    isLate: true, lateByMinutes: 10, overtimeMinutes: 10, clockInSelfie: media("a-in"), clockOutSelfie: media("a-out"), clockInLat: 18.55, clockInLng: 73.78, note: "Site visit" },
  { date: "2026-10-28", userId: ravi, clockIn: new Date("2026-10-28T12:40:00Z"), clockOut: new Date("2026-10-28T13:30:00Z"), totalMinutes: 50, dayType: "short",
    autoClosed: true, outsideShift: true, clockInProofSkipped: true },
  { date: "2026-10-28", userId: asha, clockIn: new Date("2026-10-28T04:30:00Z"), clockOut: null, totalMinutes: null, clockInSelfie: media("a2-in") },
];

let wb;
test("builds an .xlsx with a Summary sheet and an Attendance sheet", async () => {
  const buf = await attendanceWorkbook(records, { from: "2026-10-01", to: "2026-10-28", orgName: "Prophunt LLP" });
  assert.equal(buf.slice(0, 2).toString(), "PK", "an Excel (zip) file");
  wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  assert.deepEqual(wb.worksheets.map((w) => w.name), ["Summary", "Attendance"]);
});

test("summary: one row per member with totals and an All members row", () => {
  const ws = wb.getWorksheet("Summary");
  assert.match(String(ws.getCell("C1").value), /Attendance report, Prophunt LLP/);
  assert.match(String(ws.getCell("A3").value), /1 Oct 2026 to 28 Oct 2026/);
  assert.equal(ws.getCell("A6").value, "Team member");
  assert.equal(ws.getCell("A7").value, "Asha Patil");
  assert.equal(ws.getCell("C7").value, 2, "Asha present twice");
  assert.equal(ws.getCell("A8").value, "Ravi Shinde");
  assert.equal(ws.getCell("J8").value, 1, "Ravi auto closed once");
  assert.equal(ws.getCell("O8").value, 1, "Ravi clocked in without a photo");
  assert.equal(ws.getCell("A9").value, "All members");
  assert.equal(ws.getCell("C9").value, 3);
  // ExcelJS reads a duration back as a time on 30 Dec 1899.
  const v = ws.getCell("L9").value;
  const minutes = v instanceof Date ? Math.round((v - Date.UTC(1899, 11, 30)) / 60000) : Math.round(v * 1440);
  assert.equal(minutes, 595, "total hours as a duration (9:55)");
  assert.equal(ws.getCell("L9").numFmt, "[h]:mm");
});

test("records: themed header, IST times, pills, map link, photos in the cells", () => {
  const ws = wb.getWorksheet("Attendance");
  const head = ws.getRow(1);
  assert.equal(head.getCell(1).value, "Date");
  assert.equal(head.getCell(1).fill.fgColor.argb, "FFFF6B00", "brand orange heading");
  const r2 = ws.getRow(2);
  assert.equal(r2.getCell(3).value, "Asha Patil");
  assert.equal(r2.getCell(5).value.toISOString().slice(11, 16), "10:05", "clock-in shown as IST wall time");
  assert.equal(r2.getCell(5).numFmt, "h:mm AM/PM");
  assert.equal(r2.getCell(8).value, "Full day");
  assert.equal(r2.getCell(9).value, "Done");
  assert.equal(r2.getCell(16).value.text, "Open map");
  assert.equal(r2.getCell(18).value, "Site visit");
  const r3 = ws.getRow(3);
  assert.equal(r3.getCell(9).value, "Auto closed");
  assert.equal(r3.getCell(13).value, "Yes", "outside shift");
  assert.equal(r3.getCell(14).value, "No photo");
  const r4 = ws.getRow(4);
  assert.equal(r4.getCell(6).value, "Not clocked out");
  const images = ws.getImages();
  assert.equal(images.length, 3, "three selfies embedded");
  assert.equal(fetched.length, 3);
  assert.ok(ws.autoFilter, "filter buttons on the header row");
});

run("Attendance Excel report");
