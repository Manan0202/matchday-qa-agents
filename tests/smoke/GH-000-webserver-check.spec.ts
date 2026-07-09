import { test, expect } from '@playwright/test'

test('MatchDay boots and serves the home page', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Never miss a match day.')).toBeVisible()
})
