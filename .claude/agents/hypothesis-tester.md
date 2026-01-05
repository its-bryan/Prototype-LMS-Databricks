# hypothesis-tester

Orchestrating agent that systematically tests a hypothesis from `docs/hypotheses.md` against HLES data.

## Purpose

Automates the full hypothesis testing workflow:
1. Parse hypothesis requirements
2. Load and validate relevant data
2b. **Create required features** (feature-engineer skill)
3. Select appropriate statistical test
4. Generate and execute analysis code
5. Execute analysis
6. **Validate results** (built-in sanity checks)
7. Interpret results
7b. **Discover sub-hypotheses** (if weak effect - hypothesis-discovery skill)
8. Generate visualization
9. Update hypothesis status in tracking doc

## Invocation

```
/hypothesis-tester H1
/hypothesis-tester H1 --dataframe df_conversion
/hypothesis-tester "test if contact speed affects conversion"
```

## Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│                     HYPOTHESIS-TESTER AGENT                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. PARSE HYPOTHESIS                                             │
│     ├─ Read docs/hypotheses.md                                   │
│     ├─ Extract: hypothesis statement, data needed, expected test │
│     └─ Identify predictor and outcome variables                  │
│                                                                  │
│  2. VALIDATE DATA                                                │
│     ├─ Check required columns exist                              │
│     ├─ Call type-detector skill for variable types               │
│     ├─ Call quality-checker skill for data issues                │
│     └─ Flag if data insufficient                                 │
│                                                                  │
│  2b. CREATE FEATURES (feature-engineer skill) ◄── NEW            │
│      ├─ Parse hypothesis for required derived features           │
│      ├─ Check which features exist                               │
│      ├─ Create missing features (urgency, channel flags, etc.)   │
│      └─ Return enriched DataFrame                                │
│                                                                  │
│  3. SELECT TEST (stat-test-selector skill)                       │
│     ├─ Input: predictor type, outcome type, question type        │
│     └─ Output: recommended test, assumptions, effect size metric │
│                                                                  │
│  4. GENERATE CODE (analysis-coder skill)                         │
│     ├─ Input: hypothesis, test type, columns                     │
│     └─ Output: Python function for the analysis                  │
│                                                                  │
│  5. EXECUTE ANALYSIS                                             │
│     ├─ Run code via mcp__ide__executeCode (if notebook open)     │
│     └─ Or execute in Bash and capture output                     │
│                                                                  │
│  6. VALIDATE RESULTS (built-in sanity checks)                    │
│     ├─ Sample size: n ≥ 30 per group?                            │
│     ├─ Assumptions: expected counts ≥ 5? normality?              │
│     ├─ Effect vs significance: large p + large effect = warning  │
│     ├─ Direction: does effect match hypothesis direction?        │
│     ├─ Business sense: rates between 0-100%? realistic values?   │
│     ├─ Multiple comparisons: need Bonferroni correction?         │
│     └─ If issues found → flag warnings, suggest alternatives     │
│                                                                  │
│  7. INTERPRET RESULTS (results-interpreter skill)                │
│     ├─ Input: test type, statistical output, validation flags    │
│     └─ Output: plain English finding, verdict, recommendation    │
│                                                                  │
│  7b. DISCOVER SUB-HYPOTHESES (hypothesis-discovery) ◄── NEW      │
│      ├─ TRIGGER: p>0.05 OR effect<0.15 OR confidence=low/medium  │
│      ├─ Call hypothesis-discovery skill                          │
│      ├─ Run decision tree to find interaction effects            │
│      ├─ Present suggested sub-hypotheses to user                 │
│      └─ Optionally add to hypotheses.md and test recursively     │
│                                                                  │
│  8. VISUALIZE (viz-generator skill)                              │
│     ├─ Select appropriate chart type                             │
│     ├─ Execute in notebook or generate code                      │
│     └─ Save to reports/figures/                                  │
│                                                                  │
│  9. DOCUMENT                                                     │
│     ├─ Update docs/hypotheses.md with results                    │
│     ├─ Include any validation warnings                           │
│     ├─ Add notebook cell with full analysis                      │
│     └─ Return summary to user                                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Agent Instructions

When invoked, follow this procedure:

### Step 1: Parse Hypothesis

