# LMS Prototype — Interactive Walkthrough Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a single-page React app with three animated walkthroughs (Branch Manager, General Manager, Admin) showcasing the Lead Management System for senior leadership.

**Architecture:** Vite + React + Tailwind CSS. No backend. All mock data embedded. Each walkthrough is a sequence of steps where realistic mock screens animate between states on click-to-advance. A landing page routes to each walkthrough.

**Tech Stack:** Node.js, Vite, React 18, Tailwind CSS 3, Framer Motion (animations)

**Design Doc:** `docs/plans/2026-02-23-lms-prototype-design.md`

**Brand Tokens:**
- Background: `#FFFFFF`
- Primary accent (Hertz gold): `#FFD100`
- Text: `#1A1A1A`
- Secondary: `#6E6E6E`
- Dividers: `#E6E6E6`
- Positive: `#2E7D32`
- Negative: `#C62828`

---

### Task 1: Install Node.js and Scaffold Project

**Files:**
- Create: `prototype-lms/package.json`
- Create: `prototype-lms/vite.config.js`
- Create: `prototype-lms/tailwind.config.js`
- Create: `prototype-lms/index.html`
- Create: `prototype-lms/src/main.jsx`
- Create: `prototype-lms/src/App.jsx`
- Create: `prototype-lms/src/index.css`

**Step 1: Install Node.js**

```bash
brew install node
```

Verify: `node --version` should show v20+ and `npm --version` should show 10+.

**Step 2: Scaffold Vite + React project**

```bash
cd /Users/dansia/Documents/HertzDataAnalysis
npm create vite@latest prototype-lms -- --template react
cd prototype-lms
npm install
```

**Step 3: Install Tailwind CSS**

```bash
cd /Users/dansia/Documents/HertzDataAnalysis/prototype-lms
npm install -D tailwindcss @tailwindcss/vite
```

Replace `src/index.css` with:

```css
@import "tailwindcss";
```

Update `vite.config.js`:

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
})
```

**Step 4: Install Framer Motion**

```bash
cd /Users/dansia/Documents/HertzDataAnalysis/prototype-lms
npm install framer-motion
```

**Step 5: Clean up scaffolded files**

Delete: `src/App.css`, `src/assets/` (the Vite logo). Strip `App.jsx` down to a bare component:

```jsx
export default function App() {
  return <div className="min-h-screen bg-white">LMS Prototype</div>
}
```

Strip `main.jsx` to:

```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

**Step 6: Verify it runs**

```bash
cd /Users/dansia/Documents/HertzDataAnalysis/prototype-lms
npm run dev
```

Open `http://localhost:5173` — should show "LMS Prototype" on a white page.

**Step 7: Commit**

```bash
cd /Users/dansia/Documents/HertzDataAnalysis/prototype-lms
git add -A
git commit -m "chore: scaffold Vite + React + Tailwind + Framer Motion project"
```

---

### Task 2: Mock Data

**Files:**
- Create: `prototype-lms/src/data/mockData.js`

**Step 1: Create the mock data file**

This file exports all hand-crafted data used across every walkthrough. All data lives here — no other file should define mock records.

