"""Translog events API — admin management (orphans, mapping, deletion) + lead detail query."""
from fastapi import APIRouter, HTTPException, Query
from db import query, execute, with_connection
from etl.clean import derive_category, LMS_RELEVANT_SQL

router = APIRouter()


def _format_emp_display(fname: str | None, lname: str | None) -> str | None:
    """Return a human-readable employee name, or None to suppress attribution."""
    fname = (fname or "").strip()
    lname = (lname or "").strip()
    if fname.upper() == "EDI" or lname.upper() == "EDI":
        return "System (EDI)"
    full = f"{fname} {lname}".strip()
    return full or None


@router.get("/translog/stats")
async def translog_stats():
    """Summary stats for admin dashboard."""
    rows = query("""
        SELECT
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE lead_id IS NOT NULL) AS matched,
            COUNT(*) FILTER (WHERE lead_id IS NULL) AS orphan,
            COUNT(DISTINCT knum) AS unique_knums,
            COUNT(DISTINCT lead_id) FILTER (WHERE lead_id IS NOT NULL) AS unique_leads
        FROM translog_events
    """)
    if not rows:
        return {"total": 0, "matched": 0, "orphan": 0, "uniqueKnums": 0, "uniqueLeads": 0}
    r = rows[0]
    return {
        "total": r["total"],
        "matched": r["matched"],
        "orphan": r["orphan"],
        "uniqueKnums": r["unique_knums"],
        "uniqueLeads": r["unique_leads"],
    }


@router.get("/translog/orphans")
async def list_orphan_knums(
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    search: str = Query(None),
):
    """List distinct orphan knums with event counts, for admin reconciliation.

    Returns grouped by knum so admin can map or delete entire reservation's events at once.
    """
    where = "WHERE te.lead_id IS NULL AND te.knum IS NOT NULL"
    params = []
    if search:
        where += " AND te.knum ILIKE %s"
        params.append(f"%{search}%")

    count_rows = query(
        f"SELECT COUNT(DISTINCT knum) AS cnt FROM translog_events te {where}",
        tuple(params),
    )
    total_knums = count_rows[0]["cnt"] if count_rows else 0

    rows = query(
        f"""SELECT te.knum,
                   COUNT(*) AS event_count,
                   MIN(te.system_date) AS earliest_event,
                   MAX(te.system_date) AS latest_event,
                   MIN(te.loc_code) AS loc_code,
                   (array_agg(DISTINCT te.msg1) FILTER (WHERE te.msg1 IS NOT NULL))[1:5] AS sample_events
            FROM translog_events te
            {where}
            GROUP BY te.knum
            ORDER BY COUNT(*) DESC
            LIMIT %s OFFSET %s""",
        tuple(params) + (limit, offset),
    )

    return {
        "totalKnums": total_knums,
        "orphans": [
            {
                "knum": r["knum"],
                "eventCount": r["event_count"],
                "earliestEvent": str(r["earliest_event"]) if r["earliest_event"] else None,
                "latestEvent": str(r["latest_event"]) if r["latest_event"] else None,
                "locCode": r["loc_code"],
                "sampleEvents": r["sample_events"] or [],
            }
            for r in (rows or [])
        ],
    }


@router.get("/translog/orphans/{knum}/events")
async def list_orphan_events(knum: str, limit: int = Query(50, ge=1, le=500)):
    """List individual events for an orphan knum — for admin review before mapping/deleting."""
    rows = query(
        """SELECT id, source_id, knum, loc_code, system_date, application_date,
                  event_type, msg1, msg2, msg3, emp_code, emp_fname, emp_lname
           FROM translog_events
           WHERE knum = %s AND lead_id IS NULL
           ORDER BY system_date DESC
           LIMIT %s""",
        (knum, limit),
    )
    return [
        {
            "id": r["id"],
            "sourceId": r["source_id"],
            "knum": r["knum"],
            "locCode": r["loc_code"],
            "systemDate": str(r["system_date"]) if r["system_date"] else None,
            "applicationDate": str(r["application_date"]) if r["application_date"] else None,
            "eventType": r["event_type"],
            "msg1": r["msg1"],
            "msg2": r["msg2"],
            "msg3": r["msg3"],
            "empCode": r["emp_code"],
            "empName": _format_emp_display(r["emp_fname"], r["emp_lname"]),
        }
        for r in (rows or [])
    ]


