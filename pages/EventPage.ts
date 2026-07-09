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
        for (let i = 0; i < count; i++) {
            await this.availableSeats.nth(i).click()
        }
    }

    // Scopes to one named section (e.g. "Club Level") so price-sensitive
    // scenarios select from the section they actually mean, rather than
    // whichever seats happen to render first on the page.
    availableSeatsInSection(sectionName: string): Locator {
        return this.page
            .locator('div.rounded-lg', { hasText: sectionName })
            .locator('[data-seat-status="AVAILABLE"]')
    }

    async selectSeatsInSection(sectionName: string, count: number) {
        const seats = this.availableSeatsInSection(sectionName)
        for (let i = 0; i < count; i++) {
            await seats.nth(i).click()
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
