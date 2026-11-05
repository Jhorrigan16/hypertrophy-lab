import { db } from '@/db/database'
import type {
  Exercise,
  WorkoutTemplate,
  Program,
  ProgramWeek,
  ScheduledWorkout,
  WorkoutSession,
  ExerciseSession,
  LoggedSet,
  PersonalRecord,
  ReadinessEntry,
  UserSettings,
  AppMeta,
} from '@/db/types'

export const BACKUP_VERSION = 1

export interface BackupPayload {
  version: number
  exportedAt: string
  app: string
  exercises: Exercise[]
  workoutTemplates: WorkoutTemplate[]
  programs: Program[]
  programWeeks: ProgramWeek[]
  scheduledWorkouts: ScheduledWorkout[]
  workoutSessions: WorkoutSession[]
  exerciseSessions: ExerciseSession[]
  loggedSets: LoggedSet[]
  personalRecords: PersonalRecord[]
  readinessEntries: ReadinessEntry[]
  userSettings: UserSettings[]
  appMeta: AppMeta[]
}

export interface ValidationResult {
  ok: boolean
  errors: string[]
  warnings: string[]
}

export function validateBackup(data: unknown): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (data == null || typeof data !== 'object') {
    return { ok: false, errors: ['Backup must be a JSON object.'], warnings }
  }

  const obj = data as Record<string, unknown>

  if (obj.app !== 'Hypertrophy Lab' && obj.app !== 'hypertrophy-lab') {
    warnings.push('Unrecognized app field — proceeding if structure looks valid.')
  }

  if (typeof obj.version !== 'number') {
    errors.push('Missing or invalid version.')
  } else if (obj.version > BACKUP_VERSION) {
    errors.push(`Backup version ${obj.version} is newer than supported (${BACKUP_VERSION}).`)
  }

  const requiredArrays = [
    'exercises',
    'workoutTemplates',
    'programs',
    'programWeeks',
    'scheduledWorkouts',
    'workoutSessions',
    'exerciseSessions',
    'loggedSets',
    'personalRecords',
    'readinessEntries',
    'userSettings',
  ] as const

  for (const key of requiredArrays) {
    if (!Array.isArray(obj[key])) {
      errors.push(`Missing array: ${key}`)
    }
  }

  if (Array.isArray(obj.userSettings) && obj.userSettings.length > 0) {
    const s = obj.userSettings[0] as Record<string, unknown>
    if (s.weightUnit !== 'lb' && s.weightUnit !== 'kg') {
      errors.push('userSettings.weightUnit must be "lb" or "kg".')
    }
  }

  if (Array.isArray(obj.loggedSets)) {
    for (const [i, set] of (obj.loggedSets as unknown[]).entries()) {
      if (set == null || typeof set !== 'object') {
        errors.push(`loggedSets[${i}] is invalid.`)
        break
      }
      const ls = set as Record<string, unknown>
      if (typeof ls.weight !== 'number' || typeof ls.reps !== 'number') {
        errors.push(`loggedSets[${i}] must include numeric weight and reps.`)
        break
      }
    }
  }

  return { ok: errors.length === 0, errors, warnings }
}

export async function exportBackup(): Promise<BackupPayload> {
  const [
    exercises,
    workoutTemplates,
    programs,
    programWeeks,
    scheduledWorkouts,
    workoutSessions,
    exerciseSessions,
    loggedSets,
    personalRecords,
    readinessEntries,
    userSettings,
    appMeta,
  ] = await Promise.all([
    db.exercises.toArray(),
    db.workoutTemplates.toArray(),
    db.programs.toArray(),
    db.programWeeks.toArray(),
    db.scheduledWorkouts.toArray(),
    db.workoutSessions.toArray(),
    db.exerciseSessions.toArray(),
    db.loggedSets.toArray(),
    db.personalRecords.toArray(),
    db.readinessEntries.toArray(),
    db.userSettings.toArray(),
    db.appMeta.toArray(),
  ])

  // Strip blobs from exercises for JSON portability
  const portableExercises = exercises.map(({ imageBlob: _blob, ...rest }) => rest as Exercise)

  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    app: 'Hypertrophy Lab',
    exercises: portableExercises,
    workoutTemplates,
    programs,
    programWeeks,
    scheduledWorkouts,
    workoutSessions,
    exerciseSessions,
    loggedSets,
    personalRecords,
    readinessEntries,
    userSettings,
    appMeta,
  }
}

export async function importBackup(data: unknown): Promise<ValidationResult> {
  const validation = validateBackup(data)
  if (!validation.ok) return validation

  const payload = data as BackupPayload

  await db.transaction(
    'rw',
    [
      db.exercises,
      db.workoutTemplates,
      db.programs,
      db.programWeeks,
      db.scheduledWorkouts,
      db.workoutSessions,
      db.exerciseSessions,
      db.loggedSets,
      db.personalRecords,
      db.readinessEntries,
      db.userSettings,
      db.appMeta,
    ],
    async () => {
      await Promise.all([
        db.exercises.clear(),
        db.workoutTemplates.clear(),
        db.programs.clear(),
        db.programWeeks.clear(),
        db.scheduledWorkouts.clear(),
        db.workoutSessions.clear(),
        db.exerciseSessions.clear(),
        db.loggedSets.clear(),
        db.personalRecords.clear(),
        db.readinessEntries.clear(),
        db.userSettings.clear(),
        db.appMeta.clear(),
      ])

      // Preserve IDs when present for referential integrity across tables
      await replaceTable(db.exercises, payload.exercises)
      await replaceTable(db.workoutTemplates, payload.workoutTemplates)
      await replaceTable(db.programs, payload.programs)
      await replaceTable(db.programWeeks, payload.programWeeks)
      await replaceTable(db.scheduledWorkouts, payload.scheduledWorkouts)
      await replaceTable(db.workoutSessions, payload.workoutSessions)
      await replaceTable(db.exerciseSessions, payload.exerciseSessions)
      await replaceTable(db.loggedSets, payload.loggedSets)
      await replaceTable(db.personalRecords, payload.personalRecords)
      await replaceTable(db.readinessEntries, payload.readinessEntries)
      await replaceTable(db.userSettings, payload.userSettings)
      await replaceTable(db.appMeta, payload.appMeta ?? [])
    },
  )

  return validation
}

async function replaceTable<T extends { id?: number }>(
  table: { clear: () => Promise<void>; bulkPut: (items: T[]) => Promise<unknown> },
  rows: T[],
): Promise<void> {
  await table.clear()
  if (rows.length === 0) return
  await table.bulkPut(rows)
}

export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
