import { useState, useEffect, useMemo, useCallback } from 'react'
import { FileText, RefreshCw, Trash2, Eye, ExternalLink, CheckCircle, AlertTriangle, Search, CheckSquare, Square, Loader2, Plus } from 'lucide-react'
import { aiAPI, jobsAPI } from '../api'
import { showToast } from '../utils/toast'

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
      evaluate: 'AI 评分'
    }
    setBatchAction(action)
    let success = 0
    let failed = 0

    try {
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

  const filteredJobs = useMemo(() => {
    if (!searchCompany.trim()) return jobs
    const keyword = searchCompany.trim().toLowerCase()
    return jobs.filter(j => (j.company || '').toLowerCase().includes(keyword))
  }, [jobs, searchCompany])

  const companyTypeLabel = (job) => {
    return job.enterprise_type || job.company_type || job.type || job.parsed?.enterprise_type || job.parsed?.company_type || '-'
  }

  const batchButtonLabel = (action, label) => {
    return batchAction === action ? '处理中...' : `${label} (${selectedIds.size})`
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
      <div className="page-header">
        <h2>岗位列表</h2>
        <div className="empty-state">
          <div className="spinner" style={{ margin: '0 auto' }}></div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="page-header">
        <h2>岗位列表</h2>
        <p>管理已发现的岗位</p>
      </div>

      <div className="card">
        <div className="card-header">
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="form-control" style={{ width: '140px' }}>
              <option value="all">全部状态</option>
              <option value="active">有效</option>
              <option value="closed">已关闭</option>
              <option value="unconfirmed">未确认</option>
            </select>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                className="form-control"
                placeholder="搜索公司名..."
                value={searchCompany}
                onChange={(e) => setSearchCompany(e.target.value)}
                style={{ width: '180px', paddingRight: '30px' }}
              />
              <Search style={{ position: 'absolute', right: '8px', width: '14px', height: '14px', color: '#94a3b8' }} />
            </div>
          </div>
          <div className="btn-group">
            <button
              className="btn btn-secondary"
              onClick={handleSelectAll}
              disabled={filteredJobs.length === 0 || Boolean(batchAction)}
              title="选择或取消选择当前筛选结果"
            >
              {selectedIds.size === filteredJobs.length && filteredJobs.length > 0 ? (
                <CheckSquare style={{ width: '14px', height: '14px', marginRight: '6px' }} />
              ) : (
                <Square style={{ width: '14px', height: '14px', marginRight: '6px' }} />
              )}
              全选当前列表
            </button>
            {selectedIds.size > 0 && (
              <>
                <button
                  className="btn btn-secondary"
                  onClick={() => handleBatchAction('liveness')}
                  disabled={Boolean(batchAction) || isBatchDeleting}
                  title="批量检查选中岗位有效性"
                >
                  {batchAction === 'liveness' ? (
                    <Loader2 style={{ width: '14px', height: '14px', marginRight: '6px', animation: 'spin 1s linear infinite' }} />
                  ) : (
                    <CheckCircle style={{ width: '14px', height: '14px', marginRight: '6px' }} />
                  )}
                  {batchButtonLabel('liveness', '批量检查')}
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => handleBatchAction('extract')}
                  disabled={Boolean(batchAction) || isBatchDeleting}
                  title="批量提取选中岗位详情"
                >
                  {batchAction === 'extract' ? (
                    <Loader2 style={{ width: '14px', height: '14px', marginRight: '6px', animation: 'spin 1s linear infinite' }} />
                  ) : (
                    <RefreshCw style={{ width: '14px', height: '14px', marginRight: '6px' }} />
                  )}
                  {batchButtonLabel('extract', '批量提取')}
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => handleBatchAction('evaluate')}
                  disabled={Boolean(batchAction) || isBatchDeleting}
                  title="批量 AI 评分选中岗位"
                >
                  {batchAction === 'evaluate' ? (
                    <Loader2 style={{ width: '14px', height: '14px', marginRight: '6px', animation: 'spin 1s linear infinite' }} />
                  ) : (
                    <FileText style={{ width: '14px', height: '14px', marginRight: '6px' }} />
                  )}
                  {batchButtonLabel('evaluate', '批量评分')}
                </button>
                <button 
                  className="btn btn-danger" 
                  onClick={() => setShowConfirmModal(true)}
                  disabled={isBatchDeleting || Boolean(batchAction)}
                  style={{ marginRight: '8px' }}
                >
                  {isBatchDeleting ? (
                    <>
                      <Loader2 style={{ width: '14px', height: '14px', marginRight: '6px', animation: 'spin 1s linear infinite' }} />
                      删除中...
                    </>
                  ) : (
                    <>
                      <Trash2 style={{ width: '14px', height: '14px', marginRight: '6px' }} />
                      批量删除 ({selectedIds.size})
                    </>
                  )}
                </button>
              </>
            )}
            <select value={selectedProvider} onChange={(e) => setSelectedProvider(e.target.value)} className="form-control" style={{ width: '220px' }}>
              {providers.length === 0 && <option value="deepseek">DeepSeek</option>}
              {providers.map(provider => (
                <option key={provider.id} value={provider.id}>
                  {provider.label} {provider.configured ? `(${provider.model})` : '(未配置 Key)'}
                </option>
              ))}
            </select>
            <button className="btn btn-secondary" onClick={handleValidate} title="校验岗位数据完整性">
              <AlertTriangle style={{ width: '14px', height: '14px', marginRight: '6px' }} />
              数据校验
            </button>
          </div>
        </div>

        {validationResult && validationResult.issueCount > 0 && (
          <div style={{ padding: '12px 24px', background: '#fef3c7', borderBottom: '1px solid #fde68a', fontSize: '13px', color: '#92400e' }}>
            <AlertTriangle style={{ width: '14px', height: '14px', marginRight: '6px', verticalAlign: 'middle' }} />
            发现 {validationResult.issueCount} 条数据问题：
            {validationResult.issues.slice(0, 5).map((issue, i) => (
              <span key={issue.id} style={{ marginLeft: '8px' }}>
                {issue.company || issue.title || issue.id}({issue.problems.join(', ')})
                {i < Math.min(validationResult.issues.length, 5) - 1 ? ';' : ''}
              </span>
            ))}
            {validationResult.issues.length > 5 && <span> 等 {validationResult.issues.length} 条</span>}
            <button onClick={() => setValidationResult(null)} style={{ marginLeft: '12px', background: 'none', border: 'none', cursor: 'pointer', color: '#92400e' }}>关闭</button>
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
                    <CheckSquare style={{ width: '18px', height: '18px', color: '#2563eb' }} />
                  ) : (
                    <Square style={{ width: '18px', height: '18px', color: '#94a3b8' }} />
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
            {filteredJobs.map((job) => (
              <tr 
                key={job.id} 
                className={selectedIds.has(job.id) ? 'selected-row' : ''}
              >
                <td>
                  <button 
                    className="btn btn-link p-0" 
                    onClick={() => handleSelectOne(job.id)}
                  >
                    {selectedIds.has(job.id) ? (
                      <CheckSquare style={{ width: '16px', height: '16px', color: '#2563eb' }} />
                    ) : (
                      <Square style={{ width: '16px', height: '16px', color: '#cbd5e1' }} />
                    )}
                  </button>
                </td>
                <td>{job.company || <span style={{ color: '#dc2626' }}>缺失</span>}</td>
                <td>{job.title || <span style={{ color: '#dc2626' }}>缺失</span>}</td>
                <td>{companyTypeLabel(job)}</td>
                <td>{job.job_level || job.experience || job.parsed?.job_level || '-'}</td>
                <td>{job.salary || '-'}</td>
                <td>{job.location || '-'}</td>
                <td style={{ fontSize: '12px', color: '#64748b' }}>{job.discovered_at ? new Date(job.discovered_at).toLocaleDateString('zh-CN') : '-'}</td>
                <td>
                  <span className={`status-badge ${statusClass(job.liveness_status)}`}>
                    {statusLabel(job.liveness_status)}
                  </span>
                </td>
                <td>
                  {job.score ? (
                    <div>
                      <strong>{job.score}/5</strong>
                      {job.recommendation && <div style={{ color: '#64748b', fontSize: '12px' }}>{job.recommendation}</div>}
                    </div>
                  ) : '-'}
                </td>
                <td>
                  <button className="btn btn-secondary btn-sm" onClick={() => handleViewDetail(job)} title="查看详情">
                    <Eye style={{ width: '14px', height: '14px' }} />
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => handleLiveness(job.id)} title="检查有效性">
                    <CheckCircle style={{ width: '14px', height: '14px' }} />
                  </button>
                  <button className="btn btn-primary btn-sm" onClick={() => handleExtract(job.id)} title="提取岗位详情">
                    <RefreshCw style={{ width: '14px', height: '14px' }} />
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => handleEvaluate(job.id)} disabled={evaluatingId === job.id} title="AI 评分">
                    <FileText style={{ width: '14px', height: '14px' }} />
                    {evaluatingId === job.id ? '评分中' : ''}
                  </button>
                  <button className="btn btn-success btn-sm" onClick={() => handleAddToTracker(job)} title="添加到投递追踪">
                    <Plus style={{ width: '14px', height: '14px' }} />
                  </button>
                  <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDelete(job.id)} title="删除">
                    <Trash2 style={{ width: '14px', height: '14px' }} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredJobs.length === 0 && (
          <div className="empty-state">
            <FileText />
            <p>暂无岗位数据</p>
          </div>
        )}
      </div>

      {showDetail && selectedJob && (
        <div className="modal-overlay" onClick={() => setShowDetail(false)}>
          <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{selectedJob.title || '岗位详情'}</h3>
              <button className="btn btn-close" onClick={() => setShowDetail(false)}>×</button>
            </div>
            <div className="modal-body-scroll">
              {isLoadingDetail ? (
                <div style={{ padding: '24px', textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }}></div></div>
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
                        {selectedJob.liveness_reason && <span style={{ marginLeft: '8px', fontSize: '12px', color: '#64748b' }}>{selectedJob.liveness_reason}</span>}
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
                        <ExternalLink style={{ width: '14px', height: '14px' }} />
                      </a>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={handleSaveUrl}
                        disabled={isSavingUrl || !editableUrl.trim() || editableUrl === selectedJob.url}
                      >
                        {isSavingUrl ? '保存中...' : '保存 URL'}
                      </button>
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
                      <div style={{ marginTop: '6px', fontSize: '12px', color: '#64748b' }}>
                        置信度：{selectedJob.ai_jd_confidence || '-'} · 模型：{selectedJob.ai_jd_model || '-'}
                        {selectedJob.ai_jd_liveness_status ? ` · 状态判断：${selectedJob.ai_jd_liveness_status}` : ''}
                      </div>
                      {selectedJob.ai_jd_warnings?.length > 0 && (
                        <ul style={{ margin: '6px 0 0 16px', padding: 0, fontSize: '12px', color: '#92400e' }}>
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
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={handleSaveManualJd}
                      disabled={isSavingManualJd || !manualJdText.trim()}
                      style={{ marginTop: '8px' }}
                    >
                      {isSavingManualJd ? '保存中...' : '保存岗位描述'}
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleOptimizeJd(selectedJob.id)}
                      disabled={optimizingId === selectedJob.id || (!selectedJob.raw_text && !selectedJob.description)}
                      style={{ marginTop: '8px', marginLeft: '8px' }}
                    >
                      {optimizingId === selectedJob.id ? '优化中...' : 'AI 优化JD'}
                    </button>
                  </div>
                  {!selectedJob.raw_text && !selectedJob.description && !selectedJob.parsed && (
                    <div style={{ padding: '12px', background: '#fef3c7', borderRadius: '6px', fontSize: '13px', color: '#94000e', marginBottom: '12px' }}>
                      <AlertTriangle style={{ width: '14px', height: '14px', marginRight: '6px', verticalAlign: 'middle' }} />
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
                <button className="btn btn-primary" onClick={() => { handleExtract(selectedJob.id); setShowDetail(false); }}>
                  <RefreshCw style={{ width: '14px', height: '14px', marginRight: '6px' }} />
                  提取详情
                </button>
              )}
              <button className="btn btn-secondary" onClick={() => setShowDetail(false)}>关闭</button>
            </div>
          </div>
        </div>
      )}

      {showConfirmModal && (
        <div className="modal-overlay" onClick={() => setShowConfirmModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <AlertTriangle style={{ width: '24px', height: '24px', color: '#f59e0b' }} />
                <h3>确认批量删除</h3>
              </div>
              <button className="btn btn-close" onClick={() => setShowConfirmModal(false)}>×</button>
            </div>
            <div style={{ padding: '24px' }}>
              <p style={{ marginBottom: '12px' }}>
                您即将删除 <strong>{selectedIds.size}</strong> 个岗位。此操作无法撤销。
              </p>
              <p style={{ color: '#dc2626', fontSize: '13px' }}>
                删除后，这些岗位将从岗位列表中永久移除。
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowConfirmModal(false)}>取消</button>
              <button 
                className="btn btn-danger" 
                onClick={handleBatchDelete}
                disabled={isBatchDeleting}
              >
                {isBatchDeleting ? (
                  <>
                    <Loader2 style={{ width: '14px', height: '14px', marginRight: '6px', animation: 'spin 1s linear infinite' }} />
                    删除中...
                  </>
                ) : (
                  <>
                    <Trash2 style={{ width: '14px', height: '14px', marginRight: '6px' }} />
                    确认删除
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
