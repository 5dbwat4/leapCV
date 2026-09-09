"""演示模式数据：无 API Key 或 MOCK_MODE=1 时返回，保证前端全流程可演示。"""

import copy
import time
from typing import Callable

from .report import build_report

# 演示用 JD 结构（与真实 JD 抽取阶段输出同构），用于生成匹配报告
MOCK_JD_STRUCT = {
    "position_name": "Python后端开发工程师",
    "hard_skills": [
        {"name": "Python", "aliases": ["Python3"], "weight": 5, "required": True},
        {"name": "MySQL", "aliases": [], "weight": 4, "required": True},
        {"name": "Redis", "aliases": [], "weight": 4, "required": True},
        {"name": "FastAPI", "aliases": ["FastAPI框架"], "weight": 4, "required": True},
        {"name": "Docker", "aliases": ["容器化"], "weight": 3, "required": True},
        {"name": "Kubernetes", "aliases": ["k8s", "K8S"], "weight": 5, "required": True},
        {"name": "Kafka", "aliases": ["消息队列", "RabbitMQ"], "weight": 2, "required": False},
        {"name": "微服务", "aliases": ["微服务架构", "微服务治理"], "weight": 3, "required": False},
    ],
    "soft_skills": ["沟通能力", "团队协作", "学习能力", "抗压能力"],
    "responsibilities": [],
    "hidden_requirements": [],
}

# 演示用简历结构（与真实简历解析阶段输出同构，基本信息与 MOCK_RESULT.resume_overview 一致）。
# work/project 的 highlights、skills、self_evaluation 中逐字保留了 MOCK_RESULT 里
# issues[].original 与 rewrite_pairs[].before 的原句，供前端把「原文划除 → 改写句滑入」
# 的动画匹配到简历文档的具体行上。
MOCK_RESUME_STRUCT: dict = {
    "name": "张伟",
    "phone": "138****8888",
    "email": "zhangwei@example.com",
    "current_position": "Python 后端开发工程师",
    "years_of_experience": 3,
    "education": [
        {
            "school": "浙江工业大学",
            "major": "计算机科学与技术",
            "degree": "本科",
            "period": "2019.9-2023.6",
        }
    ],
    "work": [
        {
            "company": "杭州云启科技",
            "position": "Python 后端开发工程师",
            "period": "2023.07 - 至今",
            "highlights": [
                "负责订单系统的开发和维护",
                "优化了数据库查询，性能有所提升",
            ],
        }
    ],
    "internships": [],
    "projects": [
        {
            "name": "电商中台项目",
            "role": "后端开发",
            "period": "2024.03 - 2024.10",
            "highlights": ["帮忙做了一些接口的开发工作"],
        }
    ],
    "skills": ["会使用 Python、MySQL、Redis 等技术"],
    "languages": [],
    "awards": [],
    "self_evaluation": "吃苦耐劳，认真负责，有较强的学习能力和团队合作精神",
    "sections_found": ["基本信息", "教育经历", "工作经历", "项目经历", "专业技能"],
    "sections_missing": ["自我评价与岗位动机"],
}

