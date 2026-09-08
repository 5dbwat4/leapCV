# AI 简历优化平台 · 市场竞品调研报告

> 调研日期：2026-09-07 ｜ 对标需求：[REQUIREMENTS.md](REQUIREMENTS.md)
> 本报告覆盖国内专业工具、国内招聘平台内置 AI、国际 SaaS、开源项目、通用大模型助手五类竞品，并在文末给出对 betterjd 的差异化启示。

---

## 一、竞品全景分类

| 类别 | 代表产品 | 核心逻辑 |
|---|---|---|
| 国内专业简历工具 | 超级简历、职徒简历、知页简历、乔布简历、五百丁、100分简历、YOO简历 | 模板 + AI 生成/润色 + 会员付费 |
| 国内招聘平台内置 AI | 智联招聘（职悟空/艾琳/求职AI）、BOSS直聘（职决/简历指南）、牛客（AI简历诊断/模拟面试） | 平台生态免费增值，绑定自家岗位投递 |
| 国际 SaaS | Jobscan、Resume Worded、Teal、Rezi、Final Round AI、Careerflow、Enhancv/Kickresume/Resume.io/Zety | JD 匹配分析 + ATS 优化订阅制 |
| 开源项目 | Resume-Matcher、JadeAI、Prisma AI、Resume Alchemist、Magic Resume、LiteCV | 大模型驱动，功能形态参考价值高 |
| 通用大模型助手 | Kimi、豆包、ChatGPT、WPS AI、Canva | 免费替代品，单点润色能力强 |

---

## 二、重点竞品详析

### 2.1 国内专业简历工具

