#!/usr/bin/env python3
"""
CSPLIT Data Profiler Script
Analyzes the CPLIT 1000 Records.xlsx file and generates comprehensive data profile.
"""

import pandas as pd
import numpy as np
import os
import json
from datetime import datetime

# Configuration
INPUT_FILE = '/Users/dansia/Documents/HertzDataAnalysis/data/raw/CPLIT 1000 Records.xlsx'
OUTPUT_DIR = '/Users/dansia/Documents/HertzDataAnalysis/data/processed'
OUTPUT_CSV = os.path.join(OUTPUT_DIR, 'csplit_processed.csv')
OUTPUT_MD = os.path.join(OUTPUT_DIR, 'csplit_profile.md')
OUTPUT_JSON = os.path.join(OUTPUT_DIR, 'csplit_profile.json')

# Ensure output directory exists
os.makedirs(OUTPUT_DIR, exist_ok=True)

def load_data():
    """Load the Excel file and return DataFrame"""
    print("Loading Excel file...")
    df = pd.read_excel(INPUT_FILE, engine='openpyxl')
    return df

def basic_metadata(df, file_path):
    """Get basic file and DataFrame metadata"""
    metadata = {
        'file_size_kb': round(os.path.getsize(file_path) / 1024, 2),
        'total_rows': len(df),
        'total_columns': len(df.columns),
        'memory_usage_kb': round(df.memory_usage(deep=True).sum() / 1024, 2),
        'column_names_raw': [repr(col) for col in df.columns]
    }
    return metadata

def analyze_column_quality(df, col):
    """Analyze quality metrics for a single column"""
    series = df[col]
    total = len(series)

    # Basic counts
    null_count = series.isnull().sum()
    null_pct = round(null_count / total * 100, 2)

    # Non-null analysis
    non_null = series.dropna()
    unique_count = series.nunique()

    quality = {
        'original_name': repr(col),
        'dtype': str(series.dtype),
        'null_count': int(null_count),
        'null_pct': null_pct,
        'non_null_count': int(total - null_count),
        'unique_count': int(unique_count),
        'unique_pct': round(unique_count / total * 100, 2) if total > 0 else 0
    }

    # Flag columns for removal
    quality['flags'] = []
    if null_pct == 100:
        quality['flags'].append('FULLY_NULL')
    elif null_pct >= 95:
        quality['flags'].append('NEAR_NULL')

    if unique_count == 1 and null_count < total:
        quality['flags'].append('SINGLE_VALUE')
    elif unique_count == 2 and null_count > 0:
        # Only one actual value plus nulls
        if non_null.nunique() == 1:
            quality['flags'].append('SINGLE_VALUE_WITH_NULLS')

    # Value frequency analysis for categorical columns
    if series.dtype == 'object' or unique_count <= 50:
        value_counts = series.value_counts(dropna=False)
        top_value_count = value_counts.iloc[0] if len(value_counts) > 0 else 0
        top_value_pct = round(top_value_count / total * 100, 2)

        if top_value_pct >= 99 and unique_count > 1:
            quality['flags'].append('NEAR_CONSTANT')

        quality['top_values'] = []
        for val, cnt in value_counts.head(20).items():
            quality['top_values'].append({
                'value': str(val) if pd.notna(val) else 'NULL',
                'count': int(cnt),
                'pct': round(cnt / total * 100, 2)
            })

    # Numeric statistics
    if pd.api.types.is_numeric_dtype(series):
        quality['stats'] = {
            'min': float(series.min()) if pd.notna(series.min()) else None,
            'max': float(series.max()) if pd.notna(series.max()) else None,
            'mean': round(float(series.mean()), 4) if pd.notna(series.mean()) else None,
            'median': float(series.median()) if pd.notna(series.median()) else None,
            'std': round(float(series.std()), 4) if pd.notna(series.std()) else None,
            'zeros': int((series == 0).sum()),
            'negatives': int((series < 0).sum())
        }

        # Percentiles
        try:
            percentiles = series.quantile([0.25, 0.5, 0.75, 0.9, 0.99]).to_dict()
            quality['stats']['percentiles'] = {str(k): round(float(v), 4) for k, v in percentiles.items()}
        except:
            pass

    # Sample values
    non_null_sample = non_null.head(5).tolist()
    quality['sample_values'] = [str(v) for v in non_null_sample]

    return quality

