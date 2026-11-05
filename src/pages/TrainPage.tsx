import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Play, BookOpen, ClipboardList, Pencil, Plus } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useActiveProgram, useProgramWeeks, useTemplates } from '@/hooks/useProgram'
import { getActiveSession, startWorkoutFromTemplate } from '@/lib/sessions'
import {
  getActiveCardioSession,
  listActiveCardioTypes,
  startCardioSession,
} from '@/lib/cardio'
import { CARDIO_MODALITY_LABELS } from '@/data/cardio'
import { applyWeekSetCount } from '@/lib/progression'
import { db } from '@/db/database'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { QuickLogCardioSheet } from '@/components/cardio/QuickLogCardioSheet'
import { EditCardioActivitySheet } from '@/components/cardio/EditCardioActivitySheet'
import type { CardioActivityType } from '@/db/types'

type Layer = 'lift' | 'cardio'

export function TrainPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const layer: Layer = params.get('layer') === 'cardio' ? 'cardio' : 'lift'

  const templates = useTemplates()
  const program = useActiveProgram()
  const weeks = useProgramWeeks(program?.id)
  const activeSession = useLiveQuery(() => getActiveSession())
  const activeCardio = useLiveQuery(() => getActiveCardioSession())
  const exercises = useLiveQuery(() => db.exercises.toArray())
  const cardioTypes = useLiveQuery(() => listActiveCardioTypes())
  const [starting, setStarting] = useState(false)
  const [logTarget, setLogTarget] = useState<CardioActivityType | null>(null)
  const [editTarget, setEditTarget] = useState<CardioActivityType | null | undefined>(
    undefined,
  )

  const week = weeks?.find((w) => w.weekNumber === (program?.currentWeek ?? 1))

  const sortedCardio = useMemo(
    () =>
      (cardioTypes ?? []).slice().sort((a, b) => {
        const order = ['run', 'bike', 'row', 'other']
        const d = order.indexOf(a.modality) - order.indexOf(b.modality)
        return d !== 0 ? d : a.name.localeCompare(b.name)
      }),
    [cardioTypes],
  )

  function setLayer(next: Layer) {
    const nextParams = new URLSearchParams(params)
    if (next === 'lift') nextParams.delete('layer')
    else nextParams.set('layer', 'cardio')
    setParams(nextParams, { replace: true })
  }

  async function beginLift(templateId: number) {
    if (activeSession) {
      navigate(`/workout/${activeSession.id}`)
      return
    }
    setStarting(true)
    try {
      const id = await startWorkoutFromTemplate({
        templateId,
        weekNumber: program?.currentWeek,
      })
      navigate(`/workout/${id}`)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not start')
    } finally {
      setStarting(false)
    }
  }

  async function beginCardio(activityTypeId: number) {
    if (activeCardio) {
      navigate(`/cardio/${activeCardio.id}`)
      return
    }
    setStarting(true)
    try {
      const id = await startCardioSession(activityTypeId)
      navigate(`/cardio/${id}`)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not start cardio')
    } finally {
      setStarting(false)
    }
  }

  return (
    <div className="px-4 pt-4 animate-fade-up">
      <header className="mb-4">
        <h1 className="font-display text-3xl font-extrabold">Train</h1>
        <p className="mt-1 text-sm text-muted">
          {layer === 'lift'
            ? `Week ${program?.currentWeek ?? 1}${week ? ` · ${week.phaseLabel}` : ''} · RIR ${week?.targetRirMin}–${week?.targetRirMax}`
            : 'Running & cardio · local only'}
        </p>
      </header>

      <div className="mb-4 grid grid-cols-2 gap-2 rounded-2xl border border-border bg-card p-1">
        {([
          { id: 'lift' as const, label: 'Lift' },
          { id: 'cardio' as const, label: 'Cardio' },
        ]).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setLayer(tab.id)}
            className={[
              'rounded-xl py-2.5 text-sm font-semibold transition',
              layer === tab.id ? 'bg-accent text-white' : 'text-muted',
            ].join(' ')}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {layer === 'lift' && activeSession && (
        <Card className="mb-4 border-accent/40">
          <p className="text-xs font-semibold uppercase text-accent">Unfinished lift</p>
          <p className="font-display text-lg font-bold">{activeSession.title}</p>
          <Button className="mt-3" fullWidth onClick={() => navigate(`/workout/${activeSession.id}`)}>
            Resume Workout
          </Button>
        </Card>
      )}

      {layer === 'cardio' && activeCardio && (
        <Card className="mb-4 border-accent/40">
          <p className="text-xs font-semibold uppercase text-accent">Unfinished cardio</p>
          <p className="font-display text-lg font-bold">{activeCardio.title}</p>
          <Button className="mt-3" fullWidth onClick={() => navigate(`/cardio/${activeCardio.id}`)}>
            Resume Session
          </Button>
        </Card>
      )}

      {layer === 'lift' && (
        <>
          <Link
            to="/exercises"
            className="mb-4 flex items-center gap-3 rounded-3xl border border-border bg-card px-4 py-3.5"
          >
            <BookOpen className="text-accent" size={20} />
            <div className="flex-1">
              <p className="font-semibold">Exercise library</p>
              <p className="text-xs text-muted">Search, cues, alternatives, custom</p>
            </div>
          </Link>

          <div className="space-y-3">
            {templates?.map((t) => {
              const setCount = t.exercises.reduce(
                (sum, e) => sum + applyWeekSetCount(e.sets, week?.setReductionPercent ?? 0),
                0,
              )
              return (
                <Card key={t.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                        Day {t.dayIndex}
                      </p>
                      <p className="font-display text-xl font-bold">{t.name}</p>
                      <p className="mt-1 text-sm text-muted">
                        {t.exercises.length} exercises · {setCount} working sets
                      </p>
                      <ul className="mt-2 space-y-0.5">
                        {t.exercises.slice(0, 4).map((te) => {
                          const name =
                            exercises?.find((e) => e.id === te.exerciseId)?.name ?? 'Exercise'
                          return (
                            <li key={te.order} className="truncate text-xs text-muted">
                              {name} ·{' '}
                              {applyWeekSetCount(te.sets, week?.setReductionPercent ?? 0)}×
                              {te.repMin}–{te.repMax}
                            </li>
                          )
                        })}
                        {t.exercises.length > 4 && (
                          <li className="text-xs text-muted">+{t.exercises.length - 4} more</li>
                        )}
                      </ul>
                    </div>
                    <Button
                      disabled={starting}
                      className="!px-4 shrink-0"
                      onClick={() => void beginLift(t.id!)}
                    >
                      <Play size={18} />
                      Start
                    </Button>
                  </div>
                </Card>
              )
            })}
          </div>
        </>
      )}

      {layer === 'cardio' && (
        <>
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-sm text-muted">
              Start a live timer or log a finished session. Activities are editable.
            </p>
            <Button
              variant="secondary"
              className="!px-3 !py-2 shrink-0"
              onClick={() => setEditTarget(null)}
            >
              <Plus size={16} />
              Add
            </Button>
          </div>

          <div className="space-y-3">
            {sortedCardio.map((activity) => (
              <Card key={activity.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                      {CARDIO_MODALITY_LABELS[activity.modality]}
                    </p>
                    <p className="font-display text-xl font-bold">{activity.name}</p>
                    <p className="mt-1 text-sm text-muted">
                      Default effort {activity.defaultEffort}/10
                      {activity.notes ? ` · ${activity.notes}` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="rounded-xl border border-border p-2 text-muted"
                    aria-label={`Edit ${activity.name}`}
                    onClick={() => setEditTarget(activity)}
                  >
                    <Pencil size={16} />
                  </button>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button
                    variant="secondary"
                    disabled={starting}
                    onClick={() => setLogTarget(activity)}
                  >
                    <ClipboardList size={16} />
                    Log
                  </Button>
                  <Button disabled={starting} onClick={() => void beginCardio(activity.id!)}>
                    <Play size={16} />
                    Start
                  </Button>
                </div>
              </Card>
            ))}
            {sortedCardio.length === 0 && (
              <Card>
                <p className="font-display text-lg font-bold">No cardio activities</p>
                <p className="mt-1 text-sm text-muted">Add Easy Run, Bike, or your own types.</p>
                <Button className="mt-3" fullWidth onClick={() => setEditTarget(null)}>
                  <Plus size={16} />
                  Add activity
                </Button>
              </Card>
            )}
          </div>
        </>
      )}

      <QuickLogCardioSheet
        open={logTarget != null}
        activity={logTarget}
        onClose={() => setLogTarget(null)}
        onSaved={() => navigate('/')}
      />

      <EditCardioActivitySheet
        open={editTarget !== undefined}
        activity={editTarget ?? null}
        onClose={() => setEditTarget(undefined)}
        onSaved={() => {
          /* live query refreshes */
        }}
      />
    </div>
  )
}
