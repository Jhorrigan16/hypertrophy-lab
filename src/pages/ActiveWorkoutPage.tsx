import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Check,
  ChevronDown,
  ChevronLeft,
  Flag,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
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
import { ExerciseSwitcher } from '@/components/workout/ExerciseSwitcher'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Button } from '@/components/ui/Button'

function focusKey(sessionId: number) {
  return `hl-workout-focus-${sessionId}`
}

function exerciseDone(
  sets: Array<{ isComplete: boolean; isWarmup: boolean }>,
): boolean {
  const working = sets.filter((s) => !s.isWarmup)
  return working.length > 0 && working.every((s) => s.isComplete)
}

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
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [confirmFinish, setConfirmFinish] = useState(false)
  const [showExtras, setShowExtras] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [flash, setFlash] = useState(false)
  const [initializedFocus, setInitializedFocus] = useState(false)
  const [keyboardInset, setKeyboardInset] = useState(0)
  const completeHandlerRef = useRef<(() => void) | null>(null)
  const [canComplete, setCanComplete] = useState(false)

  const bindComplete = useCallback((handler: (() => void) | null) => {
    completeHandlerRef.current = handler
    setCanComplete(handler != null)
  }, [])

  const reload = useCallback(async () => {
    const data = await loadSessionBundle(id)
    setBundle(data)
    if (data && !initializedFocus && data.bundles.length > 0) {
      const saved = sessionStorage.getItem(focusKey(id))
      const savedIdx = saved != null ? Number(saved) : NaN
      const next =
        Number.isFinite(savedIdx) && savedIdx >= 0 && savedIdx < data.bundles.length
          ? savedIdx
          : findNextIncompleteExerciseIndex(data.bundles, 0)
      setExerciseIndex(next)
      setInitializedFocus(true)
    }
  }, [id, initializedFocus])

  useEffect(() => {
    void reload()
  }, [reload, refreshKey])

  useEffect(() => {
    if (!Number.isFinite(id) || !initializedFocus) return
    sessionStorage.setItem(focusKey(id), String(exerciseIndex))
  }, [id, exerciseIndex, initializedFocus])

  useEffect(() => {
    if (!bundle?.session) return
    const tick = () => setElapsed(sessionElapsedMs(bundle.session))
    tick()
    const t = window.setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [bundle?.session])

  // Keep sticky actions above the soft keyboard (iOS/Android visualViewport)
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => {
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      setKeyboardInset(inset)
    }
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])

  // Harden persistence: pause when the page is backgrounded / closed mid-session
  useEffect(() => {
    const onHide = () => {
      void db.workoutSessions.get(id).then((s) => {
        if (s?.status === 'in_progress') void pauseSession(id)
      })
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') onHide()
    }
    window.addEventListener('pagehide', onHide)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pagehide', onHide)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [id])

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
  const completedSets = sets.filter((s) => s.isComplete)
  const activeSets = sets.filter((s) => !s.isComplete)
  const activeSet = activeSets[0]
  const workingDone = sets.filter((s) => !s.isWarmup && s.isComplete).length
  const workingTotal = sets.filter((s) => !s.isWarmup).length

  async function onSetCompleted() {
    setFlash(true)
    window.setTimeout(() => setFlash(false), 450)
    await reload()
    const fresh = await loadSessionBundle(id)
    if (!fresh) return
    const cur = fresh.bundles[exerciseIndex]
    const workingLeft = cur?.sets.some((s) => !s.isWarmup && !s.isComplete)
    if (!workingLeft) {
      const next = findNextIncompleteExerciseIndex(fresh.bundles, exerciseIndex)
      setExerciseIndex(next)
      setShowExtras(false)
    }
  }

  const footerOffset = keyboardInset > 0 ? keyboardInset : 0

  return (
    <div
      className="relative flex min-h-full flex-col"
      style={{
        paddingBottom: `calc(${canComplete ? '8.5rem' : '5.5rem'} + env(safe-area-inset-bottom, 0px) + ${footerOffset}px)`,
      }}
    >
      {flash && (
        <div className="pointer-events-none fixed inset-0 z-[70] animate-fade-up bg-success/20" />
      )}

      <header className="sticky top-0 z-30 border-b border-border/60 bg-bg/95 px-3 py-2.5 backdrop-blur-xl">
        <div className="flex items-center gap-1.5">
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
            <p className="truncate font-display text-base font-bold">{session.title}</p>
            <p className="text-[11px] text-muted">
              {formatTimer(Math.floor(elapsed / 1000))}
              {session.status === 'paused' ? ' · Paused' : ''}
              {' · '}
              {progress.done}/{progress.total} sets
            </p>
          </div>
          <button
            type="button"
            className="min-h-11 min-w-11 rounded-full border border-border p-2.5"
            onClick={() =>
              session.status === 'paused'
                ? void resumeSession(id).then(reload)
                : void pauseSession(id).then(reload)
            }
            aria-label={session.status === 'paused' ? 'Resume' : 'Pause'}
          >
            {session.status === 'paused' ? <Play size={18} /> : <Pause size={18} />}
          </button>
          <button
            type="button"
            className="inline-flex min-h-11 items-center gap-1 rounded-full border border-border px-3 text-xs font-bold"
            onClick={() => setConfirmFinish(true)}
          >
            <Flag size={14} />
            Finish
          </button>
        </div>

        <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full bg-accent transition-all duration-500"
            style={{
              width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%`,
            }}
          />
        </div>

        <div className="mt-2.5 flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {bundles.map((b, idx) => {
            const done = exerciseDone(b.sets)
            const active = idx === exerciseIndex
            const label = b.exercise?.name?.split(' ').slice(0, 2).join(' ') ?? `Ex ${idx + 1}`
            return (
              <button
                key={b.exerciseSession.id}
                type="button"
                onClick={() => {
                  setExerciseIndex(idx)
                  setShowExtras(false)
                }}
                className={[
                  'inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition',
                  active
                    ? 'border-accent bg-accent text-white'
                    : done
                      ? 'border-success/40 bg-success/10 text-success'
                      : 'border-border bg-card text-muted',
                ].join(' ')}
              >
                {done && !active ? <Check size={12} strokeWidth={2.5} /> : null}
                <span className="max-w-[7.5rem] truncate">
                  {idx + 1}. {label}
                </span>
              </button>
            )
          })}
        </div>
      </header>

      <div className="animate-fade-up space-y-3 px-3 pt-3">
        <div className="rounded-3xl border border-border bg-card px-4 py-3.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-display text-xl font-extrabold leading-tight">
                {exercise?.name ?? 'Exercise'}
              </p>
              <p className="mt-1 text-sm text-muted">
                {workingDone}/{workingTotal} sets · {exerciseSession.targetRepMin}–
                {exerciseSession.targetRepMax} reps
                {prefill?.source === 'previous'
                  ? ` · last ${formatWeight(prefill.weight, unit, 0)}×${prefill.reps}`
                  : exerciseSession.suggestedWeight != null
                    ? ` · sug ${formatWeight(exerciseSession.suggestedWeight, unit, 0)}`
                    : ''}
              </p>
            </div>
            <button
              type="button"
              className="min-h-11 min-w-11 rounded-2xl border border-border text-muted"
              onClick={() => setShowExtras((v) => !v)}
              aria-label="More options"
            >
              {showExtras ? <ChevronDown size={18} /> : <MoreHorizontal size={18} />}
            </button>
          </div>

          {showExtras && (
            <div className="mt-3 space-y-2 border-t border-border pt-3">
              {exercise?.id != null && (
                <ExerciseSwitcher
                  currentExerciseId={exercise.id}
                  preferredAlternatives={exercise.alternatives}
                  onSwitch={(nextId) => {
                    void switchExerciseInSession(exerciseSession.id!, nextId).then(reload)
                  }}
                />
              )}
              {exercise?.cues && exercise.cues.length > 0 && (
                <ul className="list-disc space-y-1 rounded-2xl bg-bg px-4 py-3 text-sm text-muted">
                  {exercise.cues.slice(0, 3).map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              )}
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  className="min-h-11 flex-1 !py-2.5 text-sm"
                  onClick={() => void addWarmupSet(exerciseSession.id!).then(reload)}
                >
                  <Plus size={14} /> Warm-up
                </Button>
                <Button
                  variant="secondary"
                  className="min-h-11 flex-1 !py-2.5 text-sm"
                  onClick={() => void addWorkingSet(exerciseSession.id!).then(reload)}
                >
                  <Plus size={14} /> Set
                </Button>
              </div>
            </div>
          )}
        </div>

        {completedSets.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {completedSets.map((set) => (
              <SetRow
                key={set.id}
                set={set}
                unit={unit}
                targetRepMin={exerciseSession.targetRepMin}
                targetRepMax={exerciseSession.targetRepMax}
                targetRir={exerciseSession.targetRir}
                isUnilateral={exerciseSession.isUnilateral}
                compact
                onCompleted={() => undefined}
              />
            ))}
          </div>
        )}

        {activeSet ? (
          <SetRow
            key={activeSet.id}
            set={activeSet}
            unit={unit}
            targetRepMin={exerciseSession.targetRepMin}
            targetRepMax={exerciseSession.targetRepMax}
            targetRir={exerciseSession.targetRir}
            isUnilateral={exerciseSession.isUnilateral}
            prefillWeight={prefill?.weight}
            prefillReps={prefill?.reps}
            prefillRir={prefill?.rir}
            autoFocus
            onBindComplete={bindComplete}
            onCompleted={() => void onSetCompleted()}
          />
        ) : (
          <div className="rounded-3xl border border-success/30 bg-success/10 px-4 py-5 text-center">
            <p className="font-display text-lg font-bold text-success">Exercise complete</p>
            <p className="mt-1 text-sm text-muted">Tap another exercise above to reopen it</p>
          </div>
        )}
      </div>

      <div
        className="fixed inset-x-0 z-40 border-t border-border/80 bg-bg/95 px-3 pt-2.5 backdrop-blur-xl"
        style={{
          bottom: footerOffset,
          paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))',
        }}
      >
        <div className="mx-auto max-w-lg space-y-2">
          {canComplete ? (
            <button
              type="button"
              onClick={() => completeHandlerRef.current?.()}
              className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-accent text-lg font-bold text-white shadow-[0_10px_28px_rgba(255,116,51,0.3)] active:scale-[0.98]"
            >
              <Check size={22} strokeWidth={2.5} />
              Complete Set
            </button>
          ) : (
            <Button fullWidth className="min-h-14 text-base" onClick={() => setConfirmFinish(true)}>
              <Flag size={18} />
              Finish Workout
            </Button>
          )}
        </div>
      </div>

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
