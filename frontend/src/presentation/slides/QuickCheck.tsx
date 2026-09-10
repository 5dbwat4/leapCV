import { Reveal, SlideFrame, SlideTitle } from "@/presentation/ui"

const OUTCOMES = [
  { lead: "有回答", text: "真实数据注入 Prompt：「求职者刚刚通过快问快答确认：…」改写直接采用", tone: "ok" as const },
  { lead: "超时 180s / 跳过", text: "「约…/X+」表述框架留白 + 【请补充：…] 标注 —— 绝不编造精确数字", tone: "warn" as const },
  { lead: "客户端断开", text: "注销并唤醒全部等待中的问题，管线线程不会永久阻塞", tone: "warn" as const },
]

/** 关键技术 ②：Quick check 问答门（对应 backend/app/services/interactive.py）。 */
export default function QuickCheck({ step }: { step: number }) {
  return (
    <SlideFrame>
      <SlideTitle
        kicker="03 关键技术实现 ②"
        title="Quick check：让用户自己补充模型未覆盖的信息"
        subtitle="请求在后台跑的同时，通过模型提问改写只有本人知道的数字"
      />

      <div className="grid min-h-0 flex-1 grid-cols-[1.12fr_1fr] gap-9">
        <Reveal at={0} step={step} className="flex flex-col justify-center">
          <p className="mb-3 text-[13.5px] font-semibold tracking-[0.2em] text-slate-400">一次提问的往返：暂停 → 问 → 继续</p>
          <div className="flex flex-col gap-2">
            {[
              { what: "管线停下", detail: "走到缺数据的条目，后台线程阻塞等待；问题 + 选项 + 180s 倒计时经已建立的 SSE 流推给用户" },
              { what: "用户作答", detail: "快问快答卡片上点选推测选项或自己填写（可跳过）" },
              { what: "回答另走一条请求", detail: "这次点选是全新请求② POST /optimize/answer：按 run_id 查问答门，唤醒请求① 阻塞的线程" },
              { what: "带着数据继续", detail: "线程携真实数字继续改写；超时则落「约…/X+」占位，绝不编造" },
            ].map((s, i) => (
              <div
                key={s.what}
                className="flex items-start gap-3.5 rounded-2xl border border-slate-200/80 bg-white px-5 py-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_20px_rgba(15,23,42,0.05)]"
              >
                <span className="mt-0.5 font-mono text-[14.5px] font-bold text-indigo-500">{i + 1}</span>
                <p className="text-[14px] leading-snug text-slate-600">
                  <span className="font-bold text-slate-900">{s.what}</span>
                  <span className="mx-1.5 text-slate-300">·</span>
                  {s.detail}
                </p>
              </div>
            ))}
          </div>
        </Reveal>

        <div className="flex flex-col justify-center gap-4">
          <Reveal at={1} step={step}>
            <div className="rounded-2xl border border-slate-200/80 bg-white px-6 py-4.5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_28px_rgba(15,23,42,0.07)]">
              <p className="text-[16px] font-bold text-slate-900">问什么、怎么问：模型规划时决定</p>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-slate-500">
                仅当改写迫切缺少本人知道的事实（数字 / 规模 / 工具名）才提问，整卷最多 2 问；
                选项由模型按上下文推测并按可能性排序 —— 用户点选确认即可，不用打字
              </p>
            </div>
          </Reveal>

          <Reveal at={2} step={step} className="flex flex-col gap-2">
            {OUTCOMES.map((o) => (
              <div
                key={o.lead}
                className={`rounded-xl px-5 py-2.5 ${o.tone === "ok" ? "bg-emerald-50" : "bg-amber-50"}`}
              >
                <p className={`text-[14px] font-bold ${o.tone === "ok" ? "text-emerald-800" : "text-amber-800"}`}>
                  {o.lead}
                </p>
                <p className={`text-[13px] leading-snug ${o.tone === "ok" ? "text-emerald-700/80" : "text-amber-700/80"}`}>
                  {o.text}
                </p>
              </div>
            ))}
          </Reveal>
        </div>
      </div>
    </SlideFrame>
  )
}
