# viz-generator

Generate and optionally execute visualizations for hypothesis test results and data exploration.

## Usage

```
/viz-generator <chart_type> <data_description>
/viz-generator --code-only <chart_type> <data_description>
```

Or provide context naturally:
```
/viz-generator bar chart showing conversion rates by contact_range with confidence intervals
/viz-generator --code-only heatmap of conversion by location and day of week
```

## Execution Modes

| Mode | Behavior | When to Use |
|------|----------|-------------|
| **Default (execute)** | Runs code via `mcp__ide__executeCode`, chart renders in notebook | Active Jupyter notebook open |
| **--code-only** | Returns code block to copy into cell | No notebook, or want reusable code |

The skill automatically detects if a Jupyter kernel is available. If not, falls back to code-only mode.

## Input Parameters

- **chart_type**: Type of visualization needed
- **data**: DataFrame name or description
- **columns**: Columns to include [x, y, hue]
- **title**: Chart title
- **context**: What insight the chart should highlight
- **--code-only**: Flag to return code instead of executing

## Chart Selection Guide

| Analysis Type | Recommended Chart | Function |
|--------------|-------------------|----------|
| Conversion by category | Horizontal bar + CI | `plot_conversion_by_group()` |
| Conversion over time | Line chart | `plot_conversion_over_time()` |
| Distribution | Histogram / KDE | `plot_distribution_by_outcome()` |
| Two categorical vars | Heatmap | `plot_conversion_heatmap()` |
| Funnel stages | Funnel chart | `plot_funnel()` |
| Correlation | Scatter plot | `plot_scatter_with_regression()` |

## Code Templates

### Setup (Run Once Per Notebook)

```python
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from scipy import stats

# Style defaults
plt.rcParams['figure.facecolor'] = 'white'
plt.rcParams['axes.facecolor'] = 'white'
plt.rcParams['font.family'] = 'sans-serif'
plt.rcParams['font.size'] = 11
sns.set_style('whitegrid')

# Hertz-inspired color palette
COLORS = {
    'primary': '#FFD100',    # Hertz yellow
    'success': '#27ae60',    # Green - above baseline
    'danger': '#e74c3c',     # Red - below baseline
    'info': '#3498db',       # Blue - baseline/neutral
    'gray': '#7f8c8d'
}
```

### Conversion Rate Bar Chart (Primary)

```python
def plot_conversion_by_group(df, group_col, outcome_col, title=None, figsize=(10, 6), save_path=None):
    """
    Horizontal bar chart showing conversion rates by group with 95% confidence intervals.
    Bars colored by performance vs baseline. Sorted by conversion rate.
    """
    # Calculate conversion rates and CIs
    summary = df.groupby(group_col).agg(
        total=(outcome_col, 'count'),
        converted=(outcome_col, 'sum')
    ).reset_index()
    summary['rate'] = summary['converted'] / summary['total']

    # Wilson score CI
    def wilson_ci(s, n, z=1.96):
        if n == 0: return (0, 0)
        p = s / n
        denom = 1 + z**2 / n
        center = (p + z**2 / (2*n)) / denom
        margin = z * np.sqrt((p*(1-p) + z**2/(4*n)) / n) / denom
        return (max(0, center - margin), min(1, center + margin))

    summary['ci_lower'], summary['ci_upper'] = zip(*[
        wilson_ci(r['converted'], r['total']) for _, r in summary.iterrows()
    ])
    summary['ci_error_lower'] = summary['rate'] - summary['ci_lower']
    summary['ci_error_upper'] = summary['ci_upper'] - summary['rate']

    # Sort by conversion rate
    summary = summary.sort_values('rate', ascending=True)

    # Create plot
    fig, ax = plt.subplots(figsize=figsize)

    # Baseline
    baseline = df[outcome_col].mean()

    # Color bars by performance vs baseline
    colors = ['#e74c3c' if r < baseline else '#27ae60' for r in summary['rate']]

    # Plot bars
    bars = ax.barh(summary[group_col], summary['rate'], color=colors, alpha=0.8)

    # Add error bars
    ax.errorbar(summary['rate'], summary[group_col],
                xerr=[summary['ci_error_lower'], summary['ci_error_upper']],
                fmt='none', color='black', capsize=3)

    # Baseline reference line
    ax.axvline(baseline, color='#3498db', linestyle='--', linewidth=2,
               label=f'Baseline: {baseline:.1%}')

    # Labels on bars
    for bar, rate, n in zip(bars, summary['rate'], summary['total']):
        ax.text(bar.get_width() + 0.01, bar.get_y() + bar.get_height()/2,
                f'{rate:.1%} (n={n})', va='center', fontsize=10)

    # Formatting
    ax.set_xlabel('Conversion Rate', fontsize=12)
    ax.set_ylabel(group_col, fontsize=12)
    ax.set_title(title or f'Conversion Rate by {group_col}', fontsize=14, fontweight='bold')
    ax.set_xlim(0, min(1, summary['ci_upper'].max() + 0.15))
    ax.xaxis.set_major_formatter(plt.FuncFormatter(lambda x, _: f'{x:.0%}'))
    ax.legend(loc='lower right')
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)

    plt.tight_layout()

    if save_path:
        plt.savefig(save_path, dpi=150, bbox_inches='tight')

    plt.show()
    return summary
```

