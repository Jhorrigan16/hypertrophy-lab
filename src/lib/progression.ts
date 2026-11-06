import type {
  Equipment,
  EquipmentIncrements,
  LoggedSet,
  MuscleGroup,
  ProgressionPrefs,
  ProgramWeek,
} from '@/db/types'

export interface WorkingSetSnapshot {
  weight: number // lb
  reps: number
  rir: number | null
  isWarmup: boolean
  isComplete: boolean
}

export interface ProgressionInput {
  previousWorkingSets: WorkingSetSnapshot[]
  repMin: number
  repMax: number
  targetRirMin?: number
  targetRirMax?: number
  primaryMuscle: MuscleGroup
  equipment: Equipment
  increments: EquipmentIncrements
  prefs: ProgressionPrefs
  week: Pick<
    ProgramWeek,
    'allowAutoLoadIncrease' | 'phase' | 'targetRirMin' | 'targetRirMax'
  >
}

export type ProgressionResult =
  | { status: 'establish_baseline'; suggestedWeight: null; reason: string }
  | { status: 'hold'; suggestedWeight: number; reason: string }
  | { status: 'increase'; suggestedWeight: number; previousWeight: number; reason: string }
  | { status: 'deload_hold'; suggestedWeight: number; reason: string }

const UPPER_MUSCLES: MuscleGroup[] = [
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
]

export function isUpperBody(muscle: MuscleGroup): boolean {
  return UPPER_MUSCLES.includes(muscle)
}

export function roundToIncrement(weight: number, increment: number): number {
  if (increment <= 0) return weight
  return Math.round(weight / increment) * increment
}

export function getIncrement(equipment: Equipment, increments: EquipmentIncrements): number {
  return increments[equipment] ?? increments.other
}

export function filterWorkingSets(sets: WorkingSetSnapshot[]): WorkingSetSnapshot[] {
  return sets.filter((s) => s.isComplete && !s.isWarmup)
}

export function allSetsHitTopOfRange(
  sets: WorkingSetSnapshot[],
  repMax: number,
  prefs: ProgressionPrefs,
  targetRirMax?: number,
): boolean {
  const working = filterWorkingSets(sets)
  if (working.length === 0) return false

  const repsOk = prefs.requireAllSetsInRange
    ? working.every((s) => s.reps >= repMax)
    : working.some((s) => s.reps >= repMax)

  if (!repsOk) return false

  if (prefs.requireTargetRir && targetRirMax != null) {
    // RIR at or below target means hard enough; null RIR is treated as unknown → fail if required
    return working.every((s) => s.rir != null && s.rir <= targetRirMax)
  }
  return true
}

export function averageWorkingWeight(sets: WorkingSetSnapshot[]): number | null {
  const working = filterWorkingSets(sets)
  if (working.length === 0) return null
  const sum = working.reduce((acc, s) => acc + s.weight, 0)
  return sum / working.length
}

export function lastWorkingWeight(sets: WorkingSetSnapshot[]): number | null {
  const working = filterWorkingSets(sets)
  if (working.length === 0) return null
  return working[working.length - 1]!.weight
}

/**
 * Double-progression from real history only.
 * Never mutates logged weights — only suggests next session load.
 */
export function suggestNextWeight(input: ProgressionInput): ProgressionResult {
  const working = filterWorkingSets(input.previousWorkingSets)

  if (working.length === 0) {
    return {
      status: 'establish_baseline',
      suggestedWeight: null,
      reason: 'No working-set history yet. Establish a baseline load this session.',
    }
  }

  const previousWeight = lastWorkingWeight(working) ?? averageWorkingWeight(working)!
  const increment = getIncrement(input.equipment, input.increments)

  if (!input.week.allowAutoLoadIncrease || input.week.phase === 'deload' || input.week.phase === 'assessment') {
    return {
      status: 'deload_hold',
      suggestedWeight: roundToIncrement(previousWeight, increment),
      reason: 'Deload/assessment week — hold load; no auto increase.',
    }
  }

  const targetRirMax = input.targetRirMax ?? input.week.targetRirMax
  const earned = allSetsHitTopOfRange(
    working,
    input.repMax,
    input.prefs,
    targetRirMax,
  )

  if (!earned) {
    return {
      status: 'hold',
      suggestedWeight: roundToIncrement(previousWeight, increment),
      reason: `Hold load until all working sets hit ${input.repMax} reps at target effort.`,
    }
  }

  const pct = isUpperBody(input.primaryMuscle)
    ? input.prefs.upperBodyIncreasePercent
    : input.prefs.lowerBodyIncreasePercent

  const rawNext = previousWeight * (1 + pct / 100)
  const next = roundToIncrement(rawNext, increment)
  // Ensure at least one increment when rounding collapses
  const suggested =
    next > previousWeight ? next : roundToIncrement(previousWeight + increment, increment)

  return {
    status: 'increase',
    suggestedWeight: suggested,
    previousWeight,
    reason: `Top of range hit — suggest +${pct}% (rounded to ${increment}).`,
  }
}

export function applyWeekSetCount(baseSets: number, setReductionPercent: number): number {
  if (setReductionPercent <= 0) return baseSets
  return Math.max(1, Math.round(baseSets * (1 - setReductionPercent / 100)))
}

export function targetRirForWeek(week: Pick<ProgramWeek, 'targetRirMin' | 'targetRirMax'>): {
  min: number
  max: number
} {
  return { min: week.targetRirMin, max: week.targetRirMax }
}

export function isOptionalFailureAllowed(
  week: Pick<ProgramWeek, 'allowOptionalFailureOnIsolation'>,
  isCompound: boolean,
  isStableMachineOrIsolation: boolean,
): boolean {
  if (!week.allowOptionalFailureOnIsolation) return false
  if (isCompound) return false
  return isStableMachineOrIsolation
}

export function preventDuplicateSetSubmission(
  existingSets: Array<Pick<LoggedSet, 'setNumber' | 'isWarmup' | 'isUnilateralSide' | 'isComplete'>>,
  candidate: Pick<LoggedSet, 'setNumber' | 'isWarmup' | 'isUnilateralSide'>,
): boolean {
  // Returns true if submission should be blocked as duplicate completed set
  return existingSets.some(
    (s) =>
      s.isComplete &&
      s.setNumber === candidate.setNumber &&
      s.isWarmup === candidate.isWarmup &&
      (s.isUnilateralSide ?? null) === (candidate.isUnilateralSide ?? null),
  )
}
