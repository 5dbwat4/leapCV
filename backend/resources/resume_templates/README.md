# 简跃 LeapCV 简历模板库（LaTeX / TeX）

本目录收录从 GitHub 等来源搜罗的主流简历模板，已统一清洗为通用模板格式（原作者个人信息全部替换为占位符），并附带编译验证过的 PDF 预览。可作为简跃简历导出 / PDF 渲染的模板资源使用。

> 收录与改写仅用于模板结构与排版目的，原作者著作权与许可证继续有效，使用时请保留各目录内的 LICENSE 文件。

## 模板一览

| 目录 | 模板 | 语言 | 编译引擎 | 来源 | 许可证 |
|---|---|---|---|---|---|
| `leapcv-modern/` | **简跃定制版**（结构对齐 AI 优化输出） | 中 / 英 | XeLaTeX / pdfLaTeX | 本项目原创 | 项目内部使用 |
| `jake-resume/` | Jake's Resume（全球最流行的单栏简历之一） | 英 | pdfLaTeX | [jakegut/resume](https://github.com/jakegut/resume) | MIT |
| `sb2nov-resume/` | Sourabh Bajaj 经典单栏模板（Jake 模板的源头） | 英 | pdfLaTeX | [sb2nov/resume](https://github.com/sb2nov/resume) | MIT |
| `billryan-resume/` | billryan 模板（中文圈最流行的 LaTeX 简历之一） | 英（可开中文） | XeLaTeX | [billryan/resume](https://github.com/billryan/resume) | MIT |
| `hijiangtao-resume/` | hijiangtao 极简中文模板 | 中 | XeLaTeX | [hijiangtao/resume](https://github.com/hijiangtao/resume) | MIT |
| `awesome-cv/` | Awesome-CV（设计感最强的国际知名模板） | 英 | XeLaTeX | [posquit0/Awesome-CV](https://github.com/posquit0/Awesome-CV) | LPPL 1.3c |

每个模板目录均包含 **编译好的 PDF 预览**，可在挑选模板时直接查看效果。

## 快速使用

```bash
# 英文模板（jake / sb2nov / leapcv-en）
pdflatex resume.tex

# 中文模板（billryan / hijiangtao / awesome-cv / leapcv-zh）
xelatex resume.tex          # 各目录内主 .tex 文件名见上表
```

要求 TeX 发行版：TeX Live / MiKTeX（需含 XeLaTeX）。`awesome-cv/` 的字体已打包在目录内（`fonts/`，Adobe Source Sans 3，SIL OFL 许可），无需安装系统字体即可编译。

## 占位符约定

- **【中文方括号】/ [English brackets]** 内为占位内容，替换为真实信息；
- `xxx` / `X%` 等为原模板自带的示意占位，按需填写；
- 结构上建议遵循 **STAR 法则**（背景-任务-行动-结果）并优先量化成果，与简跃 AI 优化建议保持一致。

### leapcv-modern 定制模板说明

该模板由本项目编写，板块顺序与简跃 AI 输出的简历结构一一对应：

```
页眉（姓名 + 求职意向 + 联系方式）
→ 教育经历 → 工作经历 → 项目经历 → 专业技能 → 自我评价
```

- `\entry{机构}{城市}{职位/学位}{时间段}`：经历条目命令
- `\project{项目名}{技术栈/角色}{时间段}`：项目条目命令
- `%<<<` 注释标记的代码块可整块复制以追加条目
- 主色 `primary` 定义于文件头部（默认为简跃靛蓝 `#4F46E5`），可按品牌需要调整
- 中文版使用 `ctex` 宏包（默认 `fontset=windows`，其他平台请按注释改为 `fandol` 等）

## 对接产品的注意事项

1. AI 优化结果（Markdown 结构化简历）→ 模板渲染时，按上述板块顺序填充对应字段；
2. AI 输出中标记「【请补充：…】」的内容，渲染为模板占位符而非虚构数据；
3. 若用于服务端批量生成 PDF，建议使用 `latexmk -pdf` / `-xelatex` 并在沙箱环境中限制编译时长。
