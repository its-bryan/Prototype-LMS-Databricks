---
name: describing-data
description: Generates comprehensive descriptive statistics for a dataset including column info, value distributions, row counts, duplicates, and basic data quality checks. Use when getting initial overview of a new dataset.
---

# describing-data

[Brief description of what this skill does]

## When to Use

Use this skill when:
- [Scenario 1]
- [Scenario 2]
- User asks: "[Example question]"

## When NOT to Use

Do not use when:
- [Exclusion scenario 1]
- [Exclusion scenario 2]

## What It Does

This skill [high-level description]:
- **Feature 1** - Brief description
- **Feature 2** - Brief description

## How It Works

**IMPORTANT**: This skill executes `scripts/run_describing_data.py`. Do NOT re-implement the logic inline.

1. [High-level step 1]
2. [High-level step 2]
3. [High-level step 3]

## How to Run

### Execute the Script

```bash
# Basic usage
python scripts/run_describing_data.py <input>

# With options
python scripts/run_describing_data.py <input> --format json
```

### Arguments

- `input` - [Description of input parameter]
- `--format` - Output format: `markdown` (default) or `json`
- `--output` - Save output to file instead of stdout

## References

- **[OUTPUT.md](./OUTPUT.md)** - Output format specifications
- **[REFERENCES.md](./REFERENCES.md)** - Integration documentation

## Used By

- [Agent/skill that uses this skill]
- Can be called directly for [use case]
