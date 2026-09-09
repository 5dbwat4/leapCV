// 分析剧场：全屏 AI 分析实时可视化（深紫渐变背景 + 玻璃拟态 + 简历纸张实时标注）
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Check, Loader2, RotateCcw } from "lucide-react"

import { normalizeResumeStruct } from "@/api"
import type {
  IssueEvent,
  JdStructEvent,
  QuickCheckEvent,
  RewriteEvent,
  ScoreEvent,
  SkillCheckEvent,
} from "@/api/types"
import type { StageStatus } from "@/components/StageProgress"
import EventFeed, { SkillWall, type FeedItem } from "./EventFeed"
import { QuickCheckOverlay } from "./QuickCheckCard"
import ResumeDocLive, { buildDocLines, matchDocLine, type DocLine } from "./ResumeDocLive"
import ScorePanel from "./ScorePanel"
import StageTimeline from "./StageTimeline"
import "@/styles/analysis.css"

/**
 * 剧场事件总线：Workbench 发射细粒度 SSE 事件，剧场订阅消费。
 * 订阅前产生的事件会先缓存、订阅时重放，保证剧场挂载间隙的事件不丢。
 */
export class TheaterEventBus {
  private listeners = new Set<(event: string, data: unknown) => void>()
  private buffer: { event: string; data: unknown }[] = []

  emit(event: string, data: unknown): void {
    if (this.listeners.size === 0) {
      // 剧场尚未挂载：先缓存（上限 200 条，防异常情况下无限膨胀）
      this.buffer.push({ event, data })
      if (this.buffer.length > 200) this.buffer.shift()
      return
    }
    this.listeners.forEach((fn) => fn(event, data))
  }

  subscribe(fn: (event: string, data: unknown) => void): () => void {
    this.listeners.add(fn)
    // 重放订阅前缓存的事件
    const buffered = this.buffer
    this.buffer = []
    for (const { event, data } of buffered) fn(event, data)
    return () => {
      this.listeners.delete(fn)
    }
  }
}

export type TheaterPhase = "running" | "done" | "error"

interface AnalysisTheaterProps {
  /** Workbench 持有的剧场事件总线（每次分析新建，配合 key 重挂载重置内部状态） */
  bus: TheaterEventBus
  statusMap: Record<string, StageStatus>
  /** 0-100 整体进度（progress 事件） */
  progress: number
  message: string | null
  phase: TheaterPhase
  error: string | null
  /** 取消（运行中=中断分析）/ 返回工作台（出错时） */
  onCancel: () => void
  /** 出错重试 */
  onRetry: () => void
}

const FEED_MAX = 60 // 动态流最多保留条数，避免长任务 DOM 膨胀

