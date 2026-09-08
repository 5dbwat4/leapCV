import { CheckCircle2, CircleDashed, Loader2, XCircle } from "lucide-react"

import type { ProgressEvent } from "@/api/types"
import { Progress } from "@/components/ui/progress"

export const STAGES = [
  { key: "parse_resume", label: "解析简历" },
  { key: "parse_jd", label: "解析岗位 JD" },
  { key: "match", label: "计算匹配度" },
  { key: "diagnose", label: "风险诊断" },
  { key: "rewrite", label: "内容重构" },
] as const

export type StageStatus = "pending" | "running" | "done" | "error"

interface StageProgressProps {
  stages: readonly { key: string; label: string }[]
  statusMap: Record<string, StageStatus>
  lastEvent: ProgressEvent | null
  error?: string | null
}

/** 分析管线各阶段进度面板 */
export default function StageProgress({ stages, statusMap, lastEvent, error }: StageProgressProps) {
  const doneCount = stages.filter((s) => statusMap[s.key] === "done").length

  return (
    <div className="space-y-1">
      <div className="mb-3 space-y-1.5">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">
            {error ? "分析失败" : doneCount === stages.length ? "分析完成" : "正在分析…"}
          </span>
          <span className="text-muted-foreground tabular-nums">
            {Math.round(((lastEvent?.progress ?? 0) / 100) * 100)}%
          </span>
        </div>
        <Progress value={error ? 100 : (lastEvent?.progress ?? 0)} className="h-2" />
        <p className={`text-xs ${error ? "text-destructive" : "text-muted-foreground"}`}>
          {error ?? lastEvent?.message ?? "正在连接…"}
        </p>
      </div>

      <ol className="space-y-1">
        {stages.map((stage) => {
          const status = statusMap[stage.key] ?? "pending"
          return (
            <li
              key={stage.key}
              className={`flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm ${
                status === "running" ? "bg-primary/5" : ""
              }`}
            >
              {status === "done" && <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />}
              {status === "running" && (
                <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
              )}
              {status === "pending" && <CircleDashed className="size-4 shrink-0 text-muted-foreground/50" />}
              {status === "error" && <XCircle className="size-4 shrink-0 text-destructive" />}
              <span
                className={
                  status === "done"
                    ? "text-foreground"
                    : status === "running"
                      ? "font-medium text-primary"
                      : "text-muted-foreground/70"
                }
              >
                {stage.label}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
