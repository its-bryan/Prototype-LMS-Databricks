# Lead Management System (LMS) — Product Requirements Document

**Version:** 1.0 (V1 Prototype)
**Date:** 2026-02-21
**Author:** Product & Data Team
**Status:** Draft

---

## 1. Business Context

### 1.1 What Is Insurance Replacement Rental?

When a customer has a car accident, their insurance company authorises a rental car while the damaged vehicle is repaired. The insurer — not the customer — pays for the rental. This is the **insurance replacement (IR)** segment.

Hertz receives leads electronically via EDI (Electronic Data Interchange): when an insurance adjuster processes a claim and authorises a rental, the lead is sent directly into Hertz's reservation system (HLES). These are **warm leads** — the customer has already been assigned to Hertz by their insurer.

IR is one of Hertz's most valuable business lines — it carries higher margins and longer average rental durations than comparable segments, making it a significant revenue contributor.

The primary competitor is Enterprise, which holds the dominant market share in IR. Some insurance partners are "co-primary," meaning the same lead may be sent to both Hertz and Enterprise simultaneously — the first to convert the customer wins.

### 1.2 The End-to-End Lead Journey

```
1. ACCIDENT          Customer has an accident; insurance claim filed
        │
2. LEAD CREATED      Insurance adjuster sends EDI reservation to Hertz → lead appears in HLES
        │
3. CONTACT           Three channels attempt to reach the customer:
   ┌────┼────────────────────┐
   │    │                    │
 COUNTER (Branch)    HRD (Call Centre)    NO CONTACT
 Highest conversion  Moderate conversion  Lowest conversion
        │
4. ARRANGEMENT       Body shop selected, pickup date/time confirmed
   (often via MMR    Customers who complete MMR convert at significantly
    digital flow)    higher rates
        │
5. PICKUP            Customer physically gets the rental car
        │
6. RENTAL            Reservation converts to rental agreement (RENT_IND = 1)
                     KNUM changes from reservation format to contract format
        │
7. RETURN            Vehicle returned, billing record (DRB) sent to insurer
```

**Key terminology:**
- **HLES** — Hertz Liability and Equipment System, the mainframe that manages all IR reservations and contracts
- **Counter** — the local Hertz branch/location that fulfils the rental. Branch staff call the customer directly
- **HRD** — Hertz Replacement Desk, a centralised outbound call centre in Oklahoma City that contacts customers on behalf of branches
- **MMR** — Manage My Reservation, a digital self-service flow sent via text where customers can confirm their reservation, select a body shop, and choose a pickup time
- **EDI** — Electronic Data Interchange, the electronic channel through which insurance partners send and cancel reservations
- **TRANSLOG** — the transaction log in HLES that records every action taken on every reservation/contract

### 1.3 Why Leads Don't Convert

Every lead ends in one of three outcomes: **converted** (rented), **cancelled** (lead lost), or **unused** (still open or expired). A significant share of leads are lost. The primary reasons fall into five categories:

**1. No contact established**
A meaningful portion of leads are never contacted at all. Many of these are auto-cancelled by the insurance company via EDI within minutes of creation — before Hertz has any opportunity to act. The remainder represent real contact failures: wrong phone numbers, unanswered calls, or outbound calls flagged as spam. 

**2. Contact failure after initial attempt**
The branch or call centre reaches out but cannot establish a live conversation. Cancelled leads have significantly more failed contact attempts, voicemails left without response, and wrong number situations than converted leads. A competitor being mentioned in contact notes is a strong predictor of cancellation.

**3. Customer-driven cancellation**
The customer found alternative transportation, their vehicle was repaired sooner than expected, or they chose a competitor. These are legitimate losses — but currently they are not distinguished from operational failures because cancellation reasons are poorly recorded.

**4. Operational failures**
No vehicle available, pickup logistics couldn't be arranged, branch couldn't accommodate timing, or body shop coordination broke down. Weekend leads convert at materially lower rates than weekday leads, driven by reduced branch staffing.

