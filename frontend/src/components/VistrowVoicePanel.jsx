// Compact "Vistrow AI calls" status on the lead page: last AI call result, how
// many dials, the next scheduled Vistrow call if one is known, and why a call
// cannot be requested. The "AI call" button itself lives in the lead header
// (LeadDetail), next to the "You call" buttons, so the two are not confused.
//
// useVistrowCall reads GET /integrations/vistrow-outbound/leads/:id/status
// (newest delivery and whether a call can be requested) once per lead and is
// shared by the header button and this panel. Call results themselves are
// already on the lead (voiceCalls, activities), so no second fetch is needed.
import { useEffect, useState } from "react";
import { PhoneOutgoing } from "lucide-react";
import toast from "react-hot-toast";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { fmtDateTime } from "../utils/constants";

const BASE = "/integrations/vistrow-outbound/leads";
const KIND = { callback: "Scheduled call-back", visit_reminder: "Site-visit reminder", nurture: "Follow-up call" };

// Pipeline leads only: project copies have no delivery of their own.
export function useVistrowCall(lead, onUpdated) {
  const { user } = useAuth();
  const mayCall = user?.role === "admin" || user?.role === "manager" || user?.role === "super_admin";
  const [st, setSt] = useState(null);
  const [calling, setCalling] = useState(false);
  const leadId = lead?._type === "project" ? null : lead?._id;

  useEffect(() => {
    let alive = true;
    setSt(null);
    if (!leadId) return undefined;
    api.get(`${BASE}/${leadId}/status`).then((r) => { if (alive) setSt(r.data); }).catch(() => { if (alive) setSt({ enabled: false, canCall: false, lastDelivery: null }); });
    return () => { alive = false; };
  }, [leadId]);

  const d = st?.lastDelivery;
  const queuedAt = d?.callQueued && d.callQueuedUntil && new Date(d.callQueuedUntil).getTime() > Date.now() ? d.callQueuedUntil : null;
  const inFlight = !!d && ["pending", "sending"].includes(d.status);

  const requestCall = async () => {
    setCalling(true);
    try {
      const { data } = await api.post(`${BASE}/${leadId}/call`);
      if (data.queued) toast.success("Asked Vistrow Voice to call this lead");
      else toast(data.message || "A call was already requested in the last minute.");
      // Vistrow answers within a few seconds; then the lead's activity feed and
      // the panel show what it said.
      setTimeout(async () => {
        try {
          const [s, l] = await Promise.all([api.get(`${BASE}/${leadId}/status`), api.get(`/leads/${leadId}`)]);
          setSt(s.data);
          if (l.data?.data) onUpdated?.(l.data.data);
        } catch { /* the next open shows it */ }
        setCalling(false);
      }, 4000);
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not request the call");
      setCalling(false);
    }
  };

  return {
    st, calling, requestCall, mayCall, queuedAt, inFlight,
    busy: inFlight || !!queuedAt,
    canAiCall: !!leadId && mayCall && !!st?.canCall,
    // Who the next AI call would come from (current routing), else the last one.
    agentLabel: st?.nextAgentLabel || d?.agentLabel || "",
  };
}

export default function VistrowVoicePanel({ lead, vistrow }) {
  const { st, mayCall, queuedAt, inFlight } = vistrow;

  const calls = Array.isArray(lead?.voiceCalls)
    ? [...lead.voiceCalls].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    : [];
  const last = calls[0];
  const attempts = calls.reduce((n, c) => n + (Number(c.attempts) > 0 ? Number(c.attempts) : 1), 0);
  const d = st?.lastDelivery;
  const now = Date.now();
  const vistrowFollowUp = lead?.followUpSetByName === "Vistrow Voice" && lead.followUpDate && new Date(lead.followUpDate).getTime() > now ? lead.followUpDate : null;
  const nextCall = queuedAt || vistrowFollowUp;
  const declined = d?.autoCall && d.callQueued === false ? d.callReasonText || "Vistrow did not queue the call" : "";

  // Nothing to say: the integration is off and this lead was never called.
  if (!calls.length && !d && !st?.enabled) return null;

  // A website widget conversation is the visitor talking to the AI on the
  // site, not an AI call to them (owner, 31 Oct 2026).
  const isWidget = !!last && /widget|web/i.test(String(last.channel || "")) && !last.followUpKind && !last.result;
  const talk = last?.durationSeconds > 0
    ? `${Math.floor(last.durationSeconds / 60)}m ${Math.round(last.durationSeconds % 60)}s`.replace(/^0m /, "")
    : null;
  const lastLine = last
    ? [isWidget ? "Website widget conversation" : last.result || (last.followUpKind ? KIND[last.followUpKind] : null) || "Call made",
       isWidget ? talk : null, last.createdAt ? fmtDateTime(last.createdAt) : null].filter(Boolean).join(" · ")
    : "No call yet";

  return (
    <div className="rounded-[1.25rem] px-4 py-3 stitch-surface-muted">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-2 shrink-0">
          <PhoneOutgoing className="h-3.5 w-3.5" style={{ color: "#6366f1" }} />
          <span className="text-xs font-bold uppercase tracking-wider text-app-soft">Vistrow AI calls</span>
        </div>
        <span className="text-sm text-app"><span className="text-app-soft">{isWidget ? "Last conversation:" : "Last AI call:"}</span> {lastLine}</span>
        {calls.length > 0 && <span className="text-sm text-app"><span className="text-app-soft">Tries:</span> {attempts}</span>}
        {nextCall && <span className="text-sm text-app"><span className="text-app-soft">Next AI call:</span> {fmtDateTime(nextCall)}</span>}
        {inFlight && <span className="text-sm text-app-soft">Sending to Vistrow...</span>}
        {declined && <span className="text-sm" style={{ color: "#b45309" }}>{declined}</span>}
        {st && !st.canCall && st.whyNot && mayCall && !declined && !nextCall && (
          <span className="text-xs text-app-soft">{st.whyNot}</span>
        )}
      </div>
    </div>
  );
}
