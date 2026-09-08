import { useEffect, useRef, useState } from "react"
import {
  FileText,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
} from "lucide-react"
import { toast } from "sonner"

import { fetchResumes, parseResume, updateResumeStructured, uploadResume } from "@/api"
import { apiErrorMessage } from "@/api/client"
import type { ResumeOut, ResumeStruct } from "@/api/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"

type SectionKey = "basic" | "education" | "work" | "internships" | "projects" | "skills" | "languages" | "awards" | "self_evaluation"

const ALLOWED_EXT = [".pdf", ".docx", ".txt", ".md"]
const SECTION_TITLES: Record<SectionKey, string> = {
  basic: "个人信息",
  education: "教育背景",
  work: "工作经历",
  internships: "实习经历",
  projects: "项目经历",
  skills: "专业技能",
  languages: "语言能力",
  awards: "获奖情况",
  self_evaluation: "自我评价",
}

function emptyStruct(): ResumeStruct {
  return {
    name: "",
    phone: "",
    email: "",
    current_position: "",
    years_of_experience: null,
    education: [],
    work: [],
    internships: [],
    projects: [],
    skills: [],
    languages: [],
    awards: [],
    self_evaluation: "",
    sections_found: [],
    sections_missing: [],
  }
}

// 各分区空状态的定制引导文案
const SECTION_EMPTY_HINTS: Record<SectionKey, string> = {
  basic: "补全姓名与联系方式，让 HR 能第一时间联系到你。",
  education: "补充学校、专业与学历信息，应届生的教育背景是筛选硬指标。",
  work: "没有正式工作经历？可以先把实习和项目经历补充完整。",
  internships: "有实习经历务必写上，这是应届生最有说服力的实战证明。",
  projects: "补充 1-2 个与目标岗位最相关的项目，用数据说明你的贡献。",
  skills: "对照目标岗位 JD 列出掌握的技能，便于简历被关键词检索命中。",
  languages: "有 CET、雅思托福或小语种证书的话务必写上。",
  awards: "有证书或奖项就补充上——这是应届生简历的加分项。",
  self_evaluation: "用 2-3 句话概括你的核心竞争力，避免空泛套话。",
}

// ---------- 缩略图 ----------
function ResumeThumb({ resume }: { resume: ResumeOut }) {
  const name = resume.structured?.name
  return (
    <div className="flex h-full flex-col gap-2 bg-white p-3">
      <div className="flex items-center gap-1.5">
        <span className="flex size-4 items-center justify-center rounded bg-primary/15">
          <FileText className="size-2.5 text-primary" />
        </span>
        <span className="truncate text-[11px] font-semibold text-foreground">
          {name || resume.filename.replace(/\.\w+$/, "")}
        </span>
      </div>
      <div className="space-y-1.5">
        <div className="h-1 w-3/4 rounded bg-muted-foreground/25" />
        <div className="h-1 w-full rounded bg-muted" />
        <div className="h-1 w-5/6 rounded bg-muted" />
      </div>
      <div className="mt-1 space-y-1.5">
        <div className="h-1 w-1/3 rounded bg-primary/25" />
        <div className="h-1 w-full rounded bg-muted" />
        <div className="h-1 w-4/5 rounded bg-muted" />
        <div className="h-1 w-full rounded bg-muted" />
      </div>
      <div className="mt-auto space-y-1.5">
        <div className="h-1 w-1/4 rounded bg-primary/25" />
        <div className="h-1 w-2/3 rounded bg-muted" />
      </div>
    </div>
  )
}

// ---------- 详情分区 ----------
function SectionCard({
  title,
  onEdit,
  children,
}: {
  title: string
  onEdit: () => void
  children: React.ReactNode
}) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-1">
        <h3 className="font-semibold tracking-tight">{title}</h3>
        <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-primary" onClick={onEdit}>
          <Pencil className="size-3.5" />
        </Button>
      </div>
      <Card>
        <CardContent className="p-4">{children}</CardContent>
      </Card>
    </section>
  )
}

