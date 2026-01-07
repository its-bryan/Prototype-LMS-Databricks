# HRD Call Recording Data - Insights & Analysis Summary

**Data Source**: `data/raw/CIDsHRDrecording.xlsx`
**Date Range**: November 1-7, 2025 (1 week sample)
**Records**: 1,000 outbound HRD calls
**Analysis Date**: January 2026

---

## Executive Summary

The HRD call transcript data provides valuable insights into call center operations but has **critical limitations for conversion analysis**:

- ❌ **No direct conversion indicator** (disposition codes are 100% null)
- ❌ **No join key to HLES conversion data** (no confirmation number or reservation ID)
- ✓ **Useful for call quality benchmarking** and operational improvements
- ✓ **Can support hypothesis validation through triangulation** with HLES data

---

## Data Profile

### Coverage
- **1,000 calls** across **742 unique customers** (via phone number `toAddr`)
- **19 agents** across **2 teams** (US_VXI_HRD_ROSS: 650 calls, US_VXI_HRD_ROUPE: 350 calls)
- **93 customers** (12.5%) received multiple call attempts
  - **Concerning**: One customer received **63 calls** in one week
  - Average calls per multi-contact customer: 2.7

### Data Quality Issues

**Constant/Null Fields (Can Exclude)**:
- 26 constant columns (all calls are outbound HRD, same campaign, same skill)
- 11 fields 100% null including:
  - `primaryDispositionId`, `secondaryDispositionId` (no disposition codes recorded)
  - `dispositionNotes` (no call notes/outcomes)
  - `transferIndicatorName` (no transfer tracking)

**Key Limitation**:
- No explicit conversion outcome field
- Cannot link to HLES conversion data directly

**Useful Fields (14 of 59)**:
- `contactId`, `masterContactId`, `contactStart`, `toAddr`
- `agentId`, `teamName`, `firstName`, `lastName`
- `totalDurationSeconds`, `agentSeconds`, `holdSeconds`, `holdCount`
- `endReason`, `LoadDate`

---

## Call Outcome Patterns

### End Reason Distribution

| End Reason | Count | % | Interpretation |
|------------|-------|---|----------------|
| **Agent Hung Up** | 613 | 61.3% | Agent completed interaction (likely positive) |
| **Contact Hung Up** | 320 | 32.0% | Customer ended call (mixed signal) |
| **Agent Phone Disconnected** | 67 | 6.7% | Technical issue (negative) |

### Call Duration Metrics by Outcome

| End Reason | Avg Duration | Avg Agent Time | Avg Hold Time |
|------------|--------------|----------------|---------------|
| Agent Hung Up | 305 sec (5.1 min) | 302 sec | 12.5 sec |
| Contact Hung Up | 402 sec (6.7 min) | 306 sec | 19.7 sec |
| Agent Disconnected | 457 sec (7.6 min) | 360 sec | 20.5 sec |

**Insight**: Calls ending with "Contact Hung Up" are **32% longer** than agent-ended calls, suggesting customers may hang up after extended holds or unsatisfactory interactions.

### Proposed Call Quality Proxy

Based on available signals, calls can be classified:

| Quality Signal | Count | % | Definition |
|----------------|-------|---|------------|
| **Positive** | 593 | 59.3% | Agent ended + reasonable duration (1-15 min) + low holds (≤1) |
| **Neutral/Mixed** | 250 | 25.0% | Other agent-ended or customer-ended with normal engagement |
| **Negative** | 157 | 15.7% | Customer hung up quickly (<3 min) OR excessive holds (>2) OR technical issue |

---

## Agent & Team Performance

### Agent Performance Variance (Agents with 10+ calls)

**Top 5 Agents** (by % agent-ended calls):

| Agent ID | Calls | Avg Duration | % Agent Ended |
|----------|-------|--------------|---------------|
| 60923902 | 76 | 234 sec | **86.8%** |
| 60839761 | 27 | 305 sec | **85.2%** |
| 60923952 | 19 | 277 sec | **84.2%** |
| 60839775 | 42 | 386 sec | 76.2% |
| 60839769 | 90 | 330 sec | 73.3% |

