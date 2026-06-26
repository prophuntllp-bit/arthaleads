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

Always commit and push directly to the `main` branch. Do not use feature branches unless the user explicitly asks for one.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- ALWAYS read graphify-out/GRAPH_REPORT.md before reading any source files, running grep/glob searches, or answering codebase questions. The graph is your primary map of the codebase.
- IF graphify-out/wiki/index.md EXISTS, navigate it instead of reading raw files
- For cross-module "how does X relate to Y" questions, prefer `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` over grep — these traverse the graph's EXTRACTED + INFERRED edges instead of scanning files
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
