import { useState, useEffect, useMemo, useCallback } from 'react'
import { FileText, ArrowsClockwise, Trash, Eye, ArrowSquareOut, CheckCircle, Warning, MagnifyingGlass, CheckSquare, Square, Spinner, Plus, Upload } from '@phosphor-icons/react'
import { aiAPI, jobsAPI, discoveryAPI } from '../api'
import { showToast } from '../utils/toast'
import { PageTransition, LiquidSectionHeader, LiquidCard, MagneticButton } from '../components/LiquidMotion'

export default function Jobs({ onToast }) {
  const [jobs, setJobs] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('all')
  const [searchCompany, setSearchCompany] = useState('')
  const [selectedJob, setSelectedJob] = useState(null)
  const [showDetail, setShowDetail] = useState(false)
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)
  const [providers, setProviders] = useState([])
  const [selectedProvider, setSelectedProvider] = useState('deepseek')
  const [evaluatingId, setEvaluatingId] = useState(null)
  const [optimizingId, setOptimizingId] = useState(null)
  const [validationResult, setValidationResult] = useState(null)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [isBatchDeleting, setIsBatchDeleting] = useState(false)
  const [batchAction, setBatchAction] = useState(null)
  const [manualJdText, setManualJdText] = useState('')
  const [isSavingManualJd, setIsSavingManualJd] = useState(false)
  const [editableUrl, setEditableUrl] = useState('')
  const [isSavingUrl, setIsSavingUrl] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  // Import area state (from Discovery)
  const [manualUrl, setManualUrl] = useState('')
  const [isImportingUrl, setIsImportingUrl] = useState(false)
  const [isFileImporting, setIsFileImporting] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  const [isAiSearching, setIsAiSearching] = useState(false)
  const [aiDirection, setAiDirection] = useState('')
  const [aiCity, setAiCity] = useState('')
  const [aiEnterpriseType, setAiEnterpriseType] = useState('不限')
  const [aiJobLevel, setAiJobLevel] = useState('不限')
  const [showImportModal, setShowImportModal] = useState(false)
  const [importTab, setImportTab] = useState('url')

  useEffect(() => {
    fetchJobs()
    fetchProviders()
  }, [filterStatus])

  const fetchJobs = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = {}
      if (filterStatus !== 'all') params.status = filterStatus
      const res = await jobsAPI.getAll(params)
      setJobs(res.data || [])
      setSelectedIds(new Set())
    } catch (error) {
      console.error('Jobs fetch error:', error)
      showToast(onToast, '加载岗位数据失败', 'error')
    } finally {
      setIsLoading(false)
    }
  }, [filterStatus, onToast])

  const handleExtract = async (id) => {
    try {
      const res = await jobsAPI.extract(id)
      if (res.data?.extraction_status === 'blocked') {
        showToast(onToast, '招聘站拦截了真实 JD，已保留搜索结果元数据', 'warning')
      } else {
        showToast(onToast, '岗位信息已提取并写入 pipeline', 'success')
      }
      fetchJobs()
    } catch (error) {
      showToast(onToast, `提取失败：${error.message}`, 'error')
    }
  }

  const fetchProviders = async () => {
    try {
      const res = await aiAPI.getProviders()
      setProviders(res.data || [])
      const firstConfigured = (res.data || []).find(provider => provider.configured)
      if (firstConfigured) setSelectedProvider(firstConfigured.id)
    } catch (error) {
      console.error('Providers fetch error:', error)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('确定要删除这个岗位吗？')) return
    try {
      await jobsAPI.delete(id)
      showToast(onToast, '岗位已删除', 'success')
      fetchJobs()
    } catch (error) {
      showToast(onToast, '删除失败', 'error')
    }
  }

  const handleAddToTracker = async (job) => {
    try {
      await jobsAPI.addToTracker(job.id)
      showToast(onToast, `${job.company} - ${job.title} 已添加到投递追踪`, 'success')
    } catch (error) {
      showToast(onToast, `添加追踪器失败：${error.message}`, 'error')
    }
  }

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return
    setIsBatchDeleting(true)
    try {
      const ids = Array.from(selectedIds)
      await jobsAPI.batchDelete(ids)
      showToast(onToast, `成功删除 ${ids.length} 个岗位`, 'success')
      setSelectedIds(new Set())
      fetchJobs()
    } catch (error) {
      showToast(onToast, `批量删除失败：${error.message}`, 'error')
    } finally {
      setIsBatchDeleting(false)
      setShowConfirmModal(false)
    }
  }

  const handleBatchAction = async (action) => {
    if (selectedIds.size === 0 || batchAction) return
    const ids = filteredJobs.filter(job => selectedIds.has(job.id)).map(job => job.id)
    if (ids.length === 0) return

    const labels = {
      liveness: '检查有效性',
      extract: '提取岗位信息',
      evaluate: 'AI 评分',
      optimize: 'AI 优化 JD'
    }
    setBatchAction(action)

    try {
      if (action === 'optimize') {
        const res = await jobsAPI.batchOptimizeJd(ids, selectedProvider)
        const summary = res.data || {}
        showToast(
          onToast,
          `${labels[action]}完成：成功 ${summary.successCount || 0} 个${summary.failedCount ? `，失败 ${summary.failedCount} 个` : ''}`,
          summary.failedCount ? 'warning' : 'success'
        )
      } else {
        let success = 0
        let failed = 0
        for (const id of ids) {
          try {
            if (action === 'liveness') await jobsAPI.liveness(id)
            if (action === 'extract') await jobsAPI.extract(id)
            if (action === 'evaluate') await jobsAPI.evaluate(id, selectedProvider)
            success++
          } catch (error) {
            console.error(`Batch ${action} failed for ${id}:`, error)
            failed++
          }
        }
        showToast(onToast, `${labels[action]}完成：成功 ${success} 个${failed ? `，失败 ${failed} 个` : ''}`, failed ? 'warning' : 'success')
      }
      setSelectedIds(new Set())
      await fetchJobs()
    } finally {
      setBatchAction(null)
    }
  }

  const handleSelectAll = () => {
    if (selectedIds.size === filteredJobs.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredJobs.map(j => j.id)))
    }
  }

  const handleSelectOne = (id) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
  }

  const handleLiveness = async (id) => {
    try {
      await jobsAPI.liveness(id)
      showToast(onToast, '有效性检查完成', 'success')
      fetchJobs()
    } catch (error) {
      showToast(onToast, `检查失败：${error.message}`, 'error')
    }
  }

  const handleEvaluate = async (id) => {
    setEvaluatingId(id)
    try {
      const res = await jobsAPI.evaluate(id, selectedProvider)
      showToast(onToast, `AI 评分完成：${res.data.score ?? '-'} / 5`, 'success')
      fetchJobs()
    } catch (error) {
      showToast(onToast, `评估失败：${error.message}`, 'error')
    } finally {
      setEvaluatingId(null)
    }
  }

  const handleOptimizeJd = async (id) => {
    setOptimizingId(id)
    try {
      const res = await jobsAPI.optimizeJd(id, selectedProvider)
      setSelectedJob(res.data)
      setManualJdText(res.data.raw_text || '')
      await fetchJobs()
      const confidence = res.data.ai_jd_confidence || '-'
      showToast(onToast, `AI JD 优化完成：${confidence}`, 'success')
    } catch (error) {
      showToast(onToast, `优化失败：${error.message}`, 'error')
    } finally {
      setOptimizingId(null)
    }
  }

  const handleViewDetail = async (job) => {
    setSelectedJob(job)
    setShowDetail(true)
    setIsLoadingDetail(true)
    setManualJdText('')
    setEditableUrl(job.url || '')
    try {
      const res = await jobsAPI.getDetail(job.id)
      setSelectedJob(res.data)
      setManualJdText(res.data.raw_text || '')
      setEditableUrl(res.data.url || '')
    } catch (error) {
    } finally {
      setIsLoadingDetail(false)
    }
  }

  const handleSaveManualJd = async () => {
    if (!selectedJob || !manualJdText.trim()) {
      showToast(onToast, '请先粘贴岗位描述', 'error')
      return
    }
    setIsSavingManualJd(true)
    try {
      const res = await jobsAPI.update(selectedJob.id, { raw_text: manualJdText, provider: selectedProvider })
      setSelectedJob(res.data)
      await fetchJobs()
      showToast(onToast, '岗位描述已保存', 'success')
    } catch (error) {
      showToast(onToast, `保存失败：${error.message}`, 'error')
    } finally {
      setIsSavingManualJd(false)
    }
  }

  const handleSaveUrl = async () => {
    if (!selectedJob || !editableUrl.trim()) {
      showToast(onToast, '请先填写 URL', 'error')
      return
    }
    setIsSavingUrl(true)
    try {
      const res = await jobsAPI.update(selectedJob.id, { url: editableUrl })
      setSelectedJob(res.data)
      setEditableUrl(res.data.url || '')
      await fetchJobs()
      showToast(onToast, 'URL 已保存', 'success')
    } catch (error) {
      showToast(onToast, `URL 保存失败：${error.message}`, 'error')
    } finally {
      setIsSavingUrl(false)
    }
  }

  const handleValidate = async () => {
    try {
      const res = await jobsAPI.validate()
      setValidationResult(res.data)
      const { issueCount, total } = res.data
      showToast(onToast, issueCount > 0 ? `${issueCount}/${total} 条岗位存在数据问题` : `全部 ${total} 条岗位数据正常`, issueCount > 0 ? 'error' : 'success')
    } catch (error) {
      showToast(onToast, `校验失败：${error.message}`, 'error')
    }
  }

  // ── Import handlers (from Discovery) ──

  const ENTERPRISE_TYPES = ['不限', '国企央企', '民营名企', '外企']
  const JOB_LEVELS = ['不限', '实习', '校招/应届', '初级（1-3年）', '中级（3-5年）', '高级/资深']



  const handleImportUrl = async () => {
    const url = manualUrl.trim()
    if (!url) { showToast(onToast, '请先粘贴岗位 URL', 'error'); return }
    setIsImportingUrl(true)
    try {
      await jobsAPI.importUrl(url)
      setManualUrl('')
      await fetchJobs()
      showToast(onToast, '岗位 URL 已导入', 'success')
    } catch (error) {
      showToast(onToast, `导入失败：${error.message}`, 'error')
    } finally { setIsImportingUrl(false) }
  }

  const handleAiSearch = async () => {
    if (!aiDirection.trim()) { showToast(onToast, '请输入专业方向', 'error'); return }
    setIsAiSearching(true)
    try {
      const response = await discoveryAPI.aiSearch({
        direction: aiDirection.trim(), city: aiCity.trim(),
        enterpriseType: aiEnterpriseType, jobLevel: aiJobLevel
      })
      const result = response.data
      await fetchJobs()
      const imported = result.imported || {}
      const parts = []
      if (imported.added > 0) parts.push(`新增 ${imported.added} 个`)
      if (imported.duplicates > 0) parts.push(`重复 ${imported.duplicates} 个`)
      if (result.companies_added > 0) parts.push(`新公司 ${result.companies_added} 家`)
      const msg = parts.length > 0 ? `AI 搜索完成：${parts.join('，')}` : 'AI 搜索完成，未发现新岗位'
      showToast(onToast, msg, imported.added > 0 ? 'success' : 'warning')
    } catch (error) {
      showToast(onToast, `AI 搜索失败：${error.message}`, 'error')
    } finally { setIsAiSearching(false) }
  }

  const handleFileImport = async (event) => {
    try {
      const file = event.target.files?.[0]
      if (!file) return
      if (!file.name.toLowerCase().endsWith('.json')) { showToast(onToast, '请选择 JSON 文件', 'error'); return }
      const content = await file.text()
      let data
      try { data = JSON.parse(content) } catch (e) { showToast(onToast, 'JSON 格式无效', 'error'); return }

      if (data.jobs || data.by_enterprise_type || data.by_company) {
        setIsFileImporting(true)
        setImportProgress(0)
        const response = await discoveryAPI.importJson(data)
        const result = response.data
        setImportProgress(100)
        await fetchJobs()
        const parts = []
        if (result.addedJobs > 0) parts.push(`岗位 ${result.addedJobs} 个`)
        if (result.addedCandidates > 0) parts.push(`候选 ${result.addedCandidates} 个`)
        if (result.addedCompanies > 0) parts.push(`公司 ${result.addedCompanies} 家`)
        if (result.duplicateJobs > 0) parts.push(`重复 ${result.duplicateJobs} 个`)
        const msg = parts.length > 0 ? `导入完成：${parts.join('，')}` : '导入完成'
        showToast(onToast, msg, result.addedJobs > 0 ? 'success' : 'warning')
        setIsFileImporting(false)
        setTimeout(() => setImportProgress(0), 500)
      }
    } catch (error) {
      showToast(onToast, `文件导入失败：${error.message}`, 'error')
      setIsFileImporting(false)
    } finally {
      if (event.target) event.target.value = ''
    }
  }

  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true) }
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false) }
  const handleDrop = async (e) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false)
    try {
      const file = e.dataTransfer?.files?.[0]
      if (!file || !file.name.toLowerCase().endsWith('.json')) { showToast(onToast, '请拖拽 JSON 文件', 'error'); return }
      const content = await file.text()
      let data
      try { data = JSON.parse(content) } catch (e) { showToast(onToast, 'JSON 格式无效', 'error'); return }
      if (data.jobs || data.by_enterprise_type || data.by_company) {
        setIsFileImporting(true); setImportProgress(0)
        const response = await discoveryAPI.importJson(data)
        const result = response.data
        setImportProgress(100)
        await fetchJobs()
        showToast(onToast, '导入完成', 'success')
        setIsFileImporting(false)
        setTimeout(() => setImportProgress(0), 500)
      }
    } catch (error) { showToast(onToast, `导入失败：${error.message}`, 'error'); setIsFileImporting(false) }
  }

  const filteredJobs = useMemo(() => {
    if (!searchCompany.trim()) return jobs
    const keyword = searchCompany.trim().toLowerCase()
    return jobs.filter(j => (j.company || '').toLowerCase().includes(keyword))
  }, [jobs, searchCompany])

  useEffect(() => {
    setCurrentPage(1)
  }, [filterStatus, searchCompany])

  const totalPages = Math.ceil(filteredJobs.length / pageSize) || 1

  const paginatedJobs = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredJobs.slice(start, start + pageSize)
  }, [filteredJobs, currentPage])

  const companyTypeLabel = (job) => {
    return job.enterprise_type || job.company_type || job.type || job.parsed?.enterprise_type || job.parsed?.company_type || '-'
  }


  const statusLabel = (status) => {
    switch (status) {
      case 'active': return '有效'
      case 'closed': return '已关闭'
      case 'unconfirmed': return '未确认'
      case 'error': return '错误'
      default: return status || '未知'
    }
  }

  const statusClass = (status) => {
    switch (status) {
      case 'active': return 'status-active'
      case 'closed': return 'status-closed'
      default: return 'status-unconfirmed'
    }
  }

  if (isLoading) {
    return (
      <PageTransition>
        <LiquidSectionHeader title="岗位" subtitle="发现和管理岗位" icon={FileText} />
        <div className="liquid-empty">
          <div className="liquid-spinner" style={{ margin: '0 auto' }}></div>
        </div>
      </PageTransition>
    )
  }

  return (
    <PageTransition>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <LiquidSectionHeader title="岗位" subtitle="发现和管理岗位" icon={FileText} />
        <MagneticButton variant="primary" onClick={() => setShowImportModal(true)} style={{ marginTop: '8px' }}>
          <Plus style={{ width: '14px', height: '14px', marginRight: '4px' }} />
          导入岗位
        </MagneticButton>
      </div>

      {/* Import modal */}
      {showImportModal && (
        <div className="liquid-modal-overlay" onClick={() => setShowImportModal(false)}>
          <div className="liquid-modal" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>导入岗位</h3>
              <button className="btn btn-close" onClick={() => setShowImportModal(false)}>×</button>
            </div>
            <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid var(--border-color)' }}>
              {[
                { key: 'url', label: '粘贴 URL' },
                { key: 'ai', label: 'AI 搜索' },
                { key: 'file', label: 'JSON 文件' },
              ].map(tab => (
                <button key={tab.key}
                  onClick={() => setImportTab(tab.key)}
                  style={{
                    padding: '10px 20px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: importTab === tab.key ? 600 : 400,
                    background: importTab === tab.key ? 'var(--bg-primary)' : 'transparent',
                    color: importTab === tab.key ? 'var(--primary-color)' : 'var(--text-secondary)',
                    borderBottom: importTab === tab.key ? '2px solid var(--primary-color)' : '2px solid transparent',
                    transition: 'all 0.2s'
                  }}
                >{tab.label}</button>
              ))}
            </div>
            <div style={{ padding: '20px' }}>
              {importTab === 'url' && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input className="form-control" value={manualUrl} onChange={e => setManualUrl(e.target.value)} placeholder="粘贴公司官网岗位详情页 URL" style={{ flex: 1 }} />
                  <MagneticButton variant="primary" className="btn-sm" onClick={() => { handleImportUrl(); setShowImportModal(false); }} disabled={isImportingUrl || !manualUrl.trim()}>
                    {isImportingUrl ? '导入中...' : '导入'}
                  </MagneticButton>
                </div>
              )}
              {importTab === 'ai' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>专业方向 <span style={{ color: 'var(--error-color)' }}>*</span></label>
                      <input className="form-control" value={aiDirection} onChange={e => setAiDirection(e.target.value)} placeholder="如：数据分析、Java开发" />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>城市</label>
                      <input className="form-control" value={aiCity} onChange={e => setAiCity(e.target.value)} placeholder="如：上海、北京" />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>企业性质</label>
                      <select className="form-control" value={aiEnterpriseType} onChange={e => setAiEnterpriseType(e.target.value)}>
                        {ENTERPRISE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>职位层级</label>
                      <select className="form-control" value={aiJobLevel} onChange={e => setAiJobLevel(e.target.value)}>
                        {JOB_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                      </select>
                    </div>
                  </div>
                  <MagneticButton variant="primary" onClick={() => { handleAiSearch(); setShowImportModal(false); }} disabled={isAiSearching || !aiDirection.trim()}>
                    {isAiSearching ? '搜索中...' : '开始搜索'}
                  </MagneticButton>
                </div>
              )}
              {importTab === 'file' && (
                <div style={{
                  padding: '24px', border: `2px dashed ${isDragging ? 'var(--primary-color)' : 'var(--border-light)'}`,
                  borderRadius: '8px', backgroundColor: isDragging ? 'var(--primary-tint)' : 'var(--bg-secondary)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', transition: 'all 0.3s ease'
                }}
                  onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={(e) => { handleDrop(e); setShowImportModal(false); }}>
                  <Upload style={{ width: '24px', height: '24px', marginBottom: '8px', color: isDragging ? 'var(--primary-color)' : 'var(--text-secondary)' }} />
                  <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
                    {isFileImporting ? '导入中...' : '选择文件或拖拽到此处'}
                    <input type="file" accept=".json" onChange={(e) => { handleFileImport(e); setShowImportModal(false); }} disabled={isFileImporting} style={{ display: 'none' }} />
                  </label>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <LiquidCard delay={0}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="form-control" style={{ width: '120px' }}>
              <option value="all">全部 ({jobs.length})</option>
              <option value="active">有效</option>
              <option value="closed">已关闭</option>
              <option value="unconfirmed">未确认</option>
            </select>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input className="form-control" placeholder="搜公司..." value={searchCompany} onChange={(e) => setSearchCompany(e.target.value)} style={{ width: '150px', paddingRight: '28px' }} />
              <MagnifyingGlass style={{ position: 'absolute', right: '8px', width: '14px', height: '14px', color: 'var(--text-muted)' }} />
            </div>
            <select value={selectedProvider} onChange={(e) => setSelectedProvider(e.target.value)} className="form-control" style={{ width: '180px', fontSize: '12px' }}>
              {providers.map(provider => (
                <option key={provider.id} value={provider.id}>{provider.label}{provider.configured ? '' : ' (未配置)'}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            {selectedIds.size > 0 ? (
              <>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)', marginRight: '4px' }}>{selectedIds.size} 项</span>
                <MagneticButton variant="secondary" className="btn-sm" onClick={() => handleBatchAction('extract')} disabled={Boolean(batchAction)}>
                  {batchAction === 'extract' ? <Spinner style={{ width: '12px', height: '12px' }} /> : '提取'}
                </MagneticButton>
                <MagneticButton variant="secondary" className="btn-sm" onClick={() => handleBatchAction('evaluate')} disabled={Boolean(batchAction)}>
                  {batchAction === 'evaluate' ? <Spinner style={{ width: '12px', height: '12px' }} /> : '评分'}
                </MagneticButton>
                <MagneticButton variant="primary" className="btn-sm" onClick={() => setShowConfirmModal(true)} disabled={isBatchDeleting}>
                  <Trash style={{ width: '12px', height: '12px', marginRight: '2px' }} />删除
                </MagneticButton>
              </>
            ) : (
              <>
                <MagneticButton variant="secondary" className="btn-sm" onClick={handleSelectAll} disabled={filteredJobs.length === 0}>
                  {selectedIds.size === filteredJobs.length && filteredJobs.length > 0 ? <CheckSquare style={{ width: '14px', height: '14px' }} /> : <Square style={{ width: '14px', height: '14px' }} />}
                </MagneticButton>
                <MagneticButton variant="secondary" className="btn-sm" onClick={handleValidate} title="校验数据完整性">
                  <Warning style={{ width: '14px', height: '14px' }} />
                </MagneticButton>
              </>
            )}
          </div>
        </div>

        {validationResult && validationResult.issueCount > 0 && (
          <div style={{ padding: '12px 24px', background: 'var(--warning-tint)', borderBottom: '1px solid var(--border-color)', fontSize: '13px', color: 'var(--warning-color)' }}>
            <Warning style={{ width: '14px', height: '14px', marginRight: '6px', verticalAlign: 'middle' }} />
            发现 {validationResult.issueCount} 条数据问题：
            {validationResult.issues.slice(0, 5).map((issue, i) => (
              <span key={issue.id} style={{ marginLeft: '8px' }}>
                {issue.company || issue.title || issue.id}({issue.problems.join(', ')})
                {i < Math.min(validationResult.issues.length, 5) - 1 ? ';' : ''}
              </span>
            ))}
            {validationResult.issues.length > 5 && <span> 等 {validationResult.issues.length} 条</span>}
            <button onClick={() => setValidationResult(null)} style={{ marginLeft: '12px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warning-color)' }}>关闭</button>
          </div>
        )}

        <table className="table">
          <thead>
            <tr>
              <th style={{ width: '40px' }}>
                <button 
                  className="btn btn-link p-0" 
                  onClick={handleSelectAll}
                  disabled={filteredJobs.length === 0}
                >
                  {selectedIds.size === filteredJobs.length && filteredJobs.length > 0 ? (
                    <CheckSquare style={{ width: '18px', height: '18px', color: 'var(--primary-color)' }} />
                  ) : (
                    <Square style={{ width: '18px', height: '18px', color: 'var(--text-muted)' }} />
                  )}
                </button>
              </th>
              <th>公司</th>
              <th>岗位</th>
              <th>公司性质</th>
              <th>岗位性质</th>
              <th>薪资</th>
              <th>地点</th>
              <th>发现时间</th>
              <th>状态</th>
              <th>评分</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {paginatedJobs.map((job) => (
              <tr 
                key={job.id} 
                className={`liquid-table-row ${selectedIds.has(job.id) ? 'selected-row' : ''}`}
              >
                <td>
                  <button 
                    className="btn btn-link p-0" 
                    onClick={() => handleSelectOne(job.id)}
                  >
                    {selectedIds.has(job.id) ? (
                      <CheckSquare style={{ width: '16px', height: '16px', color: 'var(--primary-color)' }} />
                    ) : (
                      <Square style={{ width: '16px', height: '16px', color: 'var(--border-light)' }} />
                    )}
                  </button>
                </td>
                <td>{job.company || <span style={{ color: 'var(--danger-color)' }}>缺失</span>}</td>
                <td>{job.title || <span style={{ color: 'var(--danger-color)' }}>缺失</span>}</td>
                <td>{companyTypeLabel(job)}</td>
                <td>{job.job_level || job.experience || job.parsed?.job_level || '-'}</td>
                <td>{job.salary || '-'}</td>
                <td>{job.location || '-'}</td>
                <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{job.discovered_at ? new Date(job.discovered_at).toLocaleDateString('zh-CN') : '-'}</td>
                <td>
                  <span className={`status-badge ${statusClass(job.liveness_status)}`}>
                    {statusLabel(job.liveness_status)}
                  </span>
                </td>
                <td>
                  {job.score ? (
                    <div>
                      <strong>{job.score}/5</strong>
                      {job.recommendation && <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{job.recommendation}</div>}
                    </div>
                  ) : '-'}
                </td>
                <td>
                  <MagneticButton variant="secondary" className="btn-sm" onClick={() => handleViewDetail(job)} title="查看详情">
                    <Eye style={{ width: '14px', height: '14px' }} />
                  </MagneticButton>
                  <MagneticButton variant="secondary" className="btn-sm" onClick={() => handleLiveness(job.id)} title="检查有效性">
                    <CheckCircle style={{ width: '14px', height: '14px' }} />
                  </MagneticButton>
                  <MagneticButton variant="primary" className="btn-sm" onClick={() => handleExtract(job.id)} title="提取岗位详情">
                    <ArrowsClockwise style={{ width: '14px', height: '14px' }} />
                  </MagneticButton>
                  <MagneticButton variant="secondary" className="btn-sm" onClick={() => handleEvaluate(job.id)} disabled={evaluatingId === job.id} title="AI 评分">
                    <FileText style={{ width: '14px', height: '14px' }} />
                    {evaluatingId === job.id ? '评分中' : ''}
                  </MagneticButton>
                  <MagneticButton variant="primary" className="btn-sm" onClick={() => handleAddToTracker(job)} title="添加到投递追踪">
                    <Plus style={{ width: '14px', height: '14px' }} />
                  </MagneticButton>
                  <MagneticButton variant="primary" className="btn-sm" onClick={() => handleDelete(job.id)} title="删除">
                    <Trash style={{ width: '14px', height: '14px' }} />
                  </MagneticButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredJobs.length > 0 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 8px 8px',
            borderTop: '1px solid var(--border-color)',
            marginTop: '8px'
          }}>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              第 {currentPage} / {totalPages} 页，共 {filteredJobs.length} 条
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                className="btn btn-secondary btn-sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(1)}
                style={{ opacity: currentPage === 1 ? 0.5 : 1 }}
              >
                首页
              </button>
              <button
                className="btn btn-secondary btn-sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                style={{ opacity: currentPage === 1 ? 0.5 : 1 }}
              >
                上一页
              </button>
              <div style={{
                display: 'flex',
                gap: '4px',
                alignItems: 'center'
              }}>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum
                  if (totalPages <= 5) {
                    pageNum = i + 1
                  } else if (currentPage <= 3) {
                    pageNum = i + 1
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i
                  } else {
                    pageNum = currentPage - 2 + i
                  }
                  return (
                    <button
                      key={pageNum}
                      className={`btn btn-sm ${currentPage === pageNum ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setCurrentPage(pageNum)}
                      style={{
                        minWidth: '32px',
                        padding: '4px 8px',
                        fontWeight: currentPage === pageNum ? '600' : '400'
                      }}
                    >
                      {pageNum}
                    </button>
                  )
                })}
              </div>
              <button
                className="btn btn-secondary btn-sm"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                style={{ opacity: currentPage === totalPages ? 0.5 : 1 }}
              >
                下一页
              </button>
              <button
                className="btn btn-secondary btn-sm"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(totalPages)}
                style={{ opacity: currentPage === totalPages ? 0.5 : 1 }}
              >
                末页
              </button>
            </div>
          </div>
        )}

        {filteredJobs.length === 0 && (
          <div className="liquid-empty">
            <FileText size={32} />
            <p>暂无岗位数据</p>
          </div>
        )}
      </LiquidCard>

      {showDetail && selectedJob && (
        <div className="modal-overlay" onClick={() => setShowDetail(false)}>
          <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{selectedJob.title || '岗位详情'}</h3>
              <button className="btn btn-close" onClick={() => setShowDetail(false)}>×</button>
            </div>
            <div className="modal-body-scroll">
              {isLoadingDetail ? (
                <div style={{ padding: '24px', textAlign: 'center' }}><div className="liquid-spinner" style={{ margin: '0 auto' }}></div></div>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="form-group">
                      <label>公司</label>
                      <input type="text" className="form-control" value={selectedJob.company || ''} readOnly />
                    </div>
                    <div className="form-group">
                      <label>岗位名称</label>
                      <input type="text" className="form-control" value={selectedJob.title || ''} readOnly />
                    </div>
                    <div className="form-group">
                      <label>地点</label>
                      <input type="text" className="form-control" value={selectedJob.location || ''} readOnly />
                    </div>
                    <div className="form-group">
                      <label>发现时间</label>
                      <input type="text" className="form-control" value={selectedJob.discovered_at ? new Date(selectedJob.discovered_at).toLocaleString('zh-CN') : '-'} readOnly />
                    </div>
                    <div className="form-group">
                      <label>有效性状态</label>
                      <div><span className={`status-badge ${statusClass(selectedJob.liveness_status)}`}>{statusLabel(selectedJob.liveness_status)}</span>
                        {selectedJob.liveness_reason && <span style={{ marginLeft: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>{selectedJob.liveness_reason}</span>}
                      </div>
                    </div>
                    <div className="form-group">
                      <label>来源</label>
                      <input type="text" className="form-control" value={selectedJob.source_type || ''} readOnly />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>URL</label>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input
                        type="url"
                        className="form-control"
                        value={editableUrl}
                        onChange={(e) => setEditableUrl(e.target.value)}
                        placeholder="https://..."
                        style={{ flex: 1 }}
                      />
                      <a href={editableUrl || selectedJob.url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm" title="打开 URL">
                        <ArrowSquareOut style={{ width: '14px', height: '14px' }} />
                      </a>
                      <MagneticButton
                        variant="primary"
                        className="btn-sm"
                        onClick={handleSaveUrl}
                        disabled={isSavingUrl || !editableUrl.trim() || editableUrl === selectedJob.url}
                      >
                        {isSavingUrl ? '保存中...' : '保存 URL'}
                      </MagneticButton>
                    </div>
                  </div>
                  {selectedJob.parsed && (
                    <>
                      {(selectedJob.parsed.salary || selectedJob.parsed.location || selectedJob.parsed.publish_date) && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                          {selectedJob.parsed.salary && (
                            <div className="form-group">
                              <label>薪资</label>
                              <input type="text" className="form-control" value={selectedJob.parsed.salary} readOnly />
                            </div>
                          )}
                          {selectedJob.parsed.location && !selectedJob.location && (
                            <div className="form-group">
                              <label>工作地点（解析）</label>
                              <input type="text" className="form-control" value={selectedJob.parsed.location} readOnly />
                            </div>
                          )}
                          {selectedJob.parsed.publish_date && !selectedJob.publish_date && (
                            <div className="form-group">
                              <label>发布日期（解析）</label>
                              <input type="text" className="form-control" value={selectedJob.parsed.publish_date} readOnly />
                            </div>
                          )}
                        </div>
                      )}
                      {selectedJob.parsed.responsibilities.length > 0 && (
                        <div className="form-group">
                          <label>岗位职责</label>
                          <ul style={{ margin: '4px 0 0 16px', padding: 0, fontSize: '13px', lineHeight: '1.7' }}>
                            {selectedJob.parsed.responsibilities.map((item, index) => <li key={`resp-${index}`}>{item}</li>)}
                          </ul>
                        </div>
                      )}
                      {selectedJob.parsed.requirements.length > 0 && (
                        <div className="form-group">
                          <label>任职要求</label>
                          <ul style={{ margin: '4px 0 0 16px', padding: 0, fontSize: '13px', lineHeight: '1.7' }}>
                            {selectedJob.parsed.requirements.map((item, index) => <li key={`req-${index}`}>{item}</li>)}
                          </ul>
                        </div>
                      )}
                      {selectedJob.parsed.highlights.length > 0 && (
                        <div className="form-group">
                          <label>加分项</label>
                          <ul style={{ margin: '4px 0 0 16px', padding: 0, fontSize: '13px', lineHeight: '1.7' }}>
                            {selectedJob.parsed.highlights.map((item, index) => <li key={`bonus-${index}`}>{item}</li>)}
                          </ul>
                        </div>
                      )}
                    </>
                  )}
                  {selectedJob.raw_text && !selectedJob.parsed && (
                    <div className="form-group">
                      <label>岗位描述（原始提取）</label>
                      <textarea className="form-control" rows="10" value={selectedJob.raw_text} readOnly style={{ fontSize: '12px' }} />
                    </div>
                  )}
                  {selectedJob.description && !selectedJob.raw_text && (
                    <div className="form-group">
                      <label>岗位信息（搜索结果元数据）</label>
                      <textarea className="form-control" rows="8" value={selectedJob.description} readOnly style={{ fontSize: '12px' }} />
                    </div>
                  )}
                  {selectedJob.ai_optimized_jd && (
                    <div className="form-group">
                      <label>AI 优化后的 JD（用于评分和简历生成）</label>
                      <textarea className="form-control" rows="8" value={selectedJob.ai_optimized_jd} readOnly style={{ fontSize: '12px' }} />
                      <div style={{ marginTop: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                        置信度：{selectedJob.ai_jd_confidence || '-'} · 模型：{selectedJob.ai_jd_model || '-'}
                        {selectedJob.ai_jd_liveness_status ? ` · 状态判断：${selectedJob.ai_jd_liveness_status}` : ''}
                      </div>
                      {selectedJob.ai_jd_warnings?.length > 0 && (
                        <ul style={{ margin: '6px 0 0 16px', padding: 0, fontSize: '12px', color: 'var(--warning-color)' }}>
                          {selectedJob.ai_jd_warnings.map((item, index) => <li key={`ai-warning-${index}`}>{item}</li>)}
                        </ul>
                      )}
                    </div>
                  )}
                  <div className="form-group">
                    <label>手动补充岗位描述</label>
                    <textarea
                      className="form-control"
                      rows="8"
                      value={manualJdText}
                      onChange={(e) => setManualJdText(e.target.value)}
                      placeholder="从已登录的招聘页面复制职位描述、任职要求等内容后粘贴到这里"
                      style={{ fontSize: '12px' }}
                    />
                    <MagneticButton
                      variant="primary"
                      className="btn-sm"
                      onClick={handleSaveManualJd}
                      disabled={isSavingManualJd || !manualJdText.trim()}
                      style={{ marginTop: '8px' }}
                    >
                      {isSavingManualJd ? '保存中...' : '保存岗位描述'}
                    </MagneticButton>
                    <MagneticButton
                      variant="secondary"
                      className="btn-sm"
                      onClick={() => handleOptimizeJd(selectedJob.id)}
                      disabled={optimizingId === selectedJob.id || (!selectedJob.raw_text && !selectedJob.description)}
                      style={{ marginTop: '8px', marginLeft: '8px' }}
                    >
                      {optimizingId === selectedJob.id ? '优化中...' : 'AI 优化JD'}
                    </MagneticButton>
                  </div>
                  {!selectedJob.raw_text && !selectedJob.description && !selectedJob.parsed && (
                    <div style={{ padding: '12px', background: 'var(--warning-tint)', borderRadius: '6px', fontSize: '13px', color: 'var(--danger-color)', marginBottom: '12px' }}>
                      <Warning style={{ width: '14px', height: '14px', marginRight: '6px', verticalAlign: 'middle' }} />
                      该岗位尚未提取详细内容，请点击「提取」按钮获取
                    </div>
                  )}
                  {(selectedJob.score || selectedJob.score_reason) && (
                    <div className="evaluation-panel">
                      <h4>AI 评分结果</h4>
                      <p><strong>{selectedJob.score || '-'}/5</strong> {selectedJob.recommendation || ''}</p>
                      <p>{selectedJob.score_reason || ''}</p>
                      {selectedJob.match_highlights?.length > 0 && (
                        <>
                          <label>匹配点</label>
                          <ul>{selectedJob.match_highlights.map((item, index) => <li key={index}>{item}</li>)}</ul>
                        </>
                      )}
                      {selectedJob.gaps?.length > 0 && (
                        <>
                          <label>风险/缺口</label>
                          <ul>{selectedJob.gaps.map((item, index) => <li key={index}>{item}</li>)}</ul>
                        </>
                      )}
                      {selectedJob.resume_strategy?.length > 0 && (
                        <>
                          <label>简历策略</label>
                          <ul>{selectedJob.resume_strategy.map((item, index) => <li key={index}>{item}</li>)}</ul>
                        </>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="modal-footer">
              {!selectedJob.raw_text && (
                <MagneticButton variant="primary" className="btn-sm" onClick={() => { handleExtract(selectedJob.id); setShowDetail(false); }}>
                  <ArrowsClockwise style={{ width: '14px', height: '14px', marginRight: '6px' }} />
                  提取详情
                </MagneticButton>
              )}
              <MagneticButton variant="secondary" className="btn-sm" onClick={() => setShowDetail(false)}>关闭</MagneticButton>
            </div>
          </div>
        </div>
      )}

      {showConfirmModal && (
        <div className="modal-overlay" onClick={() => setShowConfirmModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Warning style={{ width: '24px', height: '24px', color: 'var(--warning-color)' }} />
                <h3>确认批量删除</h3>
              </div>
              <button className="btn btn-close" onClick={() => setShowConfirmModal(false)}>×</button>
            </div>
            <div style={{ padding: '24px' }}>
              <p style={{ marginBottom: '12px' }}>
                您即将删除 <strong>{selectedIds.size}</strong> 个岗位。此操作无法撤销。
              </p>
              <p style={{ color: 'var(--danger-color)', fontSize: '13px' }}>
                删除后，这些岗位将被永久移除。
              </p>
            </div>
            <div className="modal-footer">
              <MagneticButton variant="secondary" className="btn-sm" onClick={() => setShowConfirmModal(false)}>取消</MagneticButton>
              <MagneticButton 
                variant="primary"
                className="btn-sm" 
                onClick={handleBatchDelete}
                disabled={isBatchDeleting}
              >
                {isBatchDeleting ? (
                  <>
                    <Spinner style={{ width: '14px', height: '14px', marginRight: '6px', animation: 'spin 1s linear infinite' }} />
                    删除中...
                  </>
                ) : (
                  <>
                    <Trash style={{ width: '14px', height: '14px', marginRight: '6px' }} />
                    确认删除
                  </>
                )}
              </MagneticButton>
            </div>
          </div>
        </div>
      )}
    </PageTransition>
  )
}
