import Dexie, { type EntityTable } from 'dexie'
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
  CardioActivityType,
  CardioSession,
} from './types'

export class HypertrophyDB extends Dexie {
  exercises!: EntityTable<Exercise, 'id'>
  workoutTemplates!: EntityTable<WorkoutTemplate, 'id'>
  programs!: EntityTable<Program, 'id'>
  programWeeks!: EntityTable<ProgramWeek, 'id'>
  scheduledWorkouts!: EntityTable<ScheduledWorkout, 'id'>
  workoutSessions!: EntityTable<WorkoutSession, 'id'>
  exerciseSessions!: EntityTable<ExerciseSession, 'id'>
  loggedSets!: EntityTable<LoggedSet, 'id'>
  personalRecords!: EntityTable<PersonalRecord, 'id'>
  readinessEntries!: EntityTable<ReadinessEntry, 'id'>
  userSettings!: EntityTable<UserSettings, 'id'>
  appMeta!: EntityTable<AppMeta, 'id'>
  cardioActivityTypes!: EntityTable<CardioActivityType, 'id'>
  cardioSessions!: EntityTable<CardioSession, 'id'>

  constructor() {
    super('HypertrophyLab')

    this.version(1).stores({
      exercises: '++id, name, primaryMuscle, equipment, isCustom',
      workoutTemplates: '++id, name, dayIndex',
      programs: '++id, isActive, name',
      programWeeks: '++id, programId, weekNumber, [programId+weekNumber]',
      scheduledWorkouts: '++id, programId, plannedDate, weekNumber, status, templateId',
      workoutSessions: '++id, status, startedAt, completedAt, templateId, programId',
      exerciseSessions: '++id, workoutSessionId, exerciseId, order',
      loggedSets: '++id, exerciseSessionId, isComplete, isWarmup, completedAt',
      personalRecords: '++id, exerciseId, type, achievedAt',
      readinessEntries: '++id, date',
      userSettings: '++id',
      appMeta: '++id, key',
    })

    this.version(2).stores({
      exercises: '++id, name, primaryMuscle, equipment, isCustom',
      workoutTemplates: '++id, name, dayIndex',
      programs: '++id, isActive, name',
      programWeeks: '++id, programId, weekNumber, [programId+weekNumber]',
      scheduledWorkouts: '++id, programId, plannedDate, weekNumber, status, templateId',
      workoutSessions: '++id, status, startedAt, completedAt, templateId, programId',
      exerciseSessions: '++id, workoutSessionId, exerciseId, order',
      loggedSets: '++id, exerciseSessionId, isComplete, isWarmup, completedAt',
      personalRecords: '++id, exerciseId, type, achievedAt',
      readinessEntries: '++id, date',
      userSettings: '++id',
      appMeta: '++id, key',
      cardioActivityTypes: '++id, name, modality, archived',
      cardioSessions: '++id, status, startedAt, completedAt, activityTypeId, modality',
    })
  }
}

export const db = new HypertrophyDB()
