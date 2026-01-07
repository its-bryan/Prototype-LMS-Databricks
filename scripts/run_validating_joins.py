#!/usr/bin/env python3
"""
Validating Joins

Extracted from .claude/skills/validating-joins/SKILL.md

Usage:
    python scripts/run_validating_joins.py [options]
"""

import argparse
import sys
from pathlib import Path

# ============================================================================
# Core Functions (extracted from SKILL.md)
# ============================================================================

import pandas as pd
import numpy as np

def validate_join(left_df, right_df, left_key, right_key=None,
                  left_name='left', right_name='right'):
    """
    Validate a proposed join between two DataFrames.

    Parameters:
        left_df: Left DataFrame
        right_df: Right DataFrame
        left_key: Column name(s) in left_df (str or list)
        right_key: Column name(s) in right_df (defaults to left_key)
        left_name: Display name for left table
        right_name: Display name for right table

    Returns:
        dict with validation results
    """
    if right_key is None:
        right_key = left_key

    # Handle composite keys
    if isinstance(left_key, str):
        left_key = [left_key]
    if isinstance(right_key, str):
        right_key = [right_key]

    # Extract key values
    left_keys = left_df[left_key].copy()
    right_keys = right_df[right_key].copy()

    # For composite keys, create tuple representation
    if len(left_key) > 1:
        left_values = set(left_keys.apply(tuple, axis=1))
        right_values = set(right_keys.apply(tuple, axis=1))
        left_key_series = left_keys.apply(tuple, axis=1)
        right_key_series = right_keys.apply(tuple, axis=1)
    else:
        left_values = set(left_keys[left_key[0]].dropna())
        right_values = set(right_keys[right_key[0]].dropna())
        left_key_series = left_keys[left_key[0]]
        right_key_series = right_keys[right_key[0]]

    # Basic counts
    results = {
        'left_table': left_name,
        'right_table': right_name,
        'left_key': left_key,
        'right_key': right_key,
        'left_rows': len(left_df),
        'right_rows': len(right_df),
    }

    # Null keys
    left_nulls = left_key_series.isna().sum()
    right_nulls = right_key_series.isna().sum()
    results['null_keys'] = {
        'left': int(left_nulls),
        'left_pct': round(left_nulls / len(left_df) * 100, 2),
        'right': int(right_nulls),
        'right_pct': round(right_nulls / len(right_df) * 100, 2),
    }

    # Unique keys
    left_unique = len(left_values)
    right_unique = len(right_values)
    results['unique_keys'] = {
        'left': left_unique,
        'right': right_unique,
    }

    # Duplicate keys
    left_dupes = left_key_series.duplicated().sum()
    right_dupes = right_key_series.duplicated().sum()
    results['duplicate_keys'] = {
        'left': int(left_dupes),
        'left_pct': round(left_dupes / len(left_df) * 100, 2),
        'right': int(right_dupes),
        'right_pct': round(right_dupes / len(right_df) * 100, 2),
    }

    # Match analysis
    matched = left_values & right_values
    left_only = left_values - right_values
    right_only = right_values - left_values

    results['match_rate'] = {
        'matched_keys': len(matched),
        'left_match_pct': round(len(matched) / left_unique * 100, 2) if left_unique > 0 else 0,
        'right_match_pct': round(len(matched) / right_unique * 100, 2) if right_unique > 0 else 0,
    }

    results['orphans'] = {
        'left_only': len(left_only),
        'left_only_pct': round(len(left_only) / left_unique * 100, 2) if left_unique > 0 else 0,
        'right_only': len(right_only),
        'right_only_pct': round(len(right_only) / right_unique * 100, 2) if right_unique > 0 else 0,
    }

    # Sample orphans for debugging
    if left_only:
        results['orphans']['left_examples'] = list(left_only)[:5]
    if right_only:
        results['orphans']['right_examples'] = list(right_only)[:5]

    # Cardinality
    left_key_counts = left_key_series.value_counts()
    right_key_counts = right_key_series.value_counts()

    left_is_unique = (left_key_counts == 1).all()
    right_is_unique = (right_key_counts == 1).all()

    if left_is_unique and right_is_unique:
        cardinality = '1:1'
    elif left_is_unique and not right_is_unique:
        cardinality = '1:many'
    elif not left_is_unique and right_is_unique:
        cardinality = 'many:1'
    else:
        cardinality = 'many:many'

    results['cardinality'] = {
        'type': cardinality,
        'left_max_dupes': int(left_key_counts.max()),
        'right_max_dupes': int(right_key_counts.max()),
    }

    # Row multiplication estimate
    if cardinality == '1:1':
        estimated_rows = len(matched)
    elif cardinality == '1:many':
        # Each left row matches multiple right rows
        estimated_rows = len(left_df)  # Upper bound
    elif cardinality == 'many:1':
        estimated_rows = len(left_df)
    else:
        # many:many - could explode
        estimated_rows = '⚠️ Risk of row explosion'

    results['join_estimate'] = {
        'inner_join_rows': len(matched),
        'left_join_rows': len(left_df),
        'estimated_result_rows': estimated_rows,
    }

    # Validation verdict
    issues = []
    if results['match_rate']['left_match_pct'] < 90:
        issues.append(f"Low match rate: only {results['match_rate']['left_match_pct']}% of left keys found in right")
    if results['null_keys']['left_pct'] > 5:
        issues.append(f"High null rate in left key: {results['null_keys']['left_pct']}%")
    if cardinality == 'many:many':
        issues.append("Many-to-many relationship: risk of row explosion")
    if results['orphans']['left_only_pct'] > 20:
        issues.append(f"{results['orphans']['left_only_pct']}% of left keys have no match")

    results['validation'] = {
        'status': 'pass' if not issues else 'warning' if len(issues) <= 1 else 'fail',
        'issues': issues,
        'recommendation': _get_recommendation(results, cardinality, issues)
    }

    return results


