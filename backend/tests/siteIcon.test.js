// Website connection icons (28 Oct 2026): what the homepage declares, best
// first, without touching the network.
const { test, run, assert } = require("./helpers/harness");
const { iconCandidates } = require("../utils/siteIcon");

const urls = (html, base = "https://example.com/") => iconCandidates(html, base).map((c) => `${c.kind}:${c.url}`);

test("app icon first, then the largest favicon, then /favicon.ico", () => {
  const html = `<link rel="icon" href="/fav-32.png" sizes="32x32"><link rel="icon" href="/fav-192.png" sizes="192x192">
    <link rel="apple-touch-icon" href="/apple.png"><link rel='stylesheet' id='widget-icon-list-css' href='/x.css'>`;
  assert.deepEqual(urls(html), [
    "favicon:https://example.com/apple.png", "favicon:https://example.com/fav-192.png",
    "favicon:https://example.com/fav-32.png", "favicon:https://example.com/favicon.ico",
  ]);
});

test("no favicon: the header's first image is the logo", () => {
  const html = `<header class="site"><a href="/"><img width="280" src="https://cdn.example.com/brand-e17.png" alt=""></a></header><img src="/hero.webp">`;
  assert.deepEqual(urls(html), ["logo:https://cdn.example.com/brand-e17.png", "favicon:https://example.com/favicon.ico"]);
});

test("no favicon or header: an image named after the site", () => {
  const html = `<img src="/uploads/sanctum.png"><img src="/uploads/mahindralifespaces-e17.webp">`;
  assert.deepEqual(urls(html, "https://mahindralife-spaces.com/"), [
    "logo:https://mahindralife-spaces.com/uploads/mahindralifespaces-e17.webp", "favicon:https://mahindralife-spaces.com/favicon.ico",
  ]);
});

test("an image marked as the logo is used", () => {
  const html = `<img class="custom-logo" src="/logo-1.png"><img src="/banner.jpg">`;
  assert.equal(urls(html)[0], "logo:https://example.com/logo-1.png");
});

run("Website connection icons");
