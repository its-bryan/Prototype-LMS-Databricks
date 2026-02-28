---
name: pm-peer-review
description: Verification pass on review findings. Routes to @reviewer to validate each finding against the actual code. Run after pm-review or after receiving human/external feedback.
---

# Peer Review — Verification

**Routes to: @reviewer**

Critically evaluate review findings. Don't accept findings at face value — check the actual code.

## When to Use

- After `pm-review` — verify synthesised findings before creating Linear tickets
- After human peer review — validate external feedback before acting
- Any time you have findings that need verification

## Steps

### 1. Get the Findings
- From `pm-review` output, or
- From pasted human/external feedback

### 2. Verify Each Finding
For EACH finding:
1. **Read the actual code** at the referenced file and line.
2. **Does this issue really exist?** Check against `.cursor/rules/reviewer.md` checklist.
3. If **no** — explain why it's invalid (false positive, already fixed, misunderstood).
4. If **yes** — confirm severity and include in action plan.

### 3. Output

#### Confirmed Findings (Valid)
- [Finding 1] — severity, recommended fix
- [Finding 2] — ...

#### Invalid Findings (with explanations)
- [Finding X] — Why: [already fixed / false positive / misread]
- [Finding Y] — Why: [...]

#### Prioritised Action Plan
1. [First fix — highest impact]
2. [Second fix]
3. ...

#### Linear
For each confirmed finding: Create issue in Linear with `team: "HER"`, in Backlog. Break complex ones into sub-issues with `parentId`.

## Key Principle

Be sceptical. Only create tickets for findings that survive verification against the actual code.
