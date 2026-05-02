# Career-Ops-GUI-cn 设计规范

## 设计定位

面向中国大陆求职者的本地 AI 工作台。视觉风格参考编辑出版物的暖色美学，但克制地应用于功能型工具 -- 清晰、沉稳、不抢注意力。

核心原则：**工具服务于求职，设计服务于阅读。**

---

## 色彩系统

### 主色板

```css
--primary-color: #6b1d1d;    /* 深红棕 -- 按钮、强调、活跃态 */
--primary-hover: #7a2525;    /* hover 态 */
--accent-gold: #b8a88a;      /* 柔和金 -- 装饰线、次要强调 */
```

选取理由：深红棕参考编辑设计中的 Meridian 版墨色，饱和度低、明度适中，既醒目又不刺眼。柔和金用于分割线和统计卡顶部装饰，增加层次感但不喧宾夺主。

### 背景色

```css
--bg-primary: #faf9f7;       /* 暖米白 -- 卡片、表单背景 */
--bg-secondary: #f5f3ef;     /* 暖灰 -- 页面底色、次级区域 */
--bg-sidebar: #1c1917;       /* 暖暗 -- 侧边栏 */
```

设计逻辑：纯白 `#ffffff` 在屏幕上反光强烈，暖米白降低对比度，减少长时间使用的眼疲劳。侧边栏使用暖暗色而非冷蓝黑，与主区域色调统一。

### 文字色

```css
--text-primary: #292524;     /* 深墨 -- 正文、标题 */
--text-secondary: #78716c;   /* 暖灰 -- 次要信息、说明文字 */
```

设计逻辑：纯黑 `#000000` 与暖白背景对比度过高（21:1），深墨色控制在 12:1 ~ 15:1，清晰且温和。

### 状态色

```css
--success-color: #15803d;    /* 深绿 -- 通过、有效 */
--warning-color: #b45309;    /* 深琥珀 -- 警告、待确认 */
--danger-color: #b91c1c;     /* 深红 -- 错误、删除 */
--info-color: #0e7490;       /* 深青 -- 信息提示 */
```

设计逻辑：所有状态色都做了降饱和处理，避免高饱和色在大面积使用时刺眼。与主色系（暖调）协调。

### 边框与阴影

```css
--border-color: #e7e5e4;     /* 暖灰边框 */
--shadow-sm: 0 1px 2px rgba(41, 37, 36, 0.06);
--shadow-md: 0 4px 6px -1px rgba(41, 37, 36, 0.08);
--shadow-lg: 0 10px 15px -3px rgba(41, 37, 36, 0.1);
```

设计逻辑：阴影使用暖色调 `rgba(41, 37, 36, ...)` 替代冷灰 `rgba(0, 0, 0, ...)`，与暖色背景融合更自然。

---

## 字体系统

### 两层架构

| 层级 | 字体 | 用途 |
|------|------|------|
| 界面正文 | 系统 sans-serif（-apple-system, Segoe UI, ...） | 表单、表格、按钮、说明文字 |
| 标题与数字 | Noto Serif SC（400/600） | 页面标题、卡片标题、统计数字、侧边栏标题 |

设计逻辑：正文保持 sans-serif 确保功能区域的清晰易读（这是工具，不是杂志）。标题使用衬线字体增加编辑感和质感，但仅限于标题层，不侵入正文。

### 引入方式

```html
<link href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;600&display=swap" rel="stylesheet" />
```

仅加载 400 和 600 两个字重，控制字体文件体积。

### 应用范围

```css
h1, h2, h3, h4 {
  font-family: 'Noto Serif SC', 'Songti SC', Georgia, 'Times New Roman', serif;
  letter-spacing: 0.02em;
}
```

- `.page-header h2`：`letter-spacing: 0.03em`
- `.card-title`：`letter-spacing: 0.01em`
- `.stat-value`：使用衬线字体，颜色为 `--text-primary`（不用主色，更克制）
- `.sidebar-header h1`：衬线字体，`letter-spacing: 0.05em`

---

## 组件样式

### 卡片

- `border-radius: 6px`（比常见的 8px 更紧凑，接近印刷感）
- 统计卡顶部有 2px 的 `--accent-gold` 装饰线
- 阴影使用暖色调

### 按钮

- `border-radius: 4px`（比卡片更紧凑，区分层级）
- 主按钮使用 `--primary-color`（深红棕）
- 次按钮使用 `--bg-secondary` 背景
- focus 环使用 `rgba(107, 29, 29, 0.08)`

### 状态徽章

- 背景色使用低饱和暖色调（如 `#ecfdf5`、`#fef2f2`、`#fef7ed`）
- 文字色与状态色变量对齐
- `border-radius: 20px`（胶囊形）

### 表格

- 表头背景使用 `--bg-secondary`
- hover 行使用 `--bg-secondary`
- 选中行使用 `rgba(107, 29, 29, 0.04)`（极淡红棕）

### 表单

- 输入框 focus 环：`0 0 0 3px rgba(107, 29, 29, 0.08)`
- 日期选择器 focus 背景：`rgba(107, 29, 29, 0.06)`
- "至今"标签使用 `--primary-color` 背景

---

## 侧边栏

- 背景：`#1c1917`（暖暗，非冷蓝黑）
- 导航文字：`#a8a29e`（暖灰，非冷灰 `#94a3b8`）
- 活跃项：`--primary-color` 背景
- 标题：衬线字体，白色

---

## 简历预览区

简历预览区保持相对独立的配色，用于模拟 PDF 输出效果：

- 标题色：`--primary-color`
- 分割线：`--primary-color` 或 `--accent-gold`
- 正文色：`--text-primary`
- 次要信息：`--text-secondary`

---

## 设计公式

```
求职工具 =
    (暖米白背景 × 深墨文字)
  + (衬线标题 × 无衬线正文)
  + (深红棕主色 × 柔和金装饰)
  + (紧凑圆角 × 暖色阴影)
  + (克制配色 × 清晰层级)
```

---

## 与 editorial 设计的差异

本项目参考了 editorial web design 的暖色美学，但做了以下取舍：

| 维度 | editorial 设计 | 本项目 |
|------|---------------|--------|
| 背景 | 带噪点纹理的宣纸色 | 纯净暖米白（工具需要干净） |
| 正文 | 衬线长文排版 | sans-serif（表单/表格为主） |
| 标题 | 高对比展示字体 | Noto Serif SC 600（温和） |
| 强调色 | 深红/朱红 | 深红棕（更沉稳） |
| 装饰 | Drop Cap、编号、印章 | 仅金色装饰线（极简） |
| 动效 | 视差滚动、渐显 | 无额外动效（工具不需要） |
| 手写字体 | Caveat / Ma Shan Zheng | 不使用（保持专业感） |

---

*基于 editorial web design 美学规范，针对求职工具场景裁剪。*
