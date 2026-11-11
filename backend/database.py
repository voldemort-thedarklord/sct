import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Supports MySQL (e.g. mysql+pymysql://user:pass@localhost:3306/smart_ch)
# and defaults to local SQLite file for zero-config operation.
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "sqlite:///./smart_community_health.db"
)

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
