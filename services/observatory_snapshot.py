"""
Pre-computed Observatory Tower snapshot.

Reads non-archived leads and org_mapping from Lakebase Postgres, buckets metrics
by branch for the trailing 12 calendar months and 24 ISO weeks (Monday keys),
and stores one JSONB row in observatory_snapshots.
"""

from __future__ import annotations

import json
import logging
from calendar import monthrange
from datetime import date, datetime, timedelta, timezone

from db import execute, query

logger = logging.getLogger(__name__)

SNAPSHOT_VERSION = 1
NUM_MONTHS = 12
NUM_WEEKS = 24


# ---------------------------------------------------------------------------
# Date helpers (aligned with services/snapshot.py)
# ---------------------------------------------------------------------------


def _to_date(val) -> date | None:
    if val is None:
        return None
    if isinstance(val, datetime):
        return val.date()
    if isinstance(val, date):
        return val
    try:
        return date.fromisoformat(str(val)[:10])
    except (ValueError, TypeError):
        return None


def _get_monday(d: date) -> date:
    return d - timedelta(days=d.weekday())


def _lead_date(lead: dict) -> date | None:
    d = _to_date(lead.get("init_dt_final"))
    if d:
        return d
    return _to_date(lead.get("week_of"))


def _get_now(leads: list[dict]) -> date:
    """Latest data Sunday capped by calendar Sunday — same as snapshot.setNowFromLeads."""
    max_monday: date | None = None
    for lead in leads:
        week_of = lead.get("week_of")
        if week_of:
            d = _to_date(week_of)
            if d:
                mon = _get_monday(d)
                if max_monday is None or mon > max_monday:
                    max_monday = mon
        init_dt = lead.get("init_dt_final")
        if init_dt:
            d = _to_date(init_dt)
            if d:
                mon = _get_monday(d)
                if max_monday is None or mon > max_monday:
                    max_monday = mon

    if max_monday is None:
        return date.today()

    data_sunday = max_monday + timedelta(days=6)
    cal_monday = _get_monday(date.today())
    cal_sunday = cal_monday + timedelta(days=6)
    return data_sunday if data_sunday <= cal_sunday else cal_sunday


def _twelve_month_labels(anchor: date) -> list[str]:
    """Oldest-first YYYY-MM labels; last month is anchor's calendar month."""
    y, m = anchor.year, anchor.month
    labels_rev: list[str] = []
    cy, cm = y, m
    for _ in range(NUM_MONTHS):
        labels_rev.append(f"{cy:04d}-{cm:02d}")
        cm -= 1
        if cm < 1:
            cm = 12
            cy -= 1
    return list(reversed(labels_rev))


def _twenty_four_week_mondays(anchor: date) -> list[date]:
    """Oldest-first Mondays; last week is the ISO week (Monday) containing anchor."""
    end = _get_monday(anchor)
    return [end - timedelta(weeks=NUM_WEEKS - 1 - i) for i in range(NUM_WEEKS)]


def _month_start_end(label: str) -> tuple[date, date] | None:
    try:
        y_str, m_str = label.split("-", 1)
        y, m = int(y_str), int(m_str)
        if m < 1 or m > 12:
            return None
        last = monthrange(y, m)[1]
        return date(y, m, 1), date(y, m, last)
    except (ValueError, TypeError):
        return None


# ---------------------------------------------------------------------------
# Metrics
# ---------------------------------------------------------------------------


def _empty_metrics() -> dict:
    return {
        "total": 0,
        "rented": 0,
        "cancelled": 0,
        "unused": 0,
        "within30": 0,
        "branchContact": 0,
        "totalContact": 0,
    }


def _accumulate(bucket: dict, lead: dict) -> None:
    bucket["total"] += 1
    st = lead.get("status")
    if st == "Rented":
        bucket["rented"] += 1
    elif st == "Cancelled":
        bucket["cancelled"] += 1
    elif st == "Unused":
        bucket["unused"] += 1
    if (lead.get("contact_range") or "") == "(a)<30min":
        bucket["within30"] += 1
    fc = lead.get("first_contact_by") or ""
    if fc == "branch":
        bucket["branchContact"] += 1
    if fc in ("branch", "hrd"):
        bucket["totalContact"] += 1


def _branch_meta(branch: str, org_by_branch: dict[str, dict], branch_leads: list[dict]) -> dict:
    row = org_by_branch.get(branch)
    if row:
        return {
            "zone": (row.get("zone") or "").strip() or "—",
            "gm": (row.get("gm") or "").strip() or "—",
            "am": (row.get("am") or "").strip() or "—",
            "bm": (row.get("bm") or "").strip() or "—",
        }
    gm, am, zone, bm = "—", "—", "—", "—"
    for lead in branch_leads:
        if gm == "—" and lead.get("general_mgr"):
            gm = str(lead["general_mgr"]).strip() or "—"
        if am == "—" and lead.get("area_mgr"):
            am = str(lead["area_mgr"]).strip() or "—"
        if zone == "—" and lead.get("zone"):
            zone = str(lead["zone"]).strip() or "—"
        if bm == "—" and lead.get("bm_name") and lead.get("bm_name") != "—":
            bm = str(lead["bm_name"]).strip() or "—"
        if gm != "—" and am != "—" and zone != "—" and bm != "—":
            break
    return {"zone": zone, "gm": gm, "am": am, "bm": bm}


