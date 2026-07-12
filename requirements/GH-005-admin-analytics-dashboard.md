# GH-005: Admin analytics dashboard

**As a** MatchDay admin
**I want to** see a dashboard of overall platform activity and revenue
**So that** I can understand how the business is performing without querying
the database directly

## Acceptance criteria

- The admin dashboard is only reachable by a logged-in admin — a regular fan
  account or an anonymous visitor cannot view it.
- The dashboard shows headline counts: total events, venues, and teams on
  the platform.
- The dashboard shows total revenue across all confirmed bookings.
- The dashboard breaks revenue down by sport (e.g. Football, Cricket,
  Basketball).
- The dashboard shows, per upcoming event, how many seats are sold versus
  still available.
- The numbers shown reflect real booking activity — e.g. confirming a new
  booking as a fan (GH-001) is reflected in the admin dashboard's totals
  afterward, not a static or cached snapshot.
