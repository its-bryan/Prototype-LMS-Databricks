"""
UI Upload Test — testadmin@hertz.com
Simulates an admin user logging in and uploading the HLES IR Details file.
Runs in headed (visible) mode so you can watch the process.
"""

import time
import os
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

BASE_URL = "http://localhost:5173"
EMAIL = "testadmin@hertz.com"
PASSWORD = "Admin123!"
HLES_FILE = str(Path(__file__).parent.parent / "prodfiles" / "All IR Detail 2026.03.16 (1).xlsx")

SCREENSHOTS_DIR = Path(__file__).parent.parent / "scripts" / "upload_test_screenshots"
SCREENSHOTS_DIR.mkdir(exist_ok=True)


def shot(page, name):
    path = str(SCREENSHOTS_DIR / f"{name}.png")
    page.screenshot(path=path)
    print(f"  📸 Screenshot: {name}.png", flush=True)


def run():
    print("\n" + "="*60, flush=True)
    print("HLES Upload UI Test — testadmin@hertz.com", flush=True)
    print("="*60, flush=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=False,
            slow_mo=600,   # 600ms between actions — visible to observer
            args=["--start-maximized"],
        )
        ctx = browser.new_context(
            viewport={"width": 1440, "height": 900},
            record_video_dir=str(SCREENSHOTS_DIR),
        )
        page = ctx.new_page()

        # ── 1. Navigate to login page ──────────────────────────────────
        print("\n[1] Navigating to login page…", flush=True)
        page.goto(BASE_URL, wait_until="networkidle")
        shot(page, "01_login_page")

        # ── 2. Fill login form ─────────────────────────────────────────
        print("[2] Entering credentials…", flush=True)
        page.get_by_label("Email", exact=False).fill(EMAIL)
        page.get_by_label("Password", exact=False).fill(PASSWORD)
        shot(page, "02_credentials_entered")

        # ── 3. Click Sign In ───────────────────────────────────────────
        print("[3] Clicking Sign In…", flush=True)
        page.get_by_role("button", name="Sign In").click()
        page.wait_for_load_state("networkidle")
        time.sleep(1)
        shot(page, "03_post_login")
        print(f"    URL after login: {page.url}", flush=True)

        # ── 4. Navigate to Admin Uploads ───────────────────────────────
        print("[4] Navigating to Admin → Uploads…", flush=True)
        # Try clicking nav link first; fall back to direct URL
        try:
            # Look for "Uploads" link in sidebar/nav
            uploads_link = page.locator("a[href*='upload'], a[href*='/admin/upload']").first
            if uploads_link.is_visible(timeout=3000):
                uploads_link.click()
            else:
                page.goto(f"{BASE_URL}/admin/uploads", wait_until="networkidle")
        except Exception:
            page.goto(f"{BASE_URL}/admin/uploads", wait_until="networkidle")

        page.wait_for_load_state("networkidle")
        time.sleep(1)
        shot(page, "04_uploads_page")
        print(f"    URL: {page.url}", flush=True)

        # ── 5. Locate the HLES upload area ────────────────────────────
        print("[5] Looking for HLES upload area…", flush=True)

        # Find the file input for HLES — try several selectors
        file_input = None
        selectors_to_try = [
            "input[type='file'][accept*='xlsx']",
            "input[type='file'][accept*='xls']",
            "input[type='file']",
        ]
        for sel in selectors_to_try:
            try:
                fi = page.locator(sel).first
                if fi.count() > 0:
                    file_input = fi
                    print(f"    Found file input: {sel}", flush=True)
                    break
            except Exception:
                pass

        if not file_input:
            print("    ⚠ Could not find file input — check screenshot 04_uploads_page.png", flush=True)
            shot(page, "04b_no_file_input")
            browser.close()
            return

        # ── 6. Set the file ────────────────────────────────────────────
        print(f"[6] Setting file: {os.path.basename(HLES_FILE)}", flush=True)
        print(f"    Size: {os.path.getsize(HLES_FILE) / 1024 / 1024:.1f} MB", flush=True)
        file_input.set_input_files(HLES_FILE)
        time.sleep(1.5)
        shot(page, "05_file_selected")

        # ── 7. Click Upload / Submit ──────────────────────────────────
        print("[7] Submitting upload…", flush=True)
        upload_btn = None
        btn_names = ["Upload", "Submit", "Upload HLES", "Process", "Confirm"]
        for btn_name in btn_names:
            try:
                btn = page.get_by_role("button", name=btn_name, exact=False)
                if btn.is_visible(timeout=2000):
                    upload_btn = btn
                    print(f"    Found button: '{btn_name}'", flush=True)
                    break
            except Exception:
                pass

        if not upload_btn:
            # Try any enabled button near the file input
            try:
                upload_btn = page.locator("button[type='submit']").first
                if upload_btn.count() == 0:
                    upload_btn = page.locator("button").filter(has_text="upload|Upload|Submit").first
            except Exception:
                pass

        if upload_btn and upload_btn.is_visible():
            upload_btn.click()
            print("    Upload submitted — waiting for response…", flush=True)
        else:
            print("    ⚠ Could not find upload button — check screenshot 05_file_selected.png", flush=True)
            shot(page, "05b_no_upload_btn")

        # ── 8. Monitor upload progress ────────────────────────────────
        print("[8] Monitoring upload progress…", flush=True)
        shot(page, "06_upload_in_progress")

        # Poll for up to 5 minutes watching for status changes
        start = time.time()
        last_text = ""
        for _ in range(150):  # 150 × 2s = 5 minutes
            page.wait_for_load_state("networkidle", timeout=5000)
            # Capture any status/progress text visible on page
            try:
                body_text = page.locator("body").inner_text()
                # Print only if something meaningful changed
                for keyword in ["success", "Success", "error", "Error", "failed", "Failed",
                                "complete", "Complete", "rows", "leads", "ingestion",
                                "in_progress", "processing", "Processing"]:
                    if keyword.lower() in body_text.lower() and body_text[:300] != last_text[:300]:
                        elapsed = time.time() - start
                        print(f"    [{elapsed:.0f}s] Page state: {body_text[:200].strip()[:120]}", flush=True)
                        last_text = body_text
                        break
            except Exception:
                pass

            # Check for success/error indicators
            success_sel = "[data-status='success'], .upload-success, [class*='success']"
            error_sel = "[data-status='error'], .upload-error, [class*='error']"
            try:
                if page.locator(success_sel).is_visible(timeout=500):
                    print("    ✅ Success indicator found on page!", flush=True)
                    shot(page, "07_upload_success")
                    break
            except Exception:
                pass
            try:
                if page.locator(error_sel).is_visible(timeout=500):
                    error_text = page.locator(error_sel).first.inner_text()
                    print(f"    ❌ Error indicator: {error_text}", flush=True)
                    shot(page, "07_upload_error")
                    break
            except Exception:
                pass

            time.sleep(2)
        else:
            elapsed = time.time() - start
            print(f"    ⏱ Monitor timed out after {elapsed:.0f}s", flush=True)

        shot(page, "08_final_state")
        print(f"\n    Final URL: {page.url}", flush=True)
        print(f"\n📂 Screenshots saved to: {SCREENSHOTS_DIR}", flush=True)

        # Keep browser open for 8s so user can see result
        print("\nKeeping browser open for 8 seconds…", flush=True)
        time.sleep(8)
        ctx.close()
        browser.close()

    print("\n" + "="*60, flush=True)
    print("Upload UI test complete.", flush=True)
    print("="*60 + "\n", flush=True)


if __name__ == "__main__":
    run()
