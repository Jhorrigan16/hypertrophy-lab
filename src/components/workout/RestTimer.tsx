import { useEffect, useRef, useState } from 'react'
import { Pause, Play, RotateCcw, X } from 'lucide-react'
import {
  computeRemaining,
  createRestTimer,
  formatTimer,
  notifyRestComplete,
  pauseRestTimer,
  resetRestTimer,
  resumeRestTimer,
  startRestTimer,
  tickRestTimer,
  type RestTimerState,
} from '@/lib/restTimer'
import { useSettings } from '@/hooks/useSettings'

interface Props {
  seconds: number
  open: boolean
  onClose: () => void
}

export function RestTimer({ seconds, open, onClose }: Props) {
  const settings = useSettings()
  const [state, setState] = useState<RestTimerState>(() => createRestTimer(seconds))
  const notified = useRef(false)

  useEffect(() => {
    if (!open) return
    notified.current = false
    setState(startRestTimer(createRestTimer(seconds)))
  }, [open, seconds])

  useEffect(() => {
    if (!open || !state.isRunning || state.isPaused) return
    const id = window.setInterval(() => {
      setState((s) => {
        const next = tickRestTimer(s)
        if (next.remainingSeconds <= 0 && !notified.current) {
          notified.current = true
          void notifyRestComplete({
            sound: settings?.restTimerSound ?? true,
            vibration: settings?.restTimerVibration ?? true,
          })
        }
        return next
      })
    }, 250)

    const onVis = () => {
      setState((s) => {
        const remaining = computeRemaining(s)
        return { ...s, remainingSeconds: remaining }
      })
    }
    document.addEventListener('visibilitychange', onVis)

    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [open, state.isRunning, state.isPaused, settings?.restTimerSound, settings?.restTimerVibration])

  if (!open) return null

  const progress =
    state.durationSeconds > 0
      ? 1 - state.remainingSeconds / state.durationSeconds
      : 1

  return (
    <div className="fixed inset-x-0 bottom-0 z-[80] p-3 safe-bottom">
      <div className="mx-auto max-w-lg rounded-3xl border border-border bg-card-elevated p-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Rest timer</p>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-muted">
            <X size={18} />
          </button>
        </div>
        <div className="mt-2 flex items-end justify-between">
          <p className="font-display text-5xl font-extrabold tabular-nums text-text">
            {formatTimer(state.remainingSeconds)}
          </p>
          <div className="mb-2 h-1.5 w-24 overflow-hidden rounded-full bg-border">
            <div
              className="h-full bg-accent transition-all duration-200"
              style={{ width: `${Math.min(100, progress * 100)}%` }}
            />
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          {state.isPaused || !state.isRunning ? (
            <button
              type="button"
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-accent py-3 font-semibold"
              onClick={() =>
                setState((s) =>
                  !s.isRunning ? startRestTimer(s) : resumeRestTimer(s),
                )
              }
            >
              <Play size={18} /> {state.isRunning ? 'Resume' : 'Start'}
            </button>
          ) : (
            <button
              type="button"
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-card border border-border py-3 font-semibold"
              onClick={() => setState((s) => pauseRestTimer(s))}
            >
              <Pause size={18} /> Pause
            </button>
          )}
          <button
            type="button"
            className="flex items-center justify-center gap-2 rounded-2xl border border-border px-4 py-3 font-semibold text-muted"
            onClick={() => {
              notified.current = false
              setState((s) => startRestTimer(resetRestTimer(s)))
            }}
          >
            <RotateCcw size={18} />
          </button>
        </div>
        <p className="mt-2 text-[11px] leading-snug text-muted">
          Timer uses wall-clock time so backgrounding stays accurate. iOS PWAs have limited
          background notifications — keep the app open for reliable alerts.
        </p>
      </div>
    </div>
  )
}
