import { useCallback, useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  ClipboardPaste,
  FileUp,
  Loader2,
  PlayCircle,
  Trash2,
  Upload,
  X,
} from "lucide-react"
import { toast } from "sonner"

import { createResumeText, fetchResumeThumb, streamOptimize, uploadResume } from "@/api"
import { apiErrorMessage } from "@/api/client"
import type { ProgressEvent, ResumeOut } from "@/api/types"
import StageProgress, { STAGES, type StageStatus } from "@/components/StageProgress"
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
  const [resumeText, setResumeText] = useState("")
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
        setResumeText(saved.raw_text)
        toast.success(`简历解析成功：${file.name}`)
      } catch (err) {
        toast.error(apiErrorMessage(err, "简历解析失败"))
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
    setResumeText("")
  }

  const startAnalyze = async () => {
    if (analyzing) return
    const text = resumeText.trim()
    if (text.length < 50) {
      toast.error("简历内容太短（至少 50 字），请上传文件或粘贴完整简历")
      return
    }
    if (jdText.trim().length < 30) {
      toast.error("JD 内容太短（至少 30 字），请粘贴完整岗位描述")
      return
    }

    setAnalyzing(true)
    setAnalyzeError(null)
    setStatusMap({ [STAGES[0].key]: "running" })
    setLastEvent(null)

    try {
      // 有解析记录且内容未编辑 → 直接复用；否则先保存当前文本
      let resumeId = resume && resume.raw_text === resumeText ? resume.id : null
      if (!resumeId) {
        const saved = await createResumeText(resumeText, resume?.filename)
        setResume(saved)
        resumeId = saved.id
      }

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
      )
      setStatusMap(Object.fromEntries(STAGES.map((s) => [s.key, "done"])))
      toast.success("分析完成")
      navigate(`/result/${stream.id}`)
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        toast.info("已取消本次分析")
      } else {
        const msg = err instanceof Error ? err.message : "分析失败"
        setAnalyzeError(msg)
        toast.error(msg)
      }
    } finally {
      setAnalyzing(false)
      abortRef.current = null
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

      {analyzing ? (
        <Card className="mx-auto max-w-md">
          <CardHeader>
            <CardTitle className="text-base">AI 正在分析你的简历</CardTitle>
            <CardDescription>整个过程约需 1-2 分钟，请勿关闭页面</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <StageProgress stages={STAGES} statusMap={statusMap} lastEvent={lastEvent} error={analyzeError} />
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => abortRef.current?.abort()}
                disabled={!!analyzeError}
              >
                取消分析
              </Button>
              {analyzeError && (
                <Button className="flex-1" onClick={startAnalyze}>
                  重试
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {/* 左：简历输入 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileUp className="size-4 text-primary" />
                我的简历
              </CardTitle>
              <CardDescription>支持 PDF / Word / TXT，或直接粘贴文本（可编辑）</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="upload">
                <TabsList className="mb-3 w-full">
                  <TabsTrigger value="upload" className="flex-1 gap-1.5">
                    <Upload className="size-3.5" />
                    上传文件
                  </TabsTrigger>
                  <TabsTrigger value="paste" className="flex-1 gap-1.5">
                    <ClipboardPaste className="size-3.5" />
                    粘贴文本
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="upload">
                  {resume && resume.filename !== "粘贴的简历" ? (
                    <div className="mb-3 flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm">
                      {thumbUrl ? (
                        <img
                          src={thumbUrl}
                          alt="简历首页缩略图"
                          className="h-14 w-10 shrink-0 rounded border border-border object-cover"
                        />
                      ) : (
                        <FileUp className="size-4 shrink-0 text-primary" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{resume.filename}</p>
                        <p className="text-xs text-muted-foreground">
                          已解析 {resumeText.length} 字
                          {resume.file_size != null && ` · ${(resume.file_size / 1024).toFixed(0)} KB`}
                        </p>
                      </div>
                      <Button variant="ghost" size="icon" className="size-7" onClick={clearResume}>
                        <X className="size-4" />
                      </Button>
                    </div>
                  ) : (
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
                        {uploading ? "正在解析简历…" : "点击选择文件或拖拽到此处"}
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
                  )}
                </TabsContent>

                <TabsContent value="paste">
                  {!resume && (
                    <p className="mb-2 text-xs text-muted-foreground">
                      将简历全文粘贴到下方，解析结果同样可以编辑
                    </p>
                  )}
                </TabsContent>
              </Tabs>

              <Textarea
                value={resumeText}
                onChange={(e) => setResumeText(e.target.value)}
                placeholder="简历内容将显示在这里，上传或粘贴后可手动微调…"
                className="mt-2 min-h-56 resize-y font-mono text-xs leading-relaxed"
              />
              <div className="mt-1.5 flex items-center justify-between text-xs text-muted-foreground">
                <span>{resumeText.length} 字</span>
                {resumeText && (
                  <button
                    className="flex items-center gap-1 hover:text-destructive"
                    onClick={clearResume}
                  >
                    <Trash2 className="size-3" />
                    清空
                  </button>
                )}
              </div>
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
