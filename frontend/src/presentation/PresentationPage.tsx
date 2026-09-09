import DeckPlayer from "@/presentation/player/DeckPlayer"
import type { SlideDef } from "@/presentation/player/types"

/**
 * /presentation —— 独立的课程汇报幻灯片路由。
 *
 * 刻意不接入 RequireAuth / Navbar / 全站 Footer：不提供任何从站内其他页面
 * 进入的入口，只能通过直接输入 URL 访问，保证演示视图与产品视图完全隔离。
 */
export default function PresentationPage() {
  const slides: SlideDef[] = [
    {
      id: "placeholder-cover",
      title: "封面（占位）",
      render: () => (
        <div className="flex h-full flex-col items-center justify-center bg-[#0B0B14] text-white">
          <p className="text-5xl font-bold tracking-tight">简跃 LeapCV</p>
          <p className="mt-4 text-sm tracking-[0.3em] text-white/40">AI 简历优化工具 · 小组汇报</p>
        </div>
      ),
    },
    {
      id: "placeholder-end",
      title: "结尾（占位）",
      fragments: 2,
      render: (step) => (
        <div className="flex h-full flex-col items-center justify-center gap-4 bg-white text-slate-900">
          <p className="text-4xl font-bold">播放器自检</p>
          <p className="text-lg text-slate-500">fragment 步骤：{step} / 2</p>
        </div>
      ),
    },
  ]
  return <DeckPlayer slides={slides} />
}
