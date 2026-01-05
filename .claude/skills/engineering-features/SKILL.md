---
name: engineering-features
description: Creates derived features needed for hypothesis testing from raw data columns. Use when creating urgency metrics, channel flags, timing features, or when hypotheses require computed variables.
---

# feature-engineer

Shared skill that creates derived features needed for hypothesis testing or ML discovery.

## Purpose

Automatically creates derived features based on hypothesis requirements. Called by both `hypothesis-discovery` and `hypothesis-tester` to ensure required features exist before analysis.

## Invocation

```
/feature-engineer H1
/feature-engineer H1 --dataframe df_conversion
/feature-engineer "test urgency effect on conversion"
```

## Inputs

- Hypothesis statement or ID
- DataFrame (default: `df_conversion`)
- (Optional) Specific features to create

## Common Feature Recipes

| Feature | Source Columns | Code | Used For | Status |
|---------|----------------|------|----------|--------|
| `urgency_days` | checkout_date, initial_date | `(checkout_date - initial_date).dt.days` | Time sensitivity | Ready |
| `urgency_bin` | urgency_days | `pd.cut(...)` | Categorized urgency | Ready |
| `is_counter` | CONTACT_GROUP | `CONTACT_GROUP == 'Counter'` | Channel analysis | Ready |
| `is_hrd` | CONTACT_GROUP | `CONTACT_GROUP == 'HRD'` | Channel analysis | Ready |
| `is_mmr` | TBD | TBD - need to determine from data | Digital self-service | **TBD** |
| `day_of_week` | initial_date | `initial_date.dt.dayofweek` | Timing patterns | Ready |
| `hour_of_day` | initial_date | `initial_date.dt.hour` | Timing patterns | Ready |
| `is_weekend` | day_of_week | `day_of_week.isin([5,6])` | Weekend effect | Ready |
| `is_business_hours` | hour_of_day | `hour_of_day.between(9,17)` | Business hours effect | Ready |
| `contact_speed_min` | hours_difference | Already exists or parse from contact_range | Contact speed | Ready |

**Note**: `is_mmr` (MMR digital self-service) definition is TBD. Need to explore data to determine how MMR completion is reflected (possibly MSG10 field or other indicator).

## Process

### Step 1: Parse Hypothesis

Extract keywords that indicate required features:

| Keyword Pattern | Features Needed |
|-----------------|-----------------|
| "urgent", "urgency", "time to checkout" | urgency_days, urgency_bin |
| "contact speed", "response time", "fast contact" | contact_speed_min, contact_range |
| "channel", "counter", "HRD" | is_counter, is_hrd |
| "self-service", "MMR", "digital" | is_mmr (**flag as TBD if recipe unknown**) |
| "day", "weekend", "timing" | day_of_week, is_weekend |
| "hour", "business hours" | hour_of_day, is_business_hours |
| "partner", "insurance", "CDP" | cdp_category (if grouping needed) |
| "location", "branch" | location_tier (if ranking needed) |

### Step 2: Check Existing Features

```python
def check_features(df, required_features):
    """Check which features exist and which need to be created."""
    existing = [f for f in required_features if f in df.columns]
    missing = [f for f in required_features if f not in df.columns]
    return existing, missing
```

### Step 3: Generate Feature Code

For each missing feature, look up the recipe and generate code:

```python
def generate_feature_code(feature_name, df):
    """Generate Python code to create a feature."""

    recipes = {
        'urgency_days': """
# Calculate days between initial contact and checkout
df['urgency_days'] = (pd.to_datetime(df['checkout_date']) - pd.to_datetime(df['initial_date'])).dt.days
""",
        'urgency_bin': """
# Categorize urgency into bins
df['urgency_bin'] = pd.cut(
    df['urgency_days'],
    bins=[-1, 2, 7, float('inf')],
    labels=['urgent', 'normal', 'flexible']
)
""",
        'is_counter': """
# Flag for Counter channel
df['is_counter'] = (df['CONTACT_GROUP'] == 'Counter').astype(int)
""",
        'is_hrd': """
# Flag for HRD (centralized call center) channel
df['is_hrd'] = (df['CONTACT_GROUP'] == 'HRD').astype(int)
""",
        'day_of_week': """
# Extract day of week (0=Monday, 6=Sunday)
df['day_of_week'] = pd.to_datetime(df['initial_date']).dt.dayofweek
""",
        'hour_of_day': """
# Extract hour of day
df['hour_of_day'] = pd.to_datetime(df['initial_date']).dt.hour
""",
        'is_weekend': """
# Flag for weekend
df['is_weekend'] = df['day_of_week'].isin([5, 6]).astype(int)
""",
        'is_business_hours': """
# Flag for business hours (9am-5pm)
df['is_business_hours'] = df['hour_of_day'].between(9, 17).astype(int)
"""
    }

    # Features that need data exploration first
    tbd_features = {
        'is_mmr': "# TBD: Need to determine how MMR completion is reflected in data (possibly MSG10 field)"
    }

    if feature_name in tbd_features:
        return tbd_features[feature_name]

    return recipes.get(feature_name, f"# TODO: Define recipe for {feature_name}")
```

