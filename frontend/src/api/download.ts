// 分析结果导出：Word / LaTeX / PDF 下载与 Markdown 本地保存
import axios from "axios"

import api from "./client"

export type ExportFormat = "docx" | "tex" | "pdf"

/** 创建 <a download> 触发浏览器保存 Blob 文件 */
function triggerBrowserDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/**
 * 从 Content-Disposition 响应头解析文件名。
 * 兼容 RFC 5987 的 filename*=UTF-8''… 与普通 filename="…"/filename=… 两种形式。
 */
export function parseContentDisposition(header: string | undefined, fallback: string): string {
  if (!header) return fallback

  // 优先匹配 filename*=UTF-8''xxx（后端对中文文件名会走这种编码形式）
  const starMatch = header.match(/filename\*\s*=\s*(?:UTF-8|utf-8)''([^;]+)/)
  if (starMatch) {
    try {
      return decodeURIComponent(starMatch[1].trim().replace(/^"|"$/g, ""))
    } catch {
      /* 解码失败则继续尝试其他形式 */
    }
  }

  const quotedMatch = header.match(/filename\s*=\s*"([^"]+)"/)
  if (quotedMatch) {
    try {
      return decodeURIComponent(quotedMatch[1])
    } catch {
      return quotedMatch[1]
    }
  }

  const plainMatch = header.match(/filename\s*=\s*([^;]+)/)
  if (plainMatch) {
    const raw = plainMatch[1].trim()
    try {
      return decodeURIComponent(raw)
    } catch {
      return raw
    }
  }

  return fallback
}

/** 从 axios 错误（响应体可能是 JSON Blob）中提取后端 detail 文案 */
async function extractErrorDetail(err: unknown, fallback: string): Promise<string> {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data
    // responseType: "blob" 时后端返回的 JSON 错误也在 Blob 里，尝试解析出 detail
    if (data instanceof Blob) {
      try {
        const parsed = JSON.parse(await data.text()) as { detail?: unknown }
        if (typeof parsed?.detail === "string" && parsed.detail) return parsed.detail
      } catch {
        /* 响应体不是 JSON，走下面的兜底 */
      }
    } else if (data && typeof data === "object" && typeof (data as { detail?: unknown }).detail === "string") {
      const detail = (data as { detail: string }).detail
      if (detail) return detail
    }
    if (err.response?.status) return `导出失败（HTTP ${err.response.status}）`
    if (err.message) return err.message
  }
  return fallback
}

/**
 * 下载一次分析记录的导出文件。
 * - docx → Word 文档
 * - tex  → LaTeX 源码
 * - pdf  → PDF（服务器未安装 TeX 时返回 503，detail 为中文原因，由调用方处理回退）
 * 失败时 reject 一个 message 为后端 detail 的 Error。
 */
export async function downloadExport(id: number, fmt: ExportFormat): Promise<void> {
  let disposition: string | undefined
  let blob: Blob
  try {
    const resp = await api.get<Blob>(`/optimize/${id}/export/${fmt}`, { responseType: "blob" })
    blob = resp.data
    const header = resp.headers?.["content-disposition"]
    if (typeof header === "string") disposition = header
  } catch (err) {
    throw new Error(await extractErrorDetail(err, `导出失败，请稍后重试`))
  }
  triggerBrowserDownload(blob, parseContentDisposition(disposition, `简历优化-${id}.${fmt}`))
}

/** 将 Markdown 文本保存为本地 .md 文件 */
export function downloadMarkdown(md: string, filename: string) {
  triggerBrowserDownload(new Blob([md], { type: "text/markdown;charset=utf-8" }), filename)
}
