# Hertz HLES Data Sample Documentation

## Overview

This document describes the sample data files received from Hertz on December 2024. Each file contains 1,000 sample records from the HLES (Hertz Liability and Equipment System) used for insurance replacement rentals.

## Data Files

### 1. HLES Conversion Data 2025.06.09 – 1000 Records.xlsx

**Description**: Pre-processed conversion metrics data generated from WebFocus (mainframe reporting system).

**Key Fields**:
| Field | Description |
|-------|-------------|
| `confirmation_number` | Identifier from insurance partner (e.g., State Farm). Static across the reservation lifecycle. |
| `initial_date` | Timestamp when Hertz received the reservation from the insurance partner. Time zone is local to rental location. |
| `knum` | Reservation/agreement number. Starts with non-H prefix for reservations, shifts to H-prefix when converted to rental. |
| `res_id` | Indicator (1) that a reservation exists. All records should have this = 1. |
| `rental` | Indicator (1) if the reservation converted to an actual rental. |
| `cancel` | Indicator (1) if the reservation was cancelled. |
| `unused` | Indicator (1) if the reservation was neither rented nor cancelled. |
| `cdp_name` | Partnership/program name (e.g., insurance company partner). |
| `code` | Insurance company/rental type code. Used to filter insurance replacement vs. other rental types. |
| `contact_range` | Time bucket from initial_date to first contact (e.g., "< 30 min", "1-3 hours", "40+ hours"). |
| `no_contact` | Indicates customer was never successfully contacted by phone. |
| `counter` | Branch/location that handled the rental. |
| `hrd` | Centralized contact center indicator. |
| `hours_difference` | Minutes from confirmation to first contact (source field for contact_range). |
| `checkout_date` | Date/time when customer picked up the vehicle. |
| `cancel_reason` | Manually entered reason for cancellation (if applicable). |
| `merge_reservation` | Indicates reservation was merged with a duplicate (~0.1% of records). |

**Conversion Logic**:
- Conversion = `rental` / `res_id` (within 90-day window from initial_date)
- KNUM prefix determines conversion: H-prefix = converted, non-H = not converted

### 2. CRESER 1000 Records.xlsx

**Description**: Reservation storage table. Contains incoming reservations when first received from insurance partners.

**Purpose**: Primary table for tracking initial reservation data as it enters HLES.

### 3. CRA001 1000 Records.xlsx

**Description**: Contract detail table. Contains reservation information and serves as an intermediate step before CSPLIT.

**Purpose**: Stores contract-level details bridging reservations to split billing records.

### 4. CSPLIT 1000 Records.xlsx

**Description**: Split billing table. Despite the name, contains extensive rental information beyond just billing splits.

**Purpose**: One of the main operational tables with comprehensive rental details.

### 5. TRANSLOG 1000 Records.xlsx

**Description**: Transaction log tracking all interactions and events related to a rental.

**Purpose**: Audit trail of customer contacts, status changes, and transaction events.

**Join Key**: Can be joined to other tables via `confirmation_number`.

## Key Identifiers

| Identifier | Behavior | Use Case |
|------------|----------|----------|
| `confirmation_number` | Static throughout lifecycle | Primary key when combined with `initial_date` |
| `knum` | Changes upon conversion | Determines conversion status (H-prefix = rented) |
| `initial_date` | Static | Part of composite key; local timezone |

**Note**: Confirmation numbers may be recycled by Hertz approximately every 6 months. Use `confirmation_number + initial_date` as a composite key to ensure uniqueness.

## Data Quality Notes

1. **Conversion accuracy**: The team notes conversion calculations may have some variance depending on methodology used.
2. **Table relationships**: Stitching data across tables can be challenging due to disparate data availability and multiple customer journey paths.
3. **Merge reservations**: ~0.1% of reservations are merges from duplicates (sometimes created when updating reservations).
4. **Manual fields**: `cancel_reason` is manually entered and may be incomplete.

## Contact Channels

| Channel | Description |
|---------|-------------|
| Counter | Local branch/location handling |
| HRD | Centralized contact center |
| MMR | Mobile/text-based self-service conversion |

## Related Systems

- **HLES**: Primary system for insurance replacement rentals (end-to-end from reservation to payment)
- **HiRes**: Reservation system (data access limited due to third-party partnership)
- **HIRMs**: Management system for body shop, customer, rental company, and insurer communication
- **WebFocus**: Mainframe reporting system that generates conversion reports

## Conversion Window

- **Standard window**: 90 days from `initial_date`
- **Note**: Most conversions occur within the first few days to one week. 90-day window accounts for capacity constraints during high-volume periods (hurricanes, floods, etc.).