```js
// src/data/mockData.js

export const leads = [
  {
    id: 1,
    customer: "Sarah Mitchell",
    reservationId: "037-SAMPLE0012",
    status: "Cancelled",
    daysOpen: 8,
    timeToFirstContact: "4h 22m",
    timeToCancel: "2 days",
    lastActivity: "2026-02-17",
    enrichmentComplete: false,
    branch: "Downtown East",
    bmName: "T. Rodriguez",
    hlesReason: "NO SHOW",
    translog: [
      { time: "Feb 10, 9:15 AM", event: "Lead created via EDI", type: "system" },
      { time: "Feb 10, 1:37 PM", event: "Outbound call attempted — no answer", type: "contact" },
      { time: "Feb 11, 10:05 AM", event: "Voicemail left", type: "contact" },
    ],
    enrichment: {
      reason: "Unable to reach — no answer after multiple attempts",
      notes: "Called 3x over 2 days, voicemail each time. Number may be incorrect — only 9 digits in HLES.",
      nextAction: null,
      followUpDate: null,
    },
    gmDirective: null,
    archived: false,
  },
  {
    id: 2,
    customer: "James Cooper",
    reservationId: "037-SAMPLE0034",
    status: "Unused",
    daysOpen: 5,
    timeToFirstContact: "1h 10m",
    timeToCancel: null,
    lastActivity: "2026-02-18",
    enrichmentComplete: false,
    branch: "Airport South",
    bmName: "M. Chen",
    hlesReason: null,
    translog: [
      { time: "Feb 16, 8:30 AM", event: "Lead created via EDI", type: "system" },
      { time: "Feb 16, 9:40 AM", event: "Customer contacted — will come into location", type: "contact" },
      { time: "Feb 16, 9:42 AM", event: "Pickup date set: Feb 18", type: "system" },
    ],
    enrichment: {
      reason: null,
      notes: "Customer confirmed pickup last Tuesday but never showed. Calling to reschedule.",
      nextAction: "Call again",
      followUpDate: "2026-02-22",
    },
    gmDirective: null,
    archived: false,
  },
  {
    id: 3,
    customer: "Robert Hayes",
    reservationId: "037-SAMPLE0056",
    status: "Cancelled",
    daysOpen: 12,
    timeToFirstContact: "—",
    timeToCancel: "5 days",
    lastActivity: "2026-02-14",
    enrichmentComplete: true,
    branch: "Westside",
    bmName: "A. Patel",
    hlesReason: "CUSTOMER CANCELLED",
    translog: [],
    enrichment: {
      reason: "Customer went with competitor",
      notes: "",
      nextAction: null,
      followUpDate: null,
    },
    gmDirective: "No contact attempts recorded. Discuss in meeting — need to understand what happened.",
    archived: false,
    mismatch: true,
  },
  {
    id: 4,
    customer: "Maria Santos",
    reservationId: "037-SAMPLE0078",
    status: "Rented",
    daysOpen: 3,
    timeToFirstContact: "22m",
    timeToCancel: null,
    lastActivity: "2026-02-20",
    enrichmentComplete: true,
    branch: "Downtown East",
    bmName: "T. Rodriguez",
    hlesReason: null,
    translog: [
      { time: "Feb 18, 7:45 AM", event: "Lead created via EDI", type: "system" },
      { time: "Feb 18, 8:07 AM", event: "Customer contacted — confirmed pickup", type: "contact" },
      { time: "Feb 18, 2:30 PM", event: "Vehicle picked up", type: "system" },
      { time: "Feb 18, 2:35 PM", event: "Rental agreement opened", type: "system" },
    ],
    enrichment: { reason: null, notes: "", nextAction: null, followUpDate: null },
    gmDirective: null,
    archived: false,
  },
  {
    id: 5,
    customer: "David Kim",
    reservationId: "037-SAMPLE0091",
    status: "Unused",
    daysOpen: 2,
    timeToFirstContact: "3h 15m",
    timeToCancel: null,
    lastActivity: "2026-02-21",
    enrichmentComplete: false,
    branch: "Northgate",
    bmName: "K. Johnson",
    hlesReason: null,
    translog: [
      { time: "Feb 20, 10:00 AM", event: "Lead created via EDI", type: "system" },
      { time: "Feb 20, 1:15 PM", event: "Outbound call — customer busy, will call back", type: "contact" },
    ],
    enrichment: { reason: null, notes: "", nextAction: "Await callback", followUpDate: "2026-02-23" },
    gmDirective: null,
    archived: false,
  },
  {
    id: 6,
    customer: "Linda Park",
    reservationId: "037-SAMPLE0103",
    status: "Cancelled",
    daysOpen: 6,
    timeToFirstContact: "45m",
    timeToCancel: "4 days",
    lastActivity: "2026-02-17",
    enrichmentComplete: false,
    branch: "Central Station",
    bmName: "L. Thompson",
    hlesReason: "VEHICLE NOT NEEDED",
    translog: [
      { time: "Feb 14, 11:00 AM", event: "Lead created via EDI", type: "system" },
      { time: "Feb 14, 11:45 AM", event: "Customer contacted — vehicle repaired early", type: "contact" },
      { time: "Feb 18, 9:00 AM", event: "Reservation cancelled via EDI", type: "system" },
    ],
    enrichment: { reason: null, notes: "", nextAction: null, followUpDate: null },
    gmDirective: null,
    archived: false,
  },
  {
    id: 7,
    customer: "Marcus Webb",
    reservationId: "037-SAMPLE0115",
    status: "Unused",
    daysOpen: 4,
    timeToFirstContact: "2h 08m",
    timeToCancel: null,
    lastActivity: "2026-02-19",
    enrichmentComplete: true,
    branch: "Airport South",
    bmName: "M. Chen",
    hlesReason: null,
    translog: [
      { time: "Feb 17, 9:00 AM", event: "Lead created via EDI", type: "system" },
      { time: "Feb 17, 11:08 AM", event: "Outbound call — confirmed, needs body shop info", type: "contact" },
      { time: "Feb 19, 3:00 PM", event: "MMR link sent", type: "system" },
    ],
    enrichment: { reason: null, notes: "Waiting on body shop selection via MMR.", nextAction: "Send to body shop", followUpDate: "2026-02-23" },
    gmDirective: null,
    archived: false,
  },
  {
    id: 8,
    customer: "Emily Tran",
    reservationId: "037-SAMPLE0127",
    status: "Cancelled",
    daysOpen: 10,
    timeToFirstContact: "—",
    timeToCancel: "3m",
    lastActivity: "2026-02-13",
    enrichmentComplete: true,
    branch: "Westside",
    bmName: "A. Patel",
    hlesReason: "INS CO CANCELLED",
    translog: [
      { time: "Feb 13, 2:00 PM", event: "Lead created via EDI", type: "system" },
      { time: "Feb 13, 2:03 PM", event: "Reservation cancelled via EDI", type: "system" },
    ],
    enrichment: { reason: "Insurance partner cancelled (EDI auto-cancel)", notes: "Auto-cancelled within 3 minutes. No opportunity to act.", nextAction: null, followUpDate: null },
    gmDirective: null,
    archived: true,
  },
  {
    id: 9,
    customer: "Brian Nelson",
    reservationId: "037-SAMPLE0139",
    status: "Rented",
    daysOpen: 6,
    timeToFirstContact: "35m",
    timeToCancel: null,
    lastActivity: "2026-02-20",
    enrichmentComplete: true,
    branch: "Northgate",
    bmName: "K. Johnson",
    hlesReason: null,
    translog: [
      { time: "Feb 15, 8:00 AM", event: "Lead created via EDI", type: "system" },
      { time: "Feb 15, 8:35 AM", event: "Customer contacted — pickup confirmed", type: "contact" },
      { time: "Feb 17, 10:00 AM", event: "Vehicle picked up", type: "system" },
      { time: "Feb 17, 10:05 AM", event: "Rental agreement opened", type: "system" },
      { time: "Feb 20, 4:00 PM", event: "DRB sent to insurer", type: "system" },
    ],
    enrichment: { reason: null, notes: "", nextAction: null, followUpDate: null },
    gmDirective: null,
    archived: false,
  },
  {
    id: 10,
    customer: "Angela Cruz",
    reservationId: "037-SAMPLE0141",
    status: "Unused",
    daysOpen: 7,
    timeToFirstContact: "—",
    timeToCancel: null,
    lastActivity: "2026-02-16",
    enrichmentComplete: false,
    branch: "Central Station",
    bmName: "L. Thompson",
    hlesReason: null,
    translog: [
      { time: "Feb 16, 7:30 AM", event: "Lead created via EDI", type: "system" },
    ],
    enrichment: { reason: null, notes: "", nextAction: null, followUpDate: null },
    gmDirective: null,
    archived: false,
  },
  {
    id: 11,
    customer: "Terrence Hall",
    reservationId: "037-SAMPLE0155",
    status: "Cancelled",
    daysOpen: 9,
    timeToFirstContact: "6h 40m",
    timeToCancel: "6 days",
    lastActivity: "2026-02-16",
    enrichmentComplete: false,
    branch: "Downtown East",
    bmName: "T. Rodriguez",
    hlesReason: "NO SHOW",
    translog: [
      { time: "Feb 12, 8:00 AM", event: "Lead created via EDI", type: "system" },
      { time: "Feb 12, 2:40 PM", event: "Outbound call — left voicemail", type: "contact" },
      { time: "Feb 14, 9:00 AM", event: "Outbound call — no answer", type: "contact" },
      { time: "Feb 18, 12:00 PM", event: "Reservation cancelled — NO SHOW", type: "system" },
    ],
    enrichment: { reason: null, notes: "", nextAction: null, followUpDate: null },
    gmDirective: null,
    archived: false,
  },
  {
    id: 12,
    customer: "Rachel Gomez",
    reservationId: "037-SAMPLE0167",
    status: "Rented",
    daysOpen: 4,
    timeToFirstContact: "18m",
    timeToCancel: null,
    lastActivity: "2026-02-21",
    enrichmentComplete: true,
    branch: "Airport South",
    bmName: "M. Chen",
    hlesReason: null,
    translog: [
      { time: "Feb 19, 7:00 AM", event: "Lead created via EDI", type: "system" },
      { time: "Feb 19, 7:18 AM", event: "Customer contacted — pickup same day", type: "contact" },
      { time: "Feb 19, 11:00 AM", event: "Vehicle picked up", type: "system" },
      { time: "Feb 19, 11:05 AM", event: "Rental agreement opened", type: "system" },
    ],
    enrichment: { reason: null, notes: "", nextAction: null, followUpDate: null },
    gmDirective: null,
    archived: false,
  },
];

export const branchManagers = [
  { name: "T. Rodriguez", branch: "Downtown East", conversionRate: 78, quartile: 1 },
  { name: "M. Chen", branch: "Airport South", conversionRate: 74, quartile: 1 },
  { name: "K. Johnson", branch: "Northgate", conversionRate: 71, quartile: 2 },
  { name: "L. Thompson", branch: "Central Station", conversionRate: 65, quartile: 3 },
  { name: "A. Patel", branch: "Westside", conversionRate: 58, quartile: 4 },
];

export const cancellationReasons = [
  "Customer has alternative transportation",
  "Customer's vehicle repaired sooner than expected",
  "Customer declined rental (no reason given)",
  "Customer went with competitor",
  "Unable to reach — bad phone number",
  "Unable to reach — no answer after multiple attempts",
  "Customer unresponsive to MMR / digital outreach",
  "No vehicle available in required class",
  "Pickup/delivery logistics couldn't be arranged",
  "Branch couldn't accommodate timing",
  "Body shop coordination issue",
  "Duplicate or invalid lead",
  "Insurance partner cancelled (EDI auto-cancel)",
  "Lead data incomplete or incorrect",
  "Other — specify in notes",
];

export const nextActions = [
  "Call again",
  "Await callback",
  "Needs vehicle",
  "Send to body shop",
  "Escalate to GM",
  "No further action",
];

export const orgMapping = [
  { bm: "T. Rodriguez", branch: "Downtown East", gm: "D. Williams" },
  { bm: "M. Chen", branch: "Airport South", gm: "D. Williams" },
  { bm: "A. Patel", branch: "Westside", gm: "D. Williams" },
  { bm: "K. Johnson", branch: "Northgate", gm: "R. Martinez" },
  { bm: "L. Thompson", branch: "Central Station", gm: "R. Martinez" },
  { bm: "J. Okafor", branch: "Lakeside", gm: "R. Martinez" },
  { bm: "S. Bergman", branch: "Midtown", gm: "D. Williams" },
  { bm: "C. Reeves", branch: "Harbor View", gm: "R. Martinez" },
  { bm: "P. Nakamura", branch: "University", gm: "D. Williams" },
  { bm: "W. Foster", branch: "Riverside", gm: "R. Martinez" },
  { bm: "D. Alvarez", branch: "Hilltop", gm: "" },
  { bm: "N. Price", branch: "Parkway", gm: "D. Williams" },
  { bm: "H. Volkov", branch: "Eastgate", gm: "R. Martinez" },
  { bm: "F. Osei", branch: "Bayfront", gm: "D. Williams" },
  { bm: "R. Gupta", branch: "Summit", gm: "" },
];

export const uploadSummary = {
  hles: {
    rowsParsed: 34218,
    newLeads: 1847,
    updated: 29604,
    unchanged: 2767,
    failed: 3,
    failedDetails: [
      "Row 12,044: Missing CONFIRM_NUM",
      "Row 23,891: Missing CONFIRM_NUM",
      "Row 31,007: Missing CONFIRM_NUM",
    ],
  },
  translog: {
    eventsParsed: 142906,
    matched: 138211,
    orphan: 4695,
  },
};
```