Read the hypothesis file and extract:
```python
hypothesis = {
    'id': 'H1',
    'title': 'Faster initial contact improves conversion',
    'statement': 'Leads contacted within 30 minutes convert at significantly higher rates than those contacted later',
    'data_needed': ['contact_range', 'hours_difference', 'rental'],
    'suggested_test': 'Chi-square / logistic regression',
    'status': 'Not Started'
}
```

### Step 2: Validate Data Availability

```python
# Check columns exist
required_cols = hypothesis['data_needed']
available_cols = df.columns.tolist()
missing = [c for c in required_cols if c not in available_cols]

if missing:
    # Try to find similar columns
    suggestions = find_similar_columns(missing, available_cols)
    raise DataError(f"Missing columns: {missing}. Did you mean: {suggestions}?")

# Check data quality
for col in required_cols:
    null_pct = df[col].isna().mean()
    if null_pct > 0.5:
        warn(f"Column {col} has {null_pct:.0%} null values")
```

### Step 2b: Create Required Features

Call `feature-engineer` skill to create any derived features needed for the hypothesis:

```python
# Call feature-engineer skill
feature_result = call_skill('feature-engineer',
                            hypothesis=hypothesis,
                            df=df)

# Get enriched DataFrame
df_enriched = feature_result['df']

# Log created features
if feature_result['features_created']:
    print(f"Created features: {feature_result['features_created']}")

# Warn about TBD features
if feature_result.get('features_tbd'):
    warn(f"Some features could not be created (recipe TBD): {feature_result['features_tbd']}")
```

Common features that may be created:
- `urgency_days`, `urgency_bin` - For time sensitivity analysis
- `is_counter`, `is_hrd` - For channel analysis
- `day_of_week`, `is_weekend`, `hour_of_day`, `is_business_hours` - For timing analysis

### Step 3: Select Statistical Test

Call `stat-test-selector` skill with:
- Predictor type (from type-detector)
- Outcome type (binary for conversion)
- Question type (difference/association)

### Step 4: Generate Analysis Code

Call `analysis-coder` skill with:
- Hypothesis ID
- Selected test
- Column names
- DataFrame name

### Step 5: Execute

If Jupyter notebook is active:
```python
# Use mcp__ide__executeCode
result = execute_in_kernel(analysis_code)
```

Otherwise:
```python
# Create temp script and execute
result = execute_via_bash(analysis_code)
```

### Step 6: Validate Results (Built-in Sanity Checks)

Before interpreting, run automatic validation:

```python
def validate_results(results, df, predictor_col, outcome_col, test_type):
    """
    Built-in sanity checks for statistical results.
    Returns list of warnings and whether to proceed.
    """
    warnings = []
    blockers = []

    # 1. SAMPLE SIZE CHECK
    group_sizes = df.groupby(predictor_col).size()
    min_group = group_sizes.min()
    if min_group < 30:
        warnings.append(f"⚠️ Small sample: smallest group has n={min_group} (recommend n≥30)")
    if min_group < 5:
        blockers.append(f"🛑 Insufficient sample: group with n={min_group} is too small for reliable inference")

    # 2. ASSUMPTION CHECKS (test-specific)
    if test_type == 'chi_square':
        expected_counts = results.get('min_expected_count', 0)
        if expected_counts < 5:
            warnings.append(f"⚠️ Chi-square assumption violated: expected count={expected_counts:.1f} < 5. Consider Fisher's exact test.")

    if test_type == 'logistic_regression':
        # Check for separation
        crosstab = pd.crosstab(df[predictor_col], df[outcome_col])
        if (crosstab == 0).any().any():
            warnings.append("⚠️ Perfect separation detected: some predictor levels have 0% or 100% conversion. Coefficients may be unstable.")

    # 3. EFFECT SIZE vs SIGNIFICANCE MISMATCH
    p_value = results.get('p_value', 1)
    effect_size = results.get('cramers_v') or results.get('odds_ratio') or results.get('correlation')

    if p_value > 0.05 and effect_size and abs(effect_size) > 0.3:
        warnings.append(f"⚠️ Large effect (={effect_size:.2f}) but not significant (p={p_value:.3f}). May be underpowered - consider larger sample.")

    if p_value < 0.001 and effect_size and abs(effect_size) < 0.1:
        warnings.append(f"⚠️ Highly significant (p<0.001) but tiny effect (={effect_size:.2f}). Statistical significance ≠ practical importance.")

    # 4. DIRECTION CHECK
    # (Verify effect matches hypothesis direction - context-specific)

    # 5. BUSINESS SENSE CHECKS
    if 'conversion_by_group' in results:
        rates = [g.get('conversion_rate', 0) for g in results['conversion_by_group'].values()]
        if any(r > 100 or r < 0 for r in rates):
            blockers.append(f"🛑 Invalid conversion rates detected: {rates}. Check data or calculation.")
        if any(r > 95 for r in rates):
            warnings.append(f"⚠️ Unusually high conversion rate ({max(rates):.1f}%). Verify data filtering is correct.")
        if all(r < 5 for r in rates):
            warnings.append(f"⚠️ All conversion rates very low (<5%). Verify outcome variable is correct.")

    # 6. MULTIPLE COMPARISONS
    n_groups = df[predictor_col].nunique()
    if n_groups > 3:
        warnings.append(f"⚠️ Multiple comparisons: {n_groups} groups. Consider Bonferroni correction (α = {0.05/n_groups:.4f}) or post-hoc tests.")

    # 7. DATA QUALITY FLAGS
    null_pct = df[predictor_col].isna().mean()
    if null_pct > 0.1:
        warnings.append(f"⚠️ {null_pct:.0%} of predictor values are null and excluded from analysis.")

    return {
        'warnings': warnings,
        'blockers': blockers,
        'proceed': len(blockers) == 0,
        'confidence': 'high' if len(warnings) == 0 else 'medium' if len(warnings) <= 2 else 'low'
    }

# Run validation
validation = validate_results(results, df, predictor_col, outcome_col, test_type)

if not validation['proceed']:
    # Stop and report blockers
    raise ValidationError(f"Analysis blocked: {validation['blockers']}")

if validation['warnings']:
    # Continue but include warnings in output
    print("Validation warnings:")
    for w in validation['warnings']:
        print(f"  {w}")
```

