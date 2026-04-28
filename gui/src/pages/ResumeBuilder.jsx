import { useState, useEffect, useRef, useCallback } from 'react'
import { FileText, FileImage, CheckCircle, Save, Upload, GripVertical, Plus, Trash2, Edit3, Edit2, Eye, EyeOff, X, ChevronDown, ChevronUp, User, Briefcase, GraduationCap, FolderOpen, Mail, Phone, MapPin, Calendar } from 'lucide-react'
import { aiAPI, jobsAPI, resumeAPI } from '../api'
import { showToast } from '../utils/toast'

function SectionHeader({ icon: Icon, title, description, actions }) {
  return (
    <div className="section-header">
      <div className="section-title">
        <Icon className="section-icon" />
        <div>
          <h3>{title}</h3>
          {description && <p>{description}</p>}
        </div>
      </div>
      {actions}
    </div>
  )
}

function FormInput({ label, name, value, onChange, type = 'text', placeholder, required = false, error, disabled = false }) {
  return (
    <div className="form-item">
      <label>
        {label}
        {required && <span className="required">*</span>}
      </label>
      <input
        type={type}
        name={name}
        value={value || ''}
        onChange={(e) => onChange(name, e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={`form-input ${error ? 'error' : ''}`}
      />
      {error && <span className="error-message">{error}</span>}
    </div>
  )
}

function FormTextarea({ label, name, value, onChange, rows = 3, placeholder, required = false, error }) {
  return (
    <div className="form-item">
      <label>
        {label}
        {required && <span className="required">*</span>}
      </label>
      <textarea
        name={name}
        value={value || ''}
        onChange={(e) => onChange(name, e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className={`form-input ${error ? 'error' : ''}`}
      />
      {error && <span className="error-message">{error}</span>}
    </div>
  )
}

function DateRangePicker({ startName, endName, startValue, endValue, onChange }) {
  return (
    <div className="date-range">
      <div className="form-item">
        <label>开始时间</label>
        <input
          type="month"
          value={startValue || ''}
          onChange={(e) => onChange(startName, e.target.value)}
          className="form-input"
        />
      </div>
      <span className="date-separator">~</span>
      <div className="form-item">
        <label>结束时间</label>
        <input
          type="month"
          value={endValue === 'present' ? '' : (endValue || '')}
          onChange={(e) => onChange(endName, e.target.value)}
          className="form-input"
          placeholder={endValue === 'present' ? '至今' : ''}
        />
        {endValue === 'present' && (
          <span className="present-badge">至今</span>
        )}
      </div>
    </div>
  )
}

function EducationItem({ item, index, onChange, onDelete }) {
  return (
    <div className="timeline-item">
      <div className="timeline-header">
        <div className="timeline-dates">
          <DateRangePicker
            startName={`education[${index}].start_date`}
            endName={`education[${index}].end_date`}
            startValue={item.start_date}
            endValue={item.end_date}
            onChange={onChange}
          />
        </div>
        <button className="btn-delete" onClick={() => onDelete(index)}>
          <X size={16} />
        </button>
      </div>
      <div className="form-grid-2">
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
    <div className="timeline-item">
      <div className="timeline-header">
        <div className="timeline-dates">
          <DateRangePicker
            startName={`experience[${index}].start_date`}
            endName={`experience[${index}].end_date`}
            startValue={item.start_date}
            endValue={item.end_date}
            onChange={onChange}
          />
        </div>
        <button className="btn-delete" onClick={() => onDelete(index)}>
          <X size={16} />
        </button>
      </div>
      <div className="form-grid-2">
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
    <div className="timeline-item">
      <div className="timeline-header">
        <div className="timeline-dates">
          <DateRangePicker
            startName={`projects[${index}].start_date`}
            endName={`projects[${index}].end_date`}
            startValue={item.start_date}
            endValue={item.end_date}
            onChange={onChange}
          />
        </div>
        <button className="btn-delete" onClick={() => onDelete(index)}>
          <X size={16} />
        </button>
      </div>
      <div className="form-grid-2">
        <FormInput
          label="项目名称"
          name={`projects[${index}].name`}
          value={item.name}
          onChange={onChange}
          placeholder="请输入项目名称"
          required
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
        required
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

function ModuleItem({ module, index, onToggle, onEdit, onDelete, onEditData, onDragStart, onDragOver, onDrop, dragIndex, dragOverIndex }) {
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
      className={`module-item ${isDragging ? 'dragging' : ''} ${isDragOver ? 'drag-over' : ''}`}
    >
      <GripVertical className="drag-handle" />
      <span className="module-name" style={{ color: module.enabled ? undefined : '#94a3b8' }}>
        {module.name}
        {module.type === 'custom' && <span className="custom-badge">自定义</span>}
      </span>
      <div className="module-actions">
        <button title={module.enabled ? '隐藏此模块' : '显示此模块'} onClick={() => onToggle(index)} className="action-btn">
          {module.enabled ? <Eye size={16} /> : <EyeOff size={16} />}
        </button>
        {isDataModule ? (
          <button title="编辑数据" onClick={() => onEditData(module.id)} className="action-btn">
            <Edit2 size={16} />
          </button>
        ) : (
          <button title="编辑" onClick={() => onEdit(index)} className="action-btn">
            <Edit3 size={16} />
          </button>
        )}
        <button title="删除" onClick={() => onDelete(index)} className="action-btn danger">
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  )
}

function AddModuleForm({ onAdd, onCancel }) {
  const [name, setName] = useState('')
  const [content, setContent] = useState('')
  const nameRef = useRef(null)

  useEffect(() => {
    nameRef.current?.focus()
  }, [])

  const handleSubmit = () => {
    if (!name.trim()) return
    onAdd({ name: name.trim(), content: content.trim() })
  }

  return (
    <div className="add-module-form">
      <div className="form-item">
        <label>模块名称 <span className="required">*</span></label>
        <input ref={nameRef} className="form-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="如：实习经历、资格证书" />
      </div>
      <div className="form-item">
        <label>模块内容</label>
        <textarea className="form-input" rows="3" value={content} onChange={(e) => setContent(e.target.value)} placeholder="在此输入该模块要展示的文本内容" />
      </div>
      <div className="form-actions">
        <button className="btn btn-primary btn-sm" onClick={handleSubmit} disabled={!name.trim()}>添加</button>
        <button className="btn btn-secondary btn-sm" onClick={onCancel}>取消</button>
      </div>
    </div>
  )
}

function EditModuleForm({ module, onSave, onCancel }) {
  const [name, setName] = useState(module.name || '')
  const [content, setContent] = useState(module.content || '')

  return (
    <div className="add-module-form">
      <div className="form-item">
        <label>模块名称 <span className="required">*</span></label>
        <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="form-item">
        <label>模块内容</label>
        <textarea className="form-input" rows="3" value={content} onChange={(e) => setContent(e.target.value)} />
      </div>
      <div className="form-actions">
        <button className="btn btn-primary btn-sm" onClick={() => onSave({ name: name.trim(), content: content.trim() })} disabled={!name.trim()}>保存</button>
        <button className="btn btn-secondary btn-sm" onClick={onCancel}>取消</button>
      </div>
    </div>
  )
}

function PreviewModal({ profile, education, experience, projects, modules, onClose }) {
  const formatDate = (date) => {
    if (!date) return ''
    if (date === 'present') return '至今'
    const [year, month] = date.split('-')
    return `${year}年${parseInt(month)}月`
  }

  const enabledModules = (modules || []).filter(m => m.enabled)

  const renderModule = (mod) => {
    if (mod.type === 'custom' && mod.content) {
      return (
        <div key={mod.id} className="preview-section">
          <h3>{mod.name}</h3>
          <p style={{ whiteSpace: 'pre-line' }}>{mod.content}</p>
        </div>
      )
    }

    switch (mod.id) {
      case 'summary':
        return profile.summary ? (
          <div key="summary" className="preview-section">
            <h3>求职定位</h3>
            <p>{profile.summary}</p>
          </div>
        ) : null
      case 'skills': {
        const skillsText = profile.skills || ''
        if (!skillsText) return null
        const skillItems = skillsText.split(/[、,，|]/).filter(Boolean)
        return (
          <div key="skills" className="preview-section">
            <h3>核心能力</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {skillItems.map((s, i) => (
                <span key={i} style={{ border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1d4ed8', padding: '2px 8px', borderRadius: '3px', fontSize: '13px' }}>{s.trim()}</span>
              ))}
            </div>
          </div>
        )
      }
      case 'experience':
        return experience.length > 0 ? (
          <div key="experience" className="preview-section">
            <h3>工作经历</h3>
            {experience.map((item, i) => (
              <div key={i} className="preview-item">
                <div className="preview-item-header">
                  <span className="preview-item-title">{item.company} - {item.position}</span>
                  <span className="preview-item-date">{formatDate(item.start_date)} ~ {formatDate(item.end_date)}</span>
                </div>
                {item.role && <p className="preview-item-sub">{item.role}</p>}
                {item.description && <p className="preview-item-desc">{item.description}</p>}
              </div>
            ))}
          </div>
        ) : null
      case 'projects':
        return projects.length > 0 ? (
          <div key="projects" className="preview-section">
            <h3>项目经历</h3>
            {projects.map((item, i) => (
              <div key={i} className="preview-item">
                <div className="preview-item-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="preview-item-title" style={{ flex: 1 }}>{item.name}</span>
                  {item.role && <span style={{ flex: 1, textAlign: 'center', color: '#64748b', fontSize: '12px' }}>{item.role}</span>}
                  <span className="preview-item-date" style={{ flex: 1, textAlign: 'right', color: '#64748b', fontSize: '12px' }}>{formatDate(item.start_date)} ~ {formatDate(item.end_date)}</span>
                </div>
                {item.tech_stack && <p className="preview-item-sub"><strong>技术栈：</strong><strong>{item.tech_stack}</strong></p>}
                {item.description && <p className="preview-item-desc" style={{ whiteSpace: 'pre-line' }}>{item.description}</p>}
              </div>
            ))}
          </div>
        ) : null
      case 'education':
        return education.length > 0 ? (
          <div key="education" className="preview-section">
            <h3>教育背景</h3>
            {education.map((item, i) => (
              <div key={i} className="preview-item">
                <div className="preview-item-header">
                  <span className="preview-item-title">{item.school} - {item.major}</span>
                  <span className="preview-item-date">{formatDate(item.start_date)} ~ {formatDate(item.end_date)}</span>
                </div>
                <p className="preview-item-sub">{item.degree} {item.gpa && `| GPA: ${item.gpa}`}</p>
                {item.description && <p className="preview-item-desc">{item.description}</p>}
              </div>
            ))}
          </div>
        ) : null
      case 'gaps':
        return null
      default:
        return null
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="preview-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>简历预览</h3>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="preview-content">
          <div className="preview-header">
            <h2>{profile.full_name || '姓名'}</h2>
            <div className="preview-contact">
              {(profile.gender || profile.age) && <span>{profile.gender || ''}{profile.age ? ' · ' + profile.age + '岁' : ''}</span>}
              {profile.phone && <span><Phone size={14} /> {profile.phone}</span>}
              {profile.email && <span><Mail size={14} /> {profile.email}</span>}
              {profile.wechat && <span>微信：{profile.wechat}</span>}
              {profile.github && <span><FolderOpen size={14} /> {profile.github}</span>}
            </div>
          </div>

          {enabledModules.map(mod => renderModule(mod))}
        </div>
      </div>
    </div>
  )
}

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
  const [modules, setModules] = useState([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [editIndex, setEditIndex] = useState(null)
  const [editingDataModule, setEditingDataModule] = useState(null)
  const [dragIndex, setDragIndex] = useState(null)
  const [dragOverIndex, setDragOverIndex] = useState(null)
  const [isSavingModules, setIsSavingModules] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [expandedSections, setExpandedSections] = useState({
    basic: true,
    education: true,
    experience: true,
    projects: true,
    modules: true
  })
  const [validationErrors, setValidationErrors] = useState({})

  useEffect(() => {
    fetchJobs()
    fetchProviders()
    fetchProfile()
    fetchModules()
  }, [])

  // Persist resumeFiles to localStorage
  useEffect(() => {
    localStorage.setItem('resumeFiles', JSON.stringify(resumeFiles))
  }, [resumeFiles])

  const handleDeleteFile = async (file, index) => {
    try {
      await resumeAPI.deleteFile(file.path)
      setResumeFiles(prev => prev.filter((_, i) => i !== index))
      showToast(onToast, `已删除：${file.fileName}`, 'success')
    } catch (error) {
      setResumeFiles(prev => prev.filter((_, i) => i !== index))
      showToast(onToast, `文件已从列表移除`, 'success')
    }
  }

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
      if (data.education && Array.isArray(data.education)) {
        setEducation(data.education)
      }
      if (data.experience && Array.isArray(data.experience)) {
        setExperience(data.experience)
      }
      if (data.projects && Array.isArray(data.projects)) {
        setProjects(data.projects)
      }
    } catch (error) {
      showToast(onToast, '加载个人信息失败', 'error')
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
    if (!newArray[index]) {
      newArray[index] = {}
    }
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

  const validateForm = () => {
    const errors = {}
    
    if (!profile.full_name.trim()) errors['full_name'] = '请输入姓名'
    if (!profile.phone.trim()) {
      errors['phone'] = '请输入联系电话'
    } else if (!/^1[3-9]\d{9}$/.test(profile.phone.replace(/\s/g, ''))) {
      errors['phone'] = '请输入有效的手机号码'
    }
    if (!profile.email.trim()) {
      errors['email'] = '请输入邮箱'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) {
      errors['email'] = '请输入有效的邮箱地址'
    }

    education.forEach((item, index) => {
      if (!item.school.trim()) errors[`education[${index}].school`] = '请输入学校名称'
      if (!item.major.trim()) errors[`education[${index}].major`] = '请输入专业名称'
      if (!item.start_date) errors[`education[${index}].start_date`] = '请选择开始时间'
    })

    experience.forEach((item, index) => {
      if (!item.company.trim()) errors[`experience[${index}].company`] = '请输入公司名称'
      if (!item.position.trim()) errors[`experience[${index}].position`] = '请输入职位'
      if (!item.start_date) errors[`experience[${index}].start_date`] = '请选择开始时间'
      if (!item.description.trim()) errors[`experience[${index}].description`] = '请输入工作描述'
    })

    projects.forEach((item, index) => {
      if (!item.name.trim()) errors[`projects[${index}].name`] = '请输入项目名称'
      if (!item.start_date) errors[`projects[${index}].start_date`] = '请选择开始时间'
      if (!item.description.trim()) errors[`projects[${index}].description`] = '请输入项目描述'
      if (!item.responsibility.trim()) errors[`projects[${index}].responsibility`] = '请输入项目分工'
    })

    setValidationErrors(errors)
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

  const handleSaveProfile = async () => {
    if (!validateForm()) {
      showToast(onToast, '请填写必填项并确保格式正确', 'error')
      return
    }

    setIsSaving(true)
    try {
      const data = {
        ...profile,
        education,
        experience,
        projects
      }
      const res = await resumeAPI.saveProfile(data)
      setProfile(res.data)
      setPhotoPreview('')
      showToast(onToast, '个人信息已保存', 'success')
    } catch (error) {
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
      setShowAddForm(false)
      showToast(onToast, `模块「${data.name}」已添加`, 'success')
    } catch (error) {
      showToast(onToast, `添加失败：${error.message}`, 'error')
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
      setEditIndex(null)
      showToast(onToast, `模块「${data.name}」已更新`, 'success')
    } catch (error) {
      showToast(onToast, `更新失败：${error.message}`, 'error')
    }
  }

  const handleDeleteModule = async (index) => {
    const mod = modules[index]
    if (!confirm(`确定要删除模块「${mod.name}」吗？`)) return
    try {
      if (mod.type === 'custom') {
        await resumeAPI.deleteModule(mod.id)
      }
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
      const data = {
        ...profile,
        education,
        experience,
        projects
      }
      await resumeAPI.saveProfile(data)
    } catch (error) {
      console.error('Auto save failed:', error)
    }
  }, [profile, education, experience, projects])

  const handleSaveDataModule = async () => {
    setIsSaving(true)
    try {
      const data = {
        ...profile,
        education,
        experience,
        projects
      }
      const res = await resumeAPI.saveProfile(data)
      setProfile(res.data)
      setEditingDataModule(null)
      showToast(onToast, '数据已保存', 'success')
    } catch (error) {
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

  const handleGenerateDocx = async () => {
    if (!selectedJob) {
      showToast(onToast, '请选择岗位', 'error')
      return
    }
    setIsGenerating(true)
    try {
      const res = await jobsAPI.generateDocx(selectedJob, selectedProvider)
      setResumeFiles(prev => [res.data, ...prev])
      showToast(onToast, `Word 简历生成成功：${res.data.fileName}`, 'success')
    } catch (error) {
      showToast(onToast, '生成失败', 'error')
    } finally {
      setIsGenerating(false)
    }
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

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }))
  }

  return (
    <>
      <div className="page-header">
        <h2>简历生成</h2>
        <p>填写个人信息，根据岗位要求生成定制化简历</p>
      </div>

      <div className="card resume-card">
        <SectionHeader
          icon={User}
          title="基本信息"
          description="用于后续 Word/PDF 简历生成，优先级高于 cv.md 中的联系方式"
          actions={
            <button className="btn btn-primary btn-sm" onClick={() => toggleSection('basic')}>
              {expandedSections.basic ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
          }
        />
        
        {expandedSections.basic && (
          <div className="card-content">
            <div className="resume-profile-grid">
              <div>
                <div className="form-grid-3" style={{ gridTemplateColumns: '1fr 100px 100px 1fr' }}>
                  <FormInput
                    label="姓名"
                    name="full_name"
                    value={profile.full_name}
                    onChange={updateProfile}
                    placeholder="请输入姓名"
                    required
                    error={validationErrors.full_name}
                  />
                  <FormInput
                    label="性别"
                    name="gender"
                    value={profile.gender}
                    onChange={updateProfile}
                    placeholder="男/女"
                  />
                  <FormInput
                    label="年龄"
                    name="age"
                    value={profile.age}
                    onChange={updateProfile}
                    placeholder="22"
                  />
                  <FormInput
                    label="GitHub"
                    name="github"
                    value={profile.github}
                    onChange={updateProfile}
                    placeholder="请输入 GitHub 用户名或链接"
                  />
                </div>
                <div className="form-grid-3">
                  <FormInput
                    label="电话"
                    name="phone"
                    value={profile.phone}
                    onChange={updateProfile}
                    placeholder="请输入手机号码"
                    required
                    error={validationErrors.phone}
                  />
                  <FormInput
                    label="邮箱"
                    name="email"
                    value={profile.email}
                    onChange={updateProfile}
                    placeholder="请输入邮箱地址"
                    required
                    error={validationErrors.email}
                  />
                  <FormInput
                    label="微信"
                    name="wechat"
                    value={profile.wechat}
                    onChange={updateProfile}
                    placeholder="请输入微信号"
                  />
                </div>
              </div>
              <div className="photo-section">
                <div className="photo-preview">
                  {photoPreview ? <img src={photoPreview} alt="预览" /> : profile.photo_path ? <span>已上传照片</span> : <span>个人照片</span>}
                </div>
                <label className="btn btn-secondary btn-block">
                  <Upload size={14} style={{ marginRight: '6px' }} />
                  上传照片
                  <input type="file" accept="image/png,image/jpeg" onChange={handlePhotoChange} style={{ display: 'none' }} />
                </label>
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
          </div>
        )}
      </div>

      <div className="card resume-card">
        <SectionHeader
          icon={GripVertical}
          title="简历模块管理"
          description="拖拽排序模块顺序，控制简历输出结构。内置模块可显示/隐藏，自定义模块可编辑内容"
          actions={
            <>
              {isSavingModules && <span className="sync-status">同步中...</span>}
              <button className="btn btn-primary btn-sm" onClick={() => setShowAddForm(true)} disabled={showAddForm}>
                <Plus size={14} style={{ marginRight: '4px' }} />
                添加自定义模块
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => toggleSection('modules')}>
                {expandedSections.modules ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>
            </>
          }
        />
        
        {expandedSections.modules && (
          <div className="card-content modules-list">
            {showAddForm && (
              <AddModuleForm
                onAdd={handleAddModule}
                onCancel={() => setShowAddForm(false)}
              />
            )}
            {modules.map((mod, index) => (
              editIndex === index ? (
                <EditModuleForm
                  key={mod.id}
                  module={mod}
                  onSave={handleSaveEditModule}
                  onCancel={() => setEditIndex(null)}
                />
              ) : (
                <div key={mod.id} className="module-item-wrapper">
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
                    dragIndex={dragIndex}
                    dragOverIndex={dragOverIndex}
                  />
                  {editingDataModule === mod.id && (
                    <div className="builtin-data-editor">
                      <div className="editor-header">
                        <h4>
                          {mod.id === 'education' && '教育背景'}
                          {mod.id === 'experience' && '工作经历'}
                          {mod.id === 'projects' && '项目经验'}
                        </h4>
                        <button className="btn-close" onClick={() => setEditingDataModule(null)}>
                          <X size={18} />
                        </button>
                      </div>
                      
                      {mod.id === 'education' && (
                        <div className="editor-content">
                          {education.length === 0 ? (
                            <div className="empty-state">
                              <GraduationCap size={32} />
                              <p>暂无教育背景信息</p>
                            </div>
                          ) : (
                            education.map((item, idx) => (
                              <EducationItem
                                key={idx}
                                item={item}
                                index={idx}
                                onChange={handleArrayChange}
                                onDelete={deleteEducation}
                              />
                            ))
                          )}
                          <button className="btn btn-primary btn-sm" onClick={addEducation}>
                            <Plus size={14} style={{ marginRight: '4px' }} />添加
                          </button>
                        </div>
                      )}
                      
                      {mod.id === 'experience' && (
                        <div className="editor-content">
                          {experience.length === 0 ? (
                            <div className="empty-state">
                              <Briefcase size={32} />
                              <p>暂无工作经历信息</p>
                            </div>
                          ) : (
                            experience.map((item, idx) => (
                              <ExperienceItem
                                key={idx}
                                item={item}
                                index={idx}
                                onChange={handleArrayChange}
                                onDelete={deleteExperience}
                              />
                            ))
                          )}
                          <button className="btn btn-primary btn-sm" onClick={addExperience}>
                            <Plus size={14} style={{ marginRight: '4px' }} />添加
                          </button>
                        </div>
                      )}
                      
                      {mod.id === 'projects' && (
                        <div className="editor-content">
                          {projects.length === 0 ? (
                            <div className="empty-state">
                              <FolderOpen size={32} />
                              <p>暂无项目经验信息</p>
                            </div>
                          ) : (
                            projects.map((item, idx) => (
                              <ProjectItem
                                key={idx}
                                item={item}
                                index={idx}
                                onChange={handleArrayChange}
                                onDelete={deleteProject}
                              />
                            ))
                          )}
                          <button className="btn btn-primary btn-sm" onClick={addProject}>
                            <Plus size={14} style={{ marginRight: '4px' }} />添加
                          </button>
                        </div>
                      )}
                      
                      <div className="editor-footer">
                        <button className="btn btn-secondary" onClick={() => setEditingDataModule(null)}>
                          关闭
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            ))}
            <p className="modules-hint">提示：拖拽模块卡片调整排序，简历将按此顺序输出各模块内容</p>
          </div>
        )}
      </div>

      <div className="card resume-card">
        <SectionHeader
          icon={FileText}
          title="生成简历"
          description="选择岗位并生成定制化简历"
        />
        
        <div className="card-content">
          <div className="form-item">
            <label>选择岗位 <span className="required">*</span></label>
            <select value={selectedJob} onChange={(e) => setSelectedJob(e.target.value)} className="form-input">
              <option value="">请选择岗位</option>
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.company} - {job.title}
                </option>
              ))}
            </select>
          </div>

          <div className="form-item">
            <label>AI 生成模型</label>
            <select value={selectedProvider} onChange={(e) => setSelectedProvider(e.target.value)} className="form-input">
              {providers.length === 0 && <option value="deepseek">DeepSeek</option>}
              {providers.map(provider => (
                <option key={provider.id} value={provider.id} disabled={!provider.configured}>
                  {provider.label} {provider.configured ? `(${provider.model})` : '(未配置 Key)'}
                </option>
              ))}
            </select>
          </div>

          <div className="action-buttons">
            <button className="btn btn-primary btn-large" onClick={handleSaveProfile} disabled={isSaving}>
              <Save size={20} className="btn-icon" />
              <div className="btn-text">
                <span className="btn-label">保存信息</span>
                <span className="btn-desc">保存所有填写的个人信息</span>
              </div>
            </button>
            <button className="btn btn-secondary btn-large" onClick={async () => {
              const res = await resumeAPI.getProfile()
              const data = res.data
              setProfile(data)
              if (data.education) setEducation(data.education)
              if (data.experience) setExperience(data.experience)
              if (data.projects) setProjects(data.projects)
              if (data.modules) setModules(data.modules)
              setShowPreview(true)
            }}>
              <Eye size={20} className="btn-icon" />
              <div className="btn-text">
                <span className="btn-label">预览简历</span>
                <span className="btn-desc">查看简历效果预览</span>
              </div>
            </button>
            <button className="btn btn-success btn-large" onClick={handleGenerateDocx} disabled={!selectedJob || isGenerating}>
              <FileText size={20} className="btn-icon" />
              <div className="btn-text">
                <span className="btn-label">生成 Word</span>
                <span className="btn-desc">生成定制化 .docx 文件</span>
              </div>
            </button>
            <button className="btn btn-warning btn-large" onClick={handleGeneratePdf} disabled={!selectedJob || isGenerating}>
              <FileImage size={20} className="btn-icon" />
              <div className="btn-text">
                <span className="btn-label">生成 PDF</span>
                <span className="btn-desc">生成可打印的 PDF 文件</span>
              </div>
            </button>
          </div>

          {isGenerating && (
            <div className="empty-state">
              <div className="spinner" style={{ margin: '0 auto' }}></div>
              <p>正在生成简历...</p>
            </div>
          )}

          {!isGenerating && jobs.length === 0 && (
            <div className="empty-state">
              <FileText size={64} />
              <p>暂无可生成简历的岗位，请先在岗位发现中导入或扫描岗位</p>
            </div>
          )}
        </div>
      </div>

      {resumeFiles.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">生成文件</div>
          </div>
          <ul className="file-list">
            {resumeFiles.map((file, index) => (
              <li key={`${file.path}-${index}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <a href={`/${file.path}`} target="_blank" rel="noreferrer" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.fileName}</a>
                <button onClick={() => handleDeleteFile(file, index)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '4px', borderRadius: '4px', display: 'flex', alignItems: 'center' }} title="删除文件">
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <div className="card-title">使用说明</div>
        </div>
        <ul className="guide-list">
          <li><CheckCircle size={18} className="check-icon" />在各信息模块中填写详细的个人信息，系统会自动保存到简历模板</li>
          <li><CheckCircle size={18} className="check-icon" />教育背景、工作经历、项目经验支持添加多条记录，按时间倒序排列</li>
          <li><CheckCircle size={18} className="check-icon" />在「简历模块管理」中拖拽排序、显示/隐藏模块，控制简历输出结构</li>
          <li><CheckCircle size={18} className="check-icon" />点击「预览简历」查看填写效果，确认无误后再生成正式简历</li>
          <li><CheckCircle size={18} className="check-icon" />选择一个已评估的岗位，系统会根据岗位要求定制简历内容</li>
        </ul>
      </div>

      {showPreview && (
        <PreviewModal
          profile={profile}
          education={education}
          experience={experience}
          projects={projects}
          modules={modules}
          onClose={() => setShowPreview(false)}
        />
      )}
    </>
  )
}
