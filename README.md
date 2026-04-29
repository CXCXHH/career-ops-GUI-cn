# Career-Ops-GUI-cn

`Career-Ops-GUI-cn` 是一个面向中国大陆求职场景的本地化 AI 求职工作台，提供岗位管理、公司库、简历构建、AI 岗位评分、投递追踪、面试准备和健康检查等完整 GUI 流程。

这个项目基于开源项目 `career-ops` 演化而来，但当前仓库已经裁剪为以 GUI 为核心的中国区使用版本，保留当前运行所需的最小结构，并重写了初始化与健康检查体验。

<img width="2539" height="1382" alt="image" src="https://github.com/user-attachments/assets/b96dd9bc-675b-4902-bbc3-4b8e9184ec89" />

<img width="2536" height="1394" alt="image" src="https://github.com/user-attachments/assets/b0ed6190-2799-4d39-b5bf-a183c03085b4" />

<img width="2545" height="1403" alt="image" src="https://github.com/user-attachments/assets/2ae8f5e2-a987-4623-8142-3ce0fe5cc699" />

## 主要功能

- 岗位列表：导入岗位、提取 JD、AI 优化 JD、AI 评分、批量操作
- 公司库：维护目标公司、搜索关键词与岗位来源
- 简历生成：可视化维护简历信息，生成定制 PDF 简历
- 投递追踪：记录投递状态、备注、跟进信息
- 面试准备：基于岗位和简历生成技术题、项目深挖题、行为题
- 系统设置：管理 AI API、执行健康检查、自动补齐首启依赖

## 技术栈

- 前端：React + Vite
- 后端：Node.js + 原生 HTTP API
- PDF：Playwright
- 配置/数据：JSON / Markdown / YAML
- AI：DeepSeek、豆包（OpenAI 兼容接口）

## 项目特点

### 1. 面向中国大陆求职

默认交互、页面、简历结构和岗位处理逻辑都围绕中国用户场景设计，适合校招、社招、嵌入式、PLC、硬件、软件等岗位。

### 2. 本地优先

所有数据默认保存在本地项目目录，不依赖云端数据库。适合个人自用、二次开发和私有化部署。

### 3. 首启友好

健康检查支持：

- 自动安装根目录依赖
- 自动安装 `gui/` 前端依赖
- 优先复用本机 Chrome / Edge
- 仅在缺失系统浏览器时安装 Playwright Chromium
- 自动生成 `cv.md`、`config/profile.yml`、`portals.yml`
- npm 安装默认使用阿里云镜像源

## 目录结构

```text
Career-Ops-GUI-cn/
├── config/                    # 用户配置模板
├── data/                      # 本地数据
├── fonts/                     # PDF 字体
├── gui/                       # React 前端 + Node 后端服务
├── modes/                     # AI 评分规则（当前仅保留运行所需）
├── scripts/                   # 健康检查 / PDF / 校验 / Tracker 脚本
├── templates/                 # 简历模板、状态模板、初始化模板
├── output/                    # 导出的 PDF 简历
├── reports/                   # AI 评分报告
├── interview-prep/            # 面试准备结果
├── jds/                       # 保存的 JD 文本
└── tmp/                       # 运行临时文件
└── Template.JSON/             # JSON模板
```

## 环境要求

建议环境：

- Node.js 18 及以上
- Windows 10/11 优先
- 已安装 Chrome 或 Edge（推荐）

也支持没有浏览器依赖的新机器首次运行，健康检查会自动尝试补齐。

## 快速开始

### 1. 克隆项目

```bash
git clone <your-repo-url>
cd career-ops-gui-cn
```

### 2. 安装依赖

如果你希望手动安装：

```bash
npm install --registry=https://registry.npmmirror.com/
cd gui
npm install --registry=https://registry.npmmirror.com/
cd ..
```

如果你不想手动处理依赖，也可以直接进入下一步，交给健康检查自动处理。

### 3. 执行健康检查

```bash
npm run doctor
```

健康检查会自动：

