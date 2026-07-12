import { Locator, Page } from '@playwright/test'

// src/components/admin/AdminEventsClient.tsx — a table with one <tr> per
// event, each row holding a status <select> (PUT on change) and a
// "Delete" button (DELETE on click). Both are real, state-changing admin
// UI actions, not just read-only display.
export class AdminEventsPage {
    constructor(private page: Page) {}

    async goto() {
        await this.page.goto('/admin/events')
    }

    // Scoped by matchLabel AND league together, not matchLabel alone: this
    // table has no event id anywhere in its DOM (React's key={event.id} on
    // the <tr> isn't a rendered attribute), so two events sharing the same
    // team pair — plausible when multiple tests create fixtures via
    // api/EventFactory.ts around the same time — would otherwise be
    // ambiguous. api/EventFactory.ts makes `league` unique per call
    // specifically so this stays deterministic instead of just unlikely.
    row(matchLabel: string, league: string): Locator {
        return this.page.locator('tr', { hasText: matchLabel }).filter({ hasText: league })
    }

    statusSelect(matchLabel: string, league: string): Locator {
        return this.row(matchLabel, league).locator('select')
    }

    deleteButton(matchLabel: string, league: string): Locator {
        return this.row(matchLabel, league).getByRole('button', { name: 'Delete' })
    }

    async setStatus(
        matchLabel: string,
        league: string,
        status: 'UPCOMING' | 'LIVE' | 'FINISHED' | 'CANCELLED'
    ) {
        await this.statusSelect(matchLabel, league).selectOption(status)
    }

    async deleteEvent(matchLabel: string, league: string) {
        await this.deleteButton(matchLabel, league).click()
    }
}
