import { describe, expect, it } from 'vitest'
import { convertDisplayBetween, toDisplayWeight, toStorageWeight } from './units'

describe('unit conversion', () => {
  it('stores and displays without corrupting round-trips', () => {
    const lb = 135
    const asKg = toDisplayWeight(lb, 'kg')
    const back = toStorageWeight(asKg, 'kg')
    expect(Math.abs(back - lb)).toBeLessThan(0.0001)
  })

  it('does not alter lb display', () => {
    expect(toDisplayWeight(100, 'lb')).toBe(100)
  })

  it('converts between display units', () => {
    const kg = convertDisplayBetween(100, 'lb', 'kg')
    const lb = convertDisplayBetween(kg, 'kg', 'lb')
    expect(Math.abs(lb - 100)).toBeLessThan(0.0001)
  })
})
