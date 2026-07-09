import { Page, Locator } from '@playwright/test'

export class BookingsPage {
    readonly page: Page
    readonly confirmedBanner: Locator

    constructor(page: Page) {
        this.page = page
        this.confirmedBanner = page.getByTestId('booking-confirmed-banner')
    }

    booking(bookingId: string) {
        return this.page.getByTestId(`booking-${bookingId}`)
    }

    async bodyText() {
        return this.page.locator('body').innerText()
    }
}
