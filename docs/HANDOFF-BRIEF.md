# LMS Prototype — Handoff Brief

**From:** Dan
**Date:** Feb 27, 2026
**Repo:** https://github.com/popcornAlesto33/Prototype-LMS

---

## What you're picking up

An interactive prototype of the **Hertz Lead Management System (LMS)** — a tool for insurance replacement branch managers and general managers to track, enrich, and review lead conversion activity. It currently runs on mock data with no backend.

Clone it and run:

```bash
git clone https://github.com/popcornAlesto33/Prototype-LMS.git
cd Prototype-LMS
npm install
npm run dev
```

You'll see a landing page with three roles. Click through each one in both modes (Interactive Demo and Guided Tour) to understand the full scope.

---

## What it needs to become

A **presentation-ready prototype** that we can put in front of clients and senior stakeholders and have them say: "When can we have this?"

The current version is functional but rough. It was built fast to validate the concept with a Zone GM (David), and it did its job — he immediately saw the value and gave us actionable feedback (all of which is already implemented in v2.0). Now it needs to look and feel like a product someone would actually want to use every day.

---

## The bar

Think: **the best internal tool you've ever seen.** Clean, fast, no clutter, every pixel intentional. The kind of interface where a non-technical branch manager opens it Monday morning and knows exactly what to do, and a GM opens it and immediately sees where the problems are.

Reference points for the level of polish:
- Linear (task management)
- Vercel Dashboard
- Retool's best templates
- Stripe Dashboard

Not flashy. Not trendy. Just clear, confident, professional.

---

## Your mindset: product manager first, engineer second

This is a UX project as much as it is a code project. The people who will use this tool — branch managers, area managers, GMs — are not tech-savvy. They live in HLES (a mainframe from the 90s) and Excel. Many of them are uncomfortable with new software. If the interface makes them think, we've already lost.

**Put on the product hat.** Before you touch any component, read the user journeys in the PRD (Sections 3.1–3.4 of `2026-02-21-lead-management-system-design.md`). These describe exactly what each role does today (painful, manual, Excel-heavy) versus what the LMS should feel like. Every screen you build should make the "to-be" experience feel obvious and effortless compared to the "as-is."

Also read `Initial_brief.md` — it's a raw transcript from the kickoff with the Zone GM. You'll hear how he thinks about the business, what questions he asks first, and what frustrates him. That's the voice of your user. Design for that person.

**Key UX principles for this audience:**

- **Zero learning curve.** A branch manager should open this for the first time and know what to do without any training or onboarding.
- **One thing per screen.** Don't overload views. Each screen should have a single clear purpose and a single obvious next action.
- **Show, don't ask.** Surface the right information proactively — don't make users hunt for it with filters and menus. Defaults should be smart (e.g., "This Week", "My Branch", "Needs Attention").
- **Language matters.** Use the words they use. "Comments" not "enrichment." "Zone" not "region." If you're unsure about a label, the PRD glossary and the transcript will tell you what's natural.
- **Forgiveness over precision.** These users will click the wrong thing. Make it easy to go back, undo, and recover. No destructive actions without confirmation.

---

## What matters most

### 1. The GM dashboard is the hero screen

This is the first thing a GM sees. It needs to answer their top questions at a glance:

- **What % of leads are we contacting within 30 minutes?** (This is the #1 metric — David's words: "My number one question is always… what percentage are we contacting within thirty minutes.")
- **What's the branch vs HRD (call centre) contact split?** (If HRD is contacting your leads, it means your branch isn't doing its job.)
- **Which branches are falling behind on compliance?**
- **What's the conversion trend — are we getting better or worse?**

The dashboard currently has these cards but they need to feel like a unified, well-designed system — not a collection of components.

### 2. The lead detail view tells the full story

When a GM drills into a lead, they need to see three things side by side:
- What HLES says happened (the system reason)
- What TRANSLOG shows actually happened (the activity trail)
- What the BM says happened (their comments)

