# Hertz Insurance Replacement Lead Conversion Analysis

## Project Context

See @docs/context/project_scope.md for project context, scope and objectives.
See @docs/context/meeting_transcripts/ for stakeholder meeting notes.
See @docs/hypotheses.md for conversion failure hypotheses to test.
See @docs/outstanding_questions.md for pending data clarification questions.

## Project Overview

This project analyzes Hertz's insurance replacement business segment to **improve lead-to-rental conversion rates**. Insurance replacement covers car rentals provided to customers whose vehicles are being repaired/replaced due to accidents, with leads sourced from insurance company partners.

## Data Domain

### HLES System Tables
- **CRESER** - Incoming reservations from insurance partners
- **CRA001** - Contract details, intermediate step before CSPLIT
- **CSPLIT** - Split billing + comprehensive rental information (main operational table)
- **TRANSLOG** - Transaction log with customer contact records
- **HLES Conversion** - Aggregated conversion metrics from WebFocus

### Key Fields
- **Composite Key**: `confirmation_number + initial_date` (confirmation numbers recycled ~6 months)
- **KNUM**: Reservation → rental agreement number (H-prefix = converted)

### **Conversion Outcome Variable** (PRIMARY OPTIMIZATION TARGET)
- **Variable Name**: `RENT_IND` (raw data: `\nRENT_IND` due to Excel formatting)
- **Definition**: Binary indicator where `1` = lead converted to rental, `0` = did not convert
- **Conversion Formula**: `Conversion Rate = (sum of RENT_IND) / (sum of RES_ID) × 100%`
- **Measurement Window**: 90 days from initial_date (though most conversions occur within first week)
- **Mutually Exclusive Outcomes**: Each lead has exactly one of three states:
  - `RENT_IND = 1`: Converted to rental (**TARGET TO MAXIMIZE**)
  - `CANCEL_ID = 1`: Cancelled by customer
  - `UNUSED_IND = 1`: Reservation expired unused
- **Data Source**: HLES Conversion table (aggregated from CRESER → CRA001 → CSPLIT)
- **Note**: Documentation may reference this as `rental` for readability, but actual column is `RENT_IND`

### Key Metrics
- **Lead conversion rate (current: 67-70%, target: 80%+)** ← PRIMARY PROJECT GOAL
- Time-to-first-contact (contact_range, hours_difference)
- Conversion by channel (Counter vs HRD vs MMR self-service)
- Conversion by insurance partner (cdp_name)

## Project Structure

```
HertzDataAnalysis/
├── .claude/
│   ├── agents/        # Custom agents (hypothesis-tester, data-profiler)
│   └── skills/        # Custom skills (selecting-tests, coding-analysis, etc.)
├── configs/           # Configuration files
├── data/
│   ├── raw/           # Original data files (never modify)
│   ├── processed/     # Cleaned and transformed data
│   └── external/      # External reference data
├── docs/
│   └── context/       # Project context and requirements
├── notebooks/         # Jupyter notebooks for exploration
├── reports/
│   └── figures/       # Generated visualizations and charts
├── src/
│   ├── data/          # Data loading and transformation
│   ├── features/      # Feature engineering
│   ├── models/        # ML models and evaluation
│   └── visualization/ # Plotting and reporting
└── tests/             # Unit tests
```

## Tech Stack

- **Python 3.12+**
- **Data**: pandas, numpy, openpyxl
- **Visualization**: matplotlib, seaborn, plotly
- **ML**: scikit-learn, xgboost
- **Statistics**: scipy, statsmodels

## Commands

```bash
# Install dependencies
pip install -r requirements.txt

# Run linting
ruff check src/ notebooks/

# Format code
black src/ notebooks/

# Run tests
pytest tests/

# Start Jupyter
jupyter lab
```

## Code Style

- **Formatter**: Black (line length 88)
- **Linter**: Ruff
- Follow PEP8 conventions
- Use type hints for function signatures
- Docstrings for public functions (Google style)

## Conventions

### Naming
- `snake_case` for variables, functions, modules
- `PascalCase` for classes
- `UPPER_CASE` for constants
- Prefix private functions with `_`

### Data Files
- Raw data: `{source}_{date}.csv` (e.g., `leads_2024-01.csv`)
- Processed data: `{name}_cleaned.parquet`

### Notebooks
- Prefix with number for ordering: `01_data_exploration.ipynb`
- Keep notebooks focused on single analysis tasks
- Move reusable code to `src/` modules

### Git
- Commit messages: `type: description` (e.g., `feat: add conversion funnel analysis`)
- Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`

## Data Transformation Notes

Common operations needed:
- **Joins**: Link leads → interactions → rentals via customer/lead IDs
- **Groupings**: Aggregate by time periods, channels, regions
- **Categorizations**: Lead source, customer segments, rental types
- **Cleaning**: Handle missing values, date parsing, deduplication

## Analysis Workflow

1. **Exploration** (notebooks): Profile data, identify patterns
2. **Transformation** (src/data): Clean and join tables
3. **Feature Engineering** (src/features): Create model inputs
4. **Modeling** (src/models): Train and evaluate models
5. **Reporting** (reports): Generate insights and visualizations

## Custom Skills & Agents

See `.claude/README.md` for full documentation.

### Agents (Multi-step Orchestrators)

| Agent | Usage | Purpose |
|-------|-------|---------|
| `hypothesis-tester` | `/hypothesis-tester H1` | Test hypothesis end-to-end: select test → run analysis → interpret → visualize |
| `data-profiler` | `/data-profiler df_conversion` | Profile data: types → quality → joins → cleaning recommendations |

### Skills (Single-step Building Blocks)

| Skill | Usage | Purpose |
|-------|-------|---------|
| `selecting-tests` | `/selecting-tests categorical → binary` | Recommend statistical test |
| `coding-analysis` | `/coding-analysis H1 chi-square` | Generate Python analysis code |
| `interpreting-results` | `/interpreting-results <stats>` | Translate results to plain English |
| `generating-visualizations` | `/generating-visualizations bar conversion by X` | Generate/execute visualization |
| `checking-sanity` | `/checking-sanity H1 results` | Validate results, check assumptions |
| `detecting-types` | `/detecting-types df` | Infer semantic column types |
| `checking-quality` | `/checking-quality df` | Find data quality issues |
| `validating-joins` | `/validating-joins df1.key df2.key` | Test join compatibility |
| `suggesting-cleaning` | `/suggesting-cleaning df` | Recommend cleaning steps |
| `engineering-features` | `/engineering-features df hypothesis` | Create derived features for testing |
| `discovering-hypotheses` | `/discovering-hypotheses weak_result` | Discover sub-hypotheses from weak effects |
