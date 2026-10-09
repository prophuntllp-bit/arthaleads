// Click path on the real Integrations page: the Vistrow Voice quick-connect tile goes to the
// dedicated page (no modal); connection-row token management still works; nothing is written.
const path = require("path");
const assert = require("assert");
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
const here = __dirname;
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  page.setDefaultTimeout(5000);
  const problems = [];
  page.on("pageerror", (e) => problems.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) problems.push("console.error: " + m.text()); });
  const step = async (name, fn) => { try { await fn(); console.log("  ok    " + name); } catch (e) { console.log("  FAIL  " + name + "\n        " + String(e.message).split("\n").slice(0, 4).join(" | ")); await page.screenshot({ path: path.join(here, "FAIL-list.png"), fullPage: true }); problems.push(name); } };
  await page.goto("file://" + path.join(here, "index-list.html"));
  await page.waitForSelector("text=Your connections", { timeout: 8000 }).catch(() => {});
  const path_ = () => page.getByTestId("path").innerText();
  const tile = () => page.locator("button.card", { hasText: "Vistrow Voice" }).first();

  await step("starts on /integrations with the Vistrow Voice tile and a connected connection", async () => {
    assert.equal(await path_(), "/integrations");
    await tile().waitFor();
  });
  await step("clicking the Vistrow Voice quick-connect tile navigates to the dedicated page and opens no modal", async () => {
    await tile().click();
    await page.getByTestId("calling-page").waitFor();
    assert.equal(await path_(), "/integrations/vistrow-calling");
    assert.equal(await page.getByRole("dialog").count(), 0);
    assert.equal(await page.getByText("HOW TO CONNECT").count(), 0);
  });
  await step("the connected row keeps its token actions (Edit opens the token modal) and also offers Auto-call new leads", async () => {
    await page.goto("file://" + path.join(here, "index-list.html"));
    await page.getByTestId("vistrow-calling-link").waitFor();
    await page.getByRole("button", { name: "Edit" }).first().click();
    await page.getByText("HOW TO CONNECT").waitFor();
    await page.screenshot({ path: path.join(here, "06-token-modal.png") });
    await page.getByRole("button", { name: "Close" }).click();
    await page.getByTestId("vistrow-calling-link").click();
    await page.getByTestId("calling-page").waitFor();
    assert.equal(await path_(), "/integrations/vistrow-calling");
  });

  await step("nothing was written: no source switched on, no setting changed", async () => {
    const w = await page.evaluate(() => window.__writes);
    assert.deepEqual(w, []);
  });
  console.log(problems.length ? `\n${problems.length} problem(s):\n - ${problems.join("\n - ")}` : "\nclick path passed with no console errors");
  await browser.close();
  process.exit(problems.length ? 1 : 0);
})();
