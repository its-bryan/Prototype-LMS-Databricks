#!/usr/bin/env python3
"""
Data Quality Checker

Detects data quality issues in DataFrames including nulls, duplicates,
outliers, invalid values, and format inconsistencies.

Usage:
    python scripts/run_checking_quality.py <dataframe_name>
    python scripts/run_checking_quality.py <file.csv>
    python scripts/run_checking_quality.py <file.xlsx> --config validations.yaml
"""

import argparse
import json
import sys
from pathlib import Path
from datetime import datetime

import pandas as pd
import numpy as np


# ============================================================================
# Quality Check Functions (extracted from SKILL.md)
# ============================================================================

def check_nulls(df):
    """Check null values by column."""
    null_counts = df.isnull().sum()
    null_pcts = (df.isnull().mean() * 100).round(2)

    results = pd.DataFrame({
        'null_count': null_counts,
        'null_pct': null_pcts,
        'severity': pd.cut(null_pcts, bins=[-1, 0, 5, 20, 50, 100],
                          labels=['none', 'low', 'medium', 'high', 'critical'])
    })

    return results[results['null_count'] > 0].sort_values('null_pct', ascending=False)


def check_duplicates(df, key_columns=None):
    """Check for duplicate rows or duplicate keys."""
    results = {
        'total_rows': len(df),
        'duplicate_rows': df.duplicated().sum(),
        'duplicate_pct': round(df.duplicated().mean() * 100, 2)
    }

    if key_columns:
        if isinstance(key_columns, str):
            key_columns = [key_columns]
        key_dupes = df.duplicated(subset=key_columns, keep=False)
        results['duplicate_keys'] = key_dupes.sum()
        results['duplicate_key_pct'] = round(key_dupes.mean() * 100, 2)
        if results['duplicate_keys'] > 0:
            results['duplicate_key_examples'] = df[key_dupes][key_columns].head(10).to_dict('records')

    return results


def check_outliers(df, columns=None, method='iqr', threshold=1.5):
    """
    Detect outliers in numeric columns.

    Methods:
        - 'iqr': Values outside Q1 - 1.5*IQR or Q3 + 1.5*IQR
        - 'zscore': Values with |z-score| > 3
    """
    if columns is None:
        columns = df.select_dtypes(include=[np.number]).columns.tolist()

    results = {}

    for col in columns:
        series = df[col].dropna()
        if len(series) == 0:
            continue

        if method == 'iqr':
            Q1 = series.quantile(0.25)
            Q3 = series.quantile(0.75)
            IQR = Q3 - Q1
            lower = Q1 - threshold * IQR
            upper = Q3 + threshold * IQR
            outliers = series[(series < lower) | (series > upper)]
        elif method == 'zscore':
            z_scores = np.abs((series - series.mean()) / series.std())
            outliers = series[z_scores > 3]

        if len(outliers) > 0:
            results[col] = {
                'count': len(outliers),
                'pct': round(len(outliers) / len(series) * 100, 2),
                'min_outlier': float(outliers.min()),
                'max_outlier': float(outliers.max()),
                'bounds': {'lower': float(lower), 'upper': float(upper)} if method == 'iqr' else None,
                'examples': outliers.head(5).tolist()
            }

    return results


def check_invalid_values(df, validations=None):
    """
    Check for invalid values based on business rules.

    Default validations for HLES data:
        - rental: must be 0 or 1
        - cancel: must be 0 or 1
        - hours_difference: must be >= 0
        - dates: must not be in future
    """
    if validations is None:
        # Default validations for Hertz HLES data
        validations = {
            'rental': {'type': 'in_set', 'valid': [0, 1, 0.0, 1.0]},
            'cancel': {'type': 'in_set', 'valid': [0, 1, 0.0, 1.0]},
            'unused': {'type': 'in_set', 'valid': [0, 1, 0.0, 1.0]},
            'res_id': {'type': 'in_set', 'valid': [1, 1.0]},
            'hours_difference': {'type': 'min', 'value': 0},
            'initial_date': {'type': 'not_future'},
            'checkout_date': {'type': 'not_future'},
        }

    results = {}
    today = pd.Timestamp.now()

    for col, rules in validations.items():
        if col not in df.columns:
            continue

        series = df[col].dropna()
        invalid_mask = pd.Series(False, index=series.index)

        if rules['type'] == 'in_set':
            invalid_mask = ~series.isin(rules['valid'])
        elif rules['type'] == 'min':
            invalid_mask = series < rules['value']
        elif rules['type'] == 'max':
            invalid_mask = series > rules['value']
        elif rules['type'] == 'not_future':
            try:
                dates = pd.to_datetime(series, errors='coerce')
                invalid_mask = dates > today
            except:
                pass
        elif rules['type'] == 'regex':
            invalid_mask = ~series.astype(str).str.match(rules['pattern'])

        invalid_count = invalid_mask.sum()
        if invalid_count > 0:
            results[col] = {
                'invalid_count': int(invalid_count),
                'invalid_pct': round(invalid_count / len(series) * 100, 2),
                'rule': rules,
                'examples': series[invalid_mask].head(5).tolist()
            }

    return results


