## UI Component Standards

### Form inputs (.input class)
All form fields use the `.input` CSS class which applies: `px-4 py-3 text-sm rounded-2xl` = padding 12px 16px, font-size 14px, border-radius 1rem (16px), full width.

### CustomSelect in forms/modals
Always pass `style` to match `.input` height — NEVER use default compact sizing in a form context:
```jsx
<CustomSelect
  style={{ width: "100%", padding: "12px 16px", borderRadius: "1rem", fontSize: 14 }}
/>
```
Default CustomSelect padding (`5px 10px`) is only for inline/table use.

### DateTimePicker in forms/modals
Always pass `triggerClassName` and `triggerStyle` to match `.input` height:
```jsx
<DateTimePicker
  triggerClassName="w-full"
  triggerStyle={{ padding: "12px 16px", borderRadius: "1rem", fontSize: 14, minWidth: 0 }}
/>
```
Default DateTimePicker trigger padding (`4px 8px`) is only for inline/table use.

### Page container padding
Every page's root element must use `className="stitch-page"` — nothing else. This class already applies the correct responsive padding (`px-4 py-6 sm:px-6 lg:px-8 lg:py-8`).

- NEVER add `max-w-*`, `mx-auto`, extra `px-*`, or `container` to the page root — it creates uneven side padding compared to other pages.
- Exception: full-bleed layouts (chat panels, kanban boards) use `stitch-page !p-0` and handle their own internal padding.

### Popups are solid
Every dialog, sheet and pop-out menu panel is solid: use the shared `Modal` from `components/UI.jsx`, or put `className="modal-panel"` (styles.css) on the panel, or `background: "var(--app-surface-solid)"`. Never `var(--app-surface)`, `.card`, `.shell-panel` or `bg-app-surface` on something that floats over the page: those are see-through glass (58% in light mode) and the page bleeds through (owner, 30 Oct 2026). Glass stays for cards on the page and the top bars.

Popups follow the page theme (31 Oct 2026, after peach, sand and dark-in-light were tried and dropped): white in light mode, one step lighter grey in dark mode, via `--app-modal-bg` / `.modal-panel` in `styles.css`. A hand-built popup panel uses `background: "var(--app-modal-bg)"` (or `.modal-panel`). The new popup design is being chosen by the owner from mock-ups; don't restyle popups until that is approved.

### Mobile sidebar
The mobile drawer sidebar uses `.sidebar-glass` which has a CSS override below 1024px to be fully solid (no glass transparency). Do NOT add glass/blur to the mobile sidebar.

### Fixed-layout tables — MANDATORY rule
Every table that uses `tableLayout: "fixed"` (inline style or Tailwind `table-fixed`) MUST also have the class `stitch-table-fixed` on the `<table>` element.

`stitch-table-fixed` is defined in `styles.css` and applies:
```css
.stitch-table-fixed tbody td {
  overflow: hidden;
  max-width: 0;
}
```
This clips each cell's content at the column boundary so long text goes hidden behind the next column instead of bleeding/merging across adjacent cells. Without it, text overflows visually into neighbouring columns.

- Existing tables that already use it: Leads, FollowUps, ProjectDetail (both Leads and Prospective tabs).
- Apply this class every time a new fixed-layout table is created or an existing one is modified.

## Git Workflow

Staging first (owner rule, 15 Oct 2026): commit and push every change to the `staging` branch, check it on staging.arthaleads.com / app-staging.arthaleads.com, and only then merge `staging` into `main` (which deploys live). Full flow and setup: docs/STAGING.md. Only an urgent live fix the owner explicitly approves may go straight to `main` (merge it back into `staging` after). Do not create other branches unless the user explicitly asks. If staging is not reachable, tell the owner instead of skipping it.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- ALWAYS read graphify-out/GRAPH_REPORT.md before reading any source files, running grep/glob searches, or answering codebase questions. The graph is your primary map of the codebase.
- IF graphify-out/wiki/index.md EXISTS, navigate it instead of reading raw files
- For cross-module "how does X relate to Y" questions, prefer `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` over grep — these traverse the graph's EXTRACTED + INFERRED edges instead of scanning files
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

## Agent bridge (Claude Code and Codex)

Another AI agent (Codex) also edits this repo. Before making ANY change, `git pull` and read `AGENT_BRIDGE.md` (rules, "Active work", recent change log). Register the task there before editing, and log it with the commit hash when done. If an active entry overlaps what you are about to change, stop and tell the owner.
