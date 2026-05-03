import { useState, useEffect } from 'react'
import { ListChecks, Bell, PencilSimple, Trash, CheckSquare, Square, ArrowClockwise, EnvelopeSimple, CheckCircle, Warning, Flame, Snowflake, Clock, Funnel, PaperPlane } from '@phosphor-icons/react'
import { trackerAPI, jobsAPI, followupsAPI } from '../api'
import { showToast } from '../utils/toast'
import { PageTransition, LiquidSectionHeader, LiquidCard, MagneticButton } from '../components/LiquidMotion'

const TRACKER_STATUS_LABELS = {
  Evaluated: '已评估', Applied: '已投递', Responded: '已回复',
  Interview: '面试中', Offer: '已录取', Rejected: '已拒绝',
  Discarded: '已放弃', SKIP: '跳过'
}

const URGENCY_CONFIG = {
  urgent: { label: '紧急', color: 'var(--danger-color)', bg: 'var(--danger-tint)', icon: Flame },
  overdue: { label: '逾期', color: 'var(--warning-color)', bg: 'var(--warning-tint)', icon: Warning },
  waiting: { label: '等待中', color: 'var(--primary-color)', bg: 'var(--primary-tint)', icon: Clock },
  cold: { label: '已冷却', color: 'var(--text-secondary)', bg: 'var(--bg-secondary)', icon: Snowflake },
}

const FOLLOWUP_STATUS_LABELS = {
  applied: '已投递',
  responded: '已回复',
  interview: '面试中',
}

