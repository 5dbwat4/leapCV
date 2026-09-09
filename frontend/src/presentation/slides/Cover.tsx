import { Chip, SlideFrame } from "@/presentation/ui"

/** 封面页（对应模板第 1 页）。组员名单保留占位，汇报前替换为真实姓名。 */
export default function Cover() {
  return (
    <SlideFrame dark className="justify-center">
      <p className="text-[14px] font-semibold tracking-[0.4em] text-indigo-300">
        图灵实践 · 课程考核项目 · 小组汇报
      </p>
      <h1 className="mt-7 text-[84px] font-bold leading-none tracking-tight text-white">
        简跃 <span className="bg-gradient-to-r from-indigo-400 to-violet-300 bg-clip-text text-transparent">LeapCV</span>
      </h1>
      <p className="mt-6 text-[24px] text-white/60">
        AI 简历优化工具 —— <span className="text-white/85">让简历，跃然而出</span>
      </p>

      <div className="mt-12 flex items-center gap-5">
        <p className="text-[17px] text-white/50">
          组员：<span className="text-white/80">XXX</span>
          <span className="mx-2.5 text-white/25">·</span>
          <span className="text-white/80">XXX</span>
          <span className="mx-2.5 text-white/25">·</span>
          <span className="text-white/80">XXX</span>
        </p>
      </div>

      <div className="mt-10 flex flex-wrap gap-3">
        <Chip>简历解析</Chip>
        <Chip>JD 匹配打分</Chip>
        <Chip>风险诊断</Chip>
        <Chip>内容重构</Chip>
        <Chip>多格式导出</Chip>
      </div>
    </SlideFrame>
  )
}
