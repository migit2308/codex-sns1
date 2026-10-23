"""投稿テーブルを作成する。"""

import sqlalchemy as sa
from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    whitespace = "char(32) || char(12288) || char(9) || char(10) || char(13) || char(11) || char(12)"
    op.create_table(
        "posts",
        sa.Column("post_id", sa.Integer(), primary_key=True),
        sa.Column("author", sa.Text(), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("posted_at", sa.DateTime(timezone=False), nullable=False),
        sa.Column(
            "reply_count", sa.Integer(), nullable=False, server_default=sa.text("0")
        ),
        sa.Column(
            "retweet_count", sa.Integer(), nullable=False, server_default=sa.text("0")
        ),
        sa.Column(
            "like_count", sa.Integer(), nullable=False, server_default=sa.text("0")
        ),
        *(
            sa.CheckConstraint(
                f"typeof({column}) = 'text' AND length(trim({column}, {whitespace})) > 0",
                name=f"ck_posts_{column}_not_blank",
            )
            for column in ("author", "body")
        ),
        sa.CheckConstraint(
            "typeof(posted_at) = 'text'", name="ck_posts_posted_at_text"
        ),
        *(
            sa.CheckConstraint(
                f"typeof({column}) = 'integer' AND {column} >= 0",
                name=f"ck_posts_{column}_nonnegative",
            )
            for column in ("reply_count", "retweet_count", "like_count")
        ),
        sqlite_autoincrement=True,
    )
    op.create_index(
        "ix_posts_posted_at_post_id",
        "posts",
        [sa.text("posted_at DESC"), sa.text("post_id DESC")],
    )


def downgrade():
    op.drop_index("ix_posts_posted_at_post_id", table_name="posts")
    op.drop_table("posts")
