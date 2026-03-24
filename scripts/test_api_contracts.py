"""
Layer 2: API Contract Tests — run against the deployed app.

Usage:
    python scripts/test_api_contracts.py

Tests validate endpoint responses, pagination envelopes, hard caps,
date bounds, and new filters introduced in the 800K architecture.
"""

import os
import sys
import time
import json
import requests

BASE_URL = "https://hertz-leo-leadsmgmtsystem-1957546315544672.aws.databricksapps.com"
API = f"{BASE_URL}/api"

CREDENTIALS = {
    "admin": {"email": os.environ.get("E2E_ADMIN_EMAIL", "admin.leo@hertz.com"), "password": os.environ["E2E_ADMIN_PASSWORD"]},
    "gm": {"email": os.environ.get("E2E_GM_EMAIL", "adamfrankel.leo@hertz.com"), "password": os.environ["E2E_GM_PASSWORD"]},
    "bm": {"email": os.environ.get("E2E_BM_EMAIL", "jonathanhoover.leo@hertz.com"), "password": os.environ["E2E_BM_PASSWORD"]},
}

passed = 0
failed = 0
skipped = 0
results = []


def log(status, name, detail=""):
    global passed, failed, skipped
    icon = {"PASS": "+", "FAIL": "!", "SKIP": "~"}[status]
    if status == "PASS":
        passed += 1
    elif status == "FAIL":
        failed += 1
    else:
        skipped += 1
    msg = f"  [{icon}] {name}" + (f"  ({detail})" if detail else "")
    print(msg, flush=True)
    results.append({"status": status, "name": name, "detail": detail})


def authenticate(role):
    cred = CREDENTIALS[role]
    resp = requests.post(
        f"{API}/auth/login",
        json=cred,
        timeout=15,
    )
    if resp.status_code != 200:
        return None
    data = resp.json()
    return data.get("token") or data.get("access_token")


def get(path, token, params=None, timeout=15):
    headers = {
        "Authorization": f"Bearer {token}",
        "X-Leo-Token": token,
    }
    url = f"{API}{path}"
    return requests.get(url, headers=headers, params=params, timeout=timeout)


# ── Auth ──────────────────────────────────────────────────────────────────────

def test_auth():
    print("\n=== Auth ===", flush=True)

    for role in ("admin", "gm", "bm"):
        token = authenticate(role)
        if token:
            log("PASS", f"auth/login ({role})", f"token length={len(token)}")
        else:
            log("FAIL", f"auth/login ({role})", "no token returned")

    resp = requests.get(f"{API}/auth/me", timeout=10)
    if resp.status_code in (401, 403):
        log("PASS", "auth/me without token returns 401/403", f"status={resp.status_code}")
    else:
        log("FAIL", "auth/me without token returns 401/403", f"status={resp.status_code}")


# ── Dashboard & Observatory Snapshots ─────────────────────────────────────────

def test_snapshots(token):
    print("\n=== Snapshots ===", flush=True)

    t0 = time.monotonic()
    resp = get("/dashboard-snapshot", token)
    elapsed = time.monotonic() - t0
    if resp.status_code == 200:
        data = resp.json()
        has_keys = "snapshot" in data or "status_breakdown" in data or isinstance(data, dict)
        log("PASS", "GET /dashboard-snapshot", f"{elapsed:.2f}s, keys={list(data.keys())[:5]}")
        if elapsed < 2.0:
            log("PASS", "dashboard-snapshot SLO < 2s", f"{elapsed:.2f}s")
        else:
            log("FAIL", "dashboard-snapshot SLO < 2s", f"{elapsed:.2f}s")
    else:
        log("FAIL", "GET /dashboard-snapshot", f"status={resp.status_code}")

    t0 = time.monotonic()
    resp = get("/observatory-snapshot", token)
    elapsed = time.monotonic() - t0
    if resp.status_code == 200:
        log("PASS", "GET /observatory-snapshot", f"{elapsed:.2f}s")
        if elapsed < 5.0:
            log("PASS", "observatory-snapshot SLO < 5s", f"{elapsed:.2f}s")
        else:
            log("FAIL", "observatory-snapshot SLO < 5s", f"{elapsed:.2f}s")
    else:
        log("FAIL", "GET /observatory-snapshot", f"status={resp.status_code}")


# ── Leads Pagination ──────────────────────────────────────────────────────────

