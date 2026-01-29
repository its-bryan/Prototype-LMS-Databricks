#!/usr/bin/env python3
"""
Outbound Transfer Visualization
Generates Marimekko-style stacked bar charts following Hertz brand guidelines
"""

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from pathlib import Path

# ============================================================
# HERTZ BRAND COLORS (from visual-guide.md)
# ============================================================
COLORS = {
    'primary': '#F5C400',      # Hertz Yellow
    'secondary': '#6E6E6E',    # Dark Gray
    'tertiary': '#BDBDBD',     # Light Gray
    'charcoal': '#1A1A1A',     # Text/Axes
    'light': '#E6E6E6',        # Gridlines
    'positive': '#2E7D32',     # Positive Green
    'negative': '#C62828',     # Negative Red
    'white': '#FFFFFF',        # Background
}

# Multi-series palette following guide rules
PALETTE = ['#F5C400', '#6E6E6E', '#BDBDBD', '#E6E6E6', '#D4D4D4']

plt.rcParams['figure.facecolor'] = 'white'
plt.rcParams['axes.facecolor'] = 'white'
plt.rcParams['font.family'] = 'sans-serif'
plt.rcParams['axes.spines.top'] = False
plt.rcParams['axes.spines.right'] = False
plt.rcParams['axes.labelcolor'] = COLORS['charcoal']
plt.rcParams['xtick.color'] = COLORS['charcoal']
plt.rcParams['ytick.color'] = COLORS['charcoal']

# File paths
INPUT_FILE = Path("/Users/dansia/Documents/HertzDataAnalysis/data/OutboundAnalysis-processed/JSON/combined_extractions.csv")
OUTPUT_DIR = Path("/Users/dansia/Documents/HertzDataAnalysis")


def load_data():
    """Load and prepare the data."""
    df = pd.read_csv(INPUT_FILE)
    return df


def get_bool_mask(df, col):
    """Convert column to boolean mask, handling various true/false representations."""
    if col not in df.columns:
        return pd.Series([False] * len(df))
    return df[col].astype(str).str.lower().isin(['true', '1', 'yes'])


def draw_connector(ax, x1, y1_bottom, y1_top, x2, color='gray', alpha=0.3):
    """Draw dashed connector lines between stacked bars."""
    ax.plot([x1 + 0.3, x2 - 0.3], [y1_top, 100],
            linestyle='--', color=color, alpha=alpha, linewidth=1)
    ax.plot([x1 + 0.3, x2 - 0.3], [y1_bottom, 0],
            linestyle='--', color=color, alpha=alpha, linewidth=1)


