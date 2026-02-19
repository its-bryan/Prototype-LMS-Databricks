# HertzCallTranscripts Workspace Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a standalone workspace that processes Hertz call audio files into CSV datasets with transcripts and LLM-extracted features (with reasoning + evidence columns) for 4 call types.

**Architecture:** Two shared Python scripts (`transcribe.py`, `extract_features.py`) operate on call-type-specific data folders. YAML config files per call type define the LLM prompts and feature schemas. A 2-step LLM pipeline (GPT-4o free-form analysis → GPT-4o-mini structured JSON) fills feature columns in a single CSV per call type.

**Tech Stack:** Python 3.11+, openai SDK, pandas, pyyaml, tqdm, ffmpeg/ffprobe

**Design Doc:** `docs/plans/2026-02-19-call-transcript-workspace-design.md` (in HertzDataAnalysis repo)

**Reference scripts** (proven patterns to carry forward):
- `~/Documents/HertzDataAnalysis/scripts/transcribe_audio.py` — Whisper API, retries, metadata CSV, concurrent workers
- `~/Documents/HertzDataAnalysis/scripts/extract_transcript_features.py` — 2-step LLM, structured outputs, cost tracking

---

## Task 1: Scaffold the Project

**Files:**
- Create: `~/Documents/HertzCallTranscripts/` (project root)
- Create: `~/Documents/HertzCallTranscripts/.gitignore`
- Create: `~/Documents/HertzCallTranscripts/.env.example`
- Create: `~/Documents/HertzCallTranscripts/requirements.txt`
- Create: `~/Documents/HertzCallTranscripts/CLAUDE.md`
- Create: data directory structure for all 4 call types

**Step 1: Create project directory and data structure**

```bash
mkdir -p ~/Documents/HertzCallTranscripts/{scripts,config}
mkdir -p ~/Documents/HertzCallTranscripts/data/{call_centre_outbound,call_centre_inbound,branch_outbound,branch_inbound}/audio
```

**Step 2: Create .gitignore**

```gitignore
# Audio files (large, not for git)
data/*/audio/

# Output CSVs (large, regenerable)
data/*/*.csv

# Environment
.env
.venv/
__pycache__/
*.pyc

# OS
.DS_Store
```

**Step 3: Create .env.example**

```
OPENAI_API_KEY=sk-your-key-here
```

**Step 4: Create requirements.txt**

```
openai>=1.0.0
pandas>=2.0.0
pyyaml>=6.0
tqdm>=4.65.0
```

**Step 5: Create CLAUDE.md**

```markdown
# Hertz Call Transcript Processing Workspace

## Purpose
Processes Hertz call audio files into structured CSV datasets with transcripts and LLM-extracted features.

## Call Types
- `call_centre_outbound` — Outbound calls from Hertz call centre
- `call_centre_inbound` — Inbound calls to Hertz call centre
- `branch_outbound` — Outbound calls from Hertz branches
- `branch_inbound` — Inbound calls to Hertz branches

## Pipeline
1. `python scripts/transcribe.py <call_type>` — Audio → transcript text in CSV
2. `python scripts/extract_features.py <call_type>` — Fill feature columns via LLM

## Config
Each call type has a YAML config in `config/` defining prompts and feature schemas.

## Dependencies
- OPENAI_API_KEY environment variable
- ffmpeg installed (brew install ffmpeg)
```

**Step 6: Initialize git repo and commit**

```bash
cd ~/Documents/HertzCallTranscripts
git init
git add .gitignore .env.example requirements.txt CLAUDE.md
git commit -m "chore: scaffold HertzCallTranscripts workspace"
```

---

## Task 2: Write the YAML Config for Call Centre Outbound

**Files:**
- Create: `~/Documents/HertzCallTranscripts/config/call_centre_outbound.yaml`

**Step 1: Write the config file**

This is the primary call type. The YAML contains:
- `call_type` and `description`
- `transcription_prompt` — Whisper context prompt (carried from existing script)
- `analysis_prompt` — Full Step 1 prompt for GPT-4o, covering all 8 features with hallucination guardrails
- `json_conversion_prompt` — Step 2 prompt template for GPT-4o-mini
- `features` — list of feature definitions (name, type, allowed values)
- `json_schema` — flat JSON schema for structured output in Step 2

The analysis prompt must:
- Ask about each feature explicitly with clear definitions
- Include hallucination guardrails for interpreter vs branch transfer
- Request evidence quotes for each determination
- Define the exact enum values to use

