import { useEffect, useState, useRef } from 'react'
import { CheckCircle, FileText, MagnifyingGlass, User, FloppyDisk, Plus, X, CaretDown, CaretUp } from '@phosphor-icons/react'
import { onboardingAPI } from '../api'
import { showToast } from '../utils/toast'
import { PageTransition, LiquidSectionHeader, LiquidCard, MagneticButton } from '../components/LiquidMotion'
import '../styles/liquid-motion.css'

const emptyEducation = () => ({ school: '', degree: '', major: '', start_date: '', end_date: '', gpa: '', description: '' })
const emptyExperience = () => ({ company: '', position: '', start_date: '', end_date: '', description: '', role: '' })
const emptyProject = () => ({ name: '', role: '', start_date: '', end_date: '', description: '', tech_stack: '' })

const emptyForm = {
  candidate: {
    full_name: '',
    gender: '',
    age: '',
    email: '',
    phone: '',
    github: '',
    wechat: '',
    portfolio_url: '',
    summary: '',
    skills: '',
    education: [emptyEducation()],
    experience: [],
    projects: []
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
      <input className="form-input liquid-input" type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </div>
  )
}

function TextArea({ label, value, onChange, placeholder, rows = 4 }) {
  return (
    <div className="form-item">
      <label>{label}</label>
      <textarea className="form-input liquid-input" rows={rows} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </div>
  )
}

function FormInput({ label, value, onChange, placeholder }) {
  return (
    <div className="form-item">
      <label>{label}</label>
      <input className="form-input liquid-input" type="text" value={value || ''} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </div>
  )
}

const YEAR_MIN = 2000
const YEAR_MAX = 2050
const MONTHS = ['01','02','03','04','05','06','07','08','09','10','11','12']
const YEAR_OPTIONS = Array.from({ length: YEAR_MAX - YEAR_MIN + 1 }, (_, i) => YEAR_MIN + i)

function parseDateVal(v) {
  if (!v || typeof v !== 'string') return { year: '', month: '' }
  const m = v.match(/^(\d{4})-(\d{2})$/)
  return m ? { year: m[1], month: m[2] } : { year: '', month: '' }
}

function MonthSelect({ value, onChange }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="date-select date-select-month">
      <option value="">月</option>
      {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
    </select>
  )
}

function YearSelect({ value, onChange, onToggleFold }) {
  return (
    <div className="date-year-wrap" onClick={onToggleFold}>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="date-select date-select-year" onClick={(e) => e.stopPropagation()}>
        <option value="">年</option>
        {YEAR_OPTIONS.map(y => <option key={y} value={String(y)}>{y}</option>)}
      </select>
    </div>
  )
}

function DateField({ value, onChange }) {
  const { year, month } = parseDateVal(value)
  const [folded, setFolded] = useState(false)

  const updateYear = (y) => {
    onChange((month && y) ? `${y}-${month}` : '')
  }
  const updateMonth = (m) => {
    onChange((year && m) ? `${year}-${m}` : '')
  }

  return (
    <div className={`date-field ${folded ? 'folded' : ''}`}>
      <YearSelect value={year} onChange={updateYear} onToggleFold={() => setFolded(f => !f)} />
      {!folded && <MonthSelect value={month} onChange={updateMonth} />}
    </div>
  )
}

function DateRangePicker({ startValue, endValue, onStartChange, onEndChange }) {
  const isPresent = endValue === 'present'
  return (
    <div className="date-range-picker">
      <DateField value={startValue} onChange={onStartChange} />
      <span className="date-arrow">→</span>
      {isPresent
        ? <span className="date-present">至今</span>
        : <DateField value={endValue} onChange={onEndChange} />
      }
      <button
        type="button"
        className={`date-toggle-present ${isPresent ? 'active' : ''}`}
        onClick={() => onEndChange(isPresent ? '' : 'present')}
        title={isPresent ? '取消至今' : '设为至今'}
      >
        至今
      </button>
    </div>
  )
}

