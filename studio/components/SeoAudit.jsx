import { Badge, Box, Card, Flex, Grid, Stack, Text } from "@sanity/ui";
import { useFormValue } from "sanity";

// Live SEO score for a blog post, shown at the top of the SEO tab. It never
// writes anything; it reads the whole document and re-scores on every edit.
// Mirrors the checklist used in the Vistrow studio. Weights add up to 100.
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

export function SeoAudit() {
  const doc = useFormValue([]);
  const { checks, score, words, density, seoTitle, seoDesc, slug } = analyse(doc);
  const tone = score >= 80 ? "positive" : score >= 50 ? "caution" : "critical";

  return (
    <Stack space={4}>
      <Card padding={4} radius={3} tone={tone} border>
        <Flex align="center" justify="space-between" gap={3}>
          <Stack space={2}>
            <Text weight="semibold">SEO score</Text>
            <Text size={1} muted>{words} words · {density.toFixed(1)}% keyword density</Text>
          </Stack>
          <Badge tone={tone} padding={3} fontSize={2}>{score}/100</Badge>
        </Flex>
      </Card>

      <Card padding={4} radius={3} border>
        <Stack space={3}>
          <Text weight="semibold">Google preview</Text>
          <Text size={1} style={{ color: "#1e8e3e", wordBreak: "break-all" }}>{SITE}{slug || "your-post-url"}</Text>
          <Text size={3} style={{ color: "#4c8bf5" }}>{seoTitle || "Your SEO title"}</Text>
          <Text size={1} muted>{seoDesc || "Your SEO description appears here."}</Text>
          <Flex gap={2} wrap="wrap">
            <Badge tone={seoTitle.length > 60 ? "caution" : "default"}>{seoTitle.length}/60 title characters</Badge>
            <Badge tone={seoDesc.length > 160 ? "caution" : "default"}>{seoDesc.length}/160 description characters</Badge>
          </Flex>
        </Stack>
      </Card>

      <Stack space={3}>
        <Text weight="semibold">SEO checklist</Text>
        <Grid columns={[1, 1, 2]} gap={2}>
          {checks.map((c) => (
            <Card key={c.label} padding={3} radius={2} border>
              <Flex gap={3} align="flex-start">
                <Badge tone={c.pass ? "positive" : "critical"}>{c.pass ? "Pass" : "Fix"}</Badge>
                <Box flex={1}><Text size={1}>{c.label}</Text></Box>
              </Flex>
            </Card>
          ))}
        </Grid>
      </Stack>
    </Stack>
  );
}
