"""Data cleaning functions for HLES and TRANSLOG uploads."""
import pandas as pd
import re


# ─── Translog filtering & category constants ─────────────────────────────────
# Used by both ETL and API layers. All rows are loaded into the DB; filtering
# happens at query time based on user role (BM/GM see relevant only, Admin all).

KEEP_PREFIXES = ("Loc-", "Rez-")

# Rez- events that pass the prefix check but are not actionable for BMs
SKIP_REZ = {
    "Rez-Change Renter Name",
    "Rez-Add/Update Repair Shop",
    "Rez-Add/Update Employer",
    "Rez-Add/Update Renter`s Insurance",
    "Rez-Changed Res Class",
}

KEEP_RA_WHITELIST = {
    "R/A-Rent Opened",
    "R/A-Post Returned",
    "R/A-Returned",
    "R/A-Upsell Made",
    "R/A-Credit Auth Failed",
    "R/A-Unit Assigned at Open",
    "R/A-Changed Return Date",
    "R/A-Rate Update",
}


def is_lms_relevant(msg1: str | None) -> bool:
    """Return True if this translog event is relevant for BM/GM views."""
    if not msg1:
        return False
    if msg1 in SKIP_REZ:
        return False
    if msg1.startswith(KEEP_PREFIXES):
        return True
    if msg1 in KEEP_RA_WHITELIST:
        return True
    if msg1.startswith("Request Extensions"):
        return True
    return False


def derive_category(msg1: str | None, msg10: str | None = None) -> str:
    """Derive an activity category from the MSG1 prefix and MSG10 content."""
    if not msg1:
        return "other"
    if msg10 and "MMR" in msg10.upper():
        return "mmr"
    if msg1.startswith("Loc-"):
        return "location"
    if msg1.startswith("Rez-"):
        return "reservation"
    if msg1.startswith("R/A-") or msg1.startswith("RA-"):
        return "rental_agreement"
    if msg1.startswith("Edi-"):
        return "edi"
    if msg1.startswith("Emp-"):
        return "employee"
    if msg1.startswith("Sys-"):
        return "system"
    if msg1.startswith("Request Extensions"):
        return "extension"
    return "other"


# SQL WHERE clause fragment for BM/GM role filtering (used by routers)
LMS_RELEVANT_SQL = """(
    (
        (msg1 LIKE 'Loc-%%' OR msg1 LIKE 'Rez-%%')
        AND msg1 NOT IN (
            'Rez-Change Renter Name', 'Rez-Add/Update Repair Shop',
            'Rez-Add/Update Employer', 'Rez-Changed Res Class'
        )
        AND msg1 NOT LIKE 'Rez-Add/Update Renter%%'
    )
    OR msg1 LIKE 'Request Extensions%%'
    OR msg1 IN (
        'R/A-Rent Opened', 'R/A-Post Returned', 'R/A-Returned',
        'R/A-Upsell Made', 'R/A-Credit Auth Failed',
        'R/A-Unit Assigned at Open', 'R/A-Changed Return Date',
        'R/A-Rate Update'
    )
)"""


