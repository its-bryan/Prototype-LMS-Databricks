# Conversion Failure Hypotheses

Track all hypotheses about what drives conversion success/failure. Each hypothesis will be systematically tested with statistical analysis.

## Important: Conversion Outcome Variable
- **Variable Reference**: Hypotheses refer to the outcome variable as `rental` for readability
- **Actual Column Name**: `RENT_IND` in the HLES Conversion data (raw: `\nRENT_IND`)
- **Definition**: `RENT_IND = 1` indicates a lead converted to a rental (this is what we're trying to maximize)
- **Formula**: `Conversion Rate = (sum of RENT_IND) / (sum of RES_ID) × 100%`
- See CLAUDE.md for full definition and data specifications

## Status Legend
- 🔴 Not Started
- 🟡 In Progress
- 🟢 Completed - Supported
- ⚪ Completed - Not Supported
- 🔵 Completed - Inconclusive

---

## Contact & Response Time

### CONTACT-1: Faster initial contact improves conversion
- **Status**: 🔴 Not Started
- **Hypothesis**: Leads contacted within 30 minutes convert at significantly higher rates than those contacted later
- **Data needed**: contact_range, hours_difference, rental (HLES Conversion)
- **Test**: Chi-square / logistic regression on contact_range vs conversion
- **Result**: _pending_
- **Notes**: Ray mentioned "most conversions happen within the first week"

### CONTACT-2: No-contact leads have lower conversion
- **Status**: 🔴 Not Started
- **Hypothesis**: Leads with CONTACT_GROUP = "NO CONTACT" convert at lower rates (excluding MMR self-service)
- **Data needed**: CONTACT_GROUP, rental, MSG10 (for MMR completion)
- **Test**: Compare conversion rates by contact group
- **Result**: _pending_

### CONTACT-3: Bad or incomplete contact details
- **Status**: 🔴 Not Started
- **Hypothesis**: Leads with incorrect phone numbers, missing email addresses, no SMS consent, or language barriers have lower conversion rates due to inability to establish contact
- **Data needed**: CONTACT_GROUP, hours_difference, TRANSLOG (failed contact patterns), HRD call data (endReason), customer phone/email fields (to be confirmed)
- **Test**: Create contact_successful proxy; Compare RENT_IND rates for successful vs failed contact; HRD triangulation for wrong number proxy
- **Result**: _pending_
- **Notes**: Cross-reference CONTACT-2, DATA-1, TRANSFER-2

### CONTACT-4: Response-time miss (slow first contact, missed golden hour) ⭐
- **Status**: 🔴 Not Started
- **Hypothesis**: Leads not contacted within critical time windows (1 hour "golden hour", same-day response) convert at significantly lower rates, even if eventually contacted within broader SLA
- **Data needed**: contact_range, hours_difference, initial_date, rental (RENT_IND), CONTACT_GROUP
- **Test**: Create granular time buckets (<1hr, 1-3hrs, 3-6hrs, 6-24hrs, >24hrs); Chi-square + post-hoc comparisons; Logistic regression with splines
- **Result**: _pending_
- **Notes**: Refines CONTACT-1 with more granular buckets. Cross-reference HANDOFF-2, TIMING-1/2

### CONTACT-5: Contact/follow-up failure (insufficient attempts, poor cadence) ⭐
- **Status**: 🔴 Not Started
- **Hypothesis**: Leads receiving <3 contact attempts, irregular follow-up cadence, single-channel outreach (phone-only, no SMS/email), or no voicemail/SMS have lower conversion rates. Additionally, outbound calls flagged as spam reduce answer rates
- **Data needed**: TRANSLOG (attempt count, time gaps), HRD call data (toAddr counts, endReason patterns), CONTACT_GROUP, rental (RENT_IND), channel mix indicators
- **Test**: Segment by attempt count; Calculate cadence quality; Identify multi-channel vs single-channel; Logistic regression: RENT_IND ~ attempt_count + cadence_quality + channel_diversity
- **Result**: _pending_
- **Notes**: Cross-reference CONTACT-2, TRANSFER-2, CALLOPS-2, CALLOPS-4, DATA-1

### CONTACT-6: Qualification confusion (unclear process expectations)
- **Status**: 🔴 Not Started
- **Hypothesis**: Customers unclear about pickup/delivery logistics, required documentation (license, insurance authorization), deposit expectations, operating hours, or eligibility rules are more likely to abandon the conversion process
- **Data needed**: cancel_reason (text mining), PICKUPSERVICE, TRANSLOG notes, HRD call data (dispositionNotes, totalDurationSeconds, holdSeconds), MSG10, BODYSHOP
- **Test**: Text mine for confusion keywords; Compare call duration for converted vs non-converted; Test complexity proxies; Logistic regression: RENT_IND ~ confusion_signal + pickup_needed + bodyshop_involved + contact_channel
- **Result**: _pending_
- **Notes**: Cross-reference BODYSHOP-2, JOURNEY-1, DATA-2. PICKUPSERVICE 100% null in sample data.

---

## Customer Journey & Channel

### JOURNEY-1: MMR self-service completion improves conversion
- **Status**: 🔴 Not Started
- **Hypothesis**: Customers who complete MMR digital flow convert at higher rates
- **Data needed**: MSG10 status, rental
- **Test**: Conversion rate comparison with/without MMR completion
- **Result**: _pending_

### JOURNEY-2: Counter vs HRD contact effectiveness differs
- **Status**: 🔴 Not Started
- **Hypothesis**: Local branch (Counter) contact converts better than centralized (HRD) contact
- **Data needed**: Contact source, rental
- **Test**: Conversion rate by contact source
- **Result**: _pending_

---

## Location & Capacity

### LOCATION-1: Conversion varies significantly by location
- **Status**: 🔴 Not Started
- **Hypothesis**: Some locations consistently outperform/underperform, indicating operational differences
- **Data needed**: RENT_LOC, rental
- **Test**: ANOVA / chi-square across locations, identify outliers
- **Result**: _pending_

### LOCATION-2: High reservation volume periods reduce conversion
- **Status**: 🔴 Not Started
- **Hypothesis**: Conversion drops when reservation volume exceeds capacity (fleet/staff constraints)
- **Data needed**: Daily reservation counts, conversion rates over time
- **Test**: Correlation between volume and conversion rate
- **Result**: _pending_
- **Notes**: Ray mentioned hurricanes/floods as examples of surge impact

---

## Insurance Partner & Lead Source

### PARTNER-1: Conversion rates vary by insurance partner (CDP)
- **Status**: 🔴 Not Started
- **Hypothesis**: Some insurance partners send higher-quality leads or have better process integration
- **Data needed**: cdp_name, rental
- **Test**: Conversion rate comparison across CDP partners
- **Result**: _pending_

### PARTNER-2: Co-primary partnerships (e.g., StateFarm) have lower conversion
- **Status**: 🔴 Not Started
- **Hypothesis**: Leads shared with competitors convert worse than exclusive leads
- **Data needed**: CDP classification, rental
- **Test**: Compare exclusive vs shared lead conversion
- **Result**: _pending_
- **Notes**: Need to clarify if StateFarm leads are sent simultaneously to Enterprise

---

## Cancellation Patterns

### CANCEL-1: Specific cancel reasons are addressable
- **Status**: 🔴 Not Started
- **Hypothesis**: Certain cancel_reason categories represent preventable losses
- **Data needed**: cancel_reason, frequency counts
- **Test**: Pareto analysis of cancellation reasons
- **Result**: _pending_
- **Notes**: Cancel reasons are manually entered, may be incomplete

---

## Body Shop & Pickup

### BODYSHOP-1: Body shop relationship affects conversion
- **Status**: 🔴 Not Started
- **Hypothesis**: Leads from certain body shops convert better (possible interference from competitors)
- **Data needed**: BODYSHOP/BODYSHOPID, rental
- **Test**: Conversion rate by body shop
- **Result**: _pending_
- **Notes**: Vikram: Even when customer has set up with Hertz, body shops may actively steer them to competitors (e.g., recommending Enterprise). This is core to Enterprise's strategy.

### BODYSHOP-2: Pickup service availability affects conversion
- **Status**: 🔴 Not Started
- **Hypothesis**: Customers needing pickup who don't receive it are less likely to convert
- **Data needed**: PICKUPSERVICE, rental
- **Test**: Conversion comparison by pickup service status
- **Result**: _pending_
- **Notes**: PICKUPSERVICE column currently all null in CRESER - may need different data source. Vikram: Execution is inconsistent. Poor reliability or limited scheduling flexibility could be meaningful drag on conversion—customers may give up.

---

## Vehicle Availability & Operational Execution

### VEHICLE-1: No vehicle available at required time/location
- **Status**: 🔴 Not Started
- **Hypothesis**: Leads fail to convert when desired vehicle unavailable at customer's preferred time/location
- **Data needed**: Vehicle inventory logs, cancel_reason, TRANSLOG notes
- **Test**: Interview validation
- **Result**: _pending_

### VEHICLE-2: Wrong vehicle class or constraints
- **Status**: 🔴 Not Started
- **Hypothesis**: Leads abandon when available vehicles don't meet specific requirements (AWD, child seats, cargo space, towing capacity) or "comparable class" doesn't match expectations
- **Data needed**: Vehicle class requested vs offered, special equipment requests, cancel_reason
- **Test**: Interview validation
- **Result**: _pending_

### VEHICLE-3: Delivery/pickup capability fails ⭐
- **Status**: 🔴 Not Started
- **Hypothesis**: Leads requiring delivery/pickup convert at lower rates when delivery staff unavailable, pickup windows missed, or body shop coordination fails
- **Data needed**: PICKUPSERVICE, TRANSLOG (delivery requests/outcomes), BODYSHOP coordination, cancel_reason
- **Test**: Conversion comparison by delivery success/failure; logistic regression
- **Result**: _pending_
- **Notes**: Cross-reference BODYSHOP-2, CONTACT-6. PICKUPSERVICE currently 100% null.

### VEHICLE-4: Branch execution issues
- **Status**: 🔴 Not Started
- **Hypothesis**: Customers encountering long queues, paperwork delays, or vehicle not ready/held for others are less likely to complete rental
- **Data needed**: Branch operational metrics, cancel_reason, TRANSLOG notes
- **Test**: Interview validation
- **Result**: _pending_

### VEHICLE-5: Operating-hours mismatch
- **Status**: 🔴 Not Started
- **Hypothesis**: Customers whose preferred pickup/dropoff times fall outside branch operating hours have lower conversion
- **Data needed**: Branch hours, rental start time requests, TRANSLOG notes, cancel_reason
- **Test**: Chi-square on time-match vs conversion; interview validation
- **Result**: _pending_

---

## Pricing & Coverage

### PRICING-1: Customer out-of-pocket surprise
- **Status**: 🔴 Not Started
- **Hypothesis**: Customers surprised by out-of-pocket costs (deposits, incidentals, upgrades, fuel, tolls, young driver fees) abandon rental
- **Data needed**: Pricing disclosures, deposit requirements, fee structures, cancel_reason
- **Test**: Interview validation
- **Result**: _pending_

### PRICING-2: Coverage mismatch
- **Status**: 🔴 Not Started
- **Hypothesis**: Insurance coverage limitations (daily caps, duration limits, unauthorized vehicle class) create unexpected customer liability and reduce conversion
- **Data needed**: Insurance authorization details, vehicle class vs authorized class, rental duration vs coverage limits, cancel_reason
- **Test**: Conversion comparison coverage-matched vs mismatched; logistic regression
- **Result**: _pending_
- **Notes**: Requires insurance authorization data - check CDP integration.

---

## SLA & Insurer Escalation

### SLA-1: SLA breach
- **Status**: 🔴 Not Started
- **Hypothesis**: Leads where Hertz breaches internal SLAs (acknowledgment time, first contact, vehicle ready time, delivery windows) convert at lower rates
- **Data needed**: initial_date, contact_range, hours_difference, rental_start_time, delivery_promised_time, SLA thresholds
- **Test**: SLA compliance segmentation; chi-square/logistic regression
- **Result**: _pending_
- **Notes**: Cross-reference HANDOFF-2 (insurer SLAs), CONTACT-4 (response time).

### SLA-2: Insurer escalation and reassignment
- **Status**: 🔴 Not Started
- **Hypothesis**: Leads escalated by insurer and reassigned to secondary providers (due to Hertz non-responsiveness/capacity) result in lost conversions
- **Data needed**: Reassignment flags, CDP escalation records, cancel_reason ("reassigned"), time-to-contact patterns
- **Test**: Quantify reassignment rate; interview insurers on escalation triggers
- **Result**: _pending_
- **Notes**: Cross-reference HANDOFF-2, PARTNER-2.

---

## Customer Decision Factors

### CUSTOMER-1: Customer no longer needs rental
- **Status**: 🔴 Not Started
- **Hypothesis**: Customers abandon rental when transportation needs change (vehicle repaired faster, alternative transportation secured, claim settled differently)
- **Data needed**: cancel_reason text mining, repair completion timelines, lead duration patterns
- **Test**: Interview validation; text mining cancel_reason for "no longer needed" patterns
- **Result**: _pending_

---

## Timing & Seasonality

### TIMING-1: Day of week affects conversion
- **Status**: 🔴 Not Started
- **Hypothesis**: Leads received on certain days convert better (staffing/response time differences)
- **Data needed**: initial_date (extract day of week), rental
- **Test**: Chi-square on day-of-week vs conversion
- **Result**: _pending_

### TIMING-2: Time of day affects conversion
- **Status**: 🔴 Not Started
- **Hypothesis**: Leads received during business hours convert better
- **Data needed**: initial_date (extract hour), rental
- **Test**: Conversion rate by hour bucket
- **Result**: _pending_

---

## Call Center & Transfer Failures

### TRANSFER-1: Call center to location transfers fail frequently
- **Status**: 🔴 Not Started
- **Hypothesis**: Customers transferred from HRD to local locations often don't complete the transfer or convert
- **Data needed**: TRANSLOG transfer records, location answer rates
- **Test**: Conversion rate for transferred vs non-transferred customers
- **Result**: _pending_
- **Notes**: Vikram suspects locations often don't answer phones. Dan found 13 of 61 lost leads had "Will come to location" but never converted.

### TRANSFER-2: Outbound calls flagged as spam reduce contact rate
- **Status**: 🔴 Not Started
- **Hypothesis**: Hertz outbound calls are being labeled as spam, reducing successful contact rates
- **Data needed**: Call attempt records, contact success rates (may need call system data)
- **Test**: Interview call center team; compare answer rates to industry benchmarks
- **Result**: _pending_
- **Notes**: Vikram flagged this as potential leakage point. Requires interview with call center team.

### TRANSFER-3: Location phone answer rate varies and impacts conversion
- **Status**: 🔴 Not Started
- **Hypothesis**: Locations with poor phone answer rates have lower conversion
- **Data needed**: Location-level answer rate metrics (if available), conversion by location
- **Test**: Correlation between location answer rates and conversion rates
- **Result**: _pending_
- **Notes**: Vikram: "I know that locations often (how often?) don't answer the phone"

---

## Process Handoffs & Lead Ownership

### HANDOFF-1: Lead stuck or handballed (unclear ownership) ⭐
- **Status**: 🔴 Not Started
- **Hypothesis**: Leads with unclear ownership between call center, branch, delivery team, or claims liaison convert at significantly lower rates due to coordination failures and accountability gaps
- **Data needed**: TRANSLOG (event sequences, multiple agent/location touches), CONTACT_GROUP (Counter→HRD→Counter patterns), cancel_reason, confirmation_number + initial_date
- **Test**: Chi-square comparing single-owner vs multi-owner conversion rates; Logistic regression: RENT_IND ~ handoff_count + time_gap_hours + contact_source_variety
- **Result**: _pending_
- **Notes**: Cross-reference TRANSFER-1, DATA-2

### HANDOFF-2: Lead aged out (not actioned within insurer-required window)
- **Status**: 🔴 Not Started
- **Hypothesis**: Leads not contacted or actioned within insurer-mandated response windows (e.g., 24-48 hours) are reassigned to competitors or closed, reducing Hertz's conversion opportunity
- **Data needed**: initial_date, contact_range, hours_difference, cancel_reason, cdp_name (partner SLA requirements)
- **Test**: Segment by time-to-contact buckets (<24hrs, 24-48hrs, >48hrs); Chi-square/logistic regression on SLA compliance vs RENT_IND; Text mining cancel_reason
- **Result**: _pending_
- **Notes**: Cross-reference CONTACT-1, PARTNER-1/2, TIMING-1/2. Need partner SLA documentation.

---

## Digital Flow & Self-Selection

### DIGITAL-1: High digital conversion is self-selection bias
- **Status**: 🔴 Not Started
- **Hypothesis**: The ~80% conversion rate for digital flow completers reflects higher-intent customers, not the digital experience itself
- **Data needed**: Digital funnel: text sent → started → completed → converted
- **Test**: Compare conversion intent signals (e.g., time to action) between digital and non-digital paths. If start rate and completion rate are low, suggests self-selection.
- **Result**: _pending_
- **Notes**: Counter-hypothesis to JOURNEY-1. Vikram: Recently removed credit card requirement to test impact. Key questions: (1) what % started digital flow, (2) what % completed it.

---

## Data Quality & Recording

### DATA-1: Contact attempt data is under-recorded
- **Status**: 🔴 Not Started
- **Hypothesis**: TRANSLOG contact records are incomplete, masking actual contact attempts
- **Data needed**: TRANSLOG completeness audit, interview with call center on recording practices
- **Test**: Compare TRANSLOG records against call system logs (if available)
- **Result**: _pending_
- **Notes**: Dan's finding: Only 25% of non-converted leads had contact records. "Most probably the latter [data rarely entered]"

### DATA-2: "Will come to location" drop-offs are significant and untracked
- **Status**: 🔴 Not Started
- **Hypothesis**: A meaningful portion of customers who say they'll come to a location never show up, and reasons are not captured
- **Data needed**: TRANSLOG "Will come to location" records, conversion status
- **Test**: Quantify drop-off rate; interview locations on no-show patterns
- **Result**: _pending_
- **Notes**: Dan found 13 of 61 lost leads (21%) had this status but never converted. No info recorded as to why.

---

## Call Center Operations & Quality

**Data Source**: HRD Call Recording Data (CIDsHRDrecording.xlsx)
**Limitation**: No direct join to HLES conversion data - analysis uses temporal triangulation and aggregate patterns

### CALLOPS-1: HRD agent performance varies significantly and impacts conversion
- **Status**: 🟡 In Progress
- **Hypothesis**: Top-performing agents (high call completion rates) contribute to higher overall conversion rates
- **Data needed**: Call transcript agentId, endReason; HLES conversion rates during periods with different agent mixes
- **Test**: Agent performance distribution; correlation with conversion trends during same time periods
- **Result**: **4.6x variance identified** (top agent: 87% completion rate vs bottom: 19%). Call data shows Nov 1-7, 2025. Need to correlate with HLES conversion rates for same period to validate impact on actual rentals.
- **Notes**: Top 5 agents average 82% call completion; bottom 5 average 30%. Significant training/best practice opportunity.

### CALLOPS-2: Multiple call attempts reduce conversion likelihood
- **Status**: 🔴 Not Started
- **Hypothesis**: Customers receiving 3+ calls become frustrated and are less likely to convert
- **Data needed**: Call transcript toAddr (phone) call counts; HLES conversion rates (if phone linkable)
- **Test**: Conversion rate by call attempt count; qualitative customer satisfaction analysis
- **Result**: _pending_
- **Notes**: **Critical finding**: 93 customers (12.5%) received 2+ calls in one week. One customer received **63 calls**. Potential harassment/compliance issue. Need to validate if multi-call customers have lower conversion rates.

### CALLOPS-3: Call quality patterns vary by time of day and impact conversion
- **Status**: 🟡 In Progress
- **Hypothesis**: Certain hours have systematically lower call completion rates, reducing conversion
- **Data needed**: Call transcript contactStart hour, endReason; HLES contact_range conversion rates
- **Test**: Call completion rate by hour; correlate with HLES conversion by time of contact
- **Result**: **Hour 13 (1pm UTC)**: 54% customer hang-ups (worst). **Hours 12, 21-22**: 73-77% agent completion (best). Need to correlate with HLES conversion data to confirm timing impact.
- **Notes**: Hypothesis for hour 13 drop: shift change, lunch break, or peak customer unavailability. Recommend shifting call volume away from hour 13.

### CALLOPS-4: Low call attempts reduce conversion likelihood
- **Status**: 🔴 Not Started
- **Hypothesis**: Customers receiving 0,1,2 calls are less likely to convert
- **Data needed**: Call transcript toAddr (phone) call counts; HLES conversion rates (if phone linkable)
- **Test**: Conversion rate by call attempt count
- **Result**: _pending_

### CALLOPS-5: Excessive hold times reduce call completion and conversion
- **Status**: 🔴 Not Started
- **Hypothesis**: Calls with holds >2 minutes have lower completion rates and conversion
- **Data needed**: Call transcript holdSeconds, holdCount, endReason; conversion outcomes
- **Test**: Completion rate by hold duration buckets
- **Result**: _pending_
- **Notes**: 18.1% of calls included holds. 4 calls had >5 minute holds (max: 10.3 minutes). Customer-ended calls average 19.7s hold vs agent-ended 12.5s hold - suggests correlation.

### CALLOPS-6: Technical issues (agent phone disconnects) result in lost conversions
- **Status**: 🔴 Not Started
- **Hypothesis**: Calls ending in technical failures have near-zero conversion rates
- **Data needed**: Call transcript endReason = "Agent Phone Disconnected"; follow-up call attempts
- **Test**: Conversion rate for customers experiencing technical issues; check if they receive follow-up calls
- **Result**: _pending_
- **Notes**: **67 calls (6.7%)** ended in technical disconnects. Telephony infrastructure issue. These customers likely lost unless proactive follow-up occurs.

