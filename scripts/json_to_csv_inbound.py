#!/usr/bin/env python3
"""
JSON to CSV Converter Script for INBOUND transcripts.

Combines multiple JSON files into a single CSV file where:
- Each JSON file becomes one row
- Nested keys are flattened with dot notation (e.g., A_identity_routing.caller_type)
- Arrays are converted to pipe-separated strings
- Schema validation ensures JSON structure matches expected columns

Behavior:
- First run (no CSV exists): Creates CSV with headers from first valid JSON
- Subsequent runs: Appends rows only, validates schema matches existing headers
- Skips JSON files that don't match the expected schema

Usage:
    python scripts/json_to_csv_inbound.py                          # Process default directory
    python scripts/json_to_csv_inbound.py --input /path/to/json    # Custom input directory
    python scripts/json_to_csv_inbound.py --output results.csv     # Custom output filename
    python scripts/json_to_csv_inbound.py --dry-run                # Show what would be processed

Input:  data/audio 2/JSON_Inbound/*.json (default)
Output: data/audio 2/JSON_Inbound/combined_extractions_inbound.csv (default)
"""

import argparse
import csv
import json
from pathlib import Path
from typing import Any


# Default paths
PROJECT_ROOT = Path(__file__).parent.parent
DEFAULT_INPUT_DIR = PROJECT_ROOT / "data" / "audio 2" / "JSON_Inbound"
DEFAULT_OUTPUT_FILE = "combined_extractions_inbound.csv"

# Expected top-level sections in INBOUND transcript extraction JSON
EXPECTED_SECTIONS = [
    "A_call_answer_status",
    "B_identity_routing",
    "C_intent",
    "D_issue_diagnostics",
    "E_change_requests",
    "F_pickup_delivery",
    "G_transfers_escalations",
    "H_outcome",
    "I_complaints",
    "J_hold_experience",
]


def flatten_json(obj: dict, parent_key: str = "", sep: str = ".") -> dict:
    """
    Flatten a nested JSON object into a single-level dict with dot notation keys.

    Example:
        {"A": {"name": "foo", "items": [1, 2]}}
        -> {"A.name": "foo", "A.items": "1|2"}
    """
    items = {}

    for key, value in obj.items():
        new_key = f"{parent_key}{sep}{key}" if parent_key else key

        if isinstance(value, dict):
            # Recursively flatten nested dicts
            items.update(flatten_json(value, new_key, sep))
        elif isinstance(value, list):
            # Convert lists to pipe-separated strings
            str_items = [str(v) if v is not None else "" for v in value]
            items[new_key] = "|".join(str_items)
        elif value is None:
            items[new_key] = ""
        elif isinstance(value, bool):
            items[new_key] = str(value).lower()
        else:
            items[new_key] = value

    return items


def validate_json_schema(data: dict, expected_sections: list[str]) -> tuple[bool, str]:
    """
    Validate that JSON has expected top-level sections.

    Returns:
        tuple: (is_valid, error_message)
    """
    if not isinstance(data, dict):
        return False, "JSON root is not an object"

    missing = [s for s in expected_sections if s not in data]
    if missing:
        return False, f"Missing sections: {', '.join(missing)}"

    extra = [k for k in data.keys() if k not in expected_sections]
    if extra:
        return False, f"Unexpected sections: {', '.join(extra)}"

    return True, ""


def check_columns_completeness(flat_data: dict, expected_columns: list[str]) -> tuple[str, int, list[str], int, list[str]]:
    """
    Check how many expected columns are present and if there are extra keys.

    Returns:
        tuple: (status_string, missing_count, missing_keys, extra_count, extra_keys)
    """
    # Exclude source_file and extraction_status from both sides of comparison
    data_keys = set(flat_data.keys()) - {"source_file", "extraction_status"}
    expected_keys = set(expected_columns) - {"source_file", "extraction_status"}

    missing = expected_keys - data_keys
    extra = data_keys - expected_keys
    missing_count = len(missing)
    extra_count = len(extra)

    if missing_count == 0 and extra_count == 0:
        return "complete", 0, [], 0, []
    else:
        parts = []
        if missing_count > 0:
            parts.append(f"{missing_count} missing")
        if extra_count > 0:
            parts.append(f"{extra_count} extra")
        status = f"incomplete ({', '.join(parts)})"
        return status, missing_count, sorted(missing), extra_count, sorted(extra)


