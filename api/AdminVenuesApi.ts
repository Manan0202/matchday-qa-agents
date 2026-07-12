import { APIRequestContext } from '@playwright/test'

export type CreateVenuePayload = {
    name: string
    city: string
    capacity: number
    sections: { name: string; rows: number; seatsPerRow: number }[]
}

export class AdminVenuesApi {
    constructor(private readonly request: APIRequestContext) {}

    // src/app/api/admin/venues/route.ts GET — publicly readable, no admin gate.
    list() {
        return this.request.get('/api/admin/venues')
    }

    // src/app/api/admin/venues/route.ts POST — admin-gated (403 otherwise).
    create(payload: CreateVenuePayload) {
        return this.request.post('/api/admin/venues', { data: payload })
    }

    // src/app/api/admin/venues/[id]/route.ts DELETE — admin-gated (403 otherwise).
    delete(venueId: string) {
        return this.request.delete(`/api/admin/venues/${venueId}`)
    }
}
