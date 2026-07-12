# Test Plan — GH-005: Admin analytics dashboard

Explored live against MatchDay at `http://localhost:3010` (Next.js dev
server, seeded SQLite DB), using the seeded accounts `admin@matchday.dev`
(role ADMIN) and `fan@matchday.dev` (role USER), plus an anonymous session.
All scenarios below were walked through by hand with the Playwright MCP
browser tools; see the Evidence line on each for what was actually observed.

**Layer note:** every scenario here is tagged `Layer: UI`. `/admin` is a
single server-rendered document — `browser_network_requests` during the
dashboard load showed exactly one relevant request, `GET /admin => 200`
(the document navigation itself, listed under "static"), plus the
unrelated `GET /api/me => 200` auth-check the nav bar always makes. There
is no separate XHR/fetch call that returns the dashboard's numbers, so
there is nothing to tag as an API-layer scenario — the data is baked into
the server-rendered HTML on each navigation, consistent with a Next.js
Server Component doing direct Prisma queries as described in the task.

**Environment note for whoever automates this:** during exploration this
session, the shared dev browser repeatedly showed signs of a *second,
concurrent actor* driving the same session — spontaneous navigations to
random team pages, a "+ Follow"/"✓ Following" toggle firing with no click
from me, and the logged-in user silently flipping between the fan and
admin seeded accounts between my own tool calls. This was not something I
triggered (confirmed by closing and re-opening a clean tab and by explicit
timing tests). It made single, isolated actions (e.g. "type email, type
password, submit") unreliable if spaced out, but batching a full
navigate→fill→fill→submit→navigate sequence together consistently worked
and produced clean, reproducible evidence (see Scenario 6, where I
captured a clean before/after pair). Automated tests should log in and
act within a single tight flow per test and avoid relying on session state
surviving idle gaps, and should be run against a dedicated/non-shared
browser context if this recurs.

## Scenarios

### 1. Anonymous visitor cannot reach the admin dashboard
**Layer:** UI
**Preconditions:** Fresh/anonymous session (logged out), no cookies.
**Steps:**
1. Navigate directly to `/admin`.
**Expected outcome:** The browser is redirected to
`/login?redirectTo=/admin` and the login form (Email, Password, "Log in"
button) is shown — no dashboard content or admin data is ever rendered.
**Evidence:** Navigating to `http://localhost:3010/admin` as a fresh
anonymous session immediately resulted in `Page URL:
http://localhost:3010/login?redirectTo=/admin` with the standard login
form rendered; reproduced twice.

### 2. A logged-in fan (non-admin) cannot reach the admin dashboard
**Layer:** UI
**Preconditions:** A seeded USER-role account (`fan@matchday.dev`) is
logged in.
**Steps:**
1. While logged in as `fan@matchday.dev`, navigate directly to `/admin`.
**Expected outcome:** The browser is redirected to
`/login?redirectTo=/admin` and shown the login form — same gate as the
anonymous case. The fan's existing session is not destroyed by this (the
nav bar still shows them logged in, e.g. "Log out (Sample Fan)"), they are
simply denied the admin route and sent to log in again; no dashboard
content is rendered for them at any point.
**Expected outcome (fan role has no "Admin" nav link):** the "Admin" nav
link/sub-nav (Dashboard/Events/Venues/Teams) that appears for an admin
session is absent for a fan session.
**Evidence:** Logged in as `fan@matchday.dev`, then navigated to
`http://localhost:3010/admin`; landed on `Page URL:
http://localhost:3010/login?redirectTo=/admin` showing the login form,
while the nav bar (captured in the same snapshot) still read "Log out
(Sample Fan)" — confirming the fan's session was intact but the route
itself redirected them away. Also observed throughout exploration that
the fan's nav bar never includes an "Admin" link (only Events / Teams / My
Bookings / Log out), whereas the admin's nav bar additionally shows
"Admin", confirmed side by side in separate snapshots.

