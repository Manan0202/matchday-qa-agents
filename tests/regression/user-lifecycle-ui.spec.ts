// Full UI user lifecycle: create a user -> log in via the real UI login
// form -> validate via a real ticket booking (UI assertions at each step)
// -> log out via the UI -> afterEach cleans up what's actually cleanable.
//
// Distinct from the two related specs already in this repo:
// - tests/api/user-lifecycle.spec.ts: the same idea, but request-only —
//   no browser, no UI assertions.
// - tests/regression/full-booking-journey.spec.ts: also a UI booking
//   journey, but its beforeEach delegates auth entirely to fixtures/
//   authFixture.ts's `loggedInPage` fixture (register-and-auto-login,
//   hidden outside the spec file).
// This file keeps setup/teardown fully explicit as test.beforeEach/
// afterEach *in the spec itself*, and exercises the actual /login form
// with a pre-created account rather than register-and-auto-login.
import { APIRequestContext, request as apiRequestFactory, test, expect } from '@playwright/test'
import { AdminEventsApi } from '../../api/AdminEventsApi'
import { AuthApi } from '../../api/AuthApi'
import { createFreshEvent, FreshEvent } from '../../api/EventFactory'
import { AuthPage } from '../../pages/AuthPage'
import { HomePage } from '../../pages/HomePage'
import { EventPage } from '../../pages/EventPage'
import { CheckoutPage } from '../../pages/CheckoutPage'
import { BookingsPage } from '../../pages/BookingsPage'
import { calculateExpectedPricing } from '../../utils/pricing'
import { formatUsd } from '../../utils/currency'
import { generateTestUser, TestUser } from '../../utils/testUsers'
import { SEEDED_ADMIN } from '../../test-data/seededAccounts'

let adminCtx: APIRequestContext
let event: FreshEvent
let user: TestUser

test.beforeEach(async ({ page }) => {
    // 1. Create a new user. Via the API, deliberately — this test is about
    // proving *login* and *booking* work, not registration (that's
    // GH-001 scenario 5's job), so setup should be fast and not the thing
    // under test.
    user = generateTestUser('ui.lifecycle')
    const setupCtx = await apiRequestFactory.newContext()
    const setupResponse = await new AuthApi(setupCtx).register(user)
    expect(setupResponse.status()).toBe(200)
    await setupCtx.dispose() // that session isn't the one under test below

    // 2. Create a fresh, dedicated event via the Admin API so this test's
    // booking never contends with any other test's seat inventory (same
    // reasoning as full-booking-journey.spec.ts).
    adminCtx = await apiRequestFactory.newContext()
    await new AuthApi(adminCtx).login({ email: SEEDED_ADMIN.email, password: SEEDED_ADMIN.password })
    event = await createFreshEvent(adminCtx)

    // 3. Log in via the real UI login form with the account from step 1 —
    // the actual thing this test exercises, not a shortcut.
    const auth = new AuthPage(page)
    await auth.gotoLogin()
    await auth.login(user.email, user.password)
    await page.waitForURL('/')
})

test.afterEach(async ({}, testInfo) => {
    // Cleanup #1: delete the fresh event. This cascades away its
    // EventSections/Seats/WaitlistEntries and the BookingSeat join rows for
    // any booking made against it during the test — but NOT the Booking
    // row itself (Booking has no cascade from Event, and MatchDay has no
    // cancel-booking endpoint at all). A single zero-seat Booking row is
    // left behind for this test's user; flagged here rather than silently
    // assumed to be fully cleaned up.
    await new AdminEventsApi(adminCtx).delete(event.id)

    // Cleanup #2: release the admin API context used for setup/teardown.
    await adminCtx.dispose()

    // Cleanup #3: diagnostics on failure — cheap to capture, useful for
    // debugging a failed run without re-running it.
    if (testInfo.status !== testInfo.expectedStatus) {
        console.log(
            `[user-lifecycle-ui] "${testInfo.title}" failed for ${user.email} on event ${event.id} (status: ${testInfo.status})`
        )
    }
})

test('create user, log in via UI, book a ticket, and log out — full lifecycle', async ({ page }) => {
    const auth = new AuthPage(page)
    const home = new HomePage(page)
    const eventPage = new EventPage(page)
    const checkout = new CheckoutPage(page)
    const bookings = new BookingsPage(page)

    await test.step('Logged-in session lands on the home page and can find the fresh event', async () => {
        await expect(auth.logoutButton).toBeVisible()
        await home.goto()
        await expect(home.eventCardByHref(event.id)).toBeVisible()
    })

    await test.step('Section price renders correctly and selecting seats updates the running total', async () => {
        await home.openEventById(event.id)
        await expect(eventPage.sectionPriceText(event.sectionName)).toHaveText(`$${event.pricePerSeat} / seat`)

        await eventPage.selectSeatsInSection(event.sectionName, 2)
        const summary = await eventPage.summaryText()
        const expected = calculateExpectedPricing([event.pricePerSeat, event.pricePerSeat])
        expect(summary).toContain('2 seat(s) selected')
        expect(summary).toContain(formatUsd(expected.total))
    })

    await test.step('Checkout itemizes the seats and confirming lands on My Bookings', async () => {
        await eventPage.proceedToCheckout()
        await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible()
        await checkout.confirmBooking()

        const bookingId = new URL(page.url()).searchParams.get('confirmed')!
        await expect(bookings.confirmedBanner).toBeVisible()
        const expected = calculateExpectedPricing([event.pricePerSeat, event.pricePerSeat])
        await expect(bookings.booking(bookingId)).toContainText(event.matchLabel)
        await expect(bookings.booking(bookingId)).toContainText(formatUsd(expected.total))
    })

    await test.step('Logging out via the UI clears the session', async () => {
        await auth.logout()
        await expect(auth.loginNavLink).toBeVisible()
        await expect(auth.logoutButton).not.toBeVisible()
    })
})
