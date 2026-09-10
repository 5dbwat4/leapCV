import { Reveal, SlideFrame, SlideTitle } from "@/presentation/ui"

const LINE_FLOW = [
  { mark: "#  张伟", to: "姓名（再次出现则降级为新板块）" },
  { mark: "##  工作经历", to: "切换当前板块" },
  { mark: "###  公司 ｜ 职位 ｜ 2023.07 - 至今", to: "新建条目，标题按竖线拆字段" },
  { mark: "-  要点", to: "归属当前条目 → 当前板块 → 前置区" },
  { mark: "普通文本行", to: "交给下方启发式规则判定归属" },
]

const RULES = [
  { name: "姓名兜底", cond: "缺失 # 标记时：首行 ≤10 字、无数字/@/竖线、非板块标题 → 视为姓名" },
  { name: "联系方式行", cond: "命中关键词（求职意向/电话/邮箱/城市）或含竖线 → 拆字段，「求职意向:」单列" },
  { name: "条目提升", cond: "竖线拆 2~4 段 且 整行 ≤80 字 且 每段 ≤30 字 → 提升为条目，否则降为段落，防误判" },
  { name: "时间段识别", cond: "末段形似时间（2023.07 - 至今 / Present）→ 单独提出，渲染为右对齐时间栏" },
]

/** 关键技术 ④：LLM Markdown 容错解析器（对应 backend/app/services/exporter.py）。 */
export default function ParserResilient({ step }: { step: number }) {
  return (
    <SlideFrame>
      <SlideTitle
        kicker="03 关键技术实现 ④"
        title="容错解析：把「结构不规整」当成常态"
        subtitle="表单组装 / 聊天终稿 / 改写组装三条路线共用同一份 Markdown 契约，解析器负责把它翻成渲染器可用的结构化文档"
      />

      <div className="grid min-h-0 flex-1 grid-cols-[0.95fr_1.15fr] items-stretch gap-8">
        <Reveal at={0} step={step} className="flex flex-col">
          <p className="mb-3 text-[13.5px] font-semibold tracking-[0.2em] text-slate-400">逐行状态机</p>
          <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_20px_rgba(15,23,42,0.05)]">
            <p className="border-b border-slate-100 bg-slate-50/70 px-5 py-2.5 font-mono text-[12px] text-slate-500">
              每一行：先分类，再迁移 板块 / 条目 / 前置区 三级归属
            </p>
            {LINE_FLOW.map((l, i) => (
              <div key={l.mark} className={`flex items-center gap-4 px-5 py-[9px] ${i > 0 ? "border-t border-slate-100" : ""}`}>
                <span className="w-[218px] shrink-0 truncate font-mono text-[13px] text-indigo-600">{l.mark}</span>
                <span className="shrink-0 text-[12px] text-slate-300">→</span>
                <p className="min-w-0 text-[13.5px] leading-snug text-slate-600">{l.to}</p>
              </div>
            ))}
          </div>
        </Reveal>

        <Reveal at={1} step={step} className="flex flex-col">
          <p className="mb-3 text-[13.5px] font-semibold tracking-[0.2em] text-slate-400">启发式规则 · 带数字边界</p>
          <div className="flex flex-1 flex-col justify-between gap-2.5">
            {RULES.map((r) => (
              <div key={r.name} className="flex-1 rounded-2xl border border-slate-200/80 bg-white px-5 py-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_20px_rgba(15,23,42,0.05)]">
                <p className="text-[15px] font-bold text-slate-900">{r.name}</p>
                <p className="mt-0.5 text-[13px] leading-snug text-slate-500">{r.cond}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </div>

      <Reveal at={2} step={step} className="mt-5 grid shrink-0 grid-cols-2 gap-8">
        <div className="rounded-2xl bg-emerald-50 px-6 py-3.5">
          <p className="text-[15.5px] font-bold text-emerald-800">板块与要点不丢失</p>
          <p className="mt-1 text-[13.5px] leading-relaxed text-emerald-700/80">
            认不出的内容进前置区 / 散段落容错渲染 —— 降级展示，而不是丢弃
          </p>
        </div>
        <div className="rounded-2xl bg-amber-50 px-6 py-3.5">
          <p className="text-[15.5px] font-bold text-amber-800">任何输入都不崩溃</p>
          <p className="mt-1 text-[13.5px] leading-relaxed text-amber-700/80">
            任意字段可空：条目标题为空 → 「其他」，联系方式缺失 → 整行兜底展示
          </p>
        </div>
      </Reveal>
    </SlideFrame>
  )
}