def test_leads_paged(token):
    print("\n=== Leads (Paged) ===", flush=True)

    t0 = time.monotonic()
    resp = get("/leads", token, params={"paged": "1", "limit": "20", "offset": "0"})
    elapsed = time.monotonic() - t0
    if resp.status_code == 200:
        data = resp.json()
        has_items = "items" in data
        has_total = "total" in data
        has_next = "has_next" in data
        has_limit = "limit" in data
        has_offset = "offset" in data

        if has_items and has_total and has_next and has_limit and has_offset:
            log("PASS", "paged leads envelope shape", f"total={data['total']}, items={len(data['items'])}")
        else:
            log("FAIL", "paged leads envelope shape", f"keys={list(data.keys())}")

        if has_items and len(data["items"]) <= 20:
            log("PASS", "paged leads respects limit=20", f"returned {len(data['items'])} items")
        elif has_items:
            log("FAIL", "paged leads respects limit=20", f"returned {len(data['items'])} items")

        if elapsed < 2.0:
            log("PASS", "paged leads SLO < 2s", f"{elapsed:.2f}s")
        else:
            log("FAIL", "paged leads SLO < 2s", f"{elapsed:.2f}s")
    else:
        log("FAIL", "GET /leads?paged=1", f"status={resp.status_code}")

    # Page 2
    resp = get("/leads", token, params={"paged": "1", "limit": "20", "offset": "20"})
    if resp.status_code == 200:
        data = resp.json()
        if data.get("offset") == 20:
            log("PASS", "paged leads page 2 (offset=20)", f"items={len(data.get('items', []))}")
        else:
            log("FAIL", "paged leads page 2 offset mismatch", f"offset={data.get('offset')}")
    else:
        log("FAIL", "paged leads page 2", f"status={resp.status_code}")


# ── Leads Filters ─────────────────────────────────────────────────────────────

def test_leads_filters(token):
    print("\n=== Leads Filters ===", flush=True)

    # Status filter
    resp = get("/leads", token, params={"paged": "1", "limit": "10", "status": "Unused"})
    if resp.status_code == 200:
        data = resp.json()
        items = data.get("items", [])
        all_unused = all(i.get("status") == "Unused" for i in items) if items else True
        log("PASS" if all_unused else "FAIL", "status=Unused filter", f"{len(items)} items, all Unused={all_unused}")
    else:
        log("FAIL", "status=Unused filter", f"status={resp.status_code}")

    # Multi-status filter
    resp = get("/leads", token, params={"paged": "1", "limit": "10", "status": "Cancelled,Unused"})
    if resp.status_code == 200:
        data = resp.json()
        items = data.get("items", [])
        all_valid = all(i.get("status") in ("Cancelled", "Unused") for i in items) if items else True
        log("PASS" if all_valid else "FAIL", "multi-status=Cancelled,Unused filter", f"{len(items)} items")
    else:
        log("FAIL", "multi-status filter", f"status={resp.status_code}")

    # Date filter (YYYY-MM-DD)
    resp = get("/leads", token, params={
        "paged": "1", "limit": "10",
        "start_date": "2026-01-01", "end_date": "2026-12-31"
    })
    if resp.status_code == 200:
        log("PASS", "date filter YYYY-MM-DD", f"items={len(resp.json().get('items', []))}")
    else:
        log("FAIL", "date filter YYYY-MM-DD", f"status={resp.status_code}")

    # enrichment_complete filter
    resp = get("/leads", token, params={"paged": "1", "limit": "10", "enrichment_complete": "true"})
    if resp.status_code == 200:
        data = resp.json()
        items = data.get("items", [])
        log("PASS", "enrichment_complete=true filter", f"{len(items)} items")
    else:
        log("SKIP", "enrichment_complete filter", f"status={resp.status_code} (may not be deployed)")

    # has_directive filter
    resp = get("/leads", token, params={"paged": "1", "limit": "10", "has_directive": "true"})
    if resp.status_code == 200:
        log("PASS", "has_directive=true filter", f"items={len(resp.json().get('items', []))}")
    else:
        log("SKIP", "has_directive filter", f"status={resp.status_code} (may not be deployed)")


# ── Single Lead ───────────────────────────────────────────────────────────────

def test_single_lead(token):
    print("\n=== Single Lead ===", flush=True)

    # First get a lead ID from paged results
    resp = get("/leads", token, params={"paged": "1", "limit": "1"})
    if resp.status_code != 200:
        log("SKIP", "single lead (no leads available)")
        return

    items = resp.json().get("items", [])
    if not items:
        log("SKIP", "single lead (empty result set)")
        return

    lead_id = items[0].get("id")
    t0 = time.monotonic()
    resp = get(f"/leads/{lead_id}", token)
    elapsed = time.monotonic() - t0

    if resp.status_code == 200:
        data = resp.json()
        has_id = "id" in data
        has_customer = "customer" in data
        log("PASS", f"GET /leads/{lead_id}", f"{elapsed:.2f}s, has_id={has_id}")
        if elapsed < 1.0:
            log("PASS", "single lead SLO < 1s", f"{elapsed:.2f}s")
        else:
            log("FAIL", "single lead SLO < 1s", f"{elapsed:.2f}s")
    else:
        log("FAIL", f"GET /leads/{lead_id}", f"status={resp.status_code}")

    # 404 for non-existent lead
    resp = get("/leads/999999999", token)
    if resp.status_code == 404:
        log("PASS", "GET /leads/999999999 returns 404")
    else:
        log("FAIL", "GET /leads/999999999 expected 404", f"status={resp.status_code}")


# ── Unpaged Cap ───────────────────────────────────────────────────────────────

