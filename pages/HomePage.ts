import { Page, Locator, expect } from '@playwright/test'

export class HomePage {
    readonly page: Page
    readonly sportFilter: (sport: string) => Locator
    readonly leagueFilter: (league: string) => Locator
    readonly eventCard: (label: string) => Locator

    constructor(page: Page) {
        this.page = page
        this.sportFilter = (sport: string) =>
            page.getByRole('button', { name: new RegExp(sport, 'i') })
        this.leagueFilter = (league: string) => page.getByRole('button', { name: league })
        this.eventCard = (label: string) => page.getByText(label, { exact: false })
    }

    async goto() {
        // "load" fires before React hydration attaches event handlers on
        // this client-rendered filter UI; a click right after goto() can
        // land on a not-yet-interactive button and silently no-op. Waiting
        // for networkidle gives hydration time to finish first.
        await this.page.goto('/', { waitUntil: 'networkidle' })
    }

    async filterBySport(sport: string) {
        await this.sportFilter(sport).click()
    }

    async filterByLeague(league: string) {
        await this.leagueFilter(league).click()
    }

    async openEvent(matchLabel: string) {
        await this.eventCard(matchLabel).first().click()
        await this.page.waitForURL(/\/events\//)
    }

    async expectVisibleLeagues(leagues: string[]) {
        for (const league of leagues) {
            await expect(this.leagueFilter(league)).toBeVisible()
        }
    }
}
