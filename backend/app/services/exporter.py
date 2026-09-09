"""简历导出服务：Markdown 解析 → DOCX / LaTeX 渲染 → PDF 编译。

输入是 LLM 生成的 ``optimized_resume_md``（结构不保证严格规整），解析器按
容错策略逐行处理，保证板块与要点不丢失、任何输入都不崩溃；渲染器把解析
结果转换为 DOCX 字节流或 LaTeX 源码（风格对齐 leapcv-resume-zh.tex 模板），
PDF 由本机 XeLaTeX 编译产出。
"""

from __future__ import annotations

import io
import logging
import os
import re
import shutil
import subprocess
import tempfile
from dataclasses import dataclass, field

logger = logging.getLogger("leapcv.export")

# 简跃品牌配色（靛蓝主色 + 深灰正文 + 中灰次要信息），与前端 / LaTeX 模板一致
_PRIMARY_HEX = "4F46E5"
_DARK_HEX = "1F2937"
_GRAY_HEX = "6B7280"

# 条目标题 / 联系方式行的字段分隔符：全角｜或半角 |
_PIPE_SPLIT = re.compile(r"\s*[｜|]\s*")
# 行内粗体 **xxx**（LLM 输出，非贪婪匹配）
_BOLD_SPLIT = re.compile(r"\*\*(.+?)\*\*", re.S)
# 无序列表项：- /* / • 开头
_BULLET_PREFIX = re.compile(r"^[-*•]\s+(.*)$")
# 时间段样式：2023.07 - 至今 / 2019.09-2023.06 / Present 等
_TIME_HINT = re.compile(r"^\d{4}\s*[.\-/]|至今|present", re.IGNORECASE)
# 联系方式行特征关键词
_CONTACT_HINT = re.compile(r"求职意向|电话|邮箱|微信|手机|城市")
# 疑似"条目型"散段落（如教育经历的学校行）：整行拆成 2~4 段且长度受限才提升为条目
_ENTRY_LINE_MAX = 80
_ENTRY_PART_MAX = 30


class ExportError(Exception):
    """导出过程中的可预期错误（缺少 TeX 环境、编译失败等），message 面向用户展示。"""


# ---------------------------------------------------------------------------
# 解析结果结构
# ---------------------------------------------------------------------------


@dataclass
class Entry:
    """一条经历：条目标题按竖线拆出的字段 + 该条目下的要点列表。"""

    parts: list[str] = field(default_factory=list)  # 如 [公司, 职位, 时间段]
    bullets: list[str] = field(default_factory=list)

    def layout(self) -> tuple[str, str, str]:
        """拆为（主标题, 副标题, 时间段）三元组；末段形似时间段时单独提出。

        任意字段都可能为空字符串，渲染端需自行兜底，保证不崩。
        """
        if not self.parts:
            return "", "", ""
        parts = list(self.parts)
        time_range = ""
        if len(parts) > 1 and _TIME_HINT.search(parts[-1]):
            time_range = parts.pop()
        return parts[0], " ｜ ".join(parts[1:]), time_range


@dataclass
class Section:
    """一个板块：标题 + 条目列表（条目标题拆段 + 其要点）+ 散段落 + 裸要点。"""

    title: str = ""
    entries: list[Entry] = field(default_factory=list)
    paragraphs: list[str] = field(default_factory=list)
    bullets: list[str] = field(default_factory=list)


@dataclass
class ExportDoc:
    """整份简历的解析结果。"""

    name: str = ""
    intent: str = ""  # 求职意向
    contact_parts: list[str] = field(default_factory=list)  # 电话/邮箱/城市等字段
    contact_line: str = ""  # 联系方式整行（去粗体后的原文），解析失败时兜底展示
    preamble: list[str] = field(default_factory=list)  # 标题与首个板块之间的散落内容（容错）
    sections: list[Section] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Markdown 解析
# ---------------------------------------------------------------------------


def _strip_inline(text: str) -> str:
    """去掉行内 **粗体** 标记，只留纯文本。"""
    return _BOLD_SPLIT.sub(r"\1", text).strip()


def _split_pipes(text: str) -> list[str]:
    """按全角/半角竖线拆字段并去掉空段。"""
    return [p for p in _PIPE_SPLIT.split(text.strip()) if p.strip()]


