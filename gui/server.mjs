import { createServer } from 'http'
import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync, unlinkSync, readdirSync, statSync } from 'fs'
import { parse, stringify } from 'querystring'
import { execFile } from 'child_process'
import yaml from 'js-yaml'
import { chromium } from 'playwright'
import { classifyLiveness } from '../scripts/jobs/liveness-core.mjs'

const PORT = 3001
const PROJECT_ROOT = process.cwd().replace(/\\gui$/, '')

const parseYaml = yaml.load
const stringifyYaml = yaml.dump

mkdirSync(`${PROJECT_ROOT}/data/job-radar`, { recursive: true })
mkdirSync(`${PROJECT_ROOT}/jds`, { recursive: true })
mkdirSync(`${PROJECT_ROOT}/output`, { recursive: true })
mkdirSync(`${PROJECT_ROOT}/reports`, { recursive: true })
mkdirSync(`${PROJECT_ROOT}/interview-prep`, { recursive: true })
mkdirSync(`${PROJECT_ROOT}/batch/tracker-additions`, { recursive: true })
mkdirSync(`${PROJECT_ROOT}/tmp`, { recursive: true })

const COMPANIES_FILE = `${PROJECT_ROOT}/data/job-radar/companies.json`
const DELETED_COMPANIES_FILE = `${PROJECT_ROOT}/data/job-radar/deleted-companies.json`
const JOBS_FILE = `${PROJECT_ROOT}/data/job-radar/jobs.jsonl`
const CANDIDATES_FILE = `${PROJECT_ROOT}/data/job-radar/candidates.jsonl`
const DISCOVERY_RUNS_FILE = `${PROJECT_ROOT}/data/job-radar/discovery-runs.jsonl`
const RESUME_PROFILE_FILE = `${PROJECT_ROOT}/data/job-radar/resume-profile.json`
const PORTALS_FILE = `${PROJECT_ROOT}/portals.yml`

const DEFAULT_RESUME_MODULES = [
  { id: 'summary', name: '求职定位', type: 'builtin', enabled: true },
  { id: 'skills', name: '核心能力', type: 'builtin', enabled: true },
  { id: 'experience', name: '工作经历', type: 'builtin', enabled: true },
  { id: 'projects', name: '项目经历', type: 'builtin', enabled: true },
  { id: 'education', name: '教育背景', type: 'builtin', enabled: true },
  { id: 'gaps', name: '针对岗位的补充准备', type: 'builtin', enabled: true }
]

function normalizeResumeModules(modules) {
  const source = Array.isArray(modules) ? modules : DEFAULT_RESUME_MODULES
  return source.filter(module => module?.id !== 'paper').map(module => ({ ...module }))
}

const BUILTIN_RESUME_DATA_MODULES = new Set(['education', 'experience', 'projects'])

function loadDotEnv() {
  const envPath = `${PROJECT_ROOT}/.env`
  if (!existsSync(envPath)) return
  const lines = readFileSync(envPath, 'utf-8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue
    const index = trimmed.indexOf('=')
    const key = trimmed.slice(0, index).trim()
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, '')
    if (key && process.env[key] === undefined) {
      process.env[key] = value
    }
  }
}

loadDotEnv()

function readEnvFile() {
  const envPath = `${PROJECT_ROOT}/.env`
  if (!existsSync(envPath)) return {}
  const env = {}
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue
    const index = trimmed.indexOf('=')
    const key = trimmed.slice(0, index).trim()
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, '')
    env[key] = value
  }
  return env
}

function writeEnvFile(updates) {
  const envPath = `${PROJECT_ROOT}/.env`
  const existingContent = existsSync(envPath)
    ? readFileSync(envPath, 'utf-8')
    : '# career-ops local environment\n'
  const lines = existingContent.split('\n')
  const remaining = { ...updates }
  const updatedLines = lines.map((line) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) return line
    const index = trimmed.indexOf('=')
    const key = trimmed.slice(0, index).trim()
    if (!(key in remaining)) return line
    const value = remaining[key] ?? ''
    delete remaining[key]
    return `${key}=${value}`
  })

  for (const [key, value] of Object.entries(remaining)) {
    updatedLines.push(`${key}=${value ?? ''}`)
  }

  writeFileSync(envPath, updatedLines.join('\n').replace(/\n*$/, '\n'), 'utf-8')
  for (const [key, value] of Object.entries(updates)) {
    process.env[key] = value ?? ''
  }
}

function maskSecret(value) {
  if (!value) return ''
  if (value.length <= 8) return '********'
  return `${value.slice(0, 4)}********${value.slice(-4)}`
}

function safeSlug(value, fallback = 'item') {
  const slug = String(value || fallback)
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '-')
    .replace(/[\s._]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
  return slug || fallback
}

function getHostname(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

function getBrowserExecutablePath() {
  const candidates = [
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
  ]
  return candidates.find((candidate) => candidate && existsSync(candidate))
}

async function launchBrowser() {
  const executablePath = getBrowserExecutablePath()
  return chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {})
  })
}

const CHINESE_EXPIRED_PATTERNS = [
  /职位已关闭/i,
  /职位\s*已\s*关闭/i,
  /职位已下架/i,
  /职位\s*已\s*下架/i,
  /招聘已结束/i,
  /招聘已截止/i,
  /岗位不存在/i,
  /职位不存在/i,
  /已停止招聘/i,
  /停止招聘/i,
  /投递已截止/i,
  /查看更多优选职位/i,
  /页面不存在/i,
  /404/i
]

const CHINESE_ACTIVE_PATTERNS = [
  /投递职位/i,
  /立即申请/i,
  /申请职位/i,
  /岗位职责/i,
  /任职要求/i,
  /职位描述/i,
  /工作地点/i
]

function findChineseExpiredPattern(text = '') {
  return CHINESE_EXPIRED_PATTERNS.find(pattern => pattern.test(text))
}

function getImportedLiveness(job = {}) {
  const status = firstText(job.liveness_status, job.validation_status, job.validation)
  const evidenceText = [
    job.title,
    job.company,
    job.description,
    job.raw_text,
    job.validation_evidence,
    job.liveness_reason
  ].filter(Boolean).join('\n')
  const expiredPattern = findChineseExpiredPattern(evidenceText)

  if (expiredPattern || /^(closed|expired|dead|invalid)$/i.test(status)) {
    return {
      status: 'closed',
      confidence: 'high',
      reason: expiredPattern ? 'Chinese expired pattern matched' : `Imported validation status: ${status}`
    }
  }

  if (/^(active|valid)$/i.test(status)) {
    return {
      status: 'active',
      confidence: 'high',
      reason: `Imported validation status: ${status}`
    }
  }

  if (/^(probably_valid|unconfirmed|unknown|blocked|needs_browser|unverified_low_priority)$/i.test(status)) {
    return {
      status: 'unconfirmed',
      confidence: 'low',
      reason: `Imported validation status: ${status}`
    }
  }

  return {
    status: 'unconfirmed',
    confidence: 'low',
    reason: 'Imported without liveness validation'
  }
}

const SITE_SHELL_PATTERNS = [
  /boss直聘在线注册登录/i,
  /BOSS直聘直接谈/i,
  /客户服务热线[:：]\s*400\s*065\s*5799/i,
  /找工作\s*BOSS直聘直接谈/i,
  /APP扫码登录/i,
  /验证码登录\/注册/i
]

function isSiteShellExtraction({ title = '', bodyText = '' } = {}) {
  const text = `${title}\n${bodyText}`
  const matchedShellSignals = SITE_SHELL_PATTERNS.filter(pattern => pattern.test(text)).length
  if (matchedShellSignals >= 2) return true
  if (/boss直聘在线注册登录/i.test(title)) return true
  return false
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}

function readJsonl(path) {
  if (!existsSync(path)) return []
  return readFileSync(path, 'utf-8')
    .split('\n')
    .filter(line => line.trim())
    .map(line => JSON.parse(line))
}

function writeJsonl(path, data) {
  writeFileSync(path, data.map(item => JSON.stringify(item)).join('\n') + '\n')
}

function parseKeywordList(value) {
  if (Array.isArray(value)) return value.map(String).map(v => v.trim()).filter(Boolean)
  return String(value || '')
    .split(/[,\n，、]/)
    .map(v => v.trim())
    .filter(Boolean)
}

function uniq(values) {
  return [...new Set(values.filter(Boolean))]
}

function firstText(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

function isWeakJobText(value) {
  const text = String(value || '').trim()
  return !text || text === 'Unknown' || text === '未知公司' || /boss直聘在线注册登录/i.test(text)
}

function inferEnterpriseType(company, explicit = '') {
  const provided = firstText(explicit)
  if (provided) return provided
  const name = String(company || '')
  if (!name) return ''

  const stateOwned = [
    '中国航天', '航天科工', '航天科技', '中航', '中国兵器', '中国中车', '国家电网', '南方电网',
    '中广核', '东方电气', '中国电子', '中国电科', '中科院', '中国船舶', '中船', '中海油',
    '中国移动', '中国电信', '中国联通', '研究院', '研究所'
  ]
  const foreign = [
    '西门子', 'ABB', '施耐德', 'Rockwell', '罗克韦尔', 'Beckhoff', '倍福', 'Bosch', '博世',
    'Honeywell', '霍尼韦尔', 'Emerson', '艾默生', 'Schneider', 'Siemens'
  ]
  if (foreign.some(keyword => name.includes(keyword))) return '外企'
  if (stateOwned.some(keyword => name.includes(keyword))) return '国企/央企'
  if (/(集团|中国|局|院|所)/.test(name)) return '国企/央企'
  if (/(科技|技术|股份|有限|汽车|动力|电子|软件)/.test(name)) return '民营/上市公司'
  return ''
}

function normalizeImportedJob(job = {}) {
  const company = firstText(
    job.company,
    job.enterprise,
    job.company_name,
    job.companyName,
    job.enterprise_name,
    job.enterpriseName,
    job.employer
  )
  const title = firstText(
    job.title,
    job.job_title,
    job.jobTitle,
    job.position_name,
    job.positionName,
    job.position,
    job.role,
    job.name
  )
  const jobLevel = firstText(job.job_level, job.jobLevel, job.level, job.experience)
  const enterpriseType = inferEnterpriseType(company, firstText(job.enterprise_type, job.company_type, job.enterpriseType, job.companyType, job.type))

  return {
    url: firstText(job.url),
    company,
    title,
    location: firstText(job.location, job.city, job.work_location),
    salary: firstText(job.salary, job.compensation, job.pay),
    experience: firstText(job.experience, jobLevel),
    education: firstText(job.education, job.degree),
    publish_date: firstText(job.publish_date, job.publishDate, job.date),
    enterprise_type: enterpriseType,
    job_level: jobLevel,
    source_type: firstText(job.source_type, job.sourceType, job.source),
    source_url: firstText(job.source_url, job.sourceUrl),
    description: firstText(job.description, job.summary, job.snippet),
    raw_text: firstText(job.raw_text, job.rawText),
    validation: firstText(job.validation, job.validation_status, job.validationStatus),
    validation_status: firstText(job.validation_status, job.validationStatus, job.validation),
    validation_evidence: firstText(job.validation_evidence, job.validationEvidence),
    liveness_status: firstText(job.liveness_status, job.livenessStatus),
    liveness_reason: firstText(job.liveness_reason, job.livenessReason),
    direction: firstText(job.direction),
    freshness: firstText(job.freshness),
    freshness_evidence: firstText(job.freshness_evidence, job.freshnessEvidence),
    detected_at: firstText(job.detected_at, job.detectedAt),
    discovered_at: firstText(job.discovered_at, job.discoveredAt),
    tags: Array.isArray(job.tags) ? job.tags : Array.isArray(job.keywords) ? job.keywords : []
  }
}

function buildJobMetadataDescription(job = {}) {
  const tags = Array.isArray(job.tags) ? job.tags.filter(Boolean).join('、') : ''
  return [
    job.title ? `岗位名称：${job.title}` : '',
    job.company ? `公司：${job.company}` : '',
    job.location ? `地点：${job.location}` : '',
    job.salary ? `薪资：${job.salary}` : '',
    job.enterprise_type ? `公司性质：${job.enterprise_type}` : '',
    job.job_level || job.experience ? `岗位性质：${job.job_level || job.experience}` : '',
    tags ? `标签：${tags}` : '',
    job.liveness_reason ? `有效性说明：${job.liveness_reason}` : '',
    job.extraction_error ? `提取说明：${job.extraction_error}` : ''
  ].filter(Boolean).join('\n')
}

function normalizeStoredLiveness(job = {}) {
  if (!job) return job
  const liveness = getImportedLiveness(job)
  if (liveness.status !== 'closed' || job.liveness_status === 'closed') return job
  return {
    ...job,
    liveness_status: 'closed',
    liveness_confidence: liveness.confidence,
    liveness_reason: liveness.reason
  }
}

function normalizeCompany(company, portalsConfig = {}) {
  const positive = portalsConfig?.title_filter?.positive || []
  const negative = portalsConfig?.title_filter?.negative || []
  const careerUrls = company.career_urls || (company.careers_url ? [company.careers_url] : [])
  const homepage = company.official_homepage || company.homepage || careerUrls[0] || ''
  const domains = company.domains?.length
    ? company.domains
    : uniq([...careerUrls, homepage].map(getHostname).filter(Boolean))

  return {
    id: company.id || safeSlug(company.name || domains[0], 'company'),
    name: company.name || company.company || '未命名公司',
    aliases: company.aliases || [],
    industry_tags: company.industry_tags || [],
    official_homepage: homepage,
    career_urls: careerUrls.length ? careerUrls : [homepage].filter(Boolean),
    domains,
    source_type: company.source_type || 'official_search',
    keywords: company.keywords?.length ? company.keywords : positive,
    negative_keywords: company.negative_keywords?.length ? company.negative_keywords : negative,
    locations: company.locations || [],
    enabled: company.enabled !== false,
    notes: company.notes || '',
    created_at: company.created_at || new Date().toISOString()
  }
}

function readPortalsConfig() {
  if (!existsSync(PORTALS_FILE)) return {}
  return parseYaml(readFileSync(PORTALS_FILE, 'utf-8')) || {}
}

function readCompanies() {
  const portalsConfig = readPortalsConfig()
  const deletedCompanies = readDeletedCompanies()
  let companies = []
  if (existsSync(COMPANIES_FILE)) {
    try {
      companies = JSON.parse(readFileSync(COMPANIES_FILE, 'utf-8'))
    } catch {
      companies = []
    }
  }

  if (companies.length === 0) {
    companies = getDefaultCompanies()
  }

  const trackedCompanies = (portalsConfig.tracked_companies || [])
    .map((company) => normalizeCompany(company, portalsConfig))
    .filter((company) => !isDeletedCompany(company, deletedCompanies))
  const byId = new Map(
    companies
      .map((company) => normalizeCompany(company, portalsConfig))
      .filter((company) => !isDeletedCompany(company, deletedCompanies))
      .map((company) => [company.id, company])
  )
  for (const company of trackedCompanies) {
    if (!byId.has(company.id)) {
      byId.set(company.id, company)
    }
  }
  const normalized = enrichCompaniesFromJobs([...byId.values()])
  writeFileSync(COMPANIES_FILE, JSON.stringify(normalized, null, 2), 'utf-8')
  return normalized
}

function enrichCompaniesFromJobs(companies) {
  const jobs = readJsonl(JOBS_FILE)
  const invalidLocations = new Set(['职位类型', '求职类型', '薪资待遇', '工作经验', '学历要求', '公司行业', '公司规模', '融资阶段'])
  return companies.map(company => {
    const relatedJobs = jobs.filter(job => job.company === company.name)
    if (relatedJobs.length === 0) return company

    const inferredTags = relatedJobs.flatMap(job => [
      job.enterprise_type,
      job.direction,
      ...(Array.isArray(job.tags) ? job.tags : [])
    ]).filter(Boolean)

    const inferredLocations = relatedJobs
      .map(job => String(job.location || '').trim())
      .filter(location => location && !invalidLocations.has(location))

    return {
      ...company,
      industry_tags: uniq([...(company.industry_tags || []), ...inferredTags]).slice(0, 8),
      locations: uniq([...(company.locations || []), ...inferredLocations]).slice(0, 6)
    }
  })
}

function writeCompanies(companies) {
  const deletedCompanies = readDeletedCompanies()
  writeFileSync(
    COMPANIES_FILE,
    JSON.stringify(
      companies
        .map((company) => normalizeCompany(company))
        .filter((company) => !isDeletedCompany(company, deletedCompanies)),
      null,
      2
    ),
    'utf-8'
  )
}

function readTextIfExists(path, maxChars = 12000) {
  if (!existsSync(path)) return ''
  return readFileSync(path, 'utf-8').slice(0, maxChars)
}

function readJsonFile(path, fallback) {
  if (!existsSync(path)) return fallback
  try {
    return JSON.parse(readFileSync(path, 'utf-8'))
  } catch {
    return fallback
  }
}

function writeJsonFile(path, data) {
  writeFileSync(path, JSON.stringify(data, null, 2), 'utf-8')
}

function companyDeleteKeys(companyOrId) {
  if (typeof companyOrId === 'string') {
    return [companyOrId, safeSlug(companyOrId, 'company')]
  }
  const company = companyOrId || {}
  return uniq([
    company.id,
    company.name,
    safeSlug(company.id || company.name, 'company'),
    ...(company.aliases || []),
    ...(company.domains || [])
  ].filter(Boolean).map(String))
}

function readDeletedCompanies() {
  return readJsonFile(DELETED_COMPANIES_FILE, [])
}

function writeDeletedCompanies(keys) {
  writeJsonFile(DELETED_COMPANIES_FILE, uniq(keys))
}

function isDeletedCompany(company, deletedKeys = readDeletedCompanies()) {
  const keySet = new Set(deletedKeys)
  return companyDeleteKeys(company).some((key) => keySet.has(key))
}

function rememberDeletedCompany(company) {
  writeDeletedCompanies([...readDeletedCompanies(), ...companyDeleteKeys(company)])
}

function forgetDeletedCompany(company) {
  const keys = new Set(companyDeleteKeys(company))
  writeDeletedCompanies(readDeletedCompanies().filter((key) => !keys.has(key)))
}

function execFileAsync(file, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(file, args, options, (error, stdout, stderr) => {
      if (error) {
        error.stdout = stdout
        error.stderr = stderr
        reject(error)
      } else {
        resolve({ stdout, stderr })
      }
    })
  })
}

function getAiProviderConfig(provider) {
  const normalized = provider || process.env.AI_EVAL_PROVIDER || 'deepseek'
  if (normalized === 'deepseek') {
    return {
      id: 'deepseek',
      label: 'DeepSeek',
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseUrl: (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, ''),
      model: process.env.DEEPSEEK_MODEL || 'deepseek-v4-pro'
    }
  }
  if (normalized === 'doubao' || normalized === 'ark') {
    return {
      id: 'doubao',
      label: '豆包/火山方舟',
      apiKey: process.env.ARK_API_KEY || process.env.DOUBAO_API_KEY,
      baseUrl: (process.env.ARK_BASE_URL || process.env.DOUBAO_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3').replace(/\/$/, ''),
      model: process.env.ARK_MODEL || process.env.DOUBAO_MODEL || 'doubao-seed-1-6-251015'
    }
  }
  throw new Error(`Unsupported AI provider: ${provider}`)
}

function getAvailableAiProviders() {
  const providers = ['deepseek', 'doubao'].map((id) => {
    const config = getAiProviderConfig(id)
    return {
      id: config.id,
      label: config.label,
      model: config.model,
      configured: Boolean(config.apiKey),
      baseUrl: config.baseUrl
    }
  })
  return providers
}

function getAiSettings() {
  const env = readEnvFile()
  return {
    deepseek: {
      configured: Boolean(process.env.DEEPSEEK_API_KEY),
      apiKeyMasked: maskSecret(process.env.DEEPSEEK_API_KEY || ''),
      baseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
      model: process.env.DEEPSEEK_MODEL || 'deepseek-v4-pro'
    },
    doubao: {
      configured: Boolean(process.env.ARK_API_KEY || process.env.DOUBAO_API_KEY),
      apiKeyMasked: maskSecret(process.env.ARK_API_KEY || process.env.DOUBAO_API_KEY || ''),
      baseUrl: process.env.ARK_BASE_URL || env.DOUBAO_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3',
      model: process.env.ARK_MODEL || env.DOUBAO_MODEL || 'doubao-seed-1-6-251015'
    }
  }
}

function saveAiSettings(settings) {
  const updates = {}
  if (settings.deepseek) {
    if ('apiKey' in settings.deepseek && settings.deepseek.apiKey) updates.DEEPSEEK_API_KEY = settings.deepseek.apiKey.trim()
    if ('baseUrl' in settings.deepseek) updates.DEEPSEEK_BASE_URL = (settings.deepseek.baseUrl || 'https://api.deepseek.com').trim()
    if ('model' in settings.deepseek) updates.DEEPSEEK_MODEL = (settings.deepseek.model || 'deepseek-v4-pro').trim()
  }
  if (settings.doubao) {
    if ('apiKey' in settings.doubao && settings.doubao.apiKey) updates.ARK_API_KEY = settings.doubao.apiKey.trim()
    if ('baseUrl' in settings.doubao) updates.ARK_BASE_URL = (settings.doubao.baseUrl || 'https://ark.cn-beijing.volces.com/api/v3').trim()
    if ('model' in settings.doubao) updates.ARK_MODEL = (settings.doubao.model || 'doubao-seed-1-6-251015').trim()
  }
  writeEnvFile(updates)
  return getAiSettings()
}

function buildCandidateResumeContext() {
  const cv = readTextIfExists(`${PROJECT_ROOT}/cv.md`, 16000).trim()
  if (cv) return cv

  const profile = getResumeProfile()
  const lines = []
  if (profile.full_name) lines.push(`姓名：${profile.full_name}`)
  if (profile.target_role) lines.push(`目标岗位：${profile.target_role}`)
  if (profile.summary) lines.push(`求职定位：${profile.summary}`)
  if (profile.skills) lines.push(`核心能力：${profile.skills}`)

  if (Array.isArray(profile.education) && profile.education.length) {
    lines.push('\n教育背景：')
    for (const item of profile.education) {
      lines.push(`- ${[item.school, item.degree, item.major].filter(Boolean).join(' / ')} ${[item.start_date, item.end_date].filter(Boolean).join(' 至 ')}`)
      if (item.gpa) lines.push(`  GPA/成绩：${item.gpa}`)
      if (item.description) lines.push(`  课程/说明：${item.description}`)
    }
  }

  if (Array.isArray(profile.experience) && profile.experience.length) {
    lines.push('\n工作经历：')
    for (const item of profile.experience) {
      lines.push(`- ${[item.company, item.position].filter(Boolean).join(' / ')} ${[item.start_date, item.end_date || '至今'].filter(Boolean).join(' 至 ')}`)
      if (item.role) lines.push(`  角色：${item.role}`)
      if (item.description) lines.push(`  描述：${item.description}`)
    }
  }

  if (Array.isArray(profile.projects) && profile.projects.length) {
    lines.push('\n项目经历：')
    for (const item of profile.projects) {
      const aiTag = item.ai_generated ? '（AI生成，需面试前核验真实性）' : ''
      lines.push(`- ${item.name || '未命名项目'}${aiTag}`)
      if (item.role) lines.push(`  角色：${item.role}`)
      if (item.start_date || item.end_date) lines.push(`  时间：${[item.start_date, item.end_date || '至今'].filter(Boolean).join(' 至 ')}`)
      if (item.tech_stack) lines.push(`  技术栈：${item.tech_stack}`)
      if (item.description) lines.push(`  描述：${item.description}`)
    }
  }

  return lines.join('\n').trim()
}

function buildEvaluableJobDescription(job = {}) {
  const metadata = buildJobMetadataDescription(job)
  const optimizedText = firstText(job.ai_optimized_jd)
  const rawText = optimizedText ? '' : (isSiteShellExtraction({ title: job.title, bodyText: job.raw_text }) ? '' : firstText(job.raw_text))
  const description = firstText(optimizedText, job.description)
  return uniq([
    metadata,
    description && description !== metadata ? description : '',
    rawText
  ]).join('\n\n')
}

function buildEvaluationPrompt(job) {
  const candidateResume = buildCandidateResumeContext()
  const cv = readTextIfExists(`${PROJECT_ROOT}/cv.md`, 16000)
  const profile = readTextIfExists(`${PROJECT_ROOT}/config/profile.yml`, 8000)
  const profileMode = readTextIfExists(`${PROJECT_ROOT}/modes/_profile.md`, 10000)
  const sharedMode = readTextIfExists(`${PROJECT_ROOT}/modes/_shared.md`, 10000)
  const ofertaMode = readTextIfExists(`${PROJECT_ROOT}/modes/oferta.md`, 10000)
  const proofPoints = readTextIfExists(`${PROJECT_ROOT}/article-digest.md`, 10000)
  const jobDescription = buildEvaluableJobDescription(job)
  const jd = [
    `Company: ${job.company || ''}`,
    `Role: ${job.title || ''}`,
    `Location: ${job.location || ''}`,
    `URL: ${job.url || ''}`,
    `Liveness: ${job.liveness_status || 'unknown'}`,
    '',
    jobDescription
  ].join('\n')

  return `你是 career-ops 的求职评分器。请严格基于候选人材料、岗位 JD 和 career-ops 规则评分，不要编造经历。

必须只返回一个 JSON 对象，不要 Markdown，不要代码块。JSON schema:
{
  "score": 4.2,
  "recommendation": "apply | consider | skip",
  "legitimacy": "High Confidence | Medium Confidence | Low Confidence",
  "summary": "一句话结论",
  "match_highlights": ["..."],
  "gaps": ["..."],
  "resume_strategy": ["..."],
  "interview_focus": ["..."],
  "next_actions": ["..."]
}

评分含义：
- 4.5-5.0 强烈建议投
- 4.0-4.4 建议投
- 3.5-3.9 谨慎考虑
- 低于 3.5 不建议投

注意：
- 根据候选人实际方向和技术栈评估匹配度。
- 如果缺少 JD 关键项，要明确列为 gap。
- 如果岗位只有搜索页/元数据/标签，请做保守粗评，不要直接判定“无法评估”；同时把 legitimacy 降为 Low Confidence 或 Medium Confidence，并在 gap 里说明缺少完整 JD。
- 不要自动投递，只给评估。

## Candidate Resume Context
${candidateResume || '未提供候选人简历信息'}

## Raw cv.md
${cv}

## Profile YAML
${profile}

## User Profile Mode
${profileMode}

## Proof Points
${proofPoints}

## career-ops Shared Rules
${sharedMode}

## career-ops Offer Evaluation Rules
${ofertaMode}

## Job Description
${jd}
`
}

function buildInterviewPrepPrompt(job) {
  const cv = buildCandidateResumeContext().slice(0, 12000)
  const profile = readTextIfExists(`${PROJECT_ROOT}/config/profile.yml`, 6000)
  const profileMode = readTextIfExists(`${PROJECT_ROOT}/modes/_profile.md`, 6000)
  const proofPoints = readTextIfExists(`${PROJECT_ROOT}/article-digest.md`, 8000)
  const resumeProfile = getResumeProfile()
  const domain = inferJobDomain(job, resumeProfile)
  const seniority = inferSeniority(job)
  const optimizedJd = buildEvaluableJobDescription(job)
  const jdQuality = [
    job.ai_jd_confidence && `AI清洗置信度: ${job.ai_jd_confidence}`,
    Array.isArray(job.ai_jd_warnings) && job.ai_jd_warnings.length ? `AI清洗风险: ${job.ai_jd_warnings.join('；')}` : '',
    job.ai_jd_liveness_status && `岗位状态判断: ${job.ai_jd_liveness_status}`,
    Array.isArray(job.ai_jd_source_notes) && job.ai_jd_source_notes.length ? `清洗依据: ${job.ai_jd_source_notes.join('；')}` : ''
  ].filter(Boolean).join('\n')

  // 读取简历构建器中的项目数据（含 AI 生成标记）
  let resumeProjectsContext = ''
  try {
    const projects = Array.isArray(resumeProfile.projects) ? resumeProfile.projects : []
    if (projects.length > 0) {
      const projectLines = projects.map((p, i) => {
        const aiTag = p.ai_generated ? '【AI生成-针对' + (p.ai_target_job || '目标岗位') + '】' : '【用户自填】'
        const desc = (p.description || '').split('\n').filter(l => l.trim()).join('；')
        const meta = [
          p.ai_domain && `领域: ${p.ai_domain}`,
          p.ai_project_type && `项目类型: ${p.ai_project_type}`,
          p.ai_truth_level && `事实层级: ${p.ai_truth_level}`,
          p.ai_generation_reason && `生成依据: ${p.ai_generation_reason}`,
          Array.isArray(p.ai_risk_notes) && p.ai_risk_notes.length ? `风险提示: ${p.ai_risk_notes.join('；')}` : ''
        ].filter(Boolean).join(' | ')
        return `${i + 1}. ${p.name} ${aiTag}\n   角色: ${p.role || '个人项目'} | 时间: ${p.start_date || '?'} 至 ${p.end_date || '至今'} | 技术栈: ${p.tech_stack || '无'}\n   ${meta ? `${meta}\n   ` : ''}描述: ${desc}`
      })
      resumeProjectsContext = `
## 候选人简历项目（来自简历构建器，含AI生成标记）
以下是候选人在简历构建器中管理的项目数据。标记为【AI生成】的项目是针对特定岗位由AI生成并写入简历的，这些项目在面试中可能需要特别准备讲述逻辑。
${projectLines.join('\n')}

重要：标记为【AI生成】的项目是简历中出现的但非候选人真实经历的项目，面试准备中必须为这些项目提供详细的讲述框架、技术深挖准备和风险规避建议。
`
    }
  } catch (_) { /* ignore */ }

  // 读取已有评估报告作为补充输入
  let evaluationContext = ''
  if (job.score) {
    evaluationContext = `
## 已有岗位评估结果
- 综合评分: ${job.score || 'N/A'}/5
- 建议: ${job.recommendation || 'N/A'}
- 合法性判断: ${job.legitimacy || 'N/A'}
- 匹配亮点: ${(Array.isArray(job.match_highlights) ? job.match_highlights.join('; ') : '') || '无'}
- 差距分析: ${(Array.isArray(job.gaps) ? job.gaps.join('; ') : '') || '无'}
- 简历策略: ${(Array.isArray(job.resume_strategy) ? job.resume_strategy.join('; ') : '') || '无'}
- 面试重点: ${(Array.isArray(job.interview_focus) ? job.interview_focus.join('; ') : '') || '无'}
`
  }

  const jd = [
    `**公司**: ${job.company || '未知'}`,
    `**岗位**: ${job.title || '未知'}`,
    `**地点**: ${job.location || '未知'}`,
    `**来源**: ${job.url || '未知'}`,
    jdQuality ? `**JD清洗质量**:\n${jdQuality}` : '',
    `**用于面试准备的JD**:\n${String(optimizedJd || '无原始描述').slice(0, 10000)}`
  ].join('\n')

  return `你是一位资深的求职面试辅导专家。请基于候选人简历、目标岗位JD和已有评估报告，生成一份高质量、可直接用于复习的面试准备材料。

必须严格只返回一个JSON对象，不要Markdown代码块，不要多余文字。JSON schema如下：
{
  "match_score": 85,
  "match_level": "高度匹配|较为匹配|基本匹配|匹配度较低",
  "job_analysis": "对目标岗位的深度分析，包括核心职责、技术栈要求、业务背景等（300字以上）",
  "question_plan": {
    "domain": "${domain.primary}",
    "minimum_total_questions": 23,
    "technical_count": 12,
    "project_deep_dive_count": 6,
    "behavioral_count": 5,
    "reason": "为什么这样分配问题"
  },
  "strengths": [
    {"area": "优势领域", "detail": "具体优势说明，结合候选人实际经历", "evidence": "简历中的证据支撑"}
  ],
  "weaknesses": [
    {"gap": "差距点", "severity": "高|中|低", "improvement": "具体弥补建议"}
  ],
  "must_talk_projects": [
    {"project": "项目名称建议", "reason": "为什么这个项目必讲", "key_points": ["要点1", "要点2"]}
  ],
  "company_interview_profile": {
    "likely_interview_style": "该公司/岗位可能的面试风格，必须说明是来自JD证据还是行业推断",
    "company_specific_focus": ["结合公司、岗位、业务场景推断的重点1"],
    "jd_evidence": ["来自JD或AI清洗JD的直接证据"],
    "inference_boundary": "哪些内容只是基于公司名称、行业和岗位的保守推断"
  },
  "ai_project_explainers": [
    {
      "project": "AI生成或gap_bridging项目名",
      "truth_level": "adapted|gap_bridging|inferred",
      "one_minute_pitch": "一分钟讲法",
      "three_minute_pitch": "三分钟讲法",
      "architecture_to_draw": ["模块1", "模块2", "数据流"],
      "core_technical_points": ["技术点1", "技术点2"],
      "implementation_steps": ["怎么做"],
      "likely_followups": [
        {"question": "追问", "answer": "建议回答", "risk": "不能乱说什么"}
      ],
      "must_review_before_interview": ["需要补学内容"]
    }
  ],
  "technical_questions": [
    {"question": "技术问题", "category": "分类(按岗位技术栈分类)", "difficulty": "基础|中级|高级", "domain": "${domain.primary}", "why_it_matters": "为什么岗位会问", "suggested_answer": "建议回答，包含原理/做法/项目连接/风险边界，120-180字", "candidate_bridge": "如何连接到候选人项目", "tips": "加分技巧"}
  ],
  "project_deep_dive_questions": [
    {"project": "项目名", "question": "项目追问", "expected_depth": "面试官希望听到什么", "suggested_answer": "建议回答", "danger_zone": "不要这样回答"}
  ],
  "behavioral_questions": [
    {"question": "行为问题", "type": "挑战性|团队协作|学习能力|抗压能力|职业规划等", "suggested_answer": "建议用STAR法则回答的框架，120-180字", "star_framework": "具体的Situation/Task/Action/Result提示"}
  ],
  "company_research": {
    "overview": "公司简介和核心业务（200字以上）",
    "industry_position": "行业地位和竞争优势",
    "tech_stack": "公司主要技术栈",
    "culture_keywords": ["文化关键词1", "关键词2"],
    "recent_news": "近期动态或值得关注的信息"
  },
  "prep_suggestions": {
    "before_interview": ["面试前准备事项1", "事项2"],
    "resume_tweaks": ["针对该岗位的简历微调建议"],
    "key_topics_to_review": ["必须复习的知识点"],
    "red_flags_to_avoid": ["需要避免的坑"]
  },
  "questions_for_interviewer": [
    {"question": "反问问题", "rationale": "为什么这个问题能体现你的专业度和诚意"}
  ]
}

输出要求：
1. match_score 为0-100整数，综合评估候选人与岗位的匹配程度
2. strengths 至少4条，每条必须结合候选人简历中的真实经历给出证据支撑，不要泛泛而谈
3. weaknesses 至少2条，每条必须给出可操作的improvement建议
 4. technical_questions 至少12道，必须像该公司该岗位会问的问题，而不是通用题库；每题要绑定 JD 关键词、公司业务场景或候选人项目之一
 5. project_deep_dive_questions 至少6道，围绕简历项目和AI生成项目深挖，必须包含面试官可能追问的实现细节、调试过程、指标来源和诚实边界
 6. behavioral_questions 至少5道，覆盖项目挑战、团队协作、技术选型、错误处理、职业规划
 7. technical_questions + project_deep_dive_questions + behavioral_questions 总数必须不少于23，questions_for_interviewer不计入最低23
8. 当前岗位识别领域为 ${domain.label} (${domain.primary})，识别信号：${domain.signals.join('、') || '无'}，层级：${seniority}
9. 按领域路线出题：嵌入式覆盖C语言/外设/RTOS/协议/Bootloader/低功耗/调试/可靠性；PLC覆盖梯形图/HMI/现场总线/伺服/联锁/现场调试；硬件覆盖电源/PCB/EMC/仪器；前端/后端/运维/EDA/CAD按各自工程路线出题，不要串领域
10. 对 AI 生成或 gap_bridging 项目，必须生成 ai_project_explainers，包括讲述稿、架构解释、追问、风险提示、补学清单和诚实表达边界
 11. 可以使用你对该公司、行业和岗位面试的通用知识来增强公司针对性；但没有明确证据时必须写成"基于JD/行业推断"，不要编造融资、客户、营收、新闻或真实面试题来源
 12. suggested_answer 要结合候选人实际经历来写，不要写模板化空话；每道技术题建议回答必须包含"原理/做法/项目连接/风险边界"，但保持简洁
 13. company_interview_profile 必须指出该公司该岗位最可能关注的3-6个面试重点，并列出来自JD的证据
 14. 如果简历信息不完整导致某些分析无法深入，在对应字段标注"[需补充简历信息]"
 15. 不得把推断内容写成真实来源；不得鼓励候选人谎称生产上线、客户、量产、论文、竞赛、奖项
${resumeProjectsContext}
## 候选人简历 (CV)
${cv}

## 候选人个人档案 (Profile)
${profile}

## 用户画像模式
${profileMode}

## 证据点 / 文章摘要
${proofPoints}
${evaluationContext}
## 目标岗位职位描述 (JD)
${jd}`
}

function extractJsonObject(text) {
  const parsed = extractJsonValue(text)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('AI response did not contain a JSON object')
  }
  return parsed
}

