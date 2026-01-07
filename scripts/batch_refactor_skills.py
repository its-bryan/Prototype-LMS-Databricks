#!/usr/bin/env python3
"""
Batch Skill Refactoring Script

Automates the refactoring of multiple skills following Anthropic best practices.

Usage:
    python scripts/batch_refactor_skills.py [options]

Options:
    --skills SKILL1 SKILL2 ...  Specific skills to refactor (default: all except checking-quality)
    --dry-run                   Analyze only, don't make changes
    --interactive               Prompt for confirmation before each skill
"""

import argparse
import re
import shutil
import sys
from pathlib import Path
from typing import Dict, List, Tuple

# Import analysis functions from run_refactoring_skill
sys.path.insert(0, str(Path(__file__).parent))
from run_refactoring_skill import (
    analyze_skill,
    extract_code_blocks,
    extract_sections,
    validate_skill_structure,
    generate_analysis_report,
    generate_validation_report,
)


SKILLS_DIR = Path('.claude/skills')
SCRIPTS_DIR = Path('scripts')

# Skills to skip (already refactored or special)
SKIP_SKILLS = {'checking-quality', 'refactoring-skill'}

# Template for refactored SKILL.md
SKILL_TEMPLATE = """---
name: {name}
description: {description}
---

# {name}

{one_line_description}

## When to Use

Use this skill when:
{when_to_use}

## When NOT to Use

Do not use when:
{when_not_to_use}

## What It Does

This skill {what_it_does}

## How It Works

**IMPORTANT**: This skill executes `scripts/run_{script_name}.py`. Do NOT re-implement the logic inline.

{how_it_works}

## How to Run

### Execute the Script

```bash
{cli_examples}
```

### Arguments

{arguments}

## References

{references}

## Used By

{used_by}
"""


def get_all_skills() -> List[str]:
    """Get list of all skills in .claude/skills directory."""
    if not SKILLS_DIR.exists():
        return []

    skills = []
    for skill_dir in SKILLS_DIR.iterdir():
        if skill_dir.is_dir() and (skill_dir / 'SKILL.md').exists():
            skill_name = skill_dir.name
            if skill_name not in SKIP_SKILLS:
                skills.append(skill_name)

    return sorted(skills)


def analyze_all_skills(skills: List[str]) -> Dict[str, Dict]:
    """Analyze all skills and return analysis results."""
    results = {}

    for skill_name in skills:
        skill_path = SKILLS_DIR / skill_name / 'SKILL.md'
        try:
            analysis = analyze_skill(skill_path)
            results[skill_name] = analysis
        except Exception as e:
            results[skill_name] = {'error': str(e)}

    return results


def extract_skill_content(skill_name: str) -> Dict[str, any]:
    """Extract content from a skill for refactoring."""
    skill_path = SKILLS_DIR / skill_name / 'SKILL.md'

    content = skill_path.read_text()

    # Extract YAML frontmatter
    yaml_match = re.search(r'^---\n(.*?)\n---', content, re.DOTALL | re.MULTILINE)
    yaml_content = yaml_match.group(1) if yaml_match else ''

    # Parse name and description from YAML
    name_match = re.search(r'name:\s*(.+)', yaml_content)
    desc_match = re.search(r'description:\s*(.+)', yaml_content)

    name = name_match.group(1).strip() if name_match else skill_name
    description = desc_match.group(1).strip() if desc_match else ''

    # Extract code blocks
    code_blocks = extract_code_blocks(skill_path)

    # Extract sections
    sections = extract_sections(skill_path)

    return {
        'name': name,
        'description': description,
        'yaml_content': yaml_content,
        'code_blocks': code_blocks,
        'sections': sections,
        'original_content': content,
    }


def create_script_file(skill_name: str, code_blocks: List[Tuple[str, str]]) -> Path:
    """Create executable script file from extracted code blocks."""
    script_name = f"run_{skill_name.replace('-', '_')}.py"
    script_path = SCRIPTS_DIR / script_name

    # Filter Python code blocks
    python_code = '\n\n'.join(code for lang, code in code_blocks if lang in ('python', 'py', ''))

    script_content = f'''#!/usr/bin/env python3
"""
{skill_name.replace('-', ' ').title()}

Extracted from .claude/skills/{skill_name}/SKILL.md

Usage:
    python scripts/{script_name} [options]
"""

import argparse
import sys
from pathlib import Path

# ============================================================================
# Core Functions (extracted from SKILL.md)
# ============================================================================

{python_code}


# ============================================================================
# CLI Interface
# ============================================================================

def main():
    """Main CLI interface."""
    parser = argparse.ArgumentParser(
        description='{skill_name.replace("-", " ").title()}',
        formatter_class=argparse.RawDescriptionHelpFormatter
    )

    # TODO: Add arguments based on the skill's requirements
    parser.add_argument('input', help='Input parameter')
    parser.add_argument('--format', choices=['markdown', 'json'], default='markdown',
                       help='Output format')
    parser.add_argument('--output', help='Output file path')

    args = parser.parse_args()

    # TODO: Implement CLI logic
    print("Script execution not yet implemented")
    print(f"Input: {{args.input}}")

    return 0


if __name__ == '__main__':
    sys.exit(main())
'''

    script_path.write_text(script_content)
    script_path.chmod(0o755)

    return script_path


