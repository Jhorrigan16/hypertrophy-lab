import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { CARDIO_MODALITY_LABELS } from '@/data/cardio'
import { archiveCardioActivityType, saveCardioActivityType } from '@/lib/cardio'
import type { CardioActivityType, CardioModality } from '@/db/types'

interface Props {
  open: boolean
  activity: CardioActivityType | null
  onClose: () => void
  onSaved: () => void
}

const MODALITIES = Object.keys(CARDIO_MODALITY_LABELS) as CardioModality[]

export function EditCardioActivitySheet({ open, activity, onClose, onSaved }: Props) {
  const isNew = activity == null || activity.id == null
  const [name, setName] = useState('')
  const [modality, setModality] = useState<CardioModality>('run')
  const [defaultEffort, setDefaultEffort] = useState(5)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(activity?.name ?? '')
    setModality(activity?.modality ?? 'run')
    setDefaultEffort(activity?.defaultEffort ?? 5)
    setNotes(activity?.notes ?? '')
  }, [open, activity])

  if (!open) return null

  async function handleSave() {
    setSaving(true)
    try {
      await saveCardioActivityType({
        id: activity?.id,
        name,
        modality,
        defaultEffort,
        notes: notes.trim() || undefined,
      })
      onSaved()
      onClose()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  async function handleArchive() {
    if (!activity?.id) return
    if (!confirm(`Archive “${activity.name}”? Existing sessions stay in history.`)) return
    setSaving(true)
    try {
      await archiveCardioActivityType(activity.id)
      onSaved()
      onClose()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not archive')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/60 safe-bottom">
      <div className="w-full max-w-lg animate-fade-up rounded-t-3xl border border-border bg-card p-5">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />
        <h2 className="font-display text-xl font-bold">
          {isNew ? 'New cardio activity' : 'Edit activity'}
        </h2>
        <p className="mt-1 text-sm text-muted">Editable locally · not medical advice</p>

        <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-muted">
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1.5 w-full rounded-2xl border border-border bg-bg px-3 py-3 text-sm font-semibold text-text"
            placeholder="e.g. Tempo run"
          />
        </label>

        <div className="mt-4">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
            Modality
          </p>
          <div className="flex flex-wrap gap-2">
            {MODALITIES.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setModality(m)}
                className={[
                  'rounded-xl px-3 py-2 text-sm font-semibold',
                  modality === m
                    ? 'bg-accent text-white'
                    : 'border border-border bg-bg text-muted',
                ].join(' ')}
              >
                {CARDIO_MODALITY_LABELS[m]}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-1.5 flex justify-between text-sm">
            <span className="font-medium">Default effort</span>
            <span className="font-semibold text-accent">{defaultEffort}/10</span>
          </div>
          <input
            type="range"
            min={1}
            max={10}
            value={defaultEffort}
            onChange={(e) => setDefaultEffort(Number(e.target.value))}
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
          />
        </label>

        <div className="mt-5 flex gap-3">
          <Button variant="ghost" fullWidth onClick={onClose}>
            Cancel
          </Button>
          <Button fullWidth disabled={saving || !name.trim()} onClick={() => void handleSave()}>
            Save
          </Button>
        </div>

        {!isNew && (
          <Button
            variant="danger"
            fullWidth
            className="mt-3"
            disabled={saving}
            onClick={() => void handleArchive()}
          >
            Archive activity
          </Button>
        )}
      </div>
    </div>
  )
}
