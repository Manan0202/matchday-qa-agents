import { APIRequestContext } from '@playwright/test'

export class FavoritesApi {
    constructor(private readonly request: APIRequestContext) {}

    // src/app/api/teams/[id]/favorite/route.ts — toggles: first call
    // favorites, second call un-favorites the same team for the same session.
    toggle(teamId: string) {
        return this.request.post(`/api/teams/${teamId}/favorite`)
    }
}
