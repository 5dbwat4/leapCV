import { useCallback, useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  BadgeCheck,
  FileText,
  FileUp,
  FolderOpen,
  Loader2,
  PlayCircle,
  Search,
  Upload,
  X,
} from "lucide-react"
import { toast } from "sonner"

import { fetchResumeThumb, fetchResumes, streamOptimize, uploadResume } from "@/api"
import { apiErrorMessage } from "@/api/client"
import type { ProgressEvent, ResumeOut } from "@/api/types"
import AnalysisTheater, { TheaterEventBus } from "@/components/analysis/AnalysisTheater"
import { Badge } from "@/components/ui/badge"
import { STAGES, type StageStatus } from "@/components/StageProgress"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"

const ALLOWED_EXT = [".pdf", ".docx", ".txt", ".md"]
const MAX_SIZE = 10 * 1024 * 1024

export default function WorkbenchPage() {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // 简历输入
  const [resume, setResume] = useState<ResumeOut | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [thumbUrl, setThumbUrl] = useState<string | null>(null)

  // PDF 上传成功后加载首页缩略图（Blob URL 需手动释放）
  useEffect(() => {
    let active = true
    let created: string | null = null
    if (resume?.thumb_path) {
      fetchResumeThumb(resume.id)
        .then((url) => {
          if (!active) {
            URL.revokeObjectURL(url)
            return
          }
          created = url
          setThumbUrl(url)
        })
        .catch(() => {})
    } else {
      setThumbUrl(null)
    }
    return () => {
      active = false
      if (created) URL.revokeObjectURL(created)
    }
  }, [resume])

  // JD 输入
  const [jdText, setJdText] = useState("")
  const [targetPosition, setTargetPosition] = useState("")

  // 分析进度
  const [analyzing, setAnalyzing] = useState(false)
  const [statusMap, setStatusMap] = useState<Record<string, StageStatus>>({})
  const [lastEvent, setLastEvent] = useState<ProgressEvent | null>(null)
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)
  // 分析剧场：result 到达后进入庆祝态，延迟跳转结果页；runId 变化时剧场重挂载（支持重试）
  const [analyzeDone, setAnalyzeDone] = useState(false)
  const [runId, setRunId] = useState(0)
  const busRef = useRef<TheaterEventBus | null>(null)

  // 「从已有简历中选择」
  const [savedResumes, setSavedResumes] = useState<ResumeOut[]>([])
  const [savedLoading, setSavedLoading] = useState(false)
  const [savedSearch, setSavedSearch] = useState("")
  const savedFiltered = savedResumes.filter((r) =>
    r.filename.toLowerCase().includes(savedSearch.trim().toLowerCase()),
  )

  const loadSavedResumes = async () => {
    setSavedLoading(true)
    try {
      setSavedResumes(await fetchResumes())
    } catch {
      /* 加载失败时列表留空，不影响其他 tab */
    } finally {
      setSavedLoading(false)
    }
  }

  const selectSaved = (r: ResumeOut) => {
    setResume(r)
    toast.success(`已选择简历：${r.filename}`)
  }

  const handleFile = useCallback(
    async (file: File) => {
      const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase()
      if (!ALLOWED_EXT.includes(ext)) {
        toast.error("仅支持 PDF / DOCX / TXT / MD 格式文件")
        return
      }
      if (file.size > MAX_SIZE) {
        toast.error("文件超过 10MB 限制")
        return
      }
      setUploading(true)
      try {
        const saved = await uploadResume(file)
        setResume(saved)
        toast.success(`识别完成：${file.name}`)
      } catch (err) {
        toast.error(apiErrorMessage(err, "简历识别失败"))
      } finally {
        setUploading(false)
      }
    },
    [],
  )

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) void handleFile(file)
  }

  const clearResume = () => {
    setResume(null)
  }

  const startAnalyze = async () => {
    // 运行中防重复点击；出错态允许在剧场内直接重试
    if (analyzing && !analyzeError) return
    if (!resume) {
      toast.error("请先上传简历或从已有简历中选择一份")
      return
    }
    if (jdText.trim().length < 30) {
      toast.error("JD 内容太短（至少 30 字），请粘贴完整岗位描述")
      return
    }

    setAnalyzing(true)
    setAnalyzeError(null)
    setAnalyzeDone(false)
    setStatusMap({ [STAGES[0].key]: "running" })
    setLastEvent(null)
    setRunId((id) => id + 1)

    // 剧场事件总线：细粒度 SSE 事件经此转发给全屏分析剧场
    const bus = new TheaterEventBus()
    busRef.current = bus

    try {
      const resumeId = resume.id

      const controller = new AbortController()
      abortRef.current = controller
      const stream = await streamOptimize(
        { resume_id: resumeId, jd_text: jdText.trim(), target_position: targetPosition.trim() },
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
        // 第 4 参：所有 SSE 事件转发给剧场（progress/result/error 原有行为不变）
        (event, data) => bus.emit(event, data),
      )
      setStatusMap(Object.fromEntries(STAGES.map((s) => [s.key, "done"])))
      // 剧场切换为庆祝态，留 ~900ms 展示动画再跳转结果页
      setAnalyzeDone(true)
      toast.success("分析完成")
      await new Promise((resolve) => setTimeout(resolve, 900))
      navigate(`/result/${stream.id}`)
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        toast.info("已取消本次分析")
        setAnalyzing(false) // 关闭剧场回工作台
      } else {
        const msg = err instanceof Error ? err.message : "分析失败"
        setAnalyzeError(msg)
        toast.error(msg)
        // 保持 analyzing=true：剧场切换为错误态，提供重试 / 返回
      }
    } finally {
      abortRef.current = null
    }
  }

  /** 剧场取消按钮：出错时直接关闭剧场；运行中则中断分析 */
  const cancelAnalysis = () => {
    if (analyzeError) {
      setAnalyzing(false)
      setAnalyzeError(null)
    } else {
      abortRef.current?.abort()
    }
  }

  return (
    <div className="space-y-5">
      {/* 顶部说明 */}
      <section className="rounded-2xl bg-gradient-to-r from-indigo-600 to-sky-500 p-6 text-white shadow-lg shadow-indigo-600/20">
        <h1 className="text-xl font-semibold tracking-tight">AI 简历优化工作台</h1>
        <p className="mt-1 text-sm text-white/85">
          上传简历 + 粘贴目标岗位 JD，AI 将完成匹配度分析、风险诊断、内容重构与亮点挖掘
        </p>
      </section>

      {analyzing && busRef.current ? (
        // 全屏 AI 分析剧场：fixed inset-0 接管视口；出错时剧场内提供重试 / 返回
        <AnalysisTheater
          key={runId}
          bus={busRef.current}
          statusMap={statusMap}
          progress={analyzeDone ? 100 : (lastEvent?.progress ?? 0)}
          message={lastEvent?.message ?? null}
          phase={analyzeError ? "error" : analyzeDone ? "done" : "running"}
          error={analyzeError}
          onCancel={cancelAnalysis}
          onRetry={() => void startAnalyze()}
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {/* 左：简历输入 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileUp className="size-4 text-primary" />
                我的简历
              </CardTitle>
              <CardDescription>支持 PDF / Word / TXT，AI 直接识别文件内容</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="upload" onValueChange={(v) => v === "saved" && void loadSavedResumes()}>
                <TabsList className="mb-3 w-full">
                  <TabsTrigger value="upload" className="flex-1 gap-1.5">
                    <Upload className="size-3.5" />
                    上传文件
                  </TabsTrigger>
                  <TabsTrigger value="saved" className="flex-1 gap-1.5">
                    <FolderOpen className="size-3.5" />
                    从已有简历中选择
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="upload">
                  <div
                    className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors ${
                      dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-muted/50"
                    }`}
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => {
                      e.preventDefault()
                      setDragOver(true)
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={onDrop}
                  >
                    {uploading ? (
                      <Loader2 className="size-8 animate-spin text-primary" />
                    ) : (
                      <Upload className="size-8 text-muted-foreground" />
                    )}
                    <p className="text-sm font-medium">
                      {uploading ? "正在识别文件内容…" : "点击选择文件或拖拽到此处"}
                    </p>
                    <p className="text-xs text-muted-foreground">PDF / DOCX / TXT / MD，不超过 10MB</p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.docx,.txt,.md"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) void handleFile(file)
                        e.target.value = ""
                      }}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="saved">
                  <div className="relative mb-2">
                    <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={savedSearch}
                      onChange={(e) => setSavedSearch(e.target.value)}
                      placeholder="按文件名搜索"
                      className="h-8 pl-8 text-sm"
                    />
                  </div>
                  <div className="max-h-56 divide-y divide-border/70 overflow-y-auto rounded-lg border">
                    {savedLoading ? (
                      <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                        <Loader2 className="size-4 animate-spin" />
                        加载中…
                      </div>
                    ) : savedFiltered.length === 0 ? (
                      <div className="py-8 text-center text-sm text-muted-foreground">
                        {savedResumes.length === 0
                          ? "还没有简历记录，先上传或粘贴一份吧"
                          : "没有匹配的简历，换个关键词试试"}
                      </div>
                    ) : (
                      savedFiltered.map((r) => {
                        const active = resume?.id === r.id
                        return (
                          <button
                            key={r.id}
                            className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-muted/50 ${
                              active ? "bg-primary/5" : ""
                            }`}
                            onClick={() => selectSaved(r)}
                          >
                            <FileUp className="size-4 shrink-0 text-muted-foreground" />
                            <span className="min-w-0 flex-1 truncate text-sm">{r.filename}</span>
                            <span className="hidden text-xs text-muted-foreground sm:inline">
                              {new Date(r.created_at).toLocaleDateString("zh-CN")}
                            </span>
                            {active ? (
                              <Badge className="bg-primary/10 text-primary hover:bg-primary/10">使用中</Badge>
                            ) : (
                              <span className="shrink-0 text-xs font-medium text-primary">选择</span>
                            )}
                          </button>
                        )
                      })
                    )}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    选择后系统会直接识别该简历文件用于分析；如需更换，在列表中另选或重新上传即可。
                  </p>
                </TabsContent>
              </Tabs>

              {/* 已载入简历：文件缩略图预览 */}
              {resume && (
                <div className="mt-3 flex items-center gap-3 rounded-xl border bg-muted/30 p-3">
                  {thumbUrl ? (
                    <img
                      src={thumbUrl}
                      alt="简历首页缩略图"
                      className="h-24 w-[68px] shrink-0 rounded-md border border-border bg-white object-cover"
                    />
                  ) : (
                    <div className="flex h-24 w-[68px] shrink-0 items-center justify-center rounded-md border border-border bg-white">
                      <FileText className="size-8 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{resume.filename}</p>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-emerald-600">
                      <BadgeCheck className="size-3.5" />
                      识别完成 · 从文件中提取 {resume.raw_text.length} 字
                      {resume.file_size != null && ` · ${(resume.file_size / 1024).toFixed(0)} KB`}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      已就绪，可在右侧粘贴 JD 后开始分析
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0"
                    onClick={clearResume}
                    title="移除简历"
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 右：JD 输入 */}
          <Card className="flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <PlayCircle className="size-4 text-primary" />
                目标岗位 JD
              </CardTitle>
              <CardDescription>粘贴招聘岗位描述，AI 将以此为基准做定向匹配与优化</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="target-position">
                  目标岗位名称（可选）
                </label>
                <Input
                  id="target-position"
                  value={targetPosition}
                  onChange={(e) => setTargetPosition(e.target.value)}
                  placeholder="如：Python 后端开发工程师"
                />
              </div>
              <div className="flex flex-1 flex-col gap-1.5">
                <label className="text-sm font-medium" htmlFor="jd-text">
                  岗位描述全文
                </label>
                <Textarea
                  id="jd-text"
                  value={jdText}
                  onChange={(e) => setJdText(e.target.value)}
                  placeholder="粘贴 JD 全文：岗位职责、任职要求、加分项…"
                  className="min-h-56 flex-1 resize-y text-sm leading-relaxed"
                />
                <span className="text-xs text-muted-foreground">{jdText.length} 字</span>
              </div>
            </CardContent>
          </Card>

          {/* 开始按钮 */}
          <div className="lg:col-span-2">
            <Button size="lg" className="w-full gap-2 text-base" onClick={startAnalyze}>
              <PlayCircle className="size-5" />
              开始 AI 分析与优化
            </Button>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              分析包含：简历解析 → JD 匹配 → 风险诊断 → 内容重构，全程约 1-2 分钟
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
