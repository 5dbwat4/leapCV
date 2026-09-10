import { Check, X } from "lucide-react"

import { Reveal, SlideFrame, SlideTitle } from "@/presentation/ui"

const WEIGHTS = [
  { name: "Spring Boot", weight: 5, required: "必备", hit: true },
  { name: "MySQL / Redis", weight: 4, required: "必备", hit: true },
  { name: "Kafka", weight: 3, required: "加分", hit: false },
  { name: "分布式事务经验", weight: 4, required: "必备", hit: false },
]

/** 关键技术 ①：JD 匹配打分 —— 加权关键词覆盖度（算法）+ LLM 定性评估双路证据。 */
export default function MatchAlgorithm({ step }: { step: number }) {
  return (
    <SlideFrame>
      <SlideTitle
        kicker="03 关键技术实现 ①"
        title="JD 匹配打分：算法量化 + LLM 定性"
        subtitle="算法给出可复现的量化底线，LLM 在此之上做语义层评估"
      />

      <div className="grid min-h-0 flex-1 grid-cols-[1.15fr_1fr] gap-9">
        <div className="flex flex-col justify-center gap-5">
          <div className="rounded-2xl bg-slate-900 px-7 py-5">
            <p className="text-[15px] text-slate-400">总分公式</p>
            <p className="mt-2 font-mono text-[19px] leading-relaxed text-white">
              total = <span className="text-indigo-300">技能分 × 0.5</span> +{" "}
              <span className="text-indigo-300">经验分 × 0.3</span> +{" "}
              <span className="text-indigo-300">教育分 × 0.2</span>
            </p>
            <p className="mt-2 font-mono text-[14px] text-slate-400">技能分 = Σ命中权重 ÷ Σ全部权重 × 100</p>
          </div>
          <Reveal at={0} step={step}>
            <div className="flex flex-col gap-2.5">
              {[
                ["权重来自 JD 抽取", "硬技能 1-5 级权重，由 LLM 按 JD 语境标注"],
                ["必备/加分调权", "required=true 权重 ×1.2 上浮，加分项 ×0.8 下调"],
                ["别名归一化匹配", "casefold + 去空白/分隔符，JS、JavaScript、ECMAScript 等价命中"],
              ].map(([lead, text]) => (
                <p key={lead} className="text-[15px] text-slate-600">
                  <span className="font-semibold text-slate-900">{lead}</span>
                  <span className="mx-2 text-slate-300">·</span>
                  {text}
                </p>
              ))}
            </div>
          </Reveal>
        </div>

        <Reveal at={1} step={step} className="flex flex-col justify-center">
          <p className="mb-3 text-[13.5px] font-semibold tracking-[0.2em] text-slate-400">
            示例：某 Java 后端 JD 抽取结果
          </p>
          <div className="overflow-hidden rounded-2xl border border-slate-200/80">
            {WEIGHTS.map((kw, i) => (
              <div
                key={kw.name}
                className={`flex items-center gap-3 bg-white px-5 py-3 ${i > 0 ? "border-t border-slate-100" : ""}`}
              >
                {kw.hit ? (
                  <Check className="size-4.5 text-emerald-500" strokeWidth={2.5} />
                ) : (
                  <X className="size-4.5 text-rose-400" strokeWidth={2.5} />
                )}
                <span className="flex-1 font-mono text-[14.5px] text-slate-800">{kw.name}</span>
                <span className="font-mono text-[13px] text-slate-400">w={kw.weight}</span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[12px] font-medium ${
                    kw.required === "必备" ? "bg-indigo-50 text-indigo-600" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {kw.required}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[14px] leading-relaxed text-slate-500">
            算法只看字面覆盖，容易漏判「用了别的技术实现了同等能力」——
            <span className="font-semibold text-slate-800">因此经验/教育维度交给 LLM 结合简历语义评估</span>
            ，并把算法覆盖率作为参考一并喂给模型，双路证据互补防幻觉。
          </p>
        </Reveal>
      </div>
    </SlideFrame>
  )
}
