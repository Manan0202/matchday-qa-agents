// API coverage for src/app/api/auth/{register,login,logout}/route.ts and
// src/app/api/me/route.ts. Every status code and error body here was
// verified against the live route handlers, not guessed from the
// requirement — see specs/GH-001-plan.md for the UI-level counterpart.
import { test, expect } from '@playwright/test'
import { AuthApi } from '../../api/AuthApi'
import { generateTestUser } from '../../utils/testUsers'
import { SEEDED_FAN } from '../../test-data/seededAccounts'

test.describe('POST /api/auth/register', () => {
    test('registers a new account and starts an authenticated session', async ({ request }) => {
        const auth = new AuthApi(request)
        const user = generateTestUser('api.register')
        const response = await auth.register(user)
        expect(response.status()).toBe(200)
        const body = await response.json()
        expect(body).toMatchObject({ email: user.email, name: user.name, role: 'USER' })
        expect(body.id).toBeTruthy()

        // The register response itself sets the session cookie — confirm it
        // actually authenticated the caller, not just created a DB row.
        const me = await auth.me()
        expect(me.status()).toBe(200)
        expect((await me.json()).email).toBe(user.email)
    })

    test('rejects a duplicate email with 409', async ({ request }) => {
        const auth = new AuthApi(request)
        const response = await auth.register({
            name: 'Duplicate',
            email: SEEDED_FAN.email,
            password: 'whatever123',
        })
        expect(response.status()).toBe(409)
        expect(await response.json()).toEqual({
            error: 'An account with this email already exists',
        })
    })

    test('rejects a missing required field with 400', async ({ request }) => {
        const auth = new AuthApi(request)
        const response = await auth.register({
            name: 'No Password',
            email: `no-password.${Date.now()}@example.com`,
            password: '',
        })
        expect(response.status()).toBe(400)
        expect((await response.json()).error).toMatch(/required/i)
    })
})

test.describe('POST /api/auth/login', () => {
    test('logs in with valid seeded credentials', async ({ request }) => {
        const auth = new AuthApi(request)
        const response = await auth.login({ email: SEEDED_FAN.email, password: SEEDED_FAN.password })
        expect(response.status()).toBe(200)
        expect((await response.json()).email).toBe(SEEDED_FAN.email)
    })

    test('rejects the wrong password with 401 and a generic error', async ({ request }) => {
        const auth = new AuthApi(request)
        const response = await auth.login({
            email: SEEDED_FAN.email,
            password: 'definitely-not-the-password',
        })
        expect(response.status()).toBe(401)
        // Deliberately generic ("Invalid email or password") rather than
        // "wrong password" — worth asserting explicitly so this doesn't
        // regress into a user-enumeration leak.
        expect(await response.json()).toEqual({ error: 'Invalid email or password' })
    })

    test('rejects an unknown email with the same generic 401', async ({ request }) => {
        const auth = new AuthApi(request)
        const response = await auth.login({
            email: `nobody.${Date.now()}@example.com`,
            password: 'whatever123',
        })
        expect(response.status()).toBe(401)
        expect(await response.json()).toEqual({ error: 'Invalid email or password' })
    })

    test('rejects a missing password field with 400', async ({ request }) => {
        const response = await request.post('/api/auth/login', { data: { email: SEEDED_FAN.email } })
        expect(response.status()).toBe(400)
    })
})

test.describe('POST /api/auth/logout and GET /api/me', () => {
    test('GET /api/me is 401 for an anonymous caller', async ({ request }) => {
        const auth = new AuthApi(request)
        const response = await auth.me()
        expect(response.status()).toBe(401)
        expect(await response.json()).toEqual({ error: 'Not authenticated' })
    })

    test('logout clears the session — /api/me is 401 again afterward', async ({ request }) => {
        const auth = new AuthApi(request)
        await auth.login({ email: SEEDED_FAN.email, password: SEEDED_FAN.password })
        expect((await auth.me()).status()).toBe(200)

        const logoutResponse = await auth.logout()
        expect(logoutResponse.status()).toBe(200)
        expect(await logoutResponse.json()).toEqual({ ok: true })

        expect((await auth.me()).status()).toBe(401)
    })
})
