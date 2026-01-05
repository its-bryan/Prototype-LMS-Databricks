# type-detector

Infer semantic data types beyond pandas dtypes for columns in a DataFrame.

## Usage

```
/type-detector <dataframe> [column]
```

Or provide context:
```
/type-detector analyze the columns in df_creser
/type-detector what type is the INIT_DATE column in df_conversion?
```

## Semantic Types Detected

| Semantic Type | Description | Example Values |
|---------------|-------------|----------------|
| `id_primary` | Primary key / unique identifier | H12345678, 1001, UUID |
| `id_foreign` | Foreign key / join candidate | confirmation_number in multiple tables |
| `datetime_local` | Datetime with local timezone context | 2024-01-15 14:30:00 |
| `datetime_utc` | Datetime in UTC | 2024-01-15T14:30:00Z |
| `date_only` | Date without time | 2024-01-15 |
| `categorical_low` | Categorical with ≤10 unique values | YES/NO, status codes |
| `categorical_high` | Categorical with >10 unique values | location codes, partner names |
| `categorical_ordered` | Ordinal categories | < 30 min, 30min-1hr, 1-3hr |
| `binary` | Two values only | 0/1, True/False, Y/N |
| `numeric_continuous` | Continuous numeric | 123.45, -0.5 |
| `numeric_discrete` | Integer counts | 1, 2, 3, 100 |
| `numeric_currency` | Money values | 150.00, $1,234.56 |
| `text_short` | Short text (<50 chars avg) | Names, codes |
| `text_long` | Long text (≥50 chars avg) | Notes, descriptions |
| `phone` | Phone number | 555-123-4567 |
| `email` | Email address | user@example.com |
| `constant` | Single value throughout | All rows = "IR" |
| `mostly_null` | >80% null values | Sparse optional field |

## Detection Logic

