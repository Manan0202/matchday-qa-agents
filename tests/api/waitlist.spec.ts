// API coverage for src/app/api/events/[id]/waitlist/route.ts.
// Companion to specs/GH-004-plan.md scenarios 2-3 (the UI-observed part of
// this contract) — this file asserts full response bodies and additional
// negative cases the Planner's browser-only tooling couldn't capture.
import { test, expect } from '@playwright/test'
import { AuthApi } from '../../api/AuthApi'
import { EventsApi } from '../../api/EventsApi'
import { WaitlistApi } from '../../api/WaitlistApi'
import { generateTestUser } from '../../utils/testUsers'

test.describe('POST /api/events/:id/waitlist', () => {
    test('joining creates a waitlist entry with 201 and the expected shape', async ({ request }) => {
        const auth = new AuthApi(request)
        const events = new EventsApi(request)
        const waitlist = new WaitlistApi(request)

        await auth.register(generateTestUser('api.waitlist.join'))
        const eventId = await events.findSoldOutEventId()

        const response = await waitlist.join(eventId)
        expect(response.status()).toBe(201)
        const entry = await response.json()
        expect(entry).toMatchObject({ eventId })
        expect(entry.userId).toBeTruthy()
        expect(entry.id).toBeTruthy()
    })

    test('joining twice is idempotent — same entry, no duplicate, no error', async ({ request }) => {
        const auth = new AuthApi(request)
        const events = new EventsApi(request)
        const waitlist = new WaitlistApi(request)

        await auth.register(generateTestUser('api.waitlist.duplicate'))
        const eventId = await events.findSoldOutEventId()

        const first = await (await waitlist.join(eventId)).json()
        const secondResponse = await waitlist.join(eventId)
        expect(secondResponse.status()).toBe(201)
        const second = await secondResponse.json()

        // Prisma upsert on the (eventId, userId) unique constraint — same
        // row both times, not a second insert.
        expect(second.id).toBe(first.id)
    })

    test('rejects an unauthenticated request with 401', async ({ request }) => {
        const events = new EventsApi(request)
        const waitlist = new WaitlistApi(request)
        const eventId = await events.findSoldOutEventId()

        const response = await waitlist.join(eventId)
        expect(response.status()).toBe(401)
        expect(await response.json()).toEqual({ error: 'Not authenticated' })
    })

    test('a nonexistent event id returns a clean 404 (contrast with favorites\' 500 bug)', async ({
        request,
    }) => {
        const auth = new AuthApi(request)
        const waitlist = new WaitlistApi(request)
        await auth.register(generateTestUser('api.waitlist.badid'))
        const response = await waitlist.join('this-event-does-not-exist')
        expect(response.status()).toBe(404)
        expect(await response.json()).toEqual({ error: 'Event not found' })
    })
})
