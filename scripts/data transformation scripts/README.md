# Data Transformation Scripts

Scripts to transform raw Hertz HLES data into clean, analysis-ready CSV files.

## Quick Start

### Run All Transformations
```bash
# From project root:
python "scripts/data transformation scripts/run_all_transformations.py"

# With custom input directory (for production data):
python "scripts/data transformation scripts/run_all_transformations.py" /path/to/new/data
```

### Run Individual Transformations
```bash
# CSPLIT transformation
python "scripts/data transformation scripts/transform_csplit.py" input.xlsx output.csv

# CRA001 transformation
python "scripts/data transformation scripts/transform_cra001.py" input.xlsx output.csv

# HLES Conversion transformation
python "scripts/data transformation scripts/transform_hles_conversion.py" input.xlsx output.csv

# TRANSLOG transformation
python "scripts/data transformation scripts/transform_translog.py" input.xlsx output.csv
```

## Scripts

| Script | Purpose | Input | Output |
|--------|---------|-------|--------|
| `run_all_transformations.py` | Master script - runs all transformations | `data/raw/` | `data/processed/` |
| `transform_csplit.py` | Transform CSPLIT data | CPLIT*.xlsx | csplit_processed.csv |
| `transform_cra001.py` | Transform CRA001 data | CRA001*.xlsx | cra001_processed.csv |
| `transform_hles_conversion.py` | Transform HLES Conversion data | HLES*Conversion*.xlsx | hles_conversion_processed.csv |
| `transform_translog.py` | Transform TRANSLOG data | TRANSLOG*.xlsx | translog_processed.csv |

## Transformations Applied

### CSPLIT (234 → 133 columns)
- **Removes 101 columns**: 50 fully null + 51 single-value columns
- **Standardizes column names**: lowercase, underscores
- **Strips whitespace** from string values
- **Removes duplicate rows**

### CRA001 (139 → 72 columns)
- **Removes 67 columns**: 25 fully null + 42 constant columns
- **Standardizes column names**: lowercase, underscores
- **Strips whitespace** from string values
- **Removes duplicate rows**

### HLES Conversion (32 → 32 columns: 2 removed, 2 added)
- **Removes 2 columns**: res_id (always 1), adj_lname (always blank)
- **Standardizes column names**: removes leading newlines, converts to snake_case
- **Converts whitespace** placeholders to NULL (~2,347 values)
- **Converts date_out1** from string to datetime
- **Adds derived columns**:
  - `was_contacted`: 1 if contacted, 0 if "NO CONTACT"
  - `contact_time_category`: cleaned contact_range with standardized NO_CONTACT

### TRANSLOG (41 → 21 columns)
- **Removes 20 columns**:
  - 3 fully null columns (INVOICE, FILE, _rescued_data)
  - 7 constant/single-value columns (CSPLIT_REC, TSD_NUM, SourceFilename, LoadDate, LoadDateTime, SourceSystem, SourceRegion)
  - 10 near-null columns (>85% null: MSG3, MSG7, MSG8, MSG9, OFOUR_FROM, OFOUR_TO, CONFIRM_NUM, FIELD_CHANGED, EMP_FNAME, EMP_LNAME)
- **Renames columns** to descriptive snake_case names (e.g., Knum → contract_key, BGN01 → transaction_code)
- **Parses datetimes** from YYYYMMDDHHMMSS integer format
- **Converts placeholders** to NULL ('0' in reservation_number, whitespace in adjuster_name)
- **Strips whitespace** from string values
- **Removes duplicate rows**

## Expected File Naming

The scripts automatically detect input files based on patterns:

| Table | Expected Patterns |
|-------|-------------------|
| CSPLIT | `CPLIT*.xlsx`, `CSPLIT*.xlsx` |
| CRA001 | `CRA001*.xlsx` |
| HLES Conversion | `HLES*Conversion*.xlsx`, `HLES_Conversion*.xlsx` |
| TRANSLOG | `TRANSLOG*.xlsx`, `translog*.xlsx` |

## For Production Data (100k+ rows)

When you receive the full production data:

1. Place the new Excel files in `data/raw/`
2. Run the master script:
   ```bash
   python "scripts/data transformation scripts/run_all_transformations.py"
   ```
3. Processed files will be in `data/processed/`

The scripts are designed to handle large files efficiently using pandas chunking if needed.

## Column Removal Lists

The columns removed are hardcoded based on profiling analysis of the sample data. See each script for the complete list:

- `transform_csplit.py`: `COLUMNS_TO_REMOVE` list (101 columns)
- `transform_cra001.py`: `FULLY_NULL_COLUMNS` and `CONSTANT_COLUMNS` lists (67 columns)
- `transform_hles_conversion.py`: Removes `res_id` and `adj_lname` (known single-value columns)
- `transform_translog.py`: `FULLY_NULL_COLUMNS`, `CONSTANT_COLUMNS`, and `NEAR_NULL_COLUMNS` lists (20 columns)

## Dependencies

- Python 3.8+
- pandas
- openpyxl (for Excel reading)
- numpy

Install with:
```bash
pip install pandas openpyxl numpy
```
