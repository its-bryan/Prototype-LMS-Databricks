#!/usr/bin/env python3
"""
Data Profiling Script for CRA001 1000 Records.xlsx
This script performs comprehensive data analysis and generates a clean dataset with documentation.
"""

import pandas as pd
import numpy as np
import os
from datetime import datetime

# Configuration
INPUT_FILE = '/Users/dansia/Documents/HertzDataAnalysis/data/raw/CRA001 1000 Records.xlsx'
OUTPUT_DIR = '/Users/dansia/Documents/HertzDataAnalysis/data/processed'
OUTPUT_CSV = os.path.join(OUTPUT_DIR, 'CRA001_1000_Records_processed.csv')
OUTPUT_MD = os.path.join(OUTPUT_DIR, 'CRA001_1000_Records_profile.md')

# Ensure output directory exists
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Load the Excel file
print("Loading Excel file...")
df = pd.read_excel(INPUT_FILE, engine='openpyxl')

print("=" * 80)
print("PHASE 1: INITIAL ASSESSMENT")
print("=" * 80)

# Basic metadata
print(f"\nTotal Rows: {len(df)}")
print(f"Total Columns: {len(df.columns)}")
print(f"Memory Usage: {df.memory_usage(deep=True).sum() / 1024:.2f} KB")

# Column names analysis
print("\n" + "-" * 40)
print("COLUMN NAMES ANALYSIS")
print("-" * 40)

column_issues = {}
for i, col in enumerate(df.columns):
    issues = []
    col_str = str(col)
    if '\n' in col_str:
        issues.append('contains newline')
    if col_str.startswith(' ') or col_str.endswith(' '):
        issues.append('leading/trailing space')
    if issues:
        column_issues[col] = issues
    print(f"{i+1:2d}. {repr(col)}")
    if issues:
        print(f"     Issues: {', '.join(issues)}")

print("\n" + "-" * 40)
print("DATA TYPES")
print("-" * 40)
print(df.dtypes.to_string())

print("\n" + "-" * 40)
print("SAMPLE DATA (First 3 rows)")
print("-" * 40)
print(df.head(3).to_string())

print("\n" + "=" * 80)
print("PHASE 2: DATA QUALITY ANALYSIS")
print("=" * 80)

# Missing values analysis
print("\n" + "-" * 40)
print("MISSING VALUES ANALYSIS")
print("-" * 40)

missing_analysis = []
for col in df.columns:
    missing_count = df[col].isna().sum()
    missing_pct = (missing_count / len(df)) * 100
    missing_analysis.append({
        'column': col,
        'missing_count': missing_count,
        'missing_pct': missing_pct
    })
    if missing_pct > 0:
        print(f"{str(col)[:40]:<40}: {missing_count:>5} ({missing_pct:>6.2f}%)")

# Fully null columns (100% missing)
fully_null_cols = [m['column'] for m in missing_analysis if m['missing_pct'] == 100]
print(f"\nFully NULL columns (100% missing): {len(fully_null_cols)}")
for col in fully_null_cols:
    print(f"  - {col}")

# Near-null columns (>95% missing)
near_null_cols = [m['column'] for m in missing_analysis if 95 < m['missing_pct'] < 100]
print(f"\nNear-NULL columns (>95% missing): {len(near_null_cols)}")
for col in near_null_cols:
    pct = [m for m in missing_analysis if m['column'] == col][0]['missing_pct']
    print(f"  - {col}: {pct:.2f}% missing")

# Single-value (constant) columns
print("\n" + "-" * 40)
print("CONSTANT/NEAR-CONSTANT COLUMNS")
print("-" * 40)

constant_cols = []
near_constant_cols = []
for col in df.columns:
    non_null = df[col].dropna()
    if len(non_null) > 0:
        unique_count = non_null.nunique()
        if unique_count == 1:
            constant_cols.append((col, non_null.iloc[0] if len(non_null) > 0 else None))
        elif unique_count == 2:
            value_counts = non_null.value_counts(normalize=True)
            if value_counts.iloc[0] > 0.99:
                near_constant_cols.append((col, value_counts.index[0], value_counts.iloc[0]))

print(f"\nConstant columns (single value): {len(constant_cols)}")
for col, val in constant_cols:
    print(f"  - {col}: always '{val}'")

print(f"\nNear-constant columns (>99% one value): {len(near_constant_cols)}")
for col, val, pct in near_constant_cols:
    print(f"  - {col}: '{val}' = {pct*100:.2f}%")