**超级简历（WonderCV）** — [官网](https://www.wondercv.com/)
- 定位：专业 AI 简历制作工具，宣称 3000 万+ 用户，5000+ 行业中英文模板（校招/社招）。
- AI 能力：AI 智能生成简历内容、一键优化措辞、智能纠错；免费 AI Agent「WonderAI」可基于简历答疑；1 折 AI 导师修改服务；另有 1对1 简历优化/代写（专家来自大厂/投行）。
- 短板：主打"模板 + 生成 + 通用润色"，**没有公开的 JD 对标匹配分析**（无关键词缺口、匹配分之类的功能页）。

**职徒简历（52cv）** — [官网](https://www.52cv.com/)
- 定位：智能简历工具，主打中英文模板 + 行业案例库（金融/互联网/咨询/快消）。
- 价格：**15 元/月会员起**，权益含 20 份简历创建、**不限次数 AI 简历诊断**、中英一键翻译、全部案例查看、不限次简历导入。
- 短板：同样是模板+诊断路线，JD 定向对标能力弱；低价策略对个人用户吸引力强。

**其他**：知页简历、乔布简历、五百丁走类似路线；100分简历主打"ATS 适配模板 + 岗位范文"（宣称面试邀约率提升 120%）；YOO简历、WPS AI、Canva可画偏模板/设计，需注意 ATS 兼容性。

### 2.2 国内招聘平台内置 AI（免费，生态绑定）

**智联招聘**
- 「智联求职AI」（ai.zhaopin.com）：全链路 AI 求职托管——7×24 AI 代投、AI 代聊、岗位匹配、简历优化、投递计划、HR 进度追踪。
- App 内置【AI简历】（挖掘履历亮点一键生成高分简历）+【简历诊断】；面向年轻人的「职悟空」支持简历诊断、内容优化、AI 对话补经历并生成描述/自我评价。
- AI 招聘助手「艾琳」：同时服务 B/C 端，C 端含 AI 简历优化 + AI 模拟面试。

**BOSS直聘**
- 求职端 AI（2025 春招升级，接入 DeepSeek-R1）：明确求职意愿、求职答疑、模拟面试三大环节；「简历指南」提供模板与优化建议；授权后生成**定制化求职报告**（适配度分析、优化建议、沟通策略）。
- 内测 AI 求职助手 App「职决」：AI 对话提供求职诊断、职位推荐、简历优化、自动投递。

**牛客网**
- AI 简历诊断：精细化修改建议，主打"零错误"专业简历 + 数据安全承诺。
- AI 模拟面试：上传简历后以面试官视角针对项目经历追问；企业端「AI 面试 Ultra」初筛效率宣称提升 12 倍。

> ⚠️ 关键观察：平台系 AI 免费、离投递动作最近，但其诊断偏浅（模板级建议），且不会帮你做"跨平台/独立简历的 JD 深度对标"。

### 2.3 国际 SaaS（功能形态最接近本项目需求）

**Jobscan** — [官网](https://www.jobscan.co/)
- 定位：ATS 简历检查器鼻祖，"为特定职位优化简历"。
- 核心功能：**Match Rate（匹配率）评分**——简历 vs JD 双栏对比，缺的关键词标黄，逐项提示加什么关键词、怎么加；ATS 模拟解析；LinkedIn 优化；求职信生成与 ATS 检查。
- 商业模式：免费版有限次扫描，付费订阅（约 $30–50/月，以官网为准）。

**Resume Worded** — [官网](https://resumeworded.com/)（与本项目功能重合度最高）
- Score My Resume：上传简历得百分制评分 + **逐行反馈**（标记 vague / no metrics / weak verb 等），基于"招聘官实际使用的 30+ 检查项"；同一简历评分稳定可复现，展示 42→61→93 的提升轨迹。
- **Smart Target / Targeted Resume**：粘贴 JD → 输出匹配度评分（示例 27→85）+ 缺失关键词（绿色=已有、琥珀色=缺失），关键词权重对齐筛选系统加权方式。
- AutoFix：AI 从用户真实经历出发自动改写弱句，逐条经用户确认后导出 DOCX。
- 配套：AI 求职信生成、LinkedIn Review、ATS 模板。免费评分引流 + Pro 订阅（页面未公示价格）。

**Teal** — [定价页](https://www.tealhq.com/pricing)
- 一体化求职平台：简历构建器 + Job Tracker（职位追踪）+ AI 简历定制（按 JD 生成/改写要点）+ 求职信生成。
- 定价：免费版 1 份简历；**Teal+ $29/30天，$79/90天**。

**Rezi** — [定价页](https://www.rezi.ai/pricing)
- 主打"ATS 得分"（AI ATS Score 实时评分），AI 写作按 JD 生成工作经历要点。
- 定价：Free / Pro $29 月付 / **$149 终身买断**（低门槛试用曾低至 $2/月）。

**其他**：Final Round AI（实时面试 Copilot + 简历定制 + 自动投递）、Careerflow（简历定制 + LinkedIn 优化 + 求职追踪 Agent）、Enhancv、Kickresume、Resume.io、Zety（模板生成流）。

### 2.4 开源项目（技术选型与功能形态参考）

| 项目 | Stars | 核心功能 | 技术栈 |
|---|---|---|---|
| [Resume-Matcher](https://github.com/srbhr/Resume-Matcher) | **28.3k** | 解析简历+JD，提取关键词，计算文本相似度（ATS 通过导向），支持 100+ 本地 LLM | Python 生态 |
| [JadeAI](https://github.com/LingyiChen-AI/JadeAI) | 1.9k | 50+ 模板、PDF/**图片解析**、AI 优化、**JD 匹配分析（关键词覆盖率、ATS 通过率评分、缺失技能识别）**、多格式导出、Docker 一键部署 | Web + LLM |
| [Prisma AI](https://github.com/weicanie/prisma-ai) | 407 | 求职全流程 copilot：**项目亮点挖掘 Agent（可协助实现亮点）**、岗位实时抓取+向量检索重排定制简历、面经库、面试准备；Planer-Executor + CRAG + Human-in-the-loop 架构 | React/Vue + Nest.js/FastAPI + LangChain/LangGraph，AGPL-3.0 |
| [Resume Alchemist](https://github.com/Anarkh-Lee/resume-alchemist) | 288 | 智能诊断（综合分+**六维雷达图**）、**毒舌点评**、STAR 法则流式润色、**JD 关键词对比**、单句润色（标准/数据/专家三模式）、11 类行业 | React18+TS + Supabase + SiliconFlow/Qwen3-8B，MIT |
| 其他 | — | Magic Resume（AI 编辑器，JD 关键词提取）、LiteCV（9+ 模板 + ChatGPT/Claude 润色）、AIHawk（自动投递 Agent，海外爆火） | — |

> 开源项目验证了技术可行性：JD 关键词抽取 + 相似度/覆盖率打分 + LLM 定向改写这条链路已是成熟范式，无技术壁垒，胜负在数据与体验。

### 2.5 通用大模型助手（最大的隐性替代品）

Kimi、豆包、ChatGPT 等被大量求职者直接用来写简历初稿、岗位匹配、快速改写自我介绍（见 [ChatExcel 评测](https://chatexcel.com/blog/ai-resume-generation-tool-recommendations/)）。**免费、无结构化流程**——会侵蚀"话术润色"这类单点功能的价值，但做不了稳定的结构化诊断（评分维度固定可复现）和关键词缺口分析。

---

## 三、功能对标：REQUIREMENTS.md 五大能力 vs 竞品

| 需求能力 | 国际 SaaS | 国内专业工具 | 国内平台 AI | 开源项目 |
|---|---|---|---|---|
| 自动解析简历全文 | ✅ 普遍（PDF/DOCX） | ✅ 普遍 | ✅ 普遍 | ✅ JadeAI 连图片都能解析 |
| 对标 JD 内容重构 | ✅✅ Jobscan/Resume Worded/Teal 核心功能 | ⚠️ 弱（通用润色为主，少有 JD 深度对标） | ⚠️ 有适配度分析但浅 | ✅ Resume-Matcher/JadeAI/Alchemist 已实现 |
| 亮点挖掘 | ✅ AutoFix、Teal AI 要点 | ✅ 超级简历 AI 生成、职悟空对话补经历 | ✅ 智联 AI简历 | ✅ Prisma 项目亮点 Agent（最激进） |
| 话术专业化改写 | ✅ 普遍 | ✅ 普遍（一键优化措辞） | ✅ 普遍 | ✅ STAR 润色等 |
| 风险诊断（评分+逐行反馈） | ✅✅ Resume Worded 30+ 检查项、Rezi ATS 分 | ✅ 职徒不限次诊断 | ✅ 牛客/智联诊断 | ✅ Alchemist 六维雷达图 |
| 投递匹配分析 | ✅ Teal Job Tracker、Final Round 自动投递 | ❌ 基本没有 | ✅✅ 智联求职AI/BOSS职决（生态内最强） | ✅ Prisma 岗位抓取匹配 |

---

## 四、商业模式与定价参考

| 产品 | 免费档 | 付费档 |
|---|---|---|
| 职徒简历 | 有限使用 | ¥15/月起（含不限次 AI 诊断） |
| Rezi | Free | $29/月 或 $149 终身 |
| Teal | 1 份简历 | $29/30天，$79/90天 |
| Jobscan | 有限次扫描 | 订阅约 $30–50/月 |
| Resume Worded | 免费评分（引流） | Pro 订阅（未公示） |
| 超级简历 | 模板免费下载 | 会员 + 1对1 服务（高价人工增值） |
| 国内平台 AI | 免费 | 不收费，换平台内投递/流量 |

国内定价锚点明显低于海外（¥15–30/月 vs $29/月），终身买断/按次付费在海外已验证可行。

---

## 五、对 betterjd 的启示

1. **市场空白点：「JD 深度对标」在国内是结构性缺口。** 国内专业工具卷模板和生成（且已红海、低价），平台 AI 免费但诊断浅、生态封闭；Jobscan/Resume Worded 验证过的"JD 关键词缺口 + 匹配分 + 定向重构 + 改后复评"链路，在国内产品中普遍缺失。这正是 REQUIREMENTS.md 的核心主张，方向正确。
2. **必须做成"可复现的分析"，而非"一次性的生成"。** Resume Worded 的关键设计值得抄：固定检查项、同简历同分数、改前改后分数对比（42→61→93）、逐行标注问题类型。这是与"拿 Kimi 白嫖"拉开差距的护城河。
3. **闭环参考形态**：上传解析 → 粘贴 JD → 结构化 JD 解析（硬技能/软技能/加权关键词）→ 缺口清单 + 匹配分 → 逐条经历定向重构建议（人工确认）→ 改写后复评 → 导出。可参考 Prisma 的 Human-in-the-loop 和 Resume Worded 的 AutoFix 确认式改写。
4. **警惕两类挤压**：① 平台系 AI 拿"免费 + 离投递最近"吃掉轻需求用户，应考虑导出/跨平台中立性作为卖点；② 通用大模型吃掉纯润色需求，重心应放在结构化诊断与 JD 匹配的"分析力"上。
5. **变现参考**：低价月订阅（¥15–29）+ 单次深度报告按次付费 + 终身买断（Rezi 模式）均可行；诊断评分免费引流是全行业通用打法。

## 主要信息来源

- [超级简历官网](https://www.wondercv.com/) ｜ [2026年AI简历工具评测（100分简历）](https://www.100fenjianli.com/job_message/job_power/151) ｜ [十大AI简历工具对比](https://www.resumemakeroffer.com/blog/post/114027) ｜ [职徒/超级/知页横评（知乎）](https://zhuanlan.zhihu.com/p/1956121986347532981) ｜ [8款AI简历工具盘点（知乎）](https://zhuanlan.zhihu.com/p/666018388) ｜ [春招AI工具推荐（ChatExcel）](https://chatexcel.com/blog/ai-resume-generation-tool-recommendations/)
- [Resume Worded](https://resumeworded.com/) ｜ [Jobscan](https://www.jobscan.co/) ｜ [Teal 定价](https://www.tealhq.com/pricing) ｜ [Rezi 定价](https://www.rezi.ai/pricing)
- [智联招聘AI版（人民网）](http://828.people.com.cn/GB/461296/461373/index.html?article_id=171) ｜ [BOSS直聘简历](https://cv.zhipin.com/) ｜ [牛客AI模拟面试](https://www.nowcoder.com/interview/ai/index)
- GitHub：[Resume-Matcher](https://github.com/srbhr/Resume-Matcher) ｜ [JadeAI](https://github.com/LingyiChen-AI/JadeAI) ｜ [Prisma AI](https://github.com/weicanie/prisma-ai) ｜ [Resume Alchemist](https://github.com/Anarkh-Lee/resume-alchemist)

> 注：Jobscan 定价与 Resume Worded 定价未在官网公开页直接核实，已标注区间；其余价格均来自官网/搜索结果。部分搜索（Final Round AI、Careerflow 2026 最新动态）因搜索服务限流未完成核实，结论基于既有公开资料。
