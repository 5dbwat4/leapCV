"""冒烟：Quick check 问答门 + 演示模式问答闭环（不依赖 LLM）。"""

import sys
import threading
import time

sys.path.insert(0, ".")

from app.services.interactive import QuestionGate  # noqa: E402
from app.services.mock_data import run_mock_pipeline  # noqa: E402

failures: list[str] = []


def check(name: str, cond: bool) -> None:
    print(f"{'PASS' if cond else 'FAIL'}: {name}")
    if not cond:
        failures.append(name)


# ---- 1. QuestionGate 基本行为 ----
gate = QuestionGate()
th = threading.Thread(target=lambda: (time.sleep(0.2), gate.answer("q1", "日均 10 万单")), daemon=True)
th.start()
t0 = time.time()
ans = gate.ask("q1", timeout=5)
check("ask 收到异步作答", ans == "日均 10 万单")
check("ask 阻塞至作答才返回", time.time() - t0 >= 0.15)

# 作答后 key 已清理，重复投递应返回 False
check("作答后问题已注销", gate.answer("q1", "x") is False)

# 超时返回 None
t0 = time.time()
check("超时返回 None", gate.ask("q2", timeout=0.5) is None)
check("超时耗时符合预期", 0.4 <= time.time() - t0 < 1.5)

# cancel 唤醒等待方
threading.Timer(0.3, gate.cancel).start()
check("cancel 后 ask 返回 None", gate.ask("q3", timeout=30) is None)

# 未作答的 key 投递返回 False
check("对不存在问题作答返回 False", gate.answer("ghost", "y") is False)


# ---- 2. 演示模式管线：带问答 ----
events: list[tuple[str, dict]] = []
questions: list[dict] = []


def ask(payload: dict) -> str | None:
    questions.append(payload)
    # 模拟前端：先异步 POST /optimize/answer，再由路由侧 ask 阻塞等待
    def respond() -> None:
        time.sleep(0.2)
        from app.services.interactive import get_gate

        g = get_gate(payload["run_id"])
        assert g is not None
        assert g.answer(payload["id"], "日均 30 万单"), "answer 端点语义：投递成功应返回 True"

    threading.Thread(target=respond, daemon=True).start()
    from app.services.interactive import get_gate

    g = get_gate(payload["run_id"])
    assert g is not None
    return g.ask(payload["id"], timeout=10)


from app.services.interactive import pop_gate, register_gate  # noqa: E402

run_id = "smoke-run-0001"
register_gate(run_id)
result = run_mock_pipeline("简历文本", "JD 文本", "Python 后端", lambda k, p: events.append((k, p)), run_id=run_id, ask_user=ask)
pop_gate(run_id)

kinds = [k for k, _ in events]
check("演示模式发出 question 事件", "question" in kinds)
q_payload = next((p for k, p in events if k == "question"), {})
check("question 含 run_id / id / options", bool(q_payload.get("run_id")) and q_payload.get("id") == "q1" and len(q_payload.get("options", [])) >= 2)
check("ask_user 被调用且返回值融入改写", result["rewrite_pairs"][0].get("answer") == "日均 30 万单")
check("改写 after 采用用户答案", "日均 30 万单" in result["rewrite_pairs"][0]["after"])
check("改写 after 不再含旧占位数据", "日均 50 万单" not in result["rewrite_pairs"][0]["after"])
check("优化简历 md 采用用户答案", "日均 30 万单" in result["optimized_resume_md"])
check("优化简历 md 移除对应占位符", "支撑日均 50 万单【请补充：真实业务数据】" not in result["optimized_resume_md"])
check("rewrite 事件逐条推送", kinds.count("rewrite") == len(result["rewrite_pairs"]))
check("question 先于所有 rewrite", kinds.index("question") < kinds.index("rewrite"))


# ---- 3. 演示模式管线：无 ask_user（不提问，行为与旧版一致） ----
events2: list[tuple[str, dict]] = []
result2 = run_mock_pipeline("简历文本", "JD 文本", "", lambda k, p: events2.append((k, p)))
check("无 ask_user 时不发 question", "question" not in [k for k, _ in events2])
check("无 ask_user 时结果保留占位符", "日均 50 万单" in result2["rewrite_pairs"][0]["after"])

print()
if failures:
    print(f"{len(failures)} 项失败：{failures}")
    sys.exit(1)
print("全部通过")
