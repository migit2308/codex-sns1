from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Index, Integer, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base

BLANK_CHARACTERS = " \u3000\t\n\r\v\f"
SQL_BLANK_CHARACTERS = (
    "char(32) || char(12288) || char(9) || char(10) || char(13) || char(11) || char(12)"
)


class PostRecord(Base):
    __tablename__ = "posts"
    __table_args__ = (
        *(
            CheckConstraint(
                f"typeof({column}) = 'text' AND "
                f"length(trim({column}, {SQL_BLANK_CHARACTERS})) > 0",
                name=f"ck_posts_{column}_not_blank",
            )
            for column in ("author", "body")
        ),
        CheckConstraint("typeof(posted_at) = 'text'", name="ck_posts_posted_at_text"),
        *(
            CheckConstraint(
                f"typeof({column}) = 'integer' AND {column} >= 0",
                name=f"ck_posts_{column}_nonnegative",
            )
            for column in ("reply_count", "retweet_count", "like_count")
        ),
        {"sqlite_autoincrement": True},
    )

    post_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    author: Mapped[str] = mapped_column(Text, nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    posted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False), nullable=False
    )
    reply_count: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default=text("0")
    )
    retweet_count: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default=text("0")
    )
    like_count: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default=text("0")
    )


Index(
    "ix_posts_posted_at_post_id", PostRecord.posted_at.desc(), PostRecord.post_id.desc()
)