# Duplicate rows
print("\n" + "-" * 40)
print("DUPLICATE ANALYSIS")
print("-" * 40)
duplicate_count = df.duplicated().sum()
print(f"Exact duplicate rows: {duplicate_count}")

print("\n" + "=" * 80)
print("PHASE 3: COLUMN PROFILING")
print("=" * 80)

# Store profiling results
column_profiles = {}

for col in df.columns:
    print(f"\n{'-' * 60}")
    print(f"COLUMN: {repr(col)}")
    print(f"{'-' * 60}")

    profile = {
        'original_name': col,
        'dtype': str(df[col].dtype),
        'non_null_count': df[col].notna().sum(),
        'null_count': df[col].isna().sum(),
        'null_pct': (df[col].isna().sum() / len(df)) * 100
    }

    non_null_data = df[col].dropna()

    if len(non_null_data) == 0:
        print("  ALL VALUES ARE NULL")
        profile['status'] = 'all_null'
        column_profiles[col] = profile
        continue

    profile['unique_count'] = non_null_data.nunique()
    print(f"  Data Type: {profile['dtype']}")
    print(f"  Non-null Count: {profile['non_null_count']}")
    print(f"  Null Count: {profile['null_count']} ({profile['null_pct']:.2f}%)")
    print(f"  Unique Values: {profile['unique_count']}")

    # Check if numeric (but not boolean)
    if pd.api.types.is_numeric_dtype(df[col]) and df[col].dtype != 'bool':
        profile['type'] = 'numeric'
        print(f"\n  Numeric Statistics:")
        print(f"    Min: {non_null_data.min()}")
        print(f"    Max: {non_null_data.max()}")
        print(f"    Mean: {non_null_data.mean():.4f}")
        print(f"    Median: {non_null_data.median()}")
        print(f"    Std Dev: {non_null_data.std():.4f}")
        print(f"    Zero count: {(non_null_data == 0).sum()}")

        # Percentiles (skip for boolean)
        try:
            percentiles = non_null_data.quantile([0.25, 0.5, 0.75, 0.9, 0.99])
            print(f"    25th percentile: {percentiles[0.25]}")
            print(f"    50th percentile: {percentiles[0.5]}")
            print(f"    75th percentile: {percentiles[0.75]}")
            print(f"    90th percentile: {percentiles[0.9]}")
            print(f"    99th percentile: {percentiles[0.99]}")
        except (TypeError, ValueError):
            print("    (percentiles not available for this dtype)")

        profile['min'] = non_null_data.min()
        profile['max'] = non_null_data.max()
        profile['mean'] = non_null_data.mean()
        profile['median'] = non_null_data.median()
        profile['std'] = non_null_data.std()
        profile['percentiles'] = percentiles.to_dict()

    elif pd.api.types.is_datetime64_any_dtype(df[col]):
        profile['type'] = 'datetime'
        print(f"\n  DateTime Statistics:")
        print(f"    Earliest: {non_null_data.min()}")
        print(f"    Latest: {non_null_data.max()}")
        print(f"    Range: {non_null_data.max() - non_null_data.min()}")

        profile['min_date'] = str(non_null_data.min())
        profile['max_date'] = str(non_null_data.max())

    else:
        profile['type'] = 'categorical'
        print(f"\n  Value Distribution (Top 15):")
        value_counts = non_null_data.value_counts()
        profile['value_counts'] = value_counts.head(20).to_dict()

        for i, (val, count) in enumerate(value_counts.head(15).items()):
            pct = (count / len(non_null_data)) * 100
            print(f"    {i+1:2d}. '{val}': {count} ({pct:.2f}%)")

        if len(value_counts) > 15:
            print(f"    ... and {len(value_counts) - 15} more unique values")

        # Check for inconsistent representations
        if non_null_data.dtype == 'object':
            str_data = non_null_data.astype(str)
            lower_unique = str_data.str.lower().str.strip().nunique()
            if lower_unique < profile['unique_count']:
                print(f"\n  POTENTIAL INCONSISTENCY: {profile['unique_count']} unique values reduce to {lower_unique} when normalized (case/whitespace)")
                profile['has_inconsistencies'] = True

    column_profiles[col] = profile

# Generate markdown report
print("\n" + "=" * 80)
print("GENERATING MARKDOWN REPORT")
print("=" * 80)

