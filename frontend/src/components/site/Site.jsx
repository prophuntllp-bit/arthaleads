// components/site/Site.jsx - the shared marketing theme's building blocks.
//
// Every marketing page (and every new one) is built from these so spacing,
// cards, headings and buttons stay identical across the site:
//   <SitePage>       page wrapper: theme colours, nav and footer
//   <Section tone>   "white" | "tint" | "dark"; one padding rhythm for all
//   <Container>      1240px max width with responsive gutters
//   <SectionHeader>  eyebrow (plain text, never a pill) + H2 + lede; left-aligned by default
//   <Card>           contrasts with its section automatically (see styles.css)
//   <SiteButton>     primary / secondary / whatsapp, link or external link
//   <SiteImage>      responsive WebP with width/height (no layout shift)
// Colours live in styles.css as --site-* tokens with a dark-theme set.
import { Link } from "react-router-dom";
import PublicNav from "../PublicNav";
import PublicFooter from "../PublicFooter";
import { Reveal } from "../motion/Motion";

const cx = (...c) => c.filter(Boolean).join(" ");

export function SitePage({ children, className, onScrollTo }) {
  return (
    <div className={cx("site min-h-screen", className)}>
      <PublicNav onScrollTo={onScrollTo} />
      <main>{children}</main>
      <PublicFooter />
    </div>
  );
}

export function Section({ tone = "white", id, className, children, as: Tag = "section", ...rest }) {
  return (
    <Tag id={id} className={cx("site-section", `site-section--${tone}`, id && "scroll-mt-20", className)} {...rest}>
      {children}
    </Tag>
  );
}

export function Container({ className, children, narrow = false }) {
  return <div className={cx("site-container", narrow && "!max-w-[880px]", className)}>{children}</div>;
}

/**
 * Eyebrow + H2 + lede. Pass `action` (a link) to lay the header out as a row
 * with the action on the right, which keeps "see more" links out of a
 * separate block under the content.
 */
export function SectionHeader({ eyebrow, title, lede, align = "left", as: H = "h2", action, className, children }) {
  if (action) {
    return (
      <div className={cx("mb-10 lg:mb-14 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5 lg:gap-10", className)}>
        <SectionHeader eyebrow={eyebrow} title={title} lede={lede} align="left" as={H} className="!mb-0">{children}</SectionHeader>
        <Reveal className="shrink-0 lg:pb-1.5">{action}</Reveal>
      </div>
    );
  }
  const centered = align === "center";
  return (
    <Reveal className={cx("mb-10 lg:mb-14", centered ? "mx-auto text-center max-w-3xl" : "max-w-2xl", className)}>
      {eyebrow && <p className="site-eyebrow mb-4">{eyebrow}</p>}
      <H className="font-display site-ink font-extrabold tracking-[-0.02em] leading-[1.1] text-[30px] sm:text-[38px] lg:text-[44px]"
        style={{ textWrap: "balance" }}>
        {title}
      </H>
      {lede && (
        <p className={cx("mt-5 text-base sm:text-lg leading-relaxed", centered && "mx-auto max-w-2xl")} style={{ textWrap: "pretty" }}>
          {lede}
        </p>
      )}
      {children}
    </Reveal>
  );
}

// Feeds the cursor position to .site-glow so its light follows the pointer.
function trackGlow(e) {
  const r = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
  e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
}

/** `glow` = bento card whose border and fill light up around the cursor and lift on hover. */
export function Card({ as: Tag = "div", raised = false, hover = false, glow = false, className, children, ...rest }) {
  return (
    <Tag className={cx("site-card", raised && "site-card--raised", hover && !glow && "site-card--hover", glow && "site-glow", className)}
      onPointerMove={glow ? trackGlow : undefined} {...rest}>
      {children}
    </Tag>
  );
}

/**
 * One button for the whole site. `to` = internal route, `href` = external or
 * anchor link (opens in a new tab when `external`), otherwise a <button>.
 */
export function SiteButton({ variant = "primary", size, to, href, external = false, className, children, ...rest }) {
  const cls = cx("site-btn", `site-btn--${variant}`, size === "lg" && "site-btn--lg", className);
  if (to) return <Link to={to} className={cls} {...rest}>{children}</Link>;
  if (href) {
    return (
      <a href={href} className={cls} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})} {...rest}>
        {children}
      </a>
    );
  }
  return <button type="button" className={cls} {...rest}>{children}</button>;
}

/**
 * Responsive site photo. Expects pre-sized WebP files named
 * `${name}-640.webp`, `${name}-1024.webp`, `${name}-1600.webp` in
 * /public/img/site (made by scripts in outputs/site-images). `priority`
 * marks the one LCP image per page.
 */
export function SiteImage({ name, alt, width, height, sizes = "100vw", priority = false, className, style }) {
  const base = `/img/site/${name}`;
  return (
    <img
      src={`${base}-1024.webp`}
      srcSet={`${base}-640.webp 640w, ${base}-1024.webp 1024w, ${base}-1600.webp 1600w`}
      sizes={sizes}
      width={width}
      height={height}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      fetchpriority={priority ? "high" : undefined}
      className={className}
      style={style}
    />
  );
}
