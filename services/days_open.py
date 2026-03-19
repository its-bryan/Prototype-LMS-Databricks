from db import query


def refresh_days_open() -> dict:
    """
    Recompute days_open for all leads from init_dt_final.

    Run as a background task after every HLES upload, or via the
    POST /api/upload/refresh-days-open admin endpoint.

    days_open = max(0, today - init_dt_final).
    Returns a dict with the count of rows updated.
    """
    rows = query(
        """
        UPDATE leads
        SET days_open = GREATEST(0, (CURRENT_DATE - init_dt_final::date))
        WHERE init_dt_final IS NOT NULL
        RETURNING id
        """
    )
    count = len(rows) if rows else 0
    print(f"[days_open] Refreshed days_open for {count} leads", flush=True)
    return {"updated": count}
