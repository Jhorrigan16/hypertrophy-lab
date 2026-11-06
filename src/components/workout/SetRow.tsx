import { useEffect, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import type { LoggedSet, WeightUnit } from '@/db/types'
import { toDisplayWeight, toStorageWeight, formatWeight } from '@/lib/units'
import { completeSet } from '@/lib/sessions'

interface Props {
  set: LoggedSet
  unit: WeightUnit
  targetRepMin: number
  targetRepMax: number
  targetRir?: number
  isUnilateral: boolean
  prefillWeight?: number
  prefillReps?: number
  prefillRir?: number | null
  autoFocus?: boolean
  /** Compact chip for already-logged sets. */
  compact?: boolean
  /** Parent owns the sticky Complete button; call with latest handler. */
  onBindComplete?: (handler: (() => void) | null) => void
  onCompleted: () => void
}

function hapticLight() {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(12)
    }
  } catch {
    // ignore
  }
}

export function SetRow({
  set,
  unit,
  targetRepMin,
  targetRepMax,
  targetRir,
  isUnilateral,
  prefillWeight,
  prefillReps,
  prefillRir,
  autoFocus,
  compact,
  onBindComplete,
  onCompleted,
}: Props) {
  const cardRef = useRef<HTMLDivElement>(null)
  const initialWeight =
    set.weight > 0
      ? set.weight
      : prefillWeight != null && prefillWeight > 0
        ? prefillWeight
        : 0
  const [weight, setWeight] = useState(
    () => Math.round(toDisplayWeight(initialWeight, unit) * 10) / 10,
  )
  const [reps, setReps] = useState(
    () => (set.reps > 0 ? set.reps : prefillReps || targetRepMax),
  )
  const [rir, setRir] = useState<number | ''>(
    () => set.rir ?? prefillRir ?? targetRir ?? 2,
  )
  const [notes, setNotes] = useState(set.notes ?? '')
  const [side, setSide] = useState<'left' | 'right' | null>(set.isUnilateralSide ?? null)
  const [saving, setSaving] = useState(false)
  const [justDone, setJustDone] = useState(false)

  useEffect(() => {
    if (set.isComplete) return
    if (set.weight <= 0 && prefillWeight != null && prefillWeight > 0) {
      setWeight(Math.round(toDisplayWeight(prefillWeight, unit) * 10) / 10)
    }
    if (set.reps <= 0 && prefillReps != null && prefillReps > 0) {
      setReps(prefillReps)
    }
    if (set.rir == null && prefillRir != null) {
      setRir(prefillRir)
    }
  }, [set.isComplete, set.weight, set.reps, set.rir, prefillWeight, prefillReps, prefillRir, unit])

  function ensureVisible() {
    window.requestAnimationFrame(() => {
      cardRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    })
  }

  async function handleComplete() {
    if (set.isComplete || saving || justDone) return
    setSaving(true)
    try {
      await completeSet({
        setId: set.id!,
        weight: toStorageWeight(Number(weight) || 0, unit),
        reps: Number(reps) || 0,
        rir: rir === '' ? null : Number(rir),
        notes: notes || undefined,
        isUnilateralSide: side,
      })
      hapticLight()
      setJustDone(true)
      onCompleted()
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    if (!onBindComplete) return
    if (set.isComplete || justDone) {
      onBindComplete(null)
      return
    }
    onBindComplete(() => {
      void handleComplete()
    })
    return () => onBindComplete(null)
    // Re-bind when field values change so sticky CTA logs current inputs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onBindComplete, set.isComplete, justDone, weight, reps, rir, notes, side, saving])

  if (set.isComplete || justDone) {
    const w = set.isComplete ? set.weight : toStorageWeight(Number(weight) || 0, unit)
    const r = set.isComplete ? set.reps : Number(reps) || 0
    const loggedRir = set.isComplete ? set.rir : rir === '' ? null : Number(rir)
    if (compact) {
      return (
        <div className="inline-flex items-center gap-2 rounded-full border border-success/30 bg-success/10 px-3 py-1.5 text-sm">
          <Check size={14} className="text-success" strokeWidth={2.5} />
          <span className="font-semibold tabular-nums">
            {set.isWarmup ? 'WU' : `S${set.setNumber}`} · {formatWeight(w, unit, 0)}×{r}
            {loggedRir != null ? ` @${loggedRir}` : ''}
          </span>
        </div>
      )
    }
    return (
      <div className="animate-fade-up rounded-2xl border border-success/40 bg-success/10 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            {set.isWarmup ? 'Warm-up' : 'Set'} {set.setNumber}
          </p>
          <span className="inline-flex items-center gap-1 text-sm font-bold text-success">
            <Check size={16} strokeWidth={2.5} /> Done
          </span>
        </div>
        <p className="mt-1 font-display text-xl font-extrabold tabular-nums">
          {formatWeight(w, unit)} × {r}
          {loggedRir != null ? ` · RIR ${loggedRir}` : ''}
        </p>
      </div>
    )
  }

  return (
    <div
      ref={cardRef}
      className="rounded-3xl border border-accent/40 bg-card-elevated p-4 shadow-[0_0_0_1px_rgba(255,116,51,0.08)]"
    >
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent">
          {set.isWarmup ? 'Warm-up' : 'Set'} {set.setNumber} · logging
        </p>
        <p className="text-[11px] text-muted">
          {targetRepMin}–{targetRepMax}
          {targetRir != null ? ` @ ~${targetRir} RIR` : ''}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-medium text-muted">
            Weight ({unit})
          </span>
          <input
            type="number"
            inputMode="decimal"
            autoFocus={autoFocus}
            value={weight}
            onFocus={ensureVisible}
            onChange={(e) => setWeight(Number(e.target.value))}
            className="w-full rounded-2xl border border-border bg-bg px-2 py-4 text-center text-xl font-bold tabular-nums outline-none focus:border-accent"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-medium text-muted">Reps</span>
          <input
            type="number"
            inputMode="numeric"
            value={reps}
            onFocus={ensureVisible}
            onChange={(e) => setReps(Number(e.target.value))}
            className="w-full rounded-2xl border border-border bg-bg px-2 py-4 text-center text-xl font-bold tabular-nums outline-none focus:border-accent"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-medium text-muted">RIR</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={10}
            value={rir}
            onFocus={ensureVisible}
            onChange={(e) => setRir(e.target.value === '' ? '' : Number(e.target.value))}
            className="w-full rounded-2xl border border-border bg-bg px-2 py-4 text-center text-xl font-bold tabular-nums outline-none focus:border-accent"
          />
        </label>
      </div>

      {isUnilateral && (
        <div className="mt-3 flex gap-2">
          {(['left', 'right'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSide(s)}
              className={[
                'min-h-11 flex-1 rounded-2xl border text-sm font-semibold capitalize',
                side === s
                  ? 'border-accent bg-accent/15 text-accent'
                  : 'border-border text-muted',
              ].join(' ')}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <input
        type="text"
        placeholder="Notes (optional)"
        value={notes}
        onFocus={ensureVisible}
        onChange={(e) => setNotes(e.target.value)}
        className="mt-3 w-full rounded-2xl border border-border bg-bg px-3 py-3 text-sm outline-none focus:border-accent"
      />
    </div>
  )
}
