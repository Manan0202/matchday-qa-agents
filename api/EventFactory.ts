import { APIRequestContext } from '@playwright/test'
import { AdminEventsApi, CreateEventPayload } from './AdminEventsApi'
import { AdminTeamsApi } from './AdminTeamsApi'
import { AdminVenuesApi } from './AdminVenuesApi'
import { EventsApi } from './EventsApi'

export type FreshEvent = {
    id: string
    matchLabel: string // e.g. "ARS vs MCI" — what HomePage's event card text actually shows
    league: string // unique per call — see buildValidEventPayload for why
    venueName: string
    sectionName: string
    pricePerSeat: number
}

// Assembles a valid create-event payload from real, currently-seeded data
// (sport, two distinct teams, a venue and its real section ids) rather than
// hardcoding ids that shift on every reseed. Shared by
// tests/api/admin-events.spec.ts and any E2E suite that needs a *fresh,
// dedicated* event with guaranteed-available seats, isolated from every
// other test's inventory (unlike GH-001, which shares the seeded
// "ARS vs MCI" fixture and has to run serially because of it).
export async function buildValidEventPayload(
    request: APIRequestContext,
    pricePerSeat = 50
): Promise<{
    payload: CreateEventPayload
    matchLabel: string
    league: string
    venueName: string
    sectionName: string
}> {
    const events = new EventsApi(request)
    const teamsApi = new AdminTeamsApi(request)
    const venuesApi = new AdminVenuesApi(request)

    const eventList = await (await events.list()).json()
    const sportId = eventList[0].sport.id as string

    const teams = await (await teamsApi.list()).json()
    const sameSport = teams.filter((t: { sportId: string }) => t.sportId === sportId)
    const [homeTeam, awayTeam] = [sameSport[0], sameSport[1]]

    const venues = await (await venuesApi.list()).json()
    const venue = venues.find((v: { sections: { id: string; name: string }[] }) => v.sections.length > 0)
    const section = venue.sections[0]

    // Team pair and venue are picked deterministically (always the same
    // first candidates), so two events created around the same time — e.g.
    // by two spec files running in parallel — would otherwise render
    // identical "HOME vs AWAY" text. Some pages (the admin events table)
    // have no id anywhere in their DOM to disambiguate by, unlike the home
    // page's href-based lookup — so the league name is made unique per
    // call instead, and callers that need to find one specific row scope
    // by matchLabel + league together.
    const league = `QA Test League ${Date.now()}-${Math.floor(Math.random() * 100_000)}`

    return {
        payload: {
            sportId,
            league,
            homeTeamId: homeTeam.id,
            awayTeamId: awayTeam.id,
            venueId: venue.id,
            startTime: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            sectionPrices: venue.sections.map((s: { id: string }) => ({ sectionId: s.id, price: pricePerSeat })),
        },
        matchLabel: `${homeTeam.shortName} vs ${awayTeam.shortName}`,
        league,
        venueName: venue.name,
        sectionName: section.name,
    }
}

// Creates the event via the Admin API and returns everything a UI test
// needs to find and assert on it (label text, venue/section names, price)
// without ever touching a hardcoded seed-data id.
export async function createFreshEvent(request: APIRequestContext, pricePerSeat = 50): Promise<FreshEvent> {
    const { payload, matchLabel, league, venueName, sectionName } = await buildValidEventPayload(
        request,
        pricePerSeat
    )
    const created = await (await new AdminEventsApi(request).create(payload)).json()
    return { id: created.id, matchLabel, league, venueName, sectionName, pricePerSeat }
}
