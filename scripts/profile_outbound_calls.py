#!/usr/bin/env python3
"""
Outbound Call Data Profiler
Analyzes combined_extractions.csv to understand call execution patterns
"""

import pandas as pd
import numpy as np
from pathlib import Path
from collections import Counter
import json

# File paths
INPUT_FILE = Path("/Users/dansia/Documents/HertzDataAnalysis/data/OutboundAnalysis-processed/JSON/combined_extractions.csv")
OUTPUT_DIR = Path("/Users/dansia/Documents/HertzDataAnalysis/data/processed")

def load_data():
    """Load the CSV data."""
    df = pd.read_csv(INPUT_FILE)
    print(f"Loaded {len(df)} rows, {len(df.columns)} columns")
    print(f"File size: {INPUT_FILE.stat().st_size / 1024:.1f} KB")
    return df

def profile_column(df, col):
    """Generate profile for a single column."""
    series = df[col]
    profile = {
        'name': col,
        'dtype': str(series.dtype),
        'null_count': int(series.isna().sum()),
        'null_pct': round(series.isna().mean() * 100, 1),
        'unique_count': int(series.nunique()),
    }

    # For non-null values
    non_null = series.dropna()
    if len(non_null) > 0:
        if series.dtype == 'object':
            # Categorical/text column
            value_counts = non_null.value_counts()
            profile['top_values'] = value_counts.head(20).to_dict()
            profile['rare_values'] = value_counts[value_counts < len(df) * 0.01].index.tolist()[:10]
        elif np.issubdtype(series.dtype, np.number):
            # Numeric column
            profile['min'] = float(non_null.min())
            profile['max'] = float(non_null.max())
            profile['mean'] = float(non_null.mean())
            profile['median'] = float(non_null.median())
            profile['std'] = float(non_null.std())

    return profile

def categorize_columns(df):
    """Categorize columns by their prefix/domain."""
    categories = {
        'A_basic_context': [],
        'B_time_feasibility': [],
        'C_pickup_delivery': [],
        'D_fleet_vehicle': [],
        'E_insurance_money': [],
        'F_transfers': [],
        'G_emotional': [],
        'H_agent_behavior': [],
        'I_outcome': [],
        'J_local_branch': [],
        'K_competitive': [],
        'L_complaints': [],
        'meta': []
    }

    for col in df.columns:
        if col.startswith('A_'):
            categories['A_basic_context'].append(col)
        elif col.startswith('B_'):
            categories['B_time_feasibility'].append(col)
        elif col.startswith('C_'):
            categories['C_pickup_delivery'].append(col)
        elif col.startswith('D_'):
            categories['D_fleet_vehicle'].append(col)
        elif col.startswith('E_'):
            categories['E_insurance_money'].append(col)
        elif col.startswith('F_'):
            categories['F_transfers'].append(col)
        elif col.startswith('G_'):
            categories['G_emotional'].append(col)
        elif col.startswith('H_'):
            categories['H_agent_behavior'].append(col)
        elif col.startswith('I_'):
            categories['I_outcome'].append(col)
        elif col.startswith('J_'):
            categories['J_local_branch'].append(col)
        elif col.startswith('K_'):
            categories['K_competitive'].append(col)
        elif col.startswith('L_'):
            categories['L_complaints'].append(col)
        else:
            categories['meta'].append(col)

    return categories

def analyze_urgency(df):
    """Analyze urgency/timing columns."""
    urgency_col = 'B_time_feasibility.customer_time_need_category'

    if urgency_col not in df.columns:
        print(f"Warning: {urgency_col} not found")
        return {}

    urgency_counts = df[urgency_col].value_counts(dropna=False)
    total = len(df)

    urgency_analysis = {
        'column': urgency_col,
        'distribution': {str(k): {'count': int(v), 'pct': round(v/total*100, 1)}
                        for k, v in urgency_counts.items()},
        'same_day_pct': round((df[urgency_col] == 'same_day_today').mean() * 100, 1),
        'this_week_pct': round((df[urgency_col] == 'this_week').mean() * 100, 1),
        'next_week_pct': round((df[urgency_col] == 'next_week').mean() * 100, 1),
        'unsure_pct': round((df[urgency_col] == 'unsure').mean() * 100, 1),
    }

    return urgency_analysis

