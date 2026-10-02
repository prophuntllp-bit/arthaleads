import { useState } from "react";
import { AlertTriangle, Check, ChevronDown, Copy, ExternalLink, Pencil, RefreshCw, SearchCheck, ShieldCheck, Trash2 } from "lucide-react";

// One card per lead-source connection on the Integrations page. Every card has
// the same three parts, so a row of mixed connections lines up:
//   header  - icon, name, what it is, live status
//   facts   - a short label/value list that depends on the platform
//   footer  - the actions, delete kept apart on the right
// Everything platform-specific (icons, handlers, the Facebook form-names
// editor) comes in as props so this stays presentational.

const STATUS = {
  connected: { dot: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400", label: "Connected" },
  paused: { dot: "bg-amber-500", text: "text-amber-600 dark:text-amber-400", label: "Paused" },
  draft: { dot: "bg-slate-400", text: "text-app-soft", label: "Not connected yet" },
};

function timeAgo(date) {
  if (!date) return null;
  const sec = Math.max(0, (Date.now() - new Date(date).getTime()) / 1000);
  if (sec < 60) return "just now";
  if (sec < 3600) return `${Math.floor(sec / 60)} min ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} hr ago`;
  if (sec < 86400 * 30) { const d = Math.floor(sec / 86400); return d === 1 ? "yesterday" : `${d} days ago`; }
  return new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function hostOf(url) {
  try { return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.replace(/^www\./, ""); } catch { return url || ""; }
}

// What to call a connection. A website goes by its own name when we have read
// it, then by its domain when the saved name is just a placeholder ("WordPress
// Site 5"), and only then by the label typed at set-up. Shared with the
// dashboard's Automation Health so both screens name a source the same way.
const GENERIC_NAME = /^(wordpress site|website|my site)( \d+)?$/i;
export function connectionTitle(item) {
  if (item.platform !== "Website Form") return item.name || item.platform;
  const real = item.siteName && !GENERIC_NAME.test(item.siteName.trim()) ? item.siteName.trim() : "";
  const host = item.siteUrl ? hostOf(item.siteUrl) : "";
  return real || (host && GENERIC_NAME.test(String(item.name || "").trim()) ? host : item.name || host || "Website");
}

export { hostOf };

function Row({ label, children }) {
  return (
    <div className="grid grid-cols-[84px_minmax(0,1fr)] items-center gap-3 py-2">
      <dt className="text-xs text-app-soft">{label}</dt>
      <dd className="min-w-0 text-sm text-app">{children}</dd>
    </div>
  );
}

function CopyValue({ value, shown, mono = true, onCopy }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    await onCopy?.(value);
    setDone(true);
    setTimeout(() => setDone(false), 1500);
  };
  return (
    <div className="flex items-center gap-2">
      <span className={`min-w-0 flex-1 truncate ${mono ? "font-mono text-xs" : "text-sm"}`} title={value}>{shown || value}</span>
      <button type="button" onClick={copy} aria-label="Copy"
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[color:var(--app-border)] text-app-soft transition hover:text-app">
        {done ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

function maskToken(t) {
  if (!t) return "";
  return t.length > 10 ? `${t.slice(0, 7)}${"•".repeat(8)}${t.slice(-4)}` : t;
}

export default function ConnectionCard({
  item, leading, serverBase = "", endpointPath = "",
  onEdit, onDelete, onCopy, onDiagnose, onRefreshToken, onReconnect, refreshing = false,
  formNamesEditor = null,
}) {
  const [showForms, setShowForms] = useState(false);
  const status = STATUS[item.status] || STATUS.draft;
  const isFb = item.platform === "Facebook";
  const isWebsite = item.platform === "Website Form";
  const isGoogle = item.platform === "Google";
  const isTokenSource = ["Custom", "Vistrow Voice", "WhatsApp"].includes(item.platform);

  const host = isWebsite && item.siteUrl ? hostOf(item.siteUrl) : "";
  const title = connectionTitle(item);
  const subtitle = isWebsite && host ? host : item.platform;
  const showSubtitle = subtitle && subtitle.toLowerCase() !== String(title).toLowerCase();

  const expiresAt = item.userTokenExpiresAt ? new Date(item.userTokenExpiresAt) : null;
  const daysLeft = expiresAt ? Math.ceil((expiresAt - Date.now()) / 86400000) : null;
  const permanent = daysLeft !== null && daysLeft > 365 * 5;
  const expired = !permanent && daysLeft !== null && daysLeft <= 0;
  const urgent = !permanent && daysLeft !== null && daysLeft > 0 && daysLeft <= 5;
  const soon = !permanent && daysLeft !== null && daysLeft > 5 && daysLeft <= 20;
  const tokenTone = expired || urgent ? "text-red-500" : soon ? "text-amber-500" : "text-emerald-600 dark:text-emerald-400";
  const tokenText = permanent ? "Never expires"
    : daysLeft === null ? "Unknown, press Refresh"
    : expired ? "Expired, reconnect to resume leads"
    : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`;

  const url = `${serverBase}${endpointPath}`;

  return (
    <article className="card flex h-full flex-col p-5">
      <header className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[color:var(--app-border)] bg-white">
          {leading}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15px] font-semibold leading-tight text-app">{title}</h3>
          {showSubtitle && <p className="mt-0.5 truncate text-xs text-app-soft">{subtitle}</p>}
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1.5 text-xs font-medium ${status.text}`}>
          <span className={`h-2 w-2 rounded-full ${status.dot}`} />
          {status.label}
        </span>
      </header>

      <dl className="mt-4 flex-1 divide-y divide-[color:var(--app-border)] border-t border-[color:var(--app-border)]">
        {isFb && (
          <>
            <Row label="Page">{item.pageName || item.pageId || "All pages"}</Row>
            <Row label="Forms">{item.formId || "All forms"}</Row>
            <Row label="Token">
              <div className="flex items-center gap-2">
                {expired || urgent || soon ? <AlertTriangle className={`h-3.5 w-3.5 shrink-0 ${tokenTone}`} /> : <ShieldCheck className={`h-3.5 w-3.5 shrink-0 ${tokenTone}`} />}
                <span className={`flex-1 truncate text-sm ${tokenTone}`}>{tokenText}</span>
                {!permanent && (
                  expired ? (
                    <button type="button" onClick={onReconnect} className="inline-flex items-center gap-1 rounded-lg bg-red-500 px-2.5 py-1 text-xs font-semibold text-white">
                      <RefreshCw className="h-3 w-3" /> Reconnect
                    </button>
                  ) : (
                    <button type="button" onClick={onRefreshToken} disabled={refreshing}
                      className="inline-flex items-center gap-1 rounded-lg border border-[color:var(--app-border)] px-2.5 py-1 text-xs font-semibold text-app-soft transition hover:text-app disabled:opacity-50">
                      <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
                      {refreshing ? "Refreshing" : "Refresh"}
                    </button>
                  )
                )}
              </div>
            </Row>
            {formNamesEditor && (
              <div className="py-2">
                <button type="button" onClick={() => setShowForms((v) => !v)} className="flex w-full items-center justify-between text-left text-xs text-app-soft hover:text-app">
                  <span>Name your lead forms</span>
                  <ChevronDown className={`h-4 w-4 transition ${showForms ? "rotate-180" : ""}`} />
                </button>
                {showForms && <div className="pt-2">{formNamesEditor}</div>}
              </div>
            )}
          </>
        )}

        {isWebsite && (
          <>
            <Row label="Website">
              {item.siteUrl ? (
                <a href={item.siteUrl} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-1 text-app hover:underline">
                  <span className="truncate">{hostOf(item.siteUrl)}</span>
                  <ExternalLink className="h-3 w-3 shrink-0 text-app-soft" />
                </a>
              ) : <span className="text-app-soft">Appears after the first lead</span>}
            </Row>
            <Row label="Forms">
              {item.connectedForms?.length ? (
                <div className="flex flex-wrap gap-1">
                  {item.connectedForms.map((f) => <span key={f} className="pill-ok">{f}</span>)}
                </div>
              ) : <span className="text-app-soft">None seen yet</span>}
            </Row>
            <Row label="Last lead">{item.lastSyncAt ? timeAgo(item.lastSyncAt) : <span className="text-app-soft">No leads yet</span>}</Row>
            <Row label="Endpoint"><CopyValue value={url} shown={endpointPath} onCopy={onCopy} /></Row>
          </>
        )}

        {isGoogle && item.mode === "oauth" && (
          <>
            <Row label="Account">{item.googleCustomerName || "Not selected"}{item.googleCustomerId && <span className="ml-2 text-xs text-app-soft">{item.googleCustomerId}</span>}</Row>
            <Row label="Last sync">{item.lastSyncAt ? timeAgo(item.lastSyncAt) : <span className="text-app-soft">Not synced yet</span>}</Row>
          </>
        )}
        {isGoogle && item.mode !== "oauth" && (
          <>
            <Row label="Webhook"><CopyValue value={`${serverBase}/webhook/google`} shown="/webhook/google" onCopy={onCopy} /></Row>
            <Row label="Key">
              {item.verifyToken ? <CopyValue value={item.verifyToken} shown={maskToken(item.verifyToken)} onCopy={onCopy} /> : <span className="text-amber-500">Press Edit, then Update to create one</span>}
            </Row>
          </>
        )}

        {isTokenSource && (
          <>
            <Row label="Endpoint"><CopyValue value={`${serverBase}/webhook/lead`} shown="/webhook/lead" onCopy={onCopy} /></Row>
            <Row label="Token">
              {item.verifyToken ? <CopyValue value={item.verifyToken} shown={maskToken(item.verifyToken)} onCopy={onCopy} /> : <span className="text-amber-500">Press Edit, then Update to create one</span>}
            </Row>
          </>
        )}

        {!isFb && !isWebsite && !isGoogle && !isTokenSource && (
          <Row label="Endpoint"><CopyValue value={url} shown={endpointPath} onCopy={onCopy} /></Row>
        )}
      </dl>

      <footer className="mt-4 flex items-center gap-2 border-t border-[color:var(--app-border)] pt-4">
        <button type="button" className="btn-secondary rounded-xl" onClick={onEdit}><Pencil className="h-4 w-4" /> Edit</button>
        {isFb && <button type="button" className="btn-secondary rounded-xl" onClick={onDiagnose} title="Check why leads may not be arriving"><SearchCheck className="h-4 w-4" /> Diagnose</button>}
        {item.externalSourceUrl && (
          <a href={item.externalSourceUrl} target="_blank" rel="noreferrer" className="btn-secondary rounded-xl"><ExternalLink className="h-4 w-4" /> Open</a>
        )}
        <button type="button" className="btn-danger ml-auto rounded-xl" onClick={onDelete} aria-label="Delete connection"><Trash2 className="h-4 w-4" /></button>
      </footer>
    </article>
  );
}

// The Integrations page lists connections grouped by what they are, so a
// workspace with several websites, a Facebook page and a voice agent reads as
// sections instead of one mixed grid.
const GROUPS = [
  { platform: "Website Form", title: "Websites", hint: "Contact forms that send leads straight in" },
  { platform: "Facebook", title: "Facebook Lead Ads", hint: "Pages and forms synced from Meta" },
  { platform: "Google", title: "Google Ads", hint: "Lead form extensions" },
  { platform: "Vistrow Voice", title: "Vistrow Voice", hint: "Leads qualified by the AI calling agent" },
  { platform: "WhatsApp", title: "WhatsApp", hint: "Leads from WhatsApp conversations" },
  { platform: "Custom", title: "Custom sources", hint: "Any other partner, broker or vendor" },
];

export function ConnectionGroups({ items, renderCard }) {
  const known = new Set(GROUPS.map((g) => g.platform));
  const groups = [
    ...GROUPS.map((g) => ({ ...g, rows: items.filter((i) => i.platform === g.platform) })),
    { platform: "other", title: "Other sources", hint: "", rows: items.filter((i) => !known.has(i.platform)) },
  ].filter((g) => g.rows.length);

  return (
    <div className="space-y-8">
      {groups.map((g) => (
        <section key={g.platform} className="space-y-3">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <h2 className="text-sm font-semibold text-app">{g.title}</h2>
            <span className="rounded-full border border-[color:var(--app-border)] px-2 py-0.5 text-[11px] font-medium text-app-soft">{g.rows.length}</span>
            {g.hint && <span className="text-xs text-app-soft">{g.hint}</span>}
          </div>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">{g.rows.map(renderCard)}</div>
        </section>
      ))}
    </div>
  );
}
