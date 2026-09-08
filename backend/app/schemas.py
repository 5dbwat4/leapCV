from datetime import datetime

from pydantic import BaseModel, Field


# ---------- 认证 ----------
class RegisterRequest(BaseModel):
    username: str = Field(min_length=2, max_length=50)
    password: str = Field(min_length=6, max_length=72)


class LoginRequest(BaseModel):
    username: str
    password: str


class UserInfo(BaseModel):
    id: int
    username: str

    model_config = {"from_attributes": True}


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserInfo


# ---------- 简历 ----------
class ResumeOut(BaseModel):
    id: int
    filename: str
    raw_text: str
    file_path: str | None = None
    thumb_path: str | None = None
    file_size: int | None = None
    structured: dict | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ResumeTextRequest(BaseModel):
    raw_text: str = Field(min_length=50, max_length=50000)
    filename: str = Field(default="粘贴的简历", max_length=255)


class ResumeStructuredUpdate(BaseModel):
    structured: dict


# ---------- 优化 ----------
class OptimizeRequest(BaseModel):
    resume_id: int
    jd_text: str = Field(min_length=30, max_length=20000)
    target_position: str = Field(default="", max_length=100)


class HistoryItem(BaseModel):
    id: int
    target_position: str
    match_score: int
    is_mock: bool
    jd_excerpt: str
    created_at: datetime


class HistoryDetail(HistoryItem):
    resume_id: int
    jd_text: str
    result: dict
