import { test as base } from './baseTest'
import { AuthPage } from '../pages/AuthPage'

type RegisteredUser = { name: string; email: string; password: string }

type AuthFixtures = {
    registeredUser: RegisteredUser
    loggedInPage: RegisteredUser
}

// registeredUser creates a fresh, unique account via the UI register form
// (not the raw API) so fixture setup exercises the same code path the app's
// real users go through, matching how the Planner verified these flows.
// loggedInPage builds on it and leaves the page authenticated and on "/".
export const test = base.extend<AuthFixtures>({
    registeredUser: async ({ page }, use) => {
        const user: RegisteredUser = {
            name: 'QA Generated User',
            email: `qa.gen.${Date.now()}.${Math.floor(Math.random() * 10_000)}@example.com`,
            password: 'TestPass123!',
        }
        const auth = new AuthPage(page)
        await auth.gotoRegister()
        await auth.register(user.name, user.email, user.password)
        await page.waitForURL('/')
        await use(user)
    },

    loggedInPage: async ({ page, registeredUser }, use) => {
        await use(registeredUser)
    },
})

export { expect } from '@playwright/test'
