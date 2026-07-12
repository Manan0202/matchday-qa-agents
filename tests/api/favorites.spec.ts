// API coverage for src/app/api/teams/[id]/favorite/route.ts.
// Companion to specs/GH-003-plan.md scenarios 1-2 (the UI-observed part of
// this contract) — this file goes deeper: full response bodies, auth
// boundary, and a documented real bug (see the last test).
import { test, expect } from '@playwright/test'
import { AuthApi } from '../../api/AuthApi'
import { EventsApi } from '../../api/EventsApi'
import { FavoritesApi } from '../../api/FavoritesApi'
import { generateTestUser } from '../../utils/testUsers'

test.describe('POST /api/teams/:id/favorite', () => {
    test('first call favorites a team; second call un-favorites it (toggle)', async ({ request }) => {
        const auth = new AuthApi(request)
        const events = new EventsApi(request)
        const favorites = new FavoritesApi(request)

        await auth.register(generateTestUser('api.favorite.toggle'))
        const teamId = await events.firstTeamId()

        const first = await favorites.toggle(teamId)
        expect(first.status()).toBe(200)
        expect(await first.json()).toEqual({ favorited: true })

        const second = await favorites.toggle(teamId)
        expect(second.status()).toBe(200)
        expect(await second.json()).toEqual({ favorited: false })
    })

    test('rejects an unauthenticated request with 401', async ({ request }) => {
        const events = new EventsApi(request)
        const favorites = new FavoritesApi(request)
        const teamId = await events.firstTeamId()

        const response = await favorites.toggle(teamId)
        expect(response.status()).toBe(401)
        expect(await response.json()).toEqual({ error: 'Not authenticated' })
    })

    // Documented bug, not a passing "it works" assertion — see
    // specs/rejected/GH-003-unsupported.md's process notes and
    // src/app/api/teams/[id]/favorite/route.ts. Unlike the waitlist route
    // (which checks `prisma.event.findUnique` and returns a clean 404 for a
    // bad id), this route calls `prisma.favorite.create` directly against a
    // non-existent teamId with no existence check first, so it throws an
    // unhandled Prisma foreign-key error that surfaces as a raw 500. This
    // test pins the *current* behavior so a future fix is visible as an
    // intentional, reviewed test change — not a silent regression either way.
    test('a nonexistent team id currently 500s instead of 404ing (known bug)', async ({ request }) => {
        const auth = new AuthApi(request)
        const favorites = new FavoritesApi(request)
        await auth.register(generateTestUser('api.favorite.badid'))
        const response = await favorites.toggle('this-team-does-not-exist')
        expect(response.status()).toBe(500)
    })
})
