// components/LegalLayout.jsx - shared layout of the legal pages (Privacy, Terms,
// Refund, Cookie Policy, Delete Account), on the shared marketing theme.
// `badge` shows as the eyebrow (no pills on the site). On desktop a sticky
// "On this page" list is built from the section headings after mount, so the
// prerendered HTML stays the plain document.
import { useEffect, useRef, useState } from "react";
import { SitePage, Section as SiteSection, Container, Card } from "./site/Site";
import { PageHero } from "./site/Blocks";

const slug = (t) => String(t).toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export default function LegalLayout({ title, badge, updated, children }) {
  const body = useRef(null);
  const [toc, setToc] = useState([]);

  useEffect(() => {
    window.scrollTo(0, 0);
    const hs = body.current ? [...body.current.querySelectorAll("h2[id]")] : [];
    setToc(hs.map((h) => ({ id: h.id, label: h.textContent })));
  }, []);

  const withToc = toc.length > 3;
  return (
    <SitePage>
      <PageHero eyebrow={badge} title={title} lede={`Last updated: ${updated}`} actions={null} trust={false} />
      <SiteSection tone="tint" className="!pt-12 sm:!pt-16">
        <Container className={withToc ? "grid lg:grid-cols-[240px_1fr] gap-10 items-start" : "!max-w-[880px]"}>
          {withToc && (
            <nav aria-label="On this page" className="hidden lg:block sticky top-28">
              <p className="site-eyebrow mb-4">On this page</p>
              <ol className="space-y-2.5 text-sm border-l" style={{ borderColor: "var(--site-line)" }}>
                {toc.map((t) => (
                  <li key={t.id}>
                    <a href={`#${t.id}`} className="legal-toc block pl-4 -ml-px border-l-2 border-transparent leading-snug">{t.label}</a>
                  </li>
                ))}
              </ol>
            </nav>
          )}
          <Card raised className="legal-body min-w-0 p-6 sm:p-10">
            <div ref={body}>{children}</div>
          </Card>
        </Container>
      </SiteSection>
    </SitePage>
  );
}

export function Section({ title, children }) {
  return (
    <div className="mb-9 last:mb-0">
      <h2 id={slug(title)} className="font-display text-lg sm:text-xl font-bold site-ink mb-3 scroll-mt-28">{title}</h2>
      <div className="text-[15px] leading-[1.75] space-y-3">{children}</div>
    </div>
  );
}

export function ContactBox({ children }) {
  return (
    <div className="rounded-2xl p-5 text-[15px] leading-relaxed" style={{ background: "rgba(255,107,0,0.07)", border: "1px solid rgba(255,107,0,0.22)" }}>
      {children}
    </div>
  );
}
