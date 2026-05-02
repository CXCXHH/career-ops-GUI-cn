import { useEffect, useMemo, useState, useRef } from 'react'
import { MagnifyingGlass, ArrowsClockwise, Plus, ArrowSquareOut, CheckSquare, Square, PlusCircle, Upload } from '@phosphor-icons/react'
import { companiesAPI, discoveryAPI, jobsAPI } from '../api'
import { showToast } from '../utils/toast'
import { PageTransition, LiquidSectionHeader, LiquidCard, MagneticButton } from '../components/LiquidMotion'
import '../styles/liquid-motion.css'

const DEFAULT_KEYWORDS = ''

const ENTERPRISE_TYPES = ['不限', '国企央企', '民营名企', '外企']
const JOB_LEVELS = ['不限', '实习', '校招/应届', '初级（1-3年）', '中级（3-5年）', '高级/资深']

const firstText = (...values) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

const normalizeImportJob = (job, defaults = {}) => {
  const company = firstText(
    job.company,
    job.enterprise,
    job.company_name,
    job.companyName,
    job.enterprise_name,
    job.enterpriseName,
    job.employer,
    defaults.company
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
  const jobLevel = firstText(job.job_level, job.jobLevel, job.level, job.experience, defaults.jobLevel)

  return {
    company: company || '未知公司',
    enterprise: firstText(job.enterprise, company),
    url: job.url,
    title,
    location: firstText(job.location, job.city, job.work_location),
    salary: firstText(job.salary, job.compensation, job.pay),
    experience: firstText(job.experience, jobLevel),
    job_level: jobLevel,
    enterprise_type: firstText(job.enterprise_type, job.company_type, job.enterpriseType, job.companyType, job.type, defaults.enterpriseType),
    education: firstText(job.education, job.degree),
    tags: job.tags || job.keywords || [],
    validation: firstText(job.validation_status, job.validation, job.liveness_status),
    description: firstText(job.description, job.summary, job.snippet, job.raw_text)
  }
}

export default function Discovery({ onToast }) {
  const [companies, setCompanies] = useState([])
  const [jobs, setJobs] = useState([])
  const [manualUrl, setManualUrl] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isImporting, setIsImporting] = useState(false)
  const [isFileImporting, setIsFileImporting] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  const [isSearching, setIsSearching] = useState(false)
  
  const [selectedJobs, setSelectedJobs] = useState(new Set())

  // 搜索参数
  const [searchDirection, setSearchDirection] = useState('')
  const [searchCity, setSearchCity] = useState('')
  const [searchEnterpriseType, setSearchEnterpriseType] = useState('不限')
  const [searchJobLevel, setSearchJobLevel] = useState('不限')

  useEffect(() => {
    refreshData()
  }, [])

  const refreshData = async () => {
    setIsLoading(true)
    try {
      const [companyRes, jobRes] = await Promise.all([
        companiesAPI.getAll(),
        jobsAPI.getAll()
      ])
      const companyData = companyRes.data || []
      const jobData = jobRes.data || []
      setCompanies(companyData)
      setJobs(jobData)
      setSelectedJobs(new Set())
    } catch (error) {
      console.error('[Discovery] 加载数据失败:', error)
      showToast(onToast, `加载数据失败：${error.message}`, 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const discoveredJobs = useMemo(() => {
    return jobs
  }, [jobs])

  const handleImportUrl = async () => {
    const url = manualUrl.trim()
    if (!url) {
      showToast(onToast, '请先粘贴岗位 URL', 'error')
      return
    }

    setIsImporting(true)
    try {
      await jobsAPI.importUrl(url)
      setManualUrl('')
      await refreshData()
      showToast(onToast, '岗位 URL 已导入并完成有效性检查', 'success')
    } catch (error) {
      showToast(onToast, `导入失败：${error.message}`, 'error')
    } finally {
      setIsImporting(false)
    }
  }

  const handleSearch = async () => {
    if (!searchDirection.trim()) {
      showToast(onToast, '请输入专业方向', 'error')
      return
    }
    setIsSearching(true)
    try {
      const response = await discoveryAPI.search({
        direction: searchDirection.trim(),
        city: searchCity.trim(),
        enterpriseType: searchEnterpriseType,
        jobLevel: searchJobLevel
      })
      const result = response.data
      await refreshData()
      const parts = []
      if (result.new > 0) parts.push(`新增 ${result.new} 个`)
      if (result.duplicates > 0) parts.push(`重复 ${result.duplicates} 个`)
      if (result.companies_added > 0) parts.push(`新公司 ${result.companies_added} 家`)
      const msg = parts.length > 0
        ? `搜索完成：${parts.join('，')}`
        : '搜索完成，未发现新岗位'
      showToast(onToast, msg, result.new > 0 ? 'success' : 'warning')
    } catch (error) {
      showToast(onToast, `搜索失败：${error.message}`, 'error')
    } finally {
      setIsSearching(false)
    }
  }

  // Detect if JSON uses job-finer or legacy structured format
  const isJobFinerOrStructuredFormat = (data) => {
    if (data.jobs && Array.isArray(data.jobs)) return true
    if (data.by_enterprise_type) return true
    if (data.by_company) return true
    return false
  }

  // Import via backend /api/discovery/import-json (job-finer standard path)
  const importViaBackend = async (jsonData, sourceName) => {
    setIsFileImporting(true)
    setImportProgress(0)
    try {
      const response = await discoveryAPI.importJson(jsonData)
      const result = response.data
      setImportProgress(100)
      await refreshData()

      const parts = []
      if (result.addedJobs > 0) parts.push(`正式岗位 ${result.addedJobs} 个`)
      if (result.addedCandidates > 0) parts.push(`候选区 ${result.addedCandidates} 个`)
      if (result.addedCompanies > 0) parts.push(`新公司 ${result.addedCompanies} 家`)
      if (result.duplicateJobs > 0) parts.push(`重复 ${result.duplicateJobs} 个`)
      if (result.rejectedJobs > 0) parts.push(`拒绝 ${result.rejectedJobs} 个`)
      if (result.missingFieldsJobs > 0) parts.push(`缺字段 ${result.missingFieldsJobs} 个`)
      const message = parts.length > 0
        ? `${sourceName}导入完成：${parts.join('，')}`
        : `${sourceName}导入完成，无新增数据`
      showToast(onToast, message, result.addedJobs > 0 ? 'success' : 'warning')
    } catch (error) {
      console.error('[Discovery] Backend import error:', error)
      setImportProgress(0)
      showToast(onToast, `${sourceName}导入失败：${error.message}`, 'error')
    } finally {
      setIsFileImporting(false)
      setTimeout(() => setImportProgress(0), 500)
    }
  }

  const parseJsonContent = (content) => {
    try {
      const data = JSON.parse(content)
      const jobsToAdd = []

      if (data.jobs && Array.isArray(data.jobs)) {
        data.jobs.forEach(job => {
          if (job.url && (job.url.startsWith('http://') || job.url.startsWith('https://'))) {
            jobsToAdd.push(normalizeImportJob(job, { enterpriseType: data.enterprise_type_filter }))
          }
        })
      } else if (data.by_enterprise_type) {
        Object.entries(data.by_enterprise_type).forEach(([enterpriseType, typeData]) => {
          if (typeData.enterprises && Array.isArray(typeData.enterprises)) {
            typeData.enterprises.forEach(enterprise => {
              const companyName = enterprise.name
              if (!companyName) return
              
              if (enterprise.urls && Array.isArray(enterprise.urls)) {
                enterprise.urls.forEach(job => {
                  if (job.url && (job.url.startsWith('http://') || job.url.startsWith('https://'))) {
                    jobsToAdd.push(normalizeImportJob(job, { company: companyName, enterpriseType }))
                  }
                })
              }
            })
          }
        })
      } else if (data.urls_by_source) {
        Object.values(data.urls_by_source).forEach(source => {
          if (source.jobs && Array.isArray(source.jobs)) {
            source.jobs.forEach(job => {
              if (job.url && (job.url.startsWith('http://') || job.url.startsWith('https://'))) {
                jobsToAdd.push(normalizeImportJob(job))
              }
            })
          }
        })
      }

      return { jobsToAdd, invalidLines: [] }
    } catch (error) {
      console.error('[Discovery] JSON parse error:', error)
      return { jobsToAdd: [], invalidLines: [1] }
    }
  }

  

  const importJobsBatch = async (jobsToAdd, invalidLines, sourceName) => {
    setIsFileImporting(true)
    setImportProgress(0)
    try {
      const response = await jobsAPI.batchAdd(jobsToAdd)
      const result = response.data
      
      setImportProgress(100)
      await refreshData()

      let message = `${sourceName}导入完成：成功 ${result.added} 个`
      if (result.skipped > 0) {
        message += `，跳过重复 ${result.skipped} 个`
      }
      if (invalidLines.length > 0) {
        message += `，无效 ${invalidLines.length} 行`
      }
      showToast(onToast, message, result.skipped === 0 ? 'success' : 'warning')
    } catch (error) {
      console.error('[Discovery] Batch import error:', error)
      setImportProgress(0)
      showToast(onToast, `${sourceName}导入失败：${error.message}`, 'error')
    } finally {
      setIsFileImporting(false)
      setTimeout(() => setImportProgress(0), 500)
    }
  }

  const handleFileImport = async (event) => {
    try {
      const file = event.target.files?.[0]
      if (!file) {
        return
      }

      const fileName = file.name.toLowerCase()
      if (!fileName.endsWith('.json')) {
        showToast(onToast, '请选择 JSON 文件', 'error')
        return
      }

      const content = await file.text()
      let data
      try { data = JSON.parse(content) } catch (e) {
        showToast(onToast, 'JSON 格式无效', 'error')
        return
      }

      // job-finer or structured format → use backend import-json API
      if (isJobFinerOrStructuredFormat(data)) {
        await importViaBackend(data, '文件')
      } else {
        // Fallback: flat job list via batchAdd
        const { jobsToAdd } = parseJsonContent(content)
        if (jobsToAdd.length === 0) {
          showToast(onToast, '文件中没有有效的岗位数据', 'error')
          return
        }
        await importJobsBatch(jobsToAdd, [], '文件')
      }
    } catch (error) {
      console.error('[Discovery] File import error:', error)
      showToast(onToast, `文件导入失败：${error.message}`, 'error')
    } finally {
      if (event.target) {
        event.target.value = ''
      }
    }
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = async (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    try {
      const file = e.dataTransfer?.files?.[0]
      if (!file) {
        return
      }

      const fileName = file.name.toLowerCase()
      if (!fileName.endsWith('.json')) {
        showToast(onToast, '请拖拽 JSON 文件', 'error')
        return
      }

      const content = await file.text()
      let data
      try { data = JSON.parse(content) } catch (e) {
        showToast(onToast, 'JSON 格式无效', 'error')
        return
      }

      // job-finer or structured format → use backend import-json API
      if (isJobFinerOrStructuredFormat(data)) {
        await importViaBackend(data, '拖拽')
      } else {
        const { jobsToAdd } = parseJsonContent(content)
        if (jobsToAdd.length === 0) {
          showToast(onToast, '文件中没有有效的岗位数据', 'error')
          return
        }
        await importJobsBatch(jobsToAdd, [], '拖拽')
      }
    } catch (error) {
      console.error('[Discovery] Drop error:', error)
      showToast(onToast, `拖拽导入失败：${error.message}`, 'error')
    }
  }

  const handleExtract = async (jobId) => {
    try {
      await jobsAPI.extract(jobId)
      await refreshData()
      showToast(onToast, '已抽取 JD 并写入 pipeline', 'success')
    } catch (error) {
      showToast(onToast, `抽取失败：${error.message}`, 'error')
    }
  }

  const handleJobSelect = (jobId) => {
    const newSelected = new Set(selectedJobs)
    if (newSelected.has(jobId)) {
      newSelected.delete(jobId)
    } else {
      newSelected.add(jobId)
    }
    setSelectedJobs(newSelected)
  }

  const handleSelectAllJobs = () => {
    if (selectedJobs.size === discoveredJobs.length) {
      setSelectedJobs(new Set())
    } else {
      setSelectedJobs(new Set(discoveredJobs.map(j => j.id)))
    }
  }

  const handleAddSelectedCompanies = async () => {
    if (selectedJobs.size === 0) {
      showToast(onToast, '请先勾选岗位', 'error')
      return
    }

    const selectedJobObjects = discoveredJobs.filter(j => selectedJobs.has(j.id))
    const companiesToAdd = new Set()
    
    selectedJobObjects.forEach(job => {
      if (job.company && job.company.trim()) {
        companiesToAdd.add(job.company.trim())
      }
    })

    if (companiesToAdd.size === 0) {
      showToast(onToast, '未找到有效的公司信息', 'error')
      return
    }

    try {
      for (const companyName of companiesToAdd) {
        const exists = companies.some(c => c.name === companyName || (c.aliases || []).includes(companyName))
        if (!exists) {
          await companiesAPI.create({
            name: companyName,
            official_homepage: '',
            career_urls: [],
            keywords: [],
            negative_keywords: ['销售', '财务', '人力', '市场'],
            enabled: true
          })
        }
      }
      await refreshData()
      setSelectedJobs(new Set())
      showToast(onToast, `成功将 ${companiesToAdd.size} 家公司添加到公司库`, 'success')
    } catch (error) {
      showToast(onToast, `添加公司失败：${error.message}`, 'error')
    }
  }

  const parseKeywordList = (value) => {
    if (Array.isArray(value)) return value.map(String).map(v => v.trim()).filter(Boolean)
    return String(value || '')
      .split(/[,\n，、]/)
      .map(v => v.trim())
      .filter(Boolean)
  }

  if (isLoading) {
    return (
      <PageTransition>
        <LiquidSectionHeader title="岗位发现" subtitle="发现和管理岗位" icon={MagnifyingGlass} />
        <div className="liquid-empty">
          <div className="liquid-spinner" style={{ margin: '0 auto' }}></div>
        </div>
      </PageTransition>
    )
  }

  return (
    <PageTransition>
      <LiquidSectionHeader title="岗位发现" subtitle="发现和管理岗位" icon={MagnifyingGlass} />

      <LiquidCard delay={0}>
        <div className="card-header">
          <h3 className="card-title">手动导入官网岗位 URL</h3>
        </div>
        <div className="url-import-row">
          <input
            className="form-control"
            value={manualUrl}
            onChange={(event) => setManualUrl(event.target.value)}
            placeholder="粘贴公司官网岗位详情页 URL"
          />
          <MagneticButton variant="secondary" className="btn-sm" onClick={handleImportUrl} disabled={isImporting}>
            <Plus style={{ width: '14px', height: '14px', marginRight: '6px' }} />
            {isImporting ? '导入中...' : '导入 URL'}
          </MagneticButton>
        </div>
      </LiquidCard>

      <LiquidCard delay={0.08}>
        <div className="card-header">
          <h3 className="card-title">批量导入岗位（JSON格式）</h3>
        </div>
        <div 
          style={{ 
            marginBottom: '12px', 
            padding: '20px', 
            border: `2px dashed ${isDragging ? 'var(--primary-color)' : 'var(--border-light)'}`,
            borderRadius: '8px',
            backgroundColor: isDragging ? 'var(--primary-tint)' : 'var(--bg-secondary)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            transition: 'all 0.3s ease'
          }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <Upload style={{ width: '24px', height: '24px', marginBottom: '8px', color: isDragging ? 'var(--primary-color)' : 'var(--text-secondary)' }} />
          <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
            {isFileImporting ? '导入中...' : '选择 JSON 文件'}
            <input
              type="file"
              accept=".json"
              onChange={handleFileImport}
              disabled={isFileImporting}
              style={{ display: 'none' }}
            />
          </label>
          {isFileImporting && importProgress > 0 && (
            <div style={{ width: '100%', marginTop: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                <span>导入进度</span>
                <span>{importProgress}%</span>
              </div>
              <div style={{ height: '6px', backgroundColor: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden' }}>
                <div 
                  style={{ 
                    height: '100%', 
                    width: `${importProgress}%`, 
                    backgroundColor: 'var(--primary-color)',
                    transition: 'width 0.3s ease'
                  }} 
                />
              </div>
            </div>
          )}
        </div>
      </LiquidCard>

      <LiquidCard delay={0.16}>
        <div className="card-header">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <h3 className="card-title">岗位搜索结果</h3>
              <span style={{ color: 'var(--text-secondary)', fontSize: '13px', marginLeft: '12px' }}>{discoveredJobs.length} 个</span>
            </div>
            {discoveredJobs.length > 0 && (
              <div className="btn-group">
                <MagneticButton variant="secondary" className="btn-sm" onClick={handleSelectAllJobs}>
                  {selectedJobs.size === discoveredJobs.length ? '取消全选' : '全选'}
                </MagneticButton>
                <MagneticButton 
                  variant="primary" 
                  className="btn-sm" 
                  onClick={handleAddSelectedCompanies}
                  disabled={selectedJobs.size === 0}
                >
                  <PlusCircle style={{ width: '14px', height: '14px', marginRight: '4px' }} />
                  添加 {selectedJobs.size} 家公司到公司库
                </MagneticButton>
              </div>
            )}
          </div>
        </div>

        <table className="table">
          <thead>
            <tr>
              <th style={{ width: '40px' }}>
                <button className="btn btn-link p-0" onClick={handleSelectAllJobs}>
                  {selectedJobs.size === discoveredJobs.length && discoveredJobs.length > 0 ? (
                    <CheckSquare style={{ width: '18px', height: '18px', color: 'var(--primary-color)' }} />
                  ) : (
                    <Square style={{ width: '18px', height: '18px', color: 'var(--text-muted)' }} />
                  )}
                </button>
              </th>
              <th>公司</th>
              <th>岗位</th>
              <th>薪资</th>
              <th>地点</th>
              <th>有效性</th>
              <th>来源</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {discoveredJobs.map((job) => (
              <tr key={job.id} className={`liquid-table-row ${selectedJobs.has(job.id) ? 'selected-row' : ''}`}>
                <td>
                  <button 
                    className="btn btn-link p-0" 
                    onClick={() => handleJobSelect(job.id)}
                  >
                    {selectedJobs.has(job.id) ? (
                      <CheckSquare style={{ width: '18px', height: '18px', color: 'var(--primary-color)' }} />
                    ) : (
                      <Square style={{ width: '18px', height: '18px', color: 'var(--text-muted)' }} />
                    )}
                  </button>
                </td>
                <td>{job.company || '-'}</td>
                <td>{job.title || '-'}</td>
                <td>
                  {job.salary || '-'}
                  {job.salary && <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}> (来源：网页抓取)</span>}
                </td>
                <td>{job.location || '-'}</td>
                <td>
                  <span className={`status-badge ${job.liveness_status === 'active' ? 'status-active' : job.liveness_status === 'closed' ? 'status-closed' : job.liveness_status === 'error' ? 'status-error' : 'status-unconfirmed'}`}>
                    {job.liveness_status === 'active' ? '有效' : job.liveness_status === 'closed' ? '已关闭' : job.liveness_status === 'error' ? '错误' : job.liveness_status === 'unknown' ? '未知' : job.liveness_status || '未确认'}
                  </span>
                </td>
                <td>{job.source_type === 'manual_url' ? '手动导入' : job.source_type === 'discovery' ? '搜索发现' : job.source_type || '-'}</td>
                <td>
                  <div className="btn-group">
                    <a className="btn btn-secondary btn-sm" href={job.url} target="_blank" rel="noreferrer">
                      <ArrowSquareOut style={{ width: '14px', height: '14px' }} />
                    </a>
                    <MagneticButton variant="primary" className="btn-sm" onClick={() => handleExtract(job.id)}>
                      写入 pipeline
                    </MagneticButton>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {discoveredJobs.length === 0 && (
          <div className="liquid-empty">
            <MagnifyingGlass size={32} />
            <p>暂无岗位。可以粘贴官网岗位 URL 导入。</p>
          </div>
        )}
      </LiquidCard>
    </PageTransition>
  )
}