function extractJsonValue(text) {
  const trimmed = String(text || '').trim()
  if (!trimmed) throw new Error('AI response is empty')
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced ? fenced[1].trim() : trimmed
  try {
    return JSON.parse(candidate)
  } catch {
    const start = candidate.indexOf('{')
    const end = candidate.lastIndexOf('}')
    if (start >= 0 && end > start) {
      return JSON.parse(candidate.slice(start, end + 1))
    }
    throw new Error('AI response did not contain valid JSON')
  }
}

function normalizeEvaluationResult(result) {
  const score = Number(result.score)
  const normalizedScore = Number.isFinite(score) ? Math.max(0, Math.min(5, Math.round(score * 10) / 10)) : null
  return {
    score: normalizedScore,
    recommendation: ['apply', 'consider', 'skip'].includes(result.recommendation) ? result.recommendation : 'consider',
    legitimacy: result.legitimacy || 'Medium Confidence',
    summary: result.summary || '',
    match_highlights: Array.isArray(result.match_highlights) ? result.match_highlights : [],
    gaps: Array.isArray(result.gaps) ? result.gaps : [],
    resume_strategy: Array.isArray(result.resume_strategy) ? result.resume_strategy : [],
    interview_focus: Array.isArray(result.interview_focus) ? result.interview_focus : [],
    next_actions: Array.isArray(result.next_actions) ? result.next_actions : []
  }
}

function normalizeInterviewPrepResult(result = {}) {
  const matchScore = Number(result.match_score)
  const objectOrEmpty = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  const arrayOrEmpty = (value) => Array.isArray(value) ? value : []
  const technicalQuestions = arrayOrEmpty(result.technical_questions)
  const projectQuestions = arrayOrEmpty(result.project_deep_dive_questions)
  const behavioralQuestions = arrayOrEmpty(result.behavioral_questions)

  return {
    ...result,
    match_score: Number.isFinite(matchScore) ? Math.max(0, Math.min(100, Math.round(matchScore))) : 0,
    match_level: result.match_level || '基本匹配',
    job_analysis: result.job_analysis || '',
    question_plan: objectOrEmpty(result.question_plan),
    strengths: arrayOrEmpty(result.strengths),
    weaknesses: arrayOrEmpty(result.weaknesses),
    must_talk_projects: arrayOrEmpty(result.must_talk_projects),
    ai_project_explainers: arrayOrEmpty(result.ai_project_explainers),
    company_interview_profile: objectOrEmpty(result.company_interview_profile),
    technical_questions: technicalQuestions,
    project_deep_dive_questions: projectQuestions,
    behavioral_questions: behavioralQuestions,
    company_research: objectOrEmpty(result.company_research),
    prep_suggestions: objectOrEmpty(result.prep_suggestions),
    questions_for_interviewer: arrayOrEmpty(result.questions_for_interviewer),
    total_core_questions: technicalQuestions.length + projectQuestions.length + behavioralQuestions.length
  }
}

async function callChatCompletions(provider, prompt, options = {}) {
  const config = getAiProviderConfig(provider)
  if (!config.apiKey) {
    const keyName = config.id === 'deepseek' ? 'DEEPSEEK_API_KEY' : 'ARK_API_KEY 或 DOUBAO_API_KEY'
    throw new Error(`${config.label} 未配置 API Key，请在 .env 中设置 ${keyName}`)
  }

  const requestBody = {
    model: config.model,
    messages: [
      { role: 'system', content: options.systemPrompt || '你是严格输出 JSON 的求职岗位匹配评分器。' },
      { role: 'user', content: prompt }
    ],
    temperature: options.temperature ?? 0.2
  }
  if (options.maxTokens) {
    requestBody.max_tokens = options.maxTokens
  }

  const controller = new AbortController()
  const timeoutMs = options.timeoutMs || 180000
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody),
    signal: controller.signal
  }).finally(() => clearTimeout(timeout))

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload.error?.message || payload.message || `AI API request failed: ${response.status}`)
  }

  const content = payload.choices?.[0]?.message?.content
  if (!content) throw new Error('AI API response missing choices[0].message.content')
  return {
    provider: config.id,
    provider_label: config.label,
    model: config.model,
    content
  }
}

