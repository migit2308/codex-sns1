import os
import sqlite3
from pathlib import Path

from sqlalchemy import URL, create_engine
from sqlalchemy.orm import DeclarativeBase

BACKEND_DIR = Path(__file__).resolve().parents[2]


class Base(DeclarativeBase):
    pass


def database_path() -> Path:
    configured = os.environ.get("SNS_DATABASE_PATH")
    if configured:
        path = Path(configured)
        if not path.is_absolute():
            raise ValueError("SNS_DATABASE_PATHには絶対パスを指定してください。")
        return path
    return BACKEND_DIR / "data" / "sns.db"


def writable_engine(path: Path):
    # ディレクトリの作成は明示的な準備コマンドだけが行う。
    return create_engine(URL.create("sqlite+pysqlite", database=str(path)))


def readonly_engine(path: Path):
    def connect():
        return sqlite3.connect(
            path.as_uri() + "?mode=ro", uri=True, check_same_thread=False
        )

    return create_engine("sqlite+pysqlite://", creator=connect)
