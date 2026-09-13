"""
main.py — FastAPI application entry point
Phase 3 will populate this with ML inference endpoints.
For now it boots the app and confirms DB connectivity.
"""
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from app.core.database import test_connection

app = FastAPI(
    title="Dynamic Train ETA — AI Inference API",
    description="FastAPI backend for ML ETA prediction, simulator control, and LangChain RAG.",
    version="0.1.0",
)

# Allow all origins during development (tighten for production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    ok = test_connection()
    if ok:
        print("  ✅  FastAPI connected to PostgreSQL.")
    else:
        print("  ❌  FastAPI could NOT connect to PostgreSQL. Check .env.")


@app.get("/health", tags=["Health"])
def health_check():
    """Liveness probe — used by Node.js gateway to verify Python service is up."""
    return {"status": "ok", "service": "backend-python", "phase": "Phase 2 (Simulator Ready)"}
