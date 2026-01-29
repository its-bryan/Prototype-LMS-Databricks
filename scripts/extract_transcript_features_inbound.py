#!/usr/bin/env python3
"""
Inbound Transcript Feature Extraction Script using OpenAI API.

Analyzes INBOUND call transcript files and extracts structured features into JSON format.
Two-step process:
  1. Summarize and analyze transcript (using GPT-5)
  2. Convert analysis to structured JSON (using GPT-5-nano with structured outputs)

Input:  data/audio 2/Transcription_Inbound/*.txt
Output: data/audio 2/JSON_Inbound/*_extracted.json

Usage:
    python scripts/extract_transcript_features_inbound.py              # Process pending files (5 workers)
    python scripts/extract_transcript_features_inbound.py --workers 10 # Use 10 parallel workers
    python scripts/extract_transcript_features_inbound.py --dry-run    # Show what would be processed
    python scripts/extract_transcript_features_inbound.py --retry-failed  # Retry failed extractions

Requires:
    - OPENAI_API_KEY environment variable
"""

import argparse
import csv
import json
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from pathlib import Path
from typing import Any

from openai import APIConnectionError, APITimeoutError, OpenAI
from tqdm import tqdm

# Configuration
ANALYSIS_MODEL = "gpt-5"
JSON_MODEL = "gpt-4o-mini"
MAX_RETRIES = 3
RETRY_DELAY_SECONDS = 2

# Pricing per 1M tokens (USD) - as of late 2025
PRICING = {
    "gpt-5": {"input": 1.25, "output": 10.00},
    "gpt-4o-mini": {"input": 0.15, "output": 0.60},
}

# Metadata
ANALYST = "Halibu A"
PROJECT = "Inbound transcript analysis"

# Paths
PROJECT_ROOT = Path(__file__).parent.parent
TRANSCRIPTIONS_DIR = PROJECT_ROOT / "data" / "audio 2" / "Transcription_Inbound"
OUTPUT_DIR = PROJECT_ROOT / "data" / "audio 2" / "JSON_Inbound"
METADATA_FILE = OUTPUT_DIR / "extraction_metadata.csv"

# CSV columns for tracking
CSV_COLUMNS = [
    "filename",
    "file_size_bytes",
    "word_count",
    "analysis_model",
    "json_model",
    "step1_input_tokens",
    "step1_output_tokens",
    "step1_cost_usd",
    "step2_input_tokens",
    "step2_output_tokens",
    "step2_cost_usd",
    "total_tokens",
    "total_cost_usd",
    "output_file",
    "status",
    "error_message",
    "analyst",
    "processed_at",
]

# Step 1: Analysis prompt for INBOUND calls (open-ended, encourages thinking)
ANALYSIS_SYSTEM_PROMPT = """You are a senior call analyst reviewing inbound calls for Hertz insurance replacement rentals.

IMPORTANT CONTEXT: These calls are recorded at the BRANCH level (local Hertz locations), NOT the central call center. The caller is speaking directly with branch staff, not a call center agent. This means there are no call center → branch transfers; any transfers would be internal (to manager, other staff, another branch, or corporate).

Your task: Read the transcript carefully and write a thorough analytical report. Think through what's happening in the call, who's involved, what they need, and how it resolves.

CRITICAL: First determine if the call was actually answered by a live person. If the call was NOT answered (stuck in IVR, voicemail, no pickup), write a brief 2-3 sentence report noting this and skip the detailed analysis sections. Only write a full report for calls where a real conversation occurred.

Guidelines:
- Write in natural prose paragraphs, not rigid bullet points
- Include verbatim quotes from the transcript as evidence (use quotation marks)
- If something is unclear or not mentioned, say so explicitly
- Redact any PII (names, phone numbers, addresses) with [REDACTED]
- Distinguish between what's explicitly stated vs. what you're inferring
- Note any nuances, ambiguities, or interesting patterns you observe

Output length:
- Unanswered/IVR-stuck calls: 2-3 sentences
- Answered calls: 400-800 words depending on complexity"""

