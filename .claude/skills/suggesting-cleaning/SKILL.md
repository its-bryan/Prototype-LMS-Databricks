---
name: suggesting-cleaning
description: Recommends data cleaning steps based on quality issues. Use when analyzing data quality problems, suggesting data transformations, or when the user asks how to clean or prepare messy data.
---

# cleaning-suggester

Recommend data cleaning transformations based on quality issues detected.

## Usage

```
/cleaning-suggester <quality_report>
/cleaning-suggester <dataframe>
```

Or provide context:
```
/cleaning-suggester suggest cleaning steps for df_conversion
/cleaning-suggester how should I handle the nulls in hours_difference?
```

## Input

Accepts either:
- Output from `quality-checker` skill
- Raw DataFrame (will run quality checks first)

## Cleaning Categories

| Category | Issues Addressed | Transformations |
|----------|-----------------|-----------------|
| Nulls | Missing values | Impute, fill, drop, flag |
| Types | Wrong dtypes | Parse dates, convert types |
| Formatting | Inconsistent formats | Trim, case normalize, standardize |
| Outliers | Extreme values | Cap, winsorize, flag, remove |
| Invalid | Business rule violations | Correct, flag, remove |
| Duplicates | Repeated records | Deduplicate, aggregate |

## Suggestion Logic

