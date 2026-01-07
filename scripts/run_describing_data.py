#!/usr/bin/env python3
"""
Describing Data

Extracted from .claude/skills/describing-data/SKILL.md

Usage:
    python scripts/run_describing_data.py [options]
"""

import argparse
import sys
from pathlib import Path

# ============================================================================
# Core Functions (extracted from SKILL.md)
# ============================================================================

import pandas as pd
import numpy as np
from collections import Counter

def describe_dataset(df, name='df'):
    """
    Generate comprehensive descriptive statistics for a DataFrame.

    Returns detailed overview including:
    - Shape and memory usage
    - Column-by-column analysis
    - Data quality metrics
    - Value distributions
    """

    report = {
        'dataset_name': name,
        'overview': {},
        'columns': [],
        'quality': {},
        'summary': {}
    }

    # ===== OVERVIEW =====
    report['overview'] = {
        'rows': len(df),
        'columns': len(df.columns),
        'memory_mb': round(df.memory_usage(deep=True).sum() / 1024**2, 2),
        'total_cells': len(df) * len(df.columns),
        'dtypes': df.dtypes.value_counts().to_dict()
    }

    # ===== COLUMN-BY-COLUMN ANALYSIS =====
    for col in df.columns:
        col_info = {
            'name': col,
            'dtype': str(df[col].dtype),
            'non_null_count': int(df[col].notna().sum()),
            'null_count': int(df[col].isna().sum()),
            'null_pct': round(df[col].isna().mean() * 100, 2),
            'unique_count': int(df[col].nunique()),
            'unique_pct': round(df[col].nunique() / len(df) * 100, 2) if len(df) > 0 else 0
        }

        # Get non-null values
        non_null = df[col].dropna()

        # Numeric columns
        if pd.api.types.is_numeric_dtype(df[col]):
            if len(non_null) > 0:
                col_info['stats'] = {
                    'min': float(non_null.min()),
                    'max': float(non_null.max()),
                    'mean': round(float(non_null.mean()), 2),
                    'median': float(non_null.median()),
                    'std': round(float(non_null.std()), 2),
                    'q25': float(non_null.quantile(0.25)),
                    'q75': float(non_null.quantile(0.75))
                }

                # Top values for low-cardinality numeric columns
                if col_info['unique_count'] <= 20:
                    value_counts = non_null.value_counts().head(10)
                    col_info['value_distribution'] = {
                        str(k): int(v) for k, v in value_counts.items()
                    }

        # Categorical/Object columns
        else:
            if len(non_null) > 0:
                value_counts = non_null.value_counts()

                # Top values
                top_n = min(10, len(value_counts))
                col_info['top_values'] = {
                    str(k): int(v) for k, v in value_counts.head(top_n).items()
                }

                # Most common value
                col_info['most_common'] = str(value_counts.index[0])
                col_info['most_common_count'] = int(value_counts.iloc[0])
                col_info['most_common_pct'] = round(value_counts.iloc[0] / len(non_null) * 100, 2)

                # Sample values
                col_info['sample_values'] = [str(v) for v in non_null.head(5).tolist()]

        # Infer meaning from HLES context
        col_info['inferred_meaning'] = infer_column_meaning(col, df[col])

        report['columns'].append(col_info)

    # ===== DATA QUALITY SUMMARY =====

    # Duplicate rows
    duplicate_rows = df.duplicated().sum()
    report['quality']['duplicate_rows'] = {
        'count': int(duplicate_rows),
        'pct': round(duplicate_rows / len(df) * 100, 2) if len(df) > 0 else 0
    }

    # Completely null columns
    null_cols = [col for col in df.columns if df[col].isna().all()]
    report['quality']['completely_null_columns'] = null_cols

    # Constant columns (single unique value)
    constant_cols = [col for col in df.columns if df[col].nunique() <= 1]
    report['quality']['constant_columns'] = constant_cols

    # High null columns (>50%)
    high_null_cols = [col for col in df.columns if df[col].isna().mean() > 0.5]
    report['quality']['high_null_columns'] = {
        col: round(df[col].isna().mean() * 100, 2) for col in high_null_cols
    }

    # ===== SUMMARY STATISTICS =====
    report['summary'] = {
        'total_nulls': int(df.isna().sum().sum()),
        'null_density_pct': round(df.isna().mean().mean() * 100, 2),
        'columns_with_nulls': int((df.isna().sum() > 0).sum()),
        'numeric_columns': int(df.select_dtypes(include=[np.number]).shape[1]),
        'categorical_columns': int(df.select_dtypes(include=['object']).shape[1]),
        'datetime_columns': int(df.select_dtypes(include=['datetime64']).shape[1])
    }

    return report


