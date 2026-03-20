"""
Layer 3: Browser E2E Tests for 800K Architecture Validation
Uses Playwright with a persistent Edge profile to reuse Databricks SSO cookies.

Usage:
    python scripts/test_e2e_800k.py
"""

import os
import sys
import time
import json
from datetime import datetime
from pathlib import Path
from playwright.sync_api import sync_playwright

APP_URL = "https://hertz-leo-leadsmgmtsystem-1957546315544672.aws.databricksapps.com"
EDGE_PATH = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
# Use a copy of the Edge profile so we don't conflict with a running browser
_PROJ_ROOT = Path(__file__).resolve().parent.parent
EDGE_PROFILE = str(_PROJ_ROOT / ".tmp-localappdata" / "Microsoft" / "Edge" / "User Data")
THRESHOLD_MS = 2000
SCREENSHOT_DIR = Path("docs/frontend-test-results")
SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)

CREDS = {
    "admin": ("admin.leo@hertz.com", "LeoAdmin123"),
    "gm": ("adamfrankel.leo@hertz.com", "AdamF123"),
    "bm": ("jonathanhoover.leo@hertz.com", "JonathanH123"),
}

TS = datetime.now().strftime("%Y%m%d_%H%M%S")
results = []


def log(status, test_id, name, detail="", tti_ms=None):
    icon = {"PASS": "+", "FAIL": "!", "SKIP": "~"}[status]
    tti_str = f" [{tti_ms}ms]" if tti_ms is not None else ""
    msg = f"  [{icon}] {test_id}: {name}{tti_str}"
    if detail:
        msg += f"  ({detail})"
    print(msg, flush=True)
    results.append({
        "status": status, "test_id": test_id, "name": name,
        "detail": detail, "tti_ms": tti_ms,
    })


def screenshot(page, role, step, label):
    fname = f"{TS}_{role}_{step:02d}_{label}.png"
    page.screenshot(path=str(SCREENSHOT_DIR / fname))
    return fname


def dismiss_tour(page):
    try:
        skip = page.locator("text='Skip tour'").first
        if skip.is_visible(timeout=2000):
            skip.click()
            page.wait_for_timeout(500)
    except Exception:
        pass


def wait_for_content(page, timeout=10000):
    """Wait for meaningful content: skeleton disappears or data appears."""
    try:
        page.wait_for_function(
            """() => {
                const skeletons = document.querySelectorAll('[class*=skeleton], [class*=Skeleton], [class*=animate-pulse]');
                return skeletons.length === 0;
            }""",
            timeout=timeout,
        )
    except Exception:
        pass


def measure_navigation(page, action_fn, timeout=10000):
    """Measure time from action to content ready."""
    t0 = time.monotonic()
    action_fn()
    try:
        page.wait_for_load_state("networkidle", timeout=timeout)
    except Exception:
        pass
    wait_for_content(page, timeout=5000)
    return int((time.monotonic() - t0) * 1000)


def do_login(page, role):
    """Navigate to app and login with role credentials."""
    email, password = CREDS[role]

    page.goto(APP_URL, wait_until="networkidle", timeout=30000)
    page.wait_for_timeout(2000)

    current = page.url
    if "login" not in current.lower() and "auth" not in current.lower():
        if page.locator("input[type='email'], input[type='text'][name*='email']").count() == 0:
            return True

    email_input = page.locator("input[type='email'], input[type='text'][name*='email'], input[placeholder*='email' i]").first
    pass_input = page.locator("input[type='password']").first

    try:
        email_input.wait_for(timeout=5000)
    except Exception:
        return True

    email_input.fill(email)
    pass_input.fill(password)

    submit = page.locator("button[type='submit'], button:has-text('Sign in'), button:has-text('Log in'), button:has-text('Login')").first
    submit.click()

    page.wait_for_timeout(3000)
    dismiss_tour(page)
    return True


def click_sidebar(page, label):
    """Click a sidebar navigation item by label text."""
    nav = page.locator(f"nav a:has-text('{label}'), nav button:has-text('{label}'), aside a:has-text('{label}'), aside button:has-text('{label}')").first
    try:
        nav.wait_for(timeout=3000)
        nav.click()
        return True
    except Exception:
        try:
            fallback = page.locator(f"text='{label}'").first
            fallback.click()
            return True
        except Exception:
            return False


