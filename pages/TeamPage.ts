import { Locator, Page } from '@playwright/test'

// Minimal — only what's needed for the network-interception error-handling
// scenarios in tests/regression/error-handling.spec.ts. The full Page
// Object for GH-003 (follow/unfollow, "Your teams" home feed, etc.) is
// still pending plan approval; do not expand this file speculatively ahead
// of that Generator run.
export class TeamPage {
    readonly followButton: Locator

    constructor(private page: Page) {
        this.followButton = page.getByRole('button', { name: /Follow|Following/ })
    }

    async goto(teamId: string) {
        await this.page.goto(`/teams/${teamId}`)
    }
}