def check_format_consistency(df, columns=None):
    """Check for mixed formats within string columns."""
    if columns is None:
        columns = df.select_dtypes(include=['object']).columns.tolist()

    results = {}

    for col in columns:
        series = df[col].dropna().astype(str)
        if len(series) == 0:
            continue

        # Check patterns
        patterns = {
            'uppercase': series.str.isupper().mean(),
            'lowercase': series.str.islower().mean(),
            'mixed_case': (~series.str.isupper() & ~series.str.islower()).mean(),
            'has_leading_space': series.str.startswith(' ').mean(),
            'has_trailing_space': series.str.endswith(' ').mean(),
        }

        # Flag if mixed patterns
        issues = []
        if 0.1 < patterns['uppercase'] < 0.9:
            issues.append(f"Mixed case: {patterns['uppercase']:.0%} uppercase")
        if patterns['has_leading_space'] > 0.01:
            issues.append(f"{patterns['has_leading_space']:.1%} have leading spaces")
        if patterns['has_trailing_space'] > 0.01:
            issues.append(f"{patterns['has_trailing_space']:.1%} have trailing spaces")

        if issues:
            results[col] = {
                'issues': issues,
                'patterns': patterns
            }

    return results


def run_quality_checks(df, key_columns=None, name='df'):
    """
    Run all quality checks on a DataFrame.

    Returns comprehensive quality report.
    """
    report = {
        'dataframe': name,
        'shape': {'rows': len(df), 'columns': len(df.columns)},
        'checks': {}
    }

    # Nulls
    nulls = check_nulls(df)
    if len(nulls) > 0:
        report['checks']['nulls'] = nulls.to_dict('index')

    # Duplicates
    dupes = check_duplicates(df, key_columns)
    if dupes['duplicate_rows'] > 0 or dupes.get('duplicate_keys', 0) > 0:
        report['checks']['duplicates'] = dupes

    # Outliers
    outliers = check_outliers(df)
    if outliers:
        report['checks']['outliers'] = outliers

    # Invalid values
    invalid = check_invalid_values(df)
    if invalid:
        report['checks']['invalid_values'] = invalid

    # Format consistency
    formats = check_format_consistency(df)
    if formats:
        report['checks']['format_issues'] = formats

    # Summary
    total_issues = (
        len(report['checks'].get('nulls', {})) +
        (1 if report['checks'].get('duplicates', {}).get('duplicate_rows', 0) > 0 else 0) +
        len(report['checks'].get('outliers', {})) +
        len(report['checks'].get('invalid_values', {})) +
        len(report['checks'].get('format_issues', {}))
    )

    report['summary'] = {
        'total_issue_types': total_issues,
        'status': 'clean' if total_issues == 0 else 'issues_found'
    }

    return report


# ============================================================================
# Output Formatting
# ============================================================================

def format_markdown(report):
    """Format quality report as markdown."""
    df_name = report['dataframe']
    shape = report['shape']
    status_icon = "✓" if report['summary']['status'] == 'clean' else "⚠️"
    status_text = "Clean" if report['summary']['status'] == 'clean' else f"Issues Found ({report['summary']['total_issue_types']} issue types)"

    output = [
        f"## Data Quality Report: `{df_name}`\n",
        f"**Shape**: {shape['rows']:,} rows × {shape['columns']} columns",
        f"**Status**: {status_icon} {status_text}\n"
    ]

    checks = report['checks']

    # Null Values
    if 'nulls' in checks:
        output.append("### Null Values")
        output.append("| Column | Null Count | Null % | Severity |")
        output.append("|--------|------------|--------|----------|")
        for col, info in checks['nulls'].items():
            output.append(f"| {col} | {info['null_count']} | {info['null_pct']}% | {info['severity']} |")
        output.append("")

    # Duplicates
    if 'duplicates' in checks:
        dupes = checks['duplicates']
        output.append("### Duplicates")
        output.append(f"- **Duplicate rows**: {dupes['duplicate_rows']} ({dupes['duplicate_pct']}%)")
        if 'duplicate_keys' in dupes:
            output.append(f"- **Duplicate keys**: {dupes['duplicate_keys']} ({dupes['duplicate_key_pct']}%)")
            if dupes.get('duplicate_key_examples'):
                examples = [str(ex) for ex in dupes['duplicate_key_examples'][:3]]
                output.append(f"  - Examples: {', '.join(examples)}")
        output.append("")

    # Outliers
    if 'outliers' in checks:
        output.append("### Outliers (IQR Method)")
        output.append("| Column | Outlier Count | % | Range | Examples |")
        output.append("|--------|---------------|---|-------|----------|")
        for col, info in checks['outliers'].items():
            bounds = info.get('bounds', {})
            if bounds:
                range_str = f"<{bounds['lower']:.1f} or >{bounds['upper']:.1f}"
            else:
                range_str = "|z| > 3"
            examples = ', '.join([str(x) for x in info['examples'][:3]])
            output.append(f"| {col} | {info['count']} | {info['pct']}% | {range_str} | {examples} |")
        output.append("")

    # Invalid Values
    if 'invalid_values' in checks:
        output.append("### Invalid Values")
        output.append("| Column | Invalid Count | Rule | Examples |")
        output.append("|--------|---------------|------|----------|")
        for col, info in checks['invalid_values'].items():
            rule = info['rule']
            if rule['type'] == 'in_set':
                rule_str = f"must be in {rule['valid']}"
            elif rule['type'] == 'min':
                rule_str = f"must be >= {rule['value']}"
            elif rule['type'] == 'max':
                rule_str = f"must be <= {rule['value']}"
            elif rule['type'] == 'not_future':
                rule_str = "must not be future date"
            else:
                rule_str = str(rule)
            examples = ', '.join([str(x) for x in info['examples'][:3]])
            output.append(f"| {col} | {info['invalid_count']} | {rule_str} | {examples} |")
        output.append("")

    # Format Issues
    if 'format_issues' in checks:
        output.append("### Format Issues")
        output.append("| Column | Issue |")
        output.append("|--------|-------|")
        for col, info in checks['format_issues'].items():
            for issue in info['issues']:
                output.append(f"| {col} | {issue} |")
        output.append("")

    return '\n'.join(output)


