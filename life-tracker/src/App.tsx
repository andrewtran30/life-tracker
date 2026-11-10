import { Routes, Route, Navigate, useSearchParams } from 'react-router-dom'
import { Spinner } from '@blueprintjs/core'
import { useAuth } from './hooks/useAuth'
import { Layout } from './components/Layout'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { HealthPage } from './pages/HealthPage'
import { FinancePage } from './pages/FinancePage'
import { JournalPage } from './pages/JournalPage'
import { WhoopCallbackPage } from './pages/WhoopCallbackPage'

function HealthRoute() {
  const [searchParams] = useSearchParams()
  if (searchParams.has('code') || searchParams.has('error')) {
    return <Navigate to={`/auth/whoop/callback?${searchParams.toString()}`} replace />
  }
  return <HealthPage />
}

export default function App() {
  const { user, loading, signIn, signUp, signOut } = useAuth()

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <Spinner size={32} aria-label="Loading Life Tracker" />
      </div>
    )
  }

  if (!user) {
    return <LoginPage onSignIn={signIn} onSignUp={signUp} />
  }

  return (
    <Layout user={user} onSignOut={signOut}>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/health" element={<HealthRoute />} />
        <Route path="/finance" element={<FinancePage />} />
        <Route path="/journal" element={<JournalPage />} />
        <Route path="/auth/whoop/callback" element={<WhoopCallbackPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}
