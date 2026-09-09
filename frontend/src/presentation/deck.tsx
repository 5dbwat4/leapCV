import type { SlideDef } from "@/presentation/player/types"

import Agenda, { type DeckSection } from "@/presentation/slides/Agenda"
import Cover from "@/presentation/slides/Cover"
import SectionDivider from "@/presentation/slides/SectionDivider"
import Thanks from "@/presentation/slides/Thanks"

/** 六个章节（对齐课程考核参考模板的 8 页骨架并扩展）。 */
export const SECTIONS: DeckSection[] = [
  {
    no: "01",
    title: "项目课题简介",
    desc: "求职痛点与课题目标：为什么做、做成什么。",
    pages: ["课题背景", "课题目标"],
  },
  {
    no: "02",
    title: "项目课题方案",
    desc: "总体架构、五阶段分析管线与技术选型。",
    pages: ["总体架构", "五阶段分析管线", "技术选型"],
  },
  {
    no: "03",
    title: "关键技术实现",
    desc: "六项核心技术：从 LLM 可靠调用到实时可视化与导出。",
    pages: ["LLM 可靠调用", "JD 匹配算法", "SSE 流式管线", "Quick check 问答门", "实时分析剧场", "导出链路"],
  },
  {
    no: "04",
    title: "代码展示",
    desc: "核心模块的关键实现节选。",
    pages: ["匹配算法", "管线骨架", "重试梯度", "SSE 桥接"],
  },
  {
    no: "05",
    title: "项目演示",
    desc: "从上传简历到导出的完整演示流程。",
    pages: ["演示流程", "核心界面"],
  },
  {
    no: "06",
    title: "总结与展望",
    desc: "过程中的问题复盘与下一步优化思考。",
    pages: ["问题与解决", "优化思考"],
  },
]

function sectionDivider(section: (typeof SECTIONS)[number]): SlideDef {
  return {
    id: `section-${section.no}`,
    section: "章节",
    title: section.title,
    render: () => (
      <SectionDivider no={section.no} title={section.title} desc={section.desc} pages={section.pages} />
    ),
  }
}

/** 组装完整幻灯片序列：各内容页在后续提交中按章节插入对应位置。 */
export function buildDeck(): SlideDef[] {
  const [s1, s2, s3, s4, s5, s6] = SECTIONS
  return [
    { id: "cover", title: "封面", render: () => <Cover /> },
    { id: "agenda", title: "汇报内容", render: () => <Agenda sections={SECTIONS} /> },
    sectionDivider(s1),
    sectionDivider(s2),
    sectionDivider(s3),
    sectionDivider(s4),
    sectionDivider(s5),
    sectionDivider(s6),
    { id: "thanks", title: "致谢", render: () => <Thanks /> },
  ]
}
