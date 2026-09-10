import type { ReactNode } from "react"

import { Reveal, SlideFrame, SlideTitle } from "@/presentation/ui"

/**
 * 代码展示页的共享组件：轻量 Python 语法高亮（不引入第三方依赖）。
 * 代码片段全部节选自仓库真实源码，仅做缩进与行数裁剪。
 */

const TOKEN_RE =
  /(#[^\n]*)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|\b(def|return|for|in|if|elif|else|try|except|raise|from|import|with|as|while|class|lambda|None|True|False|not|and|or|is|yield|pass)\b|(\b\d+(?:\.\d+)?\b)/g

function highlightLine(line: string): ReactNode[] {
  const nodes: ReactNode[] = []
  let last = 0
  let m: RegExpExecArray | null
  let i = 0
  TOKEN_RE.lastIndex = 0
  while ((m = TOKEN_RE.exec(line))) {
    if (m.index > last) nodes.push(<span key={`t${i++}`}>{line.slice(last, m.index)}</span>)
    const [tok, comment, str, kw, num] = m
    const cls = comment
      ? "text-slate-500 italic"
      : str
        ? "text-emerald-300"
        : kw
          ? "text-violet-300"
          : num
            ? "text-amber-200"
            : ""
    nodes.push(
      <span key={`t${i++}`} className={cls}>
        {tok}
      </span>,
    )
    last = m.index + tok.length
  }
  if (last < line.length) nodes.push(<span key={`t${i++}`}>{line.slice(last)}</span>)
  return nodes
}

/** 1280×720 画布内代码区预算：标题区固定后，代码外层最多约 468px（含窗口栏与内边距，留 3px 余量）。 */
const CODE_MAX_H = 468
const CODE_HEADER_H = 40
const CODE_PAD_Y = 28
const LINE_RATIO = 1.5

/** 按行数自适应字号，保证整块代码落在画布内、不遮挡标题与页脚。 */
function fitFontSize(lines: number): number {
  const fit = (CODE_MAX_H - CODE_HEADER_H - CODE_PAD_Y) / lines / LINE_RATIO
  return Math.min(12.8, Math.max(9, Math.round(fit * 10) / 10))
}

export function CodeBlock({ file, code }: { file: string; code: string }) {
  const rawLines = code.replace(/^\n+|\n+$/g, "").split("\n")
  const indent = Math.min(
    ...rawLines.filter((l) => l.trim()).map((l) => l.match(/^ */)![0].length),
  )
  const lines = rawLines.map((l) => l.slice(indent))
  const fontSize = fitFontSize(lines.length)
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0D1220] shadow-[0_16px_40px_rgba(2,6,23,0.35)]">
      <div className="flex items-center gap-2 border-b border-white/[0.07] px-5 py-2.5">
        <span className="size-2.5 rounded-full bg-rose-400/70" />
        <span className="size-2.5 rounded-full bg-amber-300/70" />
        <span className="size-2.5 rounded-full bg-emerald-400/70" />
        <span className="ml-2 font-mono text-[12.5px] text-slate-400">{file}</span>
      </div>
      <pre
        className="overflow-hidden px-4 py-3.5 font-mono text-slate-200"
        style={{ fontSize, lineHeight: LINE_RATIO }}
      >
        {lines.map((line, idx) => (
          <div key={idx} className="flex">
            <span className="w-8 shrink-0 select-none pr-3.5 text-right text-slate-600">{idx + 1}</span>
            <span className="whitespace-pre">{line ? highlightLine(line) : "\u00A0"}</span>
          </div>
        ))}
      </pre>
    </div>
  )
}

export function CodeSlide({
  kicker,
  title,
  subtitle,
  file,
  code,
  notes,
  step,
}: {
  kicker: string
  title: string
  subtitle: string
  file: string
  code: string
  notes: { lead: string; text: string }[]
  step: number
}) {
  return (
    <SlideFrame>
      <SlideTitle kicker={kicker} title={title} subtitle={subtitle} />
      <div className="grid min-h-0 flex-1 grid-cols-[0.62fr_1.1fr] items-center gap-9">
        <div className="flex flex-col">
          {notes.map((n, i) => (
            <Reveal key={n.lead} at={i} step={step}>
              <div className={`py-3.5 ${i > 0 ? "border-t border-slate-100" : ""}`}>
                <p className="text-[16.5px] font-bold text-slate-900">{n.lead}</p>
                <p className="mt-1 text-[14px] leading-relaxed text-slate-500">{n.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <CodeBlock file={file} code={code} />
      </div>
    </SlideFrame>
  )
}
