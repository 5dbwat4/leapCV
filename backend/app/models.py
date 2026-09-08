from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(128))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    resumes = relationship("Resume", back_populates="user", cascade="all, delete-orphan")
    optimizations = relationship("Optimization", back_populates="user", cascade="all, delete-orphan")


class Resume(Base):
    __tablename__ = "resumes"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    filename: Mapped[str] = mapped_column(String(255), default="粘贴的简历")
    raw_text: Mapped[str] = mapped_column(Text)
    # 文件上传相关：粘贴文本创建的简历三项均为 NULL
    file_path: Mapped[str | None] = mapped_column(String(255), default=None)   # 相对 data/ 目录，如 cv/<uuid>.pdf
    thumb_path: Mapped[str | None] = mapped_column(String(255), default=None)  # 如 thumb/<uuid>.png，仅 PDF 生成
    file_size: Mapped[int | None] = mapped_column(Integer, default=None)       # 原始文件字节数
    # 结构化解析结果（JSON 字符串），首次在"我的简历"页查看时按需解析并缓存
    structured_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    user = relationship("User", back_populates="resumes")


class Optimization(Base):
    __tablename__ = "optimizations"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    resume_id: Mapped[int] = mapped_column(ForeignKey("resumes.id"))
    target_position: Mapped[str] = mapped_column(String(100), default="")
    jd_text: Mapped[str] = mapped_column(Text)
    result_json: Mapped[str] = mapped_column(Text)
    match_score: Mapped[int] = mapped_column(Integer, default=0)
    is_mock: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    user = relationship("User", back_populates="optimizations")
    resume = relationship("Resume")
