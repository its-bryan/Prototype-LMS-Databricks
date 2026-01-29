"""
TRANSLOG Feature Engineering for Conversion Analysis
=====================================================
Processes TRANSLOG data in phases to create aggregated features
for analyzing converted vs. unconverted leads.

Phases:
1. Load & Clean - Parse dates, filter columns
2. Quick Cancellation Analysis - Flag <10 min cancellations
3. Core Feature Engineering - Aggregate metrics per contract
4. Export - Ready for joining to conversion outcomes

Usage:
    python translog_feature_engineering.py --input <translog_file> --output <output_dir>
"""

import pandas as pd
import numpy as np
from pathlib import Path
from datetime import timedelta
import argparse
import logging
from typing import Tuple, Dict, List

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# =============================================================================
# CONFIGURATION - Key columns and codes to look for
# =============================================================================

# Columns to keep from raw TRANSLOG (adjust based on actual column names)
COLUMNS_TO_KEEP = [
    'ID', 'Knum', 'csplitid', 'REZ_NUM', 'SF_TRANS', 'LocCode',
    'SystemDate', 'ApplicationDate', 'TIMEZONE',
    'EventType', 'BGN01', 'STAT_FLAG', 'EXT',
    'MSG1', 'MSG2', 'MSG4', 'MSG5', 'MSG6', 'MSG10',
    'EMP_CODE', 'REQUESTED_DAYS'
]

# Event type mapping
EVENT_TYPES = {
    0: 'reservation',
    1: 'rental_agreement',
    2: 'employee',
    3: 'edi',
    4: 'location_contact'
}

# Transaction codes indicating cancellation (expand based on actual data)
CANCELLATION_CODES = ['CAN', 'CANC', '01', '02']  # Placeholder - needs validation
CANCELLATION_KEYWORDS = ['cancel', 'void', 'deleted', 'removed']

# Transaction codes indicating key milestones
UNIT_ASSIGNED_CODES = ['80']
UNIT_ASSIGNED_KEYWORDS = ['unit assigned', 'assigned unit']

RETURN_CODES = ['43', '100', '08C']
RETURN_KEYWORDS = ['returned', 'return r/a', 'date/time in']

EXTENSION_KEYWORDS = ['extension', 'auth', 'requested days']


# =============================================================================
# PHASE 1: LOAD AND CLEAN
# =============================================================================

def load_translog(filepath: str, chunksize: int = None, usecols: List[str] = None) -> pd.DataFrame:
    """
    Load TRANSLOG data from Excel or CSV.

    Args:
        filepath: Path to the TRANSLOG file
        chunksize: If set, returns iterator for chunked processing
        usecols: List of columns to load (for memory efficiency)

    Returns:
        DataFrame with TRANSLOG data (or iterator if chunksize specified)
    """
    filepath = Path(filepath)
    logger.info(f"Loading TRANSLOG from {filepath}")

    if filepath.suffix == '.xlsx':
        df = pd.read_excel(filepath, engine='openpyxl', usecols=usecols)
    elif filepath.suffix == '.csv':
        if chunksize:
            return pd.read_csv(filepath, chunksize=chunksize, usecols=usecols, low_memory=False)
        df = pd.read_csv(filepath, usecols=usecols, low_memory=False)
    else:
        raise ValueError(f"Unsupported file format: {filepath.suffix}")

    logger.info(f"Loaded {len(df):,} rows, {len(df.columns)} columns")
    return df


def parse_datetime(value) -> pd.Timestamp:
    """Parse YYYYMMDDHHMMSS integer format to datetime."""
    if pd.isna(value) or value == 0:
        return pd.NaT
    try:
        return pd.to_datetime(str(int(value)), format='%Y%m%d%H%M%S')
    except:
        return pd.NaT