```python
def detect_semantic_type(series, col_name=None):
    """
    Detect semantic type of a pandas Series.

    Returns dict with:
        - semantic_type: primary type classification
        - confidence: high/medium/low
        - pandas_dtype: original dtype
        - nullable: True if contains nulls
        - unique_ratio: n_unique / n_total
        - sample_values: list of example values
        - notes: any special observations
    """
    import pandas as pd
    import numpy as np
    import re

    result = {
        'column': col_name or series.name,
        'pandas_dtype': str(series.dtype),
        'total_rows': len(series),
        'null_count': series.isna().sum(),
        'null_pct': round(series.isna().mean() * 100, 2),
        'unique_count': series.nunique(),
        'unique_ratio': round(series.nunique() / len(series), 4) if len(series) > 0 else 0,
        'sample_values': series.dropna().head(5).tolist(),
        'notes': []
    }

    non_null = series.dropna()
    n_unique = series.nunique()
    n_total = len(series)

    # Check for mostly null
    if result['null_pct'] > 80:
        result['semantic_type'] = 'mostly_null'
        result['confidence'] = 'high'
        result['notes'].append(f'{result["null_pct"]}% null values')
        return result

    # Check for constant
    if n_unique == 1:
        result['semantic_type'] = 'constant'
        result['confidence'] = 'high'
        result['notes'].append(f'All values = {non_null.iloc[0]}')
        return result

    # Check for binary
    if n_unique == 2:
        result['semantic_type'] = 'binary'
        result['confidence'] = 'high'
        result['unique_values'] = non_null.unique().tolist()
        return result

    # String-based detection
    if series.dtype == 'object' or str(series.dtype) == 'string':
        sample_str = non_null.astype(str)

        # Check for datetime patterns
        date_patterns = [
            r'\d{4}-\d{2}-\d{2}',  # 2024-01-15
            r'\d{2}/\d{2}/\d{4}',  # 01/15/2024
            r'\d{2}-\w{3}-\d{4}',  # 15-Jan-2024
        ]
        if any(sample_str.str.match(p).mean() > 0.8 for p in date_patterns):
            has_time = sample_str.str.contains(r'\d{2}:\d{2}').mean() > 0.5
            result['semantic_type'] = 'datetime_local' if has_time else 'date_only'
            result['confidence'] = 'high'
            result['notes'].append('Consider parsing as datetime')
            return result

        # Check for ID patterns (high uniqueness + consistent format)
        if result['unique_ratio'] > 0.9:
            result['semantic_type'] = 'id_primary'
            result['confidence'] = 'high' if result['unique_ratio'] > 0.99 else 'medium'
            return result

        # Check for email
        if sample_str.str.contains(r'@.*\.').mean() > 0.8:
            result['semantic_type'] = 'email'
            result['confidence'] = 'high'
            return result

        # Check for phone
        if sample_str.str.contains(r'[\d\-\(\)]{10,}').mean() > 0.5:
            result['semantic_type'] = 'phone'
            result['confidence'] = 'medium'
            return result

        # Categorical
        avg_len = sample_str.str.len().mean()
        if n_unique <= 10:
            # Check if ordered
            ordered_patterns = ['<', '>', '-', 'to', 'low', 'med', 'high']
            if any(p in ' '.join(non_null.unique()[:5]).lower() for p in ordered_patterns):
                result['semantic_type'] = 'categorical_ordered'
            else:
                result['semantic_type'] = 'categorical_low'
            result['confidence'] = 'high'
            result['unique_values'] = non_null.unique().tolist()
        elif n_unique <= 100:
            result['semantic_type'] = 'categorical_high'
            result['confidence'] = 'medium'
        elif avg_len < 50:
            result['semantic_type'] = 'text_short'
            result['confidence'] = 'medium'
        else:
            result['semantic_type'] = 'text_long'
            result['confidence'] = 'medium'

        return result

    # Numeric detection
    if pd.api.types.is_numeric_dtype(series):
        # Check for currency (2 decimal places common)
        if pd.api.types.is_float_dtype(series):
            decimals = non_null.apply(lambda x: len(str(x).split('.')[-1]) if '.' in str(x) else 0)
            if (decimals == 2).mean() > 0.8:
                result['semantic_type'] = 'numeric_currency'
                result['confidence'] = 'medium'
                result['notes'].append('Appears to be currency (2 decimal places)')
                return result

        # Check if discrete (integers or integer-like)
        if pd.api.types.is_integer_dtype(series) or (non_null == non_null.astype(int)).all():
            if n_unique <= 20 and non_null.max() <= 100:
                result['semantic_type'] = 'categorical_low'
                result['confidence'] = 'medium'
                result['notes'].append('Integer but low cardinality - may be categorical')
            else:
                result['semantic_type'] = 'numeric_discrete'
                result['confidence'] = 'high'
        else:
            result['semantic_type'] = 'numeric_continuous'
            result['confidence'] = 'high'

        result['min'] = float(non_null.min())
        result['max'] = float(non_null.max())
        result['mean'] = float(non_null.mean())
        return result

    # Datetime detection
    if pd.api.types.is_datetime64_any_dtype(series):
        result['semantic_type'] = 'datetime_local'
        result['confidence'] = 'high'
        result['min'] = str(non_null.min())
        result['max'] = str(non_null.max())
        return result

    # Fallback
    result['semantic_type'] = 'unknown'
    result['confidence'] = 'low'
    return result


def profile_dataframe(df, name='df'):
    """
    Profile all columns in a DataFrame.

    Returns list of type detection results.
    """
    results = []
    for col in df.columns:
        result = detect_semantic_type(df[col], col)
        results.append(result)

    return results
```

## Output Format

### Single Column
```markdown
## Column: `contact_range`

| Attribute | Value |
|-----------|-------|
| Semantic Type | `categorical_ordered` |
| Confidence | high |
| Pandas dtype | object |
| Null % | 2.3% |
| Unique Values | 6 |

**Values**: `< 30 min`, `30min - 1hr`, `1-3 hrs`, `3-6 hrs`, `6+ hrs`, `No Contact`

**Notes**: Ordered time buckets - consider as ordinal for analysis
```

### Full DataFrame
```markdown
## DataFrame Profile: `df_conversion`

| Column | Semantic Type | Confidence | Nulls | Unique | Notes |
|--------|---------------|------------|-------|--------|-------|
| confirmation_number | id_primary | high | 0% | 1000 | Join key |
| initial_date | datetime_local | high | 0% | 847 | Parse as datetime |
| rental | binary | high | 0% | 2 | 0/1 outcome |
| contact_range | categorical_ordered | high | 2% | 6 | Time buckets |
| hours_difference | numeric_continuous | high | 5% | 342 | |
| cdp_name | categorical_high | medium | 0% | 23 | Insurance partners |

### Join Key Candidates
- `confirmation_number` (100% unique, appears in CRESER, CSPLIT)
- `confirmation_number + initial_date` (composite key)

### Datetime Columns to Parse
- `initial_date` → datetime (local timezone per rental location)
- `checkout_date` → datetime

### Recommended Categorical Encoding
- `contact_range` → ordinal (time-ordered)
- `cdp_name` → one-hot or target encoding
```

## Integration

This skill is typically called by:
- `data-profiler` agent (orchestrator)
- Directly when exploring a new data file
- `hypothesis-tester` agent to understand variable types before selecting tests