def analyze_transfers(df):
    """Analyze transfer patterns."""
    transfer_cols = {
        'attempted': 'F_transfers.branch_transfer_attempted',
        'type': 'F_transfers.branch_transfer_type',
        'outcome': 'F_transfers.warm_transfer_outcome',
        'interpreter': 'F_transfers.interpreter_transfer_occurred'
    }

    analysis = {}

    # Transfer attempted
    if transfer_cols['attempted'] in df.columns:
        attempted = df[transfer_cols['attempted']].value_counts(dropna=False)
        analysis['transfer_attempted'] = {str(k): int(v) for k, v in attempted.items()}

    # Transfer type (warm vs cold)
    if transfer_cols['type'] in df.columns:
        transfer_type = df[transfer_cols['type']].value_counts(dropna=False)
        analysis['transfer_type'] = {str(k): int(v) for k, v in transfer_type.items()}

    # Transfer outcome
    if transfer_cols['outcome'] in df.columns:
        outcome = df[transfer_cols['outcome']].value_counts(dropna=False)
        analysis['transfer_outcome'] = {str(k): int(v) for k, v in outcome.items()}

    # Cross-tabulation: transfer type vs outcome
    if transfer_cols['type'] in df.columns and transfer_cols['outcome'] in df.columns:
        crosstab = pd.crosstab(df[transfer_cols['type']], df[transfer_cols['outcome']])
        analysis['type_vs_outcome'] = crosstab.to_dict()

    return analysis

def build_call_funnel(df):
    """Build a call flow funnel showing what happens at each stage."""
    total_calls = len(df)

    funnel_stages = []

    # Stage 1: Extraction status
    if 'extraction_status' in df.columns:
        complete = (df['extraction_status'] == 'complete').sum()
        funnel_stages.append({
            'stage': 'Calls Extracted Successfully',
            'count': int(complete),
            'pct': round(complete/total_calls*100, 1)
        })

    # Stage 2: Same-day urgency
    urgency_col = 'B_time_feasibility.customer_time_need_category'
    if urgency_col in df.columns:
        same_day = (df[urgency_col] == 'same_day_today').sum()
        funnel_stages.append({
            'stage': 'Same-Day Urgent Requests',
            'count': int(same_day),
            'pct': round(same_day/total_calls*100, 1)
        })

    # Stage 3: Feasibility
    feasible_col = 'B_time_feasibility.request_feasible'
    if feasible_col in df.columns:
        # Handle string 'true'/'false' and boolean
        feasible = df[feasible_col].astype(str).str.lower().isin(['true', '1', 'yes']).sum()
        funnel_stages.append({
            'stage': 'Request Marked Feasible',
            'count': int(feasible),
            'pct': round(feasible/total_calls*100, 1)
        })

    # Stage 4: Transfer attempted
    transfer_col = 'F_transfers.branch_transfer_attempted'
    if transfer_col in df.columns:
        transferred = df[transfer_col].astype(str).str.lower().isin(['true', '1', 'yes']).sum()
        funnel_stages.append({
            'stage': 'Transfer Attempted to Branch',
            'count': int(transferred),
            'pct': round(transferred/total_calls*100, 1)
        })

    # Stage 5: Warm transfers
    type_col = 'F_transfers.branch_transfer_type'
    if type_col in df.columns:
        warm = (df[type_col] == 'warm').sum()
        funnel_stages.append({
            'stage': 'Warm Transfer Executed',
            'count': int(warm),
            'pct': round(warm/total_calls*100, 1)
        })

    # Stage 6: Branch took over
    outcome_col = 'F_transfers.warm_transfer_outcome'
    if outcome_col in df.columns:
        took_over = (df[outcome_col] == 'branch_took_over').sum()
        funnel_stages.append({
            'stage': 'Branch Took Over Call',
            'count': int(took_over),
            'pct': round(took_over/total_calls*100, 1)
        })

    return funnel_stages

