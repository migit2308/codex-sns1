import logging
from collections.abc import Callable
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path
from typing import Annotated

from fastapi import Depends, FastAPI, Request, Response
from fastapi import Path as PathParameter
from fastapi.exception_handlers import request_validation_exception_handler
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from .database import database_path, post_engine, readonly_engine
from .posts import create_post, current_time, read_post, read_posts
from .schemas import CreatedPost, ErrorResponse, Post, PostCreate, PostDetail

logger = logging.getLogger(__name__)
ERROR = ErrorResponse(
    code="POST_LIST_FETCH_FAILED", message="投稿一覧を取得できませんでした。"
)


VALIDATION_ERROR = ErrorResponse(
    code="POST_VALIDATION_FAILED",
    message="投稿本文は空白のみを除く1〜280文字で入力してください。",
)
CREATE_ERROR = ErrorResponse(
    code="POST_CREATE_FAILED", message="投稿を保存できませんでした。"
)
NOT_FOUND = ErrorResponse(code="POST_NOT_FOUND", message="投稿が見つかりません")
DETAIL_ERROR = ErrorResponse(
    code="POST_DETAIL_FETCH_FAILED", message="投稿詳細を取得できませんでした。"
)


def post_clock() -> Callable[[], datetime]:
    # 呼出自体は入力検証が成功したハンドラー内で行う。
    return current_time


def detail_clock() -> Callable[[], datetime]:
    return current_time


def error_response(error: ErrorResponse, status_code: int) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content=error.model_dump(),
        headers={"Cache-Control": "no-store"},
    )


def create_app(path: Path | None = None) -> FastAPI:
    resolved_path = path if path is not None else database_path()
    engine = readonly_engine(resolved_path)
    writer = post_engine(resolved_path)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        yield
        engine.dispose()
        writer.dispose()

    app = FastAPI(title="codex-sns1 API", version="1.2.0", lifespan=lifespan)
    app.state.engine = engine
    app.state.write_engine = writer

    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, error: RequestValidationError):
        if request.method == "POST" and request.url.path == "/posts":
            return error_response(VALIDATION_ERROR, 422)
        response = await request_validation_exception_handler(request, error)
        if (
            request.method == "GET"
            and getattr(request.scope.get("route"), "path", None) == "/posts/{post_id}"
        ):
            response.headers["Cache-Control"] = "no-store"
        return response

    @app.get(
        "/posts/{post_id}",
        response_model=PostDetail,
        summary="投稿詳細を取得する",
        operation_id="get_post",
        responses={
            status: {
                **({"model": ErrorResponse} if status in (404, 500) else {}),
                **(
                    {
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "required": ["detail"],
                                    "properties": {
                                        "detail": {
                                            "type": "array",
                                            "items": {"type": "object"},
                                        }
                                    },
                                }
                            }
                        }
                    }
                    if status == 422
                    else {}
                ),
                "headers": {
                    "Cache-Control": {
                        "schema": {"type": "string"},
                        "example": "no-store",
                    }
                },
            }
            for status in (200, 404, 422, 500)
        },
    )
    def get_post(
        post_id: Annotated[int, PathParameter(ge=1)],
        clock: Annotated[Callable[[], datetime], Depends(detail_clock)],
    ):
        try:
            now = clock()
            with Session(engine) as session:
                post = read_post(session, post_id, now)
                if post is None:
                    return error_response(NOT_FOUND, 404)
                # 応答の変換失敗も同じ境界で扱い、セッションを確実に閉じる。
                return JSONResponse(
                    content=post.model_dump(mode="json"),
                    headers={"Cache-Control": "no-store"},
                )
        except Exception as error:  # noqa: BLE001 - 単件取得の失敗を固定応答にする。
            logger.error("PRC-008 failed type=%s", type(error).__name__)
            return error_response(DETAIL_ERROR, 500)

    @app.post(
        "/posts",
        response_model=CreatedPost,
        status_code=201,
        summary="投稿本文を保存する",
        operation_id="create_post",
        responses={
            status: {
                **({"model": ErrorResponse} if status != 201 else {}),
                "headers": {
                    "Cache-Control": {
                        "schema": {"type": "string"},
                        "example": "no-store",
                    }
                },
            }
            for status in (201, 422, 500)
        },
    )
    def post_posts(
        payload: PostCreate,
        request: Request,
        clock: Annotated[Callable[[], datetime], Depends(post_clock)],
    ):
        if (
            request.headers.get("content-type", "").split(";")[0].strip().lower()
            != "application/json"
        ):
            return error_response(VALIDATION_ERROR, 422)
        try:
            now = clock()
            with Session(writer) as session, session.begin():
                created = create_post(session, payload, now)
                # JSON化もコミット前に完了する。確定後の再取得・変換は行わない。
                response = JSONResponse(
                    status_code=201,
                    content=created.model_dump(mode="json"),
                    headers={"Cache-Control": "no-store"},
                )
            return response
        except Exception as error:  # noqa: BLE001 - API境界で保存失敗を固定応答にする。
            logger.error("PRC-006 failed type=%s", type(error).__name__)
            return error_response(CREATE_ERROR, 500)

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