/** 分区空状态：定制引导文案 + “点击编辑”文本按钮 */
function SectionEmpty({ hint, onEdit }: { hint: string; onEdit: () => void }) {
  return (
    <p className="text-sm text-muted-foreground/70">
      {hint}{" "}
      <Button
        variant="link"
        size="sm"
        className="h-auto p-0 text-sm underline-offset-4"
        onClick={onEdit}
      >
        点击编辑
      </Button>
    </p>
  )
}

function BasicView({ s }: { s: ResumeStruct }) {
  const rows = [
    ["姓名", s.name],
    ["电话", s.phone],
    ["邮箱", s.email],
    ["求职意向", s.current_position],
    ["工作年限", s.years_of_experience != null ? `${s.years_of_experience} 年` : ""],
  ]
  return (
    <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
      {rows.map(([k, v]) => (
        <div key={k} className="flex gap-2 text-sm">
          <dt className="w-16 shrink-0 text-muted-foreground">{k}</dt>
          <dd className={v ? "" : "text-muted-foreground/60"}>{v || "未填写"}</dd>
        </div>
      ))}
    </dl>
  )
}

function EducationView({ s, onEdit }: { s: ResumeStruct; onEdit: () => void }) {
  if (s.education.length === 0) return <SectionEmpty hint={SECTION_EMPTY_HINTS.education} onEdit={onEdit} />
  return (
    <ul className="space-y-3">
      {s.education.map((e, i) => (
        <li key={i} className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium">{e.school || "未填写学校"}</span>
          {e.major && <span className="text-muted-foreground">{e.major}</span>}
          {e.degree && <Badge variant="secondary">{e.degree}</Badge>}
          {e.period && <span className="ml-auto text-xs text-muted-foreground">{e.period}</span>}
        </li>
      ))}
    </ul>
  )
}