```python
import pandas as pd
import numpy as np

def suggest_cleaning(df, quality_report=None, context='hles'):
    """
    Generate cleaning recommendations based on data quality issues.

    Parameters:
        df: DataFrame to clean
        quality_report: Output from quality-checker (optional, will generate if not provided)
        context: 'hles' for Hertz-specific rules, 'generic' otherwise

    Returns:
        List of cleaning recommendations with code snippets
    """
    suggestions = []

    if quality_report is None:
        # Run quality checks
        from quality_checker import run_quality_checks
        quality_report = run_quality_checks(df)

    checks = quality_report.get('checks', {})

    # --- NULL HANDLING ---
    if 'nulls' in checks:
        for col, info in checks['nulls'].items():
            null_pct = info['null_pct']
            suggestion = {
                'column': col,
                'issue': f'Missing values: {null_pct}%',
                'category': 'nulls',
                'priority': 'high' if null_pct > 20 else 'medium' if null_pct > 5 else 'low'
            }

            # Context-specific recommendations for HLES
            if context == 'hles':
                if col == 'cancel_reason':
                    suggestion['recommendation'] = 'Expected: only populated for cancellations. Fill with "N/A" for non-cancels.'
                    suggestion['code'] = f"df['{col}'] = df['{col}'].fillna('N/A')"
                elif col == 'hours_difference':
                    suggestion['recommendation'] = 'Likely means no contact was made. Create binary flag, then fill with median or -1.'
                    suggestion['code'] = f"""df['no_contact_flag'] = df['{col}'].isna().astype(int)
df['{col}'] = df['{col}'].fillna(-1)  # or df['{col}'].median()"""
                elif col in ['bodyshop_code', 'bodyshop']:
                    suggestion['recommendation'] = 'May not apply to all rentals. Fill with "UNKNOWN" or leave as null.'
                    suggestion['code'] = f"df['{col}'] = df['{col}'].fillna('UNKNOWN')"
                elif 'date' in col.lower():
                    suggestion['recommendation'] = 'Investigate: missing dates may indicate incomplete records. Consider dropping or flagging.'
                    suggestion['code'] = f"df['{col}_missing'] = df['{col}'].isna().astype(int)"
                else:
                    suggestion['recommendation'] = f'Fill with appropriate value based on business logic.'
                    suggestion['code'] = f"# df['{col}'] = df['{col}'].fillna(value)"
            else:
                if null_pct > 50:
                    suggestion['recommendation'] = 'High null rate. Consider dropping column or investigating data source.'
                    suggestion['code'] = f"# df = df.drop(columns=['{col}'])  # if not needed"
                else:
                    suggestion['recommendation'] = 'Fill with median (numeric) or mode (categorical).'
                    suggestion['code'] = f"df['{col}'] = df['{col}'].fillna(df['{col}'].median())"

            suggestions.append(suggestion)

    # --- TYPE CONVERSIONS ---
    for col in df.columns:
        if df[col].dtype == 'object':
            sample = df[col].dropna().head(100)

            # Check for dates
            if any(kw in col.lower() for kw in ['date', 'time', 'dt', '_at']):
                suggestions.append({
                    'column': col,
                    'issue': 'String column appears to be datetime',
                    'category': 'types',
                    'priority': 'high',
                    'recommendation': 'Parse as datetime for proper analysis.',
                    'code': f"df['{col}'] = pd.to_datetime(df['{col}'], errors='coerce')"
                })

            # Check for numeric strings
            try:
                numeric_pct = pd.to_numeric(sample, errors='coerce').notna().mean()
                if numeric_pct > 0.9:
                    suggestions.append({
                        'column': col,
                        'issue': 'String column appears to be numeric',
                        'category': 'types',
                        'priority': 'medium',
                        'recommendation': 'Convert to numeric type.',
                        'code': f"df['{col}'] = pd.to_numeric(df['{col}'], errors='coerce')"
                    })
            except:
                pass

    # --- FORMATTING ---
    if 'format_issues' in checks:
        for col, info in checks['format_issues'].items():
            for issue in info.get('issues', []):
                suggestion = {
                    'column': col,
                    'issue': issue,
                    'category': 'formatting',
                    'priority': 'low'
                }

                if 'space' in issue.lower():
                    suggestion['recommendation'] = 'Trim whitespace.'
                    suggestion['code'] = f"df['{col}'] = df['{col}'].str.strip()"
                elif 'case' in issue.lower():
                    suggestion['recommendation'] = 'Standardize case (upper recommended for codes).'
                    suggestion['code'] = f"df['{col}'] = df['{col}'].str.upper()"

                suggestions.append(suggestion)

    # --- OUTLIERS ---
    if 'outliers' in checks:
        for col, info in checks['outliers'].items():
            suggestions.append({
                'column': col,
                'issue': f"Outliers detected: {info['count']} values ({info['pct']}%)",
                'category': 'outliers',
                'priority': 'medium',
                'recommendation': 'Cap at bounds, flag, or investigate individually.',
                'code': f"""# Option 1: Cap at bounds (winsorize)
lower, upper = {info['bounds']['lower']:.2f}, {info['bounds']['upper']:.2f}
df['{col}_capped'] = df['{col}'].clip(lower, upper)

# Option 2: Flag outliers
df['{col}_outlier'] = ((df['{col}'] < {info['bounds']['lower']:.2f}) | (df['{col}'] > {info['bounds']['upper']:.2f})).astype(int)

# Option 3: Remove outliers
df = df[(df['{col}'] >= {info['bounds']['lower']:.2f}) & (df['{col}'] <= {info['bounds']['upper']:.2f})]"""
            })

    # --- INVALID VALUES ---
    if 'invalid_values' in checks:
        for col, info in checks['invalid_values'].items():
            suggestions.append({
                'column': col,
                'issue': f"Invalid values: {info['invalid_count']} ({info['invalid_pct']}%)",
                'category': 'invalid',
                'priority': 'high',
                'recommendation': 'Correct or remove invalid values.',
                'code': f"""# View invalid values
invalid_mask = ~df['{col}'].isin({info['rule'].get('valid', [])})
print(df[invalid_mask]['{col}'].value_counts())

# Option: Set invalid to NaN
df.loc[invalid_mask, '{col}'] = np.nan"""
            })

    # --- DUPLICATES ---
    if 'duplicates' in checks:
        dupe_info = checks['duplicates']
        if dupe_info.get('duplicate_rows', 0) > 0:
            suggestions.append({
                'column': 'all',
                'issue': f"Duplicate rows: {dupe_info['duplicate_rows']}",
                'category': 'duplicates',
                'priority': 'high',
                'recommendation': 'Remove exact duplicate rows.',
                'code': "df = df.drop_duplicates()"
            })
        if dupe_info.get('duplicate_keys', 0) > 0:
            suggestions.append({
                'column': 'key columns',
                'issue': f"Duplicate keys: {dupe_info['duplicate_keys']}",
                'category': 'duplicates',
                'priority': 'high',
                'recommendation': 'Investigate duplicate keys. May need to aggregate or keep first/last.',
                'code': """# Keep first occurrence
df = df.drop_duplicates(subset=['confirmation_number', 'initial_date'], keep='first')

# Or aggregate if needed
# df = df.groupby(['confirmation_number', 'initial_date']).agg({...}).reset_index()"""
            })

    # Sort by priority
    priority_order = {'high': 0, 'medium': 1, 'low': 2}
    suggestions.sort(key=lambda x: priority_order.get(x['priority'], 3))

    return suggestions


def generate_cleaning_script(suggestions, df_name='df'):
    """
    Generate a complete cleaning script from suggestions.
    """
    script_lines = [
        "# Auto-generated cleaning script",
        "# Review each transformation before applying",
        "",
        "import pandas as pd",
        "import numpy as np",
        "",
        f"# Assuming DataFrame is loaded as `{df_name}`",
        ""
    ]

    for i, s in enumerate(suggestions, 1):
        script_lines.append(f"# {i}. {s['column']}: {s['issue']}")
        script_lines.append(f"# Recommendation: {s['recommendation']}")
        script_lines.append(s['code'])
        script_lines.append("")

    return "\n".join(script_lines)
```

