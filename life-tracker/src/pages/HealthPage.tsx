import { useState, useEffect, useCallback } from 'react'
import { Heart, Moon, Activity, Zap, RefreshCw, Link2, Clock } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { supabase } from '../lib/supabase'
import { api } from '../lib/api'
import type { SleepRecord, RecoveryRecord, Workout } from '../lib/types'

export function HealthPage() {
  const [connected, setConnected] = useState(false)
  const [lastSynced, setLastSynced] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [sleepRecords, setSleepRecords] = useState<SleepRecord[]>([])
  const [recoveryRecords, setRecoveryRecords] = useState<RecoveryRecord[]>([])
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    try {
      const status = await api.whoop.status()
      setConnected(status.connected)
      setLastSynced(status.last_synced_at)

      if (status.connected) {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: conn } = await supabase.from('whoop_connections').select('id').eq('user_id', user.id).single()
        if (conn) {
          const [sleep, recovery, workout] = await Promise.all([
            supabase.from('sleep_records').select('*').eq('connection_id', conn.id).order('end_time', { ascending: false }).limit(7),
            supabase.from('recovery_records').select('*').eq('connection_id', conn.id).order('date', { ascending: false }).limit(7),
            supabase.from('workouts').select('*').eq('connection_id', conn.id).order('start_time', { ascending: false }).limit(10),
          ])
          setSleepRecords(sleep.data ?? [])
          setRecoveryRecords(recovery.data ?? [])
          setWorkouts(workout.data ?? [])
        }
      }
    } catch { /* backend may be down */ }
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  async function handleConnect() {
    try {
      const { url, state } = await api.whoop.getAuthUrl()
      sessionStorage.setItem('whoop_oauth_state', state)
      window.location.href = url
    } catch (err) { console.error(err) }
  }

  async function handleSync() {
    setSyncing(true)
    try { await api.whoop.sync(); await loadData() } catch (err) { console.error(err) }
    setSyncing(false)
  }

  const sleepChartData = [...sleepRecords].reverse().map(s => ({
    date: new Date(s.end_time).toLocaleDateString('en-US', { weekday: 'short' }),
    score: s.score ?? 0,
  }))

  const recoveryChartData = [...recoveryRecords].reverse().map(r => ({
    date: new Date(r.date).toLocaleDateString('en-US', { weekday: 'short' }),
    score: r.recovery_score ?? 0,
  }))

  const tooltipStyle = {
    contentStyle: {
      background: 'var(--bg-surface)', border: '1px solid var(--border)',
      borderRadius: 8, fontSize: 13, color: 'var(--fg)',
    },
  }

  if (loading) return <p style={{ color: 'var(--fg-muted)', padding: 40, textAlign: 'center' }}>Loading health data...</p>

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
            <button className="btn btn-secondary" onClick={handleSync} disabled={syncing}>
              <RefreshCw size={13} /> {syncing ? 'Syncing...' : 'Sync'}
            </button>
          </div>
        ) : (
          <button className="btn btn-primary" onClick={handleConnect}><Link2 size={14} /> Connect WHOOP</button>
        )}
      </div>

      {!connected ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px 32px' }}>
          <Heart size={40} color="var(--health)" style={{ marginBottom: 14 }} />
          <h3 style={{ fontSize: '1.1rem', marginBottom: 6 }}>Connect Your WHOOP</h3>
          <p style={{ color: 'var(--fg-secondary)', maxWidth: 400, margin: '0 auto 20px', fontSize: '0.9rem' }}>
            Link your WHOOP account to sync sleep scores, recovery metrics, strain, and workout history.
          </p>
          <button className="btn btn-primary" onClick={handleConnect}><Link2 size={14} /> Connect WHOOP Account</button>
        </div>
      ) : (
        <>
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Moon size={16} color="var(--accent)" />
              <h3 style={{ fontSize: '0.95rem' }}>Sleep Performance</h3>
            </div>
            {sleepChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={sleepChartData}>
                  <defs>
                    <linearGradient id="sleepGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#7C3AED" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fill: '#A8A29E', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fill: '#A8A29E', fontSize: 12 }} axisLine={false} tickLine={false} width={30} />
                  <Tooltip {...tooltipStyle} formatter={(v: number) => [`${v}/100`, 'Sleep Score']} />
                  <Area type="monotone" dataKey="score" stroke="#7C3AED" fill="url(#sleepGrad)" strokeWidth={2} dot={{ fill: '#7C3AED', r: 3 }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p style={{ color: 'var(--fg-muted)', textAlign: 'center', padding: 16 }}>No sleep data yet. Hit Sync to pull from WHOOP.</p>
            )}
          </div>

          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Activity size={16} color="var(--health)" />
              <h3 style={{ fontSize: '0.95rem' }}>Recovery</h3>
            </div>
            {recoveryChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={recoveryChartData}>
                  <defs>
                    <linearGradient id="recoveryGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#059669" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fill: '#A8A29E', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fill: '#A8A29E', fontSize: 12 }} axisLine={false} tickLine={false} width={30} />
                  <Tooltip {...tooltipStyle} formatter={(v: number) => [`${v}%`, 'Recovery']} />
                  <Area type="monotone" dataKey="score" stroke="#059669" fill="url(#recoveryGrad)" strokeWidth={2} dot={{ fill: '#059669', r: 3 }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p style={{ color: 'var(--fg-muted)', textAlign: 'center', padding: 16 }}>No recovery data yet.</p>
            )}
          </div>

          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Zap size={16} color="var(--finance)" />
              <h3 style={{ fontSize: '0.95rem' }}>Recent Workouts</h3>
            </div>
            {workouts.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {workouts.map(w => (
                  <div key={w.id} style={{
                    display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 16,
                    padding: '10px 14px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-xs)',
                    alignItems: 'center', fontSize: '0.85rem',
                  }}>
                    <span style={{ fontWeight: 500 }}>{w.sport_name || 'Workout'}</span>
                    <span style={{ color: 'var(--fg-muted)', fontVariantNumeric: 'tabular-nums' }}>{w.strain?.toFixed(1)} strain</span>
                    <span style={{ color: 'var(--fg-muted)', fontVariantNumeric: 'tabular-nums' }}>{w.calories?.toFixed(0)} cal</span>
                    <span style={{ color: 'var(--fg-muted)' }}>
                      {new Date(w.start_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: 'var(--fg-muted)', textAlign: 'center', padding: 16 }}>No workouts recorded yet.</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
