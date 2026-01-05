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
- **Conversion**: `rental / res_id` within 90-day window

### Key Metrics
- Lead conversion rate (current: 67-70%, target: 80%+)
- Time-to-first-contact (contact_range, hours_difference)
- Conversion by channel (Counter vs HRD vs MMR self-service)
- Conversion by insurance partner (cdp_name)

## Project Structure

```
HertzDataAnalysis/
├── .claude/
│   ├── agents/        # Multi-step orchestrator agents
│   ├── skills/        # Single-step building block skills
│   └── README.md      # Agent/skill documentation
├── configs/           # Configuration files
├── data/
│   ├── raw/           # Original data files (never modify)
│   ├── processed/     # Cleaned and transformed data
│   └── external/      # External reference data
├── docs/
│   ├── context/
│   │   ├── emails/              # Email correspondence
│   │   ├── Hertz_context_docs/  # Source docs from Hertz
│   │   ├── meeting_transcripts/ # Stakeholder meeting notes
│   │   ├── data_README.md       # Data documentation
│   │   └── project_scope.md     # Project scope & objectives
│   ├── hypotheses.md            # Conversion failure hypotheses
│   └── outstanding_questions.md # Pending data questions
├── notebooks/         # Jupyter notebooks for exploration
├── reports/
│   └── figures/       # Generated charts and visuals
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
| `stat-test-selector` | `/stat-test-selector categorical → binary` | Recommend statistical test |
| `analysis-coder` | `/analysis-coder H1 chi-square` | Generate Python analysis code |
| `results-interpreter` | `/results-interpreter <stats>` | Translate results to plain English |
| `viz-generator` | `/viz-generator bar conversion by X` | Generate/execute visualization |
| `sanity-checker` | `/sanity-checker H1 results` | Validate results, check assumptions |
| `type-detector` | `/type-detector df` | Infer semantic column types |
| `quality-checker` | `/quality-checker df` | Find data quality issues |
| `join-validator` | `/join-validator df1.key df2.key` | Test join compatibility |
| `cleaning-suggester` | `/cleaning-suggester df` | Recommend cleaning steps |
