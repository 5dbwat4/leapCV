import { motion } from "framer-motion"

const SHORTCUTS: [string, string][] = [
  ["→ / 空格 / Enter", "下一步（fragment 或翻页）"],
  ["← / PageUp", "上一步"],
  ["Home / End", "第一页 / 最后一页"],
  ["O", "目录总览"],
  ["F", "全屏切换"],
  ["? / /", "本帮助"],
  ["Esc", "关闭浮层"],
  ["触摸滑动", "移动端左右翻页"],
]

/** 快捷键帮助浮层（快捷键 ?）。 */
export default function HelpOverlay({ onClose }: { onClose: () => void }) {
  return (
    <motion.div
      className="absolute inset-0 z-50 flex items-center justify-center bg-[#0B0B14]/80 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onClick={onClose}
    >
      <div
        className="w-[380px] rounded-2xl border border-white/10 bg-[#151522] p-6 shadow-2xl shadow-black/50"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-sm font-semibold tracking-widest text-white/60">操作方式</h2>
        <ul className="space-y-2.5">
          {SHORTCUTS.map(([keys, desc]) => (
            <li key={keys} className="flex items-center justify-between gap-4 text-sm">
              <span className="text-white/85">{desc}</span>
              <kbd className="rounded-md border border-white/15 bg-white/[0.06] px-2 py-0.5 font-mono text-xs text-white/60">
                {keys}
              </kbd>
            </li>
          ))}
        </ul>
      </div>
    </motion.div>
  )
}
