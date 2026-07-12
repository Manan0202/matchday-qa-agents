import { APIRequestContext } from '@playwright/test'

type EventSummary = { id: string; status: string; availableSeats: number; soldOut: boolean }
type Seat = { id: string; status: string }
type EventSection = { price: number; seats: Seat[] }
type EventDetail = { id: string; sections: EventSection[] }

export type BookableSeats = {
    eventId: string
    seatIds: string[]
    pricePerSeat: number
}

export class EventsApi {
    constructor(private readonly request: APIRequestContext) {}

    // src/app/api/events/route.ts — query is an optional raw query string,
    // e.g. 'sport=football&league=La%20Liga'.
    list(query?: string) {
        return this.request.get(`/api/events${query ? `?${query}` : ''}`)
    }

    // src/app/api/events/[id]/route.ts
    get(eventId: string) {
        return this.request.get(`/api/events/${eventId}`)
    }

    // Finds an upcoming/live event with at least `minAvailable` AVAILABLE
    // seats in a single section, via the real API rather than hardcoding
    // seed-data ids, which shift on every reseed. Pass `excludeEventId` to
    // force a *different* event than one already picked — e.g. a
    // cross-event validation test needs two distinct events, and without
    // this the greedy picker below would return the same first candidate
    // twice.
    async findBookableSeats(minAvailable: number, excludeEventId?: string): Promise<BookableSeats> {
        const events = (await (await this.list()).json()) as EventSummary[]
        const candidates = events.filter(
            (e) =>
                (e.status === 'UPCOMING' || e.status === 'LIVE') &&
                e.availableSeats >= minAvailable &&
                e.id !== excludeEventId
        )

        for (const candidate of candidates) {
            const detail = (await (await this.get(candidate.id)).json()) as EventDetail
            for (const section of detail.sections) {
                const available = section.seats.filter((s) => s.status === 'AVAILABLE')
                if (available.length >= minAvailable) {
                    return {
                        eventId: detail.id,
                        seatIds: available.slice(0, minAvailable).map((s) => s.id),
                        pricePerSeat: section.price,
                    }
                }
            }
        }

        throw new Error(
            `No upcoming/live event currently has ${minAvailable}+ available seats in one ` +
                `section — reseed the dev DB (npm run db:seed in matchday) before running this suite.`
        )
    }

    // Looked up live rather than hardcoded — the seeded sold-out fixture
    // (RMA vs BAR, prisma/seed.ts soldOut: true) gets a fresh id on every reseed.
    async findSoldOutEventId(): Promise<string> {
        const events = (await (await this.list()).json()) as EventSummary[]
        const soldOut = events.find((e) => e.soldOut)
        if (!soldOut) {
            throw new Error(
                'No sold-out event in the seeded DB — reseed (npm run db:seed in matchday) before running this suite.'
            )
        }
        return soldOut.id
    }

    // Convenience for tests that just need *a* real team id and don't care
    // which one (e.g. favorites tests) — pulled from the home team of the
    // first seeded event rather than hardcoded.
    async firstTeamId(): Promise<string> {
        const events = await (await this.list()).json()
        return events[0].homeTeam.id as string
    }
}
