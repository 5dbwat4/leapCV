from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent  # backend/
DATA_DIR = BASE_DIR / "data"
CV_DIR = DATA_DIR / "cv"        # 上传的简历原件
THUMB_DIR = DATA_DIR / "thumb"  # 简历首页缩略图


class Settings(BaseSettings):
    """应用配置：全部可通过 backend/.env 覆盖。"""

    jwt_secret: str = "dev-secret-change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_days: int = 7

    # OpenAI 兼容接口：智谱 / DeepSeek / Kimi / Qwen / OpenAI 均可
    llm_base_url: str = "https://open.bigmodel.cn/api/paas/v4"
    llm_api_key: str = ""
    llm_model: str = "glm-4.6"
    # 单次调用 token 上限（思维模型建议调大）
    llm_max_tokens: int = 16000
    # 思维模型（Qwen3 等）：False 时首次尝试用 chat_template_kwargs 关闭思考，
    # 端点不支持该参数时会自动在后续重试中去掉
    llm_enable_thinking: bool = False
    # 置 1 后管线返回内置演示数据，不调用大模型
    mock_mode: bool = False

    db_url: str = f"sqlite:///{(DATA_DIR / 'app.db').as_posix()}"

    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()

# 演示模式：显式开启 mock，或未配置任何 API Key
MOCK = settings.mock_mode or not settings.llm_api_key.strip()