def _looks_like_contact(text: str) -> bool:
    """判断某行是否是姓名下方的联系方式行（求职意向/电话/邮箱/竖线字段）。"""
    if _CONTACT_HINT.search(text):
        return True
    return bool(_PIPE_SPLIT.search(text)) and len(text) <= 120


def parse_resume_md(md: str) -> ExportDoc:
    """解析优化后简历 Markdown 为结构化文档（逐行容错，内容不丢）。"""
    doc = ExportDoc()
    if not md or not md.strip():
        return doc

    current_section: Section | None = None
    current_entry: Entry | None = None
    name_seen = False

    for raw in md.replace("\r\n", "\n").split("\n"):
        line = raw.strip()
        if not line:
            continue

        # ---- 三级标题：条目标题（### 公司 ｜ 职位 ｜ 时间段） ----
        if line.startswith("### "):
            entry = Entry(parts=_split_pipes(_strip_inline(line[4:])))
            if current_section is None:  # 容错：条目出现在任何板块之前
                current_section = Section(title="")
                doc.sections.append(current_section)
            current_section.entries.append(entry)
            current_entry = entry
            continue

        # ---- 二级标题：板块标题 ----
        if line.startswith("## "):
            current_section = Section(title=_strip_inline(line[3:]))
            doc.sections.append(current_section)
            current_entry = None
            continue

        # ---- 一级标题：姓名（之后再出现则按未知板块兜底） ----
        if line.startswith("# "):
            text = _strip_inline(line[2:])
            if not name_seen:
                doc.name = text
                name_seen = True
            else:
                current_section = Section(title=text)
                doc.sections.append(current_section)
                current_entry = None
            continue

        # ---- 列表项：挂在当前条目 / 当前板块 / 前置区 ----
        m = _BULLET_PREFIX.match(line)
        if m:
            text = m.group(1).strip()
            if current_entry is not None:
                current_entry.bullets.append(text)
            elif current_section is not None:
                current_section.bullets.append(text)
            else:
                doc.preamble.append(text)
            continue

        plain = _strip_inline(line)

        # ---- 首个板块之前的散内容：姓名兜底 / 联系方式行 / 前置段落 ----
        if current_section is None:
            if not name_seen:
                # 容错：md 缺失 "# " 标记时，把首行短文本当姓名
                if len(plain) <= 20 and not _PIPE_SPLIT.search(plain):
                    doc.name = plain
                    name_seen = True
                else:
                    doc.preamble.append(line)
                continue
            if not doc.contact_line and _looks_like_contact(plain):
                doc.contact_line = plain
                for part in _split_pipes(plain):
                    m_intent = re.match(r"^求职意向[：:]\s*(.*)$", part)
                    if m_intent and not doc.intent:
                        doc.intent = m_intent.group(1).strip()
                    elif part:
                        doc.contact_parts.append(part)
                continue
            doc.preamble.append(line)
            continue

        # ---- 板块内散段落 ----
        # 竖线拆成 2~4 段且长度受限的行视为"条目型段落"（如教育经历的学校行）
        parts = _split_pipes(plain)
        if 2 <= len(parts) <= 4 and len(plain) <= _ENTRY_LINE_MAX and all(
            len(p) <= _ENTRY_PART_MAX for p in parts
        ):
            entry = Entry(parts=parts)
            current_section.entries.append(entry)
            current_entry = entry
        else:
            # 保留原始文本（含 ** 粗体标记），由渲染端转 DOCX run / \textbf
            current_section.paragraphs.append(line)

    return doc


# ---------------------------------------------------------------------------
# DOCX 渲染
# ---------------------------------------------------------------------------

_DOCX_FONT = "微软雅黑"


def _apply_docx_font(run, size=None, bold=None, color=None) -> None:
    """设置 run 字体：西文与中文（eastAsia）统一为微软雅黑。"""
    from docx.oxml.ns import qn
    from docx.shared import Pt, RGBColor

    run.font.name = _DOCX_FONT
    run._element.get_or_add_rPr().get_or_add_rFonts().set(qn("w:eastAsia"), _DOCX_FONT)
    run.font.size = size if size is not None else Pt(10.5)
    if bold is not None:
        run.font.bold = bold
    if color is not None:
        run.font.color.rgb = RGBColor.from_string(color)


