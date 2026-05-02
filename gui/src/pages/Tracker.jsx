import { useState, useEffect } from 'react'
import { ListChecks, PencilSimple, Trash, FileText, Clock, CheckCircle, CheckSquare, Square } from '@phosphor-icons/react'
import { trackerAPI, jobsAPI } from '../api'
import { showToast } from '../utils/toast'
import { PageTransition, LiquidSectionHeader, LiquidCard, MagneticButton } from '../components/LiquidMotion'
import '../styles/liquid-motion.css'

const STATUS_LABELS = {
  Evaluated: '已评估', Applied: '已投递', Responded: '已回复',
  Interview: '面试中', Offer: '已录取', Rejected: '已拒绝',
  Discarded: '已放弃', SKIP: '跳过'
}

export default function Tracker({ onToast }) {
  const [tracker, setTracker] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('all')
  const [editingRow, setEditingRow] = useState(null)
  const [editNotes, setEditNotes] = useState('')
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [isBatchDeleting, setIsBatchDeleting] = useState(false)
  const [showReportModal, setShowReportModal] = useState(false)
  const [reportJob, setReportJob] = useState(null)
  const [reportTitle, setReportTitle] = useState('')

  useEffect(() => {
    fetchTracker()
  }, [])

  const fetchTracker = async () => {
    setIsLoading(true)
    try {
      const res = await trackerAPI.getAll()
      setTracker(res.data || [])
    } catch (error) {
      console.error('Tracker fetch error:', error)
      showToast(onToast, '加载投递记录失败', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const handleStatusChange = async (rowId, status) => {
    try {
      await trackerAPI.updateStatus(rowId, status)
      showToast(onToast, '状态已更新', 'success')
      fetchTracker()
    } catch (error) {
      showToast(onToast, `状态更新失败：${error?.response?.data?.error || error?.message || '未知错误'}`, 'error')
    }
  }

  const handleNotesChange = async (rowId, notes) => {
    try {
      await trackerAPI.updateNotes(rowId, notes)
      showToast(onToast, '备注已更新', 'success')
      setEditingRow(null)
    } catch (error) {
      showToast(onToast, `备注更新失败：${error?.response?.data?.error || error?.message || '未知错误'}`, 'error')
    }
  }

  const handleAddFromJobs = async (jobId) => {
    try {
      await jobsAPI.addToTracker(jobId)
      showToast(onToast, '已添加到投递追踪', 'success')
      fetchTracker()
    } catch (error) {
      showToast(onToast, `添加失败：${error?.response?.data?.error || error?.message || '未知错误'}`, 'error')
    }
  }

  const handleDelete = async (rowId) => {
    if (!confirm('确定要删除这条记录吗？')) return
    try {
      await trackerAPI.delete(rowId)
      showToast(onToast, '记录已删除', 'success')
      fetchTracker()
    } catch (error) {
      showToast(onToast, `删除失败：${error?.response?.data?.error || error?.message || '未知错误'}`, 'error')
    }
  }

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return
    if (!confirm(`确定要删除选中的 ${selectedIds.size} 条记录吗？`)) return
    setIsBatchDeleting(true)
    try {
      const rowIds = Array.from(selectedIds).sort((a, b) => b - a)
      for (const rowId of rowIds) {
        await trackerAPI.delete(rowId)
      }
      showToast(onToast, `已删除 ${selectedIds.size} 条记录`, 'success')
      setSelectedIds(new Set())
      fetchTracker()
    } catch (error) {
      showToast(onToast, `批量删除失败：${error.message}`, 'error')
    } finally {
      setIsBatchDeleting(false)
    }
  }

  const toggleSelect = (rowId) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(rowId)) next.delete(rowId)
      else next.add(rowId)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredTracker.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredTracker.map(record => record.rowId)))
    }
  }

  const handleShowReport = async (record) => {
    setReportTitle(`${record.company} - ${record.role} 评估报告`)
    setReportJob(null)
    setShowReportModal(true)
    try {
      const res = await fetch(`/api/tracker/evaluation?company=${encodeURIComponent(record.company)}&role=${encodeURIComponent(record.role)}`)
      const json = await res.json()
      if (json.success && json.data) {
        setReportJob(json.data)
      } else {
        setReportJob({ score: record.score })
      }
    } catch {
      setReportJob({ score: record.score })
    }
  }

  const filteredTracker = tracker.filter(record => {
    if (filterStatus === 'all') return true
    return record.status === filterStatus
  })

  const statusOptions = ['Evaluated', 'Applied', 'Responded', 'Interview', 'Offer', 'Rejected', 'Discarded', 'SKIP']
  const statusFilterOptions = ['Applied', 'Interview', 'Offer', 'Rejected']

  if (isLoading) {
    return (
      <PageTransition>
        <LiquidSectionHeader title="投递追踪" subtitle="跟踪你的求职进度" icon={ListChecks} />
        <div className="liquid-empty">
          <div className="liquid-spinner" style={{ margin: '0 auto' }}></div>
        </div>
      </PageTransition>
    )
  }

  return (
    <PageTransition>
      <LiquidSectionHeader title="投递追踪" subtitle="跟踪你的求职进度" icon={ListChecks} />

      <LiquidCard>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {selectedIds.size > 0 && (
              <>
                <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>已选 {selectedIds.size} 项</span>
                <MagneticButton variant="primary" className="btn-sm" onClick={handleBatchDelete} disabled={isBatchDeleting}>
                  <Trash style={{ width: '14px', height: '14px', marginRight: '4px' }} />
                  批量删除{isBatchDeleting ? '中...' : ''}
                </MagneticButton>
              </>
            )}
          </div>
          <div className="filter-group">
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="form-control">
              <option value="all">全部</option>
              {statusFilterOptions.map(opt => (
                <option key={opt} value={opt}>{STATUS_LABELS[opt] || opt}</option>
              ))}
            </select>
          </div>
        </div>

        <table className="table">
          <thead>
            <tr>
              <th style={{ width: '36px' }}>
                {filteredTracker.length > 0 && (
                  <button onClick={toggleSelectAll} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                    {selectedIds.size === filteredTracker.length ? <CheckSquare size={16} /> : <Square size={16} />}
                  </button>
                )}
              </th>
              <th>公司</th>
              <th>岗位</th>
              <th>状态</th>
              <th>评分</th>
              <th>日期</th>
              <th>备注</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredTracker.map((record, index) => (
              <tr key={record.rowId} className="liquid-table-row">
                <td>
                  <button onClick={() => toggleSelect(record.rowId)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                    {selectedIds.has(record.rowId) ? <CheckSquare size={16} /> : <Square size={16} />}
                  </button>
                </td>
                <td>{record.company}</td>
                <td>{record.role}</td>
                <td>
                  <select
                    value={record.status}
                    onChange={(e) => handleStatusChange(record.rowId, e.target.value)}
                    className="form-control"
                    style={{ minWidth: '90px' }}
                  >
                    {statusOptions.map(option => (
                      <option key={option} value={option}>{STATUS_LABELS[option] || option}</option>
                    ))}
                  </select>
                </td>
                <td>{record.score || '-'}</td>
                <td>{record.date}</td>
                <td>
                  {editingRow === index ? (
                    <input 
                      type="text" 
                      className="form-control" 
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      onBlur={() => handleNotesChange(record.rowId, editNotes)}
                      onKeyDown={(e) => e.key === 'Enter' && handleNotesChange(record.rowId, editNotes)}
                      autoFocus
                    />
                  ) : (
                    <span 
                      className="editable" 
                      onClick={() => {
                        setEditNotes(record.notes || '')
                        setEditingRow(index)
                      }}
                    >
                      {record.notes || '点击编辑'}
                    </span>
                  )}
                </td>
                <td>
                  {record.reportPath && (
                    <MagneticButton variant="secondary" className="btn-sm" onClick={() => handleShowReport(record)} title="查看AI评估报告">
                      报告
                    </MagneticButton>
                  )}
                  <MagneticButton variant="primary" className="btn-sm" onClick={() => handleDelete(record.rowId)} title="删除记录">
                    <Trash style={{ width: '14px', height: '14px' }} />
                  </MagneticButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredTracker.length === 0 && (
          <div className="liquid-empty">
            <ListChecks size={32} />
            <p>暂无投递记录</p>
          </div>
        )}
      </LiquidCard>

      {showReportModal && (
        <div className="modal-overlay" onClick={() => setShowReportModal(false)}>
          <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ margin: 0 }}>{reportTitle}</h3>
              <MagneticButton variant="secondary" className="btn-sm" onClick={() => setShowReportModal(false)}>关闭</MagneticButton>
            </div>
            <div className="modal-body-scroll">
              {!reportJob && (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>加载中...</div>
              )}
              {reportJob && (!reportJob.score && !reportJob.score_reason) && (
                <div style={{ padding: '12px', background: 'var(--warning-tint)', borderRadius: '6px', fontSize: '13px', color: 'var(--danger-color)' }}>
                  该岗位尚未进行 AI 评分
                </div>
              )}
              {reportJob && (reportJob.score || reportJob.score_reason) && (
                <div className="evaluation-panel">
                  <h4>AI 评分结果</h4>
                  <p><strong>{reportJob.score || '-'}/5</strong> {reportJob.recommendation || ''}</p>
                  <p>{reportJob.score_reason || ''}</p>
                  {reportJob.match_highlights?.length > 0 && (
                    <>
                      <label>匹配点</label>
                      <ul>{reportJob.match_highlights.map((item, index) => <li key={index}>{item}</li>)}</ul>
                    </>
                  )}
                  {reportJob.gaps?.length > 0 && (
                    <>
                      <label>风险/缺口</label>
                      <ul>{reportJob.gaps.map((item, index) => <li key={index}>{item}</li>)}</ul>
                    </>
                  )}
                  {reportJob.resume_strategy?.length > 0 && (
                    <>
                      <label>简历策略</label>
                      <ul>{reportJob.resume_strategy.map((item, index) => <li key={index}>{item}</li>)}</ul>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </PageTransition>
  )
}
