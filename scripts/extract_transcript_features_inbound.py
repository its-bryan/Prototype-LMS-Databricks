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
JSON_MODEL = "gpt-5-nano"
MAX_RETRIES = 3
RETRY_DELAY_SECONDS = 2

# Pricing per 1M tokens (USD) - as of late 2025
PRICING = {
    "gpt-5": {"input": 1.25, "output": 10.00},
    "gpt-5-nano": {"input": 0.05, "output": 0.40},
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

# Step 1: Analysis prompt for INBOUND calls
ANALYSIS_SYSTEM_PROMPT = """You are a senior call analyst. Your task is to read a single inbound call transcript for Hertz insurance replacement rentals and extract structured answers in natural language.
Do NOT output JSON. Do NOT use code blocks. Do NOT invent facts.

Rules:
1) Answer every question below. If not mentioned, write: "Not mentioned / cannot determine."
2) Separate explicit facts from inference. Only infer when strongly supported.
3) For every non-null answer, include 1–3 short Evidence quotes (≤20 words each) copied from the transcript.
4) Remove personal identifying information (names, phone numbers, emails, addresses). If present, redact with [REDACTED].
5) Keep output concise but complete. Use the exact section headers and bullet labels."""

ANALYSIS_USER_PROMPT = """TRANSCRIPT:
{transcript}

OUTPUT FORMAT (MANDATORY):

A) Identity & routing context
- Caller type (customer / insurer rep / body shop / Hertz branch / other): [answer]
  (STRICT identification rules:
    • customer: First-person references about their own rental/accident ("my accident", "I need a rental", "I was in a crash")
    • insurer_rep: "I'm calling on behalf of", "This is [name] from [insurance company]", "I'm a claims adjuster"
    • body_shop: "We have a customer", "We're sending a customer your way", "This is [name] from [body shop name]"
    • hertz_branch: "This is [location] branch calling", "I'm calling from Hertz [location]"
    • other: None of the above)
  Evidence:
  - "[quote]"
- If caller is NOT customer, who are they and what organization do they claim? [answer]
  Evidence:
  - "[quote]"
- Insurer name mentioned (if any): [answer]
  Evidence:
  - "[quote]"
- Branch/location mentioned (if any): [answer]
  Evidence:
  - "[quote]"
- Reservation or claim reference present? (yes/no/unclear): [answer]
  Evidence:
  - "[quote]"
- Reference type (reservation number / claim number / both / none / unknown): [answer]
  (Reservation numbers follow Hertz format ###-####### e.g., 037-9974148.
   Claim numbers vary by insurer - examples: State Farm "CLM-XXXXXXX", Geico "GCXXXXXXX", Progressive "PRXXXXXXX".
   If unsure, look for context: "reservation" vs "claim" mentioned alongside the number.)
  Evidence:
  - "[quote]"
- Is the customer's car non-driveable after the accident? (true/false/unclear): [answer]
  (Look for: "totaled", "can't drive it", "not driveable", "undriveable", "car won't start", "too damaged to drive")
  Evidence:
  - "[quote]"
- Conversation summary: [answer]
  If CUSTOMER caller (2-4 sentences): reason for calling, key issues, resolution, next steps.
  If NON-CUSTOMER caller (4-6 sentences): who is calling and from what organization, which customer/reservation/claim this concerns, purpose of call, what action they are requesting, any issues or blockers discussed, outcome and next steps.
  (Remove all PII)

B) Inbound intent & whether this is first contact
- Reservation stage (choose ONE):
  no_reservation | reservation_exists_unconfirmed | reservation_exists_confirmed | in_rental_already | unknown
  [answer]
  (Stage definitions:
    • no_reservation: No reservation exists yet for this customer/claim
    • reservation_exists_unconfirmed: Reservation created but missing key details (dates, direct bill, authorization)
    • reservation_exists_confirmed: Reservation complete and ready for pickup
    • in_rental_already: Customer currently has the rental car
    • unknown: Cannot determine from transcript)
  Evidence:
  - "[quote]"
- Primary intent (choose ONE):
  create_reservation | confirm_reservation | change_reservation | repair_issue | pickup_delivery_coordination | time_hours_issue | payment_deposit | coverage_exception | extension | complaint | other
  [answer]
  (Decision logic - choose based on MAIN purpose:
    • create_reservation: Setting up a NEW rental from scratch
    • confirm_reservation: Checking details of EXISTING reservation, no changes needed
    • change_reservation: Modifying dates, location, vehicle, driver on existing reservation
    • repair_issue: Something is WRONG with existing reservation that BLOCKS progress (missing direct bill, reservation not found, authorization issues)
    • pickup_delivery_coordination: Arranging HOW to get the car (pickup service, delivery logistics)
    • time_hours_issue: Questions about branch hours/timing, NOT blocking the reservation
    • payment_deposit: Explicit discussion of deposit amount, payment methods, financial requirements
    • coverage_exception: Coverage limits, daily caps, airport exclusions - policy constraints
    • extension: Extending CURRENT rental duration
    • complaint: PRIMARY purpose is to complain about service/experience
    • other: None of the above)
  Evidence:
  - "[quote]"
- Secondary intents (choose any that apply from same list): [answer]
  Evidence:
  - "[quote]"
- Is this first contact by the caller? (true/false/unclear): [answer]
  (Identification markers:
    • true (first contact): "This is my first call", no references to prior calls, fresh inquiry
    • false (follow-up): "I was told to call back", "I called earlier", "As I mentioned last time", "This is my third call", "The person I spoke to said..."
    • unclear: No temporal references either way)
  Evidence:
  - "[quote]"
- Lead source reference (referred by insurance / referred by body shop / self initiated / unknown): [answer]
  Evidence:
  - "[quote]"

C) Issue diagnostics (ONLY if primary or secondary intent includes repair_issue; otherwise write "Not applicable")
- Issue present? (true/false/unclear): [answer]
  Evidence:
  - "[quote]"
- Issue types (select ALL that apply from list):
  reservation_not_found | wrong_location | wrong_dates_times | direct_bill_missing | coverage_mismatch_or_cap |
  name_or_driver_mismatch | authorization_missing | branch_refused_or_cant_honor | vehicle_unavailable | system_transfer_loop | other
  [answer]
  (SPECIFIC issue markers:
    • reservation_not_found: "I can't find your reservation", "no reservation under that name/number"
    • wrong_location: Reservation at incorrect branch
    • wrong_dates_times: Dates or times don't match what customer expected
    • direct_bill_missing: "No direct bill on file", "insurance billing not set up"
    • coverage_mismatch_or_cap: Customer expected X coverage but policy says Y; OR daily rate capped at $30 but customer needs $50/day vehicle
    • name_or_driver_mismatch: Wrong name on reservation, additional driver issues
    • authorization_missing: "No authorization from insurance", "claim not approved yet"
    • branch_refused_or_cant_honor: Branch says "we won't do that" (refused) OR "we don't have availability" (can't honor)
    • vehicle_unavailable: Requested vehicle class not available at location
    • system_transfer_loop: Caller says "I was transferred 3 times", "Everyone tells me to call someone else" - NOT single transfer
    • other: Issue doesn't fit above categories)
  Evidence:
  - "[quote]"
- Who reported issue? (customer / agent / branch / insurer / body shop / unknown): [answer]
  (Identification markers:
    • customer: "I noticed...", "I realized...", "There's a problem with my..."
    • agent: "I'm seeing in the system...", "I found an issue...", "It looks like..."
    • branch: "The branch told me...", "They said...", "The location reported..."
    • insurer: "Insurance flagged...", "Your insurer said..."
    • body_shop: "The body shop mentioned...", "They called and said...")
  Evidence:
  - "[quote]"
- Issue resolution status (resolved / partially_resolved / not_resolved / unknown): [answer]
  Evidence:
  - "[quote]"
- What was done to resolve it (brief): [answer]
  Evidence:
  - "[quote]"

D) Change requests (ONLY if primary or secondary intent includes change_reservation; otherwise "Not applicable")
- Change requested? (true/false/unclear): [answer]
  Evidence:
  - "[quote]"
- Change types (select ALL that apply):
  change_location | change_pickup_time | change_vehicle_class | add_pickup_or_delivery | change_driver | change_payment_method | other
  [answer]
  Evidence:
  - "[quote]"
- Change completed successfully? (true/false/unclear): [answer]
  Evidence:
  - "[quote]"

E) Time & feasibility
- Timing need category (choose ONE):
  same_day_today | this_week | next_week | scheduled_specific | unsure | no_urgency
  [answer]
  (STRICT timing classification:
    • same_day_today: "today", "ASAP", "right now", "this afternoon", "this morning", "tonight" (if said during business hours)
      NOTE: If call is at 11pm and customer says "tonight", that's NEXT calendar day, use this_week
    • this_week: "tomorrow", "in a couple days", "this week", "day after tomorrow"
    • next_week: "next week", "next Monday", "in a week"
    • scheduled_specific: Named future date ("January 15th", "next Wednesday the 20th")
    • unsure: "I'm not sure", "whenever", "flexible", "I don't know yet"
    • no_urgency: No time pressure expressed, no timing discussed)
  Evidence:
  - "[quote]"
- Hours/deadlines mentioned? (true/false/unclear): [answer]
  (true: Agent mentions "we close at X", "you must arrive by X", "we open at X"
   false: No time constraints discussed
   unclear: Vague reference like "during business hours")
  Evidence:
  - "[quote]"
- Time feasible under rules? (true/false/unclear): [answer]
  Evidence:
  - "[quote]"
- Infeasibility reasons (select ALL that apply if not feasible):
  branch_closed | closing_soon | weekend_closure | before_open | notice_window_missed | other
  [answer]
  Evidence:
  - "[quote]"
- Stranded risk language used? (true/false/unclear): [answer]
  (STRICT - true ONLY if caller says they will be UNABLE/STUCK without this rental:
    • true: "I'll be stuck", "I'll be stranded", "no way to get anywhere", "I'll have no car", "no other transportation"
    • false: Customer doesn't express being stranded
    • NOT stranded risk: "I need it for work", "I don't have another car" - these are just stating need, not expressing being stuck)
  Evidence:
  - "[quote]"

F) Pickup / delivery coordination
- Pickup requested? (true/false/unclear): [answer]
  Evidence:
  - "[quote]"
- Delivery requested? (true/false/unclear): [answer]
  Evidence:
  - "[quote]"
- Self-pickup only? (true/false/unclear): [answer]
  Evidence:
  - "[quote]"
- Policy constraints mentioned (select ALL that apply):
  lead_time_required | radius_limit | depends_on_drivers | must_contact_branch_directly | option_5_instruction | other
  [answer]
  Evidence:
  - "[quote]"
- Caller logistics anxiety present? (true/false/unclear): [answer]
  (STRICT - anxiety = expressed WORRY about getting to/getting the car, not just a request:
    • true: "How will I get there?", "How am I supposed to get the car?", "I'm worried about getting there", "I don't have a ride"
    • false: Simple request without worry expressed ("Can you deliver?", "Do you offer pickup?", "I'll come to the branch")
    • NOT anxiety: Just asking about options is NOT anxiety)
  Evidence:
  - "[quote]"

G) Transfers & reachability
- Transfer attempted? (true/false/unclear): [answer]
  Evidence:
  - "[quote]"
- Interpreter transfer during call? (true/false/unclear): [answer]
  Evidence:
  - "[quote]"
- Branch contact attempted? (true/false/unclear): [answer]
  (STRICT: Only true if agent actually CALLS the branch during this call - you hear agent say "Let me call the branch", "I'm calling them now", or similar.
   NOT true if agent only provides the branch phone number or tells caller to call the branch themselves.)
  Evidence:
  - "[quote]"
- Branch reachable? (true/false/unclear): [answer]
  (true: Branch answered the call. false: Branch didn't answer. unclear: Cannot determine.)
  Evidence:
  - "[quote]"
- Transfer type (warm / cold / unknown): [answer]
  (SPECIFIC observable markers:
    • WARM: Agent is heard conversing with another Hertz agent, discussing "I have a customer for you", "I have a lead for you", and that Hertz agent takes over the conversation. You will hear BOTH agents talking.
    • COLD: Agent says they will transfer and the call ends shortly after with the automated message "Thank you for calling HERTZ Car Rental. For faster service options, please visit our website at www.hertz.com or use the HERTZ app"
    • unknown: Transfer occurred but type cannot be determined from transcript
    • null: No transfer attempted - if transfer_attempted = false, this MUST be null)
  Evidence:
  - "[quote]"

H) Outcome & effort
- Call outcome (choose ONE):
  resolved_and_ready | resolved_but_pending_branch_or_inventory | partially_resolved_needs_followup |
  not_resolved | canceled_or_abandoned
  [answer]
  (Decision tree:
    • resolved_and_ready: Reservation confirmed, customer has ALL info needed, can proceed to pickup
    • resolved_but_pending_branch_or_inventory: Reservation details finalized BUT waiting on branch to confirm availability, inventory check, or insurer final approval
    • partially_resolved_needs_followup: SOME progress made but NOT fully resolved (e.g., reservation created but dates wrong, issue identified but not fixed)
    • not_resolved: Call ended with issue UNRESOLVED, no material progress made
    • canceled_or_abandoned: Explicit cancellation requested OR call ended abruptly without resolution)
  Evidence:
  - "[quote]"
- Post-call actions required (list each action): [answer]
  Evidence:
  - "[quote]"
- Actions required count (integer or not mentioned): [answer]
- Effort burden (low / medium / high): [answer]
  (SPECIFIC criteria:
    • low: 0-1 clear actions, no preconditions. Example: "Just pick up between 9-5"
    • medium: 2-3 actions OR 1 action with conditions. Example: "Call branch to confirm, bring ID, arrive by 5pm"
    • high: 4+ actions OR multiple preconditions OR unclear/complex requirements. Example: "Call branch, get confirmation code, bring two forms of ID, insurer approval needed, only valid 9am-11am weekdays")
  Evidence:
  - "[quote]"
- Cancellation/abandonment during call? (true/false/unclear): [answer]
  Evidence:
  - "[quote]"

I) Local branch history
- Did caller mention prior bad experience with a Hertz branch? (true/false/unclear): [answer]
  Evidence:
  - "[quote]"
- If yes, what happened? (brief description): [answer]
  Evidence:
  - "[quote]"

J) Complaints & feedback (if complaint is primary or secondary intent, OR if caller raises issue during call)
- Complaint raised during call? (true/false/unclear): [answer]
  Evidence:
  - "[quote]"
- Complaint types (select ALL that apply):
  wait_time | service_quality | vehicle_issues | pricing | availability | location_too_far |
  process_complexity | branch_behavior | communication_failure | policy_frustration | other | none
  [answer]
  (SPECIFIC markers AND decision logic:
    wait_time: "I've been waiting", "long hold", "took forever", "been on hold"
    service_quality: Complaint about INDIVIDUAL agent behavior - "Agent was rude", "unhelpful agent", "bad service from the person I spoke to"
    vehicle_issues: "wrong car", "dirty car", "car broke down", "car problems"
    pricing: "too expensive", "unexpected charges", "hidden fees", "why am I paying"
    availability: "no cars", "nothing available", "class not available"
    location_too_far: "too far", "why that location?", "there's a closer branch", "that's far from me"
    process_complexity: "too complicated", "too many steps", "confusing process"
    branch_behavior: Complaint about BRANCH as entity - "branch refused", "branch wouldn't help", "they turned me away", "the location wouldn't accommodate"
    communication_failure: Information wasn't conveyed - "no one called me back", "I never got the email", "wasn't informed", "wasn't told about"
    policy_frustration: Complaint about Hertz POLICY itself - "that policy doesn't make sense", "why can't you just...", "that's ridiculous", "I don't agree with your policy"

    TRIAGE RULE to distinguish similar types:
      • Complaint about individual agent → service_quality
      • Complaint about branch as entity/policy → branch_behavior
      • Complaint about missing info/communication → communication_failure
      • Complaint about unfairness of Hertz rules → policy_frustration)
  Evidence:
  - "[quote]"
- Complaint details (brief description): [answer]
  Evidence:
  - "[quote]"

K) Agent Verbiage SOP
- Agent mentions pickup/delivery not guaranteed? (true/false/unclear): [answer]
  (Look for: "not guaranteed", "we can't guarantee", "subject to availability", "may not be available")
  Evidence:
  - "[quote]"
- Agent mentions branch discretion? (true/false/unclear): [answer]
  (Look for: "up to the branch", "branch's discretion", "depends on the branch", "branch decides", "branch will determine")
  Evidence:
  - "[quote]"
- Agent mentions callback if no pickup? (true/false/unclear): [answer]
  (Look for: "if they don't pick up, call us back", "if no one shows up, give us a call", "call back if pickup doesn't happen", "let us know if they don't come")
  Evidence:
  - "[quote]"

END."""

# JSON Schema for structured output - INBOUND CALLS
JSON_SCHEMA = {
    "type": "object",
    "properties": {
        "A_identity_routing": {
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
                "reference_present": {
                    "type": ["string", "null"],
                    "enum": ["yes", "no", "unclear", None]
                },
                "reference_present_evidence": {"type": ["string", "null"]},
                "reference_type": {
                    "type": ["string", "null"],
                    "enum": ["reservation_number", "claim_number", "both", "none", "unknown", None]
                },
                "reference_type_evidence": {"type": ["string", "null"]},
                "non_driveable": {"type": ["boolean", "null"]},
                "non_driveable_evidence": {"type": ["string", "null"]},
                "conversation_summary": {"type": "string"}
            },
            "required": ["caller_type", "non_customer_details", "non_customer_details_evidence",
                         "insurer_name", "insurer_name_evidence", "branch_location", "branch_location_evidence",
                         "reference_present", "reference_present_evidence", "reference_type", "reference_type_evidence",
                         "non_driveable", "non_driveable_evidence", "conversation_summary"],
            "additionalProperties": False
        },
        "B_intent_first_contact": {
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
                "secondary_intents_evidence": {"type": ["string", "null"]},
                "is_first_contact": {"type": ["boolean", "null"]},
                "is_first_contact_evidence": {"type": ["string", "null"]},
                "lead_source": {
                    "type": ["string", "null"],
                    "enum": ["referred_by_insurance", "referred_by_body_shop", "self_initiated", "unknown", None]
                },
                "lead_source_evidence": {"type": ["string", "null"]}
            },
            "required": ["reservation_stage", "reservation_stage_evidence",
                         "primary_intent", "primary_intent_evidence", "secondary_intents", "secondary_intents_evidence",
                         "is_first_contact", "is_first_contact_evidence", "lead_source", "lead_source_evidence"],
            "additionalProperties": False
        },
        "C_issue_diagnostics": {
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
                "who_reported_issue": {
                    "type": ["string", "null"],
                    "enum": ["customer", "agent", "branch", "insurer", "body_shop", "unknown", None]
                },
                "who_reported_issue_evidence": {"type": ["string", "null"]},
                "issue_resolution_status": {
                    "type": ["string", "null"],
                    "enum": ["resolved", "partially_resolved", "not_resolved", "unknown", None]
                },
                "issue_resolution_status_evidence": {"type": ["string", "null"]},
                "resolution_actions": {"type": ["string", "null"]},
                "resolution_actions_evidence": {"type": ["string", "null"]}
            },
            "required": ["section_applicable", "issue_present", "issue_present_evidence", "issue_types", "issue_types_evidence",
                         "who_reported_issue", "who_reported_issue_evidence", "issue_resolution_status", "issue_resolution_status_evidence",
                         "resolution_actions", "resolution_actions_evidence"],
            "additionalProperties": False
        },
        "D_change_requests": {
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
        "E_time_feasibility": {
            "type": "object",
            "properties": {
                "timing_need_category": {
                    "type": ["string", "null"],
                    "enum": ["same_day_today", "this_week", "next_week", "scheduled_specific", "unsure", "no_urgency", None]
                },
                "timing_need_category_evidence": {"type": ["string", "null"]},
                "hours_deadlines_mentioned": {"type": ["boolean", "null"]},
                "hours_deadlines_mentioned_evidence": {"type": ["string", "null"]},
                "time_feasible": {"type": ["boolean", "null"]},
                "time_feasible_evidence": {"type": ["string", "null"]},
                "infeasibility_reasons": {
                    "type": "array",
                    "items": {
                        "type": "string",
                        "enum": ["branch_closed", "closing_soon", "weekend_closure", "before_open",
                                 "notice_window_missed", "other", "none"]
                    }
                },
                "infeasibility_reasons_evidence": {"type": ["string", "null"]},
                "stranded_risk_language": {"type": ["boolean", "null"]},
                "stranded_risk_language_evidence": {"type": ["string", "null"]}
            },
            "required": ["timing_need_category", "timing_need_category_evidence",
                         "hours_deadlines_mentioned", "hours_deadlines_mentioned_evidence",
                         "time_feasible", "time_feasible_evidence",
                         "infeasibility_reasons", "infeasibility_reasons_evidence",
                         "stranded_risk_language", "stranded_risk_language_evidence"],
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
                "self_pickup_only_evidence": {"type": ["string", "null"]},
                "policy_constraints": {
                    "type": "array",
                    "items": {
                        "type": "string",
                        "enum": ["lead_time_required", "radius_limit", "depends_on_drivers",
                                 "must_contact_branch_directly", "option_5_instruction", "other", "none"]
                    }
                },
                "policy_constraints_evidence": {"type": ["string", "null"]},
                "caller_logistics_anxiety": {"type": ["boolean", "null"]},
                "caller_logistics_anxiety_evidence": {"type": ["string", "null"]}
            },
            "required": ["pickup_requested", "pickup_requested_evidence",
                         "delivery_requested", "delivery_requested_evidence",
                         "self_pickup_only", "self_pickup_only_evidence",
                         "policy_constraints", "policy_constraints_evidence",
                         "caller_logistics_anxiety", "caller_logistics_anxiety_evidence"],
            "additionalProperties": False
        },
        "G_transfers_reachability": {
            "type": "object",
            "properties": {
                "transfer_attempted": {"type": ["boolean", "null"]},
                "transfer_attempted_evidence": {"type": ["string", "null"]},
                "interpreter_transfer": {"type": ["boolean", "null"]},
                "interpreter_transfer_evidence": {"type": ["string", "null"]},
                "branch_contact_attempted": {"type": ["boolean", "null"]},
                "branch_contact_attempted_evidence": {"type": ["string", "null"]},
                "branch_reachable": {"type": ["boolean", "null"]},
                "branch_reachable_evidence": {"type": ["string", "null"]},
                "transfer_type": {
                    "type": ["string", "null"],
                    "enum": ["warm", "cold", "unknown", None]
                },
                "transfer_type_evidence": {"type": ["string", "null"]}
            },
            "required": ["transfer_attempted", "transfer_attempted_evidence",
                         "interpreter_transfer", "interpreter_transfer_evidence",
                         "branch_contact_attempted", "branch_contact_attempted_evidence",
                         "branch_reachable", "branch_reachable_evidence",
                         "transfer_type", "transfer_type_evidence"],
            "additionalProperties": False
        },
        "H_outcome_effort": {
            "type": "object",
            "properties": {
                "call_outcome": {
                    "type": ["string", "null"],
                    "enum": ["resolved_and_ready", "resolved_but_pending_branch_or_inventory",
                             "partially_resolved_needs_followup", "not_resolved", "canceled_or_abandoned", None]
                },
                "call_outcome_evidence": {"type": ["string", "null"]},
                "post_call_actions": {
                    "type": "array",
                    "items": {"type": "string"}
                },
                "post_call_actions_evidence": {"type": ["string", "null"]},
                "actions_count": {"type": ["integer", "null"]},
                "effort_burden": {
                    "type": ["string", "null"],
                    "enum": ["low", "medium", "high", None]
                },
                "effort_burden_evidence": {"type": ["string", "null"]},
                "cancellation_abandonment": {"type": ["boolean", "null"]},
                "cancellation_abandonment_evidence": {"type": ["string", "null"]}
            },
            "required": ["call_outcome", "call_outcome_evidence",
                         "post_call_actions", "post_call_actions_evidence",
                         "actions_count", "effort_burden", "effort_burden_evidence",
                         "cancellation_abandonment", "cancellation_abandonment_evidence"],
            "additionalProperties": False
        },
        "I_branch_history": {
            "type": "object",
            "properties": {
                "prior_bad_experience": {"type": ["boolean", "null"]},
                "prior_bad_experience_evidence": {"type": ["string", "null"]},
                "prior_bad_experience_details": {"type": ["string", "null"]},
                "prior_bad_experience_details_evidence": {"type": ["string", "null"]}
            },
            "required": ["prior_bad_experience", "prior_bad_experience_evidence",
                         "prior_bad_experience_details", "prior_bad_experience_details_evidence"],
            "additionalProperties": False
        },
        "J_complaints": {
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
        "K_agent_verbiage_sop": {
            "type": "object",
            "properties": {
                "pickup_delivery_not_guaranteed": {"type": ["boolean", "null"]},
                "pickup_delivery_not_guaranteed_evidence": {"type": ["string", "null"]},
                "branch_discretion_mentioned": {"type": ["boolean", "null"]},
                "branch_discretion_mentioned_evidence": {"type": ["string", "null"]},
                "callback_if_no_pickup_mentioned": {"type": ["boolean", "null"]},
                "callback_if_no_pickup_mentioned_evidence": {"type": ["string", "null"]}
            },
            "required": ["pickup_delivery_not_guaranteed", "pickup_delivery_not_guaranteed_evidence",
                         "branch_discretion_mentioned", "branch_discretion_mentioned_evidence",
                         "callback_if_no_pickup_mentioned", "callback_if_no_pickup_mentioned_evidence"],
            "additionalProperties": False
        }
    },
    "required": ["A_identity_routing", "B_intent_first_contact",
                 "C_issue_diagnostics", "D_change_requests", "E_time_feasibility",
                 "F_pickup_delivery", "G_transfers_reachability", "H_outcome_effort",
                 "I_branch_history", "J_complaints", "K_agent_verbiage_sop"],
    "additionalProperties": False
}

