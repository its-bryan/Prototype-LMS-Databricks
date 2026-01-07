# Outstanding Questions for Hertz

## Digital Self-Service / Interactions

You mentioned digital self-service interactions are in place. Can you translate MSG10 MMR completion? Is it correct to say that if MSG10 = "accepted," then MMR is completed?

## HLES Conversion

Is there a mapping between BODYSHOP and BODYSHOPID? Other tables have BODYSHOPID, but this table only has BODYSHOP.

Is RENT_LOC = the HLE/branch location?

How do I know if the customer filled out the self-service MMR link? Is it when CONTACT_GROUP = "NO CONTACT" (instead of HRD or Counter) or is this data captured in TRANSLOG?

## CRESER

I am looking at the columns "DATE_OUT", "EXP_DATE", and "DATE_BOOKED". Can you please confirm the definition of each of them? As an example, for KNUM: 037-9143094:
   - DATE_OUT = 202411220937
   - EXP_DATE = 202411220937 (exactly the same)
   - DATE_BOOKED = 202411220737 (2 hours earlier)
   - OPEN_DATE = 202411220637 (1 hour earlier)
   - The minutes (:37) are all exactly the same, is this a coincidence?

Is CONFIRMATION the same as CONFIRM_NUM in other tables?

What is SOURCE? (values are 1,2,3)

Why is PICKUPSERVICE all null? Is it because at this point there is no visibility of whether the customer needs pick up or not?

## CPLIT

PERCENTPAY: if it's 100%, what does that mean? Insurance pays 100% of the bill?

AMTPERDAYAUTH: Is this the amount per day authorised by the Insurance?

MAXPAY: Is this the maximum the customer is going to pay for the rental? How is this different from MAXCUSTPAY and RENTEROWES? One entry's MAXCUSTPAY is 19.99 and RENTEROWES is 138.18 (KNUM: H41219264). Is MAXCUSTPAY = daily figure, RENTEROWES = total amount renter/customer has to pay for the rental duration?

What is INVOICE? Is it an amount? Or is that an Invoice ID?

REPAIRLOC: Is this the same as BODYSHOP in HLES Conversion Data?

## CRA

Is CONFIRMATION the same as CONFIRM_NUM in other tables?

