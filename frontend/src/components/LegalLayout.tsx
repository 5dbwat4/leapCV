import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import { ArrowLeft, FileText } from "lucide-react"

/** 法律文档（服务条款/隐私政策）共享布局：无需登录即可访问 */
export default function LegalLayout({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <FileText className="size-4" />
            </span>
            <span className="text-lg tracking-tight">
              简<span className="text-primary">跃</span>
            </span>
            <span className="hidden text-xs font-medium text-muted-foreground sm:inline">LeapCV</span>
          </Link>
          <Link
            to="/"
            className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            返回首页
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          生效日期：2026 年 9 月 9 日 &nbsp;·&nbsp; 版本：V1.0
        </p>
        <div className="mt-8 space-y-8">{children}</div>

        <div className="mt-12 flex flex-wrap gap-x-6 gap-y-2 border-t border-border/60 pt-6 text-sm">
          <Link to="/terms" className="text-muted-foreground hover:text-primary">
            服务条款
          </Link>
          <Link to="/privacy" className="text-muted-foreground hover:text-primary">
            隐私政策
          </Link>
        </div>
      </main>

      <footer className="border-t border-border/60 py-4 text-center text-xs text-muted-foreground">
        简跃 LeapCV · AI 驱动的一站式简历优化工具
      </footer>
    </div>
  )
}

/** 文档章节 */
export function Section({ index, title, children }: { index: number; title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-base font-semibold">
        {index}. {title}
      </h2>
      <div className="space-y-2.5 text-sm leading-7 text-foreground/90">{children}</div>
    </section>
  )
}

/** 条款正文段落，支持 sub 编号 */
export function Clause({ sub, children }: { sub?: string; children: ReactNode }) {
  return (
    <p className="text-justify">
      {sub && <span className="mr-1 font-medium">{sub}</span>}
      {children}
    </p>
  )
}