def infer_column_meaning(col_name, series):
    """
    Infer the meaning of a column based on HLES domain knowledge.
    """
    col_lower = col_name.lower()

    # HLES-specific column meanings
    hles_mappings = {
        'rent_ind': 'Rental indicator: 1 = lead converted to rental, 0 = did not convert (PRIMARY OUTCOME)',
        'cancel_id': 'Cancellation indicator: 1 = customer cancelled reservation',
        'unused_ind': 'Unused indicator: 1 = reservation expired without conversion or cancellation',
        'res_id': 'Reservation indicator: 1 = valid reservation record',
        'confirmation_number': 'Unique reservation identifier (recycled after ~6 months)',
        'confirm_num': 'Unique reservation identifier (recycled after ~6 months)',
        'initial_date': 'Date reservation was created',
        'checkout_date': 'Date customer picked up rental vehicle',
        'contact_range': 'Time bucket for first contact (< 30min, 30min-1hr, 1-3hrs, etc.)',
        'contact_group': 'Contact source: HRD (call center), Counter (local branch), NO CONTACT',
        'hours_difference': 'Hours between reservation creation and first contact',
        'cdp_name': 'Insurance partner name (Corporate Discount Program)',
        'rent_loc': 'Rental location/branch code',
        'bodyshop': 'Body shop name where vehicle is being repaired',
        'bodyshopid': 'Body shop identifier code',
        'knum': 'Rental agreement number (H-prefix indicates conversion)',
        'msg10': 'MMR (Make My Reservation) digital flow status',
        'cancel_reason': 'Free-text reason for cancellation (often incomplete)',
        'pickupservice': 'Indicator if customer requested pickup service',
        'date_out': 'Scheduled pickup date/time',
        'exp_date': 'Reservation expiration date',
        'date_booked': 'Date/time reservation was booked'
    }

    # Check exact matches
    if col_lower in hles_mappings:
        return hles_mappings[col_lower]

    # Check partial matches
    if 'date' in col_lower or 'time' in col_lower:
        return 'Date/time field'
    if 'id' in col_lower or 'num' in col_lower or 'code' in col_lower:
        return 'Identifier or code'
    if 'ind' in col_lower or 'flag' in col_lower:
        return 'Binary indicator (0/1 or yes/no)'
    if 'pct' in col_lower or 'percent' in col_lower:
        return 'Percentage value'
    if 'amt' in col_lower or 'amount' in col_lower or 'pay' in col_lower:
        return 'Monetary amount'
    if 'name' in col_lower or 'desc' in col_lower:
        return 'Text description or name'
    if 'loc' in col_lower or 'location' in col_lower:
        return 'Location identifier'

    # Infer from data
    unique_ratio = series.nunique() / len(series) if len(series) > 0 else 0
    if unique_ratio > 0.95:
        return 'Likely unique identifier (high cardinality)'
    elif unique_ratio < 0.05:
        return 'Likely categorical/grouping variable (low cardinality)'

    return 'Unknown - requires domain knowledge'


def describe_column(df, col_name):
    """
    Generate detailed description for a single column.
    """
    if col_name not in df.columns:
        return {'error': f'Column {col_name} not found in DataFrame'}

    series = df[col_name]
    non_null = series.dropna()

    description = {
        'column': col_name,
        'dtype': str(series.dtype),
        'total_values': len(series),
        'non_null': len(non_null),
        'null_count': series.isna().sum(),
        'null_pct': round(series.isna().mean() * 100, 2),
        'unique_count': series.nunique(),
        'unique_pct': round(series.nunique() / len(series) * 100, 2) if len(series) > 0 else 0,
        'inferred_meaning': infer_column_meaning(col_name, series)
    }

    if pd.api.types.is_numeric_dtype(series) and len(non_null) > 0:
        description['statistics'] = {
            'min': float(non_null.min()),
            'max': float(non_null.max()),
            'mean': round(float(non_null.mean()), 2),
            'median': float(non_null.median()),
            'std': round(float(non_null.std()), 2),
            'q25': float(non_null.quantile(0.25)),
            'q75': float(non_null.quantile(0.75))
        }

    if len(non_null) > 0:
        value_counts = non_null.value_counts()
        description['value_distribution'] = {
            'unique_values': series.nunique(),
            'top_10_values': {str(k): int(v) for k, v in value_counts.head(10).items()},
            'sample_values': [str(v) for v in non_null.head(10).tolist()]
        }

    return description



# ============================================================================
# CLI Interface
# ============================================================================

def main():
    """Main CLI interface."""
    parser = argparse.ArgumentParser(
        description='Describing Data',
        formatter_class=argparse.RawDescriptionHelpFormatter
    )

    # TODO: Add arguments based on the skill's requirements
    parser.add_argument('input', help='Input parameter')
    parser.add_argument('--format', choices=['markdown', 'json'], default='markdown',
                       help='Output format')
    parser.add_argument('--output', help='Output file path')

    args = parser.parse_args()

    # TODO: Implement CLI logic
    print("Script execution not yet implemented")
    print(f"Input: {args.input}")

    return 0


if __name__ == '__main__':
    sys.exit(main())
