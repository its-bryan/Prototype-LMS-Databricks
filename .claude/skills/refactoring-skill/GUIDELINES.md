# Skill Refactoring Guidelines

This document defines best practices for refactoring Claude skills following Anthropic's recommendations.

## Core Principles

### 1. SKILL.md is a Routing Surface, Not an Implementation

**Target**: ≤200 lines (aim for 80-120 lines)

SKILL.md should be:
- A decision/routing file that tells Claude WHEN and HOW to use the skill
- Lightweight and fast to load
- Focused on usage patterns and integration

SKILL.md should NOT be:
- A code repository
- A documentation dump
- An implementation guide

### 2. Progressive Disclosure

Heavy content must live in separate files, one level deep:
- VALIDATIONS.md - Business rules, thresholds, domain-specific logic
- OUTPUT.md - Output format specifications and examples
- REFERENCES.md - Integration documentation, dependencies
- EXAMPLES.md - Usage examples and edge cases

**Rule**: Never reference a reference file from another reference file (keep flat)

### 3. Executable > Readable

All runnable logic must live in `/scripts/`:
- Extract Python/SQL/JS code from SKILL.md
- Create executable scripts with CLI interfaces
- SKILL.md instructs Claude to execute scripts, not re-implement

**Format**: `scripts/run_<skill_name>.py`

### 4. Deterministic Naming

- Skill names: lowercase, hyphen-separated, gerund form
  - Examples: `checking-quality`, `validating-joins`, `describing-data`
- Script names: `run_<skill_name>.py`
- Reference files: `UPPERCASE.md`

## Refactoring Workflow

### Phase 1: Analyze Current Skill

1. **Measure size**: Count lines in SKILL.md
2. **Identify components**:
   - YAML frontmatter
   - Usage documentation
   - Code blocks (Python, SQL, etc.)
   - Output examples
   - Integration notes
   - Business rules and thresholds
3. **Calculate extraction**:
   - How many lines of code?
   - How many lines of examples?
   - How many lines of rules/thresholds?

### Phase 2: Extract Content

#### Extract to Scripts

Move to `scripts/run_<skill_name>.py`:
- All function definitions
- All executable code
- CLI interface (argparse)
- Input/output formatting logic

**Template**:
```python
#!/usr/bin/env python3
"""
<Skill Name>

<Brief description>

Usage:
    python scripts/run_<skill>.py <args>
"""

import argparse
import sys

# Functions extracted from SKILL.md
def function_1():
    pass

def function_2():
    pass

# CLI interface
def main():
    parser = argparse.ArgumentParser(description='...')
    parser.add_argument('input', help='...')
    args = parser.parse_args()

    # Execute
    result = function_1(args.input)
    print(result)

if __name__ == '__main__':
    main()
```

#### Extract to VALIDATIONS.md

Move business rules, thresholds, and domain-specific logic:
- Threshold definitions (numeric values, percentages)
- Severity levels
- Default validation rules
- Domain-specific business logic
- Custom validation schemas

**Structure**:
```markdown
# Validation Rules for <Skill>

## Threshold Definitions
[Tables of thresholds]

## Default Validations
[Domain-specific rules]

## Custom Validation Schema
[How to provide custom rules]
```

#### Extract to OUTPUT.md

Move output format specifications:
- Output schema (JSON/dict structure)
- Markdown format templates
- Table structures
- Example outputs
- Status values and meanings

**Structure**:
```markdown
# Output Format for <Skill>

## Markdown Output Format
[Templates and examples]

## JSON Output Format
[Schema and examples]

## Status Values
[Definitions]
```

#### Extract to REFERENCES.md

Move integration documentation:
- Which agents/skills call this skill
- Which agents/skills this skill calls
- Output contract for consumers
- Integration patterns and examples
- Dependencies

**Structure**:
```markdown
# Integration & References for <Skill>

## Called By
[List of consumers]

## Calls / Dependencies
[List of dependencies]

## Output Contract
[Schema for downstream consumers]

## Integration Patterns
[Examples of usage]
```

### Phase 3: Rewrite SKILL.md

Create a minimal routing file with this structure:

