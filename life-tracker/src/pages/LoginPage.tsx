import { useState } from 'react'
import { Button, Callout, Card, FormGroup, Icon, InputGroup } from '@blueprintjs/core'

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
      <div className="login-shell">
        <Card className="panel login-panel">
          <Callout intent="success" icon="envelope" title="Check your email">
            We sent a verification link to <strong>{email}</strong>. Open it to activate your account.
          </Callout>
          <Button fill style={{ marginTop: 20 }} onClick={() => { setConfirmationSent(false); setIsSignUp(false) }}>Back to sign in</Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="login-shell">
      <Card className="panel login-panel">
        <div className="brand" style={{ padding: 0 }}>
          <span className="brand-mark"><Icon icon="layers" size={20} /></span>
          <span>Life Tracker<span className="brand-caption">YOUR PERSONAL WORKSPACE</span></span>
        </div>
        <div className="login-heading">
          <h1>{isSignUp ? 'Make space for a better day.' : 'Welcome back.'}</h1>
          <p>{isSignUp ? 'Track your WHOOP health data and runs in one place.' : 'Your health and running, all in one place.'}</p>
        </div>
        <form onSubmit={handleSubmit} className="login-form">
          {isSignUp && <FormGroup label="Display name" labelFor="display-name">
            <InputGroup id="display-name" leftIcon="person" placeholder="Your name" value={displayName} onChange={e => setDisplayName(e.target.value)} autoComplete="name" required large />
          </FormGroup>}
          <FormGroup label="Email" labelFor="email">
            <InputGroup id="email" type="email" leftIcon="envelope" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required large />
          </FormGroup>
          <FormGroup label="Password" labelFor="password">
            <InputGroup id="password" type={showPassword ? 'text' : 'password'} leftIcon="lock" placeholder="Your password" value={password} onChange={e => setPassword(e.target.value)} autoComplete={isSignUp ? 'new-password' : 'current-password'} minLength={6} required large
              rightElement={<Button minimal icon={showPassword ? 'eye-off' : 'eye-open'} aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)} />} />
          </FormGroup>
          {error && <Callout intent="danger" role="alert">{error}</Callout>}
          <Button intent="primary" type="submit" loading={loading} fill large endIcon="arrow-right">{isSignUp ? 'Create account' : 'Sign in'}</Button>
        </form>
        <Button minimal fill onClick={() => { setIsSignUp(!isSignUp); setError('') }} style={{ marginTop: 22 }}>
          {isSignUp ? 'Already have an account? Sign in' : 'New here? Create an account'}
        </Button>
      </Card>
    </div>
  )
}
