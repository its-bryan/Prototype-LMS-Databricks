"""
Admin Upload Flow Test — testadmin@hertz.com
Simulates the full UI flow via HTTP (login → navigate → upload → monitor).
All output streams to terminal. Watch the Simple Browser for the live UI state.

Usage:
    .venv/bin/python scripts/test_upload_flow.py
"""

import sys
import time
import json
import threading
import requests
from datetime import datetime
from pathlib import Path

BASE_URL   = "http://localhost:8000"
FRONT_URL  = "http://localhost:5173"
EMAIL      = "testadmin@hertz.com"
PASSWORD   = "Admin123!"
HLES_FILE  = Path(__file__).parent.parent / "prodfiles" / "All IR Detail 2026.03.16 (1).xlsx"
LOG_FILE   = Path("/tmp/fastapi_upload_test.log")

SEP  = "=" * 62
SEP2 = "-" * 62

def ts():
    return datetime.now().strftime("%H:%M:%S")

def log(msg, prefix=""):
    print(f"[{ts()}] {prefix}{msg}", flush=True)

SESSION = requests.Session()

def req(method, path, token=None, json_body=None, files=None, form=None):
    """HTTP request wrapper using requests library."""
    url = BASE_URL + path
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    try:
        if json_body is not None:
            resp = SESSION.request(method, url, json=json_body, headers=headers, timeout=600)
        elif files is not None:
            resp = SESSION.request(method, url, files=files, data=form or {}, headers=headers, timeout=600)
        else:
            resp = SESSION.request(method, url, headers=headers, timeout=600)
        return resp.status_code, resp.json()
    except requests.exceptions.Timeout:
        return 0, {"error": "timed out"}
    except Exception as ex:
        return 0, {"error": str(ex)}


def tail_log(stop_event):
    """Stream new lines from the FastAPI log file into terminal."""
    if not LOG_FILE.exists():
        return
    with open(LOG_FILE, "r") as f:
        f.seek(0, 2)  # jump to end
        while not stop_event.is_set():
            line = f.readline()
            if line:
                stripped = line.rstrip()
                # Filter to interesting lines only
                if any(k in stripped for k in [
                    "[upload]", "[snapshot]", "[observatory]", "[days_open]",
                    "ERROR", "error", "Exception", "POST /api/upload",
                    "ingestion", "newLeads", "failed"
                ]):
                    print(f"  📋 LOG  {stripped}", flush=True)
            else:
                time.sleep(0.3)


