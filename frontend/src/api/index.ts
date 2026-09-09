import axios from "axios"

import api, { apiErrorMessage, getToken, setToken } from "./client"
import { parseContentDisposition } from "./download"
import type {
  AuthResponse,
  CreateAnswers,
  CreateFinishResult,
  CreateStepDef,
  HistoryDetail,
  HistoryItem,
  OptimizeStreamResult,
  ProgressEvent,
  ResumeOut,
  ResumeStruct,
  StreamEventHandler,
} from "./types"

/** 将后端返回的结构化 JSON 规范化为完整形状（容忍 LLM 输出缺字段） */
export function normalizeResumeStruct(raw: unknown): ResumeStruct {
  const d = (raw ?? {}) as Record<string, unknown>
  const arr = (v: unknown) => (Array.isArray(v) ? v : [])
  const str = (v: unknown) => (typeof v === "string" ? v : "")
  const items = (v: unknown, keys: string[]) =>
    arr(v)
      .map((it) => {
        const o = (it ?? {}) as Record<string, unknown>
        const out: Record<string, unknown> = {}
        for (const k of keys) out[k] = o[k]
        return out
      })
      // 过滤掉整条全空的项
      .filter((o) => Object.values(o).some((v) => (typeof v === "string" ? v.trim() : v != null)))

  return {
    name: str(d.name),
    phone: str(d.phone),
    email: str(d.email),
    current_position: str(d.current_position),
    years_of_experience:
      typeof d.years_of_experience === "number" ? d.years_of_experience : null,
    education: items(d.education, ["school", "major", "degree", "period"]) as unknown as ResumeStruct["education"],
    work: items(d.work, ["company", "position", "period", "highlights"]).map((it) => ({
      ...(it as unknown as ResumeStruct["work"][number]),
      highlights: arr((it as Record<string, unknown>).highlights).map(String),
    })) as unknown as ResumeStruct["work"],
    internships: items(d.internships, ["company", "position", "period", "highlights"]).map((it) => ({
      ...(it as unknown as ResumeStruct["internships"][number]),
      highlights: arr((it as Record<string, unknown>).highlights).map(String),
    })) as unknown as ResumeStruct["internships"],
    projects: items(d.projects, ["name", "role", "period", "highlights"]).map((it) => ({
      ...(it as unknown as ResumeStruct["projects"][number]),
      highlights: arr((it as Record<string, unknown>).highlights).map(String),
    })) as unknown as ResumeStruct["projects"],
    skills: arr(d.skills).map(String),
    languages: arr(d.languages).map(String),
    awards: arr(d.awards).map(String),
    self_evaluation: str(d.self_evaluation),
    sections_found: arr(d.sections_found).map(String),
    sections_missing: arr(d.sections_missing).map(String),
  }
}

// ---------- 认证 ----------
export async function register(username: string, password: string): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>("/auth/register", { username, password })
  setToken(data.access_token)
  return data
}

export async function login(username: string, password: string): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>("/auth/login", { username, password })
  setToken(data.access_token)
  return data
}

export async function fetchMe() {
  const { data } = await api.get("/auth/me")
  return data as AuthResponse["user"]
}

// ---------- 简历 ----------
export async function uploadResume(file: File): Promise<ResumeOut> {
  const form = new FormData()
  form.append("file", file)
  const { data } = await api.post<ResumeOut>("/resumes/upload", form)
  return data
}

export async function createResumeText(rawText: string, filename?: string): Promise<ResumeOut> {
  const { data } = await api.post<ResumeOut>("/resumes/text", {
    raw_text: rawText,
    filename: filename ?? "粘贴的简历",
  })
  return data
}

export async function fetchResume(id: string | number): Promise<ResumeOut> {
  const { data } = await api.get<ResumeOut>(`/resumes/${id}`)
  if (data.structured) data.structured = normalizeResumeStruct(data.structured)
  return data
}

/** 获取简历首页缩略图（返回 Blob URL，调用方负责 URL.revokeObjectURL） */
export async function fetchResumeThumb(id: string | number): Promise<string> {
  const { data } = await api.get<Blob>(`/resumes/${id}/thumb`, { responseType: "blob" })
  return URL.createObjectURL(data)
}

export async function fetchResumes(): Promise<ResumeOut[]> {
  const { data } = await api.get<ResumeOut[]>("/resumes")
  return data.map((r) =>
    r.structured ? { ...r, structured: normalizeResumeStruct(r.structured) } : r,
  )
}

export async function parseResume(id: number, force = false): Promise<ResumeOut> {
  const { data } = await api.post<ResumeOut>(`/resumes/${id}/parse?force=${force}`)
  if (data.structured) data.structured = normalizeResumeStruct(data.structured)
  return data
}

export async function updateResumeStructured(id: number, structured: ResumeStruct): Promise<ResumeOut> {
  const { data } = await api.put<ResumeOut>(`/resumes/${id}/structured`, { structured })
  if (data.structured) data.structured = normalizeResumeStruct(data.structured)
  return data
}

// ---------- 创建简历（问答式） ----------
export async function fetchCreateSteps(): Promise<CreateStepDef[]> {
  const { data } = await api.get<CreateStepDef[]>("/create/steps")
  return data
}

