import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import api from "../services/api";
import { FormField, Modal, Spinner } from "./UI";
import {
  BHK_OPTIONS,
  PRIORITY_OPTIONS,
  PROPERTY_TYPES,
  PURPOSE_OPTIONS,
  SOURCE_OPTIONS,
  STATUS_OPTIONS
} from "../utils/constants";

const initialForm = {
  name: "",
  phone: "",
  email: "",
  source: "Manual",
  status: "New",
  priority: "Medium",
  propertyType: "Apartment",
  preferredLocation: "",
  bhk: "N/A",
  purpose: "Buy",
  followUpDate: "",
  followUpNote: "",
  budgetMin: "",
  budgetMax: "",
  assignedTo: ""
};

export default function LeadForm({ open, onClose, onSaved, lead, agents = [] }) {
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!lead) {
      setForm(initialForm);
      return;
    }

    setForm({
      name: lead.name || "",
      phone: lead.phone || "",
      email: lead.email || "",
      source: lead.source || "Manual",
      status: lead.status || "New",
      priority: lead.priority || "Medium",
      propertyType: lead.propertyType || "Apartment",
      preferredLocation: lead.preferredLocation || "",
      bhk: lead.bhk || "N/A",
      purpose: lead.purpose || "Buy",
      followUpDate: lead.followUpDate ? new Date(lead.followUpDate).toISOString().slice(0, 10) : "",
      followUpNote: lead.followUpNote || "",
      budgetMin: lead.budget?.min || "",
      budgetMax: lead.budget?.max || "",
      assignedTo: lead.assignedTo?._id || lead.assignedTo || ""
    });
  }, [lead, open]);

  const setValue = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);

    const payload = {
      name: form.name,
      phone: form.phone,
      email: form.email,
      source: form.source,
      status: form.status,
      priority: form.priority,
      propertyType: form.propertyType,
      preferredLocation: form.preferredLocation,
      bhk: form.bhk,
      purpose: form.purpose,
      followUpDate: form.followUpDate || null,
      followUpNote: form.followUpNote,
      assignedTo: form.assignedTo || null,
      budget: {
        min: Number(form.budgetMin || 0),
        max: Number(form.budgetMax || 0),
        currency: "INR"
      }
    };

    try {
      const { data } = lead
        ? lead._type === "project" && lead.projectId
          ? await api.patch(`/projects/${lead.projectId}/leads/${lead._id}`, payload)
          : await api.put(`/leads/${lead._id}`, payload)
        : await api.post("/leads", payload);

      toast.success(lead ? "Lead updated" : "Lead created");
      onSaved(data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save lead");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={lead ? "Edit Lead" : "Add Lead"} size="xl">
      <div className="mb-6 rounded-[1.5rem] p-4 stitch-surface-muted">
        <p className="stitch-kicker mb-2">Lead Editor</p>
        <p className="text-sm text-app-soft">
          Capture property interest, source quality, assignment, and follow-up details in one premium workspace.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <FormField label="Name">
          <input className="input" value={form.name} onChange={setValue("name")} required />
        </FormField>
        <FormField label="Phone">
          <input className="input" value={form.phone} onChange={setValue("phone")} required />
        </FormField>
        <FormField label="Email">
          <input className="input" type="email" value={form.email} onChange={setValue("email")} />
        </FormField>
        <FormField label="Source">
          <select className="select" value={form.source} onChange={setValue("source")}>
            {SOURCE_OPTIONS.map((item) => <option key={item}>{item}</option>)}
          </select>
        </FormField>
        <FormField label="Status">
          <select className="select" value={form.status} onChange={setValue("status")}>
            {STATUS_OPTIONS.map((item) => <option key={item}>{item}</option>)}
          </select>
        </FormField>
        <FormField label="Priority">
          <select className="select" value={form.priority} onChange={setValue("priority")}>
            {PRIORITY_OPTIONS.map((item) => <option key={item}>{item}</option>)}
          </select>
        </FormField>
        <FormField label="Property Type">
          <select className="select" value={form.propertyType} onChange={setValue("propertyType")}>
            {PROPERTY_TYPES.map((item) => <option key={item}>{item}</option>)}
          </select>
        </FormField>
        <FormField label="BHK">
          <select className="select" value={form.bhk} onChange={setValue("bhk")}>
            {BHK_OPTIONS.map((item) => <option key={item}>{item}</option>)}
          </select>
        </FormField>
        <FormField label="Purpose">
          <select className="select" value={form.purpose} onChange={setValue("purpose")}>
            {PURPOSE_OPTIONS.map((item) => <option key={item}>{item}</option>)}
          </select>
        </FormField>
        <FormField label="Preferred Location">
          <input className="input" value={form.preferredLocation} onChange={setValue("preferredLocation")} />
        </FormField>
        <FormField label="Budget Min">
          <input className="input" type="number" min="0" value={form.budgetMin} onChange={setValue("budgetMin")} />
        </FormField>
        <FormField label="Budget Max">
          <input className="input" type="number" min="0" value={form.budgetMax} onChange={setValue("budgetMax")} />
        </FormField>
        <FormField label="Follow-up Date">
          <input className="input" type="date" value={form.followUpDate} onChange={setValue("followUpDate")} />
        </FormField>
        <FormField label="Assign To">
          <select className="select" value={form.assignedTo} onChange={setValue("assignedTo")}>
            <option value="">Unassigned</option>
            {agents.map((agent) => (
              <option key={agent._id} value={agent._id}>
                {agent.name} ({agent.role})
              </option>
            ))}
          </select>
        </FormField>
        <div className="md:col-span-2">
          <FormField label="Follow-up Note">
            <textarea className="textarea" value={form.followUpNote} onChange={setValue("followUpNote")} />
          </FormField>
        </div>

        <div className="md:col-span-2 flex justify-end gap-3 pt-2">
          <button type="button" className="btn-secondary rounded-xl" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary rounded-xl" disabled={loading}>
            {loading ? <Spinner size="sm" /> : lead ? "Update Lead" : "Create Lead"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