**5. Branch phone infrastructure**
A large share of inbound calls to branches go unanswered. Some branch phone extensions answer almost no calls at all. When the call centre attempts to transfer a customer to a branch, a significant portion of those transfers fail.

**A critical insight: contact quality matters more than contact quantity.** Cancelled leads actually receive *more* contact attempts on average than converted leads. The problem is not insufficient effort but failed contacts — wrong numbers, unanswered calls, voicemails that are never returned.

### 1.4 Where the LMS Fits

The Lead Management System is part of a broader conversion improvement programme. The LMS specifically addresses the **branch operational layer** — it provides the visibility, accountability, and structured workflow that branch managers and general managers currently lack. It is the tool that will make branch-level initiatives (lead queue discipline, follow-up compliance, weekly reviews, escalation paths) executable and measurable.


---

## 2. Problem Statement

Hertz's insurance replacement branch managers currently do not track lead follow-ups. If they do, they are done manually using Excel spreadsheets stored on individual computers. This creates three critical problems:

1. **No upward visibility** — General managers have no way to see whether branch managers are actively working their leads, and are doing the right activity for conversion. There is no incentive not to shirk.
2. **No accountability loop** — HLES (Hertz's internal system) tracks reservations but not the quality or frequency of activity against them. There is no compliance mechanism.
3. **Manual enrichment is painful and lost** — Weekly compliance meetings (if done at all) require branch managers to manually filter a messy HLES Excel export, enrich each non-converted lead with notes and reasons, and present them to the GM. This takes significant time from non-tech-savvy users, and all the feedback and next steps captured in the meeting are never centralised or fed back into any system.

The result: branch managers can neglect follow-ups with no consequence, cancelled leads are written off without proper investigation, and potential revenue is lost in leads that were never properly worked.

---

## 3. User Journeys

### 3.1 Branch Manager — Daily Lead Work

**Today (as-is):**

The branch manager is expected to check the HLES system every 15 minutes for new leads. When a new lead appears, they call the customer to arrange a rental — confirming the body shop, pickup method, timing, and vehicle availability. If the customer doesn't answer, they may try again later, leave a voicemail, or move on.

If a lead is cancelled, there's no prompt to record why. Follow-up depends entirely on the individual branch manager's discipline and memory. A lead can go cold without anyone noticing.

Because the HLES system is so old and does not have proper reporting, branch managers are not incentivised to hammer away the activity and hustle to get the leads to convert. Activity is not being monitored / tracked. On top of that, the notes in HLES entered by the team members are very brief - again because no one is tracking it so Branch managers put the bare minimum. As a result, Hertz has no data / visibility as to why certain leads do not convert, or take so long to convert etc.

**With the LMS (to-be):**

Nothing really changes for the day-to-day operational for the Branch manager (as the HLES is a great operational system, but due to the poor visibility/reporting people get away doing the bare minimum or not at all). The LMS gives enhanced visibility to the GMs and leadership, so branches will take activity much more seriously. They will follow up, add rich notes, and be more incentivised to hustle for every lead.

### 3.2 Branch Manager — Weekly Meeting Prep

**Today (as-is):**

Before the weekly compliance call, the branch manager must download a raw HLES Excel export (large file), manually filter it to their branch (multiple steps, multiple pivots, multiple sheets), and go through each non-converted lead to prepare notes and explanations. This takes significant time, especially for branch managers who are not comfortable with Excel. The notes they prepare are on paper or in a personal file — they are not captured anywhere after the meeting.

**With the LMS (to-be):**

There is no separate prep step. The branch manager has been recording notes, cancellation reasons, and next steps throughout the week as they work their leads in HLES. When the weekly call starts, their data is already there — structured, up to date, and visible to the GM. The meeting becomes a review of what's already recorded, not a scramble to reconstruct it from memory.

### 3.3 General Manager — Weekly Compliance Meeting

**Today (as-is):**

The GM runs a group call with 5–10 branch managers, typically lasting about an hour. Each branch manager presents their own filtered Excel view of their leads. The GM listens, asks questions about specific cancellations or untouched leads, and gives verbal directions. There is no unified view — the GM is relying on each branch manager's self-reported summary. If a branch manager downplays a problem or skips over a lead, the GM has no way to catch it. Directives given during the meeting are not tracked; by the next week, there's no record of what was agreed.

**With the LMS (to-be):**

The GM opens the weekly meeting view, filtered by default to cancelled and unreviewed leads. For each lead, the HLES cancellation reason, the TRANSLOG activity trail, and the branch manager's enrichment notes are displayed side by side — the GM can immediately see whether the stated reason matches the recorded activity. Time to first contact and time to cancellation are visible, helping the GM spot leads that were auto-cancelled (not the branch's fault) versus leads that were neglected.