export default function Tracker({ onToast }) {
  const [activeTab, setActiveTab] = useState('tracker')

  // ── Tracker state ──
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

  // ── Followups state ──
  const [followups, setFollowups] = useState([])
  const [isFollowupsLoading, setIsFollowupsLoading] = useState(false)
  const [showMessageModal, setShowMessageModal] = useState(false)
  const [selectedFollowup, setSelectedFollowup] = useState(null)
  const [messageText, setMessageText] = useState('')
  const [filterUrgency, setFilterUrgency] = useState('all')

  useEffect(() => {
    fetchTracker()
  }, [])

  // ── Tracker handlers ──

  const fetchTracker = async () => {
    setIsLoading(true)
    try {
      const res = await trackerAPI.getAll()
      setTracker(res.data || [])
    } catch (error) {
      console.error('Tracker fetch error:', error)
      showToast(onToast, '加载投递记录失败', 'error')
    } finally { setIsLoading(false) }
  }

  const handleStatusChange = async (rowId, status) => {
    try {
      await trackerAPI.updateStatus(rowId, status)
      showToast(onToast, '状态已更新', 'success')
      fetchTracker()
    } catch (error) {
      showToast(onToast, `状态更新失败：${error?.message || '未知错误'}`, 'error')
    }
  }

  const handleNotesChange = async (rowId, notes) => {
    try {
      await trackerAPI.updateNotes(rowId, notes)
      showToast(onToast, '备注已更新', 'success')
      setEditingRow(null)
    } catch (error) {
      showToast(onToast, `备注更新失败：${error?.message || '未知错误'}`, 'error')
    }
  }

  const handleDelete = async (rowId) => {
    if (!confirm('确定要删除这条记录吗？')) return
    try {
      await trackerAPI.delete(rowId)
      showToast(onToast, '记录已删除', 'success')
      fetchTracker()
    } catch (error) {
      showToast(onToast, `删除失败：${error?.message || '未知错误'}`, 'error')
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
    } finally { setIsBatchDeleting(false) }
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

  // ── Followups handlers ──

  const fetchFollowups = async () => {
    setIsFollowupsLoading(true)
    try {
      const res = await followupsAPI.getAll()
      setFollowups(res.data || [])
    } catch (error) {
      console.error('Followups fetch error:', error)
      showToast(onToast, `加载跟进数据失败：${error?.message || '未知错误'}`, 'error')
    } finally { setIsFollowupsLoading(false) }
  }

  const switchToTab = (tab) => {
    setActiveTab(tab)
    if (tab === 'followups' && followups.length === 0) fetchFollowups()
  }

  const handleRefreshFollowups = async () => {
    try {
      await followupsAPI.refresh()
      await fetchFollowups()
      showToast(onToast, '跟进数据已刷新', 'success')
    } catch (error) {
      showToast(onToast, `刷新失败：${error?.message || '未知错误'}`, 'error')
    }
  }

  const handleMarkSent = async (id) => {
    try {
      await followupsAPI.markSent(id)
      showToast(onToast, '已标记为已跟进', 'success')
      fetchFollowups()
    } catch (error) {
      showToast(onToast, `标记失败：${error?.message || '未知错误'}`, 'error')
    }
  }

  const handleSendMessage = (followup) => {
    setSelectedFollowup(followup)
    setMessageText(`您好！\n\n我是${followup.role}岗位的候选人，想跟进一下我的申请进度。\n\n期待您的回复！`)
    setShowMessageModal(true)
  }

  const handleSend = async () => {
    try {
      await followupsAPI.sendMessage(selectedFollowup.id, messageText)
      showToast(onToast, '跟进消息已记录', 'success')
      setShowMessageModal(false)
      setSelectedFollowup(null)
      fetchFollowups()
    } catch (error) {
      showToast(onToast, `记录失败：${error?.message || '未知错误'}`, 'error')
    }
  }

  // ── Derived data ──

  const filteredTracker = tracker.filter(record => {
    if (filterStatus === 'all') return true
    return record.status === filterStatus
  })

  const statusOptions = ['Evaluated', 'Applied', 'Responded', 'Interview', 'Offer', 'Rejected', 'Discarded', 'SKIP']
  const statusFilterOptions = ['Applied', 'Interview', 'Offer', 'Rejected']

  const followupStats = {
    urgent: followups.filter(f => f.urgency === 'urgent').length,
    overdue: followups.filter(f => f.urgency === 'overdue').length,
    waiting: followups.filter(f => f.urgency === 'waiting').length,
    cold: followups.filter(f => f.urgency === 'cold').length,
  }

  const filteredFollowups = filterUrgency === 'all'
    ? followups
    : followups.filter(f => f.urgency === filterUrgency)

  const urgencyOrder = { urgent: 0, overdue: 1, waiting: 2, cold: 3 }
  const sortedFollowups = [...filteredFollowups].sort((a, b) =>
    (urgencyOrder[a.urgency] ?? 9) - (urgencyOrder[b.urgency] ?? 9)
  )

  if (isLoading && activeTab === 'tracker') {
    return (
      <PageTransition>
        <LiquidSectionHeader title="投递追踪" subtitle="跟踪你的求职进度与跟进" icon={ListChecks} />
        <div className="liquid-empty">
          <div className="liquid-spinner" style={{ margin: '0 auto' }}></div>
        </div>
      </PageTransition>
    )
  }

  return (
    <PageTransition>
      <LiquidSectionHeader title="投递" subtitle="投递追踪与跟进提醒" icon={ListChecks} />

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: '0', marginBottom: '16px' }}>
        <button
          onClick={() => switchToTab('tracker')}
          style={{
            padding: '10px 24px', border: 'none', background: activeTab === 'tracker' ? 'var(--primary-color)' : 'var(--bg-secondary)',
            color: activeTab === 'tracker' ? '#fff' : 'var(--text-secondary)', borderRadius: '8px 0 0 8px',
            cursor: 'pointer', fontSize: '14px', fontWeight: activeTab === 'tracker' ? 600 : 400, transition: 'all 0.2s'
          }}
        >
          <ListChecks style={{ width: '16px', height: '16px', marginRight: '6px', verticalAlign: 'middle' }} />
          投递记录
        </button>
        <button
          onClick={() => switchToTab('followups')}
          style={{
            padding: '10px 24px', border: 'none', background: activeTab === 'followups' ? 'var(--primary-color)' : 'var(--bg-secondary)',
            color: activeTab === 'followups' ? '#fff' : 'var(--text-secondary)', borderRadius: '0 8px 8px 0',
            cursor: 'pointer', fontSize: '14px', fontWeight: activeTab === 'followups' ? 600 : 400, transition: 'all 0.2s'
          }}
        >
          <Bell style={{ width: '16px', height: '16px', marginRight: '6px', verticalAlign: 'middle' }} />
          跟进提醒
          {followupStats.urgent > 0 && (
            <span style={{ marginLeft: '6px', padding: '1px 6px', borderRadius: '8px', fontSize: '11px', background: 'var(--danger-color)', color: '#fff' }}>{followupStats.urgent}</span>
          )}
        </button>
      </div>

      {/* ── Tracker Tab ── */}
      {activeTab === 'tracker' && (
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
                  <option key={opt} value={opt}>{TRACKER_STATUS_LABELS[opt] || opt}</option>
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
                    <select value={record.status} onChange={(e) => handleStatusChange(record.rowId, e.target.value)} className="form-control" style={{ minWidth: '90px' }}>
                      {statusOptions.map(option => (
                        <option key={option} value={option}>{TRACKER_STATUS_LABELS[option] || option}</option>
                      ))}
                    </select>
                  </td>
                  <td>{record.score || '-'}</td>
                  <td>{record.date}</td>
                  <td>
                    {editingRow === index ? (
                      <input type="text" className="form-control" value={editNotes} onChange={(e) => setEditNotes(e.target.value)}
                        onBlur={() => handleNotesChange(record.rowId, editNotes)}
                        onKeyDown={(e) => e.key === 'Enter' && handleNotesChange(record.rowId, editNotes)} autoFocus />
                    ) : (
                      <span className="editable" onClick={() => { setEditNotes(record.notes || ''); setEditingRow(index) }}>
                        {record.notes || '点击编辑'}
                      </span>
                    )}
                  </td>
                  <td>
                    {record.reportPath && (
                      <MagneticButton variant="secondary" className="btn-sm" onClick={() => handleShowReport(record)} title="查看AI评估报告">报告</MagneticButton>
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
      )}

      {activeTab === 'followups' && (
        <>
          <div className="liquid-stats-grid" style={{ marginBottom: '16px' }}>
            {Object.entries(URGENCY_CONFIG).map(([key, cfg]) => {
              const Icon = cfg.icon
              return (
                <LiquidCard key={key} delay={0}>
                  <div
                    style={{
                      background: cfg.bg, borderRadius: '12px', padding: '14px 16px',
                      border: `1px solid ${cfg.color}22`, cursor: 'pointer',
                      outline: filterUrgency === key ? `2px solid ${cfg.color}` : 'none',
                      transition: 'all 0.3s ease'
                    }}
                    onClick={() => setFilterUrgency(filterUrgency === key ? 'all' : key)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <Icon style={{ width: '16px', height: '16px', color: cfg.color }} />
                      <span style={{ fontSize: '13px', fontWeight: 600, color: cfg.color }}>{cfg.label}</span>
                    </div>
                    <div style={{ fontSize: '22px', fontWeight: 'bold', color: cfg.color }}>{followupStats[key]}</div>
                  </div>
                </LiquidCard>
              )
            })}
          </div>

          <LiquidCard>
            <div className="card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Funnel style={{ width: '14px', height: '14px', color: 'var(--text-muted)' }} />
                <select value={filterUrgency} onChange={(e) => setFilterUrgency(e.target.value)} className="form-control" style={{ width: '120px' }}>
                  <option value="all">全部</option>
                  <option value="urgent">紧急</option>
                  <option value="overdue">逾期</option>
                  <option value="waiting">等待中</option>
                  <option value="cold">已冷却</option>
                </select>
              </div>
              <MagneticButton variant="secondary" className="btn-sm" onClick={handleRefreshFollowups}>
                <ArrowClockwise style={{ width: '14px', height: '14px', marginRight: '6px' }} />
                刷新
              </MagneticButton>
            </div>

            <table className="table">
              <thead>
                <tr>
                  <th>公司</th>
                  <th>岗位</th>
                  <th>投递状态</th>
                  <th>已跟进</th>
                  <th>投后天数</th>
                  <th>下次跟进</th>
                  <th>紧急度</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {sortedFollowups.map((followup) => {
                  const uCfg = URGENCY_CONFIG[followup.urgency] || URGENCY_CONFIG.waiting
                  const UrgencyIcon = uCfg.icon
                  return (
                    <tr key={followup.id} className="liquid-table-row">
                      <td style={{ fontWeight: 500 }}>{followup.company}</td>
                      <td>{followup.role}</td>
                      <td>
                        <span className="tag" style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
                          {FOLLOWUP_STATUS_LABELS[followup.last_status] || followup.last_status}
                        </span>
                      </td>
                      <td>{followup.followup_count ?? 0} 次</td>
                      <td>{followup.days_since_application ?? '-'} 天</td>
                      <td style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{followup.next_followup_date || '-'}</td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '10px', fontSize: '12px', fontWeight: 600, background: uCfg.bg, color: uCfg.color }}>
                          <UrgencyIcon style={{ width: '12px', height: '12px' }} />
                          {uCfg.label}
                        </span>
                      </td>
                      <td>
                        {followup.urgency !== 'cold' && (
                          <>
                            <MagneticButton variant="secondary" className="btn-sm" onClick={() => handleSendMessage(followup)} title="记录跟进消息">
                              <EnvelopeSimple style={{ width: '14px', height: '14px' }} />
                            </MagneticButton>
                            <MagneticButton variant="primary" className="btn-sm" onClick={() => handleMarkSent(followup.id)} title="标记已跟进">
                              <CheckCircle style={{ width: '14px', height: '14px' }} />
                            </MagneticButton>
                          </>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {followups.length === 0 && !isFollowupsLoading && (
              <div className="liquid-empty">
                <Bell size={32} />
                <p>暂无跟进任务</p>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>请先在「投递记录」中添加投递记录</p>
              </div>
            )}
            {followups.length > 0 && sortedFollowups.length === 0 && (
              <div className="liquid-empty">
                <Funnel size={32} />
                <p>当前筛选无结果</p>
              </div>
            )}
          </LiquidCard>
        </>
      )}

      {/* ── Modals ── */}
      {showReportModal && (
        <div className="modal-overlay" onClick={() => setShowReportModal(false)}>
          <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ margin: 0 }}>{reportTitle}</h3>
              <MagneticButton variant="secondary" className="btn-sm" onClick={() => setShowReportModal(false)}>关闭</MagneticButton>
            </div>
            <div className="modal-body-scroll">
              {!reportJob && <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>加载中...</div>}
              {reportJob && (!reportJob.score && !reportJob.score_reason) && (
                <div style={{ padding: '12px', background: 'var(--warning-tint)', borderRadius: '6px', fontSize: '13px', color: 'var(--danger-color)' }}>该岗位尚未进行 AI 评分</div>
              )}
              {reportJob && (reportJob.score || reportJob.score_reason) && (
                <div className="evaluation-panel">
                  <h4>AI 评分结果</h4>
                  <p><strong>{reportJob.score || '-'}/5</strong> {reportJob.recommendation || ''}</p>
                  <p>{reportJob.score_reason || ''}</p>
                  {reportJob.match_highlights?.length > 0 && (
                    <><label>匹配点</label><ul>{reportJob.match_highlights.map((item, i) => <li key={i}>{item}</li>)}</ul></>
                  )}
                  {reportJob.gaps?.length > 0 && (
                    <><label>风险/缺口</label><ul>{reportJob.gaps.map((item, i) => <li key={i}>{item}</li>)}</ul></>
                  )}
                  {reportJob.resume_strategy?.length > 0 && (
                    <><label>简历策略</label><ul>{reportJob.resume_strategy.map((item, i) => <li key={i}>{item}</li>)}</ul></>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showMessageModal && selectedFollowup && (
        <div className="modal-overlay" onClick={() => setShowMessageModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>记录跟进消息</h3>
              <button className="btn btn-close" onClick={() => setShowMessageModal(false)}>×</button>
            </div>
            <div className="form-group">
              <label>公司</label>
              <input type="text" className="form-control" value={selectedFollowup.company} readOnly />
            </div>
            <div className="form-group">
              <label>岗位</label>
              <input type="text" className="form-control" value={selectedFollowup.role} readOnly />
            </div>
            <div className="form-group">
              <label>跟进内容</label>
              <textarea className="form-control" rows="6" value={messageText} onChange={(e) => setMessageText(e.target.value)} placeholder="记录你的跟进内容..." />
            </div>
            <div className="modal-footer">
              <MagneticButton variant="secondary" onClick={() => setShowMessageModal(false)}>取消</MagneticButton>
              <MagneticButton variant="primary" onClick={handleSend} disabled={!messageText.trim()}>
                <PaperPlane style={{ width: '14px', height: '14px', marginRight: '6px' }} />
                记录跟进
              </MagneticButton>
            </div>
          </div>
        </div>
      )}
    </PageTransition>
  )
}