function EducationItem({ item, index, onChange, onDelete, showDelete }) {
  return (
    <div className="timeline-item">
      <div className="timeline-header">
        <div className="timeline-dates">
          <DateRangePicker
            startValue={item.start_date}
            endValue={item.end_date}
            onStartChange={(v) => onChange(index, 'start_date', v)}
            onEndChange={(v) => onChange(index, 'end_date', v)}
          />
        </div>
        {showDelete && (
          <button className="btn-delete" onClick={() => onDelete(index)}>
            <X size={16} />
          </button>
        )}
      </div>
      <div className="form-grid-2">
        <FormInput label="学校名称" value={item.school} onChange={(v) => onChange(index, 'school', v)} placeholder="如：XX大学" />
        <FormInput label="学历" value={item.degree} onChange={(v) => onChange(index, 'degree', v)} placeholder="如：本科、硕士、博士" />
        <FormInput label="专业" value={item.major} onChange={(v) => onChange(index, 'major', v)} placeholder="如：自动化" />
        <FormInput label="GPA/成绩" value={item.gpa} onChange={(v) => onChange(index, 'gpa', v)} placeholder="如：3.8/4.0" />
      </div>
      <TextArea label="主修课程/获奖情况" value={item.description} onChange={(v) => onChange(index, 'description', v)} rows={2} placeholder="请输入主修课程或获奖情况" />
    </div>
  )
}

function ExperienceItem({ item, index, onChange, onDelete }) {
  return (
    <div className="timeline-item">
      <div className="timeline-header">
        <div className="timeline-dates">
          <DateRangePicker
            startValue={item.start_date}
            endValue={item.end_date}
            onStartChange={(v) => onChange(index, 'start_date', v)}
            onEndChange={(v) => onChange(index, 'end_date', v)}
          />
        </div>
        <button className="btn-delete" onClick={() => onDelete(index)}>
          <X size={16} />
        </button>
      </div>
      <div className="form-grid-2">
        <FormInput label="公司名称" value={item.company} onChange={(v) => onChange(index, 'company', v)} placeholder="请输入公司名称" />
        <FormInput label="职位" value={item.position} onChange={(v) => onChange(index, 'position', v)} placeholder="请输入职位名称" />
      </div>
      <TextArea label="工作描述" value={item.description} onChange={(v) => onChange(index, 'description', v)} rows={4} placeholder="请描述主要工作职责、业绩成果、技术栈等" />
      <FormInput label="项目分工" value={item.role} onChange={(v) => onChange(index, 'role', v)} placeholder="如：技术负责人、核心开发、独立完成" />
    </div>
  )
}

function ProjectItem({ item, index, onChange, onDelete }) {
  return (
    <div className="timeline-item">
      <div className="timeline-header">
        <div className="timeline-dates">
          <DateRangePicker
            startValue={item.start_date}
            endValue={item.end_date}
            onStartChange={(v) => onChange(index, 'start_date', v)}
            onEndChange={(v) => onChange(index, 'end_date', v)}
          />
        </div>
        <button className="btn-delete" onClick={() => onDelete(index)}>
          <X size={16} />
        </button>
      </div>
      <div className="form-grid-2">
        <FormInput label="项目名称" value={item.name} onChange={(v) => onChange(index, 'name', v)} placeholder="请输入项目名称" />
        <FormInput label="项目角色" value={item.role} onChange={(v) => onChange(index, 'role', v)} placeholder="如：核心开发、负责人" />
      </div>
      <TextArea label="项目描述" value={item.description} onChange={(v) => onChange(index, 'description', v)} rows={3} placeholder="请描述项目背景、目标、你做了什么、结果如何" />
      <FormInput label="技术栈" value={item.tech_stack} onChange={(v) => onChange(index, 'tech_stack', v)} placeholder="如：C语言、STM32、FreeRTOS、Modbus" />
    </div>
  )
}