function TimelineListView({
  items,
  hint,
  onEdit,
}: {
  items: { title: string; subtitle: string; period: string; highlights: string[] }[]
  hint: string
  onEdit: () => void
}) {
  if (items.length === 0) return <SectionEmpty hint={hint} onEdit={onEdit} />
  return (
    <ul className="space-y-4">
      {items.map((it, i) => (
        <li key={i} className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">{it.title || "未填写"}</span>
            {it.subtitle && <Badge variant="outline">{it.subtitle}</Badge>}
            {it.period && <span className="ml-auto text-xs text-muted-foreground">{it.period}</span>}
          </div>
          {it.highlights.length > 0 && (
            <ul className="space-y-1">
              {it.highlights.map((h, j) => (
                <li key={j} className="flex gap-2 text-sm text-muted-foreground">
                  <span className="mt-1.5 size-1 shrink-0 rounded-full bg-muted-foreground/50" />
                  <span>{h}</span>
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  )
}

function SkillsView({ items, hint, onEdit }: { items: string[]; hint: string; onEdit: () => void }) {
  if (items.length === 0) return <SectionEmpty hint={hint} onEdit={onEdit} />
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((sk, i) => (
        <Badge key={i} variant="secondary" className="font-normal">
          {sk}
        </Badge>
      ))}
    </div>
  )
}

function LinesView({ items, hint, onEdit }: { items: string[]; hint: string; onEdit: () => void }) {
  if (items.length === 0) return <SectionEmpty hint={hint} onEdit={onEdit} />
  return (
    <ul className="space-y-2">
      {items.map((it, i) => (
        <li key={i} className="flex gap-2 text-sm">
          <span className="mt-1.5 size-1 shrink-0 rounded-full bg-primary/60" />
          <span>{it}</span>
        </li>
      ))}
    </ul>
  )
}

function ParagraphView({ text, hint, onEdit }: { text: string; hint: string; onEdit: () => void }) {
  if (!text.trim()) return <SectionEmpty hint={hint} onEdit={onEdit} />
  return <p className="text-sm leading-relaxed whitespace-pre-wrap">{text}</p>
}

// ---------- 编辑对话框 ----------
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}

function StructEditDialog({
  section,
  struct,
  saving,
  onSave,
  onClose,
}: {
  section: SectionKey
  struct: ResumeStruct
  saving: boolean
  onSave: (patch: Partial<ResumeStruct>) => Promise<void>
  onClose: () => void
}) {
  const [basic, setBasic] = useState({
    name: struct.name,
    phone: struct.phone,
    email: struct.email,
    current_position: struct.current_position,
    years: struct.years_of_experience?.toString() ?? "",
  })
  const [education, setEducation] = useState(struct.education.map((e) => ({ ...e })))
  const [work, setWork] = useState(struct.work.map((w) => ({ ...w, highlights: [...w.highlights] })))
  const [internships, setInternships] = useState(struct.internships.map((w) => ({ ...w, highlights: [...w.highlights] })))
  const [projects, setProjects] = useState(struct.projects.map((p) => ({ ...p, highlights: [...p.highlights] })))
  const [skillsText, setSkillsText] = useState(struct.skills.join("\n"))
  const [languagesText, setLanguagesText] = useState(struct.languages.join("\n"))
  const [awardsText, setAwardsText] = useState(struct.awards.join("\n"))
  const [selfText, setSelfText] = useState(struct.self_evaluation)

  const setRow = <T,>(list: T[], idx: number, patch: Partial<T>, set: (v: T[]) => void) => {
    const next = [...list]
    next[idx] = { ...next[idx], ...patch }
    set(next)
  }

  const toLines = (t: string) => t.split("\n").map((s) => s.trim()).filter(Boolean)

  const handleSave = async () => {
    if (section === "basic") {
      const years = parseInt(basic.years, 10)
      await onSave({
        name: basic.name,
        phone: basic.phone,
        email: basic.email,
        current_position: basic.current_position,
        years_of_experience: Number.isFinite(years) ? years : null,
      })
    } else if (section === "education") {
      await onSave({ education })
    } else if (section === "work") {
      await onSave({ work })
    } else if (section === "internships") {
      await onSave({ internships })
    } else if (section === "projects") {
      await onSave({ projects })
    } else if (section === "skills") {
      await onSave({ skills: toLines(skillsText) })
    } else if (section === "languages") {
      await onSave({ languages: toLines(languagesText) })
    } else if (section === "awards") {
      await onSave({ awards: toLines(awardsText) })
    } else {
      await onSave({ self_evaluation: selfText.trim() })
    }
  }

  return (
    <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>编辑{SECTION_TITLES[section]}</DialogTitle>
      </DialogHeader>

      <div className="space-y-4 py-2">
        {section === "basic" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="姓名">
              <Input value={basic.name} onChange={(e) => setBasic({ ...basic, name: e.target.value })} />
            </Field>
            <Field label="电话">
              <Input value={basic.phone} onChange={(e) => setBasic({ ...basic, phone: e.target.value })} />
            </Field>
            <Field label="邮箱">
              <Input value={basic.email} onChange={(e) => setBasic({ ...basic, email: e.target.value })} />
            </Field>
            <Field label="求职意向">
              <Input
                value={basic.current_position}
                onChange={(e) => setBasic({ ...basic, current_position: e.target.value })}
              />
            </Field>
            <Field label="工作年限（年）">
              <Input
                type="number"
                min={0}
                value={basic.years}
                onChange={(e) => setBasic({ ...basic, years: e.target.value })}
              />
            </Field>
          </div>
        )}

        {section === "education" && (
          <div className="space-y-3">
            {education.map((e, i) => (
              <div key={i} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-2">
                <Field label="学校">
                  <Input value={e.school} onChange={(ev) => setRow(education, i, { school: ev.target.value }, setEducation)} />
                </Field>
                <Field label="专业">
                  <Input value={e.major} onChange={(ev) => setRow(education, i, { major: ev.target.value }, setEducation)} />
                </Field>
                <Field label="学历">
                  <Input value={e.degree} onChange={(ev) => setRow(education, i, { degree: ev.target.value }, setEducation)} />
                </Field>
                <Field label="时间段">
                  <Input value={e.period} onChange={(ev) => setRow(education, i, { period: ev.target.value }, setEducation)} />
                </Field>
                <Button
                  variant="ghost"
                  size="sm"
                  className="col-span-full justify-self-end text-muted-foreground hover:text-destructive"
                  onClick={() => setEducation(education.filter((_, j) => j !== i))}
                >
                  删除该条
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setEducation([...education, { school: "", major: "", degree: "", period: "" }])}
            >
              <Plus className="size-4" />
              添加一条教育经历
            </Button>
          </div>
        )}

        {(section === "work" || section === "internships") && (() => {
          const isWork = section === "work"
          const list = isWork ? work : internships
          const setList = isWork ? setWork : setInternships
          return (
            <div className="space-y-3">
              {list.map((row, i) => (
                <div key={i} className="space-y-2 rounded-lg border p-3">
                  <div className="grid gap-2 sm:grid-cols-3">
                    <Field label={isWork ? "公司" : "实习公司"}>
                      <Input value={row.company} onChange={(ev) => setRow(list, i, { company: ev.target.value }, setList)} />
                    </Field>
                    <Field label={isWork ? "职位" : "实习岗位"}>
                      <Input value={row.position} onChange={(ev) => setRow(list, i, { position: ev.target.value }, setList)} />
                    </Field>
                    <Field label="时间段">
                      <Input value={row.period} onChange={(ev) => setRow(list, i, { period: ev.target.value }, setList)} />
                    </Field>
                  </div>
                  <Field label="主要职责 / 成果（每行一条）">
                    <Textarea
                      className="min-h-20 text-sm"
                      value={row.highlights.join("\n")}
                      onChange={(ev) => setRow(list, i, { highlights: ev.target.value.split("\n") }, setList)}
                    />
                  </Field>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="justify-self-end text-muted-foreground hover:text-destructive"
                    onClick={() => setList(list.filter((_, j) => j !== i))}
                  >
                    删除该条
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setList([...list, { company: "", position: "", period: "", highlights: [] }])}
              >
                <Plus className="size-4" />
                添加一条{isWork ? "工作经历" : "实习经历"}
              </Button>
            </div>
          )
        })()}

        {section === "projects" && (
          <div className="space-y-3">
            {projects.map((row, i) => (
              <div key={i} className="space-y-2 rounded-lg border p-3">
                <div className="grid gap-2 sm:grid-cols-3">
                  <Field label="项目名称">
                    <Input value={row.name} onChange={(ev) => setRow(projects, i, { name: ev.target.value }, setProjects)} />
                  </Field>
                  <Field label="担任角色">
                    <Input value={row.role} onChange={(ev) => setRow(projects, i, { role: ev.target.value }, setProjects)} />
                  </Field>
                  <Field label="时间段">
                    <Input value={row.period} onChange={(ev) => setRow(projects, i, { period: ev.target.value }, setProjects)} />
                  </Field>
                </div>
                <Field label="主要职责 / 成果（每行一条）">
                  <Textarea
                    className="min-h-20 text-sm"
                    value={row.highlights.join("\n")}
                    onChange={(ev) => setRow(projects, i, { highlights: ev.target.value.split("\n") }, setProjects)}
                  />
                </Field>
                <Button
                  variant="ghost"
                  size="sm"
                  className="justify-self-end text-muted-foreground hover:text-destructive"
                  onClick={() => setProjects(projects.filter((_, j) => j !== i))}
                >
                  删除该条
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setProjects([...projects, { name: "", role: "", period: "", highlights: [] }])}
            >
              <Plus className="size-4" />
              添加一条项目经历
            </Button>
          </div>
        )}

        {section === "skills" && (
          <Field label="技能清单（每行一个）">
            <Textarea className="min-h-32 text-sm" value={skillsText} onChange={(e) => setSkillsText(e.target.value)} />
          </Field>
        )}

        {section === "languages" && (
          <Field label="语言能力（每行一项，如：英语（CET-6））">
            <Textarea className="min-h-32 text-sm" value={languagesText} onChange={(e) => setLanguagesText(e.target.value)} />
          </Field>
        )}

        {section === "awards" && (
          <Field label="获奖情况（每行一项）">
            <Textarea className="min-h-32 text-sm" value={awardsText} onChange={(e) => setAwardsText(e.target.value)} />
          </Field>
        )}

        {section === "self_evaluation" && (
          <Field label="自我评价">
            <Textarea className="min-h-40 text-sm leading-relaxed" value={selfText} onChange={(e) => setSelfText(e.target.value)} />
          </Field>
        )}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={saving}>
          取消
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="size-4 animate-spin" />}
          保存
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}

// ---------- 页面 ----------
export default function MyResumesPage() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [resumes, setResumes] = useState<ResumeOut[] | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [struct, setStruct] = useState<ResumeStruct | null>(null)
  const [parsing, setParsing] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const [editing, setEditing] = useState<SectionKey | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  const selected = resumes?.find((r) => r.id === selectedId) ?? null

  const patchResume = (id: number, patch: Partial<ResumeOut>) => {
    setResumes((prev) => prev?.map((r) => (r.id === id ? { ...r, ...patch } : r)) ?? prev)
  }

  const doParse = async (id: number, force = false) => {
    setParsing(true)
    setParseError(null)
    try {
      const updated = await parseResume(id, force)
      patchResume(id, { structured: updated.structured })
      setStruct(updated.structured ?? emptyStruct())
    } catch (err) {
      setParseError(apiErrorMessage(err, "简历解析失败"))
    } finally {
      setParsing(false)
    }
  }

  const select = (resume: ResumeOut) => {
    setSelectedId(resume.id)
    setParseError(null)
    if (resume.structured) {
      setStruct(resume.structured)
    } else {
      setStruct(null)
      void doParse(resume.id)
    }
  }

  useEffect(() => {
    fetchResumes()
      .then((list) => {
        setResumes(list)
        if (list.length > 0) select(list[0])
      })
      .catch(() => {
        toast.error("加载简历列表失败")
        setResumes([])
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleUpload = async (file: File) => {
    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase()
    if (!ALLOWED_EXT.includes(ext)) {
      toast.error("仅支持 PDF / DOCX / TXT / MD 格式文件")
      return
    }
    setUploading(true)
    try {
      const saved = await uploadResume(file)
      setResumes((prev) => [saved, ...(prev ?? [])])
      select(saved)
      toast.success(`简历已上传：${file.name}`)
    } catch (err) {
      toast.error(apiErrorMessage(err, "上传失败"))
    } finally {
      setUploading(false)
    }
  }

  const handleSaveSection = async (patch: Partial<ResumeStruct>) => {
    if (!selected || !struct) return
    const next = { ...struct, ...patch }
    setSaving(true)
    try {
      const updated = await updateResumeStructured(selected.id, next)
      setStruct(updated.structured ?? next)
      patchResume(selected.id, { structured: updated.structured ?? next })
      toast.success(`已更新${SECTION_TITLES[editing!]}`)
      setEditing(null)
    } catch (err) {
      toast.error(apiErrorMessage(err, "保存失败"))
      throw err
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <FileText className="size-5 text-primary" />
          我的简历
        </h1>
        {selected && (
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto gap-1.5 text-muted-foreground"
            disabled={parsing}
            onClick={() => void doParse(selected.id, true)}
          >
            <RefreshCw className={`size-3.5 ${parsing ? "animate-spin" : ""}`} />
            重新解析
          </Button>
        )}
      </div>

      {/* 简历卡片流：可左右滚动 */}
      <div className="flex gap-3 overflow-x-auto pb-2">
        {resumes?.map((r) => {
          const active = r.id === selectedId
          return (
            <button
              key={r.id}
              className="group w-32 shrink-0 space-y-1.5 text-left sm:w-36"
              onClick={() => select(r)}
            >
              <div
                className={`aspect-[3/4] w-full overflow-hidden rounded-xl border-2 bg-card shadow-sm transition-colors ${
                  active
                    ? "border-primary ring-2 ring-primary/25"
                    : "border-border group-hover:border-primary/40"
                }`}
              >
                <ResumeThumb resume={r} />
              </div>
              <p className={`truncate text-xs ${active ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                {r.filename}
              </p>
            </button>
          )
        })}

        <label className="group w-32 shrink-0 sm:w-36">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.txt,.md"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleUpload(file)
              e.target.value = ""
            }}
          />
          <div
            className={`flex aspect-[3/4] w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary ${
              uploading ? "border-primary/50" : "border-border"
            }`}
          >
            {uploading ? <Loader2 className="size-6 animate-spin" /> : <Plus className="size-6" />}
            <span className="text-xs">{uploading ? "上传中…" : "上传简历"}</span>
          </div>
          <p className="text-xs text-transparent">.</p>
        </label>
      </div>

      {/* 详情分区 */}
      {resumes === null ? (
        <div className="space-y-4">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : !selected ? (
        <Card>
          <CardContent className="py-14 text-center text-sm text-muted-foreground">
            还没有简历，点击上方「上传简历」或前往
            <a href="/" className="mx-1 text-primary hover:underline">
              工作台
            </a>
            粘贴文本
          </CardContent>
        </Card>
      ) : parsing ? (
        <div className="space-y-4">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin text-primary" />
            AI 正在解析简历结构，通常需要几秒到半分钟…
          </p>
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-6 w-28" />
              <Skeleton className="h-20 w-full" />
            </div>
          ))}
        </div>
      ) : parseError || !struct ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-sm text-destructive">{parseError ?? "简历尚未解析"}</p>
            <Button variant="outline" onClick={() => void doParse(selected.id)}>
              <RefreshCw className="size-4" />
              重试解析
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {struct.sections_missing.length > 0 && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
              未识别到板块：{struct.sections_missing.join("、")}。AI 可能没能从原文中找到对应内容，可点击各分区的编辑图标手动补充。
            </p>
          )}
          <SectionCard title="个人信息" onEdit={() => setEditing("basic")}>
            <BasicView s={struct} />
          </SectionCard>
          <SectionCard title="教育背景" onEdit={() => setEditing("education")}>
            <EducationView s={struct} onEdit={() => setEditing("education")} />
          </SectionCard>
          <SectionCard title="工作经历" onEdit={() => setEditing("work")}>
            <TimelineListView
              items={struct.work.map((w) => ({
                title: w.company,
                subtitle: w.position,
                period: w.period,
                highlights: w.highlights,
              }))}
              hint={SECTION_EMPTY_HINTS.work}
              onEdit={() => setEditing("work")}
            />
          </SectionCard>
          <SectionCard title="实习经历" onEdit={() => setEditing("internships")}>
            <TimelineListView
              items={struct.internships.map((w) => ({
                title: w.company,
                subtitle: w.position,
                period: w.period,
                highlights: w.highlights,
              }))}
              hint={SECTION_EMPTY_HINTS.internships}
              onEdit={() => setEditing("internships")}
            />
          </SectionCard>
          <SectionCard title="项目经历" onEdit={() => setEditing("projects")}>
            <TimelineListView
              items={struct.projects.map((p) => ({
                title: p.name,
                subtitle: p.role,
                period: p.period,
                highlights: p.highlights,
              }))}
              hint={SECTION_EMPTY_HINTS.projects}
              onEdit={() => setEditing("projects")}
            />
          </SectionCard>
          <SectionCard title="专业技能" onEdit={() => setEditing("skills")}>
            <SkillsView items={struct.skills} hint={SECTION_EMPTY_HINTS.skills} onEdit={() => setEditing("skills")} />
          </SectionCard>
          <SectionCard title="语言能力" onEdit={() => setEditing("languages")}>
            <SkillsView items={struct.languages} hint={SECTION_EMPTY_HINTS.languages} onEdit={() => setEditing("languages")} />
          </SectionCard>
          <SectionCard title="获奖情况" onEdit={() => setEditing("awards")}>
            <LinesView items={struct.awards} hint={SECTION_EMPTY_HINTS.awards} onEdit={() => setEditing("awards")} />
          </SectionCard>
          <SectionCard title="自我评价" onEdit={() => setEditing("self_evaluation")}>
            <ParagraphView text={struct.self_evaluation} hint={SECTION_EMPTY_HINTS.self_evaluation} onEdit={() => setEditing("self_evaluation")} />
          </SectionCard>
        </div>
      )}

      {editing && struct && (
        <Dialog open onOpenChange={(open) => !open && setEditing(null)}>
          <StructEditDialog
            section={editing}
            struct={struct}
            saving={saving}
            onSave={handleSaveSection}
            onClose={() => setEditing(null)}
          />
        </Dialog>
      )}
    </div>
  )
}