- 安装根依赖
- 安装 `gui/` 依赖
- 检测本机 Chrome / Edge
- 必要时安装 Playwright Chromium
- 自动生成缺失的初始化模板文件

### 4. 启动项目

启动前端开发服务：

```bash
npm run gui:dev
```

单独启动后端服务：

```bash
npm run api
```

如果你使用的是当前项目默认开发方式，一般会同时运行：

```bash
# 终端 1
npm run api

# 终端 2
npm run gui:dev
```

默认访问地址：

- 前端：`http://localhost:5173`
- 后端：`http://localhost:3001`

### 5. Windows 用户一键启动

如果你是 Windows 用户，并且不想自己开两个终端，可以直接使用项目根目录自带的批处理脚本。

#### `start-gui.bat`

双击 [start-gui.bat](d:\career-ops\career-ops-main\start-gui.bat) 后会自动执行：

1. 检查本机是否已安装 `Node.js` 和 `npm`
2. 自动运行 `npm run doctor`
3. 自动补齐根依赖和 `gui/` 依赖
4. 自动检查浏览器环境
5. 启动后端服务 `http://localhost:3001`
6. 启动前端服务 `http://localhost:5173`
7. 自动打开浏览器

适合场景：

- 第一次启动项目
- 不熟悉命令行
- 希望双击即用

#### `restart-gui.bat`

双击 [restart-gui.bat](d:\career-ops\career-ops-main\restart-gui.bat) 后会自动执行：

1. 停止当前项目占用的 `3001` 和 `5173` 端口
2. 清理 Vite 前端缓存
3. 自动调用 `start-gui.bat` 重新启动项目

适合场景：

- 前端热更新异常
- 页面打不开但端口还被旧进程占用
- 修改配置后想快速重启

#### `stop-gui.bat`

双击 [stop-gui.bat](d:\career-ops\career-ops-main\stop-gui.bat) 后会自动执行：

1. 关闭当前项目启动出来的 API 窗口
2. 关闭当前项目启动出来的前端窗口
3. 清理占用 `3001` 和 `5173` 端口的相关进程

适合场景：

- 你只想彻底关闭项目，不想立即重启
- 前端或后端窗口开太多，想先统一关闭
- 准备关机、切换项目、释放端口

推荐理解方式：

- `start-gui.bat`：启动项目
- `restart-gui.bat`：重启项目
- `stop-gui.bat`：停止项目

## 首次使用流程

### 1. 进入设置页

先执行一次“运行检查并安装依赖”，确认环境无误。

### 2. 配置 AI API

在设置页配置至少一个 AI Provider：

- DeepSeek
- 豆包 / 火山方舟

配置会保存到本地 `.env` 文件。

### 3. 完成初始化信息

系统会在缺失时自动生成：

- `cv.md`
- `config/profile.yml`
- `portals.yml`

你只需要按自己的信息填写即可。

### 3.1 使用 JSON 模板导入简历信息

如果你不想在“首次使用向导”里手动逐项填写，也可以先准备一个 JSON 文件，再按这个结构整理你的简历事实和求职目标。

项目根目录已提供模板文件：[Template.JSON](</d:/career-ops/career-ops-GUI-cn/Template.JSON>)。

导入 JSON 时，顶层必须是两个对象：

- `candidate`：候选人简历事实
- `target`：求职目标与搜索偏好

最小可用结构如下：

```json
{
  "candidate": {
    "full_name": "张三",
    "summary": "一句话定位",
    "skills": ["C语言", "STM32"],
    "education": [],
    "experience": [],
    "projects": []
  },
  "target": {
    "roles": ["嵌入式软件工程师"],
    "cities": ["深圳"],
    "levels": ["校招/应届"],
    "enterprise_types": ["不限"],
    "positive_keywords": ["嵌入式", "STM32"],
    "negative_keywords": ["销售", "客服"],
    "companies": ["汇川技术"]
  }
}
```

字段说明：

