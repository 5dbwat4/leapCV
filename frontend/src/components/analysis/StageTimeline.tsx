// 分析剧场：五阶段横向 stepper + 渐变进度条
import { Check, Loader2 } from "lucide-react"
import { motion } from "framer-motion"

import { STAGES, type StageStatus } from "@/components/StageProgress"

interface StageTimelineProps {
  statusMap: Record<string, StageStatus>
  /** 0-100 的整体进度（来自 progress 事件） */
  progress: number
}

/** 顶栏下方的阶段时间轴：当前阶段脉冲高亮、完成打勾，下方整条进度条按 spring 平滑增长 */
export default function StageTimeline({ statusMap, progress }: StageTimelineProps) {
  const statuses = STAGES.map((s) => statusMap[s.key] ?? "pending")
  const allDone = statuses.every((s) => s === "done")

  // 连接线填充到最近一个「完成 / 进行中」的阶段中心（5 个阶段均分宽度，中心在 i*25% 处）
  let lastActive = 0
  statuses.forEach((s, i) => {
    if (s === "done" || s === "running") lastActive = i
  })
  const linePct = allDone ? 100 : (lastActive / (STAGES.length - 1)) * 100

  return (
    <div>
      {/* 阶段 stepper */}
      <div className="relative">
        {/* 底层连接线（跨越首尾两个阶段圆点的中心） */}
        <div className="absolute inset-x-[10%] top-[13px] h-px bg-white/10" />
        <div className="absolute inset-x-[10%] top-[13px] h-px">
          <motion.div
            className="h-full bg-gradient-to-r from-indigo-400 to-purple-400"
            animate={{ width: `${linePct}%` }}
            transition={{ type: "spring", stiffness: 70, damping: 20 }}
          />
        </div>
        <ol className="relative flex">
          {STAGES.map((stage, i) => {
            const status = statuses[i]
            return (
              <li key={stage.key} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                <span
                  className={`relative flex size-7 items-center justify-center rounded-full border text-[11px] font-medium ${
                    status === "done"
                      ? "border-emerald-400/60 bg-emerald-400/20 text-emerald-300"
                      : status === "running"
                        ? "border-indigo-400 bg-indigo-500/25 text-white"
                        : status === "error"
                          ? "border-red-400/60 bg-red-500/20 text-red-300"
                          : "border-white/15 bg-white/5 text-white/40"
                  }`}
                >
                  {/* 进行中：外圈脉冲 */}
                  {status === "running" && (
                    <motion.span
                      className="absolute inset-0 rounded-full border border-indigo-400"
                      animate={{ scale: [1, 1.55], opacity: [0.8, 0] }}
                      transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut" }}
                    />
                  )}
                  {status === "done" ? (
                    <Check className="size-3.5" />
                  ) : status === "running" ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : status === "error" ? (
                    "!"
                  ) : (
                    i + 1
                  )}
                </span>
                <span
                  className={`max-w-full truncate text-[11px] ${
                    status === "running"
                      ? "font-medium text-indigo-200"
                      : status === "done"
                        ? "text-white/75"
                        : "text-white/35"
                  }`}
                >
                  {stage.label}
                </span>
              </li>
            )
          })}
        </ol>
      </div>

      {/* 整条渐变进度条：按 progress 事件 spring 平滑增长 */}
      <div className="mt-3.5 h-1.5 overflow-hidden rounded-full bg-white/10">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-300"
          animate={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
          transition={{ type: "spring", stiffness: 60, damping: 20 }}
        />
      </div>
    </div>
  )
}
