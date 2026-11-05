import { useState } from 'react'
import { format } from 'date-fns'
import { Button } from '../ui/Button'
import { readinessNote, readinessScore, saveReadiness } from '@/lib/readiness'

interface Props {
  open: boolean
  onClose: () => void
  onSkip: () => void
  onSave: (entryId: number) => void
}

const FIELDS = [
  { key: 'sleep', label: 'Sleep' },
  { key: 'energy', label: 'Energy' },
  { key: 'soreness', label: 'Soreness' },
  { key: 'motivation', label: 'Motivation' },
  { key: 'fatigue', label: 'Fatigue' },
] as const

export function ReadinessSheet({ open, onClose, onSkip, onSave }: Props) {
  const [values, setValues] = useState({
    sleep: 3,
    energy: 3,
    soreness: 3,
    motivation: 3,
    fatigue: 3,
  })

  if (!open) return null

  const score = readinessScore(values)
  const note = readinessNote(score)

  async function handleSave() {
    const id = await saveReadiness({
      date: format(new Date(), 'yyyy-MM-dd'),
      ...values,
    })
    onSave(id)
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/60 safe-bottom">
      <div className="w-full max-w-lg animate-fade-up rounded-t-3xl border border-border bg-card p-5">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />
        <h2 className="font-display text-xl font-bold">Quick readiness</h2>
        <p className="mt-1 text-sm text-muted">Optional · 1–5 · not medical advice</p>

        <div className="mt-4 space-y-4">
          {FIELDS.map(({ key, label }) => (
            <div key={key}>
              <div className="mb-1.5 flex justify-between text-sm">
                <span className="font-medium">{label}</span>
                <span className="text-accent font-semibold">{values[key]}</span>
              </div>
              <input
                type="range"
                min={1}
                max={5}
                step={1}
                value={values[key]}
                onChange={(e) =>
                  setValues((v) => ({ ...v, [key]: Number(e.target.value) }))
                }
                className="w-full accent-[var(--color-accent)]"
              />
            </div>
          ))}
        </div>

        <p className="mt-3 text-sm text-muted">
          Score ≈ <span className="text-text font-semibold">{score}</span>/5
        </p>
        {note && (
          <p className="mt-2 rounded-2xl bg-accent/10 px-3 py-2 text-sm text-accent">{note}</p>
        )}

        <div className="mt-5 flex gap-3">
          <Button variant="ghost" fullWidth onClick={onSkip}>
            Skip
          </Button>
          <Button
            variant="secondary"
            fullWidth
            onClick={() => {
              onClose()
            }}
          >
            Cancel
          </Button>
          <Button fullWidth onClick={() => void handleSave()}>
            Save
          </Button>
        </div>
      </div>
    </div>
  )
}
