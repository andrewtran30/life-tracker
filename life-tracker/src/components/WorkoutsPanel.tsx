import { useEffect, useMemo, useState } from 'react'
import { Button, Callout, Card, Dialog, DialogBody, FormGroup, InputGroup, NonIdealState, ProgressBar, Spinner, Tab, Tabs, Tag, TextArea } from '@blueprintjs/core'
import { ChevronRight, Footprints, Zap } from 'lucide-react'
import { api } from '../lib/api'
import type { WhoopWorkoutActivity, Workout, ShoeMileageSummary } from '../lib/types'

const METERS_PER_MILE = 1609.344
const ZONES = ['zero', 'one', 'two', 'three', 'four', 'five']
const ZONE_COLORS = ['#8192a5', '#68b8ed', '#51d8ae', '#ffc46b', '#ff9b6b', '#ff727c']
const WORKOUT_CATEGORIES = ['running', 'hiking', 'tennis', 'weightlifting', 'other']

const SPORT_ALIASES: Record<string, string> = {
  running: 'running', 'trail running': 'running', '0': 'running',
  hiking: 'hiking', rucking: 'hiking', 'hiking rucking': 'hiking', '52': 'hiking',
  walking: 'walking', 'dog walking': 'walking', 'stroller walking': 'walking', '63': 'walking',
  tennis: 'tennis', '34': 'tennis',
  weightlifting: 'weightlifting', 'weight lifting': 'weightlifting', '45': 'weightlifting',
}
const SHOE_SPORTS = ['running', 'walking', 'hiking']

function sportKey(sport: string | null) { return sport?.trim().toLowerCase() || 'activity' }
/** Canonical sport family; WHOOP may send names in different spellings or a numeric sport id. */
function sportFamily(sport: string | null) {
  return SPORT_ALIASES[sportKey(sport).replace(/[-_/]/g, ' ').replace(/\s+/g, ' ')] ?? 'other'
}
function workoutCategory(sport: string | null) {
  const family = sportFamily(sport)
  return WORKOUT_CATEGORIES.includes(family) ? family : 'other'
}
function sportLabel(sport: string | null) {
  if (sport === '0') return 'Running'
  return sportKey(sport).replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}