# JSON conversion prompt
JSON_CONVERSION_PROMPT = """Convert the following inbound call transcript analysis report into the required JSON schema.

Rules:
1. Boolean fields: Use true, false, or null (if not determinable)
2. String fields: Extract exact wording when available, otherwise summarize concisely
3. Arrays: Include all mentioned items, empty array [] if none
4. Enums: Must match exactly one of the specified values
5. Null handling: Use null only when information is genuinely not available
6. Preserve factual accuracy from the source report
7. Do not infer information not present in the report

Field Examples (use these as guidance):

A_identity_routing:
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
  - reference_present: "yes" | "no" | "unclear"
  - reference_present_evidence: quote showing reference number mentioned, or null
  - reference_type: "reservation_number" | "claim_number" | "both" | "none" | "unknown" | null
      (Reservation numbers follow format ###-####### e.g., 037-9974148. Claim numbers vary by insurer but the format is always the same.)
  - reference_type_evidence: quote or null
  - non_driveable: true (car totaled/can't drive), false (car still driveable), null (not mentioned)
  - non_driveable_evidence: "My car is totaled", "The car won't start", null
  - conversation_summary:
      If CUSTOMER: "Customer called to confirm pickup time for insurance replacement. Agent verified reservation and provided branch hours."
      If NON-CUSTOMER: "State Farm claims adjuster called to set up direct bill for customer John Doe's claim #12345. Requested midsize vehicle at Springfield location for 01/15. Agent created reservation and confirmed coverage details."

B_intent_first_contact:
  - reservation_stage: reservation status when call begins:
      "no_reservation" ← no reservation exists yet
      "reservation_exists_unconfirmed" ← reservation exists but not confirmed/finalized
      "reservation_exists_confirmed" ← reservation confirmed and ready
      "in_rental_already" ← customer currently has the rental car
      "unknown" ← can't determine from transcript
  - reservation_stage_evidence: quote or null
  - primary_intent: MUST be one of (choose the MAIN reason for calling - use decision logic):
      "create_reservation" ← setting up NEW rental from scratch
      "confirm_reservation" ← checking details of EXISTING reservation, no changes needed
      "change_reservation" ← modifying dates, location, vehicle, driver on existing reservation
      "repair_issue" ← something is WRONG with existing reservation that BLOCKS progress (missing direct bill, reservation not found, authorization issues)
      "pickup_delivery_coordination" ← arranging HOW to get the car (pickup service, delivery logistics)
      "time_hours_issue" ← questions about branch hours/timing, NOT blocking the reservation
      "payment_deposit" ← explicit discussion of deposit amount, payment methods, financial requirements
      "coverage_exception" ← coverage limits, daily caps, airport exclusions - policy constraints
      "extension" ← extending CURRENT rental duration
      "complaint" ← PRIMARY purpose is to complain about service/experience
      "other" ← none of the above
  - primary_intent_evidence: quote showing main purpose, null
  - secondary_intents: array of additional intents, or ["none"] if only one intent
      Example: ["pickup_delivery_coordination", "time_hours_issue"]
  - secondary_intents_evidence: quote or null
  - is_first_contact: STRICT identification:
      true ← first time calling. Markers: "This is my first call", no references to prior calls
      false ← follow-up call. Markers: "I was told to call back", "I called earlier", "As I mentioned last time", "This is my third call"
      null ← unclear, no temporal references either way
  - is_first_contact_evidence: "I was told to call back", "This is my third call", null
  - lead_source: "referred_by_insurance" | "referred_by_body_shop" | "self_initiated" | "unknown" | null
  - lead_source_evidence: "My insurance told me to call", "The body shop gave me this number", null

C_issue_diagnostics:
  CONDITIONAL: section_applicable = true ONLY if primary or secondary intent includes "repair_issue"
  If section_applicable = false, set all other fields to null or empty arrays

  - section_applicable: true | false
  - issue_present: true | false | null
  - issue_present_evidence: quote or null
  - issue_types: select ALL that apply:
      ["reservation_not_found"] ← "I can't find your reservation", "no reservation under that name"
      ["wrong_location"] ← reservation at wrong branch
      ["wrong_dates_times"] ← dates or times incorrect
      ["direct_bill_missing"] ← "no direct bill on file", "insurance billing not set up"
      ["coverage_mismatch_or_cap"] ← coverage doesn't match what customer expected, daily cap issue
      ["name_or_driver_mismatch"] ← wrong name, additional driver issues
      ["authorization_missing"] ← "no authorization from insurance", "claim not approved"
      ["branch_refused_or_cant_honor"] ← branch can't or won't honor the reservation
      ["vehicle_unavailable"] ← requested vehicle class not available
      ["system_transfer_loop"] ← customer keeps getting transferred, system issues
      ["other"] ← issue doesn't fit above
      ["none"] ← no issues (when section_applicable but no actual issue)
  - issue_types_evidence: quote or null
  - who_reported_issue: "customer" | "agent" | "branch" | "insurer" | "body_shop" | "unknown" | null
  - who_reported_issue_evidence: quote or null
  - issue_resolution_status: "resolved" | "partially_resolved" | "not_resolved" | "unknown" | null
  - issue_resolution_status_evidence: quote or null
  - resolution_actions: "Agent updated the reservation dates", "Agent added direct bill", null
  - resolution_actions_evidence: quote or null

D_change_requests:
  CONDITIONAL: section_applicable = true ONLY if primary or secondary intent includes "change_reservation"
  If section_applicable = false, set all other fields to null or empty arrays

  - section_applicable: true | false
  - change_requested: true | false | null
  - change_requested_evidence: quote or null
  - change_types: select ALL that apply:
      ["change_location"] ← different pickup/dropoff location
      ["change_pickup_time"] ← different date or time
      ["change_vehicle_class"] ← different car type
      ["add_pickup_or_delivery"] ← adding pickup/delivery service
      ["change_driver"] ← changing or adding drivers
      ["change_payment_method"] ← changing how it's paid
      ["other"] ← other change type
      ["none"] ← no changes (when section_applicable but no actual change)
  - change_types_evidence: quote or null
  - change_completed: true (change made successfully), false (change failed/denied), null (unclear)
  - change_completed_evidence: quote or null

E_time_feasibility:
  - timing_need_category: MUST match caller's words:
      "same_day_today" ← "today", "ASAP", "right now", "immediately", "this afternoon", "tonight"
      "this_week" ← "tomorrow", "in a few days", "this week"
      "next_week" ← "next week", "next Monday"
      "scheduled_specific" ← specific future date mentioned (e.g., "January 15th")
      "unsure" ← "I'm not sure", "flexible", "whenever"
      "no_urgency" ← no time pressure expressed
      null ← timing not discussed
  - timing_need_category_evidence: "I need it today", "Can I pick up tomorrow?", null
  - hours_deadlines_mentioned: true | false | null
  - hours_deadlines_mentioned_evidence: "We close at 6pm", "You need to arrive by 5", null
  - time_feasible: true (can accommodate), false (can't accommodate), null (not addressed)
  - time_feasible_evidence: quote or null
  - infeasibility_reasons: select ALL that apply if time_feasible = false:
      ["branch_closed"] ← branch is closed
      ["closing_soon"] ← branch closing too soon
      ["weekend_closure"] ← closed on weekends
      ["before_open"] ← requested time before branch opens
      ["notice_window_missed"] ← not enough notice for pickup/delivery
      ["other"] ← other timing issue
      ["none"] ← if time is feasible or not discussed
  - infeasibility_reasons_evidence: quote or null
  - stranded_risk_language: true | false | null
  - stranded_risk_language_evidence: "I'll be stuck", "I have no way to get around", null

F_pickup_delivery:
  - pickup_requested: true | false | null
  - pickup_requested_evidence: "Can someone pick me up?", null
  - delivery_requested: true | false | null
  - delivery_requested_evidence: "Can you deliver the car?", null
  - self_pickup_only: true (will come to branch), false, null
  - self_pickup_only_evidence: "I'll come to the branch", null
  - policy_constraints: select ALL that apply:
      ["lead_time_required"] ← need advance notice for pickup/delivery
      ["radius_limit"] ← distance/radius restrictions
      ["depends_on_drivers"] ← subject to driver availability
      ["must_contact_branch_directly"] ← caller told to contact branch
      ["option_5_instruction"] ← told to press option 5 to reach branch
      ["other"] ← other policy constraint
      ["none"] ← no constraints mentioned
  - policy_constraints_evidence: quote or null
  - caller_logistics_anxiety: true (worried about getting there/getting car), false, null
  - caller_logistics_anxiety_evidence: "How am I supposed to get there?", "I don't have a ride", null

G_transfers_reachability:
  - transfer_attempted: true | false | null
  - transfer_attempted_evidence: "Let me transfer you", "I'll connect you to the branch", null
  - interpreter_transfer: true | false | null
  - interpreter_transfer_evidence: "Let me get an interpreter", "Connecting to language line", null
  - branch_contact_attempted: STRICT definition:
      true ← agent actually CALLS the branch during this call ("Let me call the branch", "I'm calling them now")
      false ← agent only provides phone number or tells caller to call themselves
      null ← unclear
    NOT true if agent just provides branch phone number
  - branch_contact_attempted_evidence: "Let me try to reach the branch", "I'm calling them now", null
  - branch_reachable: true (branch answered), false (branch didn't answer), null
  - branch_reachable_evidence: "The branch isn't answering", "I have them on the line", null
  - transfer_type: SPECIFIC observable markers (if transfer_attempted = false, MUST be null):
      "warm" ← agent is heard conversing with another Hertz agent, and that agent takes over the conversation
      "cold" ← agent says they will transfer and the call ends shortly after
      "unknown" ← transfer attempted but type unclear from transcript
      null ← if transfer_attempted = false
  - transfer_type_evidence: quote or null

H_outcome_effort:
  - call_outcome: MUST be one of (use decision tree):
      "resolved_and_ready" ← Reservation confirmed, customer has ALL info needed, can proceed to pickup
      "resolved_but_pending_branch_or_inventory" ← Reservation details finalized BUT waiting on branch to confirm availability, inventory check, or insurer final approval
      "partially_resolved_needs_followup" ← SOME progress made but NOT fully resolved (e.g., reservation created but dates wrong)
      "not_resolved" ← Call ended with issue UNRESOLVED, no material progress made
      "canceled_or_abandoned" ← Explicit cancellation requested OR call ended abruptly without resolution
  - call_outcome_evidence: quote or null
  - post_call_actions: array of actions caller must take:
      ["call branch", "bring ID", "arrive by 5pm", "wait for callback"] | []
  - post_call_actions_evidence: quote or null
  - actions_count: integer count of post_call_actions, or null if none
  - effort_burden: SPECIFIC criteria:
      "low" ← 0-1 clear actions, no preconditions. Example: "Just pick up between 9-5"
      "medium" ← 2-3 actions OR 1 action with conditions. Example: "Call branch to confirm, bring ID, arrive by 5pm"
      "high" ← 4+ actions OR multiple preconditions OR unclear/complex requirements. Example: "Call branch, get confirmation code, bring two forms of ID, insurer approval needed"
  - effort_burden_evidence: quote or null
  - cancellation_abandonment: true | false | null
  - cancellation_abandonment_evidence: "Let me cancel that", "I don't want it anymore", null

I_branch_history:
  - prior_bad_experience: true | false | null
  - prior_bad_experience_evidence: "Last time I waited 2 hours", "That branch was terrible", null
  - prior_bad_experience_details: "Long wait times", "Rude staff", "Lost reservation", null
  - prior_bad_experience_details_evidence: quote or null

J_complaints:
  - complaint_raised: true | false | null
  - complaint_raised_evidence: "I've been waiting for 30 minutes!", "This is ridiculous", null
  - complaint_types: select ALL that apply, using TRIAGE RULE to distinguish similar types:
      ["wait_time"] ← "I've been waiting", "long hold", "took forever", "been on hold"
      ["service_quality"] ← Complaint about INDIVIDUAL agent behavior: "Agent was rude", "unhelpful agent", "bad service from the person"
      ["vehicle_issues"] ← "wrong car", "dirty car", "car broke down", "car problems"
      ["pricing"] ← "too expensive", "unexpected charges", "hidden fees", "why am I paying"
      ["availability"] ← "no cars", "nothing available", "class not available"
      ["location_too_far"] ← "too far", "why that location?", "there's a closer branch", "that's far from me"
      ["process_complexity"] ← "too complicated", "too many steps", "confusing process"
      ["branch_behavior"] ← Complaint about BRANCH as entity: "branch refused", "branch wouldn't help", "the location wouldn't accommodate"
      ["communication_failure"] ← Information wasn't conveyed: "no one called me back", "I never got the email", "wasn't informed"
      ["policy_frustration"] ← Complaint about Hertz POLICY itself: "that policy doesn't make sense", "why can't you just...", "I don't agree with your policy"
      ["other"] ← complaint doesn't fit above
      ["none"] ← no complaint raised
      TRIAGE: About individual agent → service_quality | About branch as entity → branch_behavior | About missing info → communication_failure | About unfairness of rules → policy_frustration
  - complaint_types_evidence: quote showing complaint type
  - complaint_details: brief description of complaint, null if none
  - complaint_details_evidence: quote or null

K_agent_verbiage_sop:
  This section tracks whether the agent followed standard operating procedure by mentioning key disclaimers.
  - pickup_delivery_not_guaranteed: true | false | null
      true ← agent explicitly says pickup/delivery is not guaranteed
      Markers: "not guaranteed", "we can't guarantee", "subject to availability", "may not be available"
  - pickup_delivery_not_guaranteed_evidence: "Pickup is not guaranteed", "subject to driver availability", null
  - branch_discretion_mentioned: true | false | null
      true ← agent explicitly says it's up to the branch
      Markers: "up to the branch", "branch's discretion", "depends on the branch", "branch decides", "branch will determine"
  - branch_discretion_mentioned_evidence: "That's up to the branch", "depends on the location", null
  - callback_if_no_pickup_mentioned: true | false | null
      true ← agent tells customer to call back if pickup doesn't happen
      Markers: "if they don't pick up, call us back", "if no one shows up, give us a call", "call back if pickup doesn't happen", "let us know if they don't come"
  - callback_if_no_pickup_mentioned_evidence: "If they don't show up, please call us back", "Give us a call if no one comes to pick you up", null

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
