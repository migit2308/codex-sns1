from sqlalchemy import select
from sqlalchemy.dialects.sqlite import insert
from sqlalchemy.orm import Session

from .database import Base, DATABASE_PATH, engine
from .models import SampleMessage


def initialize_database() -> None:
    DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
    Base.metadata.create_all(engine)

    # 固定IDのサンプルは初回だけ追加する。再実行しても既存データを変更しない。
    with Session(engine) as session, session.begin():
        session.execute(
            insert(SampleMessage)
            .values(id=1, body="Hello SQLite")
            .on_conflict_do_nothing(index_elements=["id"])
        )


def main() -> None:
    try:
        initialize_database()
        print(f"DB: {DATABASE_PATH}")
        with Session(engine) as session:
            for message in session.scalars(
                select(SampleMessage).order_by(SampleMessage.id)
            ):
                print(
                    f"id={message.id}, body={message.body}, "
                    f"created_at={message.created_at} (UTC)"
                )
    finally:
        engine.dispose()


if __name__ == "__main__":
    main()