**Step 2: Commit**

```bash
cd /Users/dansia/Documents/HertzDataAnalysis/prototype-lms
git add src/data/mockData.js
git commit -m "feat: add hand-crafted mock data for all walkthroughs"
```

---

### Task 3: Walkthrough Shell & Navigation

**Files:**
- Create: `prototype-lms/src/components/WalkthroughShell.jsx`
- Modify: `prototype-lms/src/App.jsx`

**Step 1: Build WalkthroughShell component**

This is the core navigation wrapper. It:
- Receives an array of step components and a title
- Manages current step index
- Renders progress dots, step counter, arrow buttons
- Handles keyboard left/right
- Wraps each step in Framer Motion `AnimatePresence` for transitions
- Has a "← Back to journeys" link

```jsx
// src/components/WalkthroughShell.jsx
import { useState, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";

export default function WalkthroughShell({ steps, title, onBack }) {
  const [currentStep, setCurrentStep] = useState(0);
  const total = steps.length;

  const goNext = useCallback(() => {
    setCurrentStep((s) => Math.min(s + 1, total - 1));
  }, [total]);

  const goPrev = useCallback(() => {
    setCurrentStep((s) => Math.max(s - 1, 0));
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goNext, goPrev]);

  const StepComponent = steps[currentStep];

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Top bar */}
      <div className="px-8 py-4 flex items-center justify-between">
        <button onClick={onBack} className="text-[#6E6E6E] hover:text-[#1A1A1A] text-sm">
          ← Back to journeys
        </button>
        <span className="text-[#6E6E6E] text-sm">{title}</span>
      </div>

      {/* Step content */}
      <div className="flex-1 relative overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
            className="absolute inset-0 px-16 py-8"
          >
            <StepComponent />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Arrow buttons — left/right edges */}
      {currentStep > 0 && (
        <button
          onClick={goPrev}
          className="fixed left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-[#E6E6E6] hover:bg-[#FFD100] flex items-center justify-center text-[#1A1A1A] opacity-40 hover:opacity-100 transition-opacity"
        >
          ‹
        </button>
      )}
      {currentStep < total - 1 && (
        <button
          onClick={goNext}
          className="fixed right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-[#E6E6E6] hover:bg-[#FFD100] flex items-center justify-center text-[#1A1A1A] opacity-40 hover:opacity-100 transition-opacity"
        >
          ›
        </button>
      )}

      {/* Bottom bar — progress dots + counter */}
      <div className="px-8 py-4 flex items-center justify-center gap-2">
        {steps.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrentStep(i)}
            className={`w-2.5 h-2.5 rounded-full transition-colors ${
              i === currentStep
                ? "bg-[#FFD100]"
                : i < currentStep
                ? "bg-[#1A1A1A]"
                : "bg-[#E6E6E6]"
            }`}
          />
        ))}
        <span className="ml-4 text-xs text-[#6E6E6E]">
          {currentStep + 1} of {total}
        </span>
      </div>
    </div>
  );
}
```

**Step 2: Update App.jsx with routing**

```jsx
// src/App.jsx
import { useState } from "react";
import Landing from "./components/Landing";
import WalkthroughShell from "./components/WalkthroughShell";
// Walkthrough step arrays will be imported in later tasks

export default function App() {
  const [activeJourney, setActiveJourney] = useState(null);

  if (!activeJourney) {
    return <Landing onSelect={setActiveJourney} />;
  }

  return (
    <WalkthroughShell
      steps={activeJourney.steps}
      title={activeJourney.title}
      onBack={() => setActiveJourney(null)}
    />
  );
}
```

**Step 3: Commit**

```bash
cd /Users/dansia/Documents/HertzDataAnalysis/prototype-lms
git add src/components/WalkthroughShell.jsx src/App.jsx
git commit -m "feat: add walkthrough shell with navigation, transitions, progress dots"
```

---

### Task 4: Landing Page

**Files:**
- Create: `prototype-lms/src/components/Landing.jsx`

**Step 1: Build Landing component**

Three cards — BM, GM, Admin. Hertz branding. Yellow left-border on hover.

```jsx
// src/components/Landing.jsx
const journeys = [
  {
    key: "bm",
    icon: "📋",
    role: "Branch Manager",
    description: "Review and enrich your leads",
  },
  {
    key: "gm",
    icon: "📊",
    role: "General Manager",
    description: "Track compliance and drive accountability",
  },
  {
    key: "admin",
    icon: "⚙️",
    role: "Admin",
    description: "Upload data and manage configuration",
  },
];

export default function Landing({ onSelect }) {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-8">
      {/* Header */}
      <div className="mb-12 text-center">
        <h1 className="text-4xl font-bold text-[#1A1A1A] tracking-tight">
          Lead Management System
        </h1>
        <div className="w-16 h-1 bg-[#FFD100] mx-auto mt-3 mb-4" />
        <p className="text-[#6E6E6E] text-lg">
          A visibility and enrichment layer for insurance replacement lead conversion
        </p>
      </div>

      {/* Journey cards */}
      <div className="flex gap-6 max-w-4xl w-full">
        {journeys.map((j) => (
          <button
            key={j.key}
            onClick={() => onSelect(j.key)}
            className="flex-1 text-left p-6 rounded-lg border border-[#E6E6E6] hover:border-[#FFD100] hover:border-l-4 transition-all group cursor-pointer"
          >
            <div className="text-3xl mb-3">{j.icon}</div>
            <h2 className="text-xl font-semibold text-[#1A1A1A] mb-1">{j.role}</h2>
            <p className="text-[#6E6E6E] text-sm">{j.description}</p>
          </button>
        ))}
      </div>

      <p className="mt-12 text-xs text-[#E6E6E6]">Hertz — Insurance Replacement Division</p>
    </div>
  );
}
```

