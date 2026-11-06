import { describe, expect, it, beforeEach } from 'vitest'
import { EXTRA_SEED_EXERCISES } from './extraExercises'
import { ALL_SEED_EXERCISES, SEED_EXERCISES } from './exercises'
import { db } from '@/db/database'
import { ensureExerciseLibraryExpanded, seedAll } from '@/db/seed'

const PRIMARY_GROUPS = [
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
  'core',
] as const

describe('extra exercise library', () => {
  it('adds six exercises per used primary muscle group across expansions', () => {
    expect(EXTRA_SEED_EXERCISES).toHaveLength(60)
    for (const group of PRIMARY_GROUPS) {
      const count = EXTRA_SEED_EXERCISES.filter((e) => e.primaryMuscle === group).length
      expect(count, group).toBe(6)
    }
  })

  it('does not collide with original seed names or itself', () => {
    const original = new Set(SEED_EXERCISES.map((e) => e.name.toLowerCase()))
    const seen = new Set<string>()
    for (const ex of EXTRA_SEED_EXERCISES) {
      const key = ex.name.toLowerCase()
      expect(original.has(key)).toBe(false)
      expect(seen.has(key)).toBe(false)
      seen.add(key)
    }
  })

  it('ALL_SEED_EXERCISES is deduped and includes extras', () => {
    expect(ALL_SEED_EXERCISES.length).toBe(SEED_EXERCISES.length + EXTRA_SEED_EXERCISES.length)
    const names = ALL_SEED_EXERCISES.map((e) => e.name.toLowerCase())
    expect(new Set(names).size).toBe(names.length)
  })

  it('each extra has required coaching fields', () => {
    for (const ex of EXTRA_SEED_EXERCISES) {
      expect(ex.name.length).toBeGreaterThan(2)
      expect(ex.cues.length).toBeGreaterThan(0)
      expect(ex.commonErrors.length).toBeGreaterThan(0)
      expect(ex.alternatives.length).toBeGreaterThan(0)
      expect(ex.setup.length).toBeGreaterThan(0)
      expect(ex.execution.length).toBeGreaterThan(0)
      expect(ex.videoUrl).toBeUndefined()
      expect(ex.isCustom).toBe(false)
    }
  })
})

describe('ensureExerciseLibraryExpanded', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
  })

  it('adds missing extras without wiping existing exercises', async () => {
    await seedAll('2026-01-05')
    // Simulate an older DB that only had the original 25
    const extras = await db.exercises
      .filter((e) => EXTRA_SEED_EXERCISES.some((x) => x.name === e.name))
      .toArray()
    for (const e of extras) {
      await db.exercises.delete(e.id!)
    }
    const before = await db.exercises.count()
    expect(before).toBe(SEED_EXERCISES.length)

    const added = await ensureExerciseLibraryExpanded()
    expect(added).toBe(EXTRA_SEED_EXERCISES.length)
    expect(await db.exercises.count()).toBe(before + EXTRA_SEED_EXERCISES.length)

    // Idempotent
    expect(await ensureExerciseLibraryExpanded()).toBe(0)
    expect(await db.exercises.count()).toBe(before + EXTRA_SEED_EXERCISES.length)
  })
})