def _add_inline_runs(paragraph, text: str, color: str) -> None:
    """按 **粗体** 行内标记拆分 run 写入段落（无标记时整体一个 run）。"""
    pos = 0
    for m in _BOLD_SPLIT.finditer(text):
        if m.start() > pos:
            _apply_docx_font(paragraph.add_run(text[pos : m.start()]), color=color)
        _apply_docx_font(paragraph.add_run(m.group(1)), bold=True, color=color)
        pos = m.end()
    if pos < len(text):
        _apply_docx_font(paragraph.add_run(text[pos:]), color=color)


def _add_docx_bottom_border(paragraph) -> None:
    """给段落加底边框（板块标题的"下划线"视觉）。"""
    from docx.oxml import OxmlElement
    from docx.oxml.ns import qn

    p_pr = paragraph._p.get_or_add_pPr()
    p_bdr = OxmlElement("w:pBdr")
    bottom = OxmlElement("w:bottom")
    bottom.set(qn("w:val"), "single")
    bottom.set(qn("w:sz"), "8")  # 单位 1/8 pt，即 1pt
    bottom.set(qn("w:space"), "2")
    bottom.set(qn("w:color"), _PRIMARY_HEX)
    p_bdr.append(bottom)
    p_pr.append(p_bdr)


def build_docx(doc: ExportDoc) -> bytes:
    """把解析后的简历渲染为 DOCX 字节流（A4、微软雅黑、靛蓝板块标题）。"""
    from docx import Document
    from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_TAB_ALIGNMENT
    from docx.oxml.ns import qn
    from docx.shared import Cm, Pt, RGBColor

    document = Document()

    # ---- 页面：A4 + 约 1.6cm 页边距 ----
    section = document.sections[0]
    section.page_width, section.page_height = Cm(21.0), Cm(29.7)
    section.top_margin = section.bottom_margin = Cm(1.6)
    section.left_margin = section.right_margin = Cm(1.6)
    content_width = Cm(21.0 - 1.6 * 2)  # 正文可用宽度，供右对齐 tab stop 使用

    # ---- 文档默认字体：中英文统一微软雅黑 ----
    normal = document.styles["Normal"]
    normal.font.name = _DOCX_FONT
    normal.font.size = Pt(10.5)
    normal.element.rPr.rFonts.set(qn("w:eastAsia"), _DOCX_FONT)

    # ---- 姓名：大字号居中 ----
    if doc.name:
        p = document.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        _apply_docx_font(p.add_run(doc.name), size=Pt(22), bold=True, color=_DARK_HEX)

    # ---- 求职意向 + 联系方式行：居中小字灰色 ----
    header_bits = ([f"求职意向：{doc.intent}"] if doc.intent else []) + doc.contact_parts
    contact_text = " ｜ ".join(bit for bit in header_bits if bit) or doc.contact_line
    if contact_text:
        p = document.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        _apply_docx_font(p.add_run(contact_text), size=Pt(9), color=_GRAY_HEX)

    # ---- 前置散内容（容错兜底）：同样居中灰色小字 ----
    for text in doc.preamble:
        p = document.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        _add_inline_runs(p, text, color=_GRAY_HEX)

    def add_section_title(title: str) -> None:
        p = document.add_paragraph(style="Heading 1")
        p.paragraph_format.space_before = Pt(10)
        p.paragraph_format.space_after = Pt(4)
        _apply_docx_font(p.add_run(title), size=Pt(13), bold=True, color=_PRIMARY_HEX)
        _add_docx_bottom_border(p)

    def add_entry_heading(entry: Entry) -> None:
        title, subtitle, time_range = entry.layout()
        p = document.add_paragraph(style="Heading 2")
        p.paragraph_format.space_before = Pt(6)
        p.paragraph_format.space_after = Pt(2)
        # 时间段右侧对齐：在行末加右对齐 tab stop
        p.paragraph_format.tab_stops.add_tab_stop(content_width, WD_TAB_ALIGNMENT.RIGHT)
        _apply_docx_font(p.add_run(title), size=Pt(11), bold=True, color=_DARK_HEX)
        if subtitle:
            _apply_docx_font(p.add_run(f"  {subtitle}"), size=Pt(10), color=_GRAY_HEX)
        if time_range:
            p.add_run("\t")
            _apply_docx_font(p.add_run(time_range), size=Pt(10), color=_GRAY_HEX)

    def add_bullet(text: str) -> None:
        p = document.add_paragraph(style="List Bullet")
        p.paragraph_format.space_after = Pt(2)
        _add_inline_runs(p, text, color=_DARK_HEX)

    def add_paragraph(text: str) -> None:
        p = document.add_paragraph()
        p.paragraph_format.space_after = Pt(4)
        _add_inline_runs(p, text, color=_DARK_HEX)

    # ---- 各板块 ----
    for sec in doc.sections:
        add_section_title(sec.title or "其他")
        for entry in sec.entries:
            add_entry_heading(entry)
            for bullet in entry.bullets:
                add_bullet(bullet)
        for bullet in sec.bullets:
            add_bullet(bullet)
        for para in sec.paragraphs:
            add_paragraph(para)

    buf = io.BytesIO()
    document.save(buf)
    return buf.getvalue()