**Step 2: Update App.jsx to wire landing to walkthroughs**

At this point, `onSelect` receives a key ("bm", "gm", "admin"). In App.jsx, map keys to walkthrough configs. Use placeholder steps for now (a single "Coming soon" component per journey) — real steps come in Tasks 6-8.

```jsx
// Temporary placeholder step
function Placeholder({ label }) {
  return () => (
    <div className="flex items-center justify-center h-full">
      <p className="text-[#6E6E6E] text-xl">{label} — steps coming soon</p>
    </div>
  );
}

const walkthroughs = {
  bm: { title: "Branch Manager — Weekly Lead Review", steps: [Placeholder("BM")] },
  gm: { title: "General Manager — Compliance & Oversight", steps: [Placeholder("GM")] },
  admin: { title: "Admin — Data & Configuration", steps: [Placeholder("Admin")] },
};
```

In App.jsx, change `onSelect` to look up from this map:

```jsx
if (!activeJourney) {
  return <Landing onSelect={(key) => setActiveJourney(walkthroughs[key])} />;
}
```

**Step 3: Verify**

Run `npm run dev`. Landing page shows. Click any card → enters walkthrough with placeholder. Back button returns to landing. Arrow keys do nothing (only 1 step).

**Step 4: Commit**

```bash
cd /Users/dansia/Documents/HertzDataAnalysis/prototype-lms
git add src/components/Landing.jsx src/App.jsx
git commit -m "feat: add landing page with three role cards"
```

---

### Task 5: Shared UI Components

**Files:**
- Create: `prototype-lms/src/components/TitleCard.jsx`
- Create: `prototype-lms/src/components/LeadQueue.jsx`
- Create: `prototype-lms/src/components/LeadDetail.jsx`
- Create: `prototype-lms/src/components/EnrichmentForm.jsx`
- Create: `prototype-lms/src/components/StatusBadge.jsx`
- Create: `prototype-lms/src/components/TranslogTimeline.jsx`
- Create: `prototype-lms/src/components/ComplianceDashboard.jsx`
- Create: `prototype-lms/src/components/WeeklyMeetingView.jsx`
- Create: `prototype-lms/src/components/ThreeColumnReview.jsx`
- Create: `prototype-lms/src/components/AdminUpload.jsx`
- Create: `prototype-lms/src/components/OrgMapping.jsx`

These are the building blocks used by walkthrough steps. Each is a self-contained visual component. Build them one at a time.

**Step 1: TitleCard** — reusable title + summary slide

```jsx
// src/components/TitleCard.jsx
import { motion } from "framer-motion";

export default function TitleCard({ title, subtitle, summary = false }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center">
      <motion.h1
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-4xl font-bold text-[#1A1A1A] max-w-2xl"
      >
        {title}
      </motion.h1>
      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.4, delay: 0.3 }}
        className="w-16 h-1 bg-[#FFD100] mt-4 mb-4"
      />
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.5 }}
        className={`max-w-xl ${summary ? "text-lg text-[#1A1A1A]" : "text-[#6E6E6E] text-lg"}`}
      >
        {subtitle}
      </motion.p>
    </div>
  );
}
```

**Step 2: StatusBadge**

```jsx
// src/components/StatusBadge.jsx
const statusStyles = {
  Cancelled: "bg-red-50 text-[#C62828] border border-red-200",
  Unused: "bg-yellow-50 text-[#1A1A1A] border border-yellow-200",
  Rented: "bg-green-50 text-[#2E7D32] border border-green-200",
  Reviewed: "bg-gray-50 text-[#6E6E6E] border border-gray-200",
};

export default function StatusBadge({ status }) {
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusStyles[status] || ""}`}>
      {status}
    </span>
  );
}
```

**Step 3: TranslogTimeline**

```jsx
// src/components/TranslogTimeline.jsx
import { motion } from "framer-motion";

const typeColors = {
  system: "#6E6E6E",
  contact: "#FFD100",
};

export default function TranslogTimeline({ events, animate = true }) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold text-[#6E6E6E] uppercase tracking-wide mb-2">
        TRANSLOG Activity
      </h3>
      {events.length === 0 ? (
        <p className="text-sm text-[#C62828] italic">No activity recorded</p>
      ) : (
        events.map((ev, i) => (
          <motion.div
            key={i}
            initial={animate ? { opacity: 0, x: -10 } : false}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.15 }}
            className="flex gap-3 items-start"
          >
            <div className="flex flex-col items-center">
              <div
                className="w-2.5 h-2.5 rounded-full mt-1"
                style={{ backgroundColor: typeColors[ev.type] || "#6E6E6E" }}
              />
              {i < events.length - 1 && <div className="w-px h-6 bg-[#E6E6E6]" />}
            </div>
            <div>
              <p className="text-sm text-[#1A1A1A]">{ev.event}</p>
              <p className="text-xs text-[#6E6E6E]">{ev.time}</p>
            </div>
          </motion.div>
        ))
      )}
    </div>
  );
}
```

**Step 4: LeadQueue** — the BM's lead table

```jsx
// src/components/LeadQueue.jsx
import { motion } from "framer-motion";
import StatusBadge from "./StatusBadge";

