import { LayoutDashboard, Building2, Search, FileText, File, ListTodo, Briefcase, Bell, Inbox, Settings, ClipboardList } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'

const navItems = [
  { path: '/', icon: LayoutDashboard, label: '工作台' },
  { path: '/onboarding', icon: ClipboardList, label: '首次使用' },
  { path: '/companies', icon: Building2, label: '公司库' },
  { path: '/discovery', icon: Search, label: '岗位发现' },
  { path: '/jobs', icon: FileText, label: '岗位列表' },
  { path: '/resume', icon: File, label: '简历生成' },
  { path: '/tracker', icon: ListTodo, label: '投递追踪' },
  { path: '/interview', icon: Briefcase, label: '面试准备' },
  { path: '/followups', icon: Bell, label: '跟进提醒' },
  { path: '/candidates', icon: Inbox, label: '候选区' },
  { path: '/settings', icon: Settings, label: '设置' }
]

export default function Sidebar() {
  const location = useLocation()
  const currentPath = location.pathname
  
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1>Career Ops</h1>
        <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>工作筛选器</p>
      </div>
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
  )
}
