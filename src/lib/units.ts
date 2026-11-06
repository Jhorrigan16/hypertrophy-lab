import type { WeightUnit } from '@/db/types'

/** Canonical storage unit is always pounds (lb). */
export function toDisplayWeight(weightLb: number, unit: WeightUnit): number {
  if (unit === 'kg') return weightLb / 2.2046226218
  return weightLb
}

export function toStorageWeight(displayWeight: number, unit: WeightUnit): number {
  if (unit === 'kg') return displayWeight * 2.2046226218
  return displayWeight
}

export function formatWeight(weightLb: number, unit: WeightUnit, decimals = 1): string {
  const display = toDisplayWeight(weightLb, unit)
  const rounded =
    decimals === 0 ? Math.round(display) : Math.round(display * 10 ** decimals) / 10 ** decimals
  return `${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(decimals)} ${unit}`
}

export function convertDisplayBetween(
  value: number,
  from: WeightUnit,
  to: WeightUnit,
): number {
  if (from === to) return value
  const lb = toStorageWeight(value, from)
  return toDisplayWeight(lb, to)
}
