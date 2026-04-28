import { useState, useEffect, useRef } from 'react'
import { Bell, RefreshCw, Send, Clock, Mail, CheckCircle, AlertTriangle, Flame, Snowflake, Filter } from 'lucide-react'
import { followupsAPI } from '../api'
import { showToast } from '../utils/toast'

const URGENCY_CONFIG = {
  urgent: { label: '紧急', color: '#dc2626', bg: '#fef2f2', icon: Flame },
  overdue: { label: '逾期', color: '#d97706', bg: '#fffbeb', icon: AlertTriangle },
  waiting: { label: '等待中', color: '#2563eb', bg: '#eff6ff', icon: Clock },
  cold: { label: '已冷却', color: '#64748b', bg: '#f1f5f9', icon: Snowflake },
}

const STATUS_LABELS = {
  applied: '已投递',
  responded: '已回复',
  interview: '面试中',
}

export default function Followups({ onToast }) {
  const [followups, setFollowups] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [showMessageModal, setShowMessageModal] = useState(false)
  const [selectedFollowup, setSelectedFollowup] = useState(null)
  const [messageText, setMessageText] = useState('')
  const [filterUrgency, setFilterUrgency] = useState('all')

  useEffect(() => {
    fetchFollowups()
  }, [])

  const fetchFollowups = async () => {
    setIsLoading(true)
    try {
      const res = await followupsAPI.getAll()
      setFollowups(res.data || [])
    } catch (error) {
      console.error('Followups fetch error:', error)
      showToast(onToast, `加载跟进数据失败：${error?.message || '未知错误'}`, 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const handleRefresh = async () => {
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
    setMessageText(`尊敬的HR团队：\n\n您好！\n\n我是${followup.role}岗位的候选人，想跟进一下我的申请进度。\n\n期待您的回复！\n\n此致`)
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

  // Stats
  const stats = {
    urgent: followups.filter(f => f.urgency === 'urgent').length,
    overdue: followups.filter(f => f.urgency === 'overdue').length,
    waiting: followups.filter(f => f.urgency === 'waiting').length,
    cold: followups.filter(f => f.urgency === 'cold').length,
  }

  // Filter
  const filteredFollowups = filterUrgency === 'all'
    ? followups
    : followups.filter(f => f.urgency === filterUrgency)

  // Sort by urgency
  const urgencyOrder = { urgent: 0, overdue: 1, waiting: 2, cold: 3 }
  const sortedFollowups = [...filteredFollowups].sort((a, b) =>
    (urgencyOrder[a.urgency] ?? 9) - (urgencyOrder[b.urgency] ?? 9)
  )

  if (isLoading) {
    return (
      <div className="page-header">
        <h2>跟进提醒</h2>
        <div className="empty-state">
          <div className="spinner" style={{ margin: '0 auto' }}></div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="page-header">
        <h2>跟进提醒</h2>
        <p>基于投递状态的跟进节奏引擎，自动计算下次跟进时间</p>
      </div>

      {/* 统计概览 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '16px' }}>
        {Object.entries(URGENCY_CONFIG).map(([key, cfg]) => {
          const Icon = cfg.icon
          return (
            <div key={key} style={{
              background: cfg.bg, borderRadius: '8px', padding: '14px 16px',
              border: `1px solid ${cfg.color}22`, cursor: 'pointer',
              outline: filterUrgency === key ? `2px solid ${cfg.color}` : 'none'
            }} onClick={() => setFilterUrgency(filterUrgency === key ? 'all' : key)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <Icon style={{ width: '16px', height: '16px', color: cfg.color }} />
                <span style={{ fontSize: '13px', fontWeight: 600, color: cfg.color }}>{cfg.label}</span>
              </div>
              <div style={{ fontSize: '22px', fontWeight: 'bold', color: cfg.color }}>{stats[key]}</div>
            </div>
          )
        })}
      </div>

      <div className="card">
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Filter style={{ width: '14px', height: '14px', color: '#94a3b8' }} />
            <select value={filterUrgency} onChange={(e) => setFilterUrgency(e.target.value)} className="form-control" style={{ width: '120px' }}>
              <option value="all">全部</option>
              <option value="urgent">紧急</option>
              <option value="overdue">逾期</option>
              <option value="waiting">等待中</option>
              <option value="cold">已冷却</option>
            </select>
          </div>
          <button className="btn btn-secondary" onClick={handleRefresh}>
            <RefreshCw style={{ width: '14px', height: '14px', marginRight: '6px' }} />
            刷新
          </button>
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
                <tr key={followup.id}>
                  <td style={{ fontWeight: 500 }}>{followup.company}</td>
                  <td>{followup.role}</td>
                  <td>
                    <span className="tag" style={{ background: '#f4f6f8', color: '#1e293b' }}>
                      {STATUS_LABELS[followup.last_status] || followup.last_status}
                    </span>
                  </td>
                  <td>{followup.followup_count ?? 0} 次</td>
                  <td>{followup.days_since_application ?? '-'} 天</td>
                  <td style={{ fontSize: '13px', color: '#64748b' }}>{followup.next_followup_date || '-'}</td>
                  <td>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '4px',
                      padding: '2px 8px', borderRadius: '10px', fontSize: '12px', fontWeight: 600,
                      background: uCfg.bg, color: uCfg.color
                    }}>
                      <UrgencyIcon style={{ width: '12px', height: '12px' }} />
                      {uCfg.label}
                    </span>
                  </td>
                  <td>
                    {followup.urgency !== 'cold' && (
                      <>
                        <button className="btn btn-secondary btn-sm" onClick={() => handleSendMessage(followup)} title="记录跟进消息">
                          <Mail style={{ width: '14px', height: '14px' }} />
                        </button>
                        <button className="btn btn-primary btn-sm" onClick={() => handleMarkSent(followup.id)} title="标记已跟进">
                          <CheckCircle style={{ width: '14px', height: '14px' }} />
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {followups.length === 0 && (
          <div className="empty-state">
            <Bell />
            <p>暂无跟进任务</p>
            <p style={{ fontSize: '13px', color: '#94a3b8' }}>请先在「投递追踪」页面添加投递记录</p>
          </div>
        )}
        {followups.length > 0 && sortedFollowups.length === 0 && (
          <div className="empty-state">
            <Filter />
            <p>当前筛选无结果</p>
          </div>
        )}
      </div>

      {/* 发送跟进消息 Modal */}
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
              <textarea
                className="form-control"
                rows="6"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="记录你的跟进内容..."
              />
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowMessageModal(false)}>取消</button>
              <button className="btn btn-primary" onClick={handleSend} disabled={!messageText.trim()}>
                <Send style={{ width: '14px', height: '14px', marginRight: '6px' }} />
                记录跟进
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