def get_json_files(input_dir: Path, exclude_pattern: str = None) -> list[Path]:
    """Get all JSON files from the input directory, excluding metadata files."""
    if not input_dir.exists():
        return []

    files = []
    for f in input_dir.glob("*.json"):
        # Skip metadata or non-extraction files
        if exclude_pattern and exclude_pattern in f.name:
            continue
        files.append(f)

    return sorted(files)


def load_existing_csv(csv_path: Path) -> tuple[list[str], set[str]]:
    """
    Load existing CSV to get column headers and already-processed files.

    Returns:
        tuple: (list of column headers, set of processed source_file values)
    """
    if not csv_path.exists():
        return [], set()

    columns = []
    processed_files = set()

    with open(csv_path, "r", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        columns = reader.fieldnames or []

        for row in reader:
            if "source_file" in row:
                processed_files.add(row["source_file"])

    return columns, processed_files


def get_sorted_columns(flat_data: dict) -> list[str]:
    """Get column names sorted by section (A_, B_, etc.) with source_file and extraction_status first."""
    # Exclude source_file if already in flat_data to avoid duplication
    data_columns = sorted(k for k in flat_data.keys() if k not in {"source_file", "extraction_status"})
    return ["source_file", "extraction_status"] + data_columns


def load_existing_rows(csv_path: Path) -> list[dict]:
    """Load all existing rows from CSV."""
    if not csv_path.exists():
        return []

    rows = []
    with open(csv_path, "r", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append(dict(row))
    return rows


def write_csv(csv_path: Path, rows: list[dict], columns: list[str]) -> None:
    """Write all rows to CSV file (overwrites existing)."""
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=columns, extrasaction="ignore")
        writer.writeheader()

        for row in rows:
            # Fill missing columns with empty string
            complete_row = {col: row.get(col, "") for col in columns}
            writer.writerow(complete_row)


def main():
    parser = argparse.ArgumentParser(
        description="Combine multiple INBOUND JSON files into a single CSV"
    )
    parser.add_argument(
        "--input", "-i",
        type=Path,
        default=DEFAULT_INPUT_DIR,
        help=f"Input directory containing JSON files (default: {DEFAULT_INPUT_DIR})",
    )
    parser.add_argument(
        "--output", "-o",
        type=str,
        default=DEFAULT_OUTPUT_FILE,
        help=f"Output CSV filename (default: {DEFAULT_OUTPUT_FILE})",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be processed without creating CSV",
    )
    args = parser.parse_args()

    input_dir = args.input
    output_path = input_dir / args.output

    # Find JSON files (exclude metadata files)
    json_files = get_json_files(input_dir, exclude_pattern="metadata")

    print(f"INBOUND JSON to CSV Converter")
    print(f"{'='*50}")
    print(f"Input directory: {input_dir}")
    print(f"Output file: {output_path}")
    print(f"JSON files found: {len(json_files)}")

    if not json_files:
        print("\nNo JSON files found to process.")
        return

    # Check existing CSV
    existing_columns, processed_files = load_existing_csv(output_path)
    csv_exists = len(existing_columns) > 0

    if csv_exists:
        print(f"Existing CSV found with {len(processed_files)} rows")
    else:
        print(f"No existing CSV - will create new file")

    # Filter out already-processed files
    pending_files = [f for f in json_files if f.stem not in processed_files]

    print(f"Files to process: {len(pending_files)}")

    if not pending_files:
        print("\nNo new files to process.")
        return

    # Process files
    print(f"\nProcessing files:")
    valid_rows = []
    columns = list(existing_columns) if csv_exists else None
    new_columns_added = []  # Track any new columns discovered

    for json_path in pending_files:
        print(f"\n  {json_path.name}")

        # Load JSON
        try:
            with open(json_path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except json.JSONDecodeError as e:
            print(f"    SKIP: Invalid JSON - {e}")
            continue
        except Exception as e:
            print(f"    SKIP: Read error - {e}")
            continue

        # Validate schema (top-level sections) - warn but don't skip
        is_valid, error = validate_json_schema(data, EXPECTED_SECTIONS)
        if not is_valid:
            print(f"    WARNING: Schema issue - {error}")

        # Flatten JSON
        flat_data = flatten_json(data)
        flat_data["source_file"] = json_path.stem

        # Set columns from first valid file if CSV doesn't exist
        if columns is None:
            columns = get_sorted_columns(flat_data)
            print(f"    Established schema with {len(columns)} columns")

        # Check completeness (lenient - don't skip, just report status)
        status, missing_count, missing_keys, extra_count, extra_keys = check_columns_completeness(flat_data, columns)

        # Add extra columns to schema (at the end)
        if extra_count > 0:
            for key in extra_keys:
                if key not in columns:
                    columns.append(key)
                    new_columns_added.append(key)
            print(f"    EXPANDED: Added {extra_count} new columns to schema")

        # Re-check status after expanding (now extra keys are accounted for)
        if extra_count > 0:
            status, missing_count, missing_keys, _, _ = check_columns_completeness(flat_data, columns)

        flat_data["extraction_status"] = status

        if missing_count > 0:
            print(f"    WARNING: {status}")
            if missing_keys:
                preview = missing_keys[:3]
                print(f"    Missing: {', '.join(preview)}{'...' if len(missing_keys) > 3 else ''}")
        else:
            print(f"    OK: complete")

        valid_rows.append(flat_data)

    # Summary
    print(f"\n{'='*50}")
    print(f"Valid files: {len(valid_rows)}/{len(pending_files)}")

    if new_columns_added:
        print(f"New columns added: {len(new_columns_added)}")
        preview = new_columns_added[:5]
        print(f"  {', '.join(preview)}{'...' if len(new_columns_added) > 5 else ''}")

    if not valid_rows:
        print("No valid data to write.")
        return

    if args.dry_run:
        action = "rewrite" if (csv_exists and new_columns_added) else ("append to" if csv_exists else "create")
        print(f"\n[DRY RUN] Would {action}: {output_path}")
        print(f"[DRY RUN] Rows to add: {len(valid_rows)}")
        print(f"[DRY RUN] Total columns: {len(columns)}")
        return

    # Determine write strategy
    if csv_exists and new_columns_added:
        # Schema expanded - need to rewrite entire CSV with new columns
        print(f"\nSchema expanded - rewriting CSV with {len(new_columns_added)} new columns...")
        existing_rows = load_existing_rows(output_path)
        all_rows = existing_rows + valid_rows
        write_csv(output_path, all_rows, columns)
        action = "Rewrote (schema expanded)"
        total_rows = len(all_rows)
    elif csv_exists:
        # No schema change - append only
        existing_rows = load_existing_rows(output_path)
        all_rows = existing_rows + valid_rows
        write_csv(output_path, all_rows, columns)
        action = "Appended to"
        total_rows = len(all_rows)
    else:
        # New file
        write_csv(output_path, valid_rows, columns)
        action = "Created"
        total_rows = len(valid_rows)

    print(f"\n{action}: {output_path}")
    print(f"Rows added: {len(valid_rows)}")
    print(f"Total rows: {total_rows}")
    print(f"Total columns: {len(columns)}")


if __name__ == "__main__":
    main()
