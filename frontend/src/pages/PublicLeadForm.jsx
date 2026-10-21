import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { CheckCircle2, Loader2, Phone, MessageCircle, RotateCcw } from "lucide-react";
import { API_BASE } from "../services/api";

// The QR enquiry form a visitor opens from a poster (/form/:token).
//
// 21 Oct 2026: this used to build the server address with
// VITE_API_URL.replace("/api", ""), which removes the FIRST "/api", the one
// inside "//api.arthaleads.com". Every request went to the website itself:
// the form loaded the site's HTML as if it were the company (a blank, generic
// form for any QR) and no enquiry ever reached the CRM. It now uses API_BASE
// (".../api") as is, and only believes a reply that says success: true.
const FORM_URL = (token) => `${API_BASE}/public/form/${encodeURIComponent(token)}`;

const PROPERTY_TYPES = ["Apartment", "Villa", "Plot", "Commercial", "Office", "Penthouse", "Other"];
const EMPTY = {
  name: "", phone: "", email: "",
  propertyType: "Apartment", budget: "", message: "",
  // Unticked by default on purpose: a pre-ticked consent box is not consent.
  whatsappConsent: false,
  // Hidden from people; a bot that fills every field fills this too.
  company_website: "",
};

const digitsOf = (v) => String(v || "").replace(/\D/g, "");

