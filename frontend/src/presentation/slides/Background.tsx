import { Clock, Bot, PenLine } from "lucide-react"

import { Card, Reveal, SlideFrame, SlideTitle } from "@/presentation/ui"

const PAINS = [
  {
    icon: PenLine,
    title: "写得空",
    text: "结构混乱、经历堆砌，缺乏量化数据支撑，亮点淹没在平铺直叙里",
  },
  {
    icon: Bot,
    title: "对不上",
    text: "技能与目标岗位要求错配，关键词缺失，过不了 HR 筛选与机器初筛",
  },
  {
    icon: Clock,
    title: "改不好",
    text: "错别字、口语化表述残留；人工反复打磨费时费钱，收益却不稳定",
  },
]

/** 课题背景页（对应模板第 2 页「课题背景」半区）。 */
export default function Background({ step }: { step: number }) {
  return (
    <SlideFrame>
      <SlideTitle
        kicker="01 项目课题简介"
        title="课题背景：简历投出去，然后没有然后"
        subtitle="简历是求职的第一道门槛，多数求职者却过不好这道门槛"
      />

      <div className="grid grid-cols-3 gap-5">
        {PAINS.map((p) => (
          <Card key={p.title} className="flex flex-col gap-3">
            <p.icon className="size-7 text-indigo-500" strokeWidth={1.8} />
            <p className="text-[20px] font-bold text-slate-900">{p.title}</p>
            <p className="text-[15px] leading-relaxed text-slate-500">{p.text}</p>
          </Card>
        ))}
      </div>

      <Reveal at={0} step={step} className="mt-8">
        <div className="grid grid-cols-2 gap-5">
          <Card className="flex items-start gap-4">
            <div className="rounded-xl bg-slate-100 p-2.5">
              <Clock className="size-5 text-slate-500" />
            </div>
            <div>
              <p className="text-[17px] font-semibold text-slate-900">请人改：效果不稳定，成本高</p>
              <p className="mt-1 text-[14px] leading-relaxed text-slate-500">
                一份定制几百元、周期数天；质量取决于顾问个人经验，无法规模化
              </p>
            </div>
          </Card>
          <Card className="flex items-start gap-4">
            <div className="rounded-xl bg-slate-100 p-2.5">
              <Bot className="size-5 text-slate-500" />
            </div>
            <div>
              <p className="text-[17px] font-semibold text-slate-900">用工具改：只管语法，不懂岗位</p>
              <p className="mt-1 text-[14px] leading-relaxed text-slate-500">
                通用润色工具仅做纠错与同义替换，无法结合目标 JD 定向重构与挖掘亮点
              </p>
            </div>
          </Card>
        </div>
      </Reveal>

      <Reveal at={1} step={step} className="mt-8">
        <div className="rounded-2xl bg-indigo-50 px-8 py-5">
          <p className="text-[19px] leading-relaxed text-indigo-950">
            <span className="font-bold">核心洞察：</span>
            简历优化的关键不是「文字更华丽」，而是<span className="font-bold">与目标岗位精准对齐</span>
            —— 这正是大模型文本理解 + 岗位匹配算法可以规模化解决的问题。
          </p>
        </div>
      </Reveal>
    </SlideFrame>
  )
}
