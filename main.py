from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from routers import leads, tasks, config, upload

app = FastAPI(title="Hertz LMS API")

# API routes
app.include_router(leads.router, prefix="/api")
app.include_router(tasks.router, prefix="/api")
app.include_router(config.router, prefix="/api")
app.include_router(upload.router, prefix="/api")

# Serve React static files
app.mount("/assets", StaticFiles(directory="dist/assets"), name="assets")

# SPA fallback — serve index.html for all non-API routes
@app.get("/{path:path}")
async def spa_fallback(path: str):
    return FileResponse("dist/index.html")