def create_chart_1(df):
    """
    Chart 1: Same-Day Urgent -> Pickup Requested -> Transfer Rate
    """
    # Calculate data
    total = len(df)
    urgency_col = 'B_time_feasibility.customer_time_need_category'
    pickup_col = 'C_pickup_delivery_access.pickup_requested'
    transfer_col = 'F_transfers.branch_transfer_attempted'

    # Stage 1: All Outbound Calls by urgency
    urgency_counts = df[urgency_col].value_counts()
    same_day = urgency_counts.get('same_day_today', 0)
    this_week = urgency_counts.get('this_week', 0)
    unsure = urgency_counts.get('unsure', 0)
    next_week = urgency_counts.get('next_week', 0)
    other = total - same_day - this_week - unsure - next_week

    # Stage 2: Same-Day Urgent by pickup status
    same_day_df = df[df[urgency_col] == 'same_day_today']
    sd_total = len(same_day_df)

    pickup_mask = get_bool_mask(same_day_df, pickup_col)
    pickup_requested = pickup_mask.sum()

    # For "not requested" and "unknown", we need to check the column values
    pickup_series = same_day_df[pickup_col].astype(str).str.lower()
    pickup_not_requested = (pickup_series == 'false').sum()
    pickup_unknown = sd_total - pickup_requested - pickup_not_requested

    # Stage 3-5: Transfer rates by pickup status
    transfer_mask = get_bool_mask(same_day_df, transfer_col)

    # Pickup Requested transfers
    pr_df = same_day_df[pickup_mask]
    pr_transfers = get_bool_mask(pr_df, transfer_col).sum()
    pr_no_transfer = len(pr_df) - pr_transfers

    # Pickup Not Requested transfers
    pnr_df = same_day_df[pickup_series == 'false']
    pnr_transfers = get_bool_mask(pnr_df, transfer_col).sum()
    pnr_no_transfer = len(pnr_df) - pnr_transfers

    # Pickup Unknown transfers
    pu_df = same_day_df[~pickup_mask & (pickup_series != 'false')]
    pu_transfers = get_bool_mask(pu_df, transfer_col).sum()
    pu_no_transfer = len(pu_df) - pu_transfers

    # Create figure
    fig, ax = plt.subplots(figsize=(14, 8))

    bar_width = 0.6
    x_positions = [0, 1.5, 3, 4, 5]

    # Bar 1: All Outbound Calls
    segments1 = [
        (same_day/total*100, 'Same-Day:', same_day, COLORS['primary']),
        (this_week/total*100, 'This Week:', this_week, COLORS['secondary']),
        (unsure/total*100, 'Unsure:', unsure, COLORS['tertiary']),
        (next_week/total*100, 'Next Week:', next_week, COLORS['light']),
        (other/total*100, 'Other:', other, '#D4D4D4'),
    ]

    bottom = 0
    same_day_bottom = 0
    for pct, label, count, color in segments1:
        ax.bar(x_positions[0], pct, bar_width, bottom=bottom, color=color, edgecolor='white', linewidth=1)
        if pct > 5:
            ax.text(x_positions[0], bottom + pct/2, f'{label}\n{count} ({pct:.0f}%)',
                   ha='center', va='center', fontsize=9, color=COLORS['charcoal'])
        if label == 'Same-Day:':
            same_day_bottom = bottom
        bottom += pct

    # Bar 2: Same-Day Urgent by pickup status
    if sd_total > 0:
        segments2 = [
            (pickup_requested/sd_total*100, 'Pickup\nRequested:', pickup_requested, COLORS['primary']),
            (pickup_not_requested/sd_total*100, 'Pickup Not\nRequested:', pickup_not_requested, COLORS['secondary']),
            (pickup_unknown/sd_total*100, 'Unknown:', pickup_unknown, COLORS['tertiary']),
        ]
    else:
        segments2 = []

    bottom = 0
    pr_top = 0
    for pct, label, count, color in segments2:
        ax.bar(x_positions[1], pct, bar_width, bottom=bottom, color=color, edgecolor='white', linewidth=1)
        if pct > 5:
            ax.text(x_positions[1], bottom + pct/2, f'{label}\n{count} ({pct:.0f}%)',
                   ha='center', va='center', fontsize=9, color='white' if color == COLORS['primary'] else COLORS['charcoal'])
        if 'Requested:' in label and 'Not' not in label:
            pr_top = bottom + pct
        bottom += pct

    # Draw connector from Same-Day to Stage 2
    draw_connector(ax, x_positions[0], same_day_bottom, same_day_bottom + same_day/total*100, x_positions[1])

    # Bars 3-5: Transfer rates by pickup status
    pickup_data = [
        (x_positions[2], len(pr_df), pr_transfers, pr_no_transfer, 'Pickup Requested'),
        (x_positions[3], len(pnr_df), pnr_transfers, pnr_no_transfer, 'Pickup Not Requested'),
        (x_positions[4], len(pu_df), pu_transfers, pu_no_transfer, 'Pickup Unknown'),
    ]

    for x, n, transfers, no_transfer, title in pickup_data:
        if n > 0:
            t_pct = transfers/n*100
            nt_pct = no_transfer/n*100

            ax.bar(x, t_pct, bar_width, bottom=nt_pct, color=COLORS['primary'], edgecolor='white', linewidth=1)
            ax.bar(x, nt_pct, bar_width, bottom=0, color=COLORS['tertiary'], edgecolor='white', linewidth=1)

            if t_pct > 10:
                ax.text(x, nt_pct + t_pct/2, f'Transfer:\n{transfers} ({t_pct:.0f}%)',
                       ha='center', va='center', fontsize=9, color='white')
            if nt_pct > 10:
                ax.text(x, nt_pct/2, f'No Transfer:\n{no_transfer} ({nt_pct:.0f}%)',
                       ha='center', va='center', fontsize=9, color=COLORS['charcoal'])

    # Draw connectors from Stage 2 to Stages 3-5
    if sd_total > 0 and pickup_requested > 0:
        pr_pct = pickup_requested/sd_total*100
        draw_connector(ax, x_positions[1], 100 - pr_pct, 100, x_positions[2])

    # Formatting
    ax.set_ylim(0, 105)
    ax.set_xlim(-0.5, 5.5)
    ax.set_ylabel('Percentage', fontsize=11, color=COLORS['charcoal'])
    ax.yaxis.set_major_formatter(plt.FuncFormatter(lambda x, p: f'{x:.0f}%'))

    # X-axis labels
    ax.set_xticks(x_positions)
    ax.set_xticklabels([
        f'All Outbound Calls\nn={total}',
        f'Same-Day Urgent\nn={sd_total}',
        f'Pickup Requested\nn={len(pr_df)}',
        f'Pickup Not Requested\nn={len(pnr_df)}',
        f'Pickup Unknown\nn={len(pu_df)}'
    ], fontsize=10)

    ax.set_title('Outbound HRD Calls: Same-Day Urgent → Pickup Requested → Transfer Rate',
                fontsize=14, fontweight='bold', color=COLORS['charcoal'], pad=20)

    # Remove spines
    ax.spines['left'].set_color(COLORS['light'])
    ax.spines['bottom'].set_color(COLORS['light'])

    plt.tight_layout()
    return fig