**Validation Output Added to Results**:
```python
results['validation'] = {
    'confidence': 'medium',  # high/medium/low
    'warnings': [
        "⚠️ Small sample: smallest group has n=28",
        "⚠️ Multiple comparisons: 5 groups"
    ],
    'blockers': []
}
```

### Step 7: Interpret Results

Call `results-interpreter` skill with statistical output AND validation flags.

Expected output:
```markdown
## H1 Results: Faster Initial Contact Improves Conversion

**Verdict**: SUPPORTED

**Confidence**: 🟡 Medium (see warnings below)

**Key Finding**: Leads contacted within 30 minutes convert at 75% vs 55% for 3+ hours (χ² = 23.45, p < 0.001).

**Effect Size**: Cramér's V = 0.22 (small-to-medium association)

**Business Impact**: 20 percentage point improvement potential from faster contact.

**Validation Warnings**:
- ⚠️ Multiple comparisons: 5 groups. Consider Bonferroni correction (α = 0.01)
- ⚠️ 12% of predictor values are null and excluded from analysis

**Recommendation**: Prioritize time-to-first-contact as key operational metric.
```

### Step 7b: Discover Sub-Hypotheses (Conditional)

**Trigger Conditions** - Run if ANY of:
- `p_value > 0.05` (not statistically significant)
- `effect_size < 0.15` (weak practical effect)
- `validation['confidence']` in `['low', 'medium']`

**Purpose**: When the main hypothesis shows weak or inconclusive effects, use ML to discover sub-groups where the effect may be stronger.

**Process**:

```python
# Check trigger conditions
should_discover = (
    results.get('p_value', 0) > 0.05 or
    results.get('effect_size', 1) < 0.15 or
    validation.get('confidence') in ['low', 'medium']
)

if should_discover:
    print("⚠️ Weak or inconclusive effect. Running sub-hypothesis discovery...")

    # Call hypothesis-discovery skill
    discovery_result = call_skill('hypothesis-discovery',
                                   hypothesis_id=hypothesis['id'],
                                   df=df_enriched,
                                   predictor_col=predictor_col,
                                   outcome_col='rental')

    sub_hypotheses = discovery_result['sub_hypotheses']
```

**Present Results to User**:

```markdown
📊 **Suggested Sub-Hypotheses**:

**H1a**: Fast contact (<30min) + urgent rental (≤3 days) → 82% conversion vs 61% baseline
- Interaction: contact_range × urgency_bin
- Importance: 0.38

**H1b**: Fast contact effect strongest at Counter locations
- Counter+fast: 78% vs HRD+fast: 68%
- Importance: 0.24

Would you like me to:
1. Add these to hypotheses.md and test them now?
2. Add to hypotheses.md for later testing?
3. Skip and continue with current results?
```

