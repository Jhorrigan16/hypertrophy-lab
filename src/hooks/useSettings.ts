import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import type { UserSettings } from '@/db/types'

export function useSettings(): UserSettings | undefined {
  return useLiveQuery(async () => db.userSettings.toCollection().first())
}

export async function updateSettings(patch: Partial<UserSettings>): Promise<void> {
  const current = await db.userSettings.toCollection().first()
  if (!current?.id) return
  await db.userSettings.update(current.id, {
    ...patch,
    updatedAt: new Date().toISOString(),
  })
}
