import { Button, Tag, Icon } from '@blueprintjs/core'
import type { ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { NavLink, useLocation } from 'react-router-dom'
import { LayoutDashboard, Heart, Wallet, BookOpen, LogOut, ChevronRight, Moon } from 'lucide-react'

const NAV_ITEMS = [
  { to: '/', icon: LayoutDashboard, label: 'Overview', description: 'Your day at a glance' },
  { to: '/health', icon: Heart, label: 'Health', description: 'Recovery & performance' },
  { to: '/finance', icon: Wallet, label: 'Finance', description: 'Accounts & spending' },
  { to: '/journal', icon: BookOpen, label: 'Journal', description: 'Reflect & recharge' },
]

interface LayoutProps {
  user: User
  onSignOut: () => void
  children: ReactNode
}

export function Layout({ user, onSignOut, children }: LayoutProps) {
  const location = useLocation()
  const current = NAV_ITEMS.find(item => item.to === location.pathname)
  const name = user.user_metadata?.display_name || user.email?.split('@')[0] || 'You'

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <aside className="sidebar">
        <NavLink to="/" className="brand">
          <span className="brand-mark"><Icon icon="layers" size={20} /></span>
          <span>Life Tracker<span className="brand-caption">PERSONAL WORKSPACE</span></span>
        </NavLink>
        <div className="nav-caption">WORKSPACE</div>
        <nav className="workspace-nav" aria-label="Main navigation">
          {NAV_ITEMS.map(({ to, icon: NavIcon, label, description }) => (
            <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
              <NavIcon size={18} />
              <span><strong>{label}</strong><small>{description}</small></span>
              <ChevronRight size={13} className="nav-arrow" />
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="account-details">
            <span className="avatar">{String(name).slice(0, 1).toUpperCase()}</span>
            <div><strong>{name}</strong><small title={user.email}>{user.email}</small></div>
          </div>
          <Button minimal fill alignText="left" icon={<LogOut size={14} />} onClick={onSignOut}>Sign out</Button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="workspace-bar">
          <div className="breadcrumb"><span>Workspace</span><ChevronRight size={13} /><strong>{current?.label ?? 'WHOOP connection'}</strong></div>
          <Tag minimal icon={<Moon size={12} />} className="theme-tag">Dark mode</Tag>
        </header>
        <main className="page-content" id="main-content">{children}</main>
      </div>
    </div>
  )
}
