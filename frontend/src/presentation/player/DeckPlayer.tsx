import { useCallback, useEffect, useLayoutEffect, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"

import { STAGE_HEIGHT, STAGE_WIDTH, type SlideDef } from "./types"

interface DeckPlayerProps {
  slides: SlideDef[]
}

function readHashIndex(total: number): number {
  const m = /^#(\d+)$/.exec(window.location.hash)
  if (!m) return 0
  const n = Number(m[1])
  return Number.isInteger(n) && n >= 1 && n <= total ? n - 1 : 0
}

/** reveal 风格播放器：固定画布等比缩放 + 键盘/哈希导航 + fragment 分步。 */
export default function DeckPlayer({ slides }: DeckPlayerProps) {
  const [index, setIndex] = useState(() => readHashIndex(slides.length))
  const [step, setStep] = useState(0)
  const [scale, setScale] = useState(1)
  const [direction, setDirection] = useState(1)

  const fragments = slides[index]?.fragments ?? 0

  const go = useCallback(
    (next: number, atStep = 0) => {
      setIndex((cur) => {
        const clamped = Math.max(0, Math.min(slides.length - 1, next))
        if (clamped !== cur) setDirection(clamped > cur ? 1 : -1)
        return clamped
      })
      setStep(Math.max(0, atStep))
    },
    [slides.length],
  )

  const next = useCallback(() => {
    if (step < fragments) {
      setStep(step + 1)
    } else if (index < slides.length - 1) {
      go(index + 1)
    }
  }, [fragments, go, index, slides.length, step])

  const prev = useCallback(() => {
    if (step > 0) {
      setStep(step - 1)
    } else if (index > 0) {
      const prevFragments = slides[index - 1]?.fragments ?? 0
      go(index - 1, prevFragments)
    }
  }, [go, index, slides, step])

  // 视口自适应：1280×720 画布整体等比缩放
  useLayoutEffect(() => {
    const fit = () =>
      setScale(Math.min(window.innerWidth / STAGE_WIDTH, window.innerHeight / STAGE_HEIGHT))
    fit()
    window.addEventListener("resize", fit)
    return () => window.removeEventListener("resize", fit)
  }, [])

  // 键盘导航（对齐 reveal.js 惯例）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowRight":
        case "ArrowDown":
        case "PageDown":
        case " ":
        case "Enter":
          e.preventDefault()
          next()
          break
        case "ArrowLeft":
        case "ArrowUp":
        case "PageUp":
          e.preventDefault()
          prev()
          break
        case "Home":
          e.preventDefault()
          go(0)
          break
        case "End":
          e.preventDefault()
          go(slides.length - 1)
          break
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [go, next, prev, slides.length])

  // URL 哈希同步：#/N，可直接定位到第 N 页
  useEffect(() => {
    window.history.replaceState(null, "", `#${index + 1}`)
  }, [index])

  const slide = slides[index]
  const progress = slides.length ? ((index + 1) / slides.length) * 100 : 0

  return (
    <div className="relative h-svh w-full overflow-hidden bg-[#0B0B14]">
      <div className="flex h-full w-full items-center justify-center">
        <div
          className="relative shrink-0 overflow-hidden shadow-2xl shadow-black/60"
          style={{
            width: STAGE_WIDTH,
            height: STAGE_HEIGHT,
            transform: `scale(${scale})`,
          }}
        >
          <AnimatePresence custom={direction} mode="popLayout" initial={false}>
            <motion.div
              key={slide?.id ?? index}
              className="absolute inset-0"
              custom={direction}
              initial={{ opacity: 0, x: 56 * direction }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -56 * direction }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            >
              {slide?.render(step)}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* 底部进度条 */}
      <div className="absolute inset-x-0 bottom-0 h-1 bg-white/10">
        <div
          className="h-full bg-gradient-to-r from-indigo-500 to-violet-400 transition-[width] duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* 页码指示 */}
      <div className="absolute bottom-4 right-5 font-mono text-xs tracking-wider text-white/40">
        {index + 1} / {slides.length}
      </div>
    </div>
  )
}
