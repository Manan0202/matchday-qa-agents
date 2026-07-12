// Uses Playwright's network interception (page.route()) to force backend
// failure conditions the real server won't reliably reproduce on demand,
// and observes how each MatchDay UI component actually reacts. Distinct
// from tests/api/*.spec.ts, which hit the real backend directly for the
// call under test — every mocked route here never reaches the real API at
// all; page.route() intercepts and fulfills the request in the browser.
//
// The "empty body" 500 shape used in the known-bug tests isn't arbitrary —
// it matches what we've observed for real via curl against the live
// server (see tests/api/favorites.spec.ts and
// tests/api/admin-venues.spec.ts: MatchDay's genuine unhandled 500s come
// back with no body at all, not a JSON error object). Mocking that exact
// shape reproduces the same client-side crash deterministically, without
// this suite depending on those specific server bugs staying unfixed.
import { Page } from '@playwright/test'
import { test, expect } from '../../fixtures/authFixture'
import { HomePage } from '../../pages/HomePage'
import { EventPage } from '../../pages/EventPage'
import { CheckoutPage } from '../../pages/CheckoutPage'
import { AuthPage } from '../../pages/AuthPage'
import { TeamPage } from '../../pages/TeamPage'
import { EventsApi } from '../../api/EventsApi'

// Deterministic across reseeds — seed.ts always creates these fixtures.
const BOOKABLE_EVENT_LABEL = 'ARS vs MCI'
const SOLD_OUT_EVENT_LABEL = 'RMA vs BAR'

// Waits for a specific uncaught exception / unhandled promise rejection
// rather than a blind waitForTimeout. Deliberately `pageerror`, not
// `console`: an unhandled rejection from `await res.json()` throwing never
// goes through a `console.*()` call, so `page.on('console')` never sees it
// — `pageerror` is what Playwright fires for uncaught exceptions and
// unhandled rejections specifically.
function waitForPageError(page: Page, pattern: RegExp) {
    return page.waitForEvent('pageerror', {
        predicate: (error) => pattern.test(error.message),
        timeout: 5_000,
    })
}

test.describe('Network interception — booking confirmation failures', () => {
    test('a 500 with a JSON error body is shown to the user without navigating away', async ({
        page,
        loggedInPage: _user,
    }) => {
        const home = new HomePage(page)
        const eventPage = new EventPage(page)
        const checkout = new CheckoutPage(page)

        await home.goto()
        await home.openEvent(BOOKABLE_EVENT_LABEL)
        await eventPage.selectSeats(1)
        await eventPage.proceedToCheckout()

        await page.route('**/api/events/*/bookings', (route) =>
            route.fulfill({
                status: 500,
                contentType: 'application/json',
                body: JSON.stringify({ error: 'Simulated server error' }),
            })
        )

        await checkout.clickConfirmExpectingFailure()

        await expect(checkout.bookingError).toBeVisible()
        await expect(checkout.bookingError).toHaveText('Simulated server error')
        expect(page.url()).toContain('/checkout')
    })

    // Known bug: ConfirmBookingButton's handleConfirm calls
    // `await res.json()` unconditionally, before checking res.ok — see
    // src/components/ConfirmBookingButton.tsx. An empty 500 body throws
    // "Unexpected end of JSON input" as an unhandled rejection, and the
    // user sees no error message at all (no booking-error element, no
    // toast) — the try/finally has no catch. Pinned here so a future fix
    // (checking res.ok first, or wrapping res.json() in try/catch) is a
    // visible, reviewed test change rather than a silent regression.
    test('a 500 with an empty body crashes the confirm handler and shows nothing to the user (known bug)', async ({
        page,
        loggedInPage: _user,
    }) => {
        const home = new HomePage(page)
        const eventPage = new EventPage(page)
        const checkout = new CheckoutPage(page)

        await home.goto()
        await home.openEvent(BOOKABLE_EVENT_LABEL)
        await eventPage.selectSeats(1)
        await eventPage.proceedToCheckout()

        await page.route('**/api/events/*/bookings', (route) => route.fulfill({ status: 500, body: '' }))

        const [pageError] = await Promise.all([
            waitForPageError(page, /Unexpected end of JSON input/),
            checkout.clickConfirmExpectingFailure(),
        ])

        expect(pageError.message).toContain('Unexpected end of JSON input')
        await expect(checkout.bookingError).not.toBeVisible()
        expect(page.url()).toContain('/checkout') // silently stuck, not even redirected
    })
})

