// A complete, self-contained E2E journey — register, browse, select seats,
// checkout, confirm, verify on My Bookings — with real UI validation
// (visible text, prices, banners) at every step, not just navigation
// checks. Runs against a FRESH, dedicated event created per test via the
// Admin API, rather than the shared "ARS vs MCI" fixture GH-001 uses — so
// these tests never contend for seat inventory with each other or with
// GH-001, and (unlike GH-001) don't need `mode: 'serial'`.
//
// This file also demonstrates test.beforeEach/afterEach for shared
// setup/teardown, which the rest of this suite does inline per test
// instead — worth having both patterns represented, since a real project
// mixes them depending on whether setup is genuinely per-suite or varies
// per test.
import { APIRequestContext, request as apiRequestFactory } from '@playwright/test'
import { test, expect } from '../../fixtures/authFixture'
import { AdminEventsApi } from '../../api/AdminEventsApi'
import { AuthApi } from '../../api/AuthApi'
import { createFreshEvent, FreshEvent } from '../../api/EventFactory'
import { HomePage } from '../../pages/HomePage'
import { EventPage } from '../../pages/EventPage'
import { CheckoutPage } from '../../pages/CheckoutPage'
import { BookingsPage } from '../../pages/BookingsPage'
import { calculateExpectedPricing } from '../../utils/pricing'
import { formatUsd } from '../../utils/currency'
import { SEEDED_ADMIN } from '../../test-data/seededAccounts'

test.describe('Full booking journey (fresh, isolated event per test)', () => {
    let adminCtx: APIRequestContext
    let event: FreshEvent

    // --- Setup: runs before EVERY test in this file. ---
    test.beforeEach(async () => {
        // API setup: fast and reliable, and it's what makes per-test
        // isolation possible at all — a UI-driven admin flow to create an
        // event would be slower and isn't what's under test here anyway.
        adminCtx = await apiRequestFactory.newContext()
        await new AuthApi(adminCtx).login({ email: SEEDED_ADMIN.email, password: SEEDED_ADMIN.password })
        event = await createFreshEvent(adminCtx)
    })

    // --- Teardown: runs after EVERY test, pass or fail. ---
    test.afterEach(async () => {
        // Proven to actually succeed via tests/api/admin-events.spec.ts's
        // own lifecycle test — unlike venue delete, which has a real
        // cascade bug (see tests/api/admin-venues.spec.ts) and can't be
        // relied on for cleanup the same way.
        await new AdminEventsApi(adminCtx).delete(event.id)
        await adminCtx.dispose()
    })

    test('books 2 seats and sees the correct total end to end, with UI validation at every step', async ({
        page,
        loggedInPage: _user,
    }) => {
        const home = new HomePage(page)
        const eventPage = new EventPage(page)
        const checkout = new CheckoutPage(page)
        const bookings = new BookingsPage(page)

        await test.step('Home page lists the freshly created event', async () => {
            await home.goto()
            // Scoped by id, not by "HOME vs AWAY" text — two events created
            // from the same team pair (plausible when several tests in this
            // file run in parallel) render identical matchup text, so a
            // text-based lookup would be ambiguous. The id-based locator
            // can't collide.
            await expect(home.eventCardByHref(event.id)).toBeVisible()
            await expect(home.eventCardByHref(event.id)).toContainText(event.matchLabel)
        })

        await test.step('Event page renders the real section name and price', async () => {
            await home.openEventById(event.id)
            await expect(page.getByText(event.sectionName)).toBeVisible()
            await expect(eventPage.sectionPriceText(event.sectionName)).toHaveText(
                `$${event.pricePerSeat} / seat`
            )
        })

        await test.step('Selecting 2 seats updates the running total (no discount, under 4 seats)', async () => {
            await eventPage.selectSeatsInSection(event.sectionName, 2)
            const summary = await eventPage.summaryText()
            const expected = calculateExpectedPricing([event.pricePerSeat, event.pricePerSeat])
            expect(summary).toContain('2 seat(s) selected')
            expect(summary).toContain(formatUsd(expected.total))
            expect(expected.discountApplied).toBe(false)
        })

        await test.step('Checkout itemizes both seats at the real price with the correct total', async () => {
            await eventPage.proceedToCheckout()
            await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible()
            const body = await checkout.bodyText()
            // Literal substring count, not a regex — formatUsd() returns a
            // string like "$50.00", and "$" is a regex metacharacter
            // (end-of-string anchor), so passing it straight into `new
            // RegExp(...)` silently never matches anything real.
            const perSeatPriceText = formatUsd(event.pricePerSeat)
            const occurrences = body.split(perSeatPriceText).length - 1
            expect(occurrences).toBeGreaterThanOrEqual(2)
            const expected = calculateExpectedPricing([event.pricePerSeat, event.pricePerSeat])
            expect(body).toContain(formatUsd(expected.total))
        })

        await test.step('Confirming lands on My Bookings with a visible confirmation and the right seats/total', async () => {
            await checkout.confirmBooking()
            const bookingId = new URL(page.url()).searchParams.get('confirmed')!
            await expect(bookings.confirmedBanner).toBeVisible()
            const bookingCard = bookings.booking(bookingId)
            await expect(bookingCard).toBeVisible()
            await expect(bookingCard).toContainText(event.matchLabel)
            const expected = calculateExpectedPricing([event.pricePerSeat, event.pricePerSeat])
            await expect(bookingCard).toContainText(formatUsd(expected.total))
        })
    })

    test('books 4 seats and sees the 10% group discount applied end to end', async ({ page, loggedInPage: _user }) => {
        const home = new HomePage(page)
        const eventPage = new EventPage(page)
        const checkout = new CheckoutPage(page)
        const bookings = new BookingsPage(page)
        const expected = calculateExpectedPricing(new Array(4).fill(event.pricePerSeat))

        await test.step('Select 4 seats and see the discount preview', async () => {
            await home.goto()
            await home.openEventById(event.id)
            await eventPage.selectSeatsInSection(event.sectionName, 4)
            const summary = await eventPage.summaryText()
            expect(summary).toContain('4 seat(s) selected')
            expect(summary).toContain(formatUsd(expected.total))
            expect(summary).toMatch(/10% group discount/)
        })

        await test.step('Checkout breakdown shows subtotal, discount, and discounted total', async () => {
            await eventPage.proceedToCheckout()
            const body = await checkout.bodyText()
            expect(body).toContain(formatUsd(expected.subtotal))
            expect(body).toContain(formatUsd(expected.discountAmount))
            expect(body).toContain(formatUsd(expected.total))
        })

        await test.step('My Bookings shows the discounted total, not the pre-discount subtotal', async () => {
            await checkout.confirmBooking()
            const bookingId = new URL(page.url()).searchParams.get('confirmed')!
            const bookingCard = bookings.booking(bookingId)
            await expect(bookingCard).toContainText(formatUsd(expected.total))
            await expect(bookingCard).not.toContainText(formatUsd(expected.subtotal))
        })
    })
})
