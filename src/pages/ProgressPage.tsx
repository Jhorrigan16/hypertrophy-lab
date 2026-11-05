import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useSearchParams } from 'react-router-dom'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  CartesianGrid,
  LineChart,
  Line,
} from 'recharts'
import { format, parseISO, startOfWeek } from 'date-fns'
import { db } from '@/db/database'
import { useSettings } from '@/hooks/useSettings'
import { workingSetVolume, workingSetCount, aggregateMuscleVolume } from '@/lib/volume'
import { bestE1rmEstimate } from '@/lib/e1rm'
import { formatWeight } from '@/lib/units'
import {
  buildRunningSessionSeries,
  buildRunningWeeklyMileage,
  formatDistance,
  formatDuration,
  formatPaceClock,
  metersToDisplay,
} from '@/lib/cardio'
import { Card } from '@/components/ui/Card'
import { readinessScore } from '@/lib/readiness'
import type { MuscleGroup } from '@/db/types'

type Tab = 'volume' | 'strength' | 'muscle' | 'consistency' | 'prs' | 'cardio' | 'readiness'
type CardioSub = 'all' | 'run'

const TAB_IDS: Tab[] = [
  'volume',
  'strength',
  'muscle',
  'consistency',
  'prs',
  'cardio',
  'readiness',
]

