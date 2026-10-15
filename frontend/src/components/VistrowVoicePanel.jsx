// Compact "Vistrow Voice" status on the lead page: last call result, how many
// dials, the next scheduled Vistrow call if one is known, and "Call now via
// Vistrow" for admins/managers when the lead routes to an agent.
//
// Reads GET /integrations/vistrow-outbound/leads/:id/status (newest delivery
// and whether a call can be requested). Call results themselves are already on
// the lead (voiceCalls, activities), so no second fetch is needed for them.
import { useEffect, useState } from "react";
import { Loader2, PhoneOutgoing } from "lucide-react";
import toast from "react-hot-toast";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { fmtDateTime } from "../utils/constants";

const BASE = "/integrations/vistrow-outbound/leads";
const KIND = { callback: "Scheduled call-back", visit_reminder: "Site-visit reminder", nurture: "Follow-up call" };

export default function VistrowVoicePanel({ lead, onUpdated }) {
  const { user } = useAuth();
  const mayCall = user?.role === "admin" || user?.role === "manager" || user?.role === "super_admin";
  const [st, setSt] = useState(null);
  const [calling, setCalling] = useState(false);

  useEffect(() => {
    let alive = true;
    setSt(null);
    if (!lead?._id) return undefined;
    api.get(`${BASE}/${lead._id}/status`).then((r) => { if (alive) setSt(r.data); }).catch(() => { if (alive) setSt({ enabled: false, canCall: false, lastDelivery: null }); });
    return () => { alive = false; };
  }, [lead?._id]);

  const calls = Array.isArray(lead?.voiceCalls)
    ? [...lead.voiceCalls].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    : [];
  const last = calls[0];
  const attempts = calls.reduce((n, c) => n + (Number(c.attempts) > 0 ? Number(c.attempts) : 1), 0);
  const d = st?.lastDelivery;
  const now = Date.now();
  const queuedAt = d?.callQueued && d.callQueuedUntil && new Date(d.callQueuedUntil).getTime() > now ? d.callQueuedUntil : null;
  const vistrowFollowUp = lead?.followUpSetByName === "Vistrow Voice" && lead.followUpDate && new Date(lead.followUpDate).getTime() > now ? lead.followUpDate : null;
  const nextCall = queuedAt || vistrowFollowUp;
  const inFlight = d && ["pending", "sending"].includes(d.status);
  const declined = d?.autoCall && d.callQueued === false ? d.callReasonText || "Vistrow did not queue the call" : "";

  // Nothing to say: the integration is off and this lead was never called.
  if (!calls.length && !d && !st?.enabled) return null;

  const requestCall = async () => {
    setCalling(true);
    try {
      const { data } = await api.post(`${BASE}/${lead._id}/call`);
      if (data.queued) toast.success("Asked Vistrow Voice to call this lead");
      else toast(data.message || "A call was already requested in the last minute.");
      // Vistrow answers within a few seconds; then the lead's activity feed and
      // this panel show what it said.
      setTimeout(async () => {
        try {
          const [s, l] = await Promise.all([api.get(`${BASE}/${lead._id}/status`), api.get(`/leads/${lead._id}`)]);
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

  const lastLine = last
    ? [last.result || (last.followUpKind ? KIND[last.followUpKind] : null) || "Call made", last.createdAt ? fmtDateTime(last.createdAt) : null].filter(Boolean).join(" · ")
    : "No call yet";

  return (
    <div className="rounded-[1.25rem] px-4 py-3 stitch-surface-muted">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-2 shrink-0">
          <PhoneOutgoing className="h-3.5 w-3.5" style={{ color: "#6366f1" }} />
          <span className="text-xs font-bold uppercase tracking-wider text-app-soft">Vistrow Voice</span>
        </div>
        <span className="text-sm text-app"><span className="text-app-soft">Last call:</span> {lastLine}</span>
        {calls.length > 0 && <span className="text-sm text-app"><span className="text-app-soft">Tries:</span> {attempts}</span>}
        {nextCall && <span className="text-sm text-app"><span className="text-app-soft">Next call:</span> {fmtDateTime(nextCall)}</span>}
        {inFlight && <span className="text-sm text-app-soft">Sending to Vistrow...</span>}
        {declined && <span className="text-sm" style={{ color: "#b45309" }}>{declined}</span>}
        {st && !st.canCall && st.whyNot && mayCall && !declined && !nextCall && (
          <span className="text-xs text-app-soft">{st.whyNot}</span>
        )}
        <span className="flex-1" />
        {mayCall && st?.canCall && (
          <button type="button" onClick={requestCall} disabled={calling || inFlight}
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
            style={{ borderColor: "var(--app-border)", color: "var(--app-text-soft)" }}
            title="Ask Vistrow Voice to call this lead now">
            {calling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PhoneOutgoing className="h-3.5 w-3.5" style={{ color: "#6366f1" }} />}
            {calling ? "Requesting..." : "Call now via Vistrow"}
          </button>
        )}
      </div>
    </div>
  );
}
