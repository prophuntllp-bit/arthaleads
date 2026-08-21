/**
 * Prints the exact Facebook consent URL the app now generates, so the scope
 * the user will actually be asked to approve is verified from the deployed
 * code rather than assumed.
 *
 * Read-only: builds the URL string, does not call Facebook or start a grant.
 *
 * Run: railway run --service Arthaleads node backend/scripts/check-oauth-scope.js
 */
require("dotenv").config();
const svc = require("../services/automationService");

const url = svc.getFacebookAuthUrl("DUMMY_STATE_NOT_A_REAL_GRANT");
const parsed = new URL(url);
const scope = (parsed.searchParams.get("scope") || "").split(",");

console.log("Consent URL host :", parsed.host + parsed.pathname);
console.log("auth_type        :", parsed.searchParams.get("auth_type") || "(not set)");
console.log("redirect_uri     :", parsed.searchParams.get("redirect_uri"));
console.log("\nScopes the user will be asked to approve:");
for (const s of scope) console.log("  -", s);

const REQUIRED = ["pages_show_list", "pages_read_engagement", "pages_manage_metadata", "leads_retrieval"];
const missing = REQUIRED.filter((s) => !scope.includes(s));
console.log(missing.length
  ? `\n❌ MISSING: ${missing.join(", ")}`
  : "\n✅ All four required scopes present (leads_retrieval is what subscribePageWebhook needs).");