def run():
    print(f"\n{SEP}", flush=True)
    print("  HLES Upload Flow Test — testadmin@hertz.com", flush=True)
    print(f"  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", flush=True)
    print(SEP, flush=True)

    # ── Step 1: Health check ──────────────────────────────────────────
    log("Step 1 — Backend health check", "🔍 ")
    status, body = req("GET", "/api/health/runtime")
    if status != 200:
        log(f"❌ Backend not healthy (HTTP {status})", "   ")
        sys.exit(1)
    log(f"✅ Backend healthy: env={body.get('env')} db={body.get('db')}", "   ")

    # ── Step 2: Login ─────────────────────────────────────────────────
    print(SEP2, flush=True)
    log(f"Step 2 — Login as {EMAIL}", "🔐 ")
    status, body = req("POST", "/api/auth/login", json_body={"email": EMAIL, "password": PASSWORD})
    if status != 200 or "token" not in body:
        log(f"❌ Login failed (HTTP {status}): {body}", "   ")
        sys.exit(1)
    token = body["token"]
    user  = body.get("user", {})
    log(f"✅ Logged in — role={user.get('role')} name={user.get('displayName')}", "   ")
    log(f"   Token: {token[:40]}…", "   ")

    # ── Step 3: Verify /admin/uploads page is accessible ─────────────
    print(SEP2, flush=True)
    log("Step 3 — Navigate to Admin › Uploads (GET /api/upload/history)", "📂 ")
    status, history = req("GET", "/api/upload/history", token=token)
    if status != 200:
        log(f"❌ Could not load upload history (HTTP {status})", "   ")
    else:
        log(f"✅ Upload history loaded — {len(history)} past uploads", "   ")
        if history:
            last = history[0]
            hles = last.get("hles") or {}
            log(f"   Last upload: {last.get('created_at')} | "
                f"status={hles.get('ingestion_status')} | "
                f"newLeads={hles.get('newLeads')} updated={hles.get('updated')}", "   ")

    log(f"   (Simple Browser: {FRONT_URL}/admin/uploads — check it now!)", "   ")

    # ── Step 4: Read the HLES file ────────────────────────────────────
    print(SEP2, flush=True)
    log(f"Step 4 — Reading HLES file: {HLES_FILE.name}", "📄 ")
    if not HLES_FILE.exists():
        log(f"❌ File not found: {HLES_FILE}", "   ")
        sys.exit(1)
    file_bytes = HLES_FILE.read_bytes()
    log(f"✅ File loaded — {len(file_bytes)/1024/1024:.1f} MB", "   ")

    # ── Step 5: Submit upload ─────────────────────────────────────────
    print(SEP2, flush=True)
    log("Step 5 — Submitting HLES upload (POST /api/upload/hles)", "⬆  ")
    log("   This parses the Excel, upserts leads, and queues background jobs…", "   ")

    stop_log = threading.Event()
    log_thread = threading.Thread(target=tail_log, args=(stop_log,), daemon=True)
    log_thread.start()

    t0 = time.time()
    status, body = req(
        "POST", "/api/upload/hles", token=token,
        files={"file": (HLES_FILE.name, file_bytes,
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        form={"uploaded_by": EMAIL},
    )
    elapsed = time.time() - t0

    if status not in (200, 201):
        log(f"❌ Upload failed (HTTP {status}): {body}", "   ")
        stop_log.set()
        sys.exit(1)

    log(f"✅ Upload request complete in {elapsed:.1f}s", "   ")
    log(f"   rowsParsed={body.get('rowsParsed')}  newLeads={body.get('newLeads')}  "
        f"updated={body.get('updated')}  failed={body.get('failed')}", "   ")
    upload_id = body.get("uploadId")
    log(f"   uploadId={upload_id}  ingestion_status={body.get('ingestion_status')}", "   ")

    # ── Step 6: Poll ingestion status ─────────────────────────────────
    print(SEP2, flush=True)
    log("Step 6 — Polling ingestion status (background jobs)…", "⏳ ")
    log("   Background: compute_snapshot → observatory_snapshot → refresh_days_open", "   ")

    if upload_id:
        for attempt in range(120):   # up to 4 minutes
            time.sleep(2)
            s2, b2 = req("GET", f"/api/upload/ingestion-status/{upload_id}", token=token)
            state = b2.get("state", "unknown")
            elapsed2 = time.time() - t0
            log(f"   [{elapsed2:.0f}s] state={state}", "   ")
            if state == "success":
                log(f"✅ Ingestion complete in {elapsed2:.0f}s total!", "   ")
                break
            elif state == "failed":
                log(f"❌ Ingestion FAILED: {b2.get('error')}", "   ")
                break
        else:
            log("⚠  Timed out waiting for ingestion (>4 min)", "   ")

    stop_log.set()
    time.sleep(1)   # let tail_log flush last lines

    # ── Step 7: Verify final upload history ───────────────────────────
    print(SEP2, flush=True)
    log("Step 7 — Verifying final upload history", "✅ ")
    status, history = req("GET", "/api/upload/history", token=token)
    if status == 200 and history:
        last = history[0]
        hles = last.get("hles") or {}
        log(f"   Latest upload record:", "   ")
        log(f"     created_at     : {last.get('created_at')}", "   ")
        log(f"     ingestion_status: {hles.get('ingestion_status')}", "   ")
        log(f"     rowsParsed     : {hles.get('rowsParsed')}", "   ")
        log(f"     newLeads       : {hles.get('newLeads')}", "   ")
        log(f"     updated        : {hles.get('updated')}", "   ")
        log(f"     failed         : {hles.get('failed')}", "   ")
        log(f"     filename       : {hles.get('filename')}", "   ")
        log(f"     uploaded_by    : {hles.get('uploaded_by')}", "   ")
        err = hles.get('ingestion_error')
        if err:
            log(f"     ❌ ingestion_error: {err}", "   ")

    total = time.time() - t0
    print(SEP, flush=True)
    log(f"Upload flow test complete. Total time: {total:.0f}s", "🏁 ")
    print(SEP + "\n", flush=True)


if __name__ == "__main__":
    run()
