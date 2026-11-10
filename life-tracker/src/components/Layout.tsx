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
        background: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        padding: '24px 16px',
        gap: '8px',
      }}>
        <div style={{
          fontFamily: 'var(--font-display)',
          fontSize: '1.25rem',
          fontWeight: 700,
          color: 'var(--accent)',
          padding: '8px 12px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'var(--accent-bg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <LayoutDashboard size={18} color="var(--accent)" />
          </div>
          Life Tracker
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => {
            const active = location.pathname === to
            return (
              <NavLink
                key={to}
                to={to}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-sm)',
                  color: active ? 'var(--fg-primary)' : 'var(--fg-muted)',
                  background: active ? 'var(--accent-bg)' : 'transparent',
                  textDecoration: 'none',
                  fontSize: '0.9rem',
                  fontWeight: active ? 500 : 400,
                  transition: 'all 0.15s',
                }}
              >
                <Icon size={18} />
                {label}
              </NavLink>
            )
          })}
        </nav>

        <div style={{
          borderTop: '1px solid var(--border)',
          paddingTop: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
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
            style={{ justifyContent: 'flex-start', width: '100%' }}
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </aside>

      <main style={{
        flex: 1,
        overflow: 'auto',
        padding: '32px',
      }}>
        {children}
      </main>
    </div>
  )
}
