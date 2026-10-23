from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import event, inspect, text
from sqlalchemy.exc import IntegrityError, OperationalError

from sns.database import database_path, readonly_engine, writable_engine
from sns.main import ERROR, create_app
from sns.posts import current_time, display_time
from sns.seed import SEED_POSTS, seed_posts, validate_posts

NOW = datetime(2026, 10, 23, 12, tzinfo=UTC)
CONFIG = Path(__file__).resolve().parents[1] / "alembic.ini"


@pytest.fixture
def database(tmp_path, monkeypatch):
    path = tmp_path / "sns.db"
    monkeypatch.setenv("SNS_DATABASE_PATH", str(path))
    command.upgrade(Config(str(CONFIG)), "head")
    engine = writable_engine(path)
    yield path, engine
    engine.dispose()


def client_for(path):
    app = create_app(path)
    app.dependency_overrides[current_time] = lambda: NOW
    return TestClient(app)


def test_migration_and_seed_repeat(database):
    path, engine = database
    seed_posts(engine, now=NOW)
    command.upgrade(Config(str(CONFIG)), "head")
    seed_posts(engine, now=NOW)
    with engine.connect() as conn:
        assert conn.scalar(text("SELECT count(*) FROM posts")) == 3
        assert conn.scalar(text("SELECT version_num FROM alembic_version")) == "0001"
        assert [
            row.post_id
            for row in conn.execute(
                text("SELECT post_id FROM posts ORDER BY posted_at DESC, post_id DESC")
            )
        ] == [3, 2, 1]
        assert "AUTOINCREMENT" in conn.scalar(
            text("SELECT sql FROM sqlite_master WHERE name='posts'")
        )
        assert {c["name"] for c in inspect(conn).get_columns("posts")} == {
            "post_id",
            "author",
            "body",
            "posted_at",
            "reply_count",
            "retweet_count",
            "like_count",
        }
        assert (
            inspect(conn).get_indexes("posts")[0]["name"]
            == "ix_posts_posted_at_post_id"
        )
    with engine.begin() as conn:
        conn.execute(text("UPDATE posts SET body='保持する本文' WHERE post_id=1"))
    seed_posts(engine, now=NOW)
    with engine.connect() as conn:
        assert (
            conn.scalar(text("SELECT body FROM posts WHERE post_id=1"))
            == "保持する本文"
        )
    with client_for(path) as client:
        response = client.get("/posts?limit=1")
        assert response.status_code == 200
        assert [p["post_id"] for p in response.json()] == [3, 2, 1]
        assert response.headers["cache-control"] == "no-store"
        assert response.headers["content-type"] == "application/json"
        assert set(response.json()[0]) == {
            "post_id",
            "author",
            "body",
            "posted_at",
            "reply_count",
            "retweet_count",
            "like_count",
            "displayed_at",
        }
        assert response.json()[0]["displayed_at"] == "1日"
        assert datetime.fromisoformat(
            response.json()[0]["posted_at"]
        ).utcoffset() == timedelta(0)
        assert client.get("/").status_code == client.get("/health").status_code == 404
        spec = client.get("/openapi.json").json()
        assert set(spec["paths"]) == {"/posts"}
        assert (
            spec["paths"]["/posts"]["get"]["responses"]["200"]["content"][
                "application/json"
            ]["schema"]["type"]
            == "array"
        )
        assert "500" in spec["paths"]["/posts"]["get"]["responses"]


def test_empty_and_readonly(database):
    path, _ = database
    with client_for(path) as client:
        assert client.get("/posts").json() == []
    reader = readonly_engine(path)
    with reader.connect() as conn, pytest.raises(OperationalError):
        conn.execute(
            text(
                "INSERT INTO posts(author,body,posted_at) VALUES ('A','B','2026-01-01 00:00:00.000000')"
            )
        )
    reader.dispose()


@pytest.mark.parametrize("problem", ["missing", "unmigrated", "future", "invalid_date"])
def test_error_response(database, tmp_path, problem, caplog):
    path, engine = database
    if problem == "missing":
        path = tmp_path / "missing.db"
    elif problem == "unmigrated":
        path = tmp_path / "empty.db"
        path.touch()
    else:
        seed_posts(engine, now=NOW)
        with engine.begin() as conn:
            conn.execute(
                text("UPDATE posts SET posted_at=:value WHERE post_id=2"),
                {
                    "value": "2026-10-24 12:00:00.000000"
                    if problem == "future"
                    else "not-a-date"
                },
            )
    with client_for(path) as client:
        response = client.get("/posts")
    assert response.status_code == 500
    assert response.json() == ERROR.model_dump()
    assert response.headers["cache-control"] == "no-store"
    assert "PRC-002" in caplog.text
    assert "not-a-date" not in caplog.text
    if problem == "missing":
        assert not path.exists()


