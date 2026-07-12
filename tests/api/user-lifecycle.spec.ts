// A full account lifecycle: register -> login (register itself starts the
// session, so a separate login call isn't needed to prove auth works) ->
// validate a few real scenarios -> logout. Account *deletion* is
// deliberately out of scope: MatchDay has no delete-user endpoint anywhere
// (checked every route under src/app/api/, including admin) — see the
// afterEach comment below for what a real teardown can and can't do here.
import { APIRequestContext, test, expect } from '@playwright/test'
import { AuthApi } from '../../api/AuthApi'
import { EventsApi } from '../../api/EventsApi'
import { FavoritesApi } from '../../api/FavoritesApi'
import { generateTestUser, TestUser } from '../../utils/testUsers'

let auth: AuthApi
let events: EventsApi
let favorites: FavoritesApi
let user: TestUser
let favoritedTeamId: string | undefined // tracked so afterEach can undo it

test.beforeEach(async ({ request }) => {
    auth = new AuthApi(request)
    events = new EventsApi(request)
    favorites = new FavoritesApi(request)
    favoritedTeamId = undefined

    user = generateTestUser('api.lifecycle')
    const response = await auth.register(user)
    expect(response.status()).toBe(200) // fail fast if setup itself is broken
})

test.afterEach(async ({}, testInfo) => {
    // What we CAN clean up: favoriting is the only reversible write in
    // MatchDay's whole API (POST .../favorite toggles). If a test favorited
    // a team, un-favorite it so this account doesn't leave dangling
    // Favorite rows behind.
    if (favoritedTeamId) {
        await favorites.toggle(favoritedTeamId)
    }

    // What we CANNOT clean up: the User row itself has no delete endpoint,
    // and any Booking/WaitlistEntry created has no cancel/leave endpoint
    // either — see the file header. This suite avoids booking seats or
    // joining waitlists specifically so it doesn't accumulate irreversible
    // data beyond one harmless dangling User+Favorite-history row per run.

    if (testInfo.status !== testInfo.expectedStatus) {
        // Diagnostics on failure: capture the account's final observable
        // state to make a failed run easier to debug without re-running it.
        const me = await auth.me()
        console.log(
            `[user-lifecycle] test failed for ${user.email} — final /api/me status: ${me.status()}`
        )
    }
})

test('a freshly registered session is authenticated and can browse events', async () => {
    const me = await auth.me()
    expect(me.status()).toBe(200)
    const body = await me.json()
    expect(body).toMatchObject({ email: user.email, name: user.name, role: 'USER' })

    const eventsResponse = await events.list()
    expect(eventsResponse.status()).toBe(200)
    const list = await eventsResponse.json()
    expect(list.length).toBeGreaterThan(0)
})

test('can favorite a team and see the toggle take effect', async () => {
    const teamId = await events.firstTeamId()
    favoritedTeamId = teamId // afterEach will toggle it back off

    const response = await favorites.toggle(teamId)
    expect(response.status()).toBe(200)
    expect(await response.json()).toEqual({ favorited: true })
})

test('logging out clears the session', async () => {
    const logoutResponse = await auth.logout()
    expect(logoutResponse.status()).toBe(200)

    const me = await auth.me()
    expect(me.status()).toBe(401)
    expect(await me.json()).toEqual({ error: 'Not authenticated' })
})