def create_chart_2(df):
    """
    Chart 2: Same-Day Urgent -> Transfer Flow
    """
    total = len(df)
    urgency_col = 'B_time_feasibility.customer_time_need_category'
    transfer_col = 'F_transfers.branch_transfer_attempted'
    transfer_type_col = 'F_transfers.branch_transfer_type'
    outcome_col = 'F_transfers.warm_transfer_outcome'

    # Stage 1: All Outbound Calls by urgency
    urgency_counts = df[urgency_col].value_counts()
    same_day = urgency_counts.get('same_day_today', 0)
    this_week = urgency_counts.get('this_week', 0)
    unsure = urgency_counts.get('unsure', 0)
    next_week = urgency_counts.get('next_week', 0)
    other = total - same_day - this_week - unsure - next_week

    # Stage 2: Same-Day Urgent transfer status
    same_day_df = df[df[urgency_col] == 'same_day_today']
    sd_total = len(same_day_df)

    transfer_mask = get_bool_mask(same_day_df, transfer_col)
    transfers = transfer_mask.sum()
    no_transfer = sd_total - transfers

    # Stage 3: Transfer type (warm vs cold)
    transfer_df = same_day_df[transfer_mask]
    warm_transfers = (transfer_df[transfer_type_col] == 'warm').sum()
    cold_transfers = len(transfer_df) - warm_transfers

    # Stage 4: Warm transfer outcomes
    warm_df = transfer_df[transfer_df[transfer_type_col] == 'warm']
    took_over = (warm_df[outcome_col] == 'branch_took_over').sum()
    no_answer = (warm_df[outcome_col] == 'branch_no_answer').sum()
    busy = len(warm_df) - took_over - no_answer

    # Create figure
    fig, ax = plt.subplots(figsize=(14, 8))

    bar_width = 0.6
    x_positions = [0, 1.5, 3, 4.5]

    # Bar 1: All Outbound Calls
    segments1 = [
        (same_day/total*100, 'Same-Day:', same_day, COLORS['primary']),
        (this_week/total*100, 'This Week:', this_week, COLORS['secondary']),
        (unsure/total*100, 'Unsure:', unsure, COLORS['tertiary']),
        (next_week/total*100, 'Next Week:', next_week, COLORS['light']),
        (other/total*100, 'Other:', other, '#D4D4D4'),
    ]

    bottom = 0
    same_day_bottom = 0
    for pct, label, count, color in segments1:
        ax.bar(x_positions[0], pct, bar_width, bottom=bottom, color=color, edgecolor='white', linewidth=1)
        if pct > 5:
            ax.text(x_positions[0], bottom + pct/2, f'{label}\n{count} ({pct:.0f}%)',
                   ha='center', va='center', fontsize=9, color=COLORS['charcoal'])
        if label == 'Same-Day:':
            same_day_bottom = bottom
        bottom += pct

    # Bar 2: Same-Day Urgent - Transfer status
    if sd_total > 0:
        t_pct = transfers/sd_total*100
        nt_pct = no_transfer/sd_total*100

        ax.bar(x_positions[1], t_pct, bar_width, bottom=nt_pct, color=COLORS['primary'], edgecolor='white', linewidth=1)
        ax.bar(x_positions[1], nt_pct, bar_width, bottom=0, color=COLORS['tertiary'], edgecolor='white', linewidth=1)

        ax.text(x_positions[1], nt_pct + t_pct/2, f'Transfer:\n{transfers} ({t_pct:.0f}%)',
               ha='center', va='center', fontsize=9, color='white')
        ax.text(x_positions[1], nt_pct/2, f'No Transfer:\n{no_transfer} ({nt_pct:.0f}%)',
               ha='center', va='center', fontsize=9, color=COLORS['charcoal'])

    # Draw connector
    draw_connector(ax, x_positions[0], same_day_bottom, same_day_bottom + same_day/total*100, x_positions[1])

    # Bar 3: Transfer type
    if transfers > 0:
        w_pct = warm_transfers/transfers*100
        c_pct = cold_transfers/transfers*100

        ax.bar(x_positions[2], w_pct, bar_width, bottom=c_pct, color=COLORS['primary'], edgecolor='white', linewidth=1)
        ax.bar(x_positions[2], c_pct, bar_width, bottom=0, color=COLORS['secondary'], edgecolor='white', linewidth=1)

        ax.text(x_positions[2], c_pct + w_pct/2, f'Warm:\n{warm_transfers} ({w_pct:.0f}%)',
               ha='center', va='center', fontsize=9, color='white')
        ax.text(x_positions[2], c_pct/2, f'Cold:\n{cold_transfers} ({c_pct:.0f}%)',
               ha='center', va='center', fontsize=9, color='white')

        # Draw connector
        if sd_total > 0:
            draw_connector(ax, x_positions[1], 100 - t_pct, 100, x_positions[2])

    # Bar 4: Warm transfer outcomes
    if warm_transfers > 0:
        to_pct = took_over/warm_transfers*100
        na_pct = no_answer/warm_transfers*100
        b_pct = busy/warm_transfers*100

        bottom = 0
        ax.bar(x_positions[3], b_pct, bar_width, bottom=bottom, color=COLORS['secondary'], edgecolor='white', linewidth=1)
        if b_pct > 5:
            ax.text(x_positions[3], bottom + b_pct/2, f'Busy: {busy}',
                   ha='center', va='center', fontsize=9, color='white')
        bottom += b_pct

        ax.bar(x_positions[3], na_pct, bar_width, bottom=bottom, color=COLORS['tertiary'], edgecolor='white', linewidth=1)
        if na_pct > 5:
            ax.text(x_positions[3], bottom + na_pct/2, f'No Answer:\n{no_answer} ({na_pct:.0f}%)',
                   ha='center', va='center', fontsize=9, color=COLORS['charcoal'])
        bottom += na_pct

        ax.bar(x_positions[3], to_pct, bar_width, bottom=bottom, color=COLORS['primary'], edgecolor='white', linewidth=1)
        ax.text(x_positions[3], bottom + to_pct/2, f'Took Over:\n{took_over} ({to_pct:.0f}%)',
               ha='center', va='center', fontsize=9, color='white')

        # Draw connector
        if transfers > 0:
            draw_connector(ax, x_positions[2], 100 - w_pct, 100, x_positions[3])

    # Formatting
    ax.set_ylim(0, 105)
    ax.set_xlim(-0.5, 5.5)
    ax.set_ylabel('Percentage', fontsize=11, color=COLORS['charcoal'])
    ax.yaxis.set_major_formatter(plt.FuncFormatter(lambda x, p: f'{x:.0f}%'))

    # X-axis labels
    ax.set_xticks(x_positions)
    ax.set_xticklabels([
        f'All Outbound Calls\nn={total}',
        f'Same-Day Urgent\nn={sd_total}',
        f'Transfers\nn={transfers}',
        f'Warm Outcomes\nn={warm_transfers}'
    ], fontsize=10)

    ax.set_title('Outbound HRD Calls: Same-Day Urgent → Transfer Flow',
                fontsize=14, fontweight='bold', color=COLORS['charcoal'], pad=20)

    # Remove spines
    ax.spines['left'].set_color(COLORS['light'])
    ax.spines['bottom'].set_color(COLORS['light'])

    plt.tight_layout()
    return fig


def main():
    print("Loading data...")
    df = load_data()
    print(f"Loaded {len(df)} records")

    print("\nGenerating Chart 1: Pickup/Transfer Rate...")
    fig1 = create_chart_1(df)
    output1 = OUTPUT_DIR / "outbound_pickup_transfer.png"
    fig1.savefig(output1, dpi=150, bbox_inches='tight', facecolor='white')
    print(f"Saved: {output1}")

    print("\nGenerating Chart 2: Transfer Flow...")
    fig2 = create_chart_2(df)
    output2 = OUTPUT_DIR / "outbound_transfer_breakdown.png"
    fig2.savefig(output2, dpi=150, bbox_inches='tight', facecolor='white')
    print(f"Saved: {output2}")

    plt.close('all')
    print("\nDone!")


if __name__ == "__main__":
    main()
