#!/usr/bin/env python3
"""
Add transcript column to combined_extractions.csv

Maps source_file values to transcript files and adds full transcript text as a new column.
"""

import pandas as pd
import os

# Paths
CSV_PATH = '/Users/dansia/Documents/HertzDataAnalysis/data/OutboundAnalysis-processed/JSON/combined_extractions.csv'
TRANSCRIPT_FOLDER = '/Users/dansia/Documents/HertzDataAnalysis/data/OutboundAnalysis-processed/Transcription/'
OUTPUT_PATH = '/Users/dansia/Documents/HertzDataAnalysis/data/OutboundAnalysis-processed/JSON/combined_extractions_transcripts.csv'


def get_transcript_filename(source_file: str) -> str:
    """Convert source_file value to transcript filename."""
    base_name = source_file.replace('_extracted', '')
    return f"{base_name}.txt"


def read_transcript(transcript_path: str) -> str:
    """Read transcript file and return full text. Returns empty string if file missing."""
    if not os.path.exists(transcript_path):
        return ""
    try:
        with open(transcript_path, 'r', encoding='utf-8') as f:
            return f.read().strip()
    except Exception as e:
        print(f"Error reading {transcript_path}: {e}")
        return ""


def main():
    # Read the source CSV
    df = pd.read_csv(CSV_PATH)
    print(f"Loaded CSV with {len(df)} rows and {len(df.columns)} columns")

    # Add transcript column
    transcripts = []
    missing_count = 0

    for idx, source_file in enumerate(df['source_file']):
        transcript_filename = get_transcript_filename(source_file)
        transcript_path = os.path.join(TRANSCRIPT_FOLDER, transcript_filename)
        transcript_text = read_transcript(transcript_path)

        if not transcript_text:
            missing_count += 1

        transcripts.append(transcript_text)

        if (idx + 1) % 100 == 0:
            print(f"Processed {idx + 1}/{len(df)} rows...")

    # Add as new column at the end
    df['transcript'] = transcripts

    # Save to new CSV
    df.to_csv(OUTPUT_PATH, index=False)

    print(f"\nDone!")
    print(f"- Total rows: {len(df)}")
    print(f"- Missing transcripts: {missing_count}")
    print(f"- Output saved to: {OUTPUT_PATH}")


if __name__ == '__main__':
    main()