def analyze_branch_responses(df):
    """Analyze branch response outcomes after transfer."""
    outcome_col = 'F_transfers.warm_transfer_outcome'

    if outcome_col not in df.columns:
        return {}

    outcomes = df[outcome_col].value_counts(dropna=False)
    total = len(df)

    return {
        'distribution': {str(k): {'count': int(v), 'pct': round(v/total*100, 1)}
                        for k, v in outcomes.items()},
        'branch_answered_rate': round((df[outcome_col] == 'branch_took_over').mean() * 100, 1),
        'no_answer_rate': round((df[outcome_col] == 'branch_no_answer').mean() * 100, 1),
        'busy_callback_rate': round((df[outcome_col] == 'branch_busy_callback').mean() * 100, 1),
    }

def analyze_pickup_delivery(df):
    """Analyze pickup/delivery patterns."""
    cols = {
        'pickup_requested': 'C_pickup_delivery_access.pickup_requested',
        'delivery_requested': 'C_pickup_delivery_access.delivery_requested',
        'self_pickup_only': 'C_pickup_delivery_access.self_pickup_only',
        'instructed_to_call_branch': 'C_pickup_delivery_access.instructed_to_call_branch',
        'option_5_used': 'C_pickup_delivery_access.option_5_instruction_used'
    }

    analysis = {}
    for name, col in cols.items():
        if col in df.columns:
            true_count = df[col].astype(str).str.lower().isin(['true', '1', 'yes']).sum()
            analysis[name] = {
                'true_count': int(true_count),
                'true_pct': round(true_count/len(df)*100, 1)
            }

    return analysis

def analyze_complaints(df):
    """Analyze complaint patterns."""
    complaint_col = 'L_customer_complaints.complaint_raised'
    complaint_types_col = 'L_customer_complaints.complaint_types'

    analysis = {}

    if complaint_col in df.columns:
        complaints = df[complaint_col].astype(str).str.lower().isin(['true', '1', 'yes']).sum()
        analysis['total_complaints'] = int(complaints)
        analysis['complaint_rate'] = round(complaints/len(df)*100, 1)

    if complaint_types_col in df.columns:
        # Parse complaint types (they may be pipe-separated)
        all_types = []
        for val in df[complaint_types_col].dropna():
            if isinstance(val, str):
                types = [t.strip() for t in val.split('|')]
                all_types.extend(types)

        type_counts = Counter(all_types)
        analysis['complaint_types'] = dict(type_counts.most_common(10))

    return analysis

def analyze_distress_signals(df):
    """Analyze emotional/distress signals."""
    distress_col = 'G_emotional_psychological_signals.distress_signals_present'
    safety_col = 'G_emotional_psychological_signals.safety_concerns_present'

    analysis = {}

    if distress_col in df.columns:
        distress = df[distress_col].astype(str).str.lower().isin(['true', '1', 'yes']).sum()
        analysis['distress_signals'] = {
            'count': int(distress),
            'pct': round(distress/len(df)*100, 1)
        }

    if safety_col in df.columns:
        safety = df[safety_col].astype(str).str.lower().isin(['true', '1', 'yes']).sum()
        analysis['safety_concerns'] = {
            'count': int(safety),
            'pct': round(safety/len(df)*100, 1)
        }

    return analysis