function compactAiList(value, max = 12) {
  if (!Array.isArray(value)) return []
  return value
    .map(item => String(item || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .filter(item => !/^(无|暂无|n\/a|null|undefined)$/i.test(item))
    .slice(0, max)
}

function buildOptimizedJdText(result = {}) {
  const lines = []
  if (result.summary) lines.push(`岗位概述：${result.summary}`)
  if (result.responsibilities?.length) {
    lines.push('岗位职责：')
    result.responsibilities.forEach((item, index) => lines.push(`${index + 1}. ${item}`))
  }
  if (result.requirements?.length) {
    lines.push('任职要求：')
    result.requirements.forEach((item, index) => lines.push(`${index + 1}. ${item}`))
  }
  if (result.highlights?.length) {
    lines.push('加分项：')
    result.highlights.forEach((item, index) => lines.push(`${index + 1}. ${item}`))
  }
  if (result.keywords?.length) lines.push(`关键词：${result.keywords.join('、')}`)
  return lines.join('\n').trim()
}

function normalizeJobOptimization(result = {}) {
  const confidence = ['high', 'medium', 'low'].includes(result.confidence) ? result.confidence : 'low'
  const normalized = {
    company: String(result.company || '').trim(),
    title: String(result.title || '').trim(),
    location: String(result.location || '').trim(),
    salary: String(result.salary || '').trim(),
    experience: String(result.experience || '').trim(),
    education: String(result.education || '').trim(),
    summary: String(result.summary || '').trim(),
    responsibilities: compactAiList(result.responsibilities, 12),
    requirements: compactAiList(result.requirements, 12),
    highlights: compactAiList(result.highlights, 8),
    keywords: compactAiList(result.keywords, 16),
    confidence,
    source_notes: compactAiList(result.source_notes, 6),
    warnings: compactAiList(result.warnings, 8),
    liveness_status: ['active', 'closed', 'unconfirmed'].includes(result.liveness_status) ? result.liveness_status : 'unconfirmed'
  }
  normalized.ai_optimized_jd = buildOptimizedJdText(normalized)
  return normalized
}

async function optimizeJobWithAi(job, provider = 'deepseek') {
  const sourceText = [
    job.url ? `URL: ${job.url}` : '',
    job.company ? `当前公司字段: ${job.company}` : '',
    job.title ? `当前岗位字段: ${job.title}` : '',
    job.location ? `当前地点字段: ${job.location}` : '',
    job.salary ? `当前薪资字段: ${job.salary}` : '',
    job.experience ? `当前经验字段: ${job.experience}` : '',
    job.education ? `当前学历字段: ${job.education}` : '',
    job.description ? `当前描述字段:\n${job.description}` : '',
    job.raw_text ? `原始抓取/用户粘贴文本:\n${String(job.raw_text).slice(0, 9000)}` : ''
  ].filter(Boolean).join('\n\n')

  if (!sourceText.trim()) throw new Error('岗位缺少可优化的 URL/JD 内容')

  const prompt = `你是招聘 JD 清洗与结构化专家。请从用户导入的 URL/JD 抓取文本中找出真正的目标岗位信息，清洗后用于后续岗位评分和简历生成。

要求：
1. 只能使用输入文本中出现的信息，不得编造公司业务、岗位职责、任职要求、客户、薪资、地点、学历或经验。
2. 原始文本可能包含导航、登录注册、相似职位、热门职位、页脚、广告、职位已失效提示。请优先识别与当前 URL/公司/岗位字段一致的目标岗位，忽略不相关岗位。
3. 如果只有相似职位或站点壳，没有可靠目标岗位正文，confidence 必须为 low，并在 warnings 说明。
4. 如果文本同时出现"职位已失效/已下线"和完整 JD，仍可提取 JD，但 liveness_status 标为 closed，warnings 说明"岗位可能已失效"。
5. description_clean 要适合直接作为评分和简历生成依据，去除招聘站导航、页脚、登录、相似职位和无关公司内容。
6. 输出严格 JSON，不要 Markdown，不要 JSON 之外的文字。

JSON schema:
{
  "company": "公司名",
  "title": "岗位名",
  "location": "工作地点",
  "salary": "薪资",
  "experience": "经验要求",
  "education": "学历要求",
  "summary": "一句话岗位概述",
  "responsibilities": ["职责1"],
  "requirements": ["要求1"],
  "highlights": ["加分项或福利/标签"],
  "keywords": ["关键词"],
  "confidence": "high|medium|low",
  "liveness_status": "active|closed|unconfirmed",
  "source_notes": ["你根据哪些文本信号判断"],
  "warnings": ["风险提示"]
}

输入：
${sourceText}`

  const response = await callChatCompletions(provider, prompt, {
    temperature: 0.1,
    systemPrompt: '你是严格输出 JSON 对象的招聘 JD 清洗专家。不要输出 Markdown，不要输出 JSON 之外的文字。'
  })
  return {
    ...normalizeJobOptimization(extractJsonObject(response.content)),
    provider: response.provider,
    provider_label: response.provider_label,
    model: response.model
  }
}

function applyJobOptimization(job, optimization = {}) {
  if (!optimization.ai_optimized_jd) return job
  const canTrust = optimization.confidence === 'high' || optimization.confidence === 'medium'
  if (canTrust) {
    for (const field of ['company', 'title', 'location', 'salary', 'experience', 'education']) {
      if (optimization[field]) job[field] = optimization[field]
    }
    job.description = optimization.ai_optimized_jd
  }
  job.ai_optimized_jd = optimization.ai_optimized_jd
  job.ai_jd_confidence = optimization.confidence
  job.ai_jd_warnings = optimization.warnings
  job.ai_jd_source_notes = optimization.source_notes
  job.ai_jd_liveness_status = optimization.liveness_status
  job.ai_jd_keywords = optimization.keywords
  job.ai_jd_provider = optimization.provider
  job.ai_jd_model = optimization.model
  job.ai_optimized_at = new Date().toISOString()
  return job
}

async function maybeOptimizeJobWithAi(job, provider = 'deepseek') {
  try {
    const optimization = await optimizeJobWithAi(job, provider)
    applyJobOptimization(job, optimization)
    return optimization
  } catch (error) {
    job.ai_jd_optimization_error = error.message
    job.ai_optimized_at = new Date().toISOString()
    return null
  }
}

async function evaluateJobWithAi(job, provider) {
  const prompt = buildEvaluationPrompt(job)
  const response = await callChatCompletions(provider, prompt)
  const parsed = extractJsonObject(response.content)
  const evaluation = normalizeEvaluationResult(parsed)
  return {
    ...evaluation,
    provider: response.provider,
    provider_label: response.provider_label,
    model: response.model,
    evaluated_at: new Date().toISOString()
  }
}

async function generateInterviewPrepWithAi(job, provider) {
  const config = getAiProviderConfig(provider)
  const parsed = await generateInterviewPrepSegmented(job, provider)

  // 生成 Markdown 报告文件
  const slug = `${safeSlug(job.company, 'unknown')}-${safeSlug(job.title, 'job')}`
  const date = new Date().toISOString().split('T')[0]
  const mdContent = buildInterviewPrepMarkdown(parsed, job.company, job.title, date)
  const mdPath = `${PROJECT_ROOT}/interview-prep/${slug}.md`
  writeFileSync(mdPath, mdContent, 'utf-8')

  const resultData = {
    ...parsed,
    path: `interview-prep/${slug}.md`,
    markdown: mdContent,
    provider: config.id,
    provider_label: config.label,
    model: config.model,
    generated_at: new Date().toISOString()
  }
  writeFileSync(mdPath.replace('.md', '.json'), JSON.stringify(resultData, null, 2), 'utf-8')

  return resultData
}

function buildInterviewPrepSharedContext(job) {
  const resumeProfile = getResumeProfile()
  const evidence = buildEvidenceInventory(resumeProfile, job)
  const domain = inferJobDomain(job, resumeProfile)
  const seniority = inferSeniority(job)
  const projects = evidence.projects.map((p, i) => {
    const aiTag = p.ai_generated ? `AI生成:${p.ai_target_job || ''}` : '用户项目'
    return `${i + 1}. ${p.name || '未命名项目'} (${aiTag})\n角色:${p.role || '个人项目'} | 时间:${p.start_date || '?'}至${p.end_date || '至今'} | 技术栈:${p.tech_stack || '无'}\n描述:${String(p.description || '').replace(/\s+/g, ' ').slice(0, 800)}`
  }).join('\n')
  const jdQuality = [
    job.ai_jd_confidence && `AI清洗置信度:${job.ai_jd_confidence}`,
    Array.isArray(job.ai_jd_warnings) && job.ai_jd_warnings.length ? `JD风险:${job.ai_jd_warnings.join('；')}` : '',
    job.ai_jd_liveness_status && `岗位状态:${job.ai_jd_liveness_status}`
  ].filter(Boolean).join('\n')
  return {
    domain,
    seniority,
    text: [
      `公司:${job.company || '未知'}`,
      `岗位:${job.title || '未知'}`,
      `地点:${job.location || '未知'}`,
      `URL:${job.url || '未知'}`,
      jdQuality,
      `岗位领域:${domain.label}(${domain.primary}); 层级:${seniority}; 信号:${domain.signals.join('、') || '无'}`,
      `用于准备的JD:\n${String(buildEvaluableJobDescription(job) || '').slice(0, 5200)}`,
      `候选人简历:\n${buildCandidateResumeContext().slice(0, 5200)}`,
      `候选人项目:\n${projects || '无'}`
    ].filter(Boolean).join('\n\n')
  }
}

async function callInterviewPrepPart(provider, prompt, maxTokens = 4500) {
  const response = await callChatCompletions(provider, prompt, {
    maxTokens,
    temperature: 0.25,
    timeoutMs: 120000,
    systemPrompt: '你是严格输出 JSON 对象的中文面试辅导专家。不要输出 Markdown，不要输出 JSON 之外的文字。'
  })
  try {
    return extractJsonObject(response.content)
  } catch (error) {
    const retry = await callChatCompletions(provider, `${prompt}

上一次输出不是合法 JSON。请重新输出，必须满足：
1. 只输出一个合法 JSON 对象。
2. 不要 Markdown，不要代码块。
3. 所有回答压缩到80-130字，不要在字符串里使用未转义换行。
4. 数组数量仍按要求生成。`, {
      maxTokens,
      temperature: 0.15,
      timeoutMs: 120000,
      systemPrompt: '你是严格输出合法 JSON 对象的中文面试辅导专家。不要输出 Markdown，不要输出 JSON 之外的文字。'
    })
    return extractJsonObject(retry.content)
  }
}

async function generateInterviewPrepSegmented(job, provider) {
  const context = buildInterviewPrepSharedContext(job)
  const basePrompt = `请基于以下资料生成面试准备的总览部分，必须贴合该公司和该岗位；没有证据的公司信息必须标注为"基于JD/行业推断"。

只返回JSON:
{
  "match_score": 80,
  "match_level": "高度匹配|较为匹配|基本匹配|匹配度较低",
  "job_analysis": "250-400字，分析岗位职责、技术栈、业务场景和面试关注点",
  "question_plan": {"domain":"${context.domain.primary}","minimum_total_questions":23,"technical_count":12,"project_deep_dive_count":6,"behavioral_count":5,"reason":"规划原因"},
  "company_interview_profile": {"likely_interview_style":"面试风格","company_specific_focus":["重点1"],"jd_evidence":["JD证据1"],"inference_boundary":"推断边界"},
  "strengths": [{"area":"优势","detail":"结合简历的具体说明","evidence":"证据"}],
  "weaknesses": [{"gap":"短板","severity":"高|中|低","improvement":"改进建议"}],
  "must_talk_projects": [{"project":"项目名","reason":"为什么必讲","key_points":["要点"]}],
  "company_research": {"overview":"公司/岗位相关背景，证据不足要说明推断","industry_position":"行业位置","tech_stack":"可能技术栈","culture_keywords":["关键词"],"recent_news":"没有证据则写基于JD无法确认"},
  "prep_suggestions": {"before_interview":["准备事项"],"resume_tweaks":["简历微调"],"key_topics_to_review":["复习点"],"red_flags_to_avoid":["避坑"]},
  "questions_for_interviewer": [{"question":"反问问题","rationale":"专业理由"}]
}

资料:
${context.text}`

  const techPrompt = `请生成该公司该岗位最可能问的技术面试题。题目必须贴合JD关键词、公司业务场景或候选人项目，避免通用题库。

只返回JSON:
{
  "technical_questions": [
    {"question":"问题","category":"分类","difficulty":"基础|中级|高级","domain":"${context.domain.primary}","why_it_matters":"为什么该岗位会问","suggested_answer":"120-180字，包含原理/做法/项目连接/风险边界","candidate_bridge":"如何连接候选人项目","tips":"加分技巧"}
  ]
}

要求: technical_questions 恰好12道，覆盖基础、现场调试、工程问题和岗位高频追问。

资料:
${context.text}`

  const projectPrompt = `请生成项目深挖题、行为题和AI/补足项目讲法。必须帮助候选人诚实准备，不能鼓励谎称生产上线、客户、量产、论文、竞赛或奖项。

只返回JSON:
{
  "ai_project_explainers": [
    {"project":"项目名","truth_level":"adapted|gap_bridging|inferred","one_minute_pitch":"一分钟讲法","three_minute_pitch":"三分钟讲法","architecture_to_draw":["模块"],"core_technical_points":["技术点"],"implementation_steps":["步骤"],"likely_followups":[{"question":"追问","answer":"回答","risk":"风险"}],"must_review_before_interview":["补学内容"]}
  ],
  "project_deep_dive_questions": [
    {"project":"项目名","question":"项目追问","expected_depth":"期望深度","suggested_answer":"建议回答","danger_zone":"不要这样回答"}
  ],
  "behavioral_questions": [
    {"question":"行为问题","type":"类型","suggested_answer":"120-180字STAR回答框架","star_framework":"S/T/A/R提示"}
  ]
}

要求: project_deep_dive_questions 恰好6道，behavioral_questions 恰好5道。

资料:
${context.text}`

  const [base, tech, project] = await Promise.all([
    callInterviewPrepPart(provider, basePrompt, 4200),
    callInterviewPrepPart(provider, techPrompt, 5200),
    callInterviewPrepPart(provider, projectPrompt, 5200)
  ])

  return normalizeInterviewPrepResult({
    ...base,
    technical_questions: Array.isArray(tech.technical_questions) ? tech.technical_questions : [],
    ai_project_explainers: Array.isArray(project.ai_project_explainers) ? project.ai_project_explainers : [],
    project_deep_dive_questions: Array.isArray(project.project_deep_dive_questions) ? project.project_deep_dive_questions : [],
    behavioral_questions: Array.isArray(project.behavioral_questions) ? project.behavioral_questions : []
  })
}

function buildInterviewPrepMarkdown(data, company, title, date) {
  const lines = []
  lines.push(`# ${company} - ${title} 面试准备报告`)
  lines.push(`> 生成时间: ${date} | 匹配度: ${data.match_score || '-'}/100 (${data.match_level || '-'})`)
  lines.push('')

  if (data.company_interview_profile && Object.keys(data.company_interview_profile).length > 0) {
    lines.push('## 公司面试画像')
    lines.push('- 面试风格: ' + (data.company_interview_profile.likely_interview_style || '-'))
    if (Array.isArray(data.company_interview_profile.company_specific_focus) && data.company_interview_profile.company_specific_focus.length > 0) {
      lines.push('- 重点关注:')
      data.company_interview_profile.company_specific_focus.forEach(function(item) { lines.push('  - ' + item) })
    }
    if (Array.isArray(data.company_interview_profile.jd_evidence) && data.company_interview_profile.jd_evidence.length > 0) {
      lines.push('- JD证据:')
      data.company_interview_profile.jd_evidence.forEach(function(item) { lines.push('  - ' + item) })
    }
    lines.push('- 推断边界: ' + (data.company_interview_profile.inference_boundary || '未标注'))
    lines.push('')
  }

  lines.push('## 一、岗位深度分析')
  lines.push(data.job_analysis || '(暂无)')
  lines.push('')

  if (data.question_plan && Object.keys(data.question_plan).length > 0) {
    lines.push('## 问题规划')
    lines.push('- 岗位领域: ' + (data.question_plan.domain || '-'))
    lines.push('- 最低题量: ' + (data.question_plan.minimum_total_questions || 30))
    lines.push('- 技术题: ' + (data.question_plan.technical_count || '-'))
    lines.push('- 项目深挖题: ' + (data.question_plan.project_deep_dive_count || '-'))
    lines.push('- 行为题: ' + (data.question_plan.behavioral_count || '-'))
    lines.push('- 规划原因: ' + (data.question_plan.reason || '-'))
    lines.push('')
  }

  lines.push('## 二、个人优势分析')

  if (Array.isArray(data.strengths) && data.strengths.length > 0) {
    data.strengths.forEach(function(s, i) {
      lines.push(`### 优势${i + 1}: ${s.area}`)
      lines.push(s.detail)
      lines.push('> 证据: ' + (s.evidence || '-'))
      lines.push('')
    })
  } else {
    lines.push('(暂无数据)')
    lines.push('')
  }

  lines.push('## 三、潜在短板与改进')
  if (Array.isArray(data.weaknesses) && data.weaknesses.length > 0) {
    data.weaknesses.forEach(function(w) {
      lines.push('- **' + w.gap + '** [' + (w.severity || '中') + '] -> ' + (w.improvement || '-'))
    })
    lines.push('')
  } else {
    lines.push('(暂无数据)')
    lines.push('')
  }

  lines.push('## 四、必讲项目推荐')
  if (Array.isArray(data.must_talk_projects) && data.must_talk_projects.length > 0) {
    data.must_talk_projects.forEach(function(p) {
      lines.push('### ' + p.project)
      lines.push('- 推荐理由: ' + (p.reason || '-'))
      if (Array.isArray(p.key_points) && p.key_points.length > 0) {
        lines.push('- 关键要点:')
        p.key_points.forEach(function(k) { lines.push('  - ' + k) })
      }
      lines.push('')
    })
  } else {
    lines.push('(暂无数据)')
    lines.push('')
  }

  lines.push('## 五、AI生成项目速成')
  if (Array.isArray(data.ai_project_explainers) && data.ai_project_explainers.length > 0) {
    data.ai_project_explainers.forEach(function(p) {
      lines.push('### ' + (p.project || '未命名项目'))
      lines.push('- 事实层级: ' + (p.truth_level || '-'))
      lines.push('- 一分钟讲法: ' + (p.one_minute_pitch || '-'))
      lines.push('- 三分钟讲法: ' + (p.three_minute_pitch || '-'))
      if (Array.isArray(p.architecture_to_draw) && p.architecture_to_draw.length > 0) {
        lines.push('- 建议画出的架构/数据流: ' + p.architecture_to_draw.join(' / '))
      }
      if (Array.isArray(p.core_technical_points) && p.core_technical_points.length > 0) {
        lines.push('- 核心技术点: ' + p.core_technical_points.join(' / '))
      }
      if (Array.isArray(p.implementation_steps) && p.implementation_steps.length > 0) {
        lines.push('- 实现步骤:')
        p.implementation_steps.forEach(function(step) { lines.push('  - ' + step) })
      }
      if (Array.isArray(p.likely_followups) && p.likely_followups.length > 0) {
        lines.push('- 高频追问:')
        p.likely_followups.forEach(function(f) {
          lines.push('  - 问: ' + (f.question || '-'))
          lines.push('    答: ' + (f.answer || '-'))
          lines.push('    风险: ' + (f.risk || '-'))
        })
      }
      if (Array.isArray(p.must_review_before_interview) && p.must_review_before_interview.length > 0) {
        lines.push('- 面试前必须补学: ' + p.must_review_before_interview.join(' / '))
      }
      lines.push('')
    })
  } else {
    lines.push('(暂无AI生成项目解释)')
    lines.push('')
  }

  lines.push('## 六、技术面试问题（含建议回答）')
  if (Array.isArray(data.technical_questions) && data.technical_questions.length > 0) {
    data.technical_questions.forEach(function(q, i) {
      lines.push('### Q' + (i + 1) + ': ' + q.question)
      lines.push('**分类**: ' + (q.category || '-') + ' | **难度**: ' + (q.difficulty || '-') + ' | **领域**: ' + (q.domain || '-') + ' | **加分技巧**: ' + (q.tips || '-'))
      if (q.why_it_matters) lines.push('**为什么会问**: ' + q.why_it_matters)
      if (q.candidate_bridge) lines.push('**连接到候选人项目**: ' + q.candidate_bridge)
      lines.push('')
      lines.push('**建议回答**:')
      lines.push(q.suggested_answer || '(无)')
      lines.push('')
    })
  } else {
    lines.push('(暂无数据)')
    lines.push('')
  }

  lines.push('## 七、项目深挖问题')
  if (Array.isArray(data.project_deep_dive_questions) && data.project_deep_dive_questions.length > 0) {
    data.project_deep_dive_questions.forEach(function(q, i) {
      lines.push('### Q' + (i + 1) + ': ' + q.question)
      lines.push('**项目**: ' + (q.project || '-'))
      lines.push('**期望深度**: ' + (q.expected_depth || '-'))
      lines.push('')
      lines.push('**建议回答**:')
      lines.push(q.suggested_answer || '(无)')
      lines.push('')
      lines.push('**危险区**: ' + (q.danger_zone || '-'))
      lines.push('')
    })
  } else {
    lines.push('(暂无数据)')
    lines.push('')
  }

  lines.push('## 八、行为面试问题（含STAR回答框架）')
  if (Array.isArray(data.behavioral_questions) && data.behavioral_questions.length > 0) {
    data.behavioral_questions.forEach(function(q, i) {
      lines.push('### Q' + (i + 1) + ': ' + q.question)
      lines.push('**类型**: ' + (q.type || '-'))
      lines.push('**STAR框架提示**: ' + (q.star_framework || '-'))
      lines.push('')
      lines.push('**建议回答**:')
      lines.push(q.suggested_answer || '(无)')
      lines.push('')
    })
  } else {
    lines.push('(暂无数据)')
    lines.push('')
  }

  if (data.company_research) {
    lines.push('## 九、公司背景调研')
    lines.push('### 公司简介')
    lines.push((data.company_research.overview || '-'))
    lines.push('')
    lines.push('### 行业地位')
    lines.push((data.company_research.industry_position || '-'))
    lines.push('')
    lines.push('### 主要技术栈')
    var techStack = Array.isArray(data.company_research.tech_stack)
      ? data.company_research.tech_stack.join(', ')
      : data.company_research.tech_stack
    lines.push(techStack || '-')
    lines.push('')
    lines.push('### 文化关键词')
    var culture = Array.isArray(data.company_research.culture_keywords)
      ? data.company_research.culture_keywords.join(' / ')
      : '-'
    lines.push(culture || '-')
    lines.push('')
    lines.push('### 近期动态')
    lines.push((data.company_research.recent_news || '-'))
    lines.push('')
  }

  if (data.prep_suggestions) {
    lines.push('## 十、面试准备建议')

    function arrToList(arr) { return Array.isArray(arr) && arr.length > 0 ? arr.map(function(s) { return '- ' + s }).join('\n') : '-' }

    lines.push('### 面试前准备')
    lines.push(arrToList(data.prep_suggestions.before_interview))
    lines.push('')
    lines.push('### 简历微调建议')
    lines.push(arrToList(data.prep_suggestions.resume_tweaks))
    lines.push('')
    lines.push('### 必复习知识点')
    lines.push(arrToList(data.prep_suggestions.key_topics_to_review))
    lines.push('')
    lines.push('### 需要避免的坑')
    lines.push(arrToList(data.prep_suggestions.red_flags_to_avoid))
    lines.push('')
  }

  if (Array.isArray(data.questions_for_interviewer) && data.questions_for_interviewer.length > 0) {
    lines.push('')
    lines.push('## 十一、反问面试官推荐问题')
    data.questions_for_interviewer.forEach(function(q, i) {
      lines.push((i + 1) + '. **' + q.question + '** -- ' + (q.rationale || '-'))
    })
    lines.push('')
  }

  lines.push('')
  lines.push('---')
  lines.push('_以上内容由 AI 基于简历和岗位JD智能生成，仅供参考，请结合自身实际情况调整。_')
  lines.push('')
  return lines.join('\n')
}

function getDefaultResumeProfile() {
  return {
    full_name: '',
    gender: '',
    age: '',
    phone: '',
    email: '',
    wechat: '',
    location: '',
    education: '',
    graduation: '',
    target_role: '',
    summary: '',
    photo_path: '',
    modules: normalizeResumeModules(DEFAULT_RESUME_MODULES)
  }
}

function getResumeProfile() {
  const profile = { ...getDefaultResumeProfile(), ...readJsonFile(RESUME_PROFILE_FILE, {}) }
  profile.modules = normalizeResumeModules(profile.modules)
  return profile
}

function saveResumeProfile(profile) {
  const current = getResumeProfile()
  const next = {
    ...current,
    ...profile,
    photo_path: profile.photo_path ?? current.photo_path
  }
  next.modules = normalizeResumeModules(next.modules)
  if (profile.photoData && profile.photoName) {
    const match = String(profile.photoData).match(/^data:(image\/(png|jpeg|jpg));base64,(.+)$/)
    if (!match) throw new Error('照片格式只支持 PNG/JPG')
    const ext = match[2] === 'jpeg' ? 'jpg' : match[2]
    const fileName = `resume-photo.${ext}`
    writeFileSync(`${PROJECT_ROOT}/data/job-radar/${fileName}`, Buffer.from(match[3], 'base64'))
    next.photo_path = `data/job-radar/${fileName}`
  }
  delete next.photoData
  delete next.photoName
  writeFileSync(RESUME_PROFILE_FILE, JSON.stringify(next, null, 2), 'utf-8')
  return next
}

function deleteResumePhoto() {
  const profile = getResumeProfile()
  const photoPath = String(profile.photo_path || '').replace(/\\/g, '/')
  if (photoPath.startsWith('data/job-radar/')) {
    const fullPath = `${PROJECT_ROOT}/${photoPath}`
    if (existsSync(fullPath)) {
      unlinkSync(fullPath)
    }
  }
  const next = {
    ...profile,
    photo_path: ''
  }
  writeFileSync(RESUME_PROFILE_FILE, JSON.stringify(next, null, 2), 'utf-8')
  return next
}

function saveResumeModuleData(moduleId, payload = {}) {
  if (!BUILTIN_RESUME_DATA_MODULES.has(moduleId)) {
    throw new Error('Unsupported resume data module')
  }

  const current = getResumeProfile()
  const next = { ...current }

  if (moduleId === 'education') {
    if (!Array.isArray(payload.education)) throw new Error('education must be an array')
    next.education = payload.education
  } else if (moduleId === 'experience') {
    if (!Array.isArray(payload.experience)) throw new Error('experience must be an array')
    next.experience = payload.experience
  } else if (moduleId === 'projects') {
    if (!Array.isArray(payload.projects)) throw new Error('projects must be an array')
    next.projects = payload.projects
  }

  writeFileSync(RESUME_PROFILE_FILE, JSON.stringify(next, null, 2), 'utf-8')
  return next
}

function getProjectDisplayName(project = {}) {
  const name = String(project.name || '').trim()
  if (name) return name
  const role = String(project.role || '').trim()
  if (role) return role
  const stack = String(project.tech_stack || project.stack || '').trim()
  if (stack) return stack.split(/[、,，|/]/).map(item => item.trim()).filter(Boolean).slice(0, 2).join(' / ')
  return '项目经历'
}

function listFromText(value) {
  if (Array.isArray(value)) return value.map(String).map(v => v.trim()).filter(Boolean)
  return String(value || '')
    .split(/[\n,，、;；|]/)
    .map(v => v.trim())
    .filter(Boolean)
}

function paragraphList(value) {
  return String(value || '')
    .split(/\n+/)
    .map(v => v.trim())
    .filter(Boolean)
}

function normalizeOnboardingPayload(body = {}) {
  const candidate = body.candidate || {}
  const target = body.target || {}
  return {
    candidate: {
      full_name: firstText(candidate.full_name, candidate.name),
      gender: firstText(candidate.gender),
      age: firstText(candidate.age),
      email: firstText(candidate.email),
      phone: firstText(candidate.phone),
      github: firstText(candidate.github),
      wechat: firstText(candidate.wechat),
      portfolio_url: firstText(candidate.portfolio_url),
      summary: firstText(candidate.summary),
      skills: listFromText(candidate.skills),
      education: Array.isArray(candidate.education) ? candidate.education.map(edu => ({
        school: firstText(edu.school),
        degree: firstText(edu.degree),
        major: firstText(edu.major),
        start_date: firstText(edu.start_date),
        end_date: firstText(edu.end_date),
        gpa: firstText(edu.gpa),
        description: firstText(edu.description)
      })) : [],
      experience: Array.isArray(candidate.experience) ? candidate.experience.map(exp => ({
        company: firstText(exp.company),
        position: firstText(exp.position),
        start_date: firstText(exp.start_date),
        end_date: firstText(exp.end_date),
        description: firstText(exp.description),
        role: firstText(exp.role)
      })) : [],
      projects: Array.isArray(candidate.projects) ? candidate.projects.map(proj => ({
        name: firstText(proj.name),
        role: firstText(proj.role),
        start_date: firstText(proj.start_date),
        end_date: firstText(proj.end_date),
        description: firstText(proj.description),
        tech_stack: firstText(proj.tech_stack)
      })) : []
    },
    target: {
      roles: listFromText(target.roles),
      cities: listFromText(target.cities),
      levels: listFromText(target.levels),
      enterprise_types: listFromText(target.enterprise_types),
      positive_keywords: listFromText(target.positive_keywords),
      negative_keywords: listFromText(target.negative_keywords),
      companies: listFromText(target.companies)
    }
  }
}

function renderCvMarkdown({ candidate, target }) {
  const roles = target.roles.length ? target.roles : target.positive_keywords
  const skills = candidate.skills.length ? candidate.skills : target.positive_keywords
  const eduLines = (candidate.education || []).flatMap(edu => {
    const parts = [edu.school, edu.degree, edu.major].filter(Boolean)
    if (edu.start_date || edu.end_date) parts.push(`${edu.start_date || '?'} ~ ${edu.end_date === 'present' ? '至今' : (edu.end_date || '?')}`)
    const line = `- ${parts.join(' | ')}`
    const extra = []
    if (edu.gpa) extra.push(`  - GPA: ${edu.gpa}`)
    if (edu.description) extra.push(`  - ${edu.description}`)
    return extra.length ? [line, ...extra] : [line]
  })
  const expLines = (candidate.experience || []).flatMap(exp => {
    const dateStr = (exp.start_date || '?') + ' ~ ' + (exp.end_date === 'present' ? '至今' : (exp.end_date || '?'))
    const line = `- ${exp.company} | ${exp.position} (${dateStr})`
    const extra = []
    if (exp.role) extra.push(`  - 分工: ${exp.role}`)
    if (exp.description) { exp.description.split('\n').forEach(l => extra.push(`  - ${l}`)) }
    return extra.length ? [line, ...extra] : [line]
  })
  const projLines = (candidate.projects || []).flatMap(proj => {
    const dateStr = (proj.start_date || '?') + ' ~ ' + (proj.end_date === 'present' ? '至今' : (proj.end_date || '?'))
    const techPart = proj.tech_stack ? ` [${proj.tech_stack}]` : ''
    const rolePart = proj.role ? ` (${proj.role})` : ''
    const line = `- **${getProjectDisplayName(proj)}**${rolePart}${techPart} -- ${dateStr}`
    const extra = proj.description ? proj.description.split('\n').map(l => `  - ${l}`) : []
    return [line, ...extra]
  })
  const lines = [
    `# CV -- ${candidate.full_name || 'Candidate'}`,
    '',
    candidate.email ? `**Email:** ${candidate.email}` : '',
    candidate.phone ? `**Phone:** ${candidate.phone}` : '',
    candidate.gender ? `**Gender:** ${candidate.gender}` : '',
    candidate.age ? `**Age:** ${candidate.age}` : '',
    candidate.wechat ? `**WeChat:** ${candidate.wechat}` : '',
    candidate.portfolio_url ? `**Portfolio:** ${candidate.portfolio_url}` : '',
    candidate.github ? `**GitHub:** ${candidate.github}` : '',
    '',
    '## Target Roles',
    ...(roles.length ? roles.map(role => `- ${role}`) : ['- [目标岗位]']),
    '',
    '## Professional Summary',
    '',
    candidate.summary || '[请补充一句话专业简介]',
    '',
    '## Skills',
    '',
    ...(skills.length ? skills.map(skill => `- ${skill}`) : ['- [技能关键词]']),
    '',
    '## Projects',
    '',
    ...(projLines.length ? projLines : ['- [项目名称] -- [项目描述、技术栈和结果]']),
    '',
    '## Work Experience',
    '',
    ...(expLines.length ? expLines : ['- [公司/岗位] -- [职责、成果和时间]']),
    '',
    '## Education',
    '',
    ...(eduLines.length ? eduLines : ['- [学校 / 专业 / 学历 / 时间]']),
    ''
  ]
  return lines.filter(line => line !== '').join('\n') + '\n'
}

function renderProfileYaml({ candidate, target }) {
  return stringifyYaml({
    candidate: {
      full_name: candidate.full_name || '[你的姓名]',
      email: candidate.email || '[你的邮箱]',
      phone: candidate.phone || '[你的电话]',
      gender: candidate.gender || '',
      age: candidate.age || '',
      wechat: candidate.wechat || '',
      portfolio_url: candidate.portfolio_url || '',
      github: candidate.github || ''
    },
    target_roles: {
      primary: target.roles,
      archetypes: target.roles.map(role => ({
        name: role,
        level: target.levels.join(' / ') || '不限',
        fit: 'primary'
      }))
    },
    narrative: {
      headline: target.roles[0] || '[你的职业头衔]',
      exit_story: candidate.summary || '',
      superpowers: candidate.skills.slice(0, 8)
    },
    compensation: {
      target_range: '[期望薪资]',
      currency: 'CNY',
      minimum: '[最低接受薪资]'
    },
    location: {
      country: 'China',
      city: target.cities.join(' / ') || candidate.location || '[你的城市]',
      timezone: 'CST',
      visa_status: '不需要签证'
    }
  }, { lineWidth: 120 })
}

function renderPortalsYaml({ target }) {
  const positives = uniq([...target.positive_keywords, ...target.roles])
  const negatives = target.negative_keywords.length ? target.negative_keywords : ['销售', '客服', '培训', '保险', '中介']
  const cities = target.cities.length ? target.cities : ['全国']
  const levels = target.levels.length ? target.levels : ['不限']
  const direction = positives.slice(0, 6).join(' OR ') || '目标岗位'
  const searchQueries = cities.flatMap(city => [
    {
      name: `BOSS直聘 -- ${city} -- ${positives[0] || '目标岗位'}`,
      query: `site:zhipin.com/web/geek/job "${city}" "${positives[0] || '目标岗位'}"`,
      enabled: true
    },
    {
      name: `猎聘 -- ${city} -- ${positives[0] || '目标岗位'}`,
      query: `site:liepin.com "${city}" "${positives[0] || '目标岗位'}"`,
      enabled: true
    }
  ])
  return stringifyYaml({
    title_filter: {
      positive: positives.length ? positives : ['目标岗位'],
      negative: negatives,
      seniority_boost: levels
    },
    search_queries: searchQueries,
    tracked_companies: target.companies.map(company => ({
      name: company,
      careers_url: '',
      scan_method: 'websearch',
      scan_query: `"${company}" "${direction}" 招聘`,
      enabled: true
    }))
  }, { lineWidth: 120 })
}

function saveOnboardingFiles(body = {}) {
  const data = normalizeOnboardingPayload(body)
  const written = []

  writeFileSync(`${PROJECT_ROOT}/cv.md`, renderCvMarkdown(data), 'utf-8')
  written.push('cv.md')

  writeFileSync(`${PROJECT_ROOT}/config/profile.yml`, renderProfileYaml(data), 'utf-8')
  written.push('config/profile.yml')

  writeFileSync(`${PROJECT_ROOT}/portals.yml`, renderPortalsYaml(data), 'utf-8')
  written.push('portals.yml')

  const profile = getResumeProfile()
  saveResumeProfile({
    ...profile,
    full_name: data.candidate.full_name || profile.full_name,
    gender: data.candidate.gender || profile.gender,
    age: data.candidate.age || profile.age,
    phone: data.candidate.phone || profile.phone,
    email: data.candidate.email || profile.email,
    wechat: data.candidate.wechat || profile.wechat,
    github: data.candidate.github || profile.github,
    portfolio_url: data.candidate.portfolio_url || profile.portfolio_url,
    target_role: data.target.roles.join(' / ') || data.target.positive_keywords.join(' / ') || profile.target_role,
    summary: data.candidate.summary || profile.summary,
    skills: data.candidate.skills.join('、') || profile.skills,
    education: data.candidate.education.length ? data.candidate.education : (profile.education || []),
    experience: data.candidate.experience.length ? data.candidate.experience : (profile.experience || []),
    projects: data.candidate.projects.length ? data.candidate.projects : (profile.projects || [])
  })
  written.push('data/job-radar/resume-profile.json')

  const ONBOARDING_CACHE = `${PROJECT_ROOT}/data/job-radar/onboarding-cache.json`
  writeFileSync(ONBOARDING_CACHE, JSON.stringify({ savedAt: new Date().toISOString(), raw: body }, null, 2), 'utf-8')
  written.push('onboarding-cache.json')

  return { written }
}

function loadOnboardingCache() {
  const ONBOARDING_CACHE = `${PROJECT_ROOT}/data/job-radar/onboarding-cache.json`
  if (!existsSync(ONBOARDING_CACHE)) return null
  try {
    const raw = JSON.parse(readFileSync(ONBOARDING_CACHE, 'utf-8'))
    return raw.raw
  } catch { return null }
}

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function parseRawText(rawText) {
  if (!rawText || typeof rawText !== 'string') return null
  const text = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const result = { responsibilities: [], requirements: [], salary: '', location: '', publish_date: '', highlights: [] }

  // Extract salary patterns - enhanced for various formats
  const salaryPatterns = [
    /(?:薪资|工资|薪酬|月薪|年薪|待遇|薪酬范围|薪资范围)[:：\s]*(\d[\d,.]*[万Kk元]*[-–—~至到]\d[\d,.]*[万Kk元]*)/i,
    /(\d{1,3}[\d,.]*[万Kk])\s*[-–—~至到]\s*(\d{1,3}[\d,.]*[万Kk])/,
    /(\d{1,6})\s*[-–—~至到]\s*(\d{1,6})\s*元/,
    /(\d{1,3})[\s-]*(\d{1,3})\s*[Kk]/,
    /(\d{1,3})\s*[Kk][\s-]*(\d{1,3})\s*[Kk]/,
    /(\d{1,3})\s*[-–—~至到]\s*(\d{1,3})\s*[Kk]/,
    /(\d{1,3}\.\d{1,2})[\s-]*(\d{1,3}\.\d{1,2})\s*万/,
    /(\d{1,3})[\s-]*(\d{1,3})\s*万/,
    /(\d{1,3}\.\d{1,2})\s*[-–—~至到]\s*(\d{1,3}\.\d{1,2})\s*万/
  ]
  for (const pattern of salaryPatterns) {
    const match = text.match(pattern)
    if (match) { 
      let salary = match[0].replace(/^[^0-9]*/, '')
      salary = salary.replace(/\s+/g, '')
                     .replace(/至|到|~|–|—|-/g, '-')
                     .replace(/([0-9])K([0-9])/g, '$1K-$2K')
                     .replace(/([0-9])万([0-9])/g, '$1万-$2万')
      result.salary = salary; 
      break 
    }
  }

  if (!result.salary) {
    const negotiableMatch = text.match(/(面议|薪资面议|待遇面议|薪酬面议)/i)
    if (negotiableMatch) {
      result.salary = '面议'
    }
  }

  // Extract location — specific patterns only, avoid matching random lines with "中国"
  const locationMatch = text.match(/(?:工作地点|地点|城市|Base|工作城市|办公地点)[:：\s]*([^\n,，;；]{2,20})/i)
    || text.match(/(?:地点)[:：\s]*(中国[^\n,，;；]{2,10})/i)
  if (locationMatch) result.location = locationMatch[1].trim().replace(/\s*$/, '')

  // Extract date
  const dateMatch = text.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/)
  if (dateMatch) result.publish_date = `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`

  // Split into sections by common Chinese section headers
  const sectionPattern = /(?:岗位职责|职位描述|岗位描述|工作内容|Job\s*Responsibilities?|工作职责)[:：\s]*/i
  const reqPattern = /(?:任职要求|任职资格|职位要求|岗位要求|招聘要求|资格要求|任职条件|Job\s*(?:Requirements?|Qualifications?))[:：\s]*/i
  const bonusPattern = /(?:加分项|优先条件|优先考虑|Nice\s*to\s*have|Preferred)[:：\s]*/i

  // Section boundaries that reset the current section
  const resetPattern = /^(?:公司介绍|关于我们|团队介绍|联系方式|申请方式|投递方式|简历|备注|注意|福利|公司福利|员工福利|Benefits|薪酬|薪资|补贴|面试|岗位职责|任职要求|岗位描述|职位描述)/i

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)

  let currentSection = null
  let sectionCount = 0
  for (const line of lines) {
    // Stop after capturing one full set of responsibilities + requirements
    if (sectionCount >= 2 && !currentSection) break

    if (sectionPattern.test(line)) { currentSection = 'responsibilities'; sectionCount++; continue }
    if (reqPattern.test(line)) { currentSection = 'requirements'; sectionCount++; continue }
    if (bonusPattern.test(line)) { currentSection = 'bonus'; continue }
    // Reset on other section headers or new job title lines
    if (resetPattern.test(line) || /^((?:高级|资深|初级|实习)?(?:软件|硬件|算法|嵌入式|测试|产品|项目|数据|运维|前端|后端|全栈|架构|安全|DevOps|SRE|QA|IC|射频|通信|数字|模拟).*(?:工程师|开发|经理|总监|专家|专员|分析师|设计师|架构师))/.test(line)) {
      if (currentSection === 'responsibilities' || currentSection === 'requirements') sectionCount++
      currentSection = null
      continue
    }

    const isBullet = /^[•·●○◆▪▸\-–—\d①②③④⑤⑥⑦⑧⑨⑩][、.．)）\s]/.test(line) || /^[（(]\d[)）]/.test(line)

    if (currentSection === 'responsibilities' && isBullet) {
      result.responsibilities.push(line.replace(/^[•·●○◆▪▸\-–—\d][、.．)）\s]*/, '').replace(/^[（(]\d[)）]\s*/, '').trim())
    } else if (currentSection === 'requirements' && isBullet) {
      result.requirements.push(line.replace(/^[•·●○◆▪▸\-–—\d][、.．)）\s]*/, '').replace(/^[（(]\d[)）]\s*/, '').trim())
    } else if (currentSection === 'bonus' && isBullet) {
      result.highlights.push(line.replace(/^[•·●○◆▪▸\-–—\d][、.．)）\s]*/, '').replace(/^[（(]\d[)）]\s*/, '').trim())
    }
  }

  // Fallback: if no structured sections found, try to extract meaningful lines
  if (result.responsibilities.length === 0 && result.requirements.length === 0) {
    let capturing = false
    for (const line of lines) {
      if (/职责|要求|负责|任职|描述/.test(line)) { capturing = true; continue }
      if (capturing && (line.length > 8 && line.length < 200)) {
        const clean = line.replace(/^[•·●○◆▪▸\-–—\d][、.．)）\s]*/, '').trim()
        if (/要求|资格|必须|需要|具备/.test(line)) {
          result.requirements.push(clean)
        } else if (clean.length > 5) {
          result.responsibilities.push(clean)
        }
      }
      if (result.responsibilities.length + result.requirements.length >= 12) break
    }
  }

  const hasData = result.responsibilities.length > 0 || result.requirements.length > 0 || result.salary || result.location || result.publish_date
  return hasData ? result : null
}

function getJobText(job) {
  return `${job.title || ''}\n${job.ai_optimized_jd || ''}\n${job.description || ''}\n${job.raw_text || ''}\n${job.score_reason || ''}`.toLowerCase()
}

const JOB_DOMAIN_RULES = [
  {
    domain: 'plc_automation',
    label: 'PLC/工控自动化',
    keywords: ['plc', '工控', '自动化', 'hmi', 'scada', '伺服', '变频器', 'dcs', '仪控', '现场总线', 'profinet', 'ethercat', 'modbus', 'codesys', '梯形图', '结构化文本', '西门子', '三菱']
  },
  {
    domain: 'embedded_firmware',
    label: '嵌入式软件/固件',
    keywords: ['嵌入式', 'mcu', 'stm32', 'gd32', 'ch32', 'at32', 'risc-v', 'riscv', 'rtos', 'freertos', 'rt-thread', '驱动', 'bsp', 'bootloader', 'ota', 'uart', 'spi', 'i2c', 'can', 'mqtt', '固件', '单片机']
  },
  {
    domain: 'hardware',
    label: '硬件电路',
    keywords: ['硬件', 'pcb', '原理图', '电路', 'emc', 'esd', '电源', 'adc', 'dac', '传感器', '示波器', '万用表', '器件选型', '开关电源']
  },
  {
    domain: 'chip_eda_cad',
    label: '芯片/EDA/CAD/工业软件',
    keywords: ['芯片', 'eda', 'cad', 'cae', 'cam', 'rtl', 'fpga', '验证', '综合', '时序', '版图', '工业软件', '几何建模', '中望', 'caxa', '立创eda', '华大九天']
  },
  {
    domain: 'backend',
    label: '后端开发',
    keywords: ['后端', 'java', 'go', 'golang', 'python', 'node', 'spring', '微服务', '数据库', 'mysql', 'redis', '接口', '服务端', '消息队列']
  },
  {
    domain: 'frontend',
    label: '前端开发',
    keywords: ['前端', 'react', 'vue', 'typescript', 'javascript', '小程序', '可视化', 'echarts', 'canvas', 'vite']
  },
  {
    domain: 'devops_ops',
    label: '运维/DevOps',
    keywords: ['运维', 'devops', 'linux', 'docker', 'kubernetes', 'k8s', 'ci/cd', '监控', 'nginx', '云平台', '容器']
  },
  {
    domain: 'testing_qa',
    label: '测试/质量',
    keywords: ['测试', 'qa', '自动化测试', '可靠性', '测试开发', '性能测试', 'pytest', 'selenium']
  },
  {
    domain: 'ai_algorithm',
    label: 'AI/算法',
    keywords: ['算法', '机器学习', '深度学习', 'ai', '模型', 'pytorch', 'tensorflow', '数据建模', '视觉']
  },
  {
    domain: 'data_analysis',
    label: '数据分析',
    keywords: ['数据分析', 'bi', 'sql', '报表', '指标', '数仓', '数据可视化']
  },
  {
    domain: 'product_ops',
    label: '产品/运营/解决方案',
    keywords: ['产品', '运营', '解决方案', '售前', '技术支持', '客户成功', '需求分析']
  }
]

function getDomainRule(domain) {
  return JOB_DOMAIN_RULES.find(rule => rule.domain === domain) || { domain: 'general', label: '通用岗位', keywords: [] }
}

function inferJobDomain(job = {}, profile = {}) {
  const text = [
    job.title,
    job.company,
    job.direction,
    job.enterprise_type,
    Array.isArray(job.tags) ? job.tags.join(' ') : '',
    job.description,
    job.raw_text,
    profile.target_role
  ].filter(Boolean).join('\n').toLowerCase()

  const scores = JOB_DOMAIN_RULES.map(rule => ({
    domain: rule.domain,
    label: rule.label,
    score: rule.keywords.reduce((sum, keyword) => sum + (text.includes(keyword.toLowerCase()) ? 1 : 0), 0),
    signals: rule.keywords.filter(keyword => text.includes(keyword.toLowerCase())).slice(0, 8)
  })).filter(item => item.score > 0).sort((a, b) => b.score - a.score)

  const primary = scores[0] || { domain: 'general', label: '通用岗位', score: 0, signals: [] }
  return {
    primary: primary.domain,
    label: primary.label,
    confidence: primary.score >= 3 ? 'high' : (primary.score > 0 ? 'medium' : 'low'),
    signals: primary.signals,
    secondary: scores.slice(1, 4).map(item => item.domain)
  }
}

function inferSeniority(job = {}) {
  const text = [job.title, job.job_level, job.experience, job.raw_text, job.description].filter(Boolean).join('\n').toLowerCase()
  if (/实习|intern/.test(text)) return 'intern'
  if (/校招|应届|毕业生|graduate|campus/.test(text)) return 'campus'
  if (/高级|专家|架构|资深|senior|lead|principal/.test(text)) return 'senior'
  if (/中级|3-5|三年以上|5年/.test(text)) return 'mid'
  if (/初级|助理|junior|1-3|一年/.test(text)) return 'junior'
  return 'general'
}

