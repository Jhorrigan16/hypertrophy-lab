import { db } from '@/db/database'
import type { ReadinessEntry } from '@/db/types'

export function readinessScore(entry: Pick<ReadinessEntry, 'sleep' | 'energy' | 'soreness' | 'motivation' | 'fatigue'>): number {
  // Higher soreness/fatigue lower readiness
  const positive = entry.sleep + entry.energy + entry.motivation
  const negative = entry.soreness + entry.fatigue
  // Scale roughly 1–5
  return Math.round(((positive / 3 + (6 - negative / 2)) / 2) * 10) / 10
}

export function readinessNote(score: number): string | null {
  if (score >= 3.2) return null
  return 'Readiness looks low today. Consider an easier session or extra recovery — this is not medical advice.'
}

export async function saveReadiness(
  entry: Omit<ReadinessEntry, 'id' | 'createdAt'> & { id?: number },
): Promise<number> {
  const existing = await db.readinessEntries.where('date').equals(entry.date).first()
  const payload: ReadinessEntry = {
    ...entry,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  }
  if (existing?.id) {
    await db.readinessEntries.update(existing.id, payload)
    return existing.id
  }
  const id = await db.readinessEntries.add(payload)
  if (id == null) throw new Error('Failed to save readiness')
  return id
}