export default function AnalysisTheater({
  bus,
  statusMap,
  progress,
  message,
  phase,
  error,
  onCancel,
  onRetry,
}: AnalysisTheaterProps) {
  const [lines, setLines] = useState<DocLine[] | null>(null)
  const [jd, setJd] = useState<JdStructEvent | null>(null)
  const [score, setScore] = useState<ScoreEvent | null>(null)
  const [skills, setSkills] = useState<SkillCheckEvent[]>([])
  const [feed, setFeed] = useState<FeedItem[]>([])
  // 阶段五 Quick check：question 事件到达时弹出浮层卡片，作答后收起
  const [question, setQuestion] = useState<QuickCheckEvent | null>(null)
  const feedIdRef = useRef(0)

  // 动态流追加（issue / rewrite / skill / answer 共用），超出上限截断
  const pushFeed = useCallback((item: Omit<FeedItem, "id">) => {
    setFeed((prev) => {
      const next = [...prev, { ...item, id: feedIdRef.current++ }]
      return next.length > FEED_MAX ? next.slice(next.length - FEED_MAX) : next
    })
  }, [])

  // Quick check 作答完成：收起卡片并写入动态流
  const handleQuickCheckDone = useCallback(
    (answer: string | null) => {
      setQuestion((q) => {
        pushFeed({
          kind: "answer",
          title: answer ? `已补充：${answer}` : "已跳过补充",
          detail: q?.section ? `用于改写：${q.section}` : undefined,
        })
        return null
      })
    },
    [pushFeed],
  )

  // 订阅事件总线：把细粒度 SSE 事件归约为剧场各分区状态
  useEffect(() => {
    // 行内标注：按归一化文本匹配文档行；匹配不到则只进右栏动态流，文档不标
    const markLine = (target: string, mark: (line: DocLine) => DocLine) => {
      setLines((prev) => {
        if (!prev) return prev
        const idx = matchDocLine(prev, target)
        if (idx === -1) return prev
        const next = [...prev]
        next[idx] = mark(next[idx])
        return next
      })
    }

    return bus.subscribe((event, data) => {
      switch (event) {
        case "resume_struct": {
          // 完整结构化简历：复用 API 层的容错归一化，构建 A4 文档行
          setLines(buildDocLines(normalizeResumeStruct(data)))
          break
        }
        case "jd_struct": {
          setJd((data ?? {}) as JdStructEvent)
          break
        }
        case "score": {
          setScore((data ?? {}) as ScoreEvent)
          break
        }
        case "skill": {
          const s = (data ?? {}) as SkillCheckEvent
          setSkills((prev) => [...prev, s])
          pushFeed({
            kind: "skill",
            title: `${s.hit ? "技能命中" : "技能缺失"}：${s.name}`,
            detail: s.detail,
            hit: s.hit,
          })
          break
        }
        case "issue": {
          const iss = (data ?? {}) as IssueEvent
          // 命中行：normal → flagged（红色波浪下划线 + 待优化徽章）
          markLine(iss.original ?? "", (line) => (line.status === "normal" ? { ...line, status: "flagged" } : line))
          pushFeed({
            kind: "issue",
            title: iss.type || "简历问题",
            detail: [iss.problem, iss.suggestion].filter(Boolean).join(" → "),
            severity: iss.severity,
          })
          break
        }
        case "question": {
          // 管线已暂停：弹出 Quick check 卡片等待作答
          setQuestion((data ?? {}) as QuickCheckEvent)
          break
        }
        case "rewrite": {
          const rw = (data ?? {}) as RewriteEvent
          // 命中行：→ fixed（原句删除线 + after 滑入）
          markLine(rw.before ?? "", (line) => ({ ...line, status: "fixed", after: rw.after }))
          pushFeed({
            kind: "rewrite",
            title: rw.section || "内容重构",
            detail: rw.reason,
            before: rw.before,
            after: rw.after,
          })
          break
        }
        default:
          break
      }
      })
  }, [bus, pushFeed])

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-950 text-white">
      {/* 背景：缓慢漂移的模糊光斑（CSS 动画）+ 细网格 */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="theater-blob theater-blob-1" />
        <div className="theater-blob theater-blob-2" />
        <div className="theater-blob theater-blob-3" />
        <div className="theater-grid" />
      </div>

      <div className="relative flex h-full flex-col">
        {/* 顶栏：macOS 三圆点 + 标题 + 状态 pill + 取消 */}
        <header className="flex shrink-0 items-center gap-3 border-b border-white/10 bg-white/[0.03] px-5 py-3 backdrop-blur-md">
          <div className="flex gap-1.5">
            <span className="size-3 rounded-full bg-[#ff5f57]" />
            <span className="size-3 rounded-full bg-[#febc2e]" />
            <span className="size-3 rounded-full bg-[#28c840]" />
          </div>
          <span className="truncate text-xs font-semibold uppercase tracking-[0.35em] text-white/70">
            LeapCV · AI 分析引擎
          </span>
          {jd?.position_name && (
            <span className="hidden shrink-0 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/60 md:inline">
              目标：{jd.position_name}
            </span>
          )}
          <div className="ml-auto shrink-0">
            {phase === "running" && (
              <span className="flex items-center gap-2 rounded-full border border-indigo-400/30 bg-indigo-500/10 px-3 py-1.5 text-xs text-indigo-200">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-indigo-400 opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-indigo-400" />
                </span>
                <span className="max-w-[280px] truncate">{message || "AI 正在优化你的简历…"}</span>
              </span>
            )}
            {phase === "done" && (
              <span className="flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-medium text-emerald-300">
                <Check className="size-3.5" />
                分析完成
              </span>
            )}
            {phase === "error" && (
              <span className="flex items-center gap-2 rounded-full border border-red-400/40 bg-red-500/15 px-3 py-1.5 text-xs font-medium text-red-300">
                <span className="size-2 rounded-full bg-red-400" />
                分析失败
              </span>
            )}
          </div>
          {phase === "running" && (
            <button
              onClick={onCancel}
              className="shrink-0 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/60 transition-colors hover:border-white/25 hover:text-white"
            >
              取消分析
            </button>
          )}
        </header>

        {/* 阶段时间轴 */}
        <div className="shrink-0 px-6 pt-4">
          <StageTimeline statusMap={statusMap} progress={progress} />
        </div>

        {/* 主体两栏：左简历纸张 ~58% / 右数据面板 ~42% */}
        {!lines ? (
          // 简历解析中：右栏数据面板尚未产生，先整体留白等待
          <div className="flex flex-1 items-center justify-center p-5">
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-white/15 bg-white/[0.03] px-10 py-12 text-white/50 backdrop-blur-sm">
              <Loader2 className="size-6 animate-spin text-indigo-300" />
              <p className="text-sm">正在解析简历结构…</p>
            </div>
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-5 lg:grid-cols-[58fr_42fr] lg:overflow-hidden">
            {/* 左栏：A4 简历纸张 */}
            <div className="relative flex min-h-0 flex-col">
              <ResumeDocLive lines={lines} />
            </div>

            {/* 右栏：解析完成后从右侧滑入，匹配分 / 技能芯片墙 / 动态流依次浮现 */}
            <motion.div
              initial={{ opacity: 0, x: 48 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ type: "spring", stiffness: 110, damping: 20 }}
              className="flex min-h-0 flex-col gap-4"
            >
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.4, ease: "easeOut" }}
              >
                <ScorePanel score={score} />
              </motion.div>
              {skills.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1, duration: 0.4, ease: "easeOut" }}
                  className="shrink-0 rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-xl"
                >
                  <div className="mb-2.5 flex items-center gap-2 text-sm font-semibold text-white/90">
                    技能匹配
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium tabular-nums text-white/60">
                      命中 {skills.filter((s) => s.hit).length} · 缺失 {skills.filter((s) => !s.hit).length}
                    </span>
                  </div>
                  <div className="theater-scroll max-h-24 overflow-y-auto">
                    <SkillWall skills={skills} />
                  </div>
                </motion.div>
              )}
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.28, duration: 0.4, ease: "easeOut" }}
                className="flex min-h-0 flex-1 flex-col"
              >
                <EventFeed items={feed} />
              </motion.div>
            </motion.div>
          </div>
        )}
      </div>

      {/* 阶段五 Quick check：管线暂停等待作答的浮层卡片 */}
      <QuickCheckOverlay question={question} onDone={handleQuickCheckDone} />

      {/* 出错：底部错误条 + 重试 / 返回 */}
      <AnimatePresence>
        {phase === "error" && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-x-0 bottom-6 z-10 flex justify-center px-4"
          >
            <div className="flex flex-wrap items-center justify-center gap-3 rounded-xl border border-red-400/40 bg-red-950/80 px-4 py-3 shadow-2xl shadow-red-950/50 backdrop-blur-xl">
              <span className="max-w-md text-sm text-red-200">{error || "分析失败，请稍后重试"}</span>
              <button
                onClick={onRetry}
                className="flex items-center gap-1.5 rounded-lg bg-red-500/90 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-500"
              >
                <RotateCcw className="size-3.5" />
                重试
              </button>
              <button
                onClick={onCancel}
                className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white/70 transition-colors hover:text-white"
              >
                返回工作台
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 收尾庆祝态：confetti 粒子 burst + 大勾（约 0.8s，随后由 Workbench 跳转结果页） */}
      <AnimatePresence>{phase === "done" && <Celebration />}</AnimatePresence>
    </div>
  )
}