### 3. Admin sees headline platform counts and total revenue
**Layer:** UI
**Preconditions:** A seeded ADMIN-role account (`admin@matchday.dev`) is
logged in.
**Steps:**
1. Navigate to `/admin`.
2. Observe the row of headline stat cards at the top of the dashboard.
**Expected outcome:** Five stat cards are shown: "Events" (total event
count on the platform), "Venues", "Teams", "Bookings" (total confirmed
booking count), and "Revenue" (total revenue across confirmed bookings,
formatted as a dollar amount). The nav bar also gains an "Admin" link, and
`/admin` itself shows a sub-nav with "Dashboard" / "Events" / "Venues" /
"Teams" tabs (Dashboard active).
**Expected outcome:** the page renders directly on the `GET /admin`
document response with no separate loading spinner/XHR call for this data
(see Layer note above).
**Evidence:** Logged in as `admin@matchday.dev` and navigated to
`/admin`; snapshot showed heading "Admin dashboard" with five stat cards:
"16 / Events", "6 / Venues", "23 / Teams", "2 / Bookings", "$402 /
Revenue" (values as seeded at time of this pass — see Scenario 6 for how
these change). Nav bar showed "Events / Teams / My Bookings / Admin / Log
out (Admin)", and a sub-nav under the "Admin dashboard" heading linked to
`/admin`, `/admin/events`, `/admin/venues`, `/admin/teams`.

### 4. Admin sees revenue broken down by sport
**Layer:** UI
**Preconditions:** Admin is logged in, on `/admin`.
**Steps:**
1. Observe the "Revenue by sport" panel on the dashboard.
**Expected outcome:** A labeled bar-chart-style breakdown lists each sport
on the platform (Football, Cricket, Basketball) with its own dollar
revenue figure and a proportional bar; sports with $0 in confirmed
bookings still appear (with a $0 figure / near-zero bar) rather than being
omitted, and the per-sport figures sum to the headline "Revenue" total.
**Evidence:** Screenshot of the dashboard showed a "Revenue by sport"
panel with three rows: "Football — $1059-px-wide bar — $402", "Cricket —
sliver bar — $0", "Basketball — sliver bar — $0" (baseline pass); the
three figures ($402 + $0 + $0) summed to the headline Revenue figure
($402). Re-confirmed after a new Basketball booking in Scenario 6, where
the Basketball row changed from $0 to $45 and Football/Cricket stayed
unchanged.

