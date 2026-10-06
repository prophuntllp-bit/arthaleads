// A project lead that is deleted goes to Dump as a Lead. This used to copy only
// its name, phone, email and source, so the Dump row said nothing about where
// the person came from, and restoring it returned a bare contact with every
// remark, note and follow-up gone. This copies everything the Lead can hold and
// records where it was deleted from, so Restore can put it back there.

const VALID_SOURCES = ["Facebook", "Google", "WhatsApp", "Manual", "Website", "Referral", "Walk-in", "PropTiger", "99acres", "MagicBricks", "Other"];

function plain(v) {
  return v && typeof v.toObject === "function" ? v.toObject() : v;
}

function leadFromProjectLead(plDoc, user, project) {
  const pl = plain(plDoc);
  const doc = {
    orgId: user.orgId,
    createdBy: pl.importedBy || user._id,
    createdAt: pl.createdAt,

    name: pl.name,
    phone: pl.phone,
    email: pl.email || "",
    source: VALID_SOURCES.includes(pl.source) ? pl.source : "Other",

    leadSourceLabel: pl.leadSourceLabel || "",
    sourcePage:      pl.sourcePage || "",
    sourceDomain:    pl.sourceDomain || "",
    formPlugin:      pl.formPlugin || "",
    campaignRef:     pl.campaignRef?.adId || pl.campaignRef?.headline ? pl.campaignRef : undefined,

    status:   pl.status || "New",
    priority: pl.priority || undefined,

    propertyType:      pl.propertyType,
    bhk:               pl.bhk,
    purpose:           pl.purpose,
    budget:            pl.budget,
    timeline:          pl.timeline || "",
    preferredLocation: pl.preferredLocation || "",
    city:              pl.city || "",
    streetAddress:     pl.streetAddress || "",
    requirements:      pl.requirements || "",
    formResponses:     (pl.formResponses || []).map((r) => ({ fieldKey: r.fieldKey, label: r.label, value: r.value })),
    tags:              pl.tags || [],

    assignedTo:     pl.assignedTo || undefined,
    assignedToName: pl.assignedToName || "",

    remark1: pl.remark1 || "",
    remark2: pl.remark2 || "",
    remark3: pl.remark3 || "",
    remark4: pl.remark4 || "",
    remark:  pl.remarkNote || "",
    followUpDate: pl.followUp || null,
    followUp2:    pl.followUp2 || null,
    followUpNote: pl.followUpNote || "",
    booking:      pl.booking || "",
    siteVisitDate: pl.siteVisitDate || null,
    siteVisitDone: !!pl.siteVisitDone,
    firstContactedAt: pl.firstContactedAt || null,

    notes: (pl.notes || []).map((n) => ({ text: n.text, addedBy: n.addedBy, addedByName: n.addedByName, createdAt: n.createdAt })),
    activities: [
      ...(pl.activities || []).map((a) => ({ type: a.type, description: a.description, performedBy: a.performedBy, performedByName: a.performedByName, meta: a.meta, createdAt: a.createdAt })),
      { type: "status_changed", description: `Deleted from ${project?.name || "a project"}`, performedBy: user._id, performedByName: user.name || "", meta: { deletedFromProject: project?._id } },
    ],

    isDeleted: true,
    deletedAt: new Date(),
    deletedBy: user._id,
    deletedByName: user.name || "",
    deletedFrom: { kind: "project", projectId: project?._id, projectName: project?.name || "" },
  };
  // Leave unset fields to their schema defaults rather than writing undefined.
  for (const k of Object.keys(doc)) if (doc[k] === undefined) delete doc[k];
  return doc;
}

module.exports = { leadFromProjectLead };