@router.put("/translog/orphans/{knum}/map")
async def map_orphan_to_lead(knum: str, body: dict):
    """Map all translog events for a knum to a specific lead. Permanent DB change."""
    lead_id = body.get("leadId")
    if not lead_id:
        raise HTTPException(status_code=400, detail="leadId is required")

    # Verify lead exists
    leads = query("SELECT id, confirm_num FROM leads WHERE id = %s", (lead_id,))
    if not leads:
        raise HTTPException(status_code=404, detail=f"Lead {lead_id} not found")

    result = execute(
        "UPDATE translog_events SET lead_id = %s WHERE knum = %s AND lead_id IS NULL",
        (lead_id, knum),
    )
    # Count how many were updated
    count_rows = query(
        "SELECT COUNT(*) AS cnt FROM translog_events WHERE knum = %s AND lead_id = %s",
        (knum, lead_id),
    )
    count = count_rows[0]["cnt"] if count_rows else 0

    return {"mapped": count, "knum": knum, "leadId": lead_id}


@router.delete("/translog/orphans/{knum}")
async def delete_orphan_events(knum: str):
    """Permanently delete all orphan translog events for a knum."""
    # Only delete orphans (lead_id IS NULL) to prevent accidental deletion of mapped events
    count_rows = query(
        "SELECT COUNT(*) AS cnt FROM translog_events WHERE knum = %s AND lead_id IS NULL",
        (knum,),
    )
    count = count_rows[0]["cnt"] if count_rows else 0

    if count == 0:
        raise HTTPException(status_code=404, detail=f"No orphan events found for knum {knum}")

    execute("DELETE FROM translog_events WHERE knum = %s AND lead_id IS NULL", (knum,))
    return {"deleted": count, "knum": knum}


@router.get("/leads/{lead_id}/translog")
async def get_lead_translog(
    lead_id: int,
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    role: str = Query("bm"),
):
    """Get translog events for a specific lead, ordered by system_date descending.

    Role-based filtering:
      - bm/gm: only LMS-relevant events (Loc-, Rez-, 6 whitelisted R/A-)
      - admin: all events (no filter)
    """
    # Verify lead exists
    leads = query("SELECT id FROM leads WHERE id = %s", (lead_id,))
    if not leads:
        raise HTTPException(status_code=404, detail="Lead not found")

    # Build WHERE clause with role-based filtering
    where = "WHERE lead_id = %s"
    params = [lead_id]
    if role in ("bm", "gm"):
        where += f" AND {LMS_RELEVANT_SQL}"

    rows = query(
        f"""SELECT id, source_id, knum, rez_num, loc_code, system_date, application_date,
                  event_type, bgn01, stat_flag, msg1, msg2, msg3, msg4, msg5, msg6,
                  msg10, emp_code, emp_fname, emp_lname, requested_days
           FROM translog_events
           {where}
           ORDER BY system_date DESC
           LIMIT %s OFFSET %s""",
        tuple(params) + (limit, offset),
    )

    count_rows = query(
        f"SELECT COUNT(*) AS cnt FROM translog_events {where}",
        tuple(params),
    )
    total = count_rows[0]["cnt"] if count_rows else 0

    return {
        "total": total,
        "events": [
            {
                "id": r["id"],
                "sourceId": r["source_id"],
                "knum": r["knum"],
                "rezNum": r["rez_num"],
                "locCode": r["loc_code"],
                "systemDate": str(r["system_date"]) if r["system_date"] else None,
                "applicationDate": str(r["application_date"]) if r["application_date"] else None,
                "eventType": r["event_type"],
                "bgn01": r["bgn01"],
                "statFlag": r["stat_flag"],
                "category": derive_category(r["msg1"], r.get("msg10")),
                "msg1": r["msg1"],
                "msg2": r["msg2"],
                "msg3": r["msg3"],
                "msg4": r["msg4"],
                "msg5": r["msg5"],
                "msg6": r["msg6"],
                "msg10": r["msg10"],
                "empCode": r["emp_code"],
                "empName": _format_emp_display(r["emp_fname"], r["emp_lname"]),
                "requestedDays": r["requested_days"],
            }
            for r in (rows or [])
        ],
    }


@router.post("/translog/relink")
async def relink_translog_events():
    """Re-run dual-key linkage (knum → leads.knum, rez_num → leads.confirm_num) for all orphan events.

    Call this after uploading new HLES data to link previously-orphaned translog events.
    """
    result = query("""
        WITH matched AS (
            UPDATE translog_events te
            SET lead_id = l.id
            FROM leads l
            WHERE te.lead_id IS NULL
              AND (
                  (te.knum IS NOT NULL AND te.knum = l.knum)
                  OR (te.rez_num IS NOT NULL AND te.rez_num = l.confirm_num)
              )
            RETURNING te.id
        )
        SELECT COUNT(*) AS cnt FROM matched
    """)
    count = result[0]["cnt"] if result else 0
    return {"relinked": count}