export default function LeadQueue({
  leads,
  highlightId = null,
  enrichedIds = [],
  bannerCount = null,
  onLeadClick = null,
}) {
  return (
    <div>
      {/* Banner */}
      {bannerCount !== null && bannerCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 px-4 py-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-[#1A1A1A]"
        >
          <span className="font-semibold text-[#FFD100]">{bannerCount}</span> lead{bannerCount !== 1 ? "s" : ""} need enrichment
        </motion.div>
      )}

      {/* Table */}
      <div className="border border-[#E6E6E6] rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-xs text-[#6E6E6E] uppercase tracking-wide">
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Reservation ID</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Days Open</th>
              <th className="px-4 py-3">Time to 1st Contact</th>
              <th className="px-4 py-3">Last Activity</th>
              <th className="px-4 py-3">Enrichment</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead, i) => {
              const isHighlighted = lead.id === highlightId;
              const isEnriched = enrichedIds.includes(lead.id) || lead.enrichmentComplete;
              return (
                <motion.tr
                  key={lead.id}
                  initial={{ opacity: 0 }}
                  animate={{
                    opacity: 1,
                    backgroundColor: isHighlighted ? "#FFF4CC" : "transparent",
                  }}
                  transition={{ delay: i * 0.05 }}
                  className={`border-t border-[#E6E6E6] ${
                    onLeadClick ? "cursor-pointer hover:bg-gray-50" : ""
                  } ${isHighlighted ? "ring-2 ring-[#FFD100] ring-inset" : ""}`}
                  onClick={() => onLeadClick?.(lead)}
                >
                  <td className="px-4 py-3 font-medium text-[#1A1A1A]">{lead.customer}</td>
                  <td className="px-4 py-3 text-[#6E6E6E] font-mono text-xs">{lead.reservationId}</td>
                  <td className="px-4 py-3"><StatusBadge status={lead.status} /></td>
                  <td className="px-4 py-3">{lead.daysOpen}</td>
                  <td className="px-4 py-3">{lead.timeToFirstContact}</td>
                  <td className="px-4 py-3 text-[#6E6E6E]">{lead.lastActivity}</td>
                  <td className="px-4 py-3">
                    {isEnriched ? (
                      <span className="text-[#2E7D32]">✓</span>
                    ) : (
                      <span className="text-[#C62828]">—</span>
                    )}
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

**Step 5: LeadDetail** — split panel (HLES left, enrichment right)

```jsx
// src/components/LeadDetail.jsx
import { motion } from "framer-motion";
import StatusBadge from "./StatusBadge";
import TranslogTimeline from "./TranslogTimeline";

export default function LeadDetail({ lead, enrichmentSlot }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4 }}
      className="grid grid-cols-2 gap-8 h-full"
    >
      {/* Left — HLES Data */}
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-[#1A1A1A]">{lead.customer}</h2>
          <p className="text-sm text-[#6E6E6E] font-mono">{lead.reservationId}</p>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-[#6E6E6E] text-xs uppercase">Status</p>
            <StatusBadge status={lead.status} />
          </div>
          <div>
            <p className="text-[#6E6E6E] text-xs uppercase">Days Open</p>
            <p className="font-medium">{lead.daysOpen}</p>
          </div>
          <div>
            <p className="text-[#6E6E6E] text-xs uppercase">Time to 1st Contact</p>
            <p className="font-medium">{lead.timeToFirstContact}</p>
          </div>
          {lead.timeToCancel && (
            <div>
              <p className="text-[#6E6E6E] text-xs uppercase">Time to Cancellation</p>
              <p className="font-medium">{lead.timeToCancel}</p>
            </div>
          )}
          {lead.hlesReason && (
            <div className="col-span-2">
              <p className="text-[#6E6E6E] text-xs uppercase">HLES Cancellation Reason</p>
              <p className="font-medium text-[#C62828]">{lead.hlesReason}</p>
            </div>
          )}
        </div>

        <TranslogTimeline events={lead.translog} />
      </div>

      {/* Right — Enrichment */}
      <div className="border-l border-[#E6E6E6] pl-8">
        <h3 className="text-lg font-semibold text-[#1A1A1A] mb-4">LMS Enrichment</h3>
        {enrichmentSlot}
      </div>
    </motion.div>
  );
}
```

**Step 6: EnrichmentForm** — animated form that simulates filling in

```jsx
// src/components/EnrichmentForm.jsx
import { motion } from "framer-motion";

export default function EnrichmentForm({
  reason = null,
  notes = null,
  nextAction = null,
  followUpDate = null,
  gmDirective = null,
  showSaved = false,
  animateFields = false,
}) {
  const delay = animateFields ? 0.3 : 0;

  return (
    <div className="space-y-5">
      {/* Cancellation Reason */}
      <motion.div
        initial={animateFields ? { opacity: 0 } : false}
        animate={{ opacity: 1 }}
        transition={{ delay: delay * 1 }}
      >
        <label className="text-xs text-[#6E6E6E] uppercase tracking-wide block mb-1">
          Cancellation Reason
        </label>
        <div className="border border-[#E6E6E6] rounded px-3 py-2 text-sm bg-white">
          {reason || <span className="text-[#E6E6E6]">Select a reason...</span>}
        </div>
      </motion.div>

      {/* Next Action */}
      <motion.div
        initial={animateFields ? { opacity: 0 } : false}
        animate={{ opacity: 1 }}
        transition={{ delay: delay * 2 }}
      >
        <label className="text-xs text-[#6E6E6E] uppercase tracking-wide block mb-1">
          Next Action
        </label>
        <div className="border border-[#E6E6E6] rounded px-3 py-2 text-sm bg-white">
          {nextAction || <span className="text-[#E6E6E6]">Select next action...</span>}
        </div>
      </motion.div>

      {/* Follow-up Date */}
      <motion.div
        initial={animateFields ? { opacity: 0 } : false}
        animate={{ opacity: 1 }}
        transition={{ delay: delay * 3 }}
      >
        <label className="text-xs text-[#6E6E6E] uppercase tracking-wide block mb-1">
          Follow-up Date
        </label>
        <div className="border border-[#E6E6E6] rounded px-3 py-2 text-sm bg-white">
          {followUpDate || <span className="text-[#E6E6E6]">Select date...</span>}
        </div>
      </motion.div>

      {/* Notes */}
      <motion.div
        initial={animateFields ? { opacity: 0 } : false}
        animate={{ opacity: 1 }}
        transition={{ delay: delay * 4 }}
      >
        <label className="text-xs text-[#6E6E6E] uppercase tracking-wide block mb-1">
          Notes
        </label>
        <div className="border border-[#E6E6E6] rounded px-3 py-2 text-sm bg-white min-h-[60px]">
          {notes || <span className="text-[#E6E6E6]">Add notes...</span>}
        </div>
      </motion.div>

      {/* GM Directive (read-only) */}
      {gmDirective && (
        <motion.div
          initial={animateFields ? { opacity: 0 } : false}
          animate={{ opacity: 1 }}
          transition={{ delay: delay * 5 }}
        >
          <label className="text-xs text-[#6E6E6E] uppercase tracking-wide block mb-1">
            GM Directive
          </label>
          <div className="border border-[#FFD100] bg-yellow-50 rounded px-3 py-2 text-sm">
            {gmDirective}
          </div>
        </motion.div>
      )}

      {/* Saved indicator */}
      {showSaved && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-center gap-2 text-[#2E7D32] text-sm font-medium"
        >
          <span className="text-lg">✓</span> Saved
        </motion.div>
      )}
    </div>
  );
}
```

**Step 7: ComplianceDashboard** — GM bar chart + summary cards

```jsx
// src/components/ComplianceDashboard.jsx
import { motion } from "framer-motion";

const quartileColors = {
  1: "#2E7D32",
  2: "#FFD100",
  3: "#6E6E6E",
  4: "#C62828",
};

export default function ComplianceDashboard({ branchManagers, summaryCards }) {
  const maxRate = Math.max(...branchManagers.map((bm) => bm.conversionRate));

  return (
    <div className="space-y-8">
      {/* Conversion Scoreboard */}
      <div>
        <h2 className="text-lg font-semibold text-[#1A1A1A] mb-4">Conversion Scoreboard</h2>
        <div className="space-y-3">
          {branchManagers.map((bm, i) => (
            <div key={bm.name} className="flex items-center gap-4">
              <span className="w-28 text-sm text-[#1A1A1A] font-medium truncate">{bm.name}</span>
              <div className="flex-1 bg-gray-50 rounded h-8 relative overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(bm.conversionRate / 100) * 100}%` }}
                  transition={{ duration: 0.8, delay: i * 0.1, ease: "easeOut" }}
                  className="h-full rounded"
                  style={{ backgroundColor: quartileColors[bm.quartile] }}
                />
              </div>
              <span className="w-12 text-sm font-semibold text-right" style={{ color: quartileColors[bm.quartile] }}>
                {bm.conversionRate}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        {summaryCards.map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 + i * 0.15 }}
            className="border border-[#E6E6E6] rounded-lg p-4"
          >
            <p className="text-xs text-[#6E6E6E] uppercase tracking-wide">{card.label}</p>
            <p className={`text-2xl font-bold mt-1 ${card.color || "text-[#1A1A1A]"}`}>
              {card.value}
            </p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
