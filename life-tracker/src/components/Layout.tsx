import type { ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { NavLink, useLocation } from 'react-router-dom'
import { LayoutDashboard, Heart, Wallet, BookOpen, LogOut } from 'lucide-react'

const NAV_ITEMS = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/health', icon: Heart, label: 'Health' },
  { to: '/finance', icon: Wallet, label: 'Finance' },
  { to: '/journal', icon: BookOpen, label: 'Journal' },
]

interface LayoutProps {
  user: User
  onSignOut: () => void
  children: ReactNode
}

export function Layout({ user, onSignOut, children }: LayoutProps) {
  const location = useLocation()

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <aside style={{
        width: 'var(--sidebar-width)',
        minWidth: 'var(--sidebar-width)',
        background: 'var(--bg-surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        padding: '20px 12px',
      }}>
        <div style={{
          fontSize: '0.95rem',
          fontWeight: 700,
          color: 'var(--fg)',
          padding: '4px 12px',
          marginBottom: 28,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          letterSpacing: '-0.01em',
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: 7,
            background: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <LayoutDashboard size={15} color="#fff" />
          </div>
          Life Tracker
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => {
            const active = location.pathname === to
            return (
              <NavLink
                key={to}
                to={to}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  color: active ? 'var(--accent-fg)' : 'var(--fg-secondary)',
                  background: active ? 'var(--accent-light)' : 'transparent',
                  textDecoration: 'none',
                  fontSize: '0.875rem',
                  fontWeight: active ? 600 : 400,
                  transition: 'all 0.1s',
                }}
              >
                <Icon size={16} strokeWidth={active ? 2.5 : 2} />
                {label}
              </NavLink>
            )
          })}
        </nav>

        <div style={{
          borderTop: '1px solid var(--border)',
          paddingTop: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
        }}>
          <div style={{
            fontSize: '0.8rem',
            color: 'var(--fg-muted)',
            padding: '0 12px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {user.email}
          </div>
          <button
            onClick={onSignOut}
            className="btn btn-ghost"
            style={{ justifyContent: 'flex-start', width: '100%', fontSize: '0.8rem' }}
          >
            <LogOut size={14} />
            Sign Out
          </button>
        </div>
      </aside>

      <main style={{
        flex: 1,
        overflow: 'auto',
        padding: '32px 40px',
        background: 'var(--bg)',
      }}>
        {children}
      </main>
    </div>
  )
}
