#!/usr/bin/env python3
"""
Transcript Feature Extraction Script using OpenAI API.

Analyzes transcript files and extracts structured features into JSON format.
Two-step process:
  1. Summarize and analyze transcript (using GPT-4o)
  2. Convert analysis to structured JSON (using GPT-4o-mini with structured outputs)

Input:  data/audio 2/Transcription/*.txt
Output: data/audio 2/JSON/*_extracted.json

Usage:
    python scripts/extract_transcript_features.py              # Process pending files (5 workers)
    python scripts/extract_transcript_features.py --workers 10 # Use 10 parallel workers
    python scripts/extract_transcript_features.py --dry-run    # Show what would be processed
    python scripts/extract_transcript_features.py --retry-failed  # Retry failed extractions

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
ANALYSIS_MODEL = "gpt-4o"
JSON_MODEL = "gpt-4o-mini"
MAX_RETRIES = 3
RETRY_DELAY_SECONDS = 2

# Pricing per 1M tokens (USD) - as of Jan 2025
PRICING = {
    "gpt-4o": {"input": 2.50, "output": 10.00},
    "gpt-4o-mini": {"input": 0.15, "output": 0.60},
}

# Metadata
ANALYST = "Halibu A"
PROJECT = "Transcript analysis"

# Paths
PROJECT_ROOT = Path(__file__).parent.parent
TRANSCRIPTIONS_DIR = PROJECT_ROOT / "data" / "audio 2" / "Transcription"
OUTPUT_DIR = PROJECT_ROOT / "data" / "audio 2" / "JSON"
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

# Step 1: Analysis prompt
ANALYSIS_PROMPT = """You are an expert Transcript Analysis and Feature Extraction Specialist working for Hertz, the rental company. Analyze this call center transcript and generate a comprehensive analytical report.

Answer these key questions based ONLY on information present in the transcript:

A. Basic context & identifiers
  - Name of Insurer mentioned:
  - Branch or location mentioned:
  - Is the customer's car non-driveable after the accident? [answer] Evidence: [quote]
    (Look for phrases like "totaled", "can't drive it", "not driveable", "undriveable", "car won't start", "too damaged to drive")
  - Summary of the conversation (Briefly summarise the conversation between the two parties: cover key topics and key questions covered, as well as when the customer needs the car by, any issues/complaints/feedback, the resolution. Remove any personally identifiable information like names and emails):

B. Time & feasibility (provide evidence quote after each answer)
  - Customer's stated timing need, when they need the rental car: [answer] Evidence: [quote]
    Categorize the timing need as one of:
    • same_day_today: if customer says "today", "as soon as possible", "ASAP", "soonest", "heading there now", "right now", "immediately", "this afternoon", "this morning", "tonight", "within the hour", or any urgency implying today
    • this_week: if customer says "tomorrow", "in a couple days", "this week", "day after tomorrow", "in 2-3 days"
    • next_week: if customer says "next week", "next Monday", "in a week"
    • unsure: if customer doesn't know, is flexible, or hasn't decided
    • other: if a specific future date is mentioned that doesn't fit above categories
  - Branch hours or timing constraints mentioned: [answer] Evidence: [quote]
  - Was the customer's request feasible under those rules? [answer] Evidence: [quote]
    • TRUE: Agent confirms they can accommodate the request, reservation is made successfully for requested time
    • FALSE: Agent says it won't work - branch is closed, closing soon, no availability, customer can't make it in time. List reasons: branch_closed, closing_soon, weekend_closure, too_far_wont_make_it, one_hour_window_missed, other
    • null: Feasibility not explicitly addressed in conversation
  - Did the customer use stranded risk language? [answer] Evidence: [quote]
    • TRUE: Customer says "I'll be stuck", "stranded", "no way to get there", "I'll have no car", "how will I get around?", "I'm stuck without a car"
    • FALSE: Customer doesn't express being stranded
    • null: Not discussed

