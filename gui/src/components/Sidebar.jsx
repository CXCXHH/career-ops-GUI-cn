import { useState } from 'react'
import { LayoutDashboard, Building2, Search, File, ListTodo, Briefcase, Settings, Megaphone } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import AnnouncementModal from './AnnouncementModal'

const navItems = [
  { path: '/', icon: LayoutDashboard, label: '工作台' },
  { path: '/resume', icon: File, label: '简历' },
  { path: '/jobs', icon: Search, label: '岗位' },
  { path: '/tracker', icon: ListTodo, label: '投递' },
  { path: '/interview', icon: Briefcase, label: '面试' },
  { path: '/companies', icon: Building2, label: '公司' },
  { path: '/settings', icon: Settings, label: '设置' }
]

export default function Sidebar() {
  const location = useLocation()
  const currentPath = location.pathname
  const [showAnnouncement, setShowAnnouncement] = useState(false)
  
  return (
    <>
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1>Career Ops</h1>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>工作筛选器</p>
        </div>
        
        <button 
          className="sidebar-announcement-btn"
          onClick={() => setShowAnnouncement(true)}
        >
          <Megaphone className="icon" />
          <span>系统公告</span>
          <span className="announcement-badge">新</span>
        </button>
        
        <nav className="sidebar-nav">
          <ul>
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = currentPath === item.path || (currentPath.startsWith(item.path) && item.path !== '/')
              return (
                <li key={item.path}>
                  <Link to={item.path} className={isActive ? 'active' : ''}>
                    <Icon className="icon" />
                    <span>{item.label}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
      </aside>
      
      <AnnouncementModal 
        isOpen={showAnnouncement} 
        onClose={() => setShowAnnouncement(false)} 
      />
    </>
  )
}
