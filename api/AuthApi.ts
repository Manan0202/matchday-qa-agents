import { APIRequestContext } from '@playwright/test'
import { TestUser } from '../utils/testUsers'

// {email, password} alone — a strict subset of TestUser, but named
// separately since login doesn't take (or need) a name.
export type Credentials = Pick<TestUser, 'email' | 'password'>

// API Object Model — the request-only counterpart to pages/*.ts. Each class
// wraps one MatchDay resource's REST routes; specs call these instead of
// raw request.get/post so the HTTP contract lives in one place per resource.
export class AuthApi {
    constructor(private readonly request: APIRequestContext) {}

    // src/app/api/auth/register/route.ts
    register(user: TestUser) {
        return this.request.post('/api/auth/register', { data: user })
    }

    // src/app/api/auth/login/route.ts
    login(credentials: Credentials) {
        return this.request.post('/api/auth/login', { data: credentials })
    }

    // src/app/api/auth/logout/route.ts
    logout() {
        return this.request.post('/api/auth/logout')
    }

    // src/app/api/me/route.ts
    me() {
        return this.request.get('/api/me')
    }
}
