// 分析剧场：左侧 A4 简历纸张，行级状态机「normal → flagged（待优化）→ fixed（已修复）」
import { AnimatePresence, motion } from "framer-motion"

import type { ResumeStruct } from "@/api/types"

/** 单行标注状态：normal（正常）→ flagged（问题命中）→ fixed（改写命中） */
export type DocLineStatus = "normal" | "flagged" | "fixed"

export interface DocLine {
  id: string
  kind: "name" | "contact" | "section" | "item" | "text"
  text: string
  status: DocLineStatus
  /** fixed 态下滑入展示的改写句 */
  after?: string
}

/** 行匹配归一化：去掉全部空白字符后比较 */
export function normalizeText(s: string): string {
  return (s ?? "").replace(/\s+/g, "")
}

/** 从结构化简历构建文档行（姓名 / 联系方式 / 教育 / 工作 / 实习 / 项目 / 技能逐行 / 自我评价） */
export function buildDocLines(struct: ResumeStruct): DocLine[] {
  const lines: DocLine[] = []
  let uid = 0
  const push = (kind: DocLine["kind"], text: string) => {
    const t = (text ?? "").trim()
    if (!t) return
    lines.push({ id: `doc-${uid++}`, kind, text: t, status: "normal" })
  }
  // 时间线条目：标题行（主体 · 角色 · 时间）+ 逐条 highlights
  const pushTimeline = (
    items: { title?: string; subtitle?: string; period?: string; highlights?: string[] }[],
  ) => {
    items.forEach((it) => {
      push("item", [it.title, it.subtitle, it.period].filter(Boolean).join(" · "))
      ;(it.highlights ?? []).forEach((h) => push("text", h))
    })
  }

  push("name", struct.name)
  push("contact", [struct.phone, struct.email].filter(Boolean).join("　·　"))

  if (struct.education.length > 0) {
    push("section", "教育背景")
    struct.education.forEach((e) =>
      push("text", [e.school, e.major, e.degree, e.period].filter(Boolean).join(" · ")),
    )
  }
  if (struct.work.length > 0) {
    push("section", "工作经历")
    pushTimeline(
      struct.work.map((w) => ({ title: w.company, subtitle: w.position, period: w.period, highlights: w.highlights })),
    )
  }
  if (struct.internships.length > 0) {
    push("section", "实习经历")
    pushTimeline(
      struct.internships.map((w) => ({
        title: w.company,
        subtitle: w.position,
        period: w.period,
        highlights: w.highlights,
      })),
    )
  }
  if (struct.projects.length > 0) {
    push("section", "项目经历")
    pushTimeline(
      struct.projects.map((p) => ({ title: p.name, subtitle: p.role, period: p.period, highlights: p.highlights })),
    )
  }
  if (struct.skills.length > 0) {
    push("section", "专业技能")
    struct.skills.forEach((s) => push("text", s)) // 技能逐行
  }
  if (struct.awards.length > 0) {
    push("section", "获奖情况")
    struct.awards.forEach((a) => push("text", a))
  }
  if (struct.self_evaluation.trim()) {
    push("section", "自我评价")
    push("text", struct.self_evaluation)
  }
  return lines
}

/**
 * 在文档行中查找与 target 文本匹配的行下标（归一化后双向 includes），匹配不到返回 -1
 * 命中规则：行文本包含目标片段，或目标片段包含整行
 */
export function matchDocLine(lines: DocLine[], target: string): number {
  const t = normalizeText(target)
  if (!t) return -1
  for (let i = 0; i < lines.length; i++) {
    const line = normalizeText(lines[i].text)
    if (!line) continue
    if (line.includes(t) || t.includes(line)) return i
  }
  return -1
}

/** 按状态生成文本样式：flagged 红色波浪下划线 / fixed 灰色删除线 */
function statusTextCls(status: DocLineStatus): string {
  if (status === "flagged") return "underline decoration-red-500 decoration-wavy underline-offset-4"
  if (status === "fixed") return "text-slate-400 line-through decoration-slate-400"
  return ""
}

/** A4 白纸卡片：弹入后按行渲染，行状态变化时用 layout 动画避免跳帧 */
export default function ResumeDocLive({ lines }: { lines: DocLine[] }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 110, damping: 18 }}
      className="paper-scroll mx-auto h-full w-full max-w-[560px] overflow-y-auto rounded-xl bg-white px-7 py-6 shadow-2xl shadow-black/50 ring-1 ring-white/20"
    >
      {lines.map((line) => (
        <DocRow key={line.id} line={line} />
      ))}
      {/* 底部留白，模拟纸张 */}
      <div className="h-4" />
    </motion.div>
  )
}

/** 单行：文本 + 右侧浮动徽章 + fixed 态改写句滑入 */
function DocRow({ line }: { line: DocLine }) {
  const cls = statusTextCls(line.status)
  return (
    <motion.div layout className={`relative py-[3px] ${line.status !== "normal" ? "pr-16" : ""}`}>
      {line.kind === "name" && (
        <p className={`text-center text-[22px] font-bold leading-snug tracking-wide text-slate-900 ${cls}`}>
          {line.text}
        </p>
      )}
      {line.kind === "contact" && <p className={`text-center text-xs text-slate-500 ${cls}`}>{line.text}</p>}
      {line.kind === "section" && (
        <p className="mt-3.5 border-b border-slate-200 pb-1 text-sm font-semibold text-indigo-700">{line.text}</p>
      )}
      {line.kind === "item" && <p className={`mt-2 text-[13px] font-semibold text-slate-800 ${cls}`}>{line.text}</p>}
      {line.kind === "text" && (
        <p className="flex gap-2 text-[13px] leading-relaxed text-slate-600">
          <span className="mt-[7px] size-1 shrink-0 rounded-full bg-slate-300" />
          <span className={`min-w-0 flex-1 ${cls}`}>{line.text}</span>
        </p>
      )}

      {/* 右侧浮动状态徽章：待优化（红）/ 已修复 ✓（绿，弹跳） */}
      <AnimatePresence>
        {line.status === "flagged" && (
          <motion.span
            key="flag"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ type: "spring", stiffness: 380, damping: 20 }}
            className="absolute right-0 top-0.5 rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-600 ring-1 ring-red-200"
          >
            待优化
          </motion.span>
        )}
        {line.status === "fixed" && (
          <motion.span
            key="fix"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 12 }}
            className="absolute right-0 top-0.5 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 ring-1 ring-emerald-200"
          >
            已修复 ✓
          </motion.span>
        )}
      </AnimatePresence>

      {/* fixed：改写句以靛蓝左边框高亮块滑入 */}
      {line.status === "fixed" && line.after && (
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="mt-1 rounded-r-md border-l-2 border-indigo-500 bg-indigo-50/90 px-2.5 py-1.5 text-[13px] leading-relaxed text-slate-800"
        >
          {line.after}
        </motion.div>
      )}
    </motion.div>
  )
}
