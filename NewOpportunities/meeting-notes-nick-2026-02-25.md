# Meeting Notes: Insurance Replacement Reporting Audit & Strategy

**Date:** Feb 25, 2026
**Attendees:** Dan (Carrara), Nick (Hertz - Insurance Replacement)

---

## Key Findings

### Three Disconnected Reporting Streams

| Person | Role | Reports To | Scope |
|--------|------|------------|-------|
| **Chad** | External / partner-facing monthly reports | Nick | Monthly reports to ~20+ insurance partners (Progressive, Geico, State Farm, Liberty Mutual, etc.) |
| **Darlene** | Ad hoc + internal operational reports | Vito | Daily open reservations, conversion reporting, pending close, on-rent counts, licensee cost allocation, extension requests |
| **Tom (Borg)** | Data analytics dashboards (Tableau) | Andrew | Replacement dashboard, account-level views, summary vs detail |

### Reports Never Reconcile

- **Borg dashboard vs Borg summary:** 520-unit delta on month-to-date transactions (47,140 vs 46,760) and ~$300K revenue variance - both from the *same* analytics team.
- **Darlene vs Borg on-rent:** 37,720 vs 29,562 - an 8,000+ unit gap. This is what Gim got burned on when reporting to C-suite.
- **Chad's external reports vs internal reports:** Progressive example showed 1,620 vs 1,793 transactions for the same month. External partner reports don't match internal dashboards.
- **Conversion reporting:** Darlene's State Farm conversion includes walk-ups to inflate the number above 80%. Actual clean conversion is ~65-71%. This was a deliberate decision made years ago.

### Critical Key-Man Risk

- **No documentation** of how Darlene pulls her data (manual Excel, access to a legacy server).
- **No cross-training** - nobody else knows any of the three workflows.
- **No contractual notice period** - any of them could leave without warning.
- **If one person is unavailable** (vacation, illness, resignation), their entire reporting stream stops.

### Operational Impact

- **Strategy decisions are made on unreliable data.** Nick and Gim cannot confidently report to C-suite.
- **No segment visibility on Borg:** Cannot break down on-rent by State Farm / non-State Farm / Fleet / Dealer - just a single HLE-S total.
- **Archaic tooling:** All reporting is manual Excel-based despite having Tableau available. Reports look like they were built in 2007.
- **Chad's partner reports** are the most trusted baseline because partners have received them for a decade - can't suddenly change without losing credibility.

### Stakeholder Alignment

- **Andrew (Tom's boss):** Supports the initiative. Philosophy: include everything, label the noise, then filter. Execution is Gim and Nick's call.
- **Nick:** Indifferent to method, just needs accurate, trustworthy numbers. Wants ability to drill down by account, location, call buckets, segment.
- **Gim (Nick's boss):** Wants to talk about reporting overhaul. Has been burned by data discrepancies when reporting to senior leadership.

## Agreed Next Steps

1. **Use Chad's data as the interim baseline** for insurance replacement conversion tracking - don't change what works while fixing the root cause.
2. **Schedule follow-up with Gim** to align on the broader reporting audit scope.
3. **Bring Carrara BI team** to the next meeting to discuss audit approach and agentic reporting vision.
4. **Audit all three reporting streams** - document each person's data sources, logic, filters, and outputs one by one.
5. **Design unified intelligence architecture** once the audit is complete - single source of truth with agentic automation to eliminate key-man risk.