function hasUsefulProject(project = {}) {
  const text = [project.name, project.tech_stack, project.description].filter(Boolean).join('\n')
  return text.trim() && !/\[项目名称\]|\[项目描述|项目一|项目二|相关技术栈|\[技术栈\]/.test(text)
}

function jobTargetKey(job = {}) {
  return `${job.company || ''} - ${job.title || ''}`.trim()
}

function isAiProjectForJob(project = {}, job = {}) {
  if (!project.ai_generated) return false
  const target = String(project.ai_target_job || '').trim()
  const key = jobTargetKey(job)
  return Boolean(target && key && target === key)
}

function buildEvidenceInventory(profile = {}, job = {}) {
  const allProjects = (Array.isArray(profile.projects) ? profile.projects : []).filter(hasUsefulProject)
  const userProjects = allProjects.filter(project => !project.ai_generated)
  const targetAiProjects = allProjects.filter(project => isAiProjectForJob(project, job))
  const projects = [...userProjects, ...targetAiProjects]
  const experience = Array.isArray(profile.experience) ? profile.experience : []
  return {
    projects,
    userProjects,
    targetAiProjects,
    experience,
    skills: parseKeywordList(profile.skills),
    summary: profile.summary || '',
    hasExperience: experience.length > 0,
    hasProjects: projects.length > 0
  }
}

function scoreProjectRelevance(project = {}, domain, jobText = '') {
  const rule = getDomainRule(domain)
  const text = [project.name, project.role, project.tech_stack, project.description].filter(Boolean).join('\n').toLowerCase()
  const domainHits = rule.keywords.filter(keyword => text.includes(keyword.toLowerCase())).length
  const jobKeywords = uniq(String(jobText || '').toLowerCase().match(/[\u4e00-\u9fff]{2,}|[a-z][a-z0-9+#.-]{1,}/g) || [])
    .filter(token => token.length >= 2)
    .slice(0, 40)
  const jobHits = jobKeywords.filter(token => text.includes(token)).length
  return Math.min(10, domainHits * 2 + jobHits)
}

function isWeakJobDescription(job = {}) {
  const description = buildEvaluableJobDescription(job)
  const source = String(job.source_type || '')
  return description.length < 160 || /search|搜索/.test(source) || (!job.description && !job.raw_text)
}

function decideProjectPlan(context = {}) {
  const { job = {}, candidate = {}, inferred = {} } = context
  const projects = candidate.projects || []
  const userProjects = candidate.userProjects || []
  const targetAiProjects = candidate.targetAiProjects || []
  const jobText = getJobText(job)
  const domain = inferred.domain?.primary || 'general'
  const weakJob = isWeakJobDescription(job)
  const relevantProjects = projects
    .map(project => ({ project, score: scoreProjectRelevance(project, domain, jobText) }))
    .sort((a, b) => b.score - a.score)
  const desiredTotal = 3
  const countedExisting = Math.min(desiredTotal, userProjects.length + targetAiProjects.length)
  const needNew = Math.max(0, desiredTotal - countedExisting)

  return {
    target_project_count: desiredTotal,
    weak_job_description: weakJob,
    existing_user_project_count: userProjects.length,
    existing_target_ai_project_count: targetAiProjects.length,
    reuse_existing: relevantProjects.slice(0, Math.max(userProjects.length, 0)).map((item, index) => ({
      project_id: item.project.id || item.project.name || `project_${index + 1}`,
      action: item.score <= 1 ? 'adapt_without_changing_facts' : 'rewrite',
      relevance_score: item.score,
      reason: item.score <= 1 ? '与岗位严重不匹配，只能在不改变事实的前提下调整表达' : '与岗位存在关联，优先岗位化表达'
    })),
    new_projects: Array.from({ length: needNew }, (_, index) => ({
      slot: index + 1,
      purpose: weakJob ? 'conservative_gap_bridging' : 'cover_gap',
      domain,
      business_scenario: '由AI根据岗位JD、公司公开资料/raw_text、候选人能力与已有项目动态规划',
      gap_covered: '由AI提取岗位关键差距，且不同项目不得覆盖同质化差距',
      difficulty: 'candidate_plus_one'
    })),
    do_not_generate: ['论文', '竞赛', '奖项', '证书', '真实公司工作经历', '生产上线', '真实客户', '营收', '专利', '量产数据']
  }
}

function buildResumeGenerationContext(job, profile) {
  const domain = inferJobDomain(job, profile)
  const candidate = buildEvidenceInventory(profile, job)
  const context = {
    job: {
      company: job.company || '',
      title: job.title || '',
      location: job.location || '',
      description: job.ai_optimized_jd || job.description || '',
      raw_text: job.ai_optimized_jd || job.raw_text || '',
      industry_tags: Array.isArray(job.tags) ? job.tags : [],
      enterprise_type: job.enterprise_type || inferEnterpriseType(job.company, job.enterprise_type),
      job_level: job.job_level || job.experience || '',
      source: job.source_type || job.source || '',
      url: job.url || ''
    },
    candidate,
    evaluation: {
      score: job.score || null,
      recommendation: job.recommendation || '',
      match_highlights: Array.isArray(job.match_highlights) ? job.match_highlights : [],
      gaps: Array.isArray(job.gaps) ? job.gaps : [],
      resume_strategy: Array.isArray(job.resume_strategy) ? job.resume_strategy : [],
      interview_focus: Array.isArray(job.interview_focus) ? job.interview_focus : [],
      legitimacy: job.legitimacy || ''
    },
    inferred: {
      domain,
      seniority: inferSeniority(job),
      evidence_inventory: candidate,
      risk_flags: []
    }
  }
  context.inferred.project_plan = decideProjectPlan(context)
  return context
}

function buildTailoredSummary(job, profile, context) {
  const role = job.title || profile.target_role || '目标岗位'
  const domainLabel = context.inferred.domain?.label || '目标岗位'
  const base = String(profile.summary || '').replace(/精通/g, '熟悉').trim()
  if (base) {
    return base.length > 130 ? `${base.slice(0, 127)}...` : base
  }
  return `面向${role}岗位，重点突出${domainLabel}相关能力、项目验证经验和问题闭环意识；不夸大未提供证据的论文、竞赛、公司经历或生产成果。`
}

function normalizeGeneratedProject(project, index, count, newStartDate) {
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  const addMonths = (dateStr, months) => {
    const [y, m] = dateStr.split('-').map(Number)
    let newM = m + months
    let newY = y
    while (newM > 12) { newM -= 12; newY++ }
    return `${newY}-${String(newM).padStart(2, '0')}`
  }
  const projStart = index === 0 ? newStartDate : addMonths(addMonths(newStartDate, 5 * index), 2 * index)
  const safeStart = projStart <= todayStr ? projStart : todayStr
  const projEnd = index === count - 1 ? '至今' : addMonths(safeStart, 5)
  const bullets = Array.isArray(project.bullets)
    ? project.bullets
    : String(project.description || '').split(/[；;\n]/)
  return {
    title: project.name || project.title || '',
    role: project.role || '个人项目',
    time: `${formatDateShort(safeStart)} 至 ${projEnd}`,
    stack: (Array.isArray(project.tech_stack) ? project.tech_stack.join('、') : (project.tech_stack || project.stack || '')).replace(/\s*\/\s*/g, '、'),
    bullets: bullets.map(s => String(s).trim()).filter(Boolean).slice(0, 3),
    metadata: {
      project_type: project.project_type || 'new_portfolio',
      domain: project.domain || '',
      business_scenario: project.business_scenario || '',
      truth_level: project.truth_level || 'gap_bridging',
      interview_story: project.interview_story || '',
      risk_notes: Array.isArray(project.risk_notes) ? project.risk_notes : []
    }
  }
}

function validateGeneratedProjects(projects, context) {
  const accepted = []
  const warnings = []
  const forbidden = /项目[一二三四五六七八九十]|相关技术栈|\[技术栈\]|负责项目核心模块|实现关键技术功能|上线生产|真实客户|营收|专利|论文|竞赛|获奖|量产/i
  const existingNames = new Set((context.candidate.projects || []).map(p => String(p.name || '').trim()).filter(Boolean))

  for (const project of projects) {
    const name = String(project.title || '').trim()
    const stackItems = parseKeywordList(project.stack)
    if (!name || forbidden.test(name) || existingNames.has(name) || accepted.some(item => item.title === name)) {
      warnings.push(`丢弃低质量或重复项目：${name || '未命名项目'}`)
      continue
    }
    if (!project.stack || forbidden.test(project.stack) || stackItems.length < 2) {
      warnings.push(`丢弃技术栈不足的项目：${name}`)
      continue
    }
    const bullets = (project.bullets || []).filter(item => item && !forbidden.test(item))
    if (bullets.length !== 3) {
      warnings.push(`丢弃描述不足的项目：${name}`)
      continue
    }
    const tooSimilar = accepted.some(item => {
      const other = new Set(parseKeywordList(item.stack))
      const overlap = stackItems.filter(skill => other.has(skill)).length
      return other.size > 0 && overlap / Math.max(stackItems.length, other.size) >= 0.8
    })
    if (tooSimilar) {
      warnings.push(`丢弃技术栈过度重复的项目：${name}`)
      continue
    }
    accepted.push({ ...project, bullets: bullets.slice(0, 3) })
  }

  return { projects: accepted, warnings }
}

async function adaptExistingProjectsWithAi(job, profile, projects, provider = 'deepseek', context = buildResumeGenerationContext(job, profile)) {
  const needsAdaptation = projects.some(project => scoreProjectRelevance(project, context.inferred.domain.primary, getJobText(job)) <= 1)
  if (!needsAdaptation) return projects

  const prompt = `你是严谨的中文简历项目改写专家。请将候选人的已有项目适当改写为更贴近目标岗位的表达，但必须保持事实边界。

硬性规则：
1. 不得改变项目本质，不得把没做过的内容写成做过。
2. 可以调整项目标题、技术栈排序和 bullet 表达，使其更贴近岗位要求。
3. 每个项目只能输出 3 条 bullet，每条包含动作、技术和验证方式/结果。
4. 如果项目与岗位严重不匹配，只保留可迁移能力，不要强行改成目标岗位项目。
5. 不得编造论文、竞赛、奖项、证书、真实公司经历、生产上线、客户、营收、专利、量产数据。

目标岗位：${job.company || ''} - ${job.title || ''}
岗位领域：${context.inferred.domain.label} (${context.inferred.domain.primary})
岗位JD：
${getJobText(job).slice(0, 1800)}

候选人已有项目：
${projects.map((p, i) => `${i + 1}. ${getProjectDisplayName(p)}\n角色：${p.role || ''}\n时间：${p.start_date || ''} 至 ${p.end_date || ''}\n技术栈：${p.tech_stack || ''}\n描述：${p.description || ''}`).join('\n\n')}

只输出 JSON：
{
  "projects": [
    {
      "source_name": "原项目名",
      "name": "改写后项目名",
      "role": "角色",
      "start_date": "原开始时间",
      "end_date": "原结束时间",
      "tech_stack": "技术1、技术2、技术3",
      "bullets": ["第1条", "第2条", "第3条"]
    }
  ]
}`

  const response = await callChatCompletions(provider, prompt, {
    temperature: 0.25,
    systemPrompt: '你是严格输出完整 JSON 对象的中文简历项目改写专家。不要输出 Markdown，不要输出 JSON 之外的文字。'
  })
  const parsed = extractJsonObject(response.content)
  if (!Array.isArray(parsed.projects) || parsed.projects.length === 0) return projects

  const bySource = new Map(parsed.projects.map(project => [String(project.source_name || '').trim(), project]))
  return projects.map(project => {
    const adapted = bySource.get(String(project.name || '').trim())
    if (!adapted) return project
    return {
      ...project,
      name: adapted.name || project.name,
      role: adapted.role || project.role,
      tech_stack: adapted.tech_stack || project.tech_stack,
      description: (Array.isArray(adapted.bullets) ? adapted.bullets : [])
        .map(item => String(item).trim())
        .filter(Boolean)
        .slice(0, 3)
        .join('；\n') + '；'
    }
  })
}

async function buildTailoredResume(job, profile, provider) {
  const text = getJobText(job)
  const role = job.title || profile.target_role || '目标岗位'
  const company = job.company || '目标公司'
  const resumeProvider = provider || process.env.AI_RESUME_PROVIDER || process.env.AI_EVAL_PROVIDER || 'deepseek'
  const context = buildResumeGenerationContext(job, profile)

  const fallbackSkills = parseKeywordList(profile.skills)

  // Try to generate skills with AI based on job + projects + profile
  let skills = fallbackSkills
  try {
    skills = await generateSkillsWithAi(job, profile, fallbackSkills, resumeProvider, context)
  } catch (e) {
    console.error('AI skill generation failed, using profile skills only:', e.message)
  }

  const summary = buildTailoredSummary(job, profile, context)

  // Use only user projects and AI projects for the current target job.
  let profileProjects = context.candidate.projects
  try {
    profileProjects = await adaptExistingProjectsWithAi(job, profile, profileProjects, resumeProvider, context)
  } catch (e) {
    console.error('AI project adaptation failed, using original projects:', e.message)
  }
  const projects = profileProjects.map(p => ({
    title: getProjectDisplayName(p),
    role: p.role || '',
    time: `${formatDateShort(p.start_date)} 至 ${formatDateShort(p.end_date) || '至今'}`,
    stack: p.tech_stack || '',
    bullets: (p.description || '').split(/[；;\n]/).map(l => l.trim()).filter(Boolean).slice(0, p.ai_generated ? 3 : 5)
  }))

  // Sort projects by start time (earliest first)
  projects.sort((a, b) => {
    const parseTime = (t) => {
      const m = t.match(/(\d{4})-(\d{2})/)
      return m ? parseInt(m[1]) * 12 + parseInt(m[2]) : 0
    }
    return parseTime(a.time) - parseTime(b.time)
  })

  const profileExperience = Array.isArray(profile.experience) ? profile.experience : []
  const projectPlan = context.inferred.project_plan
  const needProjectCount = projectPlan.new_projects.length

  if (needProjectCount > 0) {
    try {
      // Calculate the latest end date across all existing projects
      let latestEndYear = 0, latestEndMonth = 0
      for (const p of projects) {
        const endPart = p.time.replace(/.*至\s*/, '').replace('至今', '').trim()
        const m = endPart.match(/(\d{4})-(\d{2})/)
        if (m) {
          const y = parseInt(m[1]), mo = parseInt(m[2])
          if (y * 12 + mo > latestEndYear * 12 + latestEndMonth) {
            latestEndYear = y; latestEndMonth = mo
          }
        }
      }
      const lastProjectEndDate = latestEndYear > 0 ? `${latestEndYear}-${String(latestEndMonth).padStart(2, '0')}` : ''
      const generatedProjects = await generateProjectsWithAi(job, profile, profileProjects, needProjectCount, lastProjectEndDate, resumeProvider, context)
      const validation = validateGeneratedProjects(generatedProjects, context)
      const aiProjects = validation.projects
      if (validation.warnings.length) console.warn('AI project validation warnings:', validation.warnings.join('; '))
      projects.push(...aiProjects)

      // 回写 AI 生成的项目到 resume-profile.json，标记 ai_generated
      try {
        const aiProjectsForProfile = aiProjects.map(ap => ({
          name: ap.title.replace(/\s*\|\s*个人项目$/, '').trim(),
          role: ap.role || '个人项目',
          start_date: (ap.time.match(/^(\d{4}-\d{2})/) || [])[1] || '',
          end_date: ap.time.includes('至今') ? '' : (ap.time.match(/至\s*(\d{4}-\d{2})/) || [])[1] || '',
          tech_stack: ap.stack || '',
          description: (ap.bullets || []).join('；\n') + '；',
          ai_generated: true,
          ai_target_job: `${job.company || ''} - ${job.title || ''}`,
          ai_generation_reason: (ap.metadata?.business_scenario || projectPlan.new_projects[0]?.business_scenario || '补足岗位项目证据'),
          ai_domain: ap.metadata?.domain || context.inferred.domain.primary,
          ai_project_type: ap.metadata?.project_type || 'new_portfolio',
          ai_truth_level: ap.metadata?.truth_level || 'gap_bridging',
          ai_source_project_id: '',
          ai_risk_notes: ap.metadata?.risk_notes || [],
          ai_generated_at: new Date().toISOString()
        }))
        // 追加而非替换，避免覆盖用户自填项目
        const currentProfile = getResumeProfile()
        const existingNames = new Set((currentProfile.projects || []).map(p => p.name))
        const newAiProjects = aiProjectsForProfile.filter(p => !existingNames.has(p.name))
        if (newAiProjects.length > 0) {
          currentProfile.projects = [...(currentProfile.projects || []), ...newAiProjects]
          writeFileSync(RESUME_PROFILE_FILE, JSON.stringify(currentProfile, null, 2), 'utf-8')
        }
      } catch (writeErr) {
        console.error('Failed to write AI projects back to profile:', writeErr.message)
      }

      // Re-sort by time after adding AI projects
      projects.sort((a, b) => {
        const parseTime = (t) => {
          const m = t.match(/(\d{4})-(\d{2})/)
          return m ? parseInt(m[1]) * 12 + parseInt(m[2]) : 0
        }
        return parseTime(a.time) - parseTime(b.time)
      })
    } catch (e) {
      console.error('AI project generation failed:', e.message)
    }
  }

  const gaps = [
    ...(job.gaps || []),
    ...(projects.length === 0 ? ['项目经历不足：请补充真实项目，或配置 AI 后重新生成岗位化作品集项目。'] : []),
    ...(projectPlan.weak_job_description ? ['岗位描述不足：当前基于搜索页/有限信息保守生成，建议补充完整 JD 后重新定制。'] : [])
  ].slice(0, 3)

  const modules = normalizeResumeModules(profile.modules)

  // Use user-filled education from profile, convert to resume format
  const profileEducation = Array.isArray(profile.education) ? profile.education : []
  const education = profileEducation.length > 0
    ? profileEducation.map(e => ({
        school: [e.school, e.major, e.degree].filter(Boolean).join(' | '),
        time: `${formatDateShort(e.start_date)} 至 ${formatDateShort(e.end_date)}`,
        bullets: [
          e.gpa ? `GPA：${e.gpa}。` : '',
          e.description ? `相关课程：${e.description}` : ''
        ].filter(Boolean)
      }))[0] || { school: '', time: '', bullets: [] }
    : {
        school: '',
        time: '',
        bullets: []
      }

  // Use user-filled experience from profile, convert to resume format
  const experience = profileExperience.map(e => ({
    company: e.company || '',
    position: e.position || '',
    time: `${formatDateShort(e.start_date)} 至 ${formatDateShort(e.end_date) || '至今'}`,
    bullets: (e.description || '').split('\n').filter(l => l.trim())
  }))

  return {
    profile,
    company,
    role,
    summary,
    skills,
    projects,
    gaps,
    modules,
    education,
    experience
  }
}

function formatDateShort(date) {
  if (!date) return ''
  if (date === 'present') return '至今'
  return String(date).replace(/^(\d{4})-(\d{1,2}).*$/, '$1-$2')
}

async function generateSkillsWithAi(job, profile, fallbackSkills, provider = 'deepseek', context = buildResumeGenerationContext(job, profile)) {
  const jobText = getJobText(job)
  const role = job.title || profile.target_role || '目标岗位'
  const company = job.company || '目标公司'
  const domain = context.inferred.domain

  const projectsSummary = (context.candidate.projects || []).map(p =>
    `${p.name}（${p.tech_stack || ''}）：${(p.description || '').split('\n').filter(Boolean).join('；')}`
  ).join('\n')

  const userSkills = profile.skills || ''
  const userSummary = profile.summary || ''

  // Include AI evaluation results: match_highlights, gaps, resume_strategy
  const matchHighlights = Array.isArray(job.match_highlights) ? job.match_highlights.join('\n') : ''
  const gaps = Array.isArray(job.gaps) ? job.gaps.join('\n') : ''
  const resumeStrategy = Array.isArray(job.resume_strategy) ? job.resume_strategy.join('\n') : ''

  const evalSection = (matchHighlights || gaps || resumeStrategy)
    ? `
AI评分匹配亮点：
${matchHighlights || '无'}

AI评分差距（候选人尚未覆盖的岗位要求）：
${gaps || '无'}

AI评分简历策略建议：
${resumeStrategy || '无'}`
    : ''

  const prompt = `你是一位严谨的中文简历优化专家。请根据【目标岗位描述（JD）】和【候选人材料】，提取最重要的核心技能标签，并将其归为3-4类。分类标题必须根据岗位领域动态生成。

必须只输出 JSON 对象，不要 Markdown，不要代码块。JSON schema:
{
  "skill_groups": [
    {
      "group": "分类标题",
      "items": [
        {"name": "技能标签", "evidence": "证据来源", "confidence": "high|medium|low"}
      ]
    }
  ],
  "do_not_claim": ["不能声称的能力"]
}

要求：
1. 每个技能标签要简洁（10-20字），并列技术用中文顿号"、"分隔，不要用斜杠"/"
2. 技能必须与岗位强相关，优先突出岗位JD中明确要求的技术
3. 必须标注 evidence 和 confidence；无证据的能力只能作为 low confidence，不得写成“精通”
4. 如果用户自填了核心能力，确保覆盖其中的关键技能
5. 仔细参考AI评分结果中的"差距"和"简历策略"，但不得把 gap 写成已掌握
6. 每个分类下2-4个标签，总计不超过12个标签
7. 不得输出"相关技术栈1"、"开发工具链"这类模板词

岗位：${company} - ${role}
岗位领域：${domain.label} (${domain.primary})，识别信号：${domain.signals.join('、') || '无'}
岗位JD摘要：${jobText.slice(0, 800)}
${evalSection}
候选人项目经历：
${projectsSummary || '无'}

用户自填核心能力：
${userSkills || '无'}`

  const response = await callChatCompletions(provider, prompt, { temperature: 0.25 })
  const parsed = extractJsonValue(response.content)
  if (Array.isArray(parsed.skill_groups) && parsed.skill_groups.length > 0) {
    return parsed.skill_groups.map(g => ({
      group: g.group,
      items: (Array.isArray(g.items) ? g.items : [])
        .map(item => typeof item === 'string' ? item : item?.name)
        .filter(Boolean)
    })).filter(g => g.group && g.items.length > 0)
  }
  if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].categoryName && Array.isArray(parsed[0].tags)) {
    return parsed.map(g => ({ group: g.categoryName, items: g.tags }))
  }
  if (Array.isArray(parsed.skills) && parsed.skills.length >= 3) {
    return parsed.skills.slice(0, 9).map(s => s.replace(/\s*\/\s*/g, '、'))
  }
  return fallbackSkills
}

async function generateProjectsWithAi(job, profile, existingProjects, count, lastProjectEndDate, provider = 'deepseek', context = buildResumeGenerationContext(job, profile)) {
  const jobText = getJobText(job)
  const role = job.title || profile.target_role || '目标岗位'
  const company = job.company || '目标公司'

  const userSkills = profile.skills || ''
  const userSummary = profile.summary || ''
  const summary = profile.summary || ''

  // Calculate the start date for the new project
  // Add 2 months gap after the last project's end date
  let newStartMonth = 1
  let newStartYear = 2024
  if (lastProjectEndDate) {
    const parts = lastProjectEndDate.split('-')
    if (parts.length >= 2) {
      let y = parseInt(parts[0])
      let m = parseInt(parts[1]) + 2 // 2-month gap
      if (m > 12) { m -= 12; y += 1 }
      newStartYear = y
      newStartMonth = m
    }
  }
  const newStartDate = `${newStartYear}-${String(newStartMonth).padStart(2, '0')}`

  const existingDesc = existingProjects.map(p =>
    `项目名：${p.name}，角色：${p.role || '个人项目'}，时间：${p.start_date || ''} 至 ${p.end_date || ''}，技术栈：${p.tech_stack || '无'}，描述：${(p.description || '').split('\n').filter(Boolean).join('；')}`
  ).join('\n')

  const matchHighlights = Array.isArray(job.match_highlights) ? job.match_highlights.join('\n') : ''
  const gaps = Array.isArray(job.gaps) ? job.gaps.join('\n') : ''
  const resumeStrategy = Array.isArray(job.resume_strategy) ? job.resume_strategy.join('\n') : ''

  const domain = context.inferred.domain
  const projectPlan = context.inferred.project_plan
  const enterpriseType = context.job.enterprise_type || ''

  const prompt = `你是严谨的中文求职简历项目生成专家。候选人正在申请"${company} - ${role}"岗位。代码层只决定补充 ${count} 个项目；具体项目主题必须由你根据岗位JD、公司公开资料/raw_text、候选人能力与已有项目动态规划，不能套用固定模板。

核心要求：
1. 项目必须与目标岗位强相关，并符合岗位领域：${domain.label} (${domain.primary})
2. 项目必须写成"个人项目/作品集项目/训练项目/模拟验证项目"，不得伪造成公司经历
3. 不得编造论文、竞赛、奖项、证书、专利、真实客户、营收、生产上线、量产数据
4. 技术栈应基于候选人已有能力延伸，可以 candidate_plus_one，但不要超出候选人可解释边界
5. 每个项目必须不同业务场景、不同核心技术矛盾、不同指标、不同面试讲法
6. 每个项目必须且只能输出 3 条 bullet；每条必须包含"动作 + 技术实现 + 验证方式/结果"
7. 如果用户已有项目严重不匹配，只能在保持项目事实不变的前提下调整表达，不得把不相关项目改造成没做过的新项目
8. 涉及中国企业的芯片、EDA、CAD、工控、嵌入式岗位时，优先考虑国产或国内常用生态；JD 明确要求国外工具时以 JD 为准
9. 不得输出"项目一"、"项目二"、"[技术栈]"、"负责项目核心模块"、"实现关键技术功能"等模板痕迹
10. 项目要有企业级场景，但必须符合大学生可完成能力：可以使用开发板、仿真、样板板、模拟负载、离线测试、实验记录，不要写成真实产线或客户交付
11. 必须结合岗位 JD、公司公开资料或 raw_text 中的公司业务线；如果资料不足，使用"基于公开资料/岗位描述推断"的保守场景

公司：${company}
岗位：${role}
企业性质：${enterpriseType || '未知'}
项目计划：
${JSON.stringify(projectPlan, null, 2)}

岗位JD摘要：
${jobText.slice(0, 2200)}

AI评分匹配亮点：
${matchHighlights || '无'}

AI评分差距（候选人缺乏的岗位要求）：
${gaps || '无'}

AI评分简历策略建议：
${resumeStrategy || '无'}

候选人自我定位：
${summary || '无'}

候选人自填核心能力：
${userSkills || '无'}

候选人已有项目（必须严格按此格式输出新项目）：
${existingDesc || '无'}

输出必须严格匹配以下JSON格式：
{
  "projects": [
    {
      "name": "项目名称",
      "project_type": "new_portfolio|new_learning_project",
      "domain": "${domain.primary}",
      "business_scenario": "业务场景",
      "role": "个人项目",
      "start_date": "${newStartDate}",
      "end_date": "",
      "tech_stack": ["技术1", "技术2", "技术3"],
      "bullets": ["第1条描述", "第2条描述", "第3条描述"],
      "metrics": ["可个人验证的指标1", "指标2"],
      "interview_story": "这个项目面试时主要讲什么",
      "truth_level": "gap_bridging",
      "risk_notes": ["需要候选人确认或补学的内容"]
    }
  ]
}`

  const response = await callChatCompletions(provider, prompt, {
    temperature: 0.38,
    systemPrompt: '你是严格输出完整 JSON 对象的中文简历项目生成专家。不要输出 Markdown，不要输出 JSON 之外的文字。'
  })
  const parsed = extractJsonObject(response.content)
  if (Array.isArray(parsed.projects) && parsed.projects.length > 0) {
    return parsed.projects.slice(0, count).map((p, i) => normalizeGeneratedProject(p, i, Math.min(parsed.projects.length, count), newStartDate))
  }
  throw new Error('AI project generation returned invalid format')
}

function cleanRoleForFileName(title) {
  return String(title || 'job')
    .replace(/【[^】]+】/g, '')
    .replace(/\[[^\]]+\]/g, '')
    .replace(/（[^）]*招聘[^）]*）/g, '')
    .replace(/\([^)]*招聘[^)]*\)/g, '')
    .trim() || 'job'
}

function resumeFileStem(job, profile, date) {
  return `cv-${safeSlug(profile.full_name || 'candidate', 'candidate')}-${safeSlug(job.company, 'company')}-${safeSlug(cleanRoleForFileName(job.title), 'job')}-${date}`
}

function resolveUniqueResumeArtifactNames(stem, artifactSpecs) {
  let suffix = 0

  while (true) {
    const candidateStem = suffix === 0 ? stem : `${stem}(${suffix})`
    const taken = artifactSpecs.some(spec => existsSync(`${PROJECT_ROOT}/${spec.dir}/${candidateStem}.${spec.extension}`))
    if (!taken) {
      return artifactSpecs.reduce((acc, spec) => {
        acc[spec.extension] = `${candidateStem}.${spec.extension}`
        return acc
      }, {})
    }
    suffix++
  }
}

function listGeneratedResumeFiles() {
  const dir = `${PROJECT_ROOT}/output`
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter(name => /\.(pdf|docx)$/i.test(name))
    .map(name => {
      const fullPath = `${dir}/${name}`
      const stat = statSync(fullPath)
      return {
        fileName: name,
        name,
        path: `output/${name}`,
        updatedAt: stat.mtime.toISOString(),
        size: stat.size
      }
    })
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
}

function crc32(buffer) {
  let crc = ~0
  for (let i = 0; i < buffer.length; i++) {
    crc ^= buffer[i]
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
    }
  }
  return ~crc >>> 0
}

function dosTimeDate(date = new Date()) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2)
  const day = date.getDate()
  const month = date.getMonth() + 1
  const year = Math.max(date.getFullYear() - 1980, 0)
  return { time, date: (year << 9) | (month << 5) | day }
}

