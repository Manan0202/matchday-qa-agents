import { defineConfig, devices } from '@playwright/test'

const PORT = 3010
const BASE_URL = `http://localhost:${PORT}`

// This suite tests MatchDay (a sibling repo, not this one). Playwright
// starts it automatically via webServer so `npx playwright test` works
// standalone — see MATCHDAY_DIR below if your checkout lives elsewhere.
const MATCHDAY_DIR = process.env.MATCHDAY_DIR ?? '../matchday'

export default defineConfig({
    testDir: './tests',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    workers: process.env.CI ? 2 : undefined,
    reporter: [['list'], ['html', { open: 'never' }]],
    use: {
        baseURL: BASE_URL,
        // 'on-first-retry' only captures a trace when a test is retried —
        // but retries are 0 locally (only CI retries), so that setting
        // silently never captured anything outside CI. 'retain-on-failure'
        // captures on any failure regardless of retry count, and discards
        // it for passing tests, so it isn't paying the overhead for the
        // common case.
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
    },
    webServer: {
        command: `npm run dev -- -p ${PORT}`,
        cwd: MATCHDAY_DIR,
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        // No TURSO_DATABASE_URL here on purpose: MatchDay falls back to a
        // local SQLite file when it's unset, so tests never touch the
        // production database.
    },
    projects: [
        // Pure functions, no server/network/browser — fastest layer, runs
        // first so a broken business-rule oracle fails loud before the
        // slower layers even start.
        {
            name: 'unit',
            testMatch: 'unit/**/*.spec.ts',
        },
        // Hits MatchDay's REST routes directly via Playwright's `request`
        // fixture — no browser, but does need the dev server up.
        {
            name: 'api',
            testMatch: 'api/**/*.spec.ts',
            use: { baseURL: BASE_URL },
        },
        // Full browser E2E — the existing smoke/regression suites.
        {
            name: 'chromium',
            testMatch: ['smoke/**/*.spec.ts', 'regression/**/*.spec.ts'],
            use: { ...devices['Desktop Chrome'] },
        },
    ],
})
