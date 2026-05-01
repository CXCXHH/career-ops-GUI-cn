import { useState, useEffect } from 'react'
import { Activity, CheckCircle, AlertCircle, Clock, FileText, TrendingUp, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { healthAPI, jobsAPI, trackerAPI } from '../api'
import { showToast } from '../utils/toast'

export default function Dashboard({ onToast }) {
  const [healthStatus, setHealthStatus] = useState(null)
  const [stats, setStats] = useState({
    totalJobs: 0,
    activeJobs: 0,
    recommendedJobs: 0,
    pendingFollowups: 0
  })
  const [isLoading, setIsLoading] = useState(true)
  const [recentJobs, setRecentJobs] = useState([])
  const [recentTrackers, setRecentTrackers] = useState([])

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setIsLoading(true)
    try {
      const [healthRes, jobsRes, trackerRes] = await Promise.all([
        healthAPI.check(),
        jobsAPI.getAll(),
        trackerAPI.getAll()
      ])
      setHealthStatus(healthRes.data)
      
      const jobs = jobsRes.data || []
      setStats({
        totalJobs: jobs.length,
        activeJobs: jobs.filter(j => j.liveness_status === 'active').length,
        recommendedJobs: jobs.filter(j => j.score && j.score >= 4).length,
        pendingFollowups: trackerRes.data?.filter(t => t.status === 'Applied' || t.status === 'Interview').length || 0
      })
      setRecentJobs(jobs.slice(0, 5))
      setRecentTrackers(trackerRes.data?.slice(0, 5) || [])
    } catch (error) {
      console.error('Dashboard fetch error:', error)
      showToast(onToast, '加载数据失败', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const runDoctor = async () => {
    try {
      const res = await healthAPI.doctor()
      setHealthStatus(res.data.checks)
      showToast(onToast, '健康检查完成，缺失依赖已尝试自动安装', 'success')
    } catch (error) {
      showToast(onToast, '健康检查失败', 'error')
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pass': return <CheckCircle style={{ color: '#16a34a', width: '20px', height: '20px' }} />
      case 'warn': return <AlertCircle style={{ color: '#f59e0b', width: '20px', height: '20px' }} />
      case 'fail': return <AlertCircle style={{ color: '#dc2626', width: '20px', height: '20px' }} />
      default: return <Activity style={{ color: '#78716c', width: '20px', height: '20px' }} />
    }
  }

  const getLivenessBadge = (status) => {
    const badges = {
      active: { className: 'status-active', text: '有效' },
      closed: { className: 'status-closed', text: '已关闭' },
      unconfirmed: { className: 'status-unconfirmed', text: '未确认' },
      error: { className: 'status-error', text: '错误' },
      unknown: { className: 'status-unconfirmed', text: '未知' }
    }
    const badge = badges[status] || badges.unknown
    return <span className={`status-badge ${badge.className}`}>{badge.text}</span>
  }

  if (isLoading) {
    return (
      <div className="page-header">
        <h2>Dashboard</h2>
        <div className="empty-state">
          <div className="spinner" style={{ margin: '0 auto' }}></div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="page-header">
        <h2>求职工作台</h2>
        <p>欢迎回来！这是你的求职概览</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{stats.totalJobs}</div>
          <div className="stat-label">已发现岗位</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.activeJobs}</div>
          <div className="stat-label">有效岗位</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.recommendedJobs}</div>
          <div className="stat-label">推荐投递</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.pendingFollowups}</div>
          <div className="stat-label">待跟进</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">项目健康状态</div>
          <button className="btn btn-primary btn-sm" onClick={runDoctor}>
            运行检查并安装依赖
          </button>
        </div>
        {healthStatus && (
          <table className="table">
            <thead>
              <tr>
                <th>检查项</th>
                <th>状态</th>
                <th>详情</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(healthStatus).map(([key, value]) => (
                <tr key={key}>
                  <td>{key}</td>
                  <td>{getStatusIcon(value.status)}</td>
                  <td>{value.message}</td>
                  <td>
                    {(key === 'cv' || key === 'portals' || key === 'profile') && value.status !== 'pass' ? (
                      <Link to="/onboarding" className="btn btn-secondary btn-sm">去配置</Link>
                    ) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">最近发现的岗位</div>
          <Link to="/jobs" className="btn btn-secondary btn-sm">
              查看全部 <ArrowRight style={{ width: '14px', height: '14px', marginLeft: '4px' }} />
            </Link>
        </div>
        {recentJobs.length > 0 ? (
          <table className="table">
            <thead>
              <tr>
                <th>公司</th>
                <th>岗位</th>
                <th>地点</th>
                <th>状态</th>
                <th>评分</th>
              </tr>
            </thead>
            <tbody>
              {recentJobs.map(job => (
                <tr key={job.id}>
                  <td>{job.company}</td>
                  <td>{job.title}</td>
                  <td>{job.location || '-'}</td>
                  <td>{getLivenessBadge(job.liveness_status)}</td>
                  <td>{job.score ? `${job.score}/5` : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-state">
            <FileText />
            <p>暂无岗位数据</p>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">投递追踪</div>
          <Link to="/tracker" className="btn btn-secondary btn-sm">       
              查看全部 <ArrowRight style={{ width: '14px', height: '14px', marginLeft: '4px' }} />
            </Link>
        </div>
        {recentTrackers.length > 0 ? (
          <table className="table">
            <thead>
              <tr>
                <th>公司</th>
                <th>岗位</th>
                <th>状态</th>
                <th>评分</th>
                <th>日期</th>
              </tr>
            </thead>
            <tbody>
              {recentTrackers.map((tracker, index) => (
                <tr key={index}>
                  <td>{tracker.company}</td>
                  <td>{tracker.role}</td>
                  <td><span className={`status-badge ${tracker.status === 'Applied' ? 'status-active' : tracker.status === 'Rejected' ? 'status-closed' : 'status-unconfirmed'}`}>{tracker.status}</span></td>
                  <td>{tracker.score || '-'}</td>
                  <td>{tracker.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-state">
            <Clock />
            <p>暂无投递记录</p>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">快捷操作</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
          <Link to="/discovery" className="btn btn-primary" style={{ textAlign: 'center', justifyContent: 'center' }}>
              <TrendingUp style={{ width: '16px', height: '16px', marginRight: '8px' }} />
              搜索岗位
            </Link>
          <Link to="/companies" className="btn btn-secondary" style={{ textAlign: 'center', justifyContent: 'center' }}>
            <TrendingUp style={{ width: '16px', height: '16px', marginRight: '8px' }} />
            管理公司
          </Link>
          <button className="btn btn-secondary" onClick={runDoctor} style={{ textAlign: 'center', justifyContent: 'center' }}>
            <Activity style={{ width: '16px', height: '16px', marginRight: '8px' }} />
            健康检查
          </button>
        </div>
      </div>
    </>
  )
}
