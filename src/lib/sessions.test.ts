import { describe, expect, it, beforeEach } from 'vitest'
import { db } from '@/db/database'
import { seedAll } from '@/db/seed'
import {
  completeSet,
  finishSession,
  getActiveSession,
  startWorkoutFromTemplate,
} from './sessions'
import { applyWeekSetCount } from './progression'
import { resetProgramKeepHistory } from '@/db/seed'

describe('workout completion & persistence', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
    await seedAll('2026-01-05')
  })

  it('starts a session, saves sets immediately, and finishes', async () => {
    const templates = await db.workoutTemplates.orderBy('dayIndex').toArray()
    const templateId = templates[0]!.id!
    const sessionId = await startWorkoutFromTemplate({ templateId, weekNumber: 1 })

    const active = await getActiveSession()
    expect(active?.id).toBe(sessionId)
    expect(active?.status).toBe('in_progress')

    const es = await db.exerciseSessions.where('workoutSessionId').equals(sessionId).first()
    expect(es).toBeTruthy()
    const sets = await db.loggedSets.where('exerciseSessionId').equals(es!.id!).toArray()
    expect(sets.length).toBeGreaterThan(0)

    const first = sets.find((s) => !s.isWarmup)!
    const result = await completeSet({
      setId: first.id!,
      weight: 100,
      reps: 10,
      rir: 2,
    })
    expect(result.ok).toBe(true)

    const saved = await db.loggedSets.get(first.id!)
    expect(saved?.isComplete).toBe(true)
    expect(saved?.weight).toBe(100)

    await finishSession(sessionId)
    const done = await db.workoutSessions.get(sessionId)
    expect(done?.status).toBe('completed')
    expect(await getActiveSession()).toBeUndefined()
  })

  it('applies deload set reduction on week 4', async () => {
    const templates = await db.workoutTemplates.orderBy('dayIndex').toArray()
    const template = templates[0]!
    const baseSets = template.exercises[0]!.sets
    const sessionId = await startWorkoutFromTemplate({
      templateId: template.id!,
      weekNumber: 4,
    })
    const es = await db.exerciseSessions.where('workoutSessionId').equals(sessionId).first()
    expect(es?.targetSets).toBe(applyWeekSetCount(baseSets, 45))
  })

  it('restarts program while keeping history', async () => {
    const templates = await db.workoutTemplates.orderBy('dayIndex').toArray()
    const sessionId = await startWorkoutFromTemplate({
      templateId: templates[0]!.id!,
      weekNumber: 1,
    })
    await finishSession(sessionId)

    const before = await db.workoutSessions.where('status').equals('completed').count()
    await resetProgramKeepHistory()
    const after = await db.workoutSessions.where('status').equals('completed').count()
    expect(after).toBe(before)

    const active = await db.programs.filter((p) => p.isActive).first()
    expect(active?.currentWeek).toBe(1)
    expect(active?.totalWeeks).toBe(10)
  })
})
