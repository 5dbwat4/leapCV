from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import settings

engine = create_engine(
    settings.db_url,
    connect_args={"check_same_thread": False} if settings.db_url.startswith("sqlite") else {},
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def ensure_schema_upgrades():
    """轻量迁移：为已存在的 SQLite 表补齐新增列（create_all 不会改旧表结构）。"""
    from sqlalchemy import inspect, text

    inspector = inspect(engine)
    if "resumes" not in inspector.get_table_names():
        return
    columns = {c["name"] for c in inspector.get_columns("resumes")}
    migrations = {
        "structured_json": "ALTER TABLE resumes ADD COLUMN structured_json TEXT",
        "file_path": "ALTER TABLE resumes ADD COLUMN file_path VARCHAR(255)",
        "thumb_path": "ALTER TABLE resumes ADD COLUMN thumb_path VARCHAR(255)",
        "file_size": "ALTER TABLE resumes ADD COLUMN file_size INTEGER",
    }
    missing = [sql for col, sql in migrations.items() if col not in columns]
    if missing:
        with engine.begin() as conn:
            for sql in missing:
                conn.execute(text(sql))
