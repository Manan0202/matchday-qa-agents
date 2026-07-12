import { APIRequestContext } from '@playwright/test'

export class WaitlistApi {
    constructor(private readonly request: APIRequestContext) {}

    // src/app/api/events/[id]/waitlist/route.ts
    join(eventId: string) {
        return this.request.post(`/api/events/${eventId}/waitlist`)
    }
}
