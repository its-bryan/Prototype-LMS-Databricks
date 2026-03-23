"""
Pre-computed dashboard snapshot service.

Reads leads, org_mapping, and tasks from Lakebase Postgres, computes the same
metrics as src/selectors/demoSelectors.js (trailing 4-week view only), and
stores the result as a single JSONB row in dashboard_snapshots.

This module is intentionally separate from the ETL (routers/upload.py) but is
triggered immediately after each HLES upload completes.
"""

import json
import re
import logging
import time as _time
from datetime import date, datetime, timedelta, timezone

from db import query, execute

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Date helpers (mirrors JS getMonday / getDateRangePresets / setNowFromLeads)
# ---------------------------------------------------------------------------

def _get_monday(d: date) -> date:
    """Return the Monday of the week containing *d* (ISO weekday: Mon=1)."""
    return d - timedelta(days=d.weekday())


def _get_now(leads: list[dict]) -> date:
    """Return the actual latest date present in the lead data.

    Uses the maximum init_dt_final (actual lead date) across all leads,
    capped at today to avoid future-dated leads pushing NOW forward.
    Falls back to the Sunday of the latest week_of week if no init_dt_final
    values are present.
    """
    max_date: date | None = None
    max_monday: date | None = None
    for lead in leads:
        init_dt = lead.get("init_dt_final")
        if init_dt:
            d = _to_date(init_dt)
            if d:
                if max_date is None or d > max_date:
                    max_date = d
        week_of = lead.get("week_of")
        if week_of:
            d = _to_date(week_of)
            if d:
                mon = _get_monday(d)
                if max_monday is None or mon > max_monday:
                    max_monday = mon

    today = date.today()

    if max_date is not None:
        return min(max_date, today)

    # Fallback: use Sunday of the latest week_of week
    if max_monday is None:
        return today
    data_sunday = max_monday + timedelta(days=6)
    cal_sunday = _get_monday(today) + timedelta(days=6)
    return data_sunday if data_sunday <= cal_sunday else cal_sunday


def _trailing_4_weeks(now: date):
    """Return (current_range, comparison_range) for the trailing-4-week preset.

    current:    (now - 27 days) .. now  (28-day span)
    comparison: (now - 7 days - 27 days) .. (now - 7 days)  (shifted back 1 week)
    """
    current_end = now
    current_start = now - timedelta(days=27)
    comp_end = current_end - timedelta(days=7)
    comp_start = comp_end - timedelta(days=27)
    return (
        {"start": current_start, "end": current_end},
        {"start": comp_start, "end": comp_end},
    )


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


# ---------------------------------------------------------------------------
# Lead filtering (mirrors leadInDateRange / getFilteredLeads)
# ---------------------------------------------------------------------------

def _lead_date(lead: dict) -> date | None:
    """Primary date for a lead: init_dt_final > week_of > None.

    Prefers init_dt_final (per-lead date) over week_of (HLES upload week)
    so leads spread across the correct weekly buckets in chart data.
    Must match the JS equivalent (getLeadDateForPeriod / leadInDateRange).
    """
    d = _to_date(lead.get("init_dt_final"))
    if d:
        return d
    return _to_date(lead.get("week_of"))


def _lead_in_range(lead: dict, start: date, end: date) -> bool:
    d = _lead_date(lead)
    if d is None:
        return False
    return start <= d <= end


def _filter_leads(leads: list[dict], start: date, end: date, branch: str | None = None) -> list[dict]:
    """Filter leads by date range and optional branch. Excludes Reviewed."""
    out = []
    for lead in leads:
        if lead.get("status") == "Reviewed":
            continue
        if branch and lead.get("branch") != branch:
            continue
        if not _lead_in_range(lead, start, end):
            continue
        out.append(lead)
    return out


def _filter_from_list(branch_leads: list[dict], start: date, end: date) -> list[dict]:
    """Filter pre-indexed branch leads by date range. Excludes Reviewed."""
    return [l for l in branch_leads if l.get("status") != "Reviewed" and _lead_in_range(l, start, end)]


# ---------------------------------------------------------------------------
# Branch / GM resolution (mirrors getBranchesForGM, normalizeGmName)
# ---------------------------------------------------------------------------

def _normalize(s: str | None) -> str:
    if not s:
        return ""
    return re.sub(r"\s+", " ", str(s).strip().lower())


def _branches_for_gm(gm_name: str, org_rows: list[dict], leads: list[dict]) -> list[str]:
    nm = _normalize(gm_name)
    if not nm:
        return []
    from_org = {r["branch"] for r in org_rows if _normalize(r.get("gm")) == nm}
    from_leads = {
        l["branch"]
        for l in leads
        if l.get("branch") and _normalize(l.get("general_mgr")) == nm
    }
    return list(from_org | from_leads)


def _resolve_bm_name(org_row: dict | None, branch_leads: list[dict]) -> str:
    if org_row:
        bm = org_row.get("bm")
        if bm and bm != "— Unassigned —":
            return bm
    for l in branch_leads:
        bm = l.get("bm_name")
        if bm and bm != "—":
            return bm
    return "—"


# ---------------------------------------------------------------------------
# Time-to-contact parsing (mirrors parseTimeToMinutes)
# ---------------------------------------------------------------------------

