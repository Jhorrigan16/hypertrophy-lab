import { useState } from 'react'
import { Check } from 'lucide-react'
import type { LoggedSet, WeightUnit } from '@/db/types'
import { toDisplayWeight, toStorageWeight } from '@/lib/units'
import { completeSet } from '@/lib/sessions'

interface Props {
  set: LoggedSet
  unit: WeightUnit
  targetRepMin: number
  targetRepMax: number
  targetRir?: number
  isUnilateral: boolean
  onCompleted: () => void
}

export function SetRow({
  set,
  unit,
  targetRepMin,
  targetRepMax,
  targetRir,
  isUnilateral,
  onCompleted,
}: Props) {
  const [weight, setWeight] = useState(
    () => Math.round(toDisplayWeight(set.weight, unit) * 10) / 10,
  )
  const [reps, setReps] = useState(set.reps || targetRepMax)
  const [rir, setRir] = useState<number | ''>(set.rir ?? targetRir ?? 2)
  const [notes, setNotes] = useState(set.notes ?? '')
  const [side, setSide] = useState<'left' | 'right' | null>(set.isUnilateralSide ?? null)
  const [saving, setSaving] = useState(false)

  async function handleComplete() {
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
      onCompleted()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className={[
        'rounded-2xl border p-3',
        set.isComplete ? 'border-success/40 bg-success/5' : 'border-border bg-card-elevated',
      ].join(' ')}
    >
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          {set.isWarmup ? 'Warm-up' : 'Set'} {set.setNumber}
          {set.isComplete ? ' · Done' : ''}
        </p>
        <p className="text-[11px] text-muted">
          Target {targetRepMin}–{targetRepMax}
          {targetRir != null ? ` @ ~${targetRir} RIR` : ''}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <label className="block">
          <span className="mb-1 block text-[11px] text-muted">Weight ({unit})</span>
          <input
            type="number"
            inputMode="decimal"
            value={weight}
            onChange={(e) => setWeight(Number(e.target.value))}
            className="w-full rounded-xl border border-border bg-bg px-3 py-3 text-center text-lg font-semibold tabular-nums outline-none focus:border-accent"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] text-muted">Reps</span>
          <input
            type="number"
            inputMode="numeric"
            value={reps}
            onChange={(e) => setReps(Number(e.target.value))}
            className="w-full rounded-xl border border-border bg-bg px-3 py-3 text-center text-lg font-semibold tabular-nums outline-none focus:border-accent"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] text-muted">RIR</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={10}
            value={rir}
            onChange={(e) => setRir(e.target.value === '' ? '' : Number(e.target.value))}
            className="w-full rounded-xl border border-border bg-bg px-3 py-3 text-center text-lg font-semibold tabular-nums outline-none focus:border-accent"
          />
        </label>
      </div>

      {isUnilateral && (
        <div className="mt-2 flex gap-2">
          {(['left', 'right'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSide(s)}
              className={[
                'flex-1 rounded-xl border py-2 text-sm font-semibold capitalize',
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
        className="mt-2 w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-sm outline-none focus:border-accent"
      />

      <button
        type="button"
        disabled={saving}
        onClick={() => void handleComplete()}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-accent py-4 text-base font-bold text-white shadow-[0_8px_24px_rgba(255,116,51,0.28)] active:scale-[0.98] disabled:opacity-50"
      >
        <Check size={20} strokeWidth={2.5} />
        {set.isComplete ? 'Update Set' : 'Complete Set'}
      </button>
    </div>
  )
}
