import os
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from routers import leads, tasks, config, upload, directives, wins, snapshot, auth, observatory, feedback
from db import get_runtime_context

app = FastAPI(title="Hertz LMS API")
app.add_middleware(GZipMiddleware, minimum_size=1000)


def _trace_id_from_request(request: Request | None) -> str:
    if request is None:
        return "unknown-trace"
    return getattr(request.state, "trace_id", None) or request.headers.get("x-request-id") or "unknown-trace"


def _http_error_code(status_code: int, detail) -> str:
    detail_text = str(detail).lower()
    if status_code == 401:
        if "expired" in detail_text:
            return "TOKEN_EXPIRED"
        if "invalid" in detail_text:
            return "TOKEN_INVALID"
        if "not authenticated" in detail_text or "unauthorized" in detail_text:
            return "TOKEN_MISSING"
        return "UNAUTHORIZED"
    if status_code == 403:
        return "FORBIDDEN"
    if status_code == 404:
        return "NOT_FOUND"
    if status_code == 409:
        return "CONFLICT"
    if status_code in (400, 422):
        return "VALIDATION_FAILED"
    if status_code >= 500:
        return "INTERNAL_ERROR"
    return "UNKNOWN_ERROR"


@app.middleware("http")
async def add_trace_id(request: Request, call_next):
    trace_id = request.headers.get("x-request-id") or str(uuid4())
    request.state.trace_id = trace_id
    response = await call_next(request)
    response.headers["X-Request-ID"] = trace_id
    print(f"[request] trace_id={trace_id} {request.method} {request.url.path} -> {response.status_code}", flush=True)
    return response


@app.exception_handler(HTTPException)
async def handle_http_exception(request: Request, exc: HTTPException):
    trace_id = _trace_id_from_request(request)
    code = _http_error_code(exc.status_code, exc.detail)
    message = exc.detail if isinstance(exc.detail, str) else "Request failed"
    payload = {
        "error": {
            "code": code,
            "message": message,
            "traceId": trace_id,
            "retryable": exc.status_code >= 500,
        }
    }
    if not isinstance(exc.detail, str):
        payload["detail"] = exc.detail
    return JSONResponse(status_code=exc.status_code, content=payload)


@app.exception_handler(RequestValidationError)
async def handle_validation_exception(request: Request, exc: RequestValidationError):
    trace_id = _trace_id_from_request(request)
    return JSONResponse(
        status_code=422,
        content={
            "error": {
                "code": "VALIDATION_FAILED",
                "message": "Validation failed",
                "traceId": trace_id,
                "retryable": False,
            },
            "detail": exc.errors(),
        },
    )


@app.exception_handler(Exception)
async def handle_unexpected_exception(request: Request, exc: Exception):
    trace_id = _trace_id_from_request(request)
    print(f"[error] trace_id={trace_id} unhandled exception: {exc}", flush=True)
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "INTERNAL_ERROR",
                "message": "Unexpected server error",
                "traceId": trace_id,
                "retryable": True,
            }
        },
    )


@app.on_event("startup")
async def log_runtime_context():
    ctx = get_runtime_context()
    print(
        f"[startup] env={ctx['env']} tier={ctx['tier']} host={ctx['host']} db={ctx['db']}",
        flush=True,
    )
    # Warm the connection pool so background ingest tasks don't block on first-use pool init
    from db import _ensure_pool
    _ensure_pool().wait()
    print("[startup] DB connection pool warmed", flush=True)

# API routes — auth first (no DB-token dependency)
app.include_router(auth.router, prefix="/api")
app.include_router(leads.router, prefix="/api")
app.include_router(tasks.router, prefix="/api")
app.include_router(config.router, prefix="/api")
app.include_router(upload.router, prefix="/api")
app.include_router(directives.router, prefix="/api")
app.include_router(wins.router, prefix="/api")
app.include_router(snapshot.router, prefix="/api")
app.include_router(observatory.router, prefix="/api")
app.include_router(feedback.router, prefix="/api")


@app.get("/api/health/runtime")
async def health_runtime(current_user: dict | None = Depends(auth.get_current_user)):
    ctx = get_runtime_context()
    if ctx["tier"] in {"staging", "prod"} and current_user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return {
        "env": ctx["env"],
        "tier": ctx["tier"],
        "host": ctx["host"],
        "db": ctx["db"],
    }

# Serve React static files
app.mount("/assets", StaticFiles(directory="dist/assets"), name="assets")

# SPA fallback — serve static files from dist/ if they exist, otherwise index.html
@app.get("/{path:path}")
async def spa_fallback(path: str):
    if path:
        file_path = os.path.join("dist", path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
    return FileResponse(
        "dist/index.html",
        headers={"Cache-Control": "no-cache, no-store, must-revalidate"},
    )