def _parse_time_to_minutes(s) -> float | None:
    if not s or not isinstance(s, str):
        return None
    s = s.strip()
    if not s or s == "—":
        return None
    total = 0
    d = re.search(r"(\d+)\s*d", s)
    h = re.search(r"(\d+)\s*h", s)
    m = re.search(r"(\d+)\s*m", s)
    if d:
        total += int(d.group(1)) * 24 * 60
    if h:
        total += int(h.group(1)) * 60
    if m:
        total += int(m.group(1))
    return total if total > 0 else None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _w30_eligible(leads: list[dict]) -> list[dict]:
    """Leads that count toward the contacted-within-30-min denominator.

    Rented leads with NO CONTACT are excluded: they converted without a contact
    attempt so including them in the denominator would suppress the rate unfairly.
    All other leads (including Rented leads that do have a contact range) remain.
    """
    return [
        l for l in leads
        if not (
            l.get("status") == "Rented"
            and (l.get("contact_range") or "") in ("NO CONTACT", "")
            and not l.get("time_to_first_contact")
        )
    ]


# ---------------------------------------------------------------------------
# BM stats (mirrors getBMStats)
# ---------------------------------------------------------------------------

def _bm_stats(filtered: list[dict]) -> dict:
    total = len(filtered)
    enriched = sum(1 for l in filtered if l.get("enrichment_complete"))
    cancelled = sum(1 for l in filtered if l.get("status") == "Cancelled")
    unused = sum(1 for l in filtered if l.get("status") == "Unused")
    rented = sum(1 for l in filtered if l.get("status") == "Rented")
    return {
        "total": total,
        "enriched": enriched,
        "cancelled": cancelled,
        "unused": unused,
        "rented": rented,
        "enrichmentRate": round(enriched / total * 100) if total else 0,
        "conversionRate": round(rented / total * 100) if total else 0,
    }


# ---------------------------------------------------------------------------
# GM stats (mirrors getGMDashboardStats)
# ---------------------------------------------------------------------------

def _gm_stats(filtered: list[dict]) -> dict:
    total = len(filtered)
    rented = sum(1 for l in filtered if l.get("status") == "Rented")
    conversion_rate = round(rented / total * 100) if total else 0

    w30_pool = _w30_eligible(filtered)
    within30 = sum(1 for l in w30_pool if (l.get("contact_range") or "") == "(a)<30min")
    pct_within30 = round(within30 / len(w30_pool) * 100) if w30_pool else 0

    branch_contact = sum(1 for l in filtered if (l.get("first_contact_by") or "") == "branch")
    hrd_contact = sum(1 for l in filtered if (l.get("first_contact_by") or "") == "hrd")
    contact_total = branch_contact + hrd_contact
    branch_pct = round(branch_contact / total * 100) if total else 0

    actionable = [l for l in filtered if l.get("status") in ("Cancelled", "Unused")]
    with_comments = [
        l for l in actionable
        if (l.get("enrichment") or {}).get("reason") or (l.get("enrichment") or {}).get("notes")
    ]
    if actionable:
        comment_compliance = round(len(with_comments) / len(actionable) * 100)
    else:
        comment_compliance = 100 if total > 0 else 0

    cancelled_unreviewed = sum(
        1 for l in filtered
        if l.get("status") == "Cancelled" and not l.get("archived") and not l.get("gm_directive")
    )
    unused_overdue = sum(
        1 for l in filtered
        if l.get("status") == "Unused" and (l.get("days_open") or 0) > 5
    )
    no_contact = sum(1 for l in actionable if
        (l.get("contact_range") or "") == "NO CONTACT" or
        (l.get("first_contact_by") == "none" and not l.get("time_to_first_contact")))

    return {
        "total": total,
        "rented": rented,
        "conversionRate": conversion_rate,
        "pctWithin30": pct_within30,
        "branchPct": branch_pct,
        "hrdPct": (100 - branch_pct) if contact_total else 0,
        "branchContact": branch_contact,
        "hrdContact": hrd_contact,
        "commentCompliance": comment_compliance,
        "cancelledUnreviewed": cancelled_unreviewed,
        "unusedOverdue": unused_overdue,
        "noContactAttempt": no_contact,
    }


# ---------------------------------------------------------------------------
# Chart data — weekly buckets for trailing 4 weeks (mirrors buildChartDataByPeriodFromFiltered)
# ---------------------------------------------------------------------------

