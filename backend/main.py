from typing import Literal

from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="codex-sns1 API", version="0.1.0")


class GreetingResponse(BaseModel):
    message: str


class HealthResponse(BaseModel):
    status: Literal["ok"]


@app.get("/", response_model=GreetingResponse, summary="サンプルの挨拶を返す")
def read_root() -> GreetingResponse:
    return GreetingResponse(message="Hello World")


@app.get("/health", response_model=HealthResponse, summary="APIの起動状態を確認する")
def health_check() -> HealthResponse:
    return HealthResponse(status="ok")