**Bottom 5 Agents**:

| Agent ID | Calls | Avg Duration | % Agent Ended |
|----------|-------|--------------|---------------|
| 69105657 | 21 | 350 sec | **19.0%** |
| 60923901 | 21 | 544 sec | **23.8%** |
| 60923896 | 28 | 392 sec | **28.6%** |
| 60839773 | 114 | 350 sec | **39.5%** |
| 60839760 | 68 | 438 sec | **39.7%** |

**Key Finding**: **4.6x performance gap** between top and bottom agents (87% vs 19% completion rate). This suggests significant opportunity for training and best practice sharing.

### Team Comparison

| Team | Calls | Avg Duration | Avg Hold | % Agent Ended |
|------|-------|--------------|----------|---------------|
| US_VXI_HRD_ROUPE | 350 | 362 sec | 19.2 sec | **64.6%** |
| US_VXI_HRD_ROSS | 650 | 338 sec | 13.3 sec | **59.5%** |

**Insight**: ROUPE team has 5.1 percentage point higher completion rate despite longer hold times. Worth investigating what ROUPE does differently.

---

## Temporal Patterns

### Call Outcomes by Hour of Day

| Hour (UTC) | Agent Hung Up | Contact Hung Up | Tech Issue | Total Calls |
|------------|---------------|-----------------|------------|-------------|
| **13** | 38.5% | **53.8%** 🔴 | 7.7% | 26 |
| **15** | 48.2% | **46.5%** 🔴 | 5.3% | 57 |
| **17** | 48.3% | 38.3% | **13.3%** 🔴 | 60 |
| **12** | **75.0%** ✓ | 18.8% | 6.2% | 16 |
| **21** | **76.5%** ✓ | 18.6% | 4.9% | 81 |
| **22** | **72.9%** ✓ | 27.1% | 0.0% | 48 |

**Key Findings**:
- **Hour 13** (1pm UTC): Worst performance - 54% customer hang-ups
- **Hours 12, 21-22**: Best performance - 73-77% agent completion
- **Hour 17** (5pm): Highest technical issues (13%)

**Hypothesis**: Hour 13 may correlate with lunch breaks, shift changes, or peak customer unavailability.

---

## Operational Issues Identified

### 1. Excessive Multi-Call Attempts

- **93 customers** (12.5% of unique customers) received 2+ calls in one week
- **Maximum**: 63 calls to single customer (phone: 8447051298)
- **Top 5 multi-call customers**:
  - 8447051298: 63 calls
  - 8444013100: 23 calls
  - 3102634884: 4 calls
  - 3123727600: 4 calls
  - 2404619546: 4 calls

**Risk**: Potential customer harassment, regulatory compliance issues, wasted agent time.

**Recommendation**: Implement call attempt limits (e.g., max 3 attempts per customer per week) and routing rules to avoid repeat calls.

### 2. Hold Time Issues

- **18.1%** of calls included holds (181/1000)
- **4 calls** with excessive holds (>5 minutes)
- **Maximum hold**: 10.3 minutes

**Recommendation**: Investigate root cause of long holds (transfer attempts? system lookups?) and implement hold time alerts.

### 3. Technical Issues

- **67 calls** (6.7%) ended due to "Agent Phone Disconnected"
- Suggests infrastructure or telephony reliability issues

**Recommendation**: Review telephony system logs, consider redundancy/failover improvements.

### 4. No Transfer Tracking

- `transferIndicatorId = 0` for all 1,000 calls (no transfers recorded)
- Yet **H14 hypothesis** suggests transfers to local branches are common

**Data Gap**: If transfers are happening, they're not being tracked in this dataset. Need to:
- Validate if transfers occur and why they're not recorded
- Check if transfers show up in separate table/system

---

## Integration with HLES Conversion Analysis

### Direct Linking: NOT POSSIBLE

**Missing Join Keys**:
- No `confirmation_number` in call data
- No `reservation_id` or `KNUM`
- `toAddr` (phone number) not present in HLES tables

**Workaround**: Temporal-geographic triangulation (correlate patterns, not individual records)

