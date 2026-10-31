// pages/AboutUs.jsx - /about-us on the shared marketing theme (components/site/*).
// Product facts only: no customer counts, ratings or outcomes until they are
// real and checkable (owner rule).
import { ArrowRight, Zap, Heart, Shield, MapPin, Users, BarChart3, Layers, Building2 } from "lucide-react";
import { SitePage, Section, Container, SectionHeader, Card, SiteButton } from "../components/site/Site";
import { PageHero, PhotoVisual, ClosingCta } from "../components/site/Blocks";
import { WhatsAppLogo } from "../components/site/BrandLogos";
import { Reveal, CountUp } from "../components/motion/Motion";
import { useSEO } from "../utils/useSEO";

const STATS = [
  // Product facts only. No customer counts until they are real and checkable.
  { num: "14", suffix: "-day", label: "Free trial" },
  { num: "4",  suffix: "",     label: "AI reply languages" },
  { num: "8",  suffix: "",     label: "Form integrations" },
  { num: "24", suffix: "/7",   label: "WhatsApp AI replies" },
];

const VALUES = [
  { icon: Zap,    title: "Speed",      desc: "Every lead captured instantly, every follow-up reminder on time." },
  { icon: Heart,  title: "Simplicity", desc: "Simple enough for a telecaller to use on day one." },
  { icon: Shield, title: "Support",    desc: "Real people who know real estate, on WhatsApp when you need them." },
];

const STORY_POINTS = [
  { icon: Layers,   text: "Every lead source in one inbox: Meta ads, Google, WhatsApp, website forms and portal imports." },
  { icon: Users,    text: "Duplicate prevention so your team never wastes a call." },
  { icon: Shield,   text: "Role-based access for telecallers, managers and admins." },
  { icon: BarChart3,text: "Real-time dashboards for property sales campaigns." },
];

const iconTile = { background: "rgba(255,107,0,0.10)", boxShadow: "inset 0 0 0 1px rgba(255,107,0,0.22)" };

