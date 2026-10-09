// In-memory twin of services/vistrowOutbound/store.mongo.js.
//
// It reproduces the semantics the service depends on -- unique (orgId,eventId),
// atomic claim with a lease, the repeat-phone window -- so the delivery state
// machine can be exercised without a database. What it cannot prove is that the
// Mongo implementation behaves the same; that needs a real MongoDB.

function createMemoryStore({ clock = () => new Date() } = {}) {
  const integrations = new Map();
  const deliveries = [];
  let seq = 0;
  const copy = (d) => (d ? { ...d, payload: d.payload ? JSON.parse(JSON.stringify(d.payload)) : d.payload, attemptLog: [...(d.attemptLog || [])] } : d);
  const find = (id) => deliveries.find((d) => d._id === id);

  return {
    deliveries,
    integrations,
    setIntegration(orgId, cfg) { integrations.set(String(orgId), { id: `int_${orgId}`, orgId, ...cfg }); },

    async getIntegration(orgId) { const c = integrations.get(String(orgId)); return c ? { ...c } : null; },

    async insertDelivery(doc) {
      const existing = deliveries.find((d) => String(d.orgId) === String(doc.orgId) && d.eventId === doc.eventId);
      if (existing) return { inserted: false, delivery: copy(existing) };
      const d = { attempts: 0, attemptLog: [], ...doc, _id: `dlv_${++seq}`, createdAt: clock() };
      deliveries.push(d);
      return { inserted: true, delivery: copy(d) };
    },

    async findRecentDeliveryForPhone({ orgId, phoneKey, since, excludeEventId, autoCallOnly = false }) {
      return copy(deliveries.find((d) =>
        String(d.orgId) === String(orgId) && d.phoneKey === phoneKey && !d.isTest &&
        ["pending", "sending", "delivered"].includes(d.status) && d.createdAt >= since && d.eventId !== excludeEventId &&
        (!autoCallOnly || d.autoCall === true))) || null;
    },

    async claimById(id, { now, leaseMs }) {
      const d = find(id);
      if (!d || d.status !== "pending" || !(d.nextAttemptAt <= now)) return null;
      Object.assign(d, { status: "sending", lockedUntil: new Date(now.getTime() + leaseMs) });
      d.attempts += 1;
      return copy(d);
    },

    async claimDue({ now, leaseMs, limit }) {
      const due = deliveries
        .filter((d) => (d.status === "pending" && d.nextAttemptAt <= now) || (d.status === "sending" && d.lockedUntil < now))
        .sort((a, b) => a.nextAttemptAt - b.nextAttemptAt)
        .slice(0, limit);
      for (const d of due) { Object.assign(d, { status: "sending", lockedUntil: new Date(now.getTime() + leaseMs) }); d.attempts += 1; }
      return due.map(copy);
    },

    async update(id, patch) {
      const d = find(id);
      const { appendAttempt, ...set } = patch;
      for (const [k, v] of Object.entries(set)) if (v !== undefined) d[k] = v;
      if (appendAttempt) d.attemptLog = [...d.attemptLog, appendAttempt].slice(-12);
    },

    async recordIntegrationOutcome(orgId, patch) {
      const c = integrations.get(String(orgId));
      const { clearError, clearWarning, ...fields } = patch;
      Object.assign(c, fields);
      if (clearError) delete c.lastError;
      if (clearWarning) delete c.lastWarning;
    },

    async throttleAlert(orgId, now, gapMs) {
      const c = integrations.get(String(orgId));
      if (c.lastAlertAt && c.lastAlertAt > new Date(now.getTime() - gapMs)) return false;
      c.lastAlertAt = now;
      return true;
    },

    async cancelPending(orgId, now, reason) {
      let n = 0;
      for (const d of deliveries) if (String(d.orgId) === String(orgId) && d.status === "pending") { Object.assign(d, { status: "cancelled", skipReason: reason, terminalAt: now }); n++; }
      return n;
    },
  };
}

module.exports = { createMemoryStore };
