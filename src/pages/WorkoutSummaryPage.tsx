import { Link, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Check, ChevronRight } from 'lucide-react'
import { loadSessionBundle, sessionElapsedMs } from '@/lib/sessions'
import { formatWeight } from '@/lib/units'
import { formatTimer } from '@/lib/restTimer'
import { workingSetCount, workingSetVolume } from '@/lib/volume'
import { useSettings } from '@/hooks/useSettings'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

export function WorkoutSummaryPage() {
  const { sessionId } = useParams()
  const id = Number(sessionId)
  const settings = useSettings()
  const unit = settings?.weightUnit ?? 'lb'

  const data = useLiveQuery(() => loadSessionBundle(id), [id])

  if (!data?.session) {
    return (
      <div className="px-4 pt-10 text-center text-muted">
        <p>Loading summary…</p>
      </div>
    )
  }

  const { session, bundles } = data
  const allSets = bundles.flatMap((b) => b.sets)
  const setCount = workingSetCount(allSets)
  const volume = workingSetVolume(allSets)
  const elapsed = sessionElapsedMs(session)

  return (
    <div className="animate-fade-up px-4 pt-6 pb-nav">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-success/15 text-success">
          <Check size={28} strokeWidth={2.5} />
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
          Workout complete
        </p>
        <h1 className="mt-1 font-display text-3xl font-extrabold">{session.title}</h1>
        <p className="mt-1 text-sm text-muted">
          Week {session.weekNumber ?? '—'}
          {session.dayLabel ? ` · ${session.dayLabel}` : ''}
        </p>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-2">
        <Card className="text-center !py-3">
          <p className="text-[10px] font-semibold uppercase text-muted">Time</p>
          <p className="mt-1 font-display text-lg font-bold">
            {formatTimer(Math.floor(elapsed / 1000))}
          </p>
        </Card>
        <Card className="text-center !py-3">
          <p className="text-[10px] font-semibold uppercase text-muted">Sets</p>
          <p className="mt-1 font-display text-lg font-bold">{setCount}</p>
        </Card>
        <Card className="text-center !py-3">
          <p className="text-[10px] font-semibold uppercase text-muted">Volume</p>
          <p className="mt-1 font-display text-lg font-bold">
            {Math.round(volume).toLocaleString()}
          </p>
        </Card>
      </div>

      <h2 className="mb-2 text-sm font-semibold text-muted">Exercises</h2>
      <div className="space-y-2">
        {bundles.map(({ exerciseSession, exercise, sets }) => {
          const working = sets.filter((s) => s.isComplete && !s.isWarmup)
          return (
            <Card key={exerciseSession.id} className="!py-3">
              <p className="font-semibold">{exercise?.name ?? 'Exercise'}</p>
              <p className="mt-1 text-sm text-muted">
                {working.length
                  ? working
                      .map((s) => `${formatWeight(s.weight, unit, 0)}×${s.reps}`)
                      .join(' · ')
                  : 'No working sets logged'}
              </p>
            </Card>
          )
        })}
      </div>

      <div className="mt-6 space-y-2">
        <Link to="/">
          <Button fullWidth className="min-h-12">
            Back to Home
          </Button>
        </Link>
        <Link
          to="/progress"
          className="flex items-center justify-center gap-1 py-3 text-sm font-semibold text-accent"
        >
          View Progress <ChevronRight size={16} />
        </Link>
      </div>
    </div>
  )
}
