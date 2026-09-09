"""交互式问答：管线在内容重构阶段暂停，等待用户通过 Quick check 补充关键信息。

每个分析运行（run_id）对应一个 QuestionGate，由 /optimize 路由创建并登记；
管线线程 emit question 事件后阻塞在 ask()，/optimize/answer 端点收到用户
作答（或跳过）后唤醒。仅进程内有效（uvicorn 单进程部署）。
"""

import threading
import time


class QuestionGate:
    """单次分析运行内的问答同步原语。"""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._events: dict[str, threading.Event] = {}
        self._answers: dict[str, str | None] = {}
        self._cancelled = threading.Event()

    def ask(self, question_id: str, timeout: float = 180.0) -> str | None:
        """阻塞等待某个问题的作答；返回 None 表示跳过、超时或运行被取消。"""
        ev = threading.Event()
        with self._lock:
            self._events[question_id] = ev
            self._answers.pop(question_id, None)
        try:
            deadline = time.monotonic() + timeout
            while not ev.wait(0.25):
                if self._cancelled.is_set() or time.monotonic() > deadline:
                    return None
            return self._answers.get(question_id)
        finally:
            with self._lock:
                self._events.pop(question_id, None)
                self._answers.pop(question_id, None)

    def answer(self, question_id: str, answer: str | None) -> bool:
        """投递作答并唤醒管线；问题不存在（已超时/已结束）返回 False。"""
        with self._lock:
            ev = self._events.get(question_id)
            if ev is None:
                return False
            self._answers[question_id] = answer
        ev.set()
        return True

    def cancel(self) -> None:
        """取消运行：所有等待中的 ask 立即返回 None。"""
        self._cancelled.set()


_GATES: dict[str, QuestionGate] = {}
_GATES_LOCK = threading.Lock()


def register_gate(run_id: str) -> QuestionGate:
    gate = QuestionGate()
    with _GATES_LOCK:
        _GATES[run_id] = gate
    return gate


def get_gate(run_id: str) -> QuestionGate | None:
    with _GATES_LOCK:
        return _GATES.get(run_id)


def pop_gate(run_id: str) -> QuestionGate | None:
    with _GATES_LOCK:
        return _GATES.pop(run_id, None)
