#!/usr/bin/env python3
"""
Checking Sanity

Extracted from .claude/skills/checking-sanity/SKILL.md

Usage:
    python scripts/run_checking_sanity.py [options]
"""

import argparse
import sys
from pathlib import Path

# ============================================================================
# Core Functions (extracted from SKILL.md)
# ============================================================================

def check_statistical_validity(results, test_type):
    """Check if statistical analysis was done correctly."""
    issues = []

    # P-value sanity
    p = results.get('p_value')
    if p is not None:
        if p < 0:
            issues.append("🛑 CRITICAL: Negative p-value (impossible)")
        if p > 1:
            issues.append("🛑 CRITICAL: P-value > 1 (impossible)")
        if p == 0:
            issues.append("⚠️ P-value exactly 0 (likely rounding - report as p < 0.0001)")

    # Effect size bounds
    if test_type == 'chi_square':
        v = results.get('cramers_v')
        if v is not None and (v < 0 or v > 1):
            issues.append(f"🛑 CRITICAL: Cramér's V = {v} outside [0,1] range")

    if test_type == 'correlation':
        r = results.get('correlation')
        if r is not None and (r < -1 or r > 1):
            issues.append(f"🛑 CRITICAL: Correlation = {r} outside [-1,1] range")

    if test_type == 'logistic_regression':
        or_val = results.get('odds_ratio')
        if or_val is not None and or_val <= 0:
            issues.append(f"🛑 CRITICAL: Odds ratio = {or_val} must be positive")

    # Degrees of freedom
    dof = results.get('dof')
    if dof is not None and dof <= 0:
        issues.append(f"🛑 CRITICAL: Degrees of freedom = {dof} must be positive")

    return issues


def check_sample_power(df, predictor_col, outcome_col, effect_size=None):
    """Check if sample size is adequate for detecting effects."""
    issues = []
    recommendations = []

    # Overall sample
    n = len(df)
    if n < 100:
        issues.append(f"⚠️ Small overall sample (n={n}). Results may be unstable.")

    # Per-group samples
    group_sizes = df.groupby(predictor_col).size()
    min_n = group_sizes.min()
    min_group = group_sizes.idxmin()

    if min_n < 10:
        issues.append(f"🛑 CRITICAL: Group '{min_group}' has only n={min_n}. Too small for inference.")
    elif min_n < 30:
        issues.append(f"⚠️ Group '{min_group}' has n={min_n}. Central limit theorem may not apply.")

    # Power analysis (simplified)
    if effect_size and effect_size < 0.2 and n < 500:
        issues.append(f"⚠️ Small effect size ({effect_size:.2f}) with n={n}. May be underpowered to detect.")
        recommendations.append("Consider pooling groups or getting more data.")

    # Outcome imbalance
    outcome_rate = df[outcome_col].mean()
    if outcome_rate < 0.05 or outcome_rate > 0.95:
        issues.append(f"⚠️ Imbalanced outcome: {outcome_rate:.1%} positive. May need rare event methods.")

    return issues, recommendations


def check_assumptions(df, predictor_col, outcome_col, test_type, results):
    """Verify statistical test assumptions are met."""
    issues = []
    alternatives = []

    if test_type == 'chi_square':
        # Expected counts
        min_expected = results.get('min_expected_count', 5)
        if min_expected < 5:
            issues.append(f"⚠️ Chi-square assumption violated: expected count = {min_expected:.1f} < 5")
            alternatives.append("Use Fisher's exact test instead")
        if min_expected < 1:
            issues.append(f"🛑 CRITICAL: Expected count < 1. Chi-square invalid.")

    if test_type == 't_test':
        # Normality (would need to run Shapiro-Wilk)
        issues.append("ℹ️ T-test assumes normality. Consider Mann-Whitney U if distribution is skewed.")

    if test_type == 'logistic_regression':
        # Linearity of log-odds (for continuous predictors)
        # Multicollinearity (for multiple predictors)
        # Check for complete/quasi-complete separation
        crosstab = pd.crosstab(df[predictor_col], df[outcome_col])
        if (crosstab == 0).any().any():
            issues.append("⚠️ Perfect separation: some predictor values have 0% or 100% outcome.")
            alternatives.append("Use Firth's penalized likelihood or exact logistic regression")

    if test_type == 'anova':
        # Homogeneity of variance (Levene's test)
        issues.append("ℹ️ ANOVA assumes equal variances. Consider Welch's ANOVA if groups differ.")

    return issues, alternatives