def generate_markdown_report(df, profiles, categories, urgency, transfers, funnel,
                             branch_responses, pickup_delivery, complaints, distress):
    """Generate comprehensive markdown report."""

    report = []
    report.append("# Outbound Call Data Profile: combined_extractions.csv")
    report.append("")
    report.append("## Executive Summary")
    report.append("")
    report.append(f"- **Total Calls Analyzed**: {len(df)}")
    report.append(f"- **Total Columns**: {len(df.columns)}")
    report.append(f"- **Data Source**: Extracted from call transcripts via JSON processing")
    report.append(f"- **Purpose**: Understanding outbound call execution patterns for insurance replacement rentals")
    report.append("")

    # Key metrics summary
    report.append("### Key Findings at a Glance")
    report.append("")
    if urgency:
        report.append(f"- **Same-Day Urgent Requests**: {urgency.get('same_day_pct', 'N/A')}% of calls")
    if transfers:
        cold_count = transfers.get('transfer_type', {}).get('cold', 0)
        warm_count = transfers.get('transfer_type', {}).get('warm', 0)
        total_typed = cold_count + warm_count
        if total_typed > 0:
            report.append(f"- **Warm vs Cold Transfers**: {warm_count} warm ({round(warm_count/total_typed*100,1)}%), {cold_count} cold ({round(cold_count/total_typed*100,1)}%)")
    if branch_responses:
        report.append(f"- **Branch Answer Rate**: {branch_responses.get('branch_answered_rate', 'N/A')}%")
        report.append(f"- **Branch No Answer Rate**: {branch_responses.get('no_answer_rate', 'N/A')}%")
    if complaints:
        report.append(f"- **Complaint Rate**: {complaints.get('complaint_rate', 'N/A')}%")
    report.append("")

    # Urgency Analysis
    report.append("## Urgency Analysis")
    report.append("")
    report.append("### Customer Time Need Distribution")
    report.append("")
    if urgency and 'distribution' in urgency:
        report.append("| Category | Count | Percentage |")
        report.append("|----------|-------|------------|")
        for cat, data in sorted(urgency['distribution'].items(), key=lambda x: -x[1]['count']):
            report.append(f"| {cat} | {data['count']} | {data['pct']}% |")
    report.append("")

    # Transfer Analysis
    report.append("## Transfer Patterns")
    report.append("")

    report.append("### Transfer Type Distribution (Warm vs Cold)")
    report.append("")
    if transfers and 'transfer_type' in transfers:
        report.append("| Type | Count |")
        report.append("|------|-------|")
        for t, count in sorted(transfers['transfer_type'].items(), key=lambda x: -x[1] if isinstance(x[1], int) else 0):
            report.append(f"| {t} | {count} |")
    report.append("")

    report.append("### Branch Response Outcomes")
    report.append("")
    if branch_responses and 'distribution' in branch_responses:
        report.append("| Outcome | Count | Percentage |")
        report.append("|---------|-------|------------|")
        for outcome, data in sorted(branch_responses['distribution'].items(), key=lambda x: -x[1]['count']):
            report.append(f"| {outcome} | {data['count']} | {data['pct']}% |")
    report.append("")

    # Call Flow Funnel
    report.append("## Call Flow Funnel")
    report.append("")
    report.append("This shows the progression through key call stages:")
    report.append("")
    report.append("```")
    total = len(df)
    for stage in funnel:
        bar_len = int(stage['pct'] / 2)  # Scale to 50 chars max
        bar = '=' * bar_len
        report.append(f"{stage['stage']:<35} | {stage['count']:>4} ({stage['pct']:>5.1f}%) |{bar}")
    report.append("```")
    report.append("")

    # Pickup/Delivery Analysis
    report.append("## Pickup & Delivery Access")
    report.append("")
    if pickup_delivery:
        report.append("| Metric | Count | Percentage |")
        report.append("|--------|-------|------------|")
        for metric, data in pickup_delivery.items():
            report.append(f"| {metric.replace('_', ' ').title()} | {data['true_count']} | {data['true_pct']}% |")
    report.append("")

    # Complaint Analysis
    report.append("## Customer Complaints")
    report.append("")
    if complaints:
        report.append(f"- **Total Calls with Complaints**: {complaints.get('total_complaints', 0)} ({complaints.get('complaint_rate', 0)}%)")
        report.append("")
        if 'complaint_types' in complaints and complaints['complaint_types']:
            report.append("### Complaint Types")
            report.append("")
            report.append("| Type | Count |")
            report.append("|------|-------|")
            for ctype, count in complaints['complaint_types'].items():
                report.append(f"| {ctype} | {count} |")
    report.append("")

    # Distress Signals
    report.append("## Emotional/Distress Signals")
    report.append("")
    if distress:
        if 'distress_signals' in distress:
            report.append(f"- **Distress Signals Detected**: {distress['distress_signals']['count']} calls ({distress['distress_signals']['pct']}%)")
        if 'safety_concerns' in distress:
            report.append(f"- **Safety Concerns Present**: {distress['safety_concerns']['count']} calls ({distress['safety_concerns']['pct']}%)")
    report.append("")

    # Column Categories
    report.append("## Column Categories")
    report.append("")
    for category, cols in categories.items():
        if cols:
            report.append(f"### {category.replace('_', ' ').title()} ({len(cols)} columns)")
            report.append("")
            for col in cols:
                prof = profiles.get(col, {})
                short_name = col.split('.')[-1] if '.' in col else col
                null_pct = prof.get('null_pct', 'N/A')
                unique = prof.get('unique_count', 'N/A')
                report.append(f"- **{short_name}**: {unique} unique values, {null_pct}% null")
            report.append("")

    # Detailed Column Dictionary
    report.append("## Column Dictionary (Key Columns)")
    report.append("")

    key_columns = [
        'extraction_status',
        'B_time_feasibility.customer_time_need_category',
        'B_time_feasibility.request_feasible',
        'F_transfers.branch_transfer_attempted',
        'F_transfers.branch_transfer_type',
        'F_transfers.warm_transfer_outcome',
        'C_pickup_delivery_access.pickup_requested',
        'C_pickup_delivery_access.delivery_requested',
        'L_customer_complaints.complaint_raised',
        'L_customer_complaints.complaint_types'
    ]

    for col in key_columns:
        if col in profiles:
            prof = profiles[col]
            report.append(f"### {col}")
            report.append("")
            report.append(f"- **Data Type**: {prof.get('dtype', 'N/A')}")
            report.append(f"- **Null Count**: {prof.get('null_count', 0)} ({prof.get('null_pct', 0)}%)")
            report.append(f"- **Unique Values**: {prof.get('unique_count', 'N/A')}")
            if 'top_values' in prof:
                report.append("")
                report.append("**Value Distribution:**")
                report.append("")
                report.append("| Value | Count |")
                report.append("|-------|-------|")
                for val, count in list(prof['top_values'].items())[:10]:
                    report.append(f"| {val} | {count} |")
            report.append("")

    # Recommendations
    report.append("## Recommendations & Insights")
    report.append("")
    report.append("### Call Execution Patterns")
    report.append("")

    # Generate insights based on data
    if branch_responses:
        no_answer = branch_responses.get('no_answer_rate', 0)
        if no_answer > 50:
            report.append(f"1. **High Branch Non-Response Rate**: {no_answer}% of calls result in branch_no_answer. This represents a significant opportunity to improve handoff success.")

    if urgency:
        same_day = urgency.get('same_day_pct', 0)
        if same_day > 40:
            report.append(f"2. **High Same-Day Urgency**: {same_day}% of customers need rental same-day, requiring fast branch coordination.")

    if transfers:
        cold = transfers.get('transfer_type', {}).get('cold', 0)
        warm = transfers.get('transfer_type', {}).get('warm', 0)
        if cold > warm:
            report.append(f"3. **Cold Transfers Dominate**: {cold} cold vs {warm} warm transfers. Consider increasing warm handoffs for better customer experience.")

    if pickup_delivery:
        option_5 = pickup_delivery.get('option_5_used', {}).get('true_pct', 0)
        if option_5 > 50:
            report.append(f"4. **Option 5 Heavily Used**: {option_5}% of calls include option 5 instruction, indicating systematic branch callback process.")

    report.append("")
    report.append("---")
    report.append("")
    report.append("*Generated by Outbound Call Data Profiler*")

    return '\n'.join(report)

