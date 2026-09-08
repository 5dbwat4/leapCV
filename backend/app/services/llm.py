"""OpenAI 兼容 LLM 客户端：带重试与健壮的 JSON 提取。"""

import json
import logging
import re

import httpx2
from openai import OpenAI

from ..config import settings

logger = logging.getLogger("leapcv.llm")

_client: OpenAI | None = None


class LLMError(Exception):
    """LLM 调用或输出解析失败，message 面向用户展示。"""


def get_client() -> OpenAI:
    global _client
    if _client is None:
        # trust_env=False：绕过系统代理，避免本地网关（localhost）请求被代理拦截返回 502
        _client = OpenAI(
            api_key=settings.llm_api_key,
            base_url=settings.llm_base_url,
            timeout=120,
            max_retries=1,
            http_client=httpx2.Client(trust_env=False, timeout=120),
        )
    return _client


def _extract_json(content: str) -> dict:
    """从模型输出中提取 JSON 对象，容忍代码围栏与前后缀文本。"""
    text = content.strip()
    fence = re.search(r"```(?:json)?\s*(.+?)\s*```", text, re.DOTALL)
    if fence:
        text = fence.group(1)
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise LLMError("模型未返回有效的 JSON 内容，请稍后重试。")
    try:
        return json.loads(text[start : end + 1])
    except json.JSONDecodeError as e:
        logger.warning("JSON 解析失败: %s", text[:300])
        raise LLMError("模型输出 JSON 解析失败，请重试。") from e


def chat_json(system: str, user: str, temperature: float = 0.3, max_tokens: int = 8000) -> dict:
    """调用 LLM 并解析 JSON 输出。部分兼容接口不支持 response_format，自动降级。"""
    client = get_client()
    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]
    last_error: Exception | None = None
    for use_json_mode in (True, False):
        try:
            kwargs = {
                "model": settings.llm_model,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens,
            }
            if use_json_mode:
                kwargs["response_format"] = {"type": "json_object"}
            resp = client.chat.completions.create(**kwargs)
            content = resp.choices[0].message.content or ""
            return _extract_json(content)
        except LLMError:
            # 内容能拿到但 JSON 坏了，换无 json_mode 重试一次
            last_error = LLMError("模型输出 JSON 解析失败，请重试。")
        except Exception as e:  # 网络/鉴权/参数等
            last_error = e
            logger.warning("LLM 调用失败 (json_mode=%s): %s", use_json_mode, e)
    raise LLMError(f"大模型调用失败，请检查 .env 中的 API 配置后重试。（{last_error}）")
