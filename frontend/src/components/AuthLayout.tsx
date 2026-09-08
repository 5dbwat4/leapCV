import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import { FileText } from "lucide-react"

/** 登录/注册页共享的居中布局 */
export default function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle: string
  children: ReactNode
  footer: ReactNode
}) {
  return (
    <div className="relative flex min-h-svh items-center justify-center overflow-hidden bg-gradient-to-br from-indigo-50 via-background to-sky-50 px-4">
      <div className="pointer-events-none absolute -left-24 -top-24 size-72 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 size-72 rounded-full bg-sky-400/10 blur-3xl" />

      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2">
          <Link to="/" className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/25">
              <FileText className="size-5" />
            </span>
            简<span className="-ml-1 text-primary">跃</span>
            <span className="ml-1 self-end text-[11px] font-medium tracking-normal text-muted-foreground">LeapCV</span>
          </Link>
          <p className="text-xs text-muted-foreground">让简历，跃然而出 · AI 驱动的一站式简历优化工具</p>
        </div>

        <div className="rounded-2xl border bg-card p-6 shadow-xl shadow-indigo-950/5">
          <h1 className="text-lg font-semibold">{title}</h1>
          <p className="mb-5 mt-1 text-sm text-muted-foreground">{subtitle}</p>
          {children}
        </div>

        <div className="mt-4 text-center text-sm text-muted-foreground">{footer}</div>
      </div>
    </div>
  )
}
