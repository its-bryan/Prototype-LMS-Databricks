# Hertz Call Transcript Processing Workspace — Design

**Date**: 2026-02-19
**Status**: Approved

## Purpose

A standalone workspace for processing fresh batches of Hertz call audio files into structured, auditable CSV datasets. Handles 4 call types with different feature schemas. Simplifies the existing 2-script/60-field/JSON pipeline into a CSV-centric workflow with ~7 features per call type (plus reasoning and evidence columns).

## Folder Structure

```
~/Documents/HertzCallTranscripts/
├── CLAUDE.md                          # Project instructions
├── requirements.txt                   # Python dependencies
├── .env.example                       # Template for OPENAI_API_KEY
├── .gitignore                         # Ignores data/*/audio/, .env, CSVs
├── scripts/
│   ├── transcribe.py                  # Pass 1: Audio -> transcript text, appends to CSV
│   └── extract_features.py            # Pass 2: Reads CSV, fills feature columns via LLM
├── config/
│   ├── call_centre_outbound.yaml      # Prompt, features, schema for this call type
│   ├── call_centre_inbound.yaml
│   ├── branch_outbound.yaml
│   └── branch_inbound.yaml
└── data/
    ├── call_centre_outbound/
    │   ├── audio/                     # Drop raw audio files here (gitignored)
    │   └── transcripts.csv            # Single output CSV for this call type
    ├── call_centre_inbound/
    │   ├── audio/
    │   └── transcripts.csv
    ├── branch_outbound/
    │   ├── audio/
    │   └── transcripts.csv
    └── branch_inbound/
        ├── audio/
        └── transcripts.csv
```

## Call Types

| Call Type | Description |
|---|---|
| `call_centre_outbound` | Outbound calls from Hertz call centre to customers |
| `call_centre_inbound` | Inbound calls to Hertz call centre from customers |
| `branch_outbound` | Outbound calls from Hertz branch locations |
| `branch_inbound` | Inbound calls to Hertz branch locations |

Each call type has its own audio folder, output CSV, and YAML config with tailored prompts and features. The scripts are shared across all call types.

## CSV Schema (Call Centre Outbound — Primary)

One CSV per call type. Every row = one audio file. Columns:

### Metadata columns (filled by transcribe.py)

| Column | Description |
|---|---|
| `filename` | Audio filename |
| `duration_seconds` | Call duration |
| `transcript` | Full timestamped transcript text |
| `transcribed_at` | Timestamp of transcription |
| `whisper_cost_usd` | Whisper API cost |

### Feature columns (filled by extract_features.py)

Each feature has 3 columns: `value`, `reasoning`, `evidence`.

| Feature | Type | Allowed Values |
|---|---|---|
| `timing_need` | enum | `same_day_today`, `this_week`, `next_week`, `unsure`, `other` |
| `branch_transfer` | boolean | `true`, `false` |
| `transfer_type` | enum | `warm`, `cold`, `null` |
| `transfer_outcome` | enum | `branch_took_over`, `branch_busy`, `branch_no_answer`, `null` |
| `escalation_to_manager` | boolean | `true`, `false` |
| `trust_breaking_verbiage` | boolean | `true`, `false` |
| `trust_breaking_phrases` | string | Actual phrases found (e.g. "not confirmed, branch's discretion") |
| `interpreter_used` | boolean | `true`, `false` |

### Tracking columns (filled by extract_features.py)

| Column | Description |
|---|---|
| `extraction_status` | `success`, `failed`, or empty (not yet processed) |
| `extracted_at` | Timestamp of extraction |
| `extraction_cost_usd` | LLM API cost (Step 1 + Step 2) |

**Total columns**: 5 metadata + (8 features x 3 = 24) + 3 tracking = **32 columns**

Note: `trust_breaking_phrases` replaces the evidence column for that feature — it IS the evidence (the actual phrases). So `trust_breaking_verbiage` has: value, reasoning, and `trust_breaking_phrases` as its evidence. Total is 32 columns.

## Pipeline

### Pass 1: Transcription (`transcribe.py`)

```bash
python scripts/transcribe.py call_centre_outbound
python scripts/transcribe.py call_centre_outbound --dry-run
python scripts/transcribe.py call_centre_outbound --workers 4
python scripts/transcribe.py call_centre_outbound --max-files 10
python scripts/transcribe.py call_centre_outbound --retry-failed
```

