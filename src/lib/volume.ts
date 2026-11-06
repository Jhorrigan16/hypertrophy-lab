import type { LoggedSet, MuscleGroup } from '@/db/types'

export function setVolume(weight: number, reps: number): number {
  return weight * reps
}

export function workingSetVolume(
  sets: Array<Pick<LoggedSet, 'weight' | 'reps' | 'isWarmup' | 'isComplete'>>,
): number {
  return sets
    .filter((s) => s.isComplete && !s.isWarmup)
    .reduce((sum, s) => sum + setVolume(s.weight, s.reps), 0)
}

export function workingSetCount(
  sets: Array<Pick<LoggedSet, 'isWarmup' | 'isComplete'>>,
): number {
  return sets.filter((s) => s.isComplete && !s.isWarmup).length
}

export interface MuscleVolumeRow {
  muscle: MuscleGroup
  volume: number
  sets: number
}

export function aggregateMuscleVolume(
  rows: Array<{ primaryMuscle: MuscleGroup; volume: number; sets: number }>,
): MuscleVolumeRow[] {
  const map = new Map<MuscleGroup, MuscleVolumeRow>()
  for (const row of rows) {
    const prev = map.get(row.primaryMuscle) ?? {
      muscle: row.primaryMuscle,
      volume: 0,
      sets: 0,
    }
    prev.volume += row.volume
    prev.sets += row.sets
    map.set(row.primaryMuscle, prev)
  }
  return Array.from(map.values()).sort((a, b) => b.volume - a.volume)
}