export default function PublicLeadForm() {
  const { token } = useParams();
  const [meta, setMeta]         = useState(null);   // { type, org, project }
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    document.title = "Enquiry Form";
    axios.get(FORM_URL(token))
      .then((r) => {
        // Only a real answer from the CRM: anything else (an HTML page, a proxy
        // error) is a failure, never a blank form that quietly loses enquiries.
        if (r.data?.success !== true || !r.data.org?.name) throw new Error("bad reply");
        setMeta(r.data);
        document.title = `Enquiry – ${r.data.project?.name ? `${r.data.project.name}, ` : ""}${r.data.org.name}`;
      })
      .catch((e) => setError(e.response?.data?.message || "This form couldn't load. Check your internet connection and scan the QR code again."))
      .finally(() => setLoading(false));
  }, [token]);

  const accent = meta?.org?.brandColor || "#FF6B00";
  const orgName = meta?.org?.name || "";
  const orgDigits = digitsOf(meta?.org?.phone);
  const waDigits = orgDigits.length === 10 ? `91${orgDigits}` : orgDigits;

  const validate = () => {
    const e = {};
    if (form.name.trim().length < 2) e.name = "Please enter your name";
    if (!form.phone.trim()) e.phone = "Phone is required";
    else if (digitsOf(form.phone).length < 10 || digitsOf(form.phone).length > 13) e.phone = "Enter a valid mobile number (10 digits)";
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) e.email = "Enter a valid email";
    return e;
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSubmitting(true);
    try {
      // application/x-www-form-urlencoded: a CORS "simple request", no preflight.
      const params = new URLSearchParams();
      Object.entries(form).forEach(([k, v]) => { if (v !== "" && v !== false) params.append(k, v); });
      const { data } = await axios.post(FORM_URL(token), params);
      if (data?.success !== true) throw new Error("not saved");
      setSubmitted(true);
      window.scrollTo(0, 0);
    } catch (err) {
      setErrors({
        _form: err.response?.data?.message
          || (err.response ? "We couldn't send your enquiry. Please try again." : "No internet connection. Your details are still here: tap Submit again once you're online."),
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Staff at a stall fill this in for one visitor after another.
  const another = () => {
    setForm(EMPTY);
    setErrors({});
    setSubmitted(false);
  };

  const field = (key, label, type = "text", placeholder = "", inputMode) => (
    <div>
      <label className="block text-sm font-semibold mb-1" style={{ color: "#374151" }} htmlFor={`f-${key}`}>{label}</label>
      <input
        id={`f-${key}`}
        type={type}
        inputMode={inputMode}
        value={form[key]}
        onChange={(e) => { setForm((p) => ({ ...p, [key]: e.target.value })); setErrors((p) => ({ ...p, [key]: "", _form: "" })); }}
        placeholder={placeholder}
        className="w-full rounded-xl border px-4 py-3 text-base outline-none transition"
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

  const logo = (size) => (meta?.org?.logo ? (
    <img src={meta.org.logo} alt={orgName} className={`${size === "lg" ? "h-14" : "h-12"} mx-auto mb-3 object-contain`} />
  ) : (
    <div className={`${size === "lg" ? "w-14 h-14 text-xl" : "w-12 h-12 text-lg"} rounded-2xl mx-auto mb-3 flex items-center justify-center text-white font-black`}
      style={{ background: accent }}>{orgName?.[0] || "A"}</div>
  ));

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#f3f4f6" }}>
      <Loader2 className="h-8 w-8 animate-spin" style={{ color: "#FF6B00" }} />
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "#f3f4f6" }}>
      <div className="max-w-sm w-full text-center p-8 rounded-3xl shadow-lg" style={{ background: "#fff" }}>
        <p className="text-2xl mb-3" aria-hidden="true">🔗</p>
        <h2 className="text-lg font-bold text-gray-800 mb-2">This form isn't available</h2>
        <p className="text-sm text-gray-500 mb-5">{error}</p>
        <button type="button" onClick={() => window.location.reload()}
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white" style={{ background: "#FF6B00" }}>
          <RotateCcw className="h-4 w-4" /> Try again
        </button>
      </div>
    </div>
  );

  if (submitted) return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "#f3f4f6" }}>
      <div className="max-w-sm w-full text-center p-8 rounded-3xl shadow-lg" style={{ background: "#fff" }}>
        {logo()}
        <CheckCircle2 className="h-14 w-14 mx-auto mb-4" style={{ color: accent }} />
        <h2 className="text-xl font-black text-gray-800 mb-2">Thank you!</h2>
        <p className="text-sm text-gray-500 leading-relaxed">
          {orgName} has your enquiry{meta?.project ? ` for ${meta.project.name}` : ""}. Someone from the team will contact you shortly.
        </p>
        {orgDigits.length >= 10 && (
          <div className="mt-6 grid grid-cols-2 gap-3">
            <a href={`tel:+${waDigits}`}
              className="flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold"
              style={{ border: `1.5px solid ${accent}`, color: accent }}>
              <Phone className="h-4 w-4" /> Call us
            </a>
            <a href={`https://wa.me/${waDigits}?text=${encodeURIComponent(`Hi ${orgName}, I just sent an enquiry${meta?.project ? ` for ${meta.project.name}` : ""}.`)}`}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white"
              style={{ background: "#25D366" }}>
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </a>
          </div>
        )}
        <button type="button" onClick={another} className="mt-5 text-sm font-semibold underline" style={{ color: "#6b7280" }}>
          Submit another enquiry
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen py-8 px-4" style={{ background: "#f3f4f6" }}>
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          {logo("lg")}
          {meta?.project && (
            <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: accent }}>
              {meta.project.name}{meta.project.location ? ` · ${meta.project.location}` : ""}
            </p>
          )}
          <h1 className="text-2xl font-black text-gray-800">Enquiry form</h1>
          <p className="text-sm text-gray-500 mt-1">{orgName}</p>
        </div>

        {/* Form card */}
        <form onSubmit={handleSubmit} noValidate className="rounded-3xl shadow-lg p-6 space-y-4" style={{ background: "#fff" }}>
          {field("name", "Full name *", "text", "Enter your name")}
          {field("phone", "Mobile number *", "tel", "98200 12345", "tel")}
          {field("email", "Email", "email", "Optional")}

          {/* Hidden from people (and screen readers); bots fill it. */}
          <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}>
            <label>Company website
              <input type="text" tabIndex={-1} autoComplete="off" value={form.company_website}
                onChange={(e) => setForm((p) => ({ ...p, company_website: e.target.value }))} />
            </label>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1" style={{ color: "#374151" }} htmlFor="f-type">Property type</label>
            <select
              id="f-type"
              value={form.propertyType}
              onChange={(e) => setForm((p) => ({ ...p, propertyType: e.target.value }))}
              className="w-full rounded-xl border px-4 py-3 text-base outline-none"
              style={{ border: "1.5px solid #e5e7eb", background: "#f9fafb", color: "#111827" }}
            >
              {PROPERTY_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>

          {field("budget", "Budget (₹)", "text", "50,00,000", "numeric")}

          <div>
            <label className="block text-sm font-semibold mb-1" style={{ color: "#374151" }} htmlFor="f-msg">Message</label>
            <textarea
              id="f-msg"
              value={form.message}
              onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))}
              placeholder="Any specific requirements"
              rows={3}
              maxLength={1000}
              className="w-full rounded-xl border px-4 py-3 text-base outline-none resize-none"
              style={{ border: "1.5px solid #e5e7eb", background: "#f9fafb", color: "#111827" }}
            />
          </div>

          <label className="flex items-start gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.whatsappConsent}
              onChange={(e) => setForm((p) => ({ ...p, whatsappConsent: e.target.checked }))}
              className="mt-0.5 h-4 w-4 shrink-0 rounded"
              style={{ accentColor: accent }}
            />
            <span className="text-xs leading-relaxed" style={{ color: "#4b5563" }}>
              I agree to receive property updates from {orgName || "this company"} on WhatsApp. I can opt out at any time.
            </span>
          </label>

          {errors._form && (
            <p className="text-sm text-red-500 text-center" role="alert">{errors._form}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 rounded-2xl font-bold text-white text-sm transition hover:opacity-90 flex items-center justify-center gap-2"
            style={{ background: submitting ? "#d1d5db" : accent }}
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting ? "Sending…" : "Submit enquiry"}
          </button>

          <p className="text-center text-xs text-gray-400 pt-1">
            Powered by <span className="font-semibold" style={{ color: accent }}>Arthaleads</span>
          </p>
        </form>
      </div>
    </div>
  );
}
