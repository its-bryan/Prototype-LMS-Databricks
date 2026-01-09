# Conversion Failure Hypotheses

## Contact & Response Time

### CONTACT-1: Faster initial contact improves conversion
**Status:** 🔴 Not Started

Leads contacted within 30 minutes convert at significantly higher rates than those contacted later.

Notes: Ray mentioned "most conversions happen within the first week"

### CONTACT-2: No-contact leads have lower conversion
**Status:** 🔴 Not Started

Leads with CONTACT_GROUP = "NO CONTACT" convert at lower rates (excluding MMR self-service).

### CONTACT-3: Bad or incomplete contact details
**Status:** 🔴 Not Started

Leads with incorrect phone numbers, missing email addresses, no SMS consent, or language barriers have lower conversion rates due to inability to establish contact.

Notes: Cross-reference CONTACT-2, DATA-1, TRANSFER-2

### CONTACT-4: Response-time miss (slow first contact, missed golden hour) ⭐
**Status:** 🔴 Not Started

Leads not contacted within critical time windows (1 hour "golden hour", same-day response) convert at significantly lower rates, even if eventually contacted within broader SLA.

Notes: Refines CONTACT-1 with more granular buckets. Cross-reference HANDOFF-2, TIMING-1/2

### CONTACT-5: Contact/follow-up failure (insufficient attempts, poor cadence) ⭐
**Status:** 🔴 Not Started

Leads receiving <3 contact attempts, irregular follow-up cadence, single-channel outreach (phone-only, no SMS/email), or no voicemail/SMS have lower conversion rates. Additionally, outbound calls flagged as spam reduce answer rates.

Notes: Cross-reference CONTACT-2, TRANSFER-2, CALLOPS-2, CALLOPS-4, DATA-1

### CONTACT-6: Qualification confusion (unclear process expectations)
**Status:** 🔴 Not Started

Customers unclear about pickup/delivery logistics, required documentation (license, insurance authorization), deposit expectations, operating hours, or eligibility rules are more likely to abandon the conversion process.

Notes: Cross-reference BODYSHOP-2, JOURNEY-1, DATA-2. PICKUPSERVICE 100% null in sample data.

---

## Customer Journey & Channel

### JOURNEY-1: MMR self-service completion improves conversion
**Status:** 🔴 Not Started

Customers who complete MMR digital flow convert at higher rates.

### JOURNEY-2: Counter vs HRD contact effectiveness differs
**Status:** 🔴 Not Started

Local branch (Counter) contact converts better than centralized (HRD) contact.

---

## Location & Capacity

### LOCATION-1: Conversion varies significantly by location
**Status:** 🔴 Not Started

Some locations consistently outperform/underperform, indicating operational differences.

### LOCATION-2: High reservation volume periods reduce conversion
**Status:** 🔴 Not Started

Conversion drops when reservation volume exceeds capacity (fleet/staff constraints).

Notes: Ray mentioned hurricanes/floods as examples of surge impact

---

## Insurance Partner & Lead Source

### PARTNER-1: Conversion rates vary by insurance partner (CDP)
**Status:** 🔴 Not Started

Some insurance partners send higher-quality leads or have better process integration.

### PARTNER-2: Co-primary partnerships (e.g., StateFarm) have lower conversion
**Status:** 🔴 Not Started

Leads shared with competitors convert worse than exclusive leads.

Notes: Need to clarify if StateFarm leads are sent simultaneously to Enterprise

---

## Cancellation Patterns

### CANCEL-1: Specific cancel reasons are addressable
**Status:** 🔴 Not Started

Certain cancel_reason categories represent preventable losses.

Notes: Cancel reasons are manually entered, may be incomplete

---

## Body Shop & Pickup

### BODYSHOP-1: Body shop relationship affects conversion
**Status:** 🔴 Not Started

Leads from certain body shops convert better (possible interference from competitors).

Notes: Vikram: Even when customer has set up with Hertz, body shops may actively steer them to competitors (e.g., recommending Enterprise). This is core to Enterprise's strategy.

### BODYSHOP-2: Pickup service availability affects conversion
**Status:** 🔴 Not Started

Customers needing pickup who don't receive it are less likely to convert.

Notes: PICKUPSERVICE column currently all null in CRESER - may need different data source. Vikram: Execution is inconsistent. Poor reliability or limited scheduling flexibility could be meaningful drag on conversion.

---

## Vehicle Availability & Operational Execution

### VEHICLE-1: No vehicle available at required time/location
**Status:** 🔴 Not Started

Leads fail to convert when desired vehicle unavailable at customer's preferred time/location.

### VEHICLE-2: Wrong vehicle class or constraints
**Status:** 🔴 Not Started

Leads abandon when available vehicles don't meet specific requirements (AWD, child seats, cargo space, towing capacity) or "comparable class" doesn't match expectations.

### VEHICLE-3: Delivery/pickup capability fails ⭐
**Status:** 🔴 Not Started

Leads requiring delivery/pickup convert at lower rates when delivery staff unavailable, pickup windows missed, or body shop coordination fails.

Notes: Cross-reference BODYSHOP-2, CONTACT-6. PICKUPSERVICE currently 100% null.

### VEHICLE-4: Branch execution issues
**Status:** 🔴 Not Started

Customers encountering long queues, paperwork delays, or vehicle not ready/held for others are less likely to complete rental.

### VEHICLE-5: Operating-hours mismatch
**Status:** 🔴 Not Started

Customers whose preferred pickup/dropoff times fall outside branch operating hours have lower conversion.

---

## Pricing & Coverage

### PRICING-1: Customer out-of-pocket surprise
**Status:** 🔴 Not Started

Customers surprised by out-of-pocket costs (deposits, incidentals, upgrades, fuel, tolls, young driver fees) abandon rental.

