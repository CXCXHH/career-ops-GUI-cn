# Project_Mem.md — Career-Ops 项目交接文档

> 生成日期：2026-04-28
> 项目版本：v1.3.1
> 原始作者：Santiago Fernández de Valderrama (santifer.io)
> 许可证：MIT

---

## 一、项目背景

### 1.1 项目定位

Career-Ops 是一个基于 AI 的求职自动化流水线系统，运行在 Claude Code / OpenCode / Gemini CLI 等 AI 编码终端之上。核心能力包括：

- **岗位评估**：A-F 结构化评分（10 个加权维度）
- **简历生成**：面向岗位的 ATS 优化 PDF/DOCX
- **门户扫描**：自动扫描 Greenhouse、Ashby、Lever 等 45+ 预配置公司
- **批量处理**：并行评估 10+ 岗位
- **应用追踪**：单一数据源 + 完整性校验
- **面试准备**：技术题 + 行为题 + 项目深挖 + AI 项目讲解

原项目面向海外 AI/Automation 岗位，由作者用于评估 740+ 岗位、生成 100+ 定制简历并成功入职。

### 1.2 本地化定制历史

本项目曾被中国区用户用于嵌入式/PLC/硬件方向求职，涉及以下定制：

- `config/profile.yml`：从 AI/LLMOps 岗位改为嵌入式/PLC 方向
- `portals.yml`：从欧美 AI 公司搜索改为 BOSS 直聘/猎聘的中国嵌入式岗位搜索
- `gui/server.mjs`：新增 Job Radar 功能（公司发现、岗位管理、简历生成、面试准备），并接入 DeepSeek/豆包 API
- `gui/src/pages/Onboarding.jsx`：**重写首次使用向导**（详见 5.4 节）
- `data/job-radar/`：新增整个数据目录用于 GUI 管理的岗位和简历数据
- 面试准备逻辑：从通用英文模板改为支持中文领域路由

### 1.3 技术栈

