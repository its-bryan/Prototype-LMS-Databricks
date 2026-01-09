#!/usr/bin/env python3
"""
HLES Conversion Data Transformation Script

Transforms raw HLES Conversion Excel files into analysis-ready CSV format.
Applies standardized cleaning, column renaming, and derived feature creation.

Usage:
    python transform_hles_conversion.py <input_file> [output_file]

Examples:
    python transform_hles_conversion.py "data/raw/HLES Conversion Data 2025.06.09.xlsx"
    python transform_hles_conversion.py "data/raw/new_data.xlsx" "data/processed/custom_output.csv"

If output_file is not specified, outputs to 'hles_conversion_processed.csv'.
"""

import pandas as pd
import numpy as np
import re
import sys
from pathlib import Path
from datetime import datetime


def clean_column_name(col: str) -> str:
    """
    Clean column name by removing newlines and converting to snake_case.

    Examples:
        '\\nCONFIRM_NUM' -> 'confirm_num'
        '\\nCDP NAME' -> 'cdp_name'
        'FST\\nDT_FROM_ALPHA1' -> 'fst_dt_from_alpha1'
    """
    col = col.replace('\n', '')
    col = col.replace(' ', '_')
    col = col.lower()
    col = re.sub(r'_+', '_', col)
    col = col.strip('_')
    return col


def transform_hles_conversion(input_path: str, output_path: str = None, verbose: bool = True) -> dict:
    """
    Transform HLES Conversion data from raw Excel to analysis-ready CSV.

    Transformations applied:
    1. Clean column names (remove newlines, snake_case)
    2. Remove single-value columns (res_id, adj_lname)
    3. Convert whitespace placeholders to NULL
    4. Convert DATE_OUT1 to datetime
    5. Add derived columns (was_contacted, contact_time_category)

    Args:
        input_path: Path to input Excel file
        output_path: Optional path for output CSV
        verbose: Print progress messages

    Returns:
        dict with transformation results
    """
    input_path = Path(input_path)

    results = {
        'input_file': str(input_path),
        'started_at': datetime.now().isoformat()
    }

    if verbose:
        print(f"[1/7] Reading input file: {input_path.name}")

    df = pd.read_excel(input_path, engine='openpyxl')
    results['original_rows'] = df.shape[0]
    results['original_columns'] = df.shape[1]

    if verbose:
        print(f"      Loaded {df.shape[0]:,} rows x {df.shape[1]} columns")

    # Step 2: Clean column names
    if verbose:
        print("[2/7] Cleaning column names...")
    original_columns = df.columns.tolist()
    df.columns = [clean_column_name(col) for col in df.columns]
    renamed_count = sum(1 for o, n in zip(original_columns, df.columns) if o != n)
    results['columns_renamed'] = renamed_count
    if verbose:
        print(f"      Renamed {renamed_count} columns")

    # Step 3: Remove single-value columns
    if verbose:
        print("[3/7] Removing single-value columns...")
    cols_to_remove = []

    for col in df.columns:
        unique_vals = df[col].dropna().unique()
        if len(unique_vals) == 0:
            cols_to_remove.append(col)
        elif len(unique_vals) == 1:
            if isinstance(unique_vals[0], str) and unique_vals[0].strip() == '':
                cols_to_remove.append(col)

    # Known single-value columns from profiling
    known_single_value_cols = ['res_id', 'adj_lname']
    for col in known_single_value_cols:
        if col in df.columns and col not in cols_to_remove:
            cols_to_remove.append(col)

    cols_to_remove = list(set(cols_to_remove))

    if cols_to_remove:
        df = df.drop(columns=cols_to_remove, errors='ignore')
        results['columns_removed'] = cols_to_remove
        if verbose:
            print(f"      Removed {len(cols_to_remove)} columns: {cols_to_remove}")
    else:
        results['columns_removed'] = []
        if verbose:
            print("      No single-value columns found")

    # Step 4: Convert whitespace to NULL
    if verbose:
        print("[4/7] Converting whitespace placeholders to NULL...")
    whitespace_count = 0
    for col in df.select_dtypes(include=['object']).columns:
        mask = df[col].apply(lambda x: isinstance(x, str) and x.strip() == '')
        count = mask.sum()
        if count > 0:
            df.loc[mask, col] = np.nan
            whitespace_count += count
    results['whitespace_converted'] = whitespace_count
    if verbose:
        print(f"      Converted {whitespace_count:,} whitespace values to NULL")

    # Step 5: Convert date columns
    if verbose:
        print("[5/7] Converting date columns...")
    date_converted = []

    if 'date_out1' in df.columns:
        try:
            df['date_out1'] = pd.to_datetime(df['date_out1'], errors='coerce')
            date_converted.append('date_out1')
        except Exception as e:
            if verbose:
                print(f"      Warning: Could not convert date_out1: {e}")

    for col in ['week_of', 'init_date', 'init_dt_final', 'fst_dt_from_alpha1']:
        if col in df.columns and df[col].dtype == 'object':
            try:
                df[col] = pd.to_datetime(df[col], errors='coerce')
                date_converted.append(col)
            except:
                pass

    results['dates_converted'] = date_converted
    if verbose:
        if date_converted:
            print(f"      Converted {len(date_converted)} columns to datetime: {date_converted}")
        else:
            print("      No date conversions needed")

    # Step 6: Add derived columns
    if verbose:
        print("[6/7] Creating derived columns...")
    derived_cols = []

    if 'contact_group' in df.columns:
        df['was_contacted'] = (df['contact_group'] != 'NO CONTACT').astype(int)
        derived_cols.append('was_contacted')

    if 'contact_range' in df.columns:
        df['contact_time_category'] = df['contact_range'].replace('NO CONTACT', 'NO_CONTACT')
        derived_cols.append('contact_time_category')

    results['columns_added'] = derived_cols
    if verbose:
        if derived_cols:
            print(f"      Created {len(derived_cols)} derived columns: {derived_cols}")
        else:
            print("      No derived columns created (source columns not found)")

    # Step 7: Save output
    if output_path is None:
        output_path = input_path.parent.parent / 'processed' / 'hles_conversion_processed.csv'

    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    if verbose:
        print(f"[7/7] Saving to: {output_path}")

    df.to_csv(output_path, index=False)

    results['final_rows'] = df.shape[0]
    results['final_columns'] = df.shape[1]
    results['output_file'] = str(output_path)
    results['completed_at'] = datetime.now().isoformat()

    if 'rent_ind' in df.columns:
        results['conversion_rate'] = df['rent_ind'].mean() * 100
        results['conversions'] = int(df['rent_ind'].sum())

    if verbose:
        print("\n" + "=" * 60)
        print("TRANSFORMATION COMPLETE")
        print("=" * 60)
        print(f"Input:  {results['original_rows']:,} rows x {results['original_columns']} columns")
        print(f"Output: {results['final_rows']:,} rows x {results['final_columns']} columns")
        print(f"File:   {output_path}")

        if 'conversion_rate' in results:
            print(f"\nConversion Rate: {results['conversion_rate']:.2f}% "
                  f"({results['conversions']:,}/{results['final_rows']:,})")

    return results


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    input_file = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else None

    if not Path(input_file).exists():
        print(f"Error: Input file not found: {input_file}")
        sys.exit(1)

    transform_hles_conversion(input_file, output_file)


if __name__ == '__main__':
    main()