def create_reference_files(skill_name: str, sections: Dict[str, str]) -> Dict[str, Path]:
    """Create reference files based on section content."""
    skill_dir = SKILLS_DIR / skill_name
    created_files = {}

    # Heuristics for extracting content to reference files
    validations_content = []
    output_content = []
    references_content = []

    for section_name, section_content in sections.items():
        section_lower = section_name.lower()

        # Check for validation/threshold content
        if any(keyword in section_lower for keyword in
               ['validation', 'threshold', 'rule', 'severity', 'check']):
            validations_content.append(f"## {section_name}\n\n{section_content}")

        # Check for output format content
        elif any(keyword in section_lower for keyword in
                 ['output', 'format', 'example', 'template', 'schema']):
            output_content.append(f"## {section_name}\n\n{section_content}")

        # Check for integration/reference content
        elif any(keyword in section_lower for keyword in
                 ['integration', 'depend', 'used by', 'call', 'reference']):
            references_content.append(f"## {section_name}\n\n{section_content}")

    # Create VALIDATIONS.md if we have relevant content
    if validations_content:
        validations_path = skill_dir / 'VALIDATIONS.md'
        validations_path.write_text(
            f"# Validation Rules for {skill_name}\n\n" +
            '\n\n'.join(validations_content)
        )
        created_files['VALIDATIONS.md'] = validations_path

    # Create OUTPUT.md if we have relevant content
    if output_content:
        output_path = skill_dir / 'OUTPUT.md'
        output_path.write_text(
            f"# Output Format for {skill_name}\n\n" +
            '\n\n'.join(output_content)
        )
        created_files['OUTPUT.md'] = output_path

    # Create REFERENCES.md if we have relevant content
    if references_content:
        references_path = skill_dir / 'REFERENCES.md'
        references_path.write_text(
            f"# Integration & References for {skill_name}\n\n" +
            '\n\n'.join(references_content)
        )
        created_files['REFERENCES.md'] = references_path

    return created_files


def create_refactored_skill_md(skill_name: str, extracted: Dict) -> str:
    """Create refactored SKILL.md content using template."""
    script_name = skill_name.replace('-', '_')

    # Build reference links
    reference_links = []
    skill_dir = SKILLS_DIR / skill_name

    if (skill_dir / 'VALIDATIONS.md').exists():
        reference_links.append("- **[VALIDATIONS.md](./VALIDATIONS.md)** - Rules and thresholds")
    if (skill_dir / 'OUTPUT.md').exists():
        reference_links.append("- **[OUTPUT.md](./OUTPUT.md)** - Output format specifications")
    if (skill_dir / 'REFERENCES.md').exists():
        reference_links.append("- **[REFERENCES.md](./REFERENCES.md)** - Integration documentation")

    references = '\n'.join(reference_links) if reference_links else "- No additional reference files"

    # Create minimal SKILL.md
    content = f"""---
name: {extracted['name']}
description: {extracted['description']}
---

# {extracted['name']}

[Brief description of what this skill does]

## When to Use

Use this skill when:
- [Scenario 1]
- [Scenario 2]
- User asks: "[Example question]"

## When NOT to Use

Do not use when:
- [Exclusion scenario 1]
- [Exclusion scenario 2]

## What It Does

This skill [high-level description]:
- **Feature 1** - Brief description
- **Feature 2** - Brief description

## How It Works

**IMPORTANT**: This skill executes `scripts/run_{script_name}.py`. Do NOT re-implement the logic inline.

1. [High-level step 1]
2. [High-level step 2]
3. [High-level step 3]

## How to Run

### Execute the Script

```bash
# Basic usage
python scripts/run_{script_name}.py <input>

# With options
python scripts/run_{script_name}.py <input> --format json
```

### Arguments

- `input` - [Description of input parameter]
- `--format` - Output format: `markdown` (default) or `json`
- `--output` - Save output to file instead of stdout

## References

{references}

## Used By

- [Agent/skill that uses this skill]
- Can be called directly for [use case]
"""

    return content


