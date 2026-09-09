import { CodeSlide } from "@/presentation/code"

// 以下片段节选自仓库真实源码：仅合并空行、压缩缩进，逻辑未改动。

const MATCHER_CODE = `
def _normalize(s):
    s = s.casefold()                          # 统一小写
    for ch in (" ", "\\t", "\\n", ".", "·", "、", "/", "-"):
        s = s.replace(ch, "")                 # 去分隔符，方便子串匹配
    return s

def keyword_hit(resume_norm, name, aliases=None):
    candidates = [name] + list(aliases or [])   # 别名等价命中
    return any(_normalize(c) in resume_norm for c in candidates)

def compute_skill_match(keywords, resume_text):
    """keywords 来自 JD 抽取：{name, weight(1-5), required, aliases?}"""
    resume_norm = _normalize(resume_text)
    total_weight = hit_weight = 0.0
    matched, missing = [], []
    for kw in keywords:
        weight = float(kw.get("weight") or 3)
        if kw.get("required") is True:        # 必备项权重上浮
            weight *= 1.2
        elif kw.get("required") is False:     # 加分项权重下调
            weight *= 0.8
        total_weight += weight
        if keyword_hit(resume_norm, kw["name"], kw.get("aliases")):
            hit_weight += weight
            matched.append(kw["name"])
        else:
            missing.append(kw["name"])
    score = round(hit_weight / total_weight * 100)
    return score, matched, missing
`

const PIPELINE_CODE = `
def run_pipeline(resume_text, jd_text, target_position, emit, *, run_id, ask_user):
    # 阶段一/二：简历与 JD 结构化抽取（各一次 LLM 调用）
    resume_struct = chat_json(resume_prompt.RESUME_EXTRACT_SYSTEM, resume_text)
    emit("resume_struct", resume_struct)
    jd_struct = chat_json(jd_extract_prompt.JD_EXTRACT_SYSTEM, jd_text)
    emit("jd_struct", jd_struct)

    # 阶段三：算法打分 + LLM 定性 → total = 技能50% + 经验30% + 教育20%
    skill_score, matched, missing = compute_skill_match(jd_struct["hard_skills"], resume_text)
    assess = chat_json(match_prompt.MATCH_ASSESS_SYSTEM, match_user)
    total = round(skill_score * 0.5 + assess["experience_score"] * 0.3
                  + assess["education_score"] * 0.2)
    emit("score", {"total": total, "dimensions": dimensions, ...})

    # 阶段四：LLM 九类诊断 + 本地弱表述规则兜底，去重合并
    issues = _dedupe_issues(chat_json(diagnose_prompt.DIAGNOSE_SYSTEM, ...),
                            _rule_scan(resume_text))

    # 阶段五：规划 → Quick check 问答 → 逐条改写 → 整卷组装
    plan = chat_json(rewrite_prompt.REWRITE_PLAN_SYSTEM, plan_user)
    for item in plan["items"]:
        emit("question", payload)
        answers[idx] = ask_user(payload)      # 阻塞，等 /optimize/answer 唤醒
    for idx, item in enumerate(items):
        out = chat_json(rewrite_prompt.REWRITE_ITEM_SYSTEM, item_user)
        emit("rewrite", pair)                 # 完成一条推一条
    final = chat_json(rewrite_prompt.REWRITE_ASSEMBLE_SYSTEM, assembly_user)
`

const LLM_CODE = `
def chat_json(system, user, temperature=0.3, max_tokens=None):
    budget = max_tokens or settings.llm_max_tokens
    disable_thinking = not settings.llm_enable_thinking
    # 三级重试梯度：json_object → 无 json_mode → 双倍 token 预算
    plans = [
        {"json_mode": True,  "budget": budget,     "thinking_off": disable_thinking},
        {"json_mode": False, "budget": budget,     "thinking_off": False},
        {"json_mode": True,  "budget": budget * 2, "thinking_off": False},
    ]
    last_error = None
    for i, plan in enumerate(plans, 1):
        try:
            kwargs = {"model": settings.llm_model, "messages": messages,
                      "temperature": temperature, "max_tokens": plan["budget"]}
            if plan["json_mode"]:
                kwargs["response_format"] = {"type": "json_object"}
            if plan["thinking_off"]:          # Qwen3 等思维模型先尝试关闭思考
                kwargs["extra_body"] = {"chat_template_kwargs":
                                        {"enable_thinking": False}}
            resp = client.chat.completions.create(**kwargs)
            content = resp.choices[0].message.content or ""
            return _extract_json(content)     # 四步容错提取
        except Exception as e:
            last_error = e                    # 降级重试
    raise LLMError(f"大模型调用失败…（{last_error}）")
`

