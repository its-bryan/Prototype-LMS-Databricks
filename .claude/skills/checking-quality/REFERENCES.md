# Integration & References

This document describes how the quality-checker skill integrates with other skills and agents in the system.

## Called By

### Agents

**data-profiler** (Step 2 of profiling workflow)
- Calls quality-checker after type detection
- Uses output to understand data quality issues
- Passes results to cleaning-suggester for remediation recommendations

**hypothesis-tester** (Optional pre-analysis validation)
- Optional quality check before running statistical tests
- Ensures data quality doesn't invalidate test assumptions

### Skills

**cleaning-suggester**
- Takes quality-checker output as input
- Generates cleaning recommendations based on detected issues
- Forms a downstream pipeline: quality-checker → cleaning-suggester

## Calls / Dependencies

**Upstream dependencies**: None
- Self-contained skill with no upstream calls
- Does not depend on other skills or agents

**Downstream calls**: None
- Does not invoke other skills
- Terminal node in skill graph (output consumed by other skills)

## Output Contract

The quality checker returns a dictionary with the following structure:

```python
{
    'dataframe': str,              # Name of analyzed dataframe
    'shape': {
        'rows': int,               # Row count
        'columns': int             # Column count
    },
    'checks': {
        'nulls': dict,             # Column → null info (optional)
        'duplicates': dict,        # Duplicate info (optional)
        'outliers': dict,          # Column → outlier info (optional)
        'invalid_values': dict,    # Column → invalid value info (optional)
        'format_issues': dict      # Column → format issue info (optional)
    },
    'summary': {
        'total_issue_types': int,  # Count of issue categories with findings
        'status': str              # 'clean' or 'issues_found'
    }
}
```

**Notes**:
- `checks` dictionary only contains keys for issue types that were found
- Empty checks (no issues) are omitted from output
- See OUTPUT.md for detailed schema and examples

## Integration Patterns

### Pattern 1: Direct Usage

```python
# Direct skill invocation
/quality-checker df_conversion

# Returns quality report as markdown
```

### Pattern 2: Agent Pipeline (data-profiler)

```
User: /data-profiler df_conversion

Agent workflow:
├── Step 1: type-detector skill
│   └── Identifies column types (categorical, numeric, date, ID)
├── Step 2: quality-checker skill ← This skill
│   └── Detects nulls, duplicates, outliers, invalid values, format issues
├── Step 3: join-validator skill
│   └── Checks key column compatibility
└── Step 4: cleaning-suggester skill
    └── Generates cleaning recommendations (uses quality-checker output)
```

### Pattern 3: Skill Chaining (quality → cleaning)

```python
# Step 1: Run quality checks
quality_report = run_quality_checks(df)

# Step 2: Generate cleaning suggestions based on quality issues
cleaning_suggestions = suggest_cleaning(df, quality_report)

# quality_report is input to cleaning-suggester
```

### Pattern 4: Pre-Analysis Validation

```python
# Before running hypothesis test:
# 1. Check data quality
quality_report = run_quality_checks(df)

# 2. Validate quality meets requirements
if quality_report['summary']['status'] == 'issues_found':
    # Handle or report issues before proceeding
    pass

# 3. Proceed with analysis
run_hypothesis_test(df, predictor, outcome)
```

## Expected Input

The quality-checker skill accepts:

1. **DataFrame reference** (in-memory pandas DataFrame)
   - Example: `/quality-checker df_conversion`

2. **File path** (CSV or Excel)
   - Example: `/quality-checker data/raw/CIDsHRDrecording.xlsx`

3. **Optional parameters**:
   - Column name for focused check: `/quality-checker df_conversion hours_difference`
   - Key columns for duplicate detection (via script): `--key-columns confirmation_number`
   - Custom validations (via script): `--config custom_validations.yaml`

## Integration Notes

### For Downstream Skills

If you're building a skill that consumes quality-checker output:

1. **Access the output contract**: Quality report is a nested dictionary (see Output Contract above)
2. **Handle missing keys**: Check if issue type exists before accessing
   ```python
   if 'nulls' in quality_report['checks']:
       handle_nulls(quality_report['checks']['nulls'])
   ```
3. **Use summary status**: Check `quality_report['summary']['status']` for quick validation
4. **Iterate issue types**: Use `quality_report['summary']['total_issue_types']` for counting

### For Upstream Agents

If you're building an agent that calls quality-checker:

1. **Execution**: Call the script directly:
   ```bash
   python scripts/run_checking_quality.py <dataframe> [options]
   ```
2. **Output format**: Use `--format json` for programmatic parsing or `--format markdown` for display
3. **Pass to downstream**: quality_report can be passed to cleaning-suggester or other skills

## Dependencies

### Runtime Dependencies

- pandas
- numpy
- Python 3.12+

### File Dependencies

- `scripts/run_checking_quality.py` - Executable script
- `VALIDATIONS.md` - Business rules and thresholds (reference only)
- `OUTPUT.md` - Output format specs (reference only)

### No External Dependencies

- Does not require other skills to be installed
- Does not call external APIs or services
- Self-contained validation logic

## Backward Compatibility

The skill maintains backward compatibility with:

- **data-profiler agent** - Uses same output format
- **cleaning-suggester skill** - Output contract unchanged
- **Direct invocations** - Command syntax preserved

Changes to internal implementation do not affect consumers as long as output contract remains stable.