The GM works through the list, discusses leads with each branch manager, adds directives where needed, and archives leads once reviewed. The conversion scoreboard shows each branch manager's conversion rate ranked with quartile indicators — creating visible, named accountability. By the end of the meeting, every discussed lead has a recorded outcome, and every directive is captured in the system for follow-up next week.

### 3.4 General Manager — Between Meetings

**Today (as-is):**

Between weekly calls, the GM has almost no visibility into what's actually happening at their branches. They can see some high level reporting in Tableau but there is no sign of activity (when was the lead last called? What is the next step? Why is it not yet converting/what are we waiting for?) If a senior leader asks about a specific branch's performance or a specific lead, the GM has to call the branch manager and ask — there is no self-serve way to check. Proactive spot-checks require the same manual Excel process that branch managers use, so they rarely happen.

**With the LMS (to-be):**

The GM can open the LMS dashboard at any time and see, at a glance, which branches have untouched leads, which have overdue follow-ups, and which are falling behind on enrichment. If a senior leader asks a question, the GM can answer it in minutes. If they notice a branch with low activity, they can drill in, review specific leads, and add a directive — without waiting for the next weekly call.

---

## 4. Product Vision

A web-based Lead Management System that sits as a **visibility and enrichment layer on top of HLES data**. It does not replace HLES — it surfaces HLES data in a clean, actionable format and adds a structured layer for branch manager notes, cancellation reasons, next steps, and GM oversight.

The system serves two equally important users:
- **Branch Managers** — see their leads, add enrichment, prepare for weekly meetings
- **General Managers** — track compliance, review cancellations, drive accountability

### V1 Scope

- Small pilot: 5–15 branches, 1–2 GMs, hundreds of leads per week
- Data fed via periodic CSV/Excel export (not live API)
- "Show, not tell" prototype to demonstrate value and build organisational buy-in for a fully custom-built solution

### Explicitly Out of Scope (V2+)

- Central team escalation / "chase bucket" workflow
- Direct HLES API integration
- Automated notifications or alerts
- National rollout scale

---

## 5. User Roles & Permissions

### 5.1 Branch Manager

| Capability | Access |
|---|---|
| View own branch leads | Yes |
| View other branches' leads | No |
| View conversion dashboard with named peer comparison + quartile ranking | Yes |
| Change lead status (Unused / Rented / Cancelled) | **No** — status comes from HLES data feed only |
| Add enrichment (cancellation reason, next action, follow-up date, notes) | Yes |
| View TRANSLOG activity timeline for own leads | Yes |
| View GM directives on own leads | Yes (read-only) |

### 5.2 General Manager

| Capability | Access |
|---|---|
| View all leads across branches they oversee | Yes |
| Filter by branch | Yes |
| View compliance + conversion dashboard | Yes |
| View weekly meeting-ready view | Yes |
| Add GM directives / comments on any lead | Yes |
| Archive cancelled leads after review | Yes |
| Edit branch manager enrichment | No |

### 5.3 Admin

| Capability | Access |
|---|---|
| Upload CSV/Excel data (HLES export + TRANSLOG export) | Yes |
| Manage users (assign branch managers to branches, GMs to regions) | Yes |
| Configure cancellation reason categories | Yes |
| System settings | Yes |

