# hypothesis-discovery

ML-driven skill that discovers sub-hypotheses when a main hypothesis shows weak or inconclusive effects.

## Purpose

Uses decision tree analysis to identify interaction effects and segment the data into sub-groups where the hypothesis may show stronger effects. Called by `hypothesis-tester` agent when results are weak (Step 7b).

## Invocation

```
/hypothesis-discovery H1
/hypothesis-discovery H1 --dataframe df_conversion
/hypothesis-discovery "test if contact speed affects conversion"
```

## Trigger Conditions

Called by `hypothesis-tester` when ANY of:
- p-value > 0.05 (not statistically significant)
- effect size < 0.15 (weak practical effect)
- confidence = "Low" or "Medium"

## Inputs

- Hypothesis ID (e.g., "H1") or description
- DataFrame with predictor and outcome columns
- Target variable (default: `rental` for conversion)
- (Optional) List of specific interaction variables to explore

## Process

### Step 1: Call feature-engineer Skill

Create all potential interaction features before running ML:

```python
# Create interaction candidate features
feature_result = call_skill('feature-engineer',
                            hypothesis=hypothesis,
                            df=df,
                            features=[
                                'urgency_days', 'urgency_bin',
                                'is_counter', 'is_hrd',
                                'day_of_week', 'is_weekend',
                                'hour_of_day', 'is_business_hours'
                            ])
df_enriched = feature_result['df']
```

### Step 2: Prepare Features for Decision Tree

```python
# Identify the main predictor from the hypothesis
main_predictor = extract_predictor(hypothesis)  # e.g., 'contact_range' for H1

# Interaction candidates
interaction_features = [
    'urgency_bin',           # Time sensitivity
    'is_counter', 'is_hrd',  # Channel
    'cdp_name',              # Insurance partner
    'day_of_week',           # Timing
    'is_business_hours',
    # Add location if available
]

# Filter to features that exist in DataFrame
available_features = [f for f in interaction_features if f in df_enriched.columns]
```

### Step 3: Build Decision Tree

```python
from sklearn.tree import DecisionTreeClassifier
from sklearn.preprocessing import LabelEncoder

# Encode categorical features
X = df_enriched[[main_predictor] + available_features].copy()
for col in X.select_dtypes(include=['object', 'category']).columns:
    X[col] = LabelEncoder().fit_transform(X[col].astype(str))

y = df_enriched['rental']  # Conversion target

# Fit decision tree (limit depth to avoid overfitting)
tree = DecisionTreeClassifier(
    max_depth=4,
    min_samples_leaf=50,
    min_samples_split=100
)
tree.fit(X.dropna(), y[X.dropna().index])
```

### Step 4: Extract Top Splits

```python
from sklearn.tree import export_text

# Get feature importances
importances = dict(zip(X.columns, tree.feature_importances_))

# Get tree structure as text
tree_rules = export_text(tree, feature_names=list(X.columns))

# Parse rules to identify interaction patterns
def extract_top_splits(tree, feature_names, n=5):
    """Extract top n splitting rules by importance."""
    # Returns list of (feature, threshold, improvement, left_rate, right_rate)
    ...
```

### Step 5: Translate Splits to Sub-Hypotheses

For each significant split, create a sub-hypothesis:

```python
def create_sub_hypothesis(parent_id, split_info, df):
    """Convert a tree split into a hypothesis statement."""

    feature = split_info['feature']
    threshold = split_info['threshold']
    left_rate = split_info['left_conversion']
    right_rate = split_info['right_conversion']

    # Generate hypothesis statement
    if feature == 'urgency_bin':
        statement = f"Fast contact + urgent rental (≤3 days) shows {left_rate:.0%} conversion vs {right_rate:.0%} for non-urgent"
    elif feature == 'is_counter':
        statement = f"Fast contact effect is stronger at Counter ({left_rate:.0%}) vs HRD ({right_rate:.0%})"
    # ... more feature-specific templates

    return {
        'id': f"{parent_id}a",  # H1 -> H1a, H1b, etc.
        'statement': statement,
        'interaction': f"{main_predictor} × {feature}",
        'split_importance': split_info['importance'],
        'conversion_by_group': {
            'group_1': left_rate,
            'group_2': right_rate
        },
        'data_needed': [main_predictor, feature],
        'suggested_test': recommend_test(main_predictor, feature),
        'feature_code': feature_result.get('code', '')  # Include feature engineering code
    }
```

### Step 6: Format Output

```markdown
### Suggested Sub-Hypotheses for {parent_id}

Based on decision tree analysis of {n_samples} records:

**{parent_id}a**: {statement}
- **Status**: 🔴 Not Started
- **Hypothesis**: {detailed_statement}
- **Interaction**: {main_predictor} × {interaction_feature}
- **Split importance**: {importance:.2f}
- **Observed rates**: Group 1: {rate1:.0%}, Group 2: {rate2:.0%}
- **Data needed**: {columns}
- **Suggested test**: {test_type}
- **Feature code**:
  ```python
  {feature_code}
  ```

**{parent_id}b**: {statement_b}
...
```

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

## Key Interaction Variables

The skill explores these interaction candidates:

| Category | Variables | Source |
|----------|-----------|--------|
| **Urgency** | urgency_days, urgency_bin | checkout_date - initial_date |
| **Channel** | is_counter, is_hrd, CONTACT_GROUP | CONTACT_GROUP |
| **Partner** | cdp_name, partner_category | cdp_name |
| **Location** | RENT_LOC, location_tier | RENT_LOC |
| **Timing** | day_of_week, is_weekend, hour_of_day, is_business_hours | initial_date |

## Dependencies

**Skills called**:
- `feature-engineer` - Create interaction features before ML

**Python packages**:
- scikit-learn (DecisionTreeClassifier)
- pandas

## Error Handling

| Error | Response |
|-------|----------|
| Insufficient data | Require min 500 samples, warn if < 1000 |
| No significant splits found | Report "No clear interaction effects detected" |
| Feature creation failed | Use available features, note limitations |
| Tree overfitting | Increase min_samples_leaf, reduce max_depth |

## Example Usage

### Called by hypothesis-tester (Step 7b)

```
User: /hypothesis-tester H1

Agent: [Steps 1-7 complete]
       Result: p=0.08, effect=0.12

       ⚠️ Weak effect. Calling hypothesis-discovery...

       [hypothesis-discovery runs]

       📊 Suggested Sub-Hypotheses:

       H1a: Fast contact + urgent rental (≤3 days) → 82% vs 61%
            Importance: 0.38

       H1b: Fast contact effect strongest at Counter
            Counter+fast: 78% vs HRD+fast: 68%
            Importance: 0.24

       Would you like me to:
       1. Add these to hypotheses.md and test now?
       2. Add to hypotheses.md for later?
       3. Skip?
```

### Standalone usage

```
User: /hypothesis-discovery H1

Agent: [Runs discovery on H1]
       [Returns sub-hypothesis suggestions]
```
