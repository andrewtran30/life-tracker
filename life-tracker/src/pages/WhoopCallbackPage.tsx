import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../lib/api'
import { Heart, CheckCircle, XCircle } from 'lucide-react'

export function WhoopCallbackPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [error, setError] = useState('')

  useEffect(() => {
    const code = searchParams.get('code')
    if (!code) {
      setStatus('error')
      setError('No authorization code received')
      return
    }

    api.whoop.exchangeCode(code)
      .then(() => {
        setStatus('success')
        setTimeout(() => navigate('/health'), 2000)
      })
      .catch(err => {
        setStatus('error')
        setError(err.message)
      })
  }, [searchParams, navigate])

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div className="glass-card" style={{ textAlign: 'center', maxWidth: 400, width: '100%' }}>
        {status === 'loading' && (
          <>
            <Heart size={48} color="var(--health)" style={{ marginBottom: 16 }} />
            <h3>Connecting WHOOP...</h3>
            <p style={{ color: 'var(--fg-muted)', marginTop: 8 }}>Exchanging authorization code</p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle size={48} color="var(--success)" style={{ marginBottom: 16 }} />
            <h3>WHOOP Connected!</h3>
            <p style={{ color: 'var(--fg-muted)', marginTop: 8 }}>Redirecting to Health page...</p>
          </>
        )}
        {status === 'error' && (
          <>
            <XCircle size={48} color="var(--danger)" style={{ marginBottom: 16 }} />
            <h3>Connection Failed</h3>
            <p style={{ color: 'var(--fg-muted)', marginTop: 8 }}>{error}</p>
            <button className="btn btn-secondary" onClick={() => navigate('/health')} style={{ marginTop: 16 }}>
              Back to Health
            </button>
          </>
        )}
      </div>
    </div>
  )
}
