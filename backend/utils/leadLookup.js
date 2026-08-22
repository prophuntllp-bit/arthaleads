// utils/leadLookup.js — resolve a lead that may live in either collection.
//
// Regular Leads and Project leads are separate models with separate _id
// namespaces but identically-shaped documents (name, phone, activities, ...).
// Code that queries only Lead therefore goes silently blind to project leads:
// it does not error, it just finds nothing — which has produced a string of
// bugs where calls dead-ended, inbound calls were routed to the wrong person,
// and call activity vanished entirely.
//
// ObjectIds are globally unique, so trying Lead first and falling back to
// ProjectLead can never return the wrong document.
//
// Use these helpers instead of querying Lead directly whenever the id or phone
// could belong to a project lead.
const Lead = require("../models/Lead");
const ProjectLead = require("../models/ProjectLead");

/**
 * Find a lead by id in either collection.
 * @returns {{doc: object|null, Model: object|null, isProject: boolean}}
 */
async function findLeadById(id, orgId, { lean = false, select = null } = {}) {
  const build = (Model) => {
    let q = Model.findOne({ _id: id, orgId });
    if (select) q = q.select(select);
    return lean ? q.lean() : q;
  };

  let doc = await build(Lead);
  if (doc) return { doc, Model: Lead, isProject: false };

  doc = await build(ProjectLead);
  if (doc) return { doc, Model: ProjectLead, isProject: true };

  return { doc: null, Model: null, isProject: false };
}

/**
 * Find a lead by phone in either collection, matching on the last 10 digits
 * (numbers are stored in mixed formats: +91…, 0…, bare 10-digit).
 * @returns {{doc: object|null, Model: object|null, isProject: boolean}}
 */
async function findLeadByPhone(phone, orgId, { lean = true, select = null } = {}) {
  const last10 = String(phone || "").replace(/\D/g, "").slice(-10);
  if (last10.length < 8) return { doc: null, Model: null, isProject: false };

  const query = {
    orgId,
    phone: { $regex: last10 + "$", $options: "i" },
    isDeleted: { $ne: true },   // also matches documents without the field
  };
  const build = (Model) => {
    let q = Model.findOne(query);
    if (select) q = q.select(select);
    return lean ? q.lean() : q;
  };

  let doc = await build(Lead);
  if (doc) return { doc, Model: Lead, isProject: false };

  doc = await build(ProjectLead);
  if (doc) return { doc, Model: ProjectLead, isProject: true };

  return { doc: null, Model: null, isProject: false };
}

/**
 * Run the same query against both collections and merge the results, tagging
 * each row so callers can tell them apart. For list/search endpoints.
 */
async function searchBothLeadTypes(query, { select = null, limit = 20 } = {}) {
  const build = (Model) => {
    let q = Model.find(query);
    if (select) q = q.select(select);
    return q.limit(limit).lean();
  };

  const [leads, projectLeads] = await Promise.all([build(Lead), build(ProjectLead)]);
  return [
    ...leads.map((l) => ({ ...l, _type: "lead" })),
    ...projectLeads.map((l) => ({ ...l, _type: "project" })),
  ];
}

module.exports = { findLeadById, findLeadByPhone, searchBothLeadTypes, Lead, ProjectLead };
