# CLAUDE.md — Project Orientation

## What is this?

**Hertz LMS (Lead Management System)** — an interactive prototype demonstrating insurance replacement lead conversion workflows. It's a walkthrough-style app where users pick a role (Branch Manager, General Manager, or Admin) and step through a guided tour of that role's workflow. There is no backend; all data is mock.

## Tech Stack

- **React 19** with JSX (no TypeScript source files, but types installed for editor support)
- **Vite 7** for dev server and builds
- **Tailwind CSS v4** (utility-first, imported via `@import "tailwindcss"` in `index.css`)
- **Framer Motion** for step transitions and UI animations
- **ESLint** for linting (no test framework configured)
- **ES Modules** throughout (`"type": "module"`)

## Project Structure

All source lives under `prototype-lms/`:

```
prototype-lms/
├── src/
│   ├── App.jsx                    # Root — mode router (demo vs journey)
│   ├── main.jsx                   # React DOM mount
│   ├── index.css                  # Tailwind import
│   ├── components/                # Shared presentational components
│   │   ├── Landing.jsx            # Role picker (BM / GM / Admin)
│   │   ├── JourneyMode.jsx        # Walkthrough journey entry point
│   │   ├── WalkthroughShell.jsx   # Step navigation shell (arrows, dots, keyboard)
│   │   ├── MiniBarChart.jsx       # Reusable 4-week trend bar chart (Framer Motion animated)
│   │   ├── LeadQueue.jsx          # Lead table/list
│   │   ├── LeadDetail.jsx         # Single lead view with enrichment slot
│   │   ├── EnrichmentForm.jsx     # Form for BM to document lead context
│   │   ├── ComplianceDashboard.jsx# GM KPI dashboard (bar chart + summary cards)
│   │   ├── ThreeColumnReview.jsx  # GM 3-column lead analysis
│   │   ├── TranslogTimeline.jsx   # Activity timeline
│   │   ├── AdminUpload.jsx        # Upload confirmation summary
│   │   ├── OrgMapping.jsx         # Org hierarchy table
│   │   ├── StatusBadge.jsx        # Colored status pill
│   │   └── TitleCard.jsx          # Section title/subtitle
│   ├── components/interactive/    # Interactive demo view components
│   │   ├── InteractiveShell.jsx   # Demo shell — sidebar + content area, view routing
│   │   ├── InteractiveDashboard.jsx       # BM/GM/Admin dashboards (current state + 4-week trends)
│   │   ├── InteractiveLeadQueue.jsx       # Clickable lead list
│   │   ├── InteractiveLeadDetail.jsx      # Lead detail with enrichment actions
│   │   ├── InteractiveEnrichmentForm.jsx  # Stateful enrichment form
│   │   ├── InteractiveComplianceDashboard.jsx # GM compliance view
│   │   ├── InteractiveCancelledLeads.jsx  # GM cancelled leads review
│   │   ├── InteractiveThreeColumn.jsx     # GM 3-column analysis
│   │   ├── InteractiveSpotCheck.jsx       # GM spot check by branch
│   │   ├── InteractiveUploads.jsx         # Admin upload view
│   │   └── InteractiveOrgMapping.jsx      # Admin org mapping view
│   ├── components/layout/         # App chrome
│   │   ├── AppLayout.jsx          # Top bar + sidebar + content wrapper
│   │   ├── DemoTopBar.jsx         # Top navigation bar with logo
│   │   └── Sidebar.jsx            # Role-aware sidebar navigation
│   ├── config/
│   │   └── navigation.js          # Role metadata, sidebar nav items, view registry
│   ├── context/
│   │   └── AppContext.jsx          # Global app state (role, mode, view, navigation)
│   ├── selectors/
│   │   └── demoSelectors.js        # Data selectors (stats, filters, trend accessors)
│   ├── walkthroughs/              # Role-specific step sequences (journey mode)
│   │   ├── BranchManagerSteps.jsx # 8 steps — weekly lead review & enrichment
│   │   ├── GeneralManagerSteps.jsx# 8 steps — compliance, spot checks, directives
│   │   └── AdminSteps.jsx         # 4 steps — uploads & org mapping
│   └── data/
│       └── mockData.js            # All sample data (leads, managers, org map, weekly trends)
├── index.html
├── vite.config.js
├── eslint.config.js
└── package.json
```

