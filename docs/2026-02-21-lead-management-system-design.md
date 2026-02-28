# Lead Management System (LMS) — Product Requirements Document

**Version:** 2.0 (V1 Prototype + ZGM Feedback)
**Date:** 2026-02-27 (originally 2026-02-21)
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

### 3.5 Jobs to Be Done

Each role comes to the LMS with a specific job in mind. The interface should be designed around these jobs — not around features or data tables. If a user can't complete their job quickly and obviously, the design isn't working.

#### Branch Manager — Jobs

**Job 1: "Show me what needs my attention this week"**

The BM opens the LMS and immediately sees which leads need action. They shouldn't have to search, filter, or sort to find them. The system should answer these questions on arrival:

- How many leads need comments? (cancelled or unused leads with no BM input yet)
- Which leads are overdue for follow-up? (follow-up date has passed)
- How am I tracking overall? (what % of my leads are commented on)

The BM's mental model is an inbox: items come in, you work through them, and when you're done, you're done. The "done" state should feel satisfying — not just an empty list, but a clear signal that you're caught up.

**Job 2: "Let me explain what happened with this lead"**

The BM clicks into a specific lead and needs to quickly understand the story so far (what HLES says, what the TRANSLOG shows), then add their own context: why did this lead not convert, and what's the next step?

This is the core enrichment action. What the BM needs to do:

- Read the HLES cancellation reason (e.g., "NO SHOW") and the TRANSLOG activity trail (e.g., 3 calls, all voicemail)
- Select a structured cancellation reason from a dropdown (see Section 7 for categories)
- Add free-text notes with additional context (e.g., "Phone number only has 9 digits — likely data quality issue")
- Set a next action and follow-up date for unused leads that still have a chance

This should take **under 60 seconds per lead**. If it takes longer, the form is too complex. BMs will do this for 10–30 leads per week. It needs to be fast and painless, not a chore.

**Job 3: "Let me see what my GM is going to see before the meeting"**

Before the weekly compliance call (typically Thursday), the BM wants to preview exactly what the GM will be looking at. This means: all cancelled leads for the current week, plus all unused leads as of today — including unused leads that have carried over from previous weeks. If a lead is sitting there without a comment, the BM knows the GM is going to ask about it.

This is a meeting-prep job, but it shouldn't feel like prep. If the BM has been adding comments throughout the week (Job 2), this view should just confirm they're ready. If they haven't, this is the "oh no" moment where they see the gaps and can fill them in before the call.

The key insight: the BM and the GM are looking at the same leads. The BM should be able to see their leads through the GM's eyes — filtered the same way, sorted the same way. No surprises in the meeting.

**Job 4: "Show me I'm keeping up with my peers"**

BMs can see a conversion dashboard with named peer comparison. This isn't their primary task, but it's a motivator. They want to see where they rank relative to other branch managers — and whether they're improving or falling behind. The leaderboard creates healthy competition and signals that activity is being watched.

#### General Manager — Jobs

**Job 5: "What's the state of my zone right now?"**

The GM opens the LMS and needs to see the big picture across all their branches in seconds. The questions they're trying to answer:

