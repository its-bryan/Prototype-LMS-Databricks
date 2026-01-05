# results-interpreter

Translate statistical test results into plain English findings with business context.

## Usage

```
/results-interpreter <test_type> <results_dict>
```

Or provide context naturally:
```
/results-interpreter chi-square results: chi2=15.3, p=0.002, cramers_v=0.18, conversion rates by contact_range showing 75% for <30min vs 55% for 3+hrs
```

## Input Parameters

- **test_type**: The statistical test that was run
- **results**: Dictionary or summary of statistical results
- **context**: Business context (e.g., "testing if faster contact improves conversion")
- **hypothesis_id**: Reference to hypothesis being tested

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
## Hypothesis {{hypothesis_id}} Results: {{hypothesis_title}}

### Finding
{{significant_statement}}

### Key Numbers
- **Statistical significance**: χ² = {{chi2}}, p {{p_comparison}} ({{significance_level}})
- **Effect size**: Cramér's V = {{cramers_v}} ({{effect_interpretation}})
- **Sample size**: {{n}} observations

### Conversion Rates by Group
| {{group_col}} | Converted | Total | Rate |
|---------------|-----------|-------|------|
{{#each groups}}
| {{name}} | {{converted}} | {{total}} | {{rate}}% |
{{/each}}

### Business Interpretation
{{business_interpretation}}

### Recommendation
{{recommendation}}
```

### Logistic Regression Results

**Input structure**:
```python
{
    'odds_ratios': {'predictor': 2.4},
    'p_values': {'predictor': 0.003},
    'conf_int_95': {'predictor': [1.8, 3.1]},
    'pseudo_r2': 0.08
}
```

**Output template**:
```markdown
## Hypothesis {{hypothesis_id}} Results: {{hypothesis_title}}

### Finding
{{main_finding}}

### Key Numbers
- **Odds ratio**: {{odds_ratio}} (95% CI: {{ci_lower}} - {{ci_upper}})
- **Interpretation**: {{odds_interpretation}}
- **Statistical significance**: p = {{p_value}} ({{significance_statement}})
- **Model fit**: Pseudo R² = {{pseudo_r2}} ({{fit_interpretation}})

### What This Means
{{plain_english_explanation}}

### Caveat
{{limitations}}
```

### Conversion Rate Comparison Results

**Output template**:
```markdown
## Hypothesis {{hypothesis_id}} Results: {{hypothesis_title}}

### Finding
{{main_finding}}

### Conversion Rates
| Group | Rate | 95% CI | vs Baseline |
|-------|------|--------|-------------|
{{#each groups}}
| {{name}} | {{rate}}% | {{ci_lower}}-{{ci_upper}}% | {{vs_baseline}} |
{{/each}}

**Baseline**: {{baseline}}%
**Spread**: {{spread}} percentage points between best and worst

### Business Impact
{{impact_statement}}
```

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
## H1 Results: Faster Initial Contact Improves Conversion

### Finding
**SUPPORTED** - There is a statistically significant association between contact speed and conversion rates.

### Key Numbers
- **Statistical significance**: χ² = 23.45, p < 0.001 (highly significant)
- **Effect size**: Cramér's V = 0.22 (small-to-medium association)
- **Sample size**: 860 leads analyzed

### Conversion Rates by Contact Time
| Contact Window | Converted | Total | Rate |
|----------------|-----------|-------|------|
| < 30 min | 180 | 240 | **75.0%** |
| 30min - 1hr | 150 | 220 | 68.2% |
| 1-3 hrs | 120 | 200 | 60.0% |
| 3+ hrs | 110 | 200 | 55.0% |

### Business Interpretation
Leads contacted within 30 minutes convert at 75% compared to 55% for those contacted after 3+ hours—a **20 percentage point gap**. The relationship shows a clear gradient: every delay bracket reduces conversion.

### Recommendation
Prioritize reducing time-to-first-contact. The 20pp improvement potential from <30min contact suggests this should be a primary operational focus. Consider:
- Staffing adjustments during high-volume periods
- Automated prioritization of fresh leads
- Real-time alerts for aging uncontacted leads
```

## Output Verdicts

Always include one of these verdict statements:

- **SUPPORTED**: p < 0.05 and effect in hypothesized direction
- **NOT SUPPORTED**: p >= 0.05 (no significant effect found)
- **PARTIALLY SUPPORTED**: Significant but smaller effect than expected, or only some subgroups show effect
- **OPPOSITE EFFECT**: Significant but in opposite direction to hypothesis
- **INCONCLUSIVE**: Data quality issues or insufficient sample size
