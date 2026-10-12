// utils/pipelineStage.js
//
// Project leads (ProjectLead) are worked from the project sheet: agents record
// a call outcome ("booking": Not Reachable, Call Back, Site Visit Done...) and
// almost never touch the pipeline `status`, which imports leave empty. The
// Pipeline board read only `status`, so thousands of worked leads sat in "New"
// forever. A project lead's stage is now:
//   - its `status`, when someone has set one (drag on the board, edit form);
//   - otherwise derived from its call outcome / contact remark / logged calls.
// Recording a new outcome also moves the stored status forward (never back),
// see stageAfterOutcome. Plain Leads are untouched: their status defaults to
// "New" and is always set explicitly.
const OUTCOME_STAGE = {
  "Not Reachable":     "Contacted",
  "Call Back":         "Contacted",
  "Interested":        "Contacted",
  "Low Budget":        "Contacted",
  "Other Location":    "Contacted",
  "Commercial":        "Contacted",
  "Site Visit Booked": "Site Visit",
  "Site Visit Done":   "Site Visit",
  "Booked":            "Closed Won",
  "Not Interested":    "Closed Lost",
};

const RANK = { "New": 0, "Contacted": 1, "Site Visit": 2, "Negotiation": 3, "Closed Won": 4 };
const UNSET = ["", null];

const outcomesFor = (stage) => Object.keys(OUTCOME_STAGE).filter((o) => OUTCOME_STAGE[o] === stage);
const contactedByActivity = { $or: [{ remark: "Contacted" }, { "activities.type": "called" }] };

/** The stage to show for a project lead document (lean or hydrated). */
function projectLeadStage(pl) {
  if (pl.status) return pl.status;
  if (OUTCOME_STAGE[pl.booking]) return OUTCOME_STAGE[pl.booking];
  if (pl.remark === "Contacted" || (pl.activities || []).some((a) => a.type === "called")) return "Contacted";
  return "New";
}

/** Mongo condition matching project leads whose stage (as above) is `stage`. */
function projectLeadStageCondition(stage) {
  const derived = { status: { $in: UNSET } };
  const outcomes = outcomesFor(stage);
  if (stage === "New") {
    return { $or: [{ status: "New" }, { ...derived, booking: { $in: UNSET }, remark: { $ne: "Contacted" }, "activities.type": { $ne: "called" } }] };
  }
  const ors = [{ status: stage }];
  if (outcomes.length) ors.push({ ...derived, booking: { $in: outcomes } });
  if (stage === "Contacted") ors.push({ ...derived, booking: { $in: UNSET }, ...contactedByActivity });
  return { $or: ors };
}

/**
 * Status to store after a call outcome is recorded, or null to leave it.
 * Moves forward only, so "Call Back" never pulls a Negotiation lead back to
 * Contacted. Booked / Not Interested always close; a closed-lost lead that
 * becomes interested again re-opens.
 */
function stageAfterOutcome(currentStatus, outcome) {
  const next = OUTCOME_STAGE[outcome];
  if (!next) return null;
  if (next === "Closed Won" || next === "Closed Lost") return next === currentStatus ? null : next;
  if (!currentStatus || currentStatus === "Closed Lost") return next;
  return (RANK[next] ?? 0) > (RANK[currentStatus] ?? 0) ? next : null;
}

module.exports = { OUTCOME_STAGE, projectLeadStage, projectLeadStageCondition, stageAfterOutcome };
