// API coverage for src/app/api/events/route.ts and
// src/app/api/events/[id]/route.ts.
import { test, expect } from '@playwright/test'
import { EventsApi } from '../../api/EventsApi'

test.describe('GET /api/events', () => {
    test('returns the seeded events as an array with computed availability', async ({ request }) => {
        const events = new EventsApi(request)
        const response = await events.list()
        expect(response.status()).toBe(200)
        const list = await response.json()
        expect(Array.isArray(list)).toBe(true)
        expect(list.length).toBeGreaterThan(0)

        // Every event carries the server-computed availability fields
        // (not stored directly on the Event row) — assert the shape and
        // internal consistency of at least one, rather than just "it's an array".
        const sample = list[0]
        expect(sample).toHaveProperty('id')
        expect(sample).toHaveProperty('totalSeats')
        expect(sample).toHaveProperty('availableSeats')
        expect(sample).toHaveProperty('soldOut')
        expect(sample.availableSeats).toBeLessThanOrEqual(sample.totalSeats)
        expect(sample.soldOut).toBe(sample.availableSeats === 0)
    })

    test('filters by sport slug', async ({ request }) => {
        const events = new EventsApi(request)
        const response = await events.list('sport=football')
        expect(response.status()).toBe(200)
        const list = await response.json()
        expect(list.length).toBeGreaterThan(0)
        for (const event of list) {
            expect(event.sport.slug).toBe('football')
        }
    })

    test('an unknown sport slug returns an empty array, not an error', async ({ request }) => {
        const events = new EventsApi(request)
        const response = await events.list('sport=curling-does-not-exist')
        expect(response.status()).toBe(200)
        expect(await response.json()).toEqual([])
    })
})

test.describe('GET /api/events/:id', () => {
    test('returns full event detail including nested sections and seats', async ({ request }) => {
        const events = new EventsApi(request)
        const list = await (await events.list()).json()
        const target = list[0]

        const response = await events.get(target.id)
        expect(response.status()).toBe(200)
        const event = await response.json()
        expect(event.id).toBe(target.id)
        expect(Array.isArray(event.sections)).toBe(true)
        expect(event.sections.length).toBeGreaterThan(0)
        for (const section of event.sections) {
            expect(section).toHaveProperty('price')
            expect(Array.isArray(section.seats)).toBe(true)
            for (const seat of section.seats) {
                expect(['AVAILABLE', 'SOLD']).toContain(seat.status)
            }
        }
    })

    test('an unknown event id returns 404 with a clean error body', async ({ request }) => {
        const events = new EventsApi(request)
        const response = await events.get('this-event-does-not-exist')
        expect(response.status()).toBe(404)
        expect(await response.json()).toEqual({ error: 'Event not found' })
    })
})
