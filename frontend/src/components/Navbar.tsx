import { Link, NavLink, useNavigate } from "react-router-dom"
import { FilePlus2, FileText, Files, History, LogOut, Sparkles } from "lucide-react"

import { useAuth } from "@/auth"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
    isActive
      ? "bg-primary/10 font-medium text-primary"
      : "text-muted-foreground hover:bg-muted hover:text-foreground"
  }`

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate("/login")
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
        <Link to="/" className="flex items-center gap-2 font-semibold">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <FileText className="size-4" />
          </span>
          <span className="text-lg tracking-tight">
            简<span className="text-primary">跃</span>
          </span>
          <span className="hidden text-xs font-medium text-muted-foreground sm:inline">LeapCV</span>
          <span className="hidden items-center gap-0.5 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 sm:flex">
            <Sparkles className="size-3" />
            AI 简历优化
          </span>
        </Link>

        <nav className="ml-2 flex items-center gap-1">
          <NavLink to="/" end className={linkClass}>
            工作台
          </NavLink>
          <NavLink to="/create" className={linkClass}>
            <FilePlus2 className="size-4" />
            创建简历
          </NavLink>
          <NavLink to="/resumes" className={linkClass}>
            <Files className="size-4" />
            我的简历
          </NavLink>
          <NavLink to="/history" className={linkClass}>
            <History className="size-4" />
            历史记录
          </NavLink>
        </nav>

        <div className="ml-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2 px-2">
                <Avatar className="size-7">
                  <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
                    {user?.username?.slice(0, 2).toUpperCase() ?? "U"}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden max-w-24 truncate text-sm sm:inline">{user?.username}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuLabel>账号：{user?.username}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="size-4" />
                退出登录
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
