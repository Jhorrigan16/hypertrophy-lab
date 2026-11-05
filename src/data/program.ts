import type { PhaseType, WorkoutTemplateExercise } from '@/db/types'

export interface DayDef {
  name: string
  dayLabel: string
  dayIndex: number
  exercises: Array<{
    exerciseName: string
    sets: number
    repMin: number
    repMax: number
    isUnilateral?: boolean
  }>
}

export const PROGRAM_DAYS: DayDef[] = [
  {
    name: 'Upper A',
    dayLabel: 'Upper A',
    dayIndex: 1,
    exercises: [
      { exerciseName: 'Incline Smith Machine Press', sets: 3, repMin: 6, repMax: 10 },
      { exerciseName: 'Chest-Supported Row', sets: 3, repMin: 8, repMax: 12 },
      { exerciseName: 'Machine Chest Press', sets: 3, repMin: 8, repMax: 12 },
      { exerciseName: 'Neutral-Grip Lat Pulldown', sets: 3, repMin: 10, repMax: 12 },
      { exerciseName: 'Cable Lateral Raise', sets: 3, repMin: 12, repMax: 20, isUnilateral: true },
      { exerciseName: 'Cable Triceps Pressdown', sets: 2, repMin: 10, repMax: 15 },
      { exerciseName: 'Bayesian Cable Curl', sets: 2, repMin: 10, repMax: 15, isUnilateral: true },
    ],
  },
  {
    name: 'Lower A',
    dayLabel: 'Lower A',
    dayIndex: 2,
    exercises: [
      { exerciseName: 'Hack Squat', sets: 3, repMin: 6, repMax: 10 },
      { exerciseName: 'Leg Press', sets: 3, repMin: 10, repMax: 15 },
      { exerciseName: 'Seated Leg Curl', sets: 3, repMin: 10, repMax: 15 },
      { exerciseName: 'Leg Extension', sets: 3, repMin: 12, repMax: 15 },
      { exerciseName: 'Standing Calf Raise', sets: 4, repMin: 8, repMax: 12 },
      { exerciseName: 'Cable Crunch', sets: 3, repMin: 10, repMax: 15 },
    ],
  },
  {
    name: 'Upper B',
    dayLabel: 'Upper B',
    dayIndex: 3,
    exercises: [
      { exerciseName: 'Chest-Supported High Row', sets: 3, repMin: 8, repMax: 12 },
      { exerciseName: 'Flat Dumbbell Press', sets: 3, repMin: 8, repMax: 12 },
      {
        exerciseName: 'Single-Arm Cable Lat Pulldown',
        sets: 3,
        repMin: 10,
        repMax: 15,
        isUnilateral: true,
      },
      { exerciseName: 'Machine Shoulder Press', sets: 2, repMin: 8, repMax: 12 },
      { exerciseName: 'Reverse Pec Deck', sets: 3, repMin: 12, repMax: 20 },
      { exerciseName: 'Preacher Curl', sets: 3, repMin: 10, repMax: 15 },
      { exerciseName: 'Overhead Cable Triceps Extension', sets: 3, repMin: 10, repMax: 15 },
    ],
  },
  {
    name: 'Lower B',
    dayLabel: 'Lower B',
    dayIndex: 4,
    exercises: [
      { exerciseName: 'Romanian Deadlift', sets: 3, repMin: 6, repMax: 10 },
      { exerciseName: 'Seated Leg Curl', sets: 3, repMin: 10, repMax: 15 },
      {
        exerciseName: 'Smith Machine Split Squat',
        sets: 3,
        repMin: 8,
        repMax: 12,
        isUnilateral: true,
      },
      { exerciseName: 'Hip Thrust Machine', sets: 3, repMin: 8, repMax: 12 },
      { exerciseName: 'Seated Calf Raise', sets: 4, repMin: 10, repMax: 15 },
      { exerciseName: 'Hanging Knee Raise', sets: 3, repMin: 10, repMax: 15 },
    ],
  },
]

/** Suggested Mon/Tue/rest/Thu/Fri/rest/rest */
export const SUGGESTED_DAY_MAP: Record<number, number | null> = {
  1: 1, // Mon -> Upper A
  2: 2, // Tue -> Lower A
  3: null, // Wed rest
  4: 3, // Thu -> Upper B
  5: 4, // Fri -> Lower B
  6: null, // Sat rest
  0: null, // Sun rest
}

export interface WeekPhaseDef {
  weekNumber: number
  phase: PhaseType
  phaseLabel: string
  targetRirMin: number
  targetRirMax: number
  setReductionPercent: number
  allowAutoLoadIncrease: boolean
  allowOptionalFailureOnIsolation: boolean
  notes: string
}

