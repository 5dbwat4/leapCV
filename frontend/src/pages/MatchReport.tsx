import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import {
  ArrowLeft,
  CircleCheck,
  CircleX,
  FileText,
  Lightbulb,
  Printer,
  RotateCcw,
  ScrollText,
} from "lucide-react"

import { fetchHistoryDetail, fetchResume } from "@/api"
import type { HistoryDetail, MatchReport, ReportCategory, ResumeOut } from "@/api/types"
import ScoreRing from "@/components/ScoreRing"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

function categoryBarClass(score: number): string {
  if (score >= 80) return "bg-emerald-500"
  if (score >= 50) return "bg-sky-500"
  return "bg-red-500"
}

function scrollToCategory(key: string) {
  document.getElementById(`cat-${key}`)?.scrollIntoView({ behavior: "smooth", block: "start" })
}

// ---------- 侧边栏 ----------
function ReportSidebar({ report, matchTotal }: { report: MatchReport; matchTotal: number }) {
  return (
    <aside className="no-print space-y-4 self-start lg:sticky lg:top-20">
      <Card className="flex flex-col items-center gap-1 py-6">
        <CardTitle className="text-base">匹配率</CardTitle>
        <ScoreRing score={matchTotal} size={150} label="" />
        <p className="text-xs text-muted-foreground">
          通过 {report.total_passed} 项 · 待改进 {report.total_failed} 项
        </p>
      </Card>

      <Button asChild className="w-full gap-2">
        <Link to="/">
          <RotateCcw className="size-4" />
          重新分析
        </Link>
      </Button>

      <Card>
        <CardContent className="space-y-3 p-4">
          {report.categories.map((cat) => (
            <button
              key={cat.key}
              className="block w-full text-left"
              onClick={() => scrollToCategory(cat.key)}
            >
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="font-medium">{cat.name}</span>
                {cat.issues > 0 ? (
                  <span className="text-xs text-primary hover:underline">{cat.issues} 项待改进</span>
                ) : (
                  <span className="text-xs text-emerald-600">全部通过</span>
                )}
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${categoryBarClass(cat.score)}`}
                  style={{ width: `${cat.score}%` }}
                />
              </div>
            </button>
          ))}
        </CardContent>
      </Card>
    </aside>
  )
}

// ---------- 检查项区块 ----------
function CategorySection({ category }: { category: ReportCategory }) {
  return (
    <section id={`cat-${category.key}`} className="scroll-mt-20 space-y-2 print-break-inside">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-xl font-semibold tracking-tight">{category.name}</h2>
        <Badge
          variant="outline"
          className={
            category.score >= 80
              ? "border-emerald-200 text-emerald-600"
              : category.score >= 50
                ? "border-sky-200 text-sky-600"
                : "border-red-200 text-red-600"
          }
        >
          {category.score} 分
        </Badge>
        {category.score < 60 && (
          <Badge className="bg-foreground text-background hover:bg-foreground">重点改进</Badge>
        )}
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">{category.intro}</p>
      {category.score < 60 && (
        <p className="text-sm">
          <span className="font-medium">提示：</span>
          优先修复下方的红叉项，可明显提升该维度得分。
        </p>
      )}

      <Card>
        <CardContent className="divide-y divide-border/70 p-0">
          {category.checks.map((check, i) => (
            <div key={i} className="flex gap-3 px-4 py-3">
              {check.passed ? (
                <CircleCheck className="mt-0.5 size-5 shrink-0 text-emerald-500" />
              ) : (
                <CircleX className="mt-0.5 size-5 shrink-0 text-red-500" />
              )}
              <div className="min-w-0 space-y-1">
                <p className={`text-sm leading-relaxed ${check.passed ? "" : "font-medium text-red-600"}`}>
                  {check.text}
                </p>
                {!check.passed && check.tip && (
                  <p className="flex gap-1.5 text-xs leading-relaxed text-muted-foreground">
                    <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
                    <span>{check.tip}</span>
                  </p>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </section>
  )
}

// ---------- 页面 ----------
export default function MatchReportPage() {
  const { id } = useParams<{ id: string }>()
  const [detail, setDetail] = useState<HistoryDetail | null>(null)
  const [resume, setResume] = useState<ResumeOut | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    fetchHistoryDetail(id)
      .then(async (d) => {
        setDetail(d)
        try {
          setResume(await fetchResume(d.resume_id))
        } catch {
          /* 原文加载失败不影响报告展示 */
        }
      })
      .catch(() => setError("加载匹配报告失败，请从历史记录中重新打开"))
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
      <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
        <div className="space-y-4">
          <Skeleton className="h-52" />
          <Skeleton className="h-64" />
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  const result = detail.result
  const report = result.report

  if (!report || report.categories.length === 0) {
    return (
      <div className="py-20 text-center">
        <p className="text-muted-foreground">该记录生成于匹配报告功能上线前，暂时无法查看报告</p>
        <Button asChild className="mt-4 gap-2">
          <Link to="/">
            <RotateCcw className="size-4" />
            重新分析生成报告
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* 顶栏 */}
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" size="icon" className="no-print size-8">
          <Link to={`/result/${detail.id}`}>
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <p className="text-xs text-muted-foreground">简历匹配报告</p>
          <h1 className="flex flex-wrap items-center gap-2 text-lg font-semibold tracking-tight">
            {detail.target_position || "未命名岗位"}
            {result.mock && (
              <Badge variant="outline" className="border-amber-300 text-amber-600">
                演示数据
              </Badge>
            )}
          </h1>
        </div>
        <Button variant="outline" className="no-print gap-2" onClick={() => window.print()}>
          <Printer className="size-4" />
          打印报告
        </Button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
        <ReportSidebar report={report} matchTotal={result.match.total} />

        <main>
          <Tabs defaultValue="checks">
            <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
              <TabsTrigger value="checks" className="gap-1.5">
                <ScrollText className="size-3.5" />
                检查项
              </TabsTrigger>
              <TabsTrigger value="resume" className="gap-1.5">
                <FileText className="size-3.5" />
                简历原文
              </TabsTrigger>
              <TabsTrigger value="jd" className="gap-1.5">
                岗位 JD
              </TabsTrigger>
            </TabsList>

            <TabsContent value="checks" className="mt-4 space-y-8">
              {report.categories.map((cat) => (
                <CategorySection key={cat.key} category={cat} />
              ))}
            </TabsContent>

            <TabsContent value="resume" className="mt-4">
              <Card>
                <CardContent className="p-6">
                  <pre className="font-mono text-xs leading-relaxed whitespace-pre-wrap">
                    {resume?.raw_text ?? "简历原文加载失败，不影响报告结论。"}
                  </pre>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="jd" className="mt-4">
              <Card>
                <CardContent className="p-6">
                  <pre className="font-mono text-xs leading-relaxed whitespace-pre-wrap">
                    {detail.jd_text}
                  </pre>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  )
}