export default function AboutUs() {
  useSEO({
    title: "About Arthaleads: Real Estate CRM Made in Pune, India",
    description: "Arthaleads is a real estate CRM made in Pune by Prophunt LLP for builders, brokers and channel partners. Who we are, what we build and how to reach us.",
    canonical: "https://www.arthaleads.com/about-us",
  });

  return (
    <SitePage>
      <PageHero
        eyebrow="About us"
        title={<>Built for real estate. <span className="site-dim">Built for India.</span></>}
        lede="Every Indian real estate team knows the problem: leads slipping through WhatsApp groups, Facebook campaigns and forgotten spreadsheets. We built the fix."
        actions={[
          { label: "Read our story", href: "#story" },
          { label: "Work with us", to: "/careers" },
        ]}
        visual={
          <PhotoVisual name="partner" alt="A real estate sales team working through their leads together in the office"
            cards={[
              { Icon: MapPin, title: "Made in Pune", sub: "Maharashtra, India" },
              { Icon: Building2, title: "By Prophunt LLP", sub: "The company behind Arthaleads" },
              { Icon: WhatsAppLogo, iconColor: "#25D366", iconBg: "rgba(37,211,102,0.12)", title: "Support on WhatsApp", sub: "From real people" },
            ]} />
        }
      />

      {/* Product facts */}
      <Section tone="tint" className="!py-12 sm:!py-14">
        <Container>
          <ul className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {STATS.map(({ num, suffix, label }, i) => (
              <Reveal as="li" key={label} delay={i * 80} className="min-w-0">
                <Card glow className="h-full p-5 sm:p-6 text-center">
                  <p className="font-display text-[34px] sm:text-[42px] leading-none font-extrabold site-dim"><CountUp value={num} />{suffix}</p>
                  <p className="mt-2.5 text-[13px] site-muted font-medium">{label}</p>
                </Card>
              </Reveal>
            ))}
          </ul>
        </Container>
      </Section>

      {/* Our story */}
      <Section tone="white" id="story">
        <Container className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          <Reveal className="min-w-0">
            <SectionHeader eyebrow="Our story" title={<>Why we built <span className="site-dim">Arthaleads</span></>} className="!mb-6" />
            <div className="space-y-4 text-base sm:text-[17px] leading-relaxed">
              <p>Indian real estate teams take leads from ads, WhatsApp, walk-ins and portals at once, then manage them across six tabs, three WhatsApp groups and an Excel sheet nobody trusts. Hot leads go cold and the same buyer gets called three times.</p>
              <p className="site-ink">Prophunt LLP started Arthaleads in Pune in 2025: one workspace where every enquiry lands, gets assigned, called and tracked to a closed deal.</p>
            </div>
          </Reveal>
          <ul className="grid gap-3 min-w-0">
            {STORY_POINTS.map(({ icon: Icon, text }, i) => (
              <Reveal as="li" key={text} delay={120 + i * 90}>
                <Card glow className="flex items-start gap-4 p-5">
                  <span className="site-icon w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={iconTile}>
                    <Icon className="w-[18px] h-[18px]" style={{ color: "var(--site-brand-ink)" }} aria-hidden="true" />
                  </span>
                  <p className="text-[15px] leading-relaxed site-ink pt-1.5">{text}</p>
                </Card>
              </Reveal>
            ))}
          </ul>
        </Container>
      </Section>

      {/* Mission */}
      <Section tone="dark" className="overflow-hidden">
        <div aria-hidden="true" className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(50% 60% at 50% 40%, rgba(255,107,0,0.18), transparent 70%)" }} />
        <Container className="relative text-center">
          <Reveal className="max-w-3xl mx-auto">
            <h2 className="site-h2">
              Turn every property enquiry <span className="site-dim">into a closed deal.</span>
            </h2>
            <p className="mt-6 text-base sm:text-lg leading-relaxed max-w-2xl mx-auto" style={{ color: "rgba(255,255,255,0.72)" }}>
              The gap between a sale and a missed one is usually a timely follow-up. Arthaleads makes sure it never gets missed.
            </p>
          </Reveal>
        </Container>
      </Section>

      {/* Values (tint: the closing CTA after it is white) */}
      <Section tone="tint">
        <Container>
          <SectionHeader eyebrow="What we stand for" title="Three values we never compromise" />
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {VALUES.map(({ icon: Icon, title, desc }, i) => (
              <Reveal key={title} delay={i * 110} className="min-w-0 flex">
                <Card glow className="w-full p-6 sm:p-7">
                  <span className="site-icon w-12 h-12 rounded-xl flex items-center justify-center mb-5" style={iconTile}>
                    <Icon className="w-[22px] h-[22px]" style={{ color: "var(--site-brand-ink)" }} aria-hidden="true" />
                  </span>
                  <h3 className="site-h3 !mb-2">{title}</h3>
                  <p className="text-[15px] leading-relaxed">{desc}</p>
                </Card>
              </Reveal>
            ))}
          </div>

          {/* The company */}
          <Reveal>
            <Card raised className="mt-6 p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
              <div className="min-w-0">
                <h3 className="site-h4 !mb-2">The company</h3>
                <p className="text-[15px] leading-relaxed max-w-2xl">
                  Arthaleads is built and run by <strong className="site-ink">Prophunt LLP</strong>, a limited liability partnership in Baner, Pune, supporting every customer from Pune since 2025.
                </p>
              </div>
              <SiteButton to="/contact" variant="secondary" className="shrink-0">Contact us <ArrowRight className="w-4 h-4" /></SiteButton>
            </Card>
          </Reveal>
        </Container>
      </Section>

      <ClosingCta title="Start managing leads" dim="the smarter way."
        body="No spreadsheets and no missed follow-ups: your whole team working from one place. Book a 30-minute demo on your own leads, or start the 14-day free trial yourself." />
    </SitePage>
  );
}
