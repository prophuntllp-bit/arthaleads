// RoutingRulesPage.jsx — /integrations/routing: campaign routing rules on their
// own page (27 Oct 2026, Growth). The rules editor is components/LeadRoutingSection.
import { useEffect, useState } from "react";
import { GitBranch, ListChecks, CheckCircle2, Shuffle } from "lucide-react";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { canAccess } from "../../utils/plan";
import LeadRoutingSection from "../../components/LeadRoutingSection";
import { IntegrationShell, LogoTile, Panel, Steps, PlanLocked } from "../../components/integrations/IntegrationUI";

export const RoutingLogo = ({ size = 40 }) => (
  <LogoTile size={size} bg="rgba(var(--app-primary-rgb),0.10)"><GitBranch className={size > 44 ? "h-6 w-6" : "h-5 w-5"} style={{ color: "var(--app-primary)" }} /></LogoTile>
);

export default function RoutingRulesPage() {
  const { user, org } = useAuth();
  const allowed = user?.role === "super_admin" || ((user?.role === "admin" || user?.role === "manager") && canAccess(org, "growth"));
  const [tab, setTab] = useState("rules");
  const [rules, setRules] = useState(null);

  // Counts for the tiles; the editor below loads its own copy.
  const loadCounts = () => api.get("/routing-rules").then((r) => setRules(r.data.rules || r.data || [])).catch(() => setRules([]));
  useEffect(() => { if (allowed) loadCounts(); }, [allowed]);

  const shell = {
    logo: <RoutingLogo size={52} />,
    name: "Lead routing rules",
    description: "Leads from a chosen Facebook or Google campaign, WhatsApp ad or website page go straight to a team member or project. Everything else follows the round-robin rotation.",
  };
  if (!allowed) {
    return (
      <IntegrationShell {...shell}>
        {user?.role === "admin" ? <PlanLocked what="Lead routing rules" /> : <Panel><p className="text-sm text-app-soft">Only an admin or manager can change routing rules.</p></Panel>}
      </IntegrationShell>
    );
  }

  const list = Array.isArray(rules) ? rules : [];
  const active = list.filter((r) => r.isActive !== false).length;
  return (
    <IntegrationShell {...shell}
      status={rules === null ? undefined : active ? `${active} active` : "No rules yet"}
      statusTone={active ? "on" : "off"}
      stats={[
        { icon: ListChecks, label: "Rules", value: rules === null ? "-" : list.length },
        { icon: CheckCircle2, label: "Active", value: rules === null ? "-" : active },
        { icon: Shuffle, label: "Everything else", value: org?.autoAssign === false ? "Unassigned" : "Round-robin" },
      ]}
      tabs={[{ key: "rules", label: "Rules" }, { key: "help", label: "Setup help" }]}
      tab={tab} onTab={setTab}
    >
      {tab === "rules" && <div onClickCapture={() => setTimeout(loadCounts, 1500)}><LeadRoutingSection bare /></div>}
      {tab === "help" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 items-start">
          <Panel title="Add a rule">
            <Steps items={[
              "Click Add Rule and pick where the leads come from: Facebook Lead Ads, WhatsApp ads, Google Ads or your website.",
              "Choose the form, campaign, ad, domain or page to match. The lists show the ones your leads already came from.",
              "Pick the team member, the project, or both. Save.",
              "From the next lead on, matching leads skip the rotation and go straight there.",
            ]} />
          </Panel>
          <Panel title="Good to know">
            <p className="text-sm text-app-soft">
              If the chosen team member has left or is switched off, the lead goes to the next person in rotation instead of being lost. Rules never move leads you already have.
            </p>
          </Panel>
        </div>
      )}
    </IntegrationShell>
  );
}
