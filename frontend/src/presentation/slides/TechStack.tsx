import { Reveal, SlideFrame, SlideTitle } from "@/presentation/ui"

const STACK: { layer: string; tech: string }[] = [
  { layer: "后端", tech: "Python 3.11 · FastAPI · SQLAlchemy 2 · SQLite · PyJWT · bcrypt" },
  { layer: "文件解析", tech: "pdfplumber（PDF）· python-docx（Word）· 多编码容错" },
  { layer: "大模型", tech: "openai SDK（OpenAI 兼容协议，任意厂商可切换）" },
  { layer: "前端", tech: "Vite · React 19 · TypeScript · pnpm · react-router" },
  { layer: "UI", tech: "Tailwind CSS v4 · shadcn/ui · lucide-react · framer-motion" },
  { layer: "导出", tech: "python-docx（DOCX）· XeLaTeX（PDF）· Markdown 解析器" },
]

const REASONS = [
  {
    lead: "为什么 FastAPI",
    text: "StreamingResponse 原生支持 SSE 流式推送；Pydantic 全链路类型校验，与前端 schema 对齐",
  },
  {
    lead: "为什么 OpenAI 兼容协议",
    text: "智谱 / DeepSeek / Kimi / OpenAI 一行配置切换，避免锁定单一厂商；无 Key 自动进入演示模式",
  },
  {
    lead: "为什么 SQLite",
    text: "零运维单文件数据库，课程项目体量下性能富余；ORM 参数化查询保证安全",
  },
]

/** 技术选型页：技术栈清单 + 关键选型理由。 */
export default function TechStack({ step }: { step: number }) {
  return (
    <SlideFrame>
      <SlideTitle
        kicker="02 项目课题方案"
        title="技术选型：为「流式 + 结构化」场景选型"
        subtitle="全部采用可替换、可本地运行的成熟开源栈"
      />

      <div className="grid min-h-0 flex-1 grid-cols-[1.2fr_1fr] gap-10">
        <div className="flex flex-col justify-center">
          {STACK.map((row, i) => (
            <div
              key={row.layer}
              className={`flex items-baseline gap-6 py-3.5 ${i > 0 ? "border-t border-slate-100" : ""}`}
            >
              <span className="w-20 shrink-0 text-[15px] font-semibold text-indigo-600">{row.layer}</span>
              <span className="text-[15.5px] leading-relaxed text-slate-700">{row.tech}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-col justify-center gap-4">
          {REASONS.map((r, i) => (
            <Reveal key={r.lead} at={i} step={step}>
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50 px-6 py-4">
                <p className="text-[16.5px] font-bold text-slate-900">{r.lead}</p>
                <p className="mt-1.5 text-[14px] leading-relaxed text-slate-500">{r.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </SlideFrame>
  )
}
