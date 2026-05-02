// Centralized AI prompts
// All AI interaction text lives here. Render rules auto-injected from render-spec.

import { RENDER_TYPE_RULES } from './render-spec.js'

// ── Auto-generated format rules (embedded in every system prompt) ──

function buildRenderRulesText() {
  const lines = ['## 数据格式规范（必须严格遵守）', '']
  lines.push('### 文本字段')
  lines.push(RENDER_TYPE_RULES.text.description)
  lines.push('')

  lines.push('### 枚举/标签字段')
  lines.push(RENDER_TYPE_RULES.comma_list.description)
  lines.push(`示例："${RENDER_TYPE_RULES.comma_list.example}"`)
  lines.push('')

  lines.push('### 描述字段（分句列表）')
  lines.push(RENDER_TYPE_RULES.semicolon_list.description)
  lines.push(`示例："${RENDER_TYPE_RULES.semicolon_list.example}"`)
  lines.push('')

  lines.push('### 日期字段')
  lines.push(RENDER_TYPE_RULES.date.description)
  lines.push('')

  lines.push('### 禁止项')
  lines.push('- 不要在 description 中使用句号（。）作为分隔符')
  lines.push('- 不要使用换行符分隔列表项')
  lines.push('- 不要在单值文本字段中使用 JSON 数组')
  lines.push('- 不要在列表字段中使用 Markdown 语法（如 - 或 1.）')
  lines.push('- 不要编号')

  return lines.join('\n')
}

const RENDER_RULES = buildRenderRulesText()

// ── Domain system prompts ──

export const SYSTEM_PROMPTS = {
  resume: [
    '你是简历数据提取与合并专家。用户会提供任意格式的文本（旧简历、项目描述等），你需要提取结构化的简历信息。',
    '规则：',
    '1. 已有数据是"底稿"，你提取的是"补充"。基本信息只填空白字段。',
    '2. 教育/经历/项目：逐条比对——同学校/同公司/同项目名则合并补充字段，否则追加新条目。',
    '3. 技能和标签：取已有和新提取的并集，去重。',
    RENDER_RULES,
    '只输出 JSON 对象，不要 Markdown 代码块包裹，不要任何解释文字。',
  ].join('\n\n'),

  jobs: [
    '你是岗位分析专家。分析职位描述并提取结构化信息。',
    RENDER_RULES,
    '只输出 JSON 对象，不要 Markdown 代码块包裹。',
  ].join('\n\n'),

  interview: [
    '你是面试准备专家。基于候选人的简历和目标岗位 JD，生成有针对性的面试题目和准备策略。',
    '输出结构化的面试准备材料，包括技术题、项目深挖题、行为题等。',
    '只输出 JSON 对象，不要 Markdown 代码块包裹。',
  ].join('\n\n'),

  discovery: [
    '你是招聘信息搜索专家。从多平台搜索符合用户条件的招聘岗位。',
    '返回结构化的岗位列表信息。',
    '只输出 JSON 对象。',
  ].join('\n\n'),
}

// ── Task prompt builders ──

export function buildBulkImportPrompt(userInput, existingProfile) {
  const snapshot = {
    full_name: existingProfile.full_name || '',
    gender: existingProfile.gender || '',
    age: existingProfile.age || '',
    phone: existingProfile.phone || '',
    email: existingProfile.email || '',
    wechat: existingProfile.wechat || '',
    github: existingProfile.github || '',
    summary: existingProfile.summary || '',
    skills: existingProfile.skills || '',
    education: existingProfile.education || [],
    experience: existingProfile.experience || [],
    projects: existingProfile.projects || [],
  }

  const existingAwards = (existingProfile.modules || []).find(m => m.id === 'awards')?.content || ''

  return [
    '请从以下文本中提取简历信息，按照合并规则与已有数据结合。',
    '',
    '## 已有数据（底稿）',
    JSON.stringify(snapshot, null, 2),
    '',
    `## 已有获奖荣誉：${existingAwards || '无'}`,
    '',
    '## 用户新输入的资料',
    userInput.trim(),
    '',
    '## 要求',
    '返回如下 JSON 对象（即使某字段无变化也返回原值）：',
    JSON.stringify({
      full_name: '',
      gender: '',
      age: '',
      phone: '',
      email: '',
      wechat: '',
      github: '',
      summary: '',
      skills: '技能1, 技能2, 技能3',
      education: [{ school: '', degree: '', major: '', start_date: 'YYYY-MM', end_date: 'YYYY-MM', gpa: '', description: '课程1；课程2' }],
      experience: [{ company: '', position: '', start_date: 'YYYY-MM', end_date: 'YYYY-MM', description: '工作内容1；工作内容2', role: '' }],
      projects: [{ name: '', role: '', start_date: 'YYYY-MM', end_date: 'YYYY-MM', description: '项目内容1；项目内容2', tech_stack: '技术1, 技术2' }],
      awards: '获奖1；获奖2；获奖3',
    }, null, 2),
    '',
    '只返回 JSON，不要任何其他文字。',
  ].join('\n')
}

