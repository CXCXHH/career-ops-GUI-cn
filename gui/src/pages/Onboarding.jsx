import { useEffect, useState } from 'react'
import { CheckCircle, FileText, Search, User, Save } from 'lucide-react'
import { onboardingAPI } from '../api'
import { showToast } from '../utils/toast'

const emptyForm = {
  candidate: {
    full_name: '',
    email: '',
    phone: '',
    location: '',
    github: '',
    linkedin: '',
    portfolio_url: '',
    summary: '',
    skills: '',
    education: '',
    experience: '',
    projects: ''
  },
  target: {
    roles: '',
    cities: '全国',
    levels: '校招/应届, 初级',
    enterprise_types: '不限',
    positive_keywords: '',
    negative_keywords: '销售, 客服, 培训, 保险, 中介',
    companies: ''
  }
}

function TextInput({ label, value, onChange, placeholder, type = 'text' }) {
  return (
    <div className="form-item">
      <label>{label}</label>
      <input className="form-input" type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </div>
  )
}

function TextArea({ label, value, onChange, placeholder, rows = 4 }) {
  return (
    <div className="form-item">
      <label>{label}</label>
      <textarea className="form-input" rows={rows} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </div>
  )
}

function StatusItem({ label, active }) {
  return (
    <span className={`status-badge ${active ? 'status-active' : 'status-unconfirmed'}`} style={{ gap: '4px' }}>
      {active && <CheckCircle size={12} />}
      {label}
    </span>
  )
}

export default function Onboarding({ onToast }) {
  const [form, setForm] = useState(emptyForm)
  const [status, setStatus] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [savedFiles, setSavedFiles] = useState([])

  useEffect(() => {
    fetchStatus()
  }, [])

  const fetchStatus = async () => {
    try {
      const res = await onboardingAPI.status()
      setStatus(res.data)
    } catch (error) {
      showToast(onToast, `加载初始化状态失败：${error.message}`, 'error')
    }
  }

  const update = (section, field, value) => {
    setForm(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }))
  }

  const save = async () => {
    if (!form.candidate.full_name.trim()) {
      showToast(onToast, '请填写姓名', 'error')
      return
    }
    if (!form.target.roles.trim() && !form.target.positive_keywords.trim()) {
      showToast(onToast, '请填写目标岗位或搜索关键词', 'error')
      return
    }

    setIsSaving(true)
    try {
      const res = await onboardingAPI.save(form)
      setSavedFiles(res.data.written || [])
      showToast(onToast, '首次使用配置已生成', 'success')
      await fetchStatus()
    } catch (error) {
      showToast(onToast, `生成失败：${error.message}`, 'error')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      <div className="page-header">
        <h2>首次使用向导</h2>
        <p>填写一次，系统自动生成简历事实库和岗位扫描配置</p>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">初始化状态</div>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <StatusItem label="cv.md" active={status?.cv} />
          <StatusItem label="profile.yml" active={status?.profile} />
          <StatusItem label="portals.yml" active={status?.portals} />
          <StatusItem label="resume-profile.json" active={status?.resume_profile} />
        </div>
      </div>

      <div className="card">
        <div className="section-header">
          <div className="section-title">
            <User className="section-icon" />
            <div>
              <h3>基本信息</h3>
            </div>
          </div>
        </div>
        <div className="form-grid-2">
          <TextInput label="姓名" value={form.candidate.full_name} onChange={(value) => update('candidate', 'full_name', value)} placeholder="如：张三" />
          <TextInput label="所在地" value={form.candidate.location} onChange={(value) => update('candidate', 'location', value)} placeholder="如：长沙 / 深圳 / 全国" />
          <TextInput label="邮箱" value={form.candidate.email} onChange={(value) => update('candidate', 'email', value)} placeholder="name@example.com" />
          <TextInput label="电话" value={form.candidate.phone} onChange={(value) => update('candidate', 'phone', value)} placeholder="手机号" />
          <TextInput label="GitHub" value={form.candidate.github} onChange={(value) => update('candidate', 'github', value)} placeholder="https://github.com/..." />
          <TextInput label="LinkedIn" value={form.candidate.linkedin} onChange={(value) => update('candidate', 'linkedin', value)} placeholder="https://linkedin.com/in/..." />
        </div>
        <TextInput label="作品集/个人网站" value={form.candidate.portfolio_url} onChange={(value) => update('candidate', 'portfolio_url', value)} placeholder="https://..." />
        <TextArea label="一句话定位" value={form.candidate.summary} onChange={(value) => update('candidate', 'summary', value)} rows={3} placeholder="如：自动化专业本科，熟悉 C、单片机、PLC 和基础控制系统开发。" />
      </div>

      <div className="card">
        <div className="section-header">
          <div className="section-title">
            <FileText className="section-icon" />
            <div>
              <h3>简历素材</h3>
            </div>
          </div>
        </div>
        <TextArea label="技能关键词" value={form.candidate.skills} onChange={(value) => update('candidate', 'skills', value)} rows={3} placeholder="一行或逗号分隔：C语言、STM32、PLC、TIA Portal、PID" />
        <TextArea label="教育背景" value={form.candidate.education} onChange={(value) => update('candidate', 'education', value)} placeholder="湖南工程学院 自动化 本科 2023-09 至 2027-06&#10;相关课程：C语言、单片机、PLC、自动控制原理" />
        <TextArea label="项目经历" value={form.candidate.projects} onChange={(value) => update('candidate', 'projects', value)} rows={6} placeholder="每行一个项目：项目名称：技术栈；你做了什么；结果是什么" />
        <TextArea label="工作/实习经历" value={form.candidate.experience} onChange={(value) => update('candidate', 'experience', value)} placeholder="每行一段经历，没有可留空" />
      </div>

      <div className="card">
        <div className="section-header">
          <div className="section-title">
            <Search className="section-icon" />
            <div>
              <h3>求职目标</h3>
            </div>
          </div>
        </div>
        <div className="form-grid-2">
          <TextInput label="目标岗位" value={form.target.roles} onChange={(value) => update('target', 'roles', value)} placeholder="嵌入式软件工程师, 自动化工程师, PLC工程师" />
          <TextInput label="城市" value={form.target.cities} onChange={(value) => update('target', 'cities', value)} placeholder="全国, 长沙, 深圳" />
          <TextInput label="岗位级别" value={form.target.levels} onChange={(value) => update('target', 'levels', value)} placeholder="实习, 校招/应届, 初级, 中级" />
          <TextInput label="企业类型" value={form.target.enterprise_types} onChange={(value) => update('target', 'enterprise_types', value)} placeholder="国企央企, 民营名企, 外企, 不限" />
        </div>
        <TextArea label="搜索关键词" value={form.target.positive_keywords} onChange={(value) => update('target', 'positive_keywords', value)} rows={3} placeholder="嵌入式、STM32、PLC、自动化、工控、电气工程师" />
        <TextArea label="排除关键词" value={form.target.negative_keywords} onChange={(value) => update('target', 'negative_keywords', value)} rows={3} placeholder="销售、客服、培训、保险、中介" />
        <TextArea label="重点公司" value={form.target.companies} onChange={(value) => update('target', 'companies', value)} rows={4} placeholder="一行或逗号分隔：汇川技术、西门子、大疆、国家电网" />
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={save} disabled={isSaving}>
            <Save style={{ width: '16px', height: '16px', marginRight: '8px' }} />
            {isSaving ? '生成中...' : '生成初始化文件'}
          </button>
          {savedFiles.length > 0 && (
            <div style={{ color: '#16a34a', fontSize: '13px' }}>
              已生成：{savedFiles.join('、')}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