- `candidate.full_name / gender / age / email / phone / github / wechat / portfolio_url / summary`：基础信息
- `candidate.skills`：技能关键词，推荐写成数组；如果你自己生成 JSON，也可以写成逗号或换行分隔的字符串
- `candidate.education`：教育经历数组，每项包含 `school / degree / major / start_date / end_date / gpa / description`
- `candidate.experience`：工作或实习经历数组，每项包含 `company / position / start_date / end_date / description / role`
- `candidate.projects`：项目经历数组，每项包含 `name / role / start_date / end_date / description / tech_stack`
- `target.roles`：目标岗位
- `target.cities`：目标城市
- `target.levels`：岗位级别，例如 `实习`、`校招/应届`、`初级`、`中级`、`高级`
- `target.enterprise_types`：企业类型，例如 `国企央企`、`民营名企`、`外企`、`不限`
- `target.positive_keywords / negative_keywords / companies`：后续岗位搜索和筛选时使用的关键词、排除词、重点公司

填写建议：

- 日期统一用 `YYYY-MM`，例如 `2024-07`
- 仍在进行中的经历，`end_date` 可写 `present`
- 推荐优先使用数组，兼容性最好
- `skills`、`roles`、`cities`、`levels`、`enterprise_types`、`positive_keywords`、`negative_keywords`、`companies` 这些字段即使写成字符串，系统也会按逗号、顿号、分号或换行自动拆分

这个 JSON 结构与项目实际导入逻辑一致，保存后可以作为你的标准简历事实模板长期复用；系统后续会据此生成 `cv.md`、`config/profile.yml`、`portals.yml` 和 `data/job-radar/resume-profile.json`。

### 4. 开始使用

推荐顺序：

1. 先在“岗位列表”导入或录入岗位
2. 对岗位执行 AI 优化 JD 和 AI 评分
3. 在“简历生成”页面维护简历并导出 PDF
4. 将岗位加入“投递追踪”
5. 对关键岗位生成“面试准备”

## GUI 界面详细说明

本项目的主要使用方式是通过 GUI 页面完成。下面按页面说明每个模块的用途、输入内容和典型操作。

### 1. Dashboard（首页）

首页用于查看整体求职状态，是进入项目后的总览页。

主要内容包括：

- 项目健康状态
- 岗位总数、有效岗位数、推荐岗位数
- 投递追踪统计
- 快速入口

适合做的事情：

- 确认系统依赖和初始化文件是否正常
- 查看当前岗位池规模
- 快速跳转到岗位列表、简历生成、投递追踪等核心页面

如果是第一次使用，建议先从这里进入“设置”页完成环境检查和 API 配置。

### 2. 设置（Settings）

设置页是首启最重要的页面，负责系统环境准备和 AI 配置。

你可以在这里完成：

- 运行健康检查并自动安装依赖
- 查看当前根依赖、GUI 依赖、浏览器依赖是否正常
- 配置 DeepSeek API
- 配置豆包 / 火山方舟 API
- 清除已保存的 API Key

推荐操作顺序：

1. 点击“运行检查并安装依赖”
2. 确认 `cv.md`、`config/profile.yml`、`portals.yml` 已自动生成
3. 填写至少一个 AI Provider 的 API Key
4. 保存配置

如果后续 AI 评分、面试准备、AI 优化 JD 无法工作，优先回到这个页面排查。

### 3. 首次使用向导（Onboarding）

首次使用向导用于初始化候选人资料，适合第一次使用时补全你的基本简历信息。

主要录入内容：

- 基本信息
- 教育背景
- 项目经历
- 工作 / 实习经历
- 技能关键词
- 求职目标

特点：

- 页面按区块折叠展示
- 支持分块保存
- 支持缓存回填
- 时间选择支持年月输入

适合做的事情：

- 在还没有完整简历页面配置前，先快速录入一版基础资料
- 用作最初的求职画像初始化

### 4. 公司库（Companies）

公司库用于维护目标公司列表，是岗位发现与管理的前置模块。

你可以在这里维护：

- 公司名称
- 行业标签
- 岗位关键词
- 屏蔽关键词
- 地点
- 公司来源类型
- 是否启用

典型用途：

- 建立你长期关注的公司池
- 维护不同方向的目标企业
- 为后续岗位发现、岗位归类和搜索做准备

