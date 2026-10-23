from datetime import UTC, datetime
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import PostRecord
from .schemas import Post


def current_time() -> datetime:
    return datetime.now(UTC)


def display_time(posted_at: datetime, now: datetime) -> str:
    seconds = (now - posted_at).total_seconds()
    if seconds < 0:
        raise ValueError("future_posted_at")
    if seconds < 60:
        return "たった今"
    if seconds < 3600:
        return f"{int(seconds // 60)}分"
    if seconds < 86400:
        return f"{int(seconds // 3600)}時間"
    if seconds < 604800:
        return f"{int(seconds // 86400)}日"
    return posted_at.astimezone(ZoneInfo("Asia/Tokyo")).strftime("%Y/%m/%d")


def read_posts(session: Session, now: datetime) -> list[Post]:
    records = session.scalars(
        select(PostRecord).order_by(
            PostRecord.posted_at.desc(), PostRecord.post_id.desc()
        )
    )
    posts = []
    for record in records:
        # DateTimeのSQLite保存値には時差情報がない。保存時のUTC規約で復元する。
        posted_at = record.posted_at.replace(tzinfo=UTC)
        posts.append(
            Post(
                post_id=record.post_id,
                author=record.author,
                body=record.body,
                posted_at=posted_at,
                reply_count=record.reply_count,
                retweet_count=record.retweet_count,
                like_count=record.like_count,
                displayed_at=display_time(posted_at, now),
            )
        )
    return posts
