// actions/index.js — the copilot's action registry.
//
// One entry per thing the copilot may do. The entry carries its own gates, so
// adding a capability and adding its permission check are the same edit; there
// is no separate place to forget one.
//
// The registry is also what generates the catalogue shown to the model, which
// means the model is never told about an action this user, on this page, could
// not run. That is a token saving and a smaller surface — it is NOT the
// enforcement. Enforcement is `authorise()` below, which runs server-side on
// every execution regardless of what the model was told.

const Joi = require("joi");
const { AppError } = require("../middlewares/errorHandler");

const ENTRIES = [
  require("./updateLeadStatus"),
  require("./setFollowup"),
  require("./assignLead"),
  require("./completeTask"),
  require("./addLeadNote"),
  require("./updateLeadFields"),
  require("./createLead"),
  require("./updateProjectLeadBooking"),
  require("./bulkUpdateStatus"),
];

const byId = new Map(ENTRIES.map((a) => [a.id, a]));

/** Normalise "/leads?tab=all" and "/leads/" to "/leads". */
function normalisePage(page) {
  const clean = String(page || "").split("?")[0].replace(/\/+$/, "");
  return clean === "" ? "/" : clean;
}

const allowsRole = (action, role) => action.roles.includes(role);
const allowsPage = (action, page) =>
  action.pages === "*" || action.pages.includes(normalisePage(page));

/**
 * Actions this user may run from this page. Used to build the model's
 * catalogue — filtered so it cannot propose something that would be refused.
 */
function availableFor({ role, page }) {
  return ENTRIES.filter((a) => allowsRole(a, role) && allowsPage(a, page));
}

/**
 * The four gates, in order. Throws AppError; returns validated params.
 *
 * Page is deliberately checked after role. Role is a real security boundary —
 * it is derived from the session. Page arrives from the browser and can be
 * claimed, so it is a scope guardrail that keeps the copilot predictable, not
 * a permission. Never let it stand in for the role check.
 */
function authorise({ id, params, role, page, scopeConfirmed }) {
  const action = byId.get(id);
  if (!action) throw new AppError("Unknown action type.", 400);

  if (!allowsRole(action, role)) {
    throw new AppError(
      `Your role cannot ${action.describe.summary.toLowerCase()}. Ask an admin or manager.`,
      403
    );
  }

  if (!allowsPage(action, page) && !scopeConfirmed) {
    const err = new AppError(
      `That is a ${action.scopeLabel} change and you are on ${normalisePage(page)}.`,
      409
    );
    err.needsScopeChange = true;
    err.scopeLabel = action.scopeLabel;
    err.allowedPages = action.pages;
    throw err;
  }

  const { value, error } = action.params.validate(params || {}, { stripUnknown: true });
  if (error) throw new AppError(error.details[0].message, 400);

  return { action, params: value };
}

/**
 * The catalogue spliced into the system prompt, describing only what is
 * runnable right now. Returns "" when nothing is — which correctly tells the
 * model it has no write actions available at all.
 */
function catalogueFor({ role, page }) {
  const usable = availableFor({ role, page });
  if (!usable.length) return "";

  const lines = usable.map((a, i) => {
    const d = a.describe;
    return [
      `${i + 1}. ${a.id} - ${d.summary}`,
      `   params: ${d.params}`,
      d.when ? `   ${d.when}` : "",
    ].filter(Boolean).join("\n");
  });

  return lines.join("\n\n");
}

module.exports = { ENTRIES, byId, availableFor, authorise, catalogueFor, normalisePage, Joi };