# ---------------------------------------------------------------------------
# LaTeX 渲染
# ---------------------------------------------------------------------------

# LaTeX 特殊字符 → 转义序列（单趟替换，避免二次转义污染）
_TEX_SPECIAL = re.compile(r"([\\{}&%$#_~^])")
_TEX_MAP = {
    "\\": r"\textbackslash{}",
    "{": r"\{",
    "}": r"\}",
    "&": r"\&",
    "%": r"\%",
    "$": r"\$",
    "#": r"\#",
    "_": r"\_",
    "~": r"\textasciitilde{}",
    "^": r"\textasciicircum{}",
}

# 板块关键词分类 →（图标命令, 默认标题）；顺序即匹配优先级
_SECTION_KINDS: list[tuple[str, str]] = [
    ("edu", "教育"),
    ("work", "工作"),
    ("project", "项目"),
    ("skill", "技能"),
    ("summary", "自我评价"),
]
_KIND_ICON = {"edu": r"\faGraduationCap", "work": r"\faBriefcase", "project": r"\faCubes",
              "skill": r"\faCogs", "summary": r"\faUser"}
_KIND_FALLBACK_TITLE = {"edu": "教育经历", "work": "工作经历", "project": "项目经历",
                        "skill": "专业技能", "summary": "自我评价"}


def _classify_section(title: str) -> str:
    """按关键词把板块标题归类；未识别返回 unknown（渲染端兜底）。"""
    for kind, keyword in _SECTION_KINDS:
        if keyword in title:
            return kind
    return "unknown"


def _tex_escape(text: str) -> str:
    """转义 LaTeX 特殊字符；【请补充：…】等占位符原样保留为可见文本。"""
    return _TEX_SPECIAL.sub(lambda m: _TEX_MAP[m.group(1)], text)


def _tex_inline(text: str) -> str:
    """转义文本并转换 **粗体** 为 \\textbf{...}。"""
    out: list[str] = []
    pos = 0
    for m in _BOLD_SPLIT.finditer(text):
        out.append(_tex_escape(text[pos : m.start()]))
        out.append("\\textbf{" + _tex_escape(m.group(1)) + "}")
        pos = m.end()
    out.append(_tex_escape(text[pos:]))
    return "".join(out)


