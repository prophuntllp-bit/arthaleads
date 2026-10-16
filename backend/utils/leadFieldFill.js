// Which lead details an automatic reader may write, shared by the WhatsApp chat
// reader (routes/whatsappRoutes.js readLeadDetailsFromChat) and the Vistrow
// Voice call result (routes/webhookRoutes.js POST /lead). One set of rules, so a
// detail a buyer says on a call is handled exactly like one they type on
// WhatsApp:
//   * a field is filled only while it is still empty: "N/A" (or blank) for
//     property type / purpose / BHK, "" for location, no min and no max for
//     budget;
//   * property type may also replace a value the CRM itself guessed from the
//     chat's project (projectType), never anything else;
//   * a stated value that differs from a real value already on the lead is
//     never written; it becomes an Artha suggestion (lead.arthaSuggest) for a
//     person to confirm or dismiss, unless that value was dismissed before.
// Form defaults ("Apartment", "Buy" on the add-lead form) cannot be told apart
// from a person's choice, so they count as real values.

const SUGGESTABLE = ["propertyType", "purpose", "bhk", "preferredLocation", "budget"];

const sameValue = (a, b) => (a && typeof a === "object")
  ? (a.min || 0) === (b?.min || 0) && (a.max || 0) === (b?.max || 0)
  : String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();

const isBlank = (k, v) => k === "budget" ? !(v?.min || v?.max) : (!v || v === "N/A");

/**
 * @param {object} lead    current values (propertyType, purpose, bhk, preferredLocation, budget)
 * @param {object} mapped  what the buyer stated, already matched to the lead's enums
 * @param {{ projectType?: string|null }} opts  the type the CRM guessed from the project, if any
 * @returns {object} the $set for fields that may be written now
 */
function planFieldFill(lead, mapped, { projectType = null } = {}) {
  const setOps = {};
  // The buyer's own words win over the project's type (which only ever fills
  // an empty field), so "I want a flat" after a plot ad corrects it.
  const typeWasGuessed = isBlank("propertyType", lead.propertyType) || (projectType && lead.propertyType === projectType);
  if (mapped.propertyType && typeWasGuessed && mapped.propertyType !== lead.propertyType) setOps.propertyType = mapped.propertyType;
  else if (!mapped.propertyType && isBlank("propertyType", lead.propertyType) && projectType) setOps.propertyType = projectType;
  if (mapped.purpose && isBlank("purpose", lead.purpose))                 setOps.purpose = mapped.purpose;
  if (mapped.bhk && isBlank("bhk", lead.bhk))                             setOps.bhk = mapped.bhk;
  if (mapped.preferredLocation && !lead.preferredLocation)                setOps.preferredLocation = mapped.preferredLocation;
  if (mapped.budget && isBlank("budget", lead.budget))                    setOps.budget = mapped.budget;
  return setOps;
}

// Fields the buyer stated that differ from a real value already on the lead,
// minus anything the team dismissed before.
function suggestionsFrom(lead, mapped, setOps) {
  const out = {};
  const dismissed = lead.arthaSuggest?.dismissed || {};
  for (const k of SUGGESTABLE) {
    const said = mapped[k];
    if (said === undefined || isBlank(k, said) || k in setOps) continue;
    if (isBlank(k, lead[k]) || sameValue(said, lead[k])) continue;
    if ((dismissed[k] || []).some((d) => sameValue(said, d))) continue;
    out[k] = k === "budget" ? { min: said.min || 0, max: said.max || 0 } : said;
  }
  return out;
}

const LABEL = { propertyType: "Property type", purpose: "Purpose", bhk: "BHK", preferredLocation: "Location", budget: "Budget" };

function rupees(n) {
  if (n >= 1e7) return `₹${+(n / 1e7).toFixed(2)} Cr`;
  if (n >= 1e5) return `₹${+(n / 1e5).toFixed(2)} L`;
  return `₹${Number(n).toLocaleString("en-IN")}`;
}

function showValue(k, v) {
  if (k === "budget") {
    if (!v || (!v.min && !v.max)) return "empty";
    return v.min && v.max && v.min !== v.max ? `${rupees(v.min)} - ${rupees(v.max)}` : rupees(v.max || v.min);
  }
  return v && v !== "N/A" ? String(v) : "empty";
}

// "Budget ₹1 Cr, Purpose Buy" in a fixed order.
function describeFields(fields) {
  return SUGGESTABLE.filter((k) => fields[k] !== undefined).map((k) => `${LABEL[k]} ${showValue(k, fields[k])}`).join(", ");
}

module.exports = { planFieldFill, suggestionsFrom, sameValue, isBlank, describeFields, showValue, SUGGESTABLE, LABEL };