```

**Step 8: ThreeColumnReview** — HLES / TRANSLOG / Enrichment side by side

```jsx
// src/components/ThreeColumnReview.jsx
import { motion } from "framer-motion";
import StatusBadge from "./StatusBadge";
import TranslogTimeline from "./TranslogTimeline";

export default function ThreeColumnReview({ lead, showMismatchWarning = false }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-bold text-[#1A1A1A]">{lead.customer}</h2>
        <StatusBadge status={lead.status} />
        <span className="text-sm text-[#6E6E6E] font-mono">{lead.reservationId}</span>
        {lead.bmName && <span className="text-sm text-[#6E6E6E]">• {lead.bmName}</span>}
      </div>

      {showMismatchWarning && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="px-4 py-2 bg-yellow-50 border border-[#FFD100] rounded text-sm text-[#1A1A1A] flex items-center gap-2"
        >
          <motion.span
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
            className="text-[#FFD100] text-lg"
          >
            ⚠
          </motion.span>
          Stated reason does not match recorded activity
        </motion.div>
      )}

      <div className="grid grid-cols-3 gap-6 mt-4">
        {/* Col 1: HLES Reason */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="border border-[#E6E6E6] rounded-lg p-4"
        >
          <h3 className="text-xs font-semibold text-[#6E6E6E] uppercase tracking-wide mb-3">
            HLES Reason
          </h3>
          <p className="text-sm font-medium text-[#C62828]">{lead.hlesReason || "—"}</p>
          <div className="mt-3 text-xs text-[#6E6E6E] space-y-1">
            <p>Time to 1st contact: {lead.timeToFirstContact}</p>
            {lead.timeToCancel && <p>Time to cancellation: {lead.timeToCancel}</p>}
          </div>
        </motion.div>

        {/* Col 2: TRANSLOG */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="border border-[#E6E6E6] rounded-lg p-4"
        >
          <TranslogTimeline events={lead.translog} />
        </motion.div>

        {/* Col 3: BM Enrichment */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="border border-[#E6E6E6] rounded-lg p-4"
        >
          <h3 className="text-xs font-semibold text-[#6E6E6E] uppercase tracking-wide mb-3">
            BM Enrichment
          </h3>
          {lead.enrichment?.reason ? (
            <div className="space-y-2 text-sm">
              <p><span className="text-[#6E6E6E]">Reason:</span> {lead.enrichment.reason}</p>
              {lead.enrichment.notes && (
                <p><span className="text-[#6E6E6E]">Notes:</span> {lead.enrichment.notes}</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-[#6E6E6E] italic">No enrichment recorded</p>
          )}
        </motion.div>
      </div>
    </div>
  );
}
```

**Step 9: AdminUpload** — drag-and-drop with validation summary

```jsx
// src/components/AdminUpload.jsx
import { motion } from "framer-motion";

export default function AdminUpload({ fileName, summary, type = "hles" }) {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Upload zone */}
      <div className="border-2 border-dashed border-[#E6E6E6] rounded-lg p-8 text-center">
        <p className="text-[#6E6E6E] text-sm mb-2">
          {type === "hles" ? "HLES Conversion Data" : type === "translog" ? "TRANSLOG Activity Data" : "Organisation Mapping"}
        </p>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 bg-gray-50 rounded px-4 py-2 text-sm font-mono text-[#1A1A1A]"
        >
          📄 {fileName}
        </motion.div>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-gray-100 rounded overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: "100%" }}
          transition={{ duration: 1.5, ease: "easeInOut" }}
          className="h-full bg-[#FFD100] rounded"
        />
      </div>

      {/* Validation summary */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.5 }}
        className="border border-[#E6E6E6] rounded-lg p-6 space-y-3"
      >
        <h3 className="font-semibold text-[#1A1A1A]">Validation Summary</h3>
        {summary.map((item, i) => (
          <div key={i} className="flex justify-between text-sm">
            <span className="text-[#6E6E6E]">{item.label}</span>
            <span className={`font-medium ${item.color || "text-[#1A1A1A]"}`}>{item.value}</span>
          </div>
        ))}

        {summary.some((s) => s.expandable) && (
          <div className="mt-2 pt-2 border-t border-[#E6E6E6]">
            {summary
              .filter((s) => s.expandable)
              .map((s) => (
                <div key={s.label} className="text-xs text-[#C62828] space-y-0.5 mt-1">
                  {s.details?.map((d, j) => <p key={j}>{d}</p>)}
                </div>
              ))}
          </div>
        )}

        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2 }}
          className="mt-4 px-4 py-2 bg-[#2E7D32] text-white rounded text-sm font-medium"
        >
          ✓ Import Confirmed
        </motion.button>
      </motion.div>
    </div>
  );
}
```

**Step 10: OrgMapping** — table with inline editing

```jsx
// src/components/OrgMapping.jsx
import { motion } from "framer-motion";

export default function OrgMapping({ rows, editingRow = null, editedValue = null, missingRows = [] }) {
  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="border border-[#E6E6E6] rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-xs text-[#6E6E6E] uppercase tracking-wide">
              <th className="px-4 py-3">Branch Manager</th>
              <th className="px-4 py-3">Branch Location</th>
              <th className="px-4 py-3">General Manager</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const isMissing = missingRows.includes(i);
              const isEditing = editingRow === i;
              return (
                <motion.tr
                  key={i}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.04 }}
                  className={`border-t border-[#E6E6E6] ${
                    isEditing ? "bg-yellow-50" : isMissing ? "bg-red-50" : ""
                  }`}
                >
                  <td className="px-4 py-2.5">{row.bm}</td>
                  <td className="px-4 py-2.5">{row.branch}</td>
                  <td className="px-4 py-2.5">
                    {isEditing ? (
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="inline-flex items-center border border-[#FFD100] rounded px-2 py-0.5 bg-white"
                      >
                        {editedValue}
                        <span className="ml-1 text-[#FFD100]">▾</span>
                      </motion.span>
                    ) : isMissing && !row.gm ? (
                      <span className="text-[#C62828] italic">— Missing —</span>
                    ) : (
                      row.gm
                    )}
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="flex justify-end"
      >
        <button className="px-4 py-2 bg-[#FFD100] text-[#1A1A1A] rounded text-sm font-medium">
          Confirm Mapping
        </button>
      </motion.div>
    </div>
  );
}
```

**Step 11: Commit all shared components**

```bash
cd /Users/dansia/Documents/HertzDataAnalysis/prototype-lms
git add src/components/
git commit -m "feat: add all shared UI components (queue, detail, dashboard, upload, etc.)"
```

---

### Task 6: Branch Manager Walkthrough Steps

**Files:**
- Create: `prototype-lms/src/walkthroughs/BranchManagerSteps.jsx`
- Modify: `prototype-lms/src/App.jsx` — wire BM steps into walkthroughs map

**Step 1: Create the 8 step components**

Each step is a function component that composes the shared UI components with specific mock data and animation states for that step.

```jsx
// src/walkthroughs/BranchManagerSteps.jsx
import TitleCard from "../components/TitleCard";
import LeadQueue from "../components/LeadQueue";
import LeadDetail from "../components/LeadDetail";
import EnrichmentForm from "../components/EnrichmentForm";
import { leads } from "../data/mockData";

