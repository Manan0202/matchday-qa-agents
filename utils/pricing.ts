// Independent pricing oracle for assertions across all three test layers
// (unit/api/e2e). Deliberately re-derived from the documented business rule
// — 10% off for 4+ seats — rather than imported from MatchDay's own
// src/lib/pricing.ts, so a bug in MatchDay's calculation can't silently
// "pass" a test that's just importing and re-running the same buggy code.
export const GROUP_DISCOUNT_MIN_SEATS = 4
export const GROUP_DISCOUNT_RATE = 0.1

export type PricingBreakdown = {
    seatCount: number
    subtotal: number
    discountApplied: boolean
    discountAmount: number
    total: number
}

export function calculateExpectedPricing(seatPrices: number[]): PricingBreakdown {
    const seatCount = seatPrices.length
    const subtotal = round2(seatPrices.reduce((sum, price) => sum + price, 0))
    const discountApplied = seatCount >= GROUP_DISCOUNT_MIN_SEATS
    const discountAmount = discountApplied ? round2(subtotal * GROUP_DISCOUNT_RATE) : 0
    return {
        seatCount,
        subtotal,
        discountApplied,
        discountAmount,
        total: round2(subtotal - discountAmount),
    }
}

function round2(value: number): number {
    return Math.round(value * 100) / 100
}
