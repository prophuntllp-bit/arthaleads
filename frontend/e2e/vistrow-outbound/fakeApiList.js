// Stand-in for the API behind the Integrations list page: one connected Vistrow Voice
// connection, everything else empty. Records every write so the check can prove none happened.
const writes = [];
window.__writes = writes;
const conn = { _id: "c1", id: "c1", name: "Vistrow Voice", platform: "Vistrow Voice", status: "connected", isActive: true, verifyToken: "AW-test-token-0000", webhookPath: "/webhook/lead", lastSyncAt: null };
const data = (u) => {
  if (u === "/automations") return { automations: [conn] };
  if (u === "/automations/voice/connections") return { connections: [conn] };
  if (u === "/whatsapp/status") return { connected: false };
  if (u === "/routing-rules") return { data: [], rules: [] };
  if (u === "/projects") return { data: [] };
  if (u === "/meta-conversions") return { datasetId: "", testEventCode: "", events: [], stages: ["New", "Closed Won", "Closed Lost"], enabled: false, stats: { sent: 0, failed: 0, pending: 0 }, matchableLeads: 0, recent: [], lastError: "", tokenSet: false, tokenLast: "" };
  return { data: [], connections: [], options: {}, pages: [], agents: [] };
};
const api = {
  defaults: { baseURL: "http://localhost:5000/api" },
  async get(u) { return { data: { success: true, ...data(u) } }; },
  async post(u, b) { writes.push(["POST", u]); return { data: { success: true } }; },
  async put(u, b) { writes.push(["PUT", u]); return { data: { success: true } }; },
  async patch(u, b) { writes.push(["PATCH", u]); return { data: { success: true } }; },
  async delete(u) { writes.push(["DELETE", u]); return { data: { success: true } }; },
};
export default api;
