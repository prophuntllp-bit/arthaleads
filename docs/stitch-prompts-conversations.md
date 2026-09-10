# Google Stitch master prompts — Conversations section

Every prompt below is self-contained: paste one into Stitch and it has the full
design system. The tokens are read from `frontend/src/styles.css`, not invented.

---

## Shared design system block

**Paste this at the top of every prompt.**

```
DESIGN SYSTEM — Arthaleads CRM (match exactly)

Typeface: Inter variable, all weights. Nothing else.

Light mode
  page background      #f0ede8   (warm off-white, not grey)
  card / surface       #ffffff
  surface-low          rgba(255,255,255,0.38) over the page bg
  primary text         #18181b
  secondary text       #5f5f66
  accent               #ff6b00   (orange)
  accent deep          #a04100
  border               rgba(160,65,0,0.12)
  border strong        rgba(160,65,0,0.22)

Dark mode
  page background      #111113
  card / surface       #1e1d20
  primary text         #ededed
  secondary text       #969696
  accent               #ff6b00   (unchanged)
  border               rgba(255,255,255,0.10)

Semantic
  success  #15803d on rgba(34,197,94,0.12)
  warning  #b45309 on rgba(251,191,36,0.14)
  danger   #b91c1c on rgba(239,68,68,0.12)
  whatsapp #25D366 ; outbound chat bubble #dcf8c6 with #111 text

Shape and spacing
  cards          20px radius, 1px border, no drop shadow, flat fill
  inputs         16px radius, 12px vertical / 16px horizontal padding, 14px text
  primary button pill (full radius), #ff6b00 fill, white text, 14px bold
  secondary btn  pill, transparent fill, 1px border, primary-text colour
  pills / badges full radius, 10-11px bold text, tinted background from the
                 same colour family as the text
  page padding   16px mobile / 24px tablet / 32px desktop
  card padding   20px

Tone
  Sentence case everywhere. Never Title Case, never ALL CAPS.
  No emoji. Line icons only, 1.5px stroke, 16-18px.
  Flat surfaces — no gradients, no glassmorphism, no drop shadows.
```

---

## 1 · Conversations shell (tab strip)

```
[paste design system]

Design the section header for a WhatsApp workspace inside a CRM.

A horizontal tab strip sits directly under the app's top bar, left aligned,
full width, with page padding. Tabs, in order: Inbox, Templates, Campaigns,
Credits, Settings. Each tab is a pill with a 16px line icon and a label.

Active tab: rgba(255,107,0,0.12) fill with #ff6b00 text.
Inactive tab: no fill, #5f5f66 text, no border.

The Credits tab shows a 6px solid #b91c1c dot after its label when the balance
is zero. No dot otherwise.

On narrow screens the strip scrolls horizontally rather than wrapping — it must
never become two rows, because the inbox below needs the vertical space.

Show light and dark.
```

---

## 2 · Inbox

```
[paste design system]

Design a two-panel WhatsApp inbox that fills the height below the tab strip,
inside one rounded 20px container with a 1px border.

Left panel, 320px fixed:
  header row — WhatsApp glyph in #25D366, "Inbox" in bold, then on the right a
  credit pill showing "₹1,240", a settings gear, and a refresh icon
  filter row — four small pills: All, Bot, Open, Done. Active pill is #ff6b00
  fill with white text
  list — each row is a 40px circular avatar with the contact's initial in
  #ff6b00 on rgba(255,107,0,0.12), name in bold, last message truncated in
  secondary text, timestamp top-right, and an unread count badge in #25D366
  with white text. A small green circle with a bot glyph overlaps the
  avatar's bottom-right when the AI assistant is handling that thread.

Right panel:
  header — avatar, contact name, phone and lead status, then on the right a
  "Bot ON" pill in green and an open-in-new icon
  thread — inbound bubbles left aligned on surface-low with primary text;
  outbound bubbles right aligned on #dcf8c6 with #111 text, max 78% width,
  20px radius with the top corner nearest the sender squared off to 4px.
  Above an outbound bubble sent by a person, show a tiny 14px circular
  initial and their name in 9px bold #3a7d1f. Above one sent by the AI, show
  a bot glyph and "Bot" in 9px bold green. Under every bubble, a 10px
  timestamp; outbound bubbles also carry a tick — one grey tick for sent,
  two grey for delivered, two blue for read
  composer — rounded 20px textarea on surface-low, and a 40px circular send
  button that is #25D366 when there is text and surface-low when empty

Also draw the zero-credit state of the composer: the textarea and send button
are replaced by a centred line of secondary text reading "Out of credits — you
can read, but not reply." next to a small pill button "Add credits". The thread
above stays fully visible and readable.

Show light and dark.
```

---

## 3 · Credits