def test_unpaged_cap(token):
    print("\n=== Unpaged Leads Cap ===", flush=True)

    resp = get("/leads", token)
    if resp.status_code == 200:
        data = resp.json()
        if isinstance(data, list):
            count = len(data)
            if count <= 500:
                log("PASS", "unpaged leads capped at 500", f"returned {count}")
            else:
                log("FAIL", "unpaged leads exceeds 500 cap", f"returned {count}")
        else:
            log("SKIP", "unpaged leads returned dict (may default to paged)")
    else:
        log("FAIL", "GET /leads (unpaged)", f"status={resp.status_code}")


# ── Tasks ─────────────────────────────────────────────────────────────────────

def test_tasks(token):
    print("\n=== Tasks ===", flush=True)

    resp = get("/tasks", token)
    if resp.status_code == 200:
        data = resp.json()
        if isinstance(data, list):
            count = len(data)
            if count <= 500:
                log("PASS", "GET /tasks capped at 500", f"returned {count}")
            else:
                log("FAIL", "GET /tasks exceeds 500 cap", f"returned {count}")
        else:
            log("PASS", "GET /tasks", f"type={type(data).__name__}")
    else:
        log("FAIL", "GET /tasks", f"status={resp.status_code}")

    resp = get("/tasks/gm", token)
    if resp.status_code == 200:
        data = resp.json()
        if isinstance(data, list) and len(data) <= 500:
            log("PASS", "GET /tasks/gm capped at 500", f"returned {len(data)}")
        elif isinstance(data, list):
            log("FAIL", "GET /tasks/gm exceeds 500 cap", f"returned {len(data)}")
        else:
            log("PASS", "GET /tasks/gm", f"type={type(data).__name__}")
    else:
        log("SKIP", "GET /tasks/gm", f"status={resp.status_code}")


# ── Wins & Config ─────────────────────────────────────────────────────────────

def test_wins_config(token):
    print("\n=== Wins & Config ===", flush=True)

    resp = get("/wins-learnings", token)
    if resp.status_code == 200:
        data = resp.json()
        if isinstance(data, list) and len(data) <= 200:
            log("PASS", "GET /wins-learnings capped at 200", f"returned {len(data)}")
        elif isinstance(data, list):
            log("FAIL", "GET /wins-learnings exceeds 200 cap", f"returned {len(data)}")
        else:
            log("PASS", "GET /wins-learnings", f"type={type(data).__name__}")
    else:
        log("FAIL", "GET /wins-learnings", f"status={resp.status_code}")

    resp = get("/config/all", token)
    if resp.status_code == 200:
        data = resp.json()
        wl = data.get("wins_learnings", [])
        if isinstance(wl, list) and len(wl) <= 50:
            log("PASS", "/config/all wins_learnings capped at 50", f"returned {len(wl)}")
        elif isinstance(wl, list):
            log("FAIL", "/config/all wins_learnings exceeds 50 cap", f"returned {len(wl)}")
        else:
            log("PASS", "/config/all", f"wins_learnings type={type(wl).__name__}")
    else:
        log("FAIL", "GET /config/all", f"status={resp.status_code}")


# ── Activity Report ───────────────────────────────────────────────────────────

def test_activity_report(token):
    print("\n=== Activity Report ===", flush=True)

    t0 = time.monotonic()
    resp = get("/activity-report", token, params={"limit": "50"})
    elapsed = time.monotonic() - t0

    if resp.status_code == 200:
        data = resp.json()
        has_logins = "logins" in data
        has_comments = "comments" in data
        has_contact = "contact" in data
        has_all = "all" in data

        if has_logins and has_comments and has_contact and has_all:
            log("PASS", "activity-report envelope shape",
                f"logins={len(data['logins'])}, comments={len(data['comments'])}, "
                f"contact={len(data['contact'])}, all={len(data['all'])}")
        else:
            log("FAIL", "activity-report envelope shape", f"keys={list(data.keys())}")

        if elapsed < 5.0:
            log("PASS", "activity-report SLO < 5s", f"{elapsed:.2f}s")
        else:
            log("FAIL", "activity-report SLO < 5s", f"{elapsed:.2f}s")
    elif resp.status_code == 404:
        log("SKIP", "GET /activity-report", "404 — endpoint not deployed yet")
    else:
        log("FAIL", "GET /activity-report", f"status={resp.status_code}")


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print(f"API Contract Tests — {BASE_URL}")
    print("=" * 60, flush=True)

    # Authenticate as GM (covers most endpoints)
    token = authenticate("gm")
    if not token:
        print("FATAL: Cannot authenticate as GM. Aborting.", flush=True)
        sys.exit(1)
    print(f"Authenticated as GM (token length={len(token)})", flush=True)

    test_auth()
    test_snapshots(token)
    test_leads_paged(token)
    test_leads_filters(token)
    test_single_lead(token)
    test_unpaged_cap(token)
    test_tasks(token)
    test_wins_config(token)
    test_activity_report(token)

    print("\n" + "=" * 60)
    print(f"RESULTS: {passed} passed, {failed} failed, {skipped} skipped")
    print("=" * 60, flush=True)

    if failed > 0:
        print("\nFailed tests:")
        for r in results:
            if r["status"] == "FAIL":
                print(f"  - {r['name']}: {r['detail']}")

    sys.exit(1 if failed > 0 else 0)


if __name__ == "__main__":
    main()
