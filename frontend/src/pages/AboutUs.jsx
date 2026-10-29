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
  { icon: Zap,    title: "Speed",      desc: "Every lead that comes in is captured instantly. Every follow-up reminder fires on time. We build for the urgency of property sales." },
  { icon: Heart,  title: "Simplicity", desc: "Sales teams shouldn't need training to use their CRM. Arthaleads is intuitive enough for a telecaller on day one." },
  { icon: Shield, title: "Support",    desc: "When your team is in the middle of a campaign and something goes wrong, we're there. Real support from people who understand real estate." },
];

const STORY_POINTS = [
  { icon: Layers,   text: "Every lead source in one inbox: Facebook and Instagram ads, Google, WhatsApp and website forms, with portal leads imported." },
  { icon: Users,    text: "Duplicate prevention so your team never wastes a call." },
  { icon: Shield,   text: "Role-based access so telecallers, managers, and admins each see exactly what they need." },
  { icon: BarChart3,text: "Real-time dashboards built for the pace of property sales campaigns." },
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
        lede="We set out to solve a problem every Indian real estate team knows: leads slipping through the cracks across WhatsApp groups, Facebook campaigns, and forgotten spreadsheets."
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
              <p>Real estate sales teams in India work across multiple channels simultaneously: Facebook lead ads, Google campaigns, WhatsApp enquiries, walk-ins, and housing portals, all at once. Before Arthaleads, managing this meant juggling six different tabs, three WhatsApp groups, and a shared Excel sheet that nobody trusted.</p>
              <p>Hot leads would go cold because no one followed up in time. Telecallers would call the same number three times from different lists. Managers had no way to see what the team was actually doing.</p>
              <p className="site-ink">Prophunt LLP started Arthaleads in Pune in 2025 to be the single workspace where every property enquiry lands, gets assigned, gets called, and gets tracked. From first contact to closed deal.</p>
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
            <p className="site-eyebrow mb-5">Our mission</p>
            <h2 className="font-display text-white font-extrabold tracking-[-0.02em] leading-[1.12] text-[32px] sm:text-[44px] lg:text-[52px]" style={{ textWrap: "balance" }}>
              Turn every property enquiry <span className="site-dim">into a closed deal.</span>
            </h2>
            <p className="mt-6 text-base sm:text-lg leading-relaxed max-w-2xl mx-auto" style={{ color: "rgba(255,255,255,0.72)" }}>
              We believe the difference between a sale and a missed opportunity is usually just one thing: a timely, informed follow-up. Arthaleads exists to make sure that follow-up never gets missed.
            </p>
          </Reveal>
        </Container>
      </Section>

      {/* Values */}
      <Section tone="white">
        <Container>
          <SectionHeader eyebrow="What we stand for" title="Three values we never compromise"
            lede="Every decision, every feature, every customer interaction is shaped by these." />
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {VALUES.map(({ icon: Icon, title, desc }, i) => (
              <Reveal key={title} delay={i * 110} className="min-w-0 flex">
                <Card glow className="w-full p-6 sm:p-7">
                  <span className="site-icon w-12 h-12 rounded-xl flex items-center justify-center mb-5" style={iconTile}>
                    <Icon className="w-[22px] h-[22px]" style={{ color: "var(--site-brand-ink)" }} aria-hidden="true" />
                  </span>
                  <h3 className="font-display text-xl font-bold site-ink mb-2">{title}</h3>
                  <p className="text-[15px] leading-relaxed">{desc}</p>
                </Card>
              </Reveal>
            ))}
          </div>

          {/* The company */}
          <Reveal>
            <Card raised className="mt-6 p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
              <div className="min-w-0">
                <p className="site-eyebrow mb-2">The company</p>
                <p className="text-[15px] leading-relaxed max-w-2xl">
                  Arthaleads is built and run by <strong className="site-ink">Prophunt LLP</strong>, a limited liability partnership based in Baner, Pune. We started building Arthaleads in 2025 and support every customer from Pune.
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