def check_duplicates(df):
    """Check for duplicate rows"""
    dup_count = df.duplicated().sum()
    return {
        'total_duplicates': int(dup_count),
        'duplicate_pct': round(dup_count / len(df) * 100, 2)
    }

def clean_column_name(name):
    """Clean column name to standard format"""
    # Remove leading/trailing whitespace and newlines
    cleaned = str(name).strip().replace('\n', '_').replace('\r', '')
    # Replace spaces with underscores
    cleaned = cleaned.replace(' ', '_')
    # Remove special characters except underscores
    import re
    cleaned = re.sub(r'[^\w]', '', cleaned)
    # Convert to lowercase
    cleaned = cleaned.lower()
    return cleaned

def profile_data(df):
    """Generate comprehensive data profile"""
    print("Profiling data...")

    profile = {
        'metadata': basic_metadata(df, INPUT_FILE),
        'duplicates': check_duplicates(df),
        'columns': {}
    }

    for col in df.columns:
        print(f"  Analyzing column: {repr(col)}")
        profile['columns'][str(col)] = analyze_column_quality(df, col)

    return profile

def identify_columns_to_remove(profile):
    """Identify columns that should be removed"""
    to_remove = []
    for col_name, col_info in profile['columns'].items():
        if 'FULLY_NULL' in col_info.get('flags', []) or 'SINGLE_VALUE' in col_info.get('flags', []):
            to_remove.append({
                'column': col_name,
                'original': col_info['original_name'],
                'reason': ', '.join(col_info['flags'])
            })
    return to_remove

def clean_dataframe(df, profile):
    """Clean the DataFrame based on profile analysis"""
    print("Cleaning data...")

    cleaned_df = df.copy()
    cleaning_log = {
        'columns_removed': [],
        'columns_renamed': [],
        'values_standardized': [],
        'rows_removed': 0
    }

    # Remove flagged columns
    cols_to_remove = []
    for col_name, col_info in profile['columns'].items():
        if 'FULLY_NULL' in col_info.get('flags', []) or 'SINGLE_VALUE' in col_info.get('flags', []):
            cols_to_remove.append(col_name)
            cleaning_log['columns_removed'].append({
                'column': col_name,
                'reason': ', '.join(col_info['flags'])
            })

    # Find actual column objects to remove
    for col in df.columns:
        if str(col) in cols_to_remove:
            cleaned_df = cleaned_df.drop(columns=[col])

    # Rename columns
    rename_map = {}
    for col in cleaned_df.columns:
        new_name = clean_column_name(col)
        if new_name != str(col):
            rename_map[col] = new_name
            cleaning_log['columns_renamed'].append({
                'original': repr(col),
                'new': new_name
            })

    cleaned_df = cleaned_df.rename(columns=rename_map)

    # Strip whitespace from string columns
    for col in cleaned_df.select_dtypes(include=['object']).columns:
        cleaned_df[col] = cleaned_df[col].apply(lambda x: x.strip() if isinstance(x, str) else x)

    # Remove duplicate rows
    original_rows = len(cleaned_df)
    cleaned_df = cleaned_df.drop_duplicates()
    rows_removed = original_rows - len(cleaned_df)
    cleaning_log['rows_removed'] = rows_removed

    return cleaned_df, cleaning_log

