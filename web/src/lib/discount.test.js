import { describe, expect, it } from 'vitest'
import { calcDiscount } from './discount'
import { rupiah, timeID } from './format'

describe('calcDiscount', () => {
  it('returns 0 when no type/value', () => {
    expect(calcDiscount(50000, '', 0)).toBe(0)
    expect(calcDiscount(50000, 'pct', 0)).toBe(0)
    expect(calcDiscount(50000, 'amt', -5)).toBe(0)
  })

  it('percent discount', () => {
    expect(calcDiscount(60000, 'pct', 10)).toBe(6000)
    expect(calcDiscount(60000, 'pct', 50)).toBe(30000)
  })

  it('percent capped at 100', () => {
    expect(calcDiscount(60000, 'pct', 150)).toBe(60000)
  })

  it('amount discount', () => {
    expect(calcDiscount(60000, 'amt', 5000)).toBe(5000)
  })

  it('amount capped at subtotal', () => {
    expect(calcDiscount(60000, 'amt', 99999)).toBe(60000)
  })
})

describe('rupiah', () => {
  it('formats rupiah', () => {
    expect(rupiah(30000)).toBe('Rp30.000')
    expect(rupiah(0)).toBe('Rp0')
    expect(rupiah(1234567)).toBe('Rp1.234.567')
  })
})

describe('timeID', () => {
  it('returns empty for invalid date', () => {
    expect(timeID('not-a-date')).toBe('')
  })
})
