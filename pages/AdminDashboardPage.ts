import { Locator, Page } from '@playwright/test'

export class AdminDashboardPage {
    readonly heading: Locator

    constructor(private page: Page) {
        this.heading = page.getByRole('heading', { name: 'Admin dashboard' })
    }

    async goto() {
        await this.page.goto('/admin')
    }

    // src/app/admin/page.tsx's Stat component renders
    // <div class="rounded-lg border border-slate-200 bg-white p-4">
    //   <p class="text-2xl font-bold">{value}</p>
    //   <p class="text-sm text-slate-600">{label}</p>
    // </div>
    // The full class string (specifically "p-4") distinguishes this from
    // SeatsChart/RevenueChart's outer containers, which use the same
    // "rounded-lg border border-slate-200 bg-white" prefix but "p-5".
    stat(label: string): Locator {
        return this.page.locator('div.rounded-lg.border.border-slate-200.bg-white.p-4', { hasText: label })
    }

    async statValue(label: string): Promise<string> {
        return this.stat(label).locator('p').first().innerText()
    }
}
