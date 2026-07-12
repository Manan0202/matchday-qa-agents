import { APIRequestContext } from '@playwright/test'

export type CreateTeamPayload = { name: string; shortName: string; sportId: string }

export class AdminTeamsApi {
    constructor(private readonly request: APIRequestContext) {}

    // src/app/api/admin/teams/route.ts GET — publicly readable, no admin gate.
    list() {
        return this.request.get('/api/admin/teams')
    }

    // src/app/api/admin/teams/route.ts POST — admin-gated (403 otherwise).
    create(payload: CreateTeamPayload) {
        return this.request.post('/api/admin/teams', { data: payload })
    }

    // src/app/api/admin/teams/[id]/route.ts DELETE — admin-gated (403 otherwise).
    delete(teamId: string) {
        return this.request.delete(`/api/admin/teams/${teamId}`)
    }
}