function createZip(entries) {
  const localParts = []
  const centralParts = []
  let offset = 0
  const stamp = dosTimeDate()
  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf-8')
    const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data, 'utf-8')
    const crc = crc32(data)
    const local = Buffer.alloc(30 + name.length)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0, 6)
    local.writeUInt16LE(0, 8)
    local.writeUInt16LE(stamp.time, 10)
    local.writeUInt16LE(stamp.date, 12)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(data.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(name.length, 26)
    local.writeUInt16LE(0, 28)
    name.copy(local, 30)
    localParts.push(local, data)

    const central = Buffer.alloc(46 + name.length)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(0, 8)
    central.writeUInt16LE(0, 10)
    central.writeUInt16LE(stamp.time, 12)
    central.writeUInt16LE(stamp.date, 14)
    central.writeUInt32LE(crc, 16)
    central.writeUInt32LE(data.length, 20)
    central.writeUInt32LE(data.length, 24)
    central.writeUInt16LE(name.length, 28)
    central.writeUInt16LE(0, 30)
    central.writeUInt16LE(0, 32)
    central.writeUInt16LE(0, 34)
    central.writeUInt16LE(0, 36)
    central.writeUInt32LE(0, 38)
    central.writeUInt32LE(offset, 42)
    name.copy(central, 46)
    centralParts.push(central)
    offset += local.length + data.length
  }
  const centralStart = offset
  const central = Buffer.concat(centralParts)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(0, 4)
  end.writeUInt16LE(0, 6)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(central.length, 12)
  end.writeUInt32LE(centralStart, 16)
  end.writeUInt16LE(0, 20)
  return Buffer.concat([...localParts, central, end])
}

function wText(text) {
  return `<w:r><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`
}

function wRun(text, options = {}) {
  const props = []
  if (options.bold) props.push('<w:b/>')
  if (options.color) props.push(`<w:color w:val="${options.color}"/>`)
  if (options.size) props.push(`<w:sz w:val="${options.size}"/>`)
  if (options.font) props.push(`<w:rFonts w:ascii="${escapeXml(options.font)}" w:eastAsia="${escapeXml(options.font)}"/>`)
  const rPr = props.length ? `<w:rPr>${props.join('')}</w:rPr>` : ''
  return `<w:r>${rPr}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`
}

function wParagraph(text, style = '') {
  const props = style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : ''
  return `<w:p>${props}${wText(text)}</w:p>`
}

function wParagraphRuns(runs, style = '', extraPPr = '') {
  const styleXml = style ? `<w:pStyle w:val="${style}"/>` : ''
  const pPr = (styleXml || extraPPr) ? `<w:pPr>${styleXml}${extraPPr}</w:pPr>` : ''
  return `<w:p>${pPr}${runs.join('')}</w:p>`
}

function wBullet(text) {
  return `<w:p><w:pPr><w:pStyle w:val="Bullet"/></w:pPr>${wText(text)}</w:p>`
}

function wBulletWithKeywords(keyword, items) {
  const keywordXml = keyword ? `<w:r><w:rPr><w:b/><w:color w:val="1178CC"/></w:rPr><w:t xml:space="preserve">${escapeXml(keyword)}</w:t></w:r>` : ''
  const itemsText = Array.isArray(items) ? items.join('　') : items
  const itemsXml = `<w:r><w:t xml:space="preserve">${keyword ? '：' : ''}${escapeXml(itemsText)}</w:t></w:r>`
  return `<w:p><w:pPr><w:pStyle w:val="Bullet"/></w:pPr>${keywordXml}${itemsXml}</w:p>`
}

function wSectionTitle(text) {
  return `<w:p><w:pPr><w:pStyle w:val="SectionTitle"/></w:pPr>${wText(text)}</w:p>`
}

function wTableCell(content, width, options = {}) {
  const tcPr = [
    width ? `<w:tcW w:w="${width}" w:type="dxa"/>` : '',
    options.vAlign ? `<w:vAlign w:val="${options.vAlign}"/>` : '',
    options.gridSpan ? `<w:gridSpan w:val="${options.gridSpan}"/>` : ''
  ].filter(Boolean).join('')
  return `<w:tc>${tcPr ? `<w:tcPr>${tcPr}</w:tcPr>` : ''}${content || '<w:p/>'}</w:tc>`
}

function wTableRow(cells) {
  return `<w:tr>${cells.join('')}</w:tr>`
}

function wTable(rows, widths, options = {}) {
  const borders = options.borders === 'none'
    ? '<w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders>'
    : options.borders === 'header'
      ? '<w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="single" w:sz="12" w:space="6" w:color="1178CC"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders>'
      : ''
  const layout = '<w:tblLayout w:type="fixed"/>'
  const cellMar = '<w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="40" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="40" w:type="dxa"/></w:tblCellMar>'
  const tblPr = `<w:tblPr>${layout}${borders}${cellMar}</w:tblPr>`
  const tblGrid = `<w:tblGrid>${(widths || []).map(width => `<w:gridCol w:w="${width}"/>`).join('')}</w:tblGrid>`
  return `<w:tbl>${tblPr}${tblGrid}${rows.join('')}</w:tbl>`
}

function wDrawingImage(rId, cx, cy) {
  return `<w:r>
    <w:drawing>
      <wp:inline distT="0" distB="0" distL="0" distR="0" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">
        <wp:extent cx="${cx}" cy="${cy}"/>
        <wp:effectExtent l="0" t="0" r="0" b="0"/>
        <wp:docPr id="1" name="ResumePhoto"/>
        <wp:cNvGraphicFramePr>
          <a:graphicFrameLocks noChangeAspect="1" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"/>
        </wp:cNvGraphicFramePr>
        <a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
          <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
            <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
              <pic:nvPicPr>
                <pic:cNvPr id="0" name="ResumePhoto"/>
                <pic:cNvPicPr/>
              </pic:nvPicPr>
              <pic:blipFill>
                <a:blip r:embed="${rId}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/>
                <a:stretch><a:fillRect/></a:stretch>
              </pic:blipFill>
              <pic:spPr>
                <a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>
                <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
                <a:ln w="9525"><a:solidFill><a:srgbClr val="1178CC"/></a:solidFill></a:ln>
              </pic:spPr>
            </pic:pic>
          </a:graphicData>
        </a:graphic>
      </wp:inline>
    </w:drawing>
  </w:r>`
}

function docxImagePart(profile) {
  if (!profile.photo_path) return null
  const fullPath = `${PROJECT_ROOT}/${profile.photo_path}`
  if (!existsSync(fullPath)) return null
  const extension = fullPath.toLowerCase().endsWith('.png') ? 'png' : 'jpeg'
  return {
    extension,
    contentType: extension === 'png' ? 'image/png' : 'image/jpeg',
    path: `word/media/resume-photo.${extension === 'jpeg' ? 'jpg' : extension}`,
    relationshipTarget: `media/resume-photo.${extension === 'jpeg' ? 'jpg' : extension}`,
    data: readFileSync(fullPath)
  }
}

function buildDocxDocumentXml(resume, options = {}) {
  const imageRelId = options.imageRelId || ''
  const nameLine = resume.profile.full_name || '候选人姓名'
  const contactPairs = [
    (resume.profile.gender || resume.profile.age) ? `${resume.profile.gender || ''}${resume.profile.age ? ' · ' + resume.profile.age + '岁' : ''}` : '',
    resume.profile.phone ? `手机：${resume.profile.phone}` : '',
    resume.profile.email ? `邮箱：${resume.profile.email}` : '',
    resume.profile.wechat ? `微信：${resume.profile.wechat}` : '',
    resume.profile.github ? `GitHub：${resume.profile.github}` : ''
  ].filter(Boolean)

  const modules = normalizeResumeModules(resume.modules)

  const moduleRenderers = {
    summary: () => [wSectionTitle('求职定位'), wParagraph(resume.summary)],
    skills: () => {
      const groups = Array.isArray(resume.skills) && resume.skills.length > 0 && resume.skills[0]?.group
        ? resume.skills
        : (Array.isArray(resume.skills) ? [{ group: '', items: resume.skills }] : [])
      return [wSectionTitle('核心能力'), ...groups.flatMap(g => [wBulletWithKeywords(g.group || '', g.items)])]
    },
    experience: () => resume.experience && resume.experience.length
      ? [
          wSectionTitle('工作经历'),
          ...resume.experience.flatMap(exp => [
            wTable([
              wTableRow([
                wTableCell(wParagraphRuns([wRun(exp.company || '', { bold: true, color: '1178CC', size: '24' })]), 5200),
                wTableCell(wParagraphRuns([wRun(`${exp.position || ''}${exp.time ? ` | ${exp.time}` : ''}`, { bold: true, color: '1178CC', size: '24' })], '', '<w:jc w:val="right"/>'), 3400)
              ])
            ], [5200, 3400], { borders: 'none' }),
            ...exp.bullets.map(wBullet)
          ])
        ]
      : [],
    projects: () => resume.projects.length
      ? [
          wSectionTitle('项目经历'),
          ...resume.projects.flatMap(project => [
            wTable([
              wTableRow([
                wTableCell(wParagraphRuns([wRun(project.title || '', { bold: true, color: '1178CC', size: '24' })]), 3600),
                wTableCell(wParagraphRuns([wRun(project.role || '', { color: '475569', size: '22' })], '', '<w:jc w:val="center"/>'), 2200),
                wTableCell(wParagraphRuns([wRun(project.time || '', { color: '64748B', size: '22' })], '', '<w:jc w:val="right"/>'), 2800)
              ])
            ], [3600, 2200, 2800], { borders: 'none' }),
            project.stack ? `<w:p><w:pPr><w:pStyle w:val="Bullet"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">技术栈：</w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${escapeXml(project.stack)}</w:t></w:r></w:p>` : '',
            ...project.bullets.map(wBullet)
          ])
        ]
      : [],
    education: () => resume.education && (resume.education.school || resume.education.bullets?.length)
      ? [
          wSectionTitle('教育背景'),
          resume.education.school || resume.education.time ? wTable([
            wTableRow([
              wTableCell(wParagraphRuns([wRun(resume.education.school || '', { bold: true, color: '1178CC', size: '24' })]), 5200),
              wTableCell(wParagraphRuns([wRun(resume.education.time || '', { color: '64748B', size: '22' })], '', '<w:jc w:val="right"/>'), 3400)
            ])
          ], [5200, 3400], { borders: 'none' }) : '',
          ...(resume.education.bullets || []).map(wBullet)
        ]
      : [],
    gaps: () => resume.gaps.length
      ? [wSectionTitle('针对岗位的补充准备'), ...resume.gaps.map(wBullet)]
      : []
  }

  const headerLeft = [
    wParagraph(nameLine, 'Name'),
    ...Array.from({ length: Math.ceil(contactPairs.length / 2) }, (_, i) => {
      const left = contactPairs[i * 2] || ''
      const right = contactPairs[i * 2 + 1] || ''
      return wTable([
        wTableRow([
          wTableCell(left ? wParagraphRuns([wRun(left, { color: '475569', size: '22' })], '', '<w:spacing w:after="40"/>') : '<w:p/>', 4200),
          wTableCell(right ? wParagraphRuns([wRun(right, { color: '475569', size: '22' })], '', '<w:spacing w:after="40"/>') : '<w:p/>', 4200)
        ])
      ], [4200, 4200], { borders: 'none' })
    })
  ].join('')

  const headerRows = [
    wTableRow([
      wTableCell(headerLeft, imageRelId ? 7600 : 9000, { vAlign: 'top' }),
      ...(imageRelId ? [wTableCell(wParagraphRuns([wDrawingImage(imageRelId, 900000, 1152000)]), 1400, { vAlign: 'top' })] : [])
    ])
  ]

  const headerTable = wTable(headerRows, imageRelId ? [7600, 1400] : [9000], { borders: 'header' })

  const body = [
    headerTable,
    ...modules.filter(mod => mod.enabled).flatMap(mod => {
      if (mod.type === 'custom' && mod.content) {
        return [wSectionTitle(mod.name), ...String(mod.content || '').split('\n').filter(Boolean).map(line => wParagraph(line))]
      }
      const renderer = moduleRenderers[mod.id]
      return renderer ? renderer() : []
    })
  ].join('')

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
  <w:body>
    ${body}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="320" w:right="720" w:bottom="720" w:left="720" w:header="240" w:footer="360" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`
}

function buildDocxStylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Microsoft YaHei" w:eastAsia="Microsoft YaHei"/><w:sz w:val="23"/></w:rPr></w:rPrDefault></w:docDefaults>
  <w:style w:type="paragraph" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="100" w:line="280" w:lineRule="auto"/></w:pPr><w:rPr><w:rFonts w:ascii="Microsoft YaHei" w:eastAsia="Microsoft YaHei"/><w:color w:val="1E293B"/><w:sz w:val="23"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Name"><w:name w:val="Name"/><w:qFormat/><w:pPr><w:spacing w:after="80"/></w:pPr><w:rPr><w:rFonts w:ascii="Microsoft YaHei" w:eastAsia="Microsoft YaHei"/><w:b/><w:color w:val="1178CC"/><w:sz w:val="56"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="SectionTitle"><w:name w:val="SectionTitle"/><w:qFormat/><w:pPr><w:jc w:val="center"/><w:spacing w:before="200" w:after="120"/><w:pBdr><w:top w:val="single" w:sz="4" w:space="1" w:color="999999"/><w:bottom w:val="single" w:sz="4" w:space="1" w:color="999999"/></w:pBdr></w:pPr><w:rPr><w:b/><w:color w:val="000000"/><w:sz w:val="28"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="ItemTitle"><w:name w:val="ItemTitle"/><w:qFormat/><w:pPr><w:spacing w:before="60" w:after="40"/></w:pPr><w:rPr><w:b/><w:color w:val="1178CC"/><w:sz w:val="24"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Muted"><w:name w:val="Muted"/><w:qFormat/><w:pPr><w:spacing w:after="60"/></w:pPr><w:rPr><w:color w:val="64748B"/><w:sz w:val="22"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Bullet"><w:name w:val="Bullet"/><w:qFormat/><w:pPr><w:ind w:left="360" w:hanging="180"/><w:spacing w:after="60"/></w:pPr><w:rPr><w:color w:val="1E293B"/><w:sz w:val="23"/></w:rPr></w:style>
</w:styles>`
}

function createDocxBuffer(resume) {
  const imagePart = docxImagePart(resume.profile)
  const imageRelId = imagePart ? 'rIdImage1' : ''
  const contentTypes = [
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
    '<Default Extension="xml" ContentType="application/xml"/>',
    imagePart ? `<Default Extension="${imagePart.extension === 'jpeg' ? 'jpg' : imagePart.extension}" ContentType="${imagePart.contentType}"/>` : '',
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>',
    '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>'
  ].filter(Boolean).join('')
  const docRels = [
    '<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>',
    imagePart ? `<Relationship Id="${imageRelId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${imagePart.relationshipTarget}"/>` : ''
  ].filter(Boolean).join('')
  const entries = [
    { name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">${contentTypes}</Types>` },
    { name: '_rels/.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>` },
    { name: 'word/_rels/document.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${docRels}</Relationships>` },
    { name: 'word/document.xml', data: buildDocxDocumentXml(resume, { imageRelId }) },
    { name: 'word/styles.xml', data: buildDocxStylesXml() }
  ]
  if (imagePart) entries.push({ name: imagePart.path, data: imagePart.data })
  return createZip(entries)
}

function imageDataUrl(profile) {
  if (!profile.photo_path) return ''
  const fullPath = `${PROJECT_ROOT}/${profile.photo_path}`
  if (!existsSync(fullPath)) return ''
  const ext = fullPath.toLowerCase().endsWith('.png') ? 'png' : 'jpeg'
  return `data:image/${ext};base64,${readFileSync(fullPath).toString('base64')}`
}

function buildResumeHtml(resume) {
  const photo = imageDataUrl(resume.profile)
  const bulletList = items => items && items.length ? `<ul>${items.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : ''
  const projectHtml = resume.projects.map(project => `
    <div class="item">
      <div class="item-head" style="display:flex;justify-content:space-between;align-items:center;">
        <span style="flex:1;">${escapeHtml(project.title)}</span>
        <span style="flex:1;text-align:center;">${escapeHtml(project.role || '')}</span>
        <span style="flex:1;text-align:right;" class="muted">${escapeHtml(project.time)}</span>
      </div>
      ${project.stack ? `<div><strong>技术栈：</strong>${escapeHtml(project.stack)}</div>` : ''}
      ${bulletList(project.bullets)}
    </div>
  `).join('')

  const experienceHtml = resume.experience && resume.experience.length
    ? resume.experience.map(exp => `
    <div class="item">
      <div class="item-head"><span>${escapeHtml(exp.company)}</span><span>${escapeHtml(exp.position)} | ${escapeHtml(exp.time)}</span></div>
      ${bulletList(exp.bullets)}
    </div>
  `).join('')
    : ''

  const educationHtml = resume.education && (resume.education.school || resume.education.bullets?.length)
    ? `<div class="item">${resume.education.school ? `<div class="item-head"><span>${escapeHtml(resume.education.school)}</span><span class="muted">${escapeHtml(resume.education.time)}</span></div>` : ''}${bulletList(resume.education.bullets)}</div>`
    : ''

  const moduleRenderers = {
    summary: () => `<section class="section"><div class="section-title">求职定位</div><p>${escapeHtml(resume.summary)}</p></section>`,
    skills: () => {
      const groups = Array.isArray(resume.skills) && resume.skills.length > 0 && resume.skills[0]?.group
        ? resume.skills
        : (Array.isArray(resume.skills) ? [{ group: '', items: resume.skills }] : [])
      return `<section class="section"><div class="section-title">核心能力</div>${groups.map(g => `<div style="margin-bottom:6px;">${g.group ? `<span style="color:#1178CC;font-weight:700;font-size:12.5px;margin-right:10px;">${escapeHtml(g.group)}</span>` : ''}<span style="color:#1e293b;">${g.items.map(s => escapeHtml(s)).join('</span>　')}</span></div>`).join('')}</section>`
    },
    experience: () => resume.experience && resume.experience.length ? `<section class="section"><div class="section-title">工作经历</div>${experienceHtml}</section>` : '',
    projects: () => resume.projects.length ? `<section class="section"><div class="section-title">项目经历</div>${projectHtml}</section>` : '',
    education: () => educationHtml ? `<section class="section"><div class="section-title">教育背景</div>${educationHtml}</section>` : '',
    gaps: () => resume.gaps.length ? `<section class="section"><div class="section-title">针对岗位的补充准备</div>${bulletList(resume.gaps)}</section>` : ''
  }

  const modules = normalizeResumeModules(resume.modules)

  const sectionsHtml = modules
    .filter(mod => mod.enabled)
    .map(mod => {
      if (mod.type === 'custom' && mod.content) {
        return `<section class="section"><div class="section-title">${escapeHtml(mod.name)}</div><p>${escapeHtml(mod.content)}</p></section>`
      }
      const renderer = moduleRenderers[mod.id]
      return renderer ? renderer() : ''
    })
    .join('')

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; }
  body { margin: 0; font-family: "Microsoft YaHei", "Noto Sans CJK SC", Arial, sans-serif; color: #1e293b; background: #fff; font-size: 12px; line-height: 1.6; }
  .page { width: 210mm; min-height: 297mm; padding: 5mm 16mm; margin: 0 auto; }
  .header { display: grid; grid-template-columns: 1fr ${photo ? '28mm' : '0'}; gap: 12px; align-items: start; border-bottom: 2px solid #1178CC; padding-bottom: 8px; margin-bottom: 8px; }
  h1 { margin: 0 0 4px; font-size: 28px; color: #1178CC; letter-spacing: 0; }
  .contact { color: #475569; display: flex; flex-wrap: wrap; gap: 8px; }
  .photo { width: 25mm; height: 32mm; object-fit: cover; border: 1px solid #1178CC; }
  .section { margin-bottom: 12px; break-inside: avoid; }
  .section-title { color: #000; font-weight: 700; font-size: 14px; text-align: center; margin-bottom: 8px; display: flex; align-items: center; justify-content: center; gap: 16px; white-space: nowrap; }
  .section-title::before, .section-title::after { content: ''; flex: 1; height: 0; border-top: 1px solid #999; }
  .tags { display: flex; flex-wrap: wrap; gap: 10px; }
  .tag { background: #f4f6f8; color: #1e293b; padding: 5px 14px; border-radius: 5px; font-size: 12px; }
  .item { margin-bottom: 10px; break-inside: avoid; }
  .item-head { display: flex; justify-content: space-between; gap: 10px; font-weight: 700; color: #1178CC; font-size: 12.5px; }
  .muted { color: #64748b; font-size: 12px; }
  ul { margin: 5px 0 0 18px; padding: 0; }
  li { margin-bottom: 3px; }
</style>
</head>
<body>
<main class="page">
  <header class="header">
    <div>
      <h1>${escapeHtml(resume.profile.full_name)}</h1>
      <div class="contact" style="display:flex;flex-wrap:wrap;gap:6px 0;">
        ${(resume.profile.gender || resume.profile.age) ? `<span style="width:50%;">${escapeHtml(resume.profile.gender || '')}${resume.profile.age ? ' · ' + escapeHtml(String(resume.profile.age)) + '岁' : ''}</span>` : ''}
        <span style="width:50%;">手机：${escapeHtml(resume.profile.phone)}</span>
        <span style="width:50%;">邮箱：${escapeHtml(resume.profile.email)}</span>
        <span style="width:50%;">微信：${escapeHtml(resume.profile.wechat)}</span>
        ${resume.profile.github ? `<span style="width:50%;">GitHub：${escapeHtml(resume.profile.github)}</span>` : ''}
      </div>
    </div>
    ${photo ? `<img class="photo" src="${photo}" alt="个人照片">` : ''}
  </header>
  ${sectionsHtml}
</main>
</body>
</html>`
}

async function runScript(scriptName) {
  const { exec } = await import('child_process')
  const SCRIPT_PATHS = {
    'doctor': 'scripts/maintenance/doctor.mjs',
    'verify-pipeline': 'scripts/core/verify-pipeline.mjs',
    'cv-sync-check': 'scripts/cv/cv-sync-check.mjs',
    'merge-tracker': 'scripts/core/merge-tracker.mjs',
    'followup-cadence': 'scripts/jobs/followup-cadence.mjs',
  }
  const scriptPath = SCRIPT_PATHS[scriptName] || `${scriptName}.mjs`
  return new Promise((resolve, reject) => {
    exec(`node ${PROJECT_ROOT}/${scriptPath}`, { cwd: PROJECT_ROOT }, (error, stdout, stderr) => {
      if (error) {
        resolve({ success: false, output: stderr || error.message })
      } else {
        resolve({ success: true, output: stdout })
      }
    })
  })
}

async function checkUrlLiveness(url) {
  let browser = null
  try {
    browser = await launchBrowser()
    const page = await browser.newPage({
      locale: 'zh-CN',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36'
    })
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 })
    const status = response?.status() ?? 0
    
    await page.waitForTimeout(2000)
    
    const finalUrl = page.url()
    const bodyText = await page.evaluate(() => document.body?.innerText ?? '')
    const applyControls = await page.evaluate(() => {
      const candidates = Array.from(document.querySelectorAll('a, button, input[type="submit"], [role="button"]'))
      return candidates
        .filter(el => !el.closest('nav, header, footer'))
        .map(el => [el.innerText, el.value, el.getAttribute('aria-label'), el.getAttribute('title')]
          .filter(Boolean).join(' ').trim())
        .filter(Boolean)
    })

    let result = classifyLiveness({ status, finalUrl, bodyText, applyControls })
    
    if (result.result !== 'expired') {
      for (const pattern of CHINESE_EXPIRED_PATTERNS) {
        if (pattern.test(bodyText)) {
          result = { result: 'expired', reason: 'Chinese expired pattern matched' }
          break
        }
      }
    }

    if (result.result === 'uncertain') {
      for (const pattern of CHINESE_ACTIVE_PATTERNS) {
        if (pattern.test(bodyText)) {
          result = { result: 'active', reason: 'Chinese active pattern matched' }
          break
        }
      }
    }

    return {
      result: result.result === 'expired' ? 'closed' : result.result === 'active' ? 'active' : 'unconfirmed',
      reason: result.reason,
      confidence: bodyText.length > 500 ? 'high' : 'medium'
    }
  } catch (error) {
    return { result: 'error', reason: error.message, confidence: 'low' }
  } finally {
    if (browser) await browser.close()
  }
}

async function extractJD(url) {
  let browser = null
  try {
    browser = await launchBrowser()
    const page = await browser.newPage({
      locale: 'zh-CN',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36'
    })
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 })
    await page.waitForTimeout(3000)

    const title = await page.title()
    const bodyText = await page.evaluate(() => document.body?.innerText ?? '')
    const html = await page.content()
    const expiredPattern = findChineseExpiredPattern(bodyText)

    if (expiredPattern) {
      const error = new Error('job posting is closed')
      error.code = 'JOB_CLOSED'
      throw error
    }

    if (isSiteShellExtraction({ title, bodyText })) {
      throw new Error('extracted site shell instead of job detail')
    }

    let company = ''
    let role = ''

    const companyKeywords = ['公司', '科技', '集团', '股份', '有限', '实业', '软件', '电子', '技术', '研究院', '研究所', '中心', '大学', '学院']
    const roleKeywords = ['工程师', '开发', '岗位', '职位', '技术', '软件', '算法', '测试', '经理', '专员', '主管', '总监', '架构师']

    const companyPatterns = [
      /([\u4e00-\u9fa5a-zA-Z0-9]+(?:公司|科技|集团|股份有限公司|有限公司|科技公司))/i,
      /([\u4e00-\u9fa5a-zA-Z0-9]{2,}(?:科技|集团|实业|电子|软件|技术|研究院|研究所))/i,
      /([\u4e00-\u9fa5a-zA-Z0-9]{2,}[有限]?公司)/i,
      /招聘.*?(?:-|_|—|–|\s)\s*([\u4e00-\u9fa5a-zA-Z0-9]+(?:公司|科技|集团))/i
    ]

    for (const pattern of companyPatterns) {
      const match = title.match(pattern)
      if (match && match[1]) {
        const candidate = match[1].trim()
        const hasCompanyKeyword = companyKeywords.some(kw => candidate.includes(kw))
        const hasRoleKeyword = roleKeywords.some(kw => candidate.includes(kw))
        
        if (candidate.length >= 2 && hasCompanyKeyword && !hasRoleKeyword) {
          company = candidate
          break
        }
      }
    }

    const rolePatterns = [
      /【([^】]+)】/i,
      /([\u4e00-\u9fa5a-zA-Z0-9]+(?:工程师|开发|岗位|职位))/i,
      /(软件|开发|工程师|技术|算法|测试|产品|运营|财务|市场).*?(?:工程师|开发|岗位|职位|经理|专员|分析师)/i,
      /([\u4e00-\u9fa5a-zA-Z0-9]{2,}(?:技术|软件|产品|运营|财务|市场|分析))/i
    ]

    for (const pattern of rolePatterns) {
      const match = title.match(pattern)
      if (match && match[1]) {
        const candidate = match[1].trim()
        const hasCompanyKeyword = companyKeywords.some(kw => candidate.includes(kw))
        const hasRoleKeyword = roleKeywords.some(kw => candidate.includes(kw))
        
        if (candidate.length >= 2 && hasRoleKeyword && !hasCompanyKeyword) {
          role = candidate
          break
        }
      }
    }

    if (!role) {
      let cleanedTitle = title
        .replace(company, '')
        .replace(/【.*?】/g, '')
        .replace(/[-_|—|–]/g, ' ')
        .replace(/招聘/g, '')
        .trim()
      
      const parts = cleanedTitle.split(/\s+/).filter(p => p.length >= 2)
      if (parts.length > 0) {
        role = parts[0]
      }
    }

    if (!role) {
      role = title
    }

    const parsed = parseRawText(bodyText)

    const experiencePattern = /(?:经验|工作经验|从业经验|经验要求)[:：\s]*(\d+[\s-]*(?:-~至到)?[\s-]*\d*\s*年)/i
    const educationPattern = /(?:学历|学历要求|教育背景|学历背景)[:：\s]*(博士|硕士|本科|大专|高中|中专|不限)/i
    
    const experienceMatch = bodyText.match(experiencePattern)
    const educationMatch = bodyText.match(educationPattern)

    return {
      title: role,
      company: company,
      role: role,
      raw_text: bodyText,
      html: html,
      url: url,
      extracted_at: new Date().toISOString(),
      salary: parsed?.salary || '',
      location: parsed?.location || '',
      experience: experienceMatch ? experienceMatch[1] : '',
      education: educationMatch ? educationMatch[1] : ''
    }
  } catch (error) {
    throw new Error(`JD extraction failed: ${error.message}`)
  } finally {
    if (browser) await browser.close()
  }
}

function generateJDMarkdown(job) {
  const date = new Date().toISOString().split('T')[0]
  const slug = `${safeSlug(job.company, 'unknown')}-${safeSlug(job.title, 'job')}-${date}`
  const path = `${PROJECT_ROOT}/jds/${slug}.md`
  
  const content = `# ${job.company || 'Unknown'} - ${job.title || 'Unknown'}

**URL:** ${job.url}
**Location:** ${job.location || '-'}
**Source:** ${job.source_type || 'manual_url'}
**Extracted:** ${job.extracted_at || date}
**Liveness:** ${job.liveness_status || 'unknown'}

## Job Description

${job.raw_text ? job.raw_text.substring(0, 2000) : 'No content available'}

## Keywords

_To be filled by AI evaluation_
`
  
  writeFileSync(path, content, 'utf-8')
  return path
}

function isOfficialUrl(url, company) {
  const hostname = getHostname(url)
  if (!hostname) return false
  const domains = company.domains?.length
    ? company.domains
    : [...(company.career_urls || []), company.official_homepage].map(getHostname).filter(Boolean)
  return domains.some((domain) => hostname === domain.replace(/^www\./, '') || hostname.endsWith(`.${domain.replace(/^www\./, '')}`))
}

