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
  /** Quick check 中用户确认补充的信息（如「日均 50 万单」），已融入 after */
  answer?: string
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
  /** 目标岗位名：请求未提供时由 JD 抽取所得，用于历史记录与结果页展示 */
  position_name?: string
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

// ---------- 创建简历（问答式） ----------

export interface CreateFieldDef {
  name: string
  label: string
  type: "input" | "textarea"
  required: boolean
  placeholder: string
}

export interface CreateStepDef {
  id: string
  index: number
  total: number
  title: string
  prompt: string
  tip: string
  allow_skip: boolean
  kind: "form" | "list"
  entry_label: string
  fields: CreateFieldDef[]
}

export interface CreateEduItem {
  school: string
  major: string
  degree: string
  period: string
  notes: string
}

export interface CreateWorkItem {
  company: string
  position: string
  period: string
  highlights: string[]
}

export interface CreateProjectItem {
  name: string
  role: string
  period: string
  highlights: string[]
}

export interface CreateAnswers {
  name: string
  phone: string
  email: string
  city: string
  intent: string
  links: string
  education: CreateEduItem[]
  work: CreateWorkItem[]
  internships: CreateWorkItem[]
  projects: CreateProjectItem[]
  skills: string
  awards: string
  self_evaluation: string
}

export interface CreateFinishResult {
  resume: ResumeOut
  markdown: string
  polished: boolean
  pdf_url: string | null
  pdf_error: string | null
  highlights?: string[]
}

// ---------- 创建简历 · 聊天模式 ----------
export interface CreateModeOut {
  llm_available: boolean
}

export interface ChatStartOut {
  session_id: string
  reply: string
}

export interface ChatMessageOut {
  reply: string
  done: boolean
  turns: number
}

// ---------- 分析剧场 SSE 细粒度事件（按时间顺序单向推送） ----------

/** SSE `resume_struct` 事件：完整结构化简历 JSON（结构同 ResumeStruct） */
export type ResumeStructEvent = ResumeStruct

/** JD 硬技能条目（含权重、是否必需与别名） */
export interface JdHardSkill {
  name: string
  weight: number
  required: boolean
  aliases?: string[]
}

/** SSE `jd_struct` 事件：目标岗位 JD 结构化信息 */
export interface JdStructEvent {
  position_name: string
  hard_skills: JdHardSkill[]
  soft_skills: string[]
  [key: string]: unknown
}

/** SSE `score` 事件：匹配度总分、维度分与总体建议 */
export interface ScoreEvent {
  total: number
  dimensions: MatchDimension[]
  advice?: string
  advice_reason?: string
}

/** SSE `skill` 事件：单条技能命中情况（逐条推送，约 6~15 条） */
export interface SkillCheckEvent {
  name: string
  hit: boolean
  detail?: string
}

/** SSE `issue` 事件：单条简历问题（逐条推送，≤12 条，结构同 ResumeIssue） */
export type IssueEvent = ResumeIssue

/** SSE `rewrite` 事件：单条改写对照（逐条推送，≤8 条，结构同 RewritePair） */
export type RewriteEvent = RewritePair

/** SSE `question` 事件：阶段五 Quick check 快问快答，管线暂停等待作答 */
export interface QuickCheckEvent {
  run_id: string
  id: string
  question: string
  options: string[]
  tip?: string
  section?: string
  before?: string
  /** 等待作答的时限（秒），倒计时归零自动按跳过处理 */
  expires_in?: number
}

/** SSE 细粒度事件回调：event 为事件名（如 "score"），data 为已解析的 JSON */
export type StreamEventHandler = (event: string, data: unknown) => void
