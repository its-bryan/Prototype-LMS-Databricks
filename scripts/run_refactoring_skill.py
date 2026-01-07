#!/usr/bin/env python3
"""
Skill Refactoring Helper

Analyzes and assists with refactoring Claude skills to follow Anthropic best practices.

Usage:
    python scripts/run_refactoring_skill.py analyze <skill-name>
    python scripts/run_refactoring_skill.py extract <skill-name>
    python scripts/run_refactoring_skill.py validate <skill-name>
    python scripts/run_refactoring_skill.py report <skill-name>
"""

import argparse
import re
import sys
from pathlib import Path
from typing import Dict, List, Tuple


# ============================================================================
# Analysis Functions
# ============================================================================

def analyze_skill(skill_path: Path) -> Dict:
    """Analyze a SKILL.md file and identify extractable content."""

    if not skill_path.exists():
        raise FileNotFoundError(f"SKILL.md not found at: {skill_path}")

    content = skill_path.read_text()
    lines = content.split('\n')
    total_lines = len(lines)

    # Find code blocks
    code_blocks = re.findall(r'```(\w+)?\n(.*?)```', content, re.DOTALL)
    code_lines = sum(len(block[1].split('\n')) for block in code_blocks)

    # Find sections
    sections = re.findall(r'^##\s+(.+)$', content, re.MULTILINE)

    # Estimate extractable content
    yaml_frontmatter_lines = len(re.findall(r'^---$.*?^---$', content, re.DOTALL | re.MULTILINE))

    # Look for patterns that suggest extraction opportunities
    has_thresholds = bool(re.search(r'threshold|severity|validation', content, re.IGNORECASE))
    has_output_examples = bool(re.search(r'output format|example output|returns', content, re.IGNORECASE))
    has_integration_docs = bool(re.search(r'called by|integration|depends on', content, re.IGNORECASE))

    analysis = {
        'skill_path': str(skill_path),
        'total_lines': total_lines,
        'code_blocks': len(code_blocks),
        'code_lines': code_lines,
        'sections': sections,
        'has_thresholds': has_thresholds,
        'has_output_examples': has_output_examples,
        'has_integration_docs': has_integration_docs,
        'needs_refactoring': total_lines > 200 or code_lines > 50,
        'estimated_reduction': min(70, int((code_lines / total_lines) * 100)) if total_lines > 0 else 0
    }

    return analysis


def extract_code_blocks(skill_path: Path) -> List[Tuple[str, str]]:
    """Extract all code blocks from SKILL.md."""

    content = skill_path.read_text()
    code_blocks = re.findall(r'```(\w+)?\n(.*?)```', content, re.DOTALL)

    return [(lang or 'text', code) for lang, code in code_blocks]


def extract_sections(skill_path: Path) -> Dict[str, str]:
    """Extract content by section."""

    content = skill_path.read_text()
    sections = {}

    # Split by ## headers
    parts = re.split(r'^##\s+(.+)$', content, flags=re.MULTILINE)

    # parts[0] is frontmatter + intro
    sections['frontmatter'] = parts[0] if parts else ''

    # Remaining parts alternate: section_name, section_content
    for i in range(1, len(parts), 2):
        if i + 1 < len(parts):
            section_name = parts[i].strip()
            section_content = parts[i + 1].strip()
            sections[section_name] = section_content

    return sections


# ============================================================================
# Validation Functions
# ============================================================================

