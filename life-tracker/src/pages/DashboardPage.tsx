import { Card, Button } from '@blueprintjs/core'
import { useState, useEffect } from 'react'
import { Moon, Activity, DollarSign, RefreshCw, Sparkles, TrendingUp, Heart } from 'lucide-react'
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
    <div style={{ maxWidth: 860 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: '1.5rem', marginBottom: 2 }}>Good Morning</h1>
        <p style={{ color: 'var(--fg-muted)', fontSize: '0.9rem' }}>{today}</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        <StatCard icon={<Moon size={16} />} label="Sleep" value={healthSnap?.sleep?.score != null ? `${healthSnap.sleep.score}` : '—'} unit="/100" color="var(--accent)" bg="var(--accent-light)" />
        <StatCard icon={<Heart size={16} />} label="Recovery" value={healthSnap?.recovery?.score != null ? `${healthSnap.recovery.score}` : '—'} unit="%" color="var(--health)" bg="var(--health-light)" />
        <StatCard icon={<DollarSign size={16} />} label="Spent" value={financeSnap?.spending_yesterday != null ? `$${financeSnap.spending_yesterday.toFixed(0)}` : '—'} color="var(--finance)" bg="var(--finance-light)" />
        <StatCard icon={<Activity size={16} />} label="Mood" value={moodSnap?.mood != null ? `${moodSnap.mood}` : '—'} unit="/10" color="var(--journal)" bg="var(--journal-light)" />
      </div>

      <Card className="panel" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'var(--accent-light)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Sparkles size={16} color="var(--accent)" />
            </div>
            <div>
              <h3 style={{ fontSize: '0.95rem' }}>Morning Summary</h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--fg-muted)' }}>
                {summary?.generated_at ? `Generated ${new Date(summary.generated_at).toLocaleTimeString()}` : 'AI-powered daily insights'}
              </span>
            </div>
          </div>
          <Button  onClick={handleRegenerate} disabled={regenerating} style={{ fontSize: '0.8rem' }}>
            <RefreshCw size={13} /> {regenerating ? 'Generating...' : 'Regenerate'}
          </Button>
        </div>

        {loading ? (
          <p style={{ color: 'var(--fg-muted)', padding: '16px 0', textAlign: 'center' }}>Loading your morning summary...</p>
        ) : error ? (
          <div style={{ color: 'var(--fg-secondary)', padding: '8px 0' }}>
            <p style={{ marginBottom: 6 }}>{error}</p>
            <p style={{ fontSize: '0.85rem', color: 'var(--fg-muted)' }}>Connect WHOOP and add transactions to get personalized insights.</p>
          </div>
        ) : summary ? (
          <div style={{ fontSize: '0.9rem', lineHeight: 1.7, color: 'var(--fg-secondary)', whiteSpace: 'pre-wrap' }}>
            {summary.summary_text}
          </div>
        ) : (
          <TemplateSummary />
        )}
      </Card>

      <Card className="panel">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <TrendingUp size={16} color="var(--accent)" />
          <h3 style={{ fontSize: '0.95rem' }}>Active Goals</h3>
        </div>
        <p style={{ color: 'var(--fg-muted)', fontSize: '0.9rem' }}>
          Set goals in each tab to track progress here. The AI summary factors these into daily recommendations.
        </p>
      </Card>
    </div>
  )
}

function StatCard({ icon, label, value, unit, color, bg }: {
  icon: React.ReactNode; label: string; value: string; unit?: string; color: string; bg: string
}) {
  return (
    <Card className="panel" style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 7,
          background: bg, display: 'flex',
          alignItems: 'center', justifyContent: 'center', color,
        }}>
          {icon}
        </div>
        <span className="stat-label">{label}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
        <span className="stat-value" style={{ fontSize: '1.5rem' }}>{value}</span>
        {unit && <span style={{ fontSize: '0.8rem', color: 'var(--fg-muted)' }}>{unit}</span>}
      </div>
    </Card>
  )
}

function TemplateSummary() {
  return (
    <div style={{ fontSize: '0.9rem', lineHeight: 1.7, color: 'var(--fg-secondary)' }}>
      <p style={{ marginBottom: 14 }}>
        <strong style={{ color: 'var(--fg)' }}>Welcome to your Life Tracker.</strong> Your morning summary will appear here once you have data.
      </p>
      <p style={{ marginBottom: 10 }}>To get started:</p>
      <ul style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <li><strong style={{ color: 'var(--health)' }}>Health</strong> — Connect WHOOP for sleep, recovery, and workout data</li>
        <li><strong style={{ color: 'var(--finance)' }}>Finance</strong> — Add accounts and log transactions or import a CSV</li>
        <li><strong style={{ color: 'var(--journal)' }}>Journal</strong> — Log mood, energy, and daily reflections</li>
      </ul>
      <div style={{
        marginTop: 16, padding: '12px 14px', background: 'var(--accent-light)',
        borderRadius: 'var(--radius-xs)', borderLeft: '3px solid var(--accent)',
        fontSize: '0.85rem',
      }}>
        Once data is flowing, the AI generates personalized morning insights and recommendations based on your goals.
      </div>
    </div>
  )
}
