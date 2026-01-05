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

### H1: Faster initial contact improves conversion
- **Status**: 🔴 Not Started
- **Hypothesis**: Leads contacted within 30 minutes convert at significantly higher rates than those contacted later
- **Data needed**: contact_range, hours_difference, rental (HLES Conversion)
- **Test**: Chi-square / logistic regression on contact_range vs conversion
- **Result**: _pending_
- **Notes**: Ray mentioned "most conversions happen within the first week"

### H2: No-contact leads have lower conversion
- **Status**: 🔴 Not Started
- **Hypothesis**: Leads with CONTACT_GROUP = "NO CONTACT" convert at lower rates (excluding MMR self-service)
- **Data needed**: CONTACT_GROUP, rental, MSG10 (for MMR completion)
- **Test**: Compare conversion rates by contact group
- **Result**: _pending_

---

## Customer Journey & Channel

### H3: MMR self-service completion improves conversion
- **Status**: 🔴 Not Started
- **Hypothesis**: Customers who complete MMR digital flow convert at higher rates
- **Data needed**: MSG10 status, rental
- **Test**: Conversion rate comparison with/without MMR completion
- **Result**: _pending_

### H4: Counter vs HRD contact effectiveness differs
- **Status**: 🔴 Not Started
- **Hypothesis**: Local branch (Counter) contact converts better than centralized (HRD) contact
- **Data needed**: Contact source, rental
- **Test**: Conversion rate by contact source
- **Result**: _pending_

---

## Location & Capacity

### H5: Conversion varies significantly by location
- **Status**: 🔴 Not Started
- **Hypothesis**: Some locations consistently outperform/underperform, indicating operational differences
- **Data needed**: RENT_LOC, rental
- **Test**: ANOVA / chi-square across locations, identify outliers
- **Result**: _pending_

### H6: High reservation volume periods reduce conversion
- **Status**: 🔴 Not Started
- **Hypothesis**: Conversion drops when reservation volume exceeds capacity (fleet/staff constraints)
- **Data needed**: Daily reservation counts, conversion rates over time
- **Test**: Correlation between volume and conversion rate
- **Result**: _pending_
- **Notes**: Ray mentioned hurricanes/floods as examples of surge impact

---

## Insurance Partner & Lead Source

### H7: Conversion rates vary by insurance partner (CDP)
- **Status**: 🔴 Not Started
- **Hypothesis**: Some insurance partners send higher-quality leads or have better process integration
- **Data needed**: cdp_name, rental
- **Test**: Conversion rate comparison across CDP partners
- **Result**: _pending_

### H8: Co-primary partnerships (e.g., StateFarm) have lower conversion
- **Status**: 🔴 Not Started
- **Hypothesis**: Leads shared with competitors convert worse than exclusive leads
- **Data needed**: CDP classification, rental
- **Test**: Compare exclusive vs shared lead conversion
- **Result**: _pending_
- **Notes**: Need to clarify if StateFarm leads are sent simultaneously to Enterprise

---

## Cancellation Patterns

### H9: Specific cancel reasons are addressable
- **Status**: 🔴 Not Started
- **Hypothesis**: Certain cancel_reason categories represent preventable losses
- **Data needed**: cancel_reason, frequency counts
- **Test**: Pareto analysis of cancellation reasons
- **Result**: _pending_
- **Notes**: Cancel reasons are manually entered, may be incomplete

---

## Body Shop & Pickup

### H10: Body shop relationship affects conversion
- **Status**: 🔴 Not Started
- **Hypothesis**: Leads from certain body shops convert better (possible interference from competitors)
- **Data needed**: BODYSHOP/BODYSHOPID, rental
- **Test**: Conversion rate by body shop
- **Result**: _pending_
- **Notes**: Vikram: Even when customer has set up with Hertz, body shops may actively steer them to competitors (e.g., recommending Enterprise). This is core to Enterprise's strategy.

