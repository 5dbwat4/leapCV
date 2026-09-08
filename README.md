# 简跃 LeapCV · AI 简历优化工具

> 让简历，跃然而出 —— 一份好简历，完成一次职业跃迁。

融合大模型文本理解、信息抽取与岗位匹配算法的一站式简历优化 Web 应用：上传简历 + 粘贴目标岗位 JD，AI 自动完成**简历解析 → JD 匹配分析（打分）→ 风险诊断 → 内容重构与亮点挖掘**，输出可直接使用的优化后简历。

## 功能特性

- **多格式简历输入**：PDF / Word（DOCX）/ TXT / MD 上传自动解析，或直接粘贴文本，解析结果可编辑
- **JD 定向匹配**：LLM 抽取岗位硬技能（带权重）/软技能/职责/隐性要求，结合关键词加权覆盖度算法输出 0-100 匹配分与三维度评分（技能/经验/教育）
- **匹配分析**：已匹配技能（带简历证据）vs 待补强差距（带重要度与补强建议），输出三档投递建议
- **风险诊断**：错别字/语病/口语化/缺乏量化/描述空泛/真实性风险等 9 类问题，按严重度分级，附原文定位与修改建议；本地规则引擎兜底扫描
- **内容重构**：按 STAR 法则 + 量化原则 + JD 关键词对齐逐条改写，产出 Markdown 优化简历（一键复制 / 下载 .md），每组改写附改写理由
- **多用户系统**：注册登录（JWT + bcrypt）、简历与分析记录按用户隔离、历史记录回看与删除
- **实时进度**：分析管线基于 SSE 流式推送五个阶段的实时进度
- **演示模式**：未配置 API Key 时自动启用内置演示数据，全流程可体验

## 技术栈

| 层 | 技术 |
|---|---|
| 后端 | Python 3.11 · FastAPI · SQLAlchemy 2 · SQLite · PyJWT · bcrypt |
| 文件解析 | pdfplumber（PDF）· python-docx（Word） |
| 大模型 | openai SDK（OpenAI 兼容接口，可配任意厂商） |
| 前端 | Vite · React 18 · TypeScript · pnpm |
| UI | Tailwind CSS v4 · shadcn/ui · lucide-react · react-hook-form + zod |
| 渲染 | react-markdown + remark-gfm + @tailwindcss/typography |

## 项目结构

```
betterjd/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI 入口（生产模式托管前端构建产物）
│   │   ├── config.py            # .env 配置加载
│   │   ├── database.py          # SQLite + SQLAlchemy
│   │   ├── models.py            # User / Resume / Optimization
│   │   ├── schemas.py           # Pydantic 模型
│   │   ├── auth.py              # 密码哈希 / JWT / 登录态依赖
│   │   ├── routers/             # auth / resumes / optimize(SSE) / history
│   │   ├── services/
│   │   │   ├── parser.py        # PDF/DOCX/TXT → 纯文本
│   │   │   ├── llm.py           # OpenAI 兼容客户端（重试 + JSON 容错）
│   │   │   ├── matcher.py       # JD 关键词加权覆盖度算法
│   │   │   ├── pipeline.py      # 五阶段分析管线
│   │   │   └── mock_data.py     # 演示模式数据
│   │   └── prompts/             # 五个阶段的中文 Prompt
│   └── data/                    # SQLite 数据库（自动创建）
└── frontend/                    # React SPA（pnpm）
```

## 快速开始

### 1. 配置大模型 API

```bash
cd backend
cp .env.example .env
# 编辑 .env，填入任意 OpenAI 兼容厂商的 API Key：
#   智谱 GLM:  LLM_BASE_URL=https://open.bigmodel.cn/api/paas/v4   LLM_MODEL=glm-4.6
#   DeepSeek:  LLM_BASE_URL=https://api.deepseek.com               LLM_MODEL=deepseek-chat
#   Kimi:      LLM_BASE_URL=https://api.moonshot.cn/v1             LLM_MODEL=moonshot-v1-32k
#   OpenAI:    LLM_BASE_URL=https://api.openai.com/v1              LLM_MODEL=gpt-4o
```

> 不配置 Key 也能运行：系统自动进入演示模式，返回内置示例分析结果。

### 2. 启动后端（端口 8000）

```bash
cd backend
python -m venv .venv                     # Windows
# source .venv/bin/activate              # macOS/Linux
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

接口文档：<http://127.0.0.1:8000/docs>

### 3. 启动前端（端口 5173）

```bash
cd frontend
pnpm install
pnpm dev
```

打开 <http://localhost:5173>，注册账号即可使用。

**Windows 一键启动**：双击项目根目录的 `start.bat`。

### 4. 生产模式部署（可选）

```bash
cd frontend && pnpm build     # 产出 dist/
# 重启后端后，FastAPI 自动托管 dist，访问 http://127.0.0.1:8000 即可
```

## API 概览（前缀 /api）

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | /auth/register · /auth/login | 注册 / 登录，返回 JWT |
| GET | /auth/me | 当前用户 |
| POST | /resumes/upload | 上传 PDF/DOCX/TXT/MD（≤10MB）并解析 |
| POST | /resumes/text | 粘贴文本创建简历 |
| GET | /resumes | 我的简历列表 |
| POST | /optimize | 发起分析（SSE 流式进度 + 结果落库） |
| GET | /history · /history/{id} · DELETE /history/{id} | 历史记录 |

## 分析管线

1. **简历解析** → 结构化抽取（教育/工作/项目/技能/证书），标记缺失板块
2. **JD 抽取** → 硬技能（权重 1-5 + 必备/加分 + 同义别名）、软技能、职责、隐性要求
3. **匹配分析** → 算法计算关键词加权覆盖率（技能分 50%）+ LLM 评估经验分（30%）与教育分（20%），输出总匹配分、已匹配/缺失清单、投递建议
4. **风险诊断** → LLM 九类问题逐条诊断 + 本地弱表述规则扫描（去重合并，按严重度排序）
5. **内容重构** → STAR 法则 + 量化优先 + 对齐 JD 术语，逐条改写并保留真实性红线（不虚构数据，不确定处标记「请补充」）

## 安全说明

- 密码 bcrypt 哈希存储，JWT 有效期默认 7 天（`JWT_SECRET` 上线前务必修改）
- 上传文件类型/大小白名单校验；ORM 参数化查询
- API Key 仅存于后端 `.env`，前端不接触模型凭证
