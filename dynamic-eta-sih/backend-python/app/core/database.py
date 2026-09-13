"""
core/database.py
Shared SQLAlchemy engine and session factory for all backend-python services.
Both the Simulator and the FastAPI app import from here.
"""

import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL: str = os.getenv("DATABASE_URL", "")

if not DATABASE_URL:
    raise EnvironmentError(
        "DATABASE_URL is not set. "
        "Copy .env.example to .env and fill in your credentials."
    )

# pool_pre_ping=True: tests connections before use — prevents stale connection errors
# pool_size=5: keep 5 connections alive in the pool
# max_overflow=3: allow up to 3 extra connections under load
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=3,
    echo=False,  # Set True to log all SQL (debugging only — noisy for demo)
)

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


def get_db() -> Session:
    """
    FastAPI dependency that yields a DB session and guarantees cleanup.
    Usage in FastAPI route:
        def my_route(db: Session = Depends(get_db)): ...
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def test_connection() -> bool:
    """Quick connectivity test — call on startup to fail fast if DB is unreachable."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception as e:
        print(f"  ❌  Database connection failed: {e}")
        return False
