# LMS Prototype — Interactive Walkthrough Design

**Version:** 1.0
**Date:** 2026-02-23
**Status:** Approved

---

## Overview

A single-page React app that presents three guided, animated walkthroughs of the Lead Management System — one per user role (Branch Manager, General Manager, Admin). Each walkthrough renders realistic mock screens that animate between states as the viewer clicks to advance. Designed for senior leadership presentation.

## Tech Stack

- **Framework:** Vite + React
- **Styling:** Tailwind CSS
- **Backend:** None — fully static, no server required
- **Data:** Hand-crafted mock data embedded in the app
- **Target:** Laptop/projector (16:9). Not mobile-optimised.

## Brand

| Token | Value | Usage |
|---|---|---|
| Background | `#FFFFFF` | All backgrounds |
| Primary accent | `#F5C400` | Highlights, active states, badges (used sparingly) |
| Text | `#1A1A1A` | Headlines, body text |
| Secondary | `#6E6E6E` | Subtitles, secondary data |
| Dividers | `#E6E6E6` | Gridlines, borders |
| Positive | `#2E7D32` | "Rented" badges, improvement indicators |
| Negative | `#C62828` | "Cancelled" badges, decline indicators |

No gradients, no shadows, no heavy borders. Clean, light, modern.

## Navigation & Layout

### Landing Page

- "Hertz" wordmark top-left (charcoal + yellow underline)
- Title: "Lead Management System"
- Subtitle: "A visibility and enrichment layer for insurance replacement lead conversion"
- Three horizontal cards — one per role:
  - **Branch Manager** — "Review and enrich your leads"
  - **General Manager** — "Track compliance and drive accountability"
  - **Admin** — "Upload data and manage configuration"
- Each card has a line icon, role name, one-line description, yellow left-border on hover
- Click → fade into that walkthrough

### Walkthrough Navigation

- Bottom bar: progress dots (filled = visited, outlined = upcoming, yellow = current)
- Step counter: "3 of 8" right-aligned
- Left/right arrow buttons at screen edges (appear on hover)
- Keyboard: left/right arrow keys
- Top-left: "← Back to journeys" link
- Click-to-advance only — no auto-play

### Transitions

- ~400ms ease between steps
- Cross-fade between full screens
- Within screens: elements slide/fade in (table rows highlight, panels slide from side, form fields animate)

---

## Walkthrough 1: Branch Manager — Weekly Lead Review (8 steps)

### Step 1 — Title Card
"Branch Manager — Weekly Lead Review." Subtitle: "Review cancelled and unused leads. Add context. Prepare for the weekly call." White screen, yellow accent line.

### Step 2 — Lead Queue
Table fades in with ~12 leads. Columns: Customer, Reservation ID, Status, Days Open, Time to First Contact, Last Activity, Enrichment Status. Status badges: red (Cancelled), yellow (Unused), green (Rented). Banner: "6 leads need enrichment." Sorted by urgency — unenriched leads at top.

### Step 3 — Open Cancelled Lead
"Sarah Mitchell — Cancelled" row highlights in yellow. Detail panel slides in from right, table compresses to half-width. Left panel: HLES data (reservation details, cancellation reason: "NO SHOW") + TRANSLOG timeline (3 events: lead created → call attempted → voicemail left). Right panel: empty enrichment form.

### Step 4 — Fill Enrichment
Cancellation reason dropdown animates open → "Unable to reach — no answer after multiple attempts" selected. Notes field types out: "Called 3x over 2 days, voicemail each time. Number may be incorrect — only 9 digits in HLES." Follow-up date suggestion appears.

### Step 5 — Save and Return
Green checkmark flashes on enrichment panel. Panel slides away. Full table returns — that lead now has a green enrichment check. Banner: "5 leads need enrichment."

### Step 6 — Open Unused Lead
"James Cooper — Unused" highlights. Detail panel slides in. TRANSLOG: lead created → customer contacted → "will come into location" → no activity for 3 days. BM selects next action: "Call again," follow-up date: tomorrow. Notes: "Customer confirmed pickup last Tuesday but never showed. Calling to reschedule."

### Step 7 — Queue Progress
Full table view. Most leads now have green checks. Banner: "1 lead needs enrichment." Queue feels worked-through.

### Step 8 — Summary Card
"Every cancelled lead explained. Every unused lead has a next step. Ready for the weekly call." Miniature completed queue with all green checks, fading to yellow accent line.

---

## Walkthrough 2: General Manager — Compliance & Oversight (8 steps)

### Step 1 — Title Card
"General Manager — Compliance & Oversight." Subtitle: "Track conversion. Review cancellations. Drive accountability."

### Step 2 — Compliance Dashboard
GM home screen. Top: horizontal bar chart — branch managers ranked by conversion rate, bars animate growing. Top performers green, bottom quartile red, middle yellow/gray. Named labels (e.g. "T. Rodriguez — 78%"). Below: summary cards — "23 Cancelled Unreviewed", "8 Unused Overdue", "91% Enrichment Compliance" — numbers count up.

