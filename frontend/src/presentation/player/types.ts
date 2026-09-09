import type { ReactNode } from "react"

/**
 * 幻灯片定义。
 *
 * step 语义（对齐 reveal.js 的 fragment）：render 收到当前已揭示的 fragment 数，
 * 0 表示仅有底板、无任何 fragment 内容；幻灯片据此做分步展示。
 */
export interface SlideDef {
  /** 稳定标识，用于 overview 与调试 */
  id: string
  /** 章节角标（左上角小字） */
  section?: string
  /** 标题（overview 网格与无障碍描述用） */
  title: string
  /** fragment 总数；缺省 0 表示整页一步呈现 */
  fragments?: number
  render: (step: number) => ReactNode
}

/** 设计稿固定尺寸：所有幻灯片按此画布排版，播放器整体等比缩放适配视口。 */
export const STAGE_WIDTH = 1280
export const STAGE_HEIGHT = 720
