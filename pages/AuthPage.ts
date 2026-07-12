import { Locator, Page } from '@playwright/test'

export class AuthPage {
    readonly logoutButton: Locator
    readonly loginNavLink: Locator
    readonly adminNavLink: Locator

    constructor(private page: Page) {
        // Accessible name is "Log out (<user's name>)" — varies per
        // account, hence the regex instead of an exact match.
        this.logoutButton = page.getByRole('button', { name: /Log out/ })
        this.loginNavLink = page.getByRole('link', { name: 'Log in' })
        // Only rendered in the nav for an ADMIN-role session (confirmed
        // live in specs/GH-005-plan.md scenarios 1-3) — a fan or anonymous
        // session never sees this link at all.
        this.adminNavLink = page.getByRole('link', { name: 'Admin', exact: true })
    }

    async gotoLogin() {
        await this.page.goto('/login')
    }

    async gotoRegister() {
        await this.page.goto('/register')
    }

    async login(email: string, password: string) {
        await this.page.getByTestId('email-input').fill(email)
        await this.page.getByTestId('password-input').fill(password)
        await this.page.getByTestId('submit-button').click()
    }

    async register(name: string, email: string, password: string) {
        await this.page.getByTestId('name-input').fill(name)
        await this.page.getByTestId('email-input').fill(email)
        await this.page.getByTestId('password-input').fill(password)
        await this.page.getByTestId('submit-button').click()
    }

    async logout() {
        await this.logoutButton.click()
    }
}
