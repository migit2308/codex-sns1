from pathlib import Path

from sqlalchemy import URL, create_engine
from sqlalchemy.orm import DeclarativeBase

# 起動したディレクトリによらず、同じDBファイルを使用する。
DATABASE_PATH = Path(__file__).resolve().parents[1] / "data" / "sample.db"

engine = create_engine(
    URL.create("sqlite+pysqlite", database=str(DATABASE_PATH))
)


class Base(DeclarativeBase):
    pass
