// Accounts created by matchday/prisma/seed.ts (npm run db:seed). Stable
// across reseeds since the seed script always recreates them with the same
// credentials — safe to hardcode here rather than registering fresh users
// for tests that just need *a* logged-in session (e.g. an ADMIN session for
// admin-only routes/pages) and don't care about the account's history.
//
// Prefer utils/testUsers.ts#generateTestUser() instead when a test needs an
// account with a clean, empty history (no prior bookings/favorites), since
// these seeded accounts accumulate state across every local test run.
export const SEEDED_ADMIN = {
    email: 'admin@matchday.dev',
    password: 'password123',
    role: 'ADMIN' as const,
}

export const SEEDED_FAN = {
    email: 'fan@matchday.dev',
    password: 'password123',
    role: 'USER' as const,
}
