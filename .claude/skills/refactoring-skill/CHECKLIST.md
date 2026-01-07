# Skill Refactoring Validation Checklist

Use this checklist to validate a refactored skill. Complete all items before considering the refactoring done.

## Pre-Refactoring Analysis

- [ ] **Measured original SKILL.md size**: _____ lines
- [ ] **Identified code blocks**: _____ lines of code
- [ ] **Identified output examples**: _____ lines
- [ ] **Identified business rules**: _____ lines
- [ ] **Identified integration docs**: _____ lines
- [ ] **Total extractable content**: _____ lines
- [ ] **Target refactored size**: ≤200 lines (aim for 80-120)

## File Structure

### SKILL.md
- [ ] File exists at `.claude/skills/[skill-name]/SKILL.md`
- [ ] YAML frontmatter present with `name` and `description`
- [ ] Description is third-person and includes WHAT and WHEN
- [ ] Has "When to Use" section with 3-5 scenarios
- [ ] Has "When NOT to Use" section with exclusions
- [ ] Has "What It Does" section (high-level only)
- [ ] Has "How It Works" section with execution instruction
- [ ] Includes **"Do NOT re-implement logic inline"** warning
- [ ] Has "How to Run" section with script examples
- [ ] Has "References" section linking to all reference files
- [ ] Has "Used By" section listing consumers
- [ ] All reference file links are valid (use `./FILENAME.md`)
- [ ] **Line count ≤200** (run `wc -l SKILL.md`)
- [ ] **Target achieved**: ≤120 lines preferred

### scripts/run_[skill_name].py
- [ ] File exists at `scripts/run_[skill_name].py`
- [ ] Has shebang: `#!/usr/bin/env python3`
- [ ] Has module docstring with usage
- [ ] All code extracted from original SKILL.md
- [ ] Has `main()` function with CLI interface
- [ ] Uses `argparse` for argument parsing
- [ ] Has `if __name__ == '__main__':` guard
- [ ] Includes proper imports
- [ ] Has error handling for invalid inputs
- [ ] Script is executable: `chmod +x scripts/run_[skill_name].py`
- [ ] `--help` flag works and shows usage

### VALIDATIONS.md (if applicable)
- [ ] File exists at `.claude/skills/[skill-name]/VALIDATIONS.md`
- [ ] Contains threshold definitions
- [ ] Contains severity level definitions
- [ ] Contains default business rules
- [ ] Contains domain-specific validations
- [ ] Includes custom validation schema (if applicable)
- [ ] Shows integration with scripts
- [ ] No code blocks (only schemas and examples)
- [ ] Size: 60-300 lines

### OUTPUT.md (if applicable)
- [ ] File exists at `.claude/skills/[skill-name]/OUTPUT.md`
- [ ] Documents markdown output format
- [ ] Documents JSON output format (if applicable)
- [ ] Includes complete schema
- [ ] Shows example outputs
- [ ] Documents status values and meanings
- [ ] Explains all output fields
- [ ] Shows usage examples (how to generate output)
- [ ] Size: 80-300 lines

### REFERENCES.md (if applicable)
- [ ] File exists at `.claude/skills/[skill-name]/REFERENCES.md`
- [ ] Lists all calling agents/skills ("Called By")
- [ ] Lists all dependencies ("Calls / Dependencies")
- [ ] Documents output contract for consumers
- [ ] Shows integration patterns with examples
- [ ] Includes runtime dependencies
- [ ] Notes backward compatibility
- [ ] Size: 40-200 lines

### EXAMPLES.md (optional)
- [ ] File exists (if needed for complex skills)
- [ ] Shows common usage patterns
- [ ] Includes edge case examples
- [ ] Demonstrates CLI usage with real scenarios
- [ ] Size: 50-300 lines

## Content Extraction Validation

### Code Extraction
- [ ] **All Python/SQL/JS code removed** from SKILL.md
- [ ] Code moved to `scripts/run_[skill_name].py`
- [ ] All functions preserved (no functionality lost)
- [ ] Function signatures unchanged (backward compatible)
- [ ] No code blocks in SKILL.md (except CLI examples)

### Rules/Thresholds Extraction
- [ ] All numeric thresholds moved to VALIDATIONS.md
- [ ] All severity levels moved to VALIDATIONS.md
- [ ] All business rules moved to VALIDATIONS.md
- [ ] Default validation schemas documented
- [ ] Custom validation schemas documented

