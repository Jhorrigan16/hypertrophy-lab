import { describe, expect, it, beforeEach } from 'vitest'
import { db } from '@/db/database'
import {
  displayToMeters,
  formatDuration,
  formatPace,
  formatPaceClock,
  metersToDisplay,
  paceSecondsPerUnit,
  speedMph,
  buildRunningSessionSeries,
  buildRunningWeeklyMileage,
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
    expect(formatPaceClock(510)).toBe('8:30')
  })

  it('computes mph from distance and duration', () => {
    // 1 mile in 10 minutes → 6 mph
    expect(Math.round((speedMph(1609.344, 600) ?? 0) * 100) / 100).toBe(6)
    expect(speedMph(null, 600)).toBeNull()
    expect(speedMph(1609.344, 0)).toBeNull()
  })

  it('builds running chart series from real sessions only', () => {
    const series = buildRunningSessionSeries([
      {
        id: 1,
        status: 'completed',
        modality: 'run',
        completedAt: '2026-03-02T12:00:00.000Z',
        distanceMeters: 3218.688,
        durationSeconds: 1200,
        title: 'Easy Run',
      },
      {
        id: 2,
        status: 'completed',
        modality: 'bike',
        completedAt: '2026-03-03T12:00:00.000Z',
        distanceMeters: 10000,
        durationSeconds: 1800,
        title: 'Bike',
      },
      {
        id: 3,
        status: 'completed',
        modality: 'run',
        completedAt: '2026-03-01T12:00:00.000Z',
        distanceMeters: null,
        durationSeconds: 900,
        title: 'Easy Run',
      },
    ])
    expect(series).toHaveLength(1)
    expect(series[0]?.miles).toBe(2)
    expect(series[0]?.paceSecPerMile).toBe(600)
    expect(series[0]?.mph).toBe(6)
  })

  it('aggregates weekly running mileage', () => {
    const weeks = buildRunningWeeklyMileage(
      [
        {
          status: 'completed',
          modality: 'run',
          completedAt: '2026-03-02T12:00:00.000Z',
          distanceMeters: 1609.344,
        },
        {
          status: 'completed',
          modality: 'run',
          completedAt: '2026-03-03T12:00:00.000Z',
          distanceMeters: 1609.344,
        },
        {
          status: 'completed',
          modality: 'bike',
          completedAt: '2026-03-03T12:00:00.000Z',
          distanceMeters: 5000,
        },
      ],
      () => '2026-03-02',
    )
    expect(weeks).toEqual([{ weekStart: '2026-03-02', miles: 2, sessions: 2 }])
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
