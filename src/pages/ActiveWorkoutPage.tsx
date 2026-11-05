import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  ChevronDown,
  ChevronLeft,
  Flag,
  Pause,
  Play,
  Plus,
  Timer,
} from 'lucide-react'
import { db } from '@/db/database'
import { useSettings } from '@/hooks/useSettings'
import {
  addWarmupSet,
  addWorkingSet,
  discardSession,
  finishSession,
  loadSessionBundle,
  pauseSession,
  resumeSession,
  sessionElapsedMs,
} from '@/lib/sessions'
import { formatWeight } from '@/lib/units'
import { formatTimer } from '@/lib/restTimer'
import { SetRow } from '@/components/workout/SetRow'
import { RestTimer } from '@/components/workout/RestTimer'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Button } from '@/components/ui/Button'

export function ActiveWorkoutPage() {
  const { sessionId } = useParams()
  const id = Number(sessionId)
  const navigate = useNavigate()
  const settings = useSettings()
  const unit = settings?.weightUnit ?? 'lb'

  const refreshKey = useLiveQuery(async () => {
    const sets = await db.loggedSets.toArray()
    const sessions = await db.workoutSessions.get(id)
    return `${sessions?.status}-${sets.length}-${sets.filter((s) => s.isComplete).length}`
  }, [id])

  const [bundle, setBundle] = useState<Awaited<ReturnType<typeof loadSessionBundle>>>(null)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [restOpen, setRestOpen] = useState(false)
  const [restSeconds, setRestSeconds] = useState(90)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [confirmFinish, setConfirmFinish] = useState(false)
  const [elapsed, setElapsed] = useState(0)

  const reload = useCallback(async () => {
    const data = await loadSessionBundle(id)
    setBundle(data)
    if (data && expanded == null && data.bundles[0]?.exerciseSession.id) {
      setExpanded(data.bundles[0].exerciseSession.id)
    }
  }, [id, expanded])

  useEffect(() => {
    void reload()
  }, [reload, refreshKey])

  useEffect(() => {
    if (!bundle?.session) return
    const tick = () => setElapsed(sessionElapsedMs(bundle.session))
    tick()
    const t = window.setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [bundle?.session])

  const incomplete = useMemo(() => {
    if (!bundle) return true
    return bundle.bundles.some((b) =>
      b.sets.some((s) => !s.isWarmup && !s.isComplete),
    )
  }, [bundle])

  if (!bundle?.session) {
    return (
      <div className="px-4 pt-8 text-center text-muted">
        <p>Loading workout…</p>
      </div>
    )
  }

  const { session, bundles } = bundle

  return (
    <div className="min-h-full pb-28">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-bg/95 px-3 py-3 backdrop-blur-xl safe-top">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-full p-2 text-muted"
            onClick={() => {
              if (incomplete) setConfirmDiscard(true)
              else navigate('/train')
            }}
          >
            <ChevronLeft size={22} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-lg font-bold">{session.title}</p>
            <p className="text-xs text-muted">
              Week {session.weekNumber ?? '—'} · {formatTimer(Math.floor(elapsed / 1000))}
              {session.status === 'paused' ? ' · Paused' : ''}
            </p>
          </div>
          {session.status === 'paused' ? (
            <button
              type="button"
              className="rounded-full border border-border p-2.5"
              onClick={() => void resumeSession(id).then(reload)}
            >
              <Play size={18} />
            </button>
          ) : (
            <button
              type="button"
              className="rounded-full border border-border p-2.5"
              onClick={() => void pauseSession(id).then(reload)}
            >
              <Pause size={18} />
            </button>
          )}
          <button
            type="button"
            className="rounded-full border border-accent/40 bg-accent/15 p-2.5 text-accent"
            onClick={() => setConfirmFinish(true)}
          >
            <Flag size={18} />
          </button>
        </div>
      </header>

      <div className="space-y-3 px-3 pt-3">
        {bundles.map(({ exerciseSession, exercise, sets, previous }) => {
          const open = expanded === exerciseSession.id
          const done = sets.filter((s) => !s.isWarmup && s.isComplete).length
          const total = sets.filter((s) => !s.isWarmup).length
          return (
            <div key={exerciseSession.id} className="overflow-hidden rounded-3xl border border-border bg-card">
              <button
                type="button"
                className="flex w-full items-start gap-3 px-4 py-3.5 text-left"
                onClick={() =>
                  setExpanded(open ? null : exerciseSession.id ?? null)
                }
              >
                <div className="min-w-0 flex-1">
                  <p className="font-display text-lg font-bold leading-tight">
                    {exercise?.name ?? 'Exercise'}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {done}/{total} sets · {exerciseSession.targetRepMin}–
                    {exerciseSession.targetRepMax} reps
                    {exerciseSession.isUnilateral ? ' · Unilateral' : ''}
                  </p>
                  {exerciseSession.suggestedWeight != null ? (
                    <p className="mt-1 text-sm text-accent">
                      Suggested{' '}
                      {formatWeight(exerciseSession.suggestedWeight, unit)}
                    </p>
                  ) : (
                    <p className="mt-1 text-sm text-accent">Establish baseline</p>
                  )}
                  {previous && (
                    <p className="mt-0.5 text-xs text-muted">
                      Last:{' '}
                      {previous.sets
                        .map(
                          (s) =>
                            `${formatWeight(s.weight, unit, 0)}×${s.reps}`,
                        )
                        .join(', ')}
                    </p>
                  )}
                </div>
                <ChevronDown
                  className={[
                    'mt-1 shrink-0 text-muted transition',
                    open ? 'rotate-180' : '',
                  ].join(' ')}
                  size={20}
                />
              </button>

              {open && (
                <div className="space-y-3 border-t border-border px-3 py-3">
                  {sets.map((set) => (
                    <SetRow
                      key={set.id}
                      set={set}
                      unit={unit}
                      targetRepMin={exerciseSession.targetRepMin}
                      targetRepMax={exerciseSession.targetRepMax}
                      targetRir={exerciseSession.targetRir}
                      isUnilateral={exerciseSession.isUnilateral}
                      onCompleted={() => {
                        void reload()
                        setRestSeconds(exerciseSession.restSeconds)
                        setRestOpen(true)
                      }}
                    />
                  ))}
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      className="flex-1 !py-3 text-sm"
                      onClick={() =>
                        void addWarmupSet(exerciseSession.id!).then(reload)
                      }
                    >
                      <Plus size={16} /> Warm-up
                    </Button>
                    <Button
                      variant="secondary"
                      className="flex-1 !py-3 text-sm"
                      onClick={() =>
                        void addWorkingSet(exerciseSession.id!).then(reload)
                      }
                    >
                      <Plus size={16} /> Set
                    </Button>
                    <Button
                      variant="ghost"
                      className="!px-3 !py-3"
                      onClick={() => {
                        setRestSeconds(exerciseSession.restSeconds)
                        setRestOpen(true)
                      }}
                    >
                      <Timer size={18} />
                    </Button>
                  </div>
                  <textarea
                    className="w-full rounded-2xl border border-border bg-bg px-3 py-2.5 text-sm outline-none focus:border-accent"
                    rows={2}
                    placeholder="Exercise notes"
                    defaultValue={exerciseSession.notes ?? ''}
                    onBlur={(e) => {
                      void db.exerciseSessions.update(exerciseSession.id!, {
                        notes: e.target.value,
                      })
                    }}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>

      <RestTimer
        open={restOpen}
        seconds={restSeconds}
        onClose={() => setRestOpen(false)}
      />

      <ConfirmDialog
        open={confirmDiscard}
        title="Leave workout?"
        message="You have incomplete sets. Discard this session, or keep it to resume later?"
        confirmLabel="Discard"
        cancelLabel="Keep & Exit"
        danger
        onCancel={() => {
          setConfirmDiscard(false)
          navigate('/train')
        }}
        onConfirm={() => {
          void discardSession(id).then(() => navigate('/train'))
        }}
      />

      <ConfirmDialog
        open={confirmFinish}
        title="Finish workout?"
        message={
          incomplete
            ? 'Some working sets are incomplete. Finish anyway and save what you logged?'
            : 'Save this session and update progress?'
        }
        confirmLabel="Finish"
        onCancel={() => setConfirmFinish(false)}
        onConfirm={() => {
          void finishSession(id).then(() => navigate('/'))
        }}
      />
    </div>
  )
}
