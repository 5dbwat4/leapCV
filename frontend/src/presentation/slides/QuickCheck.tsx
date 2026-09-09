import { Reveal, SlideFrame, SlideTitle } from "@/presentation/ui"

const SEQUENCE = [
  { who: "规划调用", what: "产出 ≤ 8 个待改写条目，每条可携带 question（问题 + 选项）" },
  { who: "管线线程", what: "emit question 事件后阻塞在 gate.ask(id, 180s)" },
  { who: "前端", what: "QuickCheckCard 弹出快问快答：点选选项或跳过" },
  { who: "POST /optimize/answer", what: "按 run_id 找到问答门，投递作答并 set 事件唤醒管线" },
  { who: "管线恢复", what: "带着用户补充的数据逐条改写，答案作为「数据补充」注入 Prompt" },
]

/** 关键技术 ④：Quick check 问答门（对应 backend/app/services/interactive.py）。 */
export default function QuickCheck({ step }: { step: number }) {
  return (
    <SlideFrame>
      <SlideTitle
        kicker="03 关键技术实现 ④"
        title="Quick check 问答门：让分析中途「停下来问你」"
        subtitle="量化数据不能靠模型编造 —— 缺数据时向本人提问，而不是猜"
      />

      <div className="flex min-h-0 flex-1 flex-col justify-center">
        {SEQUENCE.map((s, i) => (
          <Reveal key={s.who} at={i} step={step}>
            <div className={`flex items-center gap-5 py-3 ${i > 0 ? "border-t border-slate-100" : ""}`}>
              <span className="w-9 shrink-0 font-mono text-[15px] font-bold text-indigo-500">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="w-56 shrink-0 text-[16.5px] font-bold text-slate-900">{s.who}</span>
              <p className="text-[15px] text-slate-600">{s.what}</p>
            </div>
          </Reveal>
        ))}

        <Reveal at={5} step={step} className="mt-5">
          <div className="grid grid-cols-2 gap-6">
            <div className="rounded-2xl bg-emerald-50 px-6 py-4">
              <p className="text-[15.5px] font-bold text-emerald-800">有回答</p>
              <p className="mt-1 text-[14px] leading-relaxed text-emerald-700/80">
                改写直接采用真实数据：「求职者刚刚通过快问快答确认：…」
              </p>
            </div>
            <div className="rounded-2xl bg-amber-50 px-6 py-4">
              <p className="text-[15.5px] font-bold text-amber-800">超时 / 跳过（180s）</p>
              <p className="mt-1 text-[14px] leading-relaxed text-amber-700/80">
                用「约…/X+」表述框架留白并标注【请补充：…】，提醒本人填写 ——
                <span className="font-semibold">绝不编造精确数字</span>
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </SlideFrame>
  )
}
