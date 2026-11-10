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

        const { data: conn } = await supabase
          .from('whoop_connections')
          .select('id')
          .eq('user_id', user.id)
          .single()

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
    } catch { /* status check may fail if backend is down */ }
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  async function handleConnect() {
    try {
      const { url } = await api.whoop.getAuthUrl()
      window.location.href = url
    } catch (err) {
      console.error('Failed to get WHOOP auth URL:', err)
    }
  }

  async function handleSync() {
    setSyncing(true)
    try {
      await api.whoop.sync()
      await loadData()
    } catch (err) {
      console.error('Sync failed:', err)
    }
    setSyncing(false)
  }

  const sleepChartData = [...sleepRecords].reverse().map(s => ({
    date: new Date(s.end_time).toLocaleDateString('en-US', { weekday: 'short' }),
    score: s.score ?? 0,
    hours: ((new Date(s.end_time).getTime() - new Date(s.start_time).getTime()) / 3600000),
  }))

  const recoveryChartData = [...recoveryRecords].reverse().map(r => ({
    date: new Date(r.date).toLocaleDateString('en-US', { weekday: 'short' }),
    score: r.recovery_score ?? 0,
    hrv: r.hrv_rmssd ?? 0,
  }))

  if (loading) {
    return <div style={{ color: 'var(--fg-muted)', padding: 40, textAlign: 'center' }}>Loading health data...</div>
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: 4 }}>Health</h1>
          <p style={{ color: 'var(--fg-muted)' }}>WHOOP recovery, sleep, and workout data</p>
        </div>
        {connected ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {lastSynced && (
              <span style={{ fontSize: '0.8rem', color: 'var(--fg-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Clock size={12} /> Last synced {new Date(lastSynced).toLocaleString()}
              </span>
            )}
            <button className="btn btn-secondary" onClick={handleSync} disabled={syncing}>
              <RefreshCw size={14} /> {syncing ? 'Syncing...' : 'Sync'}
            </button>
          </div>
        ) : (
          <button className="btn btn-primary" onClick={handleConnect}>
            <Link2 size={16} /> Connect WHOOP
          </button>
        )}
      </div>

      {!connected ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '60px 40px' }}>
          <Heart size={48} color="var(--health)" style={{ marginBottom: 16 }} />
          <h3 style={{ marginBottom: 8 }}>Connect Your WHOOP</h3>
          <p style={{ color: 'var(--fg-secondary)', maxWidth: 440, margin: '0 auto 24px' }}>
            Link your WHOOP account to automatically sync sleep scores, recovery metrics, strain data, and workout history.
          </p>
          <button className="btn btn-primary" onClick={handleConnect}>
            <Link2 size={16} /> Connect WHOOP Account
          </button>
        </div>
      ) : (
        <>
          {/* Sleep Chart */}
          <div className="glass-card" style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <Moon size={18} color="var(--accent)" />
              <h3 style={{ fontSize: '1rem' }}>Sleep Performance</h3>
            </div>
            {sleepChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={sleepChartData}>
                  <defs>
                    <linearGradient id="sleepGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fill: '#7a6f95', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fill: '#7a6f95', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: '#1a1528', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#f0ecf9', fontSize: 13 }}
                    formatter={(v: number, name: string) => [name === 'score' ? `${v}/100` : `${v.toFixed(1)}h`, name === 'score' ? 'Sleep Score' : 'Duration']}
                  />
                  <Area type="monotone" dataKey="score" stroke="var(--accent)" fill="url(#sleepGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p style={{ color: 'var(--fg-muted)', textAlign: 'center', padding: 20 }}>No sleep data yet. Hit Sync to pull from WHOOP.</p>
            )}
          </div>

          {/* Recovery Chart */}
          <div className="glass-card" style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <Activity size={18} color="var(--health)" />
              <h3 style={{ fontSize: '1rem' }}>Recovery</h3>
            </div>
            {recoveryChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={recoveryChartData}>
                  <defs>
                    <linearGradient id="recoveryGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--health)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--health)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fill: '#7a6f95', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fill: '#7a6f95', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: '#1a1528', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#f0ecf9', fontSize: 13 }}
                    formatter={(v: number) => [`${v}%`, 'Recovery']}
                  />
                  <Area type="monotone" dataKey="score" stroke="var(--health)" fill="url(#recoveryGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p style={{ color: 'var(--fg-muted)', textAlign: 'center', padding: 20 }}>No recovery data yet.</p>
            )}
          </div>

          {/* Workouts List */}
          <div className="glass-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <Zap size={18} color="var(--finance)" />
              <h3 style={{ fontSize: '1rem' }}>Recent Workouts</h3>
            </div>
            {workouts.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {workouts.map(w => (
                  <div key={w.id} style={{
                    display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 16,
                    padding: '12px 16px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-xs)',
                    alignItems: 'center', fontSize: '0.85rem',
                  }}>
                    <span style={{ fontWeight: 500 }}>{w.sport_name || 'Workout'}</span>
                    <span style={{ color: 'var(--fg-muted)' }}>{w.strain?.toFixed(1)} strain</span>
                    <span style={{ color: 'var(--fg-muted)' }}>{w.calories?.toFixed(0)} cal</span>
                    <span style={{ color: 'var(--fg-muted)' }}>
                      {new Date(w.start_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: 'var(--fg-muted)', textAlign: 'center', padding: 20 }}>No workouts recorded yet.</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
