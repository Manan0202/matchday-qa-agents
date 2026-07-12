// Admin-role counterpart to tests/regression/user-lifecycle-ui.spec.ts —
// same beforeEach/afterEach shape, but a genuinely different role with
// genuinely different permissions, run as a separate file so it executes
// in parallel with the fan-role suite (Playwright's default: different
// spec files already run concurrently across workers; nothing extra is
// needed to make that happen).
//
// One real constraint worth stating up front: unlike the fan flow, this
// test can't "create a new admin" — src/app/api/auth/register/route.ts
// always sets role: 'USER', and there is no self-service or API way to
// promote an account to ADMIN. So this uses the seeded admin account
// (test-data/seededAccounts.ts) rather than a freshly created one — the
// same constraint already documented across tests/api/admin-*.spec.ts.
import { APIRequestContext, request as apiRequestFactory, test, expect } from '@playwright/test'
import { AdminEventsApi } from '../../api/AdminEventsApi'
import { AuthApi } from '../../api/AuthApi'
import { createFreshEvent, FreshEvent } from '../../api/EventFactory'
import { AdminDashboardPage } from '../../pages/AdminDashboardPage'
import { AdminEventsPage } from '../../pages/AdminEventsPage'
import { AuthPage } from '../../pages/AuthPage'
import { generateTestUser } from '../../utils/testUsers'
import { SEEDED_ADMIN } from '../../test-data/seededAccounts'

let adminCtx: APIRequestContext
let event: FreshEvent

test.beforeEach(async ({ page }) => {
    // 1. Create a fresh, dedicated event via the Admin API for this test's
    // own UI actions to manage — isolated from every other test's
    // inventory, same reasoning as full-booking-journey.spec.ts.
    adminCtx = await apiRequestFactory.newContext()
    await new AuthApi(adminCtx).login({ email: SEEDED_ADMIN.email, password: SEEDED_ADMIN.password })
    event = await createFreshEvent(adminCtx)

    // 2. Log in via the real UI login form as the seeded ADMIN account —
    // the actual thing this test exercises, not a shortcut.
    const auth = new AuthPage(page)
    await auth.gotoLogin()
    await auth.login(SEEDED_ADMIN.email, SEEDED_ADMIN.password)
    await page.waitForURL('/')
})

test.afterEach(async ({}, testInfo) => {
    // Cleanup #1: best-effort delete of the fresh event. The test body
    // below deletes it itself via the admin UI as part of what's under
    // test, so by the time this runs it's usually already gone — deleting
    // an already-deleted id currently 500s (documented in
    // tests/api/admin-events.spec.ts as a known bug: no existence check).
    // That's expected here, not a real failure, so it's swallowed —
    // this is cleanup, not an assertion.
    try {
        await new AdminEventsApi(adminCtx).delete(event.id)
    } catch {
        // best-effort; already deleted by the test body in the common case
    }

    // Cleanup #2: release the admin API context used for setup/teardown.
    await adminCtx.dispose()

    // Cleanup #3: diagnostics on failure.
    if (testInfo.status !== testInfo.expectedStatus) {
        console.log(`[admin-lifecycle-ui] "${testInfo.title}" failed (status: ${testInfo.status})`)
    }
})

test('admin sees dashboard stats, manages an event via UI, and has different permissions than a fan', async ({
    page,
    browser,
}) => {
    const auth = new AuthPage(page)
    const dashboard = new AdminDashboardPage(page)
    const adminEvents = new AdminEventsPage(page)

    await test.step('Admin nav link and dashboard headline stats are visible', async () => {
        await expect(auth.adminNavLink).toBeVisible()
        await dashboard.goto()
        await expect(dashboard.heading).toBeVisible()
        for (const label of ['Events', 'Venues', 'Teams', 'Bookings', 'Revenue']) {
            await expect(dashboard.stat(label)).toBeVisible()
        }
    })

    await test.step('A separate fan session has different permissions — blocked from /admin', async () => {
        // Genuinely separate browser context = separate cookie jar, so
        // this proves role-based access control, not just "admin can see
        // admin stuff" in isolation — the same route, two different
        // outcomes, based purely on who's logged in.
        const fanContext = await browser.newContext()
        const fanPage = await fanContext.newPage()
        const fanAuth = new AuthPage(fanPage)
        try {
            await fanAuth.gotoRegister()
            const fan = generateTestUser('ui.admin-lifecycle.fan')
            await fanAuth.register(fan.name, fan.email, fan.password)
            await fanPage.waitForURL('/')

            await expect(fanAuth.adminNavLink).not.toBeVisible()
            await fanPage.goto('/admin')
            await expect(fanPage).toHaveURL(/\/login\?redirectTo=\/admin/)
        } finally {
            await fanContext.close()
        }
    })

    await test.step('Admin changes the event status via the UI and it takes effect', async () => {
        // Deliberately not asserting on the toast text here — MatchDay's
        // toasts auto-dismiss after a hard 3200ms
        // (src/components/Toast.tsx), and under real parallel load that
        // window can elapse before this assertion gets scheduled, which is
        // a flaky test waiting to happen, not a real failure. The select's
        // persisted value below is the durable, retrying, actually
        // meaningful check — the toast was just a transient courtesy
        // message on top of it.
        await adminEvents.goto()
        await expect(adminEvents.row(event.matchLabel, event.league)).toBeVisible()
        await adminEvents.setStatus(event.matchLabel, event.league, 'CANCELLED')
        await expect(adminEvents.statusSelect(event.matchLabel, event.league)).toHaveValue('CANCELLED')
    })

    await test.step('Admin deletes the event via the UI and it disappears from the table', async () => {
        await adminEvents.deleteEvent(event.matchLabel, event.league)
        await expect(adminEvents.row(event.matchLabel, event.league)).not.toBeVisible()
    })

    await test.step('Logging out via the UI clears the session', async () => {
        await auth.logout()
        await expect(auth.loginNavLink).toBeVisible()
        await expect(auth.logoutButton).not.toBeVisible()
    })
})
