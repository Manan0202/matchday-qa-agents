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
        trace: 'on-first-retry',
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
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
})
