# Claude Code Skills & Agents

Custom skills and agents for the Hertz Insurance Replacement analysis project.

## Quick Reference

### Agents (Orchestrators)

| Agent | Command | Purpose |
|-------|---------|---------|
| `hypothesis-tester` | `/hypothesis-tester H1` | Test a specific hypothesis end-to-end |
| `data-profiler` | `/data-profiler df_conversion` | Profile data file or DataFrame |

### Skills (Building Blocks)

#### Hypothesis Testing Stack

| Skill | Command | Purpose |
|-------|---------|---------|
| `feature-engineer` | `/feature-engineer H1` | Create derived features for analysis |
| `stat-test-selector` | `/stat-test-selector categorical → binary` | Recommend statistical test |
| `analysis-coder` | `/analysis-coder H1 chi-square [cols]` | Generate analysis code |
| `results-interpreter` | `/results-interpreter chi2=15.3 p=0.002` | Translate stats to English |
| `viz-generator` | `/viz-generator bar conversion by contact_range` | Create visualization |
| `sanity-checker` | `/sanity-checker H1 results` | Validate results, check assumptions |
| `hypothesis-discovery` | `/hypothesis-discovery H1` | Find sub-hypotheses via ML when effect is weak |

#### Data Profiling Stack

| Skill | Command | Purpose |
|-------|---------|---------|
| `data-describer` | `/data-describer df` | Comprehensive descriptive statistics overview |
| `type-detector` | `/type-detector df_creser` | Infer semantic column types |
| `quality-checker` | `/quality-checker df` | Find data quality issues |
| `join-validator` | `/join-validator df1.key df2.key` | Test join compatibility |
| `cleaning-suggester` | `/cleaning-suggester df` | Recommend cleaning steps |

#### Utility Skills

| Skill | Command | Purpose |
|-------|---------|---------|
| `md-to-docx` | `/md-to-docx docs/hypotheses.md` | Convert Markdown to Word format (.docx) |

## Architecture

```
Agents (orchestrate multi-step workflows)
├── hypothesis-tester
│   ├── calls: feature-engineer (Step 2b),
│   │          stat-test-selector, analysis-coder,
│   │          results-interpreter, viz-generator
│   ├── built-in: validation checks (Step 6)
│   ├── conditional: hypothesis-discovery (Step 7b, when effect is weak)
│   └── optional: sanity-checker (for deep review)
│
└── data-profiler
    └── calls: type-detector, quality-checker,
               join-validator, cleaning-suggester

Skills (shared building blocks)
├── feature-engineer
│   └── called by: hypothesis-tester, hypothesis-discovery
└── hypothesis-discovery
    └── calls: feature-engineer (creates interaction features)
```

## Usage Examples

### Test a Hypothesis

```
/hypothesis-tester H1

# Or with context:
/hypothesis-tester test if faster contact improves conversion using df_conversion
```

Output:
- Statistical results
- Visualization in notebook
- Updated `docs/hypotheses.md` with verdict
- Saved figure to `reports/figures/`

### Profile a Data File

```
/data-profiler data/raw/CRESER_1000_Records.xlsx

# Or an in-memory DataFrame:
/data-profiler df_conversion
```

Output:
- Column type summary
- Data quality report
- Join compatibility matrix
- Cleaning script

### Use Individual Skills

```
# Select a statistical test
/stat-test-selector I have categorical predictor (contact_range) and binary outcome (rental)

# Generate visualization code only (don't execute)
/viz-generator --code-only bar chart of conversion by cdp_name

# Check data quality
/quality-checker are there outliers in hours_difference?
```

## Design Principles

1. **Skills are cheap**: Low token cost, single-shot, deterministic
2. **Agents orchestrate**: Higher cost but handle multi-step workflows
3. **Composable**: Skills can be used standalone or by agents
4. **HLES-aware**: Built-in knowledge of Hertz data structures
5. **Executable**: Generate runnable code, not just advice

## File Structure

```
.claude/
├── README.md           # This file
├── skills/
│   ├── feature-engineer.md   # Shared: creates derived features
│   ├── hypothesis-discovery.md  # ML-driven sub-hypothesis discovery
│   ├── stat-test-selector.md
│   ├── analysis-coder.md
│   ├── results-interpreter.md
│   ├── viz-generator.md
│   ├── sanity-checker.md    # Validation & review
│   ├── data-describer.md    # Comprehensive descriptive statistics
│   ├── type-detector.md
│   ├── quality-checker.md
│   ├── join-validator.md
│   ├── cleaning-suggester.md
│   └── md-to-docx.md        # Convert Markdown to Word format
└── agents/
    ├── hypothesis-tester.md  # Full hypothesis testing workflow
    └── data-profiler.md
```

## Adding New Skills

1. Create `.md` file in `.claude/skills/`
2. Include: Usage, Input/Output, Code Templates, Examples
3. Keep focused on single responsibility
4. Document dependencies on other skills

## Adding New Agents

1. Create `.md` file in `.claude/agents/`
2. Define workflow steps
3. List which skills are called
4. Include error handling
5. Document expected outputs
