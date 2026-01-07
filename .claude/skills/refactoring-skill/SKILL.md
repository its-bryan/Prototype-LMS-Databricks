---
name: refactoring-skill
description: Refactors Claude skills to follow Anthropic best practices (execution-first, ≤200 lines, progressive disclosure). Use when a skill is too long, has embedded code, or needs restructuring to reduce token usage.
---

# refactoring-skill

Refactor Claude skills to follow Anthropic best practices for token efficiency and maintainability.

## When to Use

Use this skill when:
- A SKILL.md file exceeds 200 lines
- SKILL.md contains embedded code blocks (Python, SQL, JavaScript)
- SKILL.md has lengthy output examples or business rules
- Token usage during skill selection is too high
- User asks: "Refactor this skill"
- User asks: "How do I make this skill follow best practices?"
- Starting a batch refactoring of multiple skills

## When NOT to Use

Do not use when:
- SKILL.md is already ≤200 lines and well-structured
- Skill has no extractable code or content
- User wants to create a new skill (not refactor existing)
- User wants to modify skill functionality (not structure)

## What It Does

This skill guides refactoring of existing skills to achieve:
- **Token reduction** - 70-80% fewer tokens during skill selection
- **Execution-first design** - Code in scripts, not SKILL.md
- **Progressive disclosure** - Heavy content in separate reference files
- **Clear structure** - Routing logic separated from implementation
- **Maintainability** - Single source of truth for code and rules

## How It Works

**IMPORTANT**: This skill provides guidance and templates. The actual refactoring is done manually or with script assistance.

1. Analyze current skill structure and measure sizes
2. Extract code to `scripts/run_[skill_name].py` with CLI interface
3. Extract business rules/thresholds to `VALIDATIONS.md`
4. Extract output formats to `OUTPUT.md`
5. Extract integration docs to `REFERENCES.md`
6. Rewrite `SKILL.md` as lightweight routing file (≤200 lines)
7. Validate using checklist (see [CHECKLIST.md](./CHECKLIST.md))

## Refactoring Process

### Step 1: Analyze
```bash
# Count lines in current SKILL.md
wc -l .claude/skills/[skill-name]/SKILL.md

# Identify extractable content:
# - Code blocks (Python, SQL, JS)
# - Output examples
# - Business rules and thresholds
# - Integration documentation
```

### Step 2: Extract Content

Follow [GUIDELINES.md](./GUIDELINES.md) for extraction rules:
- **Code** → `scripts/run_[skill_name].py`
- **Rules/Thresholds** → `VALIDATIONS.md`
- **Output Formats** → `OUTPUT.md`
- **Integration Docs** → `REFERENCES.md`

### Step 3: Rewrite SKILL.md

Use [TEMPLATE.md](./TEMPLATE.md) as starting point:
- YAML frontmatter
- When to Use / When NOT to Use
- What It Does (high-level)
- How It Works (execution instruction)
- How to Run (script examples)
- References (links to extracted files)
- Used By (consumers)

### Step 4: Create Executable Script

```bash
# Create script with CLI interface
touch scripts/run_[skill_name].py
chmod +x scripts/run_[skill_name].py
```

Script should:
- Accept CLI arguments (argparse)
- Execute extracted functions
- Format output (markdown or JSON)
- Handle errors gracefully

### Step 5: Validate

Use [CHECKLIST.md](./CHECKLIST.md) to verify:
- SKILL.md ≤200 lines
- Script works (`--help` and functional tests)
- All links valid
- No functionality lost
- Backward compatible

## Target Metrics

| Metric | Target | Maximum |
|--------|--------|---------|
| SKILL.md lines | 80-120 | 200 |
| Token reduction | ≥70% | N/A |
| Code in SKILL.md | 0 lines | 10 lines (tiny examples only) |
| Reference depth | 1 level | 1 level (flat) |

## Refactoring Patterns

### Pattern 1: Code-Heavy Skill
- **Before**: 300+ lines, embedded functions
- **After**: ~80-line SKILL.md + executable script

### Pattern 2: Rule-Heavy Skill
- **Before**: 250 lines, business rules and code
- **After**: ~90-line SKILL.md + VALIDATIONS.md + script

### Pattern 3: Integration-Heavy Skill
- **Before**: 280 lines, code and integration docs
- **After**: ~100-line SKILL.md + REFERENCES.md + OUTPUT.md + script

## References

- **[GUIDELINES.md](./GUIDELINES.md)** - Complete refactoring best practices and principles
- **[TEMPLATE.md](./TEMPLATE.md)** - SKILL.md template for refactored skills
- **[CHECKLIST.md](./CHECKLIST.md)** - Validation checklist for quality assurance

## Example Refactorings

### checking-quality
- **Before**: 322 lines (code, examples, rules)
- **After**: 89 lines (72% reduction)
- **Extracted**:
  - `scripts/run_checking_quality.py` (460 lines)
  - `VALIDATIONS.md` (140 lines)
  - `OUTPUT.md` (260 lines)
  - `REFERENCES.md` (180 lines)

## Used By

- Skill developers refactoring existing skills
- Project maintainers optimizing token usage
- Can be used as reference for creating new skills

## Best Practices

1. **Start with analysis** - Measure before refactoring
2. **Extract incrementally** - One file type at a time
3. **Test continuously** - Validate after each extraction
4. **Maintain compatibility** - Don't break existing integrations
5. **Follow checklist** - Use CHECKLIST.md for quality
6. **Document changes** - Note what was moved where

## Common Pitfalls

Avoid these mistakes:
- Changing function behavior during refactoring
- Forgetting "Do NOT re-implement" warning in SKILL.md
- Creating nested reference links (keep flat)
- Leaving code blocks in SKILL.md
- Skipping validation steps
- Breaking backward compatibility
