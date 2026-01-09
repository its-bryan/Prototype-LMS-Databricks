#!/usr/bin/env python3
"""
CRA001 Data Transformation Script

Applies standardized transformations to CRA001 data based on profiling analysis.
Designed to work with both sample (1000 rows) and full production data (100k+ rows).

Usage:
    python "scripts/data transformation scripts/transform_cra001.py" [input_file] [output_file]

    If no arguments provided, uses default paths.

Transformations Applied:
    1. Remove 67 columns identified as fully null or constant
    2. Standardize column names (lowercase, underscores)
    3. Strip whitespace from string columns
    4. Remove duplicate rows
"""

import pandas as pd
import numpy as np
import os
import sys
import re
from datetime import datetime

# Default paths
DEFAULT_INPUT = '/Users/dansia/Documents/HertzDataAnalysis/data/raw/CRA001 1000 Records.xlsx'
DEFAULT_OUTPUT = '/Users/dansia/Documents/HertzDataAnalysis/data/processed/CRA001_processed.csv'

# Columns to REMOVE - Fully NULL (25 columns)
FULLY_NULL_COLUMNS = [
    'DRB_Date', 'REF_SOURCE', 'PO', 'SWAP_KNUM', 'DBR', 'INVOICE_DATE',
    'LAST_INVOICED', 'POST_DATE', 'AIRLINE', 'FLIGHT', 'Comm_Paid',
    'EDITED_FLAG', 'Satellite', 'WorkStation', 'ARRIVAL', 'PickupPlace',
    'FreqTravler', 'FreqHotel', 'Foth5', 'transarc', 'GoldKey', 'Carisma',
    'DialerStatus', 'MergeAttempt', '_rescued_data'
]

# Columns to REMOVE - Constant/Single-value (42 columns)
CONSTANT_COLUMNS = [
    'IATA', 'Comm_Percent', 'CORP_OPEN_FLAG', 'DISC_PERCENT', 'DB_FLAG',
    'BATCH_OPEN', 'PRORATE_FLAG', 'ATAX_PROMPT', 'LTAX_PROMPT', 'CHANGE_FLAG',
    'LICENSE_ISSUED', 'Swap_Number', 'PromptTax4', 'PromptTax5', 'Tax4_Rate',
    'Tax5_Rate', 'Fuel_PP_Size', 'OrigRateID', 'Delivery', 'Collection',
    'BillFlag', 'Foth2', 'Foth3', 'DMVCheck', 'Noth2', 'Ioth2', 'Ioth3',
    'CashForm', 'DRBCashVersion', 'AutoCCExempt', 'ESTprint', 'NumOneStatCode',
    'ReCalcFlag', 'PRReason', 'PRDelivery', 'PRDistance', 'Destination',
    'SourceFilename', 'LoadDate', 'LoadDateTime', 'SourceSystem', 'SourceRegion'
]

# Combined list for removal
COLUMNS_TO_REMOVE = FULLY_NULL_COLUMNS + CONSTANT_COLUMNS


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


def transform_cra001(input_file, output_file, verbose=True):
    """
    Transform CRA001 data from raw Excel to processed CSV.

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
        print("CRA001 Data Transformation")
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
        print(f"\nRemoving {len(cols_to_remove)} columns (null/constant)...")

    df_clean = df.drop(columns=cols_to_remove, errors='ignore')

    # Rename columns to standard format
    rename_map = {}
    for col in df_clean.columns:
        new_name = clean_column_name(col)
        if new_name != str(col):
            rename_map[col] = new_name

    df_clean = df_clean.rename(columns=rename_map)
    stats['columns_renamed'] = len(rename_map)

    if verbose:
        print(f"  Renamed {len(rename_map)} columns to standard format")

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
    stats = transform_cra001(input_file, output_file)

    return stats


if __name__ == '__main__':
    main()