### Indirect Analysis Approaches

#### 1. Aggregate Call Quality Benchmarking

Compare call quality metrics for the Nov 1-7 period against HLES conversion rates for the same period:

```python
# Example approach
# HLES: Overall conversion rate Nov 1-7
hles_nov_conversion = hles_data[
    (hles_data['initial_date'] >= '2025-11-01') &
    (hles_data['initial_date'] <= '2025-11-07')
]['RENT_IND'].mean()

# Calls: % positive quality signals
calls_positive_pct = (calls_data['call_quality_proxy'] == 'Positive Signal').mean()

# Correlation check: Does call quality align with conversion performance?
```

#### 2. Hypothesis Validation (Indirect)

| Hypothesis | Call Data Support | Approach |
|------------|-------------------|----------|
| **H14**: Call transfers fail | `transferIndicatorId` all 0 - transfers not tracked | Data gap identified - need to investigate |
| **H15**: Spam flagging reduces contact | Can't directly test, but early customer hang-ups might suggest | Monitor hour-by-hour patterns |
| **H4**: Counter vs HRD effectiveness | This IS HRD data - can benchmark HRD quality | Compare HRD call quality to Counter conversion rates in HLES |

#### 3. Qualitative Insights for Interviews

Use call patterns to inform stakeholder interviews:
- "We see agents vary 4.6x in completion rates - what training differences exist?"
- "Hour 13 has 54% customer hang-ups - what happens at 1pm? Shift change? Lunch break?"
- "93 customers received 2+ calls, one got 63 - what are your call attempt policies?"
- "6.7% of calls have technical disconnects - are you aware of telephony issues?"

---

## Recommended New Hypotheses

Add to `docs/hypotheses.md`:

### H24: HRD agent performance varies significantly and impacts conversion
- **Status**: 🟡 In Progress
- **Hypothesis**: Top-performing agents (high completion rates) contribute to higher overall conversion rates
- **Data needed**: Call transcript agentId, endReason; HLES conversion rates during periods with different agent mixes
- **Test**: Agent performance distribution, correlation with conversion trends
- **Result**: 4.6x variance identified (87% vs 19% completion rates). Need to link to conversion outcomes.

### H25: Multiple call attempts reduce conversion likelihood
- **Status**: 🔴 Not Started
- **Hypothesis**: Customers receiving 3+ calls become frustrated and less likely to convert
- **Data needed**: toAddr call counts, conversion rates (if linkable via phone)
- **Test**: Conversion rate by call attempt count
- **Result**: _pending_. 93 customers received 2+ calls; one received 63 calls. Potential harassment issue.

### H26: Call quality patterns vary by time of day and impact conversion
- **Status**: 🟡 In Progress
- **Hypothesis**: Certain hours have systematically lower call completion rates, reducing conversion
- **Data needed**: contactStart hour, endReason, HLES conversion by contact time
- **Test**: Completion rate by hour; correlate with HLES contact_range conversion
- **Result**: Hour 13 shows 54% customer hang-ups (worst); hours 12, 21-22 show 73-77% agent completion (best). Need to correlate with HLES conversion data.

---

## Actionable Recommendations

### Immediate (Quick Wins)

1. **Implement Call Attempt Limits**
   - Cap at 3 attempts per customer per week
   - Flag customer 8447051298 (63 calls) for review
   - Estimated impact: Reduce wasted agent time, improve customer experience

2. **Agent Training & Best Practice Sharing**
   - Shadow top agents (60923902, 60839761) to document techniques
   - Provide coaching to bottom performers (69105657, 60923901)
   - Estimated impact: Bring bottom quartile agents to median = +20% completion rate

3. **Avoid Hour 13 for Outbound Calls**
   - Shift call volume away from 1pm UTC (lowest completion: 38.5%)
   - Prioritize hours 12, 21-22 (highest completion: 73-77%)
   - Estimated impact: +10-15% completion rate for shifted calls

### Medium-Term (3-6 months)

