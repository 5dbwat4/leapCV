import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { ChevronLeft, ChevronRight, CircleHelp, LayoutGrid, Maximize, Minimize } from "lucide-react"

import { STAGE_HEIGHT, STAGE_WIDTH, type SlideDef } from "./types"
import HelpOverlay from "./HelpOverlay"
import Overview from "./Overview"

interface DeckPlayerProps {
  slides: SlideDef[]
}

function readHashIndex(total: number): number {
  const m = /^#(\d+)$/.exec(window.location.hash)
  if (!m) return 0
  const n = Number(m[1])
  return Number.isInteger(n) && n >= 1 && n <= total ? n - 1 : 0
}

/** reveal 风格播放器：固定画布等比缩放 + 键盘/触摸/哈希导航 + fragment 分步 + 总览。 */
export default function DeckPlayer({ slides }: DeckPlayerProps) {
  const [index, setIndex] = useState(() => readHashIndex(slides.length))
  const [step, setStep] = useState(0)
  const [scale, setScale] = useState(1)
  const [direction, setDirection] = useState(1)
  const [overviewOpen, setOverviewOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const touchStart = useRef<{ x: number; y: number } | null>(null)

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

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen()
    } else {
      void document.documentElement.requestFullscreen()
    }
  }, [])

  // 视口自适应：1280×720 画布整体等比缩放
  useLayoutEffect(() => {
    const fit = () =>
      setScale(Math.min(window.innerWidth / STAGE_WIDTH, window.innerHeight / STAGE_HEIGHT))
    fit()
    window.addEventListener("resize", fit)
    return () => window.removeEventListener("resize", fit)
  }, [])

  useEffect(() => {
    const onFullscreenChange = () => setFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener("fullscreenchange", onFullscreenChange)
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange)
  }, [])

  // 键盘导航（对齐 reveal.js 惯例）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (helpOpen) setHelpOpen(false)
        else if (overviewOpen) setOverviewOpen(false)
        return
      }
      if (e.key === "?" || e.key === "/") {
        e.preventDefault()
        setHelpOpen((v) => !v)
        return
      }
      if (e.key === "o" || e.key === "O") {
        setOverviewOpen((v) => !v)
        return
      }
      if (e.key === "f" || e.key === "F") {
        toggleFullscreen()
        return
      }
      if (overviewOpen) {
        // 总览模式下方向键直接翻页
        if (e.key === "ArrowRight" || e.key === "ArrowDown") go(index + 1)
        if (e.key === "ArrowLeft" || e.key === "ArrowUp") go(index - 1)
        return
      }
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
  }, [go, helpOpen, index, next, overviewOpen, prev, slides.length, toggleFullscreen])

  // URL 哈希同步：#/N，可直接定位到第 N 页
  useEffect(() => {
    window.history.replaceState(null, "", `#${index + 1}`)
  }, [index])

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0]
    touchStart.current = { x: t.clientX, y: t.clientY }
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStart.current
    if (!start) return
    touchStart.current = null
    const t = e.changedTouches[0]
    const dx = t.clientX - start.x
    const dy = t.clientY - start.y
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx < 0) next()
      else prev()
    }
  }

  const slide = slides[index]
  const progress = slides.length ? ((index + 1) / slides.length) * 100 : 0

  return (
    <div
      className="relative h-svh w-full touch-pan-y select-none overflow-hidden bg-[#0B0B14]"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
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

      {/* 控制栏 */}
      <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/10 bg-white/[0.06] px-2 py-1.5 backdrop-blur-md">
        <ControlButton label="上一页" onClick={prev}>
          <ChevronLeft className="size-4" />
        </ControlButton>
        <ControlButton label="目录总览（O）" onClick={() => setOverviewOpen(true)}>
          <LayoutGrid className="size-4" />
        </ControlButton>
        <span className="px-1.5 font-mono text-xs tracking-wider text-white/40">
          {index + 1} / {slides.length}
        </span>
        <ControlButton label="下一页" onClick={next}>
          <ChevronRight className="size-4" />
        </ControlButton>
        <span className="mx-0.5 h-4 w-px bg-white/10" />
        <ControlButton label="全屏（F）" onClick={toggleFullscreen}>
          {fullscreen ? <Minimize className="size-4" /> : <Maximize className="size-4" />}
        </ControlButton>
        <ControlButton label="操作帮助（?）" onClick={() => setHelpOpen(true)}>
          <CircleHelp className="size-4" />
        </ControlButton>
      </div>

      <AnimatePresence>
        {overviewOpen && (
          <Overview
            slides={slides}
            index={index}
            onJump={(i) => go(i)}
            onClose={() => setOverviewOpen(false)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>{helpOpen && <HelpOverlay onClose={() => setHelpOpen(false)} />}</AnimatePresence>
    </div>
  )
}

function ControlButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="rounded-full p-2 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
    >
      {children}
    </button>
  )
}
