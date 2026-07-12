import { test, expect } from '@playwright/test'
import { EventsApi } from '../../api/EventsApi'

// Companion to tests/smoke/GH-000-webserver-check.spec.ts, but for the
// 'api' project: proves the request-only layer is wired to the same dev
// server (no browser needed) before any feature-specific API spec runs.
test('MatchDay API responds with the seeded events list', async ({ request }) => {
    const events = new EventsApi(request)
    const response = await events.list()
    expect(response.ok()).toBe(true)
    const list = await response.json()
    expect(Array.isArray(list)).toBe(true)
    expect(list.length).toBeGreaterThan(0)
})