---

## 6. Data Model

### 6.1 Data Sources

The system ingests two periodic data exports:

| Export | Contents | Purpose |
|---|---|---|
| **HLES Data Export** | Lead/reservation details, current status (Unused / Rented / Cancelled), cancellation reason (from HLES), `RENT_IND` conversion indicator | Source of truth for lead status |
| **TRANSLOG Data Export** | Activity log of all actions taken on each lead within HLES | Shows whether branch managers are actually working their leads |

Data is uploaded by an Admin as CSV or Excel files. The system parses, validates, and merges with existing lead records.

### 6.2 Lead Statuses

Statuses are **derived from HLES data** and are not user-editable:

| Status | Meaning | Dashboard Behaviour |
|---|---|---|
| **Unused** | Not yet converted — active opportunity | Visible on compliance dashboard as working queue |
| **Rented** | Converted to rental (`RENT_IND = 1`) — success | Drops off compliance dashboard |
| **Cancelled** | Lead was lost — closed without conversion | Stays on compliance dashboard until GM archives |

**Lifecycle:**

```
New lead arrives → Unused (active opportunity)
                      │
            ┌─────────┴─────────┐
         Rented              Cancelled
     (success — exits      (stays on dashboard)
      compliance view)           │
                          GM reviews reason
                                 │
                          GM archives when
                          reason is satisfactory
```

### 6.3 Enrichment Layer

Stored in the LMS database (not in HLES). This is the value-add of the system:

| Field | Type | Filled By | Purpose |
|---|---|---|---|
| **Cancellation reason** | Structured dropdown | Branch Manager | Standardised reason for lost lead |
| **Next action** | Dropdown (Call again, Await callback, Needs vehicle, Send to body shop, etc.) | Branch Manager | What happens next for unused leads |
| **Follow-up date** | Date picker | Branch Manager | When the next action should happen |
| **Notes** | Free text | Branch Manager | Additional context, meeting prep |
| **GM directive** | Free text | General Manager | Instructions or feedback from GM |

### 6.4 TRANSLOG Activity Display

Each lead displays a **chronological timeline** of all HLES-recorded events parsed from the TRANSLOG export. This allows management to verify that actions were actually taken — not just claimed.

### 6.5 Cancellation Reason Cross-Check

For cancelled leads, three sources of cancellation context are displayed side by side:

1. **HLES cancellation reason** — from the HLES data export
2. **TRANSLOG notes** — activity and notes recorded in HLES
3. **LMS enrichment** — the branch manager's structured reason + free-text notes

This allows the GM to verify consistency and identify leads where the stated reason doesn't match the recorded activity.

---

## 7. Cancellation Reason Categories

Standardised dropdown options for the enrichment layer:

### Category 1 — Customer-Driven (Legitimate)
- Customer has alternative transportation
- Customer's vehicle repaired sooner than expected
- Customer declined rental (no reason given)
- Customer went with competitor

### Category 2 — Contact Failure
- Unable to reach customer (bad phone number)
- Unable to reach customer (no answer after multiple attempts)
- Customer unresponsive to MMR / digital outreach

### Category 3 — Operational / Hertz-Side
- No vehicle available in required class
- Pickup/delivery logistics couldn't be arranged
- Branch couldn't accommodate timing
- Body shop coordination issue

### Category 4 — Data / System
- Duplicate or invalid lead
- Insurance partner cancelled (EDI auto-cancel)
- Lead data incomplete or incorrect

### Category 5 — Other
- Other — specify in notes (free text required)

[we can get GMs inputs on these]
---

## 8. Key Screens

### 8.1 Branch Manager — Lead Queue (Default View)

The branch manager's home screen. Compliance-first design: **leads needing updates** are surfaced at the top.

- Leads sorted by urgency: overdue follow-ups → unused leads with no enrichment → all others
- Filterable by status: Unused / Cancelled / Rented
- Each lead row shows: customer name, reservation ID, status, days since creation, **time to first contact** (derived from TRANSLOG), **time to cancellation** (if cancelled — helps identify auto-cancels), last TRANSLOG activity date, whether enrichment notes exist
- Click into a lead to open the detail view

