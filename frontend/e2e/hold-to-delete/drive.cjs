// Hold-to-delete: release early cancels, a full hold confirms once, keyboard works, Cancel never deletes.
const path = require("path"); const assert = require("assert");
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
(async () => {
  const browser = await chromium.launch(); const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  page.setDefaultTimeout(5000); const problems = [];
  page.on("pageerror", (e) => problems.push("pageerror: " + e.message));
  const step = async (n, f) => { try { await f(); console.log("  ok    " + n); } catch (e) { console.log("  FAIL  " + n + "\n        " + String(e.message).split("\n")[0]); problems.push(n); } };
  await page.goto("file://" + path.join(__dirname, "index.html"));
  const hold = page.getByRole("button", { name: "Hold to delete" }).first();
  const count = async () => Number(await page.getByTestId("count").innerText());
  const mid = async () => { const b = await hold.boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2]; };
  const fill = () => page.locator('button[aria-busy] > span[aria-hidden="true"]').evaluate((e) => getComputedStyle(e).clipPath);
  await step("the dialog shows Cancel and a 'Hold to delete' button; a plain click deletes nothing", async () => {
    await hold.waitFor(); await page.getByRole("button", { name: "Cancel" }).waitFor();
    await hold.click(); await page.waitForTimeout(300);
    assert.equal(await count(), 0); assert.equal(await hold.getAttribute("aria-busy"), "false");
  });
  await step("holding starts the red fill (aria-busy) and releasing early cancels it", async () => {
    const [x, y] = await mid(); await page.mouse.move(x, y); await page.mouse.down(); await page.waitForTimeout(500);
    assert.equal(await hold.getAttribute("aria-busy"), "true");
    await page.screenshot({ path: path.join(__dirname, "hold-mid.png") });
    await page.mouse.up(); await page.waitForTimeout(300);
    assert.equal(await hold.getAttribute("aria-busy"), "false"); assert.equal(await count(), 0);
  });
  await step("sliding the pointer off the button cancels the hold", async () => {
    const [x, y] = await mid(); await page.mouse.move(x, y); await page.mouse.down(); await page.waitForTimeout(300);
    await page.mouse.move(x, y - 150); await page.waitForTimeout(200);
    assert.equal(await hold.getAttribute("aria-busy"), "false"); await page.mouse.up();
    await page.waitForTimeout(1900); assert.equal(await count(), 0, "never confirmed");
  });
  await step("keyboard: releasing Enter early cancels; holding Enter for the full time confirms exactly once", async () => {
    await hold.focus(); await page.keyboard.down("Enter"); await page.waitForTimeout(400); await page.keyboard.up("Enter");
    assert.equal(await count(), 0);
    await page.keyboard.down("Enter"); await page.waitForTimeout(2000); await page.keyboard.up("Enter");
    await page.waitForFunction(() => document.querySelector('[data-testid="count"]').innerText === "1");
    await page.waitForTimeout(300); assert.equal(await count(), 1);
  });
  await step("a full pointer hold also confirms (after reopening), once", async () => {
    await page.getByTestId("reopen").click();
    const h = page.getByRole("button", { name: "Hold to delete" }).first(); await h.waitFor();
    const b = await h.boundingBox(); await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down();
    await page.waitForFunction(() => document.querySelector('[data-testid="count"]').innerText === "2", null, { timeout: 4000 });
    await page.mouse.up(); await page.waitForTimeout(300); assert.equal(await count(), 2);
  });
  await step("Cancel closes without deleting", async () => {
    await page.getByTestId("reopen").click(); await page.getByRole("button", { name: "Cancel" }).click();
    await page.waitForTimeout(200); assert.equal(await count(), 2); assert.equal(await page.getByRole("dialog").count() + await page.getByText("Delete Project").count(), 0);
  });
  console.log(problems.length ? `\n${problems.length} problem(s)` : "\nhold-to-delete passed with no page errors");
  await browser.close(); process.exit(problems.length ? 1 : 0);
})();
