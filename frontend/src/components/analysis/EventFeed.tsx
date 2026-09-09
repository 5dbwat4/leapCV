// 分析剧场：技能芯片墙 + 实时优化动态流
import { useEffect, useRef } from "react"
import type { ReactNode } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { AlertTriangle, Check, CheckCircle2, HelpCircle, Plus, ShieldAlert, Sparkles, XCircle } from "lucide-react"

import type { SkillCheckEvent } from "@/api/types"

/** 动态流条目（由 issue / rewrite / skill / question 作答归一而来） */
export interface FeedItem {
  id: number
  kind: "issue" | "rewrite" | "skill" | "answer"
  title: string
  detail?: string
  severity?: string
  before?: string
  after?: string
  hit?: boolean
}

/** 右栏第 2 块：技能芯片墙，skill 事件逐个弹入（命中绿色 ✓ / 缺失琥珀色 +） */
export function SkillWall({ skills }: { skills: SkillCheckEvent[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <AnimatePresence>
        {skills.map((s, i) => (
          <motion.span
            key={`${s.name}-${i}`}
            layout
            initial={{ opacity: 0, scale: 0.4, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.4 }}
            transition={{ type: "spring", stiffness: 380, damping: 22 }}
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${
              s.hit
                ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                : "border-amber-400/30 bg-amber-400/10 text-amber-300"
            }`}
          >
            {s.hit ? <Check className="size-3" /> : <Plus className="size-3" />}
            {s.name}
          </motion.span>
        ))}
      </AnimatePresence>
    </div>
  )
}

/** 按 kind / severity 决定卡片左边框与图标配色 */
function feedCardStyle(item: FeedItem): { border: string; iconCls: string; icon: ReactNode } {
  if (item.kind === "rewrite") {
    return { border: "border-l-2 border-l-indigo-400", iconCls: "text-indigo-300", icon: <Sparkles className="size-3.5" /> }
  }
  if (item.kind === "answer") {
    return { border: "border-l-2 border-l-violet-400", iconCls: "text-violet-300", icon: <HelpCircle className="size-3.5" /> }
  }
  if (item.kind === "skill") {
    return item.hit
      ? { border: "border-l-2 border-l-emerald-400", iconCls: "text-emerald-300", icon: <CheckCircle2 className="size-3.5" /> }
      : { border: "border-l-2 border-l-amber-400", iconCls: "text-amber-300", icon: <XCircle className="size-3.5" /> }
  }
  // issue：按严重程度着色
  if (item.severity === "高") {
    return { border: "border-l-2 border-l-red-400", iconCls: "text-red-300", icon: <AlertTriangle className="size-3.5" /> }
  }
  if (item.severity === "中") {
    return { border: "border-l-2 border-l-amber-400", iconCls: "text-amber-300", icon: <ShieldAlert className="size-3.5" /> }
  }
  return { border: "border-l-2 border-l-slate-400", iconCls: "text-slate-300", icon: <ShieldAlert className="size-3.5" /> }
}

/** 单张动态小卡：图标 + 摘要 1~2 行（rewrite 展示 before 删除线 → after） */
function FeedCard({ item }: { item: FeedItem }) {
  const style = feedCardStyle(item)
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 28 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={`rounded-xl border border-white/10 bg-white/[0.04] p-2.5 ${style.border}`}
    >
      <div className="flex items-start gap-2">
        <span className={`mt-0.5 shrink-0 ${style.iconCls}`}>{style.icon}</span>
        <div className="min-w-0 flex-1">
          {item.kind === "rewrite" && item.before ? (
            <p className="break-all text-xs leading-relaxed">
              <span className="text-white/40 line-through">{item.before}</span>
              <span className="mx-1 text-indigo-300">→</span>
              <span className="text-indigo-200">{item.after}</span>
            </p>
          ) : (
            <p className="flex items-center gap-1.5 text-xs font-medium text-white/85">
              <span className="min-w-0 flex-1 truncate">{item.title}</span>
              {item.kind === "issue" && item.severity && (
                <span
                  className={`shrink-0 rounded px-1 py-px text-[10px] ${
                    item.severity === "高"
                      ? "bg-red-500/15 text-red-300"
                      : item.severity === "中"
                        ? "bg-amber-500/15 text-amber-300"
                        : "bg-slate-500/20 text-slate-300"
                  }`}
                >
                  {item.severity}
                </span>
              )}
            </p>
          )}
          {item.detail && (
            <p className="mt-0.5 line-clamp-2 break-all text-[11px] leading-relaxed text-white/45">{item.detail}</p>
          )}
        </div>
      </div>
    </motion.div>
  )
}

/** 右栏第 3 块：实时动态流，自动滚到底部（条目在 AnalysisTheater 中截断至最多 60 条） */
export default function EventFeed({ items }: { items: FeedItem[] }) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // 新条目到达时平滑滚到底部
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTo({ top: el.scrollHeight })
  }, [items.length])

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-white/10 bg-white/[0.06] backdrop-blur-xl">
      <div className="flex shrink-0 items-center gap-2 border-b border-white/10 px-4 py-2.5">
        <span className="text-sm font-semibold text-white/90">优化动态</span>
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium tabular-nums text-white/60">
          {items.length}
        </span>
      </div>
      <div ref={scrollRef} className="theater-scroll min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {items.length === 0 && <p className="py-8 text-center text-xs text-white/30">等待诊断与改写事件…</p>}
        <AnimatePresence>
          {items.map((item) => (
            <FeedCard key={item.id} item={item} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}
