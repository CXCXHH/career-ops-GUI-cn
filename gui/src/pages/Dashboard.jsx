import { useState, useEffect } from 'react'
import { Pulse, CheckCircle, WarningCircle, FileText, ArrowRight, SquaresFour } from '@phosphor-icons/react'
import { Link } from 'react-router-dom'
import { healthAPI, jobsAPI, trackerAPI } from '../api'
import { showToast } from '../utils/toast'
import { FluidCanvas, LiquidCard, PageTransition, LiquidSectionHeader, MagneticButton, ScrollReveal } from '../components/LiquidMotion'
import '../styles/liquid-motion.css'

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
      case 'pass': return <CheckCircle weight="fill" style={{ color: 'var(--success-color)', width: '20px', height: '20px' }} />
      case 'warn': return <WarningCircle weight="fill" style={{ color: 'var(--warning-color)', width: '20px', height: '20px' }} />
      case 'fail': return <WarningCircle weight="fill" style={{ color: 'var(--danger-color)', width: '20px', height: '20px' }} />
      default: return <Pulse weight="fill" style={{ color: 'var(--text-secondary)', width: '20px', height: '20px' }} />
    }
  }

  const getLivenessBadge = (status) => {
    const badges = {
      active: { className: 'liquid-status', style: { color: 'var(--success-color)', background: 'var(--success-tint)' }, text: '有效' },
      closed: { className: 'liquid-status', style: { color: 'var(--danger-color)', background: 'var(--danger-tint)' }, text: '已关闭' },
      unconfirmed: { className: 'liquid-status', style: { color: 'var(--warning-color)', background: 'var(--warning-tint)' }, text: '未确认' },
      error: { className: 'liquid-status', style: { color: 'var(--danger-color)', background: 'var(--danger-tint)' }, text: '错误' },
      unknown: { className: 'liquid-status', style: { color: 'var(--text-secondary)', background: 'var(--bg-secondary)' }, text: '未知' }
    }
    const badge = badges[status] || badges.unknown
    return <span className={badge.className} style={badge.style}>{badge.text}</span>
  }

  if (isLoading) {
    return (
      <PageTransition>
        <div className="liquid-empty">
          <div className="liquid-spinner" style={{ margin: '0 auto 20px' }}></div>
          <p>加载中...</p>
        </div>
      </PageTransition>
    )
  }

  return (
    <PageTransition>
      <div className="dashboard-content" style={{ padding: '8px' }}>
        <LiquidSectionHeader
          title="求职工作台"
          subtitle="欢迎回来！这是你的求职概览"
          icon={SquaresFour}
        />

        <ScrollReveal delay={0}>
          <div className="liquid-stats-grid" style={{ gap: '24px', marginBottom: '32px' }}>
            <LiquidCard delay={0}>
              <div style={{ fontSize: '36px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '8px', fontFamily: 'var(--font-sans)' }}>
                {stats.totalJobs}
              </div>
              <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>已发现岗位</div>
            </LiquidCard>
            <LiquidCard delay={0.08}>
              <div style={{ fontSize: '36px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '8px', fontFamily: 'var(--font-sans)' }}>
                {stats.activeJobs}
              </div>
              <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>有效岗位</div>
            </LiquidCard>
            <LiquidCard delay={0.16}>
              <div style={{ fontSize: '36px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '8px', fontFamily: 'var(--font-sans)' }}>
                {stats.recommendedJobs}
              </div>
              <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>推荐投递</div>
            </LiquidCard>
            <LiquidCard delay={0.24}>
              <div style={{ fontSize: '36px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '8px', fontFamily: 'var(--font-sans)' }}>
                {stats.pendingFollowups}
              </div>
              <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>待跟进</div>
            </LiquidCard>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={0.1}>
          <LiquidCard delay={0.32}>
            <div className="card-header">
              <div className="card-title">项目健康状态</div>
              <MagneticButton variant="primary" className="btn-sm" onClick={runDoctor}>
                运行检查并安装依赖
              </MagneticButton>
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
                    <tr key={key} className="liquid-table-row">
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
          </LiquidCard>
        </ScrollReveal>

        <ScrollReveal delay={0.2}>
          <LiquidCard delay={0.4}>
            <div className="card-header">
              <div className="card-title">最近发现的岗位</div>
              <Link to="/jobs" className="btn btn-secondary btn-sm">
                查看全部 <ArrowRight weight="bold" style={{ width: '14px', height: '14px', marginLeft: '4px' }} />
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
                    <tr key={job.id} className="liquid-table-row">
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
              <div className="liquid-empty">
                <FileText weight="duotone" />
                <p>暂无岗位数据</p>
              </div>
            )}
          </LiquidCard>
        </ScrollReveal>

        <ScrollReveal delay={0.3}>
          <LiquidCard delay={0.48}>
            <div className="card-header">
              <div className="card-title">投递追踪</div>
              <Link to="/tracker" className="btn btn-secondary btn-sm">
                查看全部 <ArrowRight weight="bold" style={{ width: '14px', height: '14px', marginLeft: '4px' }} />
              </Link>
            </div>
            {recentTrackers.length > 0 ? (
              <table className="table">
                <thead>
                  <tr>
                    <th>公司</th>
                    <th>岗位</th>
                    <th>状态</th>
                    <th>更新时间</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTrackers.map(tracker => (
                    <tr key={tracker.id} className="liquid-table-row">
                      <td>{tracker.company}</td>
                      <td>{tracker.title}</td>
                      <td>{getLivenessBadge(tracker.status)}</td>
                      <td>{tracker.updated_at || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="liquid-empty">
                <FileText weight="duotone" />
                <p>暂无投递记录</p>
              </div>
            )}
          </LiquidCard>
        </ScrollReveal>
      </div>
    </PageTransition>
  )
}
