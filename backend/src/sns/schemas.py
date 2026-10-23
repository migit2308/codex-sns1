from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, StrictInt, StrictStr


class Post(BaseModel):
    model_config = ConfigDict(extra="forbid")

    post_id: StrictInt
    author: StrictStr
    body: StrictStr
    posted_at: datetime
    reply_count: StrictInt = Field(ge=0)
    retweet_count: StrictInt = Field(ge=0)
    like_count: StrictInt = Field(ge=0)
    displayed_at: StrictStr


class ErrorResponse(BaseModel):
    code: str
    message: str
