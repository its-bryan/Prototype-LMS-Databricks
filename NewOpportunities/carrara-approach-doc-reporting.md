# Carrara Approach: Off-Airport Reporting & Intelligence

**Client:** Hertz - Off-Airport Division (Insurance Replacement, Dealership, Fleet)
**Sponsor:** Gim & Nick
**Date:** February 2026

---

## Problem Statement

Hertz's off-airport division - representing an estimated 35% of the company's P&L across insurance replacement, dealership, and fleet segments - has **no single source of truth** for its reporting. Three individuals independently produce reports using different data sources, different logic, and different tools. The numbers rarely reconcile, discrepancies surface across internal dashboards, partner-facing reports, and executive reporting - creating a situation where leadership cannot confidently make decisions, track performance, and report to C-suite or to insurance partners.

There is no documentation of how reports are built, limited shared understanding/methodologies between the three reporting owners, and no continuity plan. If any one of these individuals is unavailable - whether through resignation, illness, or leave - their entire reporting stream stops with no way to recover it.

---

## Future End State

**Reconcilable, consistent, and defensible reporting** across the off-airport division, where:

- **One source of truth** underpins all reporting - internal dashboards, partner-facing reports, and ad hoc analysis all trace back to the same validated baseline.
- **Clear definitions** for every metric - conversion, on-rent, length of rental, and segment breakdowns - with transparent labelling of any exclusions or filters applied.
- **Full documentation** of every pipeline, in a simple, business-friendly format - so that knowledge lives in the infrastructure, not in any single person.
- **Real-time reporting intelligence** - any report can be queried and produced on demand, without waiting for a person to manually extract, pivot, and distribute it.

---

## Expected Benefits

| Benefit | Description |
|---------|-------------|
| **Reconcilability** | Every number traces back to the same source. Internal, external, and executive reports always tie out. No more unexplained deltas between dashboards. |
| **Consistency** | One set of definitions applied everywhere. Partners, operations, and C-suite all see numbers built on the same logic - regardless of which report they reference. |
| **Availability** | Reports are not dependent on any single person's availability or bandwidth. Scheduled reports run automatically. Ad hoc queries are answered in real time. |
| **Defensibility** | Leadership can report to C-suite and to partners with full confidence in the numbers, knowing exactly how they were derived and what is included or excluded. |
| **Continuity** | All pipeline logic is documented and lives in the infrastructure. No single point of failure. Knowledge transfer risk is eliminated. |

---

## Approach

This piece of work is structured in **two parts**. Part 1 addresses the immediate data integrity and continuity problem. Part 2 builds persistent reporting intelligence into Hertz's infrastructure. Hertz may choose to proceed with one or both.

### Part 1: Trace & Unify

Fix the current reporting issues. Ensure all data is clean, coherent, and reconcilable. Establish continuity and documentation so the division is no longer dependent on individual knowledge.

| Step | Focus | What We Do | Outcome |
|------|-------|------------|---------|
| **1. Diagnostics** | Understand | Map each reporting owner's complete workflow - data sources, extraction methods, transformation logic, output formats, and distribution lists. Catalogue every report produced. Identify all reconciliation gaps and trace them to root cause. | Full picture of the current state: what exists, where it diverges, and why. |
| **2. Design** | Define | Define the single source of truth and canonical data model for off-airport reporting. Establish agreed definitions for key metrics across all segments (insurance, dealership, fleet) with clear rules for labelling and filtering. Align with stakeholders on the target reporting structure. | Agreed blueprint for unified reporting - what reports exist, who consumes them, and what views are available. |
| **3. Rebuild** | Deliver | Rebuild reporting pipelines against the unified data model and agreed definitions. Ensure all partner-facing, internal, and executive reports reconcile to the same baseline. Deliver clear, business-friendly documentation of every pipeline. | Clean, reconciled reporting with full documentation - any team member can understand how data flows from source to report. |

### Part 2: Agentic Business Intelligence

Build a persistent reporting intelligence inside Hertz's infrastructure so that any report can be queried and produced in real time - without manual extraction or dependence on specific individuals.

| Step | Focus | What We Do | Outcome |
|------|-------|------------|---------|
| **1. Design Pipeline** | Architect | Define which reports and queries the agentic system needs to support - scheduled partner reports, ad hoc leadership queries, segment drill-downs. Design the data architecture and schema required for agentic access. | Technical blueprint for a structured, well-documented, queryable reporting system. |
| **2. Build Pipeline** | Automate | Build the automated data pipelines that feed the agentic system. Implement scheduled report generation to replace manual monthly reporting cycles (20+ partner reports, internal dashboards, executive summaries). | Fully automated reporting pipelines - reports generate on schedule without manual intervention. |
| **3. Build Interface** | Enable | Deliver a conversational interface where leadership and operators can query reporting in real time - by account, segment, location, claim type, and time period. | On-demand reporting intelligence accessible to any authorised user, at any time. |

---

## Considerations

- **System migration alignment** - Hertz is expected to transition to a new core system within the next two to three years. The architecture delivered in this engagement should be designed to flow cleanly into that future system, so the investment carries forward rather than being rebuilt.
- **Stakeholder engagement** - The diagnostic and design phases require close cooperation from the three current reporting owners, each of whom has deep institutional knowledge. This engagement should be positioned as a natural extension of the ongoing effort to unify reporting - not as an external audit. The current momentum and alignment across leadership provides a strong pathway to engage constructively, but the approach needs to remain collaborative and respectful of the expertise these individuals bring.
- **Baseline shift and data change management** - The current reporting contains known inconsistencies that have never been fully reconciled - even between the existing report owners. When the unified reporting is delivered, it will establish a new baseline that may not perfectly reconcile with historical numbers. Some variances will be explainable through cleaner logic; others may surface legacy errors that were never identified. This means the transition is not just a technical cutover - it requires careful change management with internal stakeholders and external partners to explain what has changed, why the numbers may look different, and why the new baseline is more trustworthy. This will be a stakeholder-heavy process and should be planned for explicitly.
- **Source system complexity** - The current operating system for the replacement business (HLES) is significantly outdated, and the underlying data contains known inconsistencies and imperfections. We expect these to surface during diagnostics. They are solvable, but will require careful cleaning and well-documented filtering logic to ensure the unified reporting layer is built on a reliable foundation.

---

**Immediate next step:** Working session with Gim, Nick, and the Carrara team to align on scope and priorities.