def validate_skill_structure(skill_dir: Path) -> Dict[str, bool]:
    """Validate that a refactored skill has proper structure."""

    checks = {}

    # Check SKILL.md
    skill_md = skill_dir / 'SKILL.md'
    checks['skill_md_exists'] = skill_md.exists()

    if skill_md.exists():
        content = skill_md.read_text()
        lines = content.split('\n')

        checks['skill_md_size_ok'] = len(lines) <= 200
        checks['skill_md_size_preferred'] = len(lines) <= 120
        checks['has_yaml_frontmatter'] = content.startswith('---')
        checks['has_when_to_use'] = '## When to Use' in content or '## When to use' in content
        checks['has_when_not_to_use'] = '## When NOT to Use' in content or '## When not to use' in content
        checks['has_how_it_works'] = '## How It Works' in content or '## How it works' in content
        checks['has_execution_warning'] = 'Do NOT re-implement' in content or 'do not re-implement' in content.lower()
        checks['has_references'] = '## References' in content
        checks['no_large_code_blocks'] = not bool(re.search(r'```python\n(.{500,}?)```', content, re.DOTALL))

    # Check for reference files
    checks['has_validations_md'] = (skill_dir / 'VALIDATIONS.md').exists()
    checks['has_output_md'] = (skill_dir / 'OUTPUT.md').exists()
    checks['has_references_md'] = (skill_dir / 'REFERENCES.md').exists()

    # Check for script
    skill_name = skill_dir.name
    script_path = Path('scripts') / f'run_{skill_name.replace("-", "_")}.py'
    checks['has_script'] = script_path.exists()

    if script_path.exists():
        script_content = script_path.read_text()
        checks['script_has_shebang'] = script_content.startswith('#!/usr/bin/env python')
        checks['script_has_main'] = 'def main()' in script_content
        checks['script_has_argparse'] = 'argparse' in script_content
        checks['script_has_cli_guard'] = "if __name__ == '__main__':" in script_content

    return checks


def calculate_metrics(before_lines: int, after_lines: int) -> Dict[str, float]:
    """Calculate refactoring metrics."""

    reduction = ((before_lines - after_lines) / before_lines * 100) if before_lines > 0 else 0
    token_savings = reduction * 0.95  # Approximate token savings

    return {
        'before_lines': before_lines,
        'after_lines': after_lines,
        'lines_removed': before_lines - after_lines,
        'reduction_pct': round(reduction, 1),
        'estimated_token_savings_pct': round(token_savings, 1)
    }


# ============================================================================
# Reporting Functions
# ============================================================================

def generate_analysis_report(analysis: Dict) -> str:
    """Generate a formatted analysis report."""

    report = [
        "=" * 70,
        "SKILL REFACTORING ANALYSIS",
        "=" * 70,
        "",
        f"Skill: {analysis['skill_path']}",
        f"Total lines: {analysis['total_lines']}",
        f"Code blocks: {analysis['code_blocks']} ({analysis['code_lines']} lines)",
        "",
        "Sections found:",
    ]

    for section in analysis['sections']:
        report.append(f"  - {section}")

    report.extend([
        "",
        "Extraction opportunities:",
        f"  - Thresholds/validations: {'Yes' if analysis['has_thresholds'] else 'No'}",
        f"  - Output examples: {'Yes' if analysis['has_output_examples'] else 'No'}",
        f"  - Integration docs: {'Yes' if analysis['has_integration_docs'] else 'No'}",
        "",
        f"Needs refactoring: {'YES' if analysis['needs_refactoring'] else 'No'}",
        f"Estimated reduction: ~{analysis['estimated_reduction']}%",
        "",
        "Recommendations:",
    ])

    if analysis['total_lines'] > 200:
        report.append(f"  ⚠️  SKILL.md exceeds 200 lines (currently {analysis['total_lines']})")

    if analysis['code_lines'] > 50:
        report.append(f"  ⚠️  Large amount of code ({analysis['code_lines']} lines) - extract to scripts/")

    if analysis['has_thresholds']:
        report.append("  💡 Extract thresholds/validations to VALIDATIONS.md")

    if analysis['has_output_examples']:
        report.append("  💡 Extract output examples to OUTPUT.md")

    if analysis['has_integration_docs']:
        report.append("  💡 Extract integration docs to REFERENCES.md")

    if not analysis['needs_refactoring']:
        report.append("  ✅ Skill structure looks good!")

    report.append("=" * 70)

    return '\n'.join(report)


