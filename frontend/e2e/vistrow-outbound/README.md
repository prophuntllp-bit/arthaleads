# Vistrow outbound setup: browser check

Drives the real `VistrowOutboundSection` in Chromium against an in-memory fake API
that runs the real backend `routing.js`. Nothing contacts Vistrow.

    cd frontend
    node e2e/vistrow-outbound/build.cjs     # needs esbuild (a Vite dependency)
    PLAYWRIGHT_PATH=/path/to/playwright node e2e/vistrow-outbound/drive.cjs

`app.css` (optional styling) and `bundle.js` are build outputs; the check passes without styling.