- Reads audio files from `data/<call_type>/audio/`
- Uses OpenAI Whisper API (`whisper-1`) with Hertz-specific context prompt
- Appends new rows to `data/<call_type>/transcripts.csv`
- Idempotent: skips files already in CSV
- Concurrent workers with file lock on CSV writes
- Supports: `.mp3`, `.wav`, `.m4a`, `.webm`, `.mp4`

### Pass 2: Feature Extraction (`extract_features.py`)

```bash
python scripts/extract_features.py call_centre_outbound
python scripts/extract_features.py call_centre_outbound --dry-run
python scripts/extract_features.py call_centre_outbound --workers 5
python scripts/extract_features.py call_centre_outbound --retry-failed
```

- Loads full CSV into a pandas DataFrame
- Identifies rows where `extraction_status` is empty
- Loads prompt and schema from `config/<call_type>.yaml`
- Fans out API calls concurrently (5 workers default)
- Collects all results in memory
- Writes updated DataFrame back to CSV once at the end
- If crash mid-run, original CSV is untouched — just re-run

### LLM Strategy (2-Step per Transcript)

**Step 1 — Free-form Analysis (GPT-4o)**
- Full reasoning about each feature
- Hallucination guardrails for interpreter vs transfer confusion
- Produces a structured text report

**Step 2 — Flat JSON Extraction (GPT-4o-mini)**
- Reads Step 1 report, maps to flat JSON
- Each key = one CSV column
- JSON is never saved to disk, just parsed into DataFrame columns

**Why 2 steps**: Structured outputs constrain the model's reasoning. Step 1 lets GPT-4o think freely. Step 2 is cheap mechanical translation.

## YAML Config Structure

```yaml
# config/call_centre_outbound.yaml
call_type: call_centre_outbound
description: "Outbound calls from Hertz call centre to customers"

analysis_prompt: |
  You are an expert Transcript Analysis Specialist working for Hertz...
  [Full Step 1 prompt tailored to this call type's features]

json_conversion_prompt: |
  Convert the following transcript analysis report into the required JSON schema...
  [Step 2 prompt]

features:
  - name: timing_need
    type: enum
    values: [same_day_today, this_week, next_week, unsure, other]
  - name: branch_transfer
    type: boolean
  - name: transfer_type
    type: enum
    values: [warm, cold, "null"]
  - name: transfer_outcome
    type: enum
    values: [branch_took_over, branch_busy, branch_no_answer, "null"]
  - name: escalation_to_manager
    type: boolean
  - name: trust_breaking_verbiage
    type: boolean
  - name: trust_breaking_phrases
    type: string
  - name: interpreter_used
    type: boolean

json_schema:
  type: object
  properties:
    timing_need:
      type: string
      enum: [same_day_today, this_week, next_week, unsure, other]
    timing_need_reasoning:
      type: string
    timing_need_evidence:
      type: [string, "null"]
    # ... etc for each feature
```

Other call types (inbound, branch outbound, branch inbound) will have different features and prompts defined in their own YAML files.

## Concurrency & Memory

- **Pass 1 (transcription)**: Workers append rows independently. File lock on CSV write prevents corruption. Low memory — streaming, one file at a time.
- **Pass 2 (extraction)**: Load full CSV into DataFrame (~15MB for 1000 transcripts). API calls fan out concurrently. Results collected in memory. Single write at end. No race conditions.
- **Bottleneck**: Network (API latency), not CPU or RAM.

## Hallucination Guardrails

The analysis prompt includes explicit instructions:
- "An interpreter transfer is when a third-party language interpreter joins the call. Do NOT confuse this with a branch transfer."
- "A branch transfer is when the agent connects the customer to a local Hertz branch. These are different events."
- Evidence columns anchor every determination to actual transcript quotes
- Reasoning columns expose the LLM's logic for manual audit

## Dependencies

- Python 3.11+
- openai (Whisper + Chat Completions)
- pandas (CSV handling)
- pyyaml (config loading)
- tqdm (progress bars)
- ffmpeg (audio duration via ffprobe)

## Cost Estimates (per transcript)

| Step | Model | Estimated Cost |
|---|---|---|
| Whisper transcription | whisper-1 | ~$0.006/min |
| Step 1 analysis | gpt-4o | ~$0.01-0.02 |
| Step 2 JSON extraction | gpt-4o-mini | ~$0.001 |
| **Total per transcript** | | **~$0.02-0.03** |

For 1,000 files: ~$20-30 total.
