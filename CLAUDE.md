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

## Git Workflow

Always commit and push directly to the `main` branch. Do not use feature branches unless the user explicitly asks for one.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- ALWAYS read graphify-out/GRAPH_REPORT.md before reading any source files, running grep/glob searches, or answering codebase questions. The graph is your primary map of the codebase.
- IF graphify-out/wiki/index.md EXISTS, navigate it instead of reading raw files
- For cross-module "how does X relate to Y" questions, prefer `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` over grep — these traverse the graph's EXTRACTED + INFERRED edges instead of scanning files
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