md_lines = []
md_lines.append("# Data Profile: CRA001 (CRA001 1000 Records.xlsx)")
md_lines.append("")
md_lines.append(f"**Generated**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
md_lines.append("")
md_lines.append("## Executive Summary")
md_lines.append("")
md_lines.append("### What This Data Represents")
md_lines.append("The CRA001 table contains contract details - it's an intermediate step before CSPLIT in the Hertz Insurance Replacement business. Each row represents a rental contract with associated vehicle, location, and billing information.")
md_lines.append("")
md_lines.append("### Key Statistics")
md_lines.append(f"- **Total Rows**: {len(df)}")
md_lines.append(f"- **Total Columns**: {len(df.columns)}")
md_lines.append(f"- **Memory Usage**: {df.memory_usage(deep=True).sum() / 1024:.2f} KB")
md_lines.append(f"- **Fully NULL columns**: {len(fully_null_cols)}")
md_lines.append(f"- **Constant columns**: {len(constant_cols)}")
md_lines.append(f"- **Duplicate rows**: {duplicate_count}")
md_lines.append("")
md_lines.append("### Data Quality Assessment")
if len(fully_null_cols) == 0 and len(constant_cols) < 5:
    md_lines.append("**Quality**: Good - Data is well-populated with few quality issues.")
elif len(fully_null_cols) <= 5:
    md_lines.append("**Quality**: Fair - Some columns have quality issues but core data is usable.")
else:
    md_lines.append("**Quality**: Needs Attention - Multiple columns have significant quality issues.")
md_lines.append("")
md_lines.append("## Columns Removed/Flagged")
md_lines.append("")
md_lines.append("### Fully NULL Columns (100% missing)")
md_lines.append("")
if fully_null_cols:
    for col in fully_null_cols:
        md_lines.append(f"- {col}")
else:
    md_lines.append("- None")
md_lines.append("")
md_lines.append("### Constant Columns (single value)")
md_lines.append("")
if constant_cols:
    for col, val in constant_cols:
        md_lines.append(f"- {col}: always '{val}'")
else:
    md_lines.append("- None")
md_lines.append("")
md_lines.append("## Column Dictionary")
md_lines.append("")
for col, profile in column_profiles.items():
    md_lines.append(f"### {col}")
    md_lines.append("")
    md_lines.append(f"- **Data Type**: {profile['dtype']}")
    md_lines.append(f"- **Non-null Count**: {profile['non_null_count']}")
    md_lines.append(f"- **Null Count**: {profile['null_count']} ({profile['null_pct']:.2f}%)")
    if 'unique_count' in profile:
        md_lines.append(f"- **Unique Values**: {profile['unique_count']}")
    if profile.get('type') == 'numeric':
        md_lines.append(f"- **Statistics**: Min={profile.get('min')}, Max={profile.get('max')}, Mean={profile.get('mean', 0):.4f}")
    if profile.get('type') == 'datetime':
        md_lines.append(f"- **Date Range**: {profile.get('min_date')} to {profile.get('max_date')}")
    if 'value_counts' in profile:
        top_vals = list(profile['value_counts'].items())[:5]
        if top_vals:
            md_lines.append(f"- **Top Values**: {', '.join([f'{k}: {v}' for k, v in top_vals])}")
    md_lines.append("")

# Write markdown file
with open(OUTPUT_MD, 'w') as f:
    f.write('\n'.join(md_lines))
print(f"Markdown report saved to: {OUTPUT_MD}")

# Create cleaned dataframe
print("\n" + "=" * 80)
print("CREATING PROCESSED DATASET")
print("=" * 80)

# Remove fully null and constant columns
cols_to_remove = fully_null_cols + [c[0] for c in constant_cols]
df_cleaned = df.drop(columns=cols_to_remove, errors='ignore')

# Clean column names
rename_map = {}
for col in df_cleaned.columns:
    new_name = str(col).strip().replace('\n', '_').replace(' ', '_').lower()
    if new_name != str(col):
        rename_map[col] = new_name
df_cleaned = df_cleaned.rename(columns=rename_map)

# Remove duplicate rows
df_cleaned = df_cleaned.drop_duplicates()

# Save processed CSV
df_cleaned.to_csv(OUTPUT_CSV, index=False)
print(f"Processed CSV saved to: {OUTPUT_CSV}")
print(f"  Original: {len(df)} rows, {len(df.columns)} columns")
print(f"  Processed: {len(df_cleaned)} rows, {len(df_cleaned.columns)} columns")
print(f"  Columns removed: {len(cols_to_remove)}")

# Save profiles for later use
print("\n" + "=" * 80)
print("PROFILE SUMMARY COMPLETE")
print("=" * 80)
print(f"Total columns profiled: {len(column_profiles)}")
print(f"Fully null columns: {len(fully_null_cols)}")
print(f"Constant columns: {len(constant_cols)}")
