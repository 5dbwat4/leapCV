import { SlideFrame } from "@/presentation/ui"

/** 致谢页（对应模板第 8 页）。 */
export default function Thanks() {
  return (
    <SlideFrame dark className="items-start justify-center">
      <h1 className="text-[96px] font-bold leading-none tracking-tight text-white">Thanks!</h1>
      <p className="mt-6 text-[24px] text-white/40">The End.</p>
      <p className="mt-14 text-[17px] text-white/60">
        欢迎提问 —— 也欢迎进入 <span className="font-semibold text-indigo-300">简跃 LeapCV</span> 现场体验完整流程
      </p>
    </SlideFrame>
  )
}
