import { useState } from 'react'
import { LayoutDashboard, Mail, Lock, User, ArrowRight } from 'lucide-react'

interface LoginPageProps {
  onSignIn: (email: string, password: string) => Promise<void>
  onSignUp: (email: string, password: string, displayName: string) => Promise<void>
}

export function LoginPage({ onSignIn, onSignUp }: LoginPageProps) {
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [confirmationSent, setConfirmationSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (isSignUp) {
        await onSignUp(email, password, displayName)
        setConfirmationSent(true)
      } else {
        await onSignIn(email, password)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  if (confirmationSent) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: 'var(--bg-primary)',
      }}>
        <div className="glass-card" style={{ maxWidth: 420, width: '100%', textAlign: 'center', margin: '0 16px' }}>
          <Mail size={48} color="var(--accent)" style={{ marginBottom: 16 }} />
          <h2 style={{ marginBottom: 8 }}>Check your email</h2>
          <p style={{ color: 'var(--fg-secondary)', marginBottom: 24 }}>
            We sent a verification link to <strong>{email}</strong>. Click the link to activate your account.
          </p>
          <button className="btn btn-secondary" onClick={() => { setConfirmationSent(false); setIsSignUp(false) }}>
            Back to Sign In
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: 'var(--bg-primary)',
      backgroundImage: 'radial-gradient(ellipse at 50% 0%, rgba(124,58,237,0.15) 0%, transparent 60%)',
    }}>
      <div className="glass-card" style={{ maxWidth: 420, width: '100%', margin: '0 16px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32,
          justifyContent: 'center',
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: 'var(--accent-bg)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <LayoutDashboard size={22} color="var(--accent)" />
          </div>
          <span style={{
            fontFamily: 'var(--font-display)', fontSize: '1.5rem',
            fontWeight: 700, color: 'var(--accent)',
          }}>Life Tracker</span>
        </div>

        <h2 style={{ textAlign: 'center', marginBottom: 24 }}>
          {isSignUp ? 'Create your account' : 'Welcome back'}
        </h2>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {isSignUp && (
            <div>
              <label className="label">Display Name</label>
              <div style={{ position: 'relative' }}>
                <User size={16} color="var(--fg-muted)" style={{ position: 'absolute', left: 14, top: 12 }} />
                <input
                  className="input"
                  type="text"
                  placeholder="Your name"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  required
                  style={{ paddingLeft: 40 }}
                />
              </div>
            </div>
          )}

          <div>
            <label className="label">Email</label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} color="var(--fg-muted)" style={{ position: 'absolute', left: 14, top: 12 }} />
              <input
                className="input"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                style={{ paddingLeft: 40 }}
              />
            </div>
          </div>

          <div>
            <label className="label">Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} color="var(--fg-muted)" style={{ position: 'absolute', left: 14, top: 12 }} />
              <input
                className="input"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                style={{ paddingLeft: 40 }}
              />
            </div>
          </div>

          {error && (
            <div style={{
              background: 'var(--danger-bg)', color: 'var(--danger)',
              padding: '10px 14px', borderRadius: 'var(--radius-xs)',
              fontSize: '0.85rem',
            }}>
              {error}
            </div>
          )}

          <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>
            {loading ? 'Please wait...' : (isSignUp ? 'Create Account' : 'Sign In')}
            {!loading && <ArrowRight size={16} />}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <button
            className="btn btn-ghost"
            onClick={() => { setIsSignUp(!isSignUp); setError('') }}
            style={{ fontSize: '0.85rem' }}
          >
            {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
          </button>
        </div>
      </div>
    </div>
  )
}