- What's our conversion rate, and is it trending up or down?
- What % of leads are we contacting within 30 minutes? (This is the #1 metric — David (ZGM) said: "My number one question is always… what percentage are we contacting within thirty minutes." This metric should be for the current week's data.)
- How much of the first contact is coming from branches vs HRD (the call centre)? (David: "HRD is really kind of like when you don't do your job, they're there to fix it." High HRD contact rate means branches aren't picking up the phone. This is a current-week metric.)
- Which branches are falling behind on compliance? (leads without comments, overdue follow-ups)
- Are there any red flags I need to act on right now?

This is a dashboard job. The GM should be able to answer all of these questions without clicking anything — the default view should surface the answers. All dashboard metrics should be filterable (by branch, by area manager, by insurance company, by date range).

**Job 6: "Who's converting and who's not?"**

The GM needs a leaderboard/conversion view that answers: which branches, area managers, or GMs are performing well, and which are falling behind?

**Conversion bar chart — the core visual:**

Each entity (branch, AM, GM, or zone) should be shown as a stacked horizontal bar with three segments:

- **Rented** (green) — leads that converted to rentals
- **Cancelled** (red) — leads that were lost
- **Unused / Opportunity** (yellow/amber) — leads still open, yet to convert or cancel

This gives the GM an instant read on the composition of each entity's leads — not just a single conversion percentage, but the full breakdown. A branch with 60% rented, 10% cancelled, and 30% unused tells a very different story from one with 60% rented, 35% cancelled, and 5% unused. The first has upside potential; the second is leaking.

**Time dimension:**

- Show the **last 4 weeks**, week by week, so the GM can see trends (is this branch improving or declining?)
- Include a **blended trailing 4-week conversion rate** — a single percentage that smooths out weekly noise and gives the true trend line (e.g., "4-week avg: 72%")

**Additional features:**

- Sorted from best to lowest conversion rate
- The ability to toggle between different views: by Branch, by Area Manager, by GM, by Zone
- A "Most Improved" view — who made the biggest jump week over week?
- Delta indicators showing the direction of change (↑ or ↓)

This is the accountability lever. When conversion rates are named and ranked, people pay attention. David's feedback confirmed this is central to how GMs drive performance.

**Job 7: "Prepare for and run the weekly compliance meeting"**

Once a week (typically Thursday), the GM runs a compliance call with their branch managers. This is arguably the most important moment in the weekly cycle. The LMS should make this meeting focused and efficient.

This may warrant its own dedicated view — a "Meeting Mode" or "Weekly Review" that's purpose-built for running the call, separate from the day-to-day dashboard. The GM needs:

- A view of all cancelled leads from the current week, plus all unused leads as of today (including carryovers from previous weeks) that haven't been reviewed yet, across all branches
- For each lead: what HLES says happened, what TRANSLOG shows actually happened, and what the BM says happened — side by side
- The ability to spot mismatches (e.g., BM says "customer cancelled" but TRANSLOG shows zero contact attempts — was this lead ever actually worked?)
- A way to add a directive (instruction to the BM) and archive the lead once discussed

The meeting should work like a checklist: go through the unreviewed leads one by one, discuss, directive if needed, archive, next. By the end of the meeting, every lead has been accounted for.

**Job 8: "Spot-check a branch between meetings"**

Between weekly calls, the GM notices something — maybe a branch's numbers dipped, maybe a senior leader asked about a specific location. The GM needs to drill into a single branch's leads on demand, without waiting for the next meeting. They want to see:

- Untouched leads (no contact, no comments)
- Leads where activity doesn't match the stated outcome
- Overall branch metrics vs the zone average

After reviewing, the GM may add a directive: "Follow up on these before Friday." The BM sees that directive next time they open the LMS.

#### Admin — Jobs

**Job 9: "Upload this week's data and make sure it loaded correctly"**

The Admin uploads HLES and TRANSLOG CSV exports every Monday. They need clear feedback: how many records were parsed, how many are new vs updated, and whether any rows failed validation. If rows fail, they need to see why (e.g., missing CONFIRM_NUM) and decide whether to fix and re-upload or proceed without them. This upload kicks off the entire weekly cycle — nothing else works until the data is in.

**Job 10: "Keep the org mapping current"**

When a branch manager transfers, a new GM is assigned, or a branch is added, the Admin updates the org mapping (BM → Branch → AM → GM → Zone). This should be simple table editing — no complex forms, just change the value and save.

### 3.6 Urgency & Priority Logic

The system needs a consistent definition of what "needs attention" means. These aren't hard rules for implementation — they're the logic that should drive how leads are surfaced and ordered.

**Lead priority tiers (highest to lowest):**

| Priority | Condition | Why it matters |
| --- | --- | --- |
| **Overdue** | Follow-up date has passed and lead is still unused | BM committed to an action and hasn't done it |
| **Cancelled — no comment** | Lead is cancelled and BM hasn't added a reason | GM will ask about this in the weekly meeting — BM needs to explain |
| **Unused — no comment** | Lead is unused (active opportunity) with no BM input | Might be slipping through the cracks |
| **Unused — has comment** | Lead is unused but BM has added notes/next action | Being actively worked — lower urgency |
| **Cancelled — has comment** | Lead is cancelled and BM has explained why | Ready for GM review |
| **Rented** | Lead converted successfully | No action needed — success |

**What "overdue" means:** A lead becomes overdue when the BM set a follow-up date and that date has passed without the lead converting or the BM updating their notes. The specific threshold can be flexible in the prototype, but the concept is: you said you'd do something by this date, and you haven't.

**What "untouched" means (for GM spot-checks):** A lead with zero or minimal TRANSLOG activity (no contact attempts) AND no BM comments. These are the leads that may have been ignored entirely.

### 3.7 The Weekly Cadence

Everything in the LMS revolves around a weekly cycle. The data arrives once a week, and everything flows from that. Understanding this rhythm is essential to designing the right experience.

**The weekly timeline:**

```
MONDAY        TUESDAY–WEDNESDAY       THURSDAY              FRIDAY
Admin uploads  BMs enrich their       Weekly compliance     Follow-up on
HLES + TRANSLOG  leads (add comments,   meeting — GM reviews  directives from
data. This is    next actions,          leads with BMs on     the meeting.
the trigger.     follow-up dates)       a group call.         New week begins
                                                             Monday.
```

**Monday — Data Upload Day:**

The Admin uploads the latest HLES and TRANSLOG CSV exports. This is the single data refresh for the week. Once uploaded, the system reflects the previous week's lead activity: which leads converted, which were cancelled, what contact attempts were made. The "Data as of" date updates in the system so everyone knows how fresh the data is.

**Tuesday–Wednesday — Branch Manager Enrichment Window:**

The BM opens the LMS and sees the current state of their leads. The data now reflects what happened last week. Their job is to work through the leads that need comments:

- **New cancelled leads from last week** — Why did these not convert? BM selects a structured reason, adds notes.
- **Unused leads (cumulative)** — These are all leads that are still open and haven't converted or been cancelled. This includes carryovers from previous weeks — a lead that was unused two weeks ago and is still unused today will keep appearing until it resolves. BM adds next actions and follow-up dates.
- **Overdue follow-ups** — Leads where the BM previously set a follow-up date that has now passed. These need updated notes or a new follow-up date.

This isn't a marathon session. Ideally the BM is spending 15–30 minutes across Tuesday and Wednesday getting their leads commented on. By Wednesday evening, they should be "all caught up" — ready for Thursday's meeting.

**Thursday — Weekly Compliance Meeting:**

The GM runs the weekly call with their BMs (typically 5–10 per call, ~1 hour). The GM opens the meeting view, which shows:

- All cancelled leads from the current week that haven't been reviewed
- All unused leads as of today (including carryovers from previous weeks) that haven't been reviewed
- Each lead with three sources of truth side by side: HLES reason, TRANSLOG trail, BM comments

The GM works through the list lead by lead. For leads where the BM has good comments and the story is consistent, the GM archives quickly. For leads with mismatches or missing comments, the GM discusses with the BM and may add a directive. By the end of the meeting, the unreviewed queue should be empty.

The GM also reviews last week's performance metrics during or before the meeting: conversion rates, time to first contact, branch vs HRD contact split, compliance rates. These are all based on the Monday data upload and reflect the previous week's performance.

**Friday — Follow-Up:**

BMs action any directives from Thursday's meeting. The cycle resets on Monday with the next data upload.

**What carries over between weeks:**

- **Unused leads persist.** An unused lead from 3 weeks ago that's still open will keep appearing in the BM's queue and the GM's meeting view until it converts, gets cancelled, or is otherwise resolved. These are cumulative — they don't reset each week.
- **Cancelled leads persist until archived.** A cancelled lead stays visible until the GM reviews and archives it in a meeting.
- **Comments and directives persist.** Everything the BM and GM record in the LMS is stored permanently. It doesn't get overwritten by the next data upload.
- **Dashboard trends show week-over-week history.** The last 4 weeks of conversion rates, contact metrics, and compliance rates are visible so users can see trajectories, not just snapshots.

### 3.8 Edge States & Empty States

These states are just as important to design as the happy path. They tell the user what's happening and what to do next.

**BM: "All caught up"** — Every cancelled lead has a comment, every unused lead has a next action, no follow-ups are overdue. This is a success state. The BM should feel good about it — they're ready for the weekly call.

**BM: "New lead, no activity yet"** — A lead just arrived in the system. TRANSLOG may show it was created but nothing else has happened. This isn't alarming — it's just new. The lead should be visible but not flagged as urgent until enough time has passed.

**GM: "Full compliance"** — All branches have commented on all their leads, no overdue follow-ups, conversion trending up. This should feel like a clean bill of health.

**Lead with no TRANSLOG entries** — About 11% of leads receive zero contact. This is significant — it could mean the lead was auto-cancelled by EDI before anyone could act, or it could mean the branch ignored it. The absence of activity is itself an important signal and should be visible, not hidden.

**Lead with a mismatch** — HLES says "CUSTOMER CANCELLED" but TRANSLOG shows zero contact events, and the BM wrote "customer went with competitor." How would the BM know that if they never spoke to the customer? This mismatch is the most important thing the GM is looking for. The system should make these contradictions visually obvious without the GM having to cross-reference manually.

**Stale lead** — An unused lead that's been sitting for weeks with no updates, no follow-up, no activity. This is different from "new and untouched" — this one has been forgotten. The longer it sits, the more likely it's lost.

### 3.9 Stakeholder Feedback — What We Learned from David (ZGM)

In February 2026, we demoed the v1.0 prototype to David, a Zone General Manager. His feedback validated the concept and sharpened several design priorities. These insights should be treated as direct user requirements — they reflect how a real GM thinks about the tool.

**On terminology:** "Nobody uses the term enrichment." Users call these "comments" — the interface should use that language everywhere. Similarly, "region" is outdated — the org uses "zone." Using the wrong words makes the tool feel foreign.

**On the #1 metric:** "My number one question is always… what percentage are we contacting within thirty minutes." Time to first contact is the leading indicator that GMs care most about. It should be prominently displayed — not buried in a secondary view.

**On HRD (the call centre):** "HRD is really kind of like when you don't do your job, they're there to fix it." The split between branch-originated contact and HRD contact is a key accountability signal. High HRD contact rate for a branch means the branch isn't doing its job. This should be visible at the branch level and the zone level.

**On filtering:** David wants to filter by insurance company (using company names like "State Farm", not internal CDP codes), by branch, by area manager, and by date. Every view should be filterable — the GM moves fluidly between zone-wide and branch-specific perspectives.

**On hierarchy context:** When looking at a lead, the GM wants to immediately see who's responsible: which BM, which branch, which AM, which GM, which zone. The full reporting chain should be visible on the lead detail view.

**On data freshness:** David compares LMS data against HLES constantly. He needs to know when the data was last uploaded (e.g., "Data as of: Mon, Feb 24") so he knows whether he's looking at current information or stale data.

**On leaderboards:** Named rankings drive behaviour. David wants to see conversion rates by branch, by AM, by GM — sorted best to worst, with trend arrows showing who's improving. A "Most Improved" view is as important as a "Top Performers" view — it rewards effort, not just results.

These feedback points are already implemented in the v2.0 prototype (see Appendix A for the full changelog). The next version should preserve and refine all of them.

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

---

## Appendix A — Prototype Changelog

### Version 2.0 — ZGM Stakeholder Feedback Release
**Date:** Feb 27, 2026
**Commits:** `5fc3f4c` → `43dad22` (6 commits)
**Based on:** David (ZGM) review session, Feb 26, 2026

#### Terminology & Language

- **"Enrichment" → "Comments"** — Renamed across all user-facing text (20+ files). David: *"Nobody uses the term enrichment."* Code variable names kept as-is for stability.
  - Affected labels: "Enrichment Rate" → "Comment Rate", "Needs Enrichment" → "Needs Comments", "LMS Enrichment" → "LMS Comments", "Save Enrichment" → "Save Comment", "Enrichment Activity" → "Comment History", "BM Enrichment" → "BM Comments", etc.
- **"Region" → "Zone"** — David: *"We don't call them regions anymore."* Updated in GM dashboard trend chart, compliance dashboard, and walkthrough text.

#### New Dashboard Features (GM)

- **Time to First Contact card** — Stacked horizontal bar showing % of leads contacted within <30m, 30m–1h, 1–3h, >3h. David: *"My number one question is always… what percentage are we contacting within thirty minutes."*
- **Branch vs HRD contact source card** — Side-by-side comparison showing what % of first contacts came from the branch vs OKC (HRD call center). David: *"HRD is really kind of like when you don't do your job, they're there to fix it."*

#### New Filters

- **Insurance Company filter** — Added to Lead Queue and Compliance Dashboard. Dropdown populated from lead data (State Farm, GEICO, Progressive, Allstate, etc.). David prefers company names over CDP codes.
- **Date filter** — Week-preset selector already existed in Lead Queue; confirmed working.

#### Hierarchy & Context

- **BM → AM → GM → Zone hierarchy bar** — Added to Lead Detail view. Looks up org mapping by branch and displays the full reporting chain above each lead.
- **Contact source badge** — Green "Branch" or red "HRD" badge shown next to Time to 1st Contact in Lead Detail.
- **"Data as of" date in top bar** — Displays the date of last data upload (e.g., "Data as of: Thu, Feb 26") so users know data freshness when comparing with HLES.

#### Leaderboard

- **New Leaderboard page** — Interactive leaderboard with filter tabs: Branches, GMs, AMs, Zones, Overall.
- **Most Improved toggle** — Switch between "Top Rate" and "Most Improved" sort on the Branches view, ranking by week-over-week conversion rate delta.
- **Delta indicators** — Each row shows ↑+N or ↓-N arrows next to conversion rates.
- Added to sidebar navigation under Interactive Demo mode.

#### Org Mapping

- **AM and Zone columns** — Table now shows full hierarchy: BM, Branch, AM, GM, Zone (previously only BM, Branch, GM).

#### Data Model Updates (`mockData.js`)

- Added `insuranceCompany` and `repairShop` fields to all leads
- Added `firstContactBy` ("branch"/"none") to lead-level summary
- Added `source` ("branch"/"hrd") to translog contact entries
- Added `timeToContact`, `branchContactRate`, `hrdContactRate` to GM weekly trends
- Added `priorConversionRate` to leaderboard branch entries
- Added `dataAsOfDate` export
- Renamed trend fields: `enrichmentRate` → `commentRate`, `enrichmentCompliance` → `commentCompliance`, `regionConversionRate` → `zoneConversionRate`

---

### Version 1.0 — Initial Prototype
**Date:** Feb 23–25, 2026
**Commits:** `412f815` → `7648b22` (6 commits)

#### Core Application

- **Scaffolded React 19 + Vite 7 + Tailwind CSS v4 + Framer Motion** project
- **Landing page** with three role cards: Branch Manager, General Manager, Admin
- **State-driven navigation** via AppContext (no router) with role-based view switching
- **Two app modes:** Guided Tour (step-by-step walkthroughs) and Interactive Demo (sidebar-navigated)
- **Hertz brand palette:** Dark #1A1A1A, Gold #FFD100, Green #2E7D32, Red #C62828

#### Interactive Demo Views

- **Branch Manager Dashboard** — Weekly KPI cards (Total Leads, Rented, Cancelled, Unused, Comment Rate, Needs Comments) + 4-week trend mini bar charts
- **GM Dashboard** — Cancelled Unreviewed, Unused Overdue, Comment Compliance cards + 4-week trends
- **Admin Dashboard** — Data Uploads and Org Mapping quick-access cards
- **Lead Queue** — Filterable/sortable lead table with status badges, search, and status/date filters
- **Lead Detail** — Full lead view with customer info, metadata grid, translog timeline, and enrichment form slot
- **Compliance Dashboard** — Branch manager compliance table with summary KPI cards
- **Cancelled Leads Review** — Three-column layout (lead list, detail, BM comments)
- **Spot Check** — Random lead review for GM oversight
- **Unused Leads** — Overdue unused leads list
- **Enrichment Form** — BM data entry form (reason, notes, next action)
- **Inbox** — Notification-style feed of actionable items
- **To-Do List** — Task tracker for pending lead actions
- **Legend** — Visual guide explaining statuses, colors, and workflows
- **Org Mapping** — Editable BM/Branch/GM assignment table
- **Data Uploads** — HLES and TRANSLOG file upload interface

#### Guided Tour Walkthroughs

- **Branch Manager walkthrough** — 7-step journey through lead review and enrichment
- **General Manager walkthrough** — 8-step journey through compliance review and oversight
- **Admin walkthrough** — 4-step journey through data management

#### Shared Components

- `StatusBadge` — Color-coded lead status indicators
- `MiniBarChart` — Compact trend visualizations
- `TitleCard` — Reusable section headers
- `TranslogTimeline` — Customer interaction timeline
- `EnrichmentTimeline` — BM comment history
- `WalkthroughShell` — Step navigation with progress dots and transitions

#### Infrastructure

- Hand-crafted mock data covering 12 leads across 4 branches with realistic translog entries
- Selector layer (`demoSelectors.js`) for computed stats and filtering
- Navigation config mapping views to components and sidebar structure
- Page title set to "Hertz LMS"

---

### Other Changes (Non-Prototype)
**Included in commit `5fc3f4c`**

#### Documentation & Plans

- Added Commercial Excellence Campaign plan (`docs/plans/commercial-excellence-campaign.md` + Word export)
- Added Phase 2 Activity Prioritisation plan
- Added LMS prototype design doc and implementation plan
- Added MMR initiative docs (PRD, screen mockups, feature discussions)
- Added Carrara approach docs (one-pager, reporting doc, meeting notes)
- Added meeting notes from Nick (Feb 25)

#### Charts & Analysis

- New PowerPoint charts: "Conversion Summary Tom vs Chad", "Tom vs Chad Report Showdown Delta", weekly conversion tables
- Updated who-cancels analysis chart
- New notebook: `all_cancellation_analysis.ipynb`
- Updated existing analysis notebooks with expanded GM and cancellation analyses

#### Scripts

- `scripts/explore_translog_csv.py` — Translog CSV exploration utility
- `scripts/generate_mmr_prd.py` — MMR PRD generation script

#### Data

- Sample data files moved into prototype directory structure
- `.gitignore` updates for `.worktrees/` and prototype build artifacts