如果你的使用习惯是“先定公司，再找岗位”，这个页面应该优先维护。

### 5. 岗位发现 / 搜索（Discovery）

这个页面用于从公司库或关键词出发，生成候选岗位并导入岗位列表。

典型能力包括：

- 按公司和关键词发起搜索
- 导入发现结果
- 将候选岗位批量加入岗位列表

适合做的事情：

- 对目标公司做集中岗位发现
- 快速建立候选岗位池
- 将搜索结果批量转入正式岗位列表

推荐流程：

1. 先维护公司库
2. 再到发现页执行搜索
3. 将有价值的岗位加入岗位列表

### 6. 候选区（Candidates）

候选区用于存放低置信度、待确认或暂不进入正式流程的岗位。

适合放入这里的岗位：

- 搜索结果信息不完整
- JD 质量差
- 暂时不确定要不要评估
- 来源可信度一般，需要人工复核

你可以在这里做：

- 批量勾选
- 批量删除
- 确认后转入正式岗位列表

这个页面相当于“缓冲区”，避免把所有粗糙岗位直接塞进正式岗位池。

### 7. 岗位列表（Jobs）

岗位列表是整个项目最核心的页面之一，负责正式岗位的管理和 AI 处理。

主要功能：

- 查看岗位列表
- 手动编辑岗位信息
- 导入 URL 或原始 JD
- 提取 JD 正文
- AI 优化 JD
- AI 岗位评分
- 批量检查、批量提取、批量优化 JD、批量评分
- 将岗位加入投递追踪
- 进入简历生成和面试准备流程

推荐操作顺序：

1. 导入岗位或从候选区转入岗位
2. 对岗位执行“提取 JD”
3. 执行“AI 优化 JD”
4. 执行“AI 评分”
5. 根据评分结果决定是否继续
6. 对值得投递的岗位生成简历、加入投递追踪、生成面试准备

页面里的岗位通常有几种状态：

- 原始导入岗位
- 已提取 JD 的岗位
- 已 AI 优化 JD 的岗位
- 已评分岗位
- 已加入投递追踪的岗位

这是日常使用频率最高的页面。

### 8. 简历生成（Resume Builder）

简历生成页用于维护你的简历资料，并针对岗位生成 PDF 简历。

主要功能：

- 编辑个人基本信息
- 管理教育、经历、项目等模块
- 自定义模块开关和排序
- 上传 / 删除个人照片
- 预览简历
- 为指定岗位生成定制 PDF
- 查看已生成文件并删除旧文件

当前简历页的使用逻辑是：

- 你维护一份本地“简历素材池”
- 系统基于目标岗位和当前简历数据生成定制结果
- 预览优先显示用户填写内容
- 导出以 PDF 为主

推荐使用方式：

1. 先把你的教育、项目、工作经历录入完整
2. 检查模块是否启用
3. 对某个岗位生成简历前先预览
4. 再生成 PDF 并保留最终版本

如果你经常要对多个岗位做差异化简历，这个页面会是核心工作区。

### 9. 投递追踪（Tracker）

投递追踪页面用于管理你已经决定投递或已经投递的岗位。

主要功能：

- 查看全部投递记录
- 修改投递状态
- 添加或更新备注
- 单条删除
- 批量删除
- 与岗位列表联动

典型状态包括：

- Evaluated
- Applied
- Interview
- Offer
- Rejected
- Skip

推荐用法：

1. 只把真正值得推进的岗位加入投递追踪
2. 在每次投递、沟通、面试后更新状态
3. 用备注记录关键事实，例如投递渠道、联系人、面试轮次、注意事项

这个页面的核心价值是让你的“岗位评估”和“实际投递动作”形成闭环。

### 10. 跟进提醒（Follow-ups）

跟进提醒页基于投递记录生成后续跟进节奏建议。

适合做的事情：

- 查看哪些岗位需要继续跟进
- 记录已发送的跟进消息
- 维护后续联系节奏

如果你把投递追踪维护得足够完整，这个页面会帮助你减少遗漏。

