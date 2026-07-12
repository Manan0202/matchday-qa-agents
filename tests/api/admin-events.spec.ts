// API coverage for src/app/api/admin/events/{route,[id]/route}.ts.
// All three methods (POST create, PUT update-status, DELETE) are
// admin-gated. This is the only route in the app that uses PUT.
import { APIRequestContext, test, expect, request as apiRequestFactory } from '@playwright/test'
import { AdminEventsApi } from '../../api/AdminEventsApi'
import { AuthApi } from '../../api/AuthApi'
import { EventsApi } from '../../api/EventsApi'
import { buildValidEventPayload } from '../../api/EventFactory'
import { SEEDED_ADMIN, SEEDED_FAN } from '../../test-data/seededAccounts'

// Create/update/delete tests mutate shared DB state; serialize for determinism.
test.describe.configure({ mode: 'serial' })

async function adminContext(): Promise<APIRequestContext> {
    const ctx = await apiRequestFactory.newContext()
    await new AuthApi(ctx).login({ email: SEEDED_ADMIN.email, password: SEEDED_ADMIN.password })
    return ctx
}

// This file only needs the raw payload (it's asserting on the create/update/
// delete contract itself, not on UI labels) — api/EventFactory.ts also
// returns matchLabel/venueName/sectionName for UI tests that need to find
// the event on screen; see tests/regression/full-booking-journey.spec.ts.
async function validEventPayload(request: APIRequestContext) {
    return (await buildValidEventPayload(request)).payload
}

test.describe('POST /api/admin/events', () => {
    test('an admin creates an event with seats generated per section — full lifecycle through delete', async ({
        request,
    }) => {
        const ctx = await adminContext()
        try {
            const adminEvents = new AdminEventsApi(ctx)
            const payload = await validEventPayload(request)

            const createResponse = await adminEvents.create(payload)
            expect(createResponse.status()).toBe(201)
            const created = await createResponse.json()
            expect(created).toMatchObject({
                league: payload.league,
                homeTeamId: payload.homeTeamId,
                awayTeamId: payload.awayTeamId,
                venueId: payload.venueId,
                status: 'UPCOMING', // default when not specified
            })

            // Lifecycle: the new event is visible via the public detail route,
            // with real seats generated for every section (rows * seatsPerRow).
            const events = new EventsApi(request)
            const detail = await (await events.get(created.id)).json()
            expect(detail.sections).toHaveLength(payload.sectionPrices.length)
            for (const section of detail.sections) {
                expect(section.seats.length).toBeGreaterThan(0)
                expect(section.seats.every((s: { status: string }) => s.status === 'AVAILABLE')).toBe(true)
            }

            const deleteResponse = await adminEvents.delete(created.id)
            expect(deleteResponse.status()).toBe(200)
            expect(await deleteResponse.json()).toEqual({ ok: true })

            const afterDelete = await events.get(created.id)
            expect(afterDelete.status()).toBe(404)
        } finally {
            await ctx.dispose()
        }
    })

    test('rejects homeTeamId === awayTeamId with 400', async ({ request }) => {
        const ctx = await adminContext()
        try {
            const adminEvents = new AdminEventsApi(ctx)
            const payload = await validEventPayload(request)
            const response = await adminEvents.create({ ...payload, awayTeamId: payload.homeTeamId })
            expect(response.status()).toBe(400)
            expect((await response.json()).error).toMatch(/must be different/i)
        } finally {
            await ctx.dispose()
        }
    })

    test('rejects a section id that does not belong to the given venue with 400', async ({ request }) => {
        const ctx = await adminContext()
        try {
            const adminEvents = new AdminEventsApi(ctx)
            const payload = await validEventPayload(request)
            const response = await adminEvents.create({
                ...payload,
                sectionPrices: [{ sectionId: 'this-section-does-not-belong-here', price: 50 }],
            })
            expect(response.status()).toBe(400)
            expect((await response.json()).error).toMatch(/do not belong to this venue/i)
        } finally {
            await ctx.dispose()
        }
    })

    test('rejects a missing required field with 400', async ({ request }) => {
        const ctx = await adminContext()
        try {
            const adminEvents = new AdminEventsApi(ctx)
            const payload = await validEventPayload(request)
            const response = await adminEvents.create({ ...payload, league: '' })
            expect(response.status()).toBe(400)
        } finally {
            await ctx.dispose()
        }
    })

    test('rejects a non-admin (fan) caller with 403', async ({ request }) => {
        const auth = new AuthApi(request)
        const adminEvents = new AdminEventsApi(request)
        const payload = await validEventPayload(request)
        await auth.login({ email: SEEDED_FAN.email, password: SEEDED_FAN.password })
        const response = await adminEvents.create(payload)
        expect(response.status()).toBe(403)
        expect(await response.json()).toEqual({ error: 'Admin access required' })
    })

    test('rejects an anonymous caller with 403', async ({ request }) => {
        const adminEvents = new AdminEventsApi(request)
        const payload = await validEventPayload(request)
        const response = await adminEvents.create(payload)
        expect(response.status()).toBe(403)
    })
})

