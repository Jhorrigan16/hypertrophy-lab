import { describe, expect, it, beforeEach } from 'vitest'
import { db } from '@/db/database'
import {
  displayToMeters,
  formatDuration,
  formatPace,
  metersToDisplay,
  paceSecondsPerUnit,
  ensureCardioSeeded,
  startCardioSession,
  completeCardioSession,
  logCompletedCardioSession,
  getActiveCardioSession,
} from './cardio'

describe('cardio helpers', () => {
  it('converts miles and km', () => {
    expect(Math.round(metersToDisplay(1609.344, 'mi') * 100) / 100).toBe(1)
    expect(metersToDisplay(5000, 'km')).toBe(5)
    expect(Math.round(displayToMeters(1, 'mi'))).toBe(1609)
    expect(displayToMeters(3, 'km')).toBe(3000)
  })

  it('formats duration and pace', () => {
    expect(formatDuration(65)).toBe('1:05')
    expect(formatDuration(3661)).toBe('1:01:01')
    expect(paceSecondsPerUnit(5000, 1500, 'km')).toBe(300)
    expect(formatPace(5000, 1500, 'km')).toBe('5:00/km')
  })
})

describe('cardio persistence', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
    await ensureCardioSeeded()
  })

  it('seeds default activity types', async () => {
    const types = await db.cardioActivityTypes.toArray()
    expect(types.length).toBeGreaterThanOrEqual(5)
    expect(types.some((t) => t.name === 'Easy Run')).toBe(true)
  })

  it('starts and completes a live session', async () => {
    const activity = await db.cardioActivityTypes.where('name').equals('Easy Run').first()
    expect(activity?.id).toBeTruthy()
    const id = await startCardioSession(activity!.id!)
    const active = await getActiveCardioSession()
    expect(active?.id).toBe(id)

    await completeCardioSession(id, {
      durationSeconds: 1800,
      distanceMeters: 5000,
      effort: 5,
      notes: 'Steady',
    })

    const done = await db.cardioSessions.get(id)
    expect(done?.status).toBe('completed')
    expect(done?.distanceMeters).toBe(5000)
    expect(await getActiveCardioSession()).toBeUndefined()
  })

  it('logs a completed session without a live start', async () => {
    const activity = await db.cardioActivityTypes.where('name').equals('Bike').first()
    const id = await logCompletedCardioSession({
      activityTypeId: activity!.id!,
      durationSeconds: 2400,
      distanceMeters: 16093.44,
      effort: 6,
    })
    const row = await db.cardioSessions.get(id)
    expect(row?.status).toBe('completed')
    expect(row?.title).toBe('Bike')
  })
})
