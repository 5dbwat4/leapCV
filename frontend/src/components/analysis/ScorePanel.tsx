// 分析剧场：匹配分面板 —— 大数字滚动 + 渐变轨道 knob + advice 文案 + 维度充能条
import { useEffect, useState } from "react"
import { AnimatePresence, animate, motion } from "framer-motion"
import { Check } from "lucide-react"

import type { ScoreEvent } from "@/api/types"

/** count-up hook：目标分数变化时从 0 平滑滚动到目标值 */
function useCountUp(target: number | null): number {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (target == null) {
      setValue(0)
      return
    }
    const controls = animate(0, target, {
      duration: 1.1,
      ease: "easeOut",
      onUpdate: (v) => setValue(Math.round(v)),
    })
    return () => controls.stop()
  }, [target])
  return value
}

/** 右栏第 1 块：score 事件到达后大数字 spring 滚动 + 轨道 knob 滑动 + 三维度依次充能 */
export default function ScorePanel({ score }: { score: ScoreEvent | null }) {
  const target = score ? Math.max(0, Math.min(100, score.total)) : null
  const display = useCountUp(target)

  return (
    <div className="shrink-0 rounded-2xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur-xl">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.25em] text-white/45">岗位匹配度</p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-6xl font-black leading-none tabular-nums text-white">
              {score ? display : <span className="text-white/20">--</span>}
            </span>
            <span className="text-sm text-white/40">/ 100</span>
          </div>
        </div>
        {/* 评分到达：绿色勾选淡入 */}
        <AnimatePresence>
          {score && (
            <motion.span
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 18 }}
              className="flex size-9 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/40"
            >
              <Check className="size-5" />
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* 渐变轨道 + 白色 knob 按分数滑动 */}
      <div className="relative mt-4 h-3 rounded-full bg-gradient-to-r from-red-400 via-amber-400 to-emerald-400">
        <motion.div
          className="absolute top-1/2 size-5 -translate-y-1/2 rounded-full border-[3px] border-white bg-slate-900 shadow-lg shadow-black/40"
          initial={{ left: "calc(0% - 10px)" }}
          animate={{ left: `calc(${target ?? 0}% - 10px)` }}
          transition={{ type: "spring", stiffness: 55, damping: 14 }}
        />
      </div>

      {/* advice 文案（score 事件后出现）/ 等待提示 */}
      <div className="mt-3 min-h-[20px]">
        <AnimatePresence mode="wait">
          {score ? (
            <motion.div
              key="advice"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
            >
              {score.advice && (
                <p className="rounded-lg bg-indigo-500/15 px-3 py-2 text-xs leading-relaxed text-indigo-200 ring-1 ring-indigo-400/20">
                  {score.advice}
                </p>
              )}
              {score.advice_reason && (
                <p className="mt-1.5 px-1 text-[11px] leading-relaxed text-white/35">{score.advice_reason}</p>
              )}
            </motion.div>
          ) : (
            <motion.p
              key="hint"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="px-1 text-xs text-white/35"
            >
              等待评分事件…
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* 三维度条：依次从 0 充能到分数 */}
      {score && score.dimensions.length > 0 && (
        <div className="mt-4 space-y-2.5 border-t border-white/10 pt-3.5">
          {score.dimensions.slice(0, 3).map((d, i) => (
            <div key={`${d.name}-${i}`} className="flex items-center gap-3" title={d.detail}>
              <span className="w-12 shrink-0 truncate text-xs text-white/60">{d.name}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-400 via-violet-400 to-purple-400"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(0, Math.min(100, d.score))}%` }}
                  transition={{ duration: 0.7, delay: 0.12 * i, ease: "easeOut" }}
                />
              </div>
              <span className="w-7 shrink-0 text-right text-xs font-semibold tabular-nums text-white/80">
                {Math.round(d.score)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
