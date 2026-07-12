export type TestUser = { name: string; email: string; password: string }

// Unique-per-call so parallel workers/tests never collide on email (MatchDay
// enforces unique emails at registration). Shared by fixtures/authFixture.ts
// (UI registration) and tests/api specs (direct API registration) so both
// layers generate accounts the same way.
export function generateTestUser(prefix = 'qa.gen'): TestUser {
    return {
        name: 'QA Generated User',
        email: `${prefix}.${Date.now()}.${Math.floor(Math.random() * 10_000)}@example.com`,
        password: 'TestPass123!',
    }
}
