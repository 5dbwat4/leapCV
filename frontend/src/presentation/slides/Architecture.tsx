import { ArrowRight, Brain, Monitor, Server, Database } from "lucide-react"

import { Card, Reveal, SlideFrame, SlideTitle } from "@/presentation/ui"

function ArchColumn({
  icon: Icon,
  name,
  tech,
  modules,
}: {
  icon: typeof Monitor
  name: string
  tech: string
  modules: string[]
}) {
  return (
    <Card className="flex min-h-0 flex-1 flex-col gap-3 px-6 py-5">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-indigo-50 p-2">
          <Icon className="size-5 text-indigo-600" />
        </div>
        <div>
          <p className="text-[18px] font-bold text-slate-900">{name}</p>
          <p className="text-[12.5px] text-slate-400">{tech}</p>
        </div>
      </div>
      <div className="flex flex-col gap-1.5 border-t border-slate-100 pt-3">
        {modules.map((m) => (
          <p key={m} className="flex items-center gap-2 text-[14px] text-slate-600">
            <span className="size-1 rounded-full bg-indigo-400" />
            {m}
          </p>
        ))}
      </div>
    </Card>
  )
}

function FlowArrow({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 px-1">
      <ArrowRight className="size-5 text-indigo-400" />
      <span className="whitespace-nowrap text-[12px] font-medium text-slate-400">{label}</span>
    </div>
  )
}

/** 总体架构页（对应模板第 3 页「项目课题方案」）：前端 ↔ 后端 ↔ 大模型 的三层结构。 */
export default function Architecture({ step }: { step: number }) {
  return (
    <SlideFrame>
      <SlideTitle
        kicker="02 项目课题方案"
        title="总体架构：三层解耦的前后端分离系统"
        subtitle="浏览器 SPA · FastAPI 服务 · OpenAI 兼容大模型，SSE 贯穿全链路"
      />

      <div className="flex min-h-0 flex-1 items-stretch gap-2">
        <ArchColumn
          icon={Monitor}
          name="浏览器 · React SPA"
          tech="Vite + React 19 + TypeScript"
          modules={["工作台：上传 / 粘贴 / 发起分析", "分析剧场：全屏实时可视化", "报告页：打分 · 诊断 · 改写 · 导出", "我的简历 / 历史记录"]}
        />
        <FlowArrow label="REST + SSE" />
        <ArchColumn
          icon={Server}
          name="FastAPI 服务"
          tech="Python 3.11 + SQLAlchemy 2"
          modules={["routers：auth / resumes / optimize / history / export", "services：parser / pipeline / matcher / llm / exporter", "五阶段分析管线（SSE 逐事件推送）", "JWT 鉴权 + SQLite 落库"]}
        />
        <FlowArrow label="OpenAI 兼容 API" />
        <ArchColumn
          icon={Brain}
          name="大模型（可替换）"
          tech="openai SDK · 任意兼容厂商"
          modules={["智谱 GLM / DeepSeek / Kimi / OpenAI", "五个中文 Prompt：抽取 · 评估 · 诊断 · 改写", "重试梯度 + JSON 容错解析"]}
        />
      </div>

      <Reveal at={0} step={step} className="mt-6">
        <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-slate-50 px-6 py-3.5">
          <Database className="size-5 text-slate-400" />
          <p className="text-[15px] text-slate-600">
            <span className="font-semibold text-slate-900">SQLite 持久层</span>
            <span className="mx-2 text-slate-300">·</span>
            users / resumes / optimizations 三表，简历与分析记录按用户隔离
          </p>
          <p className="ml-auto text-[13.5px] text-slate-400">API Key 仅存后端 .env，前端不接触模型凭证</p>
        </div>
      </Reveal>
    </SlideFrame>
  )
}
