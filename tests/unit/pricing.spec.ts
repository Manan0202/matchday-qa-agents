// Implements: unit coverage for utils/pricing.ts, the oracle used by both
// tests/api and tests/smoke|regression specs to independently verify
// MatchDay's server-side pricing (src/lib/pricing.ts). No browser, no
// server — pure function, runs in milliseconds.
import { test, expect } from '@playwright/test'
import { calculateExpectedPricing, GROUP_DISCOUNT_MIN_SEATS, GROUP_DISCOUNT_RATE } from '../../utils/pricing'

test.describe('calculateExpectedPricing', () => {
    test('single seat has no discount', () => {
        const result = calculateExpectedPricing([120])
        expect(result).toEqual({
            seatCount: 1,
            subtotal: 120,
            discountApplied: false,
            discountAmount: 0,
            total: 120,
        })
    })

    test('below the group-discount threshold applies no discount', () => {
        const result = calculateExpectedPricing([120, 120, 45])
        expect(result.seatCount).toBe(GROUP_DISCOUNT_MIN_SEATS - 1)
        expect(result.discountApplied).toBe(false)
        expect(result.discountAmount).toBe(0)
        expect(result.total).toBe(285)
    })

    test('exactly at the group-discount threshold applies 10% off', () => {
        const result = calculateExpectedPricing([45, 45, 45, 45])
        expect(result.subtotal).toBe(180)
        expect(result.discountApplied).toBe(true)
        expect(result.discountAmount).toBeCloseTo(180 * GROUP_DISCOUNT_RATE, 5)
        expect(result.total).toBe(162)
    })

    test('above the threshold still applies the flat 10% rate', () => {
        const result = calculateExpectedPricing([120, 120, 120, 120, 120, 120])
        expect(result.seatCount).toBe(6)
        expect(result.subtotal).toBe(720)
        expect(result.discountApplied).toBe(true)
        expect(result.discountAmount).toBe(72)
        expect(result.total).toBe(648)
    })

    test('handles fractional seat prices without floating-point drift', () => {
        const result = calculateExpectedPricing([33.33, 33.33, 33.33, 33.33])
        expect(result.subtotal).toBe(133.32)
        expect(result.discountAmount).toBe(13.33)
        expect(result.total).toBe(119.99)
    })

    test('empty selection totals to zero with no discount', () => {
        const result = calculateExpectedPricing([])
        expect(result).toEqual({
            seatCount: 0,
            subtotal: 0,
            discountApplied: false,
            discountAmount: 0,
            total: 0,
        })
    })
})