### PRICING-2: Coverage mismatch
**Status:** 🔴 Not Started

Insurance coverage limitations (daily caps, duration limits, unauthorized vehicle class) create unexpected customer liability and reduce conversion.

Notes: Requires insurance authorization data - check CDP integration.

---

## SLA & Insurer Escalation

### SLA-1: SLA breach
**Status:** 🔴 Not Started

Leads where Hertz breaches internal SLAs (acknowledgment time, first contact, vehicle ready time, delivery windows) convert at lower rates.

Notes: Cross-reference HANDOFF-2 (insurer SLAs), CONTACT-4 (response time).

### SLA-2: Insurer escalation and reassignment
**Status:** 🔴 Not Started

Leads escalated by insurer and reassigned to secondary providers (due to Hertz non-responsiveness/capacity) result in lost conversions.

Notes: Cross-reference HANDOFF-2, PARTNER-2.

---

## Customer Decision Factors

### CUSTOMER-1: Customer no longer needs rental
**Status:** 🔴 Not Started

Customers abandon rental when transportation needs change (vehicle repaired faster, alternative transportation secured, claim settled differently).

---

## Timing & Seasonality

### TIMING-1: Day of week affects conversion
**Status:** 🔴 Not Started

Leads received on certain days convert better (staffing/response time differences).

### TIMING-2: Time of day affects conversion
**Status:** 🔴 Not Started

Leads received during business hours convert better.

---

## Call Center & Transfer Failures

### TRANSFER-1: Call center to location transfers fail frequently
**Status:** 🔴 Not Started

Customers transferred from HRD to local locations often don't complete the transfer or convert.

Notes: Vikram suspects locations often don't answer phones. Dan found 13 of 61 lost leads had "Will come to location" but never converted.

### TRANSFER-2: Outbound calls flagged as spam reduce contact rate
**Status:** 🔴 Not Started

Hertz outbound calls are being labeled as spam, reducing successful contact rates.

Notes: Vikram flagged this as potential leakage point. Requires interview with call center team.

### TRANSFER-3: Location phone answer rate varies and impacts conversion
**Status:** 🔴 Not Started

Locations with poor phone answer rates have lower conversion.

Notes: Vikram: "I know that locations often (how often?) don't answer the phone"

---

## Process Handoffs & Lead Ownership

### HANDOFF-1: Lead stuck or handballed (unclear ownership) ⭐
**Status:** 🔴 Not Started

Leads with unclear ownership between call center, branch, delivery team, or claims liaison convert at significantly lower rates due to coordination failures and accountability gaps.

Notes: Cross-reference TRANSFER-1, DATA-2

### HANDOFF-2: Lead aged out (not actioned within insurer-required window)
**Status:** 🔴 Not Started

Leads not contacted or actioned within insurer-mandated response windows (e.g., 24-48 hours) are reassigned to competitors or closed, reducing Hertz's conversion opportunity.

Notes: Cross-reference CONTACT-1, PARTNER-1/2, TIMING-1/2. Need partner SLA documentation.

---

## Digital Flow & Self-Selection

### DIGITAL-1: High digital conversion is self-selection bias
**Status:** 🔴 Not Started

The ~80% conversion rate for digital flow completers reflects higher-intent customers, not the digital experience itself.

Notes: Counter-hypothesis to JOURNEY-1. Vikram: Recently removed credit card requirement to test impact.

---

## Data Quality & Recording

### DATA-1: Contact attempt data is under-recorded
**Status:** 🔴 Not Started

TRANSLOG contact records are incomplete, masking actual contact attempts.

Notes: Dan's finding: Only 25% of non-converted leads had contact records.

### DATA-2: "Will come to location" drop-offs are significant and untracked
**Status:** 🔴 Not Started

A meaningful portion of customers who say they'll come to a location never show up, and reasons are not captured.

Notes: Dan found 13 of 61 lost leads (21%) had this status but never converted. No info recorded as to why.

---

## Call Center Operations & Quality

### CALLOPS-1: HRD agent performance varies significantly and impacts conversion
**Status:** 🟡 In Progress

Top-performing agents (high call completion rates) contribute to higher overall conversion rates.

Notes: 4.6x variance identified (top agent: 87% completion rate vs bottom: 19%). Top 5 agents average 82% call completion; bottom 5 average 30%.

### CALLOPS-2: Multiple call attempts reduce conversion likelihood
**Status:** 🔴 Not Started

Customers receiving 3+ calls become frustrated and are less likely to convert.

Notes: 93 customers (12.5%) received 2+ calls in one week. One customer received 63 calls. Potential harassment/compliance issue.

### CALLOPS-3: Call quality patterns vary by time of day and impact conversion
**Status:** 🟡 In Progress

Certain hours have systematically lower call completion rates, reducing conversion.

Notes: Hour 13 (1pm UTC): 54% customer hang-ups (worst). Hours 12, 21-22: 73-77% agent completion (best).

### CALLOPS-4: Low call attempts reduce conversion likelihood
**Status:** 🔴 Not Started

Customers receiving 0,1,2 calls are less likely to convert.

### CALLOPS-5: Excessive hold times reduce call completion and conversion
**Status:** 🔴 Not Started

Calls with holds >2 minutes have lower completion rates and conversion.

Notes: 18.1% of calls included holds. 4 calls had >5 minute holds (max: 10.3 minutes). Customer-ended calls average 19.7s hold vs agent-ended 12.5s hold.

### CALLOPS-6: Technical issues (agent phone disconnects) result in lost conversions
**Status:** 🔴 Not Started

Calls ending in technical failures have near-zero conversion rates.

Notes: 67 calls (6.7%) ended in technical disconnects. Telephony infrastructure issue.
