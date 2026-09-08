// 与后端 result JSON schema 对齐的类型定义

export interface UserInfo {
  id: number
  username: string
}

export interface AuthResponse {
  access_token: string
  token_type: string
  user: UserInfo
}

export interface ResumeOut {
  id: number
  filename: string
  raw_text: string
  file_path: string | null
  thumb_path: string | null
  file_size: number | null
  structured?: ResumeStruct | null
  created_at: string
}

export interface EducationItem {
  school: string
  major: string
  degree: string
  period: string
}

export interface WorkItem {
  company: string
  position: string
  period: string
  highlights: string[]
}

export interface ProjectItem {
  name: string
  role: string
  period: string
  highlights: string[]
}

export interface ResumeStruct {
  name: string
  phone: string
  email: string
  current_position: string
  years_of_experience: number | null
  education: EducationItem[]
  work: WorkItem[]
  internships: WorkItem[]
  projects: ProjectItem[]
  skills: string[]
  languages: string[]
  awards: string[]
  self_evaluation: string
  sections_found: string[]
  sections_missing: string[]
}

export interface MatchDimension {
  name: string
  score: number
  detail: string
}

export interface MatchedSkill {
  name: string
  evidence: string
}

export interface MissingSkill {
  name: string
  importance: string
  advice: string
}

export interface MatchResult {
  total: number
  dimensions: MatchDimension[]
  matched_skills: MatchedSkill[]
  missing_skills: MissingSkill[]
  strengths: string[]
  gaps_summary: string
  advice: string
  advice_reason: string
}

export interface ResumeOverview {
  name: string
  current_position: string
  years_of_experience: number | null
  sections_found: string[]
  sections_missing: string[]
}

export type IssueSeverity = "高" | "中" | "低"

export interface ResumeIssue {
  type: string
  severity: IssueSeverity | string
  location: string
  original: string
  problem: string
  suggestion: string
}

export interface RewritePair {
  section: string
  before: string
  after: string
  reason: string
}

export interface ReportCheck {
  passed: boolean
  text: string
  tip?: string
}

export interface ReportCategory {
  key: string
  name: string
  score: number
  issues: number
  intro: string
  checks: ReportCheck[]
}

export interface MatchReport {
  categories: ReportCategory[]
  total_passed: number
  total_failed: number
}

export interface AnalysisResult {
  mock: boolean
  summary: string
  highlights: string[]
  match: MatchResult
  resume_overview: ResumeOverview
  issues: ResumeIssue[]
  report?: MatchReport | null
  optimized_resume_md: string
  rewrite_pairs: RewritePair[]
}

export interface HistoryItem {
  id: number
  target_position: string
  match_score: number
  is_mock: boolean
  jd_excerpt: string
  created_at: string
}

export interface HistoryDetail extends HistoryItem {
  resume_id: number
  jd_text: string
  result: AnalysisResult
}

export interface ProgressEvent {
  stage: string
  message: string
  progress: number
}

export interface OptimizeStreamResult {
  id: number
  result: AnalysisResult
}