**Execution call**:
```python
summary = plot_conversion_by_group(df, 'contact_range', 'rental',
                                    title='H1: Conversion Rate by Contact Speed')
```

### Time Series Conversion Chart

```python
def plot_conversion_over_time(df, date_col, outcome_col, freq='W', title=None, figsize=(12, 5), save_path=None):
    """
    Line chart showing conversion rate over time with rolling average.
    """
    df = df.copy()
    df[date_col] = pd.to_datetime(df[date_col])

    # Aggregate by time period
    df['period'] = df[date_col].dt.to_period(freq)
    time_summary = df.groupby('period').agg(
        total=(outcome_col, 'count'),
        converted=(outcome_col, 'sum')
    )
    time_summary['rate'] = time_summary['converted'] / time_summary['total']
    time_summary.index = time_summary.index.to_timestamp()

    fig, ax = plt.subplots(figsize=figsize)

    # Main line
    ax.plot(time_summary.index, time_summary['rate'], 'o-', color='#3498db',
            linewidth=2, markersize=6, label='Conversion Rate')

    # Rolling average
    if len(time_summary) > 4:
        rolling = time_summary['rate'].rolling(4, min_periods=2).mean()
        ax.plot(time_summary.index, rolling, '--', color='#e74c3c',
                linewidth=2, label='4-period Moving Avg')

    # Baseline
    baseline = df[outcome_col].mean()
    ax.axhline(baseline, color='gray', linestyle=':', alpha=0.7, label=f'Overall: {baseline:.1%}')

    ax.set_xlabel('Date', fontsize=12)
    ax.set_ylabel('Conversion Rate', fontsize=12)
    ax.set_title(title or 'Conversion Rate Over Time', fontsize=14, fontweight='bold')
    ax.yaxis.set_major_formatter(plt.FuncFormatter(lambda x, _: f'{x:.0%}'))
    ax.legend(loc='best')
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)

    plt.tight_layout()

    if save_path:
        plt.savefig(save_path, dpi=150, bbox_inches='tight')

    plt.show()
    return time_summary
```

### Heatmap (Two Categorical Variables)

```python
def plot_conversion_heatmap(df, row_col, col_col, outcome_col, title=None, figsize=(10, 8), save_path=None):
    """
    Heatmap showing conversion rates across two categorical dimensions.
    Centered on baseline conversion rate.
    """
    # Create pivot table
    pivot = df.pivot_table(
        values=outcome_col,
        index=row_col,
        columns=col_col,
        aggfunc='mean'
    )

    fig, ax = plt.subplots(figsize=figsize)

    # Create heatmap centered on baseline
    baseline = df[outcome_col].mean()
    sns.heatmap(pivot, annot=True, fmt='.1%', cmap='RdYlGn',
                center=baseline, ax=ax,
                cbar_kws={'label': 'Conversion Rate', 'format': '%.0%%'})

    ax.set_title(title or f'Conversion Rate: {row_col} × {col_col}',
                 fontsize=14, fontweight='bold')

    plt.tight_layout()

    if save_path:
        plt.savefig(save_path, dpi=150, bbox_inches='tight')

    plt.show()
    return pivot
```

### Distribution Comparison

```python
def plot_distribution_by_outcome(df, value_col, outcome_col, title=None, figsize=(12, 5), save_path=None):
    """
    Compare distribution of a continuous variable between converted/not converted.
    Shows both histogram and box plot side by side.
    """
    fig, axes = plt.subplots(1, 2, figsize=figsize)

    # Histogram
    for outcome, color, label in [(1, '#27ae60', 'Converted'), (0, '#e74c3c', 'Not Converted')]:
        subset = df[df[outcome_col] == outcome][value_col].dropna()
        axes[0].hist(subset, bins=30, alpha=0.6, color=color, label=label, density=True)

    axes[0].set_xlabel(value_col, fontsize=11)
    axes[0].set_ylabel('Density', fontsize=11)
    axes[0].set_title(f'Distribution of {value_col}', fontsize=12)
    axes[0].legend()
    axes[0].spines['top'].set_visible(False)
    axes[0].spines['right'].set_visible(False)

    # Box plot
    df_plot = df[[value_col, outcome_col]].dropna().copy()
    df_plot['Outcome'] = df_plot[outcome_col].map({1: 'Converted', 0: 'Not Converted'})
    sns.boxplot(data=df_plot, x='Outcome', y=value_col, ax=axes[1],
                palette={'Converted': '#27ae60', 'Not Converted': '#e74c3c'})
    axes[1].set_title(f'{value_col} by Outcome', fontsize=12)
    axes[1].spines['top'].set_visible(False)
    axes[1].spines['right'].set_visible(False)

    plt.suptitle(title or f'{value_col} Distribution by Conversion', fontsize=14, fontweight='bold', y=1.02)
    plt.tight_layout()

    if save_path:
        plt.savefig(save_path, dpi=150, bbox_inches='tight')

    plt.show()
```