```
[paste design system]

Design a WhatsApp credits page for a CRM. Prepaid wallet, billed separately
from the product subscription — the page must make that separation obvious.

Header: "WhatsApp credits" bold, and under it in secondary text "Separate from
your Arthaleads subscription — these pay Meta for messages". A pill button
"Add credits" with a lightning icon sits on the right.

Three summary cards in a row, equal width:
  1. "Available balance" label, then "₹1,240.00" at 24px bold. If any credit is
     held for in-flight messages, an 11px secondary line "₹45.00 held for
     messages in flight"
  2. "Free replies left this month" label, then "842" at 24px bold, then an
     11px secondary line "of 1,000 from Meta, resets monthly"
  3. "Your rates" label, then three tight rows — Reply ₹0.15, Marketing ₹1.12,
     Utility ₹0.15 — with the label in secondary and the figure in primary.
     An 11px secondary footnote "per message, excl. GST"

Below, an auto-recharge card: title, a secondary subtitle "Get alerted before
you run out, so replies never stop mid-conversation", and a pill toggle on the
right (44x24, #22c55e when on). When on, two number inputs side by side with a
₹ prefix inside the field: "When balance drops below" and "Top up by", plus an
11px secondary note with an info icon.

Below that, a statement card. Header "Statement" with subtitle "Every top-up and
every message charged". Then a four-column table: When, What, Amount, Balance.
The What column has a small circular arrow icon — up in #15803d for a top-up,
down in secondary for a charge — the label, and for free-tier messages a tiny
green "free" pill. Amounts are right aligned, top-ups prefixed "+" in #15803d,
charges prefixed "−" in primary text. Tabular figures.

Also draw the empty state: centred, "Nothing yet." with a secondary line
"Top-ups and message charges will appear here as they happen."

Show light and dark.
```

---

## 4 · Add credits modal

```
[paste design system]

Design a centred modal, 512px wide, 24px radius, on a blurred dark scrim.

Title "Add WhatsApp credits" with a close X on the right, separated from the
body by a 1px border.

Body:
  a surface-low block showing "Current balance" in 12px secondary and
  "₹1,240.00" at 24px bold, plus an 11px secondary line "Plus 842 free replies
  left this month"

  "Amount to add" label, then a row of four equal preset pills — ₹500, ₹1,000,
  ₹2,500, ₹5,000. The selected one has rgba(255,107,0,0.12) fill, a 1.5px
  rgba(255,107,0,0.5) border and #ff6b00 text; the others are surface-low with
  a 1px border

  a number input below with a ₹ prefix inside the field

  a surface-low breakdown block with three rows: "Credits added ₹1,000.00",
  "GST (18%) ₹180.00", then separated by a 1px top border, "You pay ₹1,180.00"
  in bold

  an 11px secondary line with an info icon explaining per-message rates

  a full-width pill primary button "Pay ₹1,180.00" with a lightning icon

  an 11px centred secondary line "UPI, cards, net banking and wallets accepted."

Show light and dark.
```

---

## 5 · Templates list

```
[paste design system]

Design a message-templates page.

Header: "Message templates" bold, secondary subtitle "Required for any message
outside the 24-hour reply window. Meta reviews each one." On the right, a small
secondary pill button "Refresh" with a refresh icon, and a primary pill button
"New template" with a plus icon.

Body: a responsive grid of cards, three per row on desktop, two on tablet, one
on mobile. Each card:
  top row — template name in bold, truncated; under it an 11px secondary line
  "marketing · en_US". On the right, a status pill:
      Approved  #15803d on rgba(34,197,94,0.12)
      In review #b45309 on rgba(251,191,36,0.14)
      Rejected  #b91c1c on rgba(239,68,68,0.12)
  middle — the body text in 12px secondary, clamped to four lines, preserving
  line breaks
  if rejected — a tinted red block with the reason in 11px lowercase
  bottom — a small "Delete" text button with a trash icon in secondary that
  turns red on hover

Also draw the empty state: a centred outline template icon at 40% opacity,
"No templates yet" in bold, a secondary paragraph "A template is what lets you
message someone who has not written to you in the last 24 hours — every
campaign needs one.", and a primary pill button "Create your first template".

Show light and dark.
```

---

## 6 · Template builder

```
[paste design system]

Design a template builder. This is a full page, not a modal — it opens from the
templates list and returns there.

Top: a back control — left arrow plus the word "Templates" in secondary text.
Under it, "New template" in bold and a secondary line "Meta reviews every
template. Approval usually takes minutes but can take up to 24 hours."

Two columns: a form on the left, and a sticky preview panel of 320px on the
right. Single column on mobile with the preview above the submit button.

Left, first card:
  "Start from" label with three secondary pill buttons — New project launch,
  Site visit reminder, Price update
  "Template name" input with placeholder "new_project_launch" and a 12px
  secondary hint "Lowercase, numbers and underscores. Cannot be changed later."
  two dropdowns side by side, Category and Language

Left, second card:
  "Message body" — a six-row textarea. Under it on the left, a 12px secondary
  hint showing {{1}} and {{2}} in a code style, and on the right a character
  counter "0/1024"
  "Footer (optional)" single-line input

Then a primary pill button "Submit for review" with a send icon.

Right preview card: label "Preview" in 12px secondary, then a surface-low
rounded block containing a single WhatsApp outbound bubble — #dcf8c6 fill,
#111 text, 20px radius with the top-left corner squared to 4px — showing the
body with each {{n}} rendered as "[value 1]", "[value 2]". The footer appears
under the body at 11px, 60% opacity.

Under the bubble, an 11px secondary line with an info icon: "2 variables to
fill per recipient when you run a campaign." Plus, when marketing is selected,
a second line: "Marketing templates need recorded consent before sending, and
cost more per message than utility."

Show light and dark.
```

