// Excel exports made on the server for the phone app (21 Oct 2026): the look
// must be the web's own (utils/exports/sheetTheme.js is generated from
// frontend/src/utils/sheetTheme.js), and a Leads file must have the same
// sheets, columns and Summary as the one the web builds.
const fs = require("fs");
const ExcelJS = require("exceljs");
const { test, run, assert } = require("./helpers/harness");
const { toCommonJs, SRC, OUT } = require("../scripts/syncSheetTheme");
const { leadRows, leadsWorkbook, themedWorkbook } = require("../utils/exports/leadWorkbook");
const leadController = require("../controllers/leadController");

async function reopen(wb) {
  const back = new ExcelJS.Workbook();
  await back.xlsx.load(await wb.xlsx.writeBuffer());
  return back;
}

const leads = [
  { _id: "1", name: "Asha Patil", phone: "919876543210", status: "New", priority: "Hot", source: "Facebook", createdAt: "2026-10-20T04:30:00Z",
    budget: { min: 5000000, max: 7500000 }, activities: [{ type: "called", createdAt: "2026-10-20T06:00:00Z", meta: { status: "answered" } }],
    formResponses: [{ label: "When do you plan to buy?", value: "In 3 months" }] },
  { _id: "2", name: "Ravi Kulkarni", phone: "9876500001", status: "Contacted", source: "Website", createdAt: "2026-10-19T10:00:00Z",
    firstContactedAt: "2026-10-19T10:30:00Z", sourcePage: "https://example.in/khopoli/?utm=fb" },
  { _id: "3", name: "Meera Iyer", phone: "9876500002", status: "Site Visit", source: "Facebook", createdAt: "2026-10-18T10:00:00Z" },
];

test("the server's copy of the look is exactly the web's (run scripts/syncSheetTheme.js after editing the web file)", () => {
  assert.equal(fs.readFileSync(OUT, "utf8"), toCommonJs(fs.readFileSync(SRC, "utf8")));
});

test("Leads rows: the web's columns in the web's order, IST dates, calls and form answers", () => {
  const [a, b] = leadRows(leads, Date.parse("2026-10-21T00:00:00Z"));
  assert.deepEqual(Object.keys(a).slice(0, 8), ["Name", "Phone", "Status", "Priority", "Project", "AssignedTo", "Email", "Source"]);
  assert.equal(a.CreatedAt, "2026-10-20 10:00");
  assert.equal(a.Calls, 1);
  assert.ok(a.LastCall.startsWith("Answered, "));
  assert.equal(a["Form: When do you plan to buy?"], "In 3 months");
  assert.equal(b.ResponseHours, 0.5);
  assert.equal(b.Page, "/khopoli");
  assert.equal(b.PageURL, "https://example.in/khopoli/");
});

test("Leads workbook: Summary first with the logo, a sheet per source, branded header, frozen, filtered", async () => {
  const wb = await reopen(leadsWorkbook(leads, { filtersText: "Last 30 days", forAgent: false }));
  assert.deepEqual(wb.worksheets.map((w) => w.name), ["Summary", "Facebook", "Website"]);
  assert.ok(wb.model.media.length >= 1, "logo image on the Summary sheet");
  const fb = wb.getWorksheet("Facebook");
  const head = fb.getRow(1).getCell(1);
  assert.equal(head.value, "Name");
  assert.equal(head.fill.fgColor.argb, "FFFF6B00");
  assert.equal(head.font.color.argb, "FFFFFFFF");
  assert.equal(fb.views[0].state, "frozen");
  assert.equal(fb.views[0].ySplit, 1);
  assert.ok(fb.autoFilter, "filters on the header row");
  const phoneCol = fb.getRow(1).values.indexOf("Phone");
  assert.equal(fb.getRow(2).getCell(phoneCol).value, "+91 98765 43210");
});

test("one source is one 'Leads' sheet", async () => {
  const wb = await reopen(leadsWorkbook([leads[1]]));
  assert.deepEqual(wb.worksheets.map((w) => w.name), ["Summary", "Leads"]);
});

test("rows from the phone (Dump, projects) come back in the same look", async () => {
  const wb = await reopen(themedWorkbook({ "Dump Leads": [{ Name: "Old Lead", Phone: "9876500003", Source: "Manual", Reason: "Closed Lost" }] }));
  assert.deepEqual(wb.worksheets.map((w) => w.name), ["Dump Leads"]);
  assert.equal(wb.getWorksheet("Dump Leads").getRow(1).getCell(1).fill.fgColor.argb, "FFFF6B00");
});

function mockRes() {
  const r = { code: 200, headers: {}, body: null };
  r.status = (c) => { r.code = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  r.setHeader = (k, v) => { r.headers[k.toLowerCase()] = v; };
  r.end = (b) => { r.body = b; return r; };
  return r;
}

test("export-sheet: sends a named .xlsx, refuses empty or oversized input", async () => {
  const ok = mockRes();
  await leadController.exportSheet({ body: { sheets: { Leads: [{ Name: "A B", Phone: "9876500004" }] }, filename: "Leads_Khopoli" } }, ok, (e) => { throw e; });
  assert.equal(ok.headers["content-type"], "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  assert.ok(ok.headers["content-disposition"].includes('filename="Leads_Khopoli.xlsx"'));
  assert.ok(Buffer.isBuffer(ok.body) && ok.body.length > 1000);

  const empty = mockRes();
  await leadController.exportSheet({ body: { sheets: { Leads: [] } } }, empty, (e) => { throw e; });
  assert.equal(empty.code, 404);
  const big = mockRes();
  await leadController.exportSheet({ body: { sheets: { Leads: Array.from({ length: 10001 }, () => ({ Name: "x" })) } } }, big, (e) => { throw e; });
  assert.equal(big.code, 413);
  const junk = mockRes();
  await leadController.exportSheet({ body: { sheets: "nope" } }, junk, (e) => { throw e; });
  assert.equal(junk.code, 400);
});

test("Dump and project leads: rows built on the server like the web's", async () => {
  const { dumpRows, projectRows } = require("../utils/exports/leadWorkbook");
  const [d] = dumpRows([{ name: "Old", phone: "9876500005", isDeleted: true, createdAt: "2026-10-20T20:00:00Z" }]);
  assert.equal(d.Reason, "Deleted");
  assert.equal(d.AddedOn, "2026-10-21");
  const rows = projectRows([
    { name: "P One", phone: "9876500006", remarkNote: "requirement: 2 BHK · visit date: 45668" },
    { name: "P Two", phone: "9876500007", remarkNote: "Called, interested" },
  ]);
  assert.equal(rows[0].Requirement, "2 BHK");
  assert.ok(/2025/.test(rows[0]["Visit Date"]), "Excel serial turned back into a date");
  assert.equal(rows[1].Note, "Called, interested");
  assert.ok(!("WhatsApp" in rows[0]), "columns nobody filled are dropped");
  const res = mockRes();
  await leadController.exportSheet({ body: { kind: "project", prospective: true, leads: [{ name: "P", phone: "1" }], filename: "Prospective_X" } }, res, (e) => { throw e; });
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(res.body);
  assert.deepEqual(wb.worksheets.map((w) => w.name), ["Prospective"]);
});

run("Server-made Excel: the web's look, the web's columns");