ANALYSIS_USER_PROMPT = """TRANSCRIPT:
{transcript}

---

## ⚠️ STEP 1: CALL ANSWER STATUS (MUST DETERMINE FIRST)

Before anything else, determine if the call was actually answered by a live person:
- **ANSWERED**: A live person (branch staff) responds and has a conversation
- **STUCK IN CALL TREE**: Call ends in automated prompts/IVR without reaching a live person
- **NOT ANSWERED**: Call transfers but no one picks up (ringing, voicemail, "Your call is being transferred" with no response)

**If NOT answered or stuck in call tree**: Write 2-3 sentences noting the status and evidence, then STOP. Do not continue to other sections.

**If ANSWERED**: Continue with the full analysis below.

---

## SECTIONS 2-10 (Only for ANSWERED calls)

**2. CALLER IDENTITY & CONTEXT**
Who is calling? Options: customer (own rental), insurance rep (on behalf of customer), body shop, another Hertz branch, or other. What evidence supports this?

Insurer involved? Branch/location discussed? Write a brief conversation summary (2-4 sentences).

**3. CALL PURPOSE**
Primary reason for calling: create reservation, confirm existing, change something, fix a blocking problem, coordinate pickup/delivery, hours inquiry, payment/deposit, coverage issue, extension, or complaint?

Reservation stage: none exists, exists but unconfirmed, confirmed, or already in rental?

**4. ISSUES & PROBLEMS** (if any)
Any blockers? (reservation not found, wrong location/dates, missing direct bill, coverage mismatch, name mismatch, authorization missing, branch can't honor, vehicle unavailable, transfer loops)

Resolution status and actions taken?

**5. CHANGE REQUESTS** (if any)
Changes requested to existing reservation? (location, pickup time, vehicle class, pickup/delivery service, driver, payment method)

Were changes completed?

**6. PICKUP & DELIVERY**
Pickup requested (Hertz picks them up)? Delivery (car brought to them)? Or self-pickup at branch?

**7. TRANSFERS & ESCALATIONS**
Call transferred? Destinations: manager/supervisor, other staff same branch, different branch, corporate, interpreter.

Did receiving party take over? Warm handoff (introduced) or cold (just transferred)?

**8. CALL OUTCOME**
How did it end? Fully resolved, resolved pending confirmation, partially resolved needs follow-up, not resolved, or cancelled/abandoned?

**9. COMPLAINTS**
Complaints or frustration expressed? About: wait time, service quality, vehicle issues, pricing, availability, location distance, process complexity, branch behavior, communication failures, policy frustration?

**10. HOLD EXPERIENCE**
Caller put on hold? (markers: "please hold", "one moment", "can you hold", "bear with me")

If yes: Timing (beginning vs middle/end)? Reason (checking system, looking up info, consulting colleague, preparing transfer, processing request)? Acknowledged afterward?

---

Note any additional observations or ambiguities worth flagging.

END OF ANALYSIS."""

