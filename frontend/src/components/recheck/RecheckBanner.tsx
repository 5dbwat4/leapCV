// 复检完成后的对比横幅：旧分 → 新分 + 各维度 delta（数字带 rAF count-up 动画）
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowRight, BadgeCheck, History } from "lucide-react"

import type { MatchDimension } from "@/api/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

/** 复检时通过路由 state 传入的上次分析信息 */
export interface RecheckState {
  prevTotal: number
  prevDimensions: MatchDimension[]
  prevId: number | string
}

/** 简易数字滚动 hook：用 requestAnimationFrame 在 duration 毫秒内从 from 缓动到 to */
function useCountUp(from: number, to: number, duration = 500): number {
  const [value, setValue] = useState(from)

  useEffect(() => {
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3) // easeOutCubic
      setValue(from + (to - from) * eased)
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [from, to, duration])

  return value
}

/** delta 徽章/文字的配色：正绿负红零灰 */
function deltaClass(delta: number): string {
  if (delta > 0) return "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
  if (delta < 0) return "bg-red-100 text-red-700 hover:bg-red-100"
  return "bg-muted text-muted-foreground hover:bg-muted"
}

function formatDelta(delta: number): string {
  return delta > 0 ? `+${delta}` : `${delta}`
}

interface RecheckBannerProps {
  state: RecheckState
  newTotal: number
  newDimensions: MatchDimension[]
}

export default function RecheckBanner({ state, newTotal, newDimensions }: RecheckBannerProps) {
  const navigate = useNavigate()
  const { prevTotal, prevDimensions, prevId } = state

  // 新分数从旧分开始滚动，形成「72 → 85」的动态对比
  const displayTotal = useCountUp(prevTotal, newTotal, 600)
  const totalDelta = newTotal - prevTotal

  // 逐维度对比（按维度名称对齐，如 技能匹配 / 工作经验 / 教育背景）
  const dimensionDeltas = newDimensions.map((d) => {
    const prev = prevDimensions.find((p) => p.name === d.name)
    return { name: d.name, delta: prev ? d.score - prev.score : null }
  })

  return (
    <div className="no-print flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-emerald-200/70 bg-gradient-to-r from-emerald-500/15 to-primary/10 px-4 py-3">
      <div className="flex items-center gap-2">
        <BadgeCheck className="size-5 shrink-0 text-emerald-600" />
        <div>
          <p className="text-sm font-semibold">复检完成</p>
          <p className="text-xs text-muted-foreground">已用优化稿针对同一岗位重新分析</p>
        </div>
      </div>

      {/* 总分对比：72 → 85 + delta 徽章 */}
      <div className="flex items-center gap-3">
        <span className="text-2xl font-bold tabular-nums text-muted-foreground">{prevTotal}</span>
        <ArrowRight className="size-5 text-muted-foreground/60" />
        <span className="text-3xl font-bold tabular-nums text-primary">{Math.round(displayTotal)}</span>
        <Badge className={`text-sm font-semibold ${deltaClass(totalDelta)}`}>
          {formatDelta(totalDelta)}
        </Badge>
      </div>

      {/* 三个维度的小 delta */}
      {dimensionDeltas.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {dimensionDeltas.map((d) => (
            <span key={d.name} className="flex items-center gap-1">
              {d.name}
              {d.delta != null ? (
                <b
                  className={`tabular-nums ${
                    d.delta > 0 ? "text-emerald-600" : d.delta < 0 ? "text-red-600" : "text-muted-foreground"
                  }`}
                >
                  {formatDelta(d.delta)}
                </b>
              ) : (
                <b className="text-muted-foreground">—</b>
              )}
            </span>
          ))}
        </div>
      )}

      {/* 查看上次分析（不带 state，避免连环横幅） */}
      <Button
        variant="outline"
        size="sm"
        className="ml-auto gap-1.5"
        onClick={() => navigate(`/result/${prevId}`)}
      >
        <History className="size-3.5" />
        查看上次分析
      </Button>
    </div>
  )
}