const CONFETTI_COLORS = ["#818cf8", "#c084fc", "#22d3ee", "#34d399", "#fbbf24", "#f472b6"]

/** 全屏庆祝态：中心大勾 spring 弹出 + 28 颗 confetti 粒子向外爆开 */
function Celebration() {
  const particles = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => ({
        angle: (i / 28) * Math.PI * 2 + Math.random() * 0.5,
        dist: 120 + Math.random() * 160,
        size: 5 + Math.random() * 6,
        rotate: Math.random() * 360,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        delay: Math.random() * 0.1,
      })),
    [],
  )
  return (
    <motion.div
      className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
      exit={{ opacity: 0 }}
    >
      {/* 轻微压暗背景，突出庆祝动画 */}
      <motion.div
        className="absolute inset-0 bg-slate-950/40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
      />
      <div className="relative">
        {particles.map((p, i) => (
          <motion.span
            key={i}
            className="absolute rounded-sm"
            style={{ width: p.size, height: p.size * 0.6, backgroundColor: p.color }}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{
              x: Math.cos(p.angle) * p.dist,
              y: Math.sin(p.angle) * p.dist - 40,
              opacity: 0,
              scale: 0.4,
              rotate: p.rotate,
            }}
            transition={{ duration: 0.8, delay: p.delay, ease: "easeOut" }}
          />
        ))}
        <motion.div
          initial={{ scale: 0, rotate: -30 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 14 }}
          className="flex size-24 items-center justify-center rounded-full bg-emerald-500 shadow-2xl shadow-emerald-500/40"
        >
          <Check className="size-12 text-white" strokeWidth={3} />
        </motion.div>
      </div>
    </motion.div>
  )
}
