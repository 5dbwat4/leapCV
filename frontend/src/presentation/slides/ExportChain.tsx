import { FileText, FileType2, Palette } from "lucide-react"

import { Reveal, SlideFrame, SlideTitle } from "@/presentation/ui"

const CHAIN = [
  { name: "Markdown 优化简历", detail: "LLM 产物，结构不保证严格规整", icon: FileText },
  { name: "容错解析器", detail: "逐行处理：条目标题竖线拆字段、行内粗体、时间段与联系方式行识别，任何输入不崩溃", icon: Palette },
  { name: "DOCX / LaTeX", detail: "python-docx 字节流；LaTeX 对齐内置 leapcv-resume-zh 模板风格", icon: FileType2 },
  { name: "XeLaTeX → PDF", detail: "本机 TeX 环境编译产出，缺环境时给出可读错误", icon: FileText },
]

/** 关键技术 ⑥：导出链路（对应 backend/app/services/exporter.py）。 */
export default function ExportChain({ step }: { step: number }) {
  return (
    <SlideFrame>
      <SlideTitle
        kicker="03 关键技术实现 ⑥"
        title="导出链路：从 Markdown 到可直接投递的 PDF"
        subtitle="优化结果不锁死在网页里 —— DOCX / LaTeX / PDF 三格式落袋"
      />

      <div className="flex items-stretch gap-2">
        {CHAIN.map((c, i) => (
          <div key={c.name} className="flex min-w-0 flex-1 items-stretch">
            <Reveal at={0} step={step} className="flex min-w-0 flex-1">
              <div className="flex min-w-0 flex-1 flex-col rounded-2xl border border-slate-200/80 bg-white px-5 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_20px_rgba(15,23,42,0.05)]">
                <c.icon className="size-5.5 text-indigo-500" strokeWidth={1.8} />
                <p className="mt-2.5 text-[16.5px] font-bold text-slate-900">{c.name}</p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-slate-500">{c.detail}</p>
              </div>
            </Reveal>
            {i < CHAIN.length - 1 && (
              <div className="flex items-center px-0.5">
                <span className="text-[16px] font-bold text-indigo-300">→</span>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="grid flex-1 grid-cols-2 gap-8 pt-7">
        <Reveal at={1} step={step}>
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50 px-6 py-5">
            <p className="text-[16.5px] font-bold text-slate-900">容错是第一优先级</p>
            <p className="mt-2 text-[14.5px] leading-relaxed text-slate-600">
              解析器按「板块与要点不丢失、任何输入都不崩溃」设计：
              疑似条目的散段落整行拆 2~4 段且长度受限才提升，避免误判。
            </p>
          </div>
        </Reveal>
        <Reveal at={2} step={step}>
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50 px-6 py-5">
            <p className="text-[16.5px] font-bold text-slate-900">导出即复检入口</p>
            <p className="mt-2 text-[14.5px] leading-relaxed text-slate-600">
              结果页导出菜单旁提供「优化后复检」：把改写后的简历再跑一遍匹配分析，
              用分数闭环验证优化效果。
            </p>
          </div>
        </Reveal>
      </div>
    </SlideFrame>
  )
}
