# stat-test-selector

Select the appropriate statistical test for a hypothesis based on variable types and research question.

## Usage

```
/stat-test-selector <predictor_type> <outcome_type> <question_type>
```

Or provide context naturally:
```
/stat-test-selector I want to test if contact_range (categorical: <30min, 1-3hr, 3-6hr, 6+hr) affects rental conversion (binary: 0/1)
```

## Input Parameters

- **predictor_type**: The independent variable type
  - `binary` - Two categories (e.g., contacted yes/no)
  - `categorical` - Multiple categories (e.g., contact_range buckets)
  - `continuous` - Numeric (e.g., hours_difference)
  - `ordinal` - Ordered categories (e.g., time buckets with order)

- **outcome_type**: The dependent variable type
  - `binary` - Two outcomes (e.g., converted yes/no)
  - `categorical` - Multiple outcomes
  - `continuous` - Numeric outcome
  - `count` - Count data

- **question_type**: What you're trying to determine
  - `difference` - Is there a difference between groups?
  - `association` - Are variables associated?
  - `prediction` - Can we predict the outcome?
  - `comparison` - Compare rates/proportions

## Decision Logic

### Binary Outcome (Conversion yes/no)

| Predictor Type | Recommended Test | When to Use |
|----------------|------------------|-------------|
| Binary | Chi-square test | Compare conversion rates between 2 groups |
| Binary | Fisher's exact test | Chi-square with small cell counts (<5) |
| Categorical (3+) | Chi-square test | Compare conversion across multiple groups |
| Categorical (3+) | Logistic regression | Control for confounders, get odds ratios |
| Continuous | Logistic regression | Predict conversion from continuous variable |
| Continuous | Point-biserial correlation | Simple association strength |
| Ordinal | Cochran-Armitage trend test | Test for trend across ordered categories |
| Multiple predictors | Logistic regression | Multiple variables, adjusted effects |

### Continuous Outcome

| Predictor Type | Recommended Test | When to Use |
|----------------|------------------|-------------|
| Binary | Independent t-test | Compare means between 2 groups |
| Binary | Mann-Whitney U | Non-normal data, compare medians |
| Categorical (3+) | One-way ANOVA | Compare means across groups |
| Categorical (3+) | Kruskal-Wallis | Non-normal data |
| Continuous | Pearson correlation | Linear relationship |
| Continuous | Spearman correlation | Non-linear or ordinal data |

### Rate/Proportion Comparison

| Scenario | Recommended Test |
|----------|------------------|
| 2 proportions | Two-proportion z-test |
| Multiple proportions | Chi-square test of homogeneity |
| Paired proportions | McNemar's test |

## Output Format

```
## Recommended Statistical Test

**Primary Test**: [Test name]
**Python Function**: `scipy.stats.xxx` or `statsmodels.xxx`

**Why this test**:
- [Reason based on variable types]
- [Assumptions that apply]

**Assumptions to check**:
1. [Assumption 1]
2. [Assumption 2]

**Alternative if assumptions violated**:
- [Alternative test]

**Effect size measure**:
- [Appropriate effect size: Cramér's V, odds ratio, Cohen's d, etc.]

**Sample code skeleton**:
```python
# [Minimal code example]
```
```

## Examples

### Example 1: Contact time → Conversion
**Input**: categorical predictor (contact_range), binary outcome (rental)
**Output**:
- Primary: Chi-square test of independence
- Python: `scipy.stats.chi2_contingency()`
- Effect size: Cramér's V
- Follow-up: Logistic regression for odds ratios per category

### Example 2: Hours to contact → Conversion
**Input**: continuous predictor (hours_difference), binary outcome (rental)
**Output**:
- Primary: Logistic regression
- Python: `statsmodels.api.Logit()` or `sklearn.linear_model.LogisticRegression`
- Effect size: Odds ratio per unit increase
- Alternative: Bin into categories and use chi-square

### Example 3: Location → Conversion
**Input**: categorical predictor (RENT_LOC, many levels), binary outcome (rental)
**Output**:
- Primary: Chi-square test (if cell counts sufficient)
- Python: `scipy.stats.chi2_contingency()`
- Caution: Many locations may have sparse data
- Alternative: Group low-volume locations, or use mixed-effects logistic regression
