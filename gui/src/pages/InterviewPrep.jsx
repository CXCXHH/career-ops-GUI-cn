import { useState, useEffect } from 'react'
import { Briefcase, Target, ShieldAlert, Star, Code2, Users, Building2, Lightbulb, MessageCircle, CheckCircle, Download, ChevronDown, ChevronUp, AlertTriangle, BookOpen, FileText, Zap } from 'lucide-react'
import { jobsAPI, interviewPrepAPI, aiAPI } from '../api'
import { showToast } from '../utils/toast'

function ScoreRing({ score, label }) {
  const radius = 42
  const circumference = 2 * Math.PI * radius
  const pct = Math.min(100, Math.max(0, Number(score) || 0))
  const offset = circumference - (pct / 100) * circumference
  const color = pct >= 80 ? '#16a34a' : pct >= 60 ? '#eab308' : '#ef4444'

  return (
    <div className="flex-col items-center gap-8">
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="8" />
        <circle cx="50" cy="50" r={radius} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" transform="rotate(-90 50 50)" style={{ transition: 'stroke-dashoffset 1s ease' }} />
        <text x="50" y="54" textAnchor="middle" fontSize="22" fontWeight="bold" fill={color}>{score}</text>
        <text x="50" y="70" textAnchor="middle" fontSize="10" fill="#9ca3af">/100</text>
      </svg>
      <span className="text-13 text-secondary font-500">{label}</span>
    </div>
  )
}