def format_json(report):
    """Format quality report as JSON."""
    return json.dumps(report, indent=2, default=str)


# ============================================================================
# Data Loading
# ============================================================================

def load_dataframe(input_path, engine='openpyxl'):
    """Load DataFrame from file or return None if path is a variable name."""
    path = Path(input_path)

    if path.suffix == '.csv':
        return pd.read_csv(input_path)
    elif path.suffix in ['.xlsx', '.xls']:
        return pd.read_excel(input_path, engine=engine)
    elif path.suffix == '.parquet':
        return pd.read_parquet(input_path)
    else:
        # Assume it's a DataFrame variable name (would need to be passed differently in practice)
        raise ValueError(f"Unsupported file type: {path.suffix}. Use .csv, .xlsx, or .parquet")


def load_validations(config_path):
    """Load custom validations from YAML or JSON file."""
    if not config_path:
        return None

    path = Path(config_path)
    if not path.exists():
        raise FileNotFoundError(f"Config file not found: {config_path}")

    if path.suffix == '.json':
        with open(path, 'r') as f:
            return json.load(f)
    elif path.suffix in ['.yaml', '.yml']:
        try:
            import yaml
            with open(path, 'r') as f:
                return yaml.safe_load(f)
        except ImportError:
            raise ImportError("PyYAML is required for YAML config files. Install with: pip install pyyaml")
    else:
        raise ValueError(f"Unsupported config file type: {path.suffix}. Use .json or .yaml")


# ============================================================================
# CLI Interface
# ============================================================================

def main():
    """Main CLI interface."""
    parser = argparse.ArgumentParser(
        description='Run quality checks on a DataFrame',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python scripts/run_checking_quality.py data/processed/df_conversion.csv
  python scripts/run_checking_quality.py data/raw/file.xlsx --format json
  python scripts/run_checking_quality.py data.csv --key-columns confirmation_number
  python scripts/run_checking_quality.py data.csv --config validations.yaml --output report.md
        """
    )

    parser.add_argument('input', help='Path to CSV, Excel, or Parquet file')
    parser.add_argument('--key-columns', nargs='+', help='Column(s) to check for duplicate keys')
    parser.add_argument('--config', help='Path to custom validations config (JSON or YAML)')
    parser.add_argument('--format', choices=['markdown', 'json'], default='markdown',
                       help='Output format (default: markdown)')
    parser.add_argument('--output', help='Output file path (default: print to stdout)')
    parser.add_argument('--name', help='DataFrame name for report (default: filename)')

    args = parser.parse_args()

    try:
        # Load data
        df = load_dataframe(args.input)
        df_name = args.name or Path(args.input).stem

        # Load custom validations if provided
        validations = load_validations(args.config) if args.config else None

        # Run quality checks
        report = run_quality_checks(
            df,
            key_columns=args.key_columns,
            name=df_name
        )

        # Format output
        if args.format == 'json':
            output = format_json(report)
        else:
            output = format_markdown(report)

        # Write output
        if args.output:
            with open(args.output, 'w') as f:
                f.write(output)
            print(f"Quality report written to: {args.output}")
        else:
            print(output)

        # Exit with code based on status
        sys.exit(0 if report['summary']['status'] == 'clean' else 1)

    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(2)


if __name__ == '__main__':
    main()
