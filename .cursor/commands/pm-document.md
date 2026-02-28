---
name: pm-document
description: Updates documentation after code changes. Routes to @engineer since it knows what changed and can verify against the actual implementation.
---

# Update Documentation

**Routes to: @engineer**

Update docs to reflect code changes. Trust the code, not existing documentation.

## Steps

### 1. Identify Changes
- Check git diff or recent commits for modified files.
- Identify which features/modules changed.
- Note new files, deleted files, renamed files.

### 2. Verify Against Actual Code
**CRITICAL:** DO NOT trust existing documentation. Read the actual implementation.

For each changed file:
- Read the current code.
- Understand actual behaviour.
- Note discrepancies with existing docs.

### 3. Update Documentation

- **CHANGELOG.md** — Add entry under "Unreleased":
  - Categories: Added, Changed, Fixed, Security, Removed
  - Concise, user-facing language

- **`.cursor/rules/project.md`** — Update if any of these changed:
  - File structure
  - Mock data schema
  - Screen specs or component names
  - Navigation or view registry

- **Component/selector comments** — Update inline docs if function signatures or behaviour changed.

### 4. Style Rules

✅ Concise — brevity over grammar
✅ Practical — examples over theory
✅ Accurate — verified against code, not assumed
✅ Current — matches actual implementation

❌ No assumptions without verification
❌ No outdated information left in place

### 5. Ask if Uncertain

If you're unsure about intent or user-facing impact, **ask** — don't guess.
