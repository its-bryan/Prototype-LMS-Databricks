#!/usr/bin/env python3
"""
CSPLIT Data Transformation Script

Applies standardized transformations to CSPLIT data based on profiling analysis.
Designed to work with both sample (1000 rows) and full production data (100k+ rows).

Usage:
    python scripts/transform_csplit.py [input_file] [output_file]

    If no arguments provided, uses default paths.

Transformations Applied:
    1. Remove 101 columns identified as fully null or single-value
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
DEFAULT_INPUT = '/Users/dansia/Documents/HertzDataAnalysis/data/raw/CPLIT 1000 Records.xlsx'
DEFAULT_OUTPUT = '/Users/dansia/Documents/HertzDataAnalysis/data/processed/csplit_processed.csv'

# Columns to REMOVE (identified from profiling as fully null or single-value)
# These 101 columns provide no analytical value
COLUMNS_TO_REMOVE = [
    # Fully NULL columns (50)
    'POLICYEXPIRES', 'POLICY_UM', 'POLICY_BI', 'POLICY_COLL', 'POLICY_COMP',
    'ADJUSTER_ADD1', 'ADJUSTER_CITY', 'ADJUSTER_STATE', 'ADJUSTER_ZIP',
    'AGENT_LNAME', 'AGENT_FNAME', 'BODY_SHOP_CNTRY', 'RENTAL_LOC_ADD2',
    'RENTAL_LOC_EXT', 'RENTER_NOTIFIED', 'TERM_DATE', 'GENDER_CODE',
    'UPD_DATE', 'TRANS_DATE', 'TIME_ZONE', 'EDI_DATE', 'EDI_TERM_DATE',
    'EDI_BRANCH', 'EDI_NAME', 'APP_ID', 'BI', 'UMCSL', 'COMP', 'TEST_PROD',
    'CUST_TYPE', 'LAST_INVOICED', 'SCHEDULE', 'SL_DATE', 'CARRIER',
    'VERIFY_NUM', 'Frp_Adj', 'Invoice_Subtotal', 'EstCompDate', 'BSROnum',
    'BSMessage1', 'BSMessage2', 'OrigClaimNum', 'VehIDNumber',
    'LastFaxSentDate', 'FRMTaxFlag', 'CallBack', 'RAAutoExtend',
    'EXT_REQ_VEHClass', 'SecAdjext', '_rescued_data',

    # Single-value columns (51)
    'POLICY_UM_DED', 'POLICY_BI_DED', 'POLICY_COLL_DED', 'POLICY_COMP_DED',
    'PREPAIDAMT', 'LUMPSUM', 'TOT_RATE_AUTH', 'PERDAY_CRG', 'LUMPSUM_CRG',
    'RENT_CRG_DAY_RT', 'RENT_CRG_PCT', 'CURR_TYPE', 'PICKUP_HR', 'PICKUP_MIN',
    'HR_OUT', 'MIN_OUT', 'RETURN_HR', 'RETURN_MIN', 'NOTIF_HR', 'NOTIF_MIN',
    'S_CHARGE_AMT', 'TERM_HR', 'TERM_MIN', 'CANC_HR', 'CANC_MIN',
    'RENTAL_DAYS', 'INITAIL_HR', 'INITIAL_MIN', 'UPD_HR', 'TRANS_HR',
    'TRANS_MIN', 'SPLIT_OPEN', 'BSPrimStatus', 'BSSecStatus', 'BSAck_Flag',
    'BSStat_Flag', 'LDW_Sold', 'FRMTaxAmt', 'SourceFilename', 'LoadDate',
    'LoadDateTime', 'SourceSystem', 'SourceRegion',

    # Near-null with single value (flagged as both)
    'LUSE', 'VERIFY_FLAG', 'ThirdPartyOwes', 'Shoptype', 'Ext_Req_Perday',
    'EXT_REQ_TOTAMT', 'CalculatedDays', 'BookingOffice'
]


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


def transform_csplit(input_file, output_file, verbose=True):
    """
    Transform CSPLIT data from raw Excel to processed CSV.

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
        print("CSPLIT Data Transformation")
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
        print(f"\nRemoving {len(cols_to_remove)} columns (null/single-value)...")

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
    stats = transform_csplit(input_file, output_file)

    return stats


if __name__ == '__main__':
    main()