def generate_markdown_report(profile, cleaning_log, df_original, df_cleaned):
    """Generate comprehensive markdown report"""
    print("Generating markdown report...")

    md = []
    md.append("# Data Profile: CSPLIT (CPLIT 1000 Records.xlsx)")
    md.append("")
    md.append(f"**Generated**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    md.append("")

    # Executive Summary
    md.append("## Executive Summary")
    md.append("")
    md.append("### What This Data Represents")
    md.append("The CSPLIT table contains comprehensive rental contract information for Hertz's insurance replacement business. This is the main operational table that captures split billing details and complete rental transaction records. Each row represents a rental contract/reservation with associated customer, vehicle, location, and billing information.")
    md.append("")

    md.append("### Key Statistics")
    metadata = profile['metadata']
    md.append(f"- **Original File Size**: {metadata['file_size_kb']} KB")
    md.append(f"- **Original Rows**: {metadata['total_rows']}")
    md.append(f"- **Original Columns**: {metadata['total_columns']}")
    md.append(f"- **Processed Rows**: {len(df_cleaned)}")
    md.append(f"- **Processed Columns**: {len(df_cleaned.columns)}")
    md.append(f"- **Columns Removed**: {len(cleaning_log['columns_removed'])}")
    md.append(f"- **Duplicate Rows Removed**: {cleaning_log['rows_removed']}")
    md.append("")

    # Target variable summary
    rent_ind_col = None
    for col_name in profile['columns'].keys():
        if 'RENT_IND' in col_name.upper():
            rent_ind_col = col_name
            break

    if rent_ind_col:
        col_info = profile['columns'][rent_ind_col]
        md.append("### Target Variable (RENT_IND) Summary")
        if 'top_values' in col_info:
            for val_info in col_info['top_values'][:3]:
                md.append(f"- **{val_info['value']}**: {val_info['count']} ({val_info['pct']}%)")
        md.append("")

    md.append("### Overall Data Quality Assessment")
    fully_null_count = sum(1 for c in profile['columns'].values() if 'FULLY_NULL' in c.get('flags', []))
    near_null_count = sum(1 for c in profile['columns'].values() if 'NEAR_NULL' in c.get('flags', []))
    single_val_count = sum(1 for c in profile['columns'].values() if 'SINGLE_VALUE' in c.get('flags', []))

    if fully_null_count == 0 and near_null_count == 0 and single_val_count < 3:
        md.append("**Quality**: Good - Data is well-populated with few quality issues.")
    elif fully_null_count <= 2 and near_null_count <= 3:
        md.append("**Quality**: Fair - Some columns have quality issues but core data is usable.")
    else:
        md.append("**Quality**: Needs Attention - Multiple columns have significant quality issues.")

    md.append(f"- Fully null columns: {fully_null_count}")
    md.append(f"- Near-null columns (>95% missing): {near_null_count}")
    md.append(f"- Single-value columns: {single_val_count}")
    md.append("")

    # Questions for Stakeholders
    md.append("## Questions for Stakeholders")
    md.append("")
    md.append("1. **RENT_IND Definition**: Please confirm that RENT_IND=1 indicates a successful conversion (customer rented) and RENT_IND=0 indicates no rental occurred.")
    md.append("2. **Date Fields**: Multiple date fields exist (RES_DATE, CHKOUT_DATE, CHKIN_DATE, etc.). What is the key date to use for time-series analysis?")
    md.append("3. **Location Codes**: Various location-related fields exist (RENTAL_LOC, CHKOUT_LOC, CHKIN_LOC, HOME_LOC, RPU_LOC, etc.). Which location is most relevant for analysis?")
    md.append("4. **Insurance Partner Codes**: What do the ACCT_CODE, CC_NBR, and BT_NBR values represent? Are these insurance company identifiers?")
    md.append("5. **Financial Fields**: Several dollar amount fields exist. Which represents the primary rental revenue?")
    md.append("6. **NULL Values**: Some columns have significant null values. Are these expected or data quality issues?")
    md.append("7. **REP_ID Fields**: What do REP_ID, HLES_REP_ID represent? Are these sales representatives?")
    md.append("")

    # Data Quality Summary
    md.append("## Data Quality Summary")
    md.append("")

    md.append("### Columns Removed")
    md.append("")
    md.append("| Column | Reason | Notes |")
    md.append("|--------|--------|-------|")
    if cleaning_log['columns_removed']:
        for item in cleaning_log['columns_removed']:
            md.append(f"| {item['column']} | {item['reason']} | Automatically removed |")
    else:
        md.append("| None | - | No columns met removal criteria |")
    md.append("")

    md.append("### Quality Issues Found")
    md.append("")
    md.append("| Issue Type | Columns Affected | Count |")
    md.append("|------------|------------------|-------|")
    md.append(f"| Fully Null (100% missing) | {', '.join([c for c,v in profile['columns'].items() if 'FULLY_NULL' in v.get('flags', [])][:5]) or 'None'} | {fully_null_count} |")
    md.append(f"| Near Null (>95% missing) | {', '.join([c for c,v in profile['columns'].items() if 'NEAR_NULL' in v.get('flags', [])][:5]) or 'None'} | {near_null_count} |")
    md.append(f"| Single Value | {', '.join([c for c,v in profile['columns'].items() if 'SINGLE_VALUE' in v.get('flags', [])][:5]) or 'None'} | {single_val_count} |")
    md.append("")

    # Column Dictionary
    md.append("## Column Dictionary")
    md.append("")

    for col_name, col_info in profile['columns'].items():
        cleaned_name = clean_column_name(col_name)
        md.append(f"### {cleaned_name}")
        md.append("")

        if col_info['original_name'] != f"'{cleaned_name}'":
            md.append(f"- **Original Name**: {col_info['original_name']}")
        md.append(f"- **Data Type**: {col_info['dtype']}")

        # Infer description based on column name
        desc = infer_column_description(col_name)
        md.append(f"- **Description**: {desc}")

        # Quality assessment
        quality = "Good"
        if col_info['null_pct'] > 50:
            quality = "Poor"
        elif col_info['null_pct'] > 20:
            quality = "Fair"
        md.append(f"- **Quality**: {quality} ({col_info['null_pct']}% null)")

        md.append(f"- **Unique Values**: {col_info['unique_count']} ({col_info['unique_pct']}%)")

        if 'stats' in col_info:
            stats = col_info['stats']
            md.append(f"- **Statistics**:")
            md.append(f"  - Min: {stats.get('min')}, Max: {stats.get('max')}")
            md.append(f"  - Mean: {stats.get('mean')}, Median: {stats.get('median')}")
            md.append(f"  - Std Dev: {stats.get('std')}")
            md.append(f"  - Zeros: {stats.get('zeros')}, Negatives: {stats.get('negatives')}")

        if 'top_values' in col_info and col_info['top_values']:
            md.append(f"- **Top Values**:")
            for val_info in col_info['top_values'][:10]:
                md.append(f"  - {val_info['value']}: {val_info['count']} ({val_info['pct']}%)")

        if col_info['sample_values']:
            md.append(f"- **Sample Values**: {', '.join(col_info['sample_values'][:5])}")

        if col_info.get('flags'):
            md.append(f"- **Flags**: {', '.join(col_info['flags'])}")

        md.append("")

    # Cleaning Transformations
    md.append("## Cleaning Transformations Applied")
    md.append("")

    md.append("### Column Operations")
    md.append("")
    md.append("| Action | Column(s) | Details | Reason |")
    md.append("|--------|-----------|---------|--------|")
    for item in cleaning_log['columns_removed']:
        md.append(f"| Removed | {item['column']} | - | {item['reason']} |")
    for item in cleaning_log['columns_renamed']:
        md.append(f"| Renamed | {item['original']} | -> {item['new']} | Standardize naming |")
    md.append("")

    md.append("### Row Operations")
    md.append("")
    md.append("| Action | Count | Criteria |")
    md.append("|--------|-------|----------|")
    md.append(f"| Duplicates removed | {cleaning_log['rows_removed']} | Exact match on all columns |")
    md.append("")

    md.append("### Summary Statistics")
    md.append("")
    md.append(f"- **Original**: {metadata['total_rows']} rows, {metadata['total_columns']} columns")
    md.append(f"- **Processed**: {len(df_cleaned)} rows, {len(df_cleaned.columns)} columns")
    md.append(f"- **Columns removed**: {len(cleaning_log['columns_removed'])}")
    md.append(f"- **Rows removed**: {cleaning_log['rows_removed']}")
    md.append("")

    # Recommendations
    md.append("## Recommendations")
    md.append("")
    md.append("### Columns of Particular Interest for Conversion Analysis")
    md.append("")
    md.append("1. **RENT_IND** (Target Variable): The primary outcome variable for conversion analysis")
    md.append("2. **RES_DATE / CHKOUT_DATE**: Key temporal variables for time-series analysis")
    md.append("3. **ACCT_CODE / CC_NBR**: Insurance partner identifiers for segmentation")
    md.append("4. **RENTAL_LOC / HOME_LOC**: Geographic analysis dimensions")
    md.append("5. **DAYS_CHRG**: Rental duration - potential predictor of conversion")
    md.append("6. **Revenue fields**: Financial impact analysis")
    md.append("")

    md.append("### Suggested Next Steps")
    md.append("")
    md.append("1. **Validate RENT_IND interpretation** with stakeholders")
    md.append("2. **Calculate baseline conversion rate**: sum(RENT_IND) / count(*)")
    md.append("3. **Time series analysis**: Look for conversion trends over RES_DATE or CHKOUT_DATE")
    md.append("4. **Segmentation analysis**: Compare conversion rates by ACCT_CODE, location, day of week")
    md.append("5. **Join with other tables**: Link to CRESER (reservations) and TRANSLOG (customer contacts) for fuller picture")
    md.append("6. **Review near-null columns**: Determine if data is missing systematically")
    md.append("")

    md.append("### Potential Relationships to Explore")
    md.append("")
    md.append("1. Does rental duration (DAYS_CHRG) correlate with conversion?")
    md.append("2. Do certain insurance partners (ACCT_CODE) have higher conversion rates?")
    md.append("3. Are there location-based patterns in conversion?")
    md.append("4. Is there seasonality or day-of-week effects on conversion?")
    md.append("5. How does time between reservation and checkout affect conversion?")
    md.append("")

    return '\n'.join(md)

def infer_column_description(col_name):
    """Infer business meaning from column name"""
    col_upper = str(col_name).upper().strip()

    descriptions = {
        'RES_ID': 'Reservation identifier - unique ID for each reservation',
        'RENT_IND': 'Rental indicator - TARGET VARIABLE: 1=converted to rental, 0=not converted',
        'RES_DATE': 'Reservation date - when the reservation was created',
        'CHKOUT_DATE': 'Checkout date - when customer picked up the vehicle',
        'CHKIN_DATE': 'Check-in date - when customer returned the vehicle',
        'ACCT_CODE': 'Account code - likely identifies the insurance partner/account',
        'CC_NBR': 'Customer/Company number - identifier for the insurance company',
        'BT_NBR': 'Bill-to number - billing account identifier',
        'RENTAL_LOC': 'Rental location - where the rental transaction occurred',
        'HOME_LOC': 'Home location - customer\'s home or primary Hertz location',
        'CHKOUT_LOC': 'Checkout location - where vehicle was picked up',
        'CHKIN_LOC': 'Check-in location - where vehicle was returned',
        'RPU_LOC': 'Return/Pick-up location',
        'CAR_CLASS': 'Vehicle class/category (e.g., compact, midsize, SUV)',
        'DAYS_CHRG': 'Days charged - number of days billed for the rental',
        'REP_ID': 'Representative ID - sales or service rep identifier',
        'HLES_REP_ID': 'HLES system representative ID',
        'TTL_REV': 'Total revenue from the rental',
        'NET_REV': 'Net revenue after discounts/adjustments',
        'T_E_REV': 'Time and expense revenue component',
        'T_E_COST': 'Time and expense cost component',
        'CAR_SEQ': 'Car sequence number',
        'STATUS': 'Reservation or rental status',
        'SVC_TYPE': 'Service type category',
        'CLM_NBR': 'Claim number - insurance claim identifier',
        'CUST_NAME': 'Customer name',
        'PHONE': 'Customer phone number',
        'EMAIL': 'Customer email address',
        'STATE': 'State/Province code',
        'CITY': 'City name',
        'ZIP': 'ZIP/Postal code'
    }

    # Check for exact or partial matches
    for key, desc in descriptions.items():
        if key in col_upper:
            return desc

    # Generic inference based on patterns
    if 'DATE' in col_upper or 'DT' in col_upper:
        return 'Date field - specific meaning to be confirmed'
    if 'AMT' in col_upper or 'AMOUNT' in col_upper or '$' in col_upper:
        return 'Dollar amount - financial field'
    if 'REV' in col_upper:
        return 'Revenue-related field'
    if 'COST' in col_upper:
        return 'Cost-related field'
    if 'LOC' in col_upper:
        return 'Location identifier'
    if 'NBR' in col_upper or 'NUM' in col_upper or 'ID' in col_upper:
        return 'Identifier or reference number'
    if 'IND' in col_upper or 'FLAG' in col_upper:
        return 'Indicator/flag field (typically 0/1 or Y/N)'
    if 'CODE' in col_upper or 'CD' in col_upper:
        return 'Code field - categorical identifier'

    return 'Business meaning to be confirmed with stakeholders'

def main():
    """Main execution function"""
    print("=" * 60)
    print("CSPLIT Data Profiler")
    print("=" * 60)

    # Load data
    df = load_data()
    print(f"Loaded {len(df)} rows, {len(df.columns)} columns")

    # Profile data
    profile = profile_data(df)

    # Clean data
    df_cleaned, cleaning_log = clean_dataframe(df, profile)
    print(f"Cleaned data: {len(df_cleaned)} rows, {len(df_cleaned.columns)} columns")

    # Save processed CSV
    print(f"Saving processed CSV to {OUTPUT_CSV}")
    df_cleaned.to_csv(OUTPUT_CSV, index=False)

    # Save profile JSON
    print(f"Saving profile JSON to {OUTPUT_JSON}")
    with open(OUTPUT_JSON, 'w') as f:
        json.dump({'profile': profile, 'cleaning_log': cleaning_log}, f, indent=2, default=str)

    # Generate and save markdown report
    md_report = generate_markdown_report(profile, cleaning_log, df, df_cleaned)
    print(f"Saving markdown report to {OUTPUT_MD}")
    with open(OUTPUT_MD, 'w') as f:
        f.write(md_report)

    print("=" * 60)
    print("PROFILING COMPLETE")
    print(f"Processed CSV: {OUTPUT_CSV}")
    print(f"Profile Markdown: {OUTPUT_MD}")
    print(f"Profile JSON: {OUTPUT_JSON}")
    print("=" * 60)

    # Print summary to console
    print("\n=== QUICK SUMMARY ===")
    print(f"Original: {profile['metadata']['total_rows']} rows x {profile['metadata']['total_columns']} columns")
    print(f"Processed: {len(df_cleaned)} rows x {len(df_cleaned.columns)} columns")
    print(f"Columns removed: {len(cleaning_log['columns_removed'])}")
    print(f"Duplicates removed: {cleaning_log['rows_removed']}")

    # Print RENT_IND summary
    for col_name in profile['columns'].keys():
        if 'RENT_IND' in col_name.upper():
            col_info = profile['columns'][col_name]
            print(f"\n=== TARGET VARIABLE: {col_name} ===")
            if 'top_values' in col_info:
                for val_info in col_info['top_values']:
                    print(f"  {val_info['value']}: {val_info['count']} ({val_info['pct']}%)")
            break

if __name__ == '__main__':
    main()
