# Outstanding Questions for Hertz

## Digital Self-Service / Interactions

1. You mentioned digital self-service interactions are in place. Can you translate MSG10 MMR completion? Is it correct to say that if MSG10 = "accepted," then MMR is completed?

## HLES Conversion

1. Is there a mapping between BODYSHOP and BODYSHOPID? Other tables have BODYSHOPID, but this table only has BODYSHOP.

2. Is RENT_LOC = the HLE/branch location?

3. How do I know if the customer filled out the self-service MMR link? Is it when CONTACT_GROUP = "NO CONTACT" (instead of HRD or Counter) or is this data captured in TRANSLOG?

## CRESER

1. I am looking at the columns "DATE_OUT", "EXP_DATE", and "DATE_BOOKED". Can you please confirm the definition of each of them? As an example, for KNUM: 037-9143094:
   - DATE_OUT = 202411220937
   - EXP_DATE = 202411220937 (exactly the same)
   - DATE_BOOKED = 202411220737 (2 hours earlier)
   - OPEN_DATE = 202411220637 (1 hour earlier)
   - The minutes (:37) are all exactly the same, is this a coincidence?

2. Is CONFIRMATION the same as CONFIRM_NUM in other tables?

3. What is SOURCE? (values are 1,2,3)

4. Why is PICKUPSERVICE all null? Is it because at this point there is no visibility of whether the customer needs pick up or not?

## CPLIT

1. PERCENTPAY: if it's 100%, what does that mean? Insurance pays 100% of the bill?

2. AMTPERDAYAUTH: Is this the amount per day authorised by the Insurance?

3. MAXPAY: Is this the maximum the customer is going to pay for the rental? How is this different from MAXCUSTPAY and RENTEROWES? One entry's MAXCUSTPAY is 19.99 and RENTEROWES is 138.18 (KNUM: H41219264). Is MAXCUSTPAY = daily figure, RENTEROWES = total amount renter/customer has to pay for the rental duration?

4. What is INVOICE? Is it an amount? Or is that an Invoice ID?

5. REPAIRLOC: Is this the same as BODYSHOP in HLES Conversion Data?

## CRA

1. Is CONFIRMATION the same as CONFIRM_NUM in other tables?

2. Is my understanding correct for:
   - DATE_OUT = when the car is taken off by the customer
   - EXP_DATE = (I'm unsure of what this is - expiry?)
   - DATE_IN = When the car is returned

3. What is DBR_DATE?

## TRANSLOG

1. What are the different EventType (1,2,3,4,etc.) and BGN01 (42) values mean?

2. What is EXT? Value is either null or "InsCall"

3. Is MMR activity recorded here? e.g. open rate, click through rate, completion rate

## HLES NOI.docx

1. "Most customers either drop their car or go to a body shop". Can I confirm:
   - "Drop their car" = drop their car at Hertz, so they can pick up a rental car right away, and Hertz will pass on their owned car to be repaired at a body shop partner
   - What variable(s) in the tables show whether the customer dropped their car, get picked up, or went to a bodyshop?

2. The document seems unfinished, is this the latest version or is there an amended/completed version?

3. Can I confirm that the format/columns of these data tables won't change in the Jan 5 version?

## Other Data Sources

1. Is CPAY data still helpful to have a look at?

2. Is there any way we can see MMR tracking data?

3. Do you have any preliminary transcript/voice recording data you could share? A sample of 5-10 could be sufficient (HRD)

4. Is there any SOP documents re. customer contact queue? e.g. alerts/routing logic/KPIs tracked

## Others

1. With Statefarm where Hertz is a "co-primary" partner, do we know if they also send the same lead to let's say Enterprise, and we basically have to 'fight' for the lead? Or is there a priority order (e.g. Hertz has the lead for the first X days)?

2. Do the Adjusters check in at all during the process? At what point do they / can they take the lead away to put to their other car rental partners/contacts?

3. Do you have any material on the MMR flow? Curious to see the UX/UI on this.

4. Would it be possible to speak to someone at Hertz that manages bodyshop relationships, or any bodyshop contacts? (to understand bodyshop interference better - re. Vikram's email)
