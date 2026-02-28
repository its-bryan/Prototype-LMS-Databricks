---
name: pm-create-issues
description: Quick issue capture mid-development. Creates a Linear ticket fast so you can keep working. Can be invoked from any agent context.
---

# Create Issue

You're mid-development and thought of a bug/feature/improvement. Capture it fast.

## Goal

Create a complete issue with:
- Clear title
- TL;DR
- Current state vs expected outcome
- Relevant files (max 3, most relevant only)
- Risk/notes if applicable
- Type/priority/effort labels
- **Create in Linear** — Use Linear MCP `create_issue` with `team: "HER"`. Create in **Backlog**.
- **Break down complex issues** — Create sub-issues with `parentId`. Each sub-issue = one discrete, implementable unit.
- **Fallback:** If Linear MCP is unavailable, output a linear.new URL.

## How

**Ask questions** to fill gaps — be concise, respect that the user is mid-flow:
- What's the issue/feature?
- Current behaviour vs desired behaviour?
- Type (bug/feature/improvement) and priority if not obvious?

One message with 2–3 targeted questions beats multiple back-and-forths.

**Search for context** only when helpful:
- Grep codebase for relevant files
- Note dependencies or risks you spot

**Skip what's obvious** — If it's a straightforward bug, don't over-research. If type/priority is clear, don't ask.

**Keep it fast** — Under 2 minutes. Capture, create ticket, done.

## Defaults

- Priority: Normal
- Effort: Medium
- Ask only if these clearly don't apply.
