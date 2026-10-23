from datetime import UTC, datetime

from sqlalchemy.dialects.sqlite import insert
from sqlalchemy.orm import Session

from .database import database_path, writable_engine
from .models import BLANK_CHARACTERS, PostRecord

SEED_POSTS = [
    {
        "post_id": 1,
        "author": "ユーザーA",
        "body": "サンプルの投稿です。",
        "posted_at": "2026-10-20T12:00:00+00:00",
        "reply_count": 2,
        "retweet_count": 1,
        "like_count": 5,
    },
    {
        "post_id": 2,
        "author": "ユーザーB",
        "body": "動作確認用の投稿です。",
        "posted_at": "2026-10-22T10:00:00+00:00",
        "reply_count": 0,
        "retweet_count": 0,
        "like_count": 1,
    },
    {
        "post_id": 3,
        "author": "ユーザーC",
        "body": "同じ投稿日時の確認用です。",
        "posted_at": "2026-10-22T10:00:00+00:00",
        "reply_count": 0,
        "retweet_count": 0,
        "like_count": 1,
    },
]


def validate_posts(rows: list[dict], now: datetime) -> list[dict]:
    ids = set()
    result = []
    for row in rows:
        if type(row["post_id"]) is not int or row["post_id"] in ids:
            raise ValueError("invalid_post_id")
        ids.add(row["post_id"])
        for column in ("author", "body"):
            if not isinstance(row[column], str) or not row[column].strip(
                BLANK_CHARACTERS
            ):
                raise ValueError("blank_text")
        for column in ("reply_count", "retweet_count", "like_count"):
            if type(row[column]) is not int or row[column] < 0:
                raise ValueError("invalid_count")
        posted_at = datetime.fromisoformat(row["posted_at"])
        if posted_at.tzinfo is None or posted_at.utcoffset() is None or posted_at > now:
            raise ValueError("invalid_posted_at")
        result.append(
            {**row, "posted_at": posted_at.astimezone(UTC).replace(tzinfo=None)}
        )
    return result


def seed_posts(engine, rows: list[dict] | None = None, now: datetime | None = None):
    values = validate_posts(
        SEED_POSTS if rows is None else rows, now or datetime.now(UTC)
    )
    with Session(engine) as session, session.begin():
        for row in values:
            session.execute(
                insert(PostRecord)
                .values(**row)
                .on_conflict_do_nothing(index_elements=["post_id"])
            )


def main():
    path = database_path()
    if not path.is_file():
        raise SystemExit("先に alembic upgrade head を実行してください。")
    engine = writable_engine(path)
    try:
        seed_posts(engine)
    except Exception as error:  # noqa: BLE001 - 境界で全失敗を機密情報なしの応答に変換する。
        raise SystemExit(f"PRC-004 failed type={type(error).__name__}") from None
    finally:
        engine.dispose()
    print("シードの投入が完了しました（同一IDはスキップ）。")


if __name__ == "__main__":
    main()
