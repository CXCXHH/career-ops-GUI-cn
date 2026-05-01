import { useEffect, useState } from 'react'
import { Trash2, ArrowUpCircle, CheckSquare, Square, ExternalLink } from 'lucide-react'
import { candidatesAPI, jobsAPI } from '../api'
import { showToast } from '../utils/toast'

export default function Candidates({ onToast }) {
  const [candidates, setCandidates] = useState([])
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [isLoading, setIsLoading] = useState(true)

  const refreshData = async () => {
    setIsLoading(true)
    try {
      const res = await candidatesAPI.getAll()
      setCandidates(res.data || [])
    } catch (error) {
      console.error('[Candidates] 加载失败:', error)
      showToast(onToast, `加载候选区失败：${error.message}`, 'error')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { refreshData() }, [])

  const toggleSelect = (id) => {
    const next = new Set(selectedIds)
    next.has(id) ? next.delete(id) : next.add(id)
    setSelectedIds(next)
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === candidates.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(candidates.map(c => c.id)))
    }
  }

  const handlePromote = async (id) => {
    try {
      await candidatesAPI.promote(id)
      showToast(onToast, '已确认进入正式岗位列表', 'success')
      await refreshData()
    } catch (error) {
      showToast(onToast, `操作失败：${error.message}`, 'error')
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('确定删除此候选岗位？')) return
    try {
      await candidatesAPI.delete(id)
      showToast(onToast, '已删除', 'success')
      await refreshData()
      setSelectedIds(prev => { const next = new Set(prev); next.delete(id); return next })
    } catch (error) {
      showToast(onToast, `删除失败：${error.message}`, 'error')
    }
  }

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) { showToast(onToast, '请先勾选', 'error'); return }
    if (!confirm(`确定删除 ${selectedIds.size} 个候选岗位？`)) return
    try {
      await candidatesAPI.batchDelete([...selectedIds])
      showToast(onToast, `已删除 ${selectedIds.size} 个`, 'success')
      setSelectedIds(new Set())
      await refreshData()
    } catch (error) {
      showToast(onToast, `批量删除失败：${error.message}`, 'error')
    }
  }

  const handleBatchPromote = async () => {
    if (selectedIds.size === 0) { showToast(onToast, '请先勾选', 'error'); return }
    if (!confirm(`确认将 ${selectedIds.size} 个候选岗位移入正式列表？`)) return
    try {
      let promoted = 0
      for (const id of selectedIds) {
        try { await candidatesAPI.promote(id); promoted++ } catch (e) { /* skip duplicates */ }
      }
      showToast(onToast, `已确认 ${promoted} 个岗位`, 'success')
      setSelectedIds(new Set())
      await refreshData()
    } catch (error) {
      showToast(onToast, `操作失败：${error.message}`, 'error')
    }
  }

  if (isLoading) {
    return (
      <div className="page-header">
        <h2>候选区</h2>
        <div className="empty-state"><div className="spinner" style={{ margin: '0 auto' }}></div></div>
      </div>
    )
  }

  return (
    <>
      <div className="page-header">
        <h2>候选区</h2>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
          低置信或待验证的岗位，确认后可移入正式岗位列表
        </p>
      </div>

      {candidates.length > 0 && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <button className="btn btn-secondary" onClick={handleBatchPromote} disabled={selectedIds.size === 0}>
            <ArrowUpCircle style={{ width: '14px', height: '14px', marginRight: '6px' }} />
            确认入选 ({selectedIds.size})
          </button>
          <button className="btn btn-danger" onClick={handleBatchDelete} disabled={selectedIds.size === 0}>
            <Trash2 style={{ width: '14px', height: '14px', marginRight: '6px' }} />
            批量删除 ({selectedIds.size})
          </button>
        </div>
      )}

      {candidates.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <p>候选区为空</p>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              导入 JSON 时，validation_status 为 blocked/unverified_low_priority 的岗位会进入候选区；expired/dead 会被拒绝
            </p>
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: '36px' }}>
                  <span onClick={toggleSelectAll} style={{ cursor: 'pointer' }}>
                    {selectedIds.size === candidates.length ? <CheckSquare size={16} /> : <Square size={16} />}
                  </span>
                </th>
                <th>岗位</th>
                <th>公司</th>
                <th>验证状态</th>
                <th>原因</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map(c => (
                <tr key={c.id}>
                  <td>
                    <span onClick={() => toggleSelect(c.id)} style={{ cursor: 'pointer' }}>
                      {selectedIds.has(c.id) ? <CheckSquare size={16} /> : <Square size={16} />}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {c.url ? (
                        <a href={c.url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink size={12} />
                        </a>
                      ) : null}
                      <span>{c.title || '无标题'}</span>
                    </div>
                  </td>
                  <td>{c.company}</td>
                  <td>
                    <span className={`badge ${
                      c.validation_status === 'expired' || c.validation_status === 'dead' ? 'badge-error' :
                      c.validation_status === 'blocked' ? 'badge-warning' :
                      'badge-info'
                    }`}>
                      {c.validation_status || '未标注'}
                    </span>
                  </td>
                  <td style={{ fontSize: '12px', color: 'var(--text-secondary)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.candidate_reason || c.liveness_reason || ''}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button className="btn btn-sm btn-success" onClick={() => handlePromote(c.id)} title="确认入选">
                        <ArrowUpCircle size={14} />
                      </button>
                      <button className="btn btn-sm btn-danger" onClick={() => handleDelete(c.id)} title="删除">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