### 8.2 Lead Detail View

Full view of a single lead with two panels:

**Left panel — HLES Data (read-only):**
- Customer info and reservation details
- Current HLES status and HLES cancellation reason (if applicable)
- **Time to first contact** — derived from TRANSLOG (time between lead creation and first contact event)
- **Time to cancellation** — if cancelled, time between lead creation and cancellation event. Short times (e.g., minutes) flag likely auto-cancels; also surfaces who/what triggered the cancellation
- TRANSLOG activity timeline (chronological)

**Right panel — LMS Enrichment (editable by branch manager):**
- Cancellation reason dropdown
- Next action dropdown
- Follow-up date picker
- Free-text notes
- GM directive (read-only for branch manager)

### 8.3 GM — Compliance + Conversion Dashboard

The general manager's overview screen with two sections:

**Conversion scoreboard:**
- Each branch manager's conversion rate, ranked
- Named leaderboard with quartile indicators
- Trend over time (week over week)

**Compliance metrics:**
- % of unused leads with enrichment notes, by branch
- % of cancelled leads with cancellation reasons filled in, by branch
- Count of overdue follow-ups, by branch
- Filterable by branch

### 8.4 GM — Weekly Meeting View

The screen the GM uses to run the weekly compliance call:

- Shows **all leads** for the selected period
- Filterable by: status (Unused / Cancelled / Rented), branch, archive status (Unreviewed / Archived)
- **Default filter: Cancelled + Unreviewed** (where most meeting time is spent)
- For each lead: HLES reason, TRANSLOG notes, branch manager enrichment, **time to first contact**, and **time to cancellation** (if cancelled) displayed **side by side** for cross-checking
- **Archive button** per lead — GM marks as reviewed/resolved after discussion
- GM can drill into unused leads to review activity levels and push follow-up

---

## 9. Data Pipeline

### 9.1 Source Systems

HLES produces two weekly data exports that feed the lead management system.

#### Conversion Data (Reservation-Level)

- One row per insurance replacement reservation
- **~34K rows/month**, 35 columns
- **Primary key:** `CONFIRM_NUM` — original reservation number (format `XXX-XXXXXXX`), never changes
- `KNUM` — starts as a copy of `CONFIRM_NUM`; changes to a letter-prefixed contract number (e.g., `H45533106`) when the reservation converts to a rental
- Key outcome fields:
  - `RENT_IND` (1/0) — did the reservation convert to a rental
  - `CANCEL_ID` (1/0) — was the reservation cancelled
  - `UNUSED_IND` (1/0) — did the reservation expire without action
  - `CANCEL_REASON` — 14 categories explaining why cancellations occurred
- Contact tracking: `CONTACT_GROUP` (Counter ~52%, HRD call centre ~37%, No Contact ~11%)
- Response time: `DT_FROM_ALPHA1` + day/hour/minute diff fields measure speed to first contact
- Org hierarchy: Region, Zone, Area Manager, General Manager, Rent Location (~1,100 locations)
- Insurance partners: CDP code + name (~650 unique, State Farm dominant)
- Current conversion rate: ~60%, target 80%+
- Data quirks: most column names have `\n` prefix from Excel export; two columns entirely null

#### TransLog (Transaction-Level Activity Feed)

- One row per system event — every action taken on every reservation/contract
- **~4.4M rows/month**, 42 columns, **~1.2 GB CSV/month**
- Key identifier: `Knum` (99% populated)
- Event taxonomy via `EventType`:
  - **0** — Reservation events (creation, date changes, cancellation, opened into rental)
  - **1** — Rental Agreement events (credit auth, DRB sent, rate updates, repair shop calls)
  - **3** — EDI events (electronic updates from insurance partners)
  - **4** — Location/Contact events (customer contact, failed attempts, emails)
  - **2** — Employee events (logons)
