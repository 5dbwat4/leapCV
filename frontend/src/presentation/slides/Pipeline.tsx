import { Reveal, SlideFrame, SlideTitle } from "@/presentation/ui"
import { cn } from "@/lib/utils"

const STAGES = [
  {
    no: "1",
    name: "简历解析",
    detail: "结构化抽取教育 / 工作 / 项目 / 技能 / 证书，标记缺失板块",
    io: "PDF·DOCX·文本 → 简历结构 JSON",
  },
  {
    no: "2",
    name: "JD 抽取",
    detail: "硬技能（权重 1-5、必备/加分、同义别名）、软技能、职责与隐性要求",
    io: "岗位 JD → 要求结构 JSON",
  },
  {
    no: "3",
    name: "匹配分析",
    detail: "算法技能覆盖率 50% + LLM 经验评估 30% + 教育评估 20%",
    io: "双路证据 → 0-100 匹配分 + 投递建议",
  },
  {
    no: "4",
    name: "风险诊断",
    detail: "LLM 九类问题逐条定位 + 本地弱表述规则兜底，去重后按严重度排序",
    io: "原文 → 问题清单（定位 + 建议）",
  },
  {
    no: "5",
    name: "内容重构",
    detail: "规划 → Quick check 快问快答 → 逐条 STAR 改写 → 整卷组装",
    io: "简历 + JD → Markdown 优化简历",
  },
]

const EVENTS = "progress / resume_struct / jd_struct / score / skill / issue / question / rewrite / result"

/** 五阶段分析管线页：每个阶段一次 LLM 结构化调用，事件随做随推。 */
export default function Pipeline({ step }: { step: number }) {
  return (
    <SlideFrame>
      <SlideTitle
        kicker="02 项目课题方案"
        title="五阶段分析管线：像流水线一样处理一份简历"
        subtitle="每阶段一次结构化 LLM 调用，算法与模型双路证据交叉验证"
      />

      <div className="flex min-h-0 flex-1 items-stretch gap-1.5">
        {STAGES.map((s, i) => (
          <div key={s.no} className="flex min-w-0 flex-1 items-stretch">
            <Reveal at={0} step={step} className="flex min-w-0 flex-1">
              <div
                className={cn(
                  "flex min-w-0 flex-1 flex-col rounded-2xl border p-4",
                  i === 2
                    ? "border-indigo-300 bg-indigo-50"
                    : "border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_20px_rgba(15,23,42,0.05)]",
                )}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={cn(
                      "flex size-8 items-center justify-center rounded-full text-[15px] font-bold text-white",
                      i === 2 ? "bg-indigo-600" : "bg-slate-800",
                    )}
                  >
                    {s.no}
                  </span>
                  <p className="text-[17.5px] font-bold text-slate-900">{s.name}</p>
                </div>
                <p className="mt-3 min-h-[88px] text-[13.5px] leading-relaxed text-slate-500">{s.detail}</p>
                <p className="mt-auto border-t border-slate-100 pt-2.5 font-mono text-[11.5px] leading-relaxed text-slate-400">
                  {s.io}
                </p>
              </div>
            </Reveal>
            {i < STAGES.length - 1 && (
              <div className="flex items-center px-0.5">
                <span className="text-[16px] font-bold text-indigo-300">→</span>
              </div>
            )}
          </div>
        ))}
      </div>

      <Reveal at={1} step={step} className="mt-6">
        <div className="rounded-2xl bg-slate-900 px-7 py-4">
          <p className="text-[15.5px] leading-relaxed text-slate-300">
            <span className="font-semibold text-white">边执行边推送：</span>
            阶段事件经 SSE 实时转发到前端驱动动画 ——
          </p>
          <p className="mt-1.5 font-mono text-[13px] tracking-tight text-indigo-300">{EVENTS}</p>
        </div>
      </Reveal>
    </SlideFrame>
  )
}
