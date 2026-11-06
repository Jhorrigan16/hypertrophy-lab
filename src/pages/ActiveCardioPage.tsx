import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import {
  completeCardioSession,
  discardCardioSession,
  displayToMeters,
  formatDuration,
  formatPace,
  metersToDisplay,
  updateCardioSession,
  type DistanceUnit,
} from '@/lib/cardio'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { CARDIO_MODALITY_LABELS } from '@/data/cardio'

export function ActiveCardioPage() {
  const { sessionId } = useParams()
  const id = Number(sessionId)
  const navigate = useNavigate()
  const session = useLiveQuery(() => (Number.isFinite(id) ? db.cardioSessions.get(id) : undefined), [
    id,
  ])

  const [elapsed, setElapsed] = useState(0)
  const [running, setRunning] = useState(true)
  const [distance, setDistance] = useState('')
  const [unit, setUnit] = useState<DistanceUnit>('mi')
  const [effort, setEffort] = useState(5)
  const [notes, setNotes] = useState('')
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [saving, setSaving] = useState(false)
  const startedAtRef = useRef<number | null>(null)
  const accumulatedRef = useRef(0)
  const hydrated = useRef(false)

  useEffect(() => {
    if (!session || hydrated.current) return
    hydrated.current = true
    accumulatedRef.current = session.durationSeconds || 0
    setElapsed(session.durationSeconds || 0)
    setEffort(session.effort ?? 5)
    setNotes(session.notes ?? '')
    if (session.distanceMeters != null) {
      setDistance(String(Math.round(metersToDisplay(session.distanceMeters, 'mi') * 100) / 100))
    }
    startedAtRef.current = Date.now()
    setRunning(session.status === 'in_progress')
  }, [session])

  useEffect(() => {
    if (!running || session?.status !== 'in_progress') return
    const tick = window.setInterval(() => {
      const base = accumulatedRef.current
      const started = startedAtRef.current ?? Date.now()
      setElapsed(base + Math.floor((Date.now() - started) / 1000))
    }, 250)
    return () => window.clearInterval(tick)
  }, [running, session?.status])

  useEffect(() => {
    if (!session || session.status !== 'in_progress') return
    const handle = window.setInterval(() => {
      void updateCardioSession(session.id!, { durationSeconds: elapsed })
    }, 5000)
    return () => window.clearInterval(handle)
  }, [elapsed, session])

  if (!session) {
    return (
      <div className="px-4 pt-10 text-center text-muted">
        <p>Loading cardio session…</p>
      </div>
    )
  }

  if (session.status === 'completed' || session.status === 'discarded') {
    return (
      <div className="px-4 pt-10 text-center">
        <p className="font-display text-xl font-bold">Session ended</p>
        <Button className="mt-4" onClick={() => navigate('/')}>
          Back home
        </Button>
      </div>
    )
  }

  const activeId = session.id!

  function pause() {
    accumulatedRef.current = elapsed
    startedAtRef.current = null
    setRunning(false)
    void updateCardioSession(activeId, { durationSeconds: elapsed })
  }

  function resume() {
    startedAtRef.current = Date.now()
    setRunning(true)
  }

  async function finish() {
    setSaving(true)
    try {
      if (running) {
        accumulatedRef.current = elapsed
        startedAtRef.current = null
        setRunning(false)
      }
      const distanceValue = distance.trim() === '' ? null : Number(distance)
      if (distanceValue != null && (!Number.isFinite(distanceValue) || distanceValue < 0)) {
        alert('Distance must be a valid number.')
        return
      }
      await completeCardioSession(activeId, {
        durationSeconds: elapsed,
        distanceMeters:
          distanceValue == null ? null : displayToMeters(distanceValue, unit),
        effort,
        notes: notes.trim() || undefined,
      })
      navigate('/')
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not finish')
    } finally {
      setSaving(false)
    }
  }

  const distanceMeters =
    distance.trim() === '' || !Number.isFinite(Number(distance))
      ? null
      : displayToMeters(Number(distance), unit)

  return (
    <div className="px-4 pt-4 animate-fade-up">
      <header className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent">
          {CARDIO_MODALITY_LABELS[session.modality]} · live
        </p>
        <h1 className="font-display text-3xl font-extrabold">{session.title}</h1>
      </header>

      <Card className="mb-4 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Elapsed</p>
        <p className="mt-2 font-display text-5xl font-extrabold tracking-tight tabular-nums">
          {formatDuration(elapsed)}
        </p>
        <p className="mt-2 text-sm text-muted">
          Pace {formatPace(distanceMeters, elapsed, unit)}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {running ? (
            <Button variant="secondary" fullWidth onClick={pause}>
              Pause
            </Button>
          ) : (
            <Button variant="secondary" fullWidth onClick={resume}>
              Resume
            </Button>
          )}
          <Button fullWidth disabled={saving || elapsed <= 0} onClick={() => void finish()}>
            Finish
          </Button>
        </div>
      </Card>

      <Card className="mb-4">
        <div className="mb-1.5 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            Distance (optional)
          </p>
          <div className="flex gap-1">
            {(['mi', 'km'] as const).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => {
                  if (unit === u) return
                  const current = Number(distance)
                  if (distance.trim() && Number.isFinite(current)) {
                    const meters = displayToMeters(current, unit)
                    setDistance(String(Math.round(metersToDisplay(meters, u) * 100) / 100))
                  }
                  setUnit(u)
                }}
                className={[
                  'rounded-lg px-2 py-1 text-xs font-semibold',
                  unit === u ? 'bg-accent text-white' : 'border border-border bg-bg text-muted',
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
          value={distance}
          onChange={(e) => setDistance(e.target.value)}
          placeholder="0.00"
          className="w-full rounded-2xl border border-border bg-bg px-3 py-3 text-sm font-semibold"
        />
      </Card>

      <Card className="mb-4">
        <div className="mb-1.5 flex justify-between text-sm">
          <span className="font-medium">Effort</span>
          <span className="font-semibold text-accent">{effort}/10</span>
        </div>
        <input
          type="range"
          min={1}
          max={10}
          value={effort}
          onChange={(e) => setEffort(Number(e.target.value))}
          className="w-full accent-[var(--color-accent)]"
        />
        <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-muted">
          Notes
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="mt-1.5 w-full rounded-2xl border border-border bg-bg px-3 py-2.5 text-sm font-normal text-text"
          />
        </label>
      </Card>

      <Button variant="danger" fullWidth onClick={() => setConfirmDiscard(true)}>
        Discard session
      </Button>

      <ConfirmDialog
        open={confirmDiscard}
        title="Discard cardio?"
        message="This session will be marked discarded and won’t appear in Progress."
        confirmLabel="Discard"
        danger
        onCancel={() => setConfirmDiscard(false)}
        onConfirm={() => {
          void discardCardioSession(activeId).then(() => navigate('/train?layer=cardio'))
        }}
      />
    </div>
  )
}
