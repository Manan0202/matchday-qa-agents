import { APIRequestContext } from '@playwright/test'

export type CreateEventPayload = {
    sportId: string
    league: string
    homeTeamId: string
    awayTeamId: string
    venueId: string
    startTime: string
    status?: string
    sectionPrices: { sectionId: string; price: number }[]
}

export class AdminEventsApi {
    constructor(private readonly request: APIRequestContext) {}

    // src/app/api/admin/events/route.ts POST — admin-gated (403 otherwise).
    // Also creates one EventSection + a full grid of Seat rows per entry in
    // sectionPrices, based on that section's rows/seatsPerRow.
    create(payload: CreateEventPayload) {
        return this.request.post('/api/admin/events', { data: payload })
    }

    // src/app/api/admin/events/[id]/route.ts PUT — admin-gated, updates only
    // `status`. No existence check before the Prisma update (see
    // tests/api/admin-events.spec.ts for the documented current behavior).
    updateStatus(eventId: string, status: string) {
        return this.request.put(`/api/admin/events/${eventId}`, { data: { status } })
    }

    // src/app/api/admin/events/[id]/route.ts DELETE — admin-gated. Cascades
    // through bookingSeats/seats/eventSections/waitlist entries before
    // deleting the event itself.
    delete(eventId: string) {
        return this.request.delete(`/api/admin/events/${eventId}`)
    }
}
