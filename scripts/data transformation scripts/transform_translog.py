#!/usr/bin/env python3
"""
TRANSLOG Data Transformation Script

Applies standardized transformations to TRANSLOG transaction log data based on profiling analysis.
Designed to work with both sample (1000 rows) and full production data (100k+ rows).

Usage:
    python "scripts/data transformation scripts/transform_translog.py" [input_file] [output_file]

    If no arguments provided, uses default paths.

Transformations Applied:
    1. Remove 20 columns identified as fully null, constant, or near-null (>85% null)
    2. Rename columns to descriptive snake_case names
    3. Parse datetime fields from YYYYMMDDHHMMSS integer format
    4. Convert placeholder values ('0' in reservation_number) to null
    5. Strip whitespace from string columns
    6. Remove duplicate rows
"""

import pandas as pd
import numpy as np
import os
import sys
import re
from datetime import datetime

# Default paths
DEFAULT_INPUT = '/Users/dansia/Documents/HertzDataAnalysis/data/raw/TRANSLOG 1000 Records .xlsx'
DEFAULT_OUTPUT = '/Users/dansia/Documents/HertzDataAnalysis/data/processed/translog_processed.csv'

# Columns to REMOVE - Fully NULL (3 columns)
FULLY_NULL_COLUMNS = [
    'INVOICE',
    'FILE',
    '_rescued_data'
]

# Columns to REMOVE - Single/Constant value (7 columns)
CONSTANT_COLUMNS = [
    'CSPLIT_REC',      # Always 0
    'TSD_NUM',         # Always 0
    'SourceFilename',  # Data lineage only
    'LoadDate',        # Single date value
    'LoadDateTime',    # Single datetime value
    'SourceSystem',    # Always 'HLES'
    'SourceRegion'     # Always 'USA'
]

# Columns to REMOVE - Near-null (>85% null, sparse data)
NEAR_NULL_COLUMNS = [
    'MSG3',           # 95.6% null, sparse pickup method info
    'MSG7',           # 97.4% null, redacted customer names
    'MSG8',           # 97.4% null, sparse card info
    'MSG9',           # 97.3% null, sparse transaction codes
    'OFOUR_FROM',     # 98.5% null, sparse date values
    'OFOUR_TO',       # 98.4% null, sparse date values
    'CONFIRM_NUM',    # 98.9% null, sparse confirmation numbers
    'FIELD_CHANGED',  # 99.9% null
    'EMP_FNAME',      # 88.1% null, single value EDI when present
    'EMP_LNAME'       # 87.0% null, mostly EDI marker
]

# Combined list for removal
COLUMNS_TO_REMOVE = FULLY_NULL_COLUMNS + CONSTANT_COLUMNS + NEAR_NULL_COLUMNS

# Column rename mapping (original -> new descriptive name)
COLUMN_RENAMES = {
    'ID': 'transaction_id',
    'Knum': 'contract_key',
    'LocCode': 'location_code',
    'SystemDate': 'system_datetime_raw',
    'ApplicationDate': 'application_datetime_raw',
    'EventType': 'event_type',
    'BGN01': 'transaction_code',
    'SF_TRANS': 'source_transaction_id',
    'STAT_FLAG': 'status_flag',
    'EXT': 'extension_flag',
    'MSG1': 'message_primary',
    'MSG2': 'message_secondary',
    'MSG4': 'message_approval_status',
    'MSG5': 'source_application',
    'MSG6': 'adjuster_name',
    'MSG10': 'message_details',
    'REQUESTED_DAYS': 'requested_days',
    'TIMEZONE': 'timezone_offset',
    'EMP_CODE': 'employee_code',
    'REZ_NUM': 'reservation_number',
    'csplitid': 'csplit_id'
}


def clean_column_name(name):
    """Standardize column name to lowercase with underscores."""
    cleaned = str(name).strip().replace('\n', '_').replace('\r', '')
    cleaned = cleaned.replace(' ', '_')
    cleaned = re.sub(r'[^\w]', '', cleaned)
    cleaned = cleaned.lower()
    return cleaned


def find_columns_to_remove(df):
    """
    Find columns to remove by matching against COLUMNS_TO_REMOVE list.
    Handles case-insensitive matching and variations in column names.
    """
    cols_to_remove = []
    df_cols_upper = {str(c).upper().strip(): c for c in df.columns}

    for remove_col in COLUMNS_TO_REMOVE:
        remove_upper = remove_col.upper().strip()
        if remove_upper in df_cols_upper:
            cols_to_remove.append(df_cols_upper[remove_upper])

    return cols_to_remove


def parse_datetime_int(value):
    """
    Parse datetime from YYYYMMDDHHMMSS integer format.
    Returns pd.NaT for invalid values.
    """
    if pd.isna(value) or value == 0:
        return pd.NaT
    try:
        s = str(int(value))
        if len(s) == 14:  # YYYYMMDDHHMMSS
            return pd.to_datetime(s, format='%Y%m%d%H%M%S')
        elif len(s) == 8:  # YYYYMMDD
            return pd.to_datetime(s, format='%Y%m%d')
        else:
            return pd.NaT
    except (ValueError, TypeError):
        return pd.NaT


