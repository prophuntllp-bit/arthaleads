// Who is acting, carried through one request without threading a parameter
// through every service. Today it answers one question: is this change being
// made by Artha on someone's behalf? Lead history then reads "Status changed
// ... (via Artha)" so the team can always tell a person's edit from Artha's.
const { AsyncLocalStorage } = require("async_hooks");

const store = new AsyncLocalStorage();

/** Run fn with this context for everything it awaits. */
function runWith(context, fn) {
  return store.run({ ...(store.getStore() || {}), ...context }, fn);
}

function viaArtha() {
  return store.getStore()?.via === "artha";
}

// Mongoose plugin for any schema with an activities[] array: activity entries
// added while Artha is acting are marked in meta and in the visible text.
function attributionPlugin(schema) {
  schema.pre("save", function markArthaActivity() {
    if (!viaArtha() || !Array.isArray(this.activities)) return;
    for (const a of this.activities) {
      if (!a.isNew || a.meta?.via === "artha") continue;
      a.meta = { ...(a.meta || {}), via: "artha" };
      if (typeof a.description === "string" && !a.description.includes("(via Artha)")) a.description = `${a.description} (via Artha)`;
    }
  });
}

/** For writes that $push activity entries directly (bulk updates). */
function stampActivity(entry) {
  if (!viaArtha()) return entry;
  return { ...entry, description: `${entry.description} (via Artha)`, meta: { ...(entry.meta || {}), via: "artha" } };
}

module.exports = { runWith, viaArtha, attributionPlugin, stampActivity };
