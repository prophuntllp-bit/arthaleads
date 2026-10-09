const path = require("path");
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
const here = __dirname;
const assert = require("assert");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  const problems = [];
  page.on("pageerror", (e) => problems.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) problems.push("console.error: " + m.text()); }); // file:// fonts/images in the harness are not part of the component
  await page.goto("file://" + path.join(here, "index.html"));
  await page.waitForSelector('[data-testid="vistrow-outbound"]');

  page.setDefaultTimeout(4000);
  const root = page.locator('[data-testid="vistrow-outbound"]');
  const src = (k) => page.locator(`[data-testid="source-${k}"]`);
  const sw = (k) => src(k).locator('[role="switch"]');
  const fake = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__fake)));
  const step = async (name, fn) => { try { await fn(); console.log("  ok    " + name); } catch (e) { console.log("  FAIL  " + name + "\n        " + String(e.message).split("\n")[0]); await page.screenshot({ path: path.join(here, "FAIL.png"), fullPage: true }); problems.push(name); } };
  const confirmWith = async (label) => { const d = page.getByRole("dialog"); await d.getByRole("button", { name: label, exact: true }).click(); };

  const tog = (k) => page.locator(`[data-testid="toggle-${k}"] [role="switch"]`);
  const pick = async (scope, current, option) => { await scope.getByRole("button", { name: current }).first().click(); await page.getByRole("button", { name: option, exact: true }).last().click(); };
  const NOJARGON = /webhook|payload|token|\bUUID\b|X-Vistrow|Bearer|account_id|agent_id|api\./i;

  await step("fresh setup: four plain steps, every source OFF, nothing live, no jargon in the main flow", async () => {
    for (const k of ["website", "facebook", "whatsapp"]) assert.equal(await tog(k).getAttribute("aria-checked"), "false");
    const t = await root.innerText();
    assert.match(t, /Connect ArthaLeads to Vistrow/);
    assert.match(t, /Which new leads should Vistrow call/);
    assert.match(t, /Choose who calls/);
    assert.match(t, /Review and switch on/);
    assert.match(await root.locator('[data-testid="master-state"]').innerText(), /Not switched on/);
    assert.ok(await root.getByRole("button", { name: /Switch on/ }).isDisabled(), "cannot switch on before connecting");
    // address / header mode / test buttons / activity live only inside the collapsed Technical details
    assert.equal(await root.locator('[data-testid="adv-body"]').count(), 0);
    assert.doesNotMatch(t, NOJARGON);
    await page.screenshot({ path: path.join(here, "01-initial.png"), fullPage: true });
  });

  await step("step 1: only an account number and a key are asked for; saving hides the key and applies the default address", async () => {
    await root.locator('label:has-text("Vistrow account number") + input').fill("acct_123");
    await root.getByPlaceholder("Paste the key from Vistrow").fill("a-very-secret-key-0123456789");
    await root.getByText("Where do I find these?").click();
    await root.getByText(/lead-import \(ArthaLeads\) settings/).waitFor();
    await root.getByRole("button", { name: "Connect", exact: true }).click();
    await page.waitForFunction(() => window.__fake.config.hasSecret === true);
    assert.equal((await fake()).config.baseUrl, "https://api.vistrowvoice.com");
    assert.equal(await root.getByPlaceholder("Saved - type a new one only to replace it").inputValue(), "");
    assert.ok(await root.getByRole("button", { name: /Switch on/ }).isEnabled());
  });

  await step("step 3 is empty until a source is chosen", async () => {
    assert.match(await root.locator('[data-testid="step-agents"]').innerText(), /Switch on at least one source in step 2/);
    assert.equal(await page.locator('[data-testid="source-website"]').count(), 0);
  });

  await step("step 2: a source switch just records the choice while not live (no scary dialog), others stay off", async () => {
    await tog("website").click();
    await page.waitForFunction(() => window.__fake.routing.website.enabled === true);
    assert.equal(await page.getByRole("dialog").count(), 0);
    assert.equal(await tog("facebook").getAttribute("aria-checked"), "false");
    assert.equal((await fake()).enabled, false, "still not live");
    assert.match(await root.locator('[data-testid="preview"]').innerText(), /Website leads: not called - no agent chosen yet/);
  });

  await step("step 3: a website page -> a NEW agent by name; the list shows names, not codes", async () => {
    const w = src("website");
    await w.getByPlaceholder("/shapoorji-pallonji-khopoli/").fill("/shapoorji-pallonji-khopoli/");
    await pick(w.locator("div").filter({ hasText: /^Project \(optional\)/ }).first(), "None", "SP Khopoli");
    await pick(w, "Choose an agent…", "+ Add a new agent");
    await w.getByPlaceholder("e.g. Siya KHOPOLI").fill("Siya KHOPOLI");
    await w.locator('label:has-text("Agent code") + input').fill("agent_khopoli");
    await w.getByRole("button", { name: "Add", exact: true }).click();
    await page.waitForFunction(() => window.__fake.routing.website.routes.length === 1);
    const r = (await fake()).routing.website.routes[0];
    assert.equal(r.agentId, "agent_khopoli"); assert.equal(r.projectId, "64b0000000000000000000e1");
    const t = await w.locator('[data-testid="route-row"]').first().innerText();
    assert.ok(t.includes("/shapoorji-pallonji-khopoli/") && t.includes("SP Khopoli") && t.includes("Siya KHOPOLI"));
    assert.ok(!t.includes("agent_khopoli"), "the code is not shown in the row");
  });

  await step("choosing no agent, or a new agent without a name, is refused", async () => {
    const w = src("website");
    await w.getByPlaceholder("/shapoorji-pallonji-khopoli/").fill("/other-project/");
    await w.getByRole("button", { name: "Add", exact: true }).click();
    await page.getByText("Choose which agent should call these leads").first().waitFor();
    await pick(w, "Choose an agent…", "+ Add a new agent");
    await w.locator('label:has-text("Agent code") + input').fill("agent_z");
    await w.getByRole("button", { name: "Add", exact: true }).click();
    await page.getByText("Give the new agent a name").first().waitFor();
    assert.equal((await fake()).routing.website.routes.length, 1);
  });

  await step("a page rule that would match nearly everything is refused with a reason", async () => {
    const w = src("website");
    await w.getByPlaceholder("/shapoorji-pallonji-khopoli/").fill("/");
    await w.locator('label:has-text("Agent name") + input').fill("Z");
    await w.getByRole("button", { name: "Add", exact: true }).click();
    await page.getByText(/enter a specific page path/).first().waitFor();
    assert.equal((await fake()).routing.website.routes.length, 1);
  });

  await step("facebook: pick a project, then the existing agent by name (no code typed again)", async () => {
    await tog("facebook").click();
    await page.waitForFunction(() => window.__fake.routing.facebook.enabled === true);
    const f = src("facebook");
    await pick(f, "Choose a project", "SP Khopoli");
    await pick(f, "Choose an agent…", "Siya KHOPOLI");
    await f.getByRole("button", { name: "Add", exact: true }).click();
    await page.waitForFunction(() => window.__fake.routing.facebook.routes.length === 1);
    assert.equal((await fake()).routing.facebook.routes[0].agentId, "agent_khopoli");
  });

  await step("whatsapp: an ad rule and a project rule; changing a row's agent by name, 'No agent' marks it Won't call", async () => {
    await tog("whatsapp").click();
    await page.waitForFunction(() => window.__fake.routing.whatsapp.enabled === true);
    const w = src("whatsapp");
    await pick(w, "A project", "An ad");
    await pick(w, "Choose an ad", "900+ Acre New Launch");
    await pick(w, "Choose an agent…", "Siya KHOPOLI");
    await w.getByRole("button", { name: "Add", exact: true }).click();
    await page.waitForFunction(() => window.__fake.routing.whatsapp.routes.length === 1);
    await pick(w, "Choose a project", "Treetopia");
    await pick(w, "Choose an agent…", "Siya KHOPOLI");
    await w.getByRole("button", { name: "Add", exact: true }).click();
    await page.waitForFunction(() => window.__fake.routing.whatsapp.routes.length === 2);
    const row = w.locator('[data-testid="route-row"]').nth(1);
    await row.getByRole("button", { name: "Siya KHOPOLI" }).click();
    await page.getByRole("button", { name: "No agent - won't call", exact: true }).click();
    await page.waitForFunction(() => window.__fake.routing.whatsapp.routes.some((r) => !r.agentId));
    await row.getByText("Won't call", { exact: true }).waitFor();
  });

  await step("step 4: the preview says in plain words exactly who will call what, and what will not be called", async () => {
    const p = await root.locator('[data-testid="preview"]').innerText();
    assert.match(p, /Every new lead from now on .*contact\. Existing leads are never sent or called/);
    assert.match(p, /for a page whose address contains “\/shapoorji-pallonji-khopoli\/” \(SP Khopoli\) → called by Siya KHOPOLI/);
    assert.match(p, /Facebook leads:[\s\S]*for project “SP Khopoli” → called by Siya KHOPOLI/);
    assert.match(p, /any other Facebook lead → added as a contact, not called/);
    assert.doesNotMatch(p, /Treetopia/, "a rule with no agent is not listed as a call");
    assert.doesNotMatch(p, NOJARGON);
    await page.screenshot({ path: path.join(here, "02-preview.png"), fullPage: true });
  });

  await step("switching on asks first, in plain words, with a non-destructive button; Cancel leaves it off", async () => {
    await root.getByRole("button", { name: /Switch on…/ }).click();
    const d = page.getByRole("dialog");
    await d.waitFor();
    assert.match(await d.innerText(), /Only the sources you chose.*Leads that already exist are never sent or called/s);
    assert.equal(await d.getByRole("button", { name: "Delete" }).count(), 0);
    await d.getByRole("button", { name: "Cancel" }).click();
    assert.equal((await fake()).enabled, false);
    await root.getByRole("button", { name: /Switch on…/ }).click();
    await confirmWith("Yes, switch on");
    await root.getByText(/Live since/).waitFor();
    assert.equal((await fake()).enabled, true);
  });

  await step("once live, turning another source on asks for confirmation; turning one off does not", async () => {
    await tog("website").click();
    await page.waitForFunction(() => window.__fake.routing.website.enabled === false);
    assert.equal(await page.getByRole("dialog").count(), 0);
    await tog("website").click();
    const d = page.getByRole("dialog"); await d.waitFor();
    assert.match(await d.innerText(), /never called/);
    assert.equal((await fake()).routing.website.enabled, false, "not on until confirmed");
    await d.getByRole("button", { name: "Cancel" }).click();
    assert.equal((await fake()).routing.website.enabled, false);
    await tog("website").click(); await confirmWith("Yes, start calling");
    await page.waitForFunction(() => window.__fake.routing.website.enabled === true);
  });

  await step("Technical details are collapsed by default; opening shows address, header mode, checker, activity", async () => {
    assert.equal(await root.locator('[data-testid="adv-body"]').count(), 0);
    await root.locator(`[data-testid="adv-toggle"]`).click();
    const t = await root.locator('[data-testid="adv-body"]').innerText();
    assert.match(t, /Vistrow web address/); assert.match(t, /Check a lead/); assert.match(t, /Last 24 hours/);
    assert.match(t, /Call\s*→\s*Siya KHOPOLI/); assert.match(t, /Contact only - Source is off/); assert.match(t, /reached Vistrow in 1\.9s/);
  });

  await step("'Check settings' sends nothing and hides the key; 'Check a lead' answers who would call, and why not", async () => {
    await root.getByRole("button", { name: "Check settings (sends nothing)" }).click();
    await root.getByText("Settings look valid. Nothing was sent.").waitFor();
    await root.getByText("Show the request that would be sent").click();
    const t = await root.innerText();
    assert.ok(t.includes("[REDACTED]") && !t.includes("a-very-secret-key"));
    const c = root.locator('[data-testid="check-result"]');
    const chk = root.getByRole("button", { name: "Check", exact: true });
    await root.getByPlaceholder("https://yoursite.com/shapoorji-pallonji-khopoli/").fill("https://x.com/shapoorji-pallonji-khopoli/?utm=1");
    await chk.click(); await c.waitFor();
    assert.match(await c.innerText(), /Would be called by Siya KHOPOLI/);
    await root.getByPlaceholder("https://yoursite.com/shapoorji-pallonji-khopoli/").fill("https://x.com/about-us/");
    await chk.click();
    await page.waitForFunction(() => /contact only/i.test(document.querySelector('[data-testid="check-result"]').innerText));
    assert.match(await c.innerText(), /No matching rule/);
  });

  await step("changing the account while live switches sending off and says so", async () => {
    await root.locator('label:has-text("Vistrow account number") + input').fill("acct_999");
    await root.getByRole("button", { name: "Save changes" }).click();
    await page.getByText(/Sending was switched off because the connection changed/).waitFor();
    assert.equal((await fake()).enabled, false);
  });

  await page.screenshot({ path: path.join(here, "03-final.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 900 });
  await page.screenshot({ path: path.join(here, "04-mobile.png"), fullPage: true });
  const styled = require("fs").existsSync(path.join(here, "app.css"));
  const overflow = styled && await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  console.log(overflow ? "  FAIL  no horizontal scroll at phone width" : "  ok    no horizontal scroll at phone width");
  if (overflow) problems.push("overflow");

  console.log(problems.length ? `\n${problems.length} problem(s):\n - ${problems.join("\n - ")}` : "\nbrowser flow passed with no console errors");
  await browser.close();
  process.exit(problems.length ? 1 : 0);
})();