_TEX_PREAMBLE = """% =====================================================================
% 简跃 LeapCV 简历（由导出服务程序化生成，风格对齐 leapcv-resume-zh.tex）
% 编译：xelatex <本文件>（需支持中文的 XeLaTeX 环境）
% =====================================================================
\\documentclass[10.5pt]{article}
\\usepackage[a4paper, top=1.6cm, bottom=1.6cm, left=1.7cm, right=1.7cm]{geometry}
\\usepackage[UTF8, fontset=windows]{ctex} % Windows 字体集
\\usepackage{titlesec}
\\usepackage{enumitem}
\\usepackage[hidelinks]{hyperref}
\\usepackage{xcolor}
\\usepackage{fontawesome5}
\\usepackage{tabularx}

\\definecolor{primary}{HTML}{4F46E5}   % 简跃主色（靛蓝）
\\definecolor{darktext}{HTML}{1F2937}
\\definecolor{graytext}{HTML}{6B7280}

\\pagestyle{empty}
\\setlength{\\parindent}{0pt}
\\raggedbottom
\\raggedright
\\color{darktext}

%---------- 标题样式 ----------
\\titleformat{\\section}
  {\\large\\bfseries\\color{primary}}
  {}{0em}{}
  [{\\color{primary}\\titlerule[0.8pt]}\\vspace{-2pt}]
\\titlespacing{\\section}{0pt}{10pt}{6pt}

%---------- 经历条目：{机构/学校}{职位·学位等副标题}{时间段} ----------
\\newcommand{\\entry}[3]{%
  \\begin{tabularx}{\\textwidth}{@{}X r@{}}
    \\textbf{#1} \\; {\\small\\color{graytext}#2} & {\\small\\color{graytext}#3} \\\\
  \\end{tabularx}\\vspace{-6pt}}

%---------- 项目条目：{项目名}{角色/技术栈}{时间段} ----------
\\newcommand{\\project}[3]{%
  \\begin{tabularx}{\\textwidth}{@{}X r@{}}
    \\textbf{#1} \\; {\\small\\color{graytext}#2} & {\\small\\color{graytext}#3} \\\\
  \\end{tabularx}\\vspace{-6pt}}

\\setlist[itemize]{leftmargin=1.2em, itemsep=1pt, parsep=0pt, topsep=2pt, label={\\color{primary}\\small\\textbullet}}

\\begin{document}
"""


def _tex_header(doc: ExportDoc) -> list[str]:
    """页眉：姓名 + 求职意向 + 联系方式，全部居中。"""
    lines: list[str] = ["%========== 页眉 ==========", "\\begin{center}"]
    name_parts: list[str] = []
    if doc.name:
        name_parts.append("{\\LARGE\\bfseries " + _tex_escape(doc.name) + "}")
    if doc.intent:
        name_parts.append("{\\small\\color{graytext}求职意向：" + _tex_escape(doc.intent) + "}")
    if name_parts:
        lines.append("  " + "\\quad ".join(name_parts) + "\\\\[4pt]")

    contact_bits: list[str] = []
    for part in doc.contact_parts:
        # 按字段关键词配图标：电话 → \faPhone*，邮箱 → \faEnvelope，其余 → 定位
        if "电话" in part or "手机" in part:
            icon = r"\faPhone*"
        elif "邮箱" in part:
            icon = r"\faEnvelope"
        else:
            icon = r"\faMapMarker*"
        contact_bits.append("{\\color{primary}" + icon + "} " + _tex_escape(part))
    if contact_bits:
        lines.append("  {\\small " + " \\;\\; ".join(contact_bits) + "}")
    lines.append("\\end{center}")
    lines.append("\\vspace{-4pt}")
    return lines


def _tex_itemize(items: list[str]) -> list[str]:
    """渲染 itemize 列表；空列表返回空。"""
    if not items:
        return []
    lines = ["\\begin{itemize}"]
    lines += ["  \\item " + _tex_inline(item) for item in items]
    lines.append("\\end{itemize}")
    return lines


def _tex_entry_command(entry: Entry, kind: str) -> list[str]:
    """条目 → \\entry / \\project 命令（含其要点 itemize）。"""
    title, subtitle, time_range = entry.layout()
    macro = "\\project" if kind == "project" else "\\entry"
    lines = [macro + "{" + _tex_escape(title) + "}{" + _tex_escape(subtitle) + "}{"
             + _tex_escape(time_range) + "}"]
    lines += _tex_itemize(entry.bullets)
    return lines


