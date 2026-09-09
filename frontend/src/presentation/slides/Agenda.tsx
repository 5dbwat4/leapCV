import { SlideFrame } from "@/presentation/ui"

export interface DeckSection {
  no: string
  title: string
  desc: string
  /** 本章包含的小节页标题（目录与章节过渡页共用） */
  pages: string[]
}

/** 目录页（数据来自 deck 的 SECTIONS，与章节过渡页保持一致）。 */
export default function Agenda({ sections }: { sections: DeckSection[] }) {
  return (
    <SlideFrame>
      <header className="mb-8 shrink-0">
        <h1 className="text-[38px] font-bold tracking-tight text-slate-900">汇报内容</h1>
        <p className="mt-2 text-[17px] text-slate-500">按课程考核模板组织 · 六个章节</p>
      </header>
      <div className="grid min-h-0 flex-1 grid-cols-2 grid-rows-3 gap-x-12">
        {sections.map((s) => (
          <div key={s.no} className="flex items-center gap-5 border-t border-slate-100 py-4">
            <span className="font-mono text-[30px] font-bold leading-none text-indigo-500/90">{s.no}</span>
            <div className="min-w-0">
              <p className="text-[19px] font-semibold text-slate-900">{s.title}</p>
              <p className="mt-0.5 truncate text-[14px] text-slate-500">{s.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </SlideFrame>
  )
}