When these don't match, that's the conversation. The mismatch needs to be visually obvious — not buried.

### 3. The BM experience needs to be dead simple

Branch managers are not tech-savvy. They're busy running a location. The lead queue should feel like an inbox: here are your leads, here's what needs attention, click one, add your notes, move on. Minimal clicks, obvious actions.

### 4. The leaderboard creates accountability

Named rankings by conversion rate, with trend arrows showing who's improving and who's slipping. This is what drives behaviour change. It needs to feel fair but motivating — not punitive.

---

## Domain context

Read these docs in the repo's parent project (I can send them separately if needed):

| Doc | What it covers |
|-----|---------------|
| `CLAUDE.md` | Project orientation, architecture, tech stack, component map |
| `2026-02-21-lead-management-system-design.md` | Full PRD — business context, user journeys, data model, all feature specs |
| `Initial_brief.md` | Raw transcript from the kickoff meeting with the Zone GM — gives you the "why" behind every feature |

The PRD's Appendix A has the full changelog (v1.0 and v2.0) documenting every feature built so far.

**Key domain terms:**
- **HLES** — Hertz's mainframe reservation system. Source of truth for lead status.
- **TRANSLOG** — Activity log in HLES. Shows every call, note, and system event on a lead.
- **HRD** — Hertz Replacement Desk. A centralised call centre in Oklahoma City that contacts customers when branches don't.
- **Enrichment/Comments** — The notes and structured reasons a BM adds to explain why a lead didn't convert. (Users call these "comments", not "enrichment" — code still uses the old name internally.)
- **Conversion rate** — % of leads that become rentals. Currently ~67-70%, target 80%+.
- **EDI** — Electronic Data Interchange. How insurance companies send and cancel leads automatically.

**Hierarchy:** Branch Manager → Area Manager → General Manager → Zone

---

## Tech stack

- React 19 + Vite 7
- Tailwind CSS v4 (utility classes, no component library)
- Framer Motion for transitions
- No backend, no database, no auth
- All data is in `src/data/mockData.js`

You have full freedom to change, add, or replace anything in the stack. If you want to bring in a component library, charting library, or different animation approach — go for it. The only constraint is it needs to stay a static prototype (no backend yet).

---

## Brand palette

| Token | Hex | Usage |
|-------|-----|-------|
| Background | `#FFFFFF` | All backgrounds |
| Text | `#1A1A1A` | Headlines, body |
| Secondary | `#6E6E6E` | Subtitles, metadata |
| Borders | `#E6E6E6` | Dividers, card edges |
| Accent | `#FFD100` | Hertz gold — highlights, active states (use sparingly) |
| Positive | `#2E7D32` | Rented, improvements, success |
| Negative | `#C62828` | Cancelled, declines, alerts |

No gradients, no shadows heavier than `shadow-sm`, no heavy borders. Clean and light.

---

## What I'm NOT prescribing

- Layout and spacing decisions — you'll have a better eye for this
- Whether to keep the current two-mode structure (Interactive Demo + Guided Tour) or merge them
- How to handle responsive design (current version is desktop-only, 16:9 optimised)
- Chart library choice (current charts are hand-rolled with Framer Motion divs)
- Component architecture — refactor freely if the current structure doesn't serve you
- Animation and transition design
- Whether the guided tour walkthroughs need updating or can stay as-is for now

---

## Sample data files

The prototype currently runs on hardcoded mock data. We also have two sample CSV files from the real HLES/TRANSLOG systems that are **not** in the GitHub repo:

- `hles_sample_500.csv` — 500 real HLES reservation records
- `translog_sample_5000.csv` — 5,000 real TRANSLOG activity entries

These aren't needed to run the prototype, but they'll give you a feel for what real data looks like — field names, formats, volumes, messiness. I can share them separately if useful.

---

## Success looks like

A stakeholder opens this prototype in a meeting, and within 30 seconds they understand:
1. What the tool does
2. Why it matters
3. That it's worth investing in building for real

That's it. Make it undeniable.
