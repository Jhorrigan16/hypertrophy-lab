import { describe, expect, it } from 'vitest'
import {
  findNextIncompleteExerciseIndex,
  findNextIncompleteSet,
  prefillFromPrevious,
  workoutWorkingProgress,
} from './workoutUx'

describe('prefillFromPrevious', () => {
  it('uses last working set when history exists', () => {
    const result = prefillFromPrevious(
      [
        { weight: 100, reps: 10, rir: 2 },
        { weight: 105, reps: 8, rir: 1 },
      ],
      { suggestedWeight: 110, targetRepMax: 12, targetRir: 2 },
    )
    expect(result).toEqual({
      weight: 105,
      reps: 8,
      rir: 1,
      source: 'previous',
    })
  })

  it('falls back to suggestion then targets', () => {
    expect(
      prefillFromPrevious([], {
        suggestedWeight: 135,
        targetRepMax: 10,
        targetRir: 2,
      }).source,
    ).toBe('suggestion')
    expect(
      prefillFromPrevious([], {
        suggestedWeight: null,
        targetRepMax: 10,
        targetRir: 3,
      }),
    ).toEqual({ weight: 0, reps: 10, rir: 3, source: 'target' })
  })
})

describe('next incomplete helpers', () => {
  it('finds next incomplete working set', () => {
    const sets = [
      { id: 1, isComplete: true, isWarmup: false, setNumber: 1 },
      { id: 2, isComplete: false, isWarmup: false, setNumber: 2 },
      { id: 3, isComplete: false, isWarmup: true, setNumber: 1 },
    ]
    expect(findNextIncompleteSet(sets)).toBe(2)
  })

  it('finds next incomplete exercise index', () => {
    const bundles = [
      { sets: [{ isComplete: true, isWarmup: false }] },
      { sets: [{ isComplete: false, isWarmup: false }] },
      { sets: [{ isComplete: true, isWarmup: false }] },
    ]
    expect(findNextIncompleteExerciseIndex(bundles, 0)).toBe(1)
    expect(findNextIncompleteExerciseIndex(bundles, 1)).toBe(1)
  })

  it('counts working progress', () => {
    expect(
      workoutWorkingProgress([
        {
          sets: [
            { isComplete: true, isWarmup: false },
            { isComplete: false, isWarmup: false },
            { isComplete: true, isWarmup: true },
          ],
        },
      ]),
    ).toEqual({ done: 1, total: 2 })
  })
})
