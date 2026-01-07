# Output Format for interpreting-results

## Interpretation Templates

### Chi-Square Test Results

**Input structure**:
```python
{
    'chi2': 15.3,
    'p_value': 0.002,
    'cramers_v': 0.18,
    'significant': True,
    'conversion_by_group': {...}
}
```

**Output template**:
```markdown

## Business Context Templates

### For Contact Time Hypotheses
```
Faster contact matters: Leads contacted within {{fast_window}} convert at {{fast_rate}}%
compared to {{slow_rate}}% for those contacted after {{slow_window}}.
This {{gap}}pp gap represents approximately {{estimated_leads}} additional conversions
per {{time_period}} if all leads were contacted quickly.
```

### For Channel Hypotheses
```
{{better_channel}} outperforms {{worse_channel}} by {{gap}} percentage points
({{better_rate}}% vs {{worse_rate}}%). Consider {{action_recommendation}}.
```

### For Partner/Source Hypotheses
```
Conversion varies significantly by {{grouping}}: {{best}} converts at {{best_rate}}%
while {{worst}} converts at only {{worst_rate}}%.
Investigate operational differences or lead quality variations.
```

## Example Output

### Input
```python
test_type = "chi_square"
results = {
    'chi2': 23.45,
    'p_value': 0.00012,
    'cramers_v': 0.22,
    'significant': True,
    'conversion_by_group': {
        '< 30 min': {'converted': 180, 'total': 240, 'conversion_rate': 75.0},
        '30min - 1hr': {'converted': 150, 'total': 220, 'conversion_rate': 68.2},
        '1-3 hrs': {'converted': 120, 'total': 200, 'conversion_rate': 60.0},
        '3+ hrs': {'converted': 110, 'total': 200, 'conversion_rate': 55.0}
    }
}
hypothesis = "H1: Faster initial contact improves conversion"
```

### Output
```markdown

## Output Verdicts

Always include one of these verdict statements:

- **SUPPORTED**: p < 0.05 and effect in hypothesized direction
- **NOT SUPPORTED**: p >= 0.05 (no significant effect found)
- **PARTIALLY SUPPORTED**: Significant but smaller effect than expected, or only some subgroups show effect
- **OPPOSITE EFFECT**: Significant but in opposite direction to hypothesis
- **INCONCLUSIVE**: Data quality issues or insufficient sample size