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
    """从模型输出中提取 JSON 对象，容忍思维标签、代码围栏与前后缀文本。"""
    text = re.sub(r"<think>[\s\S]*?</think>", "", content).strip()
    if "<think>" in text:  # 未闭合的思维标签：丢弃其前的内容
        text = text.split("<think>", 1)[1]
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


def chat_json(system: str, user: str, temperature: float = 0.3, max_tokens: int | None = None) -> dict:
    """调用 LLM 并解析 JSON 输出。

    三级重试梯度：json_object → 无 json_mode → 双倍 token 预算的 json_object。
    对 Qwen3 等思维模型默认先尝试关闭思考（chat_template_kwargs），端点不支持该参数时
    后续重试自动去掉，避免兼容接口因未知参数整体报错。
    """
    client = get_client()
    budget = max_tokens or settings.llm_max_tokens
    disable_thinking = not settings.llm_enable_thinking
    plans = [
        {"json_mode": True, "budget": budget, "thinking_off": disable_thinking},
        {"json_mode": False, "budget": budget, "thinking_off": False},
        {"json_mode": True, "budget": budget * 2, "thinking_off": False},
    ]
    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]
    last_error: Exception | None = None
    for i, plan in enumerate(plans, 1):
        try:
            kwargs: dict = {
                "model": settings.llm_model,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": plan["budget"],
            }
            if plan["json_mode"]:
                kwargs["response_format"] = {"type": "json_object"}
            if plan["thinking_off"]:
                kwargs["extra_body"] = {"chat_template_kwargs": {"enable_thinking": False}}
            resp = client.chat.completions.create(**kwargs)
            choice = resp.choices[0]
            if choice.finish_reason == "length":
                logger.warning("第 %d 次尝试输出被截断（finish_reason=length）", i)
            content = choice.message.content or ""
            return _extract_json(content)
        except LLMError as e:
            last_error = e
            logger.warning("第 %d 次尝试 JSON 解析失败: %s", i, e)
        except Exception as e:  # 网络/鉴权/参数等
            last_error = e
            logger.warning("第 %d 次尝试调用失败: %s", i, e)
    raise LLMError(f"大模型调用失败，请检查 .env 中的 API 配置后重试。（{last_error}）")
