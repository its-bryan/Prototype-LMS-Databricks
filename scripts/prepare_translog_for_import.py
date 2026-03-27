"""
Pre-process the raw translog CSV into a format ready for psql \\COPY import.

Usage:
    source .venv/bin/activate
    python scripts/prepare_translog_for_import.py

Output: prodfiles/translog_import_ready.csv
Then import via psql:
    psql "$DATABASE_URL" -c "\\COPY translog_events(source_id, knum, rez_num, confirm_num, loc_code, system_date, application_date, event_type, bgn01, stat_flag, sf_trans, msg1, msg2, msg3, msg4, msg5, msg6, msg7, msg8, msg9, msg10, emp_code, emp_lname, emp_fname, requested_days, timezone_offset, load_date, source_system, source_region) FROM 'prodfiles/translog_import_ready.csv' CSV HEADER"
"""
import csv
import sys
import time
from datetime import datetime, timezone

INPUT_CSV = "prodfiles/Translog (Partitioned) Nov-Dec 2025.csv"
OUTPUT_CSV = "prodfiles/translog_import_ready.csv"

OUTPUT_COLUMNS = [
    "source_id", "knum", "rez_num", "confirm_num", "loc_code",
    "system_date", "application_date", "event_type", "bgn01", "stat_flag",
    "sf_trans", "msg1", "msg2", "msg3", "msg4", "msg5", "msg6", "msg7",
    "msg8", "msg9", "msg10", "emp_code", "emp_lname", "emp_fname",
    "requested_days", "timezone_offset", "load_date", "source_system",
    "source_region",
]


def clean_text(val):
    if not val or val.strip() in ("", "null"):
        return ""
    return val.strip()


def clean_int(val, default="0"):
    if not val or val.strip() in ("", "null"):
        return default
    try:
        return str(int(float(val.strip())))
    except (ValueError, TypeError):
        return default


def parse_timestamp(val):
    """Parse YYYYMMDDHHMMSS to ISO 8601 timestamp string."""
    if not val or val.strip() in ("", "null"):
        return ""
    s = val.strip()
    if len(s) < 14:
        return ""
    try:
        dt = datetime(
            int(s[0:4]), int(s[4:6]), int(s[6:8]),
            int(s[8:10]), int(s[10:12]), int(s[12:14]),
            tzinfo=timezone.utc,
        )
        return dt.isoformat()
    except (ValueError, IndexError):
        return ""


def parse_load_date(val):
    if not val or val.strip() in ("", "null"):
        return ""
    s = val.strip()[:10]
    try:
        datetime.strptime(s, "%Y-%m-%d")
        return s
    except ValueError:
        return ""


def main():
    t_start = time.monotonic()
    total = 0

    with open(INPUT_CSV, "r") as fin, open(OUTPUT_CSV, "w", newline="") as fout:
        reader = csv.DictReader(fin)
        writer = csv.writer(fout)
        writer.writerow(OUTPUT_COLUMNS)

        for row in reader:
            total += 1
            out = [
                clean_int(row.get("ID", ""), ""),               # source_id
                clean_text(row.get("Knum", "")),                 # knum
                clean_text(row.get("REZ_NUM", "")),              # rez_num
                clean_text(row.get("CONFIRM_NUM", "")),          # confirm_num
                clean_text(row.get("LocCode", "")),              # loc_code
                parse_timestamp(row.get("SystemDate", "")),      # system_date
                parse_timestamp(row.get("ApplicationDate", "")), # application_date
                clean_int(row.get("EventType", ""), ""),         # event_type
                clean_text(row.get("BGN01", "")),                # bgn01
                clean_text(row.get("STAT_FLAG", "")),            # stat_flag
                clean_text(row.get("SF_TRANS", "")),             # sf_trans
                clean_text(row.get("MSG1", "")),                 # msg1
                clean_text(row.get("MSG2", "")),                 # msg2
                clean_text(row.get("MSG3", "")),                 # msg3
                clean_text(row.get("MSG4", "")),                 # msg4
                clean_text(row.get("MSG5", "")),                 # msg5
                clean_text(row.get("MSG6", "")),                 # msg6
                clean_text(row.get("MSG7", "")),                 # msg7
                clean_text(row.get("MSG8", "")),                 # msg8
                clean_text(row.get("MSG9", "")),                 # msg9
                clean_text(row.get("MSG10", "")),                # msg10
                clean_text(row.get("EMP_CODE", "")),             # emp_code
                clean_text(row.get("EMP_LNAME", "")),            # emp_lname
                clean_text(row.get("EMP_FNAME", "")),            # emp_fname
                clean_int(row.get("REQUESTED_DAYS", ""), "0"),   # requested_days
                clean_int(row.get("TIMEZONE", ""), "0"),         # timezone_offset
                parse_load_date(row.get("LoadDate", "")),        # load_date
                clean_text(row.get("SourceSystem", "")),         # source_system
                clean_text(row.get("SourceRegion", "")),         # source_region
            ]
            writer.writerow(out)

            if total % 500000 == 0:
                elapsed = time.monotonic() - t_start
                print(f"[prepare] {total:,} rows processed — {elapsed:.0f}s", flush=True)

    elapsed = time.monotonic() - t_start
    print(f"\n[prepare] DONE: {total:,} rows written to {OUTPUT_CSV} in {elapsed:.1f}s")


if __name__ == "__main__":
    main()
