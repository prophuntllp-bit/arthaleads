# Arthaleads CRM design rules

The owner approved this on 31 Oct 2026 ("Version C", mock-up kept at
`outputs/popup-design-c.html` on the owner's machine). Follow it for every new
or changed popup, and for Google Stitch prompts. Ask the owner before changing it.

## Principles

1. Popups follow the page theme. Light page, light popup. Dark page, dark popup.
2. A popup is one window in three zones, not a stack of floating pieces:
   **top band** (who / what), **body**, **bottom band** (buttons).
3. One left edge per zone. Labels in one column. Things that belong together sit
   in one card.
4. Brand orange is for the main button, the selected tab ring, links and the
   focused field. Never for backgrounds.
5. Lines must be visible. In light mode a divider is `#e6dbcf`, not a faint tint.

## Spacing, corners, type

- Spacing: 4, 8, 12, 16, 24 px only. 24 between zones and around the body, 16
  inside a card, 8 between related items.
- Corners: popup 16 px, cards and sections 12 px, popup buttons 12 px, fields as
  `.input` (CLAUDE.md), pills fully round.
- Type: Inter. Popup title 17 px extra-bold (lead name 19 px). Section title
  13.5 px bold with a 12.5 px description. Field labels 14 px medium. Body 13.5 px.

## Colours (tokens in `frontend/src/styles.css`)

| Token | Light | Dark | Used for |
|---|---|---|---|
| `--app-modal-bg` | `#ffffff` | `#222125` | popup panel |
| `--modal-zone` | `#f8f3ee` | `#28272b` | top and bottom bands |
| `--app-modal-inset` | `#fbf8f5` | `#242327` | card top band, form sections, consent row |
| `--modal-card` | `#ffffff` | `#1c1b1f` | cards and fields inside a popup |
| `--modal-card-border` | `#e2d6c9` | white 8% | popup, card and section edges |
| `--modal-divider` | `#e6dbcf` | white 7% | lines between rows (also `--app-border` inside popups) |
| `--modal-field-border` | `#e3d9ce` | white 12% | popup buttons |

Fields inside a popup are white (dark: `#1c1b1f`) via `--app-field-bg`; the
focused field gets the orange ring.

## Building blocks

- Shared `Modal` (`components/UI.jsx`): `title`, optional `description`,
  optional `footer` (pinned bottom band; form buttons use `form="<form id>"`),
  optional `header` to replace the top band (Lead Details).
- `.modal-zone` / `.modal-foot`: the top and bottom bands.
- `.modal-card` + `.modal-card-head`: a card whose top band holds the tabs
  (`SegmentTabs`, the CRM's own tab strip) so the tabs visibly control the card.
- `.modal-section` + `.modal-section-title` + `.modal-section-desc`: a titled
  group of form fields. Hints sit directly under their field.
- `.modal-btn` (+ `-wa`, `-soft`, `-danger`): 36 px buttons in a popup's action
  row. `aria-expanded="true"` shows the open state.
- `.kv-row` (+ `kv-left` / `kv-right`): label / value rows in two columns with a
  line between the columns; one column on phones.

## Lead Details

- Top band: avatar initials, name, copy; phone, email, source and priority pills
  under the name; status, edit and close on the right of the name line.
- Actions start under the name: **Message on WhatsApp** (green, real logo),
  **Call**, Call in browser / AI call when available, then **AI tools**. AI tools
  starts closed and opens a second row: Draft a message, Summarise lead, Suggest
  next step.
- Body: Artha suggestion and Vistrow panel, then one card: tabs on its top band,
  details in two columns, a "Show N empty fields / Add details" row, and the
  WhatsApp consent row as the card's last row.
- The Chat tab keeps the WhatsApp chat wallpaper.

## Forms

Sections in order of need (Lead form: Contact, Requirement, Follow-up). Required
fields carry an orange `*`. Cancel and the orange main button sit in the footer.
