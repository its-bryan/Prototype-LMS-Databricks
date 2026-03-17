"""Data cleaning functions for HLES and TRANSLOG uploads."""
import pandas as pd
import re


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
        'init_dt_final': 'init_dt_final',
        'week_of': 'week_of',
        'contact_range': 'contact_range',
        'body_shop': 'body_shop',
        'knum': 'knum',
    }
    df = df.rename(columns={k: v for k, v in col_map.items() if k in df.columns})

    if 'customer' not in df.columns:
        df['customer'] = ''

    # Keep the raw rent_loc value for the rent_loc column
    if 'branch' in df.columns:
        df['rent_loc'] = df['branch']

    # Map RENT_IND to status (1 = Rented, 0 = Cancelled; RES_ID not used as identifier)
    if 'rent_ind' in df.columns:
        df['rent_ind'] = pd.to_numeric(df['rent_ind'], errors='coerce')
        df['status'] = df['rent_ind'].map({1: 'Rented', 0: 'Cancelled'}).fillna('Unused')

    # Parse dates
    if 'init_dt_final' in df.columns:
        df['init_dt_final'] = pd.to_datetime(df['init_dt_final'], errors='coerce').dt.date
    if 'week_of' in df.columns:
        df['week_of'] = pd.to_datetime(df['week_of'], errors='coerce').dt.date

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
        'general_mgr', 'contact_range',
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
    """Clean TRANSLOG Excel data for matching to leads."""
    # Normalize column names
    df.columns = [re.sub(r'\s+', '_', col.strip().lower()) for col in df.columns]

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

    # Parse timestamps
    if 'event_time' in df.columns:
        df['event_time'] = pd.to_datetime(df['event_time'], errors='coerce')

    # Need at least one key to match leads (prefer confirm_num; fallback reservation_id)
    if 'confirm_num' in df.columns:
        df['confirm_num'] = df['confirm_num'].astype(str).str.strip()
    if 'confirm_num' not in df.columns and 'reservation_id' in df.columns:
        df['reservation_id'] = df['reservation_id'].astype(str).str.strip()
    drop_key = 'confirm_num' if 'confirm_num' in df.columns else 'reservation_id'
    if drop_key in df.columns:
        df = df[df[drop_key].notna() & (df[drop_key].astype(str).str.strip() != '') & (df[drop_key].astype(str) != 'nan')]

    return df
