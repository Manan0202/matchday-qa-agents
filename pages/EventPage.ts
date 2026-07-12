import { Page, Locator } from '@playwright/test'

export class EventPage {
    readonly page: Page
    readonly checkoutSummary: Locator
    readonly proceedToCheckoutButton: Locator
    readonly availableSeats: Locator
    readonly joinWaitlistButton: Locator
    readonly waitlistJoinedBanner: Locator

    constructor(page: Page) {
        this.page = page
        this.checkoutSummary = page.getByTestId('checkout-summary')
        this.proceedToCheckoutButton = page.getByTestId('proceed-to-checkout')
        this.availableSeats = page.locator('[data-seat-status="AVAILABLE"]')
        this.joinWaitlistButton = page.getByTestId('join-waitlist')
        this.waitlistJoinedBanner = page.getByTestId('waitlist-joined')
    }

    async selectSeats(count: number) {
        // Deliberately .first(), not .nth(i): this locator is live and
        // shrinks with every click (a selected seat's data-seat-status
        // flips away from AVAILABLE). .nth(i) against a shrinking set
        // drifts — after i clicks, the "i-th available seat" isn't the
        // i-th one you originally saw, and once the section has fewer
        // than `count` seats left un-clicked, .nth(count-1) has nothing to
        // match and hangs until timeout. Re-querying .first() each time
        // is immune to this regardless of how large `count` is relative
        // to the section's total seats.
        for (let i = 0; i < count; i++) {
            await this.availableSeats.first().click()
        }
    }

    // Scopes to one named section's own container (e.g. "Club Level") —
    // reused for seat selection and for reading that section's own price
    // label, since an event with multiple identically-priced sections
    // (e.g. two sections both "$50 / seat") makes an unscoped page-wide
    // text search ambiguous.
    sectionContainer(sectionName: string): Locator {
        return this.page.locator('div.rounded-lg', { hasText: sectionName })
    }

    availableSeatsInSection(sectionName: string): Locator {
        return this.sectionContainer(sectionName).locator('[data-seat-status="AVAILABLE"]')
    }

    // The heading price label renders as "$50 / seat" — whole dollars, no
    // cents — unlike the checkout/running-total displays, which do show
    // cents.
    sectionPriceText(sectionName: string): Locator {
        return this.sectionContainer(sectionName).getByText(/^\$\d+ \/ seat$/)
    }

    async selectSeatsInSection(sectionName: string, count: number) {
        // Same .first()-not-.nth(i) reasoning as selectSeats() above.
        const seats = this.availableSeatsInSection(sectionName)
        for (let i = 0; i < count; i++) {
            await seats.first().click()
        }
    }

    async deselectFirstSelectedSeat() {
        await this.page.locator('[data-seat-status="SELECTED"]').first().click()
    }

    async summaryText() {
        return this.checkoutSummary.innerText()
    }

    async proceedToCheckout() {
        await this.proceedToCheckoutButton.click()
        // Logged-in users land on /checkout; anonymous users are correctly
        // redirected to /login instead (scenario 4). The server-side
        // redirect() can make the URL bar transiently report /checkout
        // before settling on /login, so polling page.url() is racy — wait
        // for whichever page's own content actually renders instead.
        await Promise.race([
            this.page.getByRole('heading', { name: 'Checkout' }).waitFor(),
            this.page.getByRole('heading', { name: 'Log in' }).waitFor(),
        ])
    }

    async joinWaitlist() {
        await this.joinWaitlistButton.click()
    }
}