def _weekly_chart_data(
    filtered: list[dict],
    tasks: list[dict],
    start: date,
    end: date,
    branch: str | None = None,
    include_empty: bool = False,
) -> list[dict]:
    """Build weekly-bucketed chart data for the given date range.

    When *include_empty* is True every period slot is emitted even when it has
    no leads, so callers that need a fixed-length array (e.g. the GM trendline
    that extends 3 weeks before the T4W start) always receive the expected
    number of rows.
    """
    lead_by_id = {l["id"]: l for l in filtered}
    mon = _get_monday(start)
    end_monday = _get_monday(end)
    periods: list[dict] = []
    while mon <= end_monday:
        periods.append({
            "key": mon.isoformat(),
            "label": mon.strftime("%b %-d") if not _is_windows() else mon.strftime("%b %d").replace(" 0", " "),
            "leads": [],
        })
        mon += timedelta(days=7)

    period_map = {p["key"]: p for p in periods}

    for lead in filtered:
        # Use week_of (HLES-defined Sat–Fri week, stored as Monday label) when available
        # so chart buckets align with the HLES week definition instead of Mon–Sun boundaries.
        wk = _to_date(lead.get("week_of"))
        pk = wk.isoformat() if wk else None
        if pk is None:
            ld = _lead_date(lead)
            pk = _get_monday(ld).isoformat() if ld else None
        if pk and pk in period_map:
            period_map[pk]["leads"].append(lead)

    branch_tasks = [
        t for t in tasks
        if branch is None or _task_branch(t, lead_by_id) == branch
    ]
    tasks_in_range = [
        t for t in branch_tasks
        if _task_in_range(t, start, end)
    ]

    task_period_map: dict[str, list[dict]] = {p["key"]: [] for p in periods}
    for t in tasks_in_range:
        lead = lead_by_id.get(t.get("lead_id"))
        if not lead:
            continue
        wk = _to_date(lead.get("week_of"))
        pk = wk.isoformat() if wk else None
        if pk is None:
            ld = _lead_date(lead)
            pk = _get_monday(ld).isoformat() if ld else None
        if pk and pk in task_period_map:
            task_period_map[pk].append(t)

    result = []
    for p in periods:
        p_leads = p["leads"]
        total = len(p_leads)
        if total == 0 and not include_empty:
            continue
        rented = sum(1 for l in p_leads if l.get("status") == "Rented")
        cancelled = sum(1 for l in p_leads if l.get("status") == "Cancelled")
        unused = sum(1 for l in p_leads if l.get("status") == "Unused")
        enriched = sum(1 for l in p_leads if l.get("enrichment_complete"))
        w30_pool = _w30_eligible(p_leads)
        within30 = sum(1 for l in w30_pool if (l.get("contact_range") or "") == "(a)<30min")
        branch_contact = sum(1 for l in p_leads if (l.get("first_contact_by") or "") == "branch")
        hrd_contact = sum(1 for l in p_leads if (l.get("first_contact_by") or "") == "hrd")
        contact_total = branch_contact + hrd_contact
        cancelled_unreviewed = sum(
            1 for l in p_leads
            if l.get("status") == "Cancelled" and not l.get("archived") and not l.get("gm_directive")
        )
        unused_overdue = sum(1 for l in p_leads if l.get("status") == "Unused" and l.get("days_open", 0) > 5)
        p_actionable = [l for l in p_leads if l.get("status") in ("Cancelled", "Unused")]
        no_contact = sum(
            1 for l in p_actionable
            if (l.get("contact_range") or "") == "NO CONTACT"
            or (l.get("first_contact_by") == "none" and not l.get("time_to_first_contact"))
        )
        # Use None (not 0) for rate metrics when there are no leads so the
        # chart can distinguish "no data" from a genuine 0% rate.
        conversion_rate = round(rented / total * 100) if total else None
        comment_rate = round(enriched / total * 100) if total else None
        pct_within30 = round(within30 / len(w30_pool) * 100) if w30_pool else None
        branch_hrd_pct = round(branch_contact / contact_total * 100) if contact_total else None

        p_tasks = task_period_map.get(p["key"], [])
        open_tasks = sum(1 for t in p_tasks if t.get("status") != "Done")
        done_tasks = sum(1 for t in p_tasks if t.get("status") == "Done")
        task_completion = round(done_tasks / len(p_tasks) * 100) if p_tasks else None

        minutes = [
            m for m in (
                _parse_time_to_minutes(l.get("time_to_first_contact"))
                for l in p_leads
            )
            if m is not None
        ]
        avg_ttc = round(sum(minutes) / len(minutes)) if minutes else None

        monday = date.fromisoformat(p["key"])
        week_start = monday - timedelta(days=2)   # Saturday
        week_end = monday + timedelta(days=4)     # Friday
        result.append({
            "label": p["label"],
            "weekStart": week_start.isoformat(),
            "weekEnd": week_end.isoformat(),
            "totalLeads": total,
            "rented": rented,
            "cancelled": cancelled,
            "unused": unused,
            "enriched": enriched,
            "within30": within30,
            "w30Den": len(w30_pool),
            "branchContact": branch_contact,
            "hrdContact": hrd_contact,
            "contactTotal": contact_total,
            "cancelledUnreviewed": cancelled_unreviewed,
            "unusedOverdue": unused_overdue,
            "noContact": no_contact,
            "conversionRate": conversion_rate,
            "commentRate": comment_rate,
            "pctWithin30": pct_within30,
            "branchHrdPct": branch_hrd_pct,
            "openTasks": open_tasks,
            "taskCompletionRate": task_completion,
            "avgTimeToContact": avg_ttc,
        })

    return result


def _is_windows() -> bool:
    import platform
    return platform.system() == "Windows"


def _task_branch(task: dict, lead_by_id: dict) -> str | None:
    lead = lead_by_id.get(task.get("lead_id"))
    return lead.get("branch") if lead else None


