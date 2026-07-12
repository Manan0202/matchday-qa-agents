// API coverage for src/app/api/admin/teams/{route,[id]/route}.ts.
// GET is public; POST and DELETE are admin-gated.
import { APIRequestContext, test, expect, request as apiRequestFactory } from '@playwright/test'
import { AdminTeamsApi } from '../../api/AdminTeamsApi'
import { AuthApi } from '../../api/AuthApi'
import { EventsApi } from '../../api/EventsApi'
import { SEEDED_ADMIN, SEEDED_FAN } from '../../test-data/seededAccounts'

// Create/delete tests mutate shared DB state; serialize for determinism.
test.describe.configure({ mode: 'serial' })

async function adminContext(): Promise<APIRequestContext> {
    const ctx = await apiRequestFactory.newContext()
    await new AuthApi(ctx).login({ email: SEEDED_ADMIN.email, password: SEEDED_ADMIN.password })
    return ctx
}

async function aRealSportId(request: APIRequestContext): Promise<string> {
    const events = await (await new EventsApi(request).list()).json()
    return events[0].sport.id as string
}

test.describe('GET /api/admin/teams', () => {
    test('is publicly readable, no auth required', async ({ request }) => {
        const teams = new AdminTeamsApi(request)
        const response = await teams.list()
        expect(response.status()).toBe(200)
        const list = await response.json()
        expect(Array.isArray(list)).toBe(true)
        expect(list.length).toBeGreaterThan(0)
        expect(list[0]).toHaveProperty('sportId')
    })
})

test.describe('POST /api/admin/teams', () => {
    test('an admin creates a team — full lifecycle through delete', async () => {
        const ctx = await adminContext()
        try {
            const teams = new AdminTeamsApi(ctx)
            const sportId = await aRealSportId(ctx)
            const name = `QA Test United ${Date.now()}`

            const createResponse = await teams.create({ name, shortName: 'QTU', sportId })
            expect(createResponse.status()).toBe(201)
            const created = await createResponse.json()
            expect(created).toMatchObject({ name, shortName: 'QTU', sportId })

            const listAfterCreate = await (await teams.list()).json()
            expect(listAfterCreate.map((t: { id: string }) => t.id)).toContain(created.id)

            const deleteResponse = await teams.delete(created.id)
            expect(deleteResponse.status()).toBe(200)
            expect(await deleteResponse.json()).toEqual({ ok: true })

            const listAfterDelete = await (await teams.list()).json()
            expect(listAfterDelete.map((t: { id: string }) => t.id)).not.toContain(created.id)
        } finally {
            await ctx.dispose()
        }
    })

    test('rejects a duplicate team name within the same sport with 409', async () => {
        const ctx = await adminContext()
        try {
            const teams = new AdminTeamsApi(ctx)
            const sportId = await aRealSportId(ctx)
            const name = `QA Duplicate Team ${Date.now()}`

            const first = await teams.create({ name, shortName: 'QD1', sportId })
            expect(first.status()).toBe(201)
            const firstBody = await first.json()

            const second = await teams.create({ name, shortName: 'QD2', sportId })
            expect(second.status()).toBe(409)
            expect(await second.json()).toEqual({
                error: 'A team with this name already exists for this sport',
            })

            await teams.delete(firstBody.id) // cleanup
        } finally {
            await ctx.dispose()
        }
    })

    test('rejects a missing required field with 400', async () => {
        const ctx = await adminContext()
        try {
            const teams = new AdminTeamsApi(ctx)
            const response = await teams.create({ name: 'No Sport', shortName: 'NS', sportId: '' })
            expect(response.status()).toBe(400)
        } finally {
            await ctx.dispose()
        }
    })

    test('rejects a non-admin (fan) caller with 403', async ({ request }) => {
        const auth = new AuthApi(request)
        const teams = new AdminTeamsApi(request)
        await auth.login({ email: SEEDED_FAN.email, password: SEEDED_FAN.password })
        const response = await teams.create({ name: 'Should Not Exist', shortName: 'SNE', sportId: 'x' })
        expect(response.status()).toBe(403)
        expect(await response.json()).toEqual({ error: 'Admin access required' })
    })

    test('rejects an anonymous caller with 403', async ({ request }) => {
        const teams = new AdminTeamsApi(request)
        const response = await teams.create({ name: 'Should Not Exist', shortName: 'SNE', sportId: 'x' })
        expect(response.status()).toBe(403)
    })
})

test.describe('DELETE /api/admin/teams/:id', () => {
    test('rejects a non-admin (fan) caller with 403', async ({ request }) => {
        const auth = new AuthApi(request)
        const teams = new AdminTeamsApi(request)
        await auth.login({ email: SEEDED_FAN.email, password: SEEDED_FAN.password })
        const response = await teams.delete('does-not-matter-should-403-first')
        expect(response.status()).toBe(403)
    })

    // Documented current behavior — see the same pattern in
    // tests/api/admin-venues.spec.ts. No existence check before delete.
    test('deleting a nonexistent team id currently 500s instead of 404ing (known bug)', async () => {
        const ctx = await adminContext()
        try {
            const teams = new AdminTeamsApi(ctx)
            const response = await teams.delete('this-team-does-not-exist')
            expect(response.status()).toBe(500)
        } finally {
            await ctx.dispose()
        }
    })

    // A stronger version of the same gap: deleting a team that's still
    // referenced by real events hits a foreign-key constraint at the DB
    // level (not just a missing-row lookup), and that's just as unhandled.
    // A correct implementation would reject this with a clean 409
    // ("team has scheduled events") rather than crash.
    test('deleting a team still referenced by an event currently 500s instead of a clean conflict (known bug)', async ({
        request,
    }) => {
        const ctx = await adminContext()
        try {
            const events = new EventsApi(request)
            const list = await (await events.list()).json()
            const referencedTeamId = list[0].homeTeam.id as string

            const teams = new AdminTeamsApi(ctx)
            const response = await teams.delete(referencedTeamId)
            expect(response.status()).toBe(500)
        } finally {
            await ctx.dispose()
        }
    })
})
