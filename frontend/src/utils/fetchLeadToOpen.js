import api from "../services/api";

// A link elsewhere in the app (Artha, search, alerts) asked to open a lead.
// Plain leads live under /leads; project leads under /projects/lead. Both come
// back in the shape LeadDetail expects.
export default async function fetchLeadToOpen(id, kind) {
  const { data } = await api.get(kind === "projectLead" ? `/projects/lead/${id}` : `/leads/${id}`);
  return data.data || data.lead || data;
}
