import { FileUp, Gauge, ShieldAlert, Wand2, Users, Download } from "lucide-react"

import { Card, Reveal, SlideFrame, SlideTitle } from "@/presentation/ui"

const CAPABILITIES = [
  { icon: FileUp, title: "多格式输入", text: "PDF / Word / TXT / MD 上传解析，或直接粘贴，结果可编辑" },
  { icon: Gauge, title: "JD 定向匹配", text: "0-100 匹配分 + 技能/经验/教育三维度评分与投递建议" },
  { icon: ShieldAlert, title: "九类风险诊断", text: "口语化、缺乏量化、真实性风险等，按严重度分级并给出修改建议" },
  { icon: Wand2, title: "STAR 内容重构", text: "逐条改写 + 改写理由 + 亮点挖掘，输出 Markdown 优化简历" },
  { icon: Users, title: "多用户与历史", text: "注册登录、记录隔离、历史回看与删除" },
  { icon: Download, title: "多格式导出", text: "优化简历一键导出 DOCX / LaTeX / PDF" },
]

/** 课题目标页（对应模板第 2 页「课题目标」半区）。 */
export default function Objective({ step }: { step: number }) {
  return (
    <SlideFrame>
      <SlideTitle
        kicker="01 项目课题简介"
        title="课题目标：一站式 AI 简历优化系统"
        subtitle="上传简历 + 粘贴目标岗位 JD → 自动完成解析、打分、诊断、重写、导出"
      />

      <div className="grid min-h-0 flex-1 grid-cols-[1.05fr_1fr] gap-10">
        <div className="flex flex-col">
          <Card className="bg-gradient-to-br from-indigo-50 to-violet-50">
            <p className="text-[14px] font-semibold tracking-[0.2em] text-indigo-600">要解决的核心问题</p>
            <p className="mt-4 text-[22px] font-bold leading-relaxed text-slate-900">
              让求职者用<b className="text-indigo-600">一份针对性优化的简历</b>
              去投一个岗位，而不是用一份简历投所有岗位。
            </p>
            <p className="mt-4 text-[15px] leading-relaxed text-slate-600">
              系统以「目标 JD」为锚点：先量化差距（匹配打分），再定位问题（风险诊断），
              最后产出结果（内容重构 + 直接可用的优化简历）。
            </p>
          </Card>
          <Reveal at={1} step={step} className="mt-6">
            <div className="flex items-center gap-8 rounded-2xl border border-slate-200/80 bg-slate-50 px-7 py-4">
              <div>
                <p className="text-[26px] font-bold text-indigo-600">5</p>
                <p className="text-[13px] text-slate-500">阶段分析管线</p>
              </div>
              <div className="h-10 w-px bg-slate-200" />
              <div>
                <p className="text-[26px] font-bold text-indigo-600">0-100</p>
                <p className="text-[13px] text-slate-500">岗位匹配打分</p>
              </div>
              <div className="h-10 w-px bg-slate-200" />
              <div>
                <p className="text-[26px] font-bold text-indigo-600">3</p>
                <p className="text-[13px] text-slate-500">种格式导出</p>
              </div>
            </div>
          </Reveal>
        </div>

        <Reveal at={0} step={step} className="min-h-0">
          <div className="grid grid-cols-1 gap-2.5">
            {CAPABILITIES.map((c) => (
              <div key={c.title} className="flex items-center gap-3.5 rounded-xl border border-slate-100 px-4 py-2.5">
                <div className="rounded-lg bg-indigo-50 p-2">
                  <c.icon className="size-[18px] text-indigo-600" />
                </div>
                <p className="text-[15.5px] text-slate-600">
                  <span className="font-semibold text-slate-900">{c.title}</span>
                  <span className="mx-1.5 text-slate-300">—</span>
                  {c.text}
                </p>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </SlideFrame>
  )
}
