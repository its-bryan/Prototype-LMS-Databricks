# Validation Rules for interpreting-results

## Interpretation Rules

### Significance Levels
| p-value | Statement |
|---------|-----------|
| p < 0.001 | "highly significant" |
| p < 0.01 | "significant" |
| p < 0.05 | "marginally significant" |
| p >= 0.05 | "not statistically significant" |

### Effect Size (Cramér's V)
| Value | Interpretation |
|-------|----------------|
| < 0.1 | negligible association |
| 0.1 - 0.3 | small association |
| 0.3 - 0.5 | medium association |
| > 0.5 | large association |

### Odds Ratio
| Value | Interpretation Template |
|-------|------------------------|
| OR > 1 | "{{factor}} increases the odds of conversion by {{pct}}%" |
| OR < 1 | "{{factor}} decreases the odds of conversion by {{pct}}%" |
| OR ≈ 1 | "{{factor}} has no meaningful effect on conversion" |

### Correlation Strength
| \|r\| | Interpretation |
|-------|----------------|
| < 0.1 | negligible |
| 0.1 - 0.3 | weak |
| 0.3 - 0.5 | moderate |
| 0.5 - 0.7 | strong |
| > 0.7 | very strong |