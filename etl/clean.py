"""Data cleaning functions for HLES and TRANSLOG uploads."""
import pandas as pd
import re


def clean_hles_data(df: pd.DataFrame) -> pd.DataFrame:
    """Clean HLES Excel data for insertion into leads table."""
    # Normalize column names: strip whitespace/newlines, lowercase
    df.columns = [re.sub(r'\s+', '_', col.strip().lower()) for col in df.columns]

    # Common column mappings from HLES/CRESER format
    col_map = {
        'res_id': 'reservation_id',
        'cust_name': 'customer',
        'cust_nm': 'customer',
        'br_name': 'branch',
        'branch_name': 'branch',
        'bm': 'bm_name',
        'branch_manager': 'bm_name',
        'ins_co': 'insurance_company',
        'insurance': 'insurance_company',
        'cancel_reason': 'hles_reason',
        'reason': 'hles_reason',
        'rent_ind': 'rent_ind',
        'init_dt_final': 'init_dt_final',
    }
    df = df.rename(columns={k: v for k, v in col_map.items() if k in df.columns})

    # Map RENT_IND to status
    if 'rent_ind' in df.columns:
        df['status'] = df['rent_ind'].map({1: 'Rented', 0: 'Cancelled'}).fillna('Unused')

    # Parse dates
    if 'init_dt_final' in df.columns:
        df['init_dt_final'] = pd.to_datetime(df['init_dt_final'], errors='coerce').dt.date

    # Drop duplicates — keep last occurrence
    if 'reservation_id' in df.columns:
        df = df.drop_duplicates(subset='reservation_id', keep='last')

    # Drop rows missing required fields
    required = ['reservation_id', 'customer', 'branch']
    for col in required:
        if col in df.columns:
            df = df.dropna(subset=[col])

    # Fill optional string fields
    for col in ['bm_name', 'insurance_company', 'hles_reason']:
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

    # Drop rows without reservation_id
    if 'reservation_id' in df.columns:
        df = df.dropna(subset=['reservation_id'])

    return df
