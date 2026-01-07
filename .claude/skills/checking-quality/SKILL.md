---
name: checking-quality
description: Identifies data quality issues including nulls, outliers, invalid values, and duplicates. Use when profiling data, investigating data problems, or when the user asks about data quality.
---

# quality-checker

Detect data quality issues in a DataFrame: nulls, duplicates, outliers, invalid values, and format inconsistencies.

## When to Use

Use this skill when:
- Profiling a new dataset
- Investigating data quality problems
- Validating data before analysis
- User asks: "Are there any data quality issues?"
- User asks: "Check the data quality of..."
- User asks: "Are there outliers in...?"

## When NOT to Use

Do not use when:
- User wants to clean/fix data (use `cleaning-suggester` instead)
- User wants descriptive statistics (use `describing-data` instead)
- User wants to understand column types (use `detecting-types` instead)

## What It Does

This skill executes quality checks and generates a comprehensive report identifying:
- **Null values** by column with severity levels
- **Duplicate rows** and duplicate key values
- **Outliers** in numeric columns using IQR or Z-score methods
- **Invalid values** that violate business rules
- **Format inconsistencies** in string columns (mixed case, whitespace)

## How It Works

**IMPORTANT**: This skill executes `scripts/run_checking_quality.py`. Do NOT re-implement the quality check logic inline.

1. Loads the DataFrame from file or accepts in-memory data
2. Applies all quality checks (see [VALIDATIONS.md](./VALIDATIONS.md) for thresholds)
3. Generates formatted report (see [OUTPUT.md](./OUTPUT.md) for format)
4. Returns results as markdown or JSON

## Quality Checks Performed

| Check | Description | Details |
|-------|-------------|---------|
| Nulls | Missing values by column | See [VALIDATIONS.md](./VALIDATIONS.md#null-values) |
| Duplicates | Duplicate rows | Flag if any |
| Duplicate keys | Duplicate values in ID columns | Flag if any |
| Outliers | Extreme values in numeric columns | IQR method (1.5×) or Z-score |
| Invalid values | Values violating business rules | See [VALIDATIONS.md](./VALIDATIONS.md#default-hles-validations) |
| Format issues | Mixed formats in string columns | See [VALIDATIONS.md](./VALIDATIONS.md#format-consistency) |

## How to Run

### Execute the Script

```bash
# Basic usage
python scripts/run_checking_quality.py <file.csv>

# With options
python scripts/run_checking_quality.py data/raw/file.xlsx --format markdown
python scripts/run_checking_quality.py data.csv --key-columns confirmation_number
python scripts/run_checking_quality.py data.csv --config validations.yaml --output report.md
```

### Arguments

- `input` - Path to CSV, Excel, or Parquet file (required)
- `--key-columns` - Column(s) to check for duplicate keys
- `--config` - Path to custom validations (JSON or YAML)
- `--format` - Output format: `markdown` (default) or `json`
- `--output` - Save report to file instead of stdout
- `--name` - DataFrame name for report (default: filename)

## References

- **[VALIDATIONS.md](./VALIDATIONS.md)** - Thresholds, severity levels, and business rules
- **[OUTPUT.md](./OUTPUT.md)** - Report format specifications and examples
- **[REFERENCES.md](./REFERENCES.md)** - Integration with other skills and agents

## Used By

- **data-profiler** agent - Calls this skill as Step 2 of profiling workflow
- **cleaning-suggester** skill - Consumes output to recommend fixes
- Can be called directly for standalone quality checks