**Handle User Choice**:

```python
if user_choice == 1:
    # Add sub-hypotheses to docs/hypotheses.md
    for sub_h in sub_hypotheses:
        add_to_hypotheses_doc(sub_h)

    # Recursively test each sub-hypothesis
    for sub_h in sub_hypotheses:
        run_hypothesis_tester(sub_h['id'])

elif user_choice == 2:
    # Just add to docs/hypotheses.md for later
    for sub_h in sub_hypotheses:
        add_to_hypotheses_doc(sub_h)
    print(f"Added {len(sub_hypotheses)} sub-hypotheses to docs/hypotheses.md")

else:  # choice == 3
    print("Skipping sub-hypothesis discovery. Continuing with current results.")
```

**Output Includes**:
- List of discovered sub-hypotheses with importance scores
- Interaction effects identified
- Feature code needed (from feature-engineer)
- Suggested statistical tests for each

### Step 8: Visualize

Call `viz-generator` skill with appropriate chart type.

### Step 9: Update Documentation

Update `docs/hypotheses.md`:
```markdown
### H1: Faster initial contact improves conversion
- **Status**: 🟢 Completed - Supported
- **Result**: Significant association (p < 0.001). Contacts within 30 min convert at 75% vs 55% for 3+ hrs.
- **Effect Size**: Cramér's V = 0.22
- **Notebook**: See `notebooks/hypothesis_testing.ipynb` cell 5
```

## Error Handling

| Error | Response |
|-------|----------|
| Missing columns | Suggest alternatives, ask user |
| Insufficient data | Report sample size, recommend deferring |
| Test assumptions violated | Use alternative test, note in results |
| Execution error | Debug code, retry with fixes |
| Ambiguous hypothesis | Ask user for clarification |

## Output Format

Return to user:
```markdown
## Hypothesis Test Complete: H1

**Verdict**: ✅ SUPPORTED
**Confidence**: 🟡 Medium

**Summary**: Faster contact significantly improves conversion. Leads contacted within 30 minutes convert at 75% compared to 55% for those contacted after 3+ hours.

**Statistical Details**:
- Test: Chi-square test of independence
- χ² = 23.45, p < 0.001
- Effect size: Cramér's V = 0.22

**Validation**:
- ⚠️ Multiple comparisons: 5 groups (Bonferroni correction recommended)
- ✅ Sample size adequate (n ≥ 30 per group)
- ✅ Assumptions met (expected counts ≥ 5)

**Files Updated**:
- `docs/hypotheses.md` - Status updated to 🟢 Completed
- `reports/figures/H1_conversion_by_contact_range.png` - Chart saved

**Next**: Run `/hypothesis-tester H2` to test the next hypothesis.
```

### Confidence Levels

| Level | Icon | Meaning |
|-------|------|---------|
| High | 🟢 | No validation warnings, all assumptions met |
| Medium | 🟡 | 1-2 warnings, proceed with noted caveats |
| Low | 🔴 | 3+ warnings, interpret with caution |
| Blocked | 🛑 | Critical issues, analysis not reliable |

## Configuration

```yaml
# Default settings
dataframe: df_conversion
significance_level: 0.05
save_figures: true
figure_path: reports/figures/
update_docs: true
execute_mode: auto  # auto, notebook, code-only
```

## Dependencies

**Skills used**:
- `feature-engineer` - Create derived features (Step 2b)
- `stat-test-selector` - Test selection
- `analysis-coder` - Code generation
- `results-interpreter` - Results translation
- `viz-generator` - Visualization
- `type-detector` - Variable type inference
- `quality-checker` - Data validation
- `sanity-checker` - On-demand detailed validation (optional)
- `hypothesis-discovery` - ML-driven sub-hypothesis discovery (Step 7b, conditional)

**Built-in validation** (Step 6):
- Sample size checks
- Assumption verification
- Effect size vs significance consistency
- Business sense checks
- Multiple comparison warnings

**Tools used**:
- `Read` - Load hypothesis file, data files
- `Edit` - Update hypothesis status
- `mcp__ide__executeCode` - Run in Jupyter
- `Bash` - Fallback execution