@pytest.mark.parametrize(
    "seconds,expected",
    [
        (0, "たった今"),
        (59, "たった今"),
        (60, "1分"),
        (3599, "59分"),
        (3600, "1時間"),
        (86399, "23時間"),
        (86400, "1日"),
        (604799, "6日"),
        (604800, "2026/10/16"),
    ],
)
def test_display_boundaries(seconds, expected):
    assert display_time(NOW - timedelta(seconds=seconds), NOW) == expected


def test_japan_day_boundary_and_future():
    assert display_time(datetime(2026, 10, 1, 18, tzinfo=UTC), NOW) == "2026/10/02"
    with pytest.raises(ValueError):
        display_time(NOW + timedelta(microseconds=1), NOW)


@pytest.mark.parametrize("column", ["author", "body"])
@pytest.mark.parametrize("invalid", ["", " \u3000\t\n\r\v\f", None])
def test_text_constraints(database, column, invalid):
    _, engine = database
    with engine.begin() as conn, pytest.raises(IntegrityError):
        conn.execute(
            text(
                "INSERT INTO posts(author,body,posted_at) VALUES (:author,:body,:posted_at)"
            ),
            {
                "author": "A",
                "body": "B",
                "posted_at": "2026-10-20 12:00:00.000000",
                column: invalid,
            },
        )


@pytest.mark.parametrize("column", ["reply_count", "retweet_count", "like_count"])
@pytest.mark.parametrize("invalid", [-1, 1.5, None])
def test_count_constraints(database, column, invalid):
    _, engine = database
    with engine.begin() as conn, pytest.raises(IntegrityError):
        conn.execute(
            text(
                f"INSERT INTO posts(author,body,posted_at,{column}) VALUES ('A','B','2026-10-20 12:00:00.000000',:value)"
            ),
            {"value": invalid},
        )


def test_autoincrement_and_date_storage(database):
    _, engine = database
    seed_posts(engine, now=NOW)
    with engine.begin() as conn:
        assert (
            conn.scalar(text("SELECT typeof(posted_at) FROM posts LIMIT 1")) == "text"
        )
        assert (
            conn.scalar(text("SELECT posted_at FROM posts WHERE post_id=1"))
            == "2026-10-20 12:00:00.000000"
        )
        conn.execute(text("DELETE FROM posts WHERE post_id=3"))
        conn.execute(
            text(
                "INSERT INTO posts(author,body,posted_at) VALUES ('A','本文'||char(10)||'改行','2026-10-20 12:00:00.000000')"
            )
        )
        assert conn.scalar(text("SELECT MAX(post_id) FROM posts")) == 4
        assert (
            conn.scalar(text("SELECT body FROM posts WHERE post_id=4")) == "本文\n改行"
        )


def test_seed_validation_and_rollback(database):
    _, engine = database
    for changed in [
        {"body": " \u3000\n"},
        {"reply_count": True},
        {"like_count": -1},
        {"posted_at": "2026-10-24T00:00:00+00:00"},
        {"posted_at": "2026-10-20T12:00:00"},
    ]:
        with pytest.raises(ValueError):
            validate_posts([{**SEED_POSTS[0], **changed}], NOW)
    with engine.begin() as conn:
        conn.exec_driver_sql(
            "CREATE TRIGGER reject_seed BEFORE INSERT ON posts WHEN NEW.post_id=2 BEGIN SELECT RAISE(ABORT, 'test failure'); END"
        )
    with pytest.raises(IntegrityError):
        seed_posts(engine, now=NOW)
    with engine.connect() as conn:
        assert conn.scalar(text("SELECT count(*) FROM posts")) == 0


def test_session_returned_after_success_and_failure(database):
    path, engine = database
    app = create_app(path)
    app.dependency_overrides[current_time] = lambda: NOW
    counts = {"checkout": 0, "checkin": 0}
    for name in counts:

        def record(*args, name=name):
            counts[name] += 1

        event.listen(app.state.engine, name, record)
    with TestClient(app) as client:
        assert client.get("/posts").status_code == 200
        with engine.begin() as conn:
            conn.execute(text("DROP TABLE posts"))
        assert client.get("/posts").status_code == 500
    assert counts["checkout"] == counts["checkin"] == 2


def test_database_path_requires_absolute(monkeypatch):
    monkeypatch.setenv("SNS_DATABASE_PATH", "relative.db")
    with pytest.raises(ValueError):
        database_path()
