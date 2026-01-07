# Hertz Insurance Replacement Lead Conversion Analysis

## Project Overview

This project analyzes Hertz's insurance replacement business segment to **improve lead-to-rental conversion rates**. Insurance replacement covers car rentals provided to customers whose vehicles are being repaired/replaced due to accidents, with leads sourced from insurance company partners.

## Data Domain

### HLES System Tables
- **CRESER** - Incoming reservations from insurance partners, only 1 sheet
- **CRA001** - Contract details, intermediate step before CSPLIT
- **CSPLIT** - Split billing + comprehensive rental information (main operational table)
- **TRANSLOG** - Transaction log with customer contact records
- **HLES Conversion** - Aggregated conversion metrics from WebFocus

### HRD Call Center Data
- **CIDsHRDrecording** - HRD (Hertz Reservation Desk) call metadata, there are 2 sheets 'OutboundHRD' and 'InboundHRD'. Make sure you analyse both sheets when this file is loaded

### **Conversion Outcome Variable** (PRIMARY OPTIMIZATION TARGET)
- **Variable Name**: `RENT_IND` (raw data: `\nRENT_IND` due to Excel formatting) in HLES conversion data
- **Definition**: Binary indicator where `1` = lead converted to rental, `0` = did not convert
- **Conversion Formula**: `Conversion Rate = (sum of RENT_IND) / (sum of RES_ID) × 100%`

## Tech Stack

- **Python 3.12+**
- **Data**: pandas, numpy, openpyxl
- **Visualization**: matplotlib, seaborn, plotly
- **ML**: scikit-learn, xgboost
- **Statistics**: scipy, statsmodels
- **NLP** (future, if call transcripts available): transformers, textblob, spaCy

## Working with Excel Files

Always specify `engine='openpyxl'` when reading .xlsx files:

```python
pd.read_excel('path/to/file.xlsx', engine='openpyxl')
```

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

## Custom Skills & Agents

See `.claude/README.md` for full documentation only if needed