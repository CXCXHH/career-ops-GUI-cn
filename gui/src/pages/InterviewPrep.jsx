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
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="8" />
        <circle cx="50" cy="50" r={radius} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" transform="rotate(-90 50 50)" style={{ transition: 'stroke-dashoffset 1s ease' }} />
        <text x="50" y="54" textAnchor="middle" fontSize="22" fontWeight="bold" fill={color}>{score}</text>
        <text x="50" y="70" textAnchor="middle" fontSize="10" fill="#9ca3af">/100</text>
      </svg>
      <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>{label}</span>
    </div>
  )
}

function SectionCard({ icon: Icon, title, badge, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="card">
      <div className="card-header" style={{ cursor: 'pointer', userSelect: 'none' }}
        onClick={() => setOpen(!open)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Icon style={{ width: '18px', height: '18px', color: '#1178CC' }} />
          <div className="card-title">{title}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {badge && <span className="badge">{badge}</span>}
          {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </div>
      {open && <div style={{ padding: open ? '0 24px 24px' : '0' }}>{children}</div>}
    </div>
  )
}

function QuestionCard({ q, a, index, completed, onToggle, category, difficulty, tips, whyItMatters, candidateBridge }) {
  return (
    <div
      className={`question-card ${completed ? 'completed' : ''}`}
      onClick={() => onToggle(index)}
      style={{ marginBottom: '12px', cursor: 'pointer', transition: 'all 0.2s' }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <div className={`check-circle ${completed ? 'checked' : ''}`} style={{ marginTop: '2px' }}>
          {completed && <CheckCircle style={{ width: '14px', height: '14px' }} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
            <span style={{ fontWeight: 'bold', fontSize: '15px' }}>Q{index + 1}: {q}</span>
            {category && <span className="tag" style={{ fontSize: '11px', background: '#f0f7ff', color: '#1178CC' }}>{category}</span>}
            {difficulty && <span className="tag" style={{
              fontSize: '11px',
              background: difficulty === '高级' ? '#fef2f2' : difficulty === '中级' ? '#fffbeb' : '#f0fdf4',
              color: difficulty === '高级' ? '#dc2626' : difficulty === '中级' ? '#d97706' : '#16a34a'
            }}>{difficulty}</span>}
          </div>
          {whyItMatters && (
            <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '6px', display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
              <Zap size={12} style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>为什么问: {whyItMatters}</span>
            </div>
          )}
          <div style={{ background: '#f8fafc', borderRadius: '6px', padding: '12px', fontSize: '14px', lineHeight: '1.7', color: '#334155' }}>
            <div style={{ fontWeight: 600, fontSize: '12px', color: '#1178CC', marginBottom: '4px' }}>建议回答方向：</div>
            {a}
          </div>
          {candidateBridge && (
            <div style={{ marginTop: '6px', fontSize: '12px', color: '#7c3aed', display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
              <BookOpen size={12} style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>连接项目: {candidateBridge}</span>
            </div>
          )}
          {tips && (
            <div style={{ marginTop: '6px', fontSize: '12px', color: '#059669', display: 'flex', alignItems: 'center', gap: '4px' }}>
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
    <div style={{ background: '#fafafa', borderRadius: '10px', marginBottom: '16px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', cursor: 'pointer', userSelect: 'none' }} onClick={() => setExpanded(!expanded)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
          <span style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#1178CC', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 'bold', flexShrink: 0 }}>
            {index + 1}
          </span>
          <span style={{ fontWeight: 'bold', fontSize: '16px', color: '#1178CC', flex: 1 }}>{project.project}</span>
          <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '10px', background: tColor + '20', color: tColor }}>
            {tLabel}
          </span>
          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
        <div style={{ fontSize: '13px', color: '#64748b', paddingLeft: '38px' }}>
          {project.one_minute_pitch?.slice(0, 80)}...
        </div>
      </div>

      {expanded && (
        <div style={{ padding: '0 20px 20px', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
          <div style={{ marginBottom: '14px' }}>
            <div style={{ fontWeight: 600, fontSize: '13px', color: '#1178CC', marginBottom: '4px' }}>一分钟讲法</div>
            <p style={{ fontSize: '14px', lineHeight: '1.7', color: '#334155', margin: 0 }}>{project.one_minute_pitch}</p>
          </div>

          <div style={{ marginBottom: '14px' }}>
            <div style={{ fontWeight: 600, fontSize: '13px', color: '#1178CC', marginBottom: '4px' }}>三分钟讲法</div>
            <p style={{ fontSize: '14px', lineHeight: '1.7', color: '#334155', margin: 0, whiteSpace: 'pre-wrap' }}>{project.three_minute_pitch}</p>
          </div>

          {project.architecture_to_draw && project.architecture_to_draw.length > 0 && (
            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontWeight: 600, fontSize: '13px', color: '#1178CC', marginBottom: '4px' }}>建议画出的架构/数据流</div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {project.architecture_to_draw.map((item, j) => (
                  <span key={j} className="tag" style={{ background: '#f0f7ff', color: '#1178CC', fontSize: '12px' }}>{item}</span>
                ))}
              </div>
            </div>
          )}

          {project.core_technical_points && project.core_technical_points.length > 0 && (
            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontWeight: 600, fontSize: '13px', color: '#1178CC', marginBottom: '4px' }}>核心技术点</div>
              {project.core_technical_points.map((pt, j) => (
                <div key={j} style={{ fontSize: '14px', marginBottom: '2px', paddingLeft: '12px' }}>· {pt}</div>
              ))}
            </div>
          )}

          {project.implementation_steps && project.implementation_steps.length > 0 && (
            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontWeight: 600, fontSize: '13px', color: '#1178CC', marginBottom: '4px' }}>实现步骤</div>
              {project.implementation_steps.map((step, j) => (
                <div key={j} style={{ fontSize: '14px', marginBottom: '2px', paddingLeft: '12px', color: '#475569' }}>{j + 1}. {step}</div>
              ))}
            </div>
          )}

          {project.likely_followups && project.likely_followups.length > 0 && (
            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontWeight: 600, fontSize: '13px', color: '#dc2626', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <AlertTriangle size={14} />
                <span>高频追问</span>
              </div>
              {project.likely_followups.map((fu, j) => (
                <div key={j} style={{ background: '#fff', borderRadius: '8px', padding: '12px', marginBottom: '8px', border: '1px solid #fee2e2' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '4px', color: '#334155' }}>问: {fu.question}</div>
                  <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '4px' }}>答: {fu.answer}</div>
                  {fu.risk && (
                    <div style={{ fontSize: '12px', color: '#dc2626', display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
                      <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: '1px' }} />
                      <span>风险: {fu.risk}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {project.must_review_before_interview && project.must_review_before_interview.length > 0 && (
            <div>
              <div style={{ fontWeight: 600, fontSize: '13px', color: '#dc2626', marginBottom: '4px' }}>面试前必须补学</div>
              {project.must_review_before_interview.map((item, j) => (
                <div key={j} style={{ fontSize: '14px', marginBottom: '2px', paddingLeft: '12px', color: '#991b1b' }}>· {item}</div>
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
        <div className="card-header" style={{ flexWrap: 'wrap', gap: '12px' }}>
          <div className="form-group" style={{ flex: 1, minWidth: '220px', maxWidth: '400px' }}>
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
          <div className="form-group" style={{ flex: 1, minWidth: '220px', maxWidth: '400px' }}>
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
          <button className="btn btn-primary" onClick={handleGenerate}
            disabled={!selectedJob || isGenerating}
            style={{ marginTop: '20px', whiteSpace: 'nowrap' }}>
            <Briefcase style={{ width: '16px', height: '16px', marginRight: '6px' }} />
            {isGenerating ? 'AI 分析中...' : '生成面试准备'}
          </button>
          <button className="btn btn-secondary" onClick={handleExportMarkdown}
            disabled={!interviewPrep || isGenerating}
            style={{ marginTop: '20px', whiteSpace: 'nowrap' }}>
            <Download style={{ width: '16px', height: '16px', marginRight: '6px' }} />
            导出 .md
          </button>
        </div>

        {isGenerating && (
          <div className="empty-state">
            <div className="spinner" style={{ margin: '0 auto' }}></div>
            <p>正在深度分析简历与岗位匹配度...</p>
            <p style={{ fontSize: '12px', color: '#94a3b8' }}>
              已耗时 {generationElapsed} 秒 · {generationHint()}
            </p>
          </div>
        )}

        {!isGenerating && jobs.length === 0 && (
          <div className="empty-state">
            <Briefcase />
            <p>暂无已评估的岗位</p>
            <p style={{ fontSize: '13px', color: '#94a3b8' }}>请先在「岗位列表」页面进行 AI 评估</p>
          </div>
        )}
      </div>

      {!interviewPrep && !isGenerating && jobs.length > 0 && (
        <div className="empty-state">
          <Target style={{ width: '48px', height: '48px', color: '#cbd5e1' }} />
          <p style={{ fontSize: '15px' }}>选择岗位后点击「生成面试准备」，AI 将为你生成完整的面试准备报告</p>
        </div>
      )}

      {data && (
        <>
          {/* ===== 公司面试画像 ===== */}
          {data.company_interview_profile && Object.keys(data.company_interview_profile).length > 0 && (
            <SectionCard icon={Building2} title="公司面试画像" badge="关键">
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontWeight: 600, fontSize: '14px', color: '#1178CC', marginBottom: '6px' }}>面试风格</div>
                <p style={{ fontSize: '14px', lineHeight: '1.7', color: '#334155', margin: 0 }}>{data.company_interview_profile.likely_interview_style || '-'}</p>
              </div>
              {Array.isArray(data.company_interview_profile.company_specific_focus) && data.company_interview_profile.company_specific_focus.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontWeight: 600, fontSize: '14px', color: '#1178CC', marginBottom: '6px' }}>重点关注</div>
                  {data.company_interview_profile.company_specific_focus.map((item, i) => (
                    <div key={i} style={{ fontSize: '14px', marginBottom: '4px', paddingLeft: '12px' }}>· {item}</div>
                  ))}
                </div>
              )}
              {Array.isArray(data.company_interview_profile.jd_evidence) && data.company_interview_profile.jd_evidence.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontWeight: 600, fontSize: '14px', color: '#1178CC', marginBottom: '6px' }}>JD 证据</div>
                  {data.company_interview_profile.jd_evidence.map((item, i) => (
                    <div key={i} style={{ fontSize: '13px', marginBottom: '4px', paddingLeft: '12px', color: '#64748b' }}>· {item}</div>
                  ))}
                </div>
              )}
              {data.company_interview_profile.inference_boundary && (
                <div>
                  <div style={{ fontWeight: 600, fontSize: '14px', color: '#d97706', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <AlertTriangle size={14} /> 推断边界
                  </div>
                  <p style={{ fontSize: '13px', lineHeight: '1.7', color: '#92400e', margin: 0, background: '#fffbeb', padding: '8px 12px', borderRadius: '6px' }}>
                    {data.company_interview_profile.inference_boundary}
                  </p>
                </div>
              )}
            </SectionCard>
          )}

          {/* ===== 概览区：匹配度分数 + 核心摘要 ===== */}
          <SectionCard icon={Target} title="匹配度总览" badge={`${data.match_score || 0}/100`} defaultOpen={true}>
            <div style={{ display: 'flex', gap: '32px', alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: '20px' }}>
              <ScoreRing score={data.match_score} label={data.match_level || '匹配度'} />
              <div style={{ flex: 1, minWidth: '280px' }}>
                <h4 style={{ margin: '0 0 8px', color: '#000' }}>岗位分析摘要</h4>
                <p style={{ fontSize: '14px', lineHeight: '1.8', color: '#334155', whiteSpace: 'pre-wrap' }}>
                  {data.job_analysis || '(暂无数据)'}
                </p>
                {data.provider_label && (
                  <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '8px' }}>
                    由 {data.provider_label} ({data.model}) 生成 · {data.generated_at?.substring(0, 19)}
                  </p>
                )}
              </div>
            </div>

            {/* 问题规划摘要 */}
            {data.question_plan && (
              <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '14px 16px', marginTop: '8px' }}>
                <div style={{ fontWeight: 600, fontSize: '13px', color: '#1178CC', marginBottom: '8px' }}>问题规划</div>
                <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                  <div style={{ fontSize: '13px', color: '#334155' }}>
                    领域: <strong>{data.question_plan.domain || '-'}</strong>
                  </div>
                  <div style={{ fontSize: '13px', color: '#334155' }}>
                    技术题: <strong>{data.question_plan.technical_count || 0}</strong>
                  </div>
                  <div style={{ fontSize: '13px', color: '#334155' }}>
                    项目深挖: <strong>{data.question_plan.project_deep_dive_count || 0}</strong>
                  </div>
                  <div style={{ fontSize: '13px', color: '#334155' }}>
                    行为题: <strong>{data.question_plan.behavioral_count || 0}</strong>
                  </div>
                  <div style={{ fontSize: '13px', color: '#334155' }}>
                    最低总题量: <strong>{data.question_plan.minimum_total_questions || 0}</strong>
                  </div>
                </div>
                {data.question_plan.reason && (
                  <p style={{ fontSize: '12px', color: '#64748b', marginTop: '8px', marginBottom: 0 }}>
                    规划原因: {data.question_plan.reason}
                  </p>
                )}
              </div>
            )}
          </SectionCard>

          {/* ===== 个人优势分析 ===== */}
          <SectionCard icon={Star} title="个人优势分析" badge={Array.isArray(data.strengths) ? `${data.strengths.length}项` : '0'}>
            {Array.isArray(data.strengths) && data.strengths.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '12px' }}>
                {data.strengths.map((s, i) => (
                  <div key={i} style={{
                    borderLeft: '4px solid #16a34a', background: '#f0fdf4', borderRadius: '0 8px 8px 0',
                    padding: '14px 16px'
                  }}>
                    <div style={{ fontWeight: 'bold', color: '#15803d', marginBottom: '6px', fontSize: '15px' }}>
                      优势 {i + 1}: {s.area}
                    </div>
                    <div style={{ fontSize: '14px', lineHeight: '1.7', color: '#334155', marginBottom: '6px' }}>{s.detail}</div>
                    {s.evidence && (
                      <div style={{ fontSize: '12px', color: '#64748b', background: '#fff', padding: '6px 10px', borderRadius: '4px' }}>
                        证据: {s.evidence}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : <p style={{ color: '#94a3b8', textAlign: 'center', padding: '20px' }}>(暂无数据)</p>}
          </SectionCard>

          {/* ===== 潜在短板与改进 ===== */}
          <SectionCard icon={ShieldAlert} title="潜在短板识别" badge={Array.isArray(data.weaknesses) ? `${data.weaknesses.length}项` : '0'}>
            {Array.isArray(data.weaknesses) && data.weaknesses.length > 0 ? (
              data.weaknesses.map((w, i) => (
                <div key={i} style={{
                  borderBottom: i < data.weaknesses.length - 1 ? '1px solid #e5e7eb' : 'none',
                  padding: '12px 0'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '15px' }}>{w.gap}</span>
                    <span style={{
                      fontSize: '11px', padding: '2px 8px', borderRadius: '10px',
                      background: w.severity === '高' ? '#fef2f2' : w.severity === '中' ? '#fffbeb' : '#f0fdf4',
                      color: w.severity === '高' ? '#dc2626' : w.severity === '中' ? '#d97706' : '#16a34a'
                    }}>{w.severity || '中'}风险</span>
                  </div>
                  <div style={{ fontSize: '14px', color: '#059669', marginLeft: '8px' }}>
                    <Lightbulb size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                    改进建议: {w.improvement || '-'}
                  </div>
                </div>
              ))
            ) : <p style={{ color: '#94a3b8', textAlign: 'center', padding: '20px' }}>(暂无数据)</p>}
          </SectionCard>

          {/* ===== 必讲项目推荐 ===== */}
          <SectionCard icon={Code2} title="必讲项目推荐" badge={Array.isArray(data.must_talk_projects) ? `${data.must_talk_projects.length}个` : '0'}>
            {Array.isArray(data.must_talk_projects) && data.must_talk_projects.length > 0 ? (
              data.must_talk_projects.map((p, i) => (
                <div key={i} style={{
                  background: '#fafafa', borderRadius: '8px', padding: '16px', marginBottom: '12px',
                  border: '1px solid #e5e7eb'
                }}>
                  <div style={{ fontWeight: 'bold', fontSize: '16px', color: '#1178CC', marginBottom: '4px' }}>
                    项目 {i + 1}: {p.project}
                  </div>
                  <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '8px' }}>推荐理由: {p.reason}</div>
                  {Array.isArray(p.key_points) && p.key_points.length > 0 && (
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>关键要点:</div>
                      {p.key_points.map((kp, j) => (
                        <div key={j} style={{ fontSize: '13px', paddingLeft: '16px', marginBottom: '2px' }}>
                          · {kp}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            ) : <p style={{ color: '#94a3b8', textAlign: 'center', padding: '20px' }}>(暂无数据)</p>}
          </SectionCard>

          {/* ===== AI 项目速成 ===== */}
          {Array.isArray(data.ai_project_explainers) && data.ai_project_explainers.length > 0 && (
            <SectionCard icon={FileText} title="AI 生成项目速成" badge={`${data.ai_project_explainers.length}个`}>
              <div style={{ background: '#fffbeb', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: '#92400e', display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
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
                  className={`question-card ${completedQuestions.has(globalIdx) ? 'completed' : ''}`}
                  onClick={() => toggleQuestionComplete(globalIdx)}
                  style={{ marginBottom: '12px', cursor: 'pointer', transition: 'all 0.2s' }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    <div className={`check-circle ${completedQuestions.has(globalIdx) ? 'checked' : ''}`} style={{ marginTop: '2px' }}>
                      {completedQuestions.has(globalIdx) && <CheckCircle style={{ width: '14px', height: '14px' }} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
                        <span style={{ fontWeight: 'bold', fontSize: '15px' }}>Q{globalIdx + 1}: {q.question}</span>
                        {q.type && <span className="tag" style={{ fontSize: '11px', background: '#f0f7ff', color: '#1178CC' }}>{q.type}</span>}
                      </div>
                      <div style={{ background: '#f8fafc', borderRadius: '6px', padding: '12px', fontSize: '14px', lineHeight: '1.7', color: '#334155' }}>
                        <div style={{ fontWeight: 600, fontSize: '12px', color: '#1178CC', marginBottom: '4px' }}>建议回答方向：</div>
                        {q.suggested_answer}
                      </div>
                      {q.star_framework && (
                        <div style={{ marginTop: '8px', padding: '10px 14px', background: '#eff6ff', borderRadius: '6px', fontSize: '13px', color: '#1e40af' }}>
                          <strong style={{ display: 'block', marginBottom: '4px' }}>STAR 框架提示</strong>
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
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '14px', color: '#1178CC', marginBottom: '6px' }}>公司简介</div>
                  <p style={{ fontSize: '14px', lineHeight: '1.7' }}>{data.company_research.overview || '-'}</p>
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '14px', color: '#1178CC', marginBottom: '6px' }}>行业地位</div>
                  <p style={{ fontSize: '14px', lineHeight: '1.7' }}>{data.company_research.industry_position || '-'}</p>
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '14px', color: '#1178CC', marginBottom: '6px' }}>主要技术栈</div>
                  <p style={{ fontSize: '14px' }}>{Array.isArray(data.company_research.tech_stack) ? data.company_research.tech_stack.join(', ') : data.company_research.tech_stack || '-'}</p>
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '14px', color: '#1178CC', marginBottom: '6px' }}>文化关键词</div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {(Array.isArray(data.company_research.culture_keywords) ? data.company_research.culture_keywords : []).map((kw, i) => (
                      <span key={i} className="tag" style={{ background: '#f4f6f8', color: '#1e293b' }}>{kw}</span>
                    ))}
                  </div>
                </div>
                {data.company_research.recent_news && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <div style={{ fontWeight: 600, fontSize: '14px', color: '#1178CC', marginBottom: '6px' }}>近期动态</div>
                    <p style={{ fontSize: '14px', lineHeight: '1.7' }}>{data.company_research.recent_news}</p>
                  </div>
                )}
              </div>
            </SectionCard>
          )}

          {/* ===== 面试准备建议 ===== */}
          {data.prep_suggestions && (
            <SectionCard icon={Lightbulb} title="针对性准备建议">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                {data.prep_suggestions.before_interview && (
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '14px', color: '#1178CC', marginBottom: '6px' }}>面试前准备</div>
                    {data.prep_suggestions.before_interview.map((s, i) => (
                      <div key={i} style={{ fontSize: '14px', marginBottom: '4px', paddingLeft: '12px' }}>· {s}</div>
                    ))}
                  </div>
                )}
                {data.prep_suggestions.resume_tweaks && (
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '14px', color: '#1178CC', marginBottom: '6px' }}>简历微调建议</div>
                    {data.prep_suggestions.resume_tweaks.map((s, i) => (
                      <div key={i} style={{ fontSize: '14px', marginBottom: '4px', paddingLeft: '12px' }}>· {s}</div>
                    ))}
                  </div>
                )}
                {data.prep_suggestions.key_topics_to_review && (
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '14px', color: '#dc2626', marginBottom: '6px' }}>必复习知识点</div>
                    {data.prep_suggestions.key_topics_to_review.map((s, i) => (
                      <div key={i} style={{ fontSize: '14px', marginBottom: '4px', paddingLeft: '12px', color: '#991b1b' }}>· {s}</div>
                    ))}
                  </div>
                )}
                {data.prep_suggestions.red_flags_to_avoid && (
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '14px', color: '#dc2626', marginBottom: '6px' }}>需要避免的坑</div>
                    {data.prep_suggestions.red_flags_to_avoid.map((s, i) => (
                      <div key={i} style={{ fontSize: '14px', marginBottom: '4px', paddingLeft: '12px', color: '#991b1b' }}>· {s}</div>
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
                <div key={i} style={{
                  borderBottom: i < data.questions_for_interviewer.length - 1 ? '1px solid #f1f5f9' : 'none',
                  padding: '12px 0', display: 'flex', gap: '12px', alignItems: 'flex-start'
                }}>
                  <span style={{
                    width: '26px', height: '26px', borderRadius: '50%', background: '#1178CC', color: '#fff',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '12px', fontWeight: 'bold', flexShrink: 0, marginTop: '2px'
                  }}>{i + 1}</span>
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '4px' }}>{q.question}</div>
                    {q.rationale && <div style={{ fontSize: '13px', color: '#64748b' }}>→ {q.rationale}</div>}
                  </div>
                </div>
              ))}
            </SectionCard>
          )}

          {/* 进度总结 */}
          {totalQ > 0 && (
            <div className="card" style={{ textAlign: 'center', padding: '20px' }}>
              <div style={{ fontSize: '15px', color: '#334155' }}>
                准备进度：<strong style={{ color: completedCount === totalQ ? '#16a34a' : '#1178CC' }}>{completedCount}/{totalQ}</strong> 道题目已完成
                {completedCount === totalQ && <span style={{ color: '#16a34a', marginLeft: '8px' }}><CheckCircle size={16} style={{ verticalAlign: 'middle' }} /> 准备就绪！</span>}
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', marginTop: '12px', fontSize: '13px', color: '#64748b', flexWrap: 'wrap' }}>
                <span>技术题: <strong style={{ color: '#334155' }}>{techCompleted}/{(data.technical_questions || []).length}</strong></span>
                <span>项目深挖: <strong style={{ color: '#334155' }}>{projectCompleted}/{(data.project_deep_dive_questions || []).length}</strong></span>
                <span>行为题: <strong style={{ color: '#334155' }}>{behavioralCompleted}/{(data.behavioral_questions || []).length}</strong></span>
              </div>
            </div>
          )}
        </>
      )}
    </>
  )
}
