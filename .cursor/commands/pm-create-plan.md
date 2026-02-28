---
name: pm-create-plan
description: Creates a phased implementation plan from the exploration. Routes to the Architect agent to produce execution prompts for the Engineer and Designer agents.
---

# Plan Creation

**Routes to: @architect**

Based on our exploration exchange, produce an implementation plan.

## Plan Requirements

- Clear, minimal, concise steps.
- Each step specifies which agent executes it: **@engineer**, **@designer**, or both.
- Steps are modular and integrate seamlessly with the existing codebase.
- Do NOT add scope or complexity beyond what was explicitly clarified.
- Track status with emojis: 🟩 Done | 🟨 In Progress | 🟥 To Do

## Plan Template

```markdown
# Feature Implementation Plan

**Overall Progress:** `0%`

## TLDR
Short summary of what we're building and why.

## Critical Decisions
Key choices made during exploration:
- Decision 1: [choice] — [brief rationale]
- Decision 2: [choice] — [brief rationale]

## Tasks

- [ ] 🟥 **Step 1: [Name]** → @engineer / @designer
  - [ ] 🟥 Subtask 1
  - [ ] 🟥 Subtask 2

- [ ] 🟥 **Step 2: [Name]** → @engineer / @designer
  - [ ] 🟥 Subtask 1
  - [ ] 🟥 Subtask 2

## Review Gate
After implementation, run `pm-review` to verify all changes.
```

## Execution Prompts

For each step, write a **ready-to-paste prompt** for the assigned agent. Each prompt must include:
- What to build (specific, not vague)
- Which files to touch
- Acceptance criteria
- Request for a status report on completion

## Linear Ticket

After the plan, create the feature ticket in Linear:
- **Preferred:** Use Linear MCP `create_issue` with `team: "HER"`. Create in **Backlog**.
- For complex features, create sub-issues with `parentId` — each sub-issue maps to a plan step.
- **Fallback:** If Linear MCP is unavailable, output a linear.new URL.

Ticket format:
```
## TL;DR
[One-line summary]

## Current state
[What exists today]

## Expected outcome
[What we want]

## Relevant files
[Files to touch]

## Risk/notes
[If applicable]
```
