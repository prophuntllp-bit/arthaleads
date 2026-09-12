const mongoose = require("mongoose");

/**
 * A WhatsApp AI assistant.
 *
 * This used to be a single set of fields on the organisation
 * (`whatsapp.botName`, `whatsapp.botGreeting`, …), which meant one assistant
 * per tenant with no way to add a second, name it, pause it or delete it. Those
 * fields are migrated into one agent per org by
 * scripts/migrate-wa-agents.js and are no longer read.
 *
 * Routing, in the order `resolveAgentForConversation` tries it:
 *   1. the agent already pinned to the conversation (threads never switch
 *      assistant mid-conversation — the customer would notice)
 *   2. an active agent that claims the Click-to-WhatsApp ad this thread
 *      started from
 *   3. the default active agent
 *   4. any active agent
 * With no active agent at all, nothing auto-replies and the thread waits for a
 * human, which is the same outcome as pausing the org-wide switch.
 */
const waAgentSchema = new mongoose.Schema(
  {
    orgId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true, index: true },

    name:        { type: String, required: true, trim: true, maxlength: 60 },
    description: { type: String, trim: true, default: "", maxlength: 280 },

    // draft is "being written, never answers"; paused is "finished but off".
    // Keeping them apart is what lets the list say whether setup is incomplete
    // or somebody deliberately switched it off.
    status: { type: String, enum: ["active", "paused", "draft"], default: "draft", index: true },

    // Exactly one per org, enforced in the routes rather than the schema
    // because "unset the old one, set the new one" is two writes.
    isDefault: { type: Boolean, default: false },

    // ── What it knows and how it talks ──────────────────────────────────────
    greeting:        { type: String, default: "" },
    businessContext: { type: String, default: "" },
    groundRules:     { type: String, default: "" },

    // Empty means every active project in the org. A narrow list here is the
    // most common reason an assistant answers "our team will confirm shortly"
    // to everything, so the UI warns about it.
    projectIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Project" }],

    // Full override. When set, everything above is ignored.
    systemPrompt: { type: String, default: "" },

    // A hint in the prompt, not a translation layer — the model answers in
    // whatever the customer writes unless told otherwise.
    language: { type: String, default: "auto" },

    // ── Routing ─────────────────────────────────────────────────────────────
    // Meta ad IDs this agent answers for. A generic ad ("DM us for our best
    // deals") gives the model nothing to match a project on, so naming the ad
    // here is what guarantees the first reply is about the right thing.
    adIds: [{ type: String, trim: true }],

    createdBy:     { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    createdByName: { type: String, default: "" },
  },
  { timestamps: true }
);

waAgentSchema.index({ orgId: 1, status: 1 });
waAgentSchema.index({ orgId: 1, adIds: 1 });

/**
 * How much of this agent is actually filled in, for the readiness meter on the
 * list. Deliberately counts things that change the replies a customer gets,
 * not every field on the form.
 */
waAgentSchema.methods.readiness = function readiness(activeProjectCount = 0) {
  const checks = [
    { key: "name",     ok: !!this.name?.trim(),        label: "Has a name" },
    { key: "purpose",  ok: !!this.description?.trim(), label: "Describes what it does" },
    { key: "greeting", ok: !!this.greeting?.trim(),    label: "Opens with a greeting" },
    { key: "context",  ok: !!this.businessContext?.trim() || !!this.systemPrompt?.trim(), label: "Knows about your business" },
    { key: "rules",    ok: !!this.groundRules?.trim() || !!this.systemPrompt?.trim(),     label: "Has ground rules" },
    {
      key: "knowledge",
      // An override prompt carries its own knowledge; otherwise it needs
      // projects to talk about, and "all of them" only counts if any exist.
      ok: !!this.systemPrompt?.trim()
        || (this.projectIds?.length ? true : activeProjectCount > 0),
      label: "Has projects to discuss",
    },
  ];
  return { score: checks.filter((c) => c.ok).length, total: checks.length, checks };
};

module.exports = mongoose.model("WaAgent", waAgentSchema);
