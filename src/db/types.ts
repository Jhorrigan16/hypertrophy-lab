export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'core'
  | 'forearms'
  | 'other'

export type Equipment =
  | 'barbell'
  | 'dumbbell'
  | 'cable'
  | 'machine'
  | 'smith'
  | 'bodyweight'
  | 'other'

export type MovementPattern =
  | 'horizontal_press'
  | 'vertical_press'
  | 'horizontal_pull'
  | 'vertical_pull'
  | 'squat'
  | 'hinge'
  | 'lunge'
  | 'isolation'
  | 'core'
  | 'other'

export type PhaseType =
  | 'accumulation'
  | 'deload'
  | 'progressive_overload'
  | 'high_effort'
  | 'assessment'

export type WeightUnit = 'lb' | 'kg'

export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6 // Sun-Sat

export interface Exercise {
  id?: number
  name: string
  muscleGroups: MuscleGroup[]
  primaryMuscle: MuscleGroup
  equipment: Equipment
  movementPattern: MovementPattern
  isCompound: boolean
  isUnilateral: boolean
  cues: string[]
  commonErrors: string[]
  alternatives: string[]
  setup: string
  execution: string
  romNotes: string
  stabilityNotes: string
  videoUrl?: string
  imageBlob?: Blob
  isCustom: boolean
  defaultRestSeconds: number
  createdAt: string
  updatedAt: string
}

export interface TemplateSetTarget {
  setNumber: number
  repMin: number
  repMax: number
  targetRir?: number
  isWarmup?: boolean
}

export interface WorkoutTemplateExercise {
  exerciseId: number
  order: number
  sets: number
  repMin: number
  repMax: number
  targetRir?: number
  isUnilateral?: boolean
  notes?: string
  restSeconds?: number
}

export interface WorkoutTemplate {
  id?: number
  name: string
  dayLabel: string // e.g. "Upper A"
  dayIndex: number // 1-4
  exercises: WorkoutTemplateExercise[]
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface ProgramWeek {
  id?: number
  programId: number
  weekNumber: number
  phase: PhaseType
  phaseLabel: string
  targetRirMin: number
  targetRirMax: number
  setReductionPercent: number
  allowAutoLoadIncrease: boolean
  allowOptionalFailureOnIsolation: boolean
  notes?: string
}

export interface Program {
  id?: number
  name: string
  description: string
  totalWeeks: number
  templateIds: number[]
  startDate: string
  currentWeek: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface ScheduledWorkout {
  id?: number
  programId: number
  weekNumber: number
  templateId: number
  plannedDate: string // ISO date YYYY-MM-DD
  completedSessionId?: number
  status: 'planned' | 'completed' | 'skipped' | 'moved'
  movedFromDate?: string
  notes?: string
}

export type SessionStatus = 'in_progress' | 'paused' | 'completed' | 'discarded'

export interface LoggedSet {
  id?: number
  exerciseSessionId: number
  setNumber: number
  weight: number // always stored in lb internally
  reps: number
  rir: number | null
  isWarmup: boolean
  isComplete: boolean
  isUnilateralSide?: 'left' | 'right' | null
  notes?: string
  completedAt?: string
  createdAt: string
}

export interface ExerciseSession {
  id?: number
  workoutSessionId: number
  exerciseId: number
  order: number
  targetSets: number
  targetRepMin: number
  targetRepMax: number
  targetRir?: number
  suggestedWeight?: number // lb
  restSeconds: number
  isUnilateral: boolean
  notes?: string
  completedAt?: string
}

export interface WorkoutSession {
  id?: number
  programId?: number
  templateId?: number
  scheduledWorkoutId?: number
  title: string
  weekNumber?: number
  dayLabel?: string
  status: SessionStatus
  startedAt: string
  pausedAt?: string
  resumedAt?: string
  completedAt?: string
  totalPausedMs: number
  notes?: string
  readinessEntryId?: number
}

export interface PersonalRecord {
  id?: number
  exerciseId: number
  type: 'weight' | 'reps' | 'volume' | 'e1rm'
  value: number
  weight: number
  reps: number
  sessionId: number
  achievedAt: string
  notes?: string
}

export interface ReadinessEntry {
  id?: number
  date: string
  sleep: number // 1-5
  energy: number
  soreness: number
  motivation: number
  fatigue: number
  notes?: string
  createdAt: string
}

export interface ProgressionPrefs {
  upperBodyIncreasePercent: number
  lowerBodyIncreasePercent: number
  requireAllSetsInRange: boolean
  requireTargetRir: boolean
}

export interface EquipmentIncrements {
  barbell: number
  dumbbell: number
  cable: number
  machine: number
  smith: number
  bodyweight: number
  other: number
}

export interface RestDefaults {
  compoundMin: number
  compoundMax: number
  isolationMin: number
  isolationMax: number
}

export interface UserSettings {
  id?: number
  weightUnit: WeightUnit
  theme: 'dark' | 'light'
  programStartDate: string
  preferredTrainingDays: DayOfWeek[]
  equipmentIncrements: EquipmentIncrements
  progressionPrefs: ProgressionPrefs
  restDefaults: RestDefaults
  restTimerSound: boolean
  restTimerVibration: boolean
  substitutions: Record<number, number> // originalExerciseId -> substituteExerciseId
  onboardingComplete: boolean
  updatedAt: string
}

export interface AppMeta {
  id?: number
  key: string
  value: string
}

export type CardioModality = 'run' | 'bike' | 'row' | 'other'

export type CardioSessionStatus = 'in_progress' | 'completed' | 'discarded'

export interface CardioActivityType {
  id?: number
  name: string
  modality: CardioModality
  /** Soft default effort 1–10 when starting a session */
  defaultEffort: number
  notes?: string
  isCustom: boolean
  archived: boolean
  createdAt: string
  updatedAt: string
}

export interface CardioSession {
  id?: number
  activityTypeId: number
  title: string
  modality: CardioModality
  status: CardioSessionStatus
  startedAt: string
  completedAt?: string
  /** Elapsed moving/session time */
  durationSeconds: number
  /** Distance in meters; null when not tracked */
  distanceMeters: number | null
  /** Subjective effort 1–10 */
  effort: number | null
  notes?: string
  createdAt: string
  updatedAt: string
}

export const DEFAULT_EQUIPMENT_INCREMENTS: EquipmentIncrements = {
  barbell: 5,
  dumbbell: 5,
  cable: 5,
  machine: 5,
  smith: 5,
  bodyweight: 5,
  other: 5,
}

export const DEFAULT_PROGRESSION_PREFS: ProgressionPrefs = {
  upperBodyIncreasePercent: 2.5,
  lowerBodyIncreasePercent: 5,
  requireAllSetsInRange: true,
  requireTargetRir: true,
}

export const DEFAULT_REST_DEFAULTS: RestDefaults = {
  compoundMin: 120,
  compoundMax: 180,
  isolationMin: 60,
  isolationMax: 120,
}

export const DEFAULT_PREFERRED_DAYS: DayOfWeek[] = [1, 2, 4, 5] // Mon, Tue, Thu, Fri
