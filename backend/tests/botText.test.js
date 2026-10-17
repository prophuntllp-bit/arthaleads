// The WhatsApp bot never sends an em dash or en dash (owner rule), whatever the
// model writes; ranges read "to", other dashes become commas.
const { test, run, assert } = require("./helpers/harness");
const { noDashes } = require("../utils/botText");

test("the real 17 Oct reply comes out with a comma", () => {
  assert.equal(
    noDashes("Hey there! Just checking in—are you interested in the 1BHK apartment or looking for something else?"),
    "Hey there! Just checking in, are you interested in the 1BHK apartment or looking for something else?",
  );
});

test("spaced dashes between words become commas", () => {
  assert.equal(noDashes("Khopoli Plots — near the expressway"), "Khopoli Plots, near the expressway");
  assert.equal(noDashes("Great choice – shall I share the brochure?"), "Great choice, shall I share the brochure?");
});

test("number ranges read 'to'", () => {
  assert.equal(noDashes("Possession in 1–3 months"), "Possession in 1 to 3 months");
  assert.equal(noDashes("Budget ₹45 — ₹60 lakh"), "Budget ₹45 to ₹60 lakh");
  assert.equal(noDashes("2—3 BHK"), "2 to 3 BHK");
});

test("a dash used as a bullet becomes a hyphen; one at a line end disappears", () => {
  assert.equal(noDashes("Options:\n— 1 BHK\n— 2 BHK"), "Options:\n- 1 BHK\n- 2 BHK");
  assert.equal(noDashes("Here you go —\nthe floor plan"), "Here you go\nthe floor plan");
  assert.equal(noDashes("Thanks —."), "Thanks.");
});

test("text without dashes, hyphens and emojis are left exactly as they are", () => {
  for (const t of ["Hi Asha 🙂 shall I share photos?", "Call 98765-43210", "well-connected 2-BHK", "", "Line one\n\nLine two"]) {
    assert.equal(noDashes(t), t);
  }
  assert.equal(noDashes(undefined), "");
});

test("no em or en dash ever survives", () => {
  const nasty = "—Hi— there —— 1–2 – x —\n—— end ––";
  assert.ok(!/[–—]/.test(noDashes(nasty)), noDashes(nasty));
});

run("Bot text: no em or en dashes");
