import { useEffect, useRef, useState } from "react"
import { Link, useLocation, useNavigate, useParams } from "react-router-dom"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import {
  ArrowDown,
  ArrowLeft,
  BadgeCheck,
  ChevronDown,
  CircleAlert,
  Copy,
  Download,
  FileCode,
  FileDown,
  FileText,
  Flame,
  ListChecks,
  Loader2,
  Printer,
  RefreshCw,
  ScrollText,
  Target,
  TriangleAlert,
} from "lucide-react"
import { toast } from "sonner"

import { createResumeText, fetchHistoryDetail, streamOptimize } from "@/api"
import { downloadExport, downloadMarkdown, type ExportFormat } from "@/api/download"
import type { AnalysisResult, HistoryDetail, ProgressEvent, ResumeIssue } from "@/api/types"
import ScoreRing from "@/components/ScoreRing"
import StageProgress, { STAGES, type StageStatus } from "@/components/StageProgress"
import RecheckBanner, { type RecheckState } from "@/components/recheck/RecheckBanner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
// 复制 / 下载入口已统一收进页面顶部的「导出」下拉菜单
function ResumeTab({ result }: { result: AnalysisResult }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="size-4 text-primary" />
          优化后简历（Markdown）
        </CardTitle>
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
              {pair.answer && (
                <p className="flex items-center gap-1.5 text-xs text-indigo-600">
                  <span className="rounded bg-indigo-100 px-1.5 py-0.5 font-medium">Quick check</span>
                  已采用你补充的信息：{pair.answer}
                </p>
              )}
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
  const location = useLocation()
  const navigate = useNavigate()
  const [detail, setDetail] = useState<HistoryDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  // 导出状态：记录当前正在导出的格式（控制按钮与菜单项 loading）
  const [exporting, setExporting] = useState<ExportFormat | null>(null)

  // 复检流程状态（弹窗 + 阶段进度）
  const [recheckOpen, setRecheckOpen] = useState(false)
  const [rechecking, setRechecking] = useState(false)
  const [statusMap, setStatusMap] = useState<Record<string, StageStatus>>({})
  const [lastEvent, setLastEvent] = useState<ProgressEvent | null>(null)
  const [recheckError, setRecheckError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // 复检完成后跳转到新报告，新页面通过路由 state 拿到旧分做对比
  const recheckState = (location.state as { recheck?: RecheckState } | null)?.recheck ?? null

  useEffect(() => {
    if (!id) return
    fetchHistoryDetail(id)
      .then(setDetail)
      .catch(() => setError("加载分析结果失败，请从历史记录中重新打开"))
  }, [id])

  // 复制优化稿 Markdown（保留原逻辑与 toast）
  const handleCopy = async () => {
    if (!detail) return
    try {
      await navigator.clipboard.writeText(detail.result.optimized_resume_md)
      toast.success("已复制到剪贴板")
    } catch {
      toast.error("复制失败，请手动选择文本复制")
    }
  }

  // 下载优化稿 .md 文件
  const handleDownloadMd = () => {
    if (!detail) return
    downloadMarkdown(
      detail.result.optimized_resume_md,
      `优化后简历-${detail.result.resume_overview.name || "未命名"}.md`,
    )
  }

  // 导出 Word / LaTeX / PDF（PDF 503 且提示 TeX 缺失时自动回退下载 .tex）
  const handleExport = async (fmt: ExportFormat) => {
    if (!detail || exporting) return
    setExporting(fmt)
    try {
      await downloadExport(detail.id, fmt)
      toast.success(
        fmt === "docx" ? "Word 文档已开始下载" : fmt === "tex" ? "LaTeX 源文件已开始下载" : "PDF 已开始下载",
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : "导出失败，请稍后重试"
      if (fmt === "pdf" && msg.includes("TeX")) {
        // 服务器未安装 TeX：回退下载 LaTeX 源文件
        try {
          await downloadExport(detail.id, "tex")
          toast.info("服务器未安装 TeX，已为你下载 LaTeX 源文件")
        } catch {
          toast.error("LaTeX 源文件下载失败，请稍后重试")
        }
      } else {
        toast.error(msg)
      }
    } finally {
      setExporting(null)
    }
  }

  // 前端打印 / 另存为 PDF（配合 index.css 的 @media print 规则只输出当前页签内容）
  const handlePrint = () => window.print()

  // 「用优化稿复检」：把优化稿存为新简历 → 同一 JD 重新流式分析 → 跳转新报告
  const startRecheck = async () => {
    if (!detail || rechecking) return
    const prevResult = detail.result

    setRecheckOpen(true)
    setRechecking(true)
    setRecheckError(null)
    setStatusMap({ [STAGES[0].key]: "running" })
    setLastEvent(null)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      // 1) 优化稿文本保存为一份新简历
      const resume = await createResumeText(
        prevResult.optimized_resume_md,
        `【复检】${detail.target_position || "岗位"}·优化稿`,
      )
      // 2) 用同一份 JD 重新流式分析（阶段推进逻辑与工作台一致）
      const stream = await streamOptimize(
        {
          resume_id: resume.id,
          jd_text: detail.jd_text,
          target_position: detail.target_position || "",
        },
        (event) => {
          setLastEvent(event)
          setStatusMap((prev) => {
            const next = { ...prev }
            const idx = STAGES.findIndex((s) => s.key === event.stage)
            if (idx === -1) return prev
            STAGES.forEach((s, i) => {
              if (i < idx) next[s.key] = "done"
            })
            next[event.stage] = "running"
            return next
          })
        },
        controller.signal,
      )
      // 3) 完成后关闭弹窗并跳转新报告，带上旧分信息用于对比横幅
      setRecheckOpen(false)
      navigate(`/result/${stream.id}`, {
        state: {
          recheck: {
            prevTotal: prevResult.match.total,
            prevDimensions: prevResult.match.dimensions,
            prevId: detail.id,
          } satisfies RecheckState,
        },
      })
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        toast.info("已取消本次复检")
        setRecheckOpen(false)
      } else {
        const msg = err instanceof Error ? err.message : "复检失败，请稍后重试"
        setRecheckError(msg)
        toast.error(msg)
      }
    } finally {
      setRechecking(false)
      abortRef.current = null
    }
  }

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
      {/* 复检完成对比横幅（仅当通过复检跳转携带 state 时显示，刷新后自动消失） */}
      {recheckState && (
        <RecheckBanner
          state={recheckState}
          newTotal={result.match.total}
          newDimensions={result.match.dimensions}
        />
      )}

      {/* 顶部信息条（不参与打印） */}
      <div className="no-print flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" size="icon" className="size-8">
          <Link to="/history">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
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

        {/* 操作区 */}
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link to={`/result/${detail.id}/report`}>
              <ScrollText className="size-4" />
              匹配报告
            </Link>
          </Button>

          {/* 复检闭环入口 */}
          <Button size="sm" className="gap-1.5" onClick={() => void startRecheck()} disabled={rechecking}>
            <RefreshCw className="size-4" />
            用优化稿复检
          </Button>

          {/* 导出下拉菜单 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5" disabled={exporting !== null}>
                {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                导出
                <ChevronDown className="size-3.5 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuItem className="gap-2.5 py-1.5" onClick={() => void handleCopy()}>
                <Copy className="size-4 text-primary" />
                <span className="flex flex-col gap-0.5">
                  <span>复制 Markdown</span>
                  <span className="text-xs font-normal text-muted-foreground">优化稿全文进入剪贴板</span>
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2.5 py-1.5" onClick={handleDownloadMd}>
                <FileText className="size-4 text-primary" />
                <span className="flex flex-col gap-0.5">
                  <span>下载 .md</span>
                  <span className="text-xs font-normal text-muted-foreground">Markdown 源文件</span>
                </span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="gap-2.5 py-1.5"
                disabled={exporting !== null}
                onClick={() => void handleExport("docx")}
              >
                {exporting === "docx" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <FileDown className="size-4 text-primary" />
                )}
                <span className="flex flex-col gap-0.5">
                  <span>导出 Word (.docx)</span>
                  <span className="text-xs font-normal text-muted-foreground">适合直接投递或上传求职网站</span>
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="gap-2.5 py-1.5"
                disabled={exporting !== null}
                onClick={() => void handleExport("tex")}
              >
                {exporting === "tex" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <FileCode className="size-4 text-primary" />
                )}
                <span className="flex flex-col gap-0.5">
                  <span>导出 LaTeX (.tex)</span>
                  <span className="text-xs font-normal text-muted-foreground">学术投递常用的排版源码</span>
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="gap-2.5 py-1.5"
                disabled={exporting !== null}
                onClick={() => void handleExport("pdf")}
              >
                {exporting === "pdf" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <FileDown className="size-4 text-primary" />
                )}
                <span className="flex flex-col gap-0.5">
                  <span>导出 PDF</span>
                  <span className="text-xs font-normal text-muted-foreground">服务器排版，未装 TeX 时自动回退</span>
                </span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-2.5 py-1.5" onClick={handlePrint}>
                <Printer className="size-4 text-primary" />
                <span className="flex flex-col gap-0.5">
                  <span>打印 / 另存为 PDF</span>
                  <span className="text-xs font-normal text-muted-foreground">用浏览器打印当前页签内容</span>
                </span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Badge className={adviceBadgeClass(result.match.advice)}>{result.match.advice}</Badge>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="no-print w-full justify-start overflow-x-auto sm:w-auto">
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

      {/* 复检进行中弹窗（可取消，出错可重试） */}
      <Dialog
        open={recheckOpen}
        onOpenChange={(open) => {
          if (!open && rechecking) {
            // 通过 ESC / 点击遮罩关闭等同于取消
            abortRef.current?.abort()
          }
          setRecheckOpen(open)
        }}
      >
        <DialogContent showCloseButton={false} className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>AI 复检进行中</DialogTitle>
            <DialogDescription>正在用优化后的简历对同一岗位重新发起分析，完成后将自动跳转到新报告</DialogDescription>
          </DialogHeader>
          <StageProgress stages={STAGES} statusMap={statusMap} lastEvent={lastEvent} error={recheckError} />
          <DialogFooter>
            {recheckError ? (
              <>
                <Button variant="outline" className="flex-1" onClick={() => setRecheckOpen(false)}>
                  关闭
                </Button>
                <Button className="flex-1" onClick={() => void startRecheck()}>
                  重试
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                className="w-full"
                disabled={!rechecking}
                onClick={() => abortRef.current?.abort()}
              >
                取消复检
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
