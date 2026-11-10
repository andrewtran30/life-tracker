import { useState, useEffect } from 'react'
import { Moon, Activity, DollarSign, Brain, RefreshCw, Sparkles, TrendingUp, Heart } from 'lucide-react'
import { api } from '../lib/api'
import type { DailySummary } from '../lib/types'

export function DashboardPage() {
  const [summary, setSummary] = useState<DailySummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [regenerating, setRegenerating] = useState(false)
  const [error, setError] = useState('')

  async function loadSummary() {
    try {
      const data = await api.summary.getToday()
      setSummary(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load summary')
    } finally {
      setLoading(false)
    }
  }

  async function handleRegenerate() {
    setRegenerating(true)
    try {
      const data = await api.summary.regenerate()
      setSummary(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to regenerate')
    } finally {
      setRegenerating(false)
    }
  }

  useEffect(() => { loadSummary() }, [])

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  const healthSnap = summary?.health_snapshot as Record<string, Record<string, number>> | null
  const financeSnap = summary?.finance_snapshot as Record<string, number> | null
  const moodSnap = summary?.mood_snapshot as Record<string, number> | null

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: '1.75rem', marginBottom: 4 }}>Good Morning</h1>
        <p style={{ color: 'var(--fg-muted)' }}>{today}</p>
      </div>

      {/* Quick Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <StatCard
          icon={<Moon size={18} />}
          label="Sleep Score"
          value={healthSnap?.sleep?.score != null ? `${healthSnap.sleep.score}` : '—'}
          unit="/100"
          color="var(--accent)"
          bg="var(--accent-bg)"
        />
        <StatCard
          icon={<Heart size={18} />}
          label="Recovery"
          value={healthSnap?.recovery?.score != null ? `${healthSnap.recovery.score}` : '—'}
          unit="%"
          color="var(--health)"
          bg="var(--health-bg)"
        />
        <StatCard
          icon={<DollarSign size={18} />}
          label="Spent Yesterday"
          value={financeSnap?.spending_yesterday != null ? `$${financeSnap.spending_yesterday.toFixed(0)}` : '—'}
          color="var(--finance)"
          bg="var(--finance-bg)"
        />
        <StatCard
          icon={<Activity size={18} />}
          label="Mood"
          value={moodSnap?.mood != null ? `${moodSnap.mood}` : '—'}
          unit="/10"
          color="var(--journal)"
          bg="var(--journal-bg)"
        />
      </div>

      {/* Morning Summary */}
      <div className="glass-card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'linear-gradient(135deg, var(--accent-dim), var(--accent))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Sparkles size={18} color="#fff" />
            </div>
            <div>
              <h3 style={{ fontSize: '1rem' }}>Morning Summary</h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--fg-muted)' }}>
                {summary?.generated_at ? `Generated ${new Date(summary.generated_at).toLocaleTimeString()}` : 'AI-powered daily insights'}
              </span>
            </div>
          </div>
          <button className="btn btn-secondary" onClick={handleRegenerate} disabled={regenerating} style={{ fontSize: '0.8rem' }}>
            <RefreshCw size={14} className={regenerating ? 'spinning' : ''} />
            {regenerating ? 'Generating...' : 'Regenerate'}
          </button>
        </div>

        {loading ? (
          <div style={{ color: 'var(--fg-muted)', padding: '20px 0', textAlign: 'center' }}>Loading your morning summary...</div>
        ) : error ? (
          <div style={{ color: 'var(--fg-muted)', padding: '20px 0' }}>
            <p style={{ marginBottom: 8 }}>{error}</p>
            <p style={{ fontSize: '0.85rem' }}>Start by connecting WHOOP in the Health tab and adding transactions in Finance to get personalized insights.</p>
          </div>
        ) : summary ? (
          <div style={{ fontSize: '0.9rem', lineHeight: 1.7, color: 'var(--fg-secondary)', whiteSpace: 'pre-wrap' }}>
            {summary.summary_text}
          </div>
        ) : (
          <TemplateSummary />
        )}
      </div>

      {/* Goals */}
      <div className="glass-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <TrendingUp size={18} color="var(--accent)" />
          <h3 style={{ fontSize: '1rem' }}>Active Goals</h3>
        </div>
        <p style={{ color: 'var(--fg-muted)', fontSize: '0.9rem' }}>
          Set goals in each tab to track your progress here. Your AI summary will factor these into daily recommendations.
        </p>
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, unit, color, bg }: {
  icon: React.ReactNode; label: string; value: string; unit?: string; color: string; bg: string
}) {
  return (
    <div className="glass-card" style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: bg, display: 'flex',
          alignItems: 'center', justifyContent: 'center', color,
        }}>
          {icon}
        </div>
        <span className="stat-label">{label}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
        <span className="stat-value" style={{ color }}>{value}</span>
        {unit && <span style={{ fontSize: '0.85rem', color: 'var(--fg-muted)' }}>{unit}</span>}
      </div>
    </div>
  )
}

function TemplateSummary() {
  return (
    <div style={{ fontSize: '0.9rem', lineHeight: 1.7, color: 'var(--fg-secondary)' }}>
      <p style={{ marginBottom: 16 }}>
        <strong style={{ color: 'var(--fg-primary)' }}>Welcome to your Life Tracker!</strong> Your morning summary will appear here once you have data flowing in.
      </p>
      <p style={{ marginBottom: 12 }}>To get started:</p>
      <ul style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <li><strong style={{ color: 'var(--health)' }}>Health:</strong> Connect your WHOOP to pull in sleep, recovery, and workout data</li>
        <li><strong style={{ color: 'var(--finance)' }}>Finance:</strong> Add accounts and start logging transactions or import a CSV</li>
        <li><strong style={{ color: 'var(--journal)' }}>Journal:</strong> Log your daily mood, energy, and reflections</li>
      </ul>
      <p style={{ marginTop: 16, padding: '12px 16px', background: 'var(--accent-bg)', borderRadius: 'var(--radius-xs)', borderLeft: '3px solid var(--accent)' }}>
        Once you have data in at least one area, the AI will generate personalized morning insights and actionable recommendations based on your goals.
      </p>
    </div>
  )
}
