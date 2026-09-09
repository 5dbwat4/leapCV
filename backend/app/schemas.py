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


# ---------- 创建简历（问答式） ----------
class CreateEduItem(BaseModel):
    school: str = Field(default="", max_length=100)
    major: str = Field(default="", max_length=100)
    degree: str = Field(default="", max_length=50)
    period: str = Field(default="", max_length=50)
    notes: str = Field(default="", max_length=1000)


class CreateWorkItem(BaseModel):
    company: str = Field(default="", max_length=100)
    position: str = Field(default="", max_length=100)
    period: str = Field(default="", max_length=50)
    highlights: list[str] = Field(default_factory=list, max_length=20)


class CreateProjectItem(BaseModel):
    name: str = Field(default="", max_length=100)
    role: str = Field(default="", max_length=150)
    period: str = Field(default="", max_length=50)
    highlights: list[str] = Field(default_factory=list, max_length=20)


class CreateAnswers(BaseModel):
    """问答向导全部步骤的作答汇总（finish 时一次性提交）。"""

    name: str = Field(default="", max_length=30)
    phone: str = Field(default="", max_length=30)
    email: str = Field(default="", max_length=100)
    city: str = Field(default="", max_length=30)
    intent: str = Field(default="", max_length=60)
    links: str = Field(default="", max_length=200)
    education: list[CreateEduItem] = Field(default_factory=list, max_length=6)
    work: list[CreateWorkItem] = Field(default_factory=list, max_length=10)
    internships: list[CreateWorkItem] = Field(default_factory=list, max_length=10)
    projects: list[CreateProjectItem] = Field(default_factory=list, max_length=10)
    skills: str = Field(default="", max_length=2000)
    awards: str = Field(default="", max_length=1000)
    self_evaluation: str = Field(default="", max_length=1000)


class CreateFieldOut(BaseModel):
    name: str
    label: str
    type: str = "input"
    required: bool = False
    placeholder: str = ""


class CreateStepOut(BaseModel):
    id: str
    index: int
    total: int
    title: str
    prompt: str
    tip: str = ""
    allow_skip: bool = False
    kind: str = "form"  # form | list
    entry_label: str = ""
    fields: list[CreateFieldOut]


class CreateFinishOut(BaseModel):
    resume: ResumeOut
    markdown: str
    polished: bool  # 是否经过 LLM 润色（False = 基线版 / 演示模式）
    pdf_url: str | None = None
    pdf_error: str | None = None


# ---------- 优化 ----------
class OptimizeRequest(BaseModel):
    resume_id: int
    jd_text: str = Field(min_length=30, max_length=20000)
    target_position: str = Field(default="", max_length=100)


class OptimizeAnswerRequest(BaseModel):
    """Quick check 作答：answer 为 None 表示跳过（管线改用占位符）。"""
    run_id: str = Field(min_length=8, max_length=64)
    question_id: str = Field(min_length=1, max_length=64)
    answer: str | None = Field(default=None, max_length=500)


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