def transform_translog(input_file, output_file, verbose=True):
    """
    Transform TRANSLOG data from raw Excel to processed CSV.

    Args:
        input_file: Path to input Excel file
        output_file: Path for output CSV file
        verbose: Print progress messages

    Returns:
        dict with transformation statistics
    """
    stats = {
        'input_file': input_file,
        'output_file': output_file,
        'started_at': datetime.now().isoformat(),
    }

    if verbose:
        print("=" * 60)
        print("TRANSLOG Data Transformation")
        print("=" * 60)

    # Load data
    if verbose:
        print(f"\nLoading: {input_file}")

    if input_file.endswith('.xlsx') or input_file.endswith('.xls'):
        df = pd.read_excel(input_file, engine='openpyxl')
    elif input_file.endswith('.csv'):
        df = pd.read_csv(input_file)
    else:
        raise ValueError(f"Unsupported file format: {input_file}")

    stats['original_rows'] = len(df)
    stats['original_columns'] = len(df.columns)

    if verbose:
        print(f"  Loaded: {stats['original_rows']:,} rows x {stats['original_columns']} columns")

    # Find and remove columns
    cols_to_remove = find_columns_to_remove(df)
    stats['columns_removed'] = len(cols_to_remove)

    if verbose:
        print(f"\nRemoving {len(cols_to_remove)} columns (null/constant/near-null)...")

    df_clean = df.drop(columns=cols_to_remove, errors='ignore')

    # Rename columns using mapping
    rename_count = 0
    for old_name, new_name in COLUMN_RENAMES.items():
        # Case-insensitive match
        for col in df_clean.columns:
            if str(col).upper().strip() == old_name.upper():
                df_clean = df_clean.rename(columns={col: new_name})
                rename_count += 1
                break

    # Clean remaining column names
    rename_map = {}
    for col in df_clean.columns:
        if col not in COLUMN_RENAMES.values():
            new_name = clean_column_name(col)
            if new_name != str(col):
                rename_map[col] = new_name

    df_clean = df_clean.rename(columns=rename_map)
    stats['columns_renamed'] = rename_count + len(rename_map)

    if verbose:
        print(f"  Renamed {stats['columns_renamed']} columns to descriptive names")

    # Parse datetime columns from integer format
    datetime_cols = ['system_datetime_raw', 'application_datetime_raw']
    for col in datetime_cols:
        if col in df_clean.columns:
            new_col = col.replace('_raw', '')
            df_clean[new_col] = df_clean[col].apply(parse_datetime_int)
            df_clean = df_clean.drop(columns=[col])
            if verbose:
                valid_count = df_clean[new_col].notna().sum()
                print(f"  Parsed {col} -> {new_col} ({valid_count:,} valid datetimes)")

    # Convert placeholder values to null
    if 'reservation_number' in df_clean.columns:
        placeholder_count = (df_clean['reservation_number'] == '0').sum()
        df_clean['reservation_number'] = df_clean['reservation_number'].replace('0', np.nan)
        if verbose and placeholder_count > 0:
            print(f"  Converted {placeholder_count} placeholder '0' values to null in reservation_number")

    # Convert whitespace-only values to null in adjuster_name
    if 'adjuster_name' in df_clean.columns:
        mask = df_clean['adjuster_name'].apply(lambda x: isinstance(x, str) and x.strip() == '')
        whitespace_count = mask.sum()
        df_clean.loc[mask, 'adjuster_name'] = np.nan
        if verbose and whitespace_count > 0:
            print(f"  Converted {whitespace_count} whitespace-only values to null in adjuster_name")

    # Strip whitespace from string columns
    for col in df_clean.select_dtypes(include=['object']).columns:
        df_clean[col] = df_clean[col].apply(lambda x: x.strip() if isinstance(x, str) else x)

    # Remove duplicates
    original_rows = len(df_clean)
    df_clean = df_clean.drop_duplicates()
    stats['duplicates_removed'] = original_rows - len(df_clean)

    if verbose:
        print(f"  Removed {stats['duplicates_removed']} duplicate rows")

    stats['final_rows'] = len(df_clean)
    stats['final_columns'] = len(df_clean.columns)

    # Save output
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    df_clean.to_csv(output_file, index=False)

    stats['completed_at'] = datetime.now().isoformat()

    if verbose:
        print(f"\n" + "=" * 60)
        print("TRANSFORMATION COMPLETE")
        print("=" * 60)
        print(f"  Input:  {stats['original_rows']:,} rows x {stats['original_columns']} columns")
        print(f"  Output: {stats['final_rows']:,} rows x {stats['final_columns']} columns")
        print(f"  Saved:  {output_file}")

    return stats


def main():
    """Main entry point."""
    # Parse command line arguments
    if len(sys.argv) >= 3:
        input_file = sys.argv[1]
        output_file = sys.argv[2]
    elif len(sys.argv) == 2:
        input_file = sys.argv[1]
        # Generate output filename
        base = os.path.splitext(os.path.basename(input_file))[0]
        output_file = f'/Users/dansia/Documents/HertzDataAnalysis/data/processed/{base}_processed.csv'
    else:
        input_file = DEFAULT_INPUT
        output_file = DEFAULT_OUTPUT

    # Run transformation
    stats = transform_translog(input_file, output_file)

    return stats


if __name__ == '__main__':
    main()
