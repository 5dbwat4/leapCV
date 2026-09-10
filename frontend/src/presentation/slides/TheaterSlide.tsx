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
    text: "左侧渲染简历原文，改写完成后原句划除 → 新句滑入行内对照",
  },
  {
    name: "Quick check 内嵌",
    text: "问答卡片直接叠加在剧场之上，不打断观看节奏",
  },
]

/** 关键技术 ③：实时分析剧场（对应 frontend/src/components/analysis/*）。 */
export default function TheaterSlide({ step }: { step: number }) {
  return (
    <SlideFrame>
      <SlideTitle
        kicker="03 关键技术实现 ③"
        title="实时分析剧场：把等待变成直播"
        subtitle="几十秒的分析不是转圈等待 —— 服务端事件流驱动每一帧动画"
      />

      <div className="grid min-h-0 flex-1 grid-cols-2 gap-x-10">
        <div className="flex flex-col justify-center">
          {FEATURES.map((f, i) => (
            <Reveal key={f.name} at={Math.min(i, 1)} step={step}>
              <div className={`py-3 ${i > 0 ? "border-t border-slate-100" : ""}`}>
                <p className="text-[17px] font-bold text-slate-900">{f.name}</p>
                <p className="mt-1 text-[14px] leading-relaxed text-slate-500">{f.text}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <div className="flex flex-col justify-center gap-4">
          <Reveal at={1} step={step}>
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50 px-6 py-5">
              <p className="text-[16.5px] font-bold text-slate-900">事件契约驱动动画</p>
              <p className="mt-2 text-[14.5px] leading-relaxed text-slate-600">
                全部动画由服务端事件名驱动，前端不猜测进度；
                订阅前先缓存、订阅时重放 —— 剧场挂载间隙的事件一条不丢。
              </p>
            </div>
          </Reveal>
          <Reveal at={2} step={step}>
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50 px-6 py-5">
              <p className="text-[16.5px] font-bold text-slate-900">推送节奏与动画对齐</p>
              <p className="mt-2 text-[14.5px] leading-relaxed text-slate-600">
                技能 / 问题条目由服务端逐条推送，给前端留出渲染时间；
                改写条目按真实 LLM 耗时天然错峰，观感与实际进度一致。
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </SlideFrame>
  )
}
