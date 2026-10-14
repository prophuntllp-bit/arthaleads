// "Called Rahul, wants 2 BHK, visit Saturday 11, call him Friday": everything
// a call or visit changes, proposed as ONE card instead of four. Regular leads
// only (project leads use update_project_lead_booking). Goes through
// leadService like the lead form, so history, pushes and reports behave the same.
const { objectId, resolveLead, Joi } = require("./_shared");
const OPTS = require("../constants/leadOptions");
const leadService = require("../services/leadService");
const { AppError } = require("../middlewares/errorHandler");
const { formatISTDateTime } = require("../utils/datetime");

const FIELDS = {
  status:            { label: "Status",     options: OPTS.STATUS },
  followUpDate:      { label: "Follow-up",  date: true },
  siteVisitDate:     { label: "Site visit", date: true },
  bhk:               { label: "BHK",        options: OPTS.BHK },
  propertyType:      { label: "Property",   options: OPTS.PROPERTY_TYPE },
  purpose:           { label: "Purpose",    options: OPTS.PURPOSE },
  priority:          { label: "Priority",   options: OPTS.PRIORITY },
  preferredLocation: { label: "Preferred location", text: true },
  city:              { label: "City",       text: true },
  streetAddress:     { label: "Address",    text: true },
};
const show = (key, v) => (v == null || v === "" ? "(none)" : FIELDS[key]?.date ? formatISTDateTime(v) : String(v));

module.exports = {
  id: "log_lead_update",
  v2Only: true,
  scopeLabel: "Leads",
  pages: "*",
  roles: ["admin", "manager", "agent"],
  params: Joi.object({
    leadId: objectId.required(),
    note: Joi.string().trim().max(1000),
    status: Joi.string().valid(...OPTS.STATUS),
    followUpDate: Joi.date(),
    siteVisitDate: Joi.date(),
    bhk: Joi.string().valid(...OPTS.BHK),
    propertyType: Joi.string().valid(...OPTS.PROPERTY_TYPE),
    purpose: Joi.string().valid(...OPTS.PURPOSE),
    priority: Joi.string().valid(...OPTS.PRIORITY),
    preferredLocation: Joi.string().trim().max(120).description("Where the buyer wants to buy: the area or locality they are looking in (e.g. Baner, Hinjewadi). NOT where they live."),
    city: Joi.string().trim().max(80).description("The city the buyer lives in (e.g. 'he lives in Pune' -> Pune). Not where they want to buy."),
    streetAddress: Joi.string().trim().max(200).description("The buyer's own home address, if they gave it."),
  }).min(2),
  describe: {
    summary: "Log a call or visit on a lead: note plus any of status, follow-up, site visit and requirements, as one change",
    params: "{ leadId, note?, status?, followUpDate?, siteVisitDate?, bhk?, propertyType?, purpose?, priority?, preferredLocation?, city?, streetAddress? }",
    when: "When the user reports what happened on a call or visit, or asks for several changes to one lead at once. Regular leads only.",
  },

  async preview({ params, user }) {
    const { doc, isProject } = await resolveLead(params.leadId, user);
    if (isProject) throw new AppError("This is a project lead. Use the project lead outcome instead.", 400);
    // Only what actually changes: "2BHK -> 2BHK" is noise on a card someone has to read.
    const differs = (k) => show(k, doc[k]) !== show(k, params[k]);
    const fields = Object.entries(FIELDS).filter(([k]) => k in params && differs(k)).map(([k, meta]) => ({
      label: meta.label, param: k, from: show(k, doc[k]), to: show(k, params[k]),
      editor: meta.options ? { type: "select", value: params[k], options: meta.options }
        : meta.date ? { type: "datetime", value: new Date(new Date(params[k]).getTime() + 5.5 * 3600e3).toISOString().slice(0, 16) }
        : { type: "text", value: params[k] },
    }));
    if (params.note) fields.push({ label: "Note", param: "note", from: null, to: params.note, editor: { type: "text", value: params.note } });
    return { subject: doc.name, fields };
  },

  async captureBefore({ params, user }) {
    const { doc } = await resolveLead(params.leadId, user);
    const fields = {};
    for (const k of Object.keys(FIELDS)) if (k in params) fields[k] = doc[k] ?? null;
    return { leadId: params.leadId, fields };
  },

  async execute({ params, user }) {
    const { leadId, note, ...updates } = params;
    const { doc, isProject } = await resolveLead(leadId, user);
    if (isProject) throw new AppError("This is a project lead. Use the project lead outcome instead.", 400);
    // Named before the update: leadService.update adds its own keys to the object it is given.
    const changed = Object.keys(updates).filter((k) => FIELDS[k]);
    if (changed.length) await leadService.update(leadId, { ...updates }, user);
    let noteId = null;
    if (note) {
      const saved = await leadService.addNote(leadId, note, user);
      noteId = String(saved.notes[saved.notes.length - 1]._id);
    }
    const what = [...changed.map((k) => FIELDS[k].label.toLowerCase()), ...(note ? ["a note"] : [])];
    return { message: `Updated ${doc.name}: ${what.join(", ")}.`, data: { leadId, updates, noteId } };
  },

  async undo({ before, result, user }) {
    if (Object.keys(before.fields || {}).length) await leadService.update(before.leadId, { ...before.fields }, user);
    const noteId = result?.data?.noteId;
    if (noteId) await leadService.deleteNote(before.leadId, noteId, user).catch(() => {});
    return { message: "Put the lead back as it was." };
  },
};