- Contact-specific events in `MSG1` (EventType 4): initial contact, successful contact, failed attempt, email sent, customer refused

### 9.2 Join Logic

Single join: **`Conversion.KNUM = TransLog.Knum`**

This works for both converted and unconverted reservations:
- **Unconverted:** KNUM stays in reservation format (`037-XXXXXXX`), matches TransLog Knum in the same format
- **Converted:** KNUM changes to contract format (`H45533106`), matches TransLog Knum in the contract format

Match rates:
- Converted leads: ~95% match, ~6 TransLog events per lead
- Unconverted leads: ~75% match, ~3 TransLog events per lead

No conditional join logic required — one key covers both populations.

### 9.3 Ingestion Strategy

| Data Source | Frequency | Strategy | Rationale |
|---|---|---|---|
| **Conversion Data (HLES)** | Weekly | Rolling 8-week window, full upsert on `CONFIRM_NUM` | Reservation outcomes change retroactively — a reservation may convert, cancel, or update weeks after creation |
| **TransLog** | Weekly | Append current week only | Events are immutable once logged; historical rows never change |

Key ingestion requirements:
- HLES upsert must key on `CONFIRM_NUM` (the stable primary key), not `KNUM` (which changes upon conversion)
- TransLog append should handle orphan events — some events may reference KNUMs not yet present in Conversion Data; store and link when the matching reservation appears in a future HLES load

### 9.4 Key Data Insights for System Design

1. **11% of reservations receive no contact at all** — these are immediate opportunities for the system to flag and surface
2. **Unconverted leads have sparser activity trails** (~3 events vs ~6 for converted) — the system should surface leads with low activity as needing attention
3. **Response time is measurable** via `DT_FROM_ALPHA1` and can be reconstructed from TransLog timestamps — the system can track SLA performance
4. **The full contact journey is reconstructable** from TransLog EventType 0 and 4: no contact → initial contact → follow-up attempts → success/failure
5. **Cancel reasons (14 categories)** from HLES provide actionable categorisation that can be cross-checked against LMS enrichment
6. **The data covers ~1,100 locations, ~140 area managers, ~160 general managers** — the system can provide performance dashboards at every level of the org hierarchy

---

## 10. Technical Architecture (V1)


| Component | Technology | Notes |
|---|---|---|
| **Frontend** | Web application (React or similar) | Browser-based, no install required |
| **Backend** | Python (Flask or FastAPI) | Aligns with existing team Python expertise |
| **Database** | PostgreSQL or SQLite | Stores enrichment data + ingested HLES/TRANSLOG data |
| **Data ingestion** | CSV/Excel upload via Admin interface | Admin uploads HLES + TRANSLOG exports on a regular cadence |
| **Authentication** | Simple role-based login | Three roles: Branch Manager, GM, Admin |
| **Hosting** | TBD (cloud or internal) | Pilot scale: minimal infrastructure needed |

---

## 11. Success Criteria

### Adoption Metrics
- % of branch managers logging in and adding enrichment notes weekly
- % of cancelled leads with a structured cancellation reason filled in
- % of unused leads with next steps recorded

### Business Impact Metrics
- Reduction in time spent on weekly meeting prep (target: hours → minutes)
- GM can identify untouched leads within minutes instead of waiting for the weekly call
- Conversion rate improvement in pilot branches vs. non-pilot branches (longer term)

### Data Quality Metrics
- Consistency between HLES cancellation reasons and LMS enrichment notes
- Reduction in idle "uncontacted" unused leads

---

## 12. Future Considerations (V2+)

- **Central team escalation**: "Chase bucket" workflow for leads with bad contact data — branch flags it, central team works with adjusters
- **Direct HLES integration**: Real-time or near-real-time data feed via API instead of CSV uploads
- **Automated alerts**: Notify branch managers of new leads, overdue follow-ups
- **National rollout**: Scale to 200+ branches
- **AI-assisted insights**: Pattern detection on cancellation reasons, predictive conversion scoring