C. Pickup, delivery, and access (provide evidence quote after each answer)
  - Did the customer request pickup? Delivery? Or self-pickup only? [answer] Evidence: [quote]
  - Did the agent say pickup or delivery is not guaranteed? [answer] Evidence: [quote]
  - Did the agent say it depends on the branch or is at their discretion? [answer] Evidence: [quote]
  - Was the customer instructed to call the branch (e.g., option 5)? [answer] Evidence: [quote]

D. Fleet, vehicle, and availability
  - Vehicle class category (compact, midsize, fullsize, suv_small, suv_regular, special):
  - Did the agent mention inventory or vehicle class uncertainty?
  - Did the customer express concern about getting the right vehicle? [answer] Evidence: [quote]
    • TRUE: Customer asks "will I get the car I need?", "what if they don't have one?", "I need a specific type", "will there be a car available?", expresses worry about vehicle size/type
    • FALSE: Customer doesn't express concern about vehicle availability
    • null: Vehicle availability not discussed
  - Were there any hard constraints (none, safety, medical, caregiving, kids, electric_vehicle, other)? Explain.

E. Insurance coverage & money (provide evidence quote after each answer)
  - Did the customer express worry or confusion about insurance coverage? [answer] Evidence: [quote]
    • TRUE: Customer asks "what does insurance cover?", "am I covered for...?", "I'm confused about coverage", "what if insurance doesn't pay?", "will I have to pay out of pocket?"
    • FALSE: Customer understands coverage or doesn't ask about it
    • null: Insurance coverage not discussed
  - Did the customer express worry about the deposit? [answer] Evidence: [quote]
    • TRUE: Customer says "I can't afford the deposit", "that's too much", "I don't have that money right now", "why do I need a deposit?", hesitates or pushes back on deposit amount
    • FALSE: Customer accepts deposit without concern or doesn't mention it
    • null: Deposit not discussed

F. Transfers (provide evidence quote after each answer)
  - Was there an interpreter transfer during the call? [answer] Evidence: [quote]
  - Was there a branch transfer attempted? [answer] Evidence: [quote]
  - If branch transfer: Was it a warm transfer or cold transfer? [answer] Evidence: [quote]
    • WARM: Agent is heard conversing with another Hertz agent, discussing "I have a customer for you", "I have a lead for you", and that Hertz agent takes over the conversation
    • COLD: Agent says they will transfer and the call ends shortly after with the automated message "Thank you for calling HERTZ Car Rental. For faster service options, please visit our website at www.hertz.com or use the HERTZ app"
    • null: No transfer attempted
  - If warm transfer, what was the outcome? [answer] Evidence: [quote]
    • branch_took_over: Branch agent takes over and continues helping customer
    • branch_busy_callback: Branch answered but was busy, customer told to call back
    • branch_no_answer: Branch did not answer, customer told to call later
    • null: Not a warm transfer or no transfer attempted

G. Emotional & psychological signals (provide evidence quote after each answer)
  - Any signs of distress? [answer] Evidence: [quote]
    • TRUE: Customer is crying, panicking, uses words like "desperate", "scared", "I don't know what to do", "please help me", extreme frustration, voice breaking
    • FALSE: Customer is calm or only mildly frustrated
    • null: Cannot determine emotional state from transcript
  - Any safety concerns mentioned? [answer] Evidence: [quote]
    • TRUE: Customer mentions domestic violence, fleeing dangerous situation, medical emergency, stranded in unsafe area at night, personal safety threat
    • FALSE: No safety concerns mentioned
    • null: Unclear or ambiguous

