import { test as base, expect } from '@playwright/test'

// Extend here as real fixtures are needed (e.g. an authenticated session,
// a seeded event) — the Generator agent should reuse/extend this file
// rather than each spec rolling its own setup.
export const test = base
export { expect }
