import { describe, expect, it, beforeEach } from 'vitest'
import { db } from '@/db/database'
import { seedAll } from '@/db/seed'
import { exportBackup, importBackup, validateBackup, BACKUP_VERSION } from './backup'

describe('import/export validation', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
    await seedAll('2026-01-05')
  })

  it('rejects non-objects', () => {
    expect(validateBackup(null).ok).toBe(false)
    expect(validateBackup('nope').ok).toBe(false)
  })

  it('rejects missing arrays', () => {
    const result = validateBackup({ version: 1, app: 'Hypertrophy Lab' })
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.includes('exercises'))).toBe(true)
  })

  it('exports and re-imports a valid backup', async () => {
    const payload = await exportBackup()
    expect(payload.version).toBe(BACKUP_VERSION)
    expect(payload.exercises.length).toBeGreaterThan(10)
    expect(payload.programs.length).toBeGreaterThan(0)

    const validation = validateBackup(payload)
    expect(validation.ok).toBe(true)

    const beforeCount = await db.exercises.count()
    await db.exercises.clear()
    expect(await db.exercises.count()).toBe(0)

    const result = await importBackup(payload)
    expect(result.ok).toBe(true)
    expect(await db.exercises.count()).toBe(beforeCount)
  })
})
