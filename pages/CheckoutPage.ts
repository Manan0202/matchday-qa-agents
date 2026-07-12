import { Locator, Page } from '@playwright/test'

export class CheckoutPage {
    readonly confirmButton: Locator
    readonly bookingError: Locator

    constructor(private page: Page) {
        this.confirmButton = page.getByTestId('confirm-booking')
        this.bookingError = page.getByTestId('booking-error')
    }

    async confirmBooking() {
        await this.confirmButton.click()
        // Confirming posts to the bookings API, then router.push()es to
        // /bookings?confirmed=<id> — without waiting here, a caller that
        // reads page.url() immediately can catch the pre-navigation URL
        // and get a null "confirmed" param.
        await this.page.waitForURL(/\/bookings\?confirmed=/)
    }

    // For failure-path scenarios (e.g. a mocked 500 via network
    // interception) — no navigation is expected, so unlike confirmBooking()
    // above, this deliberately does not wait for a URL change.
    async clickConfirmExpectingFailure() {
        await this.confirmButton.click()
    }

    async bodyText() {
        return this.page.locator('body').innerText()
    }
}
