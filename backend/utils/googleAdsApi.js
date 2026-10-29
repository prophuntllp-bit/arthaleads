// Google Ads API over REST, shared by the "Sign in with Google" connect flow
// (automationService) and the lead poller (googleAdsPoller).
//
// Checked against Google's docs on 29 Oct 2026:
// - v26 is the newest version (sunset Nov 2027). Bump GOOGLE_ADS_API_VERSION
//   once a year; Google's sunset table is developers.google.com/google-ads/api/docs/sunset-dates.
// - Developer tokens were retired on 9 Sep 2026. Access now comes from the
//   Google Cloud project that owns GOOGLE_CLIENT_ID (Test, then Explorer and up).
//   A token is still sent if GOOGLE_ADS_DEVELOPER_TOKEN is set; Google ignores it.
// - Search has a fixed page size of 10,000 rows; page_size can no longer be set.
// - An account reached through a manager account needs the manager's ID in the
//   login-customer-id header, or Google answers USER_PERMISSION_DENIED.

const GOOGLE_ADS_API_VERSION = "v26";
const BASE = `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}`;

function headers(accessToken, loginCustomerId) {
  const h = { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };
  if (process.env.GOOGLE_ADS_DEVELOPER_TOKEN) h["developer-token"] = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  if (loginCustomerId) h["login-customer-id"] = String(loginCustomerId).replace(/-/g, "");
  return h;
}

// Google's error codes in words a CRM user can act on.
const FRIENDLY = {
  CLOUD_PROJECT_NOT_APPROVED_FOR_PRODUCTION: "ArthaLeads is still waiting for Google to approve its Google Ads API access. Try again later.",
  USER_PERMISSION_DENIED: "This Google login can't open that Google Ads account. Reconnect with a login that has access to it.",
  CUSTOMER_NOT_ENABLED: "That Google Ads account is not active (cancelled or not set up yet).",
  NOT_ADS_USER: "This Google login has no Google Ads account.",
};

function errorMessage(json, status) {
  const first = json?.error?.details?.find((d) => d.errors)?.errors?.[0];
  const code = first?.errorCode ? Object.values(first.errorCode)[0] : "";
  return FRIENDLY[code] || first?.message || json?.error?.message || `Google Ads API error (${status})`;
}

// Runs a GAQL query and returns every row, following next_page_token.
async function search(customerId, query, { accessToken, loginCustomerId } = {}) {
  const rows = [];
  let pageToken;
  do {
    const resp = await fetch(`${BASE}/customers/${customerId}/googleAds:search`, {
      method: "POST",
      headers: headers(accessToken, loginCustomerId),
      body: JSON.stringify(pageToken ? { query, pageToken } : { query }),
    });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(errorMessage(json, resp.status));
    rows.push(...(json.results || []));
    pageToken = json.nextPageToken;
  } while (pageToken);
  return rows;
}

// Every ad account this Google login can read leads from. A manager account
// itself has no lead forms, so it is replaced by its active client accounts,
// each remembering the manager it is reached through (loginCustomerId).
async function listAccounts(accessToken) {
  const resp = await fetch(`${BASE}/customers:listAccessibleCustomers`, { headers: headers(accessToken) });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(errorMessage(json, resp.status));
  const ids = (json.resourceNames || []).map((rn) => rn.split("/")[1]).filter(Boolean);
  if (!ids.length) throw new Error("This Google login has no Google Ads account. Sign in with the login you use for Google Ads.");

  const direct = new Map(); // id -> account
  const viaManager = [];
  const managers = []; // "Name (123-456-7890)", to say where nothing was found
  const closedClients = [];
  const managerErrors = [];
  await Promise.all(ids.map(async (id) => {
    let customer;
    try {
      const [row] = await search(id, "SELECT customer.id, customer.descriptive_name, customer.manager, customer.test_account FROM customer LIMIT 1", { accessToken });
      customer = row?.customer;
    } catch {
      // No direct read access (or a cancelled account): still listed, by its bare ID.
      direct.set(id, { id, name: id, loginCustomerId: "" });
      return;
    }
    if (!customer?.manager) {
      direct.set(id, { id, name: customer?.descriptiveName || id, loginCustomerId: "", testAccount: customer?.testAccount === true });
      return;
    }
    managers.push(`${customer.descriptiveName || "manager account"} (${String(id).replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3")})`);
    // No status filter in the query: a brand-new account with no campaign yet
    // is not ENABLED, but it can still be connected. Only closed ones are left out.
    try {
      const clients = await search(id, `
        SELECT customer_client.id, customer_client.descriptive_name, customer_client.test_account, customer_client.status
        FROM customer_client
        WHERE customer_client.manager = false`, { accessToken, loginCustomerId: id });
      for (const { customerClient: c } of clients) {
        if (!c?.id) continue;
        if (["CANCELED", "CLOSED"].includes(c.status)) { closedClients.push(`${c.descriptiveName || c.id} (${c.status.toLowerCase()})`); continue; }
        viaManager.push({ id: String(c.id), name: c.descriptiveName || String(c.id), loginCustomerId: id, managerName: customer.descriptiveName || id, testAccount: c.testAccount === true, status: c.status || "" });
      }
    } catch (err) {
      managerErrors.push(err.message);
    }
  }));

  // An account reachable both directly and through a manager is listed once, as direct.
  for (const a of viaManager) if (!direct.has(a.id)) direct.set(a.id, a);
  if (!direct.size && managerErrors.length) throw new Error(`Google Ads could not list the accounts under your manager account: ${managerErrors[0]}`);
  if (!direct.size && managers.length) {
    const closedNote = closedClients.length ? ` (only closed ones: ${closedClients.join(", ")})` : "";
    throw new Error(`Your manager account ${managers.join(", ")} has no ad accounts under it yet${closedNote}. Link your ad account to it in Google Ads, then connect again.`);
  }
  return [...direct.values()].sort((a, b) => a.name.localeCompare(b.name));
}

// "customers/123/campaigns/456" -> "456"
const idFromResourceName = (rn) => (rn ? String(rn).split("/").pop() : "");

module.exports = { GOOGLE_ADS_API_VERSION, search, listAccounts, idFromResourceName, errorMessage };
