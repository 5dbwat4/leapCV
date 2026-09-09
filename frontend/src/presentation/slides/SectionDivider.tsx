import { SlideFrame } from "@/presentation/ui"

/** 章节过渡页：深色氛围 + 超大章节数字 + 本章小节预告。 */
export default function SectionDivider({
  no,
  title,
  desc,
  pages,
}: {
  no: string
  title: string
  desc: string
  pages: string[]
}) {
  return (
    <SlideFrame dark className="justify-center">
      <div className="flex items-center gap-14">
        <div className="flex flex-col items-start">
          <span className="text-[168px] font-bold leading-none tracking-tighter text-white/[0.07]">
            {no}
          </span>
          <span className="-mt-10 font-mono text-[13px] tracking-[0.35em] text-indigo-300">
            SECTION {no}
          </span>
        </div>
        <div className="min-w-0 flex-1 border-l border-white/10 pl-14">
          <h1 className="text-[46px] font-bold tracking-tight text-white">{title}</h1>
          <p className="mt-4 max-w-[560px] text-[17px] leading-relaxed text-white/50">{desc}</p>
          <div className="mt-7 flex flex-wrap gap-x-6 gap-y-2">
            {pages.map((p) => (
              <span key={p} className="flex items-center gap-2 text-[14px] text-white/70">
                <span className="size-1 rounded-full bg-indigo-400" />
                {p}
              </span>
            ))}
          </div>
        </div>
      </div>
    </SlideFrame>
  )
}
