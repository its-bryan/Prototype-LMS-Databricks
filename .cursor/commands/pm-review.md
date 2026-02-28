---
name: pm-review
description: Comprehensive code review using the Reviewer agent's Hertz-specific checklist. Run after completing a chunk of work — a screen, a feature, a refactor.
---

# Code Review

**Routes to: @reviewer**

Perform comprehensive code review using the checklist in `.cursor/rules/reviewer.md`.

## Steps

### 1. Gather Context
- Identify code to review: git diff (staged + unstaged), user-selected files, or recently changed files.
- Read `.cursor/rules/reviewer.md` — the full review checklist covering:
  - Terminology compliance (Comments not Enrichment, Zone not Region)
  - Brand compliance (correct Hertz colours, no hardcoded values)
  - Data flow & architecture (selectors, no direct mock data imports)
  - Lead logic correctness (priority sort, mismatch detection, status rules)
  - UX & edge states (empty states, smart defaults, 60-second form test)
  - React & hooks (dependencies, keys, cleanup)
  - Production readiness (console logs, TODOs, build success)
  - Stakeholder feedback regression check (David's requirements)

### 2. Review
Run through every category in the checklist against the changed files. Be thorough — flag things that matter, not style preferences.

### 3. Output

#### ✅ Looks Good
- [What passed]

#### ⚠️ Issues Found
- **[🔴/🟡]** [File:line] — [Issue description]
  - Fix: [Suggested fix]

#### 📊 Summary
- Files reviewed: X
- Critical: X | Warning: X | Passed: X

### 4. Linear (for critical/high findings)
For each confirmed critical finding: Create issue in Linear with `team: "HER"`, in Backlog. Break complex ones into sub-issues with `parentId`. If unavailable, output linear.new URL.

## Severity Guide

- 🔴 **Critical** — Terminology violation, brand colour violation, broken lead logic, data flow violation, build failure. Must fix.
- 🟡 **Warning** — Missing edge state, accessibility gap, performance concern, minor inconsistency. Should fix.