export function ProgressPage() {
  const settings = useSettings()
  const unit = settings?.weightUnit ?? 'lb'
  const [params, setParams] = useSearchParams()
  const tabParam = params.get('tab')
  const tab: Tab = TAB_IDS.includes(tabParam as Tab) ? (tabParam as Tab) : 'volume'
  const cardioSub: CardioSub = params.get('cardio') === 'run' ? 'run' : 'all'
  const [exerciseFilter, setExerciseFilter] = useState<number | 'all'>('all')

  function setTab(next: Tab) {
    const nextParams = new URLSearchParams(params)
    if (next === 'volume') nextParams.delete('tab')
    else nextParams.set('tab', next)
    if (next !== 'cardio') nextParams.delete('cardio')
    setParams(nextParams, { replace: true })
  }

  function setCardioSub(next: CardioSub) {
    const nextParams = new URLSearchParams(params)
    nextParams.set('tab', 'cardio')
    if (next === 'all') nextParams.delete('cardio')
    else nextParams.set('cardio', 'run')
    setParams(nextParams, { replace: true })
  }

  const exercises = useLiveQuery(() => db.exercises.orderBy('name').toArray())
  const sessions = useLiveQuery(() =>
    db.workoutSessions.where('status').equals('completed').toArray(),
  )
  const prs = useLiveQuery(async () => {
    const rows = await db.personalRecords.orderBy('achievedAt').reverse().toArray()
    return Promise.all(
      rows.map(async (pr) => ({
        ...pr,
        name: (await db.exercises.get(pr.exerciseId))?.name ?? 'Exercise',
      })),
    )
  })
  const readiness = useLiveQuery(() => db.readinessEntries.orderBy('date').toArray())
  const cardioSessions = useLiveQuery(() =>
    db.cardioSessions.where('status').equals('completed').toArray(),
  )

  const chartData = useLiveQuery(async () => {
    const completed = await db.workoutSessions.where('status').equals('completed').toArray()
    if (completed.length === 0) {
      return {
        weeklyVolume: [],
        weeklySets: [],
        strength: [],
        muscle: [] as Array<{ muscle: string; volume: number; sets: number }>,
        calendar: [] as Array<{ date: string; count: number }>,
      }
    }

    const weekMap = new Map<string, { volume: number; sets: number; workouts: number }>()
    const muscleRows: Array<{ primaryMuscle: MuscleGroup; volume: number; sets: number }> = []
    const calendarMap = new Map<string, number>()
    const strengthSeries: Array<{ date: string; e1rm: number; name: string }> = []

    for (const session of completed) {
      if (!session.completedAt) continue
      const day = session.completedAt.slice(0, 10)
      calendarMap.set(day, (calendarMap.get(day) ?? 0) + 1)
      const weekKey = format(
        startOfWeek(parseISO(session.completedAt), { weekStartsOn: 1 }),
        'yyyy-MM-dd',
      )
      const week = weekMap.get(weekKey) ?? { volume: 0, sets: 0, workouts: 0 }
      week.workouts += 1

      const ess = await db.exerciseSessions.where('workoutSessionId').equals(session.id!).toArray()
      for (const es of ess) {
        if (exerciseFilter !== 'all' && es.exerciseId !== exerciseFilter) continue
        const sets = await db.loggedSets.where('exerciseSessionId').equals(es.id!).toArray()
        const vol = workingSetVolume(sets)
        const setCount = workingSetCount(sets)
        week.volume += vol
        week.sets += setCount
        const exercise = await db.exercises.get(es.exerciseId)
        if (exercise) {
          muscleRows.push({
            primaryMuscle: exercise.primaryMuscle,
            volume: vol,
            sets: setCount,
          })
        }
        const e1rm = bestE1rmEstimate(sets)
        if (e1rm != null && exercise) {
          strengthSeries.push({
            date: day,
            e1rm,
            name: exercise.name,
          })
        }
      }
      weekMap.set(weekKey, week)
    }

    const weeklyVolume = Array.from(weekMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week, v]) => ({
        week: format(parseISO(week), 'MMM d'),
        volume: Math.round(v.volume),
        sets: v.sets,
        workouts: v.workouts,
      }))

    return {
      weeklyVolume,
      weeklySets: weeklyVolume,
      strength: strengthSeries.slice(-40),
      muscle: aggregateMuscleVolume(muscleRows).map((m) => ({
        muscle: m.muscle,
        volume: Math.round(m.volume),
        sets: m.sets,
      })),
      calendar: Array.from(calendarMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, count]) => ({ date, count })),
    }
  }, [exerciseFilter])

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'volume', label: 'Volume' },
    { id: 'strength', label: 'Strength' },
    { id: 'muscle', label: 'Muscles' },
    { id: 'consistency', label: 'Consistency' },
    { id: 'prs', label: 'PRs' },
    { id: 'cardio', label: 'Cardio' },
    { id: 'readiness', label: 'Readiness' },
  ]

  const empty = !sessions || sessions.length === 0
  const cardioEmpty = !cardioSessions || cardioSessions.length === 0

  const readinessTrend = useMemo(
    () =>
      (readiness ?? []).map((r) => ({
        date: format(parseISO(r.date), 'MMM d'),
        score: readinessScore(r),
      })),
    [readiness],
  )

  const cardioTrend = useMemo(() => {
    const weekMap = new Map<string, { minutes: number; miles: number; sessions: number }>()
    for (const s of cardioSessions ?? []) {
      if (!s.completedAt) continue
      const weekKey = format(
        startOfWeek(parseISO(s.completedAt), { weekStartsOn: 1 }),
        'yyyy-MM-dd',
      )
      const row = weekMap.get(weekKey) ?? { minutes: 0, miles: 0, sessions: 0 }
      row.minutes += s.durationSeconds / 60
      row.miles += s.distanceMeters != null ? metersToDisplay(s.distanceMeters, 'mi') : 0
      row.sessions += 1
      weekMap.set(weekKey, row)
    }
    return Array.from(weekMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week, v]) => ({
        week: format(parseISO(week), 'MMM d'),
        minutes: Math.round(v.minutes),
        miles: Math.round(v.miles * 10) / 10,
        sessions: v.sessions,
      }))
  }, [cardioSessions])

  const runningSeries = useMemo(
    () => buildRunningSessionSeries(cardioSessions ?? []),
    [cardioSessions],
  )

  const runningMileageChart = useMemo(
    () =>
      runningSeries.map((p) => ({
        ...p,
        date: format(parseISO(p.isoDate), 'MMM d'),
      })),
    [runningSeries],
  )

  const runningWeeklyMileage = useMemo(
    () =>
      buildRunningWeeklyMileage(cardioSessions ?? [], (completedAt) =>
        format(startOfWeek(parseISO(completedAt), { weekStartsOn: 1 }), 'yyyy-MM-dd'),
      ).map((w) => ({
        ...w,
        week: format(parseISO(w.weekStart), 'MMM d'),
      })),
    [cardioSessions],
  )

  const runningPaceChart = useMemo(
    () =>
      runningSeries
        .filter((p) => p.paceMinPerMile != null && p.mph != null)
        .map((p) => ({
          date: format(parseISO(p.isoDate), 'MMM d'),
          paceMinPerMile: p.paceMinPerMile!,
          paceLabel: formatPaceClock(p.paceSecPerMile!),
          mph: p.mph!,
          title: p.title,
        })),
    [runningSeries],
  )

  const recentCardioList = useMemo(() => {
    const rows = (cardioSessions ?? []).filter((s) => s.completedAt)
    const filtered =
      cardioSub === 'run' ? rows.filter((s) => s.modality === 'run') : rows
    return filtered
      .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))
      .slice(0, 12)
  }, [cardioSessions, cardioSub])

  const runSessionsExist = useMemo(
    () => (cardioSessions ?? []).some((s) => s.modality === 'run' && s.completedAt),
    [cardioSessions],
  )

  return (
    <div className="px-4 pt-4 animate-fade-up">
      <header className="mb-4">
        <h1 className="font-display text-3xl font-extrabold">Progress</h1>
        <p className="mt-1 text-sm text-muted">
          Working sets only · empty until you log workouts
        </p>
      </header>

      <div className="mb-3">
        <label className="text-xs font-semibold text-muted">Exercise filter</label>
        <select
          className="mt-1 w-full rounded-2xl border border-border bg-card px-3 py-3 text-sm"
          value={exerciseFilter === 'all' ? 'all' : String(exerciseFilter)}
          onChange={(e) =>
            setExerciseFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))
          }
        >
          <option value="all">All exercises</option>
          {exercises?.map((ex) => (
            <option key={ex.id} value={ex.id}>
              {ex.name}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={[
              'rounded-full px-3 py-1.5 text-sm font-semibold whitespace-nowrap',
              tab === t.id ? 'bg-accent text-white' : 'bg-card text-muted border border-border',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {empty && tab !== 'readiness' && tab !== 'cardio' && (
        <Card>
          <p className="font-display text-lg font-bold">No data yet</p>
          <p className="mt-1 text-sm text-muted">
            Charts stay empty until you complete workouts. No sample data is shown.
          </p>
        </Card>
      )}

      {!empty && tab === 'volume' && (
        <Card>
          <p className="mb-3 text-sm font-semibold text-muted">Volume by week</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData?.weeklyVolume ?? []}>
                <defs>
                  <linearGradient id="vol" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FF7433" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#FF7433" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#2a2e36" strokeDasharray="3 3" />
                <XAxis dataKey="week" stroke="#8b919a" fontSize={11} />
                <YAxis stroke="#8b919a" fontSize={11} />
                <Tooltip
                  contentStyle={{ background: '#1C1F24', border: '1px solid #2a2e36' }}
                />
                <Area
                  type="monotone"
                  dataKey="volume"
                  stroke="#FF7433"
                  fill="url(#vol)"
                  name={`Volume (${unit})`}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 h-40">
            <p className="mb-2 text-sm font-semibold text-muted">Working sets / week</p>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData?.weeklySets ?? []}>
                <CartesianGrid stroke="#2a2e36" strokeDasharray="3 3" />
                <XAxis dataKey="week" stroke="#8b919a" fontSize={11} />
                <YAxis stroke="#8b919a" fontSize={11} />
                <Tooltip
                  contentStyle={{ background: '#1C1F24', border: '1px solid #2a2e36' }}
                />
                <Bar dataKey="sets" fill="#FF7433" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {!empty && tab === 'strength' && (
        <Card>
          <p className="mb-1 text-sm font-semibold text-muted">Strength trends</p>
          <p className="mb-3 text-xs text-muted">
            Epley e1RM estimate (reps 1–12 only) — labeled estimate, not a tested max.
          </p>
          <div className="h-56">
            {(chartData?.strength.length ?? 0) === 0 ? (
              <p className="text-sm text-muted">No eligible sets for e1RM yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData?.strength ?? []}>
                  <CartesianGrid stroke="#2a2e36" strokeDasharray="3 3" />
                  <XAxis dataKey="date" stroke="#8b919a" fontSize={11} />
                  <YAxis stroke="#8b919a" fontSize={11} />
                  <Tooltip
                    contentStyle={{ background: '#1C1F24', border: '1px solid #2a2e36' }}
                    formatter={(value) => [
                      `${Math.round(Number(value))} ${unit} (est.)`,
                      'e1RM',
                    ]}
                  />
                  <Line
                    type="monotone"
                    dataKey="e1rm"
                    stroke="#3d9a6a"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      )}

      {!empty && tab === 'muscle' && (
        <Card>
          <p className="mb-3 text-sm font-semibold text-muted">Muscle volume (primary)</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData?.muscle ?? []} layout="vertical" margin={{ left: 16 }}>
                <CartesianGrid stroke="#2a2e36" strokeDasharray="3 3" />
                <XAxis type="number" stroke="#8b919a" fontSize={11} />
                <YAxis type="category" dataKey="muscle" stroke="#8b919a" fontSize={11} width={80} />
                <Tooltip
                  contentStyle={{ background: '#1C1F24', border: '1px solid #2a2e36' }}
                />
                <Bar dataKey="volume" fill="#FF7433" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {!empty && tab === 'consistency' && (
        <Card>
          <p className="mb-3 text-sm font-semibold text-muted">Training calendar</p>
          <div className="grid grid-cols-7 gap-1">
            {(chartData?.calendar ?? []).slice(-56).map((d) => (
              <div
                key={d.date}
                title={`${d.date}: ${d.count}`}
                className="aspect-square rounded-md"
                style={{
                  background:
                    d.count >= 2
                      ? '#FF7433'
                      : d.count === 1
                        ? 'rgba(255,116,51,0.45)'
                        : '#1C1F24',
                }}
              />
            ))}
          </div>
          <p className="mt-3 text-sm text-muted">
            Completed workouts: {sessions?.length ?? 0}
          </p>
        </Card>
      )}

      {tab === 'prs' && (
        <div className="space-y-2">
          {(prs ?? []).length === 0 && (
            <Card>
              <p className="text-sm text-muted">No personal records yet.</p>
            </Card>
          )}
          {(prs ?? []).map((pr) => (
            <Card key={pr.id} className="!py-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">{pr.name}</p>
                  <p className="text-xs text-muted">
                    {pr.type.toUpperCase()}
                    {pr.type === 'e1rm' ? ' (estimate)' : ''} ·{' '}
                    {format(parseISO(pr.achievedAt), 'MMM d, yyyy')}
                  </p>
                </div>
                <p className="font-display text-lg font-bold text-success">
                  {pr.type === 'weight' || pr.type === 'e1rm'
                    ? formatWeight(pr.value, unit, 0)
                    : Math.round(pr.value)}
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === 'cardio' && (
        <div className="space-y-3">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {(
              [
                { id: 'all' as const, label: 'All' },
                { id: 'run' as const, label: 'Running' },
              ] as const
            ).map((sub) => (
              <button
                key={sub.id}
                type="button"
                onClick={() => setCardioSub(sub.id)}
                className={[
                  'rounded-full px-3 py-1.5 text-sm font-semibold whitespace-nowrap',
                  cardioSub === sub.id
                    ? 'bg-accent text-white'
                    : 'bg-card text-muted border border-border',
                ].join(' ')}
              >
                {sub.label}
              </button>
            ))}
          </div>

          {cardioSub === 'all' &&
            (cardioEmpty ? (
              <Card>
                <p className="font-display text-lg font-bold">No cardio yet</p>
                <p className="mt-1 text-sm text-muted">
                  Start or log a run, bike, or row from Train → Cardio. Charts stay empty until
                  then.
                </p>
              </Card>
            ) : (
              <>
                <Card>
                  <p className="mb-3 text-sm font-semibold text-muted">Cardio by week</p>
                  <div className="h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={cardioTrend}>
                        <defs>
                          <linearGradient id="cardioMin" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#FF7433" stopOpacity={0.4} />
                            <stop offset="100%" stopColor="#FF7433" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="#2a2e36" strokeDasharray="3 3" />
                        <XAxis dataKey="week" stroke="#8b919a" fontSize={11} />
                        <YAxis stroke="#8b919a" fontSize={11} />
                        <Tooltip
                          contentStyle={{
                            background: '#1C1F24',
                            border: '1px solid #2a2e36',
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="minutes"
                          stroke="#FF7433"
                          fill="url(#cardioMin)"
                          name="Minutes"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-4 h-40">
                    <p className="mb-2 text-sm font-semibold text-muted">Distance (mi) / week</p>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={cardioTrend}>
                        <CartesianGrid stroke="#2a2e36" strokeDasharray="3 3" />
                        <XAxis dataKey="week" stroke="#8b919a" fontSize={11} />
                        <YAxis stroke="#8b919a" fontSize={11} />
                        <Tooltip
                          contentStyle={{
                            background: '#1C1F24',
                            border: '1px solid #2a2e36',
                          }}
                        />
                        <Bar dataKey="miles" fill="#FF7433" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
                <div className="space-y-2">
                  {recentCardioList.map((s) => (
                    <Card key={s.id} className="!py-3">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="font-semibold">{s.title}</p>
                          <p className="text-xs text-muted">
                            {s.completedAt
                              ? format(parseISO(s.completedAt), 'MMM d, yyyy')
                              : '—'}{' '}
                            · {formatDuration(s.durationSeconds)}
                            {s.effort != null ? ` · Effort ${s.effort}/10` : ''}
                          </p>
                        </div>
                        <p className="font-display text-base font-bold text-accent">
                          {formatDistance(s.distanceMeters, 'mi')}
                        </p>
                      </div>
                    </Card>
                  ))}
                </div>
              </>
            ))}

          {cardioSub === 'run' &&
            (!runSessionsExist ? (
              <Card>
                <p className="font-display text-lg font-bold">No runs yet</p>
                <p className="mt-1 text-sm text-muted">
                  Log a completed run from Train → Cardio to see mileage and pace. Charts stay
                  empty — no sample data.
                </p>
              </Card>
            ) : (
              <>
                <Card>
                  <p className="mb-1 text-sm font-semibold text-muted">Mileage</p>
                  <p className="mb-3 text-xs text-muted">
                    Distance per run (mi) · completed runs with distance only
                  </p>
                  {runningMileageChart.length === 0 ? (
                    <p className="text-sm text-muted">
                      Runs are logged, but none include distance yet.
                    </p>
                  ) : (
                    <div className="h-52">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={runningMileageChart}>
                          <defs>
                            <linearGradient id="runMiles" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#FF7433" stopOpacity={0.4} />
                              <stop offset="100%" stopColor="#FF7433" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid stroke="#2a2e36" strokeDasharray="3 3" />
                          <XAxis dataKey="date" stroke="#8b919a" fontSize={11} />
                          <YAxis
                            stroke="#8b919a"
                            fontSize={11}
                            label={{
                              value: 'mi',
                              angle: -90,
                              position: 'insideLeft',
                              fill: '#8b919a',
                              fontSize: 11,
                            }}
                          />
                          <Tooltip
                            contentStyle={{
                              background: '#1C1F24',
                              border: '1px solid #2a2e36',
                            }}
                            formatter={(value) => [`${Number(value)} mi`, 'Distance']}
                          />
                          <Area
                            type="monotone"
                            dataKey="miles"
                            stroke="#FF7433"
                            fill="url(#runMiles)"
                            name="Miles"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  <div className="mt-4 h-40">
                    <p className="mb-2 text-sm font-semibold text-muted">Weekly mileage (mi)</p>
                    {runningWeeklyMileage.length === 0 ? (
                      <p className="text-sm text-muted">No weekly mileage yet.</p>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={runningWeeklyMileage}>
                          <CartesianGrid stroke="#2a2e36" strokeDasharray="3 3" />
                          <XAxis dataKey="week" stroke="#8b919a" fontSize={11} />
                          <YAxis stroke="#8b919a" fontSize={11} unit=" mi" width={48} />
                          <Tooltip
                            contentStyle={{
                              background: '#1C1F24',
                              border: '1px solid #2a2e36',
                            }}
                            formatter={(value) => [`${Number(value)} mi`, 'Mileage']}
                          />
                          <Bar dataKey="miles" fill="#FF7433" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </Card>

                <Card>
                  <p className="mb-1 text-sm font-semibold text-muted">Speed per mile</p>
                  <p className="mb-3 text-xs text-muted">
                    Pace (min/mi) and average speed (mph) from distance ÷ duration
                  </p>
                  {runningPaceChart.length === 0 ? (
                    <p className="text-sm text-muted">
                      Need runs with both distance and duration to plot pace.
                    </p>
                  ) : (
                    <>
                      <div className="h-52">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={runningPaceChart}>
                            <CartesianGrid stroke="#2a2e36" strokeDasharray="3 3" />
                            <XAxis dataKey="date" stroke="#8b919a" fontSize={11} />
                            <YAxis
                              stroke="#8b919a"
                              fontSize={11}
                              reversed
                              tickFormatter={(v) => formatPaceClock(Number(v) * 60)}
                              label={{
                                value: 'min/mi',
                                angle: -90,
                                position: 'insideLeft',
                                fill: '#8b919a',
                                fontSize: 11,
                              }}
                            />
                            <Tooltip
                              contentStyle={{
                                background: '#1C1F24',
                                border: '1px solid #2a2e36',
                              }}
                              formatter={(value, name) => {
                                if (name === 'paceMinPerMile') {
                                  return [
                                    `${formatPaceClock(Number(value) * 60)} /mi`,
                                    'Pace',
                                  ]
                                }
                                return [value, name]
                              }}
                            />
                            <Line
                              type="monotone"
                              dataKey="paceMinPerMile"
                              stroke="#FF7433"
                              strokeWidth={2}
                              dot={{ r: 3, fill: '#FF7433' }}
                              name="paceMinPerMile"
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="mt-4 h-40">
                        <p className="mb-2 text-sm font-semibold text-muted">Average speed (mph)</p>
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={runningPaceChart}>
                            <CartesianGrid stroke="#2a2e36" strokeDasharray="3 3" />
                            <XAxis dataKey="date" stroke="#8b919a" fontSize={11} />
                            <YAxis
                              stroke="#8b919a"
                              fontSize={11}
                              unit=" mph"
                              width={56}
                            />
                            <Tooltip
                              contentStyle={{
                                background: '#1C1F24',
                                border: '1px solid #2a2e36',
                              }}
                              formatter={(value) => [`${Number(value)} mph`, 'Speed']}
                            />
                            <Line
                              type="monotone"
                              dataKey="mph"
                              stroke="#3d9a6a"
                              strokeWidth={2}
                              dot={{ r: 3, fill: '#3d9a6a' }}
                              name="mph"
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </>
                  )}
                </Card>

                <div className="space-y-2">
                  {recentCardioList.length === 0 ? (
                    <Card>
                      <p className="text-sm text-muted">No completed runs to list.</p>
                    </Card>
                  ) : (
                    recentCardioList.map((s) => (
                      <Card key={s.id} className="!py-3">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="font-semibold">{s.title}</p>
                            <p className="text-xs text-muted">
                              {s.completedAt
                                ? format(parseISO(s.completedAt), 'MMM d, yyyy')
                                : '—'}{' '}
                              · {formatDuration(s.durationSeconds)}
                              {s.effort != null ? ` · Effort ${s.effort}/10` : ''}
                            </p>
                          </div>
                          <p className="font-display text-base font-bold text-accent">
                            {formatDistance(s.distanceMeters, 'mi')}
                          </p>
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              </>
            ))}
        </div>
      )}

      {tab === 'readiness' && (
        <Card>
          <p className="mb-1 text-sm font-semibold text-muted">Readiness trends</p>
          <p className="mb-3 text-xs text-muted">
            Historical check-ins only · not medical advice. Pre-workout readiness prompts were
            removed.
          </p>
          {(readinessTrend.length === 0 && (
            <p className="text-sm text-muted">No readiness check-ins yet.</p>
          )) || (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={readinessTrend}>
                  <CartesianGrid stroke="#2a2e36" strokeDasharray="3 3" />
                  <XAxis dataKey="date" stroke="#8b919a" fontSize={11} />
                  <YAxis domain={[1, 5]} stroke="#8b919a" fontSize={11} />
                  <Tooltip
                    contentStyle={{ background: '#1C1F24', border: '1px solid #2a2e36' }}
                  />
                  <Line type="monotone" dataKey="score" stroke="#FF7433" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