### H11: Pickup service availability affects conversion
- **Status**: 🔴 Not Started
- **Hypothesis**: Customers needing pickup who don't receive it are less likely to convert
- **Data needed**: PICKUPSERVICE, rental
- **Test**: Conversion comparison by pickup service status
- **Result**: _pending_
- **Notes**: PICKUPSERVICE column currently all null in CRESER - may need different data source. Vikram: Execution is inconsistent. Poor reliability or limited scheduling flexibility could be meaningful drag on conversion—customers may give up.

---

## Timing & Seasonality

### H12: Day of week affects conversion
- **Status**: 🔴 Not Started
- **Hypothesis**: Leads received on certain days convert better (staffing/response time differences)
- **Data needed**: initial_date (extract day of week), rental
- **Test**: Chi-square on day-of-week vs conversion
- **Result**: _pending_

### H13: Time of day affects conversion
- **Status**: 🔴 Not Started
- **Hypothesis**: Leads received during business hours convert better
- **Data needed**: initial_date (extract hour), rental
- **Test**: Conversion rate by hour bucket
- **Result**: _pending_

---

## Call Center & Transfer Failures

### H14: Call center to location transfers fail frequently
- **Status**: 🔴 Not Started
- **Hypothesis**: Customers transferred from HRD to local locations often don't complete the transfer or convert
- **Data needed**: TRANSLOG transfer records, location answer rates
- **Test**: Conversion rate for transferred vs non-transferred customers
- **Result**: _pending_
- **Notes**: Vikram suspects locations often don't answer phones. Dan found 13 of 61 lost leads had "Will come to location" but never converted.

### H15: Outbound calls flagged as spam reduce contact rate
- **Status**: 🔴 Not Started
- **Hypothesis**: Hertz outbound calls are being labeled as spam, reducing successful contact rates
- **Data needed**: Call attempt records, contact success rates (may need call system data)
- **Test**: Interview call center team; compare answer rates to industry benchmarks
- **Result**: _pending_
- **Notes**: Vikram flagged this as potential leakage point. Requires interview with call center team.

### H16: Location phone answer rate varies and impacts conversion
- **Status**: 🔴 Not Started
- **Hypothesis**: Locations with poor phone answer rates have lower conversion
- **Data needed**: Location-level answer rate metrics (if available), conversion by location
- **Test**: Correlation between location answer rates and conversion rates
- **Result**: _pending_
- **Notes**: Vikram: "I know that locations often (how often?) don't answer the phone"

---

## Digital Flow & Self-Selection

### H17: High digital conversion is self-selection bias
- **Status**: 🔴 Not Started
- **Hypothesis**: The ~80% conversion rate for digital flow completers reflects higher-intent customers, not the digital experience itself
- **Data needed**: Digital funnel: text sent → started → completed → converted
- **Test**: Compare conversion intent signals (e.g., time to action) between digital and non-digital paths. If start rate and completion rate are low, suggests self-selection.
- **Result**: _pending_
- **Notes**: Counter-hypothesis to H3. Vikram: Recently removed credit card requirement to test impact. Key questions: (1) what % started digital flow, (2) what % completed it.

---

## Data Quality & Recording

### H18: Contact attempt data is under-recorded
- **Status**: 🔴 Not Started
- **Hypothesis**: TRANSLOG contact records are incomplete, masking actual contact attempts
- **Data needed**: TRANSLOG completeness audit, interview with call center on recording practices
- **Test**: Compare TRANSLOG records against call system logs (if available)
- **Result**: _pending_
- **Notes**: Dan's finding: Only 25% of non-converted leads had contact records. "Most probably the latter [data rarely entered]"

### H19: "Will come to location" drop-offs are significant and untracked
- **Status**: 🔴 Not Started
- **Hypothesis**: A meaningful portion of customers who say they'll come to a location never show up, and reasons are not captured
- **Data needed**: TRANSLOG "Will come to location" records, conversion status
- **Test**: Quantify drop-off rate; interview locations on no-show patterns
- **Result**: _pending_
- **Notes**: Dan found 13 of 61 lost leads (21%) had this status but never converted. No info recorded as to why.
