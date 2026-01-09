#!/usr/bin/env python3
"""
Master Data Transformation Script

Runs all data transformations for Hertz Insurance Replacement Analysis.
Processes raw Excel files and outputs clean CSV files ready for analysis.

Usage:
    python "scripts/data transformation scripts/run_all_transformations.py"

    Or with custom input directory:
    python "scripts/data transformation scripts/run_all_transformations.py" /path/to/raw/data

Expected Input Files:
    - CPLIT*.xlsx or CSPLIT*.xlsx (CSPLIT table data)
    - CRA001*.xlsx (CRA001 table data)
    - HLES*Conversion*.xlsx (HLES Conversion metrics)
    - TRANSLOG*.xlsx (Transaction log data)

Output Files:
    - data/processed/csplit_processed.csv
    - data/processed/cra001_processed.csv
    - data/processed/hles_conversion_processed.csv
    - data/processed/translog_processed.csv
"""

import os
import sys
import glob
from datetime import datetime

# Add script directory to path for imports
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SCRIPT_DIR)

from transform_csplit import transform_csplit
from transform_cra001 import transform_cra001
from transform_hles_conversion import transform_hles_conversion
from transform_translog import transform_translog

# Default paths
PROJECT_ROOT = os.path.dirname(os.path.dirname(SCRIPT_DIR))
DEFAULT_RAW_DIR = os.path.join(PROJECT_ROOT, 'data', 'raw')
DEFAULT_PROCESSED_DIR = os.path.join(PROJECT_ROOT, 'data', 'processed')


def find_input_file(raw_dir, patterns):
    """Find input file matching any of the given patterns."""
    for pattern in patterns:
        matches = glob.glob(os.path.join(raw_dir, pattern))
        if matches:
            # Return most recently modified file if multiple matches
            return max(matches, key=os.path.getmtime)
    return None