### Output Examples Extraction
- [ ] All output examples moved to OUTPUT.md
- [ ] All format specifications moved to OUTPUT.md
- [ ] All schema definitions moved to OUTPUT.md
- [ ] Status value definitions moved to OUTPUT.md

### Integration Docs Extraction
- [ ] Integration patterns moved to REFERENCES.md
- [ ] Dependency lists moved to REFERENCES.md
- [ ] Output contract moved to REFERENCES.md
- [ ] Usage examples moved to REFERENCES.md or EXAMPLES.md

## Language and Tone

### SKILL.md Language
- [ ] Uses execution-first language
- [ ] Says "Execute `scripts/run_[skill].py`" not "Use the following code"
- [ ] Says "Do NOT re-implement" explicitly
- [ ] References are one level deep (no nested links)
- [ ] High-level conceptual steps only
- [ ] No implementation details

### Reference Files
- [ ] Single purpose per file
- [ ] No cross-references between reference files
- [ ] All link back to SKILL.md only
- [ ] Clear section headers
- [ ] Scannable structure (tables, bullet lists)

## Testing and Validation

### Script Functionality
- [ ] Script runs: `python scripts/run_[skill_name].py --help`
- [ ] Help text is clear and complete
- [ ] All arguments work as documented
- [ ] Script accepts expected inputs
- [ ] Script produces expected outputs
- [ ] Error handling works (try invalid inputs)
- [ ] Exit codes are appropriate (0=success, 1=issues, 2=error)

### Functional Testing
- [ ] Tested with real data
- [ ] Output format matches OUTPUT.md spec
- [ ] Validation rules match VALIDATIONS.md
- [ ] Results match original skill behavior
- [ ] No regressions introduced
- [ ] Backward compatibility maintained

### Integration Testing
- [ ] Tested with calling agents (if applicable)
- [ ] Tested with downstream skills (if applicable)
- [ ] Output contract unchanged
- [ ] Integration patterns still work

## Size Metrics

### Before and After
| Metric | Before | After | Reduction |
|--------|--------|-------|-----------|
| SKILL.md lines | _____ | _____ | _____% |
| Code lines | _____ | 0 | 100% |
| Example lines | _____ | 0 | 100% |
| Rules lines | _____ | 0 | 100% |

### Target Achievement
- [ ] SKILL.md reduced by ≥60%
- [ ] SKILL.md ≤200 lines (required)
- [ ] SKILL.md ≤120 lines (preferred)
- [ ] Estimated token savings ≥70%

## Quality Standards

### YAML Frontmatter
- [ ] Name follows convention: lowercase, hyphen-separated, gerund form
- [ ] Description is complete (WHAT + WHEN)
- [ ] Description ≤200 characters

### Section Structure
- [ ] All required sections present
- [ ] Sections in correct order
- [ ] No prohibited content in SKILL.md
- [ ] Clear separation of concerns

### Documentation Quality
- [ ] All links are valid
- [ ] All examples work
- [ ] No typos or errors
- [ ] Consistent formatting
- [ ] Clear and concise writing

### Script Quality
- [ ] Follows PEP 8 (for Python)
- [ ] Has type hints (Python 3.7+)
- [ ] Has docstrings for public functions
- [ ] Error messages are helpful
- [ ] Code is maintainable

## Common Issues Checklist

### Did you avoid these mistakes?
- [ ] ❌ Left code blocks in SKILL.md
- [ ] ❌ Included output examples in SKILL.md
- [ ] ❌ Listed thresholds/rules in SKILL.md
- [ ] ❌ Used implementation language ("Apply this logic...")
- [ ] ❌ Forgot execution-first instruction
- [ ] ❌ Created nested reference links
- [ ] ❌ Made "When to Use" too abstract
- [ ] ❌ Omitted "When NOT to Use"
- [ ] ❌ Forgot to test the script
- [ ] ❌ Changed function behavior (broke backward compatibility)

## Final Sign-Off

- [ ] All checklist items completed
- [ ] Refactoring meets all quality standards
- [ ] Skill is ready for use
- [ ] Documentation is complete
- [ ] Testing is complete

**Refactored by**: _____________
**Date**: _____________
**Original size**: _____ lines
**Refactored size**: _____ lines
**Reduction**: _____%

## Notes

[Add any additional notes, issues encountered, or special considerations]
