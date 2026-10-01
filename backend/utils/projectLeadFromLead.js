// A lead moved into a project becomes a ProjectLead and the original Lead is
// archived. This used to copy only name, phone, email, source and remarks, so
// everything else (budget, timeline, purpose, status, priority, form answers,
// notes, call history, assignee, and the date the lead actually arrived) was
// left behind on the archived copy where nobody could see it. This copies it
// all, and keeps the lead's own created date so date filters and sorting still
// find it where it belongs.

function plain(v) {
  return v && typeof v.toObject === "function" ? v.toObject() : v;
}

function projectLeadFromLead(leadDoc, toProjectId, user, { projectName = "" } = {}) {
  const lead = plain(leadDoc);
  const doc = {
    project:    toProjectId,
    importedBy: user._id,
    orgId:      user.orgId,

    fromLeadId:    lead._id,
    transferredAt: new Date(),
    createdAt:     lead.createdAt,

    name:   lead.name,
    phone:  lead.phone,
    email:  lead.email || "",
    source: lead.source || "Manual",

    leadSourceLabel: lead.leadSourceLabel || "",
    sourcePage:      lead.sourcePage      || "",
    sourceDomain:    lead.sourceDomain    || "",
    formPlugin:      lead.formPlugin      || "",
    campaignRef:     lead.campaignRef     || undefined,

    status:   lead.status   || "",
    priority: lead.priority || undefined,

    propertyType:      lead.propertyType,
    bhk:               lead.bhk,
    purpose:           lead.purpose,
    budget:            lead.budget ? { min: lead.budget.min || 0, max: lead.budget.max || 0, currency: lead.budget.currency || "INR" } : undefined,
    timeline:          lead.timeline          || "",
    preferredLocation: lead.preferredLocation || "",
    city:              lead.city              || "",
    streetAddress:     lead.streetAddress     || "",
    requirements:      lead.requirements      || "",
    formResponses:     (lead.formResponses || []).map((r) => ({ fieldKey: r.fieldKey, label: r.label, value: r.value })),
    tags:              lead.tags || [],

    assignedTo:     lead.assignedTo     || null,
    assignedToName: lead.assignedToName || "",

    remark1:    lead.remark1 || "",
    remark2:    lead.remark2 || "",
    remark3:    lead.remark3 || "",
    remark4:    lead.remark4 || "",
    // Lead.remark is a plain note; ProjectLead.remark is a Contacted/Not
    // Contacted flag, so the note goes to remarkNote.
    remarkNote: lead.remark || "",
    followUp:   lead.followUpDate || null,
    followUp2:  lead.followUp2    || null,
    followUpNote:      lead.followUpNote      || "",
    followUpSetBy:     lead.followUpSetBy     || null,
    followUpSetByName: lead.followUpSetByName || "",
    booking:    lead.booking || "",
    siteVisitDate: lead.siteVisitDate || null,
    siteVisitDone: !!lead.siteVisitDone,
    firstContactedAt: lead.firstContactedAt || null,
    whatsappConsent:  lead.whatsappConsent  || undefined,

    notes: (lead.notes || []).map((n) => ({ text: n.text, addedBy: n.addedBy, addedByName: n.addedByName, createdAt: n.createdAt })),
    activities: [
      ...(lead.activities || []).map((a) => ({
        type: a.type, description: a.description, performedBy: a.performedBy,
        performedByName: a.performedByName, meta: a.meta, createdAt: a.createdAt,
      })),
      {
        type: "transferred",
        description: `Moved from Leads to ${projectName || "a project"}`,
        performedBy: user._id,
        performedByName: user.name || "",
      },
    ],
  };
  return doc;
}

module.exports = { projectLeadFromLead };