---

## 7 · Campaigns list

```
[paste design system]

Design a campaigns list page.

Header: "Campaigns" bold, secondary subtitle "Send an approved template to a
filtered set of leads". A primary pill button "New campaign" with a plus icon
on the right.

Body: a vertical stack of full-width cards. Each card:
  top row — campaign name in bold, then a status pill with a 10px icon:
      Draft     secondary text on surface-low, clock icon
      Sending   #b45309 on rgba(251,191,36,0.14), spinner
      Sent      #15803d on rgba(34,197,94,0.12), check-circle
      Failed    #b91c1c on rgba(239,68,68,0.12), x-circle
    under that, an 11px secondary line "new_project_launch · 10 Sep 2026 ·
    Pranav Nair"
  right — for drafts only, a secondary pill button "Review & send"
  for anything sent — a stats row separated by a 1px top border, showing
  label-over-value pairs in a horizontal row with generous gaps:
  Sent 412 · Failed 3 (value in #b91c1c when non-zero) · No consent 88 ·
  Recipient limit 12 · Cost ₹461.44. Labels 10px secondary, values 14px bold.

Also draw the empty state: a centred outline megaphone at 40% opacity,
"No campaigns yet", a secondary paragraph "Pick an approved template, choose who
it goes to using your usual lead filters, and see the cost before anything
sends.", and a primary pill button "Create a campaign".

Show light and dark.
```

---

## 8 · Campaign builder

```
[paste design system]

Design a campaign builder. Full page with a back control reading "Campaigns",
then "New campaign" in bold and a secondary line "Nothing sends until you
confirm the cost".

Two columns: form on the left, a sticky 340px cost panel on the right. Single
column on mobile with the cost panel above the send button.

Left, card one: "Campaign name" input, then a "Template" dropdown whose options
read "new_project_launch · marketing". Include the alternative state where no
approved template exists: a tinted amber block reading "No approved templates
yet. Create one and wait for Meta to approve it before running a campaign."

Left, card two: heading "Who gets it" with secondary subtitle "The same filters
you use on the Leads page". A 2x2 grid of controls — Status dropdown, Source
dropdown, "Created from" date, "Created to" date.

Left, card three (only when the template has variables): heading "Fill the
blanks" with subtitle "This template has 2 values filled per person", then one
dropdown per variable labelled {{1}}, {{2}}, each offering Lead name or Lead
phone.

Right cost panel:
  label "Before you send" in 12px secondary
  a people icon, then "412" at 24px bold, then "of 500" in 12px secondary
  two 11px secondary exclusion lines: "88 excluded — no marketing consent" and
  "0 excluded — no phone number"
  a surface-low block: "Cost" left, "₹461.44" right in bold; beneath it an 11px
  row with "₹1.12 each · marketing" left and "balance ₹1,240.00" right
  any blockers as tinted red rows with a warning triangle, 11px, for example
  "Not enough credits — need ₹461.44, have ₹120.00" or "This number's quality
  rating is RED. Sending more marketing now risks Meta restricting it."
  an 11px secondary line "Number quality: green · 1,000 per 24h limit"
  a full-width primary pill button "Send to 412"

Under the panel, an 11px secondary line with a lightning icon: "Credits are
held for the whole run before the first message goes out, so a campaign never
stops half-sent."

Show light and dark.
```

---

## 9 · Not connected

```
[paste design system]

Design the empty state shown when no WhatsApp number is connected yet.

Header row: a 40px rounded-square tile with rgba(37,211,102,0.12) fill holding
a #25D366 WhatsApp glyph, then "WhatsApp Conversations" in bold with a secondary
line "Connect your number to start receiving and sending messages".

A full-width status strip below: a crossed-out wifi icon in secondary, then
"WhatsApp not connected" in bold with a secondary line "Pick a provider below
and follow the steps to connect."

Then numbered step cards. Each step has a 24px circular #ff6b00 badge with the
white step number, the step title in bold beside it, and the content indented
to align under the title.

Step 1 "Choose your WhatsApp provider" — a 2x2 grid of selectable provider
cards. Each has a small coloured status dot, the provider name in bold, a
secondary tagline, and a pricing line in the provider's own colour. The selected
card has a tinted fill and a 1.5px border in that colour, plus a check mark top
right. Under the grid, a solid pill button in the provider's colour reading
"Create <provider> account" with an external-link icon, and a secondary pill
"Open dashboard".

Step 2 "Set your webhook URL" — an explanatory secondary line, then a
surface-low row holding a monospace URL in #ff6b00, truncated, with a small
"Copy" button on the right.

Step 3 "Enter your credentials" — a tinted amber note, then a password input,
two text inputs, a phone input, and a solid pill button in the provider colour
reading "Connect & test".

Show light and dark.
```