## Architecture & Patterns

- **Two app modes** — `App.jsx` switches between **Interactive Demo** (product-like, stateful, sidebar-navigated) and **Customer Journeys** (step-by-step walkthroughs). Mode and role state lives in `AppContext`.
- **No router library** — view navigation is state-driven via `AppContext.navigateTo(viewId)`; `InteractiveShell` maps view IDs to components; `navigation.js` defines the view registry per role
- **No state management library** — global state in `AppContext` (React context + `useState`/`useCallback`); selectors in `demoSelectors.js` derive computed data from mock data
- **Step-based walkthroughs** (journey mode) — each walkthrough file exports an array of component functions (`[BM1, BM2, ...]`); `WalkthroughShell` renders the current step and handles prev/next navigation (buttons, arrow keys, dot indicators)
- **Interactive components mirror shared components** — `components/interactive/` wraps shared presentational components (e.g., `LeadQueue`, `ComplianceDashboard`) with stateful behavior and navigation
- **Dashboard pattern** — dashboards split into "This Week" (current snapshot cards) and "4-Week Trend" (MiniBarChart grid showing weekly metrics over time)
- **Slot pattern** — `LeadDetail` accepts an `enrichmentSlot` prop for composing different form states
- **All data is mock** — no API calls; everything comes from `mockData.js` (leads, managers, org map, `weeklyTrends`)

## Commands

```bash
cd prototype-lms
npm run dev      # Start dev server (Vite)
npm run build    # Production build
npm run preview  # Preview production build
npm run lint     # ESLint
```

## Styling Conventions

Tailwind utility classes with a custom Hertz brand palette:

| Color     | Hex       | Usage                    |
|-----------|-----------|--------------------------|
| Dark      | `#1A1A1A` | Primary text             |
| Gray      | `#6E6E6E` | Secondary text           |
| Light     | `#E6E6E6` | Borders                  |
| Gold      | `#F5C400` | Accent, highlights, hover|
| Green     | `#2E7D32` | Success, rented status   |
| Red       | `#C62828` | Errors, cancellations    |

Colors are used inline as Tailwind arbitrary values (e.g., `text-[#1A1A1A]`, `border-[#F5C400]`).

## Domain Glossary

- **HLES** — Hertz Lead Entry System; source of lead data via EDI
- **EDI** — Electronic Data Interchange; automated data feed
- **Lead** — an insurance replacement vehicle rental request
- **TRANSLOG** — activity log tracking contact attempts and system events
- **Enrichment** — BM-provided context on why a lead was cancelled/unused (reason, notes, next action, follow-up date)
- **Conversion Rate** — percentage of leads successfully rented
- **GM Directive** — instructions from General Manager to Branch Manager
- **Spot Check** — GM reviewing a specific branch's untouched leads
- **Org Mapping** — BM → Branch → GM hierarchy relationships

## Lead Statuses

`Rented` (converted) | `Cancelled` (lost, with reason) | `Unused` (no action taken) | `Reviewed` (GM reviewed)

## Role Workflows

**Branch Manager**: Reviews weekly cancelled/unused leads → enriches each with reason, notes, next action → tracks progress toward full enrichment compliance.

**General Manager**: Views compliance dashboard with conversion rates → reviews cancelled leads in 3-column layout (HLES reason vs. TRANSLOG vs. BM enrichment) → flags mismatches → adds directives → spot-checks branches.

**Admin**: Uploads HLES and TRANSLOG data files → reviews validation summaries → manages org mapping table (BM/Branch/GM assignments).
