from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, StrictInt, StrictStr, field_validator

from .models import BLANK_CHARACTERS


class CreatedPost(BaseModel):
    model_config = ConfigDict(extra="forbid")

    post_id: StrictInt
    author: StrictStr
    body: StrictStr
    posted_at: datetime
    reply_count: StrictInt = Field(ge=0)
    retweet_count: StrictInt = Field(ge=0)
    like_count: StrictInt = Field(ge=0)


class Post(CreatedPost):
    displayed_at: StrictStr


class ErrorResponse(BaseModel):
    code: str
    message: str


class PostCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    body: StrictStr = Field(min_length=1, max_length=280)

    @field_validator("body")
    @classmethod
    def not_blank(cls, value: str) -> str:
        if not value.strip(BLANK_CHARACTERS):
            raise ValueError("blank_body")
        return value