Is my understanding correct for:
   - DATE_OUT = when the car is taken off by the customer
   - EXP_DATE = (I'm unsure of what this is - expiry?)
   - DATE_IN = When the car is returned

What is DBR_DATE?

## TRANSLOG

What are the different EventType (1,2,3,4,etc.) and BGN01 (42) values mean?

What is EXT? Value is either null or "InsCall"

Is MMR activity recorded here? e.g. open rate, click through rate, completion rate

## HLES NOI.docx

"Most customers either drop their car or go to a body shop". Can I confirm:
   - "Drop their car" = drop their car at Hertz, so they can pick up a rental car right away, and Hertz will pass on their owned car to be repaired at a body shop partner
   - What variable(s) in the tables show whether the customer dropped their car, get picked up, or went to a bodyshop?

The document seems unfinished, is this the latest version or is there an amended/completed version?

Can I confirm that the format/columns of these data tables won't change in the Jan 5 version?

## HRD Call Recording Data (CIDsHRDrecording.xlsx)

**Context**: Received 1,000 call records (Nov 1-7, 2025). Analysis revealed critical data gaps.

### Data Quality & Completeness

**Why are disposition codes not populated in OutboundHRD sheet?**
   - **OutboundHRD sheet**: `primaryDispositionId`, `secondaryDispositionId`, `dispositionNotes` are all 100% null (1,000/1,000 records)
   - **InboundHRD sheet**: `dispositionNotes` has 94.4% populated (944/1,000 records), but `primaryDispositionId` and `secondaryDispositionId` are still 100% null
   - Why is OutboundHRD dispositionNotes completely empty while InboundHRD has data?
   - Are outbound agents not using the disposition system?
   - Is this a data export configuration issue?
   - What disposition codes are available in the system? (e.g., "Rental Confirmed", "Customer Declined", "No Answer", "Will Call Back")

**How are call transfers tracked?**
   - **OutboundHRD Sheet** `transferIndicatorId = 0` for all 1,000 calls (no transfers recorded)
   - **InboundHRD Sheet** `transferIndicatorId = 1` for 84 of the calls (minority)
   - Hypothesis H14 suggests transfers from HRD to local branches are common
   - Are transfers happening but not logged in this dataset?
   - Is transfer data in a different table/system?

**Is customer phone number available in HLES data?**
   - Call data has `toAddr` (customer phone number)
   - If HLES tables have phone numbers, we could link calls to conversions indirectly
   - Which HLES table(s) contain customer phone numbers?

### InboundHRD dispositionNotes Standardization

**Context**: InboundHRD sheet has `dispositionNotes` populated (944/1,000 records, 97 unique values), but data quality analysis reveals significant inconsistencies due to free-text entry.

**Data Quality Issues Found**:
- Case inconsistencies: 'cx' vs 'CX' vs 'Cx' (reduced from 113 to 97 unique values after normalization)
- Multiple abbreviations for same concept: 'cx' (389), 'cust' (61), 'cst' (51) all appear to mean "customer"
- Typos: 'beilling' (billing), 'adju' (adj), 'sgent' (agent)
- Inconsistent formatting: 'cxloc' vs 'cx loc' vs 'cxloc AZGIL06'

**Distribution Summary**:
- Customer-related: 58.3% (cx, cust, cst variations)
- Adjuster-related: 22.1% (adj variations)
- Location/Store: 4.5% (cxloc, cx loc)
- Agent/Rep: 3.1%
- SPOC: 1.5%
- Other: Escalation, billing, uber, roadside, etc.

**Questions**:

**What are the official disposition note codes/values that InboundHRD agents should use?**
   - Is there a standardized list agents should select from, or is this meant to be free-text?
   - Recommend implementing dropdown with predefined categories for better data quality

**What do the following abbreviations officially mean?**
   - **CX** (389 occurrences) - Customer? Customer experience?
   - **CST** (51 occurrences) - Customer? Different from cx?
   - **CUST** (61 occurrences) - Customer? Why 3 different abbreviations?
   - **ADJ** (210 occurrences) - Adjuster?
   - **CXLOC** (26 occurrences) - Customer calling location?
   - **SPOC** (15 occurrences) - Single Point of Contact?
   - **REP** (12 occurrences) - Representative? Different from agent?
   - **AGENT** (18 occurrences) - Agent-to-agent calls? Or calls about agents?
   - **ESCALATION** (9 occurrences) - What triggers escalation classification?

**What does 'rep' vs 'agent' indicate?**
   - Are these agent-to-agent calls, or calls about agent/representative information?
   - Is there a meaningful distinction between the two, or should they be consolidated?

### Call Attempt Policies

**What is the policy on maximum call attempts per customer?**
   - Data shows 93 customers (12.5%) received 2+ calls in one week
   - **One customer received 63 calls in 7 days** (phone: 8447051298)
   - Is this intentional? Data error? Compliance concern?
   - What are the guardrails to prevent customer harassment?

### Agent Performance & Training

**What happens during hour 13 (1pm UTC) that causes performance drop?**
    - Hour 13 shows 54% customer hang-ups (worst performance)
    - Hours 12, 21-22 show 73-77% agent completion (best performance)
    - Is hour 13 a shift change? Lunch break? Staff shortage?
    - Can call volume be shifted away from hour 13?

### Technical Infrastructure

**What causes the 6.7% agent phone disconnect rate?**
    - 67 of 1,000 calls (6.7%) ended due to "Agent Phone Disconnected"
    - Suggests telephony infrastructure or reliability issues
    - Is this a known problem?
    - Are there system logs we can review?
    - What redundancy/failover mechanisms exist?

### Data Requests

**Are there call center KPI dashboards or SOPs we can review?**
    - Call attempt limits/routing rules
    - Hold time targets
    - Transfer procedures
    - Agent performance metrics tracked
    - Quality assurance criteria

## Other Data Sources

Is CPAY data still helpful to have a look at?

Is there any way we can see MMR tracking data?

Is there any SOP documents re. customer contact queue? e.g. alerts/routing logic/KPIs tracked - **See question in HRD Data Requests section above**

## Others

With Statefarm where Hertz is a "co-primary" partner, do we know if they also send the same lead to let's say Enterprise, and we basically have to 'fight' for the lead? Or is there a priority order (e.g. Hertz has the lead for the first X days)?

Do the Adjusters check in at all during the process? At what point do they / can they take the lead away to put to their other car rental partners/contacts?

Do you have any material on the MMR flow? Curious to see the UX/UI on this.

Would it be possible to speak to someone at Hertz that manages bodyshop relationships, or any bodyshop contacts? (to understand bodyshop interference better - re. Vikram's email)