H. Agent behavior & clarity (provide evidence quote after each answer)
  - Was the agent polite and professional? [answer] Evidence: [quote]
    • TRUE: Agent uses "thank you", "please", "I appreciate", "happy to help", "my pleasure", "I apologize", shows patience
    • FALSE: Agent is curt, dismissive, interrupts customer, shows frustration, rude tone
    • null: Neutral/standard interaction with no clear evidence either way
  - Did the agent acknowledge the customer's concerns? [answer] Evidence: [quote]
    • TRUE: Agent says "I understand", "I hear you", "I can see why", "I'm sorry to hear that", or repeats back the customer's concern
    • FALSE: Agent ignores concern, dismisses it, or changes subject without addressing
    • null: No specific concerns raised by customer

I. Outcome & customer effort
  - Was anything canceled during the call?
  - What actions does the customer need to take after the call? (List all.)

J. Local branch history (provide evidence quote after each answer)
  - Did the customer mention prior bad experiences with a Hertz branch? [answer] Evidence: [quote]
  - If yes, what happened? [answer] Evidence: [quote]

K. Competitive landscape
  - Did the customer mention a competitor? Which one?

L. Customer complaints & feedback (provide evidence quote after each answer)
  - Did the customer express a complaint or raise an issue during this call? [answer] Evidence: [quote]
    • TRUE: Customer explicitly complains, expresses frustration about a specific issue, or raises a problem
    • FALSE: Customer does not complain or raise issues
    • null: Unclear
  - If complaint raised, what type? Select ALL that apply from this list ONLY:
    • wait_time: "I've been waiting", "long wait", "took forever", "been on hold"
    • service_quality: "rude staff", "unhelpful", "bad service", "didn't help me"
    • vehicle_issues: "wrong car", "dirty car", "car problems", "car broke down"
    • pricing: "too expensive", "unexpected charges", "hidden fees", "why am I paying"
    • availability: "no cars", "nothing available", "class not available"
    • location_too_far: "too far", "why that location?", "there's a closer branch", "that's far from me"
    • process_complexity: "too complicated", "too many steps", "confusing process"
    • other: complaint doesn't fit above categories
    • none: no complaint raised
  - Complaint details (brief description of what customer complained about): [answer] Evidence: [quote]

For each section, include a brief 'Evidence' subsection with 1-3 direct quotes from the transcript that support your analysis.