def main():
    print("=" * 60)
    print("OUTBOUND CALL DATA PROFILER")
    print("=" * 60)
    print()

    # Load data
    print("Loading data...")
    df = load_data()
    print()

    # Categorize columns
    print("Categorizing columns...")
    categories = categorize_columns(df)
    for cat, cols in categories.items():
        print(f"  {cat}: {len(cols)} columns")
    print()

    # Profile each column
    print("Profiling columns...")
    profiles = {}
    for col in df.columns:
        profiles[col] = profile_column(df, col)
    print(f"  Profiled {len(profiles)} columns")
    print()

    # Analyze urgency
    print("Analyzing urgency/timing...")
    urgency = analyze_urgency(df)
    if urgency:
        print(f"  Same-day: {urgency.get('same_day_pct', 'N/A')}%")
        print(f"  This week: {urgency.get('this_week_pct', 'N/A')}%")
        print(f"  Unsure: {urgency.get('unsure_pct', 'N/A')}%")
    print()

    # Analyze transfers
    print("Analyzing transfer patterns...")
    transfers = analyze_transfers(df)
    if 'transfer_type' in transfers:
        print(f"  Transfer types: {transfers['transfer_type']}")
    print()

    # Analyze branch responses
    print("Analyzing branch responses...")
    branch_responses = analyze_branch_responses(df)
    if branch_responses:
        print(f"  Branch answered: {branch_responses.get('branch_answered_rate', 'N/A')}%")
        print(f"  No answer: {branch_responses.get('no_answer_rate', 'N/A')}%")
    print()

    # Build funnel
    print("Building call flow funnel...")
    funnel = build_call_funnel(df)
    for stage in funnel:
        print(f"  {stage['stage']}: {stage['count']} ({stage['pct']}%)")
    print()

    # Analyze pickup/delivery
    print("Analyzing pickup/delivery patterns...")
    pickup_delivery = analyze_pickup_delivery(df)
    for k, v in pickup_delivery.items():
        print(f"  {k}: {v['true_pct']}%")
    print()

    # Analyze complaints
    print("Analyzing complaints...")
    complaints = analyze_complaints(df)
    if complaints:
        print(f"  Complaint rate: {complaints.get('complaint_rate', 'N/A')}%")
    print()

    # Analyze distress
    print("Analyzing distress signals...")
    distress = analyze_distress_signals(df)
    for k, v in distress.items():
        print(f"  {k}: {v['pct']}%")
    print()

    # Generate markdown report
    print("Generating markdown report...")
    report = generate_markdown_report(
        df, profiles, categories, urgency, transfers, funnel,
        branch_responses, pickup_delivery, complaints, distress
    )

    report_path = OUTPUT_DIR / "combined_extractions_profile.md"
    with open(report_path, 'w') as f:
        f.write(report)
    print(f"Report saved to: {report_path}")

    # Save JSON analysis for further processing
    json_output = {
        'summary': {
            'total_calls': len(df),
            'total_columns': len(df.columns)
        },
        'urgency': urgency,
        'transfers': transfers,
        'branch_responses': branch_responses,
        'funnel': funnel,
        'pickup_delivery': pickup_delivery,
        'complaints': complaints,
        'distress': distress,
        'categories': {k: len(v) for k, v in categories.items()}
    }

    json_path = OUTPUT_DIR / "combined_extractions_analysis.json"
    with open(json_path, 'w') as f:
        json.dump(json_output, f, indent=2)
    print(f"JSON analysis saved to: {json_path}")

    print()
    print("=" * 60)
    print("ANALYSIS COMPLETE")
    print("=" * 60)

if __name__ == "__main__":
    main()
