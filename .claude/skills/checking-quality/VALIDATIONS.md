# Data Quality Validation Rules

This document defines thresholds, severity levels, and business rules used by the quality checker.

## Threshold Definitions

### Null Values

Severity levels based on percentage of missing values:

| Severity | Null % | Description |
|----------|--------|-------------|
| none | 0% | No missing values |
| low | 1-5% | Minimal missing values |
| medium | 6-20% | Moderate missing values |
| high | 21-50% | Significant missing values |
| critical | >50% | Majority missing |

**Default threshold**: Flag columns with >5% null values.

### Duplicates

- **Duplicate rows**: Flag if any duplicate rows exist
- **Duplicate keys**: Flag if any duplicate values in ID columns exist
- No percentage threshold - any duplicates are reported

### Outliers

Two detection methods available:

#### IQR Method (Default)
- **Formula**: Values outside [Q1 - 1.5×IQR, Q3 + 1.5×IQR]
- **Threshold**: 1.5× (configurable)
- **Usage**: Works well for skewed distributions

#### Z-Score Method
- **Formula**: Values where |z-score| > 3
- **Threshold**: 3 standard deviations
- **Usage**: Assumes normal distribution

### Format Consistency

Flags mixed patterns in string columns:

| Pattern | Threshold | Description |
|---------|-----------|-------------|
| Mixed case | 10-90% | Neither fully uppercase nor lowercase |
| Leading spaces | >1% | Values starting with whitespace |
| Trailing spaces | >1% | Values ending with whitespace |

## Default HLES Validations

Business rules specific to Hertz HLES (insurance replacement) data:

### Binary Indicator Columns

Must contain only 0 or 1:
- `rental` - Whether lead converted to rental
- `cancel` - Whether reservation was cancelled
- `unused` - Whether reservation was unused

**Valid values**: `[0, 1, 0.0, 1.0]`

### ID Columns

- `res_id` - Must equal 1 (aggregated data indicator)
  - **Valid values**: `[1, 1.0]`

### Numeric Constraints

- `hours_difference` - Time between lead and rental
  - **Constraint**: Must be ≥ 0 (cannot have negative hours)

### Date Constraints

Date columns must not contain future dates:
- `initial_date` - Initial reservation date
- `checkout_date` - Rental checkout date

**Validation**: Date must be ≤ current date

## Custom Validation Schema

To apply custom validations, provide a Python dictionary or YAML config:

### Python Dictionary Format

```python
validations = {
    'column_name': {
        'type': 'in_set',  # or 'min', 'max', 'not_future', 'regex'
        'valid': [0, 1],   # for 'in_set'
        'value': 0,        # for 'min' or 'max'
        'pattern': r'^[A-Z]{2}\d{6}$'  # for 'regex'
    }
}
```

### Validation Types

| Type | Parameters | Description | Example |
|------|------------|-------------|---------|
| `in_set` | `valid` (list) | Value must be in allowed set | Binary indicators (0/1) |
| `min` | `value` (numeric) | Value must be ≥ threshold | Hours ≥ 0 |
| `max` | `value` (numeric) | Value must be ≤ threshold | Percentage ≤ 100 |
| `not_future` | None | Date must not be future | Transaction dates |
| `regex` | `pattern` (string) | Value must match regex | ID formats |

### Example Custom Validations

```python
# Example for different dataset
custom_validations = {
    'status_code': {
        'type': 'in_set',
        'valid': ['active', 'inactive', 'pending']
    },
    'discount_pct': {
        'type': 'min',
        'value': 0
    },
    'discount_pct': {
        'type': 'max',
        'value': 100
    },
    'confirmation_number': {
        'type': 'regex',
        'pattern': r'^CF\d{6}$'
    }
}
```

## Integration with Scripts

The `run_checking_quality.py` script loads these validations as defaults.

To use custom validations:
```bash
python scripts/run_checking_quality.py df_name --config custom_validations.yaml
```

YAML format:
```yaml
rental:
  type: in_set
  valid: [0, 1]

hours_difference:
  type: min
  value: 0

initial_date:
  type: not_future
```
