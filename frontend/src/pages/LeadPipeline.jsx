import { useMemo } from "react";
import toast from "react-hot-toast";
import { ArrowLeftRight, CheckCircle2, Clock3, MapPinned, PhoneCall, Trophy, XCircle } from "lucide-react";
import api from "../services/api";
import { useLeads } from "../hooks/useLeads";
import { STATUS_OPTIONS } from "../utils/constants";

const STAGE_META = {
  "New": {
    title: "New",
    subtitle: "Fresh enquiries to contact first",
    icon: Clock3,
    stripe: "from-sky-500/25 via-sky-500/10 to-transparent",
    badge: "bg-sky-500/15 text-sky-300",
    border: "border-sky-500/20",
  },
  "Contacted": {
    title: "Contacted",
    subtitle: "Initial call or message completed",
    icon: PhoneCall,
    stripe: "from-amber-500/25 via-amber-500/10 to-transparent",
    badge: "bg-amber-500/15 text-amber-300",
    border: "border-amber-500/20",
  },
  "Site Visit": {
    title: "Site Visit",
    subtitle: "Visits scheduled or done",
    icon: MapPinned,
    stripe: "from-violet-500/25 via-violet-500/10 to-transparent",
    badge: "bg-violet-500/15 text-violet-300",
    border: "border-violet-500/20",
  },
  "Negotiation": {
    title: "Negotiation",
    subtitle: "Commercial discussion in progress",
    icon: ArrowLeftRight,
    stripe: "from-orange-500/25 via-orange-500/10 to-transparent",
    badge: "bg-orange-500/15 text-orange-300",
    border: "border-orange-500/20",
  },
  "Closed Won": {
    title: "Closed Won",
    subtitle: "Successful conversions",
    icon: Trophy,
    stripe: "from-emerald-500/25 via-emerald-500/10 to-transparent",
    badge: "bg-emerald-500/15 text-emerald-300",
    border: "border-emerald-500/20",
  },
  "Closed Lost": {
    title: "Closed Lost",
    subtitle: "Dropped or unqualified leads",
    icon: XCircle,
    stripe: "from-rose-500/25 via-rose-500/10 to-transparent",
    badge: "bg-rose-500/15 text-rose-300",
    border: "border-rose-500/20",
  },
};

export default function LeadPipeline() {
  const { leads, loading, upsertLead } = useLeads();

  const grouped = useMemo(() => {
    return STATUS_OPTIONS.reduce((acc, status) => {
      acc[status] = leads.filter((lead) => lead.status === status);
      return acc;
    }, {});
  }, [leads]);

  const handleMove = async (lead, nextStatus) => {
    if (lead.status === nextStatus) return;
    try {
      const { data } = await api.put(`/leads/${lead._id}`, { status: nextStatus });
      upsertLead(data.data);
      toast.success(`Moved to ${nextStatus}`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to move lead");
    }
  };

  return (
    <div className="stitch-page space-y-6">
      <section className="card p-6">
        <p className="stitch-kicker mb-2">Pipeline View</p>
        <h1 className="text-3xl font-black tracking-tight text-app">Lead Pipeline</h1>
        <p className="mt-2 max-w-2xl text-sm text-app-soft">
          Each stage is color-coded so your team can instantly understand what needs outreach, visits, negotiation, or closure.
        </p>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {STATUS_OPTIONS.map((status) => {
          const meta = STAGE_META[status];
          const Icon = meta.icon;
          const stageLeads = grouped[status] || [];
          return (
            <div key={status} className={`card overflow-hidden border ${meta.border}`}>
              <div className={`bg-gradient-to-br ${meta.stripe} px-5 py-5`}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="mb-3 flex items-center gap-3">
                      <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${meta.badge}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <span className={`badge ${meta.badge}`}>{stageLeads.length} leads</span>
                    </div>
                    <h2 className="text-xl font-bold text-app">{meta.title}</h2>
                    <p className="mt-1 text-sm text-app-soft">{meta.subtitle}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3 p-4">
                {stageLeads.length === 0 && (
                  <div className="rounded-2xl border border-dashed p-4 text-sm text-app-soft" style={{ borderColor: "var(--app-border)" }}>
                    No leads in {status.toLowerCase()} right now.
                  </div>
                )}

                {stageLeads.map((lead) => (
                  <article key={lead._id} className="rounded-[1.25rem] border p-4 stitch-surface-muted space-y-3" style={{ borderColor: "var(--app-border)" }}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-app">{lead.name}</p>
                        <p className="mt-1 text-xs text-app-soft">{lead.phone} • {lead.source}</p>
                      </div>
                      <CheckCircle2 className="h-4 w-4 text-orange-500" />
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="text-app-soft">Property</p>
                        <p className="mt-1 text-app">{lead.propertyType}{lead.bhk && lead.bhk !== "N/A" ? ` • ${lead.bhk}` : ""}</p>
                      </div>
                      <div>
                        <p className="text-app-soft">Assigned</p>
                        <p className="mt-1 text-app">{lead.assignedToName || lead.assignedTo?.name || "Unassigned"}</p>
                      </div>
                    </div>

                    <div>
                      <label className="label">Move to stage</label>
                      <select className="select rounded-2xl" value={lead.status} onChange={(e) => handleMove(lead, e.target.value)}>
                        {STATUS_OPTIONS.map((item) => <option key={item}>{item}</option>)}
                      </select>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