export function buildAutoFillPrompt(section, userInput, profile) {
  const context = {
    skills: profile.skills || '',
    summary: profile.summary || '',
    target_role: profile.target_role || '',
  }

  return [
    `你是简历撰写专家。请根据用户提供的岗位描述或要求，优化简历的"${section}"模块。`,
    '',
    '## 候选人现有资料',
    JSON.stringify(context, null, 2),
    '',
    '## 岗位描述/用户输入',
    userInput.trim(),
    '',
    '## 要求',
    '返回 JSON 对象。description 字段用中文分号（；）分隔多条内容。只返回 JSON。',
  ].join('\n')
}

export function buildEvaluatePrompt(job, profile) {
  return [
    '## 候选人信息',
    JSON.stringify({
      summary: profile.summary || '',
      skills: profile.skills || '',
      experience: (profile.experience || []).map(e => ({ company: e.company, position: e.position, description: e.description })),
      projects: (profile.projects || []).map(p => ({ name: p.name, description: p.description, tech_stack: p.tech_stack })),
      education: (profile.education || []).map(e => ({ school: e.school, degree: e.degree, major: e.major })),
    }, null, 2),
    '',
    '## 岗位信息',
    JSON.stringify({
      company: job.company || '',
      title: job.title || '',
      description: job.description || '',
      raw_text: (job.raw_text || '').slice(0, 5000),
      ai_optimized_jd: (job.ai_optimized_jd || '').slice(0, 5000),
    }, null, 2),
    '',
    '请评估匹配度。返回 JSON：{ score: 0-5, recommendation: "apply|consider|skip", summary: "", match_highlights: [], gaps: [], resume_strategy: [], interview_focus: [], next_actions: [] }',
  ].join('\n')
}

export function buildInterviewPrompt(job, profile) {
  return [
    '## 候选人信息',
    JSON.stringify({
      summary: profile.summary || '',
      skills: profile.skills || '',
      target_role: profile.target_role || '',
      projects: (profile.projects || []).map(p => ({ name: p.name, role: p.role, description: p.description, tech_stack: p.tech_stack })),
      experience: (profile.experience || []).map(e => ({ company: e.company, position: e.position, description: e.description })),
    }, null, 2),
    '',
    '## 目标岗位',
    JSON.stringify({
      company: job.company || '',
      title: job.title || '',
      ai_optimized_jd: (job.ai_optimized_jd || '').slice(0, 5000),
      description: (job.description || '').slice(0, 5000),
      match_highlights: job.match_highlights || [],
      gaps: job.gaps || [],
    }, null, 2),
    '',
    '请生成面试准备材料。返回完整的结构化 JSON（包含 technical_questions, project_deep_dive_questions, behavioral_questions, company_research, strengths, weaknesses, match_score 等字段）。',
  ].join('\n')
}

export function buildOptimizeJdPrompt(job) {
  const sourceText = [
    job.url ? `URL: ${job.url}` : '',
    job.company ? `公司: ${job.company}` : '',
    job.title ? `岗位: ${job.title}` : '',
    job.location ? `地点: ${job.location}` : '',
    job.salary ? `薪资: ${job.salary}` : '',
    job.raw_text ? `原始文本:\n${String(job.raw_text).slice(0, 9000)}` : '',
    job.description ? `描述:\n${job.description}` : '',
  ].filter(Boolean).join('\n\n')

  return [
    '请解析以下岗位信息并生成规范化的 JD。',
    '## 原始数据',
    sourceText,
    '## 要求',
    '返回 JSON：{ company, title, location, salary, experience, education, summary, responsibilities: [], requirements: [], highlights: [], keywords: [], confidence: "high|medium|low", liveness_status: "active|closed|unconfirmed", warnings: [] }',
    'responsibilities/requirements/highlights 每项用简洁的一个句子，不要带编号。',
  ].join('\n')
}
