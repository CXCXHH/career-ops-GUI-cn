import { useState, useEffect, useRef, useCallback } from 'react'
import { FileText, FileImage, CheckCircle, FloppyDisk, Upload, DotsSixVertical, Plus, PencilSimple, PencilSimpleLine, Eye, EyeSlash, X, CaretDown, CaretUp, User, Briefcase, GraduationCap, FolderOpen, ArrowClockwise, Warning, FileArrowUp, Trash, Sparkle } from '@phosphor-icons/react'
import { aiAPI, jobsAPI, resumeAPI } from '../api'
import { showToast } from '../utils/toast'
import { PageTransition, LiquidSectionHeader, LiquidCard, MagneticButton, ScrollReveal } from '../components/LiquidMotion'
import '../styles/liquid-motion.css'

/* ── 子组件 ── */

function SectionHeader({ icon: Icon, title, description, actions, onToggle, isExpanded }) {
  return (
    <div className={`section-header${onToggle ? ' clickable' : ''}`} onClick={onToggle}>
      <div className="section-title">
        <Icon className="section-icon" weight="duotone" />
        <div>
          <h3>{title}</h3>
          {description && <p>{description}</p>}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {actions}
        {onToggle && (isExpanded ? <CaretUp size={18} /> : <CaretDown size={18} />)}
      </div>
    </div>
  )
}