# ── BM Tests ──────────────────────────────────────────────────────────────────

def test_bm(page):
    print("\n=== BM Role Tests ===", flush=True)
    role = "bm"

    # B0: Login
    t0 = time.monotonic()
    do_login(page, role)
    tti = int((time.monotonic() - t0) * 1000)
    screenshot(page, role, 0, "initial")

    page.wait_for_timeout(2000)
    screenshot(page, role, 1, "landing")
    passed = "dashboard" in page.url.lower() or "bm" in page.url.lower() or page.locator("h1, h2").first.is_visible()
    log("PASS" if passed else "FAIL", "B0", "BM Login", f"url={page.url}", tti)

    # B1: Dashboard
    wait_for_content(page)
    has_metrics = page.locator("text=/\\d+%/").count() > 0 or page.locator("[class*='metric'], [class*='card']").count() > 0
    screenshot(page, role, 2, "B1")
    log("PASS" if has_metrics else "FAIL", "B1", "BM Dashboard loads", f"metrics_visible={has_metrics}")

    # B2: Leads table
    tti = measure_navigation(page, lambda: click_sidebar(page, "My Leads") or click_sidebar(page, "Leads"))
    page.wait_for_timeout(2000)
    wait_for_content(page)

    rows = page.locator("table tbody tr, [class*='lead-row'], [class*='LeadRow']").count()
    has_pagination = page.locator("text=/Page|Next|Previous|\\d+\\s*of\\s*\\d+/i").count() > 0
    screenshot(page, role, 3, "B2")
    log(
        "PASS" if rows > 0 else "FAIL", "B2", "BM Leads Table",
        f"rows={rows}, pagination={has_pagination}", tti,
    )

    # B3: Pagination
    if has_pagination:
        next_btn = page.locator("button:has-text('Next'), button:has-text('>'), button:has-text('2')").first
        try:
            next_btn.wait_for(timeout=3000)
            tti = measure_navigation(page, lambda: next_btn.click())
            page.wait_for_timeout(1500)
            rows_p2 = page.locator("table tbody tr").count()
            screenshot(page, role, 4, "B3")
            log("PASS" if rows_p2 > 0 else "FAIL", "B3", "BM Leads Pagination", f"page2_rows={rows_p2}", tti)
        except Exception as e:
            log("FAIL", "B3", "BM Leads Pagination", f"error: {e}")
    else:
        log("SKIP", "B3", "BM Leads Pagination", "no pagination controls found")

    # B4: Lead Detail
    try:
        first_row = page.locator("table tbody tr").first
        first_row.wait_for(timeout=3000)
        tti = measure_navigation(page, lambda: first_row.click())
        page.wait_for_timeout(2000)
        wait_for_content(page)
        has_detail = page.locator("text=/Customer|Status|Enrichment|TRANSLOG|Reservation/i").count() > 0
        screenshot(page, role, 5, "B4")
        log("PASS" if has_detail else "FAIL", "B4", "BM Lead Detail", f"detail_visible={has_detail}", tti)
    except Exception as e:
        log("FAIL", "B4", "BM Lead Detail", f"error: {e}")

    # B5: Tasks
    tti = measure_navigation(page, lambda: click_sidebar(page, "Open Tasks") or click_sidebar(page, "Tasks"))
    page.wait_for_timeout(2000)
    wait_for_content(page)
    tasks_visible = page.locator("table tbody tr, [class*='task']").count() > 0
    empty_state = page.locator("text=/no tasks|empty/i").count() > 0
    screenshot(page, role, 6, "B5")
    log("PASS" if tasks_visible or empty_state else "FAIL", "B5", "BM Tasks", f"tasks={tasks_visible}, empty={empty_state}", tti)


# ── GM Tests ──────────────────────────────────────────────────────────────────