The JSON schema must be flat — every key maps directly to a CSV column:
- `timing_need`, `timing_need_reasoning`, `timing_need_evidence`
- `branch_transfer`, `branch_transfer_reasoning`, `branch_transfer_evidence`
- `transfer_type`, `transfer_type_reasoning`, `transfer_type_evidence`
- `transfer_outcome`, `transfer_outcome_reasoning`, `transfer_outcome_evidence`
- `escalation_to_manager`, `escalation_to_manager_reasoning`, `escalation_to_manager_evidence`
- `trust_breaking_verbiage`, `trust_breaking_verbiage_reasoning`, `trust_breaking_phrases`
- `interpreter_used`, `interpreter_used_reasoning`, `interpreter_used_evidence`

Reference the existing prompt in `~/Documents/HertzDataAnalysis/scripts/extract_transcript_features.py` (lines 82-199 for analysis prompt structure, lines 441-607 for JSON conversion prompt patterns). Adapt the relevant sections (B, F, and new escalation/trust features) and drop the rest.

**Step 2: Commit**

```bash
git add config/call_centre_outbound.yaml
git commit -m "feat: add call_centre_outbound YAML config with prompts and schema"
```

---

## Task 3: Write transcribe.py

**Files:**
- Create: `~/Documents/HertzCallTranscripts/scripts/transcribe.py`

**Step 1: Write the transcription script**

Port from `~/Documents/HertzDataAnalysis/scripts/transcribe_audio.py` with these changes:

- **CLI**: Takes positional arg `call_type` (one of the 4 types). Validates it exists as a folder in `data/`.
- **Paths**: Derives all paths from `call_type`:
  - Audio dir: `data/<call_type>/audio/`
  - CSV: `data/<call_type>/transcripts.csv`
- **Transcription prompt**: Load from `config/<call_type>.yaml` → `transcription_prompt` field
- **CSV columns** (metadata only, feature columns added later by extract_features.py):
  - `filename`, `duration_seconds`, `transcript`, `transcribed_at`, `whisper_cost_usd`
- **Idempotent**: Read existing CSV, skip filenames already present
- **Concurrency**: ThreadPoolExecutor with `--workers` flag (default 1). File lock (`threading.Lock`) on CSV appends.
- **Other flags**: `--dry-run`, `--max-files`, `--retry-failed` (same as existing script)

Carry forward from existing script:
- `get_audio_duration()` using ffprobe (lines 102-117)
- `transcribe_file()` with retry logic (lines 120-164)
- `append_to_metadata()` with thread-safe lock (lines 167-176)
- Supported extensions: `.mp3`, `.wav`, `.m4a`, `.webm`, `.mp4`
- Whisper model: `whisper-1`
- Cost calculation: `$0.006/min`
- Progress bar with tqdm

Key difference from existing: transcript text goes into the CSV `transcript` column (not saved as separate .txt file).

**Step 2: Test manually with dry-run**

```bash
cd ~/Documents/HertzCallTranscripts
python scripts/transcribe.py call_centre_outbound --dry-run
```

Expected: "No audio files found" (since audio folder is empty). Verifies the script loads config and resolves paths correctly.

**Step 3: Commit**

```bash
git add scripts/transcribe.py
git commit -m "feat: add transcribe.py for audio-to-CSV transcription"
```

---

## Task 4: Write extract_features.py

**Files:**
- Create: `~/Documents/HertzCallTranscripts/scripts/extract_features.py`

**Step 1: Write the feature extraction script**

This is the core script. Port patterns from `~/Documents/HertzDataAnalysis/scripts/extract_transcript_features.py` with major simplifications:

**CLI**:
- Positional arg: `call_type`
- Flags: `--dry-run`, `--workers` (default 5), `--retry-failed`

**Config loading**:
- Load `config/<call_type>.yaml`
- Extract: `analysis_prompt`, `json_conversion_prompt`, `features`, `json_schema`

**CSV handling** (load-all → process → write-once pattern):
1. Load `data/<call_type>/transcripts.csv` into pandas DataFrame
2. Ensure all feature columns exist (add them if missing, filled with empty strings)
3. Identify rows where `extraction_status` is empty (or `failed` if `--retry-failed`)
4. Fan out API calls concurrently
5. Collect results in a dict keyed by DataFrame index
6. Update DataFrame with results
7. Write entire DataFrame back to CSV once

**Feature columns to add/fill** (derived from YAML config features list):
For each feature in config: `{name}`, `{name}_reasoning`, `{name}_evidence`
Exception: `trust_breaking_verbiage` uses `trust_breaking_phrases` instead of `trust_breaking_verbiage_evidence`
Plus tracking: `extraction_status`, `extracted_at`, `extraction_cost_usd`

**2-step LLM pipeline per transcript**:

