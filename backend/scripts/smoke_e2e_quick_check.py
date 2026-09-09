"""端到端冒烟：真实 HTTP 流程 —— 登录 → 建简历 → SSE 分析 → 中途作答 → 结果校验（仅标准库）。"""

import json
import sys
import threading
import time
import urllib.error
import urllib.request

BASE = "http://127.0.0.1:8765/api"
failures: list[str] = []


def check(name: str, cond: bool, extra: str = "") -> None:
    print(f"{'PASS' if cond else 'FAIL'}: {name}{(' | ' + extra) if extra and not cond else ''}")
    if not cond:
        failures.append(name)


def post_json(path: str, payload: dict, token: str | None = None) -> tuple[int, dict]:
    req = urllib.request.Request(
        f"{BASE}{path}",
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json", **({"Authorization": f"Bearer {token}"} if token else {})},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"{}")


# ---- 登录（复用或注册冒烟账号） ----
status, body = post_json("/auth/login", {"username": "smoke_qc", "password": "smoke123456"})
if status != 200:
    status, body = post_json("/auth/register", {"username": "smoke_qc", "password": "smoke123456"})
check("认证成功", status == 200, str(body)[:200])
token = body["access_token"]

# ---- 建一份粘贴简历 ----
resume_text = (
    "张伟\n电话 138****8888\n工作经历：杭州云启科技 Python 后端开发工程师 2023.07-至今\n"
    "- 负责订单系统的开发和维护\n- 优化了数据库查询，性能有所提升\n"
    "项目经历：电商中台项目 后端开发\n- 帮忙做了一些接口的开发工作\n"
    "技能：会使用 Python、MySQL、Redis 等技术"
)
status, body = post_json("/resumes/text", {"raw_text": resume_text, "filename": "冒烟简历"}, token)
check("创建简历成功", status == 200, str(body)[:200])
resume_id = body["id"]

# ---- 发起 SSE 分析，收到 question 后作答 ----
events: list[tuple[str, dict]] = []
question_payload: dict | None = None
got_result: dict | None = None
stream_error: dict | None = None
answer_sent = threading.Event()


def consume() -> None:
    global question_payload, got_result, stream_error
    req = urllib.request.Request(
        f"{BASE}/optimize",
        data=json.dumps(
            {
                "resume_id": resume_id,
                # 不传 target_position：岗位名应从 JD 全文自动抽取并入库
                "jd_text": "Python 后端开发工程师，要求熟悉 FastAPI、MySQL、Redis、Docker、Kubernetes，有高并发经验优先。",
            }
        ).encode(),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        event = ""
        for raw in resp:
            line = raw.decode().rstrip("\n").rstrip("\r")
            if line.startswith("event: "):
                event = line[7:]
            elif line.startswith("data: "):
                data = json.loads(line[6:])
                events.append((event, data))
                if event == "question":
                    question_payload = data
                    answer_sent.wait(15)
                elif event == "result":
                    got_result = data
                elif event == "error":
                    stream_error = data


th = threading.Thread(target=consume, daemon=True)
th.start()

# 等待 question 事件到达
for _ in range(300):
    if question_payload is not None:
        break
    time.sleep(0.1)

check("收到 question 事件", question_payload is not None)
if question_payload:
    status, body = post_json(
        "/optimize/answer",
        {"run_id": question_payload["run_id"], "question_id": question_payload["id"], "answer": "日均 5 万单"},
        token,
    )
    check("作答接口 200", status == 200, str(body)[:200])
    answer_sent.set()

th.join(timeout=90)
check("流以 result 结束", got_result is not None and stream_error is None, json.dumps(stream_error, ensure_ascii=False) if stream_error else "")

if got_result:
    result = got_result["result"]
    check("结果已落库返回 id", isinstance(got_result.get("id"), int))
    check("结果含抽取的岗位名", result.get("position_name") == "Python后端开发工程师", str(result.get("position_name")))

    # 历史详情：target_position 未传时应以抽取的岗位名落库
    record_id = got_result["id"]
    req = urllib.request.Request(f"{BASE}/history/{record_id}", headers={"Authorization": f"Bearer {token}"})
    with urllib.request.urlopen(req, timeout=15) as resp:
        detail = json.loads(resp.read())
    check("历史记录岗位名兜底", detail.get("target_position") == "Python后端开发工程师", str(detail.get("target_position")))

    check("改写对采用作答", bool(result["rewrite_pairs"]) and result["rewrite_pairs"][0].get("answer") == "日均 5 万单")
    check("after 文本融入作答", "日均 5 万单" in result["rewrite_pairs"][0]["after"])
    check("优化简历融入作答", "日均 5 万单" in result["optimized_resume_md"])
    check("无残留占位规模", "支撑日均 50 万单【请补充：真实业务数据】" not in result["optimized_resume_md"])

# ---- 失效问题作答应 404 ----
status, _ = post_json("/optimize/answer", {"run_id": "0" * 32, "question_id": "q1", "answer": "x"}, token)
check("未知 run 作答返回 404", status == 404)

print()
if failures:
    print(f"{len(failures)} 项失败：{failures}")
    sys.exit(1)
print("端到端全部通过")
