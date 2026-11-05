import { db } from '@/db/database'
import { SEED_CARDIO_ACTIVITIES } from '@/data/cardio'
import type {
  CardioActivityType,
  CardioModality,
  CardioSession,
} from '@/db/types'

export type DistanceUnit = 'mi' | 'km'

const METERS_PER_MILE = 1609.344
const METERS_PER_KM = 1000

export function metersToDisplay(meters: number, unit: DistanceUnit): number {
  return unit === 'mi' ? meters / METERS_PER_MILE : meters / METERS_PER_KM
}

export function displayToMeters(value: number, unit: DistanceUnit): number {
  return unit === 'mi' ? value * METERS_PER_MILE : value * METERS_PER_KM
}

export function formatDistance(meters: number | null | undefined, unit: DistanceUnit): string {
  if (meters == null || !Number.isFinite(meters) || meters <= 0) return '—'
  const display = metersToDisplay(meters, unit)
  const rounded = display >= 10 ? display.toFixed(1) : display.toFixed(2)
  return `${rounded} ${unit}`
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }
  return `${m}:${String(sec).padStart(2, '0')}`
}

/** Pace as sec per km or sec per mile depending on unit */
export function paceSecondsPerUnit(
  meters: number | null | undefined,
  durationSeconds: number,
  unit: DistanceUnit,
): number | null {
  if (meters == null || meters <= 0 || durationSeconds <= 0) return null
  const distance = metersToDisplay(meters, unit)
  if (distance <= 0) return null
  return durationSeconds / distance
}

export function formatPace(
  meters: number | null | undefined,
  durationSeconds: number,
  unit: DistanceUnit,
): string {
  const pace = paceSecondsPerUnit(meters, durationSeconds, unit)
  if (pace == null) return '—'
  const whole = Math.floor(pace)
  const m = Math.floor(whole / 60)
  const s = whole % 60
  return `${m}:${String(s).padStart(2, '0')}/${unit}`
}

export async function ensureCardioSeeded(): Promise<void> {
  const count = await db.cardioActivityTypes.count()
  if (count > 0) return
  const ts = new Date().toISOString()
  await db.cardioActivityTypes.bulkAdd(
    SEED_CARDIO_ACTIVITIES.map((a) => ({
      ...a,
      createdAt: ts,
      updatedAt: ts,
    })),
  )
}

export async function listActiveCardioTypes(): Promise<CardioActivityType[]> {
  const all = await db.cardioActivityTypes.orderBy('name').toArray()
  return all.filter((t) => !t.archived)
}

export async function getActiveCardioSession(): Promise<CardioSession | undefined> {
  return db.cardioSessions.where('status').equals('in_progress').first()
}

export async function startCardioSession(activityTypeId: number): Promise<number> {
  const existing = await getActiveCardioSession()
  if (existing) {
    throw new Error('A cardio session is already in progress. Finish or discard it first.')
  }

  const activity = await db.cardioActivityTypes.get(activityTypeId)
  if (!activity || activity.archived) throw new Error('Activity type not found')

  const now = new Date().toISOString()
  const id = await db.cardioSessions.add({
    activityTypeId: activity.id!,
    title: activity.name,
    modality: activity.modality,
    status: 'in_progress',
    startedAt: now,
    durationSeconds: 0,
    distanceMeters: null,
    effort: activity.defaultEffort,
    createdAt: now,
    updatedAt: now,
  })
  if (id == null) throw new Error('Failed to start cardio session')
  return id
}

export async function updateCardioSession(
  id: number,
  patch: Partial<
    Pick<
      CardioSession,
      'durationSeconds' | 'distanceMeters' | 'effort' | 'notes' | 'title' | 'modality'
    >
  >,
): Promise<void> {
  await db.cardioSessions.update(id, {
    ...patch,
    updatedAt: new Date().toISOString(),
  })
}

export async function completeCardioSession(
  id: number,
  values: {
    durationSeconds: number
    distanceMeters: number | null
    effort: number | null
    notes?: string
  },
): Promise<void> {
  const session = await db.cardioSessions.get(id)
  if (!session) throw new Error('Cardio session not found')
  if (session.status !== 'in_progress') throw new Error('Session is not active')

  const now = new Date().toISOString()
  await db.cardioSessions.update(id, {
    status: 'completed',
    completedAt: now,
    durationSeconds: Math.max(0, Math.round(values.durationSeconds)),
    distanceMeters: values.distanceMeters,
    effort: values.effort,
    notes: values.notes,
    updatedAt: now,
  })
}

export async function discardCardioSession(id: number): Promise<void> {
  const session = await db.cardioSessions.get(id)
  if (!session) return
  if (session.status === 'completed') {
    throw new Error('Cannot discard a completed session')
  }
  await db.cardioSessions.update(id, {
    status: 'discarded',
    updatedAt: new Date().toISOString(),
  })
}

export async function logCompletedCardioSession(input: {
  activityTypeId: number
  durationSeconds: number
  distanceMeters: number | null
  effort: number | null
  notes?: string
  startedAt?: string
}): Promise<number> {
  const activity = await db.cardioActivityTypes.get(input.activityTypeId)
  if (!activity || activity.archived) throw new Error('Activity type not found')

  const completedAt = new Date().toISOString()
  const startedAt =
    input.startedAt ??
    new Date(Date.now() - Math.max(0, input.durationSeconds) * 1000).toISOString()

  const id = await db.cardioSessions.add({
    activityTypeId: activity.id!,
    title: activity.name,
    modality: activity.modality,
    status: 'completed',
    startedAt,
    completedAt,
    durationSeconds: Math.max(0, Math.round(input.durationSeconds)),
    distanceMeters: input.distanceMeters,
    effort: input.effort,
    notes: input.notes,
    createdAt: completedAt,
    updatedAt: completedAt,
  })
  if (id == null) throw new Error('Failed to log cardio session')
  return id
}

export async function saveCardioActivityType(input: {
  id?: number
  name: string
  modality: CardioModality
  defaultEffort: number
  notes?: string
}): Promise<number> {
  const name = input.name.trim()
  if (!name) throw new Error('Name is required')
  const effort = Math.min(10, Math.max(1, Math.round(input.defaultEffort) || 5))
  const now = new Date().toISOString()

  if (input.id != null) {
    await db.cardioActivityTypes.update(input.id, {
      name,
      modality: input.modality,
      defaultEffort: effort,
      notes: input.notes,
      updatedAt: now,
    })
    return input.id
  }

  const id = await db.cardioActivityTypes.add({
    name,
    modality: input.modality,
    defaultEffort: effort,
    notes: input.notes,
    isCustom: true,
    archived: false,
    createdAt: now,
    updatedAt: now,
  })
  if (id == null) throw new Error('Failed to save activity')
  return id
}

export async function archiveCardioActivityType(id: number): Promise<void> {
  await db.cardioActivityTypes.update(id, {
    archived: true,
    updatedAt: new Date().toISOString(),
  })
}

export async function recentCompletedCardio(limit = 5): Promise<CardioSession[]> {
  const rows = await db.cardioSessions
    .where('status')
    .equals('completed')
    .reverse()
    .sortBy('completedAt')
  return rows
    .filter((r) => r.completedAt)
    .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))
    .slice(0, limit)
}