def clean_hles_data(df: pd.DataFrame, org_lookup: dict | None = None) -> pd.DataFrame:
    """Clean HLES Excel data for insertion into leads table.

    Args:
        df: Raw DataFrame from the HLES Excel upload.
        org_lookup: Optional dict mapping branch -> bm_name from org_mapping table.
    """
    # Normalize column names: strip whitespace/newlines, lowercase, spaces->underscores
    # HLES Excel columns have leading \n characters (e.g. "\nCONFIRM_NUM")
    df.columns = [re.sub(r'\s+', '_', col.strip().lower()) for col in df.columns]

    # After normalization the HLES columns become:
    #   confirm_num, renter_last, claim, cdp, cdp_name, week_of, init_date,
    #   htzregion, set_state, zone, area_mgr, general_mgr, rent_loc,
    #   rent_ind, adj_lname, adj_fname, body_shop, code, knum, ...
    # Business key = confirm_num (Confirmation Number). RES_ID is always 1 (flag), not used.
    # Customer = RENTER_LAST (Customer Last Name). ADJ FNAME/LNAME = adjuster names.
    col_map = {
        'confirm_num': 'confirm_num',
        'renter_last': 'customer',  # Customer Last Name
        'cdp_name': 'insurance_company',
        'rent_loc': 'branch',
        'general_mgr': 'general_mgr',
        'area_mgr': 'area_mgr',
        'zone': 'zone',
        'htzregion': 'htz_region',
        'set_state': 'set_state',
        'cancel_reason': 'hles_reason',
        'rent_ind': 'rent_ind',
        'cancel_id': 'cancel_id',
        'unused_ind': 'unused_ind',
        'contact_group': 'contact_group',
        'new_contact_group': 'contact_group',
        'init_dt_final': 'init_dt_final',
        'week_of': 'week_of',
        'contact_range': 'contact_range',
        'body_shop': 'body_shop',
        'knum': 'knum',
        'min_dif': 'time_to_first_contact',
        'mmr': 'mmr',
    }
    df = df.rename(columns={k: v for k, v in col_map.items() if k in df.columns})

    if 'time_to_first_contact' in df.columns:
        df['time_to_first_contact'] = pd.to_numeric(df['time_to_first_contact'], errors='coerce')

    if 'customer' not in df.columns:
        df['customer'] = ''

    # Keep the raw rent_loc value for the rent_loc column
    if 'branch' in df.columns:
        df['rent_loc'] = df['branch']

    for ind_col in ('rent_ind', 'cancel_id', 'unused_ind'):
        if ind_col in df.columns:
            df[ind_col] = pd.to_numeric(df[ind_col], errors='coerce')

    def _derive_status(row):
        if row.get('rent_ind') == 1:
            return 'Rented'
        if row.get('cancel_id') == 1:
            return 'Cancelled'
        if row.get('unused_ind') == 1:
            return 'Unused'
        return 'Unused'

    if 'rent_ind' in df.columns or 'cancel_id' in df.columns or 'unused_ind' in df.columns:
        df['status'] = df.apply(_derive_status, axis=1)

    # Parse dates
    if 'init_dt_final' in df.columns:
        df['init_dt_final'] = pd.to_datetime(df['init_dt_final'], errors='coerce').dt.date
    if 'week_of' in df.columns:
        df['week_of'] = pd.to_datetime(df['week_of'], errors='coerce').dt.date

    if 'contact_group' in df.columns:
        cg = df['contact_group'].fillna('').str.upper()
        df['first_contact_by'] = 'other'
        df.loc[cg.str.contains('NO CONTACT', na=False), 'first_contact_by'] = 'none'
        df.loc[cg.str.contains('HRD', na=False), 'first_contact_by'] = 'hrd'
        df.loc[cg.str.contains('COUNTER', na=False), 'first_contact_by'] = 'branch'

    # Confirmation number is the business key (UUID). Ensure string, dedup, drop invalid.
    if 'confirm_num' in df.columns:
        df['confirm_num'] = df['confirm_num'].astype(str).str.strip()
    if 'confirm_num' in df.columns:
        df = df[df['confirm_num'].notna() & (df['confirm_num'].str.strip() != '') & (df['confirm_num'] != 'nan')]
        df = df.drop_duplicates(subset='confirm_num', keep='last')
    # For display/API compatibility, set reservation_id = confirm_num (DB can show "Reservation #" = confirmation number)
    if 'confirm_num' in df.columns:
        df['reservation_id'] = df['confirm_num']

    # BM name resolution: look up from org_mapping by branch, else leave None
    if org_lookup and 'branch' in df.columns:
        df['bm_name'] = df['branch'].map(org_lookup).fillna('')
    elif 'bm_name' not in df.columns:
        df['bm_name'] = None

    # Fill optional string fields with empty string where missing
    optional_str = [
        'insurance_company', 'hles_reason', 'confirm_num', 'knum',
        'body_shop', 'htz_region', 'set_state', 'zone', 'area_mgr',
        'general_mgr', 'contact_range', 'mmr',
    ]
    for col in optional_str:
        if col in df.columns:
            df[col] = df[col].fillna('')
        else:
            df[col] = ''

    if 'status' not in df.columns:
        df['status'] = 'Unused'

    return df


def clean_translog_data(df: pd.DataFrame) -> pd.DataFrame:
    """Clean TRANSLOG data (CSV or Excel) for insertion into translog_events table.

    Handles two formats:
    1. Raw Databricks export: columns like ID, Knum, SystemDate, MSG1, etc.
    2. Legacy simplified upload: columns like confirm_num, event_dt, event, result
    """
    # Normalize column names
    df.columns = [re.sub(r'\s+', '_', col.strip().lower()) for col in df.columns]

    # Detect format: raw Databricks has 'knum' and 'systemdate' after normalization
    is_raw = 'knum' in df.columns or 'systemdate' in df.columns

    if is_raw:
        return _clean_translog_raw(df)
    else:
        return _clean_translog_legacy(df)


