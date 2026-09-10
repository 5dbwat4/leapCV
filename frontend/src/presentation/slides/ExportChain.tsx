import { FileText, FileType2, Layers } from "lucide-react"

import { Reveal, SlideFrame, SlideTitle } from "@/presentation/ui"

const CHAIN = [
  { name: "Markdown 契约", detail: "表单 / 聊天 / 改写三条路线的统一产物，同一格式约定", icon: FileText },
  { name: "容错解析器", detail: "逐行状态机 + 数字边界规则，结构不规整也解析得出", icon: Layers },
  { name: "程序化渲染", detail: "LaTeX 源码逐行生成、风格对齐内置模板；DOCX 直接产出字节流", icon: FileType2 },
  { name: "XeLaTeX → PDF", detail: "本机 TeX 环境编译，缺环境 / 失败都给可读错误", icon: FileText },
]

/** 关键技术 ⑤：导出链路（对应 backend/app/services/exporter.py）。 */
export default function ExportChain({ step }: { step: number }) {
  return (
    <SlideFrame>
      <SlideTitle
        kicker="03 关键技术实现 ⑤"
        title="导出链路：从 Markdown 到可直接投递的 PDF"
        subtitle="优化结果不锁死在网页里 —— 三格式全部程序化渲染，DOCX / LaTeX / PDF 落袋"
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
              <Reveal at={0} step={step} className="flex items-center px-0.5">
                <span className="text-[16px] font-bold text-indigo-300">→</span>
              </Reveal>
            )}
          </div>
        ))}
      </div>

      <div className="grid flex-1 grid-cols-2 gap-8 pt-7">
        <Reveal at={1} step={step}>
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50 px-6 py-5">
            <p className="text-[16.5px] font-bold text-slate-900">失败也给可读错误</p>
            <p className="mt-2 text-[14.5px] leading-relaxed text-slate-600">
              缺 TeX 环境 / 编译超时 / 编译失败，收敛成一句话给用户
              （附日志尾部定位），不透传原始报错堆栈；渲染端任意字段可空，空标题自动落「其他」。
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
