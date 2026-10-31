import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import api from "../services/api";
import { FormField, Modal, Spinner, AppDatePicker } from "./UI";
import CustomSelect from "./CustomSelect";
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
  streetAddress: "",
  city: "",
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
  assignedTo: "",
  whatsappConsent: "unknown"
};

// Dropdowns sized like .input (CLAUDE.md form rule).
const SELECT_STYLE = { width: "100%", padding: "12px 16px", fontSize: 14, borderRadius: 16 };

const CONSENT_OPTIONS = [
  { value: "unknown", label: "Not recorded" },
  { value: "granted", label: "Given — happy to receive WhatsApp updates" },
  { value: "denied",  label: "Refused — do not send marketing" },
];

export default function LeadForm({ open, onClose, onSaved, lead, agents = [] }) {
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [duplicate, setDuplicate] = useState(null);

  // Real-time duplicate check — debounced so it only fires once the agent pauses
  // typing a full number. Purely informational: it never blocks saving, since an
  // agent may legitimately be logging a genuine repeat inquiry.
  useEffect(() => {
    const digits = form.phone.replace(/\D/g, "");
    if (digits.length < 10) {
      setDuplicate(null);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get("/leads/check-duplicate", {
          params: { phone: form.phone, excludeId: lead?._id },
        });
        setDuplicate(data.duplicate);
      } catch {
        // silent - this is a convenience check, not critical to saving the lead
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [form.phone, lead?._id]);

  useEffect(() => {
    setDuplicate(null);
    if (!lead) {
      setForm(initialForm);
      return;
    }

    setForm({
      name: lead.name || "",
      phone: lead.phone || "",
      email: lead.email || "",
      streetAddress: lead.streetAddress || "",
      city: lead.city || "",
      source: lead.source || "Manual",
      status: lead.status || "New",
      priority: lead.priority || "Medium",
      propertyType: lead.propertyType || "Apartment",
      preferredLocation: lead.preferredLocation || "",
      bhk: lead.bhk || "N/A",
      purpose: lead.purpose || "Buy",
      followUpDate: (lead.followUpDate || lead.followUp) ? new Date(lead.followUpDate || lead.followUp).toISOString().slice(0, 10) : "",
      followUpNote: lead.followUpNote || "",
      budgetMin: lead.budget?.min || "",
      budgetMax: lead.budget?.max || "",
      assignedTo: lead.assignedTo?._id || lead.assignedTo || "",
      whatsappConsent: lead.whatsappConsent?.status || "unknown"
    });
  }, [lead, open]);

  const setValue = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
  };
  const setField = (key) => (v) => setForm((f) => ({ ...f, [key]: v }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);

    const payload = {
      name: form.name,
      phone: form.phone,
      email: form.email,
      streetAddress: form.streetAddress,
      city: form.city,
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
    // Project leads have no consent field and campaigns never target them, so
    // sending it there would be a control that saves nothing.
    if (lead?._type !== "project") payload.whatsappConsent = { status: form.whatsappConsent };

    try {
      const { data } = lead
        ? lead._type === "project" && lead.projectId
          ? await api.patch(`/projects/${lead.projectId}/leads/${lead._id}`, payload)
          : await api.put(`/leads/${lead._id}`, payload)
        : await api.post("/leads", payload);

      toast.success(lead ? "Lead updated" : "Lead created");
      if (!lead && data.duplicate) {
        toast(`Note: this phone number matches an existing lead: ${data.duplicate.name}`, { icon: "⚠️", duration: 5000 });
      }
      onSaved(data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save lead");
    } finally {
      setLoading(false);
    }
  };

  // Version C form (DESIGN.md): titled sections, required marks, the buttons
  // in the pinned footer (they submit the form through its id).
  const isProject = lead?._type === "project";
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={lead ? "Edit lead" : "Add lead"}
      description={lead ? "Change any detail and save." : "Name and phone are enough. You can add the rest later."}
      size="xl"
      footer={(
        <>
          <button type="button" className="btn-secondary rounded-xl" onClick={onClose}>Cancel</button>
          <button type="submit" form="lead-form" className="btn-primary rounded-xl" disabled={loading}>
            {loading ? <Spinner size="sm" /> : lead ? "Save changes" : "Create lead"}
          </button>
        </>
      )}
    >
      <form id="lead-form" onSubmit={handleSubmit} className="space-y-4">
        <section className="modal-section">
          <h3 className="modal-section-title">Contact</h3>
          <p className="modal-section-desc">Who the lead is and how to reach them.</p>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField label="Name" required>
              <input className="input" value={form.name} onChange={setValue("name")} required />
            </FormField>
            <FormField label="Phone" required>
              <input className="input" value={form.phone} onChange={setValue("phone")} required />
            </FormField>
            {duplicate && (
              <div className="md:col-span-2 -mt-2 rounded-xl px-4 py-2 text-sm" style={{ background: "rgba(234,88,12,0.1)", color: "#c2410c" }}>
                A lead with this phone number already exists: <strong>{duplicate.name}</strong> ({duplicate.status}, {duplicate.source}), added {new Date(duplicate.createdAt).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" })}. You can still save this as a new lead if needed.
              </div>
            )}
            <FormField label="Email">
              <input className="input" type="email" value={form.email} onChange={setValue("email")} />
            </FormField>
            <FormField label="City">
              <input className="input" value={form.city} onChange={setValue("city")} />
            </FormField>
            <FormField label="Street address" className="md:col-span-2">
              <input className="input" value={form.streetAddress} onChange={setValue("streetAddress")} />
            </FormField>
            {!isProject && (
              <FormField label="WhatsApp marketing consent" className="md:col-span-2">
                <CustomSelect value={form.whatsappConsent} onChange={setField("whatsappConsent")} options={CONSENT_OPTIONS} style={SELECT_STYLE} />
                <p className="text-xs text-app-soft mt-2">Only record consent the person actually gave. Campaigns skip anyone not marked as given.</p>
              </FormField>
            )}
          </div>
        </section>

        <section className="modal-section">
          <h3 className="modal-section-title">Requirement</h3>
          <p className="modal-section-desc">What they are looking for, and where the lead stands.</p>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField label="Source">
              <CustomSelect value={form.source} onChange={setField("source")} options={SOURCE_OPTIONS} style={SELECT_STYLE} />
            </FormField>
            <FormField label="Status">
              <CustomSelect value={form.status} onChange={setField("status")} options={STATUS_OPTIONS} style={SELECT_STYLE} />
            </FormField>
            <FormField label="Priority">
              <CustomSelect value={form.priority} onChange={setField("priority")} options={PRIORITY_OPTIONS} style={SELECT_STYLE} />
            </FormField>
            <FormField label="Purpose">
              <CustomSelect value={form.purpose} onChange={setField("purpose")} options={PURPOSE_OPTIONS} style={SELECT_STYLE} />
            </FormField>
            <FormField label="Property type">
              <CustomSelect value={form.propertyType} onChange={setField("propertyType")} options={PROPERTY_TYPES} style={SELECT_STYLE} />
            </FormField>
            <FormField label="BHK">
              <CustomSelect value={form.bhk} onChange={setField("bhk")} options={BHK_OPTIONS} style={SELECT_STYLE} />
            </FormField>
            <FormField label="Budget min">
              <input className="input" type="number" min="0" value={form.budgetMin} onChange={setValue("budgetMin")} />
            </FormField>
            <FormField label="Budget max">
              <input className="input" type="number" min="0" value={form.budgetMax} onChange={setValue("budgetMax")} />
            </FormField>
            <FormField label="Preferred location" className="md:col-span-2">
              <input className="input" value={form.preferredLocation} onChange={setValue("preferredLocation")} />
            </FormField>
          </div>
        </section>

        <section className="modal-section">
          <h3 className="modal-section-title">Follow-up</h3>
          <p className="modal-section-desc">Who handles the lead and when to get back to them.</p>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField label="Assign to">
              <CustomSelect
                value={form.assignedTo}
                onChange={setField("assignedTo")}
                placeholder="Unassigned"
                options={agents.map((a) => ({ value: a._id, label: `${a.name} (${a.role})` }))}
                style={SELECT_STYLE}
              />
            </FormField>
            <FormField label="Follow-up date">
              <AppDatePicker value={form.followUpDate} onChange={setField("followUpDate")} />
            </FormField>
            <FormField label="Follow-up note" className="md:col-span-2">
              <textarea className="textarea" value={form.followUpNote} onChange={setValue("followUpNote")} />
            </FormField>
          </div>
        </section>
      </form>
    </Modal>
  );
}
