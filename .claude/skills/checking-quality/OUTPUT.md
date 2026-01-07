# Output Format Specifications

This document defines the output format for quality check reports in both Markdown and JSON formats.

## Markdown Output Format

### Report Header

```markdown
## Data Quality Report: `<dataframe_name>`

**Shape**: N rows × M columns
**Status**: ✓ Clean / ⚠️ Issues Found (X issue types)
```

**Status values**:
- `✓ Clean` - No issues detected across all checks
- `⚠️ Issues Found (X issue types)` - One or more issue categories have findings

### Section 1: Null Values

Only displayed if null values are detected.

```markdown
### Null Values
| Column | Null Count | Null % | Severity |
|--------|------------|--------|----------|
| column_name | 52 | 5.2% | medium |
| another_column | 890 | 89.0% | critical |
```

**Severity levels**: none, low, medium, high, critical (see VALIDATIONS.md)

### Section 2: Duplicates

Only displayed if duplicates are detected.

```markdown
### Duplicates
- **Duplicate rows**: N (X.X%)
- **Duplicate keys** (`key_column_name`): N (X.X%)
  - Examples: `value1`, `value2`, `value3`
```

### Section 3: Outliers

Only displayed if outliers are detected.

```markdown
### Outliers (IQR Method)
| Column | Outlier Count | % | Range | Examples |
|--------|---------------|---|-------|----------|
| hours_difference | 23 | 2.3% | >156 hrs | 200, 340, 512 |
| another_numeric | 15 | 1.5% | <-10 or >100 | -15, 125, 200 |
```

**Range format**:
- IQR method: Shows bounds (e.g., `<10 or >50`)
- Z-score method: Shows `|z| > 3`

### Section 4: Invalid Values

Only displayed if invalid values are detected.

```markdown
### Invalid Values
| Column | Invalid Count | Rule | Examples |
|--------|---------------|------|----------|
| rental | 2 | must be 0 or 1 | 2, -1 |
| hours_difference | 5 | must be >= 0 | -10, -25, -3 |
```

**Rule descriptions**:
- `must be 0 or 1` - Binary indicator violation
- `must be >= N` - Minimum value violation
- `must be <= N` - Maximum value violation
- `must not be future date` - Future date violation
- `must match pattern` - Regex pattern violation

### Section 5: Format Issues

Only displayed if format inconsistencies are detected.

```markdown
### Format Issues
| Column | Issue |
|--------|-------|
| cdp_name | Mixed case: 45% uppercase |
| confirmation_number | 0.5% have trailing spaces |
| customer_name | 2.3% have leading spaces |
```

### Section 6: Recommended Actions

Always displayed as summary guidance.

```markdown
---

### Recommended Actions
1. **column_name nulls**: Context-specific recommendation
2. **column_name outliers**: Investigate extreme values
3. **Trim whitespace**: List of affected columns
4. **Standardize format**: List of affected columns
```

## Complete Example

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
|--------|---------------|---|-------|----------|
| hours_difference | 23 | 2.3% | >156 hrs | 200, 340, 512 |

### Invalid Values
| Column | Invalid Count | Rule | Examples |
|--------|---------------|------|----------|
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

## JSON Output Format

### Schema

```json
{
  "dataframe": "string (dataframe name)",
  "shape": {
    "rows": "integer",
    "columns": "integer"
  },
  "checks": {
    "nulls": {
      "column_name": {
        "null_count": "integer",
        "null_pct": "float",
        "severity": "string (none|low|medium|high|critical)"
      }
    },
    "duplicates": {
      "total_rows": "integer",
      "duplicate_rows": "integer",
      "duplicate_pct": "float",
      "duplicate_keys": "integer (optional)",
      "duplicate_key_pct": "float (optional)",
      "duplicate_key_examples": ["array of dicts (optional)"]
    },
    "outliers": {
      "column_name": {
        "count": "integer",
        "pct": "float",
        "min_outlier": "float",
        "max_outlier": "float",
        "bounds": {
          "lower": "float",
          "upper": "float"
        },
        "examples": ["array of values"]
      }
    },
    "invalid_values": {
      "column_name": {
        "invalid_count": "integer",
        "invalid_pct": "float",
        "rule": "object (validation rule)",
        "examples": ["array of invalid values"]
      }
    },
    "format_issues": {
      "column_name": {
        "issues": ["array of issue descriptions"],
        "patterns": {
          "uppercase": "float (0-1)",
          "lowercase": "float (0-1)",
          "mixed_case": "float (0-1)",
          "has_leading_space": "float (0-1)",
          "has_trailing_space": "float (0-1)"
        }
      }
    }
  },
  "summary": {
    "total_issue_types": "integer",
    "status": "string (clean|issues_found)"
  }
}
```

### Example JSON Output

```json
{
  "dataframe": "df_conversion",
  "shape": {
    "rows": 1000,
    "columns": 25
  },
  "checks": {
    "nulls": {
      "hours_difference": {
        "null_count": 52,
        "null_pct": 5.2,
        "severity": "medium"
      },
      "cancel_reason": {
        "null_count": 890,
        "null_pct": 89.0,
        "severity": "critical"
      }
    },
    "duplicates": {
      "total_rows": 1000,
      "duplicate_rows": 0,
      "duplicate_pct": 0.0,
      "duplicate_keys": 3,
      "duplicate_key_pct": 0.3,
      "duplicate_key_examples": [
        {"confirmation_number": "CF123456"},
        {"confirmation_number": "CF789012"}
      ]
    },
    "outliers": {
      "hours_difference": {
        "count": 23,
        "pct": 2.3,
        "min_outlier": 200.0,
        "max_outlier": 512.0,
        "bounds": {
          "lower": -10.5,
          "upper": 156.5
        },
        "examples": [200, 340, 512]
      }
    },
    "invalid_values": {
      "rental": {
        "invalid_count": 2,
        "invalid_pct": 0.2,
        "rule": {
          "type": "in_set",
          "valid": [0, 1, 0.0, 1.0]
        },
        "examples": [2, -1]
      }
    },
    "format_issues": {
      "cdp_name": {
        "issues": ["Mixed case: 45% uppercase"],
        "patterns": {
          "uppercase": 0.45,
          "lowercase": 0.30,
          "mixed_case": 0.25,
          "has_leading_space": 0.0,
          "has_trailing_space": 0.0
        }
      }
    }
  },
  "summary": {
    "total_issue_types": 4,
    "status": "issues_found"
  }
}
```

## Status Values

| Status | Description | total_issue_types |
|--------|-------------|-------------------|
| `clean` | No issues detected across all checks | 0 |
| `issues_found` | One or more issue categories have findings | > 0 |

## Usage

### Generating Markdown Output

```bash
python scripts/run_checking_quality.py df_conversion --format markdown
```

### Generating JSON Output

```bash
python scripts/run_checking_quality.py df_conversion --format json
```

### Saving to File

```bash
python scripts/run_checking_quality.py df_conversion --format markdown --output report.md
python scripts/run_checking_quality.py df_conversion --format json --output report.json
```
