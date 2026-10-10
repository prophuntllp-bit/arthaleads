import { useFormValue } from "sanity";

// Live SEO score for a blog post, shown at the top of the SEO tab. It never
// writes anything; it reads the whole document and re-scores on every edit.
// Mirrors the checklist used in the Vistrow studio. Weights add up to 100.
// Plain elements on the Studio's CSS colour variables, not @sanity/ui: the
// hosted studio auto-updates its runtime, and a second bundled copy of
// @sanity/ui loses the theme (spacing collapses and text overlaps).
const SITE = "https://www.arthaleads.com/blog/";

const norm = (s) => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
const slugify = (s) => norm(s).replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-");

function bodyText(body) {
  const parts = [];
  const headings = [];
  for (const b of body || []) {
    if (b?._type !== "block") continue;
    const text = (b.children || []).map((c) => c.text || "").join("");
    if (/^h[1-6]$/.test(b.style || "")) headings.push(text);
    parts.push(text);
  }
  return { text: parts.join(" "), headings };
}

function countPhrase(text, phrase) {
  if (!phrase) return 0;
  const esc = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s+");
  return (text.match(new RegExp(`(^|[^a-z0-9])${esc}(?=$|[^a-z0-9])`, "gi")) || []).length;
}

export function analyse(doc) {
  const kw = norm(doc?.focusKeyword);
  const title = doc?.title || "";
  const seoTitle = doc?.metaTitle || title;
  const seoDesc = doc?.metaDescription || doc?.excerpt || "";
  const slug = doc?.slug?.current || "";
  const { text, headings } = bodyText(doc?.body);
  const words = text.split(/\s+/).filter(Boolean).length;
  const kwWords = kw ? kw.split(" ").length : 0;
  const density = words && kw ? (countPhrase(text, kw) * kwWords * 100) / words : 0;
  const has = (s) => !!kw && norm(s).includes(kw);
  const canonical = String(doc?.canonicalUrl || "").trim();

  const checks = [
    { label: "Focus keyword selected", pass: !!kw, weight: 10 },
    { label: "Keyword appears in article title", pass: has(title), weight: 10 },
    { label: "Keyword appears in SEO title", pass: has(seoTitle), weight: 10 },
    { label: "Keyword appears in SEO description", pass: has(seoDesc), weight: 8 },
    { label: "Keyword appears in URL slug", pass: !!kw && slug.includes(slugify(kw)), weight: 8 },
    { label: "SEO title is 30 to 60 characters", pass: seoTitle.length >= 30 && seoTitle.length <= 60, weight: 8 },
    { label: "SEO description is 120 to 160 characters", pass: seoDesc.length >= 120 && seoDesc.length <= 160, weight: 8 },
    { label: "Article contains at least 300 words", pass: words >= 300, weight: 10 },
    { label: "Article uses descriptive subheadings", pass: headings.filter((h) => h.trim().split(/\s+/).length >= 3).length >= 2, weight: 8 },
    { label: "Social title, description, and image added", pass: !!(doc?.openGraphTitle && doc?.openGraphDescription && doc?.openGraphImage?.asset), weight: 5 },
    { label: "Canonical URL is blank or secure", pass: !canonical || canonical.startsWith("https://"), weight: 5 },
    { label: "Keyword density is between 0.5% and 2.5%", pass: density >= 0.5 && density <= 2.5, weight: 10 },
  ];
  const score = checks.reduce((s, c) => s + (c.pass ? c.weight : 0), 0);
  return { checks, score, words, density, seoTitle, seoDesc, slug };
}

const C = {
  fg: "var(--card-fg-color, #e6e8ec)",
  muted: "var(--card-muted-fg-color, #9aa1ad)",
  border: "var(--card-border-color, rgba(255,255,255,0.12))",
};
const TONES = {
  positive: { fg: "#3ecf8e", bg: "rgba(62,207,142,0.12)", border: "rgba(62,207,142,0.45)" },
  caution:  { fg: "#f5b544", bg: "rgba(245,181,68,0.12)", border: "rgba(245,181,68,0.45)" },
  critical: { fg: "#f2685c", bg: "rgba(242,104,92,0.12)", border: "rgba(242,104,92,0.45)" },
  default:  { fg: C.muted, bg: "rgba(127,127,127,0.12)", border: C.border },
};
const box = (extra) => ({ border: `1px solid ${C.border}`, borderRadius: 8, padding: 16, ...extra });
const Pill = ({ tone = "default", big, children }) => {
  const t = TONES[tone];
  return (
    <span style={{ display: "inline-block", whiteSpace: "nowrap", color: t.fg, background: t.bg, borderRadius: 4,
      padding: big ? "8px 12px" : "2px 6px", fontSize: big ? 16 : 12, fontWeight: 600, lineHeight: 1.3 }}>{children}</span>
  );
};

export function SeoAudit() {
  const doc = useFormValue([]);
  const { checks, score, words, density, seoTitle, seoDesc, slug } = analyse(doc);
  const tone = score >= 80 ? "positive" : score >= 50 ? "caution" : "critical";
  const t = TONES[tone];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, color: C.fg, fontSize: 14, lineHeight: 1.45 }}>
      <div style={box({ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, background: t.bg, borderColor: t.border })}>
        <div>
          <div style={{ fontWeight: 600, color: t.fg }}>SEO score</div>
          <div style={{ fontSize: 13, color: t.fg, opacity: 0.85, marginTop: 4 }}>{words} words · {density.toFixed(1)}% keyword density</div>
        </div>
        <Pill tone={tone} big>{score}/100</Pill>
      </div>

      <div style={box({ display: "flex", flexDirection: "column", gap: 6 })}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>Google preview</div>
        <div style={{ fontSize: 13, color: "#3ecf8e", wordBreak: "break-all" }}>{SITE}{slug || "your-post-url"}</div>
        <div style={{ fontSize: 19, color: "#6ea8fe", lineHeight: 1.3 }}>{seoTitle || "Your SEO title"}</div>
        <div style={{ fontSize: 13, color: C.muted }}>{seoDesc || "Your SEO description appears here."}</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
          <Pill tone={seoTitle.length > 60 ? "caution" : "default"}>{seoTitle.length}/60 title characters</Pill>
          <Pill tone={seoDesc.length > 160 ? "caution" : "default"}>{seoDesc.length}/160 description characters</Pill>
        </div>
      </div>

      <div>
        <div style={{ fontWeight: 600, marginBottom: 10 }}>SEO checklist</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 8 }}>
          {checks.map((c) => (
            <div key={c.label} style={box({ padding: 12, display: "flex", gap: 10, alignItems: "flex-start" })}>
              <Pill tone={c.pass ? "positive" : "critical"}>{c.pass ? "Pass" : "Fix"}</Pill>
              <span style={{ fontSize: 13 }}>{c.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