function looksLikeJobLink(link, keywords, negativeKeywords) {
  const linkText = `${link.text || ''} ${link.title || ''}`.trim()
  const genericText = /^(查看更多|更多|详情|查看|登录|注册|隐私政策|校园招聘|社会招聘|招聘首页|职位列表|加入我们)$/i.test(linkText)
  const parsedUrl = (() => {
    try {
      const url = new URL(link.href)
      return `${url.pathname} ${url.search} ${url.hash}`
    } catch {
      return link.href || ''
    }
  })()
  const haystack = `${linkText} ${parsedUrl}`.toLowerCase()
  if (!link.href || !/^https?:\/\//i.test(link.href)) return false
  if (negativeKeywords.some((keyword) => haystack.includes(keyword.toLowerCase()))) return false
  if (genericText && !keywords.some((keyword) => haystack.includes(keyword.toLowerCase()))) return false

  const positiveMatch = keywords.some((keyword) => haystack.includes(keyword.toLowerCase()))
  const jobShapeMatch = /job|jobs|position|career|careers|recruit|recruitment|campus|hire|zhiye|zhaopin|岗位|职位|校招|社招|实习|工程师|开发|固件|驱动|算法|测试|engineer|developer/i.test(haystack)
  const specificRoleMatch = /岗位|职位|实习|工程师|开发|固件|驱动|算法|测试|engineer|developer|intern/i.test(haystack)
  const careerPathPattern = /\/(career|careers|recruit|recruitment|job|jobs|position|positions|campus|employment|joinus|hr|zhaopin|zhiye)\/?/i
  const careerPathMatch = careerPathPattern.test(parsedUrl)
  return jobShapeMatch && specificRoleMatch && (positiveMatch || !genericText || careerPathMatch)
}

function inferJobTitle(link, company) {
  const raw = (link.text || link.title || '').replace(/\s+/g, ' ').trim()
  if (!raw) return '官网岗位链接'
  return raw
    .replace(company.name, '')
    .replace(/查看详情|详情|申请|投递|立即申请|职位详情/gi, '')
    .trim()
    .slice(0, 80) || raw.slice(0, 80)
}

async function extractLinksFromPage(page, company, keywords, negativeKeywords, sourceUrl) {
  const links = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a[href]')).map((anchor) => ({
      text: anchor.innerText || anchor.textContent || '',
      title: anchor.getAttribute('title') || anchor.getAttribute('aria-label') || '',
      href: anchor.href
    }))
  }).catch(() => [])

  const candidates = []
  for (const link of links) {
    if (!isOfficialUrl(link.href, company)) continue
    if (!looksLikeJobLink(link, keywords, negativeKeywords)) continue
    candidates.push({
      id: generateId(),
      company_id: company.id,
      company: company.name,
      title: inferJobTitle(link, company),
      url: link.href.split('#')[0],
      source_url: sourceUrl,
      source_type: 'official_site',
      location: '',
      publish_date: '',
      discovered_at: new Date().toISOString(),
      liveness_status: 'unknown',
      liveness_confidence: 'low',
      liveness_reason: ''
    })
  }

  return candidates
}

async function extractJobCardsFromPage(page, company, keywords, negativeKeywords, sourceUrl) {
  const pageUrl = page.url()
  const cards = await page.evaluate(() => {
    const selectors = [
      '.content-item',
      '[class*="job" i]',
      '[class*="position" i]',
      '[class*="post" i]',
      '[class*="list-item" i]',
      '[class*="item" i]'
    ]
    return Array.from(document.querySelectorAll(selectors.join(', ')))
      .map(node => (node.innerText || node.textContent || '').trim())
      .filter(text => text.length >= 12 && text.length <= 800)
  }).catch(() => [])

  const results = []
  for (const text of uniq(cards)) {
    const lower = text.toLowerCase()
    if (negativeKeywords.some(keyword => lower.includes(keyword.toLowerCase()))) continue
    if (!keywords.some(keyword => lower.includes(keyword.toLowerCase()))) continue
    if (!/工作地点[:：]/.test(text)) continue
    if (!/工程师|开发|intern|engineer/i.test(text)) continue

    const lines = text.split('\n').map(line => line.trim()).filter(Boolean)
    const title = lines.find(line => /工程师|开发|intern|engineer/i.test(line)) || lines[0]
    const locationMatch = text.match(/工作地点[:：]\s*([^\n]+)/)

    results.push({
      id: generateId(),
      company_id: company.id,
      company: company.name,
      title: title.slice(0, 100),
      url: `${pageUrl.split('#')[0]}#${encodeURIComponent(safeSlug(title, 'job'))}`,
      source_url: sourceUrl,
      source_type: 'official_site_card',
      location: locationMatch ? locationMatch[1].trim().slice(0, 120) : '',
      publish_date: '',
      description: text,
      raw_text: text,
      discovered_at: new Date().toISOString(),
      liveness_status: 'active',
      liveness_confidence: 'medium',
      liveness_reason: 'Extracted from visible official job list card'
    })
  }
  return results
}

async function openJobSearchSurface(page) {
  const searchTexts = ['搜索职位', '职位搜索', '招聘职位', '查看职位', '加入我们', '职位列表']
  for (const text of searchTexts) {
    const locator = page.getByText(text, { exact: true }).first()
    const count = await locator.count().catch(() => 0)
    if (!count) continue
    await locator.click({ timeout: 8000 }).catch(() => null)
    await page.waitForTimeout(3000)
    return true
  }
  return false
}

async function tryKeywordSearch(page, keyword) {
  const selector = [
    'input[type="search"]',
    'input[placeholder*="搜索"]',
    'input[placeholder*="职位"]',
    'input[placeholder*="岗位"]',
    'input[placeholder*="关键"]',
    'input[placeholder*="keyword" i]',
    'input[placeholder*="job" i]'
  ].join(', ')

  const input = page.locator(selector).first()
  const count = await input.count().catch(() => 0)
  if (!count) return false

  await input.fill(keyword, { timeout: 5000 }).catch(() => null)
  await input.press('Enter', { timeout: 5000 }).catch(() => null)
  await page.waitForTimeout(2500)
  return true
}

async function discoverOfficialJobs(company, rawKeywords) {
  const keywords = uniq([
    ...parseKeywordList(rawKeywords),
    ...(company.keywords || [])
  ])
  const negativeKeywords = company.negative_keywords || []
  const sourceUrls = company.career_urls?.length ? company.career_urls : [company.official_homepage].filter(Boolean)
  const candidates = new Map()
  const errors = []
  let browser = null

  try {
    browser = await launchBrowser()
    const page = await browser.newPage({
      locale: 'zh-CN',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36'
    })

    for (const sourceUrl of sourceUrls) {
      try {
        await page.goto(sourceUrl, { waitUntil: 'domcontentloaded', timeout: 45000 })
        await page.waitForTimeout(2500)
        await openJobSearchSurface(page)
        const initialLinks = await extractLinksFromPage(page, company, keywords, negativeKeywords, sourceUrl)
        for (const job of initialLinks) candidates.set(job.url, job)
        const initialCards = await extractJobCardsFromPage(page, company, keywords, negativeKeywords, sourceUrl)
        for (const job of initialCards) candidates.set(job.url, job)

        for (const keyword of keywords.slice(0, 4)) {
          try {
            await page.goto(sourceUrl, { waitUntil: 'domcontentloaded', timeout: 45000 })
            await page.waitForTimeout(1500)
            await openJobSearchSurface(page)
            const searched = await tryKeywordSearch(page, keyword)
            if (!searched) {
              const visibleCards = await extractJobCardsFromPage(page, company, [keyword], negativeKeywords, sourceUrl)
              for (const job of visibleCards) candidates.set(job.url, job)
              continue
            }
            const searchLinks = await extractLinksFromPage(page, company, [keyword], negativeKeywords, sourceUrl)
            for (const job of searchLinks) candidates.set(job.url, job)
            const searchCards = await extractJobCardsFromPage(page, company, [keyword], negativeKeywords, sourceUrl)
            for (const job of searchCards) candidates.set(job.url, job)
          } catch (error) {
            errors.push(`${company.name} ${keyword}: ${error.message}`)
          }
        }
      } catch (error) {
        errors.push(`${sourceUrl}: ${error.message}`)
      }
    }
  } finally {
    if (browser) await browser.close()
  }

  const jobs = [...candidates.values()].slice(0, 30)
  for (const job of jobs.slice(0, 12)) {
    if (job.source_type === 'official_site_card') continue
    const liveness = await checkUrlLiveness(job.url)
    job.liveness_status = liveness.result
    job.liveness_confidence = liveness.confidence
    job.liveness_reason = liveness.reason
    job.liveness_checked_at = new Date().toISOString()
  }

  return {
    jobs: jobs.filter((job) => job.liveness_status !== 'closed'),
    errors
  }
}

const WEB_SEARCH_EXCLUDED_HOSTS = [
  'bing.com',
  'baidu.com',
  'google.com',
  'sogou.com',
  'so.com',
  '360.cn',
  'zhihu.com',
  'csdn.net',
  'cnblogs.com',
  'bilibili.com'
]

const JOB_SEARCH_HINTS = ['工程师', '招聘', '职位', '岗位', '校招', '社招']
const JOB_BOARD_HOSTS = ['zhipin.com', '51job.com', 'liepin.com', 'lagou.com', 'yingjiesheng.com', 'ncss.cn']
const INVALID_COMPANY_PATTERNS = [
  /^NCSS$/i,
  /^N\/A$/i,
  /^未知公司$/,
  /^\d+[、,.，。]?$/,
  /包括数据/,
  /电子.*通信/,
  /计算机.*电子/,
  /电子信息/,
  /student|jobs|detail|http|›|\.\.\./i
]

function normalizeSearchResultUrl(href) {
  try {
    const url = new URL(href)
    if (url.hostname.includes('bing.com') && url.pathname === '/ck/a') {
      const target = url.searchParams.get('u')
      if (target) {
        const decoded = Buffer.from(target.replace(/^a1/, ''), 'base64').toString('utf-8')
        return decoded.startsWith('http') ? decoded : href
      }
    }
    return url.href
  } catch {
    return ''
  }
}

function cleanSearchTitle(title) {
  return String(title || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .pop()
    .replace(/\s*[-_|]\s*(招聘|猎聘|BOSS直聘|前程无忧|智联招聘|应届生求职网).*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
}

/**
 * 从 direction 动态生成方向搜索词
 * - 核心岗位词（direction 本身 + 同义变体）
 * - 宽泛兜底词（工程师、招聘等通用词）
 */
function buildDirectionTerms(direction) {
  if (!direction || !direction.trim()) return { direction_terms: [], broad_terms: [] }
  const d = direction.trim()
  // 基于方向生成同义/近义变体
  const direction_terms = uniq([
    d,
    `${d}工程师`,
    `${d}开发`,
    `${d}岗位`,
  ])
  // 宽泛兜底词
  const broad_terms = ['软件工程师', '开发工程师', '技术岗位']
  return { direction_terms, broad_terms }
}

function buildJobSearchQueries(rawKeywords, options = {}) {
  const { direction, city, enterpriseType, jobLevel } = options
  const keywords = parseKeywordList(rawKeywords)

  // 如果有 direction，动态扩展关键词
  let searchTerms = keywords.join(' ').trim()
  const locationTag = city && city !== '不限' && city !== '全国' ? city : ''

  if (direction && direction.trim()) {
    const { direction_terms, broad_terms } = buildDirectionTerms(direction)
    // 用方向词替换原始关键词作为搜索基础
    searchTerms = direction_terms.slice(0, 3).join(' ')
    // 混入宽泛词扩展搜索覆盖面
    const broadBase = broad_terms[0]
    if (!searchTerms.includes(broadBase)) {
      searchTerms = `${searchTerms} ${broadBase}`
    }
  }

  const base = searchTerms
  const baseWithCity = locationTag ? `${base} ${locationTag}` : base

  // 根据职位层级调整搜索词
  let levelHint = ''
  if (jobLevel && jobLevel !== '不限') {
    if (jobLevel === '实习') levelHint = '实习'
    else if (jobLevel === '校招/应届') levelHint = '校招 应届'
    else if (jobLevel.includes('初级')) levelHint = '初级 1-3年'
    else if (jobLevel.includes('中级')) levelHint = '中级 3-5年'
    else if (jobLevel.includes('高级') || jobLevel.includes('资深')) levelHint = '高级 资深'
  }

  // 根据企业类型调整搜索词
  let entTypeHint = ''
  if (enterpriseType && enterpriseType !== '不限') {
    if (enterpriseType === '国企央企') entTypeHint = '国企 央企'
    else if (enterpriseType === '民营名企') entTypeHint = '名企 上市'
    else if (enterpriseType === '外企') entTypeHint = '外企 跨国'
  }

  const primary = keywords.length === 1 && !JOB_SEARCH_HINTS.some((hint) => base.includes(hint))
    ? `${baseWithCity} 工程师 招聘 职位 ${levelHint} 社招`
    : `${baseWithCity} 招聘 职位 ${levelHint} 社招`

  return uniq([
    primary,
    `${baseWithCity} ${levelHint} 招聘 企业 ${entTypeHint} -知乎 -CSDN`,
    `${baseWithCity} ${levelHint} 校招 社招`,
    `${baseWithCity} site:zhipin.com`,
    `${baseWithCity} site:51job.com`,
    `${baseWithCity} site:liepin.com`,
    `${baseWithCity} site:yingjiesheng.com`,
    `${base} careers site:*.com`,
    `${base} 招聘官网 site:*.com`,
    `${base} site:*.com/careers`,
    `${base} site:*.com/recruitment`,
    `${base} site:*.com/job`,
    `${base} site:job.*.com`,
    `${base} site:careers.*.com`
  ]).filter((query) => query.trim().length > 0)
}

function isLikelyCompanyName(value) {
  const name = String(value || '').trim()
  if (name.length < 2 || name.length > 40) return false
  if (INVALID_COMPANY_PATTERNS.some((pattern) => pattern.test(name))) return false
  if (/^[A-Z]{2,8}$/.test(name) && !['DJI', 'BYD', 'ZTE'].includes(name)) return false
  return /公司|集团|股份|科技|技术|电子|智能|汽车|医疗|通信|电气|自动化|机器人|半导体/.test(name)
}

function inferCompanyFromSearchResult(result) {
  const title = String(result.title || '')
  const snippet = String(result.snippet || '')
  const patterns = [
    /([\u4e00-\u9fa5A-Za-z0-9（）()]{2,40}(?:公司|集团|股份有限公司|科技有限公司|技术有限公司|电子有限公司|智能科技|汽车|医疗|通信|电气|自动化|机器人|半导体))/,
    /(?:公司|企业)[:：]\s*([\u4e00-\u9fa5A-Za-z0-9（）()]{2,40})/
  ]
  for (const pattern of patterns) {
    const match = `${title} ${snippet}`.match(pattern)
    if (match?.[1] && isLikelyCompanyName(match[1])) return match[1].trim()
  }
  return ''
}

function looksLikeWebJobResult(result, keywords) {
  const url = normalizeSearchResultUrl(result.url)
  const host = getHostname(url)
  if (!url || !/^https?:\/\//i.test(url)) return false
  if (WEB_SEARCH_EXCLUDED_HOSTS.some((excluded) => host === excluded || host.endsWith(`.${excluded}`))) return false

  const haystack = `${result.title || ''} ${result.snippet || ''} ${url}`.toLowerCase()
  const positiveMatch = keywords.some((keyword) => haystack.includes(keyword.toLowerCase()))
  const jobShapeMatch = /招聘|职位|岗位|校招|社招|实习|career|careers|job|jobs|position|recruit/i.test(haystack)
  return positiveMatch && jobShapeMatch
}

async function extractSearchResultsFromPage(page, keywords) {
  const rawResults = await page.evaluate(() => {
    const containers = Array.from(document.querySelectorAll('li.b_algo, .b_algo, article, .result, .c-container'))
    return containers.map((container) => {
      const anchor = container.querySelector('h2 a[href], h3 a[href], a[href]')
      const title = anchor?.innerText || ''
      const url = anchor?.href || ''
      const snippet = Array.from(container.querySelectorAll('p, .b_caption, .c-abstract, .content-right_8Zs40'))
        .map((node) => node.innerText || '')
        .find(Boolean) || container.innerText || ''
      return { title, url, snippet }
    }).filter((result) => result.title && result.url)
  })

  const results = []
  const seen = new Set()
  for (const result of rawResults) {
    const url = normalizeSearchResultUrl(result.url)
    if (seen.has(url)) continue
    const normalized = { ...result, url }
    if (!looksLikeWebJobResult(normalized, keywords)) continue
    seen.add(url)
    results.push(normalized)
  }
  return results
}

function buildCompanyDiscoveryPrompt(rawKeywords) {
  const keywords = parseKeywordList(rawKeywords).join(', ')
  return `你是中国岗位搜索助手。请根据关键词给出适合继续官网招聘页扫描的中国公司候选。

只返回 JSON，不要 Markdown。不要编造具体岗位，只给公司和官网招聘入口候选。
JSON schema:
{
  "companies": [
    {
      "name": "公司中文名",
      "aliases": ["英文名或简称"],
      "industry_tags": ["行业标签"],
      "official_homepage": "https://...",
      "career_urls": ["https://..."],
      "keywords": ["关键词"],
      "locations": ["城市"],
      "confidence": "high | medium | low",
      "reason": "为什么适合这些关键词"
    }
  ]
}

要求：
- 面向关键词所指定的专业方向和岗位类型，不要局限于某个特定行业。
- 优先给公司官网或官方招聘入口，不要给培训机构、论坛、博客。
- 公司数量 15-20 个，覆盖关键词相关行业领域，不要集中在同一类公司。
- 如果不确定招聘入口，可以只给 official_homepage，career_urls 留空。

关键词：${keywords}`
}

function normalizeDiscoveredCompanies(result, rawKeywords) {
  const fallbackKeywords = parseKeywordList(rawKeywords)
  const companies = Array.isArray(result?.companies) ? result.companies : []
  return companies
    .filter((company) => company?.name)
    .map((company) => normalizeCompany({
      id: safeSlug(company.name, 'company'),
      name: company.name,
      aliases: Array.isArray(company.aliases) ? company.aliases : [],
      industry_tags: Array.isArray(company.industry_tags) ? company.industry_tags : [],
      official_homepage: company.official_homepage || '',
      career_urls: Array.isArray(company.career_urls) ? company.career_urls.filter(Boolean) : [],
      domains: uniq([company.official_homepage, ...(company.career_urls || [])].map(getHostname).filter(Boolean)),
      source_type: 'ai_company_discovery',
      keywords: Array.isArray(company.keywords) && company.keywords.length ? company.keywords : fallbackKeywords,
      negative_keywords: ['销售', '财务', '人力', '市场'],
      locations: Array.isArray(company.locations) ? company.locations : [],
      enabled: true,
      created_at: new Date().toISOString(),
      confidence: company.confidence || 'medium',
      reason: company.reason || ''
    }))
}

async function discoverCompaniesWithAi(rawKeywords) {
  try {
    const response = await callChatCompletions('deepseek', buildCompanyDiscoveryPrompt(rawKeywords))
    return { companies: normalizeDiscoveredCompanies(extractJsonObject(response.content), rawKeywords), error: '' }
  } catch (error) {
    return { error: error.message, companies: [] }
  }
}

function mergeCompanyRecords(existing, incoming) {
  const merged = [...existing]
  let added = 0
  let updated = 0

  for (const company of incoming) {
    const normalized = normalizeCompany(company)
    const normalizedDomains = normalized.domains || []
    const index = merged.findIndex((item) => {
      const sameName = item.name === normalized.name || (item.aliases || []).includes(normalized.name)
      const sameDomain = (item.domains || []).some((domain) => normalizedDomains.includes(domain))
      return sameName || sameDomain
    })

    if (index === -1) {
      merged.push(normalized)
      added++
      continue
    }

    const current = merged[index]
    merged[index] = normalizeCompany({
      ...current,
      aliases: uniq([...(current.aliases || []), ...(normalized.aliases || [])]),
      industry_tags: uniq([...(current.industry_tags || []), ...(normalized.industry_tags || [])]),
      career_urls: uniq([...(current.career_urls || []), ...(normalized.career_urls || [])]),
      domains: uniq([...(current.domains || []), ...(normalized.domains || [])]),
      keywords: uniq([...(current.keywords || []), ...(normalized.keywords || [])]),
      locations: uniq([...(current.locations || []), ...(normalized.locations || [])]),
      official_homepage: current.official_homepage || normalized.official_homepage,
      updated_at: new Date().toISOString()
    })
    updated++
  }

  return { companies: merged, added, updated }
}

async function discoverWebJobs(rawKeywords, options = {}) {
  const keywords = parseKeywordList(rawKeywords)
  if (keywords.length === 0 && !options.direction?.trim()) {
    return { jobs: [], companies: [], errors: ['请先输入岗位关键词'] }
  }

  const queries = buildJobSearchQueries(rawKeywords, options)
  const candidates = new Map()
  const discoveredCompanies = []
  const hostCounts = new Map()
  const errors = []
  let browser = null

  try {
    browser = await launchBrowser()
    const page = await browser.newPage({
      locale: 'zh-CN',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36'
    })

    for (const query of queries.slice(0, 4)) {
      const searchUrl = `https://www.bing.com/search?${stringify({ q: query, mkt: 'zh-CN', setlang: 'zh-CN' })}`
      try {
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 45000 })
        await page.waitForTimeout(2000)

        const results = await extractSearchResultsFromPage(page, keywords)
        for (const result of results.slice(0, 12)) {
          const title = cleanSearchTitle(result.title)
          const company = inferCompanyFromSearchResult(result)
          const host = getHostname(result.url)
          const isJobBoard = JOB_BOARD_HOSTS.some((boardHost) => host === boardHost || host.endsWith(`.${boardHost}`))
          const hostCount = hostCounts.get(host) || 0
          if (hostCount >= 3) continue
          if (!isLikelyCompanyName(company)) continue

          if (company) {
            discoveredCompanies.push(normalizeCompany({
              id: safeSlug(company, 'web-company'),
              name: company,
              official_homepage: isJobBoard ? '' : `https://${host}`,
              career_urls: [result.url],
              domains: [host],
              source_type: 'web_search',
              keywords,
              negative_keywords: ['销售', '财务', '人力', '市场'],
              enabled: true,
              created_at: new Date().toISOString()
            }))
          }
          hostCounts.set(host, hostCount + 1)
          candidates.set(result.url, {
            id: generateId(),
            company_id: safeSlug(company, 'web-company'),
            company,
            title: title || result.title.slice(0, 120),
            url: result.url,
            source_url: searchUrl,
            source_type: 'web_search',
            location: '',
            publish_date: '',
            description: result.snippet.slice(0, 2000),
            raw_text: `${result.title}\n${result.snippet}`.trim(),
            discovered_at: new Date().toISOString(),
            liveness_status: 'unconfirmed',
            liveness_confidence: 'low',
            liveness_reason: 'Discovered from keyword web search; extract JD to verify details'
          })
        }
      } catch (error) {
        errors.push(`${query}: ${error.message}`)
      }
    }
  } catch (error) {
    errors.push(error.message)
  } finally {
    if (browser) await browser.close()
  }

  const aiDiscovery = await discoverCompaniesWithAi(rawKeywords)
  if (aiDiscovery.error) {
    errors.push(`DeepSeek 公司发现失败：${aiDiscovery.error}`)
  }
  discoveredCompanies.push(...aiDiscovery.companies)

  const jobs = [...candidates.values()]
  for (const job of jobs.slice(0, 8)) {
    const liveness = await checkUrlLiveness(job.url)
    job.liveness_status = liveness.result
    job.liveness_confidence = liveness.confidence
    job.liveness_reason = liveness.reason
    job.liveness_checked_at = new Date().toISOString()
  }

  return {
    jobs: jobs.filter((job) => job.liveness_status !== 'closed'),
    companies: discoveredCompanies,
    errors
  }
}

function appendToPipeline(url, company, title) {
  const pipelinePath = `${PROJECT_ROOT}/data/pipeline.md`
  let content = existsSync(pipelinePath) ? readFileSync(pipelinePath, 'utf-8') : ''
  
  const marker = '## Pendientes'
  if (!content.includes(marker)) {
    content = `${marker}\n\n` + content
  }
  
  const line = `- [ ] ${url} | ${company} | ${title}`
  if (!content.includes(url)) {
    content = content.replace(marker, `${marker}\n${line}`)
    writeFileSync(pipelinePath, content, 'utf-8')
  }
}

function generateTrackerTSV(job, reportPath) {
  const date = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' })
  const slug = safeSlug(job.company, 'unknown')
  const num = Date.now()
  const reportField = reportPath ? `[${num}](${reportPath})` : ''
  const tsv = `${num}\t${date}\t${(job.company || '未知公司').replace(/\t/g, ' ').replace(/\n/g, ' ')}\t${(job.title || '未知岗位').replace(/\t/g, ' ').replace(/\n/g, ' ')}\tEvaluated\t${job.score || 'N/A'}/5\t❌\t${reportField}\t自动从岗位雷达添加\n`
  
  const dir = `${PROJECT_ROOT}/batch/tracker-additions`
  const fileName = `${num}-${slug}.tsv`
  writeFileSync(`${dir}/${fileName}`, tsv, 'utf-8')
  return fileName
}

function parseMultipartForm(data) {
  const boundary = data.split('\r\n')[0]
  const parts = data.split(boundary).filter(p => p.trim())
  const result = {}
  
  for (const part of parts) {
    const match = part.match(/name="([^"]+)"/)
    if (match) {
      const name = match[1]
      const value = part.split('\r\n\r\n')[1]?.replace(/\r\n--$/, '')?.trim()
      result[name] = value
    }
  }
  
  return result
}