### 5. Admin sees seats sold vs. available per upcoming/live event
**Layer:** UI
**Preconditions:** Admin is logged in, on `/admin`.
**Steps:**
1. Observe the "Seats sold vs available" panel on the dashboard.
**Expected outcome:** A legend shows "Sold" (red) / "Available" (green).
Below it, one row per upcoming-or-live event lists the fixture name (e.g.
"ARS vs MCI"), a two-color bar proportional to sold/available seats, and
an "X/Y" sold-over-total count. A sold-out event's bar is fully red
("44/44"); an untouched event's bar is fully green ("0/44"); a
partially-sold event shows a mixed bar with the correct split. Finished
(past) events are not included in this list.
**Evidence:** Snapshot showed rows for "LIV vs CHE" (0/44, currently
LIVE), "ENG vs RSA" (0/44, LIVE), "MI vs CSK" (44/44, sold out per its
home-page "Sold out — join waitlist" badge), "RMA vs BAR" (44/44, sold
out), "ARS vs MCI" (6/44 — matching its home-page badge "38 seats
available"), "LAL vs BOS" (0/38), "IND vs AUS" (0/44), "MUN vs TOT"
(0/44) — 8 rows total. Cross-checked against the full event list on `/`:
16 events exist, 5 are "Finished" (not shown on the dashboard, e.g. "ARS
vs CHE", "MCI vs MUN"), and of the 11 upcoming/live events, the dashboard
showed only the 8 with the nearest start times (by "Starts in Xd Xh"),
omitting the 3 furthest out ("KKR vs RCB" 6d23h, "BOS vs MIA" 7d23h, "ATM
vs RMA" 8d23h) — the panel appears to cap at the 8 nearest upcoming/live
fixtures rather than listing every one; note this as expected behavior
when writing an assertion (assert on the specific events observed, don't
assert the panel lists literally every non-finished event).

### 6. Dashboard numbers reflect real, freshly-completed booking activity (not a cached snapshot)
**Layer:** UI
**Preconditions:** Admin account and fan account both exist (seeded).
Start by capturing the dashboard's current baseline as the admin.
**Steps:**
1. Logged in as admin, navigate to `/admin` and record the current
   "Bookings" and "Revenue" headline figures, the current sold/available
   count for one specific not-sold-out event, and the current per-sport
   revenue figure for that event's sport.
2. Switch to the fan account (`fan@matchday.dev`), navigate to that same
   event, select exactly one available seat, click "Proceed to checkout",
   confirm the itemized price on the checkout page, then click "Confirm
   booking".
3. Switch back to the admin account and navigate to `/admin` again.
**Expected outcome:** Without any manual refresh/cache-bust beyond a
normal navigation, the dashboard now shows: "Bookings" incremented by
exactly 1; "Revenue" increased by exactly the price of the seat just
booked; the booked event's sold count incremented by 1 (available count
decremented by 1); and that event's sport bucket in "Revenue by sport"
increased by the same seat price, while the other sport buckets are
unchanged.
**Evidence:** Baseline (admin, before booking): "16 Events / 6 Venues /
23 Teams / **2 Bookings** / **$402 Revenue**"; "LAL vs BOS: **0/38**";
Revenue by sport "Football $402, Cricket $0, **Basketball $0**". Then, as
`fan@matchday.dev`, booked 1 seat ("Courtside · Row 1, Seat 1 — $45.00")
on the LAL vs BOS event (id `cmrg4zg4500ikru5lmho1izy8`); checkout showed
Total "$45.00"; confirming landed on
`/bookings?confirmed=cmrg5hgah001nru4xjvaokktg` with "Booking confirmed!
Your tickets are below." and a card for "LAL vs BOS ... Courtside · Row 1,
Seat 1 ... $45.00". Back on `/admin` as admin immediately afterward (same
navigation, no special refresh): "16 Events / 6 Venues / 23 Teams / **3
Bookings** / **$447 Revenue**" (+1 booking, +$45 — exactly the seat's
price); "LAL vs BOS: **1/38**" (+1 sold); Revenue by sport "Football $402
(unchanged), Cricket $0 (unchanged), **Basketball $45**" (up from $0 by
exactly $45). Screenshots saved during exploration (gitignored local
evidence, not committed):
`.playwright-mcp/admin-dashboard-baseline.png` (pre-booking) and
`.playwright-mcp/admin-dashboard-after-booking.png` (post-booking) show this
side by side.

## Notes for the Generator / next human reviewer

- All six acceptance criteria in the requirement were verified live and
  are covered above; nothing was rejected as unsupported for this
  requirement, so no `specs/rejected/GH-005-unsupported.md` file was
  written.
- Scenario 5's "8 nearest upcoming/live events" cap is an observed
  behavior, not something the requirement asked for explicitly — treat it
  as a real constraint to assert on (e.g. "the panel shows the N nearest
  non-finished fixtures", with N confirmed as 8 at exploration time) but
  flag to a human if that cap ever looks like it should be configurable
  or is actually a bug (a dashboard that silently drops "seats sold" data
  for fixtures further than ~8 events out could hide real availability
  problems on a busier platform).
- Scenario 6 necessarily mutates shared DB state (creates one real,
  non-cancellable booking) — by design, since "reflects real activity" is
  only provable by making real activity happen. Automating this
  repeatably will require either picking an event/section with enough
  spare seats to survive repeat runs, or resetting seed data between
  runs; don't hardcode the baseline numbers from this pass (2 Bookings /
  $402 / etc.) as fixed expected values in the automated test — assert on
  the *deltas* (Bookings +1, Revenue +seat price, sold count +1, that
  sport's bucket +seat price) the way this scenario is written.
- See the "Environment note" above the scenarios about session/browser
  contention observed during this exploration pass — worth a sanity check
  with a fresh/dedicated browser context before trusting a flaky
  automated run of these tests.
