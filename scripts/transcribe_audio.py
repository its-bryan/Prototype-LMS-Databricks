#!/usr/bin/env python3
"""
Audio Transcription Script using OpenAI Whisper API.

Transcribes audio files from data/audio/raw/ to data/audio/transcriptions/
with idempotent processing (skips already-transcribed files).

Usage:
    python scripts/transcribe_audio.py              # Process pending files
    python scripts/transcribe_audio.py --dry-run   # Show what would be processed
    python scripts/transcribe_audio.py --retry-failed  # Retry failed transcriptions

Requires:
    - OPENAI_API_KEY environment variable
    - ffmpeg installed (brew install ffmpeg)
"""

import argparse
import csv
import json
import os
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

from openai import APIConnectionError, APITimeoutError, OpenAI
from tqdm import tqdm

# Configuration
AUDIO_EXTENSIONS = {".mp3", ".wav", ".m4a", ".webm", ".mp4"}
WHISPER_MODEL = "whisper-1"
COST_PER_MINUTE = 0.006  # USD
MAX_RETRIES = 3
RETRY_DELAY_SECONDS = 2  # Initial delay, doubles each retry

# Context prompt for Whisper - helps improve transcription accuracy
TRANSCRIPTION_PROMPT = (
    "This is a phone conversation between a HERTZ car rental employee and a customer "
    "regarding insurance replacement vehicle rentals. The conversation may also be "
    "between two HERTZ employees. Common topics include reservations, vehicle pickup, "
    "insurance claims, billing, and rental extensions. HERTZ is a car rental company"
)

# Paths
PROJECT_ROOT = Path(__file__).parent.parent
RAW_AUDIO_DIR = PROJECT_ROOT / "data" / "audio 2" / "raw"
TRANSCRIPTIONS_DIR = PROJECT_ROOT / "data" / "audio 2" / "Transcription_Inbound"
METADATA_FILE = TRANSCRIPTIONS_DIR / "metadata.csv"

# CSV columns
CSV_COLUMNS = [
    "filename",
    "file_size_bytes",
    "duration_seconds",
    "model",
    "language",
    "api_cost_usd",
    "transcription_file",
    "status",
    "error_message",
    "processed_at",
]


def get_audio_files() -> list[Path]:
    """Get all audio files from the raw directory."""
    if not RAW_AUDIO_DIR.exists():
        return []

    files = []
    for ext in AUDIO_EXTENSIONS:
        files.extend(RAW_AUDIO_DIR.glob(f"*{ext}"))
        files.extend(RAW_AUDIO_DIR.glob(f"*{ext.upper()}"))

    return sorted(files)


