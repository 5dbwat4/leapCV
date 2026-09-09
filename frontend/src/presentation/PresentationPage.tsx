/**
 * /presentation —— 独立的课程汇报幻灯片路由。
 *
 * 刻意不接入 RequireAuth / Navbar / 全站 Footer：不提供任何从站内其他页面
 * 进入的入口，只能通过直接输入 URL 访问，保证演示视图与产品视图完全隔离。
 */
export default function PresentationPage() {
  return (
    <div className="flex h-svh w-full items-center justify-center bg-[#0B0B14] text-white">
      <p className="text-sm tracking-widest text-white/40">LEAPCV · PRESENTATION</p>
    </div>
  )
}