test.describe('Network interception — login failures', () => {
    test('a 500 with a JSON error body shows an inline error and does not navigate', async ({ page }) => {
        const auth = new AuthPage(page)
        await auth.gotoLogin()

        await page.route('**/api/auth/login', (route) =>
            route.fulfill({
                status: 500,
                contentType: 'application/json',
                body: JSON.stringify({ error: 'Simulated server error' }),
            })
        )

        await auth.login('anyone@example.com', 'whatever123')

        await expect(page.getByText('Simulated server error')).toBeVisible()
        expect(page.url()).toContain('/login')
    })

    // Same class of bug as the booking-confirmation case above —
    // AuthForm.handleSubmit also calls `await res.json()` unconditionally
    // before checking res.ok (src/components/AuthForm.tsx).
    test('a 500 with an empty body crashes the login handler and shows nothing to the user (known bug)', async ({
        page,
    }) => {
        const auth = new AuthPage(page)
        await auth.gotoLogin()

        await page.route('**/api/auth/login', (route) => route.fulfill({ status: 500, body: '' }))

        const [pageError] = await Promise.all([
            waitForPageError(page, /Unexpected end of JSON input/),
            auth.login('anyone@example.com', 'whatever123'),
        ])

        expect(pageError.message).toContain('Unexpected end of JSON input')
        expect(page.url()).toContain('/login')
    })
})

test.describe('Network interception — follow/favorite failures', () => {
    // Known bug, worse than the two above: FollowButton.handleClick
    // (src/components/FollowButton.tsx) has no res.ok check *and* no
    // try/catch at all — it unconditionally does
    // `const data = await res.json(); setFollowing(data.favorited)`. A
    // logged-in user whose request happens to fail (not just the anonymous
    // case documented in specs/rejected/GH-003-unsupported.md) gets a
    // silent crash with zero feedback: no error toast, no reverted button
    // state, nothing.
    test('a 500 with an empty body crashes the follow handler for a logged-in user (known bug)', async ({
        page,
        request,
    }) => {
        const teamId = await new EventsApi(request).firstTeamId()

        // Log in via the UI so this test matches how a real user reaches
        // the team page authenticated (this repo's convention for E2E:
        // auth flows go through pages/AuthPage.ts, not the API).
        const auth = new AuthPage(page)
        await auth.gotoRegister()
        await auth.register('QA Interception User', `qa.interception.${Date.now()}@example.com`, 'TestPass123!')
        await page.waitForURL('/')

        const team = new TeamPage(page)
        await team.goto(teamId)

        await page.route('**/api/teams/*/favorite', (route) => route.fulfill({ status: 500, body: '' }))

        const [pageError] = await Promise.all([
            waitForPageError(page, /Unexpected end of JSON input/),
            team.followButton.click(),
        ])

        expect(pageError.message).toContain('Unexpected end of JSON input')
        // The button never got a chance to update — still reads "+ Follow",
        // not because the app correctly rejected the action, but because
        // the crash happened before setFollowing() could run either way.
        await expect(team.followButton).toHaveText('+ Follow')
    })
})

test.describe('Network interception — waitlist failures (contrast case: this one is handled correctly)', () => {
    test('a 500 shows a friendly error and does not crash (correct behavior, unlike follow/booking/login above)', async ({
        page,
        loggedInPage: _user,
    }) => {
        // WaitlistButton.handleJoin (src/components/WaitlistButton.tsx)
        // never calls res.json() on the error path at all — it only checks
        // res.status/res.ok — so it can't hit the "Unexpected end of JSON
        // input" crash the other three components can. Worth keeping this
        // contrast case: not every component in this app has the bug, and
        // a test suite that only ever documents failures would miss that.
        const home = new HomePage(page)
        await home.goto()
        await home.openEvent(SOLD_OUT_EVENT_LABEL)

        const eventPage = new EventPage(page)
        const pageErrors: Error[] = []
        page.on('pageerror', (error) => pageErrors.push(error))

        await page.route('**/api/events/*/waitlist', (route) => route.fulfill({ status: 500, body: '' }))

        await eventPage.joinWaitlist()

        // The error text renders in two places at once (an inline
        // paragraph under the button, and a toast) — scope to the inline
        // one specifically rather than an ambiguous page-wide text match.
        await expect(page.getByRole('main').getByText('Something went wrong. Try again.')).toBeVisible()

        // No "join waitlist" -> "you're on the waitlist" transition either —
        // it correctly stayed in the not-joined state.
        await expect(eventPage.waitlistJoinedBanner).not.toBeVisible()
        expect(pageErrors).toHaveLength(0)
    })
})