def run_all_transformations(raw_dir=None, processed_dir=None, verbose=True):
    """
    Run all data transformations.

    Args:
        raw_dir: Directory containing raw input files
        processed_dir: Directory for processed output files
        verbose: Print progress messages

    Returns:
        dict with transformation results
    """
    raw_dir = raw_dir or DEFAULT_RAW_DIR
    processed_dir = processed_dir or DEFAULT_PROCESSED_DIR

    results = {
        'started_at': datetime.now().isoformat(),
        'raw_dir': raw_dir,
        'processed_dir': processed_dir,
        'transformations': {}
    }

    if verbose:
        print("=" * 70)
        print("HERTZ DATA TRANSFORMATION PIPELINE")
        print("=" * 70)
        print(f"\nInput Directory:  {raw_dir}")
        print(f"Output Directory: {processed_dir}")
        print()

    # Ensure output directory exists
    os.makedirs(processed_dir, exist_ok=True)

    # Transform CSPLIT
    if verbose:
        print("-" * 70)
        print("CSPLIT Transformation")
        print("-" * 70)

    csplit_input = find_input_file(raw_dir, ['CPLIT*.xlsx', 'CSPLIT*.xlsx', 'cplit*.xlsx', 'csplit*.xlsx'])

    if csplit_input:
        csplit_output = os.path.join(processed_dir, 'csplit_processed.csv')
        try:
            results['transformations']['csplit'] = transform_csplit(
                csplit_input, csplit_output, verbose=verbose
            )
            results['transformations']['csplit']['status'] = 'success'
        except Exception as e:
            results['transformations']['csplit'] = {
                'status': 'error',
                'error': str(e),
                'input_file': csplit_input
            }
            if verbose:
                print(f"ERROR: {e}")
    else:
        results['transformations']['csplit'] = {
            'status': 'skipped',
            'reason': 'No CSPLIT input file found'
        }
        if verbose:
            print("SKIPPED: No CSPLIT input file found")

    print()

    # Transform CRA001
    if verbose:
        print("-" * 70)
        print("CRA001 Transformation")
        print("-" * 70)

    cra001_input = find_input_file(raw_dir, ['CRA001*.xlsx', 'cra001*.xlsx'])

    if cra001_input:
        cra001_output = os.path.join(processed_dir, 'cra001_processed.csv')
        try:
            results['transformations']['cra001'] = transform_cra001(
                cra001_input, cra001_output, verbose=verbose
            )
            results['transformations']['cra001']['status'] = 'success'
        except Exception as e:
            results['transformations']['cra001'] = {
                'status': 'error',
                'error': str(e),
                'input_file': cra001_input
            }
            if verbose:
                print(f"ERROR: {e}")
    else:
        results['transformations']['cra001'] = {
            'status': 'skipped',
            'reason': 'No CRA001 input file found'
        }
        if verbose:
            print("SKIPPED: No CRA001 input file found")

    print()

    # Transform HLES Conversion
    if verbose:
        print("-" * 70)
        print("HLES Conversion Transformation")
        print("-" * 70)

    hles_input = find_input_file(raw_dir, ['HLES*Conversion*.xlsx', 'hles*conversion*.xlsx', 'HLES_Conversion*.xlsx'])

    if hles_input:
        hles_output = os.path.join(processed_dir, 'hles_conversion_processed.csv')
        try:
            results['transformations']['hles_conversion'] = transform_hles_conversion(
                hles_input, hles_output, verbose=verbose
            )
            results['transformations']['hles_conversion']['status'] = 'success'
        except Exception as e:
            results['transformations']['hles_conversion'] = {
                'status': 'error',
                'error': str(e),
                'input_file': hles_input
            }
            if verbose:
                print(f"ERROR: {e}")
    else:
        results['transformations']['hles_conversion'] = {
            'status': 'skipped',
            'reason': 'No HLES Conversion input file found'
        }
        if verbose:
            print("SKIPPED: No HLES Conversion input file found")

    print()

    # Transform TRANSLOG
    if verbose:
        print("-" * 70)
        print("TRANSLOG Transformation")
        print("-" * 70)

    translog_input = find_input_file(raw_dir, ['TRANSLOG*.xlsx', 'translog*.xlsx', 'TRANSLOG*.csv'])

    if translog_input:
        translog_output = os.path.join(processed_dir, 'translog_processed.csv')
        try:
            results['transformations']['translog'] = transform_translog(
                translog_input, translog_output, verbose=verbose
            )
            results['transformations']['translog']['status'] = 'success'
        except Exception as e:
            results['transformations']['translog'] = {
                'status': 'error',
                'error': str(e),
                'input_file': translog_input
            }
            if verbose:
                print(f"ERROR: {e}")
    else:
        results['transformations']['translog'] = {
            'status': 'skipped',
            'reason': 'No TRANSLOG input file found'
        }
        if verbose:
            print("SKIPPED: No TRANSLOG input file found")

    results['completed_at'] = datetime.now().isoformat()

    # Summary
    if verbose:
        print()
        print("=" * 70)
        print("TRANSFORMATION SUMMARY")
        print("=" * 70)

        for name, result in results['transformations'].items():
            status = result.get('status', 'unknown')
            if status == 'success':
                print(f"  {name.upper()}: SUCCESS")
                print(f"    Input:  {result.get('original_rows', 'N/A'):,} rows x {result.get('original_columns', 'N/A')} cols")
                print(f"    Output: {result.get('final_rows', 'N/A'):,} rows x {result.get('final_columns', 'N/A')} cols")
                print(f"    File:   {result.get('output_file', 'N/A')}")
            elif status == 'skipped':
                print(f"  {name.upper()}: SKIPPED - {result.get('reason', 'Unknown reason')}")
            else:
                print(f"  {name.upper()}: ERROR - {result.get('error', 'Unknown error')}")

        print()

    return results


def main():
    """Main entry point."""
    # Parse command line arguments
    raw_dir = sys.argv[1] if len(sys.argv) > 1 else None
    processed_dir = sys.argv[2] if len(sys.argv) > 2 else None

    results = run_all_transformations(raw_dir, processed_dir)

    # Return exit code based on results
    success_count = sum(
        1 for r in results['transformations'].values()
        if r.get('status') == 'success'
    )

    if success_count == 0:
        sys.exit(1)  # All failed
    elif success_count < len(results['transformations']):
        sys.exit(2)  # Some failed
    else:
        sys.exit(0)  # All succeeded


if __name__ == '__main__':
    main()