function FormInput({ label, name, value, onChange, type = 'text', placeholder, required = false, error, disabled = false }) {
  return (
    <div className="form-item">
      <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>
        {label}
        {required && <span style={{ color: 'var(--danger-color)', marginLeft: '2px' }}>*</span>}
      </label>
      <input
        type={type}
        name={name}
        value={value || ''}
        onChange={(e) => onChange(name, e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={`form-control ${error ? 'error' : ''}`}
      />
      {error && <span style={{ fontSize: '12px', color: 'var(--danger-color)', marginTop: '4px', display: 'block' }}>{error}</span>}
    </div>
  )
}

function FormTextarea({ label, name, value, onChange, rows = 3, placeholder, required = false, error }) {
  return (
    <div className="form-item">
      <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>
        {label}
        {required && <span style={{ color: 'var(--danger-color)', marginLeft: '2px' }}>*</span>}
      </label>
      <textarea
        name={name}
        value={value || ''}
        onChange={(e) => onChange(name, e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className={`form-control ${error ? 'error' : ''}`}
      />
      {error && <span style={{ fontSize: '12px', color: 'var(--danger-color)', marginTop: '4px', display: 'block' }}>{error}</span>}
    </div>
  )
}

const YEAR_MIN = 2000
const YEAR_MAX = 2050
const MONTHS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12']
const YEAR_OPTIONS = Array.from({ length: YEAR_MAX - YEAR_MIN + 1 }, (_, i) => YEAR_MIN + i)

function parseDateVal(v) {
  if (!v || typeof v !== 'string') return { year: '', month: '' }
  const m = v.match(/^(\d{4})-(\d{2})$/)
  return m ? { year: m[1], month: m[2] } : { year: '', month: '' }
}

function MonthSelect({ value, onChange }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="form-control" style={{ width: '70px' }}>
      <option value="">月</option>
      {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
    </select>
  )
}

function YearSelect({ value, onChange }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="form-control" style={{ width: '90px' }}>
      <option value="">年</option>
      {YEAR_OPTIONS.map(y => <option key={y} value={String(y)}>{y}</option>)}
    </select>
  )
}

function DateField({ value, onChange }) {
  const parsed = parseDateVal(value)
  const [year, setYear] = useState(parsed.year)
  const [month, setMonth] = useState(parsed.month)

  useEffect(() => {
    const next = parseDateVal(value)
    setYear(next.year)
    setMonth(next.month)
  }, [value])

  const updateYear = (y) => {
    setYear(y)
    onChange((y && month) ? `${y}-${month}` : '')
  }
  const updateMonth = (m) => {
    setMonth(m)
    onChange((year && m) ? `${year}-${m}` : '')
  }

  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      <YearSelect value={year} onChange={updateYear} />
      <MonthSelect value={month} onChange={updateMonth} />
    </div>
  )
}

function DateRangePicker({ startName, endName, startValue, endValue, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
      <div className="form-item" style={{ marginBottom: 0 }}>
        <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>开始时间</label>
        <input
          type="month"
          value={startValue || ''}
          onChange={(e) => onChange(startName, e.target.value)}
          className="form-control"
        />
      </div>
      <span style={{ color: 'var(--text-muted)', paddingTop: '20px' }}>~</span>
      <div className="form-item" style={{ marginBottom: 0 }}>
        <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>结束时间</label>
        <input
          type="month"
          value={endValue === 'present' ? '' : (endValue || '')}
          onChange={(e) => onChange(endName, e.target.value)}
          className="form-control"
          placeholder={endValue === 'present' ? '至今' : ''}
        />
        {endValue === 'present' && (
          <span style={{ fontSize: '12px', color: 'var(--success-color)', marginTop: '4px', display: 'block' }}>至今</span>
        )}
      </div>
    </div>
  )
}

function StructuredDateRangePicker({ startName, endName, startValue, endValue, onChange }) {
  const isPresent = endValue === 'present'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
      <DateField value={startValue} onChange={(value) => onChange(startName, value)} />
      <span style={{ color: 'var(--text-muted)' }}>→</span>
      {isPresent
        ? <span style={{ fontSize: '14px', color: 'var(--success-color)', fontWeight: 500 }}>至今</span>
        : <DateField value={endValue} onChange={(value) => onChange(endName, value)} />
      }
      <button
        type="button"
        className={`btn btn-sm ${isPresent ? 'btn-success' : 'btn-secondary'}`}
        onClick={() => onChange(endName, isPresent ? '' : 'present')}
        title={isPresent ? '取消至今' : '设为至今'}
        style={{ padding: '4px 12px', fontSize: '12px' }}
      >
        至今
      </button>
    </div>
  )
}

function EducationItem({ item, index, onChange, onDelete }) {
  return (
    <div className="timeline-item" style={{
      background: 'var(--bg-secondary)',
      borderRadius: '16px',
      padding: '20px',
      marginBottom: '16px',
      border: '1px solid var(--border-color)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <StructuredDateRangePicker
          startName={`education[${index}].start_date`}
          endName={`education[${index}].end_date`}
          startValue={item.start_date}
          endValue={item.end_date}
          onChange={onChange}
        />
        <button className="btn btn-danger btn-sm" onClick={() => onDelete(index)} style={{ padding: '6px' }}>
          <X size={16} />
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
        <FormInput
          label="学校名称"
          name={`education[${index}].school`}
          value={item.school}
          onChange={onChange}
          placeholder="请输入学校名称"
          required
        />
        <FormInput
          label="学历"
          name={`education[${index}].degree`}
          value={item.degree}
          onChange={onChange}
          placeholder="如：本科、硕士、博士"
        />
        <FormInput
          label="专业"
          name={`education[${index}].major`}
          value={item.major}
          onChange={onChange}
          placeholder="请输入专业名称"
          required
        />
        <FormInput
          label="GPA/成绩"
          name={`education[${index}].gpa`}
          value={item.gpa}
          onChange={onChange}
          placeholder="如：3.8/4.0"
        />
      </div>
      <FormTextarea
        label="主修课程/获奖情况"
        name={`education[${index}].description`}
        value={item.description}
        onChange={onChange}
        rows={2}
        placeholder="请输入主修课程或获奖情况"
      />
    </div>
  )
}

function ExperienceItem({ item, index, onChange, onDelete }) {
  return (
    <div className="timeline-item" style={{
      background: 'var(--bg-secondary)',
      borderRadius: '16px',
      padding: '20px',
      marginBottom: '16px',
      border: '1px solid var(--border-color)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <DateRangePicker
          startName={`experience[${index}].start_date`}
          endName={`experience[${index}].end_date`}
          startValue={item.start_date}
          endValue={item.end_date}
          onChange={onChange}
        />
        <button className="btn btn-danger btn-sm" onClick={() => onDelete(index)} style={{ padding: '6px' }}>
          <X size={16} />
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
        <FormInput
          label="公司名称"
          name={`experience[${index}].company`}
          value={item.company}
          onChange={onChange}
          placeholder="请输入公司名称"
          required
        />
        <FormInput
          label="职位"
          name={`experience[${index}].position`}
          value={item.position}
          onChange={onChange}
          placeholder="请输入职位名称"
          required
        />
      </div>
      <FormTextarea
        label="工作描述"
        name={`experience[${index}].description`}
        value={item.description}
        onChange={onChange}
        rows={4}
        placeholder="请描述主要工作职责、业绩成果、技术栈等"
        required
      />
      <FormInput
        label="项目分工"
        name={`experience[${index}].role`}
        value={item.role}
        onChange={onChange}
        placeholder="如：技术负责人、核心开发、独立完成"
      />
    </div>
  )
}

function ProjectItem({ item, index, onChange, onDelete }) {
  return (
    <div className="timeline-item" style={{
      background: 'var(--bg-secondary)',
      borderRadius: '16px',
      padding: '20px',
      marginBottom: '16px',
      border: '1px solid var(--border-color)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <StructuredDateRangePicker
          startName={`projects[${index}].start_date`}
          endName={`projects[${index}].end_date`}
          startValue={item.start_date}
          endValue={item.end_date}
          onChange={onChange}
        />
        <button className="btn btn-danger btn-sm" onClick={() => onDelete(index)} style={{ padding: '6px' }}>
          <X size={16} />
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
        <FormInput
          label="项目名称"
          name={`projects[${index}].name`}
          value={item.name}
          onChange={onChange}
          placeholder="请输入项目名称"
        />
        <FormInput
          label="项目角色"
          name={`projects[${index}].role`}
          value={item.role}
          onChange={onChange}
          placeholder="如：项目经理、技术负责人、开发工程师"
        />
      </div>
      <FormTextarea
        label="项目描述"
        name={`projects[${index}].description`}
        value={item.description}
        onChange={onChange}
        rows={3}
        placeholder="请描述项目背景、目标、规模等"
      />
      <FormInput
        label="技术栈"
        name={`projects[${index}].tech_stack`}
        value={item.tech_stack}
        onChange={onChange}
        placeholder="如：Java, Spring Boot, MySQL, Redis"
      />
    </div>
  )
}

function ModuleItem({ module, index, onToggle, onEdit, onDelete, onEditData, onDragStart, onDragOver, onDrop, onDragEnd, dragIndex, dragOverIndex }) {
  const isDragging = dragIndex === index
  const isDragOver = dragOverIndex === index
  const builtinDataModules = ['education', 'experience', 'projects']
  const isDataModule = module.type === 'builtin' && builtinDataModules.includes(module.id)

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDrop={(e) => onDrop(e, index)}
      onDragEnd={onDragEnd}
      className={`module-item ${isDragging ? 'dragging' : ''} ${isDragOver ? 'drag-over' : ''}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '14px 16px',
        background: 'var(--bg-secondary)',
        borderRadius: '12px',
        marginBottom: '8px',
        border: '1px solid var(--border-color)',
        cursor: 'grab',
        opacity: isDragging ? 0.5 : 1,
        transition: 'all 0.2s ease'
      }}
    >
      <DotsSixVertical size={18} style={{ color: 'var(--text-muted)', cursor: 'grab', flexShrink: 0 }} />
      <span style={{
        flex: 1,
        fontSize: '14px',
        fontWeight: 500,
        color: module.enabled ? 'var(--text-primary)' : 'var(--text-muted)'
      }}>
        {module.name}
        {module.type === 'custom' && <span style={{
          marginLeft: '8px',
          fontSize: '11px',
          padding: '2px 8px',
          background: 'var(--haze-blue-100)',
          color: 'var(--haze-blue-700)',
          borderRadius: '12px'
        }}>自定义</span>}
      </span>
      <div style={{ display: 'flex', gap: '4px' }}>
        <button title={module.enabled ? '隐藏此模块' : '显示此模块'} onClick={() => onToggle(index)} className="btn btn-sm btn-secondary" style={{ padding: '6px' }}>
          {module.enabled ? <Eye size={16} /> : <EyeSlash size={16} />}
        </button>
        {isDataModule ? (
          <button title="编辑数据" onClick={() => onEditData(module.id)} className="btn btn-sm btn-secondary" style={{ padding: '6px' }}>
            <PencilSimpleLine size={16} />
          </button>
        ) : (
          <button title="编辑" onClick={() => onEdit(index)} className="btn btn-sm btn-secondary" style={{ padding: '6px' }}>
            <PencilSimple size={16} />
          </button>
        )}
        <button title="删除" onClick={() => onDelete(index)} className="btn btn-sm btn-danger" style={{ padding: '6px' }}>
          <Trash size={16} />
        </button>
      </div>
    </div>
  )
}

function AddModuleForm({ onAdd, onCancel }) {
  const [name, setName] = useState('')
  const [content, setContent] = useState('')
  const [saveStatus, setSaveStatus] = useState('idle')
  const nameRef = useRef(null)

  useEffect(() => {
    nameRef.current?.focus()
  }, [])

  const handleSubmit = async () => {
    if (!name.trim()) return
    setSaveStatus('saving')
    const ok = await onAdd({ name: name.trim(), content: content.trim() })
    if (!ok) {
      setSaveStatus('error')
      setTimeout(() => setSaveStatus('idle'), 2000)
      return
    }
    setSaveStatus('success')
    setTimeout(() => {
      setSaveStatus('idle')
      onCancel()
    }, 800)
  }

  const submitLabel = saveStatus === 'saving'
    ? '添加中...'
    : saveStatus === 'success'
      ? '✓ 已添加'
      : saveStatus === 'error'
        ? '✕ 添加失败'
        : '添加'

  return (
    <div style={{
      background: 'var(--bg-secondary)',
      borderRadius: '16px',
      padding: '20px',
      marginBottom: '16px',
      border: '1px solid var(--border-color)'
    }}>
      <div className="form-item">
        <label style={{ fontSize: '13px', fontWeight: 500 }}>模块名称 <span style={{ color: 'var(--danger-color)' }}>*</span></label>
        <input ref={nameRef} className="form-control" value={name} onChange={(e) => setName(e.target.value)} placeholder="如：实习经历、资格证书" />
      </div>
      <div className="form-item">
        <label style={{ fontSize: '13px', fontWeight: 500 }}>模块内容</label>
        <textarea className="form-control" rows="3" value={content} onChange={(e) => setContent(e.target.value)} placeholder="在此输入该模块要展示的文本内容" />
      </div>
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <button className="btn btn-primary btn-sm" onClick={handleSubmit} disabled={!name.trim() || saveStatus === 'saving'}>{submitLabel}</button>
        <button className="btn btn-secondary btn-sm" onClick={onCancel}>取消</button>
      </div>
    </div>
  )
}

function EditModuleForm({ module, onSave, onCancel }) {
  const [name, setName] = useState(module.name || '')
  const [content, setContent] = useState(module.content || '')
  const [saveStatus, setSaveStatus] = useState('idle')

  const handleSubmit = async () => {
    if (!name.trim()) return
    setSaveStatus('saving')
    const ok = await onSave({ name: name.trim(), content: content.trim() })
    if (!ok) {
      setSaveStatus('error')
      setTimeout(() => setSaveStatus('idle'), 2000)
      return
    }
    setSaveStatus('success')
    setTimeout(() => {
      setSaveStatus('idle')
      onCancel()
    }, 800)
  }

  const submitLabel = saveStatus === 'saving'
    ? '保存中...'
    : saveStatus === 'success'
      ? '✓ 已保存'
      : saveStatus === 'error'
        ? '✕ 保存失败'
        : '保存'

  return (
    <div style={{
      background: 'var(--bg-secondary)',
      borderRadius: '16px',
      padding: '20px',
      marginBottom: '16px',
      border: '1px solid var(--border-color)'
    }}>
      <div className="form-item">
        <label style={{ fontSize: '13px', fontWeight: 500 }}>模块名称 <span style={{ color: 'var(--danger-color)' }}>*</span></label>
        <input className="form-control" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="form-item">
        <label style={{ fontSize: '13px', fontWeight: 500 }}>模块内容</label>
        <textarea className="form-control" rows="3" value={content} onChange={(e) => setContent(e.target.value)} />
      </div>
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <button className="btn btn-primary btn-sm" onClick={handleSubmit} disabled={!name.trim() || saveStatus === 'saving'}>{submitLabel}</button>
        <button className="btn btn-secondary btn-sm" onClick={onCancel}>取消</button>
      </div>
    </div>
  )
}

function resolvePhotoSrc(profile, photoPreview = '') {
  if (photoPreview) return photoPreview
  if (profile?.photoData) return profile.photoData
  if (profile?.photo_path) return `/api/resume/photo?path=${encodeURIComponent(profile.photo_path)}`
  return ''
}

function AiAutoFillModal({ isOpen, onClose, section, onFill, onToast }) {
  const [inputText, setInputText] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [provider, setProvider] = useState('deepseek')

  const handleFill = async () => {
    if (!inputText.trim()) {
      showToast(onToast, '请输入内容', 'error')
      return
    }
    setIsGenerating(true)
    try {
      const res = await resumeAPI.autoFill({ provider, section, userInput: inputText.trim() })
      onFill(res.data.result)
      showToast(onToast, 'AI 补全成功', 'success')
      onClose()
    } catch (error) {
      showToast(onToast, error?.response?.data?.error || error?.message || 'AI 补全失败', 'error')
    } finally {
      setIsGenerating(false)
    }
  }

  if (!isOpen) return null

  const sectionLabels = {
    education: '教育背景',
    experience: '工作经历',
    projects: '项目经验',
    skills: '技能关键词'
  }

  const sectionExamples = {
    education: '例如：20XX年9月到20XX年6月在XX大学读本科，专业是自动化，GPA是X.X，主修自动控制原理、单片机原理、电力电子技术，获得过校级奖学金',
    experience: '例如：20XX年X月到X月在XX科技公司做嵌入式实习生，参与产线数据采集终端开发，负责串口通信、寄存器映射和现场联调，是核心开发',
    projects: '例如：20XX年X月到X月作为项目负责人，基于STM32开发电机控制系统，完成电机调速控制、按键交互、OLED显示和故障保护逻辑，实现稳定闭环控制，使用C语言、STM32、PID、FreeRTOS',
    skills: '例如：熟悉C语言编程，会使用STM32单片机，了解PLC编程和Modbus通信协议，掌握FreeRTOS实时操作系统'
  }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: 'var(--bg-primary)', borderRadius: '20px', padding: '32px',
        maxWidth: '560px', width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkle size={20} style={{ color: 'var(--primary-color)' }} />
            AI 智能补全 - {sectionLabels[section]}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', borderRadius: '8px' }}>
            <X size={20} style={{ color: 'var(--text-muted)' }} />
          </button>
        </div>

        <div style={{
          background: 'var(--haze-blue-50)', borderRadius: '12px', padding: '12px 16px',
          marginBottom: '16px', fontSize: '13px', color: 'var(--haze-blue-800)', display: 'flex', gap: '8px', alignItems: 'flex-start'
        }}>
          <Warning size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
          <div>用自然语言描述你的{sectionLabels[section]}，AI 将自动提取并补全结构化数据</div>
        </div>

        <div className="form-group" style={{ marginBottom: '16px' }}>
          <label>选择 AI 模型</label>
          <select value={provider} onChange={(e) => setProvider(e.target.value)} className="form-control">
            <option value="deepseek">DeepSeek</option>
            <option value="doubao">豆包 / 火山方舟</option>
          </select>
        </div>

        <textarea
          className="form-control"
          rows={8}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={sectionExamples[section]}
          style={{ resize: 'vertical', fontSize: '14px', lineHeight: '1.7' }}
        />

        <div style={{ display: 'flex', gap: '12px', marginTop: '16px', justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onClose} disabled={isGenerating}>取消</button>
          <button className="btn btn-primary" onClick={handleFill} disabled={isGenerating || !inputText.trim()}>
            <Sparkle size={16} style={{ marginRight: '6px' }} />
            {isGenerating ? 'AI 补全中...' : '开始补全'}
          </button>
        </div>
      </div>
    </div>
  )
}

function PreviewModal({ profile, education, experience, projects, modules, photoPreview, onClose }) {
  const asText = (value) => {
    if (Array.isArray(value)) return value.map(item => String(item || '').trim()).filter(Boolean).join('、')
    return String(value || '').trim()
  }

  const hasText = (value) => asText(value).length > 0
  const isFilledEducation = (item) => (
    hasText(item?.school) ||
    hasText(item?.major) ||
    hasText(item?.degree) ||
    hasText(item?.gpa) ||
    hasText(item?.description) ||
    hasText(item?.start_date) ||
    hasText(item?.end_date)
  )
  const isFilledExperience = (item) => (
    hasText(item?.company) ||
    hasText(item?.position) ||
    hasText(item?.role) ||
    hasText(item?.description) ||
    hasText(item?.start_date) ||
    hasText(item?.end_date)
  )
  const isFilledProject = (item) => (
    hasText(item?.name) ||
    hasText(item?.role) ||
    hasText(item?.tech_stack) ||
    hasText(item?.description) ||
    hasText(item?.responsibility) ||
    hasText(item?.start_date) ||
    hasText(item?.end_date)
  )
  const photoSrc = resolvePhotoSrc(profile, photoPreview)
  const previewEducation = (education || []).filter(isFilledEducation)
  const previewExperience = (experience || []).filter(isFilledExperience)
  const previewProjects = (projects || []).filter(isFilledProject)

  const formatDate = (date) => {
    if (!date) return ''
    if (date === 'present') return '至今'
    const [year, month] = date.split('-')
    return `${year}年${parseInt(month)}月`
  }

  const enabledModules = (modules || []).filter(m => m.enabled)
  const hasHeaderContent = Boolean(
    hasText(profile.full_name) ||
    hasText(profile.gender) ||
    hasText(profile.age) ||
    hasText(profile.phone) ||
    hasText(profile.email) ||
    hasText(profile.wechat) ||
    hasText(profile.github)
  )

  const renderBulletLines = (text) => asText(text)
    .split(/[；;\n]/)
    .map(item => item.trim())
    .filter(Boolean)

  const renderSectionTitle = (title) => (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      margin: '20px 0 12px',
      fontSize: '15px',
      fontWeight: 600,
      color: 'var(--text-primary)',
      fontFamily: 'var(--font-serif)'
    }}>
      <span style={{ flex: 1, height: '1px', background: 'var(--border-color)' }} />
      <span>{title}</span>
      <span style={{ flex: 1, height: '1px', background: 'var(--border-color)' }} />
    </div>
  )

  const renderModule = (mod) => {
    if (mod.type === 'custom' && mod.content) {
      const lines = renderBulletLines(mod.content)
      return (
        <section key={mod.id} style={{ marginBottom: '16px' }}>
          {renderSectionTitle(mod.name)}
          {lines.length > 1 ? (
            <ul style={{ margin: '6px 0 0 16px', padding: 0, fontSize: '13px', color: 'var(--text-primary)', lineHeight: '1.7' }}>
              {lines.map((line, idx) => <li key={idx}>{line}</li>)}
            </ul>
          ) : (
            <p style={{ fontSize: '13px', lineHeight: '1.7', color: 'var(--text-primary)' }}>{mod.content}</p>
          )}
        </section>
      )
    }

    switch (mod.id) {
      case 'summary':
        return hasText(profile.summary) ? (
          <section key="summary" style={{ marginBottom: '16px' }}>
            {renderSectionTitle('求职定位')}
            <p style={{ fontSize: '13px', lineHeight: '1.7', color: 'var(--text-primary)' }}>{asText(profile.summary)}</p>
          </section>
        ) : null
      case 'skills': {
        const skillsText = asText(profile.skills)
        if (!skillsText) return null
        const skillItems = skillsText.split(/[、,，|]/).filter(Boolean)
        return (
          <section key="skills" style={{ marginBottom: '16px' }}>
            {renderSectionTitle('核心能力')}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {skillItems.map((s, i) => (
                <span key={i} style={{
                  fontSize: '12px',
                  padding: '4px 12px',
                  background: 'var(--haze-blue-100)',
                  color: 'var(--haze-blue-800)',
                  borderRadius: '12px'
                }}>{s.trim()}</span>
              ))}
            </div>
          </section>
        )
      }
      case 'experience':
        return previewExperience.length > 0 ? (
          <section key="experience" style={{ marginBottom: '16px' }}>
            {renderSectionTitle('工作经历')}
            {previewExperience.map((item, i) => (
              <div key={i} style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 500 }}>
                  <span>{[asText(item.company), asText(item.position)].filter(Boolean).join(' | ')}</span>
                  <span style={{ color: 'var(--text-muted)' }}>{formatDate(item.start_date)} ~ {formatDate(item.end_date)}</span>
                </div>
                {hasText(item.role) && <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>分工：{asText(item.role)}</div>}
                {renderBulletLines(item.description).length > 0 && (
                  <ul style={{ margin: '6px 0 0 16px', padding: 0, fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.7' }}>
                    {renderBulletLines(item.description).map((line, idx) => <li key={idx}>{line}</li>)}
                  </ul>
                )}
              </div>
            ))}
          </section>
        ) : null
      case 'projects':
        return previewProjects.length > 0 ? (
          <section key="projects" style={{ marginBottom: '16px' }}>
            {renderSectionTitle('项目经历')}
            {previewProjects.map((item, i) => (
              <div key={i} style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 500 }}>
                  <span>{asText(item.name)}</span>
                  <span style={{ color: 'var(--text-muted)' }}>{formatDate(item.start_date)} ~ {formatDate(item.end_date)}</span>
                </div>
                {hasText(item.role) && <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>角色：{asText(item.role)}</div>}
                {hasText(item.tech_stack) && <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}><strong>技术栈：</strong>{asText(item.tech_stack)}</div>}
                {renderBulletLines(item.description).length > 0 && (
                  <ul style={{ margin: '6px 0 0 16px', padding: 0, fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.7' }}>
                    {renderBulletLines(item.description).map((line, idx) => <li key={idx}>{line}</li>)}
                  </ul>
                )}
              </div>
            ))}
          </section>
        ) : null
      case 'education':
        return previewEducation.length > 0 ? (
          <section key="education" style={{ marginBottom: '16px' }}>
            {renderSectionTitle('教育背景')}
            {previewEducation.map((item, i) => (
              <div key={i} style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 500 }}>
                  <span>{[asText(item.school), asText(item.major), asText(item.degree)].filter(Boolean).join(' | ')}</span>
                  <span style={{ color: 'var(--text-muted)' }}>{formatDate(item.start_date)} ~ {formatDate(item.end_date)}</span>
                </div>
                {(hasText(item.gpa) || hasText(item.description)) && (
                  <ul style={{ margin: '6px 0 0 16px', padding: 0, fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.7' }}>
                    {hasText(item.gpa) && <li>GPA：{asText(item.gpa)}</li>}
                    {renderBulletLines(item.description).map((line, idx) => <li key={idx}>{line}</li>)}
                  </ul>
                )}
              </div>
            ))}
          </section>
        ) : null
      case 'gaps':
        return null
      default:
        return null
    }
  }

  const renderedSections = enabledModules.map(mod => renderModule(mod)).filter(Boolean)
  const hasPreviewContent = hasHeaderContent || renderedSections.length > 0

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>简历预览</h3>
          <button className="btn btn-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body-scroll">
          {!hasPreviewContent ? (
            <div className="liquid-empty" style={{ minHeight: '320px' }}>
              <FileText size={32} />
              <p>暂无可预览内容</p>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>先填写基本信息、教育背景、项目经历或自定义模块内容，再预览简历。</p>
            </div>
          ) : (
            <div style={{
              background: '#fff',
              borderRadius: '16px',
              padding: '40px',
              boxShadow: '0 4px 24px rgba(0,0,0,0.06)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                <div>
                  <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '12px' }}>
                    {asText(profile.full_name) || '简历预览'}
                  </h1>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                    {(hasText(profile.gender) || hasText(profile.age)) && <span>{asText(profile.gender) || ''}{hasText(profile.age) ? ' · ' + asText(profile.age) + '岁' : ''}</span>}
                    {hasText(profile.phone) && <span>手机：{asText(profile.phone)}</span>}
                    {hasText(profile.email) && <span>邮箱：{asText(profile.email)}</span>}
                    {hasText(profile.wechat) && <span>微信：{asText(profile.wechat)}</span>}
                    {hasText(profile.github) && <span>GitHub：{asText(profile.github)}</span>}
                  </div>
                </div>
                {photoSrc ? <img style={{ width: '100px', height: '130px', objectFit: 'cover', borderRadius: '8px' }} src={photoSrc} alt="个人照片" /> : null}
              </div>
              {renderedSections}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── 主组件 ── */

export default function ResumeBuilder({ onToast }) {
  const [jobs, setJobs] = useState([])
  const [selectedJob, setSelectedJob] = useState('')
  const [providers, setProviders] = useState([])
  const [selectedProvider, setSelectedProvider] = useState('deepseek')
  const [isGenerating, setIsGenerating] = useState(false)
  const [resumeFiles, setResumeFiles] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('resumeFiles') || '[]')
    } catch { return [] }
  })
  const [profile, setProfile] = useState({
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
    photo_path: ''
  })
  const [education, setEducation] = useState([])
  const [experience, setExperience] = useState([])
  const [projects, setProjects] = useState([])
  const [photoPreview, setPhotoPreview] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [basicSaveStatus, setBasicSaveStatus] = useState('idle')
  const [modules, setModules] = useState([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [editIndex, setEditIndex] = useState(null)
  const [editingDataModule, setEditingDataModule] = useState(null)
  const [dragIndex, setDragIndex] = useState(null)
  const [dragOverIndex, setDragOverIndex] = useState(null)
  const [isSavingModules, setIsSavingModules] = useState(false)
  const [dataModuleSaveStatus, setDataModuleSaveStatus] = useState({})
  const [showPreview, setShowPreview] = useState(false)
  const [expandedSections, setExpandedSections] = useState({
    basic: false,
    education: true,
    experience: true,
    projects: true,
    modules: false
  })
  const [validationErrors, setValidationErrors] = useState({})
  const [aiModal, setAiModal] = useState({ open: false, section: '' })
  const basicPhotoSrc = resolvePhotoSrc(profile, photoPreview)

  useEffect(() => {
    fetchJobs()
    fetchProviders()
    fetchProfile()
    fetchModules()
    fetchResumeFiles()
  }, [])

  const fetchJobs = async () => {
    try {
      const res = await jobsAPI.getAll()
      const usableJobs = res.data?.filter(j => j.liveness_status !== 'closed') || []
      setJobs(usableJobs)
    } catch (error) {
      showToast(onToast, '加载岗位数据失败', 'error')
    }
  }

  const fetchProviders = async () => {
    try {
      const res = await aiAPI.getProviders()
      const list = res.data || []
      setProviders(list)
      const deepseek = list.find(provider => provider.id === 'deepseek' && provider.configured)
      const firstConfigured = list.find(provider => provider.configured)
      if (deepseek || firstConfigured) setSelectedProvider((deepseek || firstConfigured).id)
    } catch (error) {
      console.error('Providers fetch error:', error)
    }
  }

  const fetchProfile = async () => {
    try {
      const res = await resumeAPI.getProfile()
      const data = res.data || {}
      setProfile(data)
      if (data.education && Array.isArray(data.education)) setEducation(data.education)
      if (data.experience && Array.isArray(data.experience)) setExperience(data.experience)
      if (data.projects && Array.isArray(data.projects)) setProjects(data.projects)
    } catch (error) {
      showToast(onToast, '加载个人信息失败', 'error')
    }
  }

  const fetchResumeFiles = async () => {
    try {
      const res = await resumeAPI.getFiles()
      setResumeFiles(res.data || [])
    } catch (error) {
      console.error('Resume files fetch error:', error)
    }
  }

  const fetchModules = async () => {
    try {
      const res = await resumeAPI.getModules()
      setModules(res.data)
    } catch (error) {
      showToast(onToast, '加载模块配置失败', 'error')
    }
  }

  const updateProfile = (field, value) => {
    setProfile(prev => ({ ...prev, [field]: value }))
    clearValidationError(field)
  }

  const updateArrayField = (fieldName, index, key, value) => {
    const array = fieldName === 'education' ? education : fieldName === 'experience' ? experience : projects
    const setter = fieldName === 'education' ? setEducation : fieldName === 'experience' ? setExperience : setProjects
    const newArray = [...array]
    if (!newArray[index]) newArray[index] = {}
    newArray[index][key] = value
    setter(newArray)
    clearValidationError(`${fieldName}[${index}].${key}`)
    setTimeout(() => autoSaveData(), 100)
  }

  const handleArrayChange = (fieldPath, value) => {
    const [fieldName, indexStr, key] = fieldPath.match(/^(\w+)\[(\d+)\]\.(\w+)$/).slice(1)
    const index = parseInt(indexStr)
    updateArrayField(fieldName, index, key, value)
  }

  const addEducation = () => {
    setEducation(prev => [...prev, { school: '', degree: '', major: '', start_date: '', end_date: '', gpa: '', description: '' }])
    autoSaveData()
  }
  const deleteEducation = (index) => {
    setEducation(prev => prev.filter((_, i) => i !== index))
    autoSaveData()
  }
  const addExperience = () => {
    setExperience(prev => [...prev, { company: '', position: '', start_date: '', end_date: '', description: '', role: '' }])
    autoSaveData()
  }
  const deleteExperience = (index) => {
    setExperience(prev => prev.filter((_, i) => i !== index))
    autoSaveData()
  }
  const addProject = () => {
    setProjects(prev => [...prev, { name: '', role: '', start_date: '', end_date: '', description: '', responsibility: '', tech_stack: '' }])
    autoSaveData()
  }
  const deleteProject = (index) => {
    setProjects(prev => prev.filter((_, i) => i !== index))
    autoSaveData()
  }

  const clearValidationError = (field) => {
    setValidationErrors(prev => {
      const newErrors = { ...prev }
      delete newErrors[field]
      return newErrors
    })
  }

  const openAiModal = (section) => {
    setAiModal({ open: true, section })
  }

  const closeAiModal = () => {
    setAiModal({ open: false, section: '' })
  }

  const handleAiFillEducation = (items) => {
    const newItems = items.map(item => ({
      school: item.school || '',
      major: item.major || '',
      degree: item.degree || '',
      gpa: item.gpa || '',
      description: item.description || '',
      start_date: item.start_date || '',
      end_date: item.end_date || ''
    }))
    setEducation(prev => [...prev, ...newItems])
    autoSaveData()
  }

  const handleAiFillExperience = (items) => {
    const newItems = items.map(item => ({
      company: item.company || '',
      position: item.position || '',
      start_date: item.start_date || '',
      end_date: item.end_date || '',
      description: item.description || '',
      responsibility: item.responsibility || '',
      role: item.role || ''
    }))
    setExperience(prev => [...prev, ...newItems])
    autoSaveData()
  }

  const handleAiFillProjects = (items) => {
    const newItems = items.map(item => ({
      name: item.name || '',
      role: item.role || '',
      start_date: item.start_date || '',
      end_date: item.end_date || '',
      description: item.description || '',
      tech_stack: item.tech_stack || '',
      responsibility: item.responsibility || ''
    }))
    setProjects(prev => [...prev, ...newItems])
    autoSaveData()
  }

  const handleAiFill = (section) => {
    switch (section) {
      case 'education': return handleAiFillEducation
      case 'experience': return handleAiFillExperience
      case 'projects': return handleAiFillProjects
      default: return () => {}
    }
  }

  const validateBasicInfo = () => {
    const errors = {}
    if (profile.phone.trim() && !/^1[3-9]\d{9}$/.test(profile.phone.replace(/\s/g, ''))) {
      errors['phone'] = '请输入有效的手机号码'
    }
    if (profile.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) {
      errors['email'] = '请输入有效的邮箱地址'
    }
    if (Object.keys(errors).length > 0) setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handlePhotoChange = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      showToast(onToast, '照片只支持 PNG/JPG', 'error')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result
      setPhotoPreview(dataUrl)
      setProfile(prev => ({ ...prev, photoData: dataUrl, photoName: file.name }))
    }
    reader.readAsDataURL(file)
  }

  const handleDeletePhoto = async () => {
    setIsSaving(true)
    try {
      const res = await resumeAPI.deletePhoto()
      setProfile(prev => ({
        ...prev,
        ...res.data,
        photoData: '',
        photoName: ''
      }))
      setPhotoPreview('')
      showToast(onToast, '个人照片已删除', 'success')
    } catch (error) {
      showToast(onToast, `删除照片失败：${error.message}`, 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveProfile = async () => {
    if (!validateBasicInfo()) {
      setBasicSaveStatus('error')
      setTimeout(() => setBasicSaveStatus('idle'), 2000)
      return
    }
    setIsSaving(true)
    setBasicSaveStatus('saving')
    try {
      const data = { ...profile, education, experience, projects }
      const res = await resumeAPI.saveProfile(data)
      setProfile(res.data)
      setPhotoPreview('')
      setBasicSaveStatus('success')
      setTimeout(() => setBasicSaveStatus('idle'), 2000)
      showToast(onToast, '个人信息已保存', 'success')
    } catch (error) {
      setBasicSaveStatus('error')
      setTimeout(() => setBasicSaveStatus('idle'), 2000)
      showToast(onToast, `保存失败：${error.message}`, 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const saveModulesToServer = useCallback(async (newModules) => {
    setIsSavingModules(true)
    try {
      await resumeAPI.updateModules(newModules)
      setModules(newModules)
    } catch (error) {
      showToast(onToast, `模块保存失败：${error.message}`, 'error')
    } finally {
      setIsSavingModules(false)
    }
  }, [onToast])

  const handleToggleModule = (index) => {
    const updated = modules.map((m, i) => i === index ? { ...m, enabled: !m.enabled } : m)
    saveModulesToServer(updated)
  }

  const handleAddModule = async (data) => {
    try {
      const res = await resumeAPI.addModule({ ...data, type: 'custom' })
      setModules(prev => [...prev, res.data])
      showToast(onToast, `模块「${data.name}」已添加`, 'success')
      return true
    } catch (error) {
      showToast(onToast, `添加失败：${error.message}`, 'error')
      return false
    }
  }

  const handleEditModule = (index) => {
    const mod = modules[index]
    if (mod.type === 'builtin') {
      showToast(onToast, `「${mod.name}」的内容请在上方表单区域编辑`, 'info')
    }
    setEditIndex(index)
  }

  const handleSaveEditModule = async (data) => {
    const mod = modules[editIndex]
    try {
      await resumeAPI.updateModule(mod.id, data)
      const updated = modules.map((m, i) => i === editIndex ? { ...m, ...data } : m)
      setModules(updated)
      showToast(onToast, `模块「${data.name}」已更新`, 'success')
      return true
    } catch (error) {
      showToast(onToast, `更新失败：${error.message}`, 'error')
      return false
    }
  }

  const handleDeleteModule = async (index) => {
    const mod = modules[index]
    if (!confirm(`确定要删除模块「${mod.name}」吗？`)) return
    try {
      if (mod.type === 'custom') await resumeAPI.deleteModule(mod.id)
      const updated = modules.filter((_, i) => i !== index)
      saveModulesToServer(updated)
      showToast(onToast, `模块「${mod.name}」已删除`, 'success')
    } catch (error) {
      showToast(onToast, `删除失败：${error.message}`, 'error')
    }
  }

  const handleEditData = (moduleId) => {
    setEditingDataModule(moduleId)
  }

  const autoSaveData = useCallback(async () => {
    try {
      const data = { ...profile, education, experience, projects }
      await resumeAPI.saveProfile(data)
    } catch (error) {
      console.error('Auto save failed:', error)
    }
  }, [profile, education, experience, projects])

  const handleSaveDataModule = async (moduleId) => {
    setIsSaving(true)
    setDataModuleSaveStatus(prev => ({ ...prev, [moduleId]: 'saving' }))
    try {
      const payload = moduleId === 'education' ? { education } : moduleId === 'experience' ? { experience } : { projects }
      const res = await resumeAPI.saveModuleData(moduleId, payload)
      setProfile(res.data)
      if (Array.isArray(res.data.education)) setEducation(res.data.education)
      if (Array.isArray(res.data.experience)) setExperience(res.data.experience)
      if (Array.isArray(res.data.projects)) setProjects(res.data.projects)
      setDataModuleSaveStatus(prev => ({ ...prev, [moduleId]: 'success' }))
      setTimeout(() => setDataModuleSaveStatus(prev => ({ ...prev, [moduleId]: 'idle' })), 2000)
      showToast(onToast, '数据已保存', 'success')
    } catch (error) {
      setDataModuleSaveStatus(prev => ({ ...prev, [moduleId]: 'error' }))
      setTimeout(() => setDataModuleSaveStatus(prev => ({ ...prev, [moduleId]: 'idle' })), 2000)
      showToast(onToast, `保存失败：${error.message}`, 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDragStart = (e, index) => {
    setDragIndex(index)
    e.dataTransfer.effectAllowed = 'move'
  }
  const handleDragOver = (e, index) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverIndex(index)
  }
  const handleDragEnd = () => {
    setDragIndex(null)
    setDragOverIndex(null)
  }
  const handleDrop = (e, dropIndex) => {
    e.preventDefault()
    if (dragIndex === null || dragIndex === dropIndex) {
      setDragIndex(null)
      setDragOverIndex(null)
      return
    }
    const reordered = [...modules]
    const [moved] = reordered.splice(dragIndex, 1)
    reordered.splice(dropIndex, 0, moved)
    saveModulesToServer(reordered)
    setDragIndex(null)
    setDragOverIndex(null)
  }

  const handleGeneratePdf = async () => {
    if (!selectedJob) {
      showToast(onToast, '请选择岗位', 'error')
      return
    }
    setIsGenerating(true)
    try {
      const res = await jobsAPI.generatePdf(selectedJob, selectedProvider)
      setResumeFiles(prev => [res.data, ...prev])
      showToast(onToast, `PDF 简历生成成功：${res.data.fileName}`, 'success')
    } catch (error) {
      showToast(onToast, '生成失败', 'error')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleDeleteFile = async (file, index) => {
    const displayName = file.fileName || file.name || file.path || '文件'
    try {
      await resumeAPI.deleteFile(file.path)
      setResumeFiles(prev => prev.filter((_, i) => i !== index))
      showToast(onToast, `已删除：${displayName}`, 'success')
    } catch (error) {
      if (String(error.message || '').includes('File not found')) {
        setResumeFiles(prev => prev.filter((_, i) => i !== index))
        showToast(onToast, `磁盘文件不存在，已从列表移除：${displayName}`, 'info')
        return
      }
      showToast(onToast, `删除失败：${displayName}`, 'error')
    }
  }

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }))
  }

  const hasPreviewableContent = (data) => {
    const hasText = (value) => {
      if (Array.isArray(value)) return value.some(item => String(item || '').trim())
      return String(value || '').trim().length > 0
    }
    const hasBasic = Boolean(
      hasText(data.full_name) || hasText(data.gender) || hasText(data.age) ||
      hasText(data.phone) || hasText(data.email) || hasText(data.wechat) ||
      hasText(data.github) || hasText(data.summary) || hasText(data.skills)
    )
    const hasEducation = (data.education || []).some(item =>
      hasText(item.school) || hasText(item.major) || hasText(item.degree) ||
      hasText(item.description) || hasText(item.start_date) || hasText(item.end_date)
    )
    const hasExperience = (data.experience || []).some(item =>
      hasText(item.company) || hasText(item.position) || hasText(item.role) ||
      hasText(item.description) || hasText(item.start_date) || hasText(item.end_date)
    )
    const hasProjects = (data.projects || []).some(item =>
      hasText(item.name) || hasText(item.role) || hasText(item.tech_stack) ||
      hasText(item.description) || hasText(item.start_date) || hasText(item.end_date)
    )
    const hasCustomModule = (data.modules || []).some(mod => mod.enabled && mod.type === 'custom' && hasText(mod.content))
    return hasBasic || hasEducation || hasExperience || hasProjects || hasCustomModule
  }

  return (
    <PageTransition>
      <LiquidSectionHeader title="简历生成" subtitle="填写个人信息，根据岗位要求生成定制化简历" icon={FileText} />

      {/* ── 基本信息 ── */}
      <ScrollReveal>
        <LiquidCard>
          <SectionHeader
            icon={User}
            title="基本信息"
            description="用于后续 PDF 简历生成"
            onToggle={() => toggleSection('basic')}
            isExpanded={expandedSections.basic}
          />
          {expandedSections.basic && (
            <div style={{ paddingTop: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: '24px' }}>
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                    <FormInput label="姓名" name="full_name" value={profile.full_name} onChange={updateProfile} placeholder="请输入姓名" />
                    <FormInput label="性别" name="gender" value={profile.gender} onChange={updateProfile} placeholder="男/女" />
                    <FormInput label="年龄" name="age" value={profile.age} onChange={updateProfile} placeholder="22" />
                    <FormInput label="GitHub" name="github" value={profile.github} onChange={updateProfile} placeholder="GitHub 用户名" />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                    <FormInput label="电话" name="phone" value={profile.phone} onChange={updateProfile} placeholder="手机号码" error={validationErrors.phone} />
                    <FormInput label="邮箱" name="email" value={profile.email} onChange={updateProfile} placeholder="邮箱地址" error={validationErrors.email} />
                    <FormInput label="微信" name="wechat" value={profile.wechat} onChange={updateProfile} placeholder="微信号" />
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    width: '100px',
                    height: '130px',
                    borderRadius: '12px',
                    background: 'var(--bg-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 12px',
                    overflow: 'hidden',
                    border: '2px dashed var(--border-color)'
                  }}>
                    {basicPhotoSrc ? <img src={basicPhotoSrc} alt="个人照片" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>个人照片</span>}
                  </div>
                  <label className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', cursor: 'pointer' }}>
                    <Upload size={14} />
                    {basicPhotoSrc ? '更换照片' : '上传照片'}
                    <input type="file" accept="image/png,image/jpeg" onChange={handlePhotoChange} style={{ display: 'none' }} />
                  </label>
                  {basicPhotoSrc && (
                    <button className="btn btn-danger btn-sm" style={{ marginTop: '8px', width: '100%' }} onClick={handleDeletePhoto} disabled={isSaving}>
                      删除照片
                    </button>
                  )}
                  <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>支持 PNG/JPG</div>
                </div>
              </div>
              <FormTextarea
                label="个人简介"
                name="summary"
                value={profile.summary}
                onChange={updateProfile}
                rows={4}
                placeholder="请简要介绍自己的核心竞争力、专业技能和职业目标（建议100-200字）"
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                <MagneticButton
                  variant={basicSaveStatus === 'success' ? 'success' : basicSaveStatus === 'error' ? 'danger' : 'primary'}
                  className="btn-sm"
                  onClick={handleSaveProfile}
                  disabled={isSaving || basicSaveStatus === 'saving'}
                >
                  {basicSaveStatus === 'success' ? <><CheckCircle size={14} style={{ marginRight: '4px' }} />已保存</>
                    : basicSaveStatus === 'error' ? <><X size={14} style={{ marginRight: '4px' }} />校验失败</>
                      : isSaving || basicSaveStatus === 'saving' ? <><FloppyDisk size={14} style={{ marginRight: '4px' }} />保存中...</>
                        : <><FloppyDisk size={14} style={{ marginRight: '4px' }} />保存基本信息</>}
                </MagneticButton>
              </div>
            </div>
          )}
        </LiquidCard>
      </ScrollReveal>

      {/* ── 简历模块管理 ── */}
      <ScrollReveal delay={0.1}>
        <LiquidCard>
          <SectionHeader
            icon={DotsSixVertical}
            title="简历模块管理"
            description="拖拽排序模块顺序，控制简历输出结构"
            onToggle={() => toggleSection('modules')}
            isExpanded={expandedSections.modules}
            actions={
              <>
                {isSavingModules && <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>同步中...</span>}
                <MagneticButton variant="primary" className="btn-sm" onClick={(e) => { e.stopPropagation(); setShowAddForm(true) }} disabled={showAddForm}>
                  <Plus size={14} style={{ marginRight: '4px' }} />添加自定义模块
                </MagneticButton>
              </>
            }
          />
          {expandedSections.modules && (
            <div style={{ paddingTop: '16px' }}>
              {showAddForm && <AddModuleForm onAdd={handleAddModule} onCancel={() => setShowAddForm(false)} />}
              {modules.map((mod, index) => (
                editIndex === index ? (
                  <EditModuleForm key={mod.id} module={mod} onSave={handleSaveEditModule} onCancel={() => setEditIndex(null)} />
                ) : (
                  <div key={mod.id}>
                    <ModuleItem
                      module={mod}
                      index={index}
                      onToggle={handleToggleModule}
                      onEdit={handleEditModule}
                      onDelete={handleDeleteModule}
                      onEditData={handleEditData}
                      onDragStart={handleDragStart}
                      onDragOver={handleDragOver}
                      onDrop={handleDrop}
                      onDragEnd={handleDragEnd}
                      dragIndex={dragIndex}
                      dragOverIndex={dragOverIndex}
                    />
                    {editingDataModule === mod.id && (
                      <div style={{
                        background: 'var(--bg-secondary)',
                        borderRadius: '16px',
                        padding: '20px',
                        marginBottom: '16px',
                        border: '1px solid var(--border-color)'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                          <h4 style={{ fontSize: '16px' }}>
                            {mod.id === 'education' && '教育背景'}
                            {mod.id === 'experience' && '工作经历'}
                            {mod.id === 'projects' && '项目经验'}
                          </h4>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <button className="btn btn-sm btn-secondary" onClick={() => openAiModal(mod.id)} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Sparkle size={14} /> AI 补全
                            </button>
                            <button className="btn btn-sm btn-secondary" onClick={() => setEditingDataModule(null)} style={{ padding: '6px' }}>
                              <X size={18} />
                            </button>
                          </div>
                        </div>
                        {mod.id === 'education' && (
                          <>
                            {education.length === 0 ? (
                              <div className="liquid-empty">
                                <GraduationCap size={32} />
                                <p>暂无教育背景信息</p>
                              </div>
                            ) : education.map((item, idx) => (
                              <EducationItem key={idx} item={item} index={idx} onChange={handleArrayChange} onDelete={deleteEducation} />
                            ))}
                            <MagneticButton variant="primary" className="btn-sm" onClick={addEducation}>
                              <Plus size={14} style={{ marginRight: '4px' }} />添加
                            </MagneticButton>
                          </>
                        )}
                        {mod.id === 'experience' && (
                          <>
                            {experience.length === 0 ? (
                              <div className="liquid-empty">
                                <Briefcase size={32} />
                                <p>暂无工作经历信息</p>
                              </div>
                            ) : experience.map((item, idx) => (
                              <ExperienceItem key={idx} item={item} index={idx} onChange={handleArrayChange} onDelete={deleteExperience} />
                            ))}
                            <MagneticButton variant="primary" className="btn-sm" onClick={addExperience}>
                              <Plus size={14} style={{ marginRight: '4px' }} />添加
                            </MagneticButton>
                          </>
                        )}
                        {mod.id === 'projects' && (
                          <>
                            {projects.length === 0 ? (
                              <div className="liquid-empty">
                                <FolderOpen size={32} />
                                <p>暂无项目经验信息</p>
                              </div>
                            ) : projects.map((item, idx) => (
                              <ProjectItem key={idx} item={item} index={idx} onChange={handleArrayChange} onDelete={deleteProject} />
                            ))}
                            <MagneticButton variant="primary" className="btn-sm" onClick={addProject}>
                              <Plus size={14} style={{ marginRight: '4px' }} />添加
                            </MagneticButton>
                          </>
                        )}
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
                          <MagneticButton
                            variant="primary"
                            onClick={() => handleSaveDataModule(mod.id)}
                            disabled={dataModuleSaveStatus[mod.id] === 'saving'}
                          >
                            {dataModuleSaveStatus[mod.id] === 'saving' ? '保存中...'
                              : dataModuleSaveStatus[mod.id] === 'success' ? '✓ 已保存'
                                : dataModuleSaveStatus[mod.id] === 'error' ? '✕ 保存失败'
                                  : '保存当前模块'}
                          </MagneticButton>
                          <MagneticButton variant="secondary" onClick={() => setEditingDataModule(null)}>关闭</MagneticButton>
                        </div>
                      </div>
                    )}
                  </div>
                )
              ))}
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '12px' }}>提示：拖拽模块卡片调整排序，简历将按此顺序输出各模块内容</p>
            </div>
          )}
        </LiquidCard>
      </ScrollReveal>

      {/* ── 生成简历 ── */}
      <ScrollReveal delay={0.2}>
        <LiquidCard>
          <SectionHeader
            icon={FileText}
            title="生成简历"
            description="选择岗位并生成定制化简历"
          />
          <div style={{ paddingTop: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
              <div className="form-item">
                <label style={{ fontSize: '13px', fontWeight: 500 }}>选择岗位 <span style={{ color: 'var(--danger-color)' }}>*</span></label>
                <select value={selectedJob} onChange={(e) => setSelectedJob(e.target.value)} className="form-control">
                  <option value="">请选择岗位</option>
                  {jobs.map((job) => (
                    <option key={job.id} value={job.id}>{job.company} - {job.title}</option>
                  ))}
                </select>
              </div>
              <div className="form-item">
                <label style={{ fontSize: '13px', fontWeight: 500 }}>AI 生成模型</label>
                <select value={selectedProvider} onChange={(e) => setSelectedProvider(e.target.value)} className="form-control">
                  {providers.length === 0 && <option value="deepseek">DeepSeek</option>}
                  {providers.map(provider => (
                    <option key={provider.id} value={provider.id} disabled={!provider.configured}>
                      {provider.label} {provider.configured ? `(${provider.model})` : '(未配置 Key)'}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap', marginBottom: '16px' }}>
              <MagneticButton variant="primary" onClick={handleSaveProfile} disabled={isSaving} style={{ flex: 1 }}>
                <FloppyDisk size={18} style={{ marginRight: '6px' }} />
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 600 }}>保存信息</div>
                  <div style={{ fontSize: '11px', opacity: 0.8 }}>保存所有填写的个人信息</div>
                </div>
              </MagneticButton>
              <MagneticButton variant="secondary" onClick={() => {
                const data = { ...profile, education, experience, projects, modules }
                if (!hasPreviewableContent(data)) {
                  showToast(onToast, '暂无可预览内容，请先填写至少一项简历信息', 'info')
                  return
                }
                setShowPreview(true)
              }} style={{ flex: 1 }}>
                <Eye size={18} style={{ marginRight: '6px' }} />
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 600 }}>预览简历</div>
                  <div style={{ fontSize: '11px', opacity: 0.8 }}>查看简历效果预览</div>
                </div>
              </MagneticButton>
              <MagneticButton variant="warning" onClick={handleGeneratePdf} disabled={!selectedJob || isGenerating} style={{ flex: 1 }}>
                <FileImage size={18} style={{ marginRight: '6px' }} />
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 600 }}>生成 PDF</div>
                  <div style={{ fontSize: '11px', opacity: 0.8 }}>生成可打印的 PDF 文件</div>
                </div>
              </MagneticButton>
            </div>

            {isGenerating && (
              <div className="liquid-empty">
                <div className="liquid-spinner" style={{ margin: '0 auto' }}></div>
                <p>正在生成简历...</p>
              </div>
            )}

            {!isGenerating && jobs.length === 0 && (
              <div className="liquid-empty">
                <FileText size={64} />
                <p>暂无可生成简历的岗位，请先在岗位发现中导入或扫描岗位</p>
              </div>
            )}
          </div>
        </LiquidCard>
      </ScrollReveal>

      {/* ─ 生成文件 ── */}
      {resumeFiles.length > 0 && (
        <ScrollReveal delay={0.4}>
          <LiquidCard>
            <div className="card-header">
              <div className="card-title">生成文件</div>
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {resumeFiles.map((file, index) => (
                <li key={`${file.path}-${index}`} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  padding: '10px 0',
                  borderBottom: '1px solid var(--border-color)'
                }}>
                  <a href={`/${file.path}`} target="_blank" rel="noreferrer" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--primary-color)' }}>
                    {file.fileName || file.name || file.path}
                  </a>
                  <button onClick={() => handleDeleteFile(file, index)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger-color)', padding: '4px', borderRadius: '4px', display: 'flex', alignItems: 'center' }} title="删除文件">
                    <Trash size={16} />
                  </button>
                </li>
              ))}
            </ul>
          </LiquidCard>
        </ScrollReveal>
      )}

      {/* ── 使用说明 ── */}
      <ScrollReveal delay={0.5}>
        <LiquidCard>
          <div className="card-header">
            <div className="card-title">使用说明</div>
          </div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {[
              '在各信息模块中填写详细的个人信息，系统会自动保存到简历模板',
              '教育背景、工作经历、项目经验支持添加多条记录，按时间顺序排列',
              '在「简历模块管理」中拖拽排序、显示/隐藏模块，控制简历输出结构',
              '点击「预览简历」查看填写效果，确认无误后再生成正式简历',
              '选择一个已评估的岗位，系统会根据岗位要求定制简历内容'
            ].map((text, i) => (
              <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '8px 0', fontSize: '14px', color: 'var(--text-secondary)' }}>
                <CheckCircle size={18} style={{ color: 'var(--success-color)', flexShrink: 0, marginTop: '2px' }} />
                {text}
              </li>
            ))}
          </ul>
        </LiquidCard>
      </ScrollReveal>

      {/* ── 预览模态框 ── */}
      {showPreview && (
        <PreviewModal
          profile={profile}
          education={education}
          experience={experience}
          projects={projects}
          modules={modules}
          photoPreview={photoPreview}
          onClose={() => setShowPreview(false)}
        />
      )}

      {/* ── AI 智能补全模态框 ── */}
      <AiAutoFillModal
        isOpen={aiModal.open}
        onClose={closeAiModal}
        section={aiModal.section}
        onFill={handleAiFill(aiModal.section)}
        onToast={onToast}
      />
    </PageTransition>
  )
}