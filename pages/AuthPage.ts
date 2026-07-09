import { Page } from '@playwright/test'

export class AuthPage {
    constructor(private page: Page) {}

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
}
