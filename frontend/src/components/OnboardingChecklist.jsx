// components/OnboardingChecklist.jsx
import { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  CheckCircle2, Circle, X, ChevronRight, Rocket,
  Users, Zap, GitBranch, Bell, LayoutDashboard,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";

const STEPS = [
  {
    id: "first_lead",
    title: "Add your first lead",
    desc: "Import from Facebook, upload a CSV, or add manually from Leads.",
    href: "/leads",
    Icon: LayoutDashboard,
  },
  {
    id: "connect_facebook",
    title: "Connect Facebook Lead Ads",
    desc: "Auto-capture every Meta ad form submission straight into the CRM.",
    href: "/automation",
    Icon: Zap,
  },
  {
    id: "add_teammate",
    title: "Add a team member",
    desc: "Invite agents or managers so leads can be assigned and tracked.",
    href: "/team",
    Icon: Users,
  },
  {
    id: "view_pipeline",
    title: "Explore the Kanban pipeline",
    desc: "See every lead move from New to Converted in one visual board.",
    href: "/pipeline",
    Icon: GitBranch,
    manualOnly: true,
  },
  {
    id: "create_followup",
    title: "Schedule your first follow-up",
    desc: "Set a call or visit reminder so no prospect falls through the cracks.",
    href: "/followups",
    Icon: Bell,
    manualOnly: true,
  },
];

export default function OnboardingChecklist({ totalLeads }) {
  const { org } = useAuth();
  const orgId = org?._id || "guest";

  const storageKey  = `ol_${orgId}`;
  const dismissKey  = `ol_dis_${orgId}`;

  const [manualDone, setManualDone] = useState(
    () => JSON.parse(localStorage.getItem(storageKey) || "[]")
  );
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(dismissKey) === "1"
       || sessionStorage.getItem(dismissKey) === "1"
  );
  const [expanded, setExpanded]               = useState(true);
  const [facebookConnected, setFacebookConnected] = useState(false);
  const [agentsCount, setAgentsCount]         = useState(1);

  useEffect(() => {
    if (dismissed) return;
    api.get("/automations")
      .then((res) => {
        const list   = res.data.automations || [];
        const active = list.filter((a) => a.status === "connected" && a.isActive !== false);
        setFacebookConnected(active.some((a) => a.platform === "Facebook"));
      })
      .catch(() => {});
    api.get("/auth/agents")
      .then((r) => setAgentsCount((r.data.agents || []).length))
      .catch(() => {});
  }, [dismissed]);

  const isComplete = useCallback((step) => {
    if (manualDone.includes(step.id)) return true;
    if (step.id === "first_lead")      return (totalLeads || 0) > 0;
    if (step.id === "connect_facebook") return facebookConnected;
    if (step.id === "add_teammate")    return agentsCount > 1;
    return false;
  }, [manualDone, totalLeads, facebookConnected, agentsCount]);

  const completedCount = useMemo(() => STEPS.filter(isComplete).length, [isComplete]);
  const allDone        = completedCount === STEPS.length;

  const markDone = (id) => {
    const next = [...new Set([...manualDone, id])];
    setManualDone(next);
    localStorage.setItem(storageKey, JSON.stringify(next));
  };

  // Permanent dismiss (X button) — never shows again for this org.
  const dismiss = () => {
    setDismissed(true);
    localStorage.setItem(dismissKey, "1");
  };

  // Skip for now — hidden only for this session, reappears on next login.
  const skip = () => {
    setDismissed(true);
    sessionStorage.setItem(dismissKey, "1");
  };

  if (dismissed) return null;

  const pct = Math.round((completedCount / STEPS.length) * 100);

  return (
    <section className="card overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-4 cursor-pointer select-none"
        style={{
          background: "linear-gradient(135deg, rgba(var(--app-primary-rgb),0.10) 0%, rgba(var(--app-primary-rgb),0.03) 100%)",
          borderBottom: "1px solid var(--app-border)",
        }}
        onClick={() => setExpanded((v) => !v)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl"
            style={{ background: "rgba(var(--app-primary-rgb),0.15)" }}
          >
            <Rocket className="h-4 w-4" style={{ color: "var(--app-primary)" }} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-black text-app leading-tight">
              {allDone ? "Setup complete — you're all set!" : "Get started with Arthaleads"}
            </p>
            <p className="text-xs text-app-soft mt-0.5">
              {allDone
                ? "All onboarding steps are complete."
                : `${completedCount} of ${STEPS.length} steps complete`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 pl-2" onClick={(e) => e.stopPropagation()}>
          <div
            className="hidden sm:flex items-center rounded-full px-3 py-1 text-[11px] font-bold"
            style={{
              background: allDone ? "rgba(34,197,94,0.12)" : "rgba(var(--app-primary-rgb),0.10)",
              color:      allDone ? "#22c55e"               : "var(--app-primary)",
            }}
          >
            {pct}%
          </div>
          <button
            type="button"
            onClick={dismiss}
            title="Don't show again"
            className="p-1.5 rounded-xl text-app-soft hover:text-app hover:bg-black/5 dark:hover:bg-white/5 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 w-full" style={{ background: "var(--app-border)" }}>
        <div
          className="h-1 transition-all duration-700"
          style={{
            width: `${pct}%`,
            background: allDone ? "#22c55e" : "var(--app-primary)",
          }}
        />
      </div>

      {/* Steps list */}
      {expanded && (
        <div className="divide-y" style={{ borderColor: "var(--app-border)" }}>
          {STEPS.map((step) => {
            const done = isComplete(step);
            return (
              <div
                key={step.id}
                className="flex items-center gap-3 px-5 py-3.5"
                style={{ opacity: done ? 0.55 : 1 }}
              >
                {done
                  ? <CheckCircle2 className="h-5 w-5 shrink-0 text-green-500" />
                  : <Circle className="h-5 w-5 shrink-0 text-app-soft/30" />}

                <div
                  className="hidden sm:flex h-8 w-8 items-center justify-center rounded-xl shrink-0"
                  style={{
                    background: done
                      ? "rgba(34,197,94,0.08)"
                      : "rgba(var(--app-primary-rgb),0.08)",
                  }}
                >
                  <step.Icon
                    className="h-3.5 w-3.5"
                    style={{ color: done ? "#22c55e" : "var(--app-primary)" }}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold leading-tight ${done ? "line-through text-app-soft" : "text-app"}`}>
                    {step.title}
                  </p>
                  <p className="text-xs text-app-soft mt-0.5 hidden sm:block">{step.desc}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {!done && step.manualOnly && (
                    <button
                      type="button"
                      onClick={() => markDone(step.id)}
                      className="text-[11px] font-semibold px-2.5 py-1 rounded-lg transition hover:bg-black/5 dark:hover:bg-white/5 whitespace-nowrap"
                      style={{
                        color: "var(--app-primary)",
                        border: "1px solid rgba(var(--app-primary-rgb),0.3)",
                      }}
                    >
                      Mark done
                    </button>
                  )}
                  {!done && (
                    <Link
                      to={step.href}
                      className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg text-white transition hover:opacity-85 whitespace-nowrap"
                      style={{ background: "var(--app-primary)" }}
                    >
                      Go <ChevronRight className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              </div>
            );
          })}

          {/* Footer */}
          <div className="px-5 py-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-app-soft">
              Need detailed guidance?{" "}
              <Link
                to="/help-support"
                className="font-semibold hover:underline"
                style={{ color: "var(--app-primary)" }}
              >
                Open the Getting Started guide
              </Link>
            </p>
            <button
              type="button"
              onClick={allDone ? dismiss : skip}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg transition text-app-soft hover:text-app hover:bg-black/5 dark:hover:bg-white/5"
              style={{ border: "1px solid var(--app-border)" }}
            >
              {allDone ? "Dismiss" : "Skip for now"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
