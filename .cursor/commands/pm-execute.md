---
name: pm-execute
description: Implements the plan. Routes to @engineer for code/logic and @designer for UI/UX. Use the execution prompts from pm-create-plan.
---

# Execute Plan

**Routes to: @engineer and/or @designer** (as specified in each plan step)

Implement precisely as planned, in full.

## Implementation Requirements

- Write elegant, minimal, modular code.
- Adhere strictly to existing code patterns and conventions in `.cursor/rules/project.md`.
- Follow brand system in `.cursor/rules/hertz-brand-kit/` for all visual work.
- Use Tailwind tokens — no hardcoded colour values.
- Use selectors (`demoSelectors.js`) — no direct mock data imports.
- Include clear comments in code where intent isn't obvious.

## During Implementation

- Update the plan's tracking emojis and progress percentage as you complete each step.
- **If you discover a bug:** Use Linear MCP `create_issue` with `team: "HER"`, create in **Backlog**. If unavailable, output a linear.new URL.
- **When working on a ticket:** Reference the ticket ID and move to **In Progress** via `mcp_linear_update_issue`. Only mark **Done** after user confirms.

## After Each Step

Provide a brief status report:
- Files changed
- What was done
- Anything that needs attention or deviates from the plan
