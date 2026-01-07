# Output Format for discovering-hypotheses

## Output Format

Return to `hypothesis-tester` agent:

```python
{
    'parent_hypothesis': 'H1',
    'n_samples': 15000,
    'tree_depth': 4,
    'sub_hypotheses': [
        {
            'id': 'H1a',
            'statement': 'Fast contact (<30min) + urgent rental (≤3 days) → 82% conversion vs 61% baseline',
            'interaction': 'contact_range × urgency_bin',
            'importance': 0.38,
            'conversion_by_group': {'urgent+fast': 0.82, 'other': 0.61},
            'data_needed': ['contact_range', 'urgency_days', 'checkout_date', 'initial_date'],
            'suggested_test': 'Logistic regression with interaction term',
            'feature_code': "df['urgency_days'] = ..."
        },
        {
            'id': 'H1b',
            'statement': 'Fast contact effect strongest at Counter locations',
            'interaction': 'contact_range × CONTACT_GROUP',
            'importance': 0.24,
            'conversion_by_group': {'Counter+fast': 0.78, 'HRD+fast': 0.68},
            'data_needed': ['contact_range', 'CONTACT_GROUP'],
            'suggested_test': 'Stratified chi-square or interaction in logistic regression',
            'feature_code': None
        }
    ],
    'markdown_output': "### Suggested Sub-Hypotheses for H1\n..."
}
```

## Example Usage

### Standalone - Generate new hypotheses

```
User: /discovering-hypotheses

Agent: Analyzing df_conversion for patterns...

       📊 Top Interaction Patterns Found:

       H_NEW1: Counter locations + weekend pickups → 81% conversion vs 68% baseline
               Importance: 0.42

       H_NEW2: StateFarm leads + <2hr contact → 76% vs 62% for slower contact
               Importance: 0.35

       H_NEW3: Body shop pickups + business hours → 72% vs 58% after hours
               Importance: 0.28

       Would you like me to:
       1. Add these to hypotheses.md and test now?
       2. Add to hypotheses.md for later?
       3. Explore further?
```

### Sub-hypothesis discovery - Refine weak result

```
User: /discovering-hypotheses H1

Agent: Analyzing H1 for interaction effects...

       📊 Suggested Sub-Hypotheses for H1:

       H1a: Fast contact + urgent rental (≤3 days) → 82% vs 61%
            Importance: 0.38

       H1b: Fast contact effect strongest at Counter
            Counter+fast: 78% vs HRD+fast: 68%
            Importance: 0.24
```

### Auto-triggered by hypothesis-tester

```
User: /hypothesis-tester H1

Agent: [Steps 1-7 complete]
       Result: p=0.08, effect=0.12

       ⚠️ Weak effect. Calling discovering-hypotheses...

       [discovering-hypotheses runs automatically]

       📊 Suggested Sub-Hypotheses: [output as above]
```