def load_processed_files() -> dict[str, dict]:
    """Load metadata.csv and return dict of processed files."""
    processed = {}

    if not METADATA_FILE.exists():
        return processed

    with open(METADATA_FILE, "r", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            processed[row["filename"]] = row

    return processed


def get_audio_duration(file_path: Path) -> float:
    """Get audio duration in seconds using ffprobe."""
    result = subprocess.run(
        [
            "ffprobe",
            "-v", "quiet",
            "-print_format", "json",
            "-show_format",
            str(file_path),
        ],
        capture_output=True,
        text=True,
        check=True,
    )
    data = json.loads(result.stdout)
    return float(data["format"]["duration"])


def transcribe_file(client: OpenAI, file_path: Path) -> tuple[str, str]:
    """
    Transcribe audio file using Whisper API with timestamps.

    Retries up to MAX_RETRIES times on connection errors with exponential backoff.

    Returns:
        tuple: (transcription_text, detected_language)
    """
    last_error = None

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            with open(file_path, "rb") as audio_file:
                response = client.audio.transcriptions.create(
                    model=WHISPER_MODEL,
                    file=audio_file,
                    response_format="verbose_json",
                    timestamp_granularities=["segment"],
                    prompt=TRANSCRIPTION_PROMPT,
                )

            # Format output with timestamps
            lines = []
            for segment in response.segments:
                start = segment.start
                end = segment.end
                text = segment.text.strip()
                lines.append(f"[{start:.2f} - {end:.2f}] {text}")

            transcription_text = "\n".join(lines)
            language = response.language

            return transcription_text, language

        except (APIConnectionError, APITimeoutError, ConnectionError) as e:
            last_error = e
            if attempt < MAX_RETRIES:
                delay = RETRY_DELAY_SECONDS * (2 ** (attempt - 1))
                print(f"  Connection error (attempt {attempt}/{MAX_RETRIES}), retrying in {delay}s...")
                time.sleep(delay)
            else:
                print(f"  Failed after {MAX_RETRIES} attempts")

    raise last_error


def append_to_metadata(row: dict) -> None:
    """Append a single row to metadata.csv (creates file if needed)."""
    file_exists = METADATA_FILE.exists()

    with open(METADATA_FILE, "a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_COLUMNS)
        if not file_exists:
            writer.writeheader()
        writer.writerow(row)


def process_file(client: OpenAI, file_path: Path, dry_run: bool = False) -> bool:
    """
    Process a single audio file.

    Returns:
        bool: True if successful, False if failed
    """
    filename = file_path.name
    file_size = file_path.stat().st_size

    # Get duration
    try:
        duration = get_audio_duration(file_path)
    except Exception as e:
        print(f"  Error reading audio metadata: {e}")
        if not dry_run:
            append_to_metadata({
                "filename": filename,
                "file_size_bytes": file_size,
                "duration_seconds": "",
                "model": WHISPER_MODEL,
                "language": "",
                "api_cost_usd": "",
                "transcription_file": "",
                "status": "failed",
                "error_message": f"Could not read audio: {e}",
                "processed_at": datetime.now().isoformat(),
            })
        return False

    cost = (duration / 60) * COST_PER_MINUTE
    transcription_filename = file_path.stem + ".txt"
    transcription_path = TRANSCRIPTIONS_DIR / transcription_filename

    if dry_run:
        print(f"  Duration: {duration:.1f}s, Est. cost: ${cost:.4f}")
        return True

    # Transcribe
    try:
        transcription_text, language = transcribe_file(client, file_path)
    except Exception as e:
        print(f"  Transcription failed: {e}")
        append_to_metadata({
            "filename": filename,
            "file_size_bytes": file_size,
            "duration_seconds": duration,
            "model": WHISPER_MODEL,
            "language": "",
            "api_cost_usd": cost,
            "transcription_file": "",
            "status": "failed",
            "error_message": str(e),
            "processed_at": datetime.now().isoformat(),
        })
        return False

    # Save transcription
    with open(transcription_path, "w", encoding="utf-8") as f:
        f.write(transcription_text)

    # Record success in metadata
    append_to_metadata({
        "filename": filename,
        "file_size_bytes": file_size,
        "duration_seconds": duration,
        "model": WHISPER_MODEL,
        "language": language,
        "api_cost_usd": cost,
        "transcription_file": transcription_filename,
        "status": "success",
        "error_message": "",
        "processed_at": datetime.now().isoformat(),
    })

    print(f"  Done ({duration:.1f}s, {language}, ${cost:.4f})")
    return True


def main():
    parser = argparse.ArgumentParser(
        description="Transcribe audio files using OpenAI Whisper API"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be processed without making API calls",
    )
    parser.add_argument(
        "--retry-failed",
        action="store_true",
        help="Retry previously failed transcriptions",
    )
    args = parser.parse_args()

    # Check API key
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key and not args.dry_run:
        print("Error: OPENAI_API_KEY environment variable not set")
        sys.exit(1)

    # Ensure directories exist
    RAW_AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    TRANSCRIPTIONS_DIR.mkdir(parents=True, exist_ok=True)

    # Get audio files and processed files
    all_files = get_audio_files()
    processed = load_processed_files()

    if not all_files:
        print(f"No audio files found in {RAW_AUDIO_DIR}")
        print(f"Supported formats: {', '.join(AUDIO_EXTENSIONS)}")
        sys.exit(0)

    # Determine which files to process
    if args.retry_failed:
        # Only retry files that previously failed
        failed_filenames = {
            fname for fname, data in processed.items()
            if data["status"] == "failed"
        }
        pending_files = [f for f in all_files if f.name in failed_filenames]
    else:
        # Skip all previously processed files (success or failed)
        pending_files = [f for f in all_files if f.name not in processed]

    # Summary
    print(f"Audio files found: {len(all_files)}")
    print(f"Already processed: {len(processed)}")
    print(f"Pending: {len(pending_files)}")

    if not pending_files:
        print("\nNo files to process.")
        sys.exit(0)

    if args.dry_run:
        print("\n[DRY RUN] Would process:")
        for f in pending_files:
            print(f"\n  {f.name}")
            process_file(None, f, dry_run=True)
        sys.exit(0)

    # Initialize OpenAI client
    client = OpenAI(api_key=api_key)

    # Process files
    print(f"\nProcessing {len(pending_files)} file(s)...")
    success_count = 0

    for file_path in tqdm(pending_files, desc="Transcribing"):
        print(f"\n{file_path.name}")
        if process_file(client, file_path):
            success_count += 1

    # Final summary
    print(f"\n{'='*50}")
    print(f"Completed: {success_count}/{len(pending_files)} files")
    print(f"Metadata saved to: {METADATA_FILE}")


if __name__ == "__main__":
    main()
