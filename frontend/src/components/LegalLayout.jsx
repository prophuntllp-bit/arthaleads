// components/LegalLayout.jsx - shared layout of the legal pages (Privacy, Terms,
// Refund, Cookie Policy, Delete Account), on the shared marketing theme.
// `badge` shows as the eyebrow (no pills on the site). The "On this page" list
// is read from the <Section title> children, so it is in the prerendered HTML:
// a sticky sidebar from 1024px, a collapsible list above the text below that.
// Layout only: the wording of the legal text lives in the page files and is
// never changed here (UI audit 31 Oct 2026).
import { Children, isValidElement, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { SitePage, Section as SiteSection, Container } from "./site/Site";
import { PageHero } from "./site/Blocks";

const slug = (t) => String(t).toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function TocList({ toc }) {
  return (
    <ol className="text-sm border-l" style={{ borderColor: "var(--site-line)" }}>
      {toc.map((t) => (
        <li key={t.id}>
          <a href={`#${t.id}`} className="legal-toc flex items-center min-h-[40px] py-1.5 pl-4 -ml-px border-l-2 border-transparent leading-snug">{t.label}</a>
        </li>
      ))}
    </ol>
  );
}

export default function LegalLayout({ title, badge, updated, children }) {
  useEffect(() => { window.scrollTo(0, 0); }, []);

  const toc = Children.toArray(children)
    .filter((c) => isValidElement(c) && c.type === Section && c.props.title)
    .map((c) => ({ id: slug(c.props.title), label: c.props.title }));
  const withToc = toc.length > 3;

  return (
    <SitePage>
      <PageHero eyebrow={badge} title={title} lede={`Last updated: ${updated}`} actions={null} trust={false} />
      <SiteSection tone="tint" className="!pt-10 sm:!pt-14">
        <Container className={withToc ? "lg:grid lg:grid-cols-[240px_minmax(0,720px)] lg:justify-center lg:gap-16 lg:items-start" : ""}>
          {withToc && (
            <>
              <nav aria-label="On this page" className="hidden lg:block sticky top-28 max-h-[calc(100vh-8rem)] overflow-y-auto pr-2">
                <p className="site-h4 !mb-3">On this page</p>
                <TocList toc={toc} />
              </nav>
              <details className="lg:hidden site-card mx-auto max-w-[720px] mb-10 group">
                <summary className="flex items-center justify-between gap-3 min-h-[52px] px-5 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                  <span className="site-h4">On this page</span>
                  <ChevronDown className="w-5 h-5 site-muted transition-transform group-open:rotate-180" aria-hidden="true" />
                </summary>
                <nav aria-label="On this page" className="px-5 pb-4">
                  <TocList toc={toc} />
                </nav>
              </details>
            </>
          )}
          <article className="legal-body min-w-0 mx-auto lg:mx-0 max-w-[720px] text-[15px] sm:text-base">
            {children}
          </article>
        </Container>
      </SiteSection>
    </SitePage>
  );
}

export function Section({ title, children }) {
  return (
    <section className="pt-9 mt-9 first:pt-0 first:mt-0 border-t first:border-t-0" style={{ borderColor: "var(--site-line)" }}>
      <h2 id={slug(title)} className="site-h3 !mb-4 scroll-mt-28">{title}</h2>
      <div className="leading-[1.75] space-y-4">{children}</div>
    </section>
  );
}

export function ContactBox({ children }) {
  return (
    <div className="rounded-2xl p-5 text-[15px] leading-relaxed" style={{ background: "rgba(255,107,0,0.07)", border: "1px solid rgba(255,107,0,0.22)" }}>
      {children}
    </div>
  );
}
