# GH-004: Waitlist for sold-out events

**As a** fan
**I want to** join a waitlist when an event is completely sold out
**So that** I get a chance at a seat if one frees up, instead of just being
turned away

## Acceptance criteria

- Visiting a sold-out event's page shows that it's sold out (no bookable
  seat map) and offers a way to join a waitlist instead.
- A logged-in fan can join the waitlist with one click, and the page
  confirms they've joined.
- Joining the waitlist twice for the same event does not create duplicate
  entries or errors — it's safe to click more than once.
- An anonymous (logged-out) visitor who tries to join a waitlist is sent to
  log in first, then can complete joining afterward.
- A non-sold-out event does not show any waitlist UI — the seat map and
  checkout flow (GH-001) is the only booking path while seats remain.
