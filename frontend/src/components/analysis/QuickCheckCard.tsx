// Quick check 快问快答卡：阶段五管线暂停时浮层弹出，点选建议答案或输入自定义内容后继续改写
import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { CircleHelp, Loader2, SkipForward } from "lucide-react"
import { toast } from "sonner"

import { answerQuickCheck } from "@/api"
import { apiErrorMessage } from "@/api/client"
import type { QuickCheckEvent } from "@/api/types"

interface QuickCheckCardProps {
  question: QuickCheckEvent
  /** 提交成功后回调（answer 为 null 表示跳过），由父组件收起卡片 */
  onDone: (answer: string | null) => void
}

/** 点选 chip 后停留的毫秒数：让「✓ 选中」状态被看见，类似截图中的确认感 */
const SELECT_FEEDBACK_MS = 450

export default function QuickCheckCard({ question, onDone }: QuickCheckCardProps) {
  const [selected, setSelected] = useState<string | null>(null)
  const [custom, setCustom] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    // 问题切换时重置输入态并聚焦自定义输入框
    setSelected(null)
    setCustom("")
    setSubmitting(false)
    inputRef.current?.focus()
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [question.id])

  const submit = async (answer: string | null) => {
    if (submitting) return
    setSubmitting(true)
    try {
      await answerQuickCheck({ run_id: question.run_id, question_id: question.id, answer })
      onDone(answer)
    } catch (err) {
      setSubmitting(false)
      setSelected(null)
      toast.error(apiErrorMessage(err, "提交失败，请重试"))
    }
  }

  const pickOption = (option: string) => {
    if (submitting) return
    setSelected(option)
    timerRef.current = setTimeout(() => void submit(option), SELECT_FEEDBACK_MS)
  }

  const submitCustom = () => {
    const value = custom.trim()
    if (!value) return
    setSelected(value)
    void submit(value)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 32, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 24, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 260, damping: 24 }}
      className="pointer-events-auto w-full max-w-xl rounded-3xl border-2 border-indigo-600 bg-white p-6 shadow-2xl shadow-indigo-950/50"
    >
      {/* 标签行：来源 + 场景 */}
      <div className="flex items-center gap-2">
        <CircleHelp className="size-4 text-indigo-600" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-indigo-600">
          Quick check · 补充一个信息，改写更真实
        </span>
        {question.section && (
          <span className="ml-auto max-w-[180px] truncate rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
            {question.section}
          </span>
        )}
      </div>

      {/* 问题 */}
      <p className="mt-3 text-lg font-bold leading-snug text-slate-900">{question.question}</p>
      {question.tip && <p className="mt-1 text-xs leading-relaxed text-slate-400">{question.tip}</p>}

      {/* 建议答案 chips：点选 → 打勾 → 自动提交 */}
      {question.options.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {question.options.map((option) => {
            const active = selected === option
            return (
              <button
                key={option}
                disabled={submitting}
                onClick={() => pickOption(option)}
                className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-all disabled:cursor-not-allowed ${
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
          disabled={submitting}
          placeholder="或者输入你的真实数据…"
          className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 px-3 text-sm text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:opacity-60"
        />
        <button
          onClick={submitCustom}
          disabled={submitting || !custom.trim()}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting && <Loader2 className="size-3.5 animate-spin" />}
          使用
        </button>
        <button
          onClick={() => void submit(null)}
          disabled={submitting}
          className="flex h-9 shrink-0 items-center gap-1 rounded-lg px-2.5 text-xs font-medium text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600 disabled:opacity-50"
        >
          <SkipForward className="size-3.5" />
          跳过
        </button>
      </div>
    </motion.div>
  )
}

/** 剧场底部浮层容器：question 事件存在时挂载卡片 */
export function QuickCheckOverlay({
  question,
  onDone,
}: {
  question: QuickCheckEvent | null
  onDone: (answer: string | null) => void
}) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-8 z-30 flex justify-center px-4">
      <AnimatePresence mode="wait">
        {question && <QuickCheckCard key={question.id} question={question} onDone={onDone} />}
      </AnimatePresence>
    </div>
  )
}
