import { Link } from "react-router-dom";
import { ArrowRight, Check, Mail, MessageCircle } from "lucide-react";
import PublicNav from "../components/PublicNav";
import { useSEO } from "../utils/useSEO";

export default function AboutUs() {
  useSEO({
    title: "About Arthaleads — Real Estate CRM Built for India",
    description: "Arthaleads is India's leading real estate CRM platform built for developers, brokers, and channel partners. Learn our mission to simplify property lead management.",
    canonical: "https://www.arthaleads.com/about-us",
  });

  const values = [
    {
      title: "Speed",
      desc: "Every lead that comes in is captured instantly. Every follow-up reminder fires on time. We build for the urgency of property sales.",
    },
    {
      title: "Simplicity",
      desc: "Sales teams shouldn't need training to use their CRM. Arthaleads is intuitive enough for a telecaller on day one.",
    },
    {
      title: "Support",
      desc: "When your team is in the middle of a campaign and something goes wrong, we're there. Real support from people who understand real estate.",
    },
  ];

  const stats = [
    { val: "500+",  label: "Real Estate Teams" },
    { val: "50,000+", label: "Leads Managed" },
    { val: "8",     label: "Form Integrations" },
    { val: "99.9%", label: "Uptime" },
  ];

  return (
    <div className="min-h-screen bg-[#0d0d1a] text-white" style={{ fontFamily: "Inter, sans-serif" }}>
      <PublicNav />

      {/* Hero */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/3 left-1/4 w-96 h-96 bg-[#ff6b00]/8 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-orange-900/8 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#ff6b00]/30 bg-[#ff6b00]/10 mb-6">
            <span className="text-[#ff6b00] text-xs font-semibold uppercase tracking-wide">About Arthaleads</span>
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-[1.1] mb-6">
            Built for Real Estate.{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff6b00] to-[#ffaa00]">
              Built for India.
            </span>
          </h1>
          <p className="text-lg sm:text-xl text-white/60 leading-relaxed max-w-2xl mx-auto">
            We set out to solve a problem every Indian real estate team knows: leads slipping through the cracks
            across WhatsApp groups, Facebook campaigns, and forgotten spreadsheets.
          </p>
        </div>
      </section>

      {/* Our Story */}
      <section className="py-20 bg-[#080810]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl font-bold text-white mb-6">Our Story</h2>
              <p className="text-white/60 text-base leading-relaxed mb-5">
                Real estate sales teams in India work across multiple channels simultaneously — Facebook lead ads,
                Google campaigns, WhatsApp enquiries, walk-ins, and housing portals — all at once. Before Arthaleads,
                managing this meant juggling six different tabs, three WhatsApp groups, and a shared Excel sheet
                that nobody trusted.
              </p>
              <p className="text-white/60 text-base leading-relaxed mb-5">
                Hot leads would go cold because no one followed up in time. Telecallers would call the same number
                three times from different lists. Managers had no way to see what the team was actually doing.
              </p>
              <p className="text-white/60 text-base leading-relaxed">
                We built Arthaleads to be the single workspace where every property enquiry lands, gets assigned,
                gets called, and gets tracked — from first contact to closed deal.
              </p>
            </div>
            <div className="space-y-4">
              {[
                "Every lead source connected to one inbox — Facebook, Google, WhatsApp, forms, portals.",
                "Duplicate prevention so your team never wastes a call.",
                "Role-based access so telecallers, managers, and admins each see exactly what they need.",
                "Real-time dashboards built for the pace of property sales campaigns.",
              ].map((point) => (
                <div key={point} className="flex items-start gap-3 p-4 rounded-xl bg-white/3 border border-white/6">
                  <div className="flex-shrink-0 w-5 h-5 rounded-full bg-[#ff6b00]/15 flex items-center justify-center mt-0.5">
                    <Check className="w-3 h-3 text-[#ff6b00]" />
                  </div>
                  <p className="text-white/65 text-sm leading-relaxed">{point}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Mission */}
      <section className="py-20 bg-[#0d0d1a]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Our Mission</h2>
          <p className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#ff6b00] to-[#ffaa00] leading-tight">
            Turn every property enquiry into a closed deal.
          </p>
          <p className="text-white/55 text-base leading-relaxed mt-6 max-w-xl mx-auto">
            We believe the difference between a sale and a missed opportunity is usually just one thing: a timely,
            informed follow-up. Arthaleads exists to make sure that follow-up never gets missed.
          </p>
        </div>
      </section>

      {/* Values */}
      <section className="py-20 bg-[#080810]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-white mb-3">What We Stand For</h2>
            <p className="text-white/50 text-base max-w-xl mx-auto">
              Three values that shape every decision we make, every feature we ship, and every customer interaction.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {values.map(({ title, desc }) => (
              <div key={title} className="p-7 rounded-2xl border border-white/8 bg-white/3">
                <div className="text-[#ff6b00] font-black text-3xl mb-4">{title}</div>
                <p className="text-white/60 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-20 bg-[#0d0d1a]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map(({ val, label }) => (
              <div key={label} className="text-center p-6 rounded-2xl border border-white/6 bg-white/2">
                <div className="text-4xl font-black text-[#ff6b00] mb-2">{val}</div>
                <div className="text-white/60 text-sm font-medium">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-[#080810]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">
            Ready to bring your team onto Arthaleads?
          </h2>
          <p className="text-white/50 text-base mb-8">
            Start your free trial — no credit card required. Your team can be up and running today.
          </p>
          <Link to="/signup"
            className="inline-flex items-center gap-2 bg-[#ff6b00] hover:bg-[#e05f00] text-white font-bold px-8 py-4 rounded-2xl transition-all duration-200 shadow-xl shadow-orange-500/30 hover:-translate-y-0.5">
            Start Free Trial
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#080810] border-t border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-white/25 text-sm">© {new Date().getFullYear()} Arthaleads. All rights reserved.</p>
            <div className="flex items-center gap-6 text-sm">
              <Link to="/privacy" className="text-white/35 hover:text-white/70 transition-colors">Privacy Policy</Link>
              <Link to="/terms"   className="text-white/35 hover:text-white/70 transition-colors">Terms of Service</Link>
              <a href="mailto:hello@arthaleads.com" className="text-white/35 hover:text-white/70 transition-colors flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" /> hello@arthaleads.com
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