const routes = {
  '/api/onboarding': {
    GET: async () => {
      const cache = loadOnboardingCache()
      return {
        success: true,
        data: {
          cv: existsSync(`${PROJECT_ROOT}/cv.md`),
          profile: existsSync(`${PROJECT_ROOT}/config/profile.yml`),
          portals: existsSync(PORTALS_FILE),
          resume_profile: existsSync(RESUME_PROFILE_FILE),
          form: cache
        }
      }
    },
    POST: async (body) => {
      const result = saveOnboardingFiles(body || {})
      return { success: true, data: result }
    }
  },
  '/api/health': {
    GET: async () => {
      const checks = {
        node: { status: 'pass', message: 'Node.js environment OK' },
        project: { status: 'pass', message: 'Project root accessible' },
        cv: { status: existsSync(`${PROJECT_ROOT}/cv.md`) ? 'pass' : 'warn', message: existsSync(`${PROJECT_ROOT}/cv.md`) ? 'cv.md exists' : 'cv.md not found (optional in desensitized mode)' },
        profile: { status: existsSync(`${PROJECT_ROOT}/config/profile.yml`) ? 'pass' : 'warn', message: existsSync(`${PROJECT_ROOT}/config/profile.yml`) ? 'profile.yml exists' : 'profile.yml not found' },
        portals: { status: existsSync(PORTALS_FILE) ? 'pass' : 'warn', message: existsSync(PORTALS_FILE) ? 'portals.yml exists' : 'portals.yml not found (optional in desensitized mode)' },
        data: { status: 'pass', message: 'Data directories OK' }
      }
      return { success: true, data: checks }
    }
  },
  '/api/health/doctor': {
    POST: async () => {
      const result = await runScript('doctor')
      const checks = {
        doctor: { status: result.success ? 'pass' : 'fail', message: result.output.substring(0, 200) }
      }
      return { success: true, data: checks }
    }
  },
  '/api/health/verify': {
    POST: async () => {
      const result = await runScript('verify-pipeline')
      return { success: result.success, data: { output: result.output } }
    }
  },
  '/api/health/sync-check': {
    POST: async () => {
      const result = await runScript('cv-sync-check')
      return { success: result.success, data: { output: result.output } }
    }
  },
  '/api/ai/providers': {
    GET: async () => {
      return { success: true, data: getAvailableAiProviders() }
    }
  },
  '/api/ai/settings': {
    GET: async () => {
      return { success: true, data: getAiSettings() }
    },
    POST: async (body) => {
      return { success: true, data: saveAiSettings(body || {}) }
    }
  },
  '/api/resume/profile': {
    GET: async () => {
      return { success: true, data: getResumeProfile() }
    },
    POST: async (body) => {
      return { success: true, data: saveResumeProfile(body || {}) }
    }
  },
  '/api/resume/modules': {
    GET: async () => {
      const profile = getResumeProfile()
      return { success: true, data: normalizeResumeModules(profile.modules) }
    },
    POST: async (body) => {
      const profile = getResumeProfile()
      const modules = normalizeResumeModules(profile.modules)
      const moduleType = body.type || 'custom'
      if (body.id === 'paper') return { success: false, error: '该内置模块已停用' }
      const newModule = {
        id: body.id || `custom-${generateId()}`,
        name: body.name || '自定义模块',
        type: moduleType,
        enabled: body.enabled !== false,
        ...(moduleType === 'custom' ? { content: body.content || '' } : {})
      }
      modules.push(newModule)
      profile.modules = modules
      writeFileSync(RESUME_PROFILE_FILE, JSON.stringify(profile, null, 2), 'utf-8')
      return { success: true, data: newModule }
    },
    PUT: async (body) => {
      const profile = getResumeProfile()
      if (!Array.isArray(body)) return { success: false, error: 'modules must be an array' }
      profile.modules = normalizeResumeModules(body)
      writeFileSync(RESUME_PROFILE_FILE, JSON.stringify(profile, null, 2), 'utf-8')
      return { success: true, data: profile.modules }
    }
  },
  '/api/resume/modules/:id': {
    PATCH: async (body, params) => {
      if (params.id === 'paper') return { success: false, error: '该内置模块已停用' }
      const profile = getResumeProfile()
      const modules = normalizeResumeModules(profile.modules)
      const index = modules.findIndex(m => m.id === params.id)
      if (index === -1) return { success: false, error: 'Module not found' }
      modules[index] = { ...modules[index], ...body }
      profile.modules = modules
      writeFileSync(RESUME_PROFILE_FILE, JSON.stringify(profile, null, 2), 'utf-8')
      return { success: true, data: modules[index] }
    },
    DELETE: async (_, params) => {
      const profile = getResumeProfile()
      const modules = normalizeResumeModules(profile.modules)
      const filtered = modules.filter(m => m.id !== params.id)
      if (filtered.length === modules.length) return { success: false, error: 'Module not found' }
      profile.modules = filtered
      writeFileSync(RESUME_PROFILE_FILE, JSON.stringify(profile, null, 2), 'utf-8')
      return { success: true }
    }
  },
  '/api/resume/modules/:id/data': {
    PATCH: async (body, params) => {
      const profile = saveResumeModuleData(params.id, body || {})
      return { success: true, data: profile }
    }
  },
  '/api/companies': {
    GET: async () => {
      return { success: true, data: readCompanies() }
    },
    POST: async (body) => {
      const companies = readCompanies()
      const newCompany = normalizeCompany({ id: body.id || safeSlug(body.name, generateId()), ...body, created_at: new Date().toISOString() })
      forgetDeletedCompany(newCompany)
      companies.push(newCompany)
      writeCompanies(companies)
      return { success: true, data: newCompany }
    },
    DELETE: async (body) => {
      const { ids } = body
      if (!ids || !Array.isArray(ids)) {
        return { success: false, error: 'ids array is required' }
      }
      const companies = readCompanies()
      const idSet = new Set(ids)
      const toDelete = companies.filter(c => idSet.has(c.id))
      for (const company of toDelete) {
        rememberDeletedCompany(company)
      }
      const filtered = companies.filter(c => !idSet.has(c.id))
      writeCompanies(filtered)
      return { success: true, data: { deletedCount: toDelete.length } }
    }
  },
  '/api/companies/batch-delete': {
    POST: async (body) => {
      const { ids } = body
      if (!ids || !Array.isArray(ids)) {
        return { success: false, error: 'ids array is required' }
      }
      const companies = readCompanies()
      const idSet = new Set(ids)
      const toDelete = companies.filter(c => idSet.has(c.id))
      for (const company of toDelete) {
        rememberDeletedCompany(company)
      }
      const filtered = companies.filter(c => !idSet.has(c.id))
      writeCompanies(filtered)
      return { success: true, data: { deletedCount: toDelete.length } }
    }
  },
  '/api/companies/:id': {
    PATCH: async (body, params) => {
      const companies = readCompanies()
      const index = companies.findIndex(c => c.id === params.id)
      if (index === -1) return { success: false, error: 'Company not found' }
      companies[index] = normalizeCompany({ ...companies[index], ...body, updated_at: new Date().toISOString() })
      writeCompanies(companies)
      return { success: true, data: companies[index] }
    },
    DELETE: async (_, params) => {
      const companies = readCompanies()
      const target = companies.find(c => c.id === params.id)
      if (!target) return { success: false, error: 'Company not found' }
      rememberDeletedCompany(target)
      const filtered = companies.filter(c => c.id !== params.id)
      writeCompanies(filtered)
      return { success: true }
    }
  },
  '/api/jobs': {
    GET: async (_, __, query) => {
      const jobs = readJsonl(JOBS_FILE).map(normalizeStoredLiveness)
      let result = jobs
      if (query.status) {
        result = result.filter(j => j.liveness_status === query.status)
      }
      if (query.company) {
        const keyword = query.company.toLowerCase()
        result = result.filter(j => (j.company || '').toLowerCase().includes(keyword))
      }
      if (query.has_score === 'true') {
        result = result.filter(j => j.score != null)
      }
      const sort = query.sort || 'discovered_at'
      const dir = query.dir === 'asc' ? 1 : -1
      result.sort((a, b) => {
        const va = a[sort] ?? ''
        const vb = b[sort] ?? ''
        if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir
        return String(va).localeCompare(String(vb)) * dir
      })
      const limit = Math.min(parseInt(query.limit, 10) || 200, 500)
      const offset = parseInt(query.offset, 10) || 0
      const total = result.length
      result = result.slice(offset, offset + limit).map(j => {
        const { raw_text, html, description, ...summary } = j
        return {
          ...summary,
          enterprise_type: summary.enterprise_type || inferEnterpriseType(summary.company)
        }
      })
      return { success: true, data: result, meta: { total, offset, limit } }
    },
    DELETE: async (body) => {
      const { ids } = body
      if (!ids || !Array.isArray(ids)) {
        return { success: false, error: 'ids array is required' }
      }
      const jobs = readJsonl(JOBS_FILE)
      const idSet = new Set(ids)
      const filtered = jobs.filter(j => !idSet.has(j.id))
      const deletedCount = jobs.length - filtered.length
      writeJsonl(JOBS_FILE, filtered)
      return { success: true, data: { deletedCount } }
    }
  },
  '/api/jobs/batch-delete': {
    POST: async (body) => {
      const { ids } = body
      if (!ids || !Array.isArray(ids)) {
        return { success: false, error: 'ids array is required' }
      }
      const jobs = readJsonl(JOBS_FILE)
      const idSet = new Set(ids)
      const filtered = jobs.filter(j => !idSet.has(j.id))
      const deletedCount = jobs.length - filtered.length
      writeJsonl(JOBS_FILE, filtered)
      return { success: true, data: { deletedCount } }
    }
  },
  '/api/jobs/batch-add': {
    POST: async (body) => {
      const { jobs: newJobs } = body
      if (!newJobs || !Array.isArray(newJobs)) {
        return { success: false, error: 'jobs array is required' }
      }
      
      const existingJobs = readJsonl(JOBS_FILE)
      const existingUrls = new Set(existingJobs.map(j => j.url?.split('#')[0]?.replace(/\/+$/, '') || j.url))
      
      let addedCount = 0
      let skippedCount = 0
      for (const job of newJobs) {
        const imported = normalizeImportedJob(job)
        if (!imported.url) continue
        const importedLiveness = getImportedLiveness(imported)
        
        const normalizedUrl = imported.url.split('#')[0].replace(/\/+$/, '')
        if (existingUrls.has(normalizedUrl)) {
          const existingJob = existingJobs.find(j => (j.url?.split('#')[0]?.replace(/\/+$/, '') || j.url) === normalizedUrl)
          if (existingJob) {
            if (isWeakJobText(existingJob.company) && imported.company) existingJob.company = imported.company
            if (isWeakJobText(existingJob.title) && imported.title) existingJob.title = imported.title
            existingJob.location = existingJob.location || imported.location
            existingJob.salary = existingJob.salary || imported.salary
            existingJob.education = existingJob.education || imported.education
            existingJob.publish_date = existingJob.publish_date || imported.publish_date
            existingJob.enterprise_type = existingJob.enterprise_type || imported.enterprise_type || inferEnterpriseType(existingJob.company)
            existingJob.job_level = existingJob.job_level || imported.job_level
            existingJob.experience = existingJob.experience || imported.experience || imported.job_level
            existingJob.tags = existingJob.tags?.length ? existingJob.tags : imported.tags
            if (!existingJob.description && imported.description) existingJob.description = imported.description
            if (!existingJob.raw_text && imported.raw_text && !isSiteShellExtraction({ title: imported.title, bodyText: imported.raw_text })) {
              existingJob.raw_text = imported.raw_text
            }
            if (importedLiveness.status === 'closed' || !existingJob.liveness_status) {
              existingJob.liveness_status = importedLiveness.status
              existingJob.liveness_confidence = importedLiveness.confidence
              existingJob.liveness_reason = importedLiveness.reason
              existingJob.liveness_checked_at = new Date().toISOString()
            }
          }
          skippedCount++
          continue
        }
        
        const newJob = {
          id: generateId(),
          url: imported.url,
          company: imported.company,
          title: imported.title,
          location: imported.location,
          salary: imported.salary,
          experience: imported.experience || imported.job_level,
          education: imported.education,
          publish_date: imported.publish_date,
          enterprise_type: imported.enterprise_type || inferEnterpriseType(imported.company),
          job_level: imported.job_level,
          source_type: 'manual_url',
          source_url: imported.source_url,
          description: imported.description,
          raw_text: imported.raw_text && !isSiteShellExtraction({ title: imported.title, bodyText: imported.raw_text }) ? imported.raw_text : '',
          tags: imported.tags,
          discovered_at: new Date().toISOString(),
          liveness_status: importedLiveness.status,
          liveness_confidence: importedLiveness.confidence,
          liveness_reason: importedLiveness.reason,
          liveness_checked_at: new Date().toISOString()
        }
        existingJobs.push(newJob)
        existingUrls.add(normalizedUrl)
        addedCount++
      }
      
      writeJsonl(JOBS_FILE, existingJobs)
      return { success: true, data: { added: addedCount, skipped: skippedCount } }
    }
  },
  '/api/jobs/validate': {
    POST: async () => {
      const jobs = readJsonl(JOBS_FILE)
      const issues = []
      let fixed = 0
      for (const job of jobs) {
        const problems = []
        if (!job.company || job.company === 'Unknown') problems.push('missing_company')
        if (!job.title || job.title === 'Unknown') problems.push('missing_title')
        if (!job.url) problems.push('missing_url')
        if (job.liveness_status === 'unknown' || !job.liveness_status) problems.push('unconfirmed_liveness')
        if (!job.raw_text && !job.description) problems.push('no_content')
        if (problems.length) {
          issues.push({ id: job.id, company: job.company, title: job.title, problems })
        }
      }
      return { success: true, data: { total: jobs.length, issues, issueCount: issues.length } }
    }
  },
  '/api/jobs/:id': {
    GET: async (_, params) => {
      const jobs = readJsonl(JOBS_FILE)
      const job = normalizeStoredLiveness(jobs.find(j => j.id === params.id))
      if (!job) return { success: false, error: 'Job not found' }
      const parsed = parseRawText(job.ai_optimized_jd || job.raw_text)
      const description = job.description || buildJobMetadataDescription(job)
      return { success: true, data: { ...job, description, parsed } }
    },
    PATCH: async (body, params) => {
      const jobs = readJsonl(JOBS_FILE)
      const job = jobs.find(j => j.id === params.id)
      if (!job) return { success: false, error: 'Job not found' }

      if ('url' in body) {
        const nextUrl = String(body.url || '').trim()
        if (!/^https?:\/\//i.test(nextUrl)) {
          return { success: false, error: 'URL must start with http:// or https://' }
        }
        if (nextUrl !== job.url) {
          job.url = nextUrl
          job.extraction_status = ''
          job.extraction_error = ''
          job.extracted_at = null
        }
      }

      const fields = ['company', 'title', 'location', 'salary', 'experience', 'education', 'enterprise_type', 'job_level', 'description', 'raw_text']
      for (const field of fields) {
        if (field in body) job[field] = String(body[field] ?? '').trim()
      }
      if (body.raw_text) {
        job.extraction_status = 'manual'
        job.extraction_error = ''
        job.extracted_at = new Date().toISOString()
        await maybeOptimizeJobWithAi(job, body.provider || process.env.AI_EVAL_PROVIDER || 'deepseek')
      }
      writeJsonl(JOBS_FILE, jobs)
      const parsed = parseRawText(job.ai_optimized_jd || job.raw_text)
      const description = job.description || buildJobMetadataDescription(job)
      return { success: true, data: { ...job, description, parsed } }
    },
    DELETE: async (_, params) => {
      const jobs = readJsonl(JOBS_FILE)
      const filtered = jobs.filter(j => j.id !== params.id)
      writeJsonl(JOBS_FILE, filtered)
      return { success: true }
    }
  },
  '/api/jobs/import-url': {
    POST: async (body) => {
      const { url } = body
      if (!url) return { success: false, error: 'URL is required' }
      
      const normalizedUrl = url.split('#')[0].replace(/\/+$/, '')
      const jobs = readJsonl(JOBS_FILE)
      const exists = jobs.find(j => j.url && j.url.split('#')[0].replace(/\/+$/, '') === normalizedUrl)
      if (exists) return { success: false, error: '该 URL 已存在' }
      
      const liveness = await checkUrlLiveness(url)
      const job = {
        id: generateId(),
        url: url,
        company: '',
        title: '',
        location: '',
        salary: '',
        experience: '',
        education: '',
        publish_date: '',
        source_type: 'manual_url',
        source_url: '',
        description: '',
        raw_text: '',
        discovered_at: new Date().toISOString(),
        liveness_status: liveness.result,
        liveness_confidence: liveness.confidence,
        liveness_reason: liveness.reason,
        liveness_checked_at: new Date().toISOString()
      }
      
      try {
        const jd = await extractJD(url)
        job.company = jd.company || 'Unknown'
        job.title = jd.title || 'Unknown'
        job.location = jd.location || ''
        job.salary = jd.salary || ''
        job.experience = jd.experience || ''
        job.education = jd.education || ''
        job.raw_text = jd.raw_text
        job.extracted_at = jd.extracted_at
        await maybeOptimizeJobWithAi(job, body.provider || process.env.AI_EVAL_PROVIDER || 'deepseek')
      } catch (error) {
        job.extracted_at = null
      }
      
      jobs.push(job)
      writeJsonl(JOBS_FILE, jobs)
      return { success: true, data: job }
    }
  },
  '/api/jobs/:id/extract': {
    POST: async (_, params) => {
      const jobs = readJsonl(JOBS_FILE)
      const job = jobs.find(j => j.id === params.id)
      if (!job) return { success: false, error: 'Job not found' }
      
      try {
        const jd = await extractJD(job.url)
        job.company = jd.company || job.company
        job.title = jd.title || job.title
        job.raw_text = jd.raw_text
        job.extracted_at = jd.extracted_at
        job.salary = jd.salary || job.salary || ''
        job.location = jd.location || job.location || ''
        job.experience = jd.experience || job.experience || ''
        job.education = jd.education || job.education || ''
        await maybeOptimizeJobWithAi(job, process.env.AI_EVAL_PROVIDER || 'deepseek')
        const extractedLiveness = getImportedLiveness({ ...job, raw_text: jd.raw_text })
        if (extractedLiveness.status === 'closed') {
          job.liveness_status = extractedLiveness.status
          job.liveness_confidence = extractedLiveness.confidence
          job.liveness_reason = extractedLiveness.reason
          job.liveness_checked_at = new Date().toISOString()
        }
        generateJDMarkdown(job)
        appendToPipeline(job.url, job.company, job.title)
        writeJsonl(JOBS_FILE, jobs)
        return { success: true, data: job }
      } catch (error) {
        job.extraction_status = 'blocked'
        job.extraction_error = error.message
        job.extracted_at = null
        job.description = job.description || buildJobMetadataDescription(job)
        if (/JOB_CLOSED|job posting is closed|职位已关闭|页面不存在|职位不存在/i.test(error.message)) {
          job.liveness_status = 'closed'
          job.liveness_confidence = 'high'
          job.liveness_reason = 'Chinese expired pattern matched'
          job.liveness_checked_at = new Date().toISOString()
        }
        if (/site shell|login|登录|注册/i.test(error.message)) {
          if (job.liveness_status !== 'closed') {
            job.liveness_status = 'unconfirmed'
            job.liveness_confidence = 'low'
            job.liveness_reason = '招聘站返回登录/站点壳，未覆盖岗位元数据'
          }
        }
        writeJsonl(JOBS_FILE, jobs)
        return { success: true, data: job, meta: { warning: error.message } }
      }
    }
  },
  '/api/jobs/:id/optimize-jd': {
    POST: async (body, params) => {
      const jobs = readJsonl(JOBS_FILE)
      const job = jobs.find(j => j.id === params.id)
      if (!job) return { success: false, error: 'Job not found' }

      const optimization = await optimizeJobWithAi(job, body.provider || process.env.AI_EVAL_PROVIDER || 'deepseek')
      applyJobOptimization(job, optimization)
      writeJsonl(JOBS_FILE, jobs)
      const parsed = parseRawText(job.ai_optimized_jd || job.raw_text)
      const description = job.description || buildJobMetadataDescription(job)
      return { success: true, data: { ...job, description, parsed }, meta: { optimization } }
    }
  },
  '/api/jobs/:id/liveness': {
    POST: async (_, params) => {
      const jobs = readJsonl(JOBS_FILE)
      const job = jobs.find(j => j.id === params.id)
      if (!job) return { success: false, error: 'Job not found' }
      
      const liveness = await checkUrlLiveness(job.url)
      job.liveness_status = liveness.result
      job.liveness_confidence = liveness.confidence
      job.liveness_checked_at = new Date().toISOString()
      job.liveness_reason = liveness.reason
      
      writeJsonl(JOBS_FILE, jobs)
      return { success: true, data: liveness }
    }
  },
  '/api/jobs/:id/evaluate': {
    POST: async (body, params) => {
      const jobs = readJsonl(JOBS_FILE)
      const job = jobs.find(j => j.id === params.id)
      if (!job) return { success: false, error: 'Job not found' }
      
      const evaluation = await evaluateJobWithAi(job, body.provider)
      job.score = evaluation.score
      job.score_reason = evaluation.summary
      job.recommendation = evaluation.recommendation
      job.legitimacy = evaluation.legitimacy
      job.match_highlights = evaluation.match_highlights
      job.gaps = evaluation.gaps
      job.resume_strategy = evaluation.resume_strategy
      job.interview_focus = evaluation.interview_focus
      job.next_actions = evaluation.next_actions
      job.ai_provider = evaluation.provider
      job.ai_model = evaluation.model
      job.evaluated_at = evaluation.evaluated_at
      job.tracker_status = evaluation.score >= 4 ? 'Evaluated' : 'SKIP'
      writeJsonl(JOBS_FILE, jobs)

      // Generate report markdown file
      const reportsDir = `${PROJECT_ROOT}/reports`
      if (!existsSync(reportsDir)) mkdirSync(reportsDir, { recursive: true })
      const date = new Date().toISOString().split('T')[0]
      const slug = (job.company || 'unknown').toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-').slice(0, 20)
      const num = String(Date.now()).slice(-6)
      const reportFilename = `${num}-${slug}-${date}.md`
      const reportPath = `reports/${reportFilename}`
      const reportMd = `# ${job.company || '?'} - ${job.title || '?'} 评估报告\n\n> 评估时间：${evaluation.evaluated_at}\n> AI 模型：${evaluation.provider_label || evaluation.provider} / ${evaluation.model}\n\n## 综合评分\n\n**${evaluation.score} / 5**\n\n${evaluation.summary ? `${evaluation.summary}\n` : ''}\n\n## 建议\n\n${evaluation.recommendation || '无'}\n\n## 合法性判断\n\n${evaluation.legitimacy || '未检测'}\n\n## 匹配亮点\n\n${(evaluation.match_highlights || []).map(h => `- ${h}`).join('\n') || '- 无'}\n\n## 差距分析\n\n${(evaluation.gaps || []).map(g => `- ${g}`).join('\n') || '- 无'}\n\n## 简历策略\n\n${evaluation.resume_strategy || '无'}\n\n## 面试重点\n\n${(evaluation.interview_focus || []).map(f => `- ${f}`).join('\n') || '- 无'}\n\n## 下一步行动\n\n${(evaluation.next_actions || []).map(a => `- ${a}`).join('\n') || '- 无'}\n`
      writeFileSync(`${reportsDir}/${reportFilename}`, reportMd, 'utf-8')

      return { success: true, data: { ...evaluation, reportPath } }
    }
  },
  '/api/jobs/:id/resume/docx': {
    POST: async (body, params) => {
      const jobs = readJsonl(JOBS_FILE)
      const job = jobs.find(j => j.id === params.id)
      if (!job) return { success: false, error: 'Job not found' }
      
      const date = new Date().toISOString().split('T')[0]
      const profile = getResumeProfile()
      const stem = resumeFileStem(job, profile, date)
      const { docx: fileName } = resolveUniqueResumeArtifactNames(stem, [{ dir: 'output', extension: 'docx' }])
      const resume = await buildTailoredResume(job, profile, body.provider)
      const docx = createDocxBuffer(resume)
      writeFileSync(`${PROJECT_ROOT}/output/${fileName}`, docx)
      return { success: true, data: { fileName, path: `output/${fileName}` } }
    }
  },
  '/api/jobs/:id/resume/pdf': {
    POST: async (body, params) => {
      const jobs = readJsonl(JOBS_FILE)
      const job = jobs.find(j => j.id === params.id)
      if (!job) return { success: false, error: 'Job not found' }
      
      const date = new Date().toISOString().split('T')[0]
      const profile = getResumeProfile()
      const stem = resumeFileStem(job, profile, date)
      const artifactNames = resolveUniqueResumeArtifactNames(stem, [
        { dir: 'output', extension: 'pdf' },
        { dir: 'tmp', extension: 'html' }
      ])
      const fileName = artifactNames.pdf
      const htmlName = artifactNames.html
      const htmlPath = `${PROJECT_ROOT}/tmp/${htmlName}`
      const resume = await buildTailoredResume(job, profile, body.provider)
      writeFileSync(htmlPath, buildResumeHtml(resume), 'utf-8')
      await execFileAsync('node', ['scripts/cv/generate-pdf.mjs', `tmp/${htmlName}`, `output/${fileName}`, '--format=a4'], { cwd: PROJECT_ROOT })
      return { success: true, data: { fileName, path: `output/${fileName}` } }
    }
  },
  '/api/jobs/:id/resume/files': {
    GET: async (_, params) => {
      const jobs = readJsonl(JOBS_FILE)
      const job = jobs.find(j => j.id === params.id)
      if (!job) return { success: false, error: 'Job not found' }
      
      const fs = await import('fs')
      const dir = `${PROJECT_ROOT}/output`
      const files = fs.readdirSync(dir).filter(f => 
        f.includes(safeSlug(job.company, 'unknown'))
      )
      
      return { success: true, data: files.map(name => ({ name })) }
    }
  },
  '/api/resume/delete-file': {
    DELETE: async (body) => {
      const { path: filePath } = body
      if (!filePath || !filePath.startsWith('output/')) {
        return { success: false, error: 'Invalid file path' }
      }
      const fullPath = `${PROJECT_ROOT}/${filePath}`
      if (!existsSync(fullPath)) {
        return { success: false, error: 'File not found' }
      }
      const { unlinkSync } = await import('fs')
      unlinkSync(fullPath)
      return { success: true }
    }
  },
  '/api/resume/files': {
    GET: async () => {
      return { success: true, data: listGeneratedResumeFiles() }
    }
  },
  '/api/resume/photo': {
    DELETE: async () => {
      const profile = deleteResumePhoto()
      return { success: true, data: profile }
    }
  },
  '/api/jobs/:id/tracker-addition': {
    POST: async (_, params) => {
      const jobs = readJsonl(JOBS_FILE)
      const job = jobs.find(j => j.id === params.id)
      if (!job) return { success: false, error: 'Job not found' }

      if (!job.score) {
        return { success: false, error: '该岗位尚未完成 AI 评分，请先在岗位列表中进行评分' }
      }

      // Ensure report file exists
      let reportPath = job.reportPath || null
      if (reportPath) {
        const fullPath = `${PROJECT_ROOT}/${reportPath}`
        if (!existsSync(fullPath)) reportPath = null
      }
      if (!reportPath && job.score) {
        // Generate report from existing evaluation fields
        const reportsDir = `${PROJECT_ROOT}/reports`
        if (!existsSync(reportsDir)) mkdirSync(reportsDir, { recursive: true })
        const date = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' })
        const slug = (job.company || 'unknown').toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-').slice(0, 20)
        const num = String(Date.now()).slice(-6)
        const reportFilename = `${num}-${slug}-${date}.md`
        reportPath = `reports/${reportFilename}`
        const reportMd = `# ${job.company || '?'} - ${job.title || '?'} 评估报告\n\n> 评估时间：${job.evaluated_at || date}\n> AI 模型：${job.ai_provider || 'AI'} / ${job.ai_model || '-'}\n\n## 综合评分\n\n**${job.score} / 5**\n\n${job.score_reason ? `${job.score_reason}\n` : ''}\n\n## 建议\n\n${job.recommendation || '无'}\n\n## 合法性判断\n\n${job.legitimacy || '未检测'}\n\n## 匹配亮点\n\n${(job.match_highlights || []).map(h => `- ${h}`).join('\n') || '- 无'}\n\n## 差距分析\n\n${(job.gaps || []).map(g => `- ${g}`).join('\n') || '- 无'}\n\n## 简历策略\n\n${job.resume_strategy || '无'}\n\n## 面试重点\n\n${(job.interview_focus || []).map(f => `- ${f}`).join('\n') || '- 无'}\n\n## 下一步行动\n\n${(job.next_actions || []).map(a => `- ${a}`).join('\n') || '- 无'}\n`
        writeFileSync(`${reportsDir}/${reportFilename}`, reportMd, 'utf-8')
        // Save reportPath back to job
        job.reportPath = reportPath
        writeJsonl(JOBS_FILE, jobs)
      }

      const tsvFile = generateTrackerTSV(job, reportPath)

      // Auto-merge the TSV into applications.md
      const mergeResult = await runScript('merge-tracker')
      if (!mergeResult.success) {
        return { success: false, error: `合并 tracker 失败：${mergeResult.output?.slice(0, 200) || '未知错误'}` }
      }

      return { success: true, data: { tsvFile } }
    }
  },
  '/api/discovery/run': {
    POST: async (body) => {
      const { companyId, keywords } = body
      const companies = readCompanies()
      const company = companies.find(c => c.id === companyId)
      if (!company) return { success: false, error: 'Company not found' }
      
      const discovered = await discoverOfficialJobs(company, keywords)
      const discoveredJobs = discovered.jobs
      const jobs = readJsonl(JOBS_FILE)
      let added = 0
      let duplicates = 0
      
      for (const job of discoveredJobs) {
        const exists = jobs.find(j => j.url === job.url)
        if (!exists) {
          jobs.push(job)
          added++
        } else {
          duplicates++
        }
      }
      writeJsonl(JOBS_FILE, jobs)
      
      const runRecord = {
        run_id: generateId(),
        company: company.name,
        found: discoveredJobs.length,
        new: added,
        duplicates,
        keywords: keywords,
        errors: discovered.errors,
        timestamp: new Date().toISOString()
      }
      
      const runs = readJsonl(DISCOVERY_RUNS_FILE)
      runs.push(runRecord)
      writeJsonl(DISCOVERY_RUNS_FILE, runs)
      
      return { success: true, data: { ...runRecord, jobs: discoveredJobs } }
    }
  },
  '/api/discovery/search': {
    POST: async (body) => {
      const { keywords, direction, city, enterpriseType, jobLevel, limit } = body
      const searchKeywords = keywords || direction || ''
      if (parseKeywordList(searchKeywords).length === 0 && !direction?.trim()) {
        return { success: false, error: '请先输入岗位关键词或专业方向' }
      }
      const discovered = await discoverWebJobs(searchKeywords, { direction, city, enterpriseType, jobLevel })
      const discoveredJobs = discovered.jobs
      const discoveredCompanies = discovered.companies || []
      const jobs = readJsonl(JOBS_FILE)
      let added = 0
      let duplicates = 0

      for (const job of discoveredJobs) {
        const exists = jobs.find(j => j.url === job.url)
        if (!exists) {
          jobs.push(job)
          added++
        } else {
          duplicates++
        }
      }
      writeJsonl(JOBS_FILE, jobs)

      const companyMerge = mergeCompanyRecords(readCompanies(), discoveredCompanies)
      if (discoveredCompanies.length) {
        writeCompanies(companyMerge.companies)
      }

      return {
        success: true,
        data: {
          found: discoveredJobs.length,
          new: added,
          duplicates,
          companies_added: companyMerge.added,
          companies_updated: companyMerge.updated,
          errors: discovered.errors || []
        }
      }
    }
  },
  '/api/discovery/import-json': {
    POST: async (body, params, query, rawBody) => {
      let jsonData = body.jsonData || body
      
      if (!jsonData || typeof jsonData !== 'object' || Object.keys(jsonData).length === 0) {
        if (rawBody && typeof rawBody === 'string') {
          try {
            const parsed = JSON.parse(rawBody)
            jsonData = parsed.jsonData || parsed
          } catch (e) {
            console.error('[Import] JSON parse error:', e.message)
            return { success: false, error: '无效的JSON数据' }
          }
        } else {
          return { success: false, error: '无效的JSON数据' }
        }
      }
      
      if (!jsonData || typeof jsonData !== 'object') {
        return { success: false, error: '无效的JSON数据' }
      }

      const jobs = readJsonl(JOBS_FILE)
      const candidates = readJsonl(CANDIDATES_FILE)
      const companies = readCompanies()
      let addedJobs = 0
      let addedCandidates = 0
      let addedCompanies = 0
      let duplicateJobs = 0
      let rejectedJobs = 0
      let missingFieldsJobs = 0

      // Helper: map validation_status to liveness_status
      const mapValidationToLiveness = (vs) => {
        const status = String(vs || '').toLowerCase().trim()
        if (status === 'valid') return 'active'
        if (status === 'probably_valid') return 'unconfirmed'
        if (status === 'expired' || status === 'dead') return 'closed'
        if (status === 'blocked' || status === 'unverified_low_priority') return 'unconfirmed'
        return 'unconfirmed'
      }

      // Helper: determine if job should go to candidates instead of jobs
      const shouldGoToCandidates = (imported) => {
        const vs = String(imported.validation_status || '').toLowerCase().trim()
        if (vs === 'blocked' || vs === 'unverified_low_priority') return true
        return false
      }

      // Helper: check if job should be rejected entirely (not even candidates)
      const shouldReject = (imported) => {
        const vs = String(imported.validation_status || '').toLowerCase().trim()
        if (vs === 'expired' || vs === 'dead') return true
        return false
      }

      // Helper: check minimum requirements for formal job list
      const meetsJobRequirements = (imported) => {
        if (!imported.url) return false
        if (!imported.title) return false
        if (!imported.company || imported.company === '未知公司') return false
        return true
      }

      // Process a single imported job
      const processImportedJob = (imported) => {
        const jobUrl = imported.url
        const companyName = imported.company

        if (!jobUrl) { missingFieldsJobs++; return }

        // Reject expired/dead entirely — do not add to candidates
        if (shouldReject(imported)) { rejectedJobs++; return }

        const importedLiveness = getImportedLiveness(imported)
        const mappedLiveness = imported.validation_status ? mapValidationToLiveness(imported.validation_status) : importedLiveness.status
        const direction = imported.direction || imported.tags?.[0] || ''

        // Check if should go to candidates (blocked/unverified_low_priority)
        if (shouldGoToCandidates(imported)) {
          const candidateExists = candidates.find(c => c.url === jobUrl)
          if (!candidateExists) {
            candidates.push({
              id: generateId(),
              title: imported.title,
              company: companyName || '未知公司',
              url: jobUrl,
              location: imported.location,
              salary: imported.salary,
              source_type: imported.source_type || 'json_import',
              direction,
              liveness_status: mappedLiveness,
              liveness_confidence: importedLiveness.confidence,
              liveness_reason: imported.validation_evidence || importedLiveness.reason,
              liveness_checked_at: new Date().toISOString(),
              created_at: new Date().toISOString(),
              discovered_at: imported.discovered_at || imported.detected_at || new Date().toISOString(),
              enterprise_type: imported.enterprise_type,
              job_level: imported.job_level,
              experience: imported.experience || imported.job_level,
              education: imported.education,
              tags: imported.tags,
              description: imported.description,
              validation_status: imported.validation_status,
              freshness: imported.freshness,
              candidate_reason: shouldGoToCandidates(imported) ? `validation_status: ${imported.validation_status}` : ''
            })
            addedCandidates++
          }
          rejectedJobs++
          return
        }

        // Check minimum requirements
        if (!meetsJobRequirements(imported)) {
          // Still add to candidates if has URL
          if (imported.url) {
            const candidateExists = candidates.find(c => c.url === jobUrl)
            if (!candidateExists) {
              candidates.push({
                id: generateId(),
                title: imported.title || '',
                company: companyName || '未知公司',
                url: jobUrl,
                location: imported.location,
                salary: imported.salary,
                source_type: imported.source_type || 'json_import',
                direction,
                liveness_status: mappedLiveness,
                liveness_confidence: importedLiveness.confidence,
                liveness_reason: importedLiveness.reason,
                liveness_checked_at: new Date().toISOString(),
                created_at: new Date().toISOString(),
                discovered_at: imported.discovered_at || imported.detected_at || new Date().toISOString(),
                enterprise_type: imported.enterprise_type,
                job_level: imported.job_level,
                experience: imported.experience || imported.job_level,
                education: imported.education,
                tags: imported.tags,
                description: imported.description,
                validation_status: imported.validation_status,
                freshness: imported.freshness,
                candidate_reason: 'missing_required_fields'
              })
              addedCandidates++
            }
          }
          missingFieldsJobs++
          return
        }

        const jobExists = jobs.find(j => j.url === jobUrl)
        if (!jobExists) {
          jobs.push({
            id: generateId(),
            title: imported.title,
            company: companyName,
            url: jobUrl,
            location: imported.location,
            salary: imported.salary,
            source_type: imported.source_type || 'json_import',
            direction,
            liveness_status: mappedLiveness,
            liveness_confidence: importedLiveness.confidence,
            liveness_reason: imported.validation_evidence || importedLiveness.reason,
            liveness_checked_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            discovered_at: imported.discovered_at || imported.detected_at || new Date().toISOString(),
            enterprise_type: imported.enterprise_type,
            job_level: imported.job_level,
            experience: imported.experience || imported.job_level,
            education: imported.education,
            tags: imported.tags,
            description: imported.description,
            validation_status: imported.validation_status,
            freshness: imported.freshness
          })
          addedJobs++
        } else {
          if (isWeakJobText(jobExists.company) && companyName) jobExists.company = companyName
          if (isWeakJobText(jobExists.title) && imported.title) jobExists.title = imported.title
          jobExists.enterprise_type = jobExists.enterprise_type || imported.enterprise_type
          jobExists.job_level = jobExists.job_level || imported.job_level
          jobExists.experience = jobExists.experience || imported.experience || imported.job_level
          jobExists.location = jobExists.location || imported.location
          jobExists.salary = jobExists.salary || imported.salary
          jobExists.direction = jobExists.direction || direction
          if (!jobExists.validation_status && imported.validation_status) jobExists.validation_status = imported.validation_status
          if (!jobExists.freshness && imported.freshness) jobExists.freshness = imported.freshness
          if (importedLiveness.status === 'closed' || !jobExists.liveness_status) {
            jobExists.liveness_status = mappedLiveness
            jobExists.liveness_confidence = importedLiveness.confidence
            jobExists.liveness_reason = imported.validation_evidence || importedLiveness.reason
            jobExists.liveness_checked_at = new Date().toISOString()
          }
          duplicateJobs++
        }

        if (companyName) {
          const companyExists = companies.find(c => c.name === companyName)
          if (!companyExists) {
            companies.push({
              id: generateId(),
              name: companyName,
              official_homepage: '',
              career_urls: [],
              keywords: [],
              negative_keywords: ['销售', '财务', '人力', '市场'],
              enabled: true,
              created_at: new Date().toISOString(),
              type: imported.enterprise_type || '民营/上市公司'
            })
            addedCompanies++
          }
        }
      }

      // job-finer standard format: top-level jobs array is the single source of truth
      if (jsonData.jobs && Array.isArray(jsonData.jobs)) {
        // CX_Fix 7.2: if jobs array is empty but group stats exist, reject
        if (jsonData.jobs.length === 0 && (jsonData.by_job_level || jsonData.by_enterprise_type || jsonData.freshness || jsonData.cross_table)) {
          return { success: false, error: '顶层 jobs 数组为空，但存在分组统计。jobs 是唯一事实来源，请确保 jobs 包含完整岗位数据。' }
        }

        for (const job of jsonData.jobs) {
          const imported = normalizeImportedJob(job)
          // Map job-finer specific fields (override normalizeImportedJob defaults)
          if (job.source) imported.source_type = job.source
          if (job.direction) imported.direction = job.direction
          if (job.direction_confidence) imported.direction_confidence = job.direction_confidence
          if (job.enterprise) imported.company = imported.company || job.enterprise
          if (job.snippet) imported.description = imported.description || job.snippet
          if (job.enterprise_type_confidence) imported.enterprise_type_confidence = job.enterprise_type_confidence
          if (job.job_level_confidence) imported.job_level_confidence = job.job_level_confidence
          if (job.job_level_evidence) imported.job_level_evidence = job.job_level_evidence
          if (job.freshness) imported.freshness = job.freshness
          if (job.freshness_evidence) imported.freshness_evidence = job.freshness_evidence
          if (job.validation_status) imported.validation_status = job.validation_status
          if (job.validation_evidence) imported.validation_evidence = job.validation_evidence
          if (job.detected_at) imported.detected_at = job.detected_at
          // direction should also go into tags
          if (job.direction && !imported.tags.includes(job.direction)) {
            imported.tags = [...(imported.tags || []), job.direction]
          }
          processImportedJob(imported)
        }
      } else if (jsonData.by_enterprise_type) {
        // Legacy format: by_enterprise_type groups — downgrade to unverified_low_priority
        const enterpriseTypes = jsonData.by_enterprise_type
        
        for (const [type, typeData] of Object.entries(enterpriseTypes)) {
          // Support both nested enterprises array and flat company→urls structure
          const enterprises = typeData.enterprises || typeData
          
          for (const [companyKey, companyData] of Object.entries(enterprises)) {
            let companyName = companyKey
            let urls = companyData

            // Handle { enterprises: [{ name, urls }] } structure
            if (Array.isArray(typeData.enterprises)) {
              companyName = companyData.name || companyKey
              urls = companyData.urls || []
            }

            if (!companyName) continue

            const companyExists = companies.find(c => c.name === companyName)
            if (!companyExists) {
              companies.push({
                id: generateId(),
                name: companyName,
                official_homepage: '',
                career_urls: [],
                keywords: [],
                negative_keywords: ['销售', '财务', '人力', '市场'],
                enabled: true,
                created_at: new Date().toISOString(),
                type: type
              })
              addedCompanies++
            }

            if (!Array.isArray(urls)) continue
            
            for (const urlData of urls) {
              const imported = normalizeImportedJob(
                typeof urlData === 'string' ? { url: urlData, company: companyName, enterprise_type: type } : { ...urlData, company: companyName, enterprise_type: type }
              )
              // Legacy format imports get unverified_low_priority validation
              imported.validation_status = 'unverified_low_priority'
              processImportedJob(imported)
            }
          }
        }
      } else if (jsonData.by_company) {
        // Legacy format: by_company groups
        const companyGroups = jsonData.by_company
        for (const [companyName, companyData] of Object.entries(companyGroups)) {
          if (!companyName) continue

          const companyExists = companies.find(c => c.name === companyName)
          if (!companyExists) {
            companies.push({
              id: generateId(),
              name: companyName,
              official_homepage: '',
              career_urls: [],
              keywords: [],
              negative_keywords: ['销售', '财务', '人力', '市场'],
              enabled: true,
              created_at: new Date().toISOString(),
              type: companyData.type || companyData.enterprise_type || '民营/上市公司'
            })
            addedCompanies++
          }

          const urls = companyData.urls || []
          for (const urlData of urls) {
            const imported = normalizeImportedJob(
              typeof urlData === 'string' ? { url: urlData, company: companyName } : { ...urlData, company: companyName }
            )
            imported.validation_status = 'unverified_low_priority'
            processImportedJob(imported)
          }
        }
      } else if (Array.isArray(jsonData) && jsonData.length > 0 && jsonData.every(item => typeof item === 'string' && /^https?:\/\//.test(item))) {
        // CX_Fix 7.5: bare URL array — all go to candidates, not formal job list
        for (const url of jsonData) {
          const imported = normalizeImportedJob({ url })
          imported.validation_status = 'unverified_low_priority'
          processImportedJob(imported)
        }
      } else {
        // No recognized format — reject
        return { success: false, error: 'JSON 格式无效：需要顶层 jobs 数组（job-finer 标准）或 by_enterprise_type/by_company 分组' }
      }

      writeJsonl(JOBS_FILE, jobs)
      writeJsonl(CANDIDATES_FILE, candidates)
      writeCompanies(companies)

      return {
        success: true,
        data: {
          addedJobs,
          addedCandidates,
          addedCompanies,
          duplicateJobs,
          rejectedJobs,
          missingFieldsJobs,
          message: `导入完成：${addedJobs} 个岗位入正式列表，${addedCandidates} 个入候选区，${addedCompanies} 家新公司，${duplicateJobs} 个重复，${rejectedJobs} 个拒绝，${missingFieldsJobs} 个缺字段`
        }
      }
    }
  },

  '/api/candidates': {
    GET: async () => {
      const candidates = readJsonl(CANDIDATES_FILE)
      return { success: true, data: candidates }
    }
  },

  '/api/candidates/:id': {
    DELETE: async (body, params) => {
      const candidates = readJsonl(CANDIDATES_FILE)
      const id = params.id
      const filtered = candidates.filter(c => c.id !== id)
      if (filtered.length === candidates.length) {
        return { success: false, error: '候选岗位不存在' }
      }
      writeJsonl(CANDIDATES_FILE, filtered)
      return { success: true, data: { deleted: 1 } }
    }
  },

  '/api/candidates/batch-delete': {
    POST: async (body) => {
      const ids = body.ids || []
      if (!ids.length) return { success: false, error: '未指定要删除的候选岗位' }
      const candidates = readJsonl(CANDIDATES_FILE)
      const idSet = new Set(ids)
      const filtered = candidates.filter(c => !idSet.has(c.id))
      writeJsonl(CANDIDATES_FILE, filtered)
      return { success: true, data: { deleted: candidates.length - filtered.length } }
    }
  },

  '/api/candidates/promote': {
    POST: async (body) => {
      const id = body.id
      if (!id) return { success: false, error: '未指定候选岗位 ID' }

      const candidates = readJsonl(CANDIDATES_FILE)
      const jobs = readJsonl(JOBS_FILE)
      const candidate = candidates.find(c => c.id === id)
      if (!candidate) return { success: false, error: '候选岗位不存在' }

      // Check if already in jobs
      if (candidate.url && jobs.find(j => j.url === candidate.url)) {
        return { success: false, error: '该岗位已存在于正式列表中' }
      }

      // Promote to jobs
      jobs.push({
        id: candidate.id,
        title: candidate.title,
        company: candidate.company,
        url: candidate.url,
        location: candidate.location,
        salary: candidate.salary,
        source_type: candidate.source_type || 'candidate_promoted',
        direction: candidate.direction,
        liveness_status: 'unconfirmed',
        liveness_confidence: 0.5,
        liveness_reason: '从候选区确认晋升',
        liveness_checked_at: new Date().toISOString(),
        created_at: candidate.created_at,
        discovered_at: candidate.discovered_at,
        enterprise_type: candidate.enterprise_type,
        job_level: candidate.job_level,
        experience: candidate.experience || candidate.job_level,
        education: candidate.education,
        tags: candidate.tags,
        description: candidate.description,
        validation_status: 'probably_valid'
      })

      // Remove from candidates
      const filtered = candidates.filter(c => c.id !== id)
      writeJsonl(CANDIDATES_FILE, filtered)
      writeJsonl(JOBS_FILE, jobs)

      return { success: true, data: { promoted: 1 } }
    }
  },

  '/api/tracker': {
    GET: async () => {
      const trackerPath = `${PROJECT_ROOT}/data/applications.md`
      if (!existsSync(trackerPath)) {
        return { success: true, data: [] }
      }
      
      const content = readFileSync(trackerPath, 'utf-8')
      const lines = content.split('\n')
      const records = []
      
      for (let index = 0; index < lines.length; index++) {
        const line = lines[index]
        if (line.startsWith('|') && !line.includes('Company') && !line.includes('---')) {
          const parts = line.split('|').slice(1, -1).map(p => p.trim())
          if (parts.length >= 6) {
            const reportMatch = (parts[7] || '').match(/\(([^)]+)\)/)
            records.push({
              rowId: index,
              num: parts[0],
              date: parts[1],
              company: parts[2],
              role: parts[3],
              score: parts[4] || '',
              status: parts[5],
              pdf: parts[6] || '',
              report: parts[7] || '',
              reportPath: reportMatch ? reportMatch[1] : parts[7] || '',
              notes: parts.slice(8).join(' | ') || ''
            })
          }
        }
      }
      
      return { success: true, data: records }
    }
  },
  '/api/tracker/:rowId': {
    DELETE: async (_, params) => {
      const trackerPath = `${PROJECT_ROOT}/data/applications.md`
      if (!existsSync(trackerPath)) return { success: false, error: 'Tracker not found' }

      const content = readFileSync(trackerPath, 'utf-8')
      const lines = content.split('\n')
      const rowIndex = parseInt(params.rowId, 10)

      if (rowIndex >= 0 && rowIndex < lines.length && lines[rowIndex].startsWith('|')) {
        lines.splice(rowIndex, 1)
        writeFileSync(trackerPath, lines.join('\n'), 'utf-8')
      }

      return { success: true }
    }
  },
  '/api/tracker/:rowId/status': {
    PATCH: async (body, params) => {
      const trackerPath = `${PROJECT_ROOT}/data/applications.md`
      if (!existsSync(trackerPath)) return { success: false, error: 'Tracker not found' }
      
      const content = readFileSync(trackerPath, 'utf-8')
      const lines = content.split('\n')
      const rowIndex = parseInt(params.rowId, 10)
      
      if (rowIndex >= 0 && rowIndex < lines.length) {
        const line = lines[rowIndex]
        if (line.startsWith('|')) {
          const parts = line.split('|').slice(1, -1).map(p => p.trim())
          if (parts.length >= 6) {
            parts[5] = body.status
            lines[rowIndex] = `| ${parts.join(' | ')} |`
            writeFileSync(trackerPath, lines.join('\n'), 'utf-8')
          }
        }
      }
      
      return { success: true }
    }
  },
  '/api/tracker/:rowId/notes': {
    PATCH: async (body, params) => {
      const trackerPath = `${PROJECT_ROOT}/data/applications.md`
      if (!existsSync(trackerPath)) return { success: false, error: 'Tracker not found' }
      
      const content = readFileSync(trackerPath, 'utf-8')
      const lines = content.split('\n')
      const rowIndex = parseInt(params.rowId, 10)
      
      if (rowIndex >= 0 && rowIndex < lines.length) {
        const line = lines[rowIndex]
        if (line.startsWith('|')) {
          const parts = line.split('|').slice(1, -1).map(p => p.trim())
          while (parts.length < 9) parts.push('')
          parts[8] = body.notes
          lines[rowIndex] = `| ${parts.join(' | ')} |`
          writeFileSync(trackerPath, lines.join('\n'), 'utf-8')
        }
      }
      
      return { success: true }
    },
    DELETE: async (_, params) => {
      const trackerPath = `${PROJECT_ROOT}/data/applications.md`
      if (!existsSync(trackerPath)) return { success: false, error: 'Tracker not found' }

      const content = readFileSync(trackerPath, 'utf-8')
      const lines = content.split('\n')
      const rowIndex = parseInt(params.rowId, 10)

      if (rowIndex >= 0 && rowIndex < lines.length && lines[rowIndex].startsWith('|')) {
        lines.splice(rowIndex, 1)
        writeFileSync(trackerPath, lines.join('\n'), 'utf-8')
      }

      return { success: true }
    }
  },
  '/api/tracker/evaluation': {
    GET: async (_, __, query) => {
      const jobs = readJsonl(JOBS_FILE)
      const job = jobs.find(j =>
        (j.company || '') === (query.company || '') &&
        (j.title || '') === (query.role || '')
      )
      if (!job) return { success: true, data: null }
      return {
        success: true,
        data: {
          score: job.score,
          recommendation: job.recommendation,
          score_reason: job.score_reason,
          match_highlights: job.match_highlights || [],
          gaps: job.gaps || [],
          resume_strategy: job.resume_strategy || [],
          interview_focus: job.interview_focus || []
        }
      }
    }
  },
  '/api/jobs/:id/interview-prep': {
    POST: async (body, params) => {
      const jobs = readJsonl(JOBS_FILE)
      const job = jobs.find(j => j.id === params.id)
      if (!job) return { success: false, error: 'Job not found' }

      try {
        const provider = body.provider || process.env.AI_EVAL_PROVIDER || 'deepseek'
        const result = await generateInterviewPrepWithAi(job, provider)
        return { success: true, data: result }
      } catch (error) {
        return { success: false, error: error.message }
      }
    }
  },
  '/api/interview-prep/:jobId': {
    GET: async (_, params) => {
      const jobs = readJsonl(JOBS_FILE)
      const job = jobs.find(j => j.id === params.jobId)
      if (!job) return { success: false, error: 'Job not found' }

      const slug = `${safeSlug(job.company, 'unknown')}-${safeSlug(job.title, 'job')}`
      const path = `${PROJECT_ROOT}/interview-prep/${slug}.md`

      if (!existsSync(path)) {
        return { success: false, error: '面试准备材料尚未生成，请先点击「生成面试准备」' }
      }

      // 尝试读取缓存的 JSON 结果文件
      const jsonPath = path.replace('.md', '.json')
      let cachedData = null
      if (existsSync(jsonPath)) {
        try { cachedData = JSON.parse(readFileSync(jsonPath, 'utf-8')) } catch (_) {}
      }

      // 如果有缓存 JSON 直接返回，否则从 md 解析返回基础版本
      if (cachedData) {
        cachedData.markdown = readFileSync(path, 'utf-8')
        cachedData.path = `interview-prep/${slug}.md`
        return { success: true, data: cachedData }
      }

      const content = readFileSync(path, 'utf-8')
      return { success: true, data: { markdown: content, path: `interview-prep/${slug}.md` } }
    }
  },
  '/api/followups': {
    GET: async () => {
      try {
        const result = await runScript('followup-cadence')
        if (!result.success) {
          return { success: false, error: result.output?.slice(0, 200) || 'followup-cadence 脚本执行失败' }
        }

        const parsed = extractJsonObject(result.output)
        if (!parsed || !Array.isArray(parsed.entries)) {
          return { success: false, error: 'followup-cadence 输出解析失败，请检查投递追踪数据格式' }
        }

        // Map cadence entries to frontend-friendly format
        const followups = parsed.entries.map((e, idx) => ({
          id: String(e.num || idx + 1),
          company: e.company,
          role: e.role,
          last_status: e.status,
          next_followup_date: e.nextFollowupDate,
          status: e.urgency === 'overdue' || e.urgency === 'urgent' ? 'pending' : 'completed',
          urgency: e.urgency,
          days_since_application: e.daysSinceApplication,
          followup_count: e.followupCount,
          contacts: e.contacts || [],
          notes: e.notes || '',
          score: e.score
        }))

        return { success: true, data: followups }
      } catch (error) {
        console.error('Followups fetch error:', error.message)
        return { success: false, error: error.message || '加载跟进数据失败' }
      }
    }
  },
  '/api/followups/refresh': {
    POST: async () => {
      try {
        await runScript('followup-cadence')
        return { success: true, data: { message: '跟进数据已刷新' } }
      } catch (error) {
        throw error
      }
    }
  },
  '/api/followups/:id/mark-sent': {
    POST: async (_, params) => {
      try {
        const id = params.id
        const followUpsFile = `${PROJECT_ROOT}/data/follow-ups.md`

        // Ensure file exists with header
        if (!existsSync(followUpsFile) || !readFileSync(followUpsFile, 'utf-8').trim()) {
          writeFileSync(followUpsFile, '| # | App# | Date | Company | Role | Channel | Contact | Notes |\n|---|------|------|---------|------|---------|---------|-------|\n', 'utf-8')
        }

        const content = readFileSync(followUpsFile, 'utf-8')
        const lines = content.split('\n')
        // Find last data line, skip header row (contains '#') and separator (---)
        const lastDataLine = [...lines].reverse().find(l => {
          if (!l.startsWith('|') || l.includes('---')) return false
          const firstCell = l.split('|')[1]?.trim()
          return firstCell && !isNaN(parseInt(firstCell))
        })
        const nextNum = lastDataLine ? parseInt(lastDataLine.split('|')[1].trim()) + 1 : 1
        const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' })

        // Find app info from applications.md for this id
        const appsFile = `${PROJECT_ROOT}/data/applications.md`
        let appInfo = null
        if (existsSync(appsFile)) {
          const appsContent = readFileSync(appsFile, 'utf-8')
          for (const line of appsContent.split('\n')) {
            if (line.startsWith('|') && !line.includes('Company') && !line.includes('---')) {
              const parts = line.split('|').slice(1, -1).map(p => p.trim())
              if (String(parts[0]) === String(id) && parts.length >= 5) {
                appInfo = { company: parts[2], role: parts[3] }
                break
              }
            }
          }
        }

        const safeCompany = (appInfo?.company || '').replace(/\|/g, '\\|').replace(/\n/g, ' ')
        const safeRole = (appInfo?.role || '').replace(/\|/g, '\\|').replace(/\n/g, ' ')
        const newRow = `| ${nextNum} | ${id} | ${today} | ${safeCompany} | ${safeRole} | Email | | 已通过GUI标记发送 |`
        appendFileSync(followUpsFile, newRow + '\n', 'utf-8')

        return { success: true, data: { message: '已标记为已发送' } }
      } catch (error) {
        console.error('Mark-sent error:', error.message)
        throw error
      }
    }
  },
  '/api/followups/:id/send-message': {
    POST: async (body, params) => {
      const id = params.id
      const { message } = body || {}

      const followUpsFile = `${PROJECT_ROOT}/data/follow-ups.md`

      // Ensure file exists with header
      if (!existsSync(followUpsFile) || !readFileSync(followUpsFile, 'utf-8').trim()) {
        writeFileSync(followUpsFile, '| # | App# | Date | Company | Role | Channel | Contact | Notes |\n|---|------|------|---------|------|---------|---------|-------|\n', 'utf-8')
      }

      const content = readFileSync(followUpsFile, 'utf-8')
      const lines = content.split('\n')
      // Find last data line, skip header row (contains '#') and separator (---)
      const lastDataLine = [...lines].reverse().find(l => {
        if (!l.startsWith('|') || l.includes('---')) return false
        const firstCell = l.split('|')[1]?.trim()
        return firstCell && !isNaN(parseInt(firstCell))
      })
      const nextNum = lastDataLine ? parseInt(lastDataLine.split('|')[1].trim()) + 1 : 1
      const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' })

      let appInfo = null
      const appsFile = `${PROJECT_ROOT}/data/applications.md`
      if (existsSync(appsFile)) {
        for (const line of readFileSync(appsFile, 'utf-8').split('\n')) {
          if (line.startsWith('|') && !line.includes('Company') && !line.includes('---')) {
            const parts = line.split('|').slice(1, -1).map(p => p.trim())
            if (String(parts[0]) === String(id) && parts.length >= 5) {
              appInfo = { company: parts[2], role: parts[3] }
              break
            }
          }
        }
      }

      const safeMsg = (message || '').replace(/\n/g, ' ').replace(/\|/g, '\\|').slice(0, 200)
      const safeCompany = (appInfo?.company || '').replace(/\|/g, '\\|').replace(/\n/g, ' ')
      const safeRole = (appInfo?.role || '').replace(/\|/g, '\\|').replace(/\n/g, ' ')
      const newRow = `| ${nextNum} | ${id} | ${today} | ${safeCompany} | ${safeRole} | Email | | 发送跟进消息：${safeMsg} |`
      appendFileSync(followUpsFile, newRow + '\n', 'utf-8')

      return { success: true, data: { message: '消息记录已保存' } }
    }
  }
}