# JSON Schema for structured output - INBOUND CALLS
JSON_SCHEMA = {
    "type": "object",
    "properties": {
        "A_call_answer_status": {
            "type": "object",
            "properties": {
                "call_status": {
                    "type": "string",
                    "enum": ["answered", "stuck_in_call_tree", "not_answered"]
                },
                "call_status_evidence": {"type": ["string", "null"]}
            },
            "required": ["call_status", "call_status_evidence"],
            "additionalProperties": False
        },
        "B_identity_routing": {
            "type": "object",
            "properties": {
                "caller_type": {
                    "type": "string",
                    "enum": ["customer", "insurer_rep", "body_shop", "hertz_branch", "other"]
                },
                "non_customer_details": {"type": ["string", "null"]},
                "non_customer_details_evidence": {"type": ["string", "null"]},
                "insurer_name": {"type": ["string", "null"]},
                "insurer_name_evidence": {"type": ["string", "null"]},
                "branch_location": {"type": ["string", "null"]},
                "branch_location_evidence": {"type": ["string", "null"]},
                "conversation_summary": {"type": "string"}
            },
            "required": ["caller_type", "non_customer_details", "non_customer_details_evidence",
                         "insurer_name", "insurer_name_evidence", "branch_location", "branch_location_evidence",
                         "conversation_summary"],
            "additionalProperties": False
        },
        "C_intent": {
            "type": "object",
            "properties": {
                "reservation_stage": {
                    "type": ["string", "null"],
                    "enum": ["no_reservation", "reservation_exists_unconfirmed", "reservation_exists_confirmed",
                             "in_rental_already", "unknown", None]
                },
                "reservation_stage_evidence": {"type": ["string", "null"]},
                "primary_intent": {
                    "type": "string",
                    "enum": ["create_reservation", "confirm_reservation", "change_reservation", "repair_issue",
                             "pickup_delivery_coordination", "time_hours_issue", "payment_deposit",
                             "coverage_exception", "extension", "complaint", "other"]
                },
                "primary_intent_evidence": {"type": ["string", "null"]},
                "secondary_intents": {
                    "type": "array",
                    "items": {
                        "type": "string",
                        "enum": ["create_reservation", "confirm_reservation", "change_reservation", "repair_issue",
                                 "pickup_delivery_coordination", "time_hours_issue", "payment_deposit",
                                 "coverage_exception", "extension", "complaint", "other", "none"]
                    }
                },
                "secondary_intents_evidence": {"type": ["string", "null"]}
            },
            "required": ["reservation_stage", "reservation_stage_evidence",
                         "primary_intent", "primary_intent_evidence", "secondary_intents", "secondary_intents_evidence"],
            "additionalProperties": False
        },
        "D_issue_diagnostics": {
            "type": "object",
            "properties": {
                "section_applicable": {"type": "boolean"},
                "issue_present": {"type": ["boolean", "null"]},
                "issue_present_evidence": {"type": ["string", "null"]},
                "issue_types": {
                    "type": "array",
                    "items": {
                        "type": "string",
                        "enum": ["reservation_not_found", "wrong_location", "wrong_dates_times", "direct_bill_missing",
                                 "coverage_mismatch_or_cap", "name_or_driver_mismatch", "authorization_missing",
                                 "branch_refused_or_cant_honor", "vehicle_unavailable", "system_transfer_loop", "other", "none"]
                    }
                },
                "issue_types_evidence": {"type": ["string", "null"]},
                "issue_resolution_status": {
                    "type": ["string", "null"],
                    "enum": ["resolved", "partially_resolved", "not_resolved", "unknown", None]
                },
                "issue_resolution_status_evidence": {"type": ["string", "null"]},
                "resolution_actions": {"type": ["string", "null"]},
                "resolution_actions_evidence": {"type": ["string", "null"]}
            },
            "required": ["section_applicable", "issue_present", "issue_present_evidence", "issue_types", "issue_types_evidence",
                         "issue_resolution_status", "issue_resolution_status_evidence",
                         "resolution_actions", "resolution_actions_evidence"],
            "additionalProperties": False
        },
        "E_change_requests": {
            "type": "object",
            "properties": {
                "section_applicable": {"type": "boolean"},
                "change_requested": {"type": ["boolean", "null"]},
                "change_requested_evidence": {"type": ["string", "null"]},
                "change_types": {
                    "type": "array",
                    "items": {
                        "type": "string",
                        "enum": ["change_location", "change_pickup_time", "change_vehicle_class",
                                 "add_pickup_or_delivery", "change_driver", "change_payment_method", "other", "none"]
                    }
                },
                "change_types_evidence": {"type": ["string", "null"]},
                "change_completed": {"type": ["boolean", "null"]},
                "change_completed_evidence": {"type": ["string", "null"]}
            },
            "required": ["section_applicable", "change_requested", "change_requested_evidence",
                         "change_types", "change_types_evidence", "change_completed", "change_completed_evidence"],
            "additionalProperties": False
        },
        "F_pickup_delivery": {
            "type": "object",
            "properties": {
                "pickup_requested": {"type": ["boolean", "null"]},
                "pickup_requested_evidence": {"type": ["string", "null"]},
                "delivery_requested": {"type": ["boolean", "null"]},
                "delivery_requested_evidence": {"type": ["string", "null"]},
                "self_pickup_only": {"type": ["boolean", "null"]},
                "self_pickup_only_evidence": {"type": ["string", "null"]}
            },
            "required": ["pickup_requested", "pickup_requested_evidence",
                         "delivery_requested", "delivery_requested_evidence",
                         "self_pickup_only", "self_pickup_only_evidence"],
            "additionalProperties": False
        },
        "G_transfers_escalations": {
            "type": "object",
            "properties": {
                "transfer_attempted": {"type": ["boolean", "null"]},
                "transfer_attempted_evidence": {"type": ["string", "null"]},
                "transfer_destination": {
                    "type": ["string", "null"],
                    "enum": ["manager_supervisor", "other_staff_same_branch", "other_branch", "corporate_central", "interpreter", "unknown", None]
                },
                "transfer_destination_evidence": {"type": ["string", "null"]},
                "transfer_successful": {"type": ["boolean", "null"]},
                "transfer_successful_evidence": {"type": ["string", "null"]},
                "transfer_type": {
                    "type": ["string", "null"],
                    "enum": ["warm", "cold", "unknown", None]
                },
                "transfer_type_evidence": {"type": ["string", "null"]}
            },
            "required": ["transfer_attempted", "transfer_attempted_evidence",
                         "transfer_destination", "transfer_destination_evidence",
                         "transfer_successful", "transfer_successful_evidence",
                         "transfer_type", "transfer_type_evidence"],
            "additionalProperties": False
        },
        "H_outcome": {
            "type": "object",
            "properties": {
                "call_outcome": {
                    "type": ["string", "null"],
                    "enum": ["resolved_and_ready", "resolved_but_pending_branch_or_inventory",
                             "partially_resolved_needs_followup", "not_resolved", "canceled_or_abandoned", None]
                },
                "call_outcome_evidence": {"type": ["string", "null"]},
                "cancellation_abandonment": {"type": ["boolean", "null"]},
                "cancellation_abandonment_evidence": {"type": ["string", "null"]}
            },
            "required": ["call_outcome", "call_outcome_evidence",
                         "cancellation_abandonment", "cancellation_abandonment_evidence"],
            "additionalProperties": False
        },
        "I_complaints": {
            "type": "object",
            "properties": {
                "complaint_raised": {"type": ["boolean", "null"]},
                "complaint_raised_evidence": {"type": ["string", "null"]},
                "complaint_types": {
                    "type": "array",
                    "items": {
                        "type": "string",
                        "enum": ["wait_time", "service_quality", "vehicle_issues", "pricing", "availability",
                                 "location_too_far", "process_complexity", "branch_behavior",
                                 "communication_failure", "policy_frustration", "other", "none"]
                    }
                },
                "complaint_types_evidence": {"type": ["string", "null"]},
                "complaint_details": {"type": ["string", "null"]},
                "complaint_details_evidence": {"type": ["string", "null"]}
            },
            "required": ["complaint_raised", "complaint_raised_evidence",
                         "complaint_types", "complaint_types_evidence",
                         "complaint_details", "complaint_details_evidence"],
            "additionalProperties": False
        },
        "J_hold_experience": {
            "type": "object",
            "properties": {
                "hold_occurred": {"type": ["boolean", "null"]},
                "hold_occurred_evidence": {"type": ["string", "null"]},
                "hold_timing": {
                    "type": ["string", "null"],
                    "enum": ["beginning", "middle_end", None]
                },
                "hold_timing_evidence": {"type": ["string", "null"]},
                "hold_reason": {
                    "type": ["string", "null"],
                    "enum": ["checking_system", "looking_up_info", "consulting_colleague_manager",
                             "preparing_transfer", "processing_request", "other", "unknown", None]
                },
                "hold_reason_evidence": {"type": ["string", "null"]},
                "hold_acknowledged": {"type": ["boolean", "null"]},
                "hold_acknowledged_evidence": {"type": ["string", "null"]}
            },
            "required": ["hold_occurred", "hold_occurred_evidence",
                         "hold_timing", "hold_timing_evidence",
                         "hold_reason", "hold_reason_evidence",
                         "hold_acknowledged", "hold_acknowledged_evidence"],
            "additionalProperties": False
        }
    },
    "required": ["A_call_answer_status", "B_identity_routing", "C_intent",
                 "D_issue_diagnostics", "E_change_requests", "F_pickup_delivery",
                 "G_transfers_escalations", "H_outcome", "I_complaints", "J_hold_experience"],
    "additionalProperties": False
}

