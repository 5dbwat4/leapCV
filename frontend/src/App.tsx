import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom"
import { Loader2 } from "lucide-react"

import Navbar from "@/components/Navbar"
import { useAuth } from "@/auth"
import HistoryPage from "@/pages/History"
import LoginPage from "@/pages/Login"
import MatchReportPage from "@/pages/MatchReport"
import MyResumesPage from "@/pages/MyResumes"
import PrivacyPage from "@/pages/Privacy"
import RegisterPage from "@/pages/Register"
import ResultPage from "@/pages/Result"
import TermsPage from "@/pages/Terms"
import WorkbenchPage from "@/pages/Workbench"

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    )
  }
  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }
  return (
    <div className="flex min-h-svh flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
      <footer className="border-t border-border/60 py-4 text-center text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          <span>简跃 LeapCV · AI 驱动的一站式简历优化工具</span>
          <span aria-hidden>·</span>
          <Link to="/terms" className="transition-colors hover:text-primary">
            服务条款
          </Link>
          <span aria-hidden>·</span>
          <Link to="/privacy" className="transition-colors hover:text-primary">
            隐私政策
          </Link>
        </div>
      </footer>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <WorkbenchPage />
          </RequireAuth>
        }
      />
      <Route
        path="/resumes"
        element={
          <RequireAuth>
            <MyResumesPage />
          </RequireAuth>
        }
      />
      <Route
        path="/result/:id"
        element={
          <RequireAuth>
            <ResultPage />
          </RequireAuth>
        }
      />
      <Route
        path="/result/:id/report"
        element={
          <RequireAuth>
            <MatchReportPage />
          </RequireAuth>
        }
      />
      <Route
        path="/history"
        element={
          <RequireAuth>
            <HistoryPage />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
