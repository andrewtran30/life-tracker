import { Button, Card, Callout, ProgressBar, Spinner } from '@blueprintjs/core'
import type { CSSProperties } from 'react'
import { useState, useEffect, useCallback, useRef } from 'react'
import { Heart, Moon, Activity, Zap, RefreshCw, Link2, Clock } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { supabase } from '../lib/supabase'
import { api } from '../lib/api'
import { WorkoutsPanel } from '../components/WorkoutsPanel'
import type { SleepRecord, RecoveryRecord, Workout, WhoopDailyScore } from '../lib/types'

function localDay(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

async function loadWorkoutHistory(connectionId: string) {
  const workouts: Workout[] = []
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.from('workouts').select('*').eq('connection_id', connectionId)
      .order('start_time', { ascending: false }).order('id').range(offset, offset + 999)
    if (error) throw error
    workouts.push(...(data ?? []))
    if (!data || data.length < 1000) return workouts
  }
}

export function HealthPage() {
  const [connected, setConnected] = useState<boolean | null>(null)
  const [lastSynced, setLastSynced] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [sleepRecords, setSleepRecords] = useState<SleepRecord[]>([])
  const [recoveryRecords, setRecoveryRecords] = useState<RecoveryRecord[]>([])
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [dailyScores, setDailyScores] = useState<WhoopDailyScore[]>([])
  const [scoresError, setScoresError] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const initialSync = useRef<Promise<unknown> | null>(null)

  const loadData = useCallback(async () => {
    setError('')
    setScoresError('')
    try {
      const status = await api.whoop.status()
      setConnected(status.connected)
      setLastSynced(status.last_synced_at)

      if (status.connected) {
        if (!status.last_synced_at) {
          setSyncing(true)
          initialSync.current ??= api.whoop.sync()
          await initialSync.current
          const updatedStatus = await api.whoop.status()
          setLastSynced(updatedStatus.last_synced_at)
        }
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Please sign in again to load your health data.')
        const { data: conn, error: connectionError } = await supabase.from('whoop_connections').select('id').eq('user_id', user.id).single()
        if (connectionError) throw connectionError
        if (conn) {
          const [sleep, recovery, workout, scores] = await Promise.all([
            supabase.from('sleep_records').select('*').eq('connection_id', conn.id).order('end_time', { ascending: false }).limit(7),
            supabase.from('recovery_records').select('*').eq('connection_id', conn.id).order('date', { ascending: false }).limit(7),
            loadWorkoutHistory(conn.id),
            api.whoop.dailyScores().catch((err: unknown) => {
              setScoresError(err instanceof Error ? err.message : 'Unable to load daily scores.')
              return { days: [] }
            }),
          ])
          if (sleep.error) throw sleep.error
          if (recovery.error) throw recovery.error
          setSleepRecords(sleep.data ?? [])
          setRecoveryRecords(recovery.data ?? [])
          setWorkouts(workout)
          setDailyScores(scores.days)
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load WHOOP data. Please try again.')
    } finally {
      setSyncing(false)
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  async function handleConnect() {
    try {
      const { url, state } = await api.whoop.getAuthUrl()
      sessionStorage.setItem('whoop_oauth_state', state)
      window.location.href = url
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to connect WHOOP.') }
  }

  async function handleSync() {
    setSyncing(true)
    setError('')
    try {
      await api.whoop.sync()
      initialSync.current = null
      await loadData()
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to sync WHOOP data.') }
    setSyncing(false)
  }

  const sleepChartData = [...sleepRecords].reverse().map(s => ({
    date: new Date(s.end_time).toLocaleDateString('en-US', { weekday: 'short' }),
    score: s.score,
  }))

  const recoveryChartData = [...recoveryRecords].reverse().map(r => ({
    date: new Date(`${r.date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short' }),
    score: r.recovery_score,
  }))

  const todayKey = localDay(new Date())
  const scoresByDay = new Map(dailyScores.map(day => [localDay(new Date(day.sleep_end_time ?? day.start_time)), day]))
  const today = scoresByDay.get(todayKey)
  const strainChartData = Array.from({ length: 7 }, (_, index) => {
    const date = new Date()
    date.setDate(date.getDate() - 6 + index)
    return {
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      score: scoresByDay.get(localDay(date))?.strain ?? null,
    }
  })
  const todayCards = [
    { label: 'Sleep performance', value: today?.sleep_score, max: 100, unit: '%', color: 'var(--accent)', Icon: Moon },
    { label: 'Recovery', value: today?.recovery_score, max: 100, unit: '%', color: 'var(--health)', Icon: Heart },
    { label: 'Day strain', value: today?.strain, max: 21, unit: '/ 21', color: 'var(--finance)', Icon: Zap },
  ]

  const tooltipStyle = {
    contentStyle: {
      background: 'var(--bg-surface)', border: '1px solid var(--border)',
      borderRadius: 8, fontSize: 13, color: 'var(--fg)',
    },
  }

  if (loading) return <div role="status" style={{ padding: 60, textAlign: 'center' }}><Spinner size={28} /><p style={{ color: 'var(--fg-muted)', marginTop: 16 }}>Loading health data...</p></div>

  return (
    <div style={{ maxWidth: 860 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', marginBottom: 2 }}>Health</h1>
          <p style={{ color: 'var(--fg-muted)', fontSize: '0.9rem' }}>WHOOP recovery, sleep, and workout data</p>
        </div>
        {connected ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {lastSynced && (
              <span style={{ fontSize: '0.75rem', color: 'var(--fg-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Clock size={12} /> {new Date(lastSynced).toLocaleString()}
              </span>
            )}
            <Button  onClick={handleSync} disabled={syncing}>
              <RefreshCw size={13} /> {syncing ? 'Syncing...' : 'Sync'}
            </Button>
          </div>
        ) : connected === false ? (
          <Button intent="primary" onClick={handleConnect}><Link2 size={14} /> Connect WHOOP</Button>
        ) : null}
      </div>

      {error && <Callout intent="danger" role="alert" style={{ marginBottom: 20 }}>{error}</Callout>}
      {connected === null ? (
        <Button  onClick={loadData}>Retry loading WHOOP connection</Button>
      ) : !connected ? (
        <Card className="panel" style={{ textAlign: 'center', padding: '48px 32px' }}>
          <Heart size={40} color="var(--health)" style={{ marginBottom: 14 }} />
          <h3 style={{ fontSize: '1.1rem', marginBottom: 6 }}>Connect Your WHOOP</h3>
          <p style={{ color: 'var(--fg-secondary)', maxWidth: 400, margin: '0 auto 20px', fontSize: '0.9rem' }}>
            Link your WHOOP account to sync sleep scores, recovery metrics, strain, and workout history.
          </p>
          <Button intent="primary" onClick={handleConnect}><Link2 size={14} /> Connect WHOOP Account</Button>
        </Card>
      ) : (
        <>
          <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
            <h2 style={{ fontSize: '1rem' }}>Today’s scores</h2>
            <span style={{ color: 'var(--fg-muted)', fontSize: '0.8rem' }}>{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 12 }}>
            {todayCards.map(({ label, value, max, unit, color, Icon }) => (
              <Card className="panel score-panel" key={label} style={{ '--score-color': color } as CSSProperties}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color, marginBottom: 14 }}>
                  <Icon size={17} aria-hidden="true" />
                  <h3 style={{ fontSize: '0.85rem' }}>{label}</h3>
                </div>
                <p style={{ fontSize: '2rem', fontWeight: 600, fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>
                  {value == null ? '—' : max === 21 ? value.toFixed(1) : Math.round(value)}
                  {value != null && <span style={{ fontSize: '0.9rem', color: 'var(--fg-muted)', marginLeft: 4 }}>{unit}</span>}
                </p>
                <ProgressBar value={Math.max(0, Math.min(1, (value ?? 0) / max))} stripes={false} animate={false} aria-label={`${label}: ${value == null ? 'not available' : value}`} />
                <p style={{ color: 'var(--fg-muted)', fontSize: '0.75rem', marginTop: 8 }}>
                  {scoresError ? 'Unable to load score' : value == null ? 'Not available for today yet' : max === 21 ? 'WHOOP daily cycle · so far' : 'Today’s WHOOP score'}
                </p>
              </Card>
            ))}
          </div>
          <p style={{ color: 'var(--fg-muted)', fontSize: '0.75rem', marginBottom: 20 }}>Scores use your local day. Day strain follows WHOOP’s physiological cycle and updates when you refresh or sync.</p>
          {scoresError && <p role="alert" style={{ color: 'var(--danger)', marginBottom: 20 }}>{scoresError} <Button  onClick={loadData}>Retry scores</Button></p>}

          <div className="health-trends">
          <Card className="panel" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Moon size={16} color="var(--accent)" />
              <h3 style={{ fontSize: '0.95rem' }}>Sleep Performance</h3>
            </div>
            {sleepChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={sleepChartData}>
                  <defs>
                    <linearGradient id="sleepGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fill: 'var(--fg-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fill: 'var(--fg-muted)', fontSize: 12 }} axisLine={false} tickLine={false} width={30} />
                  <Tooltip {...tooltipStyle} formatter={v => [`${v}/100`, 'Sleep Score']} />
                  <Area type="monotone" dataKey="score" stroke="var(--accent)" fill="url(#sleepGrad)" strokeWidth={2} dot={{ fill: 'var(--accent)', r: 3 }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p style={{ color: 'var(--fg-muted)', textAlign: 'center', padding: 16 }}>No sleep data yet. Hit Sync to pull from WHOOP.</p>
            )}
          </Card>

          <Card className="panel" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Activity size={16} color="var(--health)" />
              <h3 style={{ fontSize: '0.95rem' }}>Recovery</h3>
            </div>
            {recoveryChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={recoveryChartData}>
                  <defs>
                    <linearGradient id="recoveryGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--health)" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="var(--health)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fill: 'var(--fg-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fill: 'var(--fg-muted)', fontSize: 12 }} axisLine={false} tickLine={false} width={30} />
                  <Tooltip {...tooltipStyle} formatter={v => [`${v}%`, 'Recovery']} />
                  <Area type="monotone" dataKey="score" stroke="var(--health)" fill="url(#recoveryGrad)" strokeWidth={2} dot={{ fill: 'var(--health)', r: 3 }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p style={{ color: 'var(--fg-muted)', textAlign: 'center', padding: 16 }}>No recovery data yet.</p>
            )}
          </Card>

          <Card className="panel" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Zap size={16} color="var(--finance)" />
              <h3 style={{ fontSize: '0.95rem' }}>Daily Strain</h3>
            </div>
            <p style={{ color: 'var(--fg-muted)', fontSize: '0.8rem', marginBottom: 16 }}>Last 7 days · WHOOP day strain, on a 0–21 scale</p>
            {strainChartData.some(day => day.score != null) ? (
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={strainChartData}>
                  <defs>
                    <linearGradient id="strainGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--finance)" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="var(--finance)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fill: 'var(--fg-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 21]} ticks={[0, 7, 14, 21]} tick={{ fill: 'var(--fg-muted)', fontSize: 12 }} axisLine={false} tickLine={false} width={30} />
                  <Tooltip {...tooltipStyle} formatter={value => [typeof value === 'number' ? `${value.toFixed(1)} / 21` : '—', 'Day strain']} />
                  <Area type="monotone" dataKey="score" stroke="var(--finance)" fill="url(#strainGrad)" strokeWidth={2} dot={{ fill: 'var(--finance)', r: 3 }} connectNulls={false} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p style={{ color: 'var(--fg-muted)', textAlign: 'center', padding: 16 }}>{scoresError ? 'Daily strain is currently unavailable.' : 'No scored cycles in the last 7 days yet.'}</p>
            )}
          </Card>

          </div>

          <WorkoutsPanel workouts={workouts} onSaved={updated => setWorkouts(previous => previous.map(workout => workout.id === updated.id ? updated : workout))} />
        </>
      )}
    </div>
  )
}
