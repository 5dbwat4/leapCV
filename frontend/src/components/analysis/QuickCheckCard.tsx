// Quick check 模态框：管线暂停时居中弹出（带遮罩），倒计时结束或作答后恢复改写。
// 纸张上被提问的行由 AnalysisTheater 标记高亮；此处引用原句帮助用户对照。
import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Loader2, SkipForward } from "lucide-react"
import axios from "axios"
import { toast } from "sonner"

import { answerQuickCheck } from "@/api"
import { apiErrorMessage } from "@/api/client"
import type { QuickCheckEvent } from "@/api/types"

interface QuickCheckCardProps {
  question: QuickCheckEvent
  /** 提交成功后回调（answer 为 null 表示跳过），由父组件收起卡片 */
  onDone: (answer: string | null) => void
}

/** 点选 chip 后停留的毫秒数：让「✓ 选中」状态被看见 */
const SELECT_FEEDBACK_MS = 450
/** 提交发现 404（问题已失效）后，展示提示并自动收起的毫秒数 */
const EXPIRED_NOTICE_MS = 1800

export default function QuickCheckCard({ question, onDone }: QuickCheckCardProps) {
  const totalSecs = Math.max(1, Math.round(question.expires_in ?? 180))
  const [selected, setSelected] = useState<string | null>(null)
  const [custom, setCustom] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [remaining, setRemaining] = useState(totalSecs)
  const inputRef = useRef<HTMLInputElement>(null)
  const finishedRef = useRef(false)

  const submit = async (answer: string | null) => {
    if (submitting || finishedRef.current) return
    setSubmitting(true)
    try {
      await answerQuickCheck({ run_id: question.run_id, question_id: question.id, answer })
      finishedRef.current = true
      onDone(answer)
    } catch (err) {
      setSubmitting(false)
      setSelected(null)
      if (axios.isAxiosError(err) && err.response?.status === 404) {
        // 问题已失效（等待超时或分析已结束）：静默收起，不打断用户
        finishedRef.current = true
        setNotice("这条问题已失效，AI 已用占位符继续分析")
        setTimeout(() => onDone(null), EXPIRED_NOTICE_MS)
      } else {
        setNotice(apiErrorMessage(err, "提交失败，请稍后重试"))
      }
    }
  }

  const submitRef = useRef(submit)
  submitRef.current = submit

  // 倒计时：归零自动按「跳过」提交，管线得以继续
  useEffect(() => {
    setRemaining(totalSecs)
    const iv = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000)
    return () => clearInterval(iv)
  }, [question.id, totalSecs])

  useEffect(() => {
    if (remaining === 0) {
      toast.info("未在限时内作答，已跳过此问题")
      void submitRef.current(null)
    }
  }, [remaining])

  // Esc = 跳过
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") void submitRef.current(null)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const pickOption = (option: string) => {
    if (submitting || finishedRef.current) return
    setSelected(option)
    setTimeout(() => void submit(option), SELECT_FEEDBACK_MS)
  }

  const submitCustom = () => {
    const value = custom.trim()
    if (!value) return
    setSelected(value)
    void submit(value)
  }

  const urgent = remaining <= 30

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* 遮罩：半透明压暗，纸张上的高亮行仍可辨认 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="absolute inset-0 bg-slate-950/55"
      />

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.96 }}
        transition={{ type: "spring", stiffness: 260, damping: 24 }}
        className="relative w-full max-w-xl overflow-hidden rounded-3xl border-2 border-indigo-600 bg-white shadow-2xl shadow-indigo-950/60"
      >
        {/* 顶部倒计时进度条：<30s 转为琥珀色提示 */}
        <div className="absolute inset-x-0 top-0 h-1 bg-slate-100">
          <div
            className={`h-full transition-all duration-1000 ease-linear ${urgent ? "bg-amber-400" : "bg-indigo-500"}`}
            style={{ width: `${(remaining / totalSecs) * 100}%` }}
          />
        </div>

        <div className="p-6 pt-7">
          {/* 头部：板块 chip + 剩余时间 */}
          <div className="flex items-center gap-2">
            {question.section && (
              <span className="max-w-[240px] truncate rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-500">
                {question.section}
              </span>
            )}
            <span
              className={`ml-auto text-[11px] font-medium tabular-nums ${urgent ? "text-amber-500" : "text-slate-400"}`}
            >
              剩余 {remaining}s
            </span>
          </div>

          {/* 问题 */}
          <p className="mt-3 text-lg font-bold leading-snug text-slate-900">{question.question}</p>
          {question.tip && <p className="mt-1 text-xs leading-relaxed text-slate-400">{question.tip}</p>}

          {/* 引用被提问的简历原句，便于对照 */}
          {question.before && (
            <div className="mt-3 rounded-xl border-l-4 border-indigo-300 bg-indigo-50/70 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-400">
                针对简历中的这句 → 左侧已高亮
              </p>
              <p className="mt-0.5 line-clamp-3 break-all text-xs leading-relaxed text-slate-600">
                「{question.before}」
              </p>
            </div>
          )}

          {/* 建议答案 chips：点选 → 打勾 → 自动提交 */}
          {question.options.length > 0 && (
            <div className="mt-4 flex flex-col gap-2">
              {question.options.map((option) => {
                const active = selected === option
                return (
                  <button
                    key={option}
                    disabled={submitting || finishedRef.current}
                    onClick={() => pickOption(option)}
                    className={`w-full rounded-xl px-4 py-2.5 text-left text-sm font-semibold transition-all disabled:cursor-not-allowed ${
                      active
                        ? "bg-indigo-100 text-indigo-700 ring-2 ring-indigo-500"
                        : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:ring-1 hover:ring-indigo-300"
                    }`}
                  >
                    {option}
                    {active && <span className="ml-1.5">✓</span>}
                  </button>
                )
              })}
            </div>
          )}

          {/* 自定义输入 / 跳过 */}
          <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-3.5">
            <input
              ref={inputRef}
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitCustom()}
              disabled={submitting || finishedRef.current}
              placeholder="或者输入你的真实数据…"
              className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 px-3 text-sm text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:opacity-60"
            />
            <button
              onClick={submitCustom}
              disabled={submitting || finishedRef.current || !custom.trim()}
              className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting && <Loader2 className="size-3.5 animate-spin" />}
              使用
            </button>
            <button
              onClick={() => void submit(null)}
              disabled={submitting || finishedRef.current}
              title="跳过（Esc）"
              className="flex h-9 shrink-0 items-center gap-1 rounded-lg px-2.5 text-xs font-medium text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600 disabled:opacity-50"
            >
              <SkipForward className="size-3.5" />
              跳过
            </button>
          </div>

          {notice && <p className="mt-2.5 text-xs text-slate-500">{notice}</p>}
        </div>
      </motion.div>
    </div>
  )
}

/** 剧场模态容器：question 事件存在时挂载（卡片自带遮罩与居中定位） */
export function QuickCheckOverlay({
  question,
  onDone,
}: {
  question: QuickCheckEvent | null
  onDone: (answer: string | null) => void
}) {
  return (
    <AnimatePresence>
      {question && <QuickCheckCard key={question.id} question={question} onDone={onDone} />}
    </AnimatePresence>
  )
}