### 11. 面试准备（Interview Prep）

面试准备页面用于针对某一个已评估岗位生成完整面试材料。

主要能力：

- 基于岗位和简历生成匹配度分析
- 技术面试题
- 项目深挖题
- 行为面试题
- AI 项目讲法 / 追问准备
- 导出 Markdown

推荐前置条件：

- 岗位已经完成 AI 评分
- 简历信息已经较完整
- 项目经历中已经有你准备拿来讲的内容

推荐使用流程：

1. 在岗位列表中先完成评分
2. 进入面试准备页选择该岗位
3. 点击“生成面试准备”
4. 按技术题、项目题、行为题逐项准备
5. 导出 Markdown，作为实际面试前复习材料

这个页面更适合“重点岗位深度准备”，而不是每个岗位都生成。

## 典型使用路径

如果你是第一次使用，建议按下面顺序操作：

1. 设置：运行健康检查并安装依赖
2. 设置：配置 DeepSeek 或 豆包 API
3. 首次使用向导 / 简历生成：补全个人简历资料
4. 岗位发现：使用自己的AI搜索填写 JSON 模板搜索并导入候选岗位
5. 候选区：筛一遍低质量岗位
6. 岗位列表：提取 JD、优化 JD、AI 评分
7. 简历生成：针对目标岗位生成 PDF
8. 投递追踪：加入并维护投递状态
9. 面试准备：对关键岗位生成面试材料

如果你已经有明确岗位 JD，也可以走更短路径：

1. 设置页配置 API
2. 岗位列表直接导入岗位
3. AI 优化 JD + AI 评分
4. 简历生成
5. 投递追踪
6. 面试准备

## 常用命令

```bash
# 健康检查
npm run doctor

# 数据校验
npm run verify

# CV / Profile / Portals 一致性检查
npm run sync-check

# 启动后端
npm run api

# 启动前端开发环境
npm run gui:dev

# 构建前端
npm run gui:build
```

## 数据说明

本项目默认将用户数据保存在本地：

- `data/job-radar/`：岗位、公司、候选区、初始化缓存
- `data/applications.md`：投递追踪
- `data/follow-ups.md`：跟进记录
- `data/pipeline.md`：待处理岗位入口
- `reports/`：岗位评分报告
- `output/`：导出 PDF
- `interview-prep/`：面试准备文件

如果你打算公开你的仓库，建议在提交前清理这些用户层文件或恢复为初始化状态。

## 健康检查自动安装逻辑

当前版本的健康检查做了两层优化：

### npm 依赖安装

自动使用阿里源：

```text
https://registry.npmmirror.com/
```

用于：

- 根目录 `npm install`
- `gui/` 目录 `npm install`

### 浏览器依赖安装

顺序如下：

1. 优先复用本机 Chrome
2. 其次复用本机 Edge
3. 两者都不存在时，才安装 Playwright Chromium

这样可以显著减少首次启动等待时间。

## 适合哪些人

这个项目更适合：

- 想把求职流程做成一个本地工作台的用户
- 需要长期维护岗位池、简历和投递状态的人
- 想基于 AI 做岗位评估和面试准备的人
- 想二次开发中文求职 GUI 的开发者

## 二次开发建议

如果你要继续扩展，建议优先从这些位置入手：

- 前端页面：`gui/src/pages/`
- API 封装：`gui/src/api/index.js`
- 后端核心：`gui/server.mjs`
- 健康检查：`scripts/maintenance/doctor.mjs`
- PDF 模板：`templates/cv-template.html`
- AI 评分规则：`modes/_shared.md`、`modes/oferta.md`

## 已保留的核心能力

当前仓库保留的是 GUI 运行必需部分，不再包含上游项目的大量 CLI / 多语言 / 维护文档 / dashboard / agent 配置残留。

这意味着：

- 仓库结构更轻
- 对普通用户更友好
- 更适合作为单独 GUI 项目开源

## License

MIT

## 致谢

本项目基于开源项目 `career-ops` 演化而来，并针对中文 GUI 求职场景做了较大幅度的收敛、裁剪和本地化重构。