def clean_translog(df: pd.DataFrame) -> pd.DataFrame:
    """
    Clean and standardize TRANSLOG data.

    - Parse datetime columns
    - Standardize column names
    - Remove completely empty columns
    - Convert data types
    """
    logger.info("Cleaning TRANSLOG data...")

    # Work with available columns
    available_cols = [c for c in COLUMNS_TO_KEEP if c in df.columns]
    df = df[available_cols].copy()

    # Parse datetime columns
    if 'SystemDate' in df.columns:
        df['system_datetime'] = df['SystemDate'].apply(parse_datetime)
    if 'ApplicationDate' in df.columns:
        df['application_datetime'] = df['ApplicationDate'].apply(parse_datetime)

    # Rename columns for clarity
    rename_map = {
        'ID': 'transaction_id',
        'Knum': 'contract_key',
        'csplitid': 'csplit_id',
        'REZ_NUM': 'reservation_number',
        'SF_TRANS': 'source_transaction_id',
        'LocCode': 'location_code',
        'TIMEZONE': 'timezone_offset',
        'EventType': 'event_type',
        'BGN01': 'transaction_code',
        'STAT_FLAG': 'status_flag',
        'EXT': 'extension_flag',
        'MSG1': 'message_primary',
        'MSG2': 'message_secondary',
        'MSG4': 'message_approval',
        'MSG5': 'source_application',
        'MSG6': 'adjuster_name',
        'MSG10': 'message_details',
        'EMP_CODE': 'employee_code',
        'REQUESTED_DAYS': 'requested_days'
    }
    df = df.rename(columns={k: v for k, v in rename_map.items() if k in df.columns})

    # Clean up values
    if 'contract_key' in df.columns:
        df['contract_key'] = df['contract_key'].astype(str).str.strip()
        df = df[df['contract_key'].notna() & (df['contract_key'] != '') & (df['contract_key'] != 'nan')]

    if 'csplit_id' in df.columns:
        df['csplit_id'] = pd.to_numeric(df['csplit_id'], errors='coerce').fillna(0).astype(int)

    if 'requested_days' in df.columns:
        df['requested_days'] = pd.to_numeric(df['requested_days'], errors='coerce').fillna(0).astype(int)

    # Convert message columns to lowercase for searching
    for col in ['message_primary', 'message_secondary', 'message_details']:
        if col in df.columns:
            df[f'{col}_lower'] = df[col].fillna('').astype(str).str.lower()

    logger.info(f"Cleaned data: {len(df):,} rows, {len(df.columns)} columns")
    return df


# =============================================================================
# PHASE 2: QUICK CANCELLATION ANALYSIS
# =============================================================================

def identify_cancellations(df: pd.DataFrame) -> pd.DataFrame:
    """
    Identify cancellation events based on transaction codes and message content.

    Returns DataFrame with cancellation flag added.
    """
    logger.info("Identifying cancellation events...")

    df['is_cancellation'] = False

    # Check transaction codes
    if 'transaction_code' in df.columns:
        code_match = df['transaction_code'].astype(str).str.upper().isin(
            [c.upper() for c in CANCELLATION_CODES]
        )
        df.loc[code_match, 'is_cancellation'] = True

    # Check message content for cancellation keywords
    for col in ['message_primary_lower', 'message_secondary_lower', 'message_details_lower']:
        if col in df.columns:
            for keyword in CANCELLATION_KEYWORDS:
                keyword_match = df[col].str.contains(keyword, na=False)
                df.loc[keyword_match, 'is_cancellation'] = True

    cancel_count = df['is_cancellation'].sum()
    logger.info(f"Found {cancel_count:,} cancellation events ({cancel_count/len(df)*100:.1f}%)")

    return df


def analyze_quick_cancellations(df: pd.DataFrame, threshold_minutes: int = 10) -> pd.DataFrame:
    """
    Identify reservations cancelled within threshold_minutes of first event.

    This is a key metric: reservations that never had a chance to convert.

    Returns DataFrame with one row per contract showing quick cancellation status.
    """
    logger.info(f"Analyzing quick cancellations (threshold: {threshold_minutes} minutes)...")

    # Ensure we have cancellation flags
    if 'is_cancellation' not in df.columns:
        df = identify_cancellations(df)

    results = []

    for contract_key, group in df.groupby('contract_key'):
        group = group.sort_values('system_datetime')

        first_event_time = group['system_datetime'].min()

        # Find cancellation events
        cancellations = group[group['is_cancellation']]

        if len(cancellations) > 0:
            first_cancel_time = cancellations['system_datetime'].min()
            time_to_cancel = (first_cancel_time - first_event_time).total_seconds() / 60

            # Check if adjuster-related
            cancel_row = cancellations.iloc[0]
            is_adjuster_cancel = pd.notna(cancel_row.get('adjuster_name', None))

            results.append({
                'contract_key': contract_key,
                'first_event_time': first_event_time,
                'first_cancel_time': first_cancel_time,
                'minutes_to_cancel': time_to_cancel,
                'is_quick_cancel': time_to_cancel <= threshold_minutes,
                'is_adjuster_cancel': is_adjuster_cancel,
                'cancel_message': cancel_row.get('message_primary', ''),
                'total_events_before_cancel': len(group[group['system_datetime'] <= first_cancel_time])
            })
        else:
            results.append({
                'contract_key': contract_key,
                'first_event_time': first_event_time,
                'first_cancel_time': pd.NaT,
                'minutes_to_cancel': np.nan,
                'is_quick_cancel': False,
                'is_adjuster_cancel': False,
                'cancel_message': '',
                'total_events_before_cancel': 0
            })

    quick_cancel_df = pd.DataFrame(results)

    # Summary statistics
    total_contracts = len(quick_cancel_df)
    quick_cancels = quick_cancel_df['is_quick_cancel'].sum()
    adjuster_quick_cancels = quick_cancel_df[
        quick_cancel_df['is_quick_cancel'] & quick_cancel_df['is_adjuster_cancel']
    ].shape[0]

    logger.info(f"Quick cancellation summary:")
    logger.info(f"  Total contracts: {total_contracts:,}")
    logger.info(f"  Quick cancellations (<{threshold_minutes} min): {quick_cancels:,} ({quick_cancels/total_contracts*100:.1f}%)")
    logger.info(f"  Adjuster quick cancellations: {adjuster_quick_cancels:,}")

    return quick_cancel_df


