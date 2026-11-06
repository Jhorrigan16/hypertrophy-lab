import { db } from '@/db/database'
import type {
  ExerciseSession,
  LoggedSet,
  PersonalRecord,
  ProgramWeek,
  WorkoutSession,
  WorkoutTemplate,
} from '@/db/types'
import { applyWeekSetCount, preventDuplicateSetSubmission, suggestNextWeight } from './progression'
import { bestE1rmEstimate } from './e1rm'
import { workingSetVolume } from './volume'
import { defaultRestForExercise } from './restTimer'

export async function getActiveSession(): Promise<WorkoutSession | undefined> {
  return db.workoutSessions
    .where('status')
    .anyOf(['in_progress', 'paused'])
    .first()
}

export async function getSettings() {
  const settings = await db.userSettings.toCollection().first()
  if (!settings) throw new Error('Settings not initialized')
  return settings
}

export async function getActiveProgram() {
  return db.programs.filter((p) => p.isActive).first()
}

export async function getProgramWeek(
  programId: number,
  weekNumber: number,
): Promise<ProgramWeek | undefined> {
  return db.programWeeks
    .where({ programId, weekNumber })
    .first()
}

export async function startWorkoutFromTemplate(opts: {
  templateId: number
  weekNumber?: number
  scheduledWorkoutId?: number
  readinessEntryId?: number
}): Promise<number> {
  const existing = await getActiveSession()
  if (existing) {
    throw new Error('An unfinished workout already exists. Resume or discard it first.')
  }

  const template = await db.workoutTemplates.get(opts.templateId)
  if (!template) throw new Error('Template not found')

  const settings = await getSettings()
  const program = await getActiveProgram()
  const weekNumber = opts.weekNumber ?? program?.currentWeek ?? 1
  const week =
    program?.id != null
      ? await getProgramWeek(program.id, weekNumber)
      : undefined

  const now = new Date().toISOString()
  const sessionIdRaw = await db.workoutSessions.add({
    programId: program?.id,
    templateId: template.id,
    scheduledWorkoutId: opts.scheduledWorkoutId,
    title: template.name,
    weekNumber,
    dayLabel: template.dayLabel,
    status: 'in_progress',
    startedAt: now,
    totalPausedMs: 0,
    readinessEntryId: opts.readinessEntryId,
  })
  if (sessionIdRaw == null) throw new Error('Failed to create workout session')
  const sessionId = sessionIdRaw

  const substitutions = settings.substitutions

  for (const te of template.exercises) {
    const exerciseId = substitutions[te.exerciseId] ?? te.exerciseId
    const exercise = await db.exercises.get(exerciseId)
    if (!exercise) continue

    const targetSets = applyWeekSetCount(
      te.sets,
      week?.setReductionPercent ?? 0,
    )

    const previous = await getPreviousWorkingSets(exerciseId)
    const suggestion = suggestNextWeight({
      previousWorkingSets: previous,
      repMin: te.repMin,
      repMax: te.repMax,
      primaryMuscle: exercise.primaryMuscle,
      equipment: exercise.equipment,
      increments: settings.equipmentIncrements,
      prefs: settings.progressionPrefs,
      week: week ?? {
        allowAutoLoadIncrease: true,
        phase: 'accumulation',
        targetRirMin: 2,
        targetRirMax: 2,
      },
      targetRirMax: week?.targetRirMax,
    })

    const restSeconds =
      te.restSeconds ??
      exercise.defaultRestSeconds ??
      defaultRestForExercise(exercise.isCompound, settings.restDefaults)

    const exerciseSessionIdRaw = await db.exerciseSessions.add({
      workoutSessionId: sessionId,
      exerciseId,
      order: te.order,
      targetSets,
      targetRepMin: te.repMin,
      targetRepMax: te.repMax,
      targetRir: week ? (week.targetRirMin + week.targetRirMax) / 2 : te.targetRir,
      suggestedWeight: suggestion.suggestedWeight ?? undefined,
      restSeconds,
      isUnilateral: te.isUnilateral ?? exercise.isUnilateral,
      notes: te.notes,
    })
    if (exerciseSessionIdRaw == null) throw new Error('Failed to create exercise session')
    const exerciseSessionId = exerciseSessionIdRaw

    // Pre-create empty working set slots (not complete)
    for (let i = 1; i <= targetSets; i++) {
      await db.loggedSets.add({
        exerciseSessionId,
        setNumber: i,
        weight: suggestion.suggestedWeight ?? 0,
        reps: 0,
        rir: null,
        isWarmup: false,
        isComplete: false,
        isUnilateralSide: null,
        createdAt: now,
      })
    }
  }

  return sessionId
}

