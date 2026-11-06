import type { LoggedSet } from '@/db/types'

export interface PrefillValues {
  weight: number
  reps: number
  rir: number | null
  source: 'previous' | 'suggestion' | 'target'
}

export function prefillFromPrevious(
  previousWorkingSets: Array<{ weight: number; reps: number; rir: number | null }>,
  opts: {
    suggestedWeight?: number | null
    targetRepMax: number
    targetRir?: number | null
  },
): PrefillValues {
  const last = previousWorkingSets[previousWorkingSets.length - 1]
  if (last) {
    return {
      weight: last.weight,
      reps: last.reps > 0 ? last.reps : opts.targetRepMax,
      rir: last.rir ?? opts.targetRir ?? null,
      source: 'previous',
    }
  }
  if (opts.suggestedWeight != null && opts.suggestedWeight > 0) {
    return {
      weight: opts.suggestedWeight,
      reps: opts.targetRepMax,
      rir: opts.targetRir ?? null,
      source: 'suggestion',
    }
  }
  return {
    weight: 0,
    reps: opts.targetRepMax,
    rir: opts.targetRir ?? null,
    source: 'target',
  }
}

export function findNextIncompleteSet(
  sets: Array<Pick<LoggedSet, 'id' | 'isComplete' | 'isWarmup' | 'setNumber'>>,
  preferWorking = true,
): number | null {
  const ordered = [...sets].sort((a, b) => {
    if (a.isWarmup !== b.isWarmup) return a.isWarmup ? -1 : 1
    return a.setNumber - b.setNumber
  })
  if (preferWorking) {
    const working = ordered.find((s) => !s.isWarmup && !s.isComplete)
    if (working?.id != null) return working.id
  }
  const any = ordered.find((s) => !s.isComplete)
  return any?.id ?? null
}

export function findNextIncompleteExerciseIndex(
  bundles: Array<{
    sets: Array<Pick<LoggedSet, 'isComplete' | 'isWarmup'>>
  }>,
  fromIndex = 0,
): number {
  for (let i = 0; i < bundles.length; i++) {
    const idx = (fromIndex + i) % bundles.length
    const incomplete = bundles[idx]!.sets.some((s) => !s.isWarmup && !s.isComplete)
    if (incomplete) return idx
  }
  // All working sets done — stay on fromIndex (clamped)
  return Math.min(fromIndex, Math.max(0, bundles.length - 1))
}

export function workoutWorkingProgress(
  bundles: Array<{ sets: Array<Pick<LoggedSet, 'isComplete' | 'isWarmup'>> }>,
): { done: number; total: number } {
  let done = 0
  let total = 0
  for (const b of bundles) {
    for (const s of b.sets) {
      if (s.isWarmup) continue
      total += 1
      if (s.isComplete) done += 1
    }
  }
  return { done, total }
}
