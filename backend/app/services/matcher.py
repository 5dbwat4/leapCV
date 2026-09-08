"""JD 关键词加权覆盖度算法：与 LLM 定性评估互补的量化打分。"""


def _normalize(s: str) -> str:
    """统一小写、去空白与常见分隔符，便于子串匹配。"""
    s = s.casefold()
    for ch in (" ", "\t", "\n", ".", "·", "、", "/", "-"):
        s = s.replace(ch, "")
    return s


def keyword_hit(resume_norm: str, name: str, aliases: list[str] | None = None) -> bool:
    """判断单个关键词（含别名）是否出现在已归一化的简历文本中。"""
    candidates = [name] + list(aliases or [])
    return any(_normalize(c) and _normalize(c) in resume_norm for c in candidates)


def compute_skill_match(
    keywords: list[dict], resume_text: str
) -> tuple[int, list[str], list[str]]:
    """
    计算 JD 关键词在简历中的加权覆盖率。

    keywords 来自 JD 抽取阶段，每项: {name, weight(1-5), required(bool), aliases?}
    返回: (技能匹配分 0-100, 已覆盖关键词名列表, 未覆盖关键词名列表)
    """
    if not keywords:
        return 0, [], []

    resume_norm = _normalize(resume_text)
    total_weight = 0.0
    hit_weight = 0.0
    matched: list[str] = []
    missing: list[str] = []

    for kw in keywords:
        name = str(kw.get("name", "")).strip()
        if not name:
            continue
        weight = float(kw.get("weight") or 3)
        # 必备项权重上浮，加分项下调
        if kw.get("required") is True:
            weight *= 1.2
        elif kw.get("required") is False:
            weight *= 0.8
        total_weight += weight

        if keyword_hit(resume_norm, name, kw.get("aliases")):
            hit_weight += weight
            if name not in matched:
                matched.append(name)
        elif name not in missing:
            missing.append(name)

    score = round(hit_weight / total_weight * 100) if total_weight else 0
    return score, matched, missing
