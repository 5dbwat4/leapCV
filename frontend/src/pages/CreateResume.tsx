import { useEffect, useRef, useState } from "react"
import axios from "axios"
import { Link, useNavigate } from "react-router-dom"
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Download,
  FileText,
  Loader2,
  MessageCircle,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
  Trash2,
} from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { toast } from "sonner"

import {
  downloadResumePdf,
  fetchCreateMode,
  fetchCreateSteps,
  fetchResumePdfBlob,
  finishCreate,
  finishCreateChat,
  sendCreateChatMessage,
  startCreateChat,
} from "@/api"
import { apiErrorMessage } from "@/api/client"
import type {
  CreateAnswers,
  CreateFinishResult,
  CreateStepDef,
} from "@/api/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Textarea } from "@/components/ui/textarea"

type Phase = "loading" | "wizard" | "generating" | "done"

function emptyAnswers(): CreateAnswers {
  return {
    name: "",
    phone: "",
    email: "",
    city: "",
    intent: "",
    links: "",
    education: [],
    work: [],
    internships: [],
    projects: [],
    skills: "",
    awards: "",
    self_evaluation: "",
  }
}

// 各 list 步骤对应 answers 上的字段名
const LIST_KEY: Record<string, "education" | "work" | "internships" | "projects"> = {
  education: "education",
  work: "work",
  internship: "internships",
  project: "projects",
}

const MAX_ENTRIES: Record<string, number> = {
  education: 4,
  work: 6,
  internship: 6,
  project: 6,
}

/** list 步骤的草稿条目：所有字段统一为字符串（多行字段用换行符承载） */
type ListEntry = Record<string, string>

/** 从 answers 读取某 list 步骤的条目（复制；textarea 字段数组 → 换行字符串，编辑不影响源数据） */
function readList(answers: CreateAnswers, step: CreateStepDef): ListEntry[] {
  const key = LIST_KEY[step.id]
  if (!key) return []
  const rows = answers[key] as unknown as Record<string, unknown>[]
  return rows.map((row) => {
    const entry: ListEntry = {}
    for (const f of step.fields) {
      const v = row[f.name]
      entry[f.name] = Array.isArray(v) ? v.join("\n") : String(v ?? "")
    }
    return entry
  })
}

function blankEntry(step: CreateStepDef): ListEntry {
  const entry: ListEntry = {}
  for (const f of step.fields) entry[f.name] = ""
  return entry
}

// ---------- 表单渲染 ----------
function FieldError({ text }: { text?: string }) {
  if (!text) return null
  return <p className="text-xs text-destructive">{text}</p>
}

function FormFields({
  step,
  draft,
  errors,
  onChange,
}: {
  step: CreateStepDef
  draft: Record<string, string>
  errors: Record<string, string>
  onChange: (name: string, value: string) => void
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {step.fields.map((f) => (
        <div key={f.name} className={f.type === "textarea" ? "sm:col-span-2" : ""}>
          <div className="mb-1.5 flex items-center gap-1">
            <Label className="text-sm">{f.label}</Label>
            {f.required && <span className="text-destructive">*</span>}
          </div>
          {f.type === "textarea" ? (
            <Textarea
              className="min-h-24 text-sm"
              placeholder={f.placeholder}
              value={draft[f.name] ?? ""}
              onChange={(e) => onChange(f.name, e.target.value)}
            />
          ) : (
            <Input
              placeholder={f.placeholder}
              value={draft[f.name] ?? ""}
              onChange={(e) => onChange(f.name, e.target.value)}
            />
          )}
          <FieldError text={errors[f.name]} />
        </div>
      ))}
    </div>
  )
}

