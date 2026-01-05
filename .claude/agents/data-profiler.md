# data-profiler

Orchestrating agent that comprehensively profiles HLES data files, detecting types, quality issues, and generating cleaning recommendations.

## Purpose

Automates data onboarding workflow:
1. Load and inspect data file
2. Profile all columns (types, distributions)
3. Run quality checks
4. Validate join keys across tables
5. Generate cleaning recommendations
6. Update data documentation

## Invocation

```
/data-profiler data/raw/CRESER_1000_Records.xlsx
/data-profiler df_conversion
/data-profiler --all  # Profile all loaded DataFrames
```

## Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│                      DATA-PROFILER AGENT                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. LOAD DATA                                                    │
│     ├─ Read file (Excel, CSV, Parquet)                          │
│     ├─ Detect encoding, handle parsing errors                    │
│     └─ Report basic shape and memory usage                       │
│                                                                  │
│  2. TYPE DETECTION (detecting-types skill)                       │
│     ├─ Analyze each column                                       │
│     ├─ Infer semantic types                                      │
│     ├─ Identify join key candidates                              │
│     └─ Flag datetime columns needing parsing                     │
│                                                                  │
│  3. QUALITY CHECKS (checking-quality skill)                      │
│     ├─ Null analysis                                             │
│     ├─ Duplicate detection                                       │
│     ├─ Outlier identification                                    │
│     ├─ Invalid value detection                                   │
│     └─ Format consistency                                        │
│                                                                  │
│  4. JOIN VALIDATION (validating-joins skill)                     │
│     ├─ If other tables loaded, test joins                        │
│     ├─ Validate cardinality                                      │
│     └─ Report match rates                                        │
│                                                                  │
│  5. CLEANING RECOMMENDATIONS (suggesting-cleaning skill)         │
│     ├─ Generate prioritized recommendations                      │
│     ├─ Create executable cleaning script                         │
│     └─ Note HLES-specific transformations                        │
│                                                                  │
│  6. DOCUMENTATION                                                │
│     ├─ Update docs/context/data_README.md                        │
│     ├─ Generate column-level documentation                       │
│     └─ Save profile report                                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Agent Instructions

### Step 1: Load Data

```python
import pandas as pd

def load_data(file_path):
    """Load data file with appropriate parser."""
    ext = file_path.split('.')[-1].lower()

    if ext in ['xlsx', 'xls']:
        df = pd.read_excel(file_path)
    elif ext == 'csv':
        # Try different encodings
        for encoding in ['utf-8', 'latin-1', 'cp1252']:
            try:
                df = pd.read_csv(file_path, encoding=encoding)
                break
            except UnicodeDecodeError:
                continue
    elif ext == 'parquet':
        df = pd.read_parquet(file_path)
    else:
        raise ValueError(f"Unsupported file type: {ext}")

    return df

# Basic info
info = {
    'file': file_path,
    'rows': len(df),
    'columns': len(df.columns),
    'memory_mb': df.memory_usage(deep=True).sum() / 1024**2,
    'column_names': df.columns.tolist()
}
```

### Step 2: Profile Columns

Call `detecting-types` skill for each column. Aggregate into profile:

```python
profile = {
    'file': file_path,
    'shape': (rows, cols),
    'columns': [
        {
            'name': 'confirmation_number',
            'semantic_type': 'id_primary',
            'pandas_dtype': 'object',
            'null_pct': 0,
            'unique_pct': 100,
            'sample_values': ['CF123', 'CF456', ...]
        },
        # ... more columns
    ],
    'join_key_candidates': ['confirmation_number'],
    'datetime_columns': ['initial_date', 'checkout_date'],
    'categorical_columns': ['contact_range', 'cdp_name', 'code']
}
```

### Step 3: Run Quality Checks

Call `checking-quality` skill to perform comprehensive data quality analysis:

```python
quality_report = run_quality_checks(df, key_columns=['confirmation_number'])
```

**Quality checks include**:

1. **Null Analysis**:
   - Identify columns with high null percentages (>50% = high concern, >10% = medium)
   - Flag critical columns that should not have nulls (e.g., keys, outcome variables)

2. **Duplicate Detection**:
   - Check for duplicate rows (full duplicates)
   - Check for duplicate keys (composite key: confirmation_number + initial_date)

3. **Zero Variance Detection**:
   - Identify constant columns where `df[col].nunique() == 1`
   - Flag as "no analytical value - recommend removal"
   - Example: If `PICKUPSERVICE` is all null, mark for exclusion