Step 1 — call GPT-4o:
```python
messages = [
    {"role": "system", "content": config["analysis_prompt"]},
    {"role": "user", "content": f"Transcript:\n\n{transcript_text}"}
]
```
Returns free-form analysis report.

Step 2 — call GPT-4o-mini with structured output:
```python
messages = [
    {"role": "system", "content": "You convert transcript analysis reports into structured JSON."},
    {"role": "user", "content": config["json_conversion_prompt"].format(analysis_report=report)}
]
response_format = {
    "type": "json_schema",
    "json_schema": {
        "name": "transcript_features",
        "strict": True,
        "schema": config["json_schema"]
    }
}
```
Returns flat JSON. Parse it and map each key to a DataFrame column.

**Retry logic**: Carry forward `call_openai_with_retry()` from existing script (lines 653-694). 3 retries with exponential backoff on connection errors.

**Cost tracking**: Carry forward `calculate_cost()` (lines 645-650). Track Step 1 + Step 2 costs, sum into `extraction_cost_usd`.

**Pricing constants**:
```python
PRICING = {
    "gpt-4o": {"input": 2.50, "output": 10.00},
    "gpt-4o-mini": {"input": 0.15, "output": 0.60},
}
```

**Step 2: Test manually with dry-run**

```bash
python scripts/extract_features.py call_centre_outbound --dry-run
```

Expected: Either "No transcripts found" or shows pending rows count (if transcribe.py has been run).

**Step 3: Commit**

```bash
git add scripts/extract_features.py
git commit -m "feat: add extract_features.py for 2-step LLM feature extraction"
```

---

## Task 5: Create Placeholder Configs for Other 3 Call Types

**Files:**
- Create: `~/Documents/HertzCallTranscripts/config/call_centre_inbound.yaml`
- Create: `~/Documents/HertzCallTranscripts/config/branch_outbound.yaml`
- Create: `~/Documents/HertzCallTranscripts/config/branch_inbound.yaml`

**Step 1: Create placeholder YAML configs**

Each file should have:
- `call_type` and `description` filled in
- `transcription_prompt` — same Hertz context prompt as outbound (Whisper prompt is call-type-agnostic)
- `analysis_prompt` — placeholder: `"TODO: Define analysis prompt for this call type"`
- `json_conversion_prompt` — placeholder: `"TODO: Define JSON conversion prompt for this call type"`
- `features` — empty list: `[]`
- `json_schema` — minimal valid schema: `{type: object, properties: {}, required: [], additionalProperties: false}`

This allows the scripts to load these configs without crashing, while making it clear the prompts/features need to be defined before processing.

**Step 2: Commit**

```bash
git add config/call_centre_inbound.yaml config/branch_outbound.yaml config/branch_inbound.yaml
git commit -m "feat: add placeholder configs for inbound and branch call types"
```

---

## Task 6: End-to-End Smoke Test

**Step 1: Verify full pipeline with dry-run**

```bash
cd ~/Documents/HertzCallTranscripts

# Verify transcribe works for all call types
python scripts/transcribe.py call_centre_outbound --dry-run
python scripts/transcribe.py call_centre_inbound --dry-run
python scripts/transcribe.py branch_outbound --dry-run
python scripts/transcribe.py branch_inbound --dry-run

# Verify extract works for all call types
python scripts/extract_features.py call_centre_outbound --dry-run
python scripts/extract_features.py call_centre_inbound --dry-run
python scripts/extract_features.py branch_outbound --dry-run
python scripts/extract_features.py branch_inbound --dry-run
```

Expected: All 8 commands run without errors. Each reports "No audio files found" or "No transcripts found".

**Step 2: Test with a real audio file (if available)**

Drop one test audio file into `data/call_centre_outbound/audio/` and run:

```bash
python scripts/transcribe.py call_centre_outbound --max-files 1
python scripts/extract_features.py call_centre_outbound
```

Verify:
- `data/call_centre_outbound/transcripts.csv` exists with 1 row
- All 32 columns are present
- Feature columns have values, reasoning, and evidence filled
- `extraction_status` = `success`

**Step 3: Final commit**

```bash
git add -A
git commit -m "chore: verify end-to-end pipeline works"
```

---

## Summary

| Task | What | Files |
|---|---|---|
| 1 | Scaffold project | .gitignore, .env.example, requirements.txt, CLAUDE.md, data dirs |
| 2 | Call centre outbound config | config/call_centre_outbound.yaml |
| 3 | Transcription script | scripts/transcribe.py |
| 4 | Feature extraction script | scripts/extract_features.py |
| 5 | Placeholder configs for other 3 types | config/*.yaml x3 |
| 6 | End-to-end smoke test | Verification only |

Tasks 1-5 are implementation. Task 6 is verification. Total: ~6 commits.