MOCK_RESULT: dict = {
    "mock": True,
    "position_name": "Python后端开发工程师",
    "summary": (
        "你的简历具备 3 年 Python 后端经验，与目标岗位的核心要求（FastAPI/Flask、MySQL、Redis、"
        "Docker）匹配度中等偏上。主要差距在于缺少高并发场景与微服务治理经验的量化描述，且多数"
        "工作成果没有数据支撑。本次已按 STAR 法则重构全部经历描述，补充了可量化的表达框架，"
        "并对齐了 JD 中的关键技术术语。"
    ),
    "highlights": [
        "主导订单服务重构，接口平均响应时间从 480ms 降至 120ms（75% 优化幅度）",
        "将 CI/CD 流水线从人工部署升级为 Docker + Jenkins 自动化，发版时间从 2 小时缩短到 15 分钟",
        "对 JD 中的「高并发」「微服务拆分」关键词进行了定向强化，技术与岗位语言保持一致",
    ],
    "match": {
        "total": 72,
        "dimensions": [
            {"name": "技能匹配", "score": 76, "detail": "JD 硬技能加权覆盖率 76%，核心栈已覆盖"},
            {"name": "经验匹配", "score": 68, "detail": "3 年后端经验相关度高，但缺高并发量化案例"},
            {"name": "教育背景", "score": 72, "detail": "本科计算机相关专业，符合岗位基本要求"},
        ],
        "matched_skills": [
            {"name": "Python", "evidence": "3 年 Python 开发经验，主力语言"},
            {"name": "FastAPI", "evidence": "使用 FastAPI 开发订单服务 20+ 接口"},
            {"name": "MySQL", "evidence": "负责 MySQL 表结构设计与慢查询优化"},
            {"name": "Redis", "evidence": "引入 Redis 缓存热点数据，DB 负载下降明显"},
            {"name": "Docker", "evidence": "编写 Dockerfile 并维护团队镜像仓库"},
            {"name": "Git", "evidence": "日常协作使用 Git Flow 工作流"},
        ],
        "missing_skills": [
            {
                "name": "Kubernetes",
                "importance": "高",
                "advice": "JD 列为必备。建议系统学习 K8s 核心概念（Deployment/Service/Ingress），若公司有用过可补充到经历中",
            },
            {
                "name": "高并发场景经验",
                "importance": "高",
                "advice": "把订单系统的 QPS 规模、峰值处理能力量化写进简历，如「支撑日均 50 万订单」",
            },
            {
                "name": "消息队列",
                "importance": "中",
                "advice": "JD 提到 Kafka 为加分项，可自学基础并了解公司业务中的异步场景",
            },
            {
                "name": "微服务治理",
                "importance": "中",
                "advice": "补充服务拆分思路：按业务域拆分的依据、服务间通信方式、熔断降级策略",
            },
        ],
        "strengths": [
            "主力语言与岗位完全一致，FastAPI 有生产环境实战",
            "具备数据库优化与缓存设计的完整闭环经验",
            "有从 0 到 1 搭建 CI/CD 的自动化经验",
        ],
        "gaps_summary": (
            "核心技能栈覆盖了 JD 的主要要求，但在分布式与高并发方向缺少可量化的证据；"
            "Kubernetes 是必备项中唯一完全空白的技能，是补强的第一优先级。"
        ),
        "advice": "建议补强后投递",
        "advice_reason": (
            "匹配度 72 分达到面试门槛，但建议先补一条高并发量化案例 + 了解 K8s 基础概念，"
            "通过率可明显提升。"
        ),
    },
    "resume_overview": {
        "name": "张伟",
        "current_position": "Python 后端开发工程师",
        "years_of_experience": 3,
        "sections_found": ["基本信息", "教育经历", "工作经历", "项目经历", "专业技能"],
        "sections_missing": ["自我评价与岗位动机"],
    },
    "issues": [
        {
            "type": "缺乏量化",
            "severity": "高",
            "location": "工作经历-杭州云启科技",
            "original": "负责订单系统的开发和维护",
            "problem": "「开发和维护」没有任何规模与成果数据，无法体现工作价值和业务影响。",
            "suggestion": "补充规模与结果：如「主导订单服务开发，支撑日均 50 万单，接口平均响应 120ms」。",
        },
        {
            "type": "缺乏量化",
            "severity": "高",
            "location": "工作经历-杭州云启科技",
            "original": "优化了数据库查询，性能有所提升",
            "problem": "「有所提升」是典型的无量化表述，说服力弱。",
            "suggestion": "改为「通过索引重建与慢查询治理，核心接口 P95 耗时从 480ms 降至 120ms」。",
        },
        {
            "type": "口语化表述",
            "severity": "中",
            "location": "项目经历-电商中台项目",
            "original": "帮忙做了一些接口的开发工作",
            "problem": "「帮忙」「一些」是口语化且弱化职责的表述，显得参与度低。",
            "suggestion": "改为「承担营销域 8 个核心接口的设计与开发，制定接口规范并被团队采纳」。",
        },
        {
            "type": "描述空泛",
            "severity": "中",
            "location": "自我评价",
            "original": "吃苦耐劳，认真负责，有较强的学习能力和团队合作精神",
            "problem": "通用套话堆砌，任何岗位都适用，等于没有信息量。",
            "suggestion": "替换为有事实支撑的差异化亮点：如「持续输出技术博客 20+ 篇，主导团队内部 2 次技术分享」。",
        },
        {
            "type": "信息缺失",
            "severity": "中",
            "location": "整体",
            "original": "",
            "problem": "缺少求职意向板块，HR 无法快速判断投递岗位与到岗时间。",
            "suggestion": "在简历顶部增加一行：求职意向-Python 后端开发工程师 | 期望城市 | 到岗时间。",
        },
        {
            "type": "格式问题",
            "severity": "低",
            "location": "教育经历",
            "original": "2019.9-2023.6",
            "problem": "时间段使用「.」分隔且与其他板块的「-」格式不统一。",
            "suggestion": "统一为「2019.09 - 2023.06」格式，月份补齐两位数。",
        },
    ],
    "optimized_resume_md": (
        "# 张伟\n\n"
        "**求职意向：Python 后端开发工程师** ｜ 电话：138****8888 ｜ 邮箱：zhangwei@example.com ｜ 杭州\n\n"
        "## 专业技能\n\n"
        "- 熟练使用 Python，3 年后端开发经验，熟悉 FastAPI/Flask 框架与 RESTful API 设计\n"
        "- 熟悉 MySQL 索引原理与查询优化，掌握 Redis 缓存设计（热点数据、分布式锁）\n"
        "- 熟悉 Docker 容器化部署与 Jenkins CI/CD 流水线搭建\n"
        "- 了解 Kafka 消息队列与微服务拆分方法论【请补充：实际使用情况】\n"
        "- 熟练使用 Git 协作，遵循 Git Flow 规范\n\n"
        "## 工作经历\n\n"
        "### 杭州云启科技 ｜ Python 后端开发工程师 ｜ 2023.07 - 至今\n\n"
        "- 主导订单服务重构，将单体接口拆分为 3 个领域服务，接口平均响应时间从 480ms 降至 120ms，支撑日均 50 万单【请补充：真实业务数据】\n"
        "- 设计并落地 Redis 多级缓存方案，热点商品数据命中率 92%，数据库 QPS 峰值负载下降 65%\n"
        "- 推动慢查询治理专项，梳理并优化 30+ 条核心 SQL，核心接口 P95 耗时下降 75%\n"
        "- 搭建 Docker + Jenkins 自动化部署流水线，发版时间从 2 小时缩短至 15 分钟，月均发版 20+ 次\n\n"
        "## 项目经历\n\n"
        "### 电商中台项目 ｜ 后端核心开发 ｜ 2024.03 - 2024.10\n\n"
        "- 负责营销域 8 个核心接口的设计与开发，制定模块接口规范并被团队采纳为标准\n"
        "- 引入异步任务队列处理优惠券发放，大促期间任务处理时效提升 3 倍\n"
        "- 编写单元测试覆盖核心链路，模块测试覆盖率从 40% 提升至 85%\n\n"
        "## 教育经历\n\n"
        "**浙江工业大学 ｜ 计算机科学与技术 ｜ 本科 ｜ 2019.09 - 2023.06**\n\n"
        "## 自我评价\n\n"
        "聚焦电商后端领域，具备从业务建模到性能调优的完整闭环经验；持续输出技术博客 20+ 篇"
        "【请补充：真实情况】，擅长把复杂问题拆解为可落地的工程方案。"
    ),
    "rewrite_pairs": [
        {
            "section": "工作经历-杭州云启科技",
            "before": "负责订单系统的开发和维护",
            "after": "主导订单服务重构，将单体接口拆分为 3 个领域服务，接口平均响应时间从 480ms 降至 120ms，支撑日均 50 万单",
            "reason": "「负责开发和维护」改为动词开头的主导式表达，补充拆分动作与响应时间、订单量双重量化，直接回应 JD 的「高并发」要求",
        },
        {
            "section": "工作经历-杭州云启科技",
            "before": "优化了数据库查询，性能有所提升",
            "after": "推动慢查询治理专项，梳理并优化 30+ 条核心 SQL，核心接口 P95 耗时下降 75%",
            "reason": "用「有所提升」这类模糊词换成 P95 耗时下降 75% 的硬指标，并用「专项」「治理」体现主动性",
        },
        {
            "section": "项目经历-电商中台项目",
            "before": "帮忙做了一些接口的开发工作",
            "after": "负责营销域 8 个核心接口的设计与开发，制定模块接口规范并被团队采纳为标准",
            "reason": "删除「帮忙」「一些」等弱化表述，明确职责范围（8 个接口）与影响力（规范被采纳）",
        },
        {
            "section": "自我评价",
            "before": "吃苦耐劳，认真负责，有较强的学习能力和团队合作精神",
            "after": "聚焦电商后端领域，具备从业务建模到性能调优的完整闭环经验；持续输出技术博客 20+ 篇",
            "reason": "通用套话替换为领域定位 + 可验证的事实证据，与目标岗位的技术方向强关联",
        },
        {
            "section": "专业技能",
            "before": "会使用 Python、MySQL、Redis 等技术",
            "after": "熟练使用 Python，3 年后端开发经验，熟悉 FastAPI/Flask 框架与 RESTful API 设计",
            "reason": "按 JD 关键词重组技能清单，区分熟练度层级，让 HR 10 秒内完成技能匹配",
        },
    ],
}