| 层 | 技术 |
|----|------|
| Agent 指令 | Claude Code Skills + modes/*.md |
| 后端 | Node.js (mjs 模块), js-yaml, Playwright |
| 前端 | React + Vite (gui/) |
| PDF 生成 | Playwright chromium + HTML 模板 |
| 仪表盘 | Go + Bubble Tea (dashboard/) |
| 数据格式 | Markdown 表格 + YAML + JSONL + TSV |
| AI 评分 | DeepSeek / 豆包 (OpenAI 兼容接口) |

---

## 二、项目架构

```
career-ops/
├── CLAUDE.md                    # Claude Code Agent 指令（系统层）
├── AGENTS.md                    # Codex Agent 指令（系统层）
├── GEMINI.md                    # Gemini CLI 指令（系统层）
├── DATA_CONTRACT.md             # 用户层/系统层分界契约
├── config/
│   ├── profile.example.yml      # 配置模板
│   └── profile.yml              # 用户个人配置（用户层，已重置）
├── modes/                       # 14+ 技能模式文件（系统层）
│   ├── _shared.md               # 全局评分规则
│   ├── _profile.md              # 用户定制覆写（用户层）
│   ├── oferta.md                # 单岗位评估
│   ├── pdf.md                   # PDF 生成
│   ├── scan.md                  # 门户扫描
│   └── ...
├── gui/                         # React 前端 + Express 后端
│   ├── server.mjs               # 核心 API 服务（~5000 行）
│   ├── src/                     # React 前端源码
│   └── dist/                    # 构建产物
├── scripts/                     # 工具脚本（mjs）
├── templates/                   # 简历模板 + 状态定义
├── batch/                       # 批处理
├── dashboard/                   # Go TUI 仪表盘
├── data/                        # 用户追踪数据（用户层）
│   └── job-radar/               # GUI 管理的数据
├── reports/                     # 评估报告（用户层）
├── output/                      # 生成 PDF（用户层）
├── interview-prep/              # 面试准备（用户层）
├── jds/                         # 保存的 JD（用户层）
└── tmp/                         # 运行时临时文件
```

---

## 三、当前存在的问题

### 3.1 简历生成质量问题（严重）

`gui/server.mjs` 中 `buildTailoredResume()` 存在以下问题：

1. **固定项目数量**：无工作经历时强制补到 3 个项目，不顾岗位差异
2. **低质量兜底**：AI 生成失败时使用"项目一 | 个人项目"等泛化兜底，技能兜底为"相关技术栈 1"
3. **Summary 模板化**：固定模板，未结合岗位、公司、用户能力、AI 评分结论
4. **项目同质化**：生成项目缺乏领域路由，不同方向岗位生成相似项目
5. **无项目校验**：不同项目可能业务场景、技术栈高度重复
6. **AI Provider 硬编码**：简历生成固定调用 DeepSeek，未遵循用户选择的 provider

### 3.2 面试准备不足（严重）

`buildInterviewPrepPrompt()` 存在以下问题：

1. **题量不足**：仅要求 8 道技术题 + 5 道行为题，远低于面试准备需求
2. **无领域路由**：不同岗位（嵌入式/PLC/前端/后端）使用相同问题方向
3. **无项目深挖**：缺少针对简历项目的追问
4. **AI 项目无解释**：生成的项目没有讲述稿、架构解释、追问准备
5. **JSON 截断风险**：单次 `max_tokens=8192` 生成大量内容，容易截断
6. **公司研究可能幻觉**：仅基于公司名让 AI 生成信息，无联网验证

### 3.3 数据层耦合（中等）

1. `resume-profile.json` 与 `cv.md` / `config/profile.yml` 数据重复，无同步机制
2. `resume-profile.json` 中 AI 项目元数据不够细，缺少生成依据、风险等级、证据等级
3. 搜索页岗位（无完整 JD）和完整 JD 岗位共用同一评分逻辑，导致搜索页岗位评分质量低

### 3.4 前端体验问题（中等）

1. ~~首次使用向导字段不全、表单为纯 textarea~~ → **已修复**：结构化表单 + 每卡独立保存
2. 面试准备题目少时页面可用，但题目增多后缺少分类、搜索、筛选
3. 简历生成无风险提示，用户无法看到哪些内容是 AI 生成、需要确认
4. localStorage 缓存面试准备，schema 变更后旧缓存缺字段不兼容

---

## 四、已知风险

### 4.1 安全风险

| 风险 | 等级 | 状态 | 说明 |
|------|------|------|------|
| API Key 泄露 | 高 | 已处理 | `.env` 已确认无真实密钥；`.gitignore` 已排除 `.env` |
| 个人信息残留 | 高 | 已处理 | 已清除 `config/profile.yml`、`resume-profile.json` 中的姓名/电话/邮箱；已删除含姓名的 PDF/HTML/MD 文件 |
| AI 伪造简历 | 中 | 未修复 | 系统可能生成论文、竞赛、公司经历等不可自证内容，需增加事实分层校验 |

### 4.2 技术风险

| 风险 | 等级 | 状态 | 说明 |
|------|------|------|------|
| JSON 截断 | 高 | 未修复 | 面试准备内容增长后，单次 AI 调用输出易被截断，需分段生成 |
| Provider 硬编码 | 中 | 未修复 | 简历生成固定 DeepSeek，需改为可配置 |
| 数据同步 | 中 | 未修复 | `resume-profile.json` 与 `cv.md` 数据重复无同步 |
| Go Dashboard 编译 | 低 | 已知 | 需要 Go 1.21+ 环境，非必需组件 |

### 4.3 产品风险

| 风险 | 等级 | 说明 |
|------|------|------|
| 简历生成可信度 | 高 | 低质量模板和 AI 伪造风险影响用户信任 |
| 面试准备深度不足 | 高 | 题量少、无领域路由、AI 项目无解释，影响面试表现 |
| 搜索页岗位质量 | 中 | 仅搜索页结果评分低，需保守评估并提示用户补充完整 JD |
| 国产生态适配 | 中 | 中国区嵌入式/PLC/芯片岗位需优先考虑国产工具链，当前无此逻辑 |

---

## 五、已完成的交接清理

### 5.1 个人敏感信息移除

| 文件 | 操作 |
|------|------|
| `config/profile.yml` | 重置为模板占位符，移除姓名、电话、邮箱、微信 |
| `data/job-radar/resume-profile.json` | 清空所有个人字段 |
| `.env` | 确认无真实 API Key，保留空模板 |
| `output/cv-陈翔-*.pdf` | 已删除 |
| `tmp/cv-陈翔-*.html` | 已删除 |

### 5.2 冗余文件清理

| 目录/文件 | 操作 |
|-----------|------|
| `output/1.pdf, 2.pdf, 3.pdf` | 已删除 |
| `tmp/51job-*.html, zhaopin-*.html` | 已删除 |
| `tmp/api-server.pid` | 已删除 |
| `interview-prep/成都曼托-*.json, *.md` | 已删除 |
| `reports/905247-博世-*.md` | 已删除 |
| `jds/华为-*.md, 汇川-*.md, 中广核-*.md` | 已删除 |
| `data/job-radar/jobs.jsonl` | 已清空 |
| `data/job-radar/companies.json` | 已清空 |
| `data/job-radar/candidates.jsonl` | 已清空 |
| `data/job-radar/deleted-companies.json` | 已清空 |
| `data/job-radar/discovery-runs.jsonl` | 已清空 |
| `data/job-radar/resume-photo.jpg` | 已删除 |
| `LJM_Mem.md` | 已删除（上一位用户的个人交接备注） |

### 5.3 初始化重置

| 文件 | 操作 |
|------|------|
| `config/profile.yml` | 重置为通用占位符模板 |
| `portals.yml` | 重置为空搜索配置 |
| `modes/_profile.md` | 保留原始英文模板（未包含个人信息） |
| `data/job-radar/resume-profile.json` | 清空为空白结构 |

### 5.4 首次使用向导（Onboarding）重写

**修改文件：** `gui/src/pages/Onboarding.jsx`、`gui/server.mjs`、`gui/src/api/index.js`、`gui/src/styles/index.css`

**字段变更：**

| 操作 | 字段 |
|------|------|
| 新增 | 性别 (`gender`)、年龄 (`age`)、微信 (`wechat`) |
| 删除 | LinkedIn、所在地 (`location`) |
| 结构化 | 教育/工作/项目 从 textarea 改为对象数组（与 ResumeBuilder 一致） |

**功能变更：**

| 功能 | 说明 |
|------|------|
| **6 区块折叠** | 基本信息、教育背景、项目经历、工作/实习经历、技能关键词、求职目标，默认全部折叠，点击标题栏切换 |
| **每卡独立保存** | 每个区块底部有保存按钮 + 页面底部"全部保存"按钮，点击即调用 POST `/api/onboarding` |
| **表单缓存回填** | 后端保存时写入 `onboarding-cache.json`；前端加载时 GET 回填，刷新/切页面不丢失数据 |
| **自定义日期选择器** | 替代原生 `<input type="month">`：年份范围 2000-2050，年/月独立 select，点击年份可折叠月份，统一 26px 高度对齐 |

**后端改动：**
- `normalizeOnboardingPayload()` — education/experience/projects 遍历结构化数组
- `renderCvMarkdown()` — 按结构化字段生成格式化 Markdown
- `saveOnboardingFiles()` — 同步写入 onboarding-cache.json + resume-profile.json 新增 gender/age/wechat
- `loadOnboardingCache()` / `GET /api/onboarding` — 返回已缓存的原始表单 payload |

---

### 6.1 快速启动

```bash
# 1. 安装依赖
npm install
npx playwright install chromium

# 2. 检查环境
npm run doctor

# 3. 配置个人信息
# 编辑 config/profile.yml 填入姓名、邮箱、目标岗位等

# 4. 启动 GUI
npm run gui:dev      # 开发模式
# 或
npm run gui:build && node gui/server.mjs  # 生产模式
```

### 6.2 关键文件索引

| 用途 | 文件 |
|------|------|
| Agent 指令 | `CLAUDE.md`（Claude Code）/ `AGENTS.md`（Codex）/ `GEMINI.md`（Gemini CLI） |
| 数据契约 | `DATA_CONTRACT.md`（用户层 vs 系统层分界） |
| 用户配置 | `config/profile.yml` |
| 用户定制 | `modes/_profile.md` |
| 搜索配置 | `portals.yml` |
| 简历源 | `cv.md`（如存在） |
| GUI 后端 | `gui/server.mjs`（核心 API 服务） |
| GUI 前端 | `gui/src/` |
| 评估模式 | `modes/oferta.md` |
| PDF 模式 | `modes/pdf.md` |
| 状态枚举 | `templates/states.yml` |

### 6.3 优先修复建议

1. **简历生成解耦**：移除固定 3 项目规则，引入 `inferJobDomain()` + `decideProjectPlan()` 动态决定项目数量和方向
2. **面试准备增强**：题量提升至 30+，按领域路由出题，增加项目深挖和 AI 项目解释
3. **分段生成**：将单次大 JSON 拆为多段 AI 调用，避免截断
4. **事实分层**：简历内容标注 `verified / adapted / gap_bridging / inferred`，防止伪造不可自证成果
5. **Provider 可配置**：简历生成和面试准备的 AI Provider 由环境变量或 UI 设置决定

---

## 七、数据契约摘要

**用户层（永不自动更新）：**
- `cv.md`, `config/profile.yml`, `modes/_profile.md`, `article-digest.md`, `portals.yml`
- `data/*`, `reports/*`, `output/*`, `interview-prep/*`, `jds/*`

**系统层（可自动更新）：**
- `modes/_shared.md`, `modes/oferta.md` 等模式文件
- `CLAUDE.md`, `AGENTS.md`, `GEMINI.md`
- `*.mjs` 脚本, `batch/*`, `dashboard/*`, `templates/*`, `docs/*`

**核心规则：用户定制写入 `modes/_profile.md` 或 `config/profile.yml`，绝不写入 `modes/_shared.md`。**
