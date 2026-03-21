import argparse
import json
import os
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path


def _git_sha() -> str:
    try:
        return (
            subprocess.check_output(["git", "rev-parse", "HEAD"], text=True)
            .strip()
        )
    except Exception:
        return os.getenv("GIT_COMMIT", "unknown")


def _request_json(url: str, method: str = "GET", headers: dict | None = None, body=None):
    req = urllib.request.Request(url=url, method=method, headers=headers or {})
    if body is not None:
        payload = json.dumps(body).encode("utf-8")
        req.add_header("Content-Type", "application/json")
        req.data = payload
    with urllib.request.urlopen(req, timeout=30) as response:
        raw = response.read()
        return response.status, json.loads(raw.decode("utf-8")) if raw else None


def _check_endpoint(name: str, url: str, headers: dict):
    try:
        status, payload = _request_json(url, headers=headers)
        ok = 200 <= status < 300
        return {"name": name, "ok": ok, "status": status, "error": None, "payload": payload}
    except urllib.error.HTTPError as exc:
        return {"name": name, "ok": False, "status": exc.code, "error": exc.reason, "payload": None}
    except Exception as exc:  # pragma: no cover
        return {"name": name, "ok": False, "status": None, "error": str(exc), "payload": None}


def main() -> int:
    parser = argparse.ArgumentParser(description="LMS smoke tests.")
    parser.add_argument("--target", choices=["local", "staging", "prod"], required=True)
    parser.add_argument("--base-url", default=None, help="API base host, e.g. https://app.domain")
    parser.add_argument("--email", default=os.getenv("SMOKE_TEST_EMAIL"))
    parser.add_argument("--password", default=os.getenv("SMOKE_TEST_PASSWORD"))
    parser.add_argument("--read-only", action="store_true")
    args = parser.parse_args()

    if args.target == "local":
        base_url = (args.base_url or "http://localhost:8000").rstrip("/")
    else:
        if not args.base_url:
            print("--base-url is required for staging/prod.")
            return 1
        base_url = args.base_url.rstrip("/")

    read_only = args.read_only or args.target == "prod"
    token = None
    headers = {}

    if args.email and args.password:
        try:
            _, login_payload = _request_json(
                f"{base_url}/api/auth/login",
                method="POST",
                body={"email": args.email, "password": args.password},
            )
            token = login_payload.get("token") if login_payload else None
            if token:
                headers["Authorization"] = f"Bearer {token}"
        except Exception as exc:
            print(f"[smoke] login failed: {exc}")
            return 1
    else:
        print("[smoke] SMOKE_TEST_EMAIL/SMOKE_TEST_PASSWORD not set; running unauthenticated checks only.")

    checks = [
        ("auth.me", f"{base_url}/api/auth/me"),
        ("leads.paged", f"{base_url}/api/leads?paged=1&limit=20&offset=0"),
        ("tasks.paged", f"{base_url}/api/tasks?paged=1&limit=20&offset=0"),
        ("upload.history", f"{base_url}/api/upload/history"),
        ("snapshot.dashboard", f"{base_url}/api/dashboard-snapshot"),
        ("snapshot.observatory", f"{base_url}/api/observatory-snapshot"),
        ("config.all", f"{base_url}/api/config/all"),
        ("health.runtime", f"{base_url}/api/health/runtime"),
    ]

    results = []
    for name, url in checks:
        result = _check_endpoint(name, url, headers=headers)
        results.append(result)
        print(f"[smoke] {name}: {'PASS' if result['ok'] else 'FAIL'} ({result['status']})")

    runtime = next((r for r in results if r["name"] == "health.runtime"), None)
    runtime_ok = bool(runtime and runtime["ok"] and runtime["payload"])
    if runtime_ok and runtime["payload"].get("tier") != args.target:
        runtime["ok"] = False
        runtime["error"] = f"tier mismatch: expected {args.target}, got {runtime['payload'].get('tier')}"
        print(f"[smoke] health.runtime: FAIL ({runtime['error']})")

    passed = all(r["ok"] for r in results)
    summary = {
        "target": args.target,
        "baseUrl": base_url,
        "readOnly": read_only,
        "passed": passed,
        "commitSha": _git_sha(),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "results": results,
    }

    artifact_dir = Path("release")
    artifact_dir.mkdir(exist_ok=True)
    artifact = artifact_dir / f"smoke_{args.target}_{summary['commitSha'][:12]}.json"
    artifact.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(f"[smoke] artifact: {artifact}")

    if passed and args.target == "staging":
        gate = artifact_dir / f"staging_passed_{summary['commitSha']}.json"
        gate.write_text(json.dumps(summary, indent=2), encoding="utf-8")
        print(f"[smoke] staging gate artifact: {gate}")

    return 0 if passed else 1


if __name__ == "__main__":
    sys.exit(main())
