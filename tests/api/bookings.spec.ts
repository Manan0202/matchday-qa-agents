// API coverage for src/app/api/events/[id]/bookings/route.ts (the
// authoritative booking endpoint — the UI's "Confirm booking" button in
// specs/GH-001-plan.md ultimately hits this same route) and
// src/app/api/bookings/route.ts (list-my-bookings).
import { test, expect, request as apiRequestFactory } from '@playwright/test'
import { AuthApi } from '../../api/AuthApi'
import { BookingsApi } from '../../api/BookingsApi'
import { EventsApi } from '../../api/EventsApi'
import { calculateExpectedPricing } from '../../utils/pricing'
import { generateTestUser } from '../../utils/testUsers'

// Every test in this file books real seats against the same shared dev-DB
// inventory via EventsApi#findBookableSeats(), which picks *currently
// available* seats but doesn't reserve them. Running these tests in
// parallel (this repo's default) lets two tests race for the same seats
// and produces spurious 409s that have nothing to do with the app. Serial
// execution trades a little speed for determinism — the right call for
// tests that mutate shared, finite inventory instead of isolated-per-test
// data.
test.describe.configure({ mode: 'serial' })

test.describe('POST /api/events/:id/bookings', () => {
    test('books seats and charges the correct total (no discount, under 4 seats)', async ({ request }) => {
        const auth = new AuthApi(request)
        const events = new EventsApi(request)
        const bookings = new BookingsApi(request)

        await auth.register(generateTestUser('api.booking.happy'))
        const { eventId, seatIds, pricePerSeat } = await events.findBookableSeats(2)

        const response = await bookings.create(eventId, seatIds)
        expect(response.status()).toBe(201)
        const booking = await response.json()

        const expected = calculateExpectedPricing([pricePerSeat, pricePerSeat])
        expect(booking.totalPrice).toBe(expected.total)
        expect(booking.seats).toHaveLength(2)
        expect(booking.seats.map((s: { seatId: string }) => s.seatId).sort()).toEqual([...seatIds].sort())
    })

    test('applies the 10% group discount for 4+ seats, matching the shared pricing oracle', async ({
        request,
    }) => {
        const auth = new AuthApi(request)
        const events = new EventsApi(request)
        const bookings = new BookingsApi(request)

        await auth.register(generateTestUser('api.booking.discount'))
        const { eventId, seatIds, pricePerSeat } = await events.findBookableSeats(4)

        const response = await bookings.create(eventId, seatIds)
        expect(response.status()).toBe(201)
        const booking = await response.json()

        const expected = calculateExpectedPricing(new Array(4).fill(pricePerSeat))
        expect(expected.discountApplied).toBe(true)
        expect(booking.totalPrice).toBe(expected.total)
    })

    test('rejects an unauthenticated request with 401', async ({ request }) => {
        const events = new EventsApi(request)
        const bookings = new BookingsApi(request)
        const { eventId, seatIds } = await events.findBookableSeats(1)
        const response = await bookings.create(eventId, seatIds)
        expect(response.status()).toBe(401)
        expect(await response.json()).toEqual({ error: 'Not authenticated' })
    })

    test('rejects an empty seatIds array with 400', async ({ request }) => {
        const auth = new AuthApi(request)
        const events = new EventsApi(request)
        const bookings = new BookingsApi(request)

        await auth.register(generateTestUser('api.booking.empty'))
        const { eventId } = await events.findBookableSeats(1)

        const response = await bookings.create(eventId, [])
        expect(response.status()).toBe(400)
        expect((await response.json()).error).toMatch(/seatIds is required/i)
    })

    test('rejects seats that belong to a different event with 400', async ({ request }) => {
        const auth = new AuthApi(request)
        const events = new EventsApi(request)
        const bookings = new BookingsApi(request)

        await auth.register(generateTestUser('api.booking.wrongevent'))
        const a = await events.findBookableSeats(1)
        const b = await events.findBookableSeats(1, a.eventId)

        const response = await bookings.create(a.eventId, b.seatIds)
        expect(response.status()).toBe(400)
        expect((await response.json()).error).toMatch(/do not belong to this event/i)
    })

    test('a seat already sold cannot be double-booked — concurrent requests race safely to exactly one winner', async ({
        request,
    }) => {
        // This is the interesting case: two users try to book the *same*
        // seat at the same time. The route's conditional
        // `updateMany({ where: { status: 'AVAILABLE' }, data: { status: 'SOLD' } })`
        // plus a transaction is what's supposed to make this safe — prove it
        // by actually firing both requests concurrently, not sequentially.
        const events = new EventsApi(request)
        const { eventId, seatIds } = await events.findBookableSeats(1)

        // Two independent cookie jars so each "user" carries their own session.
        const ctxA = await apiRequestFactory.newContext()
        const ctxB = await apiRequestFactory.newContext()
        try {
            const authA = new AuthApi(ctxA)
            const authB = new AuthApi(ctxB)
            const bookingsA = new BookingsApi(ctxA)
            const bookingsB = new BookingsApi(ctxB)

            await authA.register(generateTestUser('api.booking.raceA'))
            await authB.register(generateTestUser('api.booking.raceB'))

            const [responseA, responseB] = await Promise.all([
                bookingsA.create(eventId, seatIds),
                bookingsB.create(eventId, seatIds),
            ])

            const statuses = [responseA.status(), responseB.status()].sort()
            // Exactly one 201 (the winner) and one 409 (the loser) — never
            // two 201s (double-sold), never two failures (seat wrongly locked).
            expect(statuses).toEqual([201, 409])

            const loserBody = responseA.status() === 409 ? await responseA.json() : await responseB.json()
            expect(loserBody.error).toMatch(/just booked by someone else/i)
        } finally {
            await ctxA.dispose()
            await ctxB.dispose()
        }
    })
})

test.describe('GET /api/bookings', () => {
    test('rejects an unauthenticated request with 401', async ({ request }) => {
        const bookings = new BookingsApi(request)
        const response = await bookings.listMine()
        expect(response.status()).toBe(401)
    })

    test("only returns the caller's own bookings, never another user's", async ({ request }) => {
        const events = new EventsApi(request)
        const ctxA = await apiRequestFactory.newContext()
        const ctxB = await apiRequestFactory.newContext()
        try {
            const authA = new AuthApi(ctxA)
            const authB = new AuthApi(ctxB)
            const bookingsA = new BookingsApi(ctxA)
            const bookingsB = new BookingsApi(ctxB)

            await authA.register(generateTestUser('api.bookings.isolationA'))
            await authB.register(generateTestUser('api.bookings.isolationB'))

            const seatsForA = await events.findBookableSeats(1)
            const bookingA = await (await bookingsA.create(seatsForA.eventId, seatsForA.seatIds)).json()

            const bListResponse = await bookingsB.listMine()
            expect(bListResponse.status()).toBe(200)
            const bBookings = await bListResponse.json()
            expect(bBookings.map((b: { id: string }) => b.id)).not.toContain(bookingA.id)

            const aBookings = await (await bookingsA.listMine()).json()
            expect(aBookings.map((b: { id: string }) => b.id)).toContain(bookingA.id)
        } finally {
            await ctxA.dispose()
            await ctxB.dispose()
        }
    })
})