def _task_in_range(task: dict, start: date, end: date) -> bool:
    created = task.get("created_at")
    if not created:
        return False
    if isinstance(created, str):
        try:
            dt = datetime.fromisoformat(created)
        except (ValueError, TypeError):
            return False
    elif isinstance(created, datetime):
        dt = created
    else:
        return False
    d = dt.date() if hasattr(dt, "date") else dt
    return start <= d <= end


# ---------------------------------------------------------------------------
# Task stats (mirrors getOpenTasksCount / getTaskCompletionRate)
# ---------------------------------------------------------------------------

def _task_stats(tasks: list[dict], lead_by_id: dict, branch: str | None, start: date, end: date) -> dict:
    branch_tasks = [
        t for t in tasks
        if branch is None or _task_branch(t, lead_by_id) == branch
    ]
    in_range = [t for t in branch_tasks if _task_in_range(t, start, end)]
    open_count = sum(1 for t in in_range if t.get("status") != "Done")
    done_count = sum(1 for t in in_range if t.get("status") == "Done")
    total = len(in_range)

    minutes = []
    for l in (lead_by_id.get(t.get("lead_id")) for t in in_range):
        if l:
            m = _parse_time_to_minutes(l.get("time_to_first_contact"))
            if m is not None:
                minutes.append(m)

    return {
        "open": open_count,
        "completionRate": round(done_count / total * 100) if total else 0,
        "avgTimeToContactMin": round(sum(minutes) / len(minutes)) if minutes else 0,
    }


# ---------------------------------------------------------------------------
# Meeting prep (mirrors getMeetingPrepOutstandingCount, getNeedsCommentsCount, getMismatchLeadsInRange)
# ---------------------------------------------------------------------------

def _meeting_prep(filtered: list[dict]) -> dict:
    needs_comments = [
        l for l in filtered
        if l.get("status") in ("Cancelled", "Unused")
        and not ((l.get("enrichment") or {}).get("reason") or (l.get("enrichment") or {}).get("notes"))
    ]
    has_mismatch = [l for l in filtered if l.get("mismatch")]
    unique_ids = {l["id"] for l in needs_comments} | {l["id"] for l in has_mismatch}
    return {
        "outstanding": len(unique_ids),
        "needsComments": len(needs_comments),
        "mismatch": len(has_mismatch),
    }


# ---------------------------------------------------------------------------
# Leaderboard (mirrors getGMBranchLeaderboard)
# ---------------------------------------------------------------------------

def _build_leaderboard(
    leads: list[dict],
    org_rows: list[dict],
    start: date,
    end: date,
    gm_name: str,
    gm_branches: list[str],
    comp_start: date,
    comp_end: date,
) -> list[dict]:
    all_branches = list({r["branch"] for r in org_rows})
    org_by_branch = {r["branch"]: r for r in org_rows}

    rows = []
    for branch in all_branches:
        bl = _filter_leads(leads, start, end, branch)
        total = len(bl)
        rented = sum(1 for l in bl if l.get("status") == "Rented")
        cancelled = sum(1 for l in bl if l.get("status") == "Cancelled")
        unused = sum(1 for l in bl if l.get("status") == "Unused")
        conversion_rate = round(rented / total * 100) if total else None

        w30_pool = _w30_eligible(bl)
        w30 = sum(1 for l in w30_pool if (l.get("contact_range") or "") == "(a)<30min")
        pct_within30 = round(w30 / len(w30_pool) * 100) if w30_pool else None

        bc = sum(1 for l in bl if (l.get("first_contact_by") or "") == "branch")
        hc = sum(1 for l in bl if (l.get("first_contact_by") or "") == "hrd")
        branch_hrd_pct = round(bc / (bc + hc) * 100) if (bc + hc) > 0 else None

        actionable = [l for l in bl if l.get("status") in ("Cancelled", "Unused")]
        with_comments = [
            l for l in actionable
            if (l.get("enrichment") or {}).get("reason") or (l.get("enrichment") or {}).get("notes")
        ]
        if actionable:
            comment_rate = round(len(with_comments) / len(actionable) * 100)
        elif total > 0:
            comment_rate = 100
        else:
            comment_rate = None

        cancelled_unreviewed = sum(
            1 for l in bl
            if l.get("status") == "Cancelled" and not l.get("archived") and not l.get("gm_directive")
        )
        unused_overdue = sum(
            1 for l in bl
            if l.get("status") == "Unused" and (l.get("days_open") or 0) > 5
        )

        org_row = org_by_branch.get(branch)

        # Comparison period
        prev_bl = _filter_leads(leads, comp_start, comp_end, branch)
        prev_total = len(prev_bl)
        prev_rented = sum(1 for l in prev_bl if l.get("status") == "Rented")
        prev_conversion = round(prev_rented / prev_total * 100) if prev_total else None

        prev_w30_pool = _w30_eligible(prev_bl)
        prev_w30 = sum(1 for l in prev_w30_pool if (l.get("contact_range") or "") == "(a)<30min")
        prev_pct_within30 = round(prev_w30 / len(prev_w30_pool) * 100) if prev_w30_pool else None
        prev_bc = sum(1 for l in prev_bl if (l.get("first_contact_by") or "") == "branch")
        prev_hc = sum(1 for l in prev_bl if (l.get("first_contact_by") or "") == "hrd")
        prev_branch_hrd_pct = round(prev_bc / (prev_bc + prev_hc) * 100) if (prev_bc + prev_hc) > 0 else None
        prev_actionable = [l for l in prev_bl if l.get("status") in ("Cancelled", "Unused")]
        prev_with_comments = [
            l for l in prev_actionable
            if (l.get("enrichment") or {}).get("reason") or (l.get("enrichment") or {}).get("notes")
        ]
        if prev_actionable:
            prev_comment_rate = round(len(prev_with_comments) / len(prev_actionable) * 100)
        elif prev_total > 0:
            prev_comment_rate = 100
        else:
            prev_comment_rate = None

        improvement_delta = (
            (conversion_rate - prev_conversion)
            if conversion_rate is not None and prev_conversion is not None
            else None
        )

        rows.append({
            "branch": branch,
            "bmName": _resolve_bm_name(org_row, bl),
            "zone": (org_row or {}).get("zone", "—"),
            "gm": (org_row or {}).get("gm", "—"),
            "total": total,
            "rented": rented,
            "cancelled": cancelled,
            "unused": unused,
            "conversionRate": conversion_rate,
            "pctWithin30": pct_within30,
            "branchHrdPct": branch_hrd_pct,
            "commentRate": comment_rate,
            "cancelledUnreviewed": cancelled_unreviewed,
            "unusedOverdue": unused_overdue,
            "isMyBranch": branch in gm_branches,
            "improvementDelta": improvement_delta,
            "prevConversionRate": prev_conversion,
            "prevPctWithin30": prev_pct_within30,
            "prevBranchHrdPct": prev_branch_hrd_pct,
            "prevCommentRate": prev_comment_rate,
        })

    # Quartile assignment by conversionRate descending
    q_sorted = sorted(rows, key=lambda r: r["conversionRate"] if r["conversionRate"] is not None else -1, reverse=True)
    n = len(q_sorted)
    for i, row in enumerate(q_sorted):
        if n == 0:
            row["quartile"] = None
        else:
            pct = i / n
            row["quartile"] = 1 if pct < 0.25 else 2 if pct < 0.5 else 3 if pct < 0.75 else 4

    # Default sort by conversionRate desc, assign rank
    sorted_rows = sorted(rows, key=lambda r: r["conversionRate"] if r["conversionRate"] is not None else -1, reverse=True)
    for i, row in enumerate(sorted_rows):
        row["rank"] = i + 1

    return sorted_rows


