"""
Explore Translog (Partitioned) Nov-Dec 2025.csv
"""
import pandas as pd
import numpy as np
import os

FILE = "/Users/dansia/Documents/HertzDataAnalysis/data/raw/Translog (Partitioned) Nov-Dec 2025.csv"

# ── 1. Basic metadata ──────────────────────────────────────────────
print("=" * 80)
print("1. BASIC METADATA")
print("=" * 80)

file_size_mb = os.path.getsize(FILE) / (1024 * 1024)
print(f"File size: {file_size_mb:,.1f} MB")

# Read with low_memory=False to get better dtype inference
df = pd.read_csv(FILE, low_memory=False)

print(f"Shape: {df.shape[0]:,} rows x {df.shape[1]} columns")
print(f"Memory usage: {df.memory_usage(deep=True).sum() / (1024**2):,.1f} MB")

print("\n── Column Names & Dtypes ──")
for i, (col, dtype) in enumerate(df.dtypes.items()):
    null_pct = df[col].isna().mean() * 100
    print(f"  {i:2d}. {col:<25s}  {str(dtype):<12s}  null: {null_pct:.1f}%")

print("\n── First 5 Rows (transposed for readability) ──")
print(df.head(5).T.to_string())

# ── 2. Date columns ────────────────────────────────────────────────
print("\n" + "=" * 80)
print("2. DATE COLUMNS")
print("=" * 80)

date_candidates = ['SystemDate', 'ApplicationDate', 'LoadDate', 'LoadDateTime']
for col in date_candidates:
    if col not in df.columns:
        continue
    print(f"\n  {col}:")
    print(f"    dtype: {df[col].dtype}")
    print(f"    sample values: {df[col].dropna().head(5).tolist()}")

    # Try parsing
    try:
        parsed = pd.to_datetime(df[col], errors='coerce')
        valid = parsed.dropna()
        print(f"    parseable: {len(valid):,} / {len(df):,} ({len(valid)/len(df)*100:.1f}%)")
        if len(valid) > 0:
            print(f"    min: {valid.min()}")
            print(f"    max: {valid.max()}")
    except Exception as e:
        print(f"    parse error: {e}")

# ── 3. Personal information columns ───────────────────────────────
print("\n" + "=" * 80)
print("3. PERSONAL INFORMATION SCAN")
print("=" * 80)

pii_keywords = ['name', 'fname', 'lname', 'email', 'phone', 'addr', 'address',
                'ssn', 'social', 'dob', 'birth', 'license', 'card']

for col in df.columns:
    col_lower = col.lower()
    matches = [kw for kw in pii_keywords if kw in col_lower]
    if matches:
        non_null = df[col].dropna()
        print(f"\n  ** {col} ** (matched: {matches})")
        print(f"     non-null: {len(non_null):,} / {len(df):,}")
        if len(non_null) > 0:
            print(f"     unique: {non_null.nunique():,}")
            print(f"     sample: {non_null.head(10).tolist()}")

# Also scan MSG columns for patterns
print("\n  -- Scanning MSG columns for PII patterns --")
import re
email_pat = re.compile(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}')
phone_pat = re.compile(r'\b\d{3}[-.]?\d{3}[-.]?\d{4}\b')
ssn_pat = re.compile(r'\b\d{3}-\d{2}-\d{4}\b')

msg_cols = [c for c in df.columns if c.startswith('MSG')]
sample_size = min(500_000, len(df))
sample_idx = np.random.RandomState(42).choice(len(df), sample_size, replace=False)
df_sample = df.iloc[sample_idx]

for col in msg_cols:
    vals = df_sample[col].dropna().astype(str)
    if len(vals) == 0:
        continue
    emails = vals.str.contains(email_pat, na=False).sum()
    phones = vals.str.contains(phone_pat, na=False).sum()
    ssns = vals.str.contains(ssn_pat, na=False).sum()
    if emails > 0 or phones > 0 or ssns > 0:
        print(f"  {col}: emails={emails}, phones={phones}, ssns={ssns} (in {sample_size:,} sample)")
        if emails > 0:
            print(f"    email examples: {vals[vals.str.contains(email_pat, na=False)].head(3).tolist()}")
        if phones > 0:
            print(f"    phone examples: {vals[vals.str.contains(phone_pat, na=False)].head(3).tolist()}")

# ── 4. Join key candidates ────────────────────────────────────────
print("\n" + "=" * 80)
print("4. JOIN KEY CANDIDATES")
print("=" * 80)

join_candidates = ['ID', 'Knum', 'CSPLIT_REC', 'TSD_NUM', 'INVOICE',
                   'CONFIRM_NUM', 'REZ_NUM', 'csplitid', 'LocCode', 'EMP_CODE']

for col in join_candidates:
    if col not in df.columns:
        continue
    non_null = df[col].dropna()
    non_empty = non_null[non_null.astype(str).str.strip() != '']
    print(f"\n  {col}:")
    print(f"    non-null/non-empty: {len(non_empty):,} / {len(df):,} ({len(non_empty)/len(df)*100:.1f}%)")
    print(f"    unique: {non_empty.nunique():,}")
    print(f"    sample: {non_empty.head(10).tolist()}")

# ── 5. Categorical column value counts ───────────────────────────
print("\n" + "=" * 80)
print("5. KEY CATEGORICAL COLUMNS - VALUE COUNTS")
print("=" * 80)

cat_cols = ['EventType', 'BGN01', 'SF_TRANS', 'STAT_FLAG', 'EXT',
            'TIMEZONE', 'SourceSystem', 'SourceRegion', 'FIELD_CHANGED',
            'FILE']

for col in cat_cols:
    if col not in df.columns:
        continue
    vc = df[col].value_counts(dropna=False).head(25)
    total = len(df)
    print(f"\n  {col}  (unique: {df[col].nunique(dropna=False)})")
    for val, cnt in vc.items():
        pct = cnt / total * 100
        label = repr(val) if pd.notna(val) else '<NULL>'
        print(f"    {label:<45s} {cnt:>10,}  ({pct:5.1f}%)")

# Also show MSG1 top values (often describes the action)
print(f"\n  MSG1  (unique: {df['MSG1'].nunique(dropna=False)})")
vc = df['MSG1'].value_counts(dropna=False).head(30)
for val, cnt in vc.items():
    pct = cnt / len(df) * 100
    label = repr(val)[:60] if pd.notna(val) else '<NULL>'
    print(f"    {label:<62s} {cnt:>10,}  ({pct:5.1f}%)")

# REQUESTED_DAYS distribution
print(f"\n  REQUESTED_DAYS stats:")
print(df['REQUESTED_DAYS'].describe().to_string())

# OFOUR columns
for col in ['OFOUR_FROM', 'OFOUR_TO']:
    if col in df.columns:
        non_null = df[col].dropna()
        print(f"\n  {col}: non-null={len(non_null):,}, unique={non_null.nunique():,}")
        if len(non_null) > 0:
            print(f"    sample: {non_null.head(10).tolist()}")

print("\n" + "=" * 80)
print("DONE")
print("=" * 80)