Provide your analysis in a structured format with clear section headers (A through L)."""

# JSON Schema for structured output
JSON_SCHEMA = {
    "type": "object",
    "properties": {
        "A_basic_context_identifiers": {
            "type": "object",
            "properties": {
                "insurer_name": {"type": ["string", "null"]},
                "branch_location": {"type": ["string", "null"]},
                "non_driveable": {"type": ["boolean", "null"]},
                "non_driveable_evidence": {"type": ["string", "null"]},
                "conversation_summary": {"type": "string"},
                "evidence": {
                    "type": "array",
                    "items": {"type": "string"}
                }
            },
            "required": ["insurer_name", "branch_location", "non_driveable", "non_driveable_evidence", "conversation_summary", "evidence"],
            "additionalProperties": False
        },
        "B_time_feasibility": {
            "type": "object",
            "properties": {
                "customer_stated_timing_need": {"type": ["string", "null"]},
                "customer_time_need_category": {
                    "type": ["string", "null"],
                    "enum": ["same_day_today", "this_week", "next_week", "unsure", "other"]
                },
                "customer_time_need_category_evidence": {"type": ["string", "null"]},
                "branch_hours_constraints": {"type": ["string", "null"]},
                "branch_hours_constraints_evidence": {"type": ["string", "null"]},
                "request_feasible": {"type": ["boolean", "null"]},
                "request_feasible_evidence": {"type": ["string", "null"]},
                "infeasibility_reasons": {
                    "type": "array",
                    "items": {
                        "type": "string",
                        "enum": ["branch_closed", "closing_soon", "weekend_closure",
                                 "too_far_wont_make_it", "one_hour_window_missed", "other"]
                    }
                },
                "infeasibility_reasons_evidence": {"type": ["string", "null"]},
                "stranded_risk_language": {"type": "boolean"},
                "stranded_risk_language_evidence": {"type": ["string", "null"]}
            },
            "required": ["customer_stated_timing_need",
                         "customer_time_need_category", "customer_time_need_category_evidence",
                         "branch_hours_constraints", "branch_hours_constraints_evidence",
                         "request_feasible", "request_feasible_evidence",
                         "infeasibility_reasons", "infeasibility_reasons_evidence",
                         "stranded_risk_language", "stranded_risk_language_evidence"],
            "additionalProperties": False
        },
        "C_pickup_delivery_access": {
            "type": "object",
            "properties": {
                "pickup_requested": {"type": ["boolean", "null"]},
                "pickup_requested_evidence": {"type": ["string", "null"]},
                "delivery_requested": {"type": ["boolean", "null"]},
                "delivery_requested_evidence": {"type": ["string", "null"]},
                "self_pickup_only": {"type": ["boolean", "null"]},
                "self_pickup_only_evidence": {"type": ["string", "null"]},
                "agent_said_pickup_delivery_not_guaranteed": {"type": "boolean"},
                "agent_said_pickup_delivery_not_guaranteed_evidence": {"type": ["string", "null"]},
                "agent_said_branch_discretion": {"type": "boolean"},
                "agent_said_branch_discretion_evidence": {"type": ["string", "null"]},
                "instructed_to_call_branch": {"type": "boolean"},
                "instructed_to_call_branch_evidence": {"type": ["string", "null"]},
                "option_5_instruction_used": {"type": "boolean"},
                "option_5_instruction_used_evidence": {"type": ["string", "null"]}
            },
            "required": ["pickup_requested", "pickup_requested_evidence",
                         "delivery_requested", "delivery_requested_evidence",
                         "self_pickup_only", "self_pickup_only_evidence",
                         "agent_said_pickup_delivery_not_guaranteed", "agent_said_pickup_delivery_not_guaranteed_evidence",
                         "agent_said_branch_discretion", "agent_said_branch_discretion_evidence",
                         "instructed_to_call_branch", "instructed_to_call_branch_evidence",
                         "option_5_instruction_used", "option_5_instruction_used_evidence"],
            "additionalProperties": False
        },
        "D_fleet_vehicle_availability": {
            "type": "object",
            "properties": {
                "vehicle_class_category": {
                    "type": ["string", "null"],
                    "enum": ["compact", "midsize", "fullsize", "suv_small",
                             "suv_regular", "special", None]
                },
                "agent_mentioned_inventory_uncertainty": {"type": "boolean"},
                "agent_mentioned_class_not_guaranteed": {"type": "boolean"},
                "customer_vehicle_anxiety": {"type": "boolean"},
                "hard_constraint_type": {
                    "type": ["string", "null"],
                    "enum": ["none", "safety", "medical", "caregiving", "kids", "electric_vehicle", "other"]
                },
                "hard_constraint_details": {"type": ["string", "null"]},
                "evidence": {
                    "type": "array",
                    "items": {"type": "string"}
                }
            },
            "required": ["vehicle_class_category",
                         "agent_mentioned_inventory_uncertainty",
                         "agent_mentioned_class_not_guaranteed", "customer_vehicle_anxiety",
                         "hard_constraint_type", "hard_constraint_details", "evidence"],
            "additionalProperties": False
        },
        "E_insurance_coverage_money": {
            "type": "object",
            "properties": {
                "insurance_coverage_worry": {"type": "boolean"},
                "insurance_coverage_worry_evidence": {"type": ["string", "null"]},
                "deposit_worry": {"type": "boolean"},
                "deposit_worry_evidence": {"type": ["string", "null"]}
            },
            "required": ["insurance_coverage_worry", "insurance_coverage_worry_evidence",
                         "deposit_worry", "deposit_worry_evidence"],
            "additionalProperties": False
        },
        "F_transfers": {
            "type": "object",
            "properties": {
                "interpreter_transfer_occurred": {"type": ["boolean", "null"]},
                "interpreter_transfer_occurred_evidence": {"type": ["string", "null"]},
                "branch_transfer_attempted": {"type": "boolean"},
                "branch_transfer_attempted_evidence": {"type": ["string", "null"]},
                "branch_transfer_type": {
                    "type": ["string", "null"],
                    "enum": ["warm", "cold"]
                },
                "branch_transfer_type_evidence": {"type": ["string", "null"]},
                "warm_transfer_outcome": {
                    "type": ["string", "null"],
                    "enum": ["branch_took_over", "branch_busy_callback", "branch_no_answer"]
                },
                "warm_transfer_outcome_evidence": {"type": ["string", "null"]}
            },
            "required": ["interpreter_transfer_occurred", "interpreter_transfer_occurred_evidence",
                         "branch_transfer_attempted", "branch_transfer_attempted_evidence",
                         "branch_transfer_type", "branch_transfer_type_evidence",
                         "warm_transfer_outcome", "warm_transfer_outcome_evidence"],
            "additionalProperties": False
        },
        "G_emotional_psychological_signals": {
            "type": "object",
            "properties": {
                "distress_signals_present": {"type": "boolean"},
                "distress_signals_present_evidence": {"type": ["string", "null"]},
                "safety_concerns_present": {"type": "boolean"},
                "safety_concerns_present_evidence": {"type": ["string", "null"]}
            },
            "required": ["distress_signals_present", "distress_signals_present_evidence",
                         "safety_concerns_present", "safety_concerns_present_evidence"],
            "additionalProperties": False
        },
        "H_agent_behavior_clarity": {
            "type": "object",
            "properties": {
                "agent_polite_professional": {"type": ["boolean", "null"]},
                "agent_polite_professional_evidence": {"type": ["string", "null"]},
                "agent_acknowledged_concerns": {"type": "boolean"},
                "agent_acknowledged_concerns_evidence": {"type": ["string", "null"]}
            },
            "required": ["agent_polite_professional", "agent_polite_professional_evidence",
                         "agent_acknowledged_concerns", "agent_acknowledged_concerns_evidence"],
            "additionalProperties": False
        },
        "I_outcome_customer_effort": {
            "type": "object",
            "properties": {
                "cancellation_during_call": {"type": "boolean"},
                "customer_post_call_actions": {
                    "type": "array",
                    "items": {"type": "string"}
                },
                "evidence": {
                    "type": "array",
                    "items": {"type": "string"}
                }
            },
            "required": ["cancellation_during_call", "customer_post_call_actions", "evidence"],
            "additionalProperties": False
        },
        "J_local_branch_history": {
            "type": "object",
            "properties": {
                "prior_bad_branch_experience_mentioned": {"type": "boolean"},
                "prior_bad_branch_experience_mentioned_evidence": {"type": ["string", "null"]},
                "prior_bad_branch_experience_details": {"type": ["string", "null"]},
                "prior_bad_branch_experience_details_evidence": {"type": ["string", "null"]}
            },
            "required": ["prior_bad_branch_experience_mentioned", "prior_bad_branch_experience_mentioned_evidence",
                         "prior_bad_branch_experience_details", "prior_bad_branch_experience_details_evidence"],
            "additionalProperties": False
        },
        "K_competitive_landscape": {
            "type": "object",
            "properties": {
                "competitor_name": {"type": ["string", "null"]},
                "evidence": {
                    "type": "array",
                    "items": {"type": "string"}
                }
            },
            "required": ["competitor_name", "evidence"],
            "additionalProperties": False
        },
        "L_customer_complaints": {
            "type": "object",
            "properties": {
                "complaint_raised": {"type": ["boolean", "null"]},
                "complaint_raised_evidence": {"type": ["string", "null"]},
                "complaint_types": {
                    "type": "array",
                    "items": {
                        "type": "string",
                        "enum": ["wait_time", "service_quality", "vehicle_issues", "pricing",
                                 "availability", "location_too_far", "process_complexity", "other", "none"]
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
        }
    },
    "required": ["A_basic_context_identifiers", "B_time_feasibility",
                 "C_pickup_delivery_access", "D_fleet_vehicle_availability",
                 "E_insurance_coverage_money", "F_transfers",
                 "G_emotional_psychological_signals", "H_agent_behavior_clarity",
                 "I_outcome_customer_effort", "J_local_branch_history", "K_competitive_landscape",
                 "L_customer_complaints"],
    "additionalProperties": False
}

# JSON conversion prompt
JSON_CONVERSION_PROMPT = """Convert the following transcript analysis report into the required JSON schema.