def _tex_section(sec: Section) -> list[str]:
    """渲染单个板块：已知类型用图标 section + 对应命令，未知类型 \\section* 兜底。"""
    kind = _classify_section(sec.title)
    if kind == "unknown":
        header = "\\section*{" + _tex_escape(sec.title or "其他") + "}"
    else:
        title = sec.title or _KIND_FALLBACK_TITLE[kind]
        header = "\\section{" + _KIND_ICON[kind] + "\\ " + _tex_escape(title) + "}"

    lines = [header]
    if kind in ("edu", "work", "project", "unknown"):
        # 经历型：条目命令 + 要点；随后是裸要点与散段落
        for entry in sec.entries:
            lines += _tex_entry_command(entry, kind)
        lines += _tex_itemize(sec.bullets)
        for para in sec.paragraphs:
            lines.append(_tex_inline(para))
            lines.append("")
    elif kind == "skill":
        # 技能型：全部要点收进一个 itemize；异常出现的条目按"标题行 + 要点"兜底
        items = list(sec.bullets)
        lines += _tex_itemize(items)
        for entry in sec.entries:
            title, subtitle, _ = entry.layout()
            head = _tex_escape(" ｜ ".join(p for p in (title, subtitle) if p))
            lines.append("\\textbf{" + head + "}")
            lines += _tex_itemize(entry.bullets)
        for para in sec.paragraphs:
            lines.append(_tex_inline(para))
            lines.append("")
    else:  # summary 自我评价：段落正文为主
        for para in sec.paragraphs:
            lines.append(_tex_inline(para))
            lines.append("")
        lines += _tex_itemize(sec.bullets)
        for entry in sec.entries:
            lines += _tex_entry_command(entry, kind)
    return lines


def build_tex(doc: ExportDoc) -> str:
    """把解析后的简历程序化拼接为 LaTeX 源码（风格对齐 leapcv-resume-zh.tex）。"""
    lines = [_TEX_PREAMBLE]
    lines += _tex_header(doc)
    for sec in doc.sections:
        lines.append("%---------- " + (sec.title or "其他") + " ----------")
        lines += _tex_section(sec)
    lines.append("\\end{document}")
    return "\n".join(lines) + "\n"


# ---------------------------------------------------------------------------
# PDF 编译
# ---------------------------------------------------------------------------

_XELATEX_TIMEOUT = 180  # 秒，MiKTeX 首次编译缺包自动安装可能较慢


def _decode_log_tail(data: bytes | None, limit: int = 300) -> str:
    """解码编译日志尾部（约 300 字符），用于失败提示。"""
    if not data:
        return ""
    return data.decode("utf-8", errors="replace").strip()[-limit:]


def compile_pdf(tex_content: str) -> bytes:
    """调用本机 XeLaTeX 把 LaTeX 源码编译为 PDF 字节流。

    找不到编译器或编译失败均抛 ExportError，message 可直接展示给用户。
    """
    xelatex = shutil.which("xelatex")
    if not xelatex:
        raise ExportError("服务器未安装 TeX 环境，无法编译 PDF")

    # Windows 下隐藏 xelatex 控制台窗口；POSIX 不支持 creationflags
    run_kwargs: dict = {}
    if os.name == "nt":
        run_kwargs["creationflags"] = subprocess.CREATE_NO_WINDOW

    with tempfile.TemporaryDirectory(prefix="leapcv-export-") as tmpdir:
        tex_path = os.path.join(tmpdir, "resume.tex")
        with open(tex_path, "w", encoding="utf-8") as f:
            f.write(tex_content)

        cmd = [
            xelatex,
            "-interaction=nonstopmode",
            "-halt-on-error",
            "-output-directory",
            tmpdir,
            tex_path,
        ]
        try:
            proc = subprocess.run(
                cmd,
                capture_output=True,
                timeout=_XELATEX_TIMEOUT,
                cwd=tmpdir,
                **run_kwargs,
            )
        except subprocess.TimeoutExpired:
            logger.warning("XeLaTeX 编译超时（%s 秒）", _XELATEX_TIMEOUT)
            raise ExportError(f"PDF 编译超时（超过 {_XELATEX_TIMEOUT} 秒），请稍后重试") from None

        pdf_path = os.path.join(tmpdir, "resume.pdf")
        if proc.returncode != 0 or not os.path.exists(pdf_path):
            log_tail = _decode_log_tail(proc.stdout) or _decode_log_tail(proc.stderr) or "无编译日志"
            logger.warning("XeLaTeX 编译失败，日志尾部：%s", log_tail)
            raise ExportError(f"PDF 编译失败：{log_tail}")

        with open(pdf_path, "rb") as f:
            return f.read()