const SSE_CODE = `
@router.post("/optimize")
def optimize(body, user, db):
    run_id = uuid.uuid4().hex
    gate = register_gate(run_id)              # Quick check 问答门

    def event_stream():
        q = queue.Queue()
        def task():                           # 管线跑在后台线程
            try:
                result = run_pipeline(
                    resume_text, body.jd_text, body.target_position,
                    emit=lambda kind, payload: q.put((kind, payload)),
                    ask_user=lambda p: gate.ask(p["id"], QUESTION_TIMEOUT))
                q.put(("done", result))
            except PipelineError as e:
                q.put(("error", {"message": str(e)}))
        threading.Thread(target=task, daemon=True).start()

        while True:
            kind, payload = q.get()           # 队列解耦生产 / 消费
            if kind == "done":
                record = save_optimization(user, body, payload)  # 独立会话落库
                yield _sse("result", {"id": record.id, "result": payload})
                break
            elif kind == "error":
                yield _sse("error", payload); break
            yield _sse(kind, payload)         # 中间事件原样转发

    return StreamingResponse(event_stream(),
                             media_type="text/event-stream")
`

const KICKER = "04 代码展示"

/** 代码展示 ①：JD 加权覆盖度匹配算法（backend/app/services/matcher.py）。 */
export function MatcherCode() {
  return (
    <CodeSlide
      kicker={KICKER}
      title="匹配算法：加权关键词覆盖度"
      subtitle="matcher.py —— 量化打分的全部逻辑不足 40 行"
      file="backend/app/services/matcher.py"
      code={MATCHER_CODE}
      step={2}
      notes={[
        { lead: "权重从哪来", text: "JD 抽取阶段由 LLM 标注 1-5 级权重与必备/加分，算法只负责公平计票" },
        { lead: "别名等价命中", text: "归一化后子串匹配，同义技术名一条候选列表即可等价命中" },
        { lead: "输出三件套", text: "技能分 + 已命中清单 + 缺失清单，直接驱动前端技能墙动画" },
      ]}
    />
  )
}

/** 代码展示 ②：五阶段管线骨架（backend/app/services/pipeline.py）。 */
export function PipelineCode() {
  return (
    <CodeSlide
      kicker={KICKER}
      title="管线骨架：五个阶段一气呵成"
      subtitle="pipeline.py —— emit 让管线与传输解耦，ask_user 让管线可以停下来提问"
      file="backend/app/services/pipeline.py"
      code={PIPELINE_CODE}
      step={2}
      notes={[
        { lead: "事件即契约", text: "resume_struct / jd_struct / score / issue / rewrite 与前端 schema 一一对齐" },
        { lead: "双路证据", text: "阶段三先算覆盖率再交给 LLM 定性，算法结果作为参考注入 Prompt" },
        { lead: "可暂停", text: "ask_user 回调由路由层注入 —— 管线代码不感知 HTTP 与线程细节" },
      ]}
    />
  )
}

/** 代码展示 ③：LLM 三级重试梯度（backend/app/services/llm.py）。 */
export function LlmCode() {
  return (
    <CodeSlide
      kicker={KICKER}
      title="重试梯度：把不稳定封装在一处"
      subtitle="llm.py —— 上层管线只管调 chat_json，容错细节全部收口在这里"
      file="backend/app/services/llm.py"
      code={LLM_CODE}
      step={2}
      notes={[
        { lead: "梯度式降级", text: "每一级只改动一个变量：json 约束 → 输出预算，失败原因互不掩盖" },
        { lead: "思维模型兼容", text: "enable_thinking 参数端点不支持时自动在后续重试中去掉" },
        { lead: "错误可读", text: "最终异常带上下文透出，用户看到的是「检查 API 配置」而非堆栈" },
      ]}
    />
  )
}

/** 代码展示 ④：SSE 桥接（backend/app/routers/optimize_router.py）。 */
export function SseCode() {
  return (
    <CodeSlide
      kicker={KICKER}
      title="SSE 桥接：线程 + 队列 + 生成器"
      subtitle="optimize_router.py —— 30 行把同步管线变成可直播、可中断的流"
      file="backend/app/routers/optimize_router.py"
      code={SSE_CODE}
      step={2}
      notes={[
        { lead: "队列解耦", text: "管线只往队列丢事件，生成器只管取 —— 两端速率互不阻塞" },
        { lead: "问答穿透", text: "ask_user 指向问答门，HTTP 请求 - 响应之外实现了反向唤醒" },
        { lead: "优雅收尾", text: "finally 注销问答门：客户端断开时管线线程不会永久阻塞" },
      ]}
    />
  )
}
