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


def existing_engine(path: Path, *, readonly: bool):
    def connect():
        return sqlite3.connect(
            path.as_uri() + ("?mode=ro" if readonly else "?mode=rw"),
            uri=True,
            check_same_thread=False,
        )

    return create_engine("sqlite+pysqlite://", creator=connect)


def readonly_engine(path: Path):
    return existing_engine(path, readonly=True)


def post_engine(path: Path):
    """投稿APIでは未作成DBを生成しない。準備用の接続とは区別する。"""
    return existing_engine(path, readonly=False)