def refactor_skill(skill_name: str, dry_run: bool = False) -> Dict:
    """Refactor a single skill."""
    print(f"\n{'='*70}")
    print(f"REFACTORING: {skill_name}")
    print(f"{'='*70}\n")

    result = {
        'skill': skill_name,
        'success': False,
        'before_lines': 0,
        'after_lines': 0,
        'files_created': [],
        'errors': []
    }

    try:
        # Step 1: Analyze
        skill_path = SKILLS_DIR / skill_name / 'SKILL.md'
        analysis = analyze_skill(skill_path)
        result['before_lines'] = analysis['total_lines']

        print(generate_analysis_report(analysis))
        print()

        if not analysis['needs_refactoring']:
            print(f"✅ {skill_name} doesn't need refactoring (under 200 lines)\n")
            result['success'] = True
            result['after_lines'] = analysis['total_lines']
            return result

        if dry_run:
            print(f"[DRY RUN] Would refactor {skill_name}\n")
            return result

        # Step 2: Extract content
        print("Extracting content...")
        extracted = extract_skill_content(skill_name)

        # Step 3: Create script file
        print("Creating executable script...")
        script_path = create_script_file(skill_name, extracted['code_blocks'])
        result['files_created'].append(str(script_path))
        print(f"  ✅ Created {script_path}")

        # Step 4: Create reference files
        print("Creating reference files...")
        ref_files = create_reference_files(skill_name, extracted['sections'])
        for ref_name, ref_path in ref_files.items():
            result['files_created'].append(str(ref_path))
            print(f"  ✅ Created {ref_path}")

        # Step 5: Backup original SKILL.md
        backup_path = skill_path.with_suffix('.md.backup')
        shutil.copy(skill_path, backup_path)
        print(f"  ✅ Backed up original to {backup_path}")

        # Step 6: Create refactored SKILL.md
        print("Creating refactored SKILL.md...")
        refactored_content = create_refactored_skill_md(skill_name, extracted)
        skill_path.write_text(refactored_content)

        result['after_lines'] = len(refactored_content.split('\n'))
        print(f"  ✅ Refactored SKILL.md ({result['before_lines']} → {result['after_lines']} lines)")

        # Step 7: Validate
        print("\nValidating refactored skill...")
        checks = validate_skill_structure(SKILLS_DIR / skill_name)
        print(generate_validation_report(checks))

        result['success'] = True

        # Calculate metrics
        reduction = ((result['before_lines'] - result['after_lines']) / result['before_lines'] * 100) if result['before_lines'] > 0 else 0
        print(f"\n📊 Metrics:")
        print(f"  Before: {result['before_lines']} lines")
        print(f"  After: {result['after_lines']} lines")
        print(f"  Reduction: {reduction:.1f}%")

    except Exception as e:
        result['errors'].append(str(e))
        print(f"❌ Error refactoring {skill_name}: {e}")

    return result


def main():
    """Main CLI interface."""
    parser = argparse.ArgumentParser(
        description='Batch refactor skills',
        formatter_class=argparse.RawDescriptionHelpFormatter
    )

    parser.add_argument('--skills', nargs='+', help='Specific skills to refactor')
    parser.add_argument('--dry-run', action='store_true', help='Analyze only, no changes')
    parser.add_argument('--interactive', action='store_true', help='Prompt before each skill')

    args = parser.parse_args()

    # Get list of skills to refactor
    if args.skills:
        skills = args.skills
    else:
        skills = get_all_skills()

    print(f"\n{'='*70}")
    print(f"BATCH SKILL REFACTORING")
    print(f"{'='*70}\n")
    print(f"Skills to process: {len(skills)}")
    print(f"Mode: {'DRY RUN' if args.dry_run else 'REFACTOR'}")
    print(f"Interactive: {'Yes' if args.interactive else 'No'}\n")

    # Analyze all first
    if not args.dry_run:
        print("Analyzing all skills first...\n")
        analyses = analyze_all_skills(skills)

        # Show summary
        for skill_name, analysis in analyses.items():
            if 'error' in analysis:
                print(f"❌ {skill_name}: {analysis['error']}")
            else:
                status = "⚠️  NEEDS REFACTORING" if analysis['needs_refactoring'] else "✅ OK"
                print(f"{status} {skill_name}: {analysis['total_lines']} lines")
        print()

    # Process each skill
    results = []
    for i, skill_name in enumerate(skills, 1):
        if args.interactive:
            response = input(f"\nRefactor {skill_name}? [y/N]: ")
            if response.lower() != 'y':
                print(f"Skipped {skill_name}")
                continue

        result = refactor_skill(skill_name, dry_run=args.dry_run)
        results.append(result)

    # Final summary
    print(f"\n{'='*70}")
    print("BATCH REFACTORING SUMMARY")
    print(f"{'='*70}\n")

    successful = [r for r in results if r['success']]
    failed = [r for r in results if not r['success']]

    print(f"Total skills processed: {len(results)}")
    print(f"Successful: {len(successful)}")
    print(f"Failed: {len(failed)}\n")

    if successful:
        total_reduction = sum(r['before_lines'] - r['after_lines'] for r in successful)
        total_before = sum(r['before_lines'] for r in successful)
        avg_reduction = (total_reduction / total_before * 100) if total_before > 0 else 0

        print(f"Total line reduction: {total_reduction} lines ({avg_reduction:.1f}%)")
        print(f"Files created: {sum(len(r['files_created']) for r in successful)}\n")

    if failed:
        print("Failed skills:")
        for r in failed:
            print(f"  ❌ {r['skill']}: {', '.join(r['errors'])}")

    return 0 if not failed else 1


if __name__ == '__main__':
    sys.exit(main())