export async function getPreviousWorkingSets(exerciseId: number) {
  const sessions = await db.exerciseSessions.where('exerciseId').equals(exerciseId).toArray()
  if (sessions.length === 0) return []

  // Find most recent completed workout's exercise session
  const sessionIds = sessions.map((s) => s.workoutSessionId)
  const workouts = await db.workoutSessions.bulkGet(sessionIds)
  const completed = sessions
    .map((es, i) => ({ es, ws: workouts[i] }))
    .filter((x) => x.ws?.status === 'completed' && x.ws.completedAt)
    .sort((a, b) => (b.ws!.completedAt! > a.ws!.completedAt! ? 1 : -1))

  if (completed.length === 0) return []

  const latest = completed[0]!.es
  const sets = await db.loggedSets.where('exerciseSessionId').equals(latest.id!).toArray()
  return sets.map((s) => ({
    weight: s.weight,
    reps: s.reps,
    rir: s.rir,
    isWarmup: s.isWarmup,
    isComplete: s.isComplete,
  }))
}

export async function getPreviousPerformanceSummary(exerciseId: number) {
  const sets = await getPreviousWorkingSets(exerciseId)
  const working = sets.filter((s) => s.isComplete && !s.isWarmup)
  if (working.length === 0) return null
  return {
    sets: working,
    bestSet: working.reduce((best, s) =>
      s.weight * s.reps > best.weight * best.reps ? s : best,
    ),
  }
}