4. **Outlier Identification**:
   - For numeric columns, detect outliers using IQR method
   - Flag extreme values in key metrics (e.g., negative hours_difference)

5. **Invalid Value Detection**:
   - Check binary columns (0/1) have only valid values
   - Check categorical columns for unexpected values
   - Check date columns for future dates or unrealistic historical dates

6. **Format Consistency**:
   - Identify mixed case in categorical fields (e.g., "StateFarm" vs "statefarm")
   - Detect leading/trailing whitespace
   - Find inconsistent date formats

**Output structure**:
```python
quality_report = {
    'null_analysis': {
        'high_null_cols': ['hours_difference', 'bodyshop'],  # >50% null
        'medium_null_cols': ['cancel_reason'],  # 10-50% null
        'null_percentages': {...}
    },
    'duplicates': {
        'duplicate_rows': 0,
        'duplicate_keys': 5
    },
    'constant_columns': ['PICKUPSERVICE', 'SOURCE'],  # Zero variance
    'outliers': {
        'hours_difference': [340, 450, 720]  # Outlier values
    },
    'invalid_values': {
        'RENT_IND': []  # All valid (0 or 1)
    },
    'format_issues': {
        'cdp_name': 'mixed case detected'
    },
    'columns_to_exclude': ['PICKUPSERVICE', 'SOURCE'],  # Null or constant
    'severity': 'medium'  # high/medium/low
}
```

### Step 4: Validate Joins

If multiple tables are loaded, call `validating-joins` skill:

```python
# Check if related tables exist
related_tables = {
    'CRESER': ['CRA001', 'CSPLIT', 'TRANSLOG'],
    'CRA001': ['CSPLIT'],
    'Conversion': ['CRESER', 'CSPLIT']
}

for other_table in related_tables.get(current_table, []):
    if other_table in loaded_dataframes:
        join_result = validate_join(
            df, loaded_dataframes[other_table],
            left_key='confirmation_number',
            left_name=current_table,
            right_name=other_table
        )
        # Store results
```

### Step 5: Generate Cleaning Recommendations

Call `suggesting-cleaning` skill:

```python
suggestions = suggest_cleaning(df, quality_report, context='hles')
cleaning_script = generate_cleaning_script(suggestions)
```

### Step 5.5: Generate Processed Dataset Recommendation

After identifying quality issues and cleaning needs, recommend creating an optimized processed dataset:

```python
def recommend_processed_dataset(df, quality_report, profile, table_name):
    """
    Generate recommendation for creating efficient parquet file.
    """

    # Identify columns to keep (exclude null/constant/irrelevant)
    columns_to_exclude = quality_report.get('columns_to_exclude', [])
    all_columns = set(df.columns)
    relevant_columns = all_columns - set(columns_to_exclude)

    # Recommend data type optimizations
    dtype_recommendations = {}
    for col in relevant_columns:
        col_profile = next((c for c in profile['columns'] if c['name'] == col), None)
        if col_profile:
            if col_profile['semantic_type'] == 'categorical' and col_profile['unique_pct'] < 50:
                dtype_recommendations[col] = 'category'
            elif col_profile['semantic_type'] == 'datetime_local':
                dtype_recommendations[col] = 'datetime64[ns]'

    # Generate executable script
    script = f'''
import pandas as pd

# Load raw data
df_raw = pd.read_excel('data/raw/{table_name}.xlsx')

# Standardize column names (strip whitespace, handle newlines)
df_raw.columns = df_raw.columns.str.strip()

# Select only relevant columns
relevant_cols = {list(relevant_columns)}
df_clean = df_raw[relevant_cols].copy()

# Optimize data types
{chr(10).join([f"df_clean['{col}'] = df_clean['{col}'].astype('{dtype}')"
               for col, dtype in dtype_recommendations.items()])}

# Save as parquet (efficient storage + fast loading)
output_path = 'data/processed/{table_name}_processed.parquet'
df_clean.to_parquet(output_path, index=False, compression='snappy')

print(f"✓ Processed dataset saved: {{output_path}}")
print(f"  Original size: {{len(df_raw)}} rows × {{len(df_raw.columns)}} cols")
print(f"  Processed size: {{len(df_clean)}} rows × {{len(df_clean.columns)}} cols")
print(f"  Columns excluded: {{{len(columns_to_exclude)}}}")
'''

    return {
        'output_path': f'data/processed/{table_name}_processed.parquet',
        'columns_kept': len(relevant_columns),
        'columns_excluded': len(columns_to_exclude),
        'dtype_optimizations': dtype_recommendations,
        'script': script
    }
```

