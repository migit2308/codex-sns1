import logging
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path
from typing import Annotated

from fastapi import Depends, FastAPI, Response
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from .database import database_path, readonly_engine
from .posts import current_time, read_posts
from .schemas import ErrorResponse, Post

logger = logging.getLogger(__name__)
ERROR = ErrorResponse(
    code="POST_LIST_FETCH_FAILED", message="投稿一覧を取得できませんでした。"
)


def create_app(path: Path | None = None) -> FastAPI:
    engine = readonly_engine(path if path is not None else database_path())

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        yield
        engine.dispose()

    app = FastAPI(title="codex-sns1 API", version="1.0.0", lifespan=lifespan)
    app.state.engine = engine

    @app.get(
        "/posts",
        response_model=list[Post],
        summary="投稿一覧を全件取得する",
        operation_id="get_posts",
        responses={
            200: {
                "headers": {
                    "Cache-Control": {
                        "schema": {"type": "string"},
                        "example": "no-store",
                    }
                }
            },
            500: {
                "model": ErrorResponse,
                "description": "投稿一覧の取得失敗",
                "headers": {
                    "Cache-Control": {
                        "schema": {"type": "string"},
                        "example": "no-store",
                    }
                },
            },
        },
    )
    def get_posts(response: Response, now: Annotated[datetime, Depends(current_time)]):
        try:
            with Session(engine) as session:
                posts = read_posts(session, now)
            response.headers["Cache-Control"] = "no-store"
            return posts
        except Exception as error:  # noqa: BLE001 - 境界で全失敗を機密情報なしの応答に変換する。
            # 例外の本文にはSQL・投稿・接続情報が含まれ得るため記録しない。
            logger.error("PRC-002 failed type=%s", type(error).__name__)
            return JSONResponse(
                status_code=500,
                content=ERROR.model_dump(),
                headers={"Cache-Control": "no-store"},
            )

    return app


app = create_app()