function StatusItem({ label, active }) {
  return (
    <span className={`liquid-tag ${active ? '' : 'liquid-status'}`} style={active ? {} : { color: 'var(--text-muted)', background: 'var(--bg-secondary)' }}>
      {active && <CheckCircle weight="fill" size={12} style={{ marginRight: '4px' }} />}
      {label}
    </span>
  )
}

export default function Onboarding({ onToast }) {
  const [form, setForm] = useState(emptyForm)
  const [status, setStatus] = useState(null)
  const [savingSection, setSavingSection] = useState('')
  const [savedFiles, setSavedFiles] = useState([])
  const [collapsed, setCollapsed] = useState({ basic: true, education: true, projects: true, experience: true, skills: true, target: true })
  const formRef = useRef(form)
  formRef.current = form

  useEffect(() => {
    fetchStatus()
    loadCachedForm()
  }, [])

  const loadCachedForm = async () => {
    try {
      const cached = await onboardingAPI.loadData()
      if (cached) {
        setForm(prev => ({
          candidate: { ...prev.candidate, ...(cached.candidate || {}) },
          target: { ...prev.target, ...(cached.target || {}) }
        }))
      }
    } catch (error) {
      console.warn('加载缓存表单失败:', error.message)
    }
  }

  const fetchStatus = async () => {
    try {
      const res = await onboardingAPI.status()
      setStatus(res.data)
    } catch (error) {
      showToast(onToast, `加载初始化状态失败：${error.message}`, 'error')
    }
  }

  const saveSection = async (sectionName) => {
    setSavingSection(sectionName)
    try {
      const res = await onboardingAPI.save(formRef.current)
      setSavedFiles(res.data.written || [])
      showToast(onToast, `${sectionName}已保存`, 'success')
      fetchStatus()
    } catch (error) {
      showToast(onToast, `保存失败：${error.message}`, 'error')
    } finally {
      setSavingSection('')
    }
  }

  const update = (section, field, value) => {
    setForm(prev => ({
      ...prev,
      [section]: { ...prev[section], [field]: value }
    }))
  }

  const updateArrayItem = (field, index, key, value) => {
    setForm(prev => ({
      ...prev,
      candidate: {
        ...prev.candidate,
        [field]: prev.candidate[field].map((item, i) =>
          i === index ? { ...item, [key]: value } : item
        )
      }
    }))
  }

  const addItem = (field, factory) => {
    setForm(prev => ({
      ...prev,
      candidate: { ...prev.candidate, [field]: [...prev.candidate[field], factory()] }
    }))
  }

  const removeItem = (field, index) => {
    setForm(prev => ({
      ...prev,
      candidate: {
        ...prev.candidate,
        [field]: prev.candidate[field].filter((_, i) => i !== index)
      }
    }))
  }

  const toggleCollapse = (key) => {
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const SaveButton = ({ section, label }) => (
    <MagneticButton
      variant="primary"
      className="btn-sm"
      onClick={() => saveSection(section)}
    >
      <FloppyDisk size={14} style={{ marginRight: '4px' }} />
      {savingSection === section ? '保存中...' : label}
    </MagneticButton>
  )

  return (
    <PageTransition>
      <LiquidSectionHeader
        title="首次使用向导"
        subtitle="填写一次，系统自动生成简历事实库和岗位扫描配置"
        icon={User}
      />

      <LiquidCard delay={0}>
        <div className="card-header">
          <div className="card-title">初始化状态</div>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <StatusItem label="cv.md" active={status?.cv} />
          <StatusItem label="profile.yml" active={status?.profile} />
          <StatusItem label="portals.yml" active={status?.portals} />
          <StatusItem label="resume-profile.json" active={status?.resume_profile} />
        </div>
      </LiquidCard>

      <LiquidCard delay={0.08}>
        <div className="section-header clickable" onClick={() => toggleCollapse('basic')}>
          <div className="section-title">
            <User className="section-icon" weight="duotone" />
            <div><h3>基本信息</h3></div>
          </div>
          {collapsed.basic ? <CaretDown size={18} /> : <CaretUp size={18} />}
        </div>
        {!collapsed.basic && (
          <>
        <div className="form-grid-2">
          <TextInput label="姓名" value={form.candidate.full_name} onChange={(value) => update('candidate', 'full_name', value)} placeholder="如：张三" />
          <TextInput label="性别" value={form.candidate.gender} onChange={(value) => update('candidate', 'gender', value)} placeholder="如：男 / 女" />
          <TextInput label="年龄" value={form.candidate.age} onChange={(value) => update('candidate', 'age', value)} placeholder="如：23" />
          <TextInput label="邮箱" value={form.candidate.email} onChange={(value) => update('candidate', 'email', value)} placeholder="name@example.com" />
          <TextInput label="电话" value={form.candidate.phone} onChange={(value) => update('candidate', 'phone', value)} placeholder="手机号" />
          <TextInput label="微信" value={form.candidate.wechat} onChange={(value) => update('candidate', 'wechat', value)} placeholder="微信号" />
          <TextInput label="GitHub" value={form.candidate.github} onChange={(value) => update('candidate', 'github', value)} placeholder="https://github.com/..." />
        </div>
        <TextInput label="作品集/个人网站" value={form.candidate.portfolio_url} onChange={(value) => update('candidate', 'portfolio_url', value)} placeholder="https://..." />
        <TextArea label="一句话定位" value={form.candidate.summary} onChange={(value) => update('candidate', 'summary', value)} rows={3} placeholder="如：自动化专业本科，熟悉 C、单片机、PLC 和基础控制系统开发。" />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
          <SaveButton section="basic" label="保存基本信息" />
        </div>
          </>
        )}
      </LiquidCard>

      <LiquidCard delay={0.08}>
        <div className="section-header clickable" onClick={() => toggleCollapse('education')}>
          <div className="section-title">
            <FileText className="section-icon" weight="duotone" />
            <div><h3>教育背景</h3></div>
          </div>
          {collapsed.education ? <CaretDown size={18} /> : <CaretUp size={18} />}
        </div>
        {!collapsed.education && (
          <>
        {form.candidate.education.map((edu, idx) => (
          <EducationItem
            key={`edu-${idx}`}
            item={edu}
            index={idx}
            onChange={updateArrayItem.bind(null, 'education')}
            onDelete={removeItem.bind(null, 'education')}
            showDelete={form.candidate.education.length > 1}
          />
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
          <MagneticButton variant="secondary" className="btn-sm" onClick={() => addItem('education', emptyEducation)}>
            <Plus size={16} /> 添加教育经历
          </MagneticButton>
          <SaveButton section="education" label="保存教育背景" />
        </div>
          </>
        )}
      </LiquidCard>

      <LiquidCard delay={0.24}>
        <div className="section-header clickable" onClick={() => toggleCollapse('projects')}>
          <div className="section-title">
            <FileText className="section-icon" weight="duotone" />
            <div><h3>项目经历</h3></div>
          </div>
          {collapsed.projects ? <CaretDown size={18} /> : <CaretUp size={18} />}
        </div>
        {!collapsed.projects && (
          <>
        {form.candidate.projects.length === 0 && (
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '12px' }}>暂无项目经历，点击下方按钮添加</p>
        )}
        {form.candidate.projects.map((proj, idx) => (
          <ProjectItem
            key={`proj-${idx}`}
            item={proj}
            index={idx}
            onChange={updateArrayItem.bind(null, 'projects')}
            onDelete={removeItem.bind(null, 'projects')}
          />
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
          <MagneticButton variant="secondary" className="btn-sm" onClick={() => addItem('projects', emptyProject)}>
            <Plus size={16} /> 添加项目经历
          </MagneticButton>
          <SaveButton section="projects" label="保存项目经历" />
        </div>
          </>
        )}
      </LiquidCard>

      <LiquidCard delay={0.32}>
        <div className="section-header clickable" onClick={() => toggleCollapse('experience')}>
          <div className="section-title">
            <FileText className="section-icon" weight="duotone" />
            <div><h3>工作/实习经历</h3></div>
          </div>
          {collapsed.experience ? <CaretDown size={18} /> : <CaretUp size={18} />}
        </div>
        {!collapsed.experience && (
          <>
        {form.candidate.experience.length === 0 && (
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '12px' }}>暂无工作/实习经历，点击下方按钮添加</p>
        )}
        {form.candidate.experience.map((exp, idx) => (
          <ExperienceItem
            key={`exp-${idx}`}
            item={exp}
            index={idx}
            onChange={updateArrayItem.bind(null, 'experience')}
            onDelete={removeItem.bind(null, 'experience')}
          />
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
          <MagneticButton variant="secondary" className="btn-sm" onClick={() => addItem('experience', emptyExperience)}>
            <Plus size={16} /> 添加工作/实习经历
          </MagneticButton>
          <SaveButton section="experience" label="保存工作经历" />
        </div>
          </>
        )}
      </LiquidCard>

      <LiquidCard delay={0.4}>
        <div className="section-header clickable" onClick={() => toggleCollapse('skills')}>
          <div className="section-title">
            <FileText className="section-icon" weight="duotone" />
            <div><h3>技能关键词</h3></div>
          </div>
          {collapsed.skills ? <CaretDown size={18} /> : <CaretUp size={18} />}
        </div>
        {!collapsed.skills && (
          <>
        <TextArea label="" value={form.candidate.skills} onChange={(value) => update('candidate', 'skills', value)} rows={3} placeholder="逗号分隔：C语言、STM32、PLC、TIA Portal、PID、Modbus" />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
          <SaveButton section="skills" label="保存技能关键词" />
        </div>
          </>
        )}
      </LiquidCard>

      <LiquidCard delay={0.48}>
        <div className="section-header clickable" onClick={() => toggleCollapse('target')}>
          <div className="section-title">
            <MagnifyingGlass className="section-icon" weight="duotone" />
            <div><h3>求职目标</h3></div>
          </div>
          {collapsed.target ? <CaretDown size={18} /> : <CaretUp size={18} />}
        </div>
        {!collapsed.target && (
          <>
        <div className="form-grid-2">
          <TextInput label="目标岗位" value={form.target.roles} onChange={(value) => update('target', 'roles', value)} placeholder="嵌入式软件工程师, 自动化工程师, PLC工程师" />
          <TextInput label="城市" value={form.target.cities} onChange={(value) => update('target', 'cities', value)} placeholder="全国, 长沙, 深圳" />
          <TextInput label="岗位级别" value={form.target.levels} onChange={(value) => update('target', 'levels', value)} placeholder="实习, 校招/应届, 初级, 中级" />
          <TextInput label="企业类型" value={form.target.enterprise_types} onChange={(value) => update('target', 'enterprise_types', value)} placeholder="国企央企, 民营名企, 外企, 不限" />
        </div>
        <TextArea label="搜索关键词" value={form.target.positive_keywords} onChange={(value) => update('target', 'positive_keywords', value)} rows={3} placeholder="嵌入式、STM32、PLC、自动化、工控、电气工程师" />
        <TextArea label="排除关键词" value={form.target.negative_keywords} onChange={(value) => update('target', 'negative_keywords', value)} rows={3} placeholder="销售、客服、培训、保险、中介" />
        <TextArea label="重点公司" value={form.target.companies} onChange={(value) => update('target', 'companies', value)} rows={4} placeholder="一行或逗号分隔：汇川技术、西门子、大疆、国家电网" />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
          <SaveButton section="target" label="保存求职目标" />
        </div>
          </>
        )}
      </LiquidCard>

      <LiquidCard delay={0.56}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <SaveButton section="all" label="全部保存" />
          {savedFiles.length > 0 && (
            <div style={{ fontSize: '13px', color: 'var(--success-color)' }}>
              已生成：{savedFiles.join('、')}
            </div>
          )}
        </div>
      </LiquidCard>
    </PageTransition>
  )
}