export async function completeSet(opts: {
  setId: number
  weight: number // storage lb
  reps: number
  rir: number | null
  notes?: string
  isUnilateralSide?: 'left' | 'right' | null
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const set = await db.loggedSets.get(opts.setId)
  if (!set) return { ok: false, reason: 'Set not found' }

  const siblings = await db.loggedSets.where('exerciseSessionId').equals(set.exerciseSessionId).toArray()
  if (
    preventDuplicateSetSubmission(siblings, {
      setNumber: set.setNumber,
      isWarmup: set.isWarmup,
      isUnilateralSide: opts.isUnilateralSide ?? set.isUnilateralSide,
    }) &&
    set.isComplete
  ) {
    // Allow updating an already-complete set in place (edit), but block double-create of same slot via addWarmup path
  }

  const now = new Date().toISOString()
  await db.loggedSets.update(opts.setId, {
    weight: opts.weight,
    reps: opts.reps,
    rir: opts.rir,
    notes: opts.notes,
    isUnilateralSide: opts.isUnilateralSide ?? set.isUnilateralSide,
    isComplete: true,
    completedAt: now,
  })

  return { ok: true }
}

export async function addWarmupSet(exerciseSessionId: number, weight = 0): Promise<number> {
  const sets = await db.loggedSets.where('exerciseSessionId').equals(exerciseSessionId).toArray()
  const warmups = sets.filter((s) => s.isWarmup)
  const setNumber = warmups.length + 1
  const now = new Date().toISOString()
  const id = await db.loggedSets.add({
    exerciseSessionId,
    setNumber,
    weight,
    reps: 0,
    rir: null,
    isWarmup: true,
    isComplete: false,
    createdAt: now,
  })
  if (id == null) throw new Error('Failed to add warm-up set')
  return id
}

export async function addWorkingSet(exerciseSessionId: number): Promise<number> {
  const sets = await db.loggedSets.where('exerciseSessionId').equals(exerciseSessionId).toArray()
  const working = sets.filter((s) => !s.isWarmup)
  const last = working.sort((a, b) => b.setNumber - a.setNumber)[0]
  const now = new Date().toISOString()
  const id = await db.loggedSets.add({
    exerciseSessionId,
    setNumber: (last?.setNumber ?? 0) + 1,
    weight: last?.weight ?? 0,
    reps: 0,
    rir: null,
    isWarmup: false,
    isComplete: false,
    createdAt: now,
  })
  if (id == null) throw new Error('Failed to add working set')
  return id
}

export async function pauseSession(sessionId: number): Promise<void> {
  await db.workoutSessions.update(sessionId, {
    status: 'paused',
    pausedAt: new Date().toISOString(),
  })
}

export async function resumeSession(sessionId: number): Promise<void> {
  const session = await db.workoutSessions.get(sessionId)
  if (!session) return
  let totalPausedMs = session.totalPausedMs
  if (session.pausedAt) {
    totalPausedMs += Date.now() - new Date(session.pausedAt).getTime()
  }
  await db.workoutSessions.update(sessionId, {
    status: 'in_progress',
    resumedAt: new Date().toISOString(),
    pausedAt: undefined,
    totalPausedMs,
  })
}

export async function discardSession(sessionId: number): Promise<void> {
  await db.transaction(
    'rw',
    [db.workoutSessions, db.exerciseSessions, db.loggedSets],
    async () => {
      const exercises = await db.exerciseSessions.where('workoutSessionId').equals(sessionId).toArray()
      for (const es of exercises) {
        await db.loggedSets.where('exerciseSessionId').equals(es.id!).delete()
      }
      await db.exerciseSessions.where('workoutSessionId').equals(sessionId).delete()
      await db.workoutSessions.update(sessionId, { status: 'discarded' })
    },
  )
}

export async function finishSession(sessionId: number): Promise<void> {
  const now = new Date().toISOString()
  await db.transaction(
    'rw',
    [
      db.workoutSessions,
      db.exerciseSessions,
      db.loggedSets,
      db.personalRecords,
      db.scheduledWorkouts,
      db.programs,
      db.exercises,
    ],
    async () => {
      const session = await db.workoutSessions.get(sessionId)
      if (!session) return

      await db.workoutSessions.update(sessionId, {
        status: 'completed',
        completedAt: now,
      })

      if (session.scheduledWorkoutId) {
        await db.scheduledWorkouts.update(session.scheduledWorkoutId, {
          status: 'completed',
          completedSessionId: sessionId,
        })
      }

      // Detect PRs from this session
      const exerciseSessions = await db.exerciseSessions
        .where('workoutSessionId')
        .equals(sessionId)
        .toArray()

      for (const es of exerciseSessions) {
        const sets = await db.loggedSets.where('exerciseSessionId').equals(es.id!).toArray()
        const working = sets.filter((s) => s.isComplete && !s.isWarmup)
        if (working.length === 0) continue

        const bestWeight = Math.max(...working.map((s) => s.weight))
        const bestRepsAtWeight = working
          .filter((s) => s.weight === bestWeight)
          .reduce((m, s) => Math.max(m, s.reps), 0)
        const volume = workingSetVolume(working)
        const e1rm = bestE1rmEstimate(working)

        await maybeAddPr({
          exerciseId: es.exerciseId,
          type: 'weight',
          value: bestWeight,
          weight: bestWeight,
          reps: bestRepsAtWeight,
          sessionId,
          achievedAt: now,
        })

        await maybeAddPr({
          exerciseId: es.exerciseId,
          type: 'volume',
          value: volume,
          weight: bestWeight,
          reps: bestRepsAtWeight,
          sessionId,
          achievedAt: now,
        })

        if (e1rm != null) {
          await maybeAddPr({
            exerciseId: es.exerciseId,
            type: 'e1rm',
            value: e1rm,
            weight: bestWeight,
            reps: bestRepsAtWeight,
            sessionId,
            achievedAt: now,
          })
        }

        await db.exerciseSessions.update(es.id!, { completedAt: now })
      }

      // Advance current week if all scheduled workouts for week are done
      if (session.programId && session.weekNumber) {
        await maybeAdvanceWeek(session.programId, session.weekNumber)
      }
    },
  )
}

async function maybeAddPr(pr: Omit<PersonalRecord, 'id'>): Promise<void> {
  const existing = await db.personalRecords
    .where({ exerciseId: pr.exerciseId, type: pr.type })
    .toArray()
  const best = existing.reduce((m, r) => Math.max(m, r.value), 0)
  if (pr.value > best) {
    await db.personalRecords.add(pr)
  }
}

async function maybeAdvanceWeek(programId: number, weekNumber: number): Promise<void> {
  const scheduled = await db.scheduledWorkouts
    .where({ programId, weekNumber })
    .toArray()
  if (scheduled.length === 0) return
  const allDone = scheduled.every((s) => s.status === 'completed' || s.status === 'skipped')
  if (!allDone) return

  const program = await db.programs.get(programId)
  if (!program) return
  if (weekNumber >= program.currentWeek && weekNumber < program.totalWeeks) {
    await db.programs.update(programId, {
      currentWeek: weekNumber + 1,
      updatedAt: new Date().toISOString(),
    })
  }
}

export async function moveScheduledWorkout(
  scheduledId: number,
  newDate: string,
): Promise<void> {
  const row = await db.scheduledWorkouts.get(scheduledId)
  if (!row) return
  await db.scheduledWorkouts.update(scheduledId, {
    plannedDate: newDate,
    status: 'moved',
    movedFromDate: row.movedFromDate ?? row.plannedDate,
  })
}

export async function loadSessionBundle(sessionId: number) {
  const session = await db.workoutSessions.get(sessionId)
  if (!session) return null
  const exerciseSessions = await db.exerciseSessions
    .where('workoutSessionId')
    .equals(sessionId)
    .sortBy('order')
  const bundles = []
  for (const es of exerciseSessions) {
    const exercise = await db.exercises.get(es.exerciseId)
    const sets = await db.loggedSets.where('exerciseSessionId').equals(es.id!).toArray()
    sets.sort((a, b) => {
      if (a.isWarmup !== b.isWarmup) return a.isWarmup ? -1 : 1
      return a.setNumber - b.setNumber
    })
    const previous = await getPreviousPerformanceSummary(es.exerciseId)
    bundles.push({ exerciseSession: es, exercise, sets, previous })
  }
  return { session, bundles }
}

export type SessionBundle = NonNullable<Awaited<ReturnType<typeof loadSessionBundle>>>

export async function updateTemplateExercise(
  templateId: number,
  exercises: WorkoutTemplate['exercises'],
): Promise<void> {
  // Editing templates must not mutate historical sessions
  await db.workoutTemplates.update(templateId, {
    exercises,
    updatedAt: new Date().toISOString(),
  })
}

/**
 * Swap the exercise for an in-progress slot.
 * Keeps completed sets; refreshes suggestion / defaults for the new movement.
 * Does not mutate program templates or other sessions.
 */
export async function switchExerciseInSession(
  exerciseSessionId: number,
  newExerciseId: number,
): Promise<void> {
  const es = await db.exerciseSessions.get(exerciseSessionId)
  if (!es) throw new Error('Exercise session not found')
  if (es.exerciseId === newExerciseId) return

  const exercise = await db.exercises.get(newExerciseId)
  if (!exercise) throw new Error('Exercise not found')

  const settings = await getSettings()
  const session = await db.workoutSessions.get(es.workoutSessionId)
  const week =
    session?.programId != null && session.weekNumber != null
      ? await getProgramWeek(session.programId, session.weekNumber)
      : undefined

  const previous = await getPreviousWorkingSets(newExerciseId)
  const suggestion = suggestNextWeight({
    previousWorkingSets: previous,
    repMin: es.targetRepMin,
    repMax: es.targetRepMax,
    primaryMuscle: exercise.primaryMuscle,
    equipment: exercise.equipment,
    increments: settings.equipmentIncrements,
    prefs: settings.progressionPrefs,
    week: week ?? {
      allowAutoLoadIncrease: true,
      phase: 'accumulation',
      targetRirMin: 2,
      targetRirMax: 2,
    },
    targetRirMax: week?.targetRirMax,
  })

  const restSeconds =
    exercise.defaultRestSeconds ??
    defaultRestForExercise(exercise.isCompound, settings.restDefaults)

  await db.exerciseSessions.update(exerciseSessionId, {
    exerciseId: newExerciseId,
    suggestedWeight: suggestion.suggestedWeight ?? undefined,
    restSeconds,
    isUnilateral: exercise.isUnilateral,
  })

  // Update incomplete working/warmup slots to the new suggested load; leave completed sets alone
  const sets = await db.loggedSets.where('exerciseSessionId').equals(exerciseSessionId).toArray()
  const nextWeight = suggestion.suggestedWeight ?? 0
  await Promise.all(
    sets
      .filter((s) => !s.isComplete)
      .map((s) => db.loggedSets.update(s.id!, { weight: nextWeight })),
  )
}

export function sessionElapsedMs(session: WorkoutSession, now = Date.now()): number {
  const start = new Date(session.startedAt).getTime()
  let paused = session.totalPausedMs
  if (session.status === 'paused' && session.pausedAt) {
    paused += now - new Date(session.pausedAt).getTime()
  }
  const end = session.completedAt ? new Date(session.completedAt).getTime() : now
  return Math.max(0, end - start - paused)
}

export type { ExerciseSession, LoggedSet, WorkoutSession }