def _collect_branches(org_rows: list[dict], leads: list[dict]) -> list[str]:
    names: set[str] = set()
    for r in org_rows:
        b = r.get("branch")
        if b:
            names.add(b)
    for lead in leads:
        b = lead.get("branch")
        if b:
            names.add(b)
    return sorted(names)


def _index_leads_by_branch(leads: list[dict]) -> dict[str, list[dict]]:
    out: dict[str, list[dict]] = {}
    for lead in leads:
        b = lead.get("branch")
        if b:
            out.setdefault(b, []).append(lead)
    return out


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------


def compute_observatory_snapshot() -> None:
    import time as _time

    t0 = _time.monotonic()
    print("[observatory] compute_observatory_snapshot started", flush=True)

    try:
        leads = query("SELECT * FROM leads WHERE archived = false")
        org_rows = query("SELECT * FROM org_mapping")
    except Exception:
        print("[observatory] ERROR reading data from DB", flush=True)
        logger.exception("Failed to read data for observatory snapshot")
        return

    t_load = _time.monotonic()
    print(
        f"[observatory] loaded {len(leads)} leads, {len(org_rows)} org rows in {t_load - t0:.1f}s",
        flush=True,
    )

    if not leads:
        print("[observatory] no leads found — skipping", flush=True)
        return

    now = _get_now(leads)
    month_labels = _twelve_month_labels(now)
    week_mondays = _twenty_four_week_mondays(now)
    week_labels = [m.isoformat() for m in week_mondays]

    month_bounds = {lab: _month_start_end(lab) for lab in month_labels}
    month_to_i = {lab: i for i, lab in enumerate(month_labels)}
    week_to_i = {m.isoformat(): i for i, m in enumerate(week_mondays)}

    org_by_branch = {r["branch"]: r for r in org_rows if r.get("branch")}
    all_branches = _collect_branches(org_rows, leads)
    leads_by_branch = _index_leads_by_branch(leads)

    def empty_grids() -> tuple[list[dict], list[dict]]:
        return (
            [_empty_metrics() for _ in range(NUM_MONTHS)],
            [_empty_metrics() for _ in range(NUM_WEEKS)],
        )

    branch_monthly: dict[str, list[dict]] = {}
    branch_weekly: dict[str, list[dict]] = {}
    for b in all_branches:
        m_grid, w_grid = empty_grids()
        branch_monthly[b] = m_grid
        branch_weekly[b] = w_grid

    for lead in leads:
        if lead.get("status") == "Reviewed":
            continue
        branch = lead.get("branch")
        if not branch:
            continue
        ld = _lead_date(lead)
        if ld is None:
            continue

        for lab, bounds in month_bounds.items():
            if bounds is None:
                continue
            start, end = bounds
            if start <= ld <= end:
                idx = month_to_i[lab]
                _accumulate(branch_monthly[branch][idx], lead)
                break

        wmon = _get_monday(ld)
        wi = week_to_i.get(wmon.isoformat())
        if wi is not None:
            _accumulate(branch_weekly[branch][wi], lead)

    branches_out: dict[str, dict] = {}
    filter_zones: set[str] = set()
    filter_gms: set[str] = set()
    filter_ams: set[str] = set()

    for b in sorted(branch_monthly.keys()):
        meta = _branch_meta(b, org_by_branch, leads_by_branch.get(b, []))
        branches_out[b] = {
            "zone": meta["zone"],
            "gm": meta["gm"],
            "am": meta["am"],
            "bm": meta["bm"],
            "monthly": branch_monthly[b],
            "weekly": branch_weekly[b],
        }
        if meta["zone"] != "—":
            filter_zones.add(meta["zone"])
        if meta["gm"] != "—":
            filter_gms.add(meta["gm"])
        if meta["am"] != "—":
            filter_ams.add(meta["am"])

    snapshot = {
        "version": SNAPSHOT_VERSION,
        "computed_at": datetime.now(timezone.utc).isoformat(),
        "now": now.isoformat(),
        "months": month_labels,
        "weeks": week_labels,
        "branches": branches_out,
        "filters": {
            "zones": sorted(filter_zones),
            "gms": sorted(filter_gms),
            "ams": sorted(filter_ams),
        },
    }

    try:
        payload = json.dumps(snapshot, default=str)
        execute(
            "INSERT INTO observatory_snapshots (snapshot) VALUES (%s::jsonb)",
            (payload,),
        )
        t_done = _time.monotonic()
        print(
            f"[observatory] STORED OK — now={now.isoformat()}, "
            f"{len(branches_out)} branches, json={len(payload)} chars, total={t_done - t0:.1f}s",
            flush=True,
        )
    except Exception as exc:
        print(f"[observatory] ERROR storing snapshot: {exc}", flush=True)
        logger.exception("Failed to store observatory snapshot")
