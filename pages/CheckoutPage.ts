import { Page } from '@playwright/test'

export class CheckoutPage {
    constructor(private page: Page) {}

    async confirmBooking() {
        await this.page.getByTestId('confirm-booking').click()
        // Confirming posts to the bookings API, then router.push()es to
        // /bookings?confirmed=<id> — without waiting here, a caller that
        // reads page.url() immediately can catch the pre-navigation URL
        // and get a null "confirmed" param.
        await this.page.waitForURL(/\/bookings\?confirmed=/)
    }

    async bodyText() {
        return this.page.locator('body').innerText()
    }
}