def _get_recommendation(results, cardinality, issues):
    """Generate join recommendation based on validation results."""
    if not issues:
        if cardinality == '1:1':
            return "Clean 1:1 join. Safe to use inner or left join."
        elif cardinality == '1:many':
            return "1:many relationship. Left join will preserve all left rows; expect row multiplication."
        elif cardinality == 'many:1':
            return "Many:1 relationship. Inner join is safe; rows from left will match one right row."
        else:
            return "Many:many relationship. Consider aggregating one side first."

    recommendations = []
    if 'Low match rate' in str(issues):
        recommendations.append("Check if key columns are correctly identified. May need composite key.")
    if 'null rate' in str(issues):
        recommendations.append("Filter out null keys before joining, or use outer join and handle nulls.")
    if 'many:many' in str(issues).lower():
        recommendations.append("Aggregate one DataFrame before joining to avoid row explosion.")
    if 'no match' in str(issues):
        recommendations.append("Investigate orphan records. May indicate data quality issue or expected filtering.")

    return " ".join(recommendations)


def test_composite_key(df, columns, name='df'):
    """
    Test if a set of columns forms a valid composite key.
    """
    key = df[columns].apply(tuple, axis=1)

    results = {
        'columns': columns,
        'total_rows': len(df),
        'unique_combinations': key.nunique(),
        'is_unique_key': key.nunique() == len(df),
        'duplicate_count': key.duplicated().sum(),
    }

    if not results['is_unique_key']:
        dupe_keys = key[key.duplicated(keep=False)]
        results['duplicate_examples'] = df[key.isin(dupe_keys.unique()[:3])][columns].head(10).to_dict('records')

    return results



# ============================================================================
# CLI Interface
# ============================================================================

def main():
    """Main CLI interface."""
    parser = argparse.ArgumentParser(
        description='Validating Joins',
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