# Step 2: JSON conversion prompt (classification logic lives here)
JSON_CONVERSION_PROMPT = """You are converting a free-form call analysis report into structured JSON.

The analysis report below was written by an analyst who reviewed an inbound call transcript. Your job is to:
1. Read the analysis carefully
2. Extract information into the JSON schema
3. Apply the classification rules below to map descriptions to enum values

IMPORTANT RULES:
- Only extract what's in the analysis - do not infer beyond what's written
- If the analysis says something is "unclear" or "not mentioned", use null
- Use the STRICT classification rules below to choose enum values
- For evidence fields: extract ONLY the quoted text (text inside quotation marks from the analysis), not the surrounding context. Example: if analysis says 'The caller mentioned "I need it today"', the evidence should be "I need it today"
- For arrays: include all applicable items, or empty array [] if none apply

CLASSIFICATION RULES BY SECTION:

A_call_answer_status:
  IMPORTANT: This must be determined FIRST before other sections.
  - call_status: MUST be one of:
      "answered" ← A live person (branch staff) responds and has a conversation
      "stuck_in_call_tree" ← Call ends in automated prompts/IVR without reaching a live person
      "not_answered" ← Call transfers but no one picks up (ringing, voicemail, "Your call is being transferred" with no response)
  - call_status_evidence: quote showing status, e.g., "Thank you for calling Hertz, how can I help you?" for answered, or "Your call is being transferred" for not_answered

  NOTE: If call_status is "stuck_in_call_tree" or "not_answered", sections B through J should have minimal/null values as there was no real conversation.

B_identity_routing:
  - caller_type: MUST be one of (use STRICT identification rules):
      "customer" ← individual calling about their own rental. Markers: First-person references ("my accident", "I need a rental", "I was in a crash")
      "insurer_rep" ← insurance company representative. Markers: "I'm calling on behalf of", "This is [name] from [insurance]", "I'm a claims adjuster"
      "body_shop" ← auto body shop calling about a customer. Markers: "We have a customer", "We're sending a customer your way"
      "hertz_branch" ← another Hertz location calling. Markers: "This is [location] branch calling"
      "other" ← none of the above
  - non_customer_details: "Claims adjuster from State Farm", "Service advisor from ABC Body Shop", null (if customer)
  - non_customer_details_evidence: quote identifying who they are, null if customer
  - insurer_name: "State Farm", "Geico", "Progressive", "Allstate", null (if not mentioned)
  - insurer_name_evidence: quote or null
  - branch_location: "LAX Airport", "Downtown Chicago", "Springfield Main St", null (if not mentioned)
  - branch_location_evidence: quote or null
  - conversation_summary: Brief summary of the conversation (2-4 sentences)

C_intent:
  - reservation_stage: reservation status when call begins:
      "no_reservation" ← no reservation exists yet
      "reservation_exists_unconfirmed" ← reservation exists but not confirmed/finalized
      "reservation_exists_confirmed" ← reservation confirmed and ready
      "in_rental_already" ← customer currently has the rental car
      "unknown" ← can't determine from transcript
  - reservation_stage_evidence: quote or null
  - primary_intent: MUST be one of (choose the MAIN reason for calling):
      "create_reservation" ← setting up NEW rental from scratch
      "confirm_reservation" ← checking details of EXISTING reservation, no changes needed
      "change_reservation" ← modifying dates, location, vehicle, driver on existing reservation
      "repair_issue" ← something is WRONG with existing reservation that BLOCKS progress
      "pickup_delivery_coordination" ← arranging HOW to get the car
      "time_hours_issue" ← questions about branch hours/timing
      "payment_deposit" ← discussion of deposit, payment methods
      "coverage_exception" ← coverage limits, daily caps, policy constraints
      "extension" ← extending CURRENT rental duration
      "complaint" ← PRIMARY purpose is to complain
      "other" ← none of the above
  - primary_intent_evidence: quote showing main purpose, null
  - secondary_intents: array of additional intents, or ["none"] if only one intent
  - secondary_intents_evidence: quote or null

D_issue_diagnostics:
  CONDITIONAL: section_applicable = true ONLY if primary or secondary intent includes "repair_issue"
  If section_applicable = false, set all other fields to null

  - section_applicable: true | false
  - issue_present: true | false | null
  - issue_present_evidence: quote or null
  - issue_types: select ALL that apply:
      ["reservation_not_found"] | ["wrong_location"] | ["wrong_dates_times"] | ["direct_bill_missing"] |
      ["coverage_mismatch_or_cap"] | ["name_or_driver_mismatch"] | ["authorization_missing"] |
      ["branch_refused_or_cant_honor"] | ["vehicle_unavailable"] | ["system_transfer_loop"] | ["other"] | ["none"]
  - issue_types_evidence: quote or null
  - issue_resolution_status: "resolved" | "partially_resolved" | "not_resolved" | "unknown" | null
  - issue_resolution_status_evidence: quote or null
  - resolution_actions: "Agent updated the reservation dates", "Agent added direct bill", null
  - resolution_actions_evidence: quote or null

E_change_requests:
  CONDITIONAL: section_applicable = true ONLY if primary or secondary intent includes "change_reservation"
  If section_applicable = false, set all other fields to null

  - section_applicable: true | false
  - change_requested: true | false | null
  - change_requested_evidence: quote or null
  - change_types: select ALL that apply:
      ["change_location"] | ["change_pickup_time"] | ["change_vehicle_class"] |
      ["add_pickup_or_delivery"] | ["change_driver"] | ["change_payment_method"] | ["other"] | ["none"]
  - change_types_evidence: quote or null
  - change_completed: true | false | null
  - change_completed_evidence: quote or null

F_pickup_delivery:
  - pickup_requested: true | false | null
  - pickup_requested_evidence: "Can someone pick me up?", null
  - delivery_requested: true | false | null
  - delivery_requested_evidence: "Can you deliver the car?", null
  - self_pickup_only: true (will come to branch), false, null
  - self_pickup_only_evidence: "I'll come to the branch", null

G_transfers_escalations:
  NOTE: These are BRANCH-LEVEL calls. Transfers are internal (within branch or to other Hertz entities).

  - transfer_attempted: true | false | null
  - transfer_attempted_evidence: "Let me get my manager", null
  - transfer_destination (if transfer_attempted = false, MUST be null):
      "manager_supervisor" | "other_staff_same_branch" | "other_branch" | "corporate_central" | "interpreter" | "unknown" | null
  - transfer_destination_evidence: quote or null
  - transfer_successful: true | false | null
  - transfer_successful_evidence: quote or null
  - transfer_type (if transfer_attempted = false, MUST be null):
      "warm" ← agent introduces caller to receiving party
      "cold" ← caller transferred directly without introduction
      "unknown" | null
  - transfer_type_evidence: quote or null

H_outcome:
  - call_outcome: MUST be one of:
      "resolved_and_ready" ← customer has ALL info needed, can proceed
      "resolved_but_pending_branch_or_inventory" ← waiting on confirmation
      "partially_resolved_needs_followup" ← some progress but not complete
      "not_resolved" ← no material progress made
      "canceled_or_abandoned" ← cancellation or call ended abruptly
  - call_outcome_evidence: quote or null
  - cancellation_abandonment: true | false | null
  - cancellation_abandonment_evidence: "Let me cancel that", null

I_complaints:
  - complaint_raised: true | false | null
  - complaint_raised_evidence: quote or null
  - complaint_types: select ALL that apply:
      ["wait_time"] | ["service_quality"] | ["vehicle_issues"] | ["pricing"] | ["availability"] |
      ["location_too_far"] | ["process_complexity"] | ["branch_behavior"] |
      ["communication_failure"] | ["policy_frustration"] | ["other"] | ["none"]
  - complaint_types_evidence: quote or null
  - complaint_details: brief description, null if none
  - complaint_details_evidence: quote or null

J_hold_experience:
  - hold_occurred: true | false | null
      Markers: "please hold", "one moment", "can you hold", "let me put you on hold", "hold on", "bear with me"
  - hold_occurred_evidence: "Can you hold for just a moment?", null
  - hold_timing (if hold_occurred = false, MUST be null):
      "beginning" ← hold at START of call, before conversation
      "middle_end" ← hold DURING/AFTER conversation started
      null
  - hold_timing_evidence: quote or null
  - hold_reason (if hold_occurred = false, MUST be null):
      "checking_system" | "looking_up_info" | "consulting_colleague_manager" |
      "preparing_transfer" | "processing_request" | "other" | "unknown" | null
  - hold_reason_evidence: quote or null
  - hold_acknowledged: true | false | null
      Markers: "thanks for holding", "sorry for the wait", "appreciate your patience"
  - hold_acknowledged_evidence: quote or null

Analysis Report:
{analysis_report}"""


