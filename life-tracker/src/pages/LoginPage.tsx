import { useState } from 'react'
import { LayoutDashboard, Mail, Lock, User, ArrowRight, Eye, EyeOff } from 'lucide-react'

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
  const [showPassword, setShowPassword] = useState(false)
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)' }}>
        <div className="card" style={{ maxWidth: 400, width: '100%', textAlign: 'center', margin: '0 16px' }}>
          <Mail size={40} color="var(--accent)" style={{ marginBottom: 16 }} />
          <h2 style={{ fontSize: '1.25rem', marginBottom: 8 }}>Check your email</h2>
          <p style={{ color: 'var(--fg-secondary)', fontSize: '0.9rem', marginBottom: 24, lineHeight: 1.6 }}>
            We sent a verification link to <strong>{email}</strong>. Click it to activate your account.
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
      height: '100vh', background: 'var(--bg)',
    }}>
      <div className="card" style={{ maxWidth: 380, width: '100%', margin: '0 16px', padding: 32 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28, justifyContent: 'center',
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8, background: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <LayoutDashboard size={17} color="#fff" />
          </div>
          <span style={{ fontSize: '1.1rem', fontWeight: 700, letterSpacing: '-0.01em' }}>
            Life Tracker
          </span>
        </div>

        <h2 style={{ textAlign: 'center', fontSize: '1.15rem', marginBottom: 24 }}>
          {isSignUp ? 'Create your account' : 'Welcome back'}
        </h2>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {isSignUp && (
            <div>
              <label className="label">Display Name</label>
              <div style={{ position: 'relative' }}>
                <User size={15} color="var(--fg-muted)" style={{ position: 'absolute', left: 12, top: 10 }} />
                <input className="input" type="text" placeholder="Your name" value={displayName}
                  onChange={e => setDisplayName(e.target.value)} required style={{ paddingLeft: 36 }} />
              </div>
            </div>
          )}
          <div>
            <label className="label">Email</label>
            <div style={{ position: 'relative' }}>
              <Mail size={15} color="var(--fg-muted)" style={{ position: 'absolute', left: 12, top: 10 }} />
              <input className="input" type="email" placeholder="you@example.com" value={email}
                onChange={e => setEmail(e.target.value)} required style={{ paddingLeft: 36 }} />
            </div>
          </div>
          <div>
            <label className="label">Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={15} color="var(--fg-muted)" style={{ position: 'absolute', left: 12, top: 10 }} />
              <input className="input" type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={password}
                onChange={e => setPassword(e.target.value)} required minLength={6} style={{ paddingLeft: 36, paddingRight: 36 }} />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: 10, top: 7, background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
                {showPassword ? <EyeOff size={15} color="var(--fg-muted)" /> : <Eye size={15} color="var(--fg-muted)" />}
              </button>
            </div>
          </div>

          {error && (
            <div style={{
              background: 'var(--danger-light)', color: 'var(--danger)',
              padding: '8px 12px', borderRadius: 'var(--radius-xs)', fontSize: '0.85rem',
            }}>
              {error}
            </div>
          )}

          <button className="btn btn-primary" type="submit" disabled={loading}
            style={{ width: '100%', justifyContent: 'center', marginTop: 4, padding: '10px 16px' }}>
            {loading ? 'Please wait...' : (isSignUp ? 'Create Account' : 'Sign In')}
            {!loading && <ArrowRight size={15} />}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <button className="btn btn-ghost" onClick={() => { setIsSignUp(!isSignUp); setError('') }}
            style={{ fontSize: '0.8rem' }}>
            {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
          </button>
        </div>
      </div>
    </div>
  )
}
