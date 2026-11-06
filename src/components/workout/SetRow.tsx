import { useEffect, useState } from 'react'
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
  onCompleted,
}: Props) {
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

  async function handleComplete() {
    if (set.isComplete || saving) return
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

  if (set.isComplete || justDone) {
    return (
      <div className="animate-fade-up rounded-2xl border border-success/40 bg-success/10 p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            {set.isWarmup ? 'Warm-up' : 'Set'} {set.setNumber}
          </p>
          <span className="inline-flex items-center gap-1 text-sm font-bold text-success">
            <Check size={16} strokeWidth={2.5} /> Done
          </span>
        </div>
        <p className="mt-2 font-display text-2xl font-extrabold tabular-nums">
          {formatWeight(
            set.isComplete ? set.weight : toStorageWeight(Number(weight) || 0, unit),
            unit,
          )}{' '}
          × {set.isComplete ? set.reps : Number(reps) || 0}
          {(set.isComplete ? set.rir : rir === '' ? null : Number(rir)) != null
            ? ` · RIR ${set.isComplete ? set.rir : rir}`
            : ''}
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-3xl border border-border bg-card-elevated p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          {set.isWarmup ? 'Warm-up' : 'Set'} {set.setNumber}
        </p>
        <p className="text-[11px] text-muted">
          Target {targetRepMin}–{targetRepMax}
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
        placeholder="Set notes (optional)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        className="mt-3 w-full rounded-2xl border border-border bg-bg px-3 py-3 text-sm outline-none focus:border-accent"
      />

      <button
        type="button"
        disabled={saving}
        onClick={() => void handleComplete()}
        className="mt-4 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-accent py-4 text-lg font-bold text-white shadow-[0_10px_28px_rgba(255,116,51,0.3)] active:scale-[0.98] disabled:opacity-50"
      >
        <Check size={22} strokeWidth={2.5} />
        Complete Set
      </button>
    </div>
  )
}
