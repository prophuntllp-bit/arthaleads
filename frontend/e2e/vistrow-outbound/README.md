# Vistrow outbound setup: browser check

Drives the real `VistrowOutboundSection` in Chromium against an in-memory fake API
that runs the real backend `routing.js`. Nothing contacts Vistrow.

    cd frontend
    node e2e/vistrow-outbound/build.cjs     # needs esbuild (a Vite dependency)
    PLAYWRIGHT_PATH=/path/to/playwright node e2e/vistrow-outbound/drive.cjs

`app.css` (optional styling) and `bundle.js` are build outputs; the check passes without styling.

## Integrations list click path
    node e2e/vistrow-outbound/build-list.cjs
    PLAYWRIGHT_PATH=... node e2e/vistrow-outbound/drive-list.cjs
Mounts the real Integrations page with a stub API: the Vistrow Voice tile goes to
`/integrations/vistrow-calling`, the connected row keeps Edit (token modal) and shows
"Auto-call new leads", and no write request is made.
