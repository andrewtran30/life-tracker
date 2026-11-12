import { Alignment, Button, Icon, Navbar, NavbarGroup, NavbarHeading } from '@blueprintjs/core'
import type { ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { NavLink } from 'react-router-dom'

export function Layout({ user, onSignOut, children }: { user: User; onSignOut: () => void; children: ReactNode }) {
  const name = user.user_metadata?.display_name || user.email?.split('@')[0] || 'You'
  return <div className="app-shell">
    <a className="skip-link" href="#main-content">Skip to content</a>
    <Navbar className="app-navbar"><NavbarGroup align={Alignment.START}><NavbarHeading className="top-brand"><span className="top-brand-mark"><Icon icon="layers" size={16} /></span> Life Tracker</NavbarHeading><span className="top-subtitle">Personal workspace</span></NavbarGroup><NavbarGroup align={Alignment.END}><span className="top-user">{name}</span><Button variant="minimal" icon="log-out" onClick={onSignOut}>Sign out</Button></NavbarGroup></Navbar>
    <div className="app-body"><aside className="sidebar"><div className="nav-caption">WORKSPACE</div><nav className="workspace-nav" aria-label="Main navigation">
      <NavLink to="/health" className={({isActive}) => `nav-item${isActive ? ' active' : ''}`}><Icon icon="heart" /> <strong>Overall health</strong></NavLink>
      <NavLink to="/running" className={({isActive}) => `nav-item${isActive ? ' active' : ''}`}><Icon icon="walk" /> <strong>Running tracker</strong></NavLink>
    </nav><div className="sidebar-footnote">Your health, all in one place.</div></aside><main className="page-content" id="main-content">{children}</main></div>
  </div>
}