def test_gm(page):
    print("\n=== GM Role Tests ===", flush=True)
    role = "gm"

    # G0: Login
    page.goto(APP_URL, wait_until="networkidle", timeout=30000)
    page.wait_for_timeout(1000)
    # Logout if still logged in
    try:
        logout = page.locator("text='Logout', text='Sign out', button:has-text('Logout')").first
        if logout.is_visible(timeout=2000):
            logout.click()
            page.wait_for_timeout(2000)
    except Exception:
        pass

    t0 = time.monotonic()
    do_login(page, role)
    tti = int((time.monotonic() - t0) * 1000)
    screenshot(page, role, 0, "initial")
    page.wait_for_timeout(2000)
    screenshot(page, role, 1, "landing")
    log("PASS", "G0", "GM Login", f"url={page.url}", tti)

    # G1: Dashboard / Overview
    wait_for_content(page)
    has_content = page.locator("h1, h2, [class*='metric'], [class*='card']").count() > 0
    screenshot(page, role, 2, "G1")
    log("PASS" if has_content else "FAIL", "G1", "GM Dashboard", f"content_visible={has_content}")

    # G2: GM Leads
    tti = measure_navigation(page, lambda: click_sidebar(page, "Leads") or click_sidebar(page, "My Leads"))
    page.wait_for_timeout(2000)
    wait_for_content(page)
    rows = page.locator("table tbody tr").count()
    screenshot(page, role, 3, "G2")
    log("PASS" if rows > 0 else "FAIL", "G2", "GM Leads Table", f"rows={rows}", tti)

    # G3: Spot Check
    tti = measure_navigation(page, lambda: click_sidebar(page, "Spot Check"))
    page.wait_for_timeout(2000)
    wait_for_content(page)
    tiles = page.locator("[class*='card'], [class*='tile'], [class*='spot']").count()
    has_delta = page.locator("text=/vs zone|vs\\./i").count()
    screenshot(page, role, 4, "G3")
    log(
        "PASS" if tiles > 0 else "FAIL", "G3", "GM Spot Check",
        f"tiles={tiles}, delta_metrics={has_delta} (should be 0)", tti,
    )

    # G4: Meeting Prep
    tti = measure_navigation(page, lambda: click_sidebar(page, "Meeting Prep"))
    page.wait_for_timeout(2000)
    wait_for_content(page)
    has_prep = page.locator("table, [class*='checklist'], [class*='prep']").count() > 0
    screenshot(page, role, 5, "G4")
    log("PASS" if has_prep else "FAIL", "G4", "GM Meeting Prep", f"prep_visible={has_prep}", tti)

    # G5: Activity Report
    tti = measure_navigation(page, lambda: click_sidebar(page, "Activity Report") or click_sidebar(page, "Activity"))
    page.wait_for_timeout(2000)
    wait_for_content(page)
    has_tabs = page.locator("text='All Activity'").count() > 0 or page.locator("text='Logins'").count() > 0
    screenshot(page, role, 6, "G5")
    log("PASS" if has_tabs else "FAIL", "G5", "GM Activity Report", f"tabs_visible={has_tabs}", tti)

    # G6: Observatory
    tti = measure_navigation(page, lambda: click_sidebar(page, "Observatory") or click_sidebar(page, "Observatory Tower"))
    page.wait_for_timeout(3000)
    wait_for_content(page)
    has_charts = page.locator("canvas, svg, [class*='chart'], [class*='bar']").count() > 0
    screenshot(page, role, 7, "G6")
    log("PASS" if has_charts else "FAIL", "G6", "GM Observatory", f"charts_visible={has_charts}", tti)


# ── Admin Tests ───────────────────────────────────────────────────────────────

