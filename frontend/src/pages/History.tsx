import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { ArrowRight, FileSearch, History, Sparkles, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { deleteHistory, fetchHistory } from "@/api"
import type { HistoryItem } from "@/api/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

function scoreBadge(score: number): string {
  if (score >= 75) return "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
  if (score >= 50) return "bg-indigo-100 text-indigo-700 hover:bg-indigo-100"
  if (score >= 30) return "bg-amber-100 text-amber-700 hover:bg-amber-100"
  return "bg-red-100 text-red-700 hover:bg-red-100"
}

export default function HistoryPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState<HistoryItem[] | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<HistoryItem | null>(null)

  useEffect(() => {
    fetchHistory()
      .then(setItems)
      .catch(() => {
        toast.error("加载历史记录失败")
        setItems([])
      })
  }, [])

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteHistory(deleteTarget.id)
      setItems((prev) => prev?.filter((i) => i.id !== deleteTarget.id) ?? [])
      toast.success("已删除该记录")
    } catch {
      toast.error("删除失败，请稍后重试")
    } finally {
      setDeleteTarget(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <History className="size-5 text-primary" />
            历史分析记录
          </h1>
          <p className="text-xs text-muted-foreground">点击任意记录查看完整分析报告</p>
        </div>
        <Button asChild>
          <Link to="/">发起新分析</Link>
        </Button>
      </div>

      {items === null ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <FileSearch className="size-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">还没有分析记录，去工作台发起第一次分析吧</p>
            <Button asChild variant="outline">
              <Link to="/">
                <Sparkles className="size-4" />
                开始优化简历
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Card
              key={item.id}
              className="cursor-pointer transition-colors hover:border-primary/40"
              onClick={() => navigate(`/result/${item.id}`)}
            >
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex size-14 shrink-0 flex-col items-center justify-center rounded-xl bg-primary/5">
                  <span className="text-xl font-bold tabular-nums text-primary">{item.match_score}</span>
                  <span className="text-[10px] text-muted-foreground">匹配分</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate font-medium">
                      {item.target_position || "未命名岗位"}
                    </h3>
                    {item.is_mock && (
                      <Badge variant="outline" className="border-amber-300 text-amber-600">
                        演示数据
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                    JD：{item.jd_excerpt}…
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {new Date(item.created_at).toLocaleString("zh-CN")}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Badge className={scoreBadge(item.match_score)}>
                    {item.match_score >= 75
                      ? "匹配良好"
                      : item.match_score >= 50
                        ? "中等匹配"
                        : item.match_score >= 30
                          ? "匹配偏低"
                          : "匹配较差"}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation()
                      setDeleteTarget(item)
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                  <ArrowRight className="size-4 text-muted-foreground/50" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除这条分析记录？</AlertDialogTitle>
            <AlertDialogDescription>
              「{deleteTarget?.target_position || "未命名岗位"}」的分析报告将被永久删除，无法恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={handleDelete}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