def _clean_translog_raw(df: pd.DataFrame) -> pd.DataFrame:
    """Clean raw Databricks translog export for translog_events table."""
    col_map = {
        'id': 'source_id',
        'knum': 'knum',
        'rez_num': 'rez_num',
        'confirm_num': 'confirm_num',
        'loccode': 'loc_code',
        'systemdate': 'system_date',
        'applicationdate': 'application_date',
        'eventtype': 'event_type',
        'bgn01': 'bgn01',
        'stat_flag': 'stat_flag',
        'sf_trans': 'sf_trans',
        'msg1': 'msg1',
        'msg2': 'msg2',
        'msg3': 'msg3',
        'msg4': 'msg4',
        'msg5': 'msg5',
        'msg6': 'msg6',
        'msg7': 'msg7',
        'msg8': 'msg8',
        'msg9': 'msg9',
        'msg10': 'msg10',
        'emp_code': 'emp_code',
        'emp_lname': 'emp_lname',
        'emp_fname': 'emp_fname',
        'requested_days': 'requested_days',
        'timezone': 'timezone_offset',
        'loaddate': 'load_date',
        'sourcesystem': 'source_system',
        'sourceregion': 'source_region',
    }
    df = df.rename(columns={k: v for k, v in col_map.items() if k in df.columns})

    # Parse YYYYMMDDHHMMSS timestamps
    for ts_col in ('system_date', 'application_date'):
        if ts_col in df.columns:
            df[ts_col] = df[ts_col].apply(_parse_hles_ts)

    # Clean text fields — replace 'null' string with actual None
    text_cols = [
        'knum', 'rez_num', 'confirm_num', 'loc_code', 'bgn01', 'stat_flag',
        'sf_trans', 'msg1', 'msg2', 'msg3', 'msg4', 'msg5', 'msg6', 'msg7',
        'msg8', 'msg9', 'msg10', 'emp_code', 'emp_lname', 'emp_fname',
        'source_system', 'source_region',
    ]
    for col in text_cols:
        if col in df.columns:
            df[col] = df[col].apply(lambda v: None if not v or str(v).strip() in ('', 'null') else str(v).strip())

    # Parse numeric fields
    for int_col in ('source_id', 'event_type', 'requested_days', 'timezone_offset'):
        if int_col in df.columns:
            df[int_col] = pd.to_numeric(df[int_col], errors='coerce')

    # Parse load_date
    if 'load_date' in df.columns:
        df['load_date'] = pd.to_datetime(df['load_date'], errors='coerce').dt.date

    return df


def _clean_translog_legacy(df: pd.DataFrame) -> pd.DataFrame:
    """Clean legacy simplified translog upload (backward-compatible)."""
    col_map = {
        'confirm_num': 'confirm_num',
        'res_id': 'reservation_id',
        'event_dt': 'event_time',
        'event_date': 'event_time',
        'event': 'event_type',
        'action': 'event_type',
        'result': 'outcome',
        'disposition': 'outcome',
    }
    df = df.rename(columns={k: v for k, v in col_map.items() if k in df.columns})

    if 'event_time' in df.columns:
        df['event_time'] = pd.to_datetime(df['event_time'], errors='coerce')

    if 'confirm_num' in df.columns:
        df['confirm_num'] = df['confirm_num'].astype(str).str.strip()
    if 'confirm_num' not in df.columns and 'reservation_id' in df.columns:
        df['reservation_id'] = df['reservation_id'].astype(str).str.strip()
    drop_key = 'confirm_num' if 'confirm_num' in df.columns else 'reservation_id'
    if drop_key in df.columns:
        df = df[df[drop_key].notna() & (df[drop_key].astype(str).str.strip() != '') & (df[drop_key].astype(str) != 'nan')]

    return df


def _parse_hles_ts(val):
    """Parse YYYYMMDDHHMMSS string to pandas Timestamp or NaT."""
    if not val or str(val).strip() in ('', 'null'):
        return pd.NaT
    s = str(val).strip()
    if len(s) < 14:
        return pd.NaT
    try:
        return pd.Timestamp(
            year=int(s[0:4]), month=int(s[4:6]), day=int(s[6:8]),
            hour=int(s[8:10]), minute=int(s[10:12]), second=int(s[12:14]),
            tz='UTC',
        )
    except (ValueError, IndexError):
        return pd.NaT
