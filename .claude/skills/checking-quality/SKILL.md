---
name: checking-quality
description: Identifies data quality issues including nulls, outliers, invalid values, and duplicates. Use when profiling data, investigating data problems, or when the user asks about data quality.
---

# quality-checker

Detect data quality issues in a DataFrame: nulls, duplicates, outliers, invalid values.

## Usage

```
/quality-checker <dataframe>
/quality-checker <dataframe> <column>
```

Or provide context:
```
/quality-checker check df_creser for data quality issues
/quality-checker are there outliers in hours_difference?
```

## Quality Checks Performed

| Check | Description | Threshold |
|-------|-------------|-----------|
| Nulls | Missing values by column | Flag if >5% |
| Duplicates | Duplicate rows | Flag if any |
| Duplicate keys | Duplicate values in ID columns | Flag if any |
| Outliers | Extreme values in numeric columns | IQR method (1.5×) |
| Invalid values | Values that don't match expected patterns | Context-dependent |
| Inconsistent formats | Mixed formats in same column | Flag if detected |
| Future dates | Dates beyond current date | Flag if any |
| Negative values | Negatives where unexpected | Context-dependent |

## Detection Code

```python
import pandas as pd
import numpy as np
from datetime import datetime

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
```

## Output Format

```markdown
## Data Quality Report: `df_conversion`

**Shape**: 1,000 rows × 25 columns
**Status**: ⚠️ Issues Found (4 issue types)

### Null Values
| Column | Null Count | Null % | Severity |
|--------|------------|--------|----------|
| hours_difference | 52 | 5.2% | medium |
| cancel_reason | 890 | 89.0% | critical |
| bodyshop_code | 234 | 23.4% | high |

### Duplicates
- **Duplicate rows**: 0
- **Duplicate keys** (`confirmation_number`): 3 (0.3%)
  - Examples: `CF123456`, `CF789012`

### Outliers (IQR Method)
| Column | Outlier Count | % | Range | Examples |
|--------|--------------|---|-------|----------|
| hours_difference | 23 | 2.3% | >156 hrs | 200, 340, 512 |

### Invalid Values
| Column | Invalid Count | Rule | Examples |
|--------|--------------|------|----------|
| rental | 2 | must be 0 or 1 | 2, -1 |

### Format Issues
| Column | Issue |
|--------|-------|
| cdp_name | Mixed case: 45% uppercase |
| confirmation_number | 0.5% have trailing spaces |

---

### Recommended Actions
1. **hours_difference nulls**: Investigate if null means "no contact" or missing data
2. **cancel_reason**: Expected to be mostly null (only populated for cancels)
3. **hours_difference outliers**: Verify 200+ hour contacts are valid
4. **Trim whitespace**: `confirmation_number`, `cdp_name`
```

## Integration

Called by:
- `data-profiler` agent as part of full profiling
- Directly when validating data before analysis
- `cleaning-suggester` skill uses output to recommend fixes
