// actions/_shared.js — helpers common to lead actions.
const Joi = require("joi");
const { findLeadById } = require("../utils/leadLookup");
const { AppError } = require("../middlewares/errorHandler");

const objectId = Joi.string().hex().length(24);

/**
 * Resolve a lead across both collections.
 *
 * Regular leads and project leads are separate models with separate services.
 * The copilot can describe either, so an action that only queried Lead would
 * answer "Lead not found" for one it had just discussed — the failure mode
 * utils/leadLookup.js exists to prevent.
 */
async function resolveLead(leadId, user) {
  const found = await findLeadById(leadId, user.orgId);
  if (!found.doc || found.doc.isDeleted === true) throw new AppError("Lead not found.", 404);
  return found;
}

module.exports = { objectId, resolveLead, Joi };
