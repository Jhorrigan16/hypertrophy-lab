import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  addDays,
  format,
  isSameDay,
  parseISO,
  startOfDay,
} from 'date-fns'
import { ChevronRight, Play, RotateCcw, Trophy, Flame, HeartPulse } from 'lucide-react'
import { db } from '@/db/database'
import { useActiveProgram, useProgramWeeks, useScheduled, useTemplates } from '@/hooks/useProgram'
import { getActiveSession, startWorkoutFromTemplate } from '@/lib/sessions'
import {
  formatDistance,
  formatDuration,
  getActiveCardioSession,
  recentCompletedCardio,
} from '@/lib/cardio'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

export function HomePage() {
  const navigate = useNavigate()
  const program = useActiveProgram()
  const weeks = useProgramWeeks(program?.id)
  const scheduled = useScheduled(program?.id)
  const templates = useTemplates()
  const [starting, setStarting] = useState(false)

  const activeSession = useLiveQuery(() => getActiveSession())
  const activeCardio = useLiveQuery(() => getActiveCardioSession())
  const completedCount = useLiveQuery(
    () => db.workoutSessions.where('status').equals('completed').count(),
  )
  const cardioCount = useLiveQuery(
    () => db.cardioSessions.where('status').equals('completed').count(),
  )
  const recentCardio = useLiveQuery(() => recentCompletedCardio(3))
  const recentPrs = useLiveQuery(async () => {
    const prs = await db.personalRecords.orderBy('achievedAt').reverse().limit(5).toArray()
    const withNames = await Promise.all(
      prs.map(async (pr) => {
        const ex = await db.exercises.get(pr.exerciseId)
        return { ...pr, exerciseName: ex?.name ?? 'Exercise' }
      }),
    )
    return withNames
  })

  const currentWeek = program?.currentWeek ?? 1
  const weekMeta = weeks?.find((w) => w.weekNumber === currentWeek)

  const today = startOfDay(new Date())
  const calendarDays = useMemo(() => {
    const mondayOffset = (today.getDay() + 6) % 7
    return Array.from({ length: 7 }, (_, i) => addDays(today, -mondayOffset + i))
  }, [today])

  const nextScheduled = useMemo(() => {
    if (!scheduled || !templates) return null
    const upcoming = scheduled
      .filter((s) => s.status === 'planned' || s.status === 'moved')
      .filter((s) => parseISO(s.plannedDate) >= addDays(today, -1))
      .sort((a, b) => a.plannedDate.localeCompare(b.plannedDate))[0]
    if (!upcoming) return null
    const template = templates.find((t) => t.id === upcoming.templateId)
    return { scheduled: upcoming, template }
  }, [scheduled, templates, today])

  const weekScheduled = useMemo(() => {
    if (!scheduled) return []
    return scheduled.filter((s) => s.weekNumber === currentWeek)
  }, [scheduled, currentWeek])

  const weekDone = weekScheduled.filter((s) => s.status === 'completed').length
  const weekTotal = weekScheduled.length || 4

  async function begin(templateId: number, scheduledId?: number) {
    setStarting(true)
    try {
      const id = await startWorkoutFromTemplate({
        templateId,
        weekNumber: currentWeek,
        scheduledWorkoutId: scheduledId,
      })
      navigate(`/workout/${id}`)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not start workout')
    } finally {
      setStarting(false)
    }
  }

  return (
    <div className="px-4 pt-4 animate-fade-up">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
          Hypertrophy Lab
        </p>
        <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight text-text">
          Ready to Grow
        </h1>
        <p className="mt-1 text-sm text-muted">
          Week {currentWeek}
          {weekMeta ? ` · ${weekMeta.phaseLabel}` : ''}
        </p>
      </header>

      {activeSession && (
        <Card className="mb-4 border-accent/40 bg-gradient-to-br from-accent/10 to-card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-accent">
                Lift in progress
              </p>
              <p className="font-display text-lg font-bold">{activeSession.title}</p>
              <p className="text-sm text-muted">
                {activeSession.status === 'paused' ? 'Paused' : 'Active'} · Week{' '}
                {activeSession.weekNumber}
              </p>
            </div>
            <Button
              onClick={() => navigate(`/workout/${activeSession.id}`)}
              className="!px-4 shrink-0"
            >
              <RotateCcw size={18} />
              Resume
            </Button>
          </div>
        </Card>
      )}

      {activeCardio && (
        <Card className="mb-4 border-accent/40 bg-gradient-to-br from-accent/10 to-card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-accent">
                Cardio in progress
              </p>
              <p className="font-display text-lg font-bold">{activeCardio.title}</p>
              <p className="text-sm text-muted">
                {formatDuration(activeCardio.durationSeconds)} elapsed
              </p>
            </div>
            <Button
              onClick={() => navigate(`/cardio/${activeCardio.id}`)}
              className="!px-4 shrink-0"
            >
              <RotateCcw size={18} />
              Resume
            </Button>
          </div>
        </Card>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => navigate('/train?layer=lift')}
          className="rounded-3xl border border-border bg-card px-4 py-4 text-left transition active:scale-[0.98]"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Layer</p>
          <p className="mt-1 font-display text-xl font-bold">Lift</p>
          <p className="mt-1 text-xs text-muted">Hypertrophy sessions</p>
        </button>
        <button
          type="button"
          onClick={() => navigate('/train?layer=cardio')}
          className="rounded-3xl border border-border bg-card px-4 py-4 text-left transition active:scale-[0.98]"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Layer</p>
          <p className="mt-1 font-display text-xl font-bold">Cardio</p>
          <p className="mt-1 text-xs text-muted">Run · bike · row</p>
        </button>
      </div>

      <Card className="mb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              Next lift
            </p>
            <p className="mt-1 font-display text-xl font-bold">
              {nextScheduled?.template?.name ?? 'No workout scheduled'}
            </p>
            {nextScheduled && (
              <p className="mt-0.5 text-sm text-muted">
                {format(parseISO(nextScheduled.scheduled.plannedDate), 'EEE, MMM d')} · Week{' '}
                {nextScheduled.scheduled.weekNumber}
              </p>
            )}
          </div>
          {nextScheduled?.template?.id && !activeSession && (
            <Button
              disabled={starting}
              onClick={() =>
                void begin(nextScheduled.template!.id!, nextScheduled.scheduled.id)
              }
              className="!px-4 shrink-0"
            >
              <Play size={18} />
              Start
            </Button>
          )}
        </div>

        <div className="mt-4">
          <div className="mb-1.5 flex justify-between text-xs text-muted">
            <span>Weekly lift progress</span>
            <span>
              {weekDone}/{weekTotal}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-border">
            <div
              className="h-full rounded-full bg-accent transition-all duration-500"
              style={{ width: `${weekTotal ? (weekDone / weekTotal) * 100 : 0}%` }}
            />
          </div>
        </div>
      </Card>

      <div className="mb-4 grid grid-cols-3 gap-3">
        <Card>
          <div className="flex items-center gap-2 text-muted">
            <Flame size={16} className="text-accent" />
            <span className="text-xs font-semibold uppercase tracking-wide">Lifts</span>
          </div>
          <p className="mt-2 font-display text-3xl font-bold">{completedCount ?? 0}</p>
        </Card>
        <Card>
          <div className="flex items-center gap-2 text-muted">
            <HeartPulse size={16} className="text-accent" />
            <span className="text-xs font-semibold uppercase tracking-wide">Cardio</span>
          </div>
          <p className="mt-2 font-display text-3xl font-bold">{cardioCount ?? 0}</p>
        </Card>
        <Card>
          <div className="flex items-center gap-2 text-muted">
            <Trophy size={16} className="text-success" />
            <span className="text-xs font-semibold uppercase tracking-wide">PRs</span>
          </div>
          <p className="mt-2 font-display text-3xl font-bold">{recentPrs?.length ?? 0}</p>
        </Card>
      </div>

      <section className="mb-4">
        <h2 className="mb-2 text-sm font-semibold text-muted">This week</h2>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {calendarDays.map((day) => {
            const key = format(day, 'yyyy-MM-dd')
            const match = scheduled?.find((s) => s.plannedDate === key)
            const template = templates?.find((t) => t.id === match?.templateId)
            const isToday = isSameDay(day, today)
            return (
              <div
                key={key}
                className={[
                  'min-w-[64px] rounded-2xl border px-2 py-2.5 text-center',
                  isToday ? 'border-accent bg-accent/10' : 'border-border bg-card',
                ].join(' ')}
              >
                <p className="text-[10px] font-semibold uppercase text-muted">
                  {format(day, 'EEE')}
                </p>
                <p className="font-display text-lg font-bold">{format(day, 'd')}</p>
                <p className="mt-0.5 truncate text-[10px] text-muted">
                  {match
                    ? match.status === 'completed'
                      ? 'Done'
                      : template?.dayLabel?.split(' ')[0] ?? 'Train'
                    : 'Rest'}
                </p>
              </div>
            )
          })}
        </div>
      </section>

      {recentCardio && recentCardio.length > 0 && (
        <section className="mb-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted">Recent cardio</h2>
            <Link to="/progress?tab=cardio" className="text-xs font-semibold text-accent">
              See all
            </Link>
          </div>
          <div className="space-y-2">
            {recentCardio.map((session) => (
              <Card key={session.id} className="!py-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold">{session.title}</p>
                    <p className="text-xs text-muted">
                      {session.completedAt
                        ? format(parseISO(session.completedAt), 'MMM d')
                        : '—'}{' '}
                      · {formatDuration(session.durationSeconds)}
                      {session.effort != null ? ` · Effort ${session.effort}` : ''}
                    </p>
                  </div>
                  <p className="font-display text-base font-bold text-accent">
                    {formatDistance(session.distanceMeters, 'mi')}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {recentPrs && recentPrs.length > 0 && (
        <section className="mb-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted">Recent PRs</h2>
            <Link to="/progress" className="text-xs font-semibold text-accent">
              See all
            </Link>
          </div>
          <div className="space-y-2">
            {recentPrs.slice(0, 3).map((pr) => (
              <Card key={pr.id} className="!py-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold">{pr.exerciseName}</p>
                    <p className="text-xs text-muted">
                      {pr.type.toUpperCase()} · {format(parseISO(pr.achievedAt), 'MMM d')}
                    </p>
                  </div>
                  <p className="font-display text-lg font-bold text-success">
                    {Math.round(pr.value)}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      <Link
        to="/train"
        className="mb-2 flex items-center justify-between rounded-3xl border border-border bg-card px-4 py-4"
      >
        <div>
          <p className="font-display text-lg font-bold">Quick start</p>
          <p className="text-sm text-muted">Lift templates or cardio activities</p>
        </div>
        <ChevronRight className="text-muted" />
      </Link>
    </div>
  )
}