function ListFields({
  step,
  entries,
  errors,
  entryErrors,
  onChangeEntry,
  onAdd,
  onRemove,
}: {
  step: CreateStepDef
  entries: ListEntry[]
  errors: Record<string, string>
  entryErrors: Record<string, string>
  onChangeEntry: (idx: number, name: string, value: string) => void
  onAdd: () => void
  onRemove: (idx: number) => void
}) {
  const limit = MAX_ENTRIES[step.id] ?? 6
  return (
    <div className="space-y-4">
      {errors.list && (
        <p className="flex items-center gap-1.5 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertTriangle className="size-3.5" />
          {errors.list}
        </p>
      )}
      {entries.map((entry, i) => (
        <div key={i} className="space-y-3 rounded-xl border p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {step.entry_label} {i + 1}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-xs text-muted-foreground hover:text-destructive"
              onClick={() => onRemove(i)}
            >
              <Trash2 className="size-3.5" />
              删除
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {step.fields
              .filter((f) => f.type === "input")
              .map((f) => (
                <div key={f.name} className={f.name === "highlights" ? "sm:col-span-3" : ""}>
                  <div className="mb-1 flex items-center gap-1">
                    <Label className="text-xs text-muted-foreground">{f.label}</Label>
                    {f.required && <span className="text-xs text-destructive">*</span>}
                  </div>
                  <Input
                    placeholder={f.placeholder}
                    value={entry[f.name] ?? ""}
                    onChange={(e) => onChangeEntry(i, f.name, e.target.value)}
                  />
                  <FieldError text={entryErrors[`${i}:${f.name}`]} />
                </div>
              ))}
            {step.fields
              .filter((f) => f.type === "textarea")
              .map((f) => (
                <div key={f.name} className="sm:col-span-3">
                  <div className="mb-1 flex items-center gap-1">
                    <Label className="text-xs text-muted-foreground">{f.label}</Label>
                    {f.required && <span className="text-xs text-destructive">*</span>}
                  </div>
                  <Textarea
                    className="min-h-20 text-sm"
                    placeholder={f.placeholder}
                    value={entry[f.name] ?? ""}
                    onChange={(e) => onChangeEntry(i, f.name, e.target.value)}
                  />
                  <FieldError text={entryErrors[`${i}:${f.name}`]} />
                </div>
              ))}
          </div>
        </div>
      ))}
      {entries.length < limit && (
        <Button variant="outline" size="sm" className="w-full" onClick={onAdd}>
          <Plus className="size-4" />
          再添加一条{step.entry_label}
        </Button>
      )}
    </div>
  )
}

// ---------- 聊天问答视图 ----------
interface ChatMsg {
  role: "user" | "assistant"
  content: string
}