def _build_leaderboard_indexed(
    branch_current: dict[str, list[dict]],
    branch_prev: dict[str, list[dict]],
    org_by_branch: dict[str, dict],
    all_branches: list[str],
) -> list[dict]:
    """Build leaderboard rows using pre-indexed/pre-filtered branch data.

    Returns rows WITHOUT isMyBranch set (caller stamps that per-GM).
    """
    rows = []
    for branch in all_branches:
        bl = branch_current.get(branch, [])
        total = len(bl)
        rented = sum(1 for l in bl if l.get("status") == "Rented")
        cancelled = sum(1 for l in bl if l.get("status") == "Cancelled")
        unused = sum(1 for l in bl if l.get("status") == "Unused")
        conversion_rate = round(rented / total * 100) if total else None

        w30_pool = _w30_eligible(bl)
        w30 = sum(1 for l in w30_pool if (l.get("contact_range") or "") == "(a)<30min")
        pct_within30 = round(w30 / len(w30_pool) * 100) if w30_pool else None

        bc = sum(1 for l in bl if (l.get("first_contact_by") or "") == "branch")
        hc = sum(1 for l in bl if (l.get("first_contact_by") or "") == "hrd")
        branch_hrd_pct = round(bc / (bc + hc) * 100) if (bc + hc) > 0 else None

        actionable = [l for l in bl if l.get("status") in ("Cancelled", "Unused")]
        with_comments = [
            l for l in actionable
            if (l.get("enrichment") or {}).get("reason") or (l.get("enrichment") or {}).get("notes")
        ]
        if actionable:
            comment_rate = round(len(with_comments) / len(actionable) * 100)
        elif total > 0:
            comment_rate = 100
        else:
            comment_rate = None

        cancelled_unreviewed = sum(
            1 for l in bl
            if l.get("status") == "Cancelled" and not l.get("archived") and not l.get("gm_directive")
        )
        unused_overdue = sum(
            1 for l in bl
            if l.get("status") == "Unused" and (l.get("days_open") or 0) > 5
        )
        bl_actionable = [l for l in bl if l.get("status") in ("Cancelled", "Unused")]
        no_contact = sum(
            1 for l in bl_actionable
            if (l.get("contact_range") or "") == "NO CONTACT" or
            (l.get("first_contact_by") == "none" and not l.get("time_to_first_contact"))
        )

        org_row = org_by_branch.get(branch)

        prev_bl = branch_prev.get(branch, [])
        prev_total = len(prev_bl)
        prev_rented = sum(1 for l in prev_bl if l.get("status") == "Rented")
        prev_conversion_exact = (prev_rented / prev_total * 100) if prev_total else None
        prev_conversion = round(prev_conversion_exact) if prev_conversion_exact is not None else None

        prev_w30_pool = _w30_eligible(prev_bl)
        prev_w30 = sum(1 for l in prev_w30_pool if (l.get("contact_range") or "") == "(a)<30min")
        prev_pct_within30 = round(prev_w30 / len(prev_w30_pool) * 100) if prev_w30_pool else None
        prev_bc = sum(1 for l in prev_bl if (l.get("first_contact_by") or "") == "branch")
        prev_hc = sum(1 for l in prev_bl if (l.get("first_contact_by") or "") == "hrd")
        prev_branch_hrd_pct = round(prev_bc / (prev_bc + prev_hc) * 100) if (prev_bc + prev_hc) > 0 else None
        prev_actionable = [l for l in prev_bl if l.get("status") in ("Cancelled", "Unused")]
        prev_with_comments = [
            l for l in prev_actionable
            if (l.get("enrichment") or {}).get("reason") or (l.get("enrichment") or {}).get("notes")
        ]
        if prev_actionable:
            prev_comment_rate = round(len(prev_with_comments) / len(prev_actionable) * 100)
        elif prev_total > 0:
            prev_comment_rate = 100
        else:
            prev_comment_rate = None

        prev_no_contact = sum(
            1 for l in prev_actionable
            if (l.get("contact_range") or "") == "NO CONTACT" or
            (l.get("first_contact_by") == "none" and not l.get("time_to_first_contact"))
        )
        prev_cancelled_unreviewed = sum(
            1 for l in prev_bl
            if l.get("status") == "Cancelled" and not l.get("archived") and not l.get("gm_directive")
        )
        prev_unused_overdue = sum(
            1 for l in prev_bl
            if l.get("status") == "Unused" and (l.get("days_open") or 0) > 5
        )

        # Compute deltas from exact unrounded rates to avoid rounding-of-rounded errors.
        # e.g. round(63.64) - round(60.34) = 64 - 60 = 4, but round(63.64 - 60.34) = round(3.29) = 3
        def _exact_delta(cur_num, cur_den, prev_num, prev_den):
            if not cur_den or not prev_den:
                return None
            return round(cur_num / cur_den * 100 - prev_num / prev_den * 100)

        conversion_rate_exact = (rented / total * 100) if total else None
        improvement_delta = (
            round(conversion_rate_exact - prev_conversion_exact)
            if conversion_rate_exact is not None and prev_conversion_exact is not None
            else None
        )
        delta_pct_within30 = _exact_delta(w30, len(w30_pool), prev_w30, len(prev_w30_pool))
        delta_branch_hrd_pct = _exact_delta(bc, bc + hc, prev_bc, prev_bc + prev_hc) if (bc + hc) and (prev_bc + prev_hc) else None
        delta_comment_rate = (
            round(len(with_comments) / len(actionable) * 100 - len(prev_with_comments) / len(prev_actionable) * 100)
            if actionable and prev_actionable else None
        )

        rows.append({
            "branch": branch,
            "bmName": _resolve_bm_name(org_row, bl),
            "zone": (org_row or {}).get("zone", "—"),
            "gm": (org_row or {}).get("gm", "—"),
            "total": total,
            "rented": rented,
            "cancelled": cancelled,
            "unused": unused,
            "conversionRate": conversion_rate,
            "pctWithin30": pct_within30,
            "branchHrdPct": branch_hrd_pct,
            "commentRate": comment_rate,
            "cancelledUnreviewed": cancelled_unreviewed,
            "unusedOverdue": unused_overdue,
            "noContact": no_contact,
            "improvementDelta": improvement_delta,
            "prevConversionRate": prev_conversion,
            "prevPctWithin30": prev_pct_within30,
            "prevBranchHrdPct": prev_branch_hrd_pct,
            "prevCommentRate": prev_comment_rate,
            "deltaPctWithin30": delta_pct_within30,
            "deltaBranchHrdPct": delta_branch_hrd_pct,
            "deltaCommentRate": delta_comment_rate,
            "prevNoContact": prev_no_contact,
            "prevCancelledUnreviewed": prev_cancelled_unreviewed,
            "prevUnusedOverdue": prev_unused_overdue,
        })

    q_sorted = sorted(rows, key=lambda r: r["conversionRate"] if r["conversionRate"] is not None else -1, reverse=True)
    n = len(q_sorted)
    for i, row in enumerate(q_sorted):
        if n == 0:
            row["quartile"] = None
        else:
            pct = i / n
            row["quartile"] = 1 if pct < 0.25 else 2 if pct < 0.5 else 3 if pct < 0.75 else 4

    sorted_rows = sorted(rows, key=lambda r: r["conversionRate"] if r["conversionRate"] is not None else -1, reverse=True)
    for i, row in enumerate(sorted_rows):
        row["rank"] = i + 1

    return sorted_rows