Rules:
1. Boolean fields: Use true, false, or null (if not determinable)
2. String fields: Extract exact wording when available, otherwise summarize concisely
3. Arrays: Include all mentioned items, empty array [] if none
4. Enums: Must match exactly one of the specified values
5. Null handling: Use null only when information is genuinely not available
6. Preserve factual accuracy from the source report
7. Do not infer information not present in the report

Field Examples (use these as guidance):

A_basic_context_identifiers:
  - insurer_name: "State Farm", "Geico", "Progressive", null (if not mentioned)
  - branch_location: "LAX Airport", "Downtown Chicago", null (if not mentioned)
  - non_driveable: true (car totaled/can't drive/too damaged), false (car still driveable), null (not mentioned)
  - non_driveable_evidence: "Customer: My car is totaled", "Customer: The car won't start after the accident", null (if not mentioned)
  - conversation_summary: "Customer called to arrange pickup for insurance replacement after accident. Agent confirmed reservation and explained branch hours."

B_time_feasibility (each field has _evidence suffix for supporting quote):
  - customer_stated_timing_need: "needs car by 5pm today", "picking up tomorrow morning", null
  - customer_time_need_category: MUST match customer's words:
      "same_day_today" ← "today", "ASAP", "as soon as possible", "soonest", "heading there now", "right now", "immediately", "this afternoon", "tonight"
      "this_week" ← "tomorrow", "in a few days", "this week", "day after tomorrow"
      "next_week" ← "next week", "next Monday", "in a week"
      "unsure" ← "I'm not sure", "whenever", "flexible", "I don't know yet"
      "other" ← specific date mentioned (e.g., "January 15th")
      null ← timing not discussed at all
  - customer_time_need_category_evidence: "Customer: I need the car by 5pm today", null
  - branch_hours_constraints: "branch closes at 6pm", null
  - branch_hours_constraints_evidence: "Agent: We close at 6pm", null
  - request_feasible: MUST match what agent says:
      true ← agent confirms they can accommodate the request
      false ← agent says it won't work (branch closed, no availability, timing issue)
      null ← feasibility not explicitly addressed
  - request_feasible_evidence: quote or null
  - infeasibility_reasons: ["branch_closed"] | ["closing_soon", "too_far_wont_make_it"] | []
  - infeasibility_reasons_evidence: quote or null
  - stranded_risk_language: MUST match customer's words:
      true ← customer says "I'll be stuck", "stranded", "no way to get there", "I'll have no car"
      false ← customer doesn't express being stranded
      null ← not discussed
  - stranded_risk_language_evidence: "I'll be stranded without a car", null

C_pickup_delivery_access (each field has _evidence suffix):
  - pickup_requested: true | false | null
  - pickup_requested_evidence: quote or null
  - delivery_requested: true | false | null
  - delivery_requested_evidence: quote or null
  - self_pickup_only: true | false | null
  - self_pickup_only_evidence: quote or null
  - agent_said_pickup_delivery_not_guaranteed: true | false
  - agent_said_pickup_delivery_not_guaranteed_evidence: "Agent: Pickup is not guaranteed", null
  - agent_said_branch_discretion: true | false
  - agent_said_branch_discretion_evidence: quote or null
  - instructed_to_call_branch: true | false
  - instructed_to_call_branch_evidence: quote or null
  - option_5_instruction_used: true | false
  - option_5_instruction_used_evidence: "Agent: Press option 5 to reach the branch", null

D_fleet_vehicle_availability:
  - vehicle_class_category: "compact" | "midsize" | "fullsize" | "suv_small" | "suv_regular" | "special" | null
  - agent_mentioned_inventory_uncertainty: true ("subject to availability"/"depends on what's on the lot"), false
  - agent_mentioned_class_not_guaranteed: true ("can't guarantee exact class"), false
  - customer_vehicle_anxiety: MUST match customer's words:
      true ← customer says "will I get the car I need?", "what if they don't have one?", "will there be a car available?"
      false ← customer doesn't express vehicle concern
      null ← vehicle availability not discussed
  - hard_constraint_type: "none" | "safety" (car seats) | "medical" (wheelchair) | "caregiving" (elderly) | "kids" (children/family needs) | "electric_vehicle" (EV requirement) | "other" | null
  - hard_constraint_details: "needs car seat for toddler", "requires wheelchair accessible", null

E_insurance_coverage_money (each field has _evidence suffix):
  - insurance_coverage_worry: MUST match customer's words:
      true ← customer asks "what does insurance cover?", "am I covered for...?", "what if insurance doesn't pay?"
      false ← customer understands coverage or doesn't ask
      null ← insurance coverage not discussed
  - insurance_coverage_worry_evidence: "Customer: I'm not sure what the insurance covers", null
  - deposit_worry: MUST match customer's words:
      true ← customer says "I can't afford the deposit", "that's too much", "why do I need a deposit?"
      false ← customer accepts deposit without concern
      null ← deposit not discussed
  - deposit_worry_evidence: "Customer: I can't afford a $200 deposit", null

F_transfers (each field has _evidence suffix):
  CONDITIONAL NULL RULES (enforce strictly):
  • If branch_transfer_attempted = false → branch_transfer_type MUST be null
  • If branch_transfer_attempted = false → warm_transfer_outcome MUST be null
  • If branch_transfer_type ≠ "warm" → warm_transfer_outcome MUST be null

  - interpreter_transfer_occurred:
      true ← interpreter transfer happened
      false ← no interpreter transfer
      null ← unclear/not determinable from transcript
  - interpreter_transfer_occurred_evidence: quote or null
  - branch_transfer_attempted: true | false
  - branch_transfer_attempted_evidence: quote or null
  - branch_transfer_type:
      "warm" ← ONLY if branch_transfer_attempted = true AND agent talked to branch agent
      "cold" ← ONLY if branch_transfer_attempted = true AND call ended with automated message
      null ← if branch_transfer_attempted = false (not applicable)
  - branch_transfer_type_evidence: quote or null (null if type is null)
  - warm_transfer_outcome:
      "branch_took_over" | "branch_busy_callback" | "branch_no_answer" ← ONLY if branch_transfer_type = "warm"
      null ← if branch_transfer_type is "cold" or null (not applicable)
  - warm_transfer_outcome_evidence: quote or null (null if outcome is null)

G_emotional_psychological_signals (each field has _evidence suffix):
  - distress_signals_present: MUST match customer's behavior:
      true ← customer is crying, panicking, says "desperate", "scared", "I don't know what to do", "please help me"
      false ← customer is calm or only mildly frustrated
      null ← cannot determine from transcript
  - distress_signals_present_evidence: "Customer: [crying] I don't know what to do", null
  - safety_concerns_present: MUST match customer's words:
      true ← customer mentions domestic violence, fleeing danger, medical emergency, stranded in unsafe area
      false ← no safety concerns mentioned
      null ← unclear
  - safety_concerns_present_evidence: quote or null

H_agent_behavior_clarity (each field has _evidence suffix):
  - agent_polite_professional: MUST match agent's behavior:
      true ← agent says "thank you", "please", "I appreciate", "happy to help", "my pleasure", "I apologize"
      false ← agent is curt, dismissive, interrupts customer, shows frustration
      null ← neutral/standard interaction, no clear evidence
  - agent_polite_professional_evidence: "Agent: Thank you for your patience, I'm happy to help", null
  - agent_acknowledged_concerns: MUST match agent's words:
      true ← agent says "I understand", "I hear you", "I can see why", "I'm sorry to hear that"
      false ← agent ignores or dismisses concern
      null ← no concerns raised by customer
  - agent_acknowledged_concerns_evidence: "Agent: I understand your concern", null

I_outcome_customer_effort:
  - cancellation_during_call: true (reservation canceled), false
  - customer_post_call_actions: ["call branch", "bring ID", "arrive by 5pm"] | []

J_local_branch_history (each field has _evidence suffix):
  - prior_bad_branch_experience_mentioned: true | false
  - prior_bad_branch_experience_mentioned_evidence: "Customer: Last time at that branch I waited 2 hours", null
  - prior_bad_branch_experience_details: "long wait times at LAX location", null
  - prior_bad_branch_experience_details_evidence: quote or null

K_competitive_landscape:
  - competitor_name: "Enterprise", "Avis", "Budget", null (if no competitor mentioned)

L_customer_complaints (each field has _evidence suffix):
  - complaint_raised: MUST match customer's behavior:
      true ← customer explicitly complains or expresses frustration about specific issue
      false ← customer does not complain
      null ← unclear
  - complaint_raised_evidence: "Customer: I've been waiting for 30 minutes!", null
  - complaint_types: MUST match customer's words - select from this list ONLY:
      ["wait_time"] ← "I've been waiting", "long wait", "took forever", "been on hold"
      ["service_quality"] ← "rude staff", "unhelpful", "bad service"
      ["vehicle_issues"] ← "wrong car", "dirty car", "car broke down"
      ["pricing"] ← "too expensive", "unexpected charges", "hidden fees"
      ["availability"] ← "no cars", "nothing available"
      ["location_too_far"] ← "too far", "why that location?", "there's a closer branch", "that's far from me"
      ["process_complexity"] ← "too complicated", "too many steps"
      ["other"] ← complaint doesn't fit above categories
      ["none"] ← no complaint raised
      Can include multiple: ["wait_time", "service_quality"]
  - complaint_types_evidence: quote showing the complaint type
  - complaint_details: brief description of complaint, null if none
  - complaint_details_evidence: quote or null

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
    Step 1: Analyze transcript and generate comprehensive report.

    Returns:
        tuple: (analysis_report, input_tokens, output_tokens)
    """
    messages = [
        {"role": "system", "content": ANALYSIS_PROMPT},
        {"role": "user", "content": f"Transcript:\n\n{transcript_text}"}
    ]

    return call_openai_with_retry(client, messages, ANALYSIS_MODEL)


def step2_convert_to_json(client: OpenAI, analysis_report: str) -> tuple[dict[str, Any], int, int]:
    """
    Step 2: Convert analysis report to structured JSON.

    Returns:
        tuple: (json_data, input_tokens, output_tokens)
    """
    messages = [
        {"role": "system", "content": "You convert transcript analysis reports into structured JSON."},
        {"role": "user", "content": JSON_CONVERSION_PROMPT.format(analysis_report=analysis_report)}
    ]

    response_format = {
        "type": "json_schema",
        "json_schema": {
            "name": "transcript_features",
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
    print(f"  Step 1: Analyzing transcript...")
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
        description="Extract features from transcript files using OpenAI API"
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
    print(f"Transcript Feature Extraction")
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