### Step 3 — Weekly Meeting View
Tab highlights "Weekly Meeting." Dashboard cross-fades to filtered table: cancelled + unreviewed leads across branches. Columns: Customer, Branch, BM Name, Status, HLES Reason, Time to First Contact, Time to Cancellation, Enrichment Status. Active filter bar: "Cancelled · Unreviewed."

### Step 4 — Drill Into Lead
"Sarah Mitchell — Cancelled" highlights. Detail panel slides in with three columns side by side:
- **HLES reason:** "NO SHOW"
- **TRANSLOG trail:** lead created → call attempted → voicemail left
- **BM enrichment:** "Unable to reach — no answer after multiple attempts. Called 3x, voicemail each time."

### Step 5 — Mismatch Detected
Different lead: "Robert Hayes — Cancelled." Three-column view loads. HLES reason: "CUSTOMER CANCELLED." TRANSLOG: zero contact events. BM enrichment: "Customer went with competitor." Yellow warning indicator pulses — stated reason doesn't match activity trail. Caption: "The stated reason doesn't match the evidence. Was this lead ever actually worked?"

### Step 6 — Directive + Archive
GM types directive: "No contact attempts recorded. Discuss in meeting — need to understand what happened." Archive button appears → clicked → lead fades, shows "Reviewed" badge. Back to table.

### Step 7 — Between Meetings: Spot Check
New scene. GM opens dashboard on a different day. A branch shows "5 untouched leads" in red. GM drills in — unused leads with no enrichment and low TRANSLOG activity. Adds directive: "Follow up on these before Friday." Caption: "No need to wait for the weekly call."

### Step 8 — Summary Card
"Full visibility. No surprises. Every lead accounted for." Miniature dashboard with all-green compliance indicators, yellow accent line.

---

## Walkthrough 3: Admin — Data & Configuration (4 steps)

### Step 1 — Title Card
"Admin — Data & Configuration." Subtitle: "Upload data. Manage mappings. Keep the system current."

### Step 2 — HLES Upload
Admin screen with drag-and-drop upload zone. CSV file drops in → progress bar animates. Validation summary slides up: "34,218 rows parsed. 1,847 new leads. 29,604 updated. 2,767 unchanged. 3 rows failed validation (missing CONFIRM_NUM)." Expandable error section. Green "Import Confirmed" button.

### Step 3 — TRANSLOG Upload
Same upload flow. Validation summary: "142,906 events parsed. 138,211 matched to existing leads. 4,695 orphan events (stored for future matching)." Info note: "Orphan events auto-link when matching leads appear in future uploads."

### Step 4 — Org Mapping
Admin uploads org mapping CSV. Preview table animates in: Branch Manager, Branch Location, General Manager (~15 rows). One row highlights — admin edits GM assignment inline via dropdown. Another row flagged yellow for missing GM — admin fills it in. "Confirm Mapping" button. Caption: "Upload in bulk. Edit where needed."

---

## Mock Data

Hand-crafted, realistic names and scenarios. No real Hertz data. Examples:

**Leads:**
- Sarah Mitchell — Cancelled, NO SHOW, contact attempts failed
- James Cooper — Unused, confirmed pickup but no-showed, needs follow-up call
- Robert Hayes — Cancelled, CUSTOMER CANCELLED but zero contact events (mismatch scenario)
- Maria Santos — Rented, successful conversion
- David Kim — Unused, awaiting callback

**Branch Managers:** T. Rodriguez, M. Chen, A. Patel, K. Johnson, L. Thompson
**General Managers:** D. Williams, R. Martinez
**Branches:** Downtown East, Airport South, Westside, Northgate, Central Station

---

## File Structure

```
prototype-lms/
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── data/
│   │   └── mockData.js          # All hand-crafted mock data
│   ├── components/
│   │   ├── Landing.jsx           # Landing page with 3 role cards
│   │   ├── WalkthroughShell.jsx  # Navigation, progress dots, transitions
│   │   ├── TitleCard.jsx         # Reusable title/summary slides
│   │   ├── LeadQueue.jsx         # BM lead table
│   │   ├── LeadDetail.jsx        # Split panel with HLES + enrichment
│   │   ├── EnrichmentForm.jsx    # Animated form fill
│   │   ├── ComplianceDashboard.jsx  # GM bar chart + summary cards
│   │   ├── WeeklyMeetingView.jsx    # GM filtered table
│   │   ├── ThreeColumnReview.jsx    # HLES / TRANSLOG / Enrichment side by side
│   │   ├── AdminUpload.jsx       # Upload + validation summary
│   │   └── OrgMapping.jsx        # Table with inline editing
│   └── walkthroughs/
│       ├── BranchManagerSteps.jsx
│       ├── GeneralManagerSteps.jsx
│       └── AdminSteps.jsx
```