// Step 1: Title
function BM1() {
  return (
    <TitleCard
      title="Branch Manager — Weekly Lead Review"
      subtitle="Review cancelled and unused leads. Add context. Prepare for the weekly call."
    />
  );
}

// Step 2: Lead queue appears
function BM2() {
  return (
    <div>
      <h2 className="text-xl font-semibold text-[#1A1A1A] mb-1">My Leads</h2>
      <p className="text-sm text-[#6E6E6E] mb-4">Week of Feb 10 – Feb 21, 2026</p>
      <LeadQueue leads={leads} bannerCount={6} />
    </div>
  );
}

// Step 3: Click into Sarah Mitchell (cancelled)
function BM3() {
  const lead = leads.find((l) => l.id === 1);
  return (
    <LeadDetail
      lead={lead}
      enrichmentSlot={<EnrichmentForm />}
    />
  );
}

// Step 4: Fill enrichment for Sarah Mitchell
function BM4() {
  const lead = leads.find((l) => l.id === 1);
  return (
    <LeadDetail
      lead={lead}
      enrichmentSlot={
        <EnrichmentForm
          reason="Unable to reach — no answer after multiple attempts"
          notes="Called 3x over 2 days, voicemail each time. Number may be incorrect — only 9 digits in HLES."
          animateFields
        />
      }
    />
  );
}

// Step 5: Saved, back to queue
function BM5() {
  return (
    <div>
      <h2 className="text-xl font-semibold text-[#1A1A1A] mb-1">My Leads</h2>
      <p className="text-sm text-[#6E6E6E] mb-4">Week of Feb 10 – Feb 21, 2026</p>
      <LeadQueue leads={leads} enrichedIds={[1]} bannerCount={5} />
    </div>
  );
}

// Step 6: Open James Cooper (unused)
function BM6() {
  const lead = leads.find((l) => l.id === 2);
  return (
    <LeadDetail
      lead={lead}
      enrichmentSlot={
        <EnrichmentForm
          nextAction="Call again"
          followUpDate="Feb 22, 2026"
          notes="Customer confirmed pickup last Tuesday but never showed. Calling to reschedule."
          animateFields
        />
      }
    />
  );
}

// Step 7: Queue progress
function BM7() {
  return (
    <div>
      <h2 className="text-xl font-semibold text-[#1A1A1A] mb-1">My Leads</h2>
      <p className="text-sm text-[#6E6E6E] mb-4">Week of Feb 10 – Feb 21, 2026</p>
      <LeadQueue leads={leads} enrichedIds={[1, 2, 3, 5, 6, 7, 8, 9, 10, 11]} bannerCount={1} />
    </div>
  );
}

// Step 8: Summary
function BM8() {
  return (
    <TitleCard
      title="Every cancelled lead explained. Every unused lead has a next step."
      subtitle="Ready for the weekly call."
      summary
    />
  );
}

export const bmSteps = [BM1, BM2, BM3, BM4, BM5, BM6, BM7, BM8];
```

**Step 2: Wire into App.jsx**

Update the walkthroughs map in `App.jsx`:

```jsx
import { bmSteps } from "./walkthroughs/BranchManagerSteps";

const walkthroughs = {
  bm: { title: "Branch Manager — Weekly Lead Review", steps: bmSteps },
  gm: { title: "General Manager — Compliance & Oversight", steps: [Placeholder("GM")] },
  admin: { title: "Admin — Data & Configuration", steps: [Placeholder("Admin")] },
};
```

**Step 3: Verify** — run `npm run dev`, click Branch Manager card, click through all 8 steps.

**Step 4: Commit**

```bash
cd /Users/dansia/Documents/HertzDataAnalysis/prototype-lms
git add src/walkthroughs/BranchManagerSteps.jsx src/App.jsx
git commit -m "feat: add Branch Manager walkthrough (8 animated steps)"
```

---

### Task 7: General Manager Walkthrough Steps

**Files:**
- Create: `prototype-lms/src/walkthroughs/GeneralManagerSteps.jsx`
- Modify: `prototype-lms/src/App.jsx`

**Step 1: Create the 8 step components**

```jsx
// src/walkthroughs/GeneralManagerSteps.jsx
import { motion } from "framer-motion";
import TitleCard from "../components/TitleCard";
import ComplianceDashboard from "../components/ComplianceDashboard";
import LeadQueue from "../components/LeadQueue";
import ThreeColumnReview from "../components/ThreeColumnReview";
import EnrichmentForm from "../components/EnrichmentForm";
import StatusBadge from "../components/StatusBadge";
import { leads, branchManagers } from "../data/mockData";

const summaryCards = [
  { label: "Cancelled Unreviewed", value: "23", color: "text-[#C62828]" },
  { label: "Unused Overdue", value: "8", color: "text-[#FFD100]" },
  { label: "Enrichment Compliance", value: "91%", color: "text-[#2E7D32]" },
];

const cancelledLeads = leads.filter((l) => l.status === "Cancelled" && !l.archived);

// Step 1: Title
function GM1() {
  return (
    <TitleCard
      title="General Manager — Compliance & Oversight"
      subtitle="Track conversion. Review cancellations. Drive accountability."
    />
  );
}

// Step 2: Compliance dashboard
function GM2() {
  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <h2 className="text-xl font-semibold text-[#1A1A1A]">Compliance Dashboard</h2>
        <span className="text-sm text-[#6E6E6E]">D. Williams — Eastern Region</span>
      </div>
      <ComplianceDashboard branchManagers={branchManagers} summaryCards={summaryCards} />
    </div>
  );
}

// Step 3: Weekly meeting view
function GM3() {
  return (
    <div>
      <div className="flex items-center gap-4 mb-4">
        <h2 className="text-xl font-semibold text-[#1A1A1A]">Weekly Meeting</h2>
        <div className="flex gap-2 text-xs">
          <span className="px-2 py-1 bg-[#FFD100] text-[#1A1A1A] rounded font-medium">Cancelled · Unreviewed</span>
        </div>
      </div>
      <LeadQueue leads={cancelledLeads} />
    </div>
  );
}

// Step 4: Drill into Sarah Mitchell — three columns
function GM4() {
  const lead = leads.find((l) => l.id === 1);
  return <ThreeColumnReview lead={lead} />;
}

// Step 5: Mismatch — Robert Hayes
function GM5() {
  const lead = leads.find((l) => l.id === 3);
  return (
    <div>
      <ThreeColumnReview lead={lead} showMismatchWarning />
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="mt-6 text-sm text-[#6E6E6E] italic text-center"
      >
        The stated reason doesn't match the evidence. Was this lead ever actually worked?
      </motion.p>
    </div>
  );
}