# ---------------------------------------------------------------------------
# Top-level orchestrator
# ---------------------------------------------------------------------------

def compute_and_store_snapshot():
    """Compute dashboard metrics for the trailing 4-week view and store as JSONB."""
    t0 = _time.monotonic()
    earliest_date = (datetime.utcnow() - timedelta(weeks=12)).strftime("%Y-%m-%d")
    print("[snapshot] compute_and_store_snapshot started", flush=True)
    try:
        leads = query(
            "SELECT * FROM leads WHERE archived = false AND COALESCE(init_dt_final, week_of) >= %s",
            (earliest_date,),
        )
        print(f"[snapshot] loaded {len(leads)} leads in {_time.monotonic() - t0:.2f}s", flush=True)
        org_rows = query("SELECT * FROM org_mapping")
        tasks = query("SELECT * FROM tasks")
    except Exception:
        print("[snapshot] ERROR reading data from DB", flush=True)
        logger.exception("Failed to read data for snapshot computation")
        return

    t_load = _time.monotonic()

    if not leads:
        print("[snapshot] no leads found — skipping", flush=True)
        print(f"[snapshot] compute complete in {_time.monotonic() - t0:.2f}s", flush=True)
        return

    now = _get_now(leads)
    current, comparison = _trailing_4_weeks(now)
    c_start, c_end = current["start"], current["end"]
    p_start, p_end = comparison["start"], comparison["end"]

    # --- Pre-index leads by branch (avoids scanning 62K leads per branch) ---
    leads_by_branch: dict[str, list[dict]] = {}
    for lead in leads:
        b = lead.get("branch")
        if b:
            leads_by_branch.setdefault(b, []).append(lead)

    lead_by_id = {l["id"]: l for l in leads}

    all_branches = list({r["branch"] for r in org_rows})
    org_by_branch = {r["branch"]: r for r in org_rows}

    # --- Pre-filter per branch (current + comparison) ---
    branch_current: dict[str, list[dict]] = {}
    branch_prev: dict[str, list[dict]] = {}
    for branch in all_branches:
        bl = leads_by_branch.get(branch, [])
        branch_current[branch] = _filter_from_list(bl, c_start, c_end)
        branch_prev[branch] = _filter_from_list(bl, p_start, p_end)

    t_index = _time.monotonic()
    print(f"[snapshot] indexed {len(all_branches)} branches in {t_index - t_load:.1f}s", flush=True)

    # --- Per-branch metrics ---
    branches_snapshot: dict = {}
    for branch in all_branches:
        filtered = branch_current[branch]
        prev_filtered = branch_prev[branch]

        org_row = org_by_branch.get(branch)
        gm = (org_row or {}).get("gm", "—")
        zone = (org_row or {}).get("zone", "—")

        branches_snapshot[branch] = {
            "bmName": _resolve_bm_name(org_row, filtered),
            "gm": gm,
            "zone": zone,
            "stats": _bm_stats(filtered),
            "comparison": _bm_stats(prev_filtered),
            "tasks": _task_stats(tasks, lead_by_id, branch, c_start, c_end),
            "comparisonTasks": _task_stats(tasks, lead_by_id, branch, p_start, p_end),
            "chartData": _weekly_chart_data(filtered, tasks, c_start, c_end, branch),
            "meetingPrep": _meeting_prep(filtered),
        }

    t_branches = _time.monotonic()
    print(f"[snapshot] computed {len(branches_snapshot)} branch snapshots in {t_branches - t_index:.1f}s", flush=True)

    # --- Leaderboard: compute ONCE for all branches, then tag per-GM ---
    leaderboard_base = _build_leaderboard_indexed(
        branch_current, branch_prev, org_by_branch, all_branches,
    )

    t_lb = _time.monotonic()
    print(f"[snapshot] computed global leaderboard ({len(leaderboard_base)} rows) in {t_lb - t_branches:.1f}s", flush=True)

    # --- Per-GM metrics ---
    gm_names = list({r.get("gm") for r in org_rows if r.get("gm")})
    gms_snapshot: dict = {}

    for gm_name in gm_names:
        gm_branches = _branches_for_gm(gm_name, org_rows, leads)

        gm_branch_leads = []
        for b in gm_branches:
            gm_branch_leads.extend(leads_by_branch.get(b, []))

        gm_filtered = [
            l for l in gm_branch_leads
            if l.get("status") != "Reviewed" and _lead_in_range(l, c_start, c_end)
        ]
        gm_prev = [
            l for l in gm_branch_leads
            if l.get("status") != "Reviewed" and _lead_in_range(l, p_start, p_end)
        ]

        # Include 3 extra historical weeks before c_start so each trendline
        # data point can show a proper trailing-4-week breakdown window.
        chart_history_start = c_start - timedelta(weeks=3)
        gm_chart_leads = [
            l for l in gm_branch_leads
            if l.get("status") != "Reviewed" and _lead_in_range(l, chart_history_start, c_end)
        ]

        gms_snapshot[gm_name] = {
            "zone": org_by_branch.get(gm_branches[0], {}).get("zone", "—") if gm_branches else "—",
            "branches": gm_branches,
            "stats": _gm_stats(gm_filtered),
            "comparison": _gm_stats(gm_prev),
            "chartData": _weekly_chart_data(gm_chart_leads, tasks, chart_history_start, c_end, include_empty=True),
        }

    t_gms = _time.monotonic()
    print(f"[snapshot] computed {len(gms_snapshot)} GM snapshots in {t_gms - t_lb:.1f}s", flush=True)

    # --- Zone-level aggregates (weighted, from raw counts) ---
    # Group branches by zone and sum raw counts so the frontend can display
    # a true weighted zone conversion rate (total rented / total leads),
    # not an average of branch-level rounded percentages.
    zone_buckets: dict[str, dict] = {}
    for row in leaderboard_base:
        z = row.get("zone") or "—"
        if z not in zone_buckets:
            zone_buckets[z] = {
                "total": 0, "rented": 0,
                "w30": 0,
                "bc": 0, "bc_hc": 0,
                "actionable": 0, "with_comments": 0,
                "prev_total": 0, "prev_rented": 0,
                "prev_w30": 0,
                "prev_bc": 0, "prev_bc_hc": 0,
                "prev_actionable": 0, "prev_with_comments": 0,
            }
        b = zone_buckets[z]
        bl = branch_current.get(row["branch"], [])
        prev_bl = branch_prev.get(row["branch"], [])

        b["total"] += len(bl)
        b["rented"] += sum(1 for l in bl if l.get("status") == "Rented")
        cur_w30_pool = _w30_eligible(bl)
        b["w30"] += sum(1 for l in cur_w30_pool if (l.get("contact_range") or "") == "(a)<30min")
        b["w30_den"] = b.get("w30_den", 0) + len(cur_w30_pool)
        bc_cur = sum(1 for l in bl if (l.get("first_contact_by") or "") == "branch")
        hc_cur = sum(1 for l in bl if (l.get("first_contact_by") or "") == "hrd")
        b["bc"] += bc_cur
        b["bc_hc"] += bc_cur + hc_cur
        actionable_cur = [l for l in bl if l.get("status") in ("Cancelled", "Unused")]
        b["actionable"] += len(actionable_cur)
        b["with_comments"] += sum(
            1 for l in actionable_cur
            if (l.get("enrichment") or {}).get("reason") or (l.get("enrichment") or {}).get("notes")
        )

        b["prev_total"] += len(prev_bl)
        b["prev_rented"] += sum(1 for l in prev_bl if l.get("status") == "Rented")
        prev_w30_pool = _w30_eligible(prev_bl)
        b["prev_w30"] += sum(1 for l in prev_w30_pool if (l.get("contact_range") or "") == "(a)<30min")
        b["prev_w30_den"] = b.get("prev_w30_den", 0) + len(prev_w30_pool)
        bc_prev = sum(1 for l in prev_bl if (l.get("first_contact_by") or "") == "branch")
        hc_prev = sum(1 for l in prev_bl if (l.get("first_contact_by") or "") == "hrd")
        b["prev_bc"] += bc_prev
        b["prev_bc_hc"] += bc_prev + hc_prev
        actionable_prev = [l for l in prev_bl if l.get("status") in ("Cancelled", "Unused")]
        b["prev_actionable"] += len(actionable_prev)
        b["prev_with_comments"] += sum(
            1 for l in actionable_prev
            if (l.get("enrichment") or {}).get("reason") or (l.get("enrichment") or {}).get("notes")
        )

    def _safe_rate(num, den):
        return round(num / den * 100) if den else None

    zones_snapshot: dict = {}
    for z, b in zone_buckets.items():
        zones_snapshot[z] = {
            "conversionRate": _safe_rate(b["rented"], b["total"]),
            "pctWithin30": _safe_rate(b["w30"], b.get("w30_den", b["total"])),
            "branchHrdPct": _safe_rate(b["bc"], b["bc_hc"]),
            "commentRate": _safe_rate(b["with_comments"], b["actionable"]) if b["actionable"] else (100 if b["total"] > 0 else None),
            "prevConversionRate": _safe_rate(b["prev_rented"], b["prev_total"]),
            "prevPctWithin30": _safe_rate(b["prev_w30"], b.get("prev_w30_den", b["prev_total"])),
            "prevBranchHrdPct": _safe_rate(b["prev_bc"], b["prev_bc_hc"]),
            "prevCommentRate": _safe_rate(b["prev_with_comments"], b["prev_actionable"]) if b["prev_actionable"] else (100 if b["prev_total"] > 0 else None),
            "total": b["total"],
        }

    t_zones = _time.monotonic()
    print(f"[snapshot] computed {len(zones_snapshot)} zone snapshots in {t_zones - t_gms:.1f}s", flush=True)

    snapshot = {
        "version": 2,
        "computed_at": datetime.now(timezone.utc).isoformat(),
        "now": now.isoformat(),
        "period": {"start": c_start.isoformat(), "end": c_end.isoformat()},
        "comparison": {"start": p_start.isoformat(), "end": p_end.isoformat()},
        "branches": branches_snapshot,
        "gms": gms_snapshot,
        "zones": zones_snapshot,
        "leaderboard": leaderboard_base,
    }

    try:
        payload = json.dumps(snapshot, default=str)
        execute(
            "INSERT INTO dashboard_snapshots (snapshot) VALUES (%s::jsonb)",
            (payload,),
        )
        t_done = _time.monotonic()
        print(f"[snapshot] STORED OK — now={now}, {len(branches_snapshot)} branches, {len(gms_snapshot)} GMs, json={len(payload)} chars, total={t_done - t0:.1f}s", flush=True)
        print(f"[snapshot] compute complete in {_time.monotonic() - t0:.2f}s", flush=True)
    except Exception as exc:
        print(f"[snapshot] ERROR storing snapshot: {exc}", flush=True)
        logger.exception("Failed to store dashboard snapshot")
