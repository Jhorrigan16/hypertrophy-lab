import { describe, expect, it } from 'vitest'
import {
  allSetsHitTopOfRange,
  applyWeekSetCount,
  isOptionalFailureAllowed,
  preventDuplicateSetSubmission,
  roundToIncrement,
  suggestNextWeight,
} from './progression'
import {
  DEFAULT_EQUIPMENT_INCREMENTS,
  DEFAULT_PROGRESSION_PREFS,
} from '@/db/types'

const baseWeek = {
  allowAutoLoadIncrease: true,
  phase: 'progressive_overload' as const,
  targetRirMin: 1,
  targetRirMax: 2,
}

describe('roundToIncrement', () => {
  it('rounds to nearest increment', () => {
    expect(roundToIncrement(102, 5)).toBe(100)
    expect(roundToIncrement(103, 5)).toBe(105)
    expect(roundToIncrement(47.5, 2.5)).toBe(47.5)
  })
})

describe('RIR / double progression', () => {
  it('establishes baseline when no history', () => {
    const result = suggestNextWeight({
      previousWorkingSets: [],
      repMin: 8,
      repMax: 12,
      primaryMuscle: 'chest',
      equipment: 'machine',
      increments: DEFAULT_EQUIPMENT_INCREMENTS,
      prefs: DEFAULT_PROGRESSION_PREFS,
      week: baseWeek,
    })
    expect(result.status).toBe('establish_baseline')
    expect(result.suggestedWeight).toBeNull()
  })

  it('holds when reps are below top of range', () => {
    const result = suggestNextWeight({
      previousWorkingSets: [
        { weight: 100, reps: 10, rir: 1, isWarmup: false, isComplete: true },
        { weight: 100, reps: 10, rir: 1, isWarmup: false, isComplete: true },
        { weight: 100, reps: 9, rir: 1, isWarmup: false, isComplete: true },
      ],
      repMin: 8,
      repMax: 12,
      primaryMuscle: 'chest',
      equipment: 'machine',
      increments: DEFAULT_EQUIPMENT_INCREMENTS,
      prefs: DEFAULT_PROGRESSION_PREFS,
      week: baseWeek,
      targetRirMax: 2,
    })
    expect(result.status).toBe('hold')
    expect(result.suggestedWeight).toBe(100)
  })

  it('increases when all sets hit top reps at target RIR', () => {
    const result = suggestNextWeight({
      previousWorkingSets: [
        { weight: 100, reps: 12, rir: 1, isWarmup: false, isComplete: true },
        { weight: 100, reps: 12, rir: 1, isWarmup: false, isComplete: true },
        { weight: 100, reps: 12, rir: 2, isWarmup: false, isComplete: true },
      ],
      repMin: 8,
      repMax: 12,
      primaryMuscle: 'chest',
      equipment: 'machine',
      increments: DEFAULT_EQUIPMENT_INCREMENTS,
      prefs: DEFAULT_PROGRESSION_PREFS,
      week: baseWeek,
      targetRirMax: 2,
    })
    expect(result.status).toBe('increase')
    if (result.status === 'increase') {
      expect(result.suggestedWeight).toBeGreaterThan(100)
      expect(result.suggestedWeight % 5).toBe(0)
    }
  })

  it('uses lower-body percent for quads', () => {
    const result = suggestNextWeight({
      previousWorkingSets: [
        { weight: 200, reps: 10, rir: 1, isWarmup: false, isComplete: true },
        { weight: 200, reps: 10, rir: 1, isWarmup: false, isComplete: true },
        { weight: 200, reps: 10, rir: 1, isWarmup: false, isComplete: true },
      ],
      repMin: 6,
      repMax: 10,
      primaryMuscle: 'quads',
      equipment: 'machine',
      increments: DEFAULT_EQUIPMENT_INCREMENTS,
      prefs: DEFAULT_PROGRESSION_PREFS,
      week: baseWeek,
      targetRirMax: 2,
    })
    expect(result.status).toBe('increase')
    if (result.status === 'increase') {
      // 5% of 200 = 210, rounds to 210
      expect(result.suggestedWeight).toBe(210)
    }
  })

  it('excludes warm-ups from progression decisions', () => {
    expect(
      allSetsHitTopOfRange(
        [
          { weight: 60, reps: 12, rir: 5, isWarmup: true, isComplete: true },
          { weight: 100, reps: 12, rir: 1, isWarmup: false, isComplete: true },
          { weight: 100, reps: 12, rir: 1, isWarmup: false, isComplete: true },
        ],
        12,
        DEFAULT_PROGRESSION_PREFS,
        2,
      ),
    ).toBe(true)
  })

  it('holds load on deload weeks', () => {
    const result = suggestNextWeight({
      previousWorkingSets: [
        { weight: 100, reps: 12, rir: 1, isWarmup: false, isComplete: true },
      ],
      repMin: 8,
      repMax: 12,
      primaryMuscle: 'chest',
      equipment: 'machine',
      increments: DEFAULT_EQUIPMENT_INCREMENTS,
      prefs: DEFAULT_PROGRESSION_PREFS,
      week: {
        allowAutoLoadIncrease: false,
        phase: 'deload',
        targetRirMin: 3,
        targetRirMax: 4,
      },
    })
    expect(result.status).toBe('deload_hold')
  })
})

describe('weekly set reduction / deload', () => {
  it('reduces sets for deload percent', () => {
    expect(applyWeekSetCount(3, 45)).toBe(2)
    expect(applyWeekSetCount(4, 50)).toBe(2)
    expect(applyWeekSetCount(2, 45)).toBe(1)
    expect(applyWeekSetCount(3, 0)).toBe(3)
  })
})

describe('optional failure RIR logic', () => {
  it('never allows required failure on compounds', () => {
    expect(
      isOptionalFailureAllowed(
        { allowOptionalFailureOnIsolation: true },
        true,
        true,
      ),
    ).toBe(false)
  })

  it('allows optional failure on stable isolation when week permits', () => {
    expect(
      isOptionalFailureAllowed(
        { allowOptionalFailureOnIsolation: true },
        false,
        true,
      ),
    ).toBe(true)
  })
})

describe('prevent duplicate set submissions', () => {
  it('blocks completing the same set slot twice', () => {
    const existing = [
      {
        setNumber: 1,
        isWarmup: false,
        isUnilateralSide: null as 'left' | 'right' | null,
        isComplete: true,
      },
    ]
    expect(
      preventDuplicateSetSubmission(existing, {
        setNumber: 1,
        isWarmup: false,
        isUnilateralSide: null,
      }),
    ).toBe(true)
    expect(
      preventDuplicateSetSubmission(existing, {
        setNumber: 2,
        isWarmup: false,
        isUnilateralSide: null,
      }),
    ).toBe(false)
  })
})