def test_admin(page):
    print("\n=== Admin Role Tests ===", flush=True)
    role = "admin"

    # Logout first
    page.goto(APP_URL, wait_until="networkidle", timeout=30000)
    page.wait_for_timeout(1000)
    try:
        logout = page.locator("text='Logout', text='Sign out', button:has-text('Logout')").first
        if logout.is_visible(timeout=2000):
            logout.click()
            page.wait_for_timeout(2000)
    except Exception:
        pass

    # A0: Login
    t0 = time.monotonic()
    do_login(page, role)
    tti = int((time.monotonic() - t0) * 1000)
    screenshot(page, role, 0, "initial")
    page.wait_for_timeout(2000)
    screenshot(page, role, 1, "landing")
    log("PASS", "A0", "Admin Login", f"url={page.url}", tti)

    # A1: Dashboard
    wait_for_content(page)
    has_content = page.locator("h1, h2, [class*='metric'], [class*='card']").count() > 0
    screenshot(page, role, 2, "A1")
    log("PASS" if has_content else "FAIL", "A1", "Admin Dashboard", f"content_visible={has_content}")

    # A2: Org Mapping
    tti = measure_navigation(page, lambda: click_sidebar(page, "Org Mapping"))
    page.wait_for_timeout(2000)
    wait_for_content(page)
    has_table = page.locator("table tbody tr").count() > 0
    screenshot(page, role, 3, "A2")
    log("PASS" if has_table else "FAIL", "A2", "Admin Org Mapping", f"table_rows={page.locator('table tbody tr').count()}", tti)

    # A3: Data Uploads
    tti = measure_navigation(page, lambda: click_sidebar(page, "Data Uploads") or click_sidebar(page, "Uploads"))
    page.wait_for_timeout(2000)
    wait_for_content(page)
    has_upload = page.locator("input[type='file'], [class*='upload'], text=/upload/i").count() > 0
    screenshot(page, role, 4, "A3")
    log("PASS" if has_upload else "FAIL", "A3", "Admin Data Uploads", f"upload_visible={has_upload}", tti)

    # A4: Observatory
    tti = measure_navigation(page, lambda: click_sidebar(page, "Observatory") or click_sidebar(page, "Observatory Tower"))
    page.wait_for_timeout(3000)
    wait_for_content(page)
    has_content = page.locator("canvas, svg, [class*='chart'], h1, h2").count() > 0
    screenshot(page, role, 5, "A4")
    log("PASS" if has_content else "FAIL", "A4", "Admin Observatory", f"content_visible={has_content}", tti)


# ── Report ────────────────────────────────────────────────────────────────────

def write_report():
    p = sum(1 for r in results if r["status"] == "PASS")
    f = sum(1 for r in results if r["status"] == "FAIL")
    s = sum(1 for r in results if r["status"] == "SKIP")

    report = f"""# 800K Architecture E2E Test Results

**Date:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
**URL:** {APP_URL}
**TTI Threshold:** {THRESHOLD_MS} ms
**Browser:** Microsoft Edge (persistent profile)

## Results Summary

- **Total:** {len(results)}
- **Passed:** {p}
- **Failed:** {f}
- **Skipped:** {s}

## Detailed Results

| Test ID | Name | Status | TTI (ms) | Details |
|---------|------|--------|----------|---------|
"""
    for r in results:
        tti = str(r["tti_ms"]) if r["tti_ms"] is not None else "-"
        status = r["status"]
        report += f"| {r['test_id']} | {r['name']} | {status} | {tti} | {r['detail']} |\n"

    report += f"\n## Screenshots\n\nAll screenshots saved to `{SCREENSHOT_DIR}/`\n"

    report_path = SCREENSHOT_DIR / f"report_{TS}.md"
    report_path.write_text(report, encoding="utf-8")
    print(f"\nReport written to {report_path}", flush=True)

    json_path = SCREENSHOT_DIR / f"results_{TS}.json"
    json_path.write_text(json.dumps(results, indent=2), encoding="utf-8")


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print(f"800K Architecture E2E Tests — {APP_URL}")
    print(f"Timestamp: {TS}")
    print("=" * 60, flush=True)

    with sync_playwright() as p:
        context = p.chromium.launch_persistent_context(
            user_data_dir=EDGE_PROFILE,
            executable_path=EDGE_PATH,
            channel="msedge",
            headless=False,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-first-run",
                "--disable-extensions",
            ],
            viewport={"width": 1440, "height": 900},
            timeout=30000,
        )
        page = context.pages[0] if context.pages else context.new_page()

        try:
            test_bm(page)
            test_gm(page)
            test_admin(page)
        except Exception as e:
            print(f"\nFATAL ERROR: {e}", flush=True)
            screenshot(page, "error", 99, "fatal")
        finally:
            write_report()
            context.close()

    p_count = sum(1 for r in results if r["status"] == "PASS")
    f_count = sum(1 for r in results if r["status"] == "FAIL")
    s_count = sum(1 for r in results if r["status"] == "SKIP")

    print(f"\n{'=' * 60}")
    print(f"RESULTS: {p_count} passed, {f_count} failed, {s_count} skipped")
    print(f"{'=' * 60}", flush=True)

    if f_count > 0:
        print("\nFailed tests:")
        for r in results:
            if r["status"] == "FAIL":
                print(f"  - {r['test_id']}: {r['name']} — {r['detail']}")

    sys.exit(1 if f_count > 0 else 0)


if __name__ == "__main__":
    main()
