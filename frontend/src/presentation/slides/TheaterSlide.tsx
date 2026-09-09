import { Reveal, SlideFrame, SlideTitle } from "@/presentation/ui"

const FEATURES = [
  {
    name: "五阶段时间线",
    text: "阶段状态实时流转：待执行 / 进行中 / 完成，进度百分比同步跳动",
  },
  {
    name: "动态事件流",
    text: "score / skill / issue 逐条飞入，命中技能带简历原文证据，缺失带补强建议",
  },
  {
    name: "简历纸张实时标注",
    text: "左侧渲染简历原文，改写完成后原句 → 新句行内对照高亮",
  },
  {
    name: "Quick check 内嵌",
    text: "问答卡片直接叠加在剧场之上，不打断沉浸式观感",
  },
]

/** 关键技术 ⑤：实时分析剧场（对应 frontend/src/components/analysis/*）。 */
export default function TheaterSlide({ step }: { step: number }) {
  return (
    <SlideFrame dark>
      <SlideTitle
        dark
        kicker="03 关键技术实现 ⑤"
        title="实时分析剧场：把等待变成产品体验"
        subtitle="全屏可视化界面 —— 深紫渐变 + 玻璃拟态，SSE 事件驱动全部动画"
      />

      <div className="grid min-h-0 flex-1 grid-cols-2 gap-x-10 gap-y-0">
        <div className="flex flex-col justify-center">
          {FEATURES.map((f, i) => (
            <Reveal key={f.name} at={Math.min(i, 1)} step={step}>
              <div className={`py-3.5 ${i > 0 ? "border-t border-white/10" : ""}`}>
                <p className="text-[17px] font-bold text-white">{f.name}</p>
                <p className="mt-1 text-[14px] leading-relaxed text-white/50">{f.text}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <div className="flex flex-col justify-center gap-4">
          <Reveal at={2} step={step}>
            <div className="rounded-2xl border border-white/10 bg-white/[0.05] px-6 py-5 backdrop-blur-sm">
              <p className="font-mono text-[12px] uppercase tracking-widest text-indigo-300">TheaterEventBus</p>
              <p className="mt-2 text-[14.5px] leading-relaxed text-white/70">
                剧场事件总线：订阅前先缓存（上限 200 条）、订阅时重放 ——
                剧场挂载间隙的 SSE 事件一条不丢。
              </p>
            </div>
          </Reveal>
          <Reveal at={3} step={step}>
            <div className="rounded-2xl border border-white/10 bg-white/[0.05] px-6 py-5 backdrop-blur-sm">
              <p className="font-mono text-[12px] uppercase tracking-widest text-indigo-300">staggered emit</p>
              <p className="mt-2 text-[14.5px] leading-relaxed text-white/70">
                服务端逐条推送时插入固定间隔（_emit_staggered），
                给前端动画留出渲染时间；改写条目按真实 LLM 耗时天然错峰。
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </SlideFrame>
  )
}
