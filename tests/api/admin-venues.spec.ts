// API coverage for src/app/api/admin/venues/{route,[id]/route}.ts.
// GET is public; POST and DELETE are admin-gated.
import { APIRequestContext, test, expect, request as apiRequestFactory } from '@playwright/test'
import { AdminVenuesApi } from '../../api/AdminVenuesApi'
import { AuthApi } from '../../api/AuthApi'
import { SEEDED_ADMIN, SEEDED_FAN } from '../../test-data/seededAccounts'

// Every test that creates/deletes a real venue row mutates shared DB state;
// serialize so parallel workers don't race the same happy-path assertions.
test.describe.configure({ mode: 'serial' })

async function adminContext(): Promise<APIRequestContext> {
    const ctx = await apiRequestFactory.newContext()
    await new AuthApi(ctx).login({ email: SEEDED_ADMIN.email, password: SEEDED_ADMIN.password })
    return ctx
}

test.describe('GET /api/admin/venues', () => {
    test('is publicly readable, no auth required', async ({ request }) => {
        const venues = new AdminVenuesApi(request)
        const response = await venues.list()
        expect(response.status()).toBe(200)
        const list = await response.json()
        expect(Array.isArray(list)).toBe(true)
        expect(list.length).toBeGreaterThan(0)
        expect(Array.isArray(list[0].sections)).toBe(true)
    })
})

test.describe('POST /api/admin/venues', () => {
    test('an admin creates a venue with sections, visible via the public list', async () => {
        const ctx = await adminContext()
        try {
            const venues = new AdminVenuesApi(ctx)
            const name = `QA Test Arena ${Date.now()}`
            const createResponse = await venues.create({
                name,
                city: 'Test City',
                capacity: 500,
                sections: [
                    { name: 'Main Stand', rows: 5, seatsPerRow: 10 },
                    { name: 'Away End', rows: 2, seatsPerRow: 10 },
                ],
            })
            expect(createResponse.status()).toBe(201)
            const created = await createResponse.json()
            expect(created).toMatchObject({ name, city: 'Test City', capacity: 500 })
            expect(created.sections).toHaveLength(2)

            const listAfterCreate = await (await venues.list()).json()
            expect(listAfterCreate.map((v: { id: string }) => v.id)).toContain(created.id)

            // Not deleted here — see the DELETE describe block below.
            // `venue.delete({ where: { id } })` has no cascade for its
            // Section rows, so deleting *any* venue with sections (i.e.
            // every venue this route can create, since creation requires
            // at least one) hits a foreign-key constraint and 500s. This
            // is a core-functionality bug, not an edge case, and it means
            // venues created by this suite currently cannot be cleaned up
            // via the API — a real operational cost of the bug, worth
            // surfacing to whoever owns this route.
        } finally {
            await ctx.dispose()
        }
    })

    test('rejects a missing required field with 400', async () => {
        const ctx = await adminContext()
        try {
            const venues = new AdminVenuesApi(ctx)
            const response = await venues.create({
                name: 'Incomplete Venue',
                city: '',
                capacity: 100,
                sections: [{ name: 'Only Stand', rows: 1, seatsPerRow: 10 }],
            })
            expect(response.status()).toBe(400)
        } finally {
            await ctx.dispose()
        }
    })

    test('rejects duplicate section names within the same payload with 400', async () => {
        const ctx = await adminContext()
        try {
            const venues = new AdminVenuesApi(ctx)
            const response = await venues.create({
                name: `Duplicate Section Venue ${Date.now()}`,
                city: 'Test City',
                capacity: 100,
                sections: [
                    { name: 'Same Name', rows: 1, seatsPerRow: 10 },
                    { name: 'Same Name', rows: 1, seatsPerRow: 10 },
                ],
            })
            expect(response.status()).toBe(400)
            expect((await response.json()).error).toMatch(/must be unique/i)
        } finally {
            await ctx.dispose()
        }
    })

    test('rejects a non-admin (fan) caller with 403', async ({ request }) => {
        const auth = new AuthApi(request)
        const venues = new AdminVenuesApi(request)
        await auth.login({ email: SEEDED_FAN.email, password: SEEDED_FAN.password })
        const response = await venues.create({
            name: 'Should Not Be Created',
            city: 'Nowhere',
            capacity: 1,
            sections: [{ name: 'N/A', rows: 1, seatsPerRow: 1 }],
        })
        expect(response.status()).toBe(403)
        expect(await response.json()).toEqual({ error: 'Admin access required' })
    })

    test('rejects an anonymous caller with 403', async ({ request }) => {
        const venues = new AdminVenuesApi(request)
        const response = await venues.create({
            name: 'Should Not Be Created',
            city: 'Nowhere',
            capacity: 1,
            sections: [{ name: 'N/A', rows: 1, seatsPerRow: 1 }],
        })
        expect(response.status()).toBe(403)
    })
})

test.describe('DELETE /api/admin/venues/:id', () => {
    test('rejects a non-admin (fan) caller with 403', async ({ request }) => {
        const auth = new AuthApi(request)
        const venues = new AdminVenuesApi(request)
        await auth.login({ email: SEEDED_FAN.email, password: SEEDED_FAN.password })
        const response = await venues.delete('does-not-matter-should-403-first')
        expect(response.status()).toBe(403)
    })

    // Documented current behavior, not a passing "it works" assertion — see
    // the same not-found pattern in tests/api/favorites.spec.ts and
    // tests/api/admin-teams.spec.ts / admin-events.spec.ts: no existence
    // check before Prisma's delete, so a nonexistent id throws an
    // unhandled P2025 ("record not found") that surfaces as a raw 500
    // instead of a clean 404.
    test('deleting a nonexistent venue id currently 500s instead of 404ing (known bug)', async () => {
        const ctx = await adminContext()
        try {
            const venues = new AdminVenuesApi(ctx)
            const response = await venues.delete('this-venue-does-not-exist')
            expect(response.status()).toBe(500)
        } finally {
            await ctx.dispose()
        }
    })

    // The more severe finding: this isn't limited to bad ids. Reproduced
    // directly with curl outside this suite too, to rule out a test-order
    // artifact. `prisma.venue.delete({ where: { id } })` has no cascade for
    // its Section rows, so deleting *any* real venue with sections — which
    // is every venue this route can create — hits a foreign-key constraint
    // and 500s instead of succeeding. The happy path is broken, not just
    // the edge case.
    test('deleting a venue that has sections currently 500s instead of succeeding (known bug)', async () => {
        const ctx = await adminContext()
        try {
            const venues = new AdminVenuesApi(ctx)
            const created = await (
                await venues.create({
                    name: `QA Delete-Probe Arena ${Date.now()}`,
                    city: 'Test City',
                    capacity: 50,
                    sections: [{ name: 'Only Stand', rows: 1, seatsPerRow: 5 }],
                })
            ).json()

            const response = await venues.delete(created.id)
            expect(response.status()).toBe(500)
        } finally {
            await ctx.dispose()
        }
    })
})
