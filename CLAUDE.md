# Hertz Insurance Replacement Lead Conversion Analysis

## Project Overview
This project analyzes Hertz's insurance replacement business to **improve lead-to-rental conversion rates**.

## Data Domain

### HLES System Tables
- **CRESER** - Incoming reservations from insurance partners (1 sheet)
- **CRA001** - Contract details, intermediate step before CSPLIT
- **CSPLIT** - Split billing + comprehensive rental info (main operational table)
- **TRANSLOG** - Transaction log with customer contact records
- **HLES Conversion** - Aggregated conversion metrics from WebFocus

### HRD Call Center Data
- **CIDsHRDrecording** - 2 sheets: 'OutboundHRD' and 'InboundHRD'. Analyse both.

### Conversion Outcome Variable (PRIMARY TARGET)
- **Variable**: `RENT_IND` (raw: `\nRENT_IND` due to Excel formatting)
- **Definition**: `1` = converted, `0` = not converted
- **Formula**: `Conversion Rate = sum(RENT_IND) / sum(RES_ID) × 100%`
- **Baseline**: Current conversion ~67-70%, target 80%+

## Notes
- Use `engine='openpyxl'` when reading .xlsx files