def generate_validation_report(checks: Dict[str, bool]) -> str:
    """Generate a formatted validation report."""

    report = [
        "=" * 70,
        "SKILL VALIDATION REPORT",
        "=" * 70,
        "",
        "SKILL.md Structure:",
    ]

    skill_checks = {
        'skill_md_exists': 'SKILL.md exists',
        'skill_md_size_ok': 'SKILL.md ≤200 lines',
        'skill_md_size_preferred': 'SKILL.md ≤120 lines (preferred)',
        'has_yaml_frontmatter': 'Has YAML frontmatter',
        'has_when_to_use': 'Has "When to Use" section',
        'has_when_not_to_use': 'Has "When NOT to Use" section',
        'has_how_it_works': 'Has "How It Works" section',
        'has_execution_warning': 'Has execution warning',
        'has_references': 'Has "References" section',
        'no_large_code_blocks': 'No large code blocks (>500 chars)',
    }

    for check, description in skill_checks.items():
        status = '✅' if checks.get(check, False) else '❌'
        report.append(f"  {status} {description}")

    report.extend([
        "",
        "Reference Files:",
        f"  {'✅' if checks.get('has_validations_md') else '⚪'} VALIDATIONS.md (optional)",
        f"  {'✅' if checks.get('has_output_md') else '⚪'} OUTPUT.md (optional)",
        f"  {'✅' if checks.get('has_references_md') else '⚪'} REFERENCES.md (optional)",
        "",
        "Script:",
    ])

    script_checks = {
        'has_script': 'Script exists in scripts/',
        'script_has_shebang': 'Has shebang',
        'script_has_main': 'Has main() function',
        'script_has_argparse': 'Uses argparse',
        'script_has_cli_guard': 'Has CLI guard',
    }

    for check, description in script_checks.items():
        if check == 'has_script':
            status = '✅' if checks.get(check, False) else '❌'
        else:
            status = '✅' if checks.get(check, False) else ('⚪' if not checks.get('has_script') else '❌')
        report.append(f"  {status} {description}")

    # Overall status
    required_checks = ['skill_md_exists', 'skill_md_size_ok', 'has_yaml_frontmatter',
                      'has_when_to_use', 'has_execution_warning']
    all_required_pass = all(checks.get(c, False) for c in required_checks)

    report.extend([
        "",
        "=" * 70,
        f"Overall Status: {'✅ PASS' if all_required_pass else '❌ FAIL'}",
        "=" * 70,
    ])

    return '\n'.join(report)


# ============================================================================
# CLI Interface
# ============================================================================

def main():
    """Main CLI interface."""

    parser = argparse.ArgumentParser(
        description='Skill refactoring helper',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Commands:
  analyze   - Analyze a skill and identify refactoring opportunities
  extract   - Extract code blocks from SKILL.md
  validate  - Validate a refactored skill structure
  report    - Generate a comprehensive refactoring report

Examples:
  python scripts/run_refactoring_skill.py analyze checking-quality
  python scripts/run_refactoring_skill.py validate checking-quality
  python scripts/run_refactoring_skill.py report checking-quality
        """
    )

    parser.add_argument('command', choices=['analyze', 'extract', 'validate', 'report'],
                       help='Command to execute')
    parser.add_argument('skill_name', help='Name of the skill (e.g., checking-quality)')
    parser.add_argument('--before-lines', type=int, help='Original line count (for metrics)')

    args = parser.parse_args()

    # Construct paths
    skill_dir = Path('.claude/skills') / args.skill_name
    skill_md = skill_dir / 'SKILL.md'

    try:
        if args.command == 'analyze':
            analysis = analyze_skill(skill_md)
            print(generate_analysis_report(analysis))

        elif args.command == 'extract':
            code_blocks = extract_code_blocks(skill_md)
            print(f"\nFound {len(code_blocks)} code blocks:\n")
            for i, (lang, code) in enumerate(code_blocks, 1):
                lines = len(code.split('\n'))
                print(f"{i}. Language: {lang}, Lines: {lines}")
                print(f"   First 50 chars: {code[:50].strip()}...")
                print()

        elif args.command == 'validate':
            checks = validate_skill_structure(skill_dir)
            print(generate_validation_report(checks))

        elif args.command == 'report':
            # Comprehensive report
            analysis = analyze_skill(skill_md)
            checks = validate_skill_structure(skill_dir)

            print(generate_analysis_report(analysis))
            print()
            print(generate_validation_report(checks))

            if args.before_lines:
                current_lines = analysis['total_lines']
                metrics = calculate_metrics(args.before_lines, current_lines)
                print("\nRefactoring Metrics:")
                print(f"  Before: {metrics['before_lines']} lines")
                print(f"  After: {metrics['after_lines']} lines")
                print(f"  Reduction: {metrics['lines_removed']} lines ({metrics['reduction_pct']}%)")
                print(f"  Est. token savings: ~{metrics['estimated_token_savings_pct']}%")

    except FileNotFoundError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Unexpected error: {e}", file=sys.stderr)
        sys.exit(2)


if __name__ == '__main__':
    main()