### Step 4: Handle TBD Features

If a feature recipe is TBD:
1. Flag it in the output
2. Suggest exploring the data to define the recipe
3. List candidate columns that might be relevant

```python
if feature_name in tbd_features:
    return {
        'status': 'TBD',
        'message': f"Feature '{feature_name}' recipe not yet defined",
        'suggestion': "Explore data to determine correct definition",
        'candidate_columns': find_related_columns(df, feature_name)
    }
```

### Step 5: Execute and Validate

```python
# Execute feature creation
exec(feature_code)

# Validate new feature
assert feature_name in df.columns, f"Failed to create {feature_name}"
print(f"Created {feature_name}: {df[feature_name].value_counts().to_dict()}")
```

### Step 6: Log and Return

```python
result = {
    'features_created': ['urgency_days', 'urgency_bin'],
    'features_existing': ['contact_range', 'rental'],
    'features_tbd': ['is_mmr'],  # Features that couldn't be created
    'code': combined_code,
    'validation': {
        'urgency_days': {'min': 0, 'max': 90, 'null_pct': 0.02},
        'urgency_bin': {'distribution': {'urgent': 0.3, 'normal': 0.5, 'flexible': 0.2}}
    }
}
```

## Output Format

Return to calling skill/agent:

```markdown
## Feature Engineering Complete

**Created**: urgency_days, urgency_bin
**Already existed**: contact_range, CONTACT_GROUP, rental
**TBD (recipe undefined)**: is_mmr

### New Feature Details

| Feature | Type | Distribution |
|---------|------|--------------|
| urgency_days | numeric | mean=5.2, min=0, max=45 |
| urgency_bin | categorical | urgent: 30%, normal: 50%, flexible: 20% |

### Features Requiring Definition

| Feature | Issue | Suggestion |
|---------|-------|------------|
| is_mmr | Recipe not defined | Explore MSG10 field or CONTACT_GROUP values |

### Code (for reproducibility)

```python
df['urgency_days'] = (pd.to_datetime(df['checkout_date']) - pd.to_datetime(df['initial_date'])).dt.days
df['urgency_bin'] = pd.cut(df['urgency_days'], bins=[-1,2,7,float('inf')], labels=['urgent','normal','flexible'])
```
```

## Dependencies

**Source columns required** (must exist in DataFrame):
- `initial_date` - For timing features
- `checkout_date` - For urgency features
- `CONTACT_GROUP` - For channel features
- `hours_difference` or `contact_range` - For contact speed features

## Error Handling

| Error | Response |
|-------|----------|
| Source column missing | List alternatives, ask user which to use |
| Date parsing fails | Try multiple date formats, flag if still failing |
| Feature already exists | Skip creation, note in log |
| Recipe is TBD | Flag in output, suggest data exploration |
| Unknown feature requested | Suggest similar features or ask for recipe |

## Adding New Feature Recipes

When a TBD feature is defined, update this skill:

1. Add recipe to the `recipes` dictionary
2. Remove from `tbd_features`
3. Update the Common Feature Recipes table
4. Test with sample data

## Usage by Other Skills/Agents

### Called by hypothesis-tester (Step 2b)

```python
# In hypothesis-tester, after data validation
feature_result = call_skill('feature-engineer', hypothesis=H1, df=df_conversion)
df_enriched = feature_result['df']

# Check for TBD features
if feature_result['features_tbd']:
    warn(f"Some features could not be created: {feature_result['features_tbd']}")
```

### Called by hypothesis-discovery (Step 1)

```python
# In hypothesis-discovery, before running ML
feature_result = call_skill('feature-engineer',
                            hypothesis=H1,
                            df=df_conversion,
                            features=['urgency_bin', 'is_counter', 'is_weekend', 'is_business_hours'])
df_enriched = feature_result['df']
```
