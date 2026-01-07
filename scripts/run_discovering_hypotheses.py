#!/usr/bin/env python3
"""
Discovering Hypotheses

Extracted from .claude/skills/discovering-hypotheses/SKILL.md

Usage:
    python scripts/run_discovering_hypotheses.py [options]
"""

import argparse
import sys
from pathlib import Path

# ============================================================================
# Core Functions (extracted from SKILL.md)
# ============================================================================

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



# ============================================================================
# CLI Interface
# ============================================================================

def main():
    """Main CLI interface."""
    parser = argparse.ArgumentParser(
        description='Discovering Hypotheses',
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