function tracksShoes(workout: Workout) { return SHOE_SPORTS.includes(sportFamily(workout.sport_name)) }
function formatNumber(value: number | null | undefined, unit = '', decimals = 0) {
  return value == null ? '—' : `${value.toFixed(decimals)}${unit}`
}
function durationLabel(milliseconds: number) {
  const minutes = Math.max(0, Math.round(milliseconds / 60000))
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes} min`
}

export function WorkoutsPanel({ workouts: allWorkouts, onSaved, runningOnly = false }: { workouts: Workout[]; onSaved: (workout: Workout) => void; runningOnly?: boolean }) {
  const workouts = useMemo(() => runningOnly ? allWorkouts.filter(workout => workoutCategory(workout.sport_name) === 'running') : allWorkouts, [allWorkouts, runningOnly])
  const [view, setView] = useState('workouts')
  const [shoeSummary, setShoeSummary] = useState<ShoeMileageSummary | null>(null)
  const [shoeError, setShoeError] = useState('')
  const [shoesLoading, setShoesLoading] = useState(true)
  const [shoesRetry, setShoesRetry] = useState(0)
  useEffect(() => {
    let cancelled = false
    setShoesLoading(true)
    setShoeError('')
    api.whoop.shoes().then(result => { if (!cancelled) setShoeSummary(result) })
      .catch(err => { if (!cancelled) setShoeError(err instanceof Error ? err.message : 'Unable to load shoe mileage.') })
      .finally(() => { if (!cancelled) setShoesLoading(false) })
    return () => { cancelled = true }
  }, [workouts, shoesRetry])
  const [activeTab, setActiveTab] = useState('all')
  const [visibleCount, setVisibleCount] = useState(20)
  const [selected, setSelected] = useState<Workout | null>(null)
  const selectedTab = activeTab === 'all' || WORKOUT_CATEGORIES.includes(activeTab) ? activeTab : 'all'
  function workoutList(items: Workout[]) {
    if (!items.length) return <NonIdealState title="No activities in this category" description="Activities will appear here after syncing WHOOP." />
    return <div className="workout-list">
      {items.slice(0, visibleCount).map(workout => {
        const miles = workout.running_miles ?? (workout.distance_m == null ? null : workout.distance_m / METERS_PER_MILE)
        return <Button minimal key={workout.id} className="workout-row" onClick={() => setSelected(workout)} aria-label={`View ${sportLabel(workout.sport_name)} on ${new Date(workout.start_time).toLocaleDateString()}`}>
          <span className="workout-identity">
            <span className="workout-icon">{tracksShoes(workout) ? <Footprints size={18} /> : <Zap size={18} />}</span>
            <span><strong>{sportLabel(workout.sport_name)}</strong><small>{new Date(workout.start_time).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} · {durationLabel(new Date(workout.end_time).getTime() - new Date(workout.start_time).getTime())}</small>
              {tracksShoes(workout) && <small>{workout.running_shoes || 'No shoes added'}{miles != null ? ` · ${miles.toFixed(2)} mi` : ''}</small>}
            </span>
          </span>
          <span className="workout-metric"><strong>{formatNumber(workout.strain, '', 1)}</strong><small>strain</small></span>
          <span className="workout-metric"><strong>{formatNumber(workout.calories)}</strong><small>calories</small></span>
          <ChevronRight size={16} aria-hidden="true" />
        </Button>
      })}
      {items.length > visibleCount && <Button minimal onClick={() => setVisibleCount(count => count + 20)}>Show more activities ({items.length - visibleCount} remaining)</Button>}
    </div>
  }
  return <>
    <Card className="panel">
      <Tabs id="activity-and-gear" selectedTabId={view} onChange={id => setView(String(id))} renderActiveTabPanelOnly>
        <Tab id="workouts" title="Workouts" panel={<>
      <div className="workouts-heading"><div><h3>{runningOnly ? 'Run history' : 'Workout history'}</h3><p>{runningOnly ? 'Open a run to log your pace, splits, shoes, and how you felt.' : 'Explore saved activities and assign shoes to runs, walks, and hikes.'}</p></div><Tag minimal>{workouts.length} activities</Tag></div>
      {runningOnly ? workoutList(workouts) : workouts.length ? <Tabs id="workout-types" className="workout-tabs" selectedTabId={selectedTab} onChange={id => { setActiveTab(String(id)); setVisibleCount(20) }} renderActiveTabPanelOnly>
        <Tab id="all" title={`All (${workouts.length})`} panel={workoutList(workouts)} />
        {WORKOUT_CATEGORIES.map(type => {
          const items = workouts.filter(w => workoutCategory(w.sport_name) === type)
          return <Tab key={type} id={type} title={`${sportLabel(type)} (${items.length})`} panel={workoutList(items)} />
        })}
      </Tabs> : <NonIdealState icon="heart" title="No workouts yet" description="Sync WHOOP to load your recent activities." />}
        </>} />
        <Tab id="shoes" title="Shoes" panel={<div>
          <div className="workouts-heading"><div><h3>Your shoes</h3><p>Total miles from all saved runs, walks, and hikes.</p></div><Footprints size={22} color="var(--accent)" /></div>
          <p className="muted" style={{ marginBottom: 18 }}>Assign a pair in an activity’s details. Your entered distance takes priority over WHOOP distance. Use a distinct name for each pair.</p>
          {shoesLoading ? <Spinner size={24} aria-label="Loading shoe mileage" /> : shoeError ? <Callout intent="danger">{shoeError} <Button minimal onClick={() => setShoesRetry(value => value + 1)}>Retry</Button></Callout> : <>
            {!!shoeSummary?.unassigned_activities && <Callout style={{ marginBottom: 18 }}>{shoeSummary.unassigned_activities} running, walking, or hiking activities have no shoes assigned. <Button minimal onClick={() => setView('workouts')}>Assign shoes</Button></Callout>}
            {shoeSummary?.shoes.length ? <div className="shoe-grid">{shoeSummary.shoes.map(shoe => <Card key={shoe.name} className="shoe-card">
              <div className="shoe-card-heading"><Footprints size={20} /><h4>{shoe.name}</h4></div>
              <p className="shoe-total">{shoe.total_miles.toFixed(2)} <span>mi total</span></p>
              <dl className="shoe-breakdown"><div><dt>Running</dt><dd>{shoe.running_miles.toFixed(2)} mi</dd></div><div><dt>Walking</dt><dd>{shoe.walking_miles.toFixed(2)} mi</dd></div><div><dt>Hiking</dt><dd>{shoe.hiking_miles.toFixed(2)} mi</dd></div></dl>
              <p className="muted">{shoe.activities} activities{shoe.last_used ? ` · Last worn ${new Date(shoe.last_used).toLocaleDateString()}` : ''}</p>
              {shoe.missing_distance > 0 && <p className="shoe-missing">{shoe.missing_distance} activities need mileage to complete this total.</p>}
            </Card>)}</div> : <NonIdealState icon="walk" title="Start tracking your shoes" description="Open a run, walk, or hike and enter the shoes you wore. Their miles will add up here." action={<Button intent="primary" onClick={() => setView('workouts')}>View workouts</Button>} />}
          </>}
        </div>} />
      </Tabs>
    </Card>
    {selected && <WorkoutDetails key={selected.id} workout={selected} shoes={[...new Set([...(shoeSummary?.shoes.map(shoe => shoe.name) ?? []), ...workouts.map(w => w.running_shoes).filter((name): name is string => !!name)])]} onClose={() => setSelected(null)} onSaved={updated => { onSaved(updated); setSelected(updated) }} />}
  </>
}

function WorkoutDetails({ workout, shoes, onClose, onSaved }: { workout: Workout; shoes: string[]; onClose: () => void; onSaved: (workout: Workout) => void }) {
  const [activity, setActivity] = useState<WhoopWorkoutActivity | null>(null)
  const [archivedAt, setArchivedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [retry, setRetry] = useState(0)
  const [runningShoes, setRunningShoes] = useState(workout.running_shoes ?? '')
  const [runningMiles, setRunningMiles] = useState(workout.running_miles == null ? '' : String(workout.running_miles))
  const [pace, setPace] = useState(workout.running_pace ?? '')
  const [splits, setSplits] = useState(workout.running_splits ?? '')
  const [feeling, setFeeling] = useState(workout.running_feeling ?? '')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saved, setSaved] = useState(false)
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError('')
    api.whoop.workoutDetails(workout.id).then(result => { if (!cancelled) { setActivity(result.activity); setArchivedAt(result.archived_at ?? null) } })
      .catch(err => { if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Unable to load activity.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [workout.id, retry])

  async function saveRun(event: React.FormEvent) {
    event.preventDefault()
    setSaveError('')
    setSaved(false)
    const miles = runningMiles.trim() === '' ? null : Number(runningMiles)
    if (miles != null && (!Number.isFinite(miles) || miles < 0 || miles > 1000)) {
      setSaveError('Enter mileage between 0 and 1,000, or leave it blank.')
      return
    }
    setSaving(true)
    try {
      const result = await api.whoop.saveRunDetails(workout.id, { running_shoes: runningShoes.trim() || null, running_miles: miles, running_pace: pace.trim() || null, running_splits: splits.trim() || null, running_feeling: feeling.trim() || null })
      onSaved(result.workout)
      setSaved(true)
    } catch (err) { setSaveError(err instanceof Error ? err.message : 'Unable to save activity details.') }
    finally { setSaving(false) }
  }

  const score = activity?.score
  const start = activity?.start ?? workout.start_time
  const end = activity?.end ?? workout.end_time
  const distance = score?.distance_meter
  const zones = score?.zone_durations
  const totalZoneTime = ZONES.reduce((sum, zone) => sum + (zones?.[`zone_${zone}_milli`] ?? 0), 0)
  const metric = (label: string, value: string) => <div className="activity-stat" key={label}><span>{label}</span><strong>{value}</strong></div>
  return <Dialog isOpen onClose={onClose} title={sportLabel(activity?.sport_name ?? workout.sport_name)} className="bp6-dark activity-dialog" style={{ width: 680, maxWidth: 'calc(100vw - 24px)' }}>
    <DialogBody>
      <p className="activity-date">{new Date(start).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} · {new Date(start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} – {new Date(end).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</p>
      {archivedAt && <Tag minimal intent="success" icon="database" style={{ marginBottom: 18 }}>Saved in your backend · {new Date(archivedAt).toLocaleDateString()}</Tag>}
      {loading && <div className="activity-loading" role="status"><Spinner size={22} /><span>Loading activity details…</span></div>}
      {loadError && <Callout intent="warning" style={{ marginBottom: 18 }}>{loadError} <Button minimal small onClick={() => setRetry(value => value + 1)}>Retry</Button></Callout>}
      {activity && <>
        {activity.score_state !== 'SCORED' && <Callout style={{ marginBottom: 18 }}>{activity.score_state === 'PENDING_SCORE' ? 'WHOOP is still calculating the score for this activity.' : 'WHOOP could not score this activity. Some metrics are unavailable.'}</Callout>}
        <div className="activity-stats">
          {metric('Duration', durationLabel(new Date(end).getTime() - new Date(start).getTime()))}
          {metric('Activity strain', formatNumber(score?.strain, ' / 21', 1))}
          {metric('Average heart rate', formatNumber(score?.average_heart_rate, ' bpm'))}
          {metric('Max heart rate', formatNumber(score?.max_heart_rate, ' bpm'))}
          {metric('Calories', formatNumber(score?.kilojoule == null ? null : score.kilojoule / 4.184, ' cal'))}
          {metric('WHOOP distance', formatNumber(distance == null ? null : distance / METERS_PER_MILE, ' mi', 2))}
          {metric('Elevation gain', formatNumber(score?.altitude_gain_meter == null ? null : score.altitude_gain_meter * 3.28084, ' ft'))}
          {metric('Elevation change', formatNumber(score?.altitude_change_meter == null ? null : score.altitude_change_meter * 3.28084, ' ft'))}
          {metric('Heart rate recorded', formatNumber(score?.percent_recorded, '%', 1))}
        </div>
        <section className="activity-zones" aria-label="Heart rate zones">
          <h4>Time in heart rate zones</h4>
          {totalZoneTime > 0 ? ZONES.map((zone, index) => {
            const value = zones?.[`zone_${zone}_milli`]
            return <div className="zone-row" key={zone}><span>Zone {index}</span><ProgressBar value={(value ?? 0) / totalZoneTime} stripes={false} animate={false} aria-label={`Zone ${index}`} className={`zone-bar zone-${index}`} /><span>{value == null ? '—' : durationLabel(value)}</span><i style={{ background: ZONE_COLORS[index] }} /></div>
          }) : <p className="muted">WHOOP has no heart rate zone data for this activity yet.</p>}
        </section>
      </>}
      {tracksShoes(workout) && <form className="run-details-form" onSubmit={saveRun}>
        <div><h4>Your activity log</h4><p className="muted">Saved in Life Tracker. WHOOP measurements stay unchanged.</p></div>
        <FormGroup label="Shoes worn" labelFor="running-shoes">
          <InputGroup id="running-shoes" placeholder="e.g. Nike Pegasus 41" value={runningShoes} maxLength={200} list="running-shoe-options" onChange={event => { setRunningShoes(event.target.value); setSaved(false) }} disabled={saving} />
          <datalist id="running-shoe-options">{shoes.map(shoe => <option key={shoe} value={shoe} />)}</datalist>
        </FormGroup>
        <FormGroup label="Distance (miles)" labelFor="running-miles" helperText="Enter your own distance; leave blank to use WHOOP distance in the workout list.">
          <InputGroup id="running-miles" type="number" min="0" max="1000" step="any" placeholder="e.g. 5.25" value={runningMiles} onChange={event => { setRunningMiles(event.target.value); setSaved(false) }} disabled={saving} />
        </FormGroup>
        {workoutCategory(workout.sport_name) === 'running' && <>
          <FormGroup label="Average pace per mile" labelFor="running-pace" helperText="For example, 8:35 per mile."><InputGroup id="running-pace" placeholder="8:35" maxLength={40} value={pace} onChange={event => { setPace(event.target.value); setSaved(false) }} disabled={saving} /></FormGroup>
          <FormGroup label="Mile splits" labelFor="running-splits" helperText="Enter each mile and its time, one per line."><TextArea id="running-splits" fill maxLength={4000} placeholder={'Mile 1: 8:45\nMile 2: 8:30'} value={splits} onChange={event => { setSplits(event.target.value); setSaved(false) }} disabled={saving} /></FormGroup>
          <FormGroup label="How did you feel?" labelFor="running-feeling"><TextArea id="running-feeling" fill maxLength={4000} placeholder="Notes on effort, energy, or anything else" value={feeling} onChange={event => { setFeeling(event.target.value); setSaved(false) }} disabled={saving} /></FormGroup>
        </>}
        {saveError && <Callout intent="danger" role="alert">{saveError}</Callout>}
        {saved && <Callout intent="success" role="status" icon="tick">Activity details saved.</Callout>}
        <Button intent="primary" type="submit" loading={saving} icon="floppy-disk">Save activity details</Button>
      </form>}
    </DialogBody>
  </Dialog>
}