function SectionCard({ icon: Icon, title, badge, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="card">
      <div className="card-header cursor-pointer user-select-none"
        onClick={() => setOpen(!open)}>
        <div className="flex items-center gap-8">
          <Icon style={{ width: 18, height: 18, color: 'var(--primary-color)' }} />
          <div className="card-title">{title}</div>
        </div>
        <div className="flex items-center gap-8">
          {badge && <span className="badge">{badge}</span>}
          {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </div>
      {open && <div className="px-24 pb-24">{children}</div>}
    </div>
  )
}

function QuestionCard({ q, a, index, completed, onToggle, category, difficulty, tips, whyItMatters, candidateBridge }) {
  const diffClass = difficulty === '高级' ? 'ip-tag-difficulty-advanced' : difficulty === '中级' ? 'ip-tag-difficulty-intermediate' : 'ip-tag-difficulty-basic'

  return (
    <div
      className={`question-card ${completed ? 'completed' : ''} mb-12 cursor-pointer`}
      onClick={() => onToggle(index)}
    >
      <div className="flex items-start gap-12">
        <div className={`check-circle ${completed ? 'checked' : ''} mt-2`}>
          {completed && <CheckCircle style={{ width: 14, height: 14 }} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="ip-q-meta">
            <span className="ip-q-title">Q{index + 1}: {q}</span>
            {category && <span className="tag ip-tag-blue">{category}</span>}
            {difficulty && <span className={`tag ${diffClass}`}>{difficulty}</span>}
          </div>
          {whyItMatters && (
            <div className="text-12 text-secondary mb-6 flex items-start gap-4">
              <Zap size={12} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>为什么问: {whyItMatters}</span>
            </div>
          )}
          <div className="ip-answer-box">
            <div className="ip-answer-label">建议回答方向：</div>
            {a}
          </div>
          {candidateBridge && (
            <div className="mt-6 text-12 flex items-start gap-4" style={{ color: '#7c3aed' }}>
              <BookOpen size={12} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>连接项目: {candidateBridge}</span>
            </div>
          )}
          {tips && (
            <div className="mt-6 text-12 flex items-center gap-4" style={{ color: '#059669' }}>
              <Lightbulb size={13} /> 加分技巧: {tips}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function AiProjectCard({ project, index }) {
  const [expanded, setExpanded] = useState(false)
  const truthLabel = {
    adapted: '适配已有项目',
    gap_bridging: '补足经历项目',
    inferred: '推理生成项目'
  }
  const truthColor = {
    adapted: '#3b82f6',
    gap_bridging: '#f59e0b',
    inferred: '#8b5cf6'
  }
  const tColor = truthColor[project.truth_level] || '#6b7280'
  const tLabel = truthLabel[project.truth_level] || project.truth_level

  return (
    <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, marginBottom: 16, border: '1px solid var(--border-color)', overflow: 'hidden' }}>
      <div className="p-16 cursor-pointer user-select-none" style={{ padding: '16px 20px' }} onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-8 mb-6" style={{ gap: 10 }}>
          <span className="ip-number-badge" style={{ width: 28, height: 28, fontSize: 13 }}>
            {index + 1}
          </span>
          <span className="flex-1 font-700 text-16" style={{ color: 'var(--primary-color)' }}>{project.project}</span>
          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: tColor + '20', color: tColor }}>
            {tLabel}
          </span>
          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
        <div className="text-13 text-secondary" style={{ paddingLeft: 38 }}>
          {project.one_minute_pitch?.slice(0, 80)}...
        </div>
      </div>

      {expanded && (
        <div style={{ padding: '0 20px 20px', borderTop: '1px solid var(--border-color)', paddingTop: 16 }}>
          <div className="mb-14">
            <div className="ip-section-title text-13">一分钟讲法</div>
            <p className="text-14 mb-0" style={{ lineHeight: 1.7, color: 'var(--text-primary)' }}>{project.one_minute_pitch}</p>
          </div>

          <div className="mb-14">
            <div className="ip-section-title text-13">三分钟讲法</div>
            <p className="text-14 mb-0 whitespace-pre-wrap" style={{ lineHeight: 1.7, color: 'var(--text-primary)' }}>{project.three_minute_pitch}</p>
          </div>

          {project.architecture_to_draw && project.architecture_to_draw.length > 0 && (
            <div className="mb-14">
              <div className="ip-section-title text-13">建议画出的架构/数据流</div>
              <div className="flex flex-wrap gap-6">
                {project.architecture_to_draw.map((item, j) => (
                  <span key={j} className="tag ip-tag-blue text-12">{item}</span>
                ))}
              </div>
            </div>
          )}

          {project.core_technical_points && project.core_technical_points.length > 0 && (
            <div className="mb-14">
              <div className="ip-section-title text-13">核心技术点</div>
              {project.core_technical_points.map((pt, j) => (
                <div key={j} className="text-14 mb-2 ip-bullet-item">· {pt}</div>
              ))}
            </div>
          )}

          {project.implementation_steps && project.implementation_steps.length > 0 && (
            <div className="mb-14">
              <div className="ip-section-title text-13">实现步骤</div>
              {project.implementation_steps.map((step, j) => (
                <div key={j} className="text-14 mb-2 ip-bullet-item" style={{ color: '#475569' }}>{j + 1}. {step}</div>
              ))}
            </div>
          )}

          {project.likely_followups && project.likely_followups.length > 0 && (
            <div className="mb-14">
              <div className="font-600 text-13 mb-6 flex items-center gap-4" style={{ color: 'var(--danger-color)' }}>
                <AlertTriangle size={14} />
                <span>高频追问</span>
              </div>
              {project.likely_followups.map((fu, j) => (
                <div key={j} className="ip-followup-card">
                  <div className="font-700 text-14 mb-4" style={{ color: 'var(--text-primary)' }}>问: {fu.question}</div>
                  <div className="text-13 text-secondary mb-4">答: {fu.answer}</div>
                  {fu.risk && (
                    <div className="text-12 flex items-start gap-4" style={{ color: 'var(--danger-color)' }}>
                      <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: 1 }} />
                      <span>风险: {fu.risk}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {project.must_review_before_interview && project.must_review_before_interview.length > 0 && (
            <div>
              <div className="font-600 text-13 mb-4" style={{ color: 'var(--danger-color)' }}>面试前必须补学</div>
              {project.must_review_before_interview.map((item, j) => (
                <div key={j} className="ip-bullet-item-danger text-14 mb-2">· {item}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const INTERVIEW_PREP_CACHE_KEY = 'interviewPrepCache'

function loadPrepCache() {
  try {
    return JSON.parse(localStorage.getItem(INTERVIEW_PREP_CACHE_KEY) || '{}')
  } catch (_) { return {} }
}

function savePrepToCache(jobId, data) {
  const cache = loadPrepCache()
  cache[jobId] = { data, savedAt: new Date().toISOString() }
  localStorage.setItem(INTERVIEW_PREP_CACHE_KEY, JSON.stringify(cache))
}

function getPrepFromCache(jobId) {
  const cache = loadPrepCache()
  return cache[jobId]?.data || null
}

function getAnalyzedJobIds() {
  const cache = loadPrepCache()
  return Object.keys(cache)
}

export default function InterviewPrep({ onToast }) {
  const [jobs, setJobs] = useState([])
  const [selectedJob, setSelectedJob] = useState('')
  const [interviewPrep, setInterviewPrep] = useState(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationElapsed, setGenerationElapsed] = useState(0)
  const [completedQuestions, setCompletedQuestions] = useState(new Set())
  const [activeTab, setActiveTab] = useState('overview')
  const [selectedProvider, setSelectedProvider] = useState('deepseek')
  const [selectedAnalyzedJob, setSelectedAnalyzedJob] = useState('')
  const [analyzedJobs, setAnalyzedJobs] = useState([])

  useEffect(() => {
    fetchJobs()
    fetchAiSettings()
  }, [])

  useEffect(() => {
    refreshAnalyzedJobs()
  }, [jobs])

  useEffect(() => {
    if (!isGenerating) {
      setGenerationElapsed(0)
      return
    }
    const timer = setInterval(() => {
      setGenerationElapsed(prev => prev + 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [isGenerating])

  const refreshAnalyzedJobs = () => {
    const ids = getAnalyzedJobIds()
    const matched = jobs.filter(j => ids.includes(j.id))
    setAnalyzedJobs(matched)
  }

  const fetchAiSettings = async () => {
    try {
      const res = await aiAPI.getProviders()
      const configured = (res.data || []).find(p => p.configured)
      if (configured) {
        setSelectedProvider(configured.id || 'deepseek')
      }
    } catch (_) { /* keep default */ }
  }

  const generationHint = () => {
    if (generationElapsed < 15) return '通常约 20-40 秒'
    if (generationElapsed < 40) return '通常约 30-60 秒'
    if (generationElapsed < 70) return '本次耗时偏长，通常在 1 分钟内完成'
    return '已超过常见耗时，请继续等待，本次任务可能较复杂'
  }

  const fetchJobs = async () => {
    try {
      const res = await jobsAPI.getAll()
      const evaluatedJobs = res.data?.filter(j => j.score) || []
      setJobs(evaluatedJobs)
    } catch (error) {
      console.error('InterviewPrep fetch jobs error:', error)
      showToast(onToast, '加载岗位数据失败', 'error')
    }
  }

  const handleSelectAnalyzedJob = async (jobId) => {
    setSelectedAnalyzedJob(jobId)
    setSelectedJob('')
    if (!jobId) {
      setInterviewPrep(null)
      setCompletedQuestions(new Set())
      return
    }
    const cached = getPrepFromCache(jobId)
    if (cached) {
      setInterviewPrep(cached)
      setCompletedQuestions(new Set())
      return
    }
    try {
      const res = await interviewPrepAPI.get(jobId)
      if (res.data && (res.data.match_score != null || res.data.markdown)) {
        setInterviewPrep(res.data)
        savePrepToCache(jobId, res.data)
      } else {
        setInterviewPrep(null)
        showToast(onToast, '该岗位的面试准备数据格式不兼容，请重新生成', 'warning')
      }
    } catch (_) {
      setInterviewPrep(null)
      showToast(onToast, '该岗位的面试准备缓存已失效，请重新生成', 'warning')
    }
  }

  const handleGenerate = async () => {
    if (!selectedJob) {
      showToast(onToast, '请先选择一个岗位', 'error')
      return
    }
    setIsGenerating(true)
    setInterviewPrep(null)
    setSelectedAnalyzedJob('')
    setCompletedQuestions(new Set())
    try {
      const res = await interviewPrepAPI.generate(selectedJob, selectedProvider)
      setInterviewPrep(res.data)
      savePrepToCache(selectedJob, res.data)
      refreshAnalyzedJobs()
      setActiveTab('overview')
      showToast(onToast, '面试准备报告生成成功！', 'success')
    } catch (error) {
      showToast(onToast, error?.response?.data?.error || error?.message || '生成失败，请检查 AI 配置', 'error')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleExportMarkdown = async () => {
    const jobId = selectedAnalyzedJob || selectedJob
    if (!jobId && !interviewPrep?.markdown) {
      showToast(onToast, '请先生成面试准备报告', 'error')
      return
    }
    try {
      let markdown = interviewPrep?.markdown
      let fileName = interviewPrep?.path?.split('/').pop() || 'interview-prep.md'
      if (!markdown && jobId) {
        const res = await interviewPrepAPI.get(jobId)
        markdown = res.data.markdown
        fileName = res.data.path?.split('/').pop() || fileName
      }
      if (!markdown) throw new Error('未找到 Markdown 内容')
      const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      showToast(onToast, 'Markdown 已导出', 'success')
    } catch (error) {
      showToast(onToast, `导出失败：${error.message}`, 'error')
    }
  }

  const toggleQuestionComplete = (index) => {
    setCompletedQuestions(prev => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  const allQuestions = [
    ...(interviewPrep?.technical_questions || []).map((q, i) => ({ ...q, _type: 'tech', _idx: i })),
    ...(interviewPrep?.project_deep_dive_questions || []).map((q, i) => ({ ...q, _type: 'project', _idx: i + (interviewPrep?.technical_questions || []).length })),
    ...(interviewPrep?.behavioral_questions || []).map((q, i) => ({
      ...q,
      _type: 'behavioral',
      _idx: i + (interviewPrep?.technical_questions || []).length + (interviewPrep?.project_deep_dive_questions || []).length
    }))
  ]

  const totalQ = allQuestions.length
  const completedCount = completedQuestions.size
  const techCompleted = (interviewPrep?.technical_questions || []).filter((_, i) => completedQuestions.has(i)).length
  const projectCompleted = (interviewPrep?.project_deep_dive_questions || []).filter((_, i) => completedQuestions.has(i + (interviewPrep?.technical_questions || []).length)).length
  const behavioralCompleted = (interviewPrep?.behavioral_questions || []).filter((_, i) => completedQuestions.has(i + (interviewPrep?.technical_questions || []).length + (interviewPrep?.project_deep_dive_questions || []).length)).length

  const data = interviewPrep

  return (
    <>
      <div className="page-header">
        <h2>面试准备</h2>
        <p>AI 驱动的深度智能匹配分析与面试辅导</p>
      </div>

      {/* 岗位选择 */}
      <div className="card">
        <div className="card-header flex-wrap gap-12">
          <div className="form-group flex-1" style={{ minWidth: 220, maxWidth: 400 }}>
            <label>选择已评估岗位</label>
            <select value={selectedJob} onChange={(e) => { setSelectedJob(e.target.value); setSelectedAnalyzedJob(''); }} className="form-control">
              <option value="">-- 请选择岗位 --</option>
              {jobs.map(job => (
                <option key={job.id} value={job.id}>
                  {job.company} - {job.title} （评分: {job.score || '-'}/5）
                </option>
              ))}
            </select>
          </div>
          <div className="form-group flex-1" style={{ minWidth: 220, maxWidth: 400 }}>
            <label>选择已分析岗位</label>
            <select value={selectedAnalyzedJob} onChange={(e) => handleSelectAnalyzedJob(e.target.value)} className="form-control">
              <option value="">-- 查看已分析结果 --</option>
              {analyzedJobs.map(job => (
                <option key={job.id} value={job.id}>
                  {job.company} - {job.title} （匹配度: {getPrepFromCache(job.id)?.match_score || '-'}/100）
                </option>
              ))}
            </select>
          </div>
          <button className="btn btn-primary mt-20 whitespace-nowrap" onClick={handleGenerate}
            disabled={!selectedJob || isGenerating}>
            <Briefcase style={{ width: 16, height: 16, marginRight: 6 }} />
            {isGenerating ? 'AI 分析中...' : '生成面试准备'}
          </button>
          <button className="btn btn-secondary mt-20 whitespace-nowrap" onClick={handleExportMarkdown}
            disabled={!interviewPrep || isGenerating}>
            <Download style={{ width: 16, height: 16, marginRight: 6 }} />
            导出 .md
          </button>
        </div>

        {isGenerating && (
          <div className="empty-state">
            <div className="spinner" style={{ margin: '0 auto' }}></div>
            <p>正在深度分析简历与岗位匹配度...</p>
            <p className="text-12 text-secondary">
              已耗时 {generationElapsed} 秒 · {generationHint()}
            </p>
          </div>
        )}

        {!isGenerating && jobs.length === 0 && (
          <div className="empty-state">
            <Briefcase />
            <p>暂无已评估的岗位</p>
            <p className="text-13 text-secondary">请先在「岗位」页面进行 AI 评估</p>
          </div>
        )}
      </div>

      {!interviewPrep && !isGenerating && jobs.length > 0 && (
        <div className="empty-state">
          <Target style={{ width: 48, height: 48, color: 'var(--border-color)' }} />
          <p className="text-15">选择岗位后点击「生成面试准备」，AI 将为你生成完整的面试准备报告</p>
        </div>
      )}

      {data && (
        <>
          {/* ===== 公司面试画像 ===== */}
          {data.company_interview_profile && Object.keys(data.company_interview_profile).length > 0 && (
            <SectionCard icon={Building2} title="公司面试画像" badge="关键">
              <div className="mb-16">
                <div className="ip-section-title">面试风格</div>
                <p className="text-14 mb-0" style={{ lineHeight: 1.7, color: 'var(--text-primary)' }}>{data.company_interview_profile.likely_interview_style || '-'}</p>
              </div>
              {Array.isArray(data.company_interview_profile.company_specific_focus) && data.company_interview_profile.company_specific_focus.length > 0 && (
                <div className="mb-16">
                  <div className="ip-section-title">重点关注</div>
                  {data.company_interview_profile.company_specific_focus.map((item, i) => (
                    <div key={i} className="text-14 mb-4 ip-bullet-item">· {item}</div>
                  ))}
                </div>
              )}
              {Array.isArray(data.company_interview_profile.jd_evidence) && data.company_interview_profile.jd_evidence.length > 0 && (
                <div className="mb-16">
                  <div className="ip-section-title">JD 证据</div>
                  {data.company_interview_profile.jd_evidence.map((item, i) => (
                    <div key={i} className="text-13 mb-4 ip-bullet-item text-secondary">· {item}</div>
                  ))}
                </div>
              )}
              {data.company_interview_profile.inference_boundary && (
                <div>
                  <div className="font-600 text-14 mb-6 flex items-center gap-4" style={{ color: 'var(--warning-color)' }}>
                    <AlertTriangle size={14} /> 推断边界
                  </div>
                  <p className="ip-info-box mb-0" style={{ color: '#92400e', background: 'var(--warning-tint)' }}>
                    {data.company_interview_profile.inference_boundary}
                  </p>
                </div>
              )}
            </SectionCard>
          )}

          {/* ===== 概览区：匹配度分数 + 核心摘要 ===== */}
          <SectionCard icon={Target} title="匹配度总览" badge={`${data.match_score || 0}/100`} defaultOpen={true}>
            <div className="ip-stat-container">
              <ScoreRing score={data.match_score} label={data.match_level || '匹配度'} />
              <div className="ip-stat-detail">
                <h4 className="mb-8" style={{ color: 'var(--text-primary)' }}>岗位分析摘要</h4>
                <p className="text-14 whitespace-pre-wrap" style={{ lineHeight: 1.8, color: 'var(--text-primary)' }}>
                  {data.job_analysis || '(暂无数据)'}
                </p>
                {data.provider_label && (
                  <p className="text-11 text-secondary mt-8">
                    由 {data.provider_label} ({data.model}) 生成 · {data.generated_at?.substring(0, 19)}
                  </p>
                )}
              </div>
            </div>

            {/* 问题规划摘要 */}
            {data.question_plan && (
              <div className="ip-answer-box mt-8" style={{ padding: '14px 16px' }}>
                <div className="ip-section-title text-13 mb-8">问题规划</div>
                <div className="flex flex-wrap gap-24">
                  <div className="text-13" style={{ color: 'var(--text-primary)' }}>
                    领域: <strong>{data.question_plan.domain || '-'}</strong>
                  </div>
                  <div className="text-13" style={{ color: 'var(--text-primary)' }}>
                    技术题: <strong>{data.question_plan.technical_count || 0}</strong>
                  </div>
                  <div className="text-13" style={{ color: 'var(--text-primary)' }}>
                    项目深挖: <strong>{data.question_plan.project_deep_dive_count || 0}</strong>
                  </div>
                  <div className="text-13" style={{ color: 'var(--text-primary)' }}>
                    行为题: <strong>{data.question_plan.behavioral_count || 0}</strong>
                  </div>
                  <div className="text-13" style={{ color: 'var(--text-primary)' }}>
                    最低总题量: <strong>{data.question_plan.minimum_total_questions || 0}</strong>
                  </div>
                </div>
                {data.question_plan.reason && (
                  <p className="text-12 text-secondary mt-8 mb-0">
                    规划原因: {data.question_plan.reason}
                  </p>
                )}
              </div>
            )}
          </SectionCard>

          {/* ===== 个人优势分析 ===== */}
          <SectionCard icon={Star} title="个人优势分析" badge={Array.isArray(data.strengths) ? `${data.strengths.length}项` : '0'}>
            {Array.isArray(data.strengths) && data.strengths.length > 0 ? (
              <div className="grid-auto-320">
                {data.strengths.map((s, i) => (
                  <div key={i} className="ip-strength-card">
                    <div className="ip-strength-title">
                      优势 {i + 1}: {s.area}
                    </div>
                    <div className="text-14 mb-6" style={{ lineHeight: 1.7, color: 'var(--text-primary)' }}>{s.detail}</div>
                    {s.evidence && (
                      <div className="ip-strength-evidence">
                        证据: {s.evidence}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : <p className="ip-empty">(暂无数据)</p>}
          </SectionCard>

          {/* ===== 潜在短板与改进 ===== */}
          <SectionCard icon={ShieldAlert} title="潜在短板识别" badge={Array.isArray(data.weaknesses) ? `${data.weaknesses.length}项` : '0'}>
            {Array.isArray(data.weaknesses) && data.weaknesses.length > 0 ? (
              data.weaknesses.map((w, i) => {
                const sevClass = w.severity === '高' ? 'ip-severity-high' : w.severity === '中' ? 'ip-severity-mid' : 'ip-severity-low'
                return (
                  <div key={i} style={{ borderBottom: i < data.weaknesses.length - 1 ? '1px solid var(--border-color)' : 'none', padding: '12px 0' }}>
                    <div className="flex items-center gap-8 mb-6">
                      <span className="font-700 text-15">{w.gap}</span>
                      <span className={sevClass}>{w.severity || '中'}风险</span>
                    </div>
                    <div className="text-14" style={{ color: '#059669', marginLeft: 8 }}>
                      <Lightbulb size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                      改进建议: {w.improvement || '-'}
                    </div>
                  </div>
                )
              })
            ) : <p className="ip-empty">(暂无数据)</p>}
          </SectionCard>

          {/* ===== 必讲项目推荐 ===== */}
          <SectionCard icon={Code2} title="必讲项目推荐" badge={Array.isArray(data.must_talk_projects) ? `${data.must_talk_projects.length}个` : '0'}>
            {Array.isArray(data.must_talk_projects) && data.must_talk_projects.length > 0 ? (
              data.must_talk_projects.map((p, i) => (
                <div key={i} className="ip-project-card">
                  <div className="ip-project-title">
                    项目 {i + 1}: {p.project}
                  </div>
                  <div className="text-13 text-secondary mb-8">推荐理由: {p.reason}</div>
                  {Array.isArray(p.key_points) && p.key_points.length > 0 && (
                    <div>
                      <div className="text-12 font-600 mb-4" style={{ color: '#475569' }}>关键要点:</div>
                      {p.key_points.map((kp, j) => (
                        <div key={j} className="text-13 ip-bullet-item mb-2">
                          · {kp}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            ) : <p className="ip-empty">(暂无数据)</p>}
          </SectionCard>

          {/* ===== AI 项目速成 ===== */}
          {Array.isArray(data.ai_project_explainers) && data.ai_project_explainers.length > 0 && (
            <SectionCard icon={FileText} title="AI 生成项目速成" badge={`${data.ai_project_explainers.length}个`}>
              <div className="ip-warning-box mb-16" style={{ color: '#92400e' }}>
                <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
                以下项目为 AI 生成或补足经历，请重点准备讲述逻辑和诚实边界，切勿谎称为真实生产经验。
              </div>
              {data.ai_project_explainers.map((project, i) => (
                <AiProjectCard key={i} project={project} index={i} />
              ))}
            </SectionCard>
          )}

          {/* ===== 技术面试问题 ===== */}
          <SectionCard icon={Code2} title="技术面试问题"
            badge={`${(data.technical_questions || []).length}题 | 已完成 ${techCompleted}/${(data.technical_questions || []).length}`}>
            {(data.technical_questions || []).map((q, i) => (
              <QuestionCard
                key={`t-${i}`}
                index={i}
                q={q.question}
                category={q.category}
                difficulty={q.difficulty}
                tips={q.tips}
                whyItMatters={q.why_it_matters}
                candidateBridge={q.candidate_bridge}
                a={q.suggested_answer}
                completed={completedQuestions.has(i)}
                onToggle={toggleQuestionComplete}
              />
            ))}
          </SectionCard>

          <SectionCard icon={Target} title="项目深挖问题"
            badge={`${(data.project_deep_dive_questions || []).length}题 | 已完成 ${projectCompleted}/${(data.project_deep_dive_questions || []).length}`}>
            {(data.project_deep_dive_questions || []).map((q, i) => {
              const globalIdx = i + (data.technical_questions || []).length
              return (
                <QuestionCard
                  key={`p-${i}`}
                  index={globalIdx}
                  q={q.question}
                  category={q.project ? `项目: ${q.project}` : '项目追问'}
                  difficulty="高级"
                  tips={q.danger_zone ? `危险区：${q.danger_zone}` : undefined}
                  a={`${q.expected_depth ? `面试官期待：${q.expected_depth}\n\n` : ''}${q.suggested_answer || ''}`}
                  completed={completedQuestions.has(globalIdx)}
                  onToggle={toggleQuestionComplete}
                />
              )
            })}
          </SectionCard>

          {/* ===== 行为面试问题 ===== */}
          <SectionCard icon={Users} title="行为面试问题（含STAR框架）"
            badge={`${(data.behavioral_questions || []).length}题 | 已完成 ${behavioralCompleted}/${(data.behavioral_questions || []).length}`}>
            {(data.behavioral_questions || []).map((q, i) => {
              const globalIdx = i + (data.technical_questions || []).length + (data.project_deep_dive_questions || []).length
              return (
                <div key={`b-${i}`}
                  className={`question-card ${completedQuestions.has(globalIdx) ? 'completed' : ''} mb-12 cursor-pointer`}
                  onClick={() => toggleQuestionComplete(globalIdx)}
                >
                  <div className="flex items-start gap-12">
                    <div className={`check-circle ${completedQuestions.has(globalIdx) ? 'checked' : ''} mt-2`}>
                      {completedQuestions.has(globalIdx) && <CheckCircle style={{ width: 14, height: 14 }} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="ip-q-meta">
                        <span className="ip-q-title">Q{globalIdx + 1}: {q.question}</span>
                        {q.type && <span className="tag ip-tag-blue">{q.type}</span>}
                      </div>
                      <div className="ip-answer-box">
                        <div className="ip-answer-label">建议回答方向：</div>
                        {q.suggested_answer}
                      </div>
                      {q.star_framework && (
                        <div className="mt-8 p-14 rounded-8" style={{ background: '#eff6ff', color: '#1e40af' }}>
                          <strong className="block mb-4">STAR 框架提示</strong>
                          {q.star_framework}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </SectionCard>

          {/* ===== 公司背景调研 ===== */}
          {data.company_research && (
            <SectionCard icon={Building2} title="公司背景调研">
              <div className="ip-grid-300">
                <div>
                  <div className="ip-section-title">公司简介</div>
                  <p className="text-14" style={{ lineHeight: 1.7 }}>{data.company_research.overview || '-'}</p>
                </div>
                <div>
                  <div className="ip-section-title">行业地位</div>
                  <p className="text-14" style={{ lineHeight: 1.7 }}>{data.company_research.industry_position || '-'}</p>
                </div>
                <div>
                  <div className="ip-section-title">主要技术栈</div>
                  <p className="text-14">{Array.isArray(data.company_research.tech_stack) ? data.company_research.tech_stack.join(', ') : data.company_research.tech_stack || '-'}</p>
                </div>
                <div>
                  <div className="ip-section-title">文化关键词</div>
                  <div className="flex flex-wrap gap-6">
                    {(Array.isArray(data.company_research.culture_keywords) ? data.company_research.culture_keywords : []).map((kw, i) => (
                      <span key={i} className="tag" style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>{kw}</span>
                    ))}
                  </div>
                </div>
                {data.company_research.recent_news && (
                  <div className="colspan-all">
                    <div className="ip-section-title">近期动态</div>
                    <p className="text-14" style={{ lineHeight: 1.7 }}>{data.company_research.recent_news}</p>
                  </div>
                )}
              </div>
            </SectionCard>
          )}

          {/* ===== 面试准备建议 ===== */}
          {data.prep_suggestions && (
            <SectionCard icon={Lightbulb} title="针对性准备建议">
              <div className="ip-grid-280">
                {data.prep_suggestions.before_interview && (
                  <div>
                    <div className="ip-section-title">面试前准备</div>
                    {data.prep_suggestions.before_interview.map((s, i) => (
                      <div key={i} className="text-14 mb-4 ip-bullet-item">· {s}</div>
                    ))}
                  </div>
                )}
                {data.prep_suggestions.resume_tweaks && (
                  <div>
                    <div className="ip-section-title">简历微调建议</div>
                    {data.prep_suggestions.resume_tweaks.map((s, i) => (
                      <div key={i} className="text-14 mb-4 ip-bullet-item">· {s}</div>
                    ))}
                  </div>
                )}
                {data.prep_suggestions.key_topics_to_review && (
                  <div>
                    <div className="font-600 text-14 mb-6" style={{ color: 'var(--danger-color)' }}>必复习知识点</div>
                    {data.prep_suggestions.key_topics_to_review.map((s, i) => (
                      <div key={i} className="ip-bullet-item-danger text-14 mb-4">· {s}</div>
                    ))}
                  </div>
                )}
                {data.prep_suggestions.red_flags_to_avoid && (
                  <div>
                    <div className="font-600 text-14 mb-6" style={{ color: 'var(--danger-color)' }}>需要避免的坑</div>
                    {data.prep_suggestions.red_flags_to_avoid.map((s, i) => (
                      <div key={i} className="ip-bullet-item-danger text-14 mb-4">· {s}</div>
                    ))}
                  </div>
                )}
              </div>
            </SectionCard>
          )}

          {/* ===== 反问面试官 ===== */}
          {Array.isArray(data.questions_for_interviewer) && data.questions_for_interviewer.length > 0 && (
            <SectionCard icon={MessageCircle} title="反问面试官推荐问题" badge={`${data.questions_for_interviewer.length}个`}>
              {data.questions_for_interviewer.map((q, i) => (
                <div key={i} className="flex items-start gap-12" style={{ borderBottom: i < data.questions_for_interviewer.length - 1 ? '1px solid var(--border-color)' : 'none', padding: '12px 0' }}>
                  <span className="ip-number-badge mt-2">{i + 1}</span>
                  <div>
                    <div className="font-700 text-14 mb-4">{q.question}</div>
                    {q.rationale && <div className="text-13 text-secondary">→ {q.rationale}</div>}
                  </div>
                </div>
              ))}
            </SectionCard>
          )}

          {/* 进度总结 */}
          {totalQ > 0 && (
            <div className="card text-center p-20">
              <div className="ip-progress-text">
                准备进度：<strong style={{ color: completedCount === totalQ ? 'var(--success-color)' : 'var(--primary-color)' }}>{completedCount}/{totalQ}</strong> 道题目已完成
                {completedCount === totalQ && <span className="ml-8" style={{ color: 'var(--success-color)' }}><CheckCircle size={16} style={{ verticalAlign: 'middle' }} /> 准备就绪！</span>}
              </div>
              <div className="ip-progress-stats">
                <span>技术题: <strong style={{ color: 'var(--text-primary)' }}>{techCompleted}/{(data.technical_questions || []).length}</strong></span>
                <span>项目深挖: <strong style={{ color: 'var(--text-primary)' }}>{projectCompleted}/{(data.project_deep_dive_questions || []).length}</strong></span>
                <span>行为题: <strong style={{ color: 'var(--text-primary)' }}>{behavioralCompleted}/{(data.behavioral_questions || []).length}</strong></span>
              </div>
            </div>
          )}
        </>
      )}
    </>
  )
}
