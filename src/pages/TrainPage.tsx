import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Play, BookOpen } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useActiveProgram, useProgramWeeks, useTemplates } from '@/hooks/useProgram'
import { getActiveSession, startWorkoutFromTemplate } from '@/lib/sessions'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ReadinessSheet } from '@/components/workout/ReadinessSheet'
import { applyWeekSetCount } from '@/lib/progression'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'

export function TrainPage() {
  const navigate = useNavigate()
  const templates = useTemplates()
  const program = useActiveProgram()
  const weeks = useProgramWeeks(program?.id)
  const activeSession = useLiveQuery(() => getActiveSession())
  const exercises = useLiveQuery(() => db.exercises.toArray())
  const [pendingId, setPendingId] = useState<number | null>(null)
  const [showReadiness, setShowReadiness] = useState(false)
  const [starting, setStarting] = useState(false)

  const week = weeks?.find((w) => w.weekNumber === (program?.currentWeek ?? 1))

  async function begin(templateId: number, readinessId?: number) {
    if (activeSession) {
      navigate(`/workout/${activeSession.id}`)
      return
    }
    setStarting(true)
    try {
      const id = await startWorkoutFromTemplate({
        templateId,
        weekNumber: program?.currentWeek,
        readinessEntryId: readinessId,
      })
      navigate(`/workout/${id}`)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not start')
    } finally {
      setStarting(false)
      setShowReadiness(false)
      setPendingId(null)
    }
  }

  return (
    <div className="px-4 pt-4 animate-fade-up">
      <header className="mb-5">
        <h1 className="font-display text-3xl font-extrabold">Train</h1>
        <p className="mt-1 text-sm text-muted">
          Week {program?.currentWeek ?? 1}
          {week ? ` · ${week.phaseLabel}` : ''} · RIR {week?.targetRirMin}–{week?.targetRirMax}
        </p>
      </header>

      {activeSession && (
        <Card className="mb-4 border-accent/40">
          <p className="text-xs font-semibold uppercase text-accent">Unfinished</p>
          <p className="font-display text-lg font-bold">{activeSession.title}</p>
          <Button className="mt-3" fullWidth onClick={() => navigate(`/workout/${activeSession.id}`)}>
            Resume Workout
          </Button>
        </Card>
      )}

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
                          {name} · {applyWeekSetCount(te.sets, week?.setReductionPercent ?? 0)}×
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
                  onClick={() => {
                    if (activeSession) {
                      navigate(`/workout/${activeSession.id}`)
                      return
                    }
                    setPendingId(t.id!)
                    setShowReadiness(true)
                  }}
                >
                  <Play size={18} />
                  Start
                </Button>
              </div>
            </Card>
          )
        })}
      </div>

      <ReadinessSheet
        open={showReadiness}
        onClose={() => {
          setShowReadiness(false)
          setPendingId(null)
        }}
        onSkip={() => pendingId && void begin(pendingId)}
        onSave={(id) => pendingId && void begin(pendingId, id)}
      />
    </div>
  )
}
