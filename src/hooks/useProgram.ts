import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'

export function useActiveProgram() {
  return useLiveQuery(async () => db.programs.filter((p) => p.isActive).first())
}

export function useProgramWeeks(programId?: number) {
  return useLiveQuery(
    async () => {
      if (!programId) return []
      return db.programWeeks.where('programId').equals(programId).sortBy('weekNumber')
    },
    [programId],
  )
}

export function useTemplates() {
  return useLiveQuery(async () => db.workoutTemplates.orderBy('dayIndex').toArray())
}

export function useScheduled(programId?: number) {
  return useLiveQuery(
    async () => {
      if (!programId) return []
      return db.scheduledWorkouts.where('programId').equals(programId).sortBy('plannedDate')
    },
    [programId],
  )
}
