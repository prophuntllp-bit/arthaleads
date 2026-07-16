// Shared Google Lead Form field mapping — used by both the push webhook
// (POST /webhook/google, Google's user_column_data shape) and the Google Ads
// API poller (lead_form_submission_fields shape), so a "FULL_NAME"/
// "PHONE_NUMBER" column is interpreted identically regardless of which path
// delivered it.

const NAME_KEYS  = ["FULL_NAME"];
const FIRST_KEYS = ["FIRST_NAME"];
const LAST_KEYS  = ["LAST_NAME"];
const PHONE_KEYS = ["PHONE_NUMBER", "WORK_PHONE_NUMBER"];
const EMAIL_KEYS = ["EMAIL", "WORK_EMAIL"];
const STANDARD_KEYS = new Set([...NAME_KEYS, ...FIRST_KEYS, ...LAST_KEYS, ...PHONE_KEYS, ...EMAIL_KEYS]);

// entries: [{ id, label, value }] — already normalized from either Google shape.
// Anything whose id isn't a known standard key is treated as a custom question
// (label is the human-readable question text the advertiser configured).
function mapGoogleLeadFields(entries) {
  const byId = new Map();
  for (const e of entries) {
    if (e && e.id) byId.set(String(e.id).toUpperCase(), e);
  }
  const valueOf = (keys) => {
    for (const k of keys) {
      const v = byId.get(k)?.value;
      if (v) return String(v).trim();
    }
    return "";
  };

  const fullName = valueOf(NAME_KEYS)
    || [valueOf(FIRST_KEYS), valueOf(LAST_KEYS)].filter(Boolean).join(" ").trim();
  const phone = valueOf(PHONE_KEYS);
  const email = valueOf(EMAIL_KEYS);

  const customFields = entries.filter((e) => e?.id && !STANDARD_KEYS.has(String(e.id).toUpperCase()) && e.value);
  const formResponses = customFields.map((e) => ({
    fieldKey: String(e.id),
    label: e.label || String(e.id).replace(/_/g, " "),
    value: String(e.value),
  }));
  const requirements = customFields.map((e) => `${e.label || e.id}: ${e.value}`).join(" · ");

  return { fullName, phone, email, formResponses, requirements, customFields };
}

// POST /webhook/google's user_column_data: [{ column_id, column_name, string_value }]
function fromWebhookColumns(columns) {
  return (Array.isArray(columns) ? columns : []).map((c) => ({
    id: c?.column_id, label: c?.column_name, value: c?.string_value,
  }));
}

// Google Ads API's lead_form_submission_fields: [{ field_type, field_value }]
// (no separate human-readable label field — field_type doubles as both)
function fromApiFields(fields) {
  return (Array.isArray(fields) ? fields : []).map((f) => ({
    id: f?.fieldType ?? f?.field_type, label: f?.fieldType ?? f?.field_type, value: f?.fieldValue ?? f?.field_value,
  }));
}

module.exports = { mapGoogleLeadFields, fromWebhookColumns, fromApiFields };
