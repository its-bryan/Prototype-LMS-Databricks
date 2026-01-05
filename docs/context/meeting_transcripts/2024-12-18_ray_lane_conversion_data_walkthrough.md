# Meeting: Conversion Metrics and Data Access Planning

**Date**: December 18, 2024
**Attendees**: Dan (Consultant), Rai (Hertz), Lane (Hertz)
**Topic**: Initial data walkthrough and conversion metrics discussion

---

## Summary

Rai and Lane walked through the HLES conversion data structure, explaining key fields, data sources, and known limitations. They committed to providing sample data files and documentation incrementally.

---

## Key Takeaways

### Conversion Definition

1. **KNUM Behavior**: The KNUM starts as a reservation number and shifts to a rental agreement number upon conversion. Numbers starting with "H" indicate completed rentals.

2. **Composite Key**: Use `confirmation_number + initial_date` as the unique identifier. Confirmation numbers may be recycled every ~6 months by Hertz.

3. **Conversion Window**: 90 days from initial_date (when Hertz learned of the reservation from insurance partner). This is a system limitation, though most conversions happen within the first week.

4. **Conversion Formula**: `conversion_rate = rental / res_id`

### HLES System Overview

> **Lane**: "HLES is the system we use for insurance replacement rentals. It's gonna have everything from when you receive the reservation to when they pay. That's your end-to-end."

**Related Systems**:
- **HiRes**: Reservation source system (third-party partnership limits data access)
- **HIRMs**: Communication hub for body shops, customers, rental company, and insurers
- **MMR**: Text/mobile self-service conversion system

### Table Descriptions

| Table | Purpose |
|-------|---------|
| CRESER | Stores incoming reservations |
| CRA001 | Contract details, intermediate step before CSPLIT |
| CSPLIT | Split billing + comprehensive rental information (main operational table) |
| TRANSLOG | Transaction log with customer contact records |

> **Lane**: "There's a lot of scattered information. Old knowledge left with previous departures. I kept hearing conflicting views about what the tables represented."

### Contact Tracking

- **Counter**: Local branch/location
- **HRD**: Centralized contact center
- **Contact Range**: Time from initial_date to first phone contact (excludes automated text)
- **No Contact**: Customer never reached by phone (may still convert via walk-up)

> **Ray**: "They try to make a point to call every customer. The text happens almost simultaneously [with receiving the reservation]—it's automated."

### Data Quality Concerns

1. **Stitching Challenge**: Linking data across tables and customer journey paths is difficult
2. **Merge Reservations**: ~0.1% of records are merges from duplicates (created when updating reservations rather than modifying originals)
3. **Cancel Reasons**: Manually entered, may be incomplete
4. **Time Zone**: `initial_date` is in the local time zone of the rental location

> **Ray**: "Where we've struggled quite a bit is the stitching together of different swim lanes people can go down. The disparate availability of the data, and the consistency of which we can stitch it back to a confirmation number across time."

### Seasonality Consideration

> **Ray**: "Our ability to convert is dependent on ebbing and flowing of the denominator of reservation volume. If there's only finite fleet or staff, and reservation numbers go above what we can absorb, conversion would come down."

Example: Hurricanes or floods create claim surges that may temporarily reduce conversion rates.

---

## Conversion Data Fields Discussed

| Field | Description | Notes |
|-------|-------------|-------|
| confirmation_number | ID from insurance partner | Static, but recycled ~6 months |
| initial_date | When Hertz learned of reservation | Local timezone |
| knum | Reservation/agreement number | H-prefix = converted |
| res_id | Reservation indicator | Always 1 |
| rental | Converted indicator | 1 if rented |
| cancel | Cancellation indicator | 1 if cancelled |
| unused | Unused indicator | 1 if neither rented nor cancelled |
| cdp_name | Partnership program name | e.g., insurance company |
| code | Rental type/source code | Filters IR vs non-IR |
| contact_range | Time bucket to first contact | e.g., "< 30 min", "1-3 hours" |
| hours_difference | Minutes to first contact | Source for contact_range |
| checkout_date | Vehicle pickup date | |
| cancel_reason | Reason for cancellation | Manual entry |

---

## Action Items

1. **Hertz to provide**:
   - Sample data files (~1,000 rows each) for CRESER, CSPLIT, CRA001, TRANSLOG
   - Conversion data export from WebFocus
   - Data flow documentation
   - Contact center flowchart (from Cheryl/Nasira)
   - Contact list: data owners, customer care, field leadership

2. **Consultant to provide**:
   - Column legend/data dictionary feedback
   - Questions and follow-ups on data structure

3. **Scheduling**:
   - Block January meetings (Wednesday PM + Thursday full day)
   - Use Microsoft Teams for calls

---

## Key Contacts Mentioned

- **Nick Capalucci**: Data/business contact
- **Cheryl**: Customer care side (has contact center flowchart)
- **Nasira**: Works for Cheryl
- **Vikram**: Leading pilot location selection (DC/Virginia area identified)

---

## Quotes of Note

On conversion accuracy:
> **Lane**: "The accuracy of the conversion rate is a little shaky. It's not 100% guaranteed to be as accurate as feasibly possible."

On the 90-day window:
> **Ray**: "As a business, whenever we wanna make changes, we're not gonna wait ninety full days. Statistical significance is probably achieved within a week."

On data complexity:
> **Ray**: "We believe the conversion data itself is fairly sound. It's the in-between that we don't really know."

Agreed approach:
> **Dan**: "If we can't stitch all of them into one full picture, that's okay. The minimum join we need is to attach 'did this convert or not' to each table. That way we can see trends within each table itself."