```markdown
---
name: skill-name
description: [3rd person, includes when to use]
---

# skill-name

[One-line description]

## When to Use

Use this skill when:
- [Scenario 1]
- [Scenario 2]
- User asks: "[Example question]"

## When NOT to Use

Do not use when:
- [Exclusion 1]
- [Exclusion 2]

## What It Does

[High-level bullet list - no technical detail]
- [Feature 1]
- [Feature 2]

## How It Works

**IMPORTANT**: This skill executes `scripts/run_<skill>.py`. Do NOT re-implement logic inline.

1. [Step 1]
2. [Step 2]
3. [See VALIDATIONS.md for rules]
4. [See OUTPUT.md for format]

## How to Run

### Execute the Script

```bash
python scripts/run_<skill>.py <args>
```

### Arguments

- `arg1` - Description
- `--option` - Description

## References

- **[VALIDATIONS.md](./VALIDATIONS.md)** - Rules and thresholds
- **[OUTPUT.md](./OUTPUT.md)** - Output specifications
- **[REFERENCES.md](./REFERENCES.md)** - Integration docs

## Used By

- [Agent/skill 1]
- [Agent/skill 2]
```

### Phase 4: Validate

1. **Line count**: `wc -l SKILL.md` should be ≤200 (aim for ≤120)
2. **Script works**: `python scripts/run_<skill>.py --help`
3. **Functional test**: Run script with real data
4. **Links work**: All reference file links are valid
5. **No regressions**: Skill behavior unchanged

## Common Patterns

### Pattern 1: Code-Heavy Skills

**Before**: 300+ lines with embedded functions
**After**:
- SKILL.md: ~80 lines
- scripts/run_skill.py: All code
- No other references needed

### Pattern 2: Rule-Heavy Skills

**Before**: 250 lines with business rules and code
**After**:
- SKILL.md: ~90 lines
- VALIDATIONS.md: All rules and thresholds
- scripts/run_skill.py: All code
- OUTPUT.md: Format specs

### Pattern 3: Integration-Heavy Skills

**Before**: 280 lines with code and integration docs
**After**:
- SKILL.md: ~100 lines
- scripts/run_skill.py: All code
- REFERENCES.md: All integration patterns
- OUTPUT.md: Output contract

## Prohibited in SKILL.md

Never include in SKILL.md:
- ❌ Python/SQL/JS code blocks (except tiny examples)
- ❌ Complete function definitions
- ❌ Output samples (move to OUTPUT.md)
- ❌ Business rules and thresholds (move to VALIDATIONS.md)
- ❌ Large tables
- ❌ Integration patterns (move to REFERENCES.md)
- ❌ Phrases like "Use the following code..."

## Required in SKILL.md

Always include:
- ✅ YAML frontmatter with name and description
- ✅ "When to Use" section with scenarios
- ✅ "When NOT to Use" section with exclusions
- ✅ "How It Works" with script execution instruction
- ✅ Links to reference files
- ✅ "Used By" section

## Execution-First Language

Replace:
- ❌ "Use the following code..."
- ❌ "Apply this logic..."
- ❌ "Implement the function..."

With:
- ✅ "Execute `scripts/run_<skill>.py`"
- ✅ "Do NOT re-implement logic inline"
- ✅ "Run the script with..."

## File Size Targets

| File | Target Lines | Max Lines | Purpose |
|------|--------------|-----------|---------|
| SKILL.md | 80-120 | 200 | Routing/decision |
| scripts/run_*.py | Any | No limit | Implementation |
| VALIDATIONS.md | 60-150 | 300 | Business rules |
| OUTPUT.md | 80-200 | 300 | Format specs |
| REFERENCES.md | 40-100 | 200 | Integration |
| EXAMPLES.md | 50-150 | 300 | Usage examples |

## Quality Checklist

After refactoring, verify:

- [ ] SKILL.md ≤ 200 lines (ideally ≤120)
- [ ] All code extracted to scripts/
- [ ] Script has CLI interface
- [ ] Script is executable and tested
- [ ] Reference files are flat (one level deep)
- [ ] SKILL.md uses execution-first language
- [ ] All links in SKILL.md are valid
- [ ] YAML frontmatter is correct
- [ ] "When to Use" and "When NOT to Use" sections exist
- [ ] No functionality lost (backward compatible)

## Benefits of Refactoring

1. **Token Efficiency**: ~70-80% reduction in tokens during skill selection
2. **Maintainability**: Logic in one place (scripts), docs in another
3. **Reusability**: Scripts can be imported or run standalone
4. **Clarity**: Clear separation of routing vs implementation
5. **Performance**: Faster skill loading and selection
