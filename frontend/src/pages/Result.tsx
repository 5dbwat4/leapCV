import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import {
  ArrowDown,
  ArrowLeft,
  BadgeCheck,
  CircleAlert,
  Copy,
  Download,
  FileText,
  Flame,
  ListChecks,
  ScrollText,
  Target,
  TriangleAlert,
} from "lucide-react"
import { toast } from "sonner"

import { fetchHistoryDetail } from "@/api"
import type { AnalysisResult, HistoryDetail, ResumeIssue } from "@/api/types"
import ScoreRing from "@/components/ScoreRing"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

function adviceBadgeClass(advice: string): string {
  if (advice.includes("建议投递") && !advice.includes("补强"))
    return "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
  if (advice.includes("补强")) return "bg-amber-100 text-amber-700 hover:bg-amber-100"
  return "bg-red-100 text-red-700 hover:bg-red-100"
}

function severityClass(severity: string): { border: string; badge: string } {
  if (severity === "高") return { border: "border-l-red-500", badge: "bg-red-100 text-red-700" }
  if (severity === "中") return { border: "border-l-amber-500", badge: "bg-amber-100 text-amber-700" }
  return { border: "border-l-sky-500", badge: "bg-sky-100 text-sky-700" }
}// ---------- 总览 ----------
function OverviewTab({ result }: { result: AnalysisResult }) {
  const { match, resume_overview, highlights, summary } = result
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="flex flex-col items-center justify-center gap-2 py-6">
          <ScoreRing score={match.total} />
          <Badge className={adviceBadgeClass(match.advice)}>{match.advice}</Badge>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="size-4 text-primary" />
              维度得分
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {match.dimensions.map((d) => (
              <div key={d.name}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium">{d.name}</span>
                  <span className="tabular-nums text-muted-foreground">{d.score} 分</span>
                </div>
                <Progress value={d.score} className="h-2" />
                {d.detail && <p className="mt-1 text-xs text-muted-foreground">{d.detail}</p>}
              </div>
            ))}
            <Separator />
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
              {resume_overview.name && (
                <span>
                  简历姓名：<b className="text-foreground">{resume_overview.name}</b>
                </span>
              )}
              {resume_overview.current_position && (
                <span>
                  求职方向：<b className="text-foreground">{resume_overview.current_position}</b>
                </span>
              )}
              {resume_overview.years_of_experience != null && (
                <span>
                  工作年限：<b className="text-foreground">{resume_overview.years_of_experience} 年</b>
                </span>
              )}
            </div>
            {resume_overview.sections_missing.length > 0 && (
              <p className="text-xs text-muted-foreground">
                简历缺失板块：{resume_overview.sections_missing.join("、")}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ListChecks className="size-4 text-primary" />
            投递建议
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="leading-relaxed">{match.advice_reason || summary}</p>
          {match.gaps_summary && (
            <p className="leading-relaxed text-muted-foreground">{match.gaps_summary}</p>
          )}
          {highlights.length > 0 && (
            <div>
              <p className="mb-1.5 flex items-center gap-1 font-medium">
                <Flame className="size-4 text-orange-500" />
                核心亮点
              </p>
              <ul className="space-y-1">
                {highlights.map((h, i) => (
                  <li key={i} className="flex gap-2">
                    <BadgeCheck className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {match.strengths.length > 0 && (
            <div>
              <p className="mb-1.5 font-medium">针对该岗位的优势</p>
              <ul className="space-y-1 text-muted-foreground">
                {match.strengths.map((s, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ---------- 匹配分析 ----------
function MatchTab({ result }: { result: AnalysisResult }) {
  const { match } = result
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-emerald-600">
            <BadgeCheck className="size-4" />
            已匹配的能力与技能（{match.matched_skills.length}）
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2.5">
          {match.matched_skills.map((s) => (
            <div key={s.name} className="rounded-lg border border-emerald-100 bg-emerald-50/60 px-3 py-2">
              <Badge variant="outline" className="border-emerald-300 bg-white text-emerald-700">
                {s.name}
              </Badge>
              {s.evidence && <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{s.evidence}</p>}
            </div>
          ))}
          {match.matched_skills.length === 0 && (
            <p className="text-sm text-muted-foreground">未识别到明显匹配项</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-red-600">
            <CircleAlert className="size-4" />
            待补强的差距（{match.missing_skills.length}）
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2.5">
          {match.missing_skills.map((s) => (
            <div key={s.name} className="rounded-lg border border-red-100 bg-red-50/50 px-3 py-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="border-red-200 bg-white text-red-700">
                  {s.name}
                </Badge>
                <Badge
                  variant="outline"
                  className={
                    s.importance === "高"
                      ? "border-red-200 text-red-600"
                      : s.importance === "中"
                        ? "border-amber-200 text-amber-600"
                        : "border-sky-200 text-sky-600"
                  }
                >
                  重要度 {s.importance}
                </Badge>
              </div>
              {s.advice && <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{s.advice}</p>}
            </div>
          ))}
          {match.missing_skills.length === 0 && (
            <p className="text-sm text-muted-foreground">没有发现明显差距，匹配情况良好</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ---------- 风险诊断 ----------
function IssueCard({ issue }: { issue: ResumeIssue }) {
  const cls = severityClass(issue.severity)
  return (
    <div className={`rounded-lg border border-border border-l-4 bg-card p-4 ${cls.border}`}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="font-medium">
          {issue.type}
        </Badge>
        <Badge className={cls.badge}>严重度：{issue.severity}</Badge>
        {issue.location && <span className="text-xs text-muted-foreground">{issue.location}</span>}
      </div>
      {issue.original && (
        <blockquote className="mb-2 rounded bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
          原文：{issue.original}
        </blockquote>
      )}
      <p className="text-sm leading-relaxed">{issue.problem}</p>
      <p className="mt-1.5 flex gap-1.5 text-sm leading-relaxed text-emerald-700">
        <span className="shrink-0 font-medium">建议：</span>
        <span>{issue.suggestion}</span>
      </p>
    </div>
  )
}

function IssuesTab({ result }: { result: AnalysisResult }) {
  const issues = result.issues
  const counts = {
    高: issues.filter((i) => i.severity === "高").length,
    中: issues.filter((i) => i.severity === "中").length,
    低: issues.filter((i) => i.severity === "低").length,
  }
  return (
    <div className="space-y-3">
      {issues.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            未发现明显风险问题
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <TriangleAlert className="size-4 text-amber-500" />
            共发现 <b className="text-foreground">{issues.length}</b> 个问题：
            <span className="text-red-600">高 {counts["高"]}</span>·
            <span className="text-amber-600">中 {counts["中"]}</span>·
            <span className="text-sky-600">低 {counts["低"]}</span>
          </div>
          {issues.map((issue, i) => (
            <IssueCard key={i} issue={issue} />
          ))}
        </>
      )}
    </div>
  )
}

// ---------- 优化简历 ----------
function ResumeTab({ result }: { result: AnalysisResult }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(result.optimized_resume_md)
      toast.success("已复制到剪贴板")
    } catch {
      toast.error("复制失败，请手动选择文本复制")
    }
  }

  const download = () => {
    const blob = new Blob([result.optimized_resume_md], { type: "text/markdown;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `优化后简历-${result.resume_overview.name || "未命名"}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="size-4 text-primary" />
          优化后简历（Markdown）
        </CardTitle>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={copy}>
            <Copy className="size-4" />
            复制全文
          </Button>
          <Button variant="outline" size="sm" onClick={download}>
            <Download className="size-4" />
            下载 .md
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="prose prose-slate prose-sm max-w-none prose-headings:mt-5 prose-headings:mb-2 prose-h1:text-xl prose-h2:text-lg prose-h2:border-b prose-h2:pb-1.5 prose-h3:text-base prose-li:my-0.5">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.optimized_resume_md}</ReactMarkdown>
        </div>
        {result.optimized_resume_md.includes("【请补充") && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            提示：简历中标注「【请补充：…】」的位置需要你填入真实数据，切勿虚构。
          </p>
        )}
      </CardContent>
    </Card>
  )
}

// ---------- 修改对比 ----------
function DiffTab({ result }: { result: AnalysisResult }) {
  const pairs = result.rewrite_pairs
  return (
    <div className="space-y-3">
      {pairs.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            暂无改写对比数据
          </CardContent>
        </Card>
      ) : (
        pairs.map((pair, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {pair.section}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              <div className="rounded-lg border border-red-100 bg-red-50/50 px-3 py-2">
                <span className="mb-1 inline-block rounded bg-red-500 px-1.5 py-0.5 text-[10px] font-medium text-white">
                  改写前
                </span>
                <p className="text-sm leading-relaxed text-muted-foreground">{pair.before}</p>
              </div>
              <div className="flex justify-center">
                <ArrowDown className="size-4 text-muted-foreground" />
              </div>
              <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 px-3 py-2">
                <span className="mb-1 inline-block rounded bg-emerald-500 px-1.5 py-0.5 text-[10px] font-medium text-white">
                  改写后
                </span>
                <p className="text-sm leading-relaxed">{pair.after}</p>
              </div>
              {pair.reason && (
                <p className="flex gap-1.5 text-xs leading-relaxed text-muted-foreground">
                  <span className="shrink-0 font-medium text-primary">改写理由：</span>
                  <span>{pair.reason}</span>
                </p>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}

// ---------- 页面 ----------
export default function ResultPage() {
  const { id } = useParams<{ id: string }>()
  const [detail, setDetail] = useState<HistoryDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    fetchHistoryDetail(id)
      .then(setDetail)
      .catch(() => setError("加载分析结果失败，请从历史记录中重新打开"))
  }, [id])

  if (error) {
    return (
      <div className="py-20 text-center">
        <p className="text-muted-foreground">{error}</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/history">返回历史记录</Link>
        </Button>
      </div>
    )
  }

  if (!detail) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-52" />
          <Skeleton className="h-52 lg:col-span-2" />
        </div>
      </div>
    )
  }

  const result = detail.result

  return (
    <div className="space-y-4">
      {/* 顶部信息条 */}
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" size="icon" className="size-8">
          <Link to="/history">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="flex flex-wrap items-center gap-2 text-lg font-semibold tracking-tight">
            {detail.target_position || "简历分析报告"}
            {result.mock && (
              <Badge variant="outline" className="border-amber-300 text-amber-600">
                演示数据
              </Badge>
            )}
          </h1>
          <p className="text-xs text-muted-foreground">
            分析时间：{new Date(detail.created_at).toLocaleString("zh-CN")}
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="gap-1.5">
          <Link to={`/result/${detail.id}/report`}>
            <ScrollText className="size-4" />
            匹配报告
          </Link>
        </Button>
        <Badge className={adviceBadgeClass(result.match.advice)}>{result.match.advice}</Badge>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
          <TabsTrigger value="overview">总览</TabsTrigger>
          <TabsTrigger value="match">匹配分析</TabsTrigger>
          <TabsTrigger value="issues" className="gap-1">
            风险诊断
            {result.issues.length > 0 && (
              <span className="rounded-full bg-red-100 px-1.5 text-xs text-red-600">
                {result.issues.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="resume">优化简历</TabsTrigger>
          <TabsTrigger value="diff">修改对比</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <OverviewTab result={result} />
        </TabsContent>
        <TabsContent value="match" className="mt-4">
          <MatchTab result={result} />
        </TabsContent>
        <TabsContent value="issues" className="mt-4">
          <IssuesTab result={result} />
        </TabsContent>
        <TabsContent value="resume" className="mt-4">
          <ResumeTab result={result} />
        </TabsContent>
        <TabsContent value="diff" className="mt-4">
          <DiffTab result={result} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