4. **Fix Disposition Code Recording**
   - `primaryDispositionId` and `secondaryDispositionId` are 100% null
   - Without these, cannot definitively identify successful conversions
   - Enable agents to log call outcomes: "Rental Confirmed", "Customer Declined", "No Answer", etc.
   - Estimated impact: Enable direct conversion analysis, agent accountability

5. **Implement Hold Time Alerts**
   - Alert agents when hold >2 minutes
   - Maximum hold of 10.3 minutes is unacceptable customer experience
   - Estimated impact: Reduce customer frustration, improve conversion

6. **Telephony System Reliability Review**
   - 6.7% technical disconnects suggest infrastructure issues
   - Review call logs, implement failover/redundancy
   - Estimated impact: Recover 67 lost calls (6.7%) from technical failures

### Long-Term (6-12 months)

7. **Enable Call-to-Conversion Linking**
   - Add `confirmation_number` or `reservation_id` to call records when booking confirmed
   - Alternatively, add `phone_number` to HLES data for indirect linking
   - Estimated impact: Enable direct measurement of call effectiveness → conversion

8. **Implement Real-Time Agent Coaching**
   - Use call quality signals to provide live feedback during calls
   - Alert supervisors when agent has <40% completion rate for shift
   - Estimated impact: Continuous improvement culture, reduce performance variance

---

## Data Gaps & Follow-Up Questions

Add to `docs/outstanding_questions.md`:

### Call Recording System

1. **Why are disposition codes not populated?**
   - `primaryDispositionId`, `secondaryDispositionId`, `dispositionNotes` are all 100% null
   - Are agents not using the system? Is it a data export issue?
   - What disposition codes are available? (e.g., "Rental Confirmed", "Customer Declined")

2. **How are transfers tracked?**
   - `transferIndicatorId = 0` for all 1,000 calls
   - H14 suggests transfers to local branches are common, but no transfers recorded here
   - Are transfers happening but not logged? Different system?

3. **Can we link calls to reservations?**
   - No `confirmation_number` or `reservation_id` in call data
   - When a booking is confirmed on a call, is this captured anywhere?
   - Can we add these fields to future call exports?

4. **What is the call attempt policy?**
   - One customer received 63 calls in one week
   - What are the rules on maximum attempts per customer?
   - Are there regulatory compliance concerns with excessive attempts?

5. **Why is customer 8447051298 receiving 63 calls?**
   - Is this a data error (duplicate records)?
   - Is this a VIP customer? A problematic case?
   - What outcome did these 63 calls achieve?

6. **Hour 13 performance drop - what happens at 1pm?**
   - 54% customer hang-ups at hour 13 (1pm UTC)
   - Shift change? Lunch break? Peak customer unavailability?
   - Can we adjust staffing or call scheduling?

### Future Data Requests

1. **Phone number field in HLES data**
   - Would enable indirect linking via `toAddr` in call data
   - Customer phone is likely captured at reservation creation

2. **Call transcripts or recordings**
   - Current data only has metadata (duration, end reason)
   - Actual transcript text would enable qualitative analysis:
     - Common objections
     - Effective vs ineffective agent language
     - Customer confusion points

3. **Full call center data (beyond Nov 1-7)**
   - 1,000 calls over 1 week is a small sample
   - Need 3-6 months of data for robust analysis

4. **Counter contact center data**
   - This dataset is HRD only (centralized outbound)
   - Need Counter (local branch) call data for H4 comparison

---

## Next Steps

1. ✅ **Document findings** (this file)
2. ✅ **Update project documentation** (CLAUDE.md, hypotheses.md, outstanding_questions.md)
3. 🔲 **Request full call dataset** (Nov 2024 - Jan 2025 if available)
4. 🔲 **Request disposition code enablement** (critical for conversion tracking)
5. 🔲 **Create call quality analysis notebook** (`notebooks/04_call_quality_analysis.ipynb`)
6. 🔲 **Prepare stakeholder interview questions** based on call data findings
7. 🔲 **Attempt temporal triangulation** with HLES conversion data (Nov 1-7 period)

---

**Analysis by**: Claude Code (Data Profiling Agent)
**Date**: January 5, 2026