def get_transcript_files() -> list[Path]:
    """Get all transcript files from the transcriptions directory."""
    if not TRANSCRIPTIONS_DIR.exists():
        return []

    files = list(TRANSCRIPTIONS_DIR.glob("*.txt"))
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


def append_to_metadata(row: dict) -> None:
    """Append a single row to metadata.csv (creates file if needed)."""
    file_exists = METADATA_FILE.exists()

    with open(METADATA_FILE, "a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_COLUMNS)
        if not file_exists:
            writer.writeheader()
        writer.writerow(row)


def calculate_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    """Calculate cost in USD for given token counts."""
    pricing = PRICING.get(model, {"input": 0, "output": 0})
    input_cost = (input_tokens / 1_000_000) * pricing["input"]
    output_cost = (output_tokens / 1_000_000) * pricing["output"]
    return input_cost + output_cost


def call_openai_with_retry(
    client: OpenAI,
    messages: list[dict],
    model: str,
    response_format: dict | None = None
) -> tuple[str, int, int]:
    """
    Call OpenAI API with retry logic.

    Returns:
        tuple: (response_content, input_tokens, output_tokens)
    """
    last_error = None

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            kwargs = {
                "model": model,
                "messages": messages,
                "temperature": 1,
            }
            if response_format:
                kwargs["response_format"] = response_format

            response = client.chat.completions.create(**kwargs)

            content = response.choices[0].message.content
            input_tokens = response.usage.prompt_tokens
            output_tokens = response.usage.completion_tokens

            return content, input_tokens, output_tokens

        except (APIConnectionError, APITimeoutError, ConnectionError) as e:
            last_error = e
            if attempt < MAX_RETRIES:
                delay = RETRY_DELAY_SECONDS * (2 ** (attempt - 1))
                print(f"  Connection error (attempt {attempt}/{MAX_RETRIES}), retrying in {delay}s...")
                time.sleep(delay)
            else:
                print(f"  Failed after {MAX_RETRIES} attempts")

    raise last_error


def step1_analyze_transcript(client: OpenAI, transcript_text: str) -> tuple[str, int, int]:
    """
    Step 1: Analyze inbound transcript and generate comprehensive report.

    Returns:
        tuple: (analysis_report, input_tokens, output_tokens)
    """
    messages = [
        {"role": "system", "content": ANALYSIS_SYSTEM_PROMPT},
        {"role": "user", "content": ANALYSIS_USER_PROMPT.format(transcript=transcript_text)}
    ]

    return call_openai_with_retry(client, messages, ANALYSIS_MODEL)


def step2_convert_to_json(client: OpenAI, analysis_report: str) -> tuple[dict[str, Any], int, int]:
    """
    Step 2: Convert analysis report to structured JSON.

    Returns:
        tuple: (json_data, input_tokens, output_tokens)
    """
    messages = [
        {"role": "system", "content": "You convert inbound call transcript analysis reports into structured JSON."},
        {"role": "user", "content": JSON_CONVERSION_PROMPT.format(analysis_report=analysis_report)}
    ]

    response_format = {
        "type": "json_schema",
        "json_schema": {
            "name": "inbound_transcript_features",
            "strict": True,
            "schema": JSON_SCHEMA
        }
    }

    content, input_tokens, output_tokens = call_openai_with_retry(client, messages, JSON_MODEL, response_format)

    # Parse JSON response
    json_data = json.loads(content)

    return json_data, input_tokens, output_tokens


def process_file(client: OpenAI, file_path: Path, dry_run: bool = False) -> bool:
    """
    Process a single transcript file.

    Returns:
        bool: True if successful, False if failed
    """
    filename = file_path.name
    file_size = file_path.stat().st_size

    # Read transcript
    try:
        transcript_text = file_path.read_text(encoding="utf-8")
        word_count = len(transcript_text.split())
    except Exception as e:
        print(f"  Error reading file: {e}")
        if not dry_run:
            append_to_metadata({
                "filename": filename,
                "file_size_bytes": file_size,
                "word_count": "",
                "analysis_model": ANALYSIS_MODEL,
                "json_model": JSON_MODEL,
                "step1_input_tokens": "",
                "step1_output_tokens": "",
                "step1_cost_usd": "",
                "step2_input_tokens": "",
                "step2_output_tokens": "",
                "step2_cost_usd": "",
                "total_tokens": "",
                "total_cost_usd": "",
                "output_file": "",
                "status": "failed",
                "error_message": f"Could not read file: {e}",
                "analyst": ANALYST,
                "processed_at": datetime.now().isoformat(),
            })
        return False

    output_filename = file_path.stem + "_extracted.json"
    output_path = OUTPUT_DIR / output_filename

    if dry_run:
        print(f"  Words: {word_count}, Output: {output_filename}")
        return True

    # Step 1: Analyze transcript
    print(f"  Step 1: Analyzing inbound transcript...")
    try:
        analysis_report, step1_in, step1_out = step1_analyze_transcript(client, transcript_text)
        step1_cost = calculate_cost(ANALYSIS_MODEL, step1_in, step1_out)
    except Exception as e:
        print(f"  Step 1 failed: {e}")
        append_to_metadata({
            "filename": filename,
            "file_size_bytes": file_size,
            "word_count": word_count,
            "analysis_model": ANALYSIS_MODEL,
            "json_model": JSON_MODEL,
            "step1_input_tokens": "",
            "step1_output_tokens": "",
            "step1_cost_usd": "",
            "step2_input_tokens": "",
            "step2_output_tokens": "",
            "step2_cost_usd": "",
            "total_tokens": "",
            "total_cost_usd": "",
            "output_file": "",
            "status": "failed",
            "error_message": f"Step 1 failed: {e}",
            "analyst": ANALYST,
            "processed_at": datetime.now().isoformat(),
        })
        return False

    step1_total = step1_in + step1_out
    print(f"  Step 1 complete ({step1_total} tokens, ${step1_cost:.4f})")

    # Step 2: Convert to JSON
    print(f"  Step 2: Converting to JSON...")
    try:
        json_data, step2_in, step2_out = step2_convert_to_json(client, analysis_report)
        step2_cost = calculate_cost(JSON_MODEL, step2_in, step2_out)
    except Exception as e:
        print(f"  Step 2 failed: {e}")
        append_to_metadata({
            "filename": filename,
            "file_size_bytes": file_size,
            "word_count": word_count,
            "analysis_model": ANALYSIS_MODEL,
            "json_model": JSON_MODEL,
            "step1_input_tokens": step1_in,
            "step1_output_tokens": step1_out,
            "step1_cost_usd": f"{step1_cost:.6f}",
            "step2_input_tokens": "",
            "step2_output_tokens": "",
            "step2_cost_usd": "",
            "total_tokens": "",
            "total_cost_usd": "",
            "output_file": "",
            "status": "failed",
            "error_message": f"Step 2 failed: {e}",
            "analyst": ANALYST,
            "processed_at": datetime.now().isoformat(),
        })
        return False

    step2_total = step2_in + step2_out
    print(f"  Step 2 complete ({step2_total} tokens, ${step2_cost:.4f})")

    # Save JSON output
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(json_data, f, indent=2)

    total_tokens = step1_total + step2_total
    total_cost = step1_cost + step2_cost

    # Record success
    append_to_metadata({
        "filename": filename,
        "file_size_bytes": file_size,
        "word_count": word_count,
        "analysis_model": ANALYSIS_MODEL,
        "json_model": JSON_MODEL,
        "step1_input_tokens": step1_in,
        "step1_output_tokens": step1_out,
        "step1_cost_usd": f"{step1_cost:.6f}",
        "step2_input_tokens": step2_in,
        "step2_output_tokens": step2_out,
        "step2_cost_usd": f"{step2_cost:.6f}",
        "total_tokens": total_tokens,
        "total_cost_usd": f"{total_cost:.6f}",
        "output_file": output_filename,
        "status": "success",
        "error_message": "",
        "analyst": ANALYST,
        "processed_at": datetime.now().isoformat(),
    })

    print(f"  Done ({total_tokens} tokens, ${total_cost:.4f}) -> {output_filename}")
    return True


def main():
    parser = argparse.ArgumentParser(
        description="Extract features from INBOUND transcript files using OpenAI API"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be processed without making API calls",
    )
    parser.add_argument(
        "--retry-failed",
        action="store_true",
        help="Retry previously failed extractions",
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=5,
        help="Number of parallel workers (default: 5)",
    )
    args = parser.parse_args()

    # Check API key
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key and not args.dry_run:
        print("Error: OPENAI_API_KEY environment variable not set")
        sys.exit(1)

    # Ensure directories exist
    TRANSCRIPTIONS_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Get transcript files and processed files
    all_files = get_transcript_files()
    processed = load_processed_files()

    if not all_files:
        print(f"No transcript files found in {TRANSCRIPTIONS_DIR}")
        sys.exit(0)

    # Determine which files to process
    if args.retry_failed:
        failed_filenames = {
            fname for fname, data in processed.items()
            if data["status"] == "failed"
        }
        pending_files = [f for f in all_files if f.name in failed_filenames]
    else:
        pending_files = [f for f in all_files if f.name not in processed]

    # Summary
    print(f"INBOUND Transcript Feature Extraction")
    print(f"Analyst: {ANALYST}")
    print(f"Project: {PROJECT}")
    print(f"{'='*50}")
    print(f"Transcript files found: {len(all_files)}")
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

    # Process files in parallel
    num_workers = min(args.workers, len(pending_files))
    print(f"\nProcessing {len(pending_files)} file(s) with {num_workers} workers...")
    success_count = 0

    with ThreadPoolExecutor(max_workers=num_workers) as executor:
        # Submit all tasks
        future_to_file = {
            executor.submit(process_file, client, file_path): file_path
            for file_path in pending_files
        }

        # Process as they complete
        for future in tqdm(as_completed(future_to_file), total=len(pending_files), desc="Extracting features"):
            file_path = future_to_file[future]
            try:
                if future.result():
                    success_count += 1
            except Exception as e:
                print(f"\n{file_path.name} failed with exception: {e}")

    # Final summary
    print(f"\n{'='*50}")
    print(f"Completed: {success_count}/{len(pending_files)} files")
    print(f"Output directory: {OUTPUT_DIR}")
    print(f"Metadata saved to: {METADATA_FILE}")


if __name__ == "__main__":
    main()