// Step 6: GM adds directive + archives
function GM6() {
  const lead = leads.find((l) => l.id === 3);
  return (
    <div className="space-y-6">
      <ThreeColumnReview lead={lead} showMismatchWarning />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="max-w-md mx-auto space-y-3"
      >
        <div>
          <label className="text-xs text-[#6E6E6E] uppercase tracking-wide block mb-1">
            GM Directive
          </label>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="border border-[#FFD100] bg-yellow-50 rounded px-3 py-2 text-sm"
          >
            No contact attempts recorded. Discuss in meeting — need to understand what happened.
          </motion.div>
        </div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="flex items-center gap-3"
        >
          <button className="px-3 py-1.5 bg-[#6E6E6E] text-white rounded text-sm">
            ✓ Archive — Reviewed
          </button>
          <StatusBadge status="Reviewed" />
        </motion.div>
      </motion.div>
    </div>
  );
}

// Step 7: Between meetings — spot check
function GM7() {
  const untouchedLeads = leads.filter((l) => l.status === "Unused" && !l.enrichmentComplete);
  return (
    <div>
      <div className="flex items-center gap-4 mb-4">
        <h2 className="text-xl font-semibold text-[#1A1A1A]">Spot Check — Central Station</h2>
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="px-2 py-1 bg-red-50 text-[#C62828] text-xs rounded font-medium border border-red-200"
        >
          5 untouched leads
        </motion.span>
      </div>
      <LeadQueue leads={untouchedLeads} />
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="mt-4 max-w-md"
      >
        <label className="text-xs text-[#6E6E6E] uppercase tracking-wide block mb-1">
          GM Directive
        </label>
        <div className="border border-[#FFD100] bg-yellow-50 rounded px-3 py-2 text-sm">
          Follow up on these before Friday.
        </div>
      </motion.div>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="mt-4 text-sm text-[#6E6E6E] italic"
      >
        No need to wait for the weekly call.
      </motion.p>
    </div>
  );
}

// Step 8: Summary
function GM8() {
  return (
    <TitleCard
      title="Full visibility. No surprises."
      subtitle="Every lead accounted for."
      summary
    />
  );
}

export const gmSteps = [GM1, GM2, GM3, GM4, GM5, GM6, GM7, GM8];
```

**Step 2: Wire into App.jsx**

```jsx
import { gmSteps } from "./walkthroughs/GeneralManagerSteps";

// Update walkthroughs map:
gm: { title: "General Manager — Compliance & Oversight", steps: gmSteps },
```

**Step 3: Verify** — click through all 8 GM steps.

**Step 4: Commit**

```bash
cd /Users/dansia/Documents/HertzDataAnalysis/prototype-lms
git add src/walkthroughs/GeneralManagerSteps.jsx src/App.jsx
git commit -m "feat: add General Manager walkthrough (8 animated steps)"
```

---

### Task 8: Admin Walkthrough Steps

**Files:**
- Create: `prototype-lms/src/walkthroughs/AdminSteps.jsx`
- Modify: `prototype-lms/src/App.jsx`

**Step 1: Create the 4 step components**

```jsx
// src/walkthroughs/AdminSteps.jsx
import TitleCard from "../components/TitleCard";
import AdminUpload from "../components/AdminUpload";
import OrgMapping from "../components/OrgMapping";
import { uploadSummary, orgMapping } from "../data/mockData";

// Step 1: Title
function Admin1() {
  return (
    <TitleCard
      title="Admin — Data & Configuration"
      subtitle="Upload data. Manage mappings. Keep the system current."
    />
  );
}

// Step 2: HLES upload
function Admin2() {
  const { hles } = uploadSummary;
  return (
    <AdminUpload
      fileName="Conversion_Data_Feb_2026.xlsx"
      type="hles"
      summary={[
        { label: "Rows parsed", value: hles.rowsParsed.toLocaleString() },
        { label: "New leads", value: hles.newLeads.toLocaleString(), color: "text-[#2E7D32]" },
        { label: "Updated", value: hles.updated.toLocaleString() },
        { label: "Unchanged", value: hles.unchanged.toLocaleString(), color: "text-[#6E6E6E]" },
        {
          label: "Failed validation",
          value: hles.failed.toString(),
          color: "text-[#C62828]",
          expandable: true,
          details: hles.failedDetails,
        },
      ]}
    />
  );
}

// Step 3: TRANSLOG upload
function Admin3() {
  const { translog } = uploadSummary;
  return (
    <AdminUpload
      fileName="Translog_Feb_2026.csv"
      type="translog"
      summary={[
        { label: "Events parsed", value: translog.eventsParsed.toLocaleString() },
        { label: "Matched to existing leads", value: translog.matched.toLocaleString(), color: "text-[#2E7D32]" },
        {
          label: "Orphan events (stored for future matching)",
          value: translog.orphan.toLocaleString(),
          color: "text-[#6E6E6E]",
        },
      ]}
    />
  );
}

// Step 4: Org mapping with inline edit
function Admin4() {
  return (
    <div>
      <h2 className="text-xl font-semibold text-[#1A1A1A] mb-1">Organisation Mapping</h2>
      <p className="text-sm text-[#6E6E6E] mb-4">Upload in bulk. Edit where needed.</p>
      <OrgMapping
        rows={orgMapping}
        editingRow={0}
        editedValue="R. Martinez"
        missingRows={[10, 14]}
      />
    </div>
  );
}

export const adminSteps = [Admin1, Admin2, Admin3, Admin4];
```

**Step 2: Wire into App.jsx**

```jsx
import { adminSteps } from "./walkthroughs/AdminSteps";

// Update walkthroughs map:
admin: { title: "Admin — Data & Configuration", steps: adminSteps },
```

Remove the `Placeholder` function — no longer needed.

**Step 3: Verify** — click through all 4 Admin steps.

**Step 4: Commit**

```bash
cd /Users/dansia/Documents/HertzDataAnalysis/prototype-lms
git add src/walkthroughs/AdminSteps.jsx src/App.jsx
git commit -m "feat: add Admin walkthrough (4 animated steps)"
```

---

### Task 9: Polish & Final Review

**Files:**
- Modify: various components as needed

**Step 1: Full walkthrough review**

Run through all three journeys end to end. Check:
- Transitions are smooth (no jank, no layout shift)
- Yellow accent is used sparingly — not overwhelming
- Text is legible, hierarchy is clear
- Progress dots work correctly
- Keyboard navigation works
- "Back to journeys" works from every step

**Step 2: Fix any visual issues**

Adjust spacing, font sizes, animation timing as needed. Common fixes:
- Table columns may need width adjustments
- Detail panels may need max-height with scroll
- Animation delays may need tuning for presentation pacing

**Step 3: Update index.html title**

```html
<title>Hertz LMS — Lead Management System</title>
```

**Step 4: Final commit**

```bash
cd /Users/dansia/Documents/HertzDataAnalysis/prototype-lms
git add -A
git commit -m "feat: polish animations, spacing, and final walkthrough review"
```

---

## Summary

| Task | Description | Est. Steps |
|------|-------------|------------|
| 1 | Install Node, scaffold Vite + React + Tailwind + Framer Motion | 7 |
| 2 | Mock data | 2 |
| 3 | Walkthrough shell & navigation | 3 |
| 4 | Landing page | 4 |
| 5 | Shared UI components (11 components) | 11 |
| 6 | Branch Manager walkthrough (8 steps) | 4 |
| 7 | General Manager walkthrough (8 steps) | 4 |
| 8 | Admin walkthrough (4 steps) | 4 |
| 9 | Polish & final review | 4 |