function ChatView({ onResult }: { onResult: (r: CreateFinishResult) => void }) {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [input, setInput] = useState("")
  const [starting, setStarting] = useState(true)
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, sending, generating])

  const start = () => {
    setStarting(true)
    setError(null)
    setMessages([])
    setDone(false)
    startCreateChat()
      .then(({ session_id, reply }) => {
        setSessionId(session_id)
        setMessages([{ role: "assistant", content: reply }])
      })
      .catch((err) => setError(apiErrorMessage(err, "开启聊天失败，请重试")))
      .finally(() => setStarting(false))
  }

  useEffect(() => {
    start()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const send = async () => {
    const text = input.trim()
    if (!text || sending || generating || !sessionId) return
    setInput("")
    setMessages((m) => [...m, { role: "user", content: text }])
    setSending(true)
    setError(null)
    try {
      const out = await sendCreateChatMessage(sessionId, text)
      setMessages((m) => [...m, { role: "assistant", content: out.reply }])
      setDone(out.done)
    } catch (err) {
      const msg = apiErrorMessage(err, "消息发送失败，请重试")
      if (err && axios.isAxiosError(err) && err.response?.status === 404) {
        setError("聊天会话已过期")
      } else {
        setError(msg)
      }
      setMessages((m) => [...m, { role: "assistant", content: msg }])
    } finally {
      setSending(false)
    }
  }

  const generate = async () => {
    if (!sessionId || generating) return
    setGenerating(true)
    setError(null)
    try {
      const result = await finishCreateChat(sessionId)
      onResult(result)
    } catch (err) {
      setError(apiErrorMessage(err, "简历生成失败，请重试"))
    } finally {
      setGenerating(false)
    }
  }

  const canGenerate = !!sessionId && !starting && !sending && !generating

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="flex h-[56vh] min-h-80 flex-col gap-3 overflow-y-auto p-4">
          {starting ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin text-primary" />
              顾问正在准备…
            </div>
          ) : (
            messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                {m.role === "assistant" && (
                  <span className="mr-2 flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                    <Sparkles className="size-4 text-primary" />
                  </span>
                )}
                <div
                  className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "rounded-br-sm bg-primary text-primary-foreground"
                      : "rounded-tl-sm bg-muted text-foreground"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))
          )}
          {sending && (
            <div className="flex items-center gap-2">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <Sparkles className="size-4 text-primary" />
              </span>
              <div className="flex gap-1 rounded-2xl rounded-tl-sm bg-muted px-4 py-3">
                <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:0ms]" />
                <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:150ms]" />
                <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:300ms]" />
              </div>
            </div>
          )}
          {error && (
            <p className="flex items-center gap-1.5 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <AlertTriangle className="size-3.5 shrink-0" />
              {error}
            </p>
          )}
          <div ref={bottomRef} />
        </CardContent>
      </Card>

      {done ? (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <p className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="size-4 text-primary" />
              信息收齐了，随时可以生成你的简历
            </p>
            <Button onClick={() => void generate()} disabled={generating}>
              {generating ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              生成我的简历
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="flex items-end gap-2">
              <Textarea
                className="min-h-11 flex-1 resize-none py-2.5 text-sm"
                rows={1}
                placeholder={done ? "信息已收齐，可以直接生成简历了" : "输入你的回答，Enter 发送，Shift+Enter 换行"}
                value={input}
                disabled={sending || generating || starting}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    void send()
                  }
                }}
              />
              <Button
                size="icon"
                className="size-11 shrink-0"
                onClick={() => void send()}
                disabled={!input.trim() || sending || generating || starting}
              >
                {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              </Button>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void generate()}
                disabled={!canGenerate}
              >
                <Sparkles className="size-4" />
                信息够了，生成我的简历
              </Button>
              {error && (
                <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={start}>
                  <RefreshCw className="size-3.5" />
                  重新开始聊天
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ---------- 结果页 ----------
function ResultView({
  result,
  onRestart,
}: {
  result: CreateFinishResult
  onRestart: () => void
}) {
  const navigate = useNavigate()
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [tab, setTab] = useState<"pdf" | "md">("pdf")
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    if (!result.resume.file_path?.endsWith(".pdf")) return
    let cancelled = false
    let url: string | null = null
    setPdfLoading(true)
    fetchResumePdfBlob(result.resume.id)
      .then((u) => {
        if (cancelled) {
          URL.revokeObjectURL(u)
          return
        }
        url = u
        setPdfUrl(u)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setPdfLoading(false)
      })
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [result.resume.id, result.resume.file_path])

  const handleDownload = async () => {
    setDownloading(true)
    try {
      await downloadResumePdf(result.resume.id)
      toast.success("PDF 已开始下载")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "PDF 下载失败")
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-primary" />
            <div>
              <h2 className="font-semibold tracking-tight">简历已生成</h2>
              <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <FileText className="size-3.5" />
                  {result.resume.filename}
                </span>
                <Badge variant={result.polished ? "default" : "secondary"}>
                  {result.polished ? "AI 润色版" : "标准排版版"}
                </Badge>
              </p>
              {result.pdf_error && (
                <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-600">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                  PDF 排版失败：{result.pdf_error}
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void handleDownload()} disabled={downloading}>
              {downloading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              下载 PDF
            </Button>
            <Button variant="outline" onClick={() => navigate("/resumes")}>
              查看我的简历
            </Button>
            <Button variant="ghost" onClick={onRestart}>
              再创建一份
            </Button>
          </div>
        </CardContent>
      </Card>

      {result.highlights && result.highlights.length > 0 && (
        <Card>
          <CardContent className="p-5">
            <h3 className="mb-3 flex items-center gap-1.5 font-semibold tracking-tight">
              <Sparkles className="size-4 text-primary" />
              核心亮点
            </h3>
            <ul className="space-y-2">
              {result.highlights.map((h, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                  <span>{h}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="rounded-xl border">
        <div className="flex items-center gap-1 border-b px-3 pt-2">
          {(
            [
              ["pdf", "PDF 预览"],
              ["md", "Markdown"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              className={`rounded-t-md px-3 py-2 text-sm transition-colors ${
                tab === key
                  ? "border-b-2 border-primary font-medium text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </div>
        {tab === "pdf" ? (
          <div className="flex min-h-[70vh] items-center justify-center bg-muted/40 p-3">
            {pdfLoading ? (
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                正在加载 PDF 预览…
              </span>
            ) : pdfUrl ? (
              <iframe src={pdfUrl} title="简历 PDF 预览" className="h-[80vh] w-full rounded-lg bg-white shadow-sm" />
            ) : (
              <p className="text-sm text-muted-foreground">
                暂无 PDF 预览（{result.pdf_error ?? "该简历未生成 PDF"}），可在下方查看 Markdown 内容。
              </p>
            )}
          </div>
        ) : (
          <div className="max-h-[80vh] overflow-y-auto p-5">
            <div className="prose prose-slate prose-sm max-w-none prose-headings:mt-5 prose-headings:mb-2 prose-h1:text-xl prose-h2:text-lg prose-h2:border-b prose-h2:pb-1.5 prose-h3:text-base prose-li:my-0.5">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.markdown}</ReactMarkdown>
            </div>
          </div>
        )}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        这份简历已保存到
        <Link to="/resumes" className="mx-1 text-primary hover:underline">
          我的简历
        </Link>
        ，之后可以随时编辑或结合岗位 JD 做 AI 优化。
      </p>
    </div>
  )
}

// ---------- 页面 ----------
export default function CreateResumePage() {
  const [phase, setPhase] = useState<Phase>("loading")
  const [steps, setSteps] = useState<CreateStepDef[]>([])
  const [stepIdx, setStepIdx] = useState(0)
  const [answers, setAnswers] = useState<CreateAnswers>(emptyAnswers)
  const [formDraft, setFormDraft] = useState<Record<string, string>>({})
  const [listDraft, setListDraft] = useState<ListEntry[]>([])
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [entryErrors, setEntryErrors] = useState<Record<string, string>>({})
  const [loadError, setLoadError] = useState<string | null>(null)
  const [genError, setGenError] = useState<string | null>(null)
  const [result, setResult] = useState<CreateFinishResult | null>(null)
  // 创建方式：chat（LLM 聊天问答）/ form（表单分步）；未配置大模型时仅表单可用
  const [mode, setMode] = useState<"chat" | "form" | null>(null)
  const [llmAvailable, setLlmAvailable] = useState(false)
  // 变化即强制 ChatView 重挂载（"再创建一份"时开启新会话）
  const [chatKey, setChatKey] = useState(0)

  const step = steps[stepIdx]

  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetchCreateSteps(),
      fetchCreateMode().catch(() => ({ llm_available: false })),
    ])
      .then(([s, m]) => {
        if (cancelled) return
        setSteps(s)
        setLlmAvailable(m.llm_available)
        setMode(m.llm_available ? "chat" : "form")
        setPhase("wizard")
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(apiErrorMessage(err, "加载创建方式失败"))
          setPhase("wizard")
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  // 进入某一步时，用已保存的答案初始化草稿
  useEffect(() => {
    if (!step) return
    setFieldErrors({})
    setEntryErrors({})
    if (step.kind === "list") {
      // 首次进入（还没有任何条目）时预置一条空白，避免面对空表单不知所措
      const existing = readList(answers, step)
      setListDraft(existing.length > 0 ? existing : [blankEntry(step)])
      setFormDraft({})
    } else if (step.id === "basic") {
      setFormDraft({
        name: answers.name,
        phone: answers.phone,
        email: answers.email,
        city: answers.city,
        intent: answers.intent,
        links: answers.links,
      })
      setListDraft([])
    } else if (step.id === "skills") {
      setFormDraft({
        skills: answers.skills,
        awards: answers.awards,
        self_evaluation: answers.self_evaluation,
      })
      setListDraft([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIdx, steps.length])

  const validateStep = (): boolean => {
    if (!step) return false
    const errors: Record<string, string> = {}
    const eErrors: Record<string, string> = {}

    if (step.kind === "form") {
      for (const f of step.fields) {
        if (f.required && !(formDraft[f.name] ?? "").trim()) {
          errors[f.name] = `请填写${f.label}`
        }
      }
    } else {
      if (listDraft.length === 0 && !step.allow_skip) {
        errors.list = `请至少填写一条${step.entry_label}`
      }
      listDraft.forEach((entry, i) => {
        for (const f of step.fields) {
          if (f.required && !(entry[f.name] ?? "").trim()) {
            eErrors[`${i}:${f.name}`] = `请填写${f.label}`
          }
        }
      })
    }

    setFieldErrors(errors)
    setEntryErrors(eErrors)
    return Object.keys(errors).length === 0 && Object.keys(eErrors).length === 0
  }

  const commitStep = (): CreateAnswers => {
    if (!step) return answers
    const next = { ...answers }
    if (step.kind === "form") {
      for (const f of step.fields) (next as Record<string, unknown>)[f.name] = (formDraft[f.name] ?? "").trim()
    } else {
      const key = LIST_KEY[step.id]
      const rows = listDraft.map((entry) => {
        const row: Record<string, unknown> = {}
        for (const f of step.fields) {
          // 仅 highlights 在后端是字符串数组；其余多行字段（如 notes）按原文提交
          if (f.name === "highlights") {
            row[f.name] = String(entry[f.name] ?? "")
              .split("\n")
              .map((s) => s.trim())
              .filter(Boolean)
          } else {
            row[f.name] = (entry[f.name] ?? "").trim()
          }
        }
        return row
      })
      ;(next as unknown as Record<string, unknown>)[key] = rows
    }
    return next
  }

  const goNext = () => {
    if (!validateStep()) return
    const next = commitStep()
    setAnswers(next)
    if (stepIdx >= steps.length - 1) {
      void generate(next)
    } else {
      setStepIdx(stepIdx + 1)
    }
  }

  const goBack = () => {
    if (stepIdx > 0) setStepIdx(stepIdx - 1)
  }

  const skipStep = () => {
    if (!step?.allow_skip) return
    // 跳过不校验必填，但保留已填内容
    const next = commitStep()
    setAnswers(next)
    if (stepIdx >= steps.length - 1) {
      void generate(next)
    } else {
      setStepIdx(stepIdx + 1)
    }
  }

  const generate = async (finalAnswers: CreateAnswers) => {
    setPhase("generating")
    setGenError(null)
    try {
      const res = await finishCreate(finalAnswers)
      setResult(res)
      setPhase("done")
    } catch (err) {
      setGenError(apiErrorMessage(err, "简历生成失败，请稍后重试"))
      setAnswers(finalAnswers)
      setPhase("wizard")
    }
  }

  const handleChatResult = (r: CreateFinishResult) => {
    setResult(r)
    setPhase("done")
  }

  const restart = () => {
    setAnswers(emptyAnswers())
    setStepIdx(0)
    setResult(null)
    setGenError(null)
    setChatKey((k) => k + 1)
    setPhase("wizard")
  }

  if (phase === "loading") {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin text-primary" />
          正在准备问题…
        </span>
      </div>
    )
  }

  if (phase === "generating") {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10">
          <Sparkles className="size-7 animate-pulse text-primary" />
        </div>
        <div className="text-center">
          <h2 className="font-semibold tracking-tight">正在生成你的简历</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            AI 正在润色内容并排版 PDF，通常需要 10~30 秒…
          </p>
        </div>
        <Loader2 className="size-5 animate-spin text-primary" />
      </div>
    )
  }

  if (phase === "done" && result) {
    return <ResultView result={result} onRestart={restart} />
  }

  // wizard（含加载失败与生成失败回退）
  if (loadError || !step) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
          <p className="text-sm text-destructive">{loadError ?? "未加载到问题步骤"}</p>
          <Button
            variant="outline"
            onClick={() => {
              setPhase("loading")
              setLoadError(null)
              setSteps([])
            }}
          >
            重试
          </Button>
        </CardContent>
      </Card>
    )
  }

  const last = stepIdx >= steps.length - 1

  const modeTab = (key: "chat" | "form", label: string, icon: React.ReactNode) => (
    <button
      className={`flex items-center gap-1.5 rounded-md px-4 py-1.5 text-sm transition-colors ${
        mode === key
          ? "bg-primary font-medium text-primary-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
      onClick={() => setMode(key)}
    >
      {icon}
      {label}
    </button>
  )

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* 创建方式切换：聊天问答（需大模型）/ 表单分步 */}
      {llmAvailable ? (
        <div className="flex justify-center">
          <div className="inline-flex gap-0.5 rounded-lg border bg-background p-0.5">
            {modeTab("chat", "聊天问答", <MessageCircle className="size-4" />)}
            {modeTab("form", "表单填写", <ClipboardList className="size-4" />)}
          </div>
        </div>
      ) : (
        <p className="text-center text-xs text-muted-foreground">
          提示：配置大模型 API Key（backend/.env）后可启用聊天问答模式
        </p>
      )}

      {mode === "chat" ? (
        <ChatView key={chatKey} onResult={handleChatResult} />
      ) : (
        <>
      <div>
        <div className="mb-1.5 flex items-center justify-between text-sm">
          <span className="font-medium tracking-tight">
            第 {step.index} 步 / 共 {step.total} 步
          </span>
          <span className="text-xs text-muted-foreground">{step.title}</span>
        </div>
        <Progress value={(step.index / step.total) * 100} />
      </div>

      {/* 提问卡片 */}
      <Card>
        <CardContent className="flex gap-3 p-4">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Sparkles className="size-4.5 text-primary" />
          </span>
          <div>
            <p className="text-sm leading-relaxed">{step.prompt}</p>
            {step.tip && <p className="mt-1.5 text-xs text-muted-foreground">{step.tip}</p>}
          </div>
        </CardContent>
      </Card>

      {genError && (
        <p className="flex items-center gap-1.5 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertTriangle className="size-4 shrink-0" />
          {genError}
        </p>
      )}

      <Card>
        <CardContent className="p-4">
          {step.kind === "form" ? (
            <FormFields
              step={step}
              draft={formDraft}
              errors={fieldErrors}
              onChange={(name, value) => setFormDraft((d) => ({ ...d, [name]: value }))}
            />
          ) : (
            <ListFields
              step={step}
              entries={listDraft}
              errors={fieldErrors}
              entryErrors={entryErrors}
              onChangeEntry={(idx, name, value) =>
                setListDraft((list) => list.map((e, i) => (i === idx ? { ...e, [name]: value } : e)))
              }
              onAdd={() => setListDraft((list) => [...list, blankEntry(step)])}
              onRemove={(idx) => setListDraft((list) => list.filter((_, i) => i !== idx))}
            />
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={goBack} disabled={stepIdx === 0}>
          <ArrowLeft className="size-4" />
          上一步
        </Button>
        <div className="flex gap-2">
          {step.allow_skip && (
            <Button variant="outline" onClick={skipStep}>
              跳过此步
            </Button>
          )}
          <Button onClick={goNext}>
            {last ? (
              <>
                <Sparkles className="size-4" />
                生成我的简历
              </>
            ) : (
              <>
                下一步
                <ArrowRight className="size-4" />
              </>
            )}
          </Button>
        </div>
      </div>
        </>
      )}
    </div>
  )
}
