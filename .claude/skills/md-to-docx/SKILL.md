---
name: md-to-docx
description: Converts a single Markdown file to Word (.docx) format using Pandoc, saving to docs/word_exports/. Use when user wants to export documentation to Word.
---

# md-to-docx

Convert a single Markdown file to Microsoft Word (.docx) format using Pandoc.

## Usage

```bash
/md-to-docx <file_path>
```

Examples:
```bash
/md-to-docx docs/hypotheses.md
/md-to-docx docs/clarified_understanding.md
/md-to-docx README.md
```

You can also provide context:
```bash
/md-to-docx convert the hypotheses document
/md-to-docx export project_scope.md to Word
```

## What This Skill Does

1. Takes a Markdown file path as input
2. Validates the file exists and has .md extension
3. Creates `docs/word_exports/` directory if it doesn't exist
4. Uses Pandoc to convert the Markdown to Word format
5. Saves the .docx file to `docs/word_exports/` with the same base filename
6. Reports the output file location

## Requirements

- Pandoc must be installed (already installed via Homebrew)

## Output Location

All converted Word files are saved to: `docs/word_exports/`

Example:
- Input: `docs/hypotheses.md`
- Output: `docs/word_exports/hypotheses.docx`

## Formatting Preservation

Pandoc preserves:
- Headings and hierarchy
- Lists (bulleted and numbered)
- Tables
- Code blocks (formatted as Word code style)
- Bold, italics, links
- Images (if paths are correct)

## Error Handling

The skill validates:
- File exists
- File has .md extension
- Output directory can be created
- Pandoc is available

## Use Cases

1. **Documentation export**: Convert project documentation to Word for sharing
2. **Report generation**: Create Word versions of analysis reports
3. **Stakeholder communication**: Export findings to client-friendly format
4. **OneDrive upload**: Prepare files for cloud storage and collaboration

## Implementation

When invoked, the skill:

```bash
# Ensure output directory exists
mkdir -p docs/word_exports

# Convert markdown to docx
pandoc <input_file>.md -o docs/word_exports/<basename>.docx
```

## Notes

- Converts one file at a time (by design)
- Output directory is fixed to `docs/word_exports/`
- Overwrites existing files with the same name
- Works with relative and absolute paths
