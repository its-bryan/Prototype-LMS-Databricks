# Hertz Insurance Replacement Lead Conversion optimisation Project Context, Scope, Objectives

## Background

- Hertz derives ~20% of its total North America revenue (~$2B annually) from the Insurance Replacement segment
- The Insurance Replacement segment involves providing rental cars to customers whose vehicles are being repaired or replaced after an accident, with rentals covered by insurance companies
- Enterprise dominates the segment with ~70% market share vs. Hertz's ~30% share
- Hertz currently converts 67-70% of insurance-referred leads, representing a significant gap to best-in-class performance (~80%)
- Lost conversions represent $20-30M in immediate revenue opportunity, with additional strategic upside in market share capture
- Root causes of lost conversions are currently understood anecdotally but not quantified or systematically addressed

## Success metrics
- Improved conversion rates from 67-70% to 80%+ within 12-18 months.
- At least an additional 800 conversions per month would payback Carrara's fees (60,000 USD) for the 6 weeks.

## Output
- Jupyter notebook report outlining the results of our hypothesis testing through the data and stakeholder interviews. 
- Diagnostics report with quantification of failure steps & estimated contribution to loss conversion (and therefore uplift potential)
- ROI prioritization framework that balances revenue impact, implementation complexity, and time-to-value for potential interventions 

## This is likely achieved by:

### Data analysis
- Use converted leads, unconverted leads, location data, and other provided data.
- Compare attributes and nature of converted leads vs unconverted leads, key differences / patterns.
- Leverage statistical analysis to understand what influence conversion rates up or down significantly

### Stakeholder interviews for operational insights
- Use emerging insights from the data to dive deeper with Hertz stakeholders, getting more fidelity on what actually happens on the ground which causes the failure modes
- Focus on outbound calling desk and customer contact process.
- Identify specific breakdowns (timing, trust, follow-up, call quality) and resource allocation needs.
- Recommend quick-win interventions (3–6 months) and highlight longer-term “big rocks” to tackle in 2026.

### Financial modeling
- Estimate the revenue impact of addressing each conversion barrier.
- Develop ROI-driven prioritization for resource deployment.

## Approach

The general approach for this project will be as follows:

### Phase 1: Data Onboarding

**Receive sample data from Hertz**
- 1,000 rows across multiple HLES tables (CRESER, CRA001, CSPLIT, TRANSLOG, Conversion)
- Familiarize with data formats, field definitions, and table relationships
- Build data loading and validation scripts that will work when full production data arrives
- Document any data quality issues or gaps discovered in samples

### Phase 2: Descriptive Analysis

**Establish baseline understanding of conversion patterns**
- Calculate overall conversion rate and validate against Hertz's reported 67-70%
- Segment conversion rates by key attributes:
  - Insurance partner (cdp_name)
  - Time-to-first-contact (contact_range)
  - Contact channel (Counter vs HRD vs MMR)
  - Geography / location
  - Day of week / time patterns
- Identify which segments over/under-perform baseline

### Phase 3: Hypothesis Testing

**Systematically test each conversion failure hypothesis**

Work through hypotheses documented in `@docs/hypotheses.md` using the hypothesis tester agent.

### Phase 3A: Call Quality Analysis (New - HRD Call Center Data)

**Analyze HRD call center operations and quality patterns**

**Context**: HRD call recording data received (1,000 calls, Nov 1-7, 2025). Cannot directly join to HLES conversion data, but provides valuable operational insights.

**Analysis objectives**:
- **Agent performance benchmarking**: Identify top/bottom performers, document best practices
- **Call quality patterns**: Analyze completion rates, hold times, technical issues
- **Temporal optimization**: Identify optimal calling hours, avoid low-performance periods
- **Operational issues**: Multi-call attempts, transfer failures, telephony problems
- **Triangulation with HLES**: Correlate aggregate call quality patterns with conversion trends for same time period

**Deliverables**:
- Call quality analysis notebook (`notebooks/04_call_quality_analysis.ipynb`)
- Agent performance rankings and training recommendations
- Operational improvement recommendations (call attempt limits, hold time alerts, telephony fixes)
- Stakeholder interview questions based on call data patterns

**Limitations**:
- No direct conversion indicator in call data (disposition codes 100% null)
- No join key to link individual calls to HLES conversion outcomes
- Analysis relies on temporal triangulation and aggregate pattern correlation

### Phase 4: Insights Synthesis

**Compile findings into actionable deliverables**
- Consolidate all hypothesis tests into a master Jupyter notebook
- Rank failure modes by estimated conversion impact
- Identify top 3-5 drivers of lost conversions with quantified uplift potential

### Phase 5: Stakeholder Interview Preparation

**Use data insights to brief survey questionnaire**
- Translate quantitative findings into targeted questions for field teams
- Focus on understanding the "why" behind the patterns observed in data
- Prepare specific scenarios to validate with HRD, counter staff, and field leadership
- **Incorporate call quality insights**:
  - Agent performance variance (4.6x difference between top/bottom performers)
  - Hour 13 performance drop (54% customer hang-ups) - shift change? lunch break?
  - Multi-call attempt policies (one customer received 63 calls)
  - Telephony technical issues (6.7% agent phone disconnects)
  - Team ROUPE vs ROSS effectiveness differences

### Phase 6: Stakeholder Interviews

**Ground-truth findings with operational reality**
- Interview outbound calling desk (HRD) on contact process and barriers
- Interview counter/location staff on walk-up vs. pre-booked conversion
- Interview field leadership on resource constraints and competitive dynamics
- Capture anecdotes that explain or contradict data findings

### Phase 7: Experiment Design

**Craft interventions based on validated insights**
- Prioritize failure modes by: revenue impact × feasibility × speed-to-implement
- Design A/B test frameworks for quick-win interventions (3-6 month horizon)
- Outline "big rock" initiatives requiring longer investment (2026 roadmap)
- Develop ROI projections for each proposed intervention