### Funnel Chart

```python
def plot_funnel(stages, values, title=None, figsize=(10, 6), save_path=None):
    """
    Funnel chart for conversion stages.

    Parameters:
        stages: list of stage names ['Leads', 'Contacted', 'Reserved', 'Converted']
        values: list of counts at each stage [1000, 750, 600, 450]
    """
    fig, ax = plt.subplots(figsize=figsize)

    # Calculate percentages relative to first stage
    pcts = [v / values[0] * 100 for v in values]

    # Colors gradient (darker = further in funnel)
    colors = plt.cm.Blues(np.linspace(0.3, 0.9, len(stages)))

    # Plot funnel bars (centered)
    for i, (stage, value, pct, color) in enumerate(zip(stages, values, pcts, colors)):
        width = pct / 100
        left = (1 - width) / 2
        y_pos = len(stages) - i - 1
        ax.barh(y_pos, width, left=left, height=0.6, color=color, edgecolor='white', linewidth=2)

        # Stage label and stats
        if i > 0:
            drop = pcts[i-1] - pct
            ax.text(0.5, y_pos, f'{stage}\n{value:,} ({pct:.1f}%)\n↓ {drop:.1f}% drop',
                    ha='center', va='center', fontsize=11, fontweight='bold', color='white' if pct > 50 else 'black')
        else:
            ax.text(0.5, y_pos, f'{stage}\n{value:,} (100%)',
                    ha='center', va='center', fontsize=11, fontweight='bold', color='white')

    ax.set_xlim(0, 1)
    ax.set_ylim(-0.5, len(stages) - 0.5)
    ax.axis('off')
    ax.set_title(title or 'Conversion Funnel', fontsize=14, fontweight='bold', pad=20)

    # Overall conversion annotation
    overall = values[-1] / values[0] * 100
    ax.text(0.5, -0.3, f'Overall Conversion: {overall:.1f}%', ha='center', fontsize=12,
            fontweight='bold', color='#27ae60')

    plt.tight_layout()

    if save_path:
        plt.savefig(save_path, dpi=150, bbox_inches='tight')

    plt.show()
```

### Scatter with Regression Line

```python
def plot_scatter_with_regression(df, x_col, y_col, title=None, figsize=(10, 6), save_path=None):
    """
    Scatter plot with regression line and correlation stats.
    For continuous x continuous relationships.
    """
    df_clean = df[[x_col, y_col]].dropna()

    fig, ax = plt.subplots(figsize=figsize)

    # Scatter
    ax.scatter(df_clean[x_col], df_clean[y_col], alpha=0.5, color='#3498db', s=50)

    # Regression line
    slope, intercept, r_value, p_value, std_err = stats.linregress(df_clean[x_col], df_clean[y_col])
    x_line = np.linspace(df_clean[x_col].min(), df_clean[x_col].max(), 100)
    y_line = slope * x_line + intercept
    ax.plot(x_line, y_line, color='#e74c3c', linewidth=2,
            label=f'r = {r_value:.3f}, p = {p_value:.4f}')

    ax.set_xlabel(x_col, fontsize=12)
    ax.set_ylabel(y_col, fontsize=12)
    ax.set_title(title or f'{y_col} vs {x_col}', fontsize=14, fontweight='bold')
    ax.legend(loc='best')
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)

    plt.tight_layout()

    if save_path:
        plt.savefig(save_path, dpi=150, bbox_inches='tight')

    plt.show()

    return {'r': r_value, 'p': p_value, 'slope': slope}
```

## Execution Behavior

When called **without** `--code-only`:

1. Skill constructs the appropriate plotting code
2. Executes via `mcp__ide__executeCode` in the active Jupyter kernel
3. Chart renders inline in the notebook
4. Returns summary data (if applicable)

When called **with** `--code-only`:

1. Returns the complete code block
2. User can copy into a notebook cell
3. Useful for customization or when no kernel is active

## Output Files

All charts can optionally save to `reports/figures/` with naming convention:
```
{hypothesis_id}_{chart_type}_{grouping}.png
```

Example: `H1_conversion_by_contact_range.png`
