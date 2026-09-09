import type { CSSProperties, ReactNode } from "react"

import { cn } from "@/lib/utils"

/**
 * 幻灯片排版原语。
 *
 * 画布固定 1280×720（见 player/types.ts），全部字号与间距按此画布设计，
 * 由 DeckPlayer 整体等比缩放适配视口。视觉语言与产品一致：
 * 靛蓝主色 + 玻璃拟态深色页（封面/章节）+ 浅色内容页的三明治结构。
 */

// ---------------------------------------------------------------------------
// Reveal：fragment 分步展示（step >= at+1 时显示）
// ---------------------------------------------------------------------------

export function Reveal({
  at,
  step,
  className,
  children,
}: {
  at: number
  step: number
  className?: string
  children: ReactNode
}) {
  const shown = step > at
  return (
    <div
      className={cn(
        "transition-all duration-500 ease-out",
        shown ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
        className,
      )}
    >
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Kicker：左上角小节标签
// ---------------------------------------------------------------------------

export function Kicker({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return (
    <p
      className={cn(
        "flex items-center gap-2 text-[13px] font-semibold tracking-[0.25em]",
        dark ? "text-indigo-300" : "text-indigo-600",
      )}
    >
      <span className={cn("size-1.5 rounded-[2px]", dark ? "bg-indigo-300" : "bg-indigo-500")} />
      {children}
    </p>
  )
}

// ---------------------------------------------------------------------------
// SlideFrame：整页骨架（浅色内容页 / 深色氛围页），含页脚品牌
// ---------------------------------------------------------------------------

const DARK_BG: CSSProperties = {
  background:
    "radial-gradient(120% 90% at 20% 0%, #2B2467 0%, #1B183F 42%, #0B0B14 100%)",
}

interface SlideFrameProps {
  dark?: boolean
  className?: string
  children: ReactNode
}

export function SlideFrame({ dark = false, className, children }: SlideFrameProps) {
  return (
    <div
      className={cn(
        "relative flex h-full w-full flex-col overflow-hidden",
        dark ? "text-white" : "bg-white text-slate-900",
      )}
      style={dark ? DARK_BG : undefined}
    >
      <div className={cn("flex min-h-0 flex-1 flex-col px-16 pb-12 pt-14", className)}>{children}</div>
      <div
        className={cn(
          "pointer-events-none absolute bottom-5 left-16 text-[12px] tracking-[0.18em]",
          dark ? "text-white/25" : "text-slate-300",
        )}
      >
        简跃 LEAPCV · 课程考核项目汇报
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// SlideTitle：内容页标题区（kicker + 标题 + 副题）
// ---------------------------------------------------------------------------

export function SlideTitle({
  kicker,
  title,
  subtitle,
  dark = false,
}: {
  kicker?: string
  title: string
  subtitle?: string
  dark?: boolean
}) {
  return (
    <header className="mb-8 shrink-0">
      {kicker && <Kicker dark={dark}>{kicker}</Kicker>}
      <h1
        className={cn(
          "mt-3 text-[38px] font-bold leading-tight tracking-tight",
          dark ? "text-white" : "text-slate-900",
        )}
      >
        {title}
      </h1>
      {subtitle && (
        <p className={cn("mt-2 text-[17px]", dark ? "text-white/50" : "text-slate-500")}>{subtitle}</p>
      )}
    </header>
  )
}

// ---------------------------------------------------------------------------
// Card：内容卡片（浅色页阴影卡 / 深色页玻璃卡）
// ---------------------------------------------------------------------------

export function Card({
  dark = false,
  className,
  children,
}: {
  dark?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        "rounded-2xl p-5",
        dark
          ? "border border-white/10 bg-white/[0.05] backdrop-blur-sm"
          : "border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_28px_rgba(15,23,42,0.07)]",
        className,
      )}
    >
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// BulletList：要点列表（加粗引导词 + 说明），行间发丝线分隔
// ---------------------------------------------------------------------------

export function BulletList({
  items,
  className,
  dense = false,
}: {
  items: { lead: string; text: string }[]
  className?: string
  dense?: boolean
}) {
  return (
    <ul className={cn("flex flex-col", className)}>
      {items.map((item, i) => (
        <li
          key={item.lead}
          className={cn(
            "flex items-start gap-3",
            dense ? "py-2" : "py-2.5",
            i > 0 && "border-t border-slate-100",
          )}
        >
          <span className="mt-[11px] size-1.5 shrink-0 rounded-full bg-indigo-500" />
          <p className="text-[16px] leading-relaxed text-slate-600">
            <span className="font-semibold text-slate-900">{item.lead}</span>
            <span className="mx-2 text-slate-300">·</span>
            {item.text}
          </p>
        </li>
      ))}
    </ul>
  )
}

// ---------------------------------------------------------------------------
// StatCallout：大数字强调
// ---------------------------------------------------------------------------

export function StatCallout({
  value,
  label,
  dark = false,
  accent = false,
}: {
  value: string
  label: string
  dark?: boolean
  accent?: boolean
}) {
  return (
    <div>
      <p
        className={cn(
          "text-[44px] font-bold leading-none tracking-tight",
          accent ? "text-indigo-500" : dark ? "text-white" : "text-slate-900",
        )}
      >
        {value}
      </p>
      <p className={cn("mt-2 text-[14px]", dark ? "text-white/50" : "text-slate-500")}>{label}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Chip：小型标签胶囊（深色页用）
// ---------------------------------------------------------------------------

export function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-white/15 bg-white/[0.06] px-4 py-1.5 text-[14px] text-white/70 backdrop-blur-sm">
      {children}
    </span>
  )
}
