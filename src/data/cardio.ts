import type { CardioActivityType, CardioModality } from '@/db/types'

export const SEED_CARDIO_ACTIVITIES: Array<
  Omit<CardioActivityType, 'id' | 'createdAt' | 'updatedAt'>
> = [
  {
    name: 'Easy Run',
    modality: 'run',
    defaultEffort: 4,
    notes: 'Conversational pace',
    isCustom: false,
    archived: false,
  },
  {
    name: 'Intervals',
    modality: 'run',
    defaultEffort: 8,
    notes: 'Hard efforts with recovery',
    isCustom: false,
    archived: false,
  },
  {
    name: 'Zone 2',
    modality: 'run',
    defaultEffort: 5,
    notes: 'Steady aerobic work',
    isCustom: false,
    archived: false,
  },
  {
    name: 'Bike',
    modality: 'bike',
    defaultEffort: 5,
    notes: 'Cycling or spin',
    isCustom: false,
    archived: false,
  },
  {
    name: 'Row',
    modality: 'row',
    defaultEffort: 6,
    notes: 'Erg or open water',
    isCustom: false,
    archived: false,
  },
]

export const CARDIO_MODALITY_LABELS: Record<CardioModality, string> = {
  run: 'Run',
  bike: 'Bike',
  row: 'Row',
  other: 'Other',
}

export const DISTANCE_UNITS = ['mi', 'km'] as const
export type DistanceUnit = (typeof DISTANCE_UNITS)[number]