export async function finishCreate(answers: CreateAnswers): Promise<CreateFinishResult> {
  const { data } = await api.post<CreateFinishResult>("/create/finish", answers)
  return data
}

/** 获取简历 PDF 的 Blob URL（用于页内预览；调用方负责 URL.revokeObjectURL） */
export async function fetchResumePdfBlob(id: number): Promise<string> {
  const { data } = await api.get<Blob>(`/resumes/${id}/pdf`, { responseType: "blob" })
  return URL.createObjectURL(data)
}

/** 下载简历 PDF（已生成的直接返回，否则服务端现场渲染） */
export async function downloadResumePdf(id: number): Promise<void> {
  let blob: Blob
  let disposition: string | undefined
  try {
    const resp = await api.get<Blob>(`/resumes/${id}/pdf`, { responseType: "blob" })
    blob = resp.data
    const header = resp.headers?.["content-disposition"]
    if (typeof header === "string") disposition = header
  } catch (err) {
    throw new Error(await extractBlobErrorDetail(err, "PDF 下载失败，请稍后重试"))
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = parseContentDisposition(disposition, `简历-${id}.pdf`)
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** 从 axios 错误（响应体可能是 JSON Blob）中提取后端 detail 文案 */
async function extractBlobErrorDetail(err: unknown, fallback: string): Promise<string> {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data
    if (data instanceof Blob) {
      try {
        const parsed = JSON.parse(await data.text()) as { detail?: unknown }
        if (typeof parsed?.detail === "string" && parsed.detail) return parsed.detail
      } catch {
        /* 响应体不是 JSON，走兜底 */
      }
    } else if (typeof data === "object" && data !== null && typeof (data as { detail?: unknown }).detail === "string") {
      return (data as { detail: string }).detail
    }
  }
  return apiErrorMessage(err, fallback)
}

// ---------- 优化（SSE 流式） ----------
/** Quick check 作答：answer 为 null 表示跳过（后端改用占位符继续改写） */
export async function answerQuickCheck(payload: {
  run_id: string
  question_id: string
  answer: string | null
}): Promise<void> {
  await api.post("/optimize/answer", payload)
}

export async function streamOptimize(
  payload: { resume_id: number; jd_text: string; target_position?: string },
  onProgress: (event: ProgressEvent) => void,
  signal?: AbortSignal,
  /** 可选第 4 参：每个解析出的 SSE 事件都会回调（含 progress/result/error），供分析剧场等 UI 消费细粒度事件 */
  onEvent?: StreamEventHandler,
): Promise<OptimizeStreamResult> {
  const resp = await fetch("/api/optimize", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
    },
    body: JSON.stringify(payload),
    signal,
  })

  if (!resp.ok || !resp.body) {
    let detail = `请求失败（HTTP ${resp.status}）`
    try {
      const j = await resp.json()
      if (typeof j?.detail === "string") detail = j.detail
    } catch {
      /* 忽略非 JSON 响应体 */
    }
    throw new Error(detail)
  }

  const reader = resp.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  const parseBlock = (block: string): { event: string; data: unknown } | null => {
    let event = ""
    let raw = ""
    for (const line of block.split("\n")) {
      if (line.startsWith("event: ")) event = line.slice(7)
      else if (line.startsWith("data: ")) raw += line.slice(6)
    }
    if (!event) return null
    try {
      return { event, data: JSON.parse(raw) }
    } catch {
      return { event, data: null }
    }
  }

  return new Promise<OptimizeStreamResult>((resolve, reject) => {
    const handleBlock = (block: string) => {
      const parsed = parseBlock(block)
      if (!parsed) return
      // 所有解析出的事件（含 progress/result/error）统一回调 onEvent；既有 resolve/reject 逻辑不变
      onEvent?.(parsed.event, parsed.data)
      if (parsed.event === "progress") {
        onProgress(parsed.data as ProgressEvent)
      } else if (parsed.event === "result") {
        resolve(parsed.data as OptimizeStreamResult)
      } else if (parsed.event === "error") {
        const msg = (parsed.data as { message?: string })?.message ?? "分析失败，请稍后重试"
        reject(new Error(msg))
      }
    }

    const pump = async () => {
      try {
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          let idx: number
          while ((idx = buffer.indexOf("\n\n")) !== -1) {
            const block = buffer.slice(0, idx)
            buffer = buffer.slice(idx + 2)
            handleBlock(block)
          }
        }
        reject(new Error("连接中断，分析未完成"))
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") reject(err)
        else reject(new Error(apiErrorMessage(err, "网络异常，分析中断")))
      }
    }
    void pump()
  })
}

// ---------- 历史 ----------
export async function fetchHistory(): Promise<HistoryItem[]> {
  const { data } = await api.get<HistoryItem[]>("/history")
  return data
}

export async function fetchHistoryDetail(id: string | number): Promise<HistoryDetail> {
  const { data } = await api.get<HistoryDetail>(`/history/${id}`)
  return data
}

export async function deleteHistory(id: number): Promise<void> {
  await api.delete(`/history/${id}`)
}
