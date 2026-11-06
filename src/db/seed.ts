import { addWeeks, format, parseISO, startOfWeek, addDays } from 'date-fns'
import { ALL_SEED_EXERCISES, withTimestamps } from '@/data/exercises'
import {
  PROGRAM_DAYS,
  WEEK_PHASES,
  SUGGESTED_DAY_MAP,
  toTemplateExercises,
} from '@/data/program'
import { db } from './database'
import {
  DEFAULT_EQUIPMENT_INCREMENTS,
  DEFAULT_PREFERRED_DAYS,
  DEFAULT_PROGRESSION_PREFS,
  DEFAULT_REST_DEFAULTS,
  type UserSettings,
} from './types'
import { ensureCardioSeeded } from '@/lib/cardio'

export async function isSeeded(): Promise<boolean> {
  const meta = await db.appMeta.where('key').equals('seeded').first()
  return meta?.value === 'true'
}

export async function ensureSeeded(): Promise<void> {
  const seeded = await isSeeded()
  if (seeded) {
    const settingsCount = await db.userSettings.count()
    if (settingsCount === 0) {
      await seedSettings(format(new Date(), 'yyyy-MM-dd'))
    }
    await ensureExerciseLibraryExpanded()
    await ensureCardioSeeded()
    await db.appMeta.put({ key: 'schemaVersion', value: '3' })
    return
  }
  await seedAll()
}

/** Additive: insert any default library exercises missing by name. Never deletes. */
export async function ensureExerciseLibraryExpanded(): Promise<number> {
  const existing = await db.exercises.toArray()
  const names = new Set(existing.map((e) => e.name.toLowerCase()))
  const missing = ALL_SEED_EXERCISES.filter((e) => !names.has(e.name.toLowerCase()))
  if (missing.length === 0) {
    await db.appMeta.put({ key: 'exerciseLibraryVersion', value: '3' })
    return 0
  }
  await db.exercises.bulkAdd(missing.map(withTimestamps))
  await db.appMeta.put({ key: 'exerciseLibraryVersion', value: '3' })
  return missing.length
}

export async function seedAll(startDate = format(new Date(), 'yyyy-MM-dd')): Promise<void> {
  await db.transaction(
    'rw',
    [
      db.exercises,
      db.workoutTemplates,
      db.programs,
      db.programWeeks,
      db.scheduledWorkouts,
      db.userSettings,
      db.appMeta,
      db.cardioActivityTypes,
      db.cardioSessions,
    ],
    async () => {
      await seedExercises()
      await ensureExerciseLibraryExpanded()
      const templateIds = await seedTemplates()
      const programId = await seedProgram(templateIds, startDate)
      await seedProgramWeeks(programId)
      await seedSchedule(programId, templateIds, startDate)
      await seedSettings(startDate)
      await ensureCardioSeeded()
      await db.appMeta.put({ key: 'seeded', value: 'true' })
      await db.appMeta.put({ key: 'schemaVersion', value: '3' })
      await db.appMeta.put({ key: 'exerciseLibraryVersion', value: '3' })
    },
  )
}

async function seedExercises(): Promise<Map<string, number>> {
  const existing = await db.exercises.count()
  if (existing === 0) {
    await db.exercises.bulkAdd(ALL_SEED_EXERCISES.map(withTimestamps))
  }
  const all = await db.exercises.toArray()
  return new Map(all.map((e) => [e.name, e.id!]))
}

async function seedTemplates(): Promise<number[]> {
  const exerciseIdByName = await seedExercises()
  const existing = await db.workoutTemplates.count()
  if (existing > 0) {
    const templates = await db.workoutTemplates.orderBy('dayIndex').toArray()
    return templates.map((t) => t.id!)
  }

  const ts = new Date().toISOString()
  const ids: number[] = []
  for (const day of PROGRAM_DAYS) {
    const id = await db.workoutTemplates.add({
      name: day.name,
      dayLabel: day.dayLabel,
      dayIndex: day.dayIndex,
      exercises: toTemplateExercises(day, exerciseIdByName),
      createdAt: ts,
      updatedAt: ts,
    })
    if (id == null) throw new Error('Failed to seed template')
    ids.push(id)
  }
  return ids
}

