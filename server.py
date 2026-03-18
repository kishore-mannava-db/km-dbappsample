"""Lakebase OLTP Evaluation Track — Entry point: FastAPI + serves React build."""
import os
import sys
import logging

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from starlette.middleware.cors import CORSMiddleware

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "app"))

from main import app as backend_app

app = FastAPI(title="Lakebase OLTP Evaluation", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
app.include_router(backend_app.router)

# Serve React build
BUILD_PATHS = [
    os.path.join(os.path.dirname(__file__), "frontend", "build"),
    os.path.join(os.path.dirname(__file__), "build"),
]

build_dir = None
for path in BUILD_PATHS:
    if os.path.exists(path) and os.path.isfile(os.path.join(path, "index.html")):
        build_dir = path
        logger.info(f"Found React build at: {build_dir}")
        break

if build_dir:
    static_dir = os.path.join(build_dir, "static")
    if os.path.exists(static_dir):
        app.mount("/static", StaticFiles(directory=static_dir), name="static")

    @app.get("/")
    async def serve_root():
        return FileResponse(os.path.join(build_dir, "index.html"))

    @app.get("/{path:path}")
    async def serve_frontend(path: str):
        if path.startswith("api/") or path in ("health", "docs", "openapi.json", "redoc"):
            return None
        file_path = os.path.join(build_dir, path)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(build_dir, "index.html"))
else:
    logger.warning("No React build found. Running in API-only mode.")

    @app.get("/")
    async def root():
        return {"service": "Lakebase OLTP Evaluation Track", "docs": "/docs", "eval": "/api/eval/full-report"}