function getDefaultCompanies() {
  return []
}

function parseMarkdownSections(content) {
  const sections = []
  const lines = content.split('\n')
  let currentSection = null
  
  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (currentSection) {
        sections.push(currentSection)
      }
      currentSection = { title: line.substring(3), type: 'text', content: '', items: [], questions: [] }
    } else if (currentSection) {
      if (line.startsWith('- ')) {
        if (line.includes('？') || line.includes('?')) {
          if (!currentSection.questions) currentSection.questions = []
          currentSection.type = 'questions'
          currentSection.questions.push(line.substring(2))
        } else {
          if (!currentSection.items) currentSection.items = []
          currentSection.type = 'list'
          currentSection.items.push(line.substring(2))
        }
      } else if (line.trim()) {
        currentSection.content += line + '\n'
      }
    }
  }
  
  if (currentSection) {
    sections.push(currentSection)
  }
  
  return sections
}

async function handleRequest(req, res) {
  const { method, url } = req

  const requestPath = decodeURIComponent(url.split('?')[0])
  if (method === 'GET' && requestPath === '/api/resume/photo') {
    const queryString = url.includes('?') ? url.slice(url.indexOf('?') + 1) : ''
    const query = Object.fromEntries(new URLSearchParams(queryString))
    const relativePath = String(query.path || '').replace(/^\/+/, '').replace(/\\/g, '/')
    if (!relativePath.startsWith('data/job-radar/')) {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('Invalid photo path')
      return
    }
    const filePath = `${PROJECT_ROOT}/${relativePath}`
    if (!existsSync(filePath)) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('Photo not found')
      return
    }
    const lower = filePath.toLowerCase()
    const type = lower.endsWith('.png')
      ? 'image/png'
      : lower.endsWith('.jpg') || lower.endsWith('.jpeg')
        ? 'image/jpeg'
        : 'application/octet-stream'
    res.writeHead(200, { 'Content-Type': type })
    res.end(readFileSync(filePath))
    return
  }

  if (method === 'GET' && requestPath.startsWith('/output/')) {
    const relativePath = requestPath.replace(/^\/+/, '')
    const filePath = `${PROJECT_ROOT}/${relativePath}`
    if (!existsSync(filePath)) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('File not found')
      return
    }
    const lower = filePath.toLowerCase()
    const type = lower.endsWith('.pdf')
      ? 'application/pdf'
      : lower.endsWith('.docx')
        ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        : 'application/octet-stream'
    res.writeHead(200, { 'Content-Type': type })
    res.end(readFileSync(filePath))
    return
  }

  // Serve report files
  if (method === 'GET' && requestPath.startsWith('/reports/')) {
    const relativePath = requestPath.replace(/^\/+/, '')
    const filePath = `${PROJECT_ROOT}/${relativePath}`
    if (!existsSync(filePath)) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('报告文件不存在')
      return
    }
    res.writeHead(200, { 'Content-Type': 'text/markdown; charset=utf-8' })
    res.end(readFileSync(filePath, 'utf-8'))
    return
  }

  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  }

  if (method === 'OPTIONS') {
    res.writeHead(204, corsHeaders)
    res.end()
    return
  }
  
  let body = ''
  await new Promise(resolve => {
    req.on('data', chunk => body += chunk)
    req.on('end', resolve)
  })
  
  let parsedBody = {}
  const contentType = req.headers['content-type'] || ''
  
  if (contentType.includes('application/json')) {
    try {
      parsedBody = JSON.parse(body)
    } catch (e) {
      parsedBody = {}
    }
  } else if (contentType.includes('application/x-www-form-urlencoded')) {
    parsedBody = parse(body)
  } else if (contentType.includes('multipart/form-data')) {
    parsedBody = parseMultipartForm(body)
  }
  
  const path = decodeURIComponent(url.split('?')[0])
  const queryString = url.includes('?') ? url.slice(url.indexOf('?') + 1) : ''
  const query = Object.fromEntries(new URLSearchParams(queryString))
  let matchedRoute = null
  let params = {}
  
  const routeEntries = Object.entries(routes).sort(([a], [b]) => {
    const aParams = a.split('/').filter(part => part.startsWith(':')).length
    const bParams = b.split('/').filter(part => part.startsWith(':')).length
    return aParams - bParams
  })

  for (const [routePath, handlers] of routeEntries) {
    const routeParts = routePath.split('/')
    const pathParts = path.split('/')
    
    if (routeParts.length === pathParts.length) {
      let match = true
      const routeParams = {}
      
      for (let i = 0; i < routeParts.length; i++) {
        if (routeParts[i].startsWith(':')) {
          routeParams[routeParts[i].substring(1)] = pathParts[i]
        } else if (routeParts[i] !== pathParts[i]) {
          match = false
          break
        }
      }
      
      if (match) {
        matchedRoute = handlers
        params = routeParams
        break
      }
    }
  }
  
  if (!matchedRoute || !matchedRoute[method]) {
    res.writeHead(404, corsHeaders)
    res.end(JSON.stringify({ success: false, error: 'Route not found' }))
    return
  }
  
  try {
    const result = await matchedRoute[method](parsedBody, params, query, body)
    res.writeHead(200, corsHeaders)
    res.end(JSON.stringify(result))
  } catch (error) {
    res.writeHead(500, corsHeaders)
    res.end(JSON.stringify({ success: false, error: error.message }))
  }
}

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
})

const server = createServer(handleRequest)

server.listen(PORT, () => {
  console.log(`API Server running on http://localhost:${PORT}`)
})