def check_business_sense(results, context='hles_conversion'):
    """Check if results make business sense."""
    issues = []

    if context == 'hles_conversion':
        # Conversion rate bounds
        if 'conversion_by_group' in results:
            for group, stats in results['conversion_by_group'].items():
                rate = stats.get('conversion_rate', 0)
                if rate > 100 or rate < 0:
                    issues.append(f"🛑 CRITICAL: '{group}' has {rate}% conversion (impossible)")
                elif rate > 95:
                    issues.append(f"⚠️ '{group}' has {rate:.1f}% conversion. Unusually high - verify data.")
                elif rate > 85:
                    issues.append(f"ℹ️ '{group}' has {rate:.1f}% conversion. Above typical range (67-70%).")

        # Effect direction
        # For contact time: faster should be better
        # For certain car type: specific types might be harder

        # Baseline comparison
        baseline = results.get('baseline_conversion')
        if baseline and (baseline < 0.5 or baseline > 0.85):
            issues.append(f"⚠️ Baseline conversion {baseline:.1%} differs from expected 67-70%.")

    return issues


def check_multiple_comparisons(hypotheses_tested, alpha=0.05):
    """Check for family-wise error rate issues."""
    issues = []
    recommendations = []

    n_tests = len(hypotheses_tested)

    if n_tests > 1:
        # Family-wise error rate
        fwer = 1 - (1 - alpha) ** n_tests
        issues.append(f"ℹ️ {n_tests} tests conducted. Family-wise error rate = {fwer:.1%}")

        if n_tests >= 3:
            bonferroni_alpha = alpha / n_tests
            recommendations.append(f"Apply Bonferroni correction: α = {bonferroni_alpha:.4f}")

        if n_tests >= 10:
            recommendations.append("Consider Benjamini-Hochberg FDR correction instead of Bonferroni")

        # Check for significant-only reporting
        n_significant = sum(1 for h in hypotheses_tested if h.get('p_value', 1) < alpha)
        if n_significant == n_tests:
            issues.append("⚠️ All tests significant. Possible p-hacking or selection bias?")

    return issues, recommendations


def check_data_quality_impact(df, predictor_col, outcome_col, quality_report=None):
    """Assess how data quality issues might affect results."""
    issues = []

    # Null values
    pred_null_pct = df[predictor_col].isna().mean()
    out_null_pct = df[outcome_col].isna().mean()

    if pred_null_pct > 0.1:
        issues.append(f"⚠️ {pred_null_pct:.0%} of predictor values are null. Are these MCAR/MAR/MNAR?")
    if out_null_pct > 0.01:
        issues.append(f"⚠️ {out_null_pct:.0%} of outcome values are null. Missing conversions?")

    # Check if nulls correlate with outcome (MAR vs MCAR)
    if pred_null_pct > 0:
        null_conversion = df[df[predictor_col].isna()][outcome_col].mean()
        non_null_conversion = df[df[predictor_col].notna()][outcome_col].mean()
        if abs(null_conversion - non_null_conversion) > 0.1:
            issues.append(f"⚠️ Null predictor values have different conversion rate ({null_conversion:.0%} vs {non_null_conversion:.0%}). Missingness may be informative.")

    # Outliers
    if quality_report and 'outliers' in quality_report.get('checks', {}):
        outlier_cols = list(quality_report['checks']['outliers'].keys())
        if predictor_col in outlier_cols:
            issues.append(f"⚠️ Outliers detected in predictor. May influence results.")

    return issues


def suggest_alternative_explanations(hypothesis_id, results):
    """Suggest confounders or alternative interpretations."""
    suggestions = []

    # Common confounders for HLES hypotheses
    confounders = {
        'H1': [  # Contact speed → conversion
            "Lead source (some partners may be faster AND higher quality)",
            "Time of day (faster contact during business hours, also higher conversion)",
            "Location capacity (busy locations slower to contact AND lower conversion)",
        ],
        'H5': [  # Location → conversion
            "Local competition (Enterprise presence)",
            "Customer demographics by region",
            "Fleet availability differences",
        ],
        'H7': [  # Insurance partner → conversion
            "Exclusive vs co-primary partnership status",
            "Lead quality varies by partner",
            "Geographic concentration of partners",
        ],
    }

    if hypothesis_id in confounders:
        suggestions.append("**Potential confounders to consider:**")
        for c in confounders[hypothesis_id]:
            suggestions.append(f"  - {c}")

    # Simpson's paradox warning
    suggestions.append("\n**Simpson's Paradox check:** Does the effect reverse when controlling for other variables?")

    return suggestions



# ============================================================================
# CLI Interface
# ============================================================================

def main():
    """Main CLI interface."""
    parser = argparse.ArgumentParser(
        description='Checking Sanity',
        formatter_class=argparse.RawDescriptionHelpFormatter
    )

    # TODO: Add arguments based on the skill's requirements
    parser.add_argument('input', help='Input parameter')
    parser.add_argument('--format', choices=['markdown', 'json'], default='markdown',
                       help='Output format')
    parser.add_argument('--output', help='Output file path')

    args = parser.parse_args()

    # TODO: Implement CLI logic
    print("Script execution not yet implemented")
    print(f"Input: {args.input}")

    return 0


if __name__ == '__main__':
    sys.exit(main())