# 演示节奏（秒）：progress 步进间隔、结构化/汇总事件后的停顿，以及逐条 item 事件的推送间隔。
# item 间隔与真实管线共用（pipeline.py 从此处导入），全程总时长控制在 8~12 秒。
PROGRESS_INTERVAL = 0.3
STRUCT_PAUSE = 0.5
SKILL_INTERVAL = 0.18
ISSUE_INTERVAL = 0.22
REWRITE_INTERVAL = 0.28

PROGRESS_STEPS = [
    ("parse_resume", "正在解析简历结构…", 10),
    ("parse_resume", "简历解析完成", 25),
    ("parse_jd", "正在解析岗位 JD…", 32),
    ("parse_jd", "JD 解析完成", 48),
    ("match", "正在计算岗位匹配度…", 55),
    ("match", "匹配度计算完成", 65),
    ("diagnose", "正在诊断简历风险…", 72),
    ("diagnose", "风险诊断完成", 82),
    ("rewrite", "正在重构简历内容…", 88),
    ("rewrite", "内容重构完成", 97),
]


def run_mock_pipeline(
    resume_text: str,
    jd_text: str,
    target_position: str,
    emit: Callable[[str, dict], None],
    run_id: str = "",
    ask_user: Callable[[dict], str | None] | None = None,
) -> dict:
    """按与真实管线完全相同的事件序列推送演示事件，返回内置演示结果（报告部分基于用户真实输入计算）。

    ask_user 与真实管线一致：阶段五弹出 Quick check 问题并阻塞等待作答，答案会真实
    融入改写结果，完整演示「提问 → 点选 → 改写采用」的交互闭环。
    """
    result = copy.deepcopy(MOCK_RESULT)
    steps = iter(PROGRESS_STEPS)

    def step() -> None:
        stage, message, progress = next(steps)
        emit("progress", {"stage": stage, "message": message, "progress": progress})
        time.sleep(PROGRESS_INTERVAL)

    # ---- 阶段一：简历结构化解析 ----
    step()
    step()
    emit("resume_struct", copy.deepcopy(MOCK_RESUME_STRUCT))
    time.sleep(STRUCT_PAUSE)

    # ---- 阶段二：JD 要求抽取 ----
    step()
    step()
    emit("jd_struct", copy.deepcopy(MOCK_JD_STRUCT))
    time.sleep(STRUCT_PAUSE)

    # ---- 阶段三：匹配分析（先发总分，再逐条推送已命中/缺失技能） ----
    step()
    step()
    match = result["match"]
    emit(
        "score",
        {
            "total": match["total"],
            "dimensions": match["dimensions"],
            "advice": match["advice"],
            "advice_reason": match["advice_reason"],
        },
    )
    time.sleep(STRUCT_PAUSE)
    skills = [
        {"name": s["name"], "hit": True, "detail": s.get("evidence", "")}
        for s in match["matched_skills"]
    ] + [
        {"name": s["name"], "hit": False, "detail": s.get("advice", "")}
        for s in match["missing_skills"]
    ]
    for idx, skill in enumerate(skills):
        if idx:
            time.sleep(SKILL_INTERVAL)
        emit("skill", skill)

    # ---- 阶段四：风险诊断（逐条弹出） ----
    step()
    step()
    for idx, issue in enumerate(result["issues"]):
        if idx:
            time.sleep(ISSUE_INTERVAL)
        emit("issue", issue)

    # ---- 阶段五：内容重构（Quick check 问答 + 逐条滑入） ----
    step()
    # 演示 Quick check：与真实管线一致地提问并等待作答，答案融入第一条改写
    if ask_user is not None:
        question = {
            "run_id": run_id,
            "id": "q1",
            "question": "你主导的订单服务日均处理多少订单？",
            "options": ["日均 50 万单", "日均 10 万单", "日均 1 万单"],
            "tip": "点选量级或直接输入真实数据，改写会立即采用；跳过则保留【请补充】占位",
            "section": "工作经历-杭州云启科技",
            "before": "负责订单系统的开发和维护",
        }
        emit("question", question)
        answer = ask_user(question)
        if answer:
            first_pair = result["rewrite_pairs"][0]
            first_pair["after"] = first_pair["after"].replace("日均 50 万单", answer.strip())
            first_pair["answer"] = answer.strip()
            first_pair["reason"] += "；已采用你通过 Quick check 补充的业务规模"
            result["optimized_resume_md"] = result["optimized_resume_md"].replace(
                "支撑日均 50 万单【请补充：真实业务数据】", f"支撑{answer.strip()}"
            )
    time.sleep(STRUCT_PAUSE)
    step()
    for idx, pair in enumerate(result["rewrite_pairs"]):
        if idx:
            time.sleep(REWRITE_INTERVAL)
        emit("rewrite", pair)

    result["report"] = build_report(resume_text, MOCK_JD_STRUCT, result["issues"])
    return result
