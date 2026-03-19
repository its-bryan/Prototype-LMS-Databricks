import os
from fastapi import FastAPI
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from routers import leads, tasks, config, upload, directives, wins, snapshot, auth, observatory

app = FastAPI(title="Hertz LMS API")
app.add_middleware(GZipMiddleware, minimum_size=1000)

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