test.describe('PUT /api/admin/events/:id', () => {
    test('an admin updates event status, visible immediately via the public detail route', async ({
        request,
    }) => {
        const ctx = await adminContext()
        try {
            const adminEvents = new AdminEventsApi(ctx)
            const payload = await validEventPayload(request)
            const created = await (await adminEvents.create(payload)).json()

            const updateResponse = await adminEvents.updateStatus(created.id, 'CANCELLED')
            expect(updateResponse.status()).toBe(200)
            expect((await updateResponse.json()).status).toBe('CANCELLED')

            const events = new EventsApi(request)
            const detail = await (await events.get(created.id)).json()
            expect(detail.status).toBe('CANCELLED')

            await adminEvents.delete(created.id) // cleanup
        } finally {
            await ctx.dispose()
        }
    })

    test('rejects a missing status field with 400', async ({ request }) => {
        const ctx = await adminContext()
        try {
            const adminEvents = new AdminEventsApi(ctx)
            const payload = await validEventPayload(request)
            const created = await (await adminEvents.create(payload)).json()

            const response = await ctx.put(`/api/admin/events/${created.id}`, { data: {} })
            expect(response.status()).toBe(400)
            expect((await response.json()).error).toMatch(/status is required/i)

            await adminEvents.delete(created.id) // cleanup
        } finally {
            await ctx.dispose()
        }
    })

    test('rejects a non-admin (fan) caller with 403', async ({ request }) => {
        const auth = new AuthApi(request)
        const adminEvents = new AdminEventsApi(request)
        await auth.login({ email: SEEDED_FAN.email, password: SEEDED_FAN.password })
        const response = await adminEvents.updateStatus('does-not-matter-should-403-first', 'CANCELLED')
        expect(response.status()).toBe(403)
    })

    // Documented current behavior — same systemic gap as
    // tests/api/admin-teams.spec.ts / admin-venues.spec.ts: no existence
    // check before the Prisma update, so a nonexistent id 500s instead of
    // 404ing.
    test('updating a nonexistent event id currently 500s instead of 404ing (known bug)', async () => {
        const ctx = await adminContext()
        try {
            const adminEvents = new AdminEventsApi(ctx)
            const response = await adminEvents.updateStatus('this-event-does-not-exist', 'CANCELLED')
            expect(response.status()).toBe(500)
        } finally {
            await ctx.dispose()
        }
    })
})

test.describe('DELETE /api/admin/events/:id', () => {
    test('rejects a non-admin (fan) caller with 403', async ({ request }) => {
        const auth = new AuthApi(request)
        const adminEvents = new AdminEventsApi(request)
        await auth.login({ email: SEEDED_FAN.email, password: SEEDED_FAN.password })
        const response = await adminEvents.delete('does-not-matter-should-403-first')
        expect(response.status()).toBe(403)
    })

    test('deleting a nonexistent event id currently 500s instead of 404ing (known bug)', async () => {
        const ctx = await adminContext()
        try {
            const adminEvents = new AdminEventsApi(ctx)
            const response = await adminEvents.delete('this-event-does-not-exist')
            expect(response.status()).toBe(500)
        } finally {
            await ctx.dispose()
        }
    })
})
