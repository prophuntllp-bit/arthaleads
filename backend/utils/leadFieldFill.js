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
//   * an untouched default counts as empty: "Apartment" / "Buy" are what the
//     schema and the add-lead form put on every lead whose source did not say
//     (a Facebook form that never asked), so a buyer's stated "Plot" replaces
//     it. Only on leads an integration created (Facebook, Google, website...):
//     not on leads a person typed in (Manual / Walk-in / Referral, where the
//     person saw "Apartment" selected and kept it), not on WhatsApp or Vistrow
//     Voice leads (created with "N/A", so "Apartment" there was a person's
//     pick), and never on a field a person changed after creation
//     (lead.detailsSetByPerson, set by leadService.update).

const SUGGESTABLE = ["propertyType", "purpose", "bhk", "preferredLocation", "budget"];

// Words that only point at a place ("Baner side", "near Baner"), ignored when
// comparing, so "Baner-Balewadi side" and "Baner / Balewadi" are one place.
const FILLER = new Set(["side", "near", "area", "around", "ke", "paas", "pass", "ka", "ki", "and", "or", "the"]);
const placeWords = (v) => String(v || "").toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w && !FILLER.has(w)).sort().join(" ");

const sameValue = (a, b) => (a && typeof a === "object")
  ? (a.min || 0) === (b?.min || 0) && (a.max || 0) === (b?.max || 0)
  : String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase() || (placeWords(a) !== "" && placeWords(a) === placeWords(b));

const isBlank = (k, v) => k === "budget" ? !(v?.min || v?.max) : (!v || v === "N/A");

const SCHEMA_DEFAULT = { propertyType: "Apartment", purpose: "Buy" };
const DEFAULT_IS_A_CHOICE = ["Manual", "Walk-in", "Referral", "WhatsApp", "Vistrow Voice"];

// Fields whose value is still the untouched schema / add-lead-form default.
function untouchedDefaults(lead) {
  if (!lead.source || DEFAULT_IS_A_CHOICE.includes(lead.source)) return [];
  const mine = lead.detailsSetByPerson || [];
  return Object.keys(SCHEMA_DEFAULT).filter((k) => lead[k] === SCHEMA_DEFAULT[k] && !mine.includes(k));
}

/**
 * @param {object} lead    current values (propertyType, purpose, bhk, preferredLocation, budget)
 * @param {object} mapped  what the buyer stated, already matched to the lead's enums
 * @param {{ projectType?: string|null }} opts  the type the CRM guessed from the project, if any
 * @returns {object} the $set for fields that may be written now
 */
function planFieldFill(lead, mapped, { projectType = null } = {}) {
  const setOps = {};
  const defaults = untouchedDefaults(lead);
  const empty = (k) => isBlank(k, lead[k]) || defaults.includes(k);
  // The buyer's own words win over the project's type (which only ever fills
  // an empty field), so "I want a flat" after a plot ad corrects it.
  const typeWasGuessed = empty("propertyType") || (projectType && lead.propertyType === projectType);
  if (mapped.propertyType && typeWasGuessed && mapped.propertyType !== lead.propertyType) setOps.propertyType = mapped.propertyType;
  else if (!mapped.propertyType && isBlank("propertyType", lead.propertyType) && projectType) setOps.propertyType = projectType;
  if (mapped.purpose && empty("purpose") && mapped.purpose !== lead.purpose) setOps.purpose = mapped.purpose;
  if (mapped.bhk && isBlank("bhk", lead.bhk))                             setOps.bhk = mapped.bhk;
  if (mapped.preferredLocation && !lead.preferredLocation)                setOps.preferredLocation = mapped.preferredLocation;
  if (mapped.budget && isBlank("budget", lead.budget))                    setOps.budget = mapped.budget;
  if (mapped.timeline && !lead.timeline)                                  setOps.timeline = mapped.timeline;
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
    if (isBlank(k, lead[k]) || untouchedDefaults(lead).includes(k) || sameValue(said, lead[k])) continue;
    if ((dismissed[k] || []).some((d) => sameValue(said, d))) continue;
    out[k] = k === "budget" ? { min: said.min || 0, max: said.max || 0 } : said;
  }
  return out;
}

const LABEL = { propertyType: "Property type", purpose: "Purpose", bhk: "BHK", preferredLocation: "Location", budget: "Budget", timeline: "Timeline" };

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
  return [...SUGGESTABLE, "timeline"].filter((k) => fields[k] !== undefined).map((k) => `${LABEL[k]} ${showValue(k, fields[k])}`).join(", ");
}

module.exports = { planFieldFill, suggestionsFrom, untouchedDefaults, sameValue, isBlank, describeFields, showValue, SUGGESTABLE, LABEL };
