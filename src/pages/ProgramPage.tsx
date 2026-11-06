import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import {
  useActiveProgram,
  useProgramWeeks,
  useScheduled,
  useTemplates,
} from '@/hooks/useProgram'
import { moveScheduledWorkout, updateTemplateExercise } from '@/lib/sessions'
import { resetProgramKeepHistory } from '@/db/seed'
import { applyWeekSetCount } from '@/lib/progression'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

export function ProgramPage() {
  const program = useActiveProgram()
  const weeks = useProgramWeeks(program?.id)
  const templates = useTemplates()
  const scheduled = useScheduled(program?.id)
  const exercises = useLiveQuery(() => db.exercises.toArray())
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null)
  const [editingTemplateId, setEditingTemplateId] = useState<number | null>(null)
  const [confirmRestart, setConfirmRestart] = useState(false)
  const [movingId, setMovingId] = useState<number | null>(null)
  const [moveDate, setMoveDate] = useState('')

  const week = selectedWeek ?? program?.currentWeek ?? 1
  const weekMeta = weeks?.find((w) => w.weekNumber === week)
  const weekSchedule = scheduled?.filter((s) => s.weekNumber === week) ?? []

  return (
    <div className="px-4 pt-4 animate-fade-up">
      <header className="mb-4">
        <h1 className="font-display text-3xl font-extrabold">Program</h1>
        <p className="mt-1 text-sm text-muted">
          {program?.name ?? 'Hypertrophy Lab'} · 10 weeks · fully editable
        </p>
      </header>

      <Card className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          Current week
        </p>
        <p className="mt-1 font-display text-2xl font-bold">
          Week {program?.currentWeek ?? 1}
          {weekMeta ? ` · ${weeks?.find((w) => w.weekNumber === program?.currentWeek)?.phaseLabel}` : ''}
        </p>
        <p className="mt-2 text-sm text-muted">
          Suggested: Mon Upper A, Tue Lower A, Wed rest, Thu Upper B, Fri Lower B.
          Move workouts freely — program progress is preserved.
        </p>
      </Card>

      <section className="mb-4">
        <h2 className="mb-2 text-sm font-semibold text-muted">Phases</h2>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {weeks?.map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => setSelectedWeek(w.weekNumber)}
              className={[
                'min-w-[72px] rounded-2xl border px-3 py-2.5 text-left',
                week === w.weekNumber
                  ? 'border-accent bg-accent/10'
                  : 'border-border bg-card',
              ].join(' ')}
            >
              <p className="text-[10px] font-semibold uppercase text-muted">W{w.weekNumber}</p>
              <p className="text-xs font-bold leading-tight">{w.phaseLabel}</p>
              <p className="mt-1 text-[10px] text-muted">
                RIR {w.targetRirMin}–{w.targetRirMax}
              </p>
            </button>
          ))}
        </div>
        {weekMeta && (
          <Card className="mt-3">
            <p className="font-semibold">
              Week {weekMeta.weekNumber}: {weekMeta.phaseLabel}
            </p>
            <p className="mt-1 text-sm text-muted">{weekMeta.notes}</p>
            {weekMeta.setReductionPercent > 0 && (
              <p className="mt-2 text-sm text-accent">
                Sets reduced ~{weekMeta.setReductionPercent}% · no auto load increase
              </p>
            )}
          </Card>
        )}
      </section>

      <section className="mb-4">
        <h2 className="mb-2 text-sm font-semibold text-muted">Week {week} schedule</h2>
        <div className="space-y-2">
          {weekSchedule.map((s) => {
            const t = templates?.find((x) => x.id === s.templateId)
            return (
              <Card key={s.id} className="!py-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold">{t?.name}</p>
                    <p className="text-xs text-muted">
                      {format(parseISO(s.plannedDate), 'EEE, MMM d')} · {s.status}
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    className="!py-2 !px-3 text-sm"
                    onClick={() => {
                      setMovingId(s.id!)
                      setMoveDate(s.plannedDate)
                    }}
                  >
                    Move
                  </Button>
                </div>
              </Card>
            )
          })}
          {weekSchedule.length === 0 && (
            <p className="text-sm text-muted">No scheduled sessions for this week.</p>
          )}
        </div>
      </section>

      <section className="mb-4">
        <h2 className="mb-2 text-sm font-semibold text-muted">Day templates</h2>
        <p className="mb-2 text-xs text-muted">
          Editing templates updates future workouts only — past sessions stay intact.
        </p>
        <div className="space-y-2">
          {templates?.map((t) => (
            <Card key={t.id}>
              <button
                type="button"
                className="w-full text-left"
                onClick={() =>
                  setEditingTemplateId(editingTemplateId === t.id ? null : t.id!)
                }
              >
                <p className="font-display text-lg font-bold">{t.name}</p>
                <p className="text-sm text-muted">{t.exercises.length} exercises</p>
              </button>
              {editingTemplateId === t.id && (
                <div className="mt-3 space-y-2 border-t border-border pt-3">
                  {t.exercises.map((te, idx) => {
                    const name =
                      exercises?.find((e) => e.id === te.exerciseId)?.name ?? 'Exercise'
                    return (
                      <div
                        key={`${te.exerciseId}-${idx}`}
                        className="rounded-2xl border border-border bg-bg p-3"
                      >
                        <p className="font-semibold text-sm">{name}</p>
                        <div className="mt-2 grid grid-cols-3 gap-2">
                          <label className="text-[11px] text-muted">
                            Sets
                            <input
                              type="number"
                              className="mt-1 w-full rounded-xl border border-border bg-card px-2 py-2 text-center font-semibold"
                              value={te.sets}
                              onChange={(e) => {
                                const next = [...t.exercises]
                                next[idx] = { ...te, sets: Number(e.target.value) || 1 }
                                void updateTemplateExercise(t.id!, next)
                              }}
                            />
                          </label>
                          <label className="text-[11px] text-muted">
                            Rep min
                            <input
                              type="number"
                              className="mt-1 w-full rounded-xl border border-border bg-card px-2 py-2 text-center font-semibold"
                              value={te.repMin}
                              onChange={(e) => {
                                const next = [...t.exercises]
                                next[idx] = { ...te, repMin: Number(e.target.value) || 1 }
                                void updateTemplateExercise(t.id!, next)
                              }}
                            />
                          </label>
                          <label className="text-[11px] text-muted">
                            Rep max
                            <input
                              type="number"
                              className="mt-1 w-full rounded-xl border border-border bg-card px-2 py-2 text-center font-semibold"
                              value={te.repMax}
                              onChange={(e) => {
                                const next = [...t.exercises]
                                next[idx] = { ...te, repMax: Number(e.target.value) || 1 }
                                void updateTemplateExercise(t.id!, next)
                              }}
                            />
                          </label>
                        </div>
                        <p className="mt-1 text-[11px] text-muted">
                          This week:{' '}
                          {applyWeekSetCount(te.sets, weekMeta?.setReductionPercent ?? 0)} sets
                        </p>
                      </div>
                    )
                  })}
                </div>
              )}
            </Card>
          ))}
        </div>
      </section>

      {program?.currentWeek === 10 && (
        <Card className="mb-4 border-accent/30">
          <p className="font-display text-lg font-bold">Week 10 assessment</p>
          <p className="mt-1 text-sm text-muted">
            Review your 10-week summary in Progress, then restart a fresh block or keep
            history and duplicate the program structure.
          </p>
          <Button className="mt-3" fullWidth onClick={() => setConfirmRestart(true)}>
            Restart / duplicate program
          </Button>
        </Card>
      )}

      <Button variant="secondary" fullWidth onClick={() => setConfirmRestart(true)}>
        Reset program (keep history)
      </Button>

      {movingId != null && (
        <div className="fixed inset-0 z-[90] flex items-end bg-black/60 p-4 safe-bottom">
          <div className="w-full max-w-lg rounded-3xl border border-border bg-card p-5">
            <h3 className="font-display text-lg font-bold">Move workout</h3>
            <input
              type="date"
              value={moveDate}
              onChange={(e) => setMoveDate(e.target.value)}
              className="mt-3 w-full rounded-2xl border border-border bg-bg px-3 py-3"
            />
            <div className="mt-4 flex gap-2">
              <Button variant="secondary" fullWidth onClick={() => setMovingId(null)}>
                Cancel
              </Button>
              <Button
                fullWidth
                onClick={() => {
                  void moveScheduledWorkout(movingId, moveDate).then(() => setMovingId(null))
                }}
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmRestart}
        title="Restart program?"
        message="Starts a new 10-week block with the same templates. Past workout history is kept. Current schedule is replaced."
        confirmLabel="Restart"
        onCancel={() => setConfirmRestart(false)}
        onConfirm={() => {
          void resetProgramKeepHistory().then(() => setConfirmRestart(false))
        }}
      />
    </div>
  )
}
