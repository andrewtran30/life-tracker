import { useState, useEffect, useCallback } from 'react'
import { BookOpen, ChevronLeft, ChevronRight, Save, Smile } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { JournalEntry, JournalPrompt, JournalResponse } from '../lib/types'

const MOOD_LABELS = ['', 'Awful', 'Bad', 'Poor', 'Low', 'Meh', 'Okay', 'Good', 'Great', 'Amazing', 'Perfect']
const ENERGY_LABELS = ['', 'Exhausted', 'Drained', 'Tired', 'Low', 'Average', 'Fine', 'Energized', 'Strong', 'Fired Up', 'Unstoppable']

export function JournalPage() {
  const [currentDate, setCurrentDate] = useState(new Date().toISOString().split('T')[0])
  const [entry, setEntry] = useState<JournalEntry | null>(null)
  const [prompts, setPrompts] = useState<JournalPrompt[]>([])
  const [responses, setResponses] = useState<Record<string, string>>({})
  const [moodScore, setMoodScore] = useState<number>(0)
  const [energyScore, setEnergyScore] = useState<number>(0)
  const [freeformText, setFreeformText] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)
    setSaved(false)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [promptsRes, entryRes] = await Promise.all([
      supabase.from('journal_prompts').select('*').or(`user_id.is.null,user_id.eq.${user.id}`).eq('is_active', true).order('sort_order'),
      supabase.from('journal_entries').select('*').eq('user_id', user.id).eq('date', currentDate).single(),
    ])

    setPrompts(promptsRes.data ?? [])

    if (entryRes.data) {
      setEntry(entryRes.data)
      setMoodScore(entryRes.data.mood_score ?? 0)
      setEnergyScore(entryRes.data.energy_score ?? 0)
      setFreeformText(entryRes.data.freeform_text ?? '')

      const { data: resps } = await supabase
        .from('journal_responses')
        .select('*')
        .eq('entry_id', entryRes.data.id)

      const respMap: Record<string, string> = {}
      for (const r of resps ?? []) respMap[r.prompt_id] = r.response_text
      setResponses(respMap)
    } else {
      setEntry(null)
      setMoodScore(0)
      setEnergyScore(0)
      setFreeformText('')
      setResponses({})
    }
    setLoading(false)
  }, [currentDate])

  useEffect(() => { loadData() }, [loadData])

  async function handleSave() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    let entryId = entry?.id
    if (entryId) {
      await supabase.from('journal_entries').update({
        mood_score: moodScore || null,
        energy_score: energyScore || null,
        freeform_text: freeformText || null,
      }).eq('id', entryId)
    } else {
      const { data } = await supabase.from('journal_entries').insert({
        user_id: user.id,
        date: currentDate,
        mood_score: moodScore || null,
        energy_score: energyScore || null,
        freeform_text: freeformText || null,
      }).select().single()
      entryId = data?.id
    }

    if (entryId) {
      const upserts = Object.entries(responses)
        .filter(([, text]) => text.trim())
        .map(([promptId, text]) => ({
          entry_id: entryId!,
          prompt_id: promptId,
          response_text: text,
        }))

      if (upserts.length) {
        await supabase.from('journal_responses').upsert(upserts, { onConflict: 'entry_id,prompt_id' })
      }
    }

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    loadData()
  }

  function changeDate(delta: number) {
    const d = new Date(currentDate)
    d.setDate(d.getDate() + delta)
    setCurrentDate(d.toISOString().split('T')[0])
  }

  const isToday = currentDate === new Date().toISOString().split('T')[0]
  const dateLabel = new Date(currentDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  if (loading) return <div style={{ color: 'var(--fg-muted)', padding: 40, textAlign: 'center' }}>Loading journal...</div>

  return (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: 4 }}>Journal</h1>
          <p style={{ color: 'var(--fg-muted)' }}>Daily reflections, mood, and energy</p>
        </div>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          <Save size={14} /> {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Entry'}
        </button>
      </div>

      {/* Date Navigation */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16,
        marginBottom: 32,
      }}>
        <button className="btn btn-ghost" onClick={() => changeDate(-1)} style={{ padding: 8 }}>
          <ChevronLeft size={18} />
        </button>
        <div style={{ textAlign: 'center', minWidth: 200 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '1.1rem' }}>{dateLabel}</div>
          {isToday && <span style={{ fontSize: '0.75rem', color: 'var(--accent)' }}>Today</span>}
        </div>
        <button className="btn btn-ghost" onClick={() => changeDate(1)} disabled={isToday} style={{ padding: 8, opacity: isToday ? 0.3 : 1 }}>
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Mood & Energy */}
      <div className="glass-card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <Smile size={18} color="var(--journal)" />
          <h3 style={{ fontSize: '1rem' }}>How are you feeling?</h3>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span className="label" style={{ margin: 0 }}>Mood</span>
            <span style={{ fontSize: '0.85rem', color: moodScore ? 'var(--journal)' : 'var(--fg-muted)' }}>
              {moodScore ? `${moodScore}/10 — ${MOOD_LABELS[moodScore]}` : 'Not set'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[1,2,3,4,5,6,7,8,9,10].map(n => (
              <button key={n} onClick={() => setMoodScore(n)} style={{
                flex: 1, height: 36, borderRadius: 'var(--radius-xs)', border: 'none', cursor: 'pointer',
                background: n <= moodScore ? 'var(--journal)' : 'var(--bg-surface)',
                color: n <= moodScore ? '#0e0a1a' : 'var(--fg-muted)',
                fontWeight: 600, fontSize: '0.8rem',
                transition: 'all 0.15s',
              }}>
                {n}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span className="label" style={{ margin: 0 }}>Energy</span>
            <span style={{ fontSize: '0.85rem', color: energyScore ? 'var(--accent)' : 'var(--fg-muted)' }}>
              {energyScore ? `${energyScore}/10 — ${ENERGY_LABELS[energyScore]}` : 'Not set'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[1,2,3,4,5,6,7,8,9,10].map(n => (
              <button key={n} onClick={() => setEnergyScore(n)} style={{
                flex: 1, height: 36, borderRadius: 'var(--radius-xs)', border: 'none', cursor: 'pointer',
                background: n <= energyScore ? 'var(--accent)' : 'var(--bg-surface)',
                color: n <= energyScore ? '#0e0a1a' : 'var(--fg-muted)',
                fontWeight: 600, fontSize: '0.8rem',
                transition: 'all 0.15s',
              }}>
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Prompts */}
      <div className="glass-card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <BookOpen size={18} color="var(--accent)" />
          <h3 style={{ fontSize: '1rem' }}>Guided Prompts</h3>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {prompts.map(p => (
            <div key={p.id}>
              <label style={{
                display: 'block', fontSize: '0.9rem', fontWeight: 500,
                color: 'var(--fg-primary)', marginBottom: 8,
              }}>
                {p.text}
              </label>
              <textarea
                className="input"
                placeholder="Write your thoughts..."
                value={responses[p.id] ?? ''}
                onChange={e => setResponses(prev => ({ ...prev, [p.id]: e.target.value }))}
                rows={3}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Freeform */}
      <div className="glass-card">
        <h3 style={{ fontSize: '1rem', marginBottom: 12 }}>Free Writing</h3>
        <textarea
          className="input"
          placeholder="Anything else on your mind..."
          value={freeformText}
          onChange={e => setFreeformText(e.target.value)}
          rows={6}
        />
      </div>
    </div>
  )
}
