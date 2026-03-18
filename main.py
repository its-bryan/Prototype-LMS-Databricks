import os, glob as _glob
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from routers import leads, tasks, config, upload, directives, wins, snapshot, auth

# On startup, remove stale JS/CSS from dist/assets that aren't referenced by index.html
def _cleanup_stale_assets():
    index_path = os.path.join("dist", "index.html")
    if not os.path.isfile(index_path):
        return
    with open(index_path) as f:
        html = f.read()
    assets_dir = os.path.join("dist", "assets")
    if not os.path.isdir(assets_dir):
        return
    for fpath in _glob.glob(os.path.join(assets_dir, "*")):
        fname = os.path.basename(fpath)
        if fname not in html:
            print(f"[startup] removing stale asset: {fname}", flush=True)
            os.remove(fpath)

_cleanup_stale_assets()

app = FastAPI(title="Hertz LMS API")

# Debug endpoint to list what's in dist/assets and index.html references
@app.get("/api/debug/assets")
async def debug_assets():
    assets_dir = os.path.join("dist", "assets")
    files = os.listdir(assets_dir) if os.path.isdir(assets_dir) else []
    index_path = os.path.join("dist", "index.html")
    index_refs = []
    if os.path.isfile(index_path):
        with open(index_path) as f:
            html = f.read()
        import re
        index_refs = re.findall(r'/assets/([^"\'>\s]+)', html)
    return JSONResponse({
        "assets_on_disk": sorted(files),
        "index_html_refs": index_refs,
        "cwd": os.getcwd(),
    })

@app.get("/api/debug/clean-assets")
async def clean_assets():
    """Force-clean stale assets at runtime."""
    index_path = os.path.join("dist", "index.html")
    if not os.path.isfile(index_path):
        return JSONResponse({"error": "no index.html"})
    with open(index_path) as f:
        html = f.read()
    assets_dir = os.path.join("dist", "assets")
    removed = []
    kept = []
    for fpath in _glob.glob(os.path.join(assets_dir, "*")):
        fname = os.path.basename(fpath)
        if fname not in html:
            os.remove(fpath)
            removed.append(fname)
        else:
            kept.append(fname)
    return JSONResponse({"removed": removed, "kept": kept})

# API routes — auth first (no DB-token dependency)
app.include_router(auth.router, prefix="/api")
app.include_router(leads.router, prefix="/api")
app.include_router(tasks.router, prefix="/api")
app.include_router(config.router, prefix="/api")
app.include_router(upload.router, prefix="/api")
app.include_router(directives.router, prefix="/api")
app.include_router(wins.router, prefix="/api")
app.include_router(snapshot.router, prefix="/api")

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