export const WEEK_PHASES: WeekPhaseDef[] = [
  {
    weekNumber: 1,
    phase: 'accumulation',
    phaseLabel: 'Accumulation',
    targetRirMin: 3,
    targetRirMax: 3,
    setReductionPercent: 0,
    allowAutoLoadIncrease: true,
    allowOptionalFailureOnIsolation: false,
    notes: 'Establish technique and baseline loads. Aim ~3 RIR.',
  },
  {
    weekNumber: 2,
    phase: 'accumulation',
    phaseLabel: 'Accumulation',
    targetRirMin: 2,
    targetRirMax: 2,
    setReductionPercent: 0,
    allowAutoLoadIncrease: true,
    allowOptionalFailureOnIsolation: false,
    notes: 'Push a bit closer — target ~2 RIR.',
  },
  {
    weekNumber: 3,
    phase: 'accumulation',
    phaseLabel: 'Accumulation',
    targetRirMin: 1,
    targetRirMax: 2,
    setReductionPercent: 0,
    allowAutoLoadIncrease: true,
    allowOptionalFailureOnIsolation: false,
    notes: 'Higher effort — target 1–2 RIR.',
  },
  {
    weekNumber: 4,
    phase: 'deload',
    phaseLabel: 'Deload',
    targetRirMin: 3,
    targetRirMax: 4,
    setReductionPercent: 45,
    allowAutoLoadIncrease: false,
    allowOptionalFailureOnIsolation: false,
    notes: '~40–50% set reduction. Keep RIR 3–4. No auto load increases.',
  },
  {
    weekNumber: 5,
    phase: 'progressive_overload',
    phaseLabel: 'Progressive Overload',
    targetRirMin: 2,
    targetRirMax: 2,
    setReductionPercent: 0,
    allowAutoLoadIncrease: true,
    allowOptionalFailureOnIsolation: false,
    notes: 'Build loads via double progression where earned.',
  },
  {
    weekNumber: 6,
    phase: 'progressive_overload',
    phaseLabel: 'Progressive Overload',
    targetRirMin: 1,
    targetRirMax: 2,
    setReductionPercent: 0,
    allowAutoLoadIncrease: true,
    allowOptionalFailureOnIsolation: false,
    notes: 'Continue progressive overload with solid form.',
  },
  {
    weekNumber: 7,
    phase: 'progressive_overload',
    phaseLabel: 'Progressive Overload',
    targetRirMin: 1,
    targetRirMax: 2,
    setReductionPercent: 0,
    allowAutoLoadIncrease: true,
    allowOptionalFailureOnIsolation: false,
    notes: 'Peak accumulation before high-effort block.',
  },
  {
    weekNumber: 8,
    phase: 'high_effort',
    phaseLabel: 'High Effort',
    targetRirMin: 1,
    targetRirMax: 1,
    setReductionPercent: 0,
    allowAutoLoadIncrease: true,
    allowOptionalFailureOnIsolation: true,
    notes:
      '~1 RIR. Optional 0 RIR final set on stable isolation/machines only — never required on compounds.',
  },
  {
    weekNumber: 9,
    phase: 'high_effort',
    phaseLabel: 'High Effort',
    targetRirMin: 0,
    targetRirMax: 1,
    setReductionPercent: 0,
    allowAutoLoadIncrease: true,
    allowOptionalFailureOnIsolation: true,
    notes:
      'High effort. Optional failure only on stable isolation/machines. Compounds stay controlled.',
  },
  {
    weekNumber: 10,
    phase: 'assessment',
    phaseLabel: 'Deload + Assessment',
    targetRirMin: 3,
    targetRirMax: 4,
    setReductionPercent: 45,
    allowAutoLoadIncrease: false,
    allowOptionalFailureOnIsolation: false,
    notes: 'Deload, assess progress, review 10-week summary, then restart or duplicate.',
  },
]

export function applySetReduction(baseSets: number, reductionPercent: number): number {
  if (reductionPercent <= 0) return baseSets
  const reduced = Math.round(baseSets * (1 - reductionPercent / 100))
  return Math.max(1, reduced)
}

export function toTemplateExercises(
  day: DayDef,
  exerciseIdByName: Map<string, number>,
): WorkoutTemplateExercise[] {
  return day.exercises.map((ex, index) => {
    const exerciseId = exerciseIdByName.get(ex.exerciseName)
    if (!exerciseId) {
      throw new Error(`Missing exercise seed: ${ex.exerciseName}`)
    }
    return {
      exerciseId,
      order: index,
      sets: ex.sets,
      repMin: ex.repMin,
      repMax: ex.repMax,
      isUnilateral: ex.isUnilateral ?? false,
    }
  })
}
