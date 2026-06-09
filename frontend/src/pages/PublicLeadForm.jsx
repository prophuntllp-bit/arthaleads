import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { CheckCircle2, Loader2 } from "lucide-react";

const API = import.meta.env.VITE_API_URL?.replace("/api", "") || "http://localhost:5000";

const PROPERTY_TYPES = ["Apartment", "Villa", "Plot", "Commercial", "Office", "Penthouse", "Other"];

export default function PublicLeadForm() {
  const { token } = useParams();
  const [meta, setMeta]         = useState(null);   // { type, org, project }
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "", phone: "", email: "",
    propertyType: "Apartment", budget: "", message: "",
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    document.title = "Enquiry Form";
    axios.get(`${API}/api/public/form/${token}`)
      .then((r) => {
        setMeta(r.data);
        if (r.data.org?.name) document.title = `Enquiry – ${r.data.org.name}`;
      })
      .catch((e) => setError(e.response?.data?.message || "Invalid or expired QR code"))
      .finally(() => setLoading(false));
  }, [token]);

  const accent = meta?.org?.brandColor || "#FF6B00";

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Name is required";
    if (!form.phone.trim()) e.phone = "Phone is required";
    else if (!/^[0-9+\-\s()]{7,15}$/.test(form.phone.trim())) e.phone = "Enter a valid phone number";
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) e.email = "Enter a valid email";
    return e;
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSubmitting(true);
    try {
      // Use URLSearchParams (application/x-www-form-urlencoded) — a CORS "simple
      // request" that skips the OPTIONS preflight entirely.
      const params = new URLSearchParams();
      Object.entries(form).forEach(([k, v]) => { if (v !== "") params.append(k, v); });
      await axios.post(`${API}/api/public/form/${token}`, params);
      setSubmitted(true);
    } catch (err) {
      const msg = err.response?.data?.message
        || (err.response ? `Server error ${err.response.status}` : err.message)
        || "Submission failed. Please try again.";
      setErrors({ _form: msg });
    } finally {
      setSubmitting(false);
    }
  };

  const field = (key, label, type = "text", placeholder = "") => (
    <div>
      <label className="block text-sm font-semibold mb-1" style={{ color: "#374151" }}>{label}</label>
      <input
        type={type}
        value={form[key]}
        onChange={(e) => { setForm((p) => ({ ...p, [key]: e.target.value })); setErrors((p) => ({ ...p, [key]: "" })); }}
        placeholder={placeholder}
        className="w-full rounded-xl border px-4 py-3 text-sm outline-none transition"
        style={{
          border: errors[key] ? "1.5px solid #ef4444" : "1.5px solid #e5e7eb",
          background: "#f9fafb", color: "#111827",
        }}
        onFocus={(e) => { if (!errors[key]) e.target.style.borderColor = accent; }}
        onBlur={(e) => { if (!errors[key]) e.target.style.borderColor = "#e5e7eb"; }}
      />
      {errors[key] && <p className="mt-1 text-xs text-red-500">{errors[key]}</p>}
    </div>
  );

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#f3f4f6" }}>
      <Loader2 className="h-8 w-8 animate-spin" style={{ color: "#FF6B00" }} />
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "#f3f4f6" }}>
      <div className="max-w-sm w-full text-center p-8 rounded-3xl shadow-lg" style={{ background: "#fff" }}>
        <p className="text-2xl mb-3">🔗</p>
        <h2 className="text-lg font-bold text-gray-800 mb-2">Invalid QR Code</h2>
        <p className="text-sm text-gray-500">{error}</p>
      </div>
    </div>
  );

  if (submitted) return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "#f3f4f6" }}>
      <div className="max-w-sm w-full text-center p-8 rounded-3xl shadow-lg" style={{ background: "#fff" }}>
        {meta?.org?.logo ? (
          <img src={meta.org.logo} alt={meta.org.name} className="h-12 mx-auto mb-5 object-contain" />
        ) : (
          <div className="w-12 h-12 rounded-2xl mx-auto mb-5 flex items-center justify-center text-white font-black text-lg"
            style={{ background: accent }}>{meta?.org?.name?.[0] || "A"}</div>
        )}
        <CheckCircle2 className="h-14 w-14 mx-auto mb-4" style={{ color: accent }} />
        <h2 className="text-xl font-black text-gray-800 mb-2">Thank You!</h2>
        <p className="text-sm text-gray-500 leading-relaxed">
          Your enquiry has been submitted. Our team will contact you shortly.
        </p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen py-8 px-4" style={{ background: "#f3f4f6" }}>
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          {meta?.org?.logo ? (
            <img src={meta.org.logo} alt={meta.org.name} className="h-14 mx-auto mb-3 object-contain" />
          ) : (
            <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center text-white font-black text-xl"
              style={{ background: accent }}>{meta?.org?.name?.[0] || "A"}</div>
          )}
          {meta?.project && (
            <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: accent }}>
              {meta.project.name}
            </p>
          )}
          <h1 className="text-2xl font-black text-gray-800">Enquiry Form</h1>
          <p className="text-sm text-gray-500 mt-1">{meta?.org?.name}</p>
        </div>

        {/* Form card */}
        <div className="rounded-3xl shadow-lg p-6 space-y-4" style={{ background: "#fff" }}>
          {field("name", "Full Name *", "text", "Enter your name")}
          {field("phone", "Phone Number *", "tel", "+91 XXXXX XXXXX")}
          {field("email", "Email Address", "email", "optional")}

          <div>
            <label className="block text-sm font-semibold mb-1" style={{ color: "#374151" }}>Property Type</label>
            <select
              value={form.propertyType}
              onChange={(e) => setForm((p) => ({ ...p, propertyType: e.target.value }))}
              className="w-full rounded-xl border px-4 py-3 text-sm outline-none"
              style={{ border: "1.5px solid #e5e7eb", background: "#f9fafb", color: "#111827" }}
            >
              {PROPERTY_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>

          {field("budget", "Budget (₹)", "number", "e.g. 5000000")}

          <div>
            <label className="block text-sm font-semibold mb-1" style={{ color: "#374151" }}>Message</label>
            <textarea
              value={form.message}
              onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))}
              placeholder="Any specific requirements…"
              rows={3}
              className="w-full rounded-xl border px-4 py-3 text-sm outline-none resize-none"
              style={{ border: "1.5px solid #e5e7eb", background: "#f9fafb", color: "#111827" }}
            />
          </div>

          {errors._form && (
            <p className="text-sm text-red-500 text-center">{errors._form}</p>
          )}

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full py-3.5 rounded-2xl font-bold text-white text-sm transition hover:opacity-90 flex items-center justify-center gap-2"
            style={{ background: submitting ? "#d1d5db" : accent }}
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting ? "Submitting…" : "Submit Enquiry"}
          </button>

          <p className="text-center text-xs text-gray-400 pt-1">
            Powered by <span className="font-semibold" style={{ color: accent }}>Arthaleads</span>
          </p>
        </div>
      </div>
    </div>
  );
}
