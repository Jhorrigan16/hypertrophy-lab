import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { CARDIO_MODALITY_LABELS } from '@/data/cardio'
import {
  displayToMeters,
  logCompletedCardioSession,
  type DistanceUnit,
} from '@/lib/cardio'
import type { CardioActivityType } from '@/db/types'

interface Props {
  open: boolean
  activity: CardioActivityType | null
  onClose: () => void
  onSaved: () => void
}

export function QuickLogCardioSheet({ open, activity, onClose, onSaved }: Props) {
  const [hours, setHours] = useState(0)
  const [minutes, setMinutes] = useState(30)
  const [seconds, setSeconds] = useState(0)
  const [distance, setDistance] = useState('')
  const [unit, setUnit] = useState<DistanceUnit>('mi')
  const [effort, setEffort] = useState(5)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open || !activity) return
    setHours(0)
    setMinutes(30)
    setSeconds(0)
    setDistance('')
    setUnit('mi')
    setEffort(activity.defaultEffort)
    setNotes('')
  }, [open, activity])

  if (!open || !activity) return null

  async function handleSave() {
    if (!activity?.id) return
    const durationSeconds = hours * 3600 + minutes * 60 + seconds
    if (durationSeconds <= 0) {
      alert('Enter a duration greater than zero.')
      return
    }
    setSaving(true)
    try {
      const distanceValue = distance.trim() === '' ? null : Number(distance)
      if (distanceValue != null && (!Number.isFinite(distanceValue) || distanceValue < 0)) {
        alert('Distance must be a valid number.')
        return
      }
      await logCompletedCardioSession({
        activityTypeId: activity.id,
        durationSeconds,
        distanceMeters:
          distanceValue == null ? null : displayToMeters(distanceValue, unit),
        effort,
        notes: notes.trim() || undefined,
      })
      onSaved()
      onClose()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not save cardio')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/60 safe-bottom">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto animate-fade-up rounded-t-3xl border border-border bg-card p-5">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />
        <h2 className="font-display text-xl font-bold">Log {activity.name}</h2>
        <p className="mt-1 text-sm text-muted">
          {CARDIO_MODALITY_LABELS[activity.modality]} · quick log after the fact
        </p>

        <div className="mt-4">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
            Duration
          </p>
          <div className="grid grid-cols-3 gap-2">
            <NumberField label="hr" value={hours} min={0} max={12} onChange={setHours} />
            <NumberField label="min" value={minutes} min={0} max={59} onChange={setMinutes} />
            <NumberField label="sec" value={seconds} min={0} max={59} onChange={setSeconds} />
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              Distance (optional)
            </p>
            <div className="flex gap-1">
              {(['mi', 'km'] as const).map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setUnit(u)}
                  className={[
                    'rounded-lg px-2 py-1 text-xs font-semibold',
                    unit === u ? 'bg-accent text-white' : 'bg-bg text-muted border border-border',
                  ].join(' ')}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min={0}
            placeholder="e.g. 3.1"
            value={distance}
            onChange={(e) => setDistance(e.target.value)}
            className="w-full rounded-2xl border border-border bg-bg px-3 py-3 text-sm font-semibold"
          />
        </div>

        <div className="mt-4">
          <div className="mb-1.5 flex justify-between text-sm">
            <span className="font-medium">Effort</span>
            <span className="font-semibold text-accent">{effort}/10</span>
          </div>
          <input
            type="range"
            min={1}
            max={10}
            step={1}
            value={effort}
            onChange={(e) => setEffort(Number(e.target.value))}
            className="w-full accent-[var(--color-accent)]"
          />
        </div>

        <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-muted">
          Notes
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="mt-1.5 w-full rounded-2xl border border-border bg-bg px-3 py-2.5 text-sm font-normal text-text"
            placeholder="Optional"
          />
        </label>

        <div className="mt-5 flex gap-3">
          <Button variant="ghost" fullWidth onClick={onClose}>
            Cancel
          </Button>
          <Button fullWidth disabled={saving} onClick={() => void handleSave()}>
            Save session
          </Button>
        </div>
      </div>
    </div>
  )
}

function NumberField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  onChange: (n: number) => void
}) {
  return (
    <label className="text-xs text-muted">
      {label}
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value)
          if (!Number.isFinite(n)) return
          onChange(Math.min(max, Math.max(min, Math.round(n))))
        }}
        className="mt-1 w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-sm font-semibold text-text"
      />
    </label>
  )
}
