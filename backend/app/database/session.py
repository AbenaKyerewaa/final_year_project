import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

# Ensure environment variables are loaded
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./easybiz.db")

# Convert standard postgresql:// to postgresql+pg8000:// for pg8000 driver
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+pg8000://", 1)

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
