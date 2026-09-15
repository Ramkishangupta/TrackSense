"""
backend-python/app/rag/agent.py
================================
Phase 6 — AI Operations Copilot (Text-to-SQL RAG Agent)

PURPOSE:
  Creates a LangChain SQL agent connected to the eta_sih_db PostgreSQL
  database.  Station controllers can ask natural-language questions like
  "Which trains are delayed?" and the agent translates that into a SQL query,
  executes it against the *read-only* tables, and returns a human-readable
  answer.

ARCHITECTURE:
  ┌────────────┐     ┌──────────────┐     ┌──────────────┐
  │ User Query │ ──▶ │ Groq LLM     │ ──▶ │ SQL Agent    │
  │ (NL text)  │     │ (Llama 3.1)  │     │ (LangChain)  │
  └────────────┘     └──────────────┘     └──────┬───────┘
                                                 │  SQL
                                           ┌─────▼─────┐
                                           │ PostgreSQL │
                                           │ eta_sih_db │
                                           └───────────┘

TABLES EXPOSED (read-only):
  - trains          → static train metadata (12 trains)
  - live_telemetry  → current position, speed, delay, H3 index
  - events_log      → anomaly events (fog, halt, signal, chain_pulling)
  - stations        → station metadata (name, code, lat/lng)
  - routes          → train-to-station mapping with distances

SAFETY:
  - The SQLDatabase wrapper is initialized with include_tables to limit
    exposure to only the 5 tables above.
  - The system prompt explicitly forbids DROP, DELETE, UPDATE, INSERT, ALTER.
  - Agent type is "tool-calling" — uses the modern LangChain ReAct loop.

LLM PROVIDER:
  - Uses Groq (free tier) with the llama-3.1-8b-instant model for
    ultra-fast inference (~200ms response times).
  - Configurable via GROQ_API_KEY in .env.
"""

from __future__ import annotations

import os
from typing import Optional

from langchain_community.utilities import SQLDatabase
from langchain_community.agent_toolkits import create_sql_agent
from langchain_groq import ChatGroq

# ---------------------------------------------------------------------------
# CONFIGURATION
# ---------------------------------------------------------------------------

# Tables the agent is allowed to see / query.
ALLOWED_TABLES = [
    "trains",
    "live_telemetry",
    "events_log",
    "stations",
    "routes",
]

# System prompt injected into the agent — establishes the persona,
# domain knowledge, and safety guardrails.
SYSTEM_PREFIX = """You are TrackSense AI Copilot — a railway operations assistant 
for the Indian Railways Dynamic ETA Prediction System.

You have access to a PostgreSQL database with live train telemetry and event data.

IMPORTANT RULES:
1. You are READ-ONLY. NEVER generate DROP, DELETE, UPDATE, INSERT, ALTER, 
   TRUNCATE, or CREATE statements. Only use SELECT queries.
2. Always limit your result sets (use LIMIT) to avoid returning excessive rows.
3. When asked about delays, use the `delay_minutes` column in `live_telemetry`.
4. When asked about speed, use `current_speed` from `live_telemetry`.
5. When asked about events or anomalies, query `events_log` where is_active = TRUE.
6. Train names and numbers are in the `trains` table. Join with `live_telemetry` 
   using `trains.id = live_telemetry.train_id`.
7. Station info is in `stations` table (code, name, lat, lng). 
   Route info is in `routes` table (train_id, station_id, station_sequence, distance_from_start).
8. Format your final answer as a clear, concise response. Use bullet points 
   or tables when listing multiple items.
9. When showing delay data, mention the train number and name alongside the delay.
10. If a query asks about something not in the database, say so politely.

TABLE SCHEMA HINTS:
- trains: id, train_no, name, train_type (Rajdhani/Shatabdi/Superfast/Mail/Express/Intercity/Passenger)
- live_telemetry: train_id, current_lat, current_lng, current_speed, delay_minutes, h3_index, recorded_at
- events_log: train_id, event_type (weather_fog/unscheduled_halt/signal_halt/chain_pulling), 
  severity, description, is_active, created_at
- stations: id, name, code, lat, lng
- routes: train_id, station_id, station_sequence, distance_from_start
"""


# ---------------------------------------------------------------------------
# AGENT FACTORY
# ---------------------------------------------------------------------------

_agent = None  # Module-level singleton


def _build_agent():
    """
    Build the LangChain SQL Agent using Groq LLM + PostgreSQL.
    Lazily constructed on first call, then cached.
    """
    groq_key = os.getenv("GROQ_API_KEY", "")
    if not groq_key:
        raise EnvironmentError(
            "GROQ_API_KEY is not set. Add it to backend-python/.env"
        )

    db_url = os.getenv("DATABASE_URL", "")
    if not db_url:
        raise EnvironmentError(
            "DATABASE_URL is not set. Add it to backend-python/.env"
        )

    # ── LLM — Groq (Qwen 3.8 27B — best available text model) ─────────
    llm = ChatGroq(
        api_key=groq_key,
        model_name="qwen/qwen3.8-27b",
        temperature=0,            # Deterministic SQL generation
        max_tokens=1024,
    )

    # ── SQLDatabase wrapper (read-only, limited tables) ─────────────────
    db = SQLDatabase.from_uri(
        db_url,
        include_tables=ALLOWED_TABLES,
        sample_rows_in_table_info=3,   # Show 3 sample rows in schema prompt
    )

    # ── SQL Agent (modern "tool-calling" ReAct loop) ────────────────────
    agent = create_sql_agent(
        llm=llm,
        db=db,
        agent_type="tool-calling",    # Modern LangChain agent loop
        verbose=True,                  # Logs agent steps to console (demo)
        prefix=SYSTEM_PREFIX,
        handle_parsing_errors=True,    # Gracefully recover from LLM issues
        max_iterations=8,              # Prevent infinite loops
        top_k=20,                      # Limit SELECT results to 20 rows
    )

    return agent


def get_agent():
    """Return the cached SQL agent singleton."""
    global _agent
    if _agent is None:
        _agent = _build_agent()
    return _agent


# ---------------------------------------------------------------------------
# PUBLIC API — called by the FastAPI route
# ---------------------------------------------------------------------------

def ask_copilot(query: str) -> dict:
    """
    Process a natural-language question through the SQL agent.

    Args:
        query: The user's question in plain English.

    Returns:
        dict with keys:
            - query:    The original question.
            - response: The agent's natural-language answer.
            - error:    Error message if something went wrong.
    """
    try:
        agent = get_agent()
        result = agent.invoke({"input": query})

        return {
            "query":    query,
            "response": result.get("output", "I couldn't generate a response."),
            "error":    None,
        }

    except Exception as e:
        print(f"  [RAG Agent] Error: {e}")
        return {
            "query":    query,
            "response": None,
            "error":    str(e),
        }
