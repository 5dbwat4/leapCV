import { motion } from "framer-motion"

import type { SlideDef } from "./types"

interface OverviewProps {
  slides: SlideDef[]
  index: number
  onJump: (index: number) => void
  onClose: () => void
}

/** 总览网格（快捷键 O）：全部页面的章节与标题索引，点击跳转。 */
export default function Overview({ slides, index, onJump, onClose }: OverviewProps) {
  return (
    <motion.div
      className="absolute inset-0 z-40 overflow-auto bg-[#0B0B14]/95 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      onClick={onClose}
    >
      <div className="mx-auto flex min-h-full max-w-5xl flex-col px-10 py-10" onClick={(e) => e.stopPropagation()}>
        <div className="mb-6 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold tracking-wide text-white/80">目录总览</h2>
          <p className="font-mono text-xs text-white/30">O / Esc 关闭 · 点击页面跳转</p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {slides.map((slide, i) => {
            const active = i === index
            return (
              <button
                key={slide.id}
                type="button"
                onClick={() => {
                  onJump(i)
                  onClose()
                }}
                className={`group rounded-xl border px-4 py-3.5 text-left transition-colors ${
                  active
                    ? "border-indigo-400/60 bg-indigo-500/15"
                    : "border-white/10 bg-white/[0.04] hover:border-white/25 hover:bg-white/[0.08]"
                }`}
              >
                <p className={`font-mono text-[11px] ${active ? "text-indigo-300" : "text-white/30"}`}>
                  {String(i + 1).padStart(2, "0")}
                </p>
                <p className={`mt-1 truncate text-sm font-medium ${active ? "text-white" : "text-white/70"}`}>
                  {slide.title}
                </p>
                {slide.section && <p className="mt-0.5 truncate text-xs text-white/35">{slide.section}</p>}
              </button>
            )
          })}
        </div>
      </div>
    </motion.div>
  )
}
