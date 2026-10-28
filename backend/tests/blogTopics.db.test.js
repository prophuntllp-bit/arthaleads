// Blog topics and article blocks (28 Oct 2026): the Sanity sync files posts
// under the topics in config/blogCategories.js (older names land in the topic
// that replaced them), copies key takeaways, FAQs, tables, step cards and
// checklists; the public API lists topics with counts in tab order and filters
// posts by topic slug; the sitemap lists each topic page that has an article.
process.env.NODE_ENV = "test";
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { test, run, assert } = require("./helpers/harness");

let sync, toBlocks, ctrl, BlogPost, BlogCategory;

const doc = (id, slug, category, extra = {}) => ({
  _id: id, _updatedAt: "2026-10-28T10:00:00Z", title: `Post ${slug}`, slug, excerpt: "An excerpt long enough for the blog.",
  category, publishedAt: "2026-10-20T06:30:00Z", body: [{ _type: "block", _key: "p1", style: "normal", children: [{ _type: "span", text: "Hello world" }] }],
  ...extra,
});
let sanityDocs = [];
const call = (fn, req) => new Promise((resolve, reject) => {
  const res = { body: null, headers: {}, json(b) { this.body = b; resolve(this); }, setHeader(k, v) { this.headers[k] = v; }, send(b) { this.body = b; resolve(this); } };
  fn(req, res, (err) => (err ? reject(err) : resolve(res)));
});

test("toBlocks reads tables, step cards and checklists", async () => {
  const blocks = toBlocks([
    { _type: "table", _key: "t", caption: "Phone formats", rows: [{ cells: ["Arrives as", "Normalised"] }, { cells: ["098xxx", "9198xxx"] }, { cells: ["", ""] }] },
    { _type: "steps", _key: "s", items: [{ title: "Normalise", text: "Country code first." }, { title: "", text: "dropped" }] },
    { _type: "block", _key: "c1", listItem: "check", children: [{ _type: "span", text: "Import sheets" }] },
    { _type: "block", _key: "c2", listItem: "check", children: [{ _type: "span", text: "Review flags" }] },
  ]);
  assert.deepEqual(blocks.map((b) => b.type), ["table", "steps", "checklist"]);
  assert.deepEqual(blocks[0].rows, [["Arrives as", "Normalised"], ["098xxx", "9198xxx"]], "empty rows are dropped");
  assert.equal(blocks[0].caption, "Phone formats");
  assert.deepEqual(blocks[1].steps, [{ title: "Normalise", text: "Country code first." }]);
  assert.deepEqual(blocks[2].items, ["Import sheets", "Review flags"]);
});

test("sync files posts under topics, copies takeaways and FAQs", async () => {
  sanityDocs = [
    doc("a", "crm-guide", "Real Estate CRM", { keyTakeaways: ["One", " ", "Two"], faqs: [{ question: "Q1?", answer: "A1." }, { question: "", answer: "no question" }] }),
    doc("b", "old-name", "WhatsApp Marketing"),
    doc("c", "lead-mgmt", "Lead Management & Follow-ups"),
  ];
  await sync();
  const topics = await BlogCategory.find().lean();
  assert.ok(topics.length >= 8, "every topic exists after a sync");
  const crm = await BlogPost.findOne({ slug: "crm-guide" }).populate("category").lean();
  assert.equal(crm.category.slug, "real-estate-crm");
  assert.deepEqual(crm.keyTakeaways, ["One", "Two"]);
  assert.deepEqual(crm.faqs.map((f) => f.question), ["Q1?"], "an FAQ without a question is dropped");
  const old = await BlogPost.findOne({ slug: "old-name" }).populate("category").lean();
  assert.equal(old.category.slug, "whatsapp", "an older topic name lands in the topic that replaced it");
  const lm = await BlogPost.findOne({ slug: "lead-mgmt" }).populate("category").lean();
  assert.equal(lm.category.slug, "lead-management");
});

test("topics list in tab order with counts; posts filter by topic slug", async () => {
  const all = (await call(ctrl.getCategories, { query: {} })).body.categories;
  assert.equal(all[0].slug, "real-estate-crm", "tab order from the config");
  assert.equal(all.find((c) => c.slug === "whatsapp").count, 1);
  assert.equal(all.find((c) => c.slug === "channel-partners").count, 0);
  const inUse = (await call(ctrl.getCategories, { query: { inUse: "1" } })).body.categories;
  assert.deepEqual(inUse.map((c) => c.slug).sort(), ["lead-management", "real-estate-crm", "whatsapp"]);
  const bySlug = (await call(ctrl.getPosts, { query: { category: "lead-management" } })).body;
  assert.deepEqual(bySlug.posts.map((p) => p.slug), ["lead-mgmt"]);
  const unknown = (await call(ctrl.getPosts, { query: { category: "no-such-topic" } })).body;
  assert.equal(unknown.total, 0, "an unknown topic shows nothing, not everything");
});

test("a post copied by an older sync is copied again, even if Sanity is unchanged", async () => {
  await BlogPost.updateOne({ slug: "old-name" }, { $set: { sanitySyncVersion: 1, category: null } });
  await sync();
  const old = await BlogPost.findOne({ slug: "old-name" }).populate("category").lean();
  assert.equal(old.category.slug, "whatsapp");
  assert.equal(old.sanitySyncVersion, 2);
});

test("the sitemap lists topic pages that have an article", async () => {
  const xml = (await call(ctrl.getSitemap, { query: {} })).body;
  assert.ok(xml.includes("/blog/category/real-estate-crm</loc>"));
  assert.ok(xml.includes("/blog/category/whatsapp</loc>"));
  assert.ok(!xml.includes("/blog/category/channel-partners"), "empty topics stay out");
});

(async () => {
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  BlogPost = require("../models/BlogPost");
  BlogCategory = require("../models/BlogCategory");
  await Promise.all([BlogPost.init(), BlogCategory.init()]);
  require("../services/indexNow").submit = async () => {};
  global.fetch = async () => ({ ok: true, json: async () => ({ result: sanityDocs }) });
  ({ sync, toBlocks } = require("../services/sanityBlogSync"));
  ctrl = require("../controllers/blogController");
  const origExit = process.exit;
  process.exit = async (code) => { await mongoose.disconnect(); await mongod.stop(); origExit(code); };
  await run("Blog topics and article blocks");
})();
