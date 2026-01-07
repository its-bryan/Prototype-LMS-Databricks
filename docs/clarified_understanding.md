# Clarified Understanding - Hertz Insurance Replacement Analysis

## Purpose

This document tracks all **confirmed understanding** and **answered questions** from the analysis. When questions from `outstanding_questions.md` are answered (either through meetings, data analysis, or direct communication), they are moved here with their answers.

---

## Digital Self-Service / Interactions

_(Clarified understanding will be added here as questions are answered)_

---

## HLES Conversion

_(Clarified understanding will be added here as questions are answered)_

---

## CRESER

_(Clarified understanding will be added here as questions are answered)_

---

## CSPLIT

_(Clarified understanding will be added here as questions are answered)_

---

## CRA

_(Clarified understanding will be added here as questions are answered)_

---

## TRANSLOG

_(Clarified understanding will be added here as questions are answered)_

---

## HRD Call Recording Data (CIDsHRDrecording.xlsx)

**Call Data Overview**:
- Dataset contains 1,000 call records from Nov 1-7, 2025
- Two sheets: OutboundHRD (proactive outreach) and InboundHRD (customer-initiated)

**Q: Can we add join keys to link calls to reservations?**

**A:** No direct join keys are currently available in the call recording data (no `confirmation_number`, `reservation_id`, or `KNUM`). Potential indirect linking approaches:
- Join based on mobile number for outbound calls
- Parse call transcripts to extract reservation numbers or KNUM numbers mentioned by agents
- These approaches may enable linking call quality metrics to conversion outcomes

**Source:** User clarification
**Date Clarified:** 2026-01-06

**Data Quality Issues Identified**:
- OutboundHRD: 100% null disposition codes (primaryDispositionId, secondaryDispositionId, dispositionNotes)
- InboundHRD: 94.4% populated dispositionNotes but primary/secondary IDs still null
- dispositionNotes use inconsistent free-text entry (97 unique values for similar concepts)
- No transfer tracking in OutboundHRD (transferIndicatorId = 0 for all calls)

**Call Volume Patterns**:
- 12.5% of customers received 2+ calls in one week
- One extreme case: customer received 63 calls in 7 days

**Performance Observations**:
- Hour 13 (1pm UTC) shows 54% customer hang-ups (worst performance)
- 6.7% of calls ended due to "Agent Phone Disconnected"
- 18.1% of calls included holds; 4 calls exceeded 5 minutes hold time

---

## Business Process & Workflows

**Conversion Outcome**:
- Primary metric: `RENT_IND` variable (1 = converted to rental, 0 = did not convert)
- Conversion Rate Formula: `(sum of RENT_IND) / (sum of RES_IND) × 100%`

**Insurance Partner Relationships**:
- Hertz is "co-primary" partner with State Farm (exact prioritization TBD)
- Leads come through insurance company partners
- Adjusters have involvement in the process (timing/handoff details TBD)

---

## Other Data Sources

_(Clarified understanding will be added here as questions are answered)_

---

## General Notes & Insights

**Key Business Context**:
- **Business Objective**: Improve lead-to-rental conversion rates for insurance replacement segment
- **Customer Journey**: Insurance claim → Lead to Hertz → Reservation → Rental conversion
- **Critical Touchpoints**: HRD calls, MMR (digital self-service), body shop interactions, branch counter

**Data Integration Challenges**:
- Multiple disconnected systems: HLES (reservations), HRD (calls), CRA/CSPLIT (contracts)
- Limited join keys between systems
- Customer phone numbers could enable indirect linkage (if available in HLES)

**Analysis Priorities**:
1. Link call quality metrics to conversion outcomes
2. Understand digital self-service (MMR) adoption and completion
3. Quantify body shop interference impact
4. Optimize HRD contact strategies (timing, attempts, messaging)

---

## Document Maintenance

**How to use this document**:

1. **When a question from `outstanding_questions.md` is answered**:
   - Copy the question to the appropriate section here
   - Add the answer with source (meeting notes, data analysis, email, etc.)
   - Add date clarified if relevant
   - Remove from `outstanding_questions.md`

2. **When new understanding emerges**:
   - Add to the appropriate section with source and confidence level if applicable

3. **Format for answered questions**:
   ```
   **Q: [Original question]**

   **A:** [Detailed answer]

   **Source:** [Meeting with X / Data analysis / Email from Y]
   **Date Clarified:** [YYYY-MM-DD]
   ```

**Last Updated:** 2026-01-06
