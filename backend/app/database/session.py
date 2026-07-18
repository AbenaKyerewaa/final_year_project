import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

# Ensure environment variables are loaded
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./easybiz.db")

# Convert various postgres/postgresql schemes to postgresql+psycopg2:// to ensure
# psycopg2 driver is used (handles sslmode correctly and works out-of-the-box on Render/Neon)
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg2://", 1)
elif DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg2://", 1)
elif DATABASE_URL.startswith("postgresql+"):
    parts = DATABASE_URL.split("://", 1)
    DATABASE_URL = "postgresql+psycopg2://" + parts[1]

is_sqlite = DATABASE_URL.startswith("sqlite")

# SQLite needs check_same_thread=False for FastAPI concurrency
connect_args = {}
if is_sqlite:
    connect_args["check_same_thread"] = False

engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    """FastAPI dependency to yield a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