## Output Format

```markdown
## Cleaning Recommendations: `df_conversion`

### High Priority

#### 1. `initial_date` - String column appears to be datetime
**Recommendation**: Parse as datetime for proper analysis.
```python
df['initial_date'] = pd.to_datetime(df['initial_date'], errors='coerce')
```

#### 2. `rental` - Invalid values: 2 (0.2%)
**Recommendation**: Correct or remove invalid values.
```python
invalid_mask = ~df['rental'].isin([0, 1])
print(df[invalid_mask]['rental'].value_counts())
df.loc[invalid_mask, 'rental'] = np.nan
```

### Medium Priority

#### 3. `hours_difference` - Missing values: 5.2%
**Recommendation**: Likely means no contact was made. Create binary flag, then fill.
```python
df['no_contact_flag'] = df['hours_difference'].isna().astype(int)
df['hours_difference'] = df['hours_difference'].fillna(-1)
```

#### 4. `hours_difference` - Outliers detected: 23 values (2.3%)
**Recommendation**: Cap at bounds or flag for investigation.
```python
df['hours_difference_capped'] = df['hours_difference'].clip(0, 156)
df['hours_difference_outlier'] = (df['hours_difference'] > 156).astype(int)
```

### Low Priority

#### 5. `cdp_name` - Mixed case: 45% uppercase
**Recommendation**: Standardize case.
```python
df['cdp_name'] = df['cdp_name'].str.upper()
```

#### 6. `confirmation_number` - 0.5% have trailing spaces
**Recommendation**: Trim whitespace.
```python
df['confirmation_number'] = df['confirmation_number'].str.strip()
```

---

## Complete Cleaning Script

```python
# Auto-generated cleaning script
# Review each transformation before applying

import pandas as pd
import numpy as np

# 1. Parse dates
df['initial_date'] = pd.to_datetime(df['initial_date'], errors='coerce')
df['checkout_date'] = pd.to_datetime(df['checkout_date'], errors='coerce')

# 2. Clean string columns
df['confirmation_number'] = df['confirmation_number'].str.strip()
df['cdp_name'] = df['cdp_name'].str.upper().str.strip()

# 3. Handle nulls
df['no_contact_flag'] = df['hours_difference'].isna().astype(int)
df['hours_difference'] = df['hours_difference'].fillna(-1)
df['cancel_reason'] = df['cancel_reason'].fillna('N/A')

# 4. Flag outliers
df['hours_diff_outlier'] = (df['hours_difference'] > 156).astype(int)

# 5. Validate
assert df['rental'].isin([0, 1, -1]).all(), "Invalid rental values remain"
print(f"Cleaned DataFrame: {len(df)} rows")
```
```

## Integration

Called by:
- `data-profiler` agent after quality checks
- Directly when preparing data for analysis
- Generates reusable cleaning scripts for notebooks
