import { APIRequestContext } from '@playwright/test'

export class BookingsApi {
    constructor(private readonly request: APIRequestContext) {}

    // src/app/api/events/[id]/bookings/route.ts — the authoritative booking
    // endpoint; both the UI's "Confirm booking" button (specs/GH-001-plan.md)
    // and these API tests ultimately hit this same route.
    create(eventId: string, seatIds: string[]) {
        return this.request.post(`/api/events/${eventId}/bookings`, { data: { seatIds } })
    }

    // src/app/api/bookings/route.ts
    listMine() {
        return this.request.get('/api/bookings')
    }
}
