from fastapi import APIRouter, UploadFile, File
import pandas as pd
import json
import io
from db import execute, query
from etl.clean import clean_hles_data, clean_translog_data

router = APIRouter()

@router.post("/upload/hles")
async def upload_hles(file: UploadFile = File(...)):
    """Upload HLES Excel file -> clean -> insert/update leads table."""
    contents = await file.read()
    df = pd.read_excel(io.BytesIO(contents), engine="openpyxl")

    df_clean = clean_hles_data(df)

    stats = {"rowsParsed": len(df), "newLeads": 0, "updated": 0, "failed": 0}

    for _, row in df_clean.iterrows():
        existing = query(
            "SELECT id FROM leads WHERE reservation_id = %s",
            (row["reservation_id"],)
        )
        if existing:
            execute(
                """UPDATE leads SET
                    customer = %s, status = %s, branch = %s, bm_name = %s,
                    insurance_company = %s, hles_reason = %s,
                    init_dt_final = %s, updated_at = now()
                WHERE reservation_id = %s""",
                (
                    row["customer"], row["status"], row["branch"], row["bm_name"],
                    row["insurance_company"], row["hles_reason"],
                    row["init_dt_final"], row["reservation_id"],
                )
            )
            stats["updated"] += 1
        else:
            execute(
                """INSERT INTO leads
                    (customer, reservation_id, status, branch, bm_name,
                     insurance_company, hles_reason, init_dt_final)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
                (
                    row["customer"], row["reservation_id"], row["status"],
                    row["branch"], row["bm_name"], row["insurance_company"],
                    row["hles_reason"], row["init_dt_final"],
                )
            )
            stats["newLeads"] += 1

    execute(
        "INSERT INTO upload_summary (hles, translog, data_as_of_date) VALUES (%s::jsonb, %s::jsonb, %s)",
        (json.dumps(stats), '{}', str(pd.Timestamp.now().date()))
    )

    return stats

@router.post("/upload/translog")
async def upload_translog(file: UploadFile = File(...)):
    """Upload TRANSLOG Excel file -> match events to leads."""
    contents = await file.read()
    df = pd.read_excel(io.BytesIO(contents), engine="openpyxl")

    df_clean = clean_translog_data(df)

    stats = {"eventsParsed": len(df), "matched": 0, "orphan": 0}

    for _, row in df_clean.iterrows():
        existing = query(
            "SELECT id, translog FROM leads WHERE reservation_id = %s",
            (row["reservation_id"],)
        )
        if existing:
            lead = existing[0]
            current_log = lead["translog"] or []
            current_log.append({
                "time": str(row.get("event_time", "")),
                "event": row.get("event_type", ""),
                "outcome": row.get("outcome", "")
            })
            execute(
                """UPDATE leads SET
                    translog = %s::jsonb,
                    last_activity = now(),
                    updated_at = now()
                WHERE id = %s""",
                (json.dumps(current_log), lead["id"])
            )
            stats["matched"] += 1
        else:
            stats["orphan"] += 1

    return stats