# =============================================================================
# PHASE 3: CORE FEATURE ENGINEERING
# =============================================================================

def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Create aggregated features per contract_key.

    Features are organized by priority (80/20 rule - most impactful first).
    """
    logger.info("Engineering features per contract...")

    # Ensure we have cancellation flags
    if 'is_cancellation' not in df.columns:
        df = identify_cancellations(df)

    features_list = []

    for contract_key, group in df.groupby('contract_key'):
        group = group.sort_values('system_datetime')

        features = {'contract_key': contract_key}

        # -----------------------------------------------------------------
        # PRIORITY 1: Quick Cancellation Flag
        # -----------------------------------------------------------------
        first_time = group['system_datetime'].min()
        cancellations = group[group['is_cancellation']]

        if len(cancellations) > 0:
            first_cancel = cancellations['system_datetime'].min()
            minutes_to_cancel = (first_cancel - first_time).total_seconds() / 60
            features['has_cancellation'] = True
            features['minutes_to_cancel'] = minutes_to_cancel
            features['is_quick_cancel_10min'] = minutes_to_cancel <= 10
            features['is_quick_cancel_30min'] = minutes_to_cancel <= 30
            features['is_quick_cancel_60min'] = minutes_to_cancel <= 60
        else:
            features['has_cancellation'] = False
            features['minutes_to_cancel'] = np.nan
            features['is_quick_cancel_10min'] = False
            features['is_quick_cancel_30min'] = False
            features['is_quick_cancel_60min'] = False

        # -----------------------------------------------------------------
        # PRIORITY 2: CSPLIT Linkage (reached rental stage)
        # -----------------------------------------------------------------
        if 'csplit_id' in group.columns:
            features['has_csplit_id'] = (group['csplit_id'] > 0).any()
            features['max_csplit_id'] = group['csplit_id'].max()

        # -----------------------------------------------------------------
        # PRIORITY 3: Unit Assigned (key milestone)
        # -----------------------------------------------------------------
        has_unit_assigned = False
        if 'message_primary_lower' in group.columns:
            has_unit_assigned = group['message_primary_lower'].str.contains(
                '|'.join(UNIT_ASSIGNED_KEYWORDS), na=False
            ).any()
        if 'transaction_code' in group.columns and not has_unit_assigned:
            has_unit_assigned = group['transaction_code'].astype(str).isin(UNIT_ASSIGNED_CODES).any()
        features['has_unit_assigned'] = has_unit_assigned

        # -----------------------------------------------------------------
        # PRIORITY 4: Event Counts (engagement level)
        # -----------------------------------------------------------------
        features['total_events'] = len(group)
        features['unique_transaction_codes'] = group['transaction_code'].nunique() if 'transaction_code' in group.columns else 0

        # Event type counts
        if 'event_type' in group.columns:
            event_counts = group['event_type'].value_counts()
            for event_code, event_name in EVENT_TYPES.items():
                features[f'count_event_{event_name}'] = event_counts.get(event_code, 0)

        # -----------------------------------------------------------------
        # PRIORITY 5: EDI Activity (insurance partner communication)
        # -----------------------------------------------------------------
        if 'event_type' in group.columns:
            features['count_edi_events'] = (group['event_type'] == 3).sum()
        if 'source_application' in group.columns:
            features['has_edicar_trans'] = group['source_application'].str.contains(
                'EDICAR', case=False, na=False
            ).any()

        # -----------------------------------------------------------------
        # PRIORITY 6: Extension Activity
        # -----------------------------------------------------------------
        if 'extension_flag' in group.columns:
            features['has_insurance_call'] = (group['extension_flag'] == 'InsCall').any()
            features['count_insurance_calls'] = (group['extension_flag'] == 'InsCall').sum()

        if 'requested_days' in group.columns:
            features['total_requested_days'] = group['requested_days'].sum()
            features['max_requested_days'] = group['requested_days'].max()
            features['has_extension_request'] = (group['requested_days'] > 0).any()

        # Extension keywords in messages
        has_extension_msg = False
        for col in ['message_primary_lower', 'message_secondary_lower']:
            if col in group.columns:
                has_extension_msg = has_extension_msg or group[col].str.contains(
                    'extension', na=False
                ).any()
        features['has_extension_message'] = has_extension_msg

        # -----------------------------------------------------------------
        # PRIORITY 7: Temporal Features
        # -----------------------------------------------------------------
        features['first_event_time'] = first_time
        features['last_event_time'] = group['system_datetime'].max()

        duration = (features['last_event_time'] - features['first_event_time']).total_seconds()
        features['duration_hours'] = duration / 3600
        features['duration_days'] = duration / 86400

        # Events per day (engagement intensity)
        if features['duration_days'] > 0:
            features['events_per_day'] = features['total_events'] / max(features['duration_days'], 1)
        else:
            features['events_per_day'] = features['total_events']

        # Time to first R/A event
        if 'event_type' in group.columns:
            ra_events = group[group['event_type'] == 1]
            if len(ra_events) > 0:
                first_ra_time = ra_events['system_datetime'].min()
                features['hours_to_first_ra'] = (first_ra_time - first_time).total_seconds() / 3600
            else:
                features['hours_to_first_ra'] = np.nan

        # -----------------------------------------------------------------
        # PRIORITY 8: Customer Contact
        # -----------------------------------------------------------------
        if 'event_type' in group.columns:
            features['count_contact_events'] = (group['event_type'] == 4).sum()

        contact_keywords = ['contact', 'call', 'phone', 'email']
        has_contact = False
        for col in ['message_primary_lower', 'message_secondary_lower']:
            if col in group.columns:
                has_contact = has_contact or group[col].str.contains(
                    '|'.join(contact_keywords), na=False
                ).any()
        features['has_contact_attempt'] = has_contact

        # -----------------------------------------------------------------
        # ADDITIONAL: Return/Completion Indicators
        # -----------------------------------------------------------------
        has_return = False
        if 'message_primary_lower' in group.columns:
            has_return = group['message_primary_lower'].str.contains(
                '|'.join(RETURN_KEYWORDS), na=False
            ).any()
        if 'transaction_code' in group.columns and not has_return:
            has_return = group['transaction_code'].astype(str).isin(RETURN_CODES).any()
        features['has_return_event'] = has_return

        # -----------------------------------------------------------------
        # ADDITIONAL: Location and Employee
        # -----------------------------------------------------------------
        if 'location_code' in group.columns:
            features['location_code'] = group['location_code'].mode().iloc[0] if len(group['location_code'].mode()) > 0 else None

        if 'employee_code' in group.columns:
            features['unique_employees'] = group['employee_code'].nunique()

        # -----------------------------------------------------------------
        # ADDITIONAL: Adjuster Activity
        # -----------------------------------------------------------------
        if 'adjuster_name' in group.columns:
            adjuster_events = group[group['adjuster_name'].notna() & (group['adjuster_name'] != '')]
            features['has_adjuster_activity'] = len(adjuster_events) > 0
            features['count_adjuster_events'] = len(adjuster_events)

        features_list.append(features)

    features_df = pd.DataFrame(features_list)

    logger.info(f"Engineered {len(features_df.columns)} features for {len(features_df):,} contracts")

    return features_df


# =============================================================================
# PHASE 4: SUMMARY AND EXPORT
# =============================================================================

def generate_summary_report(features_df: pd.DataFrame, quick_cancel_df: pd.DataFrame = None) -> str:
    """Generate a summary report of the feature engineering results."""

    report = []
    report.append("=" * 60)
    report.append("TRANSLOG FEATURE ENGINEERING SUMMARY")
    report.append("=" * 60)
    report.append("")

    # Basic stats
    report.append(f"Total contracts analyzed: {len(features_df):,}")
    report.append("")

    # Quick cancellation stats
    report.append("QUICK CANCELLATION ANALYSIS (Priority 1)")
    report.append("-" * 40)
    if 'is_quick_cancel_10min' in features_df.columns:
        qc_10 = features_df['is_quick_cancel_10min'].sum()
        qc_30 = features_df['is_quick_cancel_30min'].sum()
        qc_60 = features_df['is_quick_cancel_60min'].sum()
        total = len(features_df)

        report.append(f"  Cancelled within 10 min: {qc_10:,} ({qc_10/total*100:.1f}%)")
        report.append(f"  Cancelled within 30 min: {qc_30:,} ({qc_30/total*100:.1f}%)")
        report.append(f"  Cancelled within 60 min: {qc_60:,} ({qc_60/total*100:.1f}%)")
    report.append("")

    # Milestone stats
    report.append("KEY MILESTONE PRESENCE")
    report.append("-" * 40)
    for col, label in [
        ('has_csplit_id', 'Has CSPLIT ID (reached rental stage)'),
        ('has_unit_assigned', 'Has Unit Assigned'),
        ('has_return_event', 'Has Return Event'),
        ('has_insurance_call', 'Has Insurance Call'),
        ('has_extension_request', 'Has Extension Request'),
        ('has_contact_attempt', 'Has Contact Attempt'),
        ('has_adjuster_activity', 'Has Adjuster Activity')
    ]:
        if col in features_df.columns:
            count = features_df[col].sum()
            pct = count / len(features_df) * 100
            report.append(f"  {label}: {count:,} ({pct:.1f}%)")
    report.append("")

    # Activity stats
    report.append("ACTIVITY METRICS")
    report.append("-" * 40)
    if 'total_events' in features_df.columns:
        report.append(f"  Total events - Mean: {features_df['total_events'].mean():.1f}, Median: {features_df['total_events'].median():.0f}")
    if 'duration_days' in features_df.columns:
        report.append(f"  Duration (days) - Mean: {features_df['duration_days'].mean():.1f}, Median: {features_df['duration_days'].median():.1f}")
    if 'count_edi_events' in features_df.columns:
        report.append(f"  EDI events - Mean: {features_df['count_edi_events'].mean():.1f}")

    return "\n".join(report)


def export_features(
    features_df: pd.DataFrame,
    output_dir: str,
    prefix: str = "translog_features"
) -> Dict[str, str]:
    """
    Export engineered features to CSV files.

    Exports:
    1. Full features dataset
    2. Priority features only (for quick analysis)
    3. Summary statistics
    """
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    outputs = {}

    # Full features
    full_path = output_dir / f"{prefix}_full.csv"
    features_df.to_csv(full_path, index=False)
    outputs['full'] = str(full_path)
    logger.info(f"Exported full features to {full_path}")

    # Priority features (80/20)
    priority_cols = [
        'contract_key',
        'is_quick_cancel_10min', 'is_quick_cancel_30min', 'minutes_to_cancel',
        'has_csplit_id', 'has_unit_assigned', 'has_return_event',
        'total_events', 'count_edi_events',
        'has_insurance_call', 'has_extension_request', 'total_requested_days',
        'duration_days', 'hours_to_first_ra',
        'has_contact_attempt', 'count_contact_events'
    ]
    priority_cols = [c for c in priority_cols if c in features_df.columns]
    priority_df = features_df[priority_cols]

    priority_path = output_dir / f"{prefix}_priority.csv"
    priority_df.to_csv(priority_path, index=False)
    outputs['priority'] = str(priority_path)
    logger.info(f"Exported priority features to {priority_path}")

    return outputs


# =============================================================================
# CHUNKED PROCESSING FOR LARGE FILES
# =============================================================================

def process_translog_chunked(
    input_path: str,
    output_dir: str,
    chunksize: int = 500000,
    quick_cancel_threshold: int = 10
) -> Tuple[pd.DataFrame, str]:
    """
    Process large TRANSLOG files in chunks to manage memory.

    Strategy:
    1. First pass: Collect all events grouped by contract_key
    2. Second pass: Engineer features per contract

    Args:
        input_path: Path to TRANSLOG file
        output_dir: Directory for output files
        chunksize: Rows per chunk (default 500k)
        quick_cancel_threshold: Minutes for quick cancellation flag

    Returns:
        Tuple of (features_df, summary_report)
    """
    logger.info("=" * 60)
    logger.info("TRANSLOG CHUNKED PROCESSING PIPELINE")
    logger.info("=" * 60)

    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    # Columns we need (skip unnecessary ones to save memory)
    needed_cols = [
        'ID', 'Knum', 'csplitid', 'REZ_NUM', 'SF_TRANS', 'LocCode',
        'SystemDate', 'ApplicationDate', 'TIMEZONE',
        'EventType', 'BGN01', 'STAT_FLAG', 'EXT',
        'MSG1', 'MSG2', 'MSG4', 'MSG5', 'MSG6', 'MSG10',
        'EMP_CODE', 'REQUESTED_DAYS'
    ]

    # =================================================================
    # PHASE 1: First pass - collect and aggregate events by contract
    # =================================================================
    logger.info("\n--- PHASE 1: COLLECTING EVENTS BY CONTRACT ---")

    contract_events = {}  # contract_key -> list of event dicts
    total_rows = 0
    chunk_num = 0

    filepath = Path(input_path)
    chunks = pd.read_csv(filepath, chunksize=chunksize, low_memory=False)

    for chunk in chunks:
        chunk_num += 1
        chunk_rows = len(chunk)
        total_rows += chunk_rows
        logger.info(f"Processing chunk {chunk_num}: {chunk_rows:,} rows (total: {total_rows:,})")

        # Filter to needed columns that exist
        available_cols = [c for c in needed_cols if c in chunk.columns]
        chunk = chunk[available_cols].copy()

        # Clean the chunk
        chunk = clean_translog(chunk)

        # Skip rows without contract_key
        chunk = chunk[chunk['contract_key'].notna() & (chunk['contract_key'] != '')]

        # Group events by contract
        for _, row in chunk.iterrows():
            key = row['contract_key']
            if key not in contract_events:
                contract_events[key] = []

            # Store minimal event info needed for features
            event = {
                'system_datetime': row.get('system_datetime'),
                'event_type': row.get('event_type'),
                'transaction_code': row.get('transaction_code'),
                'csplit_id': row.get('csplit_id', 0),
                'extension_flag': row.get('extension_flag'),
                'requested_days': row.get('requested_days', 0),
                'message_primary_lower': row.get('message_primary_lower', ''),
                'message_secondary_lower': row.get('message_secondary_lower', ''),
                'adjuster_name': row.get('adjuster_name'),
                'location_code': row.get('location_code'),
                'employee_code': row.get('employee_code'),
            }
            contract_events[key].append(event)

        # Memory management - log progress
        if chunk_num % 5 == 0:
            logger.info(f"  Unique contracts so far: {len(contract_events):,}")

    logger.info(f"\nPhase 1 complete:")
    logger.info(f"  Total rows processed: {total_rows:,}")
    logger.info(f"  Unique contracts: {len(contract_events):,}")

    # =================================================================
    # PHASE 2: Engineer features per contract
    # =================================================================
    logger.info("\n--- PHASE 2: ENGINEERING FEATURES ---")

    features_list = []
    contracts_processed = 0

    for contract_key, events in contract_events.items():
        contracts_processed += 1

        if contracts_processed % 50000 == 0:
            logger.info(f"  Processed {contracts_processed:,} / {len(contract_events):,} contracts")

        # Sort events by time
        events = sorted(events, key=lambda x: x['system_datetime'] if pd.notna(x['system_datetime']) else pd.Timestamp.min)

        features = {'contract_key': contract_key}

        # Get timestamps
        valid_times = [e['system_datetime'] for e in events if pd.notna(e['system_datetime'])]
        first_time = min(valid_times) if valid_times else pd.NaT
        last_time = max(valid_times) if valid_times else pd.NaT

        # -----------------------------------------------------------------
        # PRIORITY 1: Quick Cancellation
        # -----------------------------------------------------------------
        cancel_events = [e for e in events if _is_cancellation(e)]

        if cancel_events:
            cancel_times = [e['system_datetime'] for e in cancel_events if pd.notna(e['system_datetime'])]
            if cancel_times and pd.notna(first_time):
                first_cancel = min(cancel_times)
                minutes_to_cancel = (first_cancel - first_time).total_seconds() / 60
                features['has_cancellation'] = True
                features['minutes_to_cancel'] = minutes_to_cancel
                features['is_quick_cancel_10min'] = minutes_to_cancel <= 10
                features['is_quick_cancel_30min'] = minutes_to_cancel <= 30
                features['is_quick_cancel_60min'] = minutes_to_cancel <= 60

                # Check if adjuster-related
                cancel_event = cancel_events[0]
                features['is_adjuster_cancel'] = pd.notna(cancel_event.get('adjuster_name'))
            else:
                features['has_cancellation'] = True
                features['minutes_to_cancel'] = np.nan
                features['is_quick_cancel_10min'] = False
                features['is_quick_cancel_30min'] = False
                features['is_quick_cancel_60min'] = False
                features['is_adjuster_cancel'] = False
        else:
            features['has_cancellation'] = False
            features['minutes_to_cancel'] = np.nan
            features['is_quick_cancel_10min'] = False
            features['is_quick_cancel_30min'] = False
            features['is_quick_cancel_60min'] = False
            features['is_adjuster_cancel'] = False

        # -----------------------------------------------------------------
        # PRIORITY 2: CSPLIT Linkage
        # -----------------------------------------------------------------
        csplit_ids = [e['csplit_id'] for e in events if e.get('csplit_id', 0) > 0]
        features['has_csplit_id'] = len(csplit_ids) > 0
        features['max_csplit_id'] = max(csplit_ids) if csplit_ids else 0

        # -----------------------------------------------------------------
        # PRIORITY 3: Unit Assigned
        # -----------------------------------------------------------------
        features['has_unit_assigned'] = any(
            'unit assigned' in e.get('message_primary_lower', '') or
            'assigned unit' in e.get('message_primary_lower', '') or
            str(e.get('transaction_code', '')) in UNIT_ASSIGNED_CODES
            for e in events
        )

        # -----------------------------------------------------------------
        # PRIORITY 4: Event Counts
        # -----------------------------------------------------------------
        features['total_events'] = len(events)
        features['unique_transaction_codes'] = len(set(e.get('transaction_code') for e in events if e.get('transaction_code')))

        # Event type counts
        event_types = [e.get('event_type') for e in events]
        for code, name in EVENT_TYPES.items():
            features[f'count_event_{name}'] = event_types.count(code)

        # -----------------------------------------------------------------
        # PRIORITY 5: EDI Activity
        # -----------------------------------------------------------------
        features['count_edi_events'] = event_types.count(3)

        # -----------------------------------------------------------------
        # PRIORITY 6: Extension Activity
        # -----------------------------------------------------------------
        ins_calls = [e for e in events if e.get('extension_flag') == 'InsCall']
        features['has_insurance_call'] = len(ins_calls) > 0
        features['count_insurance_calls'] = len(ins_calls)

        req_days = [e.get('requested_days', 0) for e in events]
        features['total_requested_days'] = sum(d for d in req_days if d and d > 0)
        features['max_requested_days'] = max(req_days) if req_days else 0
        features['has_extension_request'] = features['total_requested_days'] > 0

        features['has_extension_message'] = any(
            'extension' in e.get('message_primary_lower', '') or
            'extension' in e.get('message_secondary_lower', '')
            for e in events
        )

        # -----------------------------------------------------------------
        # PRIORITY 7: Temporal Features
        # -----------------------------------------------------------------
        features['first_event_time'] = first_time
        features['last_event_time'] = last_time

        if pd.notna(first_time) and pd.notna(last_time):
            duration = (last_time - first_time).total_seconds()
            features['duration_hours'] = duration / 3600
            features['duration_days'] = duration / 86400
            features['events_per_day'] = len(events) / max(features['duration_days'], 1)
        else:
            features['duration_hours'] = 0
            features['duration_days'] = 0
            features['events_per_day'] = len(events)

        # Time to first R/A event
        ra_events = [e for e in events if e.get('event_type') == 1]
        if ra_events and pd.notna(first_time):
            ra_times = [e['system_datetime'] for e in ra_events if pd.notna(e['system_datetime'])]
            if ra_times:
                features['hours_to_first_ra'] = (min(ra_times) - first_time).total_seconds() / 3600
            else:
                features['hours_to_first_ra'] = np.nan
        else:
            features['hours_to_first_ra'] = np.nan

        # -----------------------------------------------------------------
        # PRIORITY 8: Customer Contact
        # -----------------------------------------------------------------
        features['count_contact_events'] = event_types.count(4)

        contact_keywords = ['contact', 'call', 'phone', 'email']
        features['has_contact_attempt'] = any(
            any(kw in e.get('message_primary_lower', '') or kw in e.get('message_secondary_lower', '')
                for kw in contact_keywords)
            for e in events
        )

        # -----------------------------------------------------------------
        # ADDITIONAL: Return/Completion
        # -----------------------------------------------------------------
        features['has_return_event'] = any(
            any(kw in e.get('message_primary_lower', '') for kw in RETURN_KEYWORDS) or
            str(e.get('transaction_code', '')) in RETURN_CODES
            for e in events
        )

        # Location (mode)
        locations = [e.get('location_code') for e in events if e.get('location_code')]
        if locations:
            features['location_code'] = max(set(locations), key=locations.count)
        else:
            features['location_code'] = None

        # Unique employees
        employees = [e.get('employee_code') for e in events if e.get('employee_code')]
        features['unique_employees'] = len(set(employees))

        # Adjuster activity
        adjuster_events = [e for e in events if pd.notna(e.get('adjuster_name')) and e.get('adjuster_name') != '']
        features['has_adjuster_activity'] = len(adjuster_events) > 0
        features['count_adjuster_events'] = len(adjuster_events)

        features_list.append(features)

    # Free memory
    del contract_events

    features_df = pd.DataFrame(features_list)
    logger.info(f"\nPhase 2 complete: {len(features_df):,} contracts with {len(features_df.columns)} features")

    # =================================================================
    # PHASE 3: Summary and Export
    # =================================================================
    logger.info("\n--- PHASE 3: SUMMARY AND EXPORT ---")

    summary_report = generate_summary_report(features_df)
    print("\n" + summary_report)

    # Export
    export_features(features_df, output_dir)

    # Save summary
    report_path = output_dir / "feature_engineering_summary.txt"
    with open(report_path, 'w') as f:
        f.write(summary_report)
    logger.info(f"Saved summary report to {report_path}")

    return features_df, summary_report


def _is_cancellation(event: dict) -> bool:
    """Check if an event represents a cancellation."""
    # Check transaction code
    code = str(event.get('transaction_code', '')).upper()
    if code in [c.upper() for c in CANCELLATION_CODES]:
        return True

    # Check message content
    msg_primary = event.get('message_primary_lower', '')
    msg_secondary = event.get('message_secondary_lower', '')

    for keyword in CANCELLATION_KEYWORDS:
        if keyword in msg_primary or keyword in msg_secondary:
            return True

    return False


# =============================================================================
# MAIN EXECUTION
# =============================================================================

def process_translog(
    input_path: str,
    output_dir: str,
    quick_cancel_threshold: int = 10,
    use_chunked: bool = False,
    chunksize: int = 500000
) -> Tuple[pd.DataFrame, pd.DataFrame, str]:
    """
    Main processing pipeline for TRANSLOG data.

    Args:
        input_path: Path to TRANSLOG file (xlsx or csv)
        output_dir: Directory for output files
        quick_cancel_threshold: Minutes threshold for quick cancellation
        use_chunked: If True, use chunked processing for large files
        chunksize: Rows per chunk when using chunked processing

    Returns:
        Tuple of (features_df, quick_cancel_df, summary_report)
    """
    # Auto-detect if chunked processing needed
    filepath = Path(input_path)
    file_size_gb = filepath.stat().st_size / (1024**3)

    if use_chunked or file_size_gb > 0.5:  # Use chunked for files > 500MB
        logger.info(f"File size: {file_size_gb:.2f} GB - using chunked processing")
        features_df, summary_report = process_translog_chunked(
            input_path, output_dir, chunksize, quick_cancel_threshold
        )
        return features_df, None, summary_report

    # Standard processing for smaller files
    logger.info("=" * 60)
    logger.info("TRANSLOG FEATURE ENGINEERING PIPELINE")
    logger.info("=" * 60)

    # Phase 1: Load and Clean
    logger.info("\n--- PHASE 1: LOAD AND CLEAN ---")
    df = load_translog(input_path)
    df = clean_translog(df)

    # Phase 2: Quick Cancellation Analysis
    logger.info("\n--- PHASE 2: QUICK CANCELLATION ANALYSIS ---")
    quick_cancel_df = analyze_quick_cancellations(df, threshold_minutes=quick_cancel_threshold)

    # Phase 3: Feature Engineering
    logger.info("\n--- PHASE 3: FEATURE ENGINEERING ---")
    features_df = engineer_features(df)

    # Phase 4: Summary and Export
    logger.info("\n--- PHASE 4: SUMMARY AND EXPORT ---")
    summary_report = generate_summary_report(features_df, quick_cancel_df)
    print("\n" + summary_report)

    export_features(features_df, output_dir)

    # Export quick cancel analysis
    qc_path = Path(output_dir) / "quick_cancellation_analysis.csv"
    quick_cancel_df.to_csv(qc_path, index=False)
    logger.info(f"Exported quick cancellation analysis to {qc_path}")

    # Save summary report
    report_path = Path(output_dir) / "feature_engineering_summary.txt"
    with open(report_path, 'w') as f:
        f.write(summary_report)
    logger.info(f"Saved summary report to {report_path}")

    return features_df, quick_cancel_df, summary_report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="TRANSLOG Feature Engineering Pipeline")
    parser.add_argument("--input", "-i", required=True, help="Path to TRANSLOG file")
    parser.add_argument("--output", "-o", default="./output", help="Output directory")
    parser.add_argument("--threshold", "-t", type=int, default=10,
                        help="Quick cancellation threshold in minutes")

    args = parser.parse_args()

    process_translog(args.input, args.output, args.threshold)
