// Implements specs/GH-001-plan.md (approved after re-verification —
// scenario 4 covers a redirect bug found by the Planner and since fixed
// in matchday/src/app/checkout/page.tsx).
import { test, expect } from '../../fixtures/authFixture'
import { HomePage } from '../../pages/HomePage'
import { EventPage } from '../../pages/EventPage'
import { AuthPage } from '../../pages/AuthPage'
import { CheckoutPage } from '../../pages/CheckoutPage'
import { BookingsPage } from '../../pages/BookingsPage'

// Deterministic across reseeds — seed.ts always creates this exact fixture.
const EVENT_LABEL = 'ARS vs MCI'

test.describe('GH-001: Successful ticket booking', () => {
    // All scenarios book real seats on the same fixed event (EVENT_LABEL)
    // against the shared dev database — running them in parallel lets two
    // workers grab the same "first available" seats and race each other to
    // confirm/expire them. Serial execution matches how the Planner verified
    // these flows and avoids that cross-test seat contention.
    test.describe.configure({ mode: 'serial' })

    test('1. Browse and filter events by sport and league', async ({ page }) => {
        const home = new HomePage(page)

        await test.step('Navigate to the home page', async () => {
            await home.goto()
        })

        await test.step('Filter by Football narrows the league row to football leagues', async () => {
            await home.filterBySport('Football')
            await home.expectVisibleLeagues(['Premier League', 'La Liga'])
            // Scoped to the league filter pill specifically — "IPL" can
            // legitimately still appear elsewhere on the page (the
            // Trending strip isn't filtered by sport/league by design).
            await expect(home.leagueFilter('IPL')).toHaveCount(0)
        })

        await test.step('Further filtering by La Liga narrows the event list (not the filter row)', async () => {
            await home.filterByLeague('La Liga')
            await expect(page.getByText('Football · La Liga').first()).toBeVisible()
            // The league picker intentionally keeps showing every football
            // league (so you can switch back) — only the event *cards*
            // narrow to La Liga. Confirmed this is the app's actual design,
            // not an oversight, by reading EventsBrowser.tsx's filtering
            // logic, which derives the picker row from the sport filter
            // only, independent of which league is currently active.
            await expect(page.getByText('Football · Premier League')).toHaveCount(0)
        })
    })

    test('2. Seat map shows sections with live availability', async ({ page }) => {
        const home = new HomePage(page)
        const eventPage = new EventPage(page)

        await test.step('Open an upcoming, not-sold-out event', async () => {
            await home.goto()
            await home.openEvent(EVENT_LABEL)
        })

        await test.step('Seat map shows named sections with a price and a legend', async () => {
            await expect(page.getByText('Lower Tier')).toBeVisible()
            await expect(page.getByText('Club Level')).toBeVisible()
            await expect(page.getByText('Available')).toBeVisible()
            // exact: true — otherwise this also matches "0 seat(s) selected"
            // in the summary bar below (case-insensitive substring match).
            await expect(page.getByText('Selected', { exact: true })).toBeVisible()
            await expect(page.getByText('Sold')).toBeVisible()
            await expect(eventPage.availableSeats.first()).toBeVisible()
        })
    })

    test('3. Selecting seats updates a running total', async ({ page }) => {
        const home = new HomePage(page)
        const eventPage = new EventPage(page)

        await home.goto()
        await home.openEvent(EVENT_LABEL)

        await test.step('Selecting one seat shows a 1-seat total and enables checkout', async () => {
            await expect(eventPage.proceedToCheckoutButton).toBeDisabled()
            await eventPage.selectSeats(1)
            await expect(eventPage.checkoutSummary).toContainText('1 seat(s) selected')
            await expect(eventPage.proceedToCheckoutButton).toBeEnabled()
        })

        await test.step('Selecting 3 more (4 total) applies the group discount', async () => {
            await eventPage.selectSeats(3)
            await expect(eventPage.checkoutSummary).toContainText('4 seat(s) selected')
            await expect(eventPage.checkoutSummary).toContainText('10% group discount')
        })

        await test.step('Deselecting one seat (back to 3) removes the discount', async () => {
            await eventPage.deselectFirstSelectedSeat()
            await expect(eventPage.checkoutSummary).toContainText('3 seat(s) selected')
            await expect(eventPage.checkoutSummary).not.toContainText('group discount')
        })
    })

    test('4. Anonymous checkout redirects to login and back to checkout with seats intact', async ({
        page,
    }) => {
        const home = new HomePage(page)
        const eventPage = new EventPage(page)
        const auth = new AuthPage(page)

        await test.step('Select seats as an anonymous user and proceed to checkout', async () => {
            await home.goto()
            await home.openEvent(EVENT_LABEL)
            await eventPage.selectSeats(2)
            await eventPage.proceedToCheckout()
        })

        await test.step('Redirected to /login with the checkout destination preserved', async () => {
            await expect(page).toHaveURL(/\/login\?redirectTo=/)
        })

        await test.step('Registering from the redirect context lands back on checkout, not home', async () => {
            const redirectTo = new URL(page.url()).searchParams.get('redirectTo')!
            await page.goto(`/register?redirectTo=${encodeURIComponent(redirectTo)}`)
            await auth.register(
                'GH-001 Redirect Regression',
                `qa.redirect.${Date.now()}@example.com`,
                'TestPass123!'
            )
            await expect(page).toHaveURL(/\/checkout\?event=.*seats=/)
        })

        await test.step('Checkout shows the original 2 seats, not an empty/failed state', async () => {
            const checkout = new CheckoutPage(page)
            // The URL settles on /checkout before the async Server Component
            // finishes streaming in its content — reading body text right
            // after the URL assertion can still catch app/loading.tsx's
            // skeleton (which renders no seat/total text of its own).
            await page.getByRole('heading', { name: 'Checkout' }).waitFor()
            const body = await checkout.bodyText()
            expect(body).toContain('Total')
            expect((body.match(/Row \d+, Seat \d+/g) ?? []).length).toBe(2)
        })
    })

    test('5. Logged-in user completes checkout and sees the booking on My Bookings', async ({
        page,
        loggedInPage: _user,
    }) => {
        const home = new HomePage(page)
        const eventPage = new EventPage(page)
        const checkout = new CheckoutPage(page)
        const bookings = new BookingsPage(page)

        await test.step('Select 2 Lower Tier seats and proceed straight to checkout (no login gate)', async () => {
            await home.goto()
            await home.openEvent(EVENT_LABEL)
            await eventPage.selectSeatsInSection('Lower Tier', 2)
            await eventPage.proceedToCheckout()
            await expect(page).toHaveURL(/\/checkout/)
        })

        await test.step('Checkout itemizes both seats with a $240.00 total', async () => {
            const body = await checkout.bodyText()
            expect(body).toContain('Lower Tier')
            expect(body).toContain('$240.00')
        })

        await test.step('Confirming lands on My Bookings with the booking visible', async () => {
            await checkout.confirmBooking()
            await expect(page).toHaveURL(/\/bookings\?confirmed=/)
            await expect(bookings.confirmedBanner).toBeVisible()
            const bookingId = new URL(page.url()).searchParams.get('confirmed')!
            await expect(bookings.booking(bookingId)).toContainText('$240.00')
        })
    })

    test('6. Booking 4+ seats applies a 10% group discount end to end', async ({
        page,
        loggedInPage: _user,
    }) => {
        const home = new HomePage(page)
        const eventPage = new EventPage(page)
        const checkout = new CheckoutPage(page)
        const bookings = new BookingsPage(page)

        await test.step('Select 4 Club Level seats ($45 each) on the event page', async () => {
            await home.goto()
            await home.openEvent(EVENT_LABEL)
            await eventPage.selectSeatsInSection('Club Level', 4)
            await expect(eventPage.checkoutSummary).toContainText('$162.00')
            await expect(eventPage.checkoutSummary).toContainText('10% group discount')
        })

        await test.step('Checkout breaks down subtotal, discount, and total', async () => {
            await eventPage.proceedToCheckout()
            const body = await checkout.bodyText()
            expect(body).toContain('Subtotal')
            expect(body).toContain('$180.00')
            expect(body).toContain('Group discount (10%, 4 seats)')
            expect(body).toContain('-$18.00')
            expect(body).toContain('$162.00')
        })

        await test.step('My Bookings shows the discounted total, not the pre-discount subtotal', async () => {
            await checkout.confirmBooking()
            const bookingId = new URL(page.url()).searchParams.get('confirmed')!
            await expect(bookings.booking(bookingId)).toContainText('$162.00')
        })
    })

    test('7. Booking under 4 seats does not apply the group discount', async ({
        page,
        loggedInPage: _user,
    }) => {
        const home = new HomePage(page)
        const eventPage = new EventPage(page)

        await home.goto()
        await home.openEvent(EVENT_LABEL)

        await test.step('Selecting 2 seats shows a plain total with a discount hint, no discount line', async () => {
            await eventPage.selectSeats(2)
            await expect(eventPage.checkoutSummary).toContainText('add 2 more for 10% off')
            await expect(eventPage.checkoutSummary).not.toContainText('group discount')
        })
    })
})