**Benefits of processed parquet files**:
- **Reduced token usage**: Only relevant columns loaded
- **Faster loading**: Parquet is 5-10x faster than Excel/CSV
- **Smaller file size**: Compression + optimized dtypes
- **Type safety**: Data types preserved correctly
- **Standardized names**: No whitespace/formatting issues

**Save script to**: `src/data/preprocess_{table_name}.py`

### Step 6: Update Documentation

Update `docs/context/data_README.md` with new column definitions.

## Output Format

### Console Summary

```markdown
## Data Profile: CRESER_1000_Records.xlsx

### Overview
| Metric | Value |
|--------|-------|
| Rows | 1,000 |
| Columns | 45 |
| Memory | 2.3 MB |
| File | data/raw/CRESER_1000_Records.xlsx |

### Column Summary
| Column | Type | Nulls | Unique | Notes |
|--------|------|-------|--------|-------|
| CONFIRMATION_NUM | id_primary | 0% | 1000 | Join key |
| INIT_DATE | datetime_local | 0% | 847 | Parse needed |
| CONTACT_RANGE | categorical_ordered | 2% | 6 | Time buckets |
| ... | ... | ... | ... | ... |

### Data Quality
**Status**: ⚠️ 4 issues found

| Issue | Severity | Columns |
|-------|----------|---------|
| Missing values >5% | Medium | hours_difference, bodyshop |
| Outliers detected | Low | hours_difference |
| Format inconsistency | Low | cdp_name |
| Duplicate keys | None | - |

### Join Compatibility
| Target Table | Key | Match Rate | Cardinality |
|--------------|-----|------------|-------------|
| CRA001 | confirmation_number | 85% | 1:1 |
| CSPLIT | confirmation_number | 72% | 1:1 |

### Recommended Actions
1. **High**: Parse `INIT_DATE` as datetime
2. **Medium**: Handle 5.2% nulls in `hours_difference`
3. **Low**: Standardize case in `cdp_name`

### Cleaning Script Generated
Saved to: `notebooks/cleaning/creser_cleaning.py`
```

### Generated Files

1. **Profile Report** (JSON)
   - `data/processed/profiles/creser_profile.json`

2. **Cleaning Script** (Python)
   - `notebooks/cleaning/creser_cleaning.py`

3. **Documentation Update**
   - Appends to `docs/context/data_README.md`

## HLES-Specific Knowledge

### Expected Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| CRESER | Incoming reservations | confirmation_number, init_date |
| CRA001 | Contract details | confirmation_number, knum |
| CSPLIT | Split billing + rental info | confirmation_number, rental fields |
| TRANSLOG | Transaction log | confirmation_number, transaction_type |
| Conversion | Aggregated conversion data | confirmation_number, initial_date, rental |

### Known Data Quirks

- `confirmation_number` recycled every ~6 months → use with `initial_date` as composite key
- `knum` changes on conversion: non-H prefix = reservation, H prefix = rental
- `cancel_reason` only populated for cancellations (expected high nulls)
- `hours_difference` null often means "no contact made"
- Dates are in local timezone of rental location

### Default Validations

```python
HLES_VALIDATIONS = {
    'rental': {'type': 'in_set', 'valid': [0, 1]},
    'cancel': {'type': 'in_set', 'valid': [0, 1]},
    'unused': {'type': 'in_set', 'valid': [0, 1]},
    'hours_difference': {'type': 'min', 'value': 0},
}
```

## Error Handling

| Error | Response |
|-------|----------|
| File not found | Check path, suggest alternatives |
| Parse error | Try different encodings, report issue |
| Memory error | Suggest chunked loading |
| Unknown columns | Compare to expected schema, flag new columns |

## Dependencies

**Skills used**:
- `detecting-types` - Column type inference
- `checking-quality` - Data quality analysis
- `validating-joins` - Table relationship validation
- `suggesting-cleaning` - Transformation recommendations

**Tools used**:
- `Read` - Load data files
- `Write` - Save profiles, scripts
- `Edit` - Update documentation
- `Bash` - File operations
- `mcp__ide__executeCode` - Execute in Jupyter