async function seedProgram(templateIds: number[], startDate: string): Promise<number> {
  const active = await db.programs.filter((p) => p.isActive).first()
  if (active?.id) return active.id

  const ts = new Date().toISOString()
  const id = await db.programs.add({
    name: 'Hypertrophy Lab 10-Week',
    description:
      'Four-day upper/lower hypertrophy split with accumulation, deload, progressive overload, high-effort, and assessment phases. Fully editable. Not affiliated with any coach brand.',
    totalWeeks: 10,
    templateIds,
    startDate,
    currentWeek: 1,
    isActive: true,
    createdAt: ts,
    updatedAt: ts,
  })
  if (id == null) throw new Error('Failed to seed program')
  return id
}

async function seedProgramWeeks(programId: number): Promise<void> {
  const existing = await db.programWeeks.where('programId').equals(programId).count()
  if (existing > 0) return

  await db.programWeeks.bulkAdd(
    WEEK_PHASES.map((w) => ({
      programId,
      weekNumber: w.weekNumber,
      phase: w.phase,
      phaseLabel: w.phaseLabel,
      targetRirMin: w.targetRirMin,
      targetRirMax: w.targetRirMax,
      setReductionPercent: w.setReductionPercent,
      allowAutoLoadIncrease: w.allowAutoLoadIncrease,
      allowOptionalFailureOnIsolation: w.allowOptionalFailureOnIsolation,
      notes: w.notes,
    })),
  )
}

export async function seedSchedule(
  programId: number,
  templateIds: number[],
  startDate: string,
): Promise<void> {
  const existing = await db.scheduledWorkouts.where('programId').equals(programId).count()
  if (existing > 0) return

  const start = parseISO(startDate)
  const weekStart = startOfWeek(start, { weekStartsOn: 1 }) // Monday
  const templates = await db.workoutTemplates.bulkGet(templateIds)
  const byDayIndex = new Map(
    templates.filter(Boolean).map((t) => [t!.dayIndex, t!.id!]),
  )

  const rows = []
  for (let week = 1; week <= 10; week++) {
    for (let dow = 1; dow <= 7; dow++) {
      const dayOfWeek = dow === 7 ? 0 : dow // convert Mon=1..Sun=0
      const dayIndex = SUGGESTED_DAY_MAP[dayOfWeek]
      if (dayIndex == null) continue
      const templateId = byDayIndex.get(dayIndex)
      if (!templateId) continue
      const date = addDays(addWeeks(weekStart, week - 1), dow - 1)
      rows.push({
        programId,
        weekNumber: week,
        templateId,
        plannedDate: format(date, 'yyyy-MM-dd'),
        status: 'planned' as const,
      })
    }
  }
  await db.scheduledWorkouts.bulkAdd(rows)
}

async function seedSettings(startDate: string): Promise<void> {
  const count = await db.userSettings.count()
  if (count > 0) return

  const settings: UserSettings = {
    weightUnit: 'lb',
    theme: 'dark',
    programStartDate: startDate,
    preferredTrainingDays: DEFAULT_PREFERRED_DAYS,
    equipmentIncrements: DEFAULT_EQUIPMENT_INCREMENTS,
    progressionPrefs: DEFAULT_PROGRESSION_PREFS,
    restDefaults: DEFAULT_REST_DEFAULTS,
    restTimerSound: true,
    restTimerVibration: true,
    substitutions: {},
    onboardingComplete: true,
    updatedAt: new Date().toISOString(),
  }
  await db.userSettings.add(settings)
}

export async function resetProgramKeepHistory(): Promise<void> {
  const active = await db.programs.filter((p) => p.isActive).first()
  if (!active?.id) return

  await db.transaction(
    'rw',
    [db.programs, db.programWeeks, db.scheduledWorkouts, db.workoutTemplates, db.userSettings],
    async () => {
      await db.programs.update(active.id!, { isActive: false, updatedAt: new Date().toISOString() })
      const templates = await db.workoutTemplates.orderBy('dayIndex').toArray()
      const templateIds = templates.map((t) => t.id!)
      const startDate = format(new Date(), 'yyyy-MM-dd')
      const programId = await seedProgram(templateIds, startDate)
      // Clear and reseed weeks/schedule for new program
      await db.programWeeks.where('programId').equals(programId).delete()
      await seedProgramWeeks(programId)
      await db.scheduledWorkouts.where('programId').equals(programId).delete()
      await seedSchedule(programId, templateIds, startDate)
      const settings = await db.userSettings.toCollection().first()
      if (settings?.id) {
        await db.userSettings.update(settings.id, {
          programStartDate: startDate,
          updatedAt: new Date().toISOString(),
        })
      }
    },
  )
}

export async function deleteAllData(): Promise<void> {
  await db.delete()
  // Recreate DB instance tables by opening again
  await db.open()
  await seedAll()
}
