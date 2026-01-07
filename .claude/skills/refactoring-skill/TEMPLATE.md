# SKILL.md Template for Refactored Skills

Use this template when creating a refactored SKILL.md file.

---

```markdown
---
name: [skill-name]
description: [Third-person description that includes: (1) what the skill does, (2) when it should be used. Example: "Identifies data quality issues including nulls, outliers, invalid values, and duplicates. Use when profiling data, investigating data problems, or when the user asks about data quality."]
---

# [skill-name]

[One-line description of what the skill does]

## When to Use

Use this skill when:
- [Specific scenario 1]
- [Specific scenario 2]
- [Specific scenario 3]
- User asks: "[Example question 1]"
- User asks: "[Example question 2]"

## When NOT to Use

Do not use when:
- [Exclusion scenario 1] (use `[other-skill]` instead)
- [Exclusion scenario 2] (use `[other-skill]` instead)
- [Exclusion scenario 3]

## What It Does

This skill [high-level description of functionality]:
- **[Feature 1]** - Brief description
- **[Feature 2]** - Brief description
- **[Feature 3]** - Brief description
- **[Feature 4]** - Brief description

## How It Works

**IMPORTANT**: This skill executes `scripts/run_[skill_name].py`. Do NOT re-implement the logic inline.

1. [High-level step 1]
2. [High-level step 2] (see [VALIDATIONS.md](./VALIDATIONS.md) for [details])
3. [High-level step 3] (see [OUTPUT.md](./OUTPUT.md) for [details])
4. [High-level step 4]

## [Optional Section: Quick Reference Table]

[If the skill has multiple check types, validation types, or categories, include a quick reference table]

| Category | Description | Details |
|----------|-------------|---------|
| [Item 1] | [Brief description] | See [VALIDATIONS.md](./VALIDATIONS.md#section) |
| [Item 2] | [Brief description] | See [VALIDATIONS.md](./VALIDATIONS.md#section) |
| [Item 3] | [Brief description] | See [VALIDATIONS.md](./VALIDATIONS.md#section) |

## How to Run

### Execute the Script

```bash
# Basic usage
python scripts/run_[skill_name].py <required_arg>

# With options
python scripts/run_[skill_name].py <arg> --option1 value1
python scripts/run_[skill_name].py <arg> --option2 value2 --output file.ext
```

### Arguments

- `required_arg` - Description of required argument
- `--option1` - Description of optional argument 1
- `--option2` - Description of optional argument 2
- `--format` - Output format: `markdown` (default) or `json`
- `--output` - Save output to file instead of stdout

## References

- **[VALIDATIONS.md](./VALIDATIONS.md)** - [What's in this file, e.g., "Thresholds, severity levels, and business rules"]
- **[OUTPUT.md](./OUTPUT.md)** - [What's in this file, e.g., "Report format specifications and examples"]
- **[REFERENCES.md](./REFERENCES.md)** - [What's in this file, e.g., "Integration with other skills and agents"]
- **[EXAMPLES.md](./EXAMPLES.md)** - [Optional: "Common usage patterns and edge cases"]

## Used By

- **[agent-name]** agent - [How it uses this skill]
- **[skill-name]** skill - [How it uses this skill]
- Can be called directly for [standalone use case]
```

---

## Template Usage Notes

### YAML Frontmatter
- `name`: lowercase, hyphen-separated, gerund form (e.g., `checking-quality`, `validating-joins`)
- `description`: Third-person, includes WHAT and WHEN. Keep under 200 characters.

### When to Use Section
- List 3-5 specific scenarios
- Include 2-3 example user questions
- Be concrete, not abstract

### When NOT to Use Section
- List 2-4 exclusion scenarios
- Reference alternative skills where applicable
- Prevents misuse and guides correct skill selection

### What It Does Section
- High-level bullet list only
- No technical implementation details
- No thresholds or specific values (those go in VALIDATIONS.md)
- Use bold for feature names

### How It Works Section
- **Critical**: Must include execution instruction
- 2-4 conceptual steps maximum
- Link to reference files for details
- No code, no algorithms

### Quick Reference Table (Optional)
- Only if skill has multiple categories/types
- Keep descriptions brief
- Link to VALIDATIONS.md for details
- Examples: quality checks, validation types, analysis methods

### How to Run Section
- **Always** show script execution examples
- Include basic usage + 2-3 common options
- Explain each argument clearly
- Show both stdout and file output options

### References Section
- Link to ALL reference files
- Describe what's in each file (helps with discovery)
- Always use relative links: `./FILENAME.md`
- List in order: VALIDATIONS → OUTPUT → REFERENCES → EXAMPLES

### Used By Section
- List consuming agents and skills
- Explain how they use this skill
- Include standalone usage note if applicable

## Size Guidelines

Target: 80-120 lines
Maximum: 200 lines

If approaching 200 lines:
- Move Quick Reference Table details to VALIDATIONS.md
- Shorten How to Run examples
- Move integration examples to REFERENCES.md

## Common Mistakes to Avoid

1. ❌ Including code blocks (except CLI examples)
2. ❌ Listing specific threshold values (use VALIDATIONS.md)
3. ❌ Showing output examples (use OUTPUT.md)
4. ❌ Explaining integration patterns (use REFERENCES.md)
5. ❌ Using implementation-focused language ("Apply this logic...")
6. ❌ Omitting "Do NOT re-implement" warning
7. ❌ Forgetting to link reference files
8. ❌ Making "When to Use" section too abstract

## Good Examples

See these refactored skills:
- `checking-quality` - Code-heavy skill with validations
- [Add more as you refactor]
