import { describe, expect, it } from 'vitest'
import { getLargestPurchaseUnit, getPurchaseUnitPrice } from '@/lib/normalize'

describe('purchase unit defaults', () => {
  it('chooses the unit with the largest base-unit conversion', () => {
    const largest = getLargestPurchaseUnit([
      { code: 'PCS', contains: 1 },
      { code: 'DUS', contains: 12 },
      { code: 'KARTON', contains: 48 },
    ], 'PCS')

    expect(largest.code).toBe('KARTON')
  })

  it('falls back to the base unit when pack sizes are unavailable', () => {
    expect(getLargestPurchaseUnit(undefined, 'BOTOL')).toEqual({ code: 'BOTOL', contains: 1 })
  })

  it('uses configured unit cost or derives it from base cost and conversion', () => {
    expect(getPurchaseUnitPrice(2000, { code: 'DUS', contains: 12 })).toBe(24000)
    expect(getPurchaseUnitPrice(2000, { code: 'DUS', contains: 12, modal: 25000 })).toBe(25000)
  })
})