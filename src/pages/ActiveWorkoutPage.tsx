import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  ChevronLeft,
  ChevronRight,
  Flag,
  Pause,
  Play,
  Plus,
  BookOpen,
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
  switchExerciseInSession,
  getPreviousWorkingSets,
} from '@/lib/sessions'
import { formatWeight } from '@/lib/units'
import { formatTimer } from '@/lib/restTimer'
import {
  findNextIncompleteExerciseIndex,
  prefillFromPrevious,
  workoutWorkingProgress,
} from '@/lib/workoutUx'
import { SetRow } from '@/components/workout/SetRow'
import { RestTimer } from '@/components/workout/RestTimer'
import { ExerciseSwitcher } from '@/components/workout/ExerciseSwitcher'
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
  const [exerciseIndex, setExerciseIndex] = useState(0)
  const [restOpen, setRestOpen] = useState(false)
  const [restSeconds, setRestSeconds] = useState(90)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [confirmFinish, setConfirmFinish] = useState(false)
  const [showCues, setShowCues] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [flash, setFlash] = useState(false)
  const [initializedFocus, setInitializedFocus] = useState(false)

  const reload = useCallback(async () => {
    const data = await loadSessionBundle(id)
    setBundle(data)
    if (data && !initializedFocus && data.bundles.length > 0) {
      const next = findNextIncompleteExerciseIndex(data.bundles, 0)
      setExerciseIndex(next)
      setInitializedFocus(true)
    }
  }, [id, initializedFocus])

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

  const current = bundle?.bundles[exerciseIndex]
  const progress = useMemo(
    () => (bundle ? workoutWorkingProgress(bundle.bundles) : { done: 0, total: 0 }),
    [bundle],
  )

  const previousWorking = useLiveQuery(async () => {
    if (!current?.exerciseSession.exerciseId) return []
    return getPreviousWorkingSets(current.exerciseSession.exerciseId)
  }, [current?.exerciseSession.exerciseId, refreshKey])

  const prefill = useMemo(() => {
    if (!current) return null
    return prefillFromPrevious(previousWorking ?? [], {
      suggestedWeight: current.exerciseSession.suggestedWeight,
      targetRepMax: current.exerciseSession.targetRepMax,
      targetRir: current.exerciseSession.targetRir,
    })
  }, [current, previousWorking])

  const incomplete = useMemo(() => {
    if (!bundle) return true
    return bundle.bundles.some((b) =>
      b.sets.some((s) => !s.isWarmup && !s.isComplete),
    )
  }, [bundle])

  if (!bundle?.session || !current) {
    return (
      <div className="px-4 pt-8 text-center text-muted">
        <p>Loading workout…</p>
      </div>
    )
  }

  const { session, bundles } = bundle
  const { exerciseSession, exercise, sets } = current
  const activeSetId = sets.find((s) => !s.isComplete)?.id

  function goPrev() {
    setExerciseIndex((i) => Math.max(0, i - 1))
    setShowCues(false)
  }

  function goNext() {
    setExerciseIndex((i) => Math.min(bundles.length - 1, i + 1))
    setShowCues(false)
  }

  async function onSetCompleted() {
    setFlash(true)
    window.setTimeout(() => setFlash(false), 450)
    setRestSeconds(exerciseSession.restSeconds)
    setRestOpen(true)
    await reload()
    // After reload, advance exercise if all working sets done on current
    const fresh = await loadSessionBundle(id)
    if (!fresh) return
    const cur = fresh.bundles[exerciseIndex]
    const workingLeft = cur?.sets.some((s) => !s.isWarmup && !s.isComplete)
    if (!workingLeft) {
      const next = findNextIncompleteExerciseIndex(fresh.bundles, exerciseIndex)
      setExerciseIndex(next)
    }
  }

  return (
    <div className="relative flex min-h-full flex-col pb-[calc(7.5rem+env(safe-area-inset-bottom,0px))]">
      {flash && (
        <div className="pointer-events-none fixed inset-0 z-[70] bg-success/15 animate-fade-up" />
      )}

      <header className="sticky top-0 z-30 border-b border-border/60 bg-bg/95 px-3 py-3 backdrop-blur-xl safe-top">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="min-h-11 min-w-11 rounded-full p-2 text-muted"
            onClick={() => {
              if (incomplete) setConfirmDiscard(true)
              else navigate('/train')
            }}
            aria-label="Back"
          >
            <ChevronLeft size={22} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-lg font-bold">{session.title}</p>
            <p className="text-xs text-muted">
              Week {session.weekNumber ?? '—'} · {formatTimer(Math.floor(elapsed / 1000))}
              {session.status === 'paused' ? ' · Paused' : ''}
              {' · '}
              {progress.done}/{progress.total} sets
            </p>
          </div>
          {session.status === 'paused' ? (
            <button
              type="button"
              className="min-h-11 min-w-11 rounded-full border border-border p-2.5"
              onClick={() => void resumeSession(id).then(reload)}
              aria-label="Resume"
            >
              <Play size={18} />
            </button>
          ) : (
            <button
              type="button"
              className="min-h-11 min-w-11 rounded-full border border-border p-2.5"
              onClick={() => void pauseSession(id).then(reload)}
              aria-label="Pause"
            >
              <Pause size={18} />
            </button>
          )}
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full bg-accent transition-all duration-500"
            style={{
              width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%`,
            }}
          />
        </div>
      </header>

      <div className="flex items-center justify-between gap-2 px-3 pt-3">
        <button
          type="button"
          disabled={exerciseIndex === 0}
          onClick={goPrev}
          className="inline-flex min-h-11 items-center gap-1 rounded-2xl border border-border px-3 text-sm font-semibold text-muted disabled:opacity-30"
        >
          <ChevronLeft size={18} /> Prev
        </button>
        <p className="font-display text-sm font-bold tabular-nums">
          Exercise {exerciseIndex + 1}/{bundles.length}
        </p>
        <button
          type="button"
          disabled={exerciseIndex >= bundles.length - 1}
          onClick={goNext}
          className="inline-flex min-h-11 items-center gap-1 rounded-2xl border border-border px-3 text-sm font-semibold text-muted disabled:opacity-30"
        >
          Next <ChevronRight size={18} />
        </button>
      </div>

      <div className="animate-fade-up space-y-3 px-3 pt-3">
        <div className="rounded-3xl border border-border bg-card p-4">
          <p className="font-display text-2xl font-extrabold leading-tight">
            {exercise?.name ?? 'Exercise'}
          </p>
          <p className="mt-1 text-sm text-muted">
            {exerciseSession.targetRepMin}–{exerciseSession.targetRepMax} reps
            {exerciseSession.isUnilateral ? ' · Unilateral' : ''}
            {exerciseSession.suggestedWeight != null
              ? ` · Suggested ${formatWeight(exerciseSession.suggestedWeight, unit)}`
              : ' · Establish baseline'}
          </p>
          {prefill?.source === 'previous' && (
            <p className="mt-1 text-xs text-accent">
              Prefill from last session · {formatWeight(prefill.weight, unit)} × {prefill.reps}
            </p>
          )}

          {exercise?.id != null && (
            <div className="mt-3">
              <ExerciseSwitcher
                currentExerciseId={exercise.id}
                preferredAlternatives={exercise.alternatives}
                onSwitch={(nextId) => {
                  void switchExerciseInSession(exerciseSession.id!, nextId).then(reload)
                }}
              />
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowCues((v) => !v)}
            className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-border text-sm font-semibold text-muted"
          >
            <BookOpen size={16} />
            {showCues ? 'Hide technique' : 'Technique cues'}
          </button>

          {showCues && exercise && (
            <div className="mt-3 space-y-2 rounded-2xl bg-bg p-3 text-sm">
              {exercise.cues?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase text-muted">Cues</p>
                  <ul className="mt-1 list-disc space-y-1 pl-4">
                    {exercise.cues.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}
              {exercise.setup && (
                <p>
                  <span className="font-semibold">Setup: </span>
                  {exercise.setup}
                </p>
              )}
              {exercise.commonErrors?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase text-muted">Watch for</p>
                  <ul className="mt-1 list-disc space-y-1 pl-4 text-muted">
                    {exercise.commonErrors.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}
              {exercise.videoUrl && (
                <a
                  href={exercise.videoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="block text-accent"
                >
                  Open your video link
                </a>
              )}
              <Link
                to={`/exercises/${exercise.id}`}
                className="inline-block text-xs font-semibold text-accent"
              >
                Full exercise detail
              </Link>
            </div>
          )}
        </div>

        {sets.map((set) => (
          <SetRow
            key={set.id}
            set={set}
            unit={unit}
            targetRepMin={exerciseSession.targetRepMin}
            targetRepMax={exerciseSession.targetRepMax}
            targetRir={exerciseSession.targetRir}
            isUnilateral={exerciseSession.isUnilateral}
            prefillWeight={prefill?.weight}
            prefillReps={prefill?.reps}
            prefillRir={prefill?.rir}
            autoFocus={set.id === activeSetId && !set.isComplete}
            onCompleted={() => void onSetCompleted()}
          />
        ))}

        <div className="flex gap-2">
          <Button
            variant="secondary"
            className="min-h-12 flex-1"
            onClick={() => void addWarmupSet(exerciseSession.id!).then(reload)}
          >
            <Plus size={16} /> Warm-up
          </Button>
          <Button
            variant="secondary"
            className="min-h-12 flex-1"
            onClick={() => void addWorkingSet(exerciseSession.id!).then(reload)}
          >
            <Plus size={16} /> Set
          </Button>
        </div>

        <textarea
          className="w-full rounded-2xl border border-border bg-card px-3 py-3 text-sm outline-none focus:border-accent"
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

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-bg/95 p-3 backdrop-blur-xl safe-bottom">
        <div className="mx-auto max-w-lg">
          <Button
            fullWidth
            className="min-h-14 text-base"
            onClick={() => setConfirmFinish(true)}
          >
            <Flag size={18} />
            Finish Workout
          </Button>
        </div>
      </div>

      <RestTimer
        open={restOpen}
        seconds={restSeconds}
        onClose={() => setRestOpen(false)}
      />

      <ConfirmDialog
        open={confirmDiscard}
        title="Leave workout?"
        message="You have incomplete sets. Discard this session, or keep it paused to resume later?"
        confirmLabel="Discard"
        cancelLabel="Keep & Exit"
        danger
        onCancel={() => {
          setConfirmDiscard(false)
          void pauseSession(id).then(() => navigate('/train'))
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
            : 'Save this session and view your summary?'
        }
        confirmLabel="Finish"
        onCancel={() => setConfirmFinish(false)}
        onConfirm={() => {
          void finishSession(id).then(() => navigate(`/workout/${id}/summary`))
        }}
      />
    </div>
  )
}
