# Test Plan — GH-001: Successful ticket booking

Explored live against MatchDay at `http://localhost:3010` (Next.js dev
server, seeded SQLite DB). All scenarios below were walked through by hand
with the Playwright MCP browser tools before being written down; see the
Evidence line on each for what was actually observed.

**Update (re-verification pass):** the app's database was reseeded between
the original exploration and this pass, so event/seat IDs below differ
across scenarios written on different days — each Evidence line uses
whatever IDs were live at the time it was captured. Scenario 4 was
specifically re-tested after a fix landed in
`matchday/src/app/checkout/page.tsx` for the checkout→login→checkout
redirect (previously documented as broken in
`specs/rejected/GH-001-unsupported.md`); see the "Re-verified" note in
scenario 4 for details, including a caveat about how it was tested.

Test accounts used during exploration:
- `qa.planner.gh001@example.com` / `TestPass123!`, self-registered via
  `/register` (first pass, pre-reseed — no longer valid after the DB was
  reseeded).
- `fan@matchday.dev` / `password123`, a seeded account (`prisma/seed.ts`),
  used for the re-verification pass.

Event used for the seat-map/checkout scenarios: **ARS vs MCI**, an upcoming
(not started, not sold out) Premier League fixture with two sections —
"Lower Tier" ($120/seat, 4 rows x 8 seats) and "Club Level" ($45/seat, 2
rows x 6 seats). Its ID changed across the DB reseed
(`cmrdewdeg001wzpd9y72ixnqt` → `cmrdg5atx001wzpkn1ejb6n01`); both are noted
where relevant.

## Scenarios

### 1. Browse and filter events by sport and league
**Preconditions:** Fresh/anonymous session, home page (`/`).
**Steps:**
1. Navigate to `/`.
2. Note the full, unfiltered event list under the sport/league filter bar.
3. Click the "⚽ Football" sport filter button.
4. Click the "La Liga" league filter button.
**Expected outcome:**
- After step 3, only football fixtures remain in the list, and the league
  filter row narrows to only the leagues that actually have football
  fixtures (e.g. "La Liga" and "Premier League" — "IPL", "International",
  "NBA" disappear).
- After step 4, the list narrows further to only football/La Liga fixtures
  (e.g. "RMA vs BAR", "ATM vs RMA"), and the "La Liga" button shows an
  active/selected state.
**Evidence:** Directly observed via snapshot: clicking "⚽ Football" left
only Premier League and La Liga buttons visible in the league row and
football-only cards in the list; clicking "La Liga" further narrowed the
list to exactly 2 events ("RMA vs BAR", "ATM vs RMA"), both tagged
"Football · La Liga", with the "La Liga" button marked `[active]`.

### 2. Seat map shows sections with live availability
**Preconditions:** Fresh/anonymous session.
**Steps:**
1. Navigate to `/` and click an upcoming, not-sold-out event (e.g. "ARS vs
   MCI").
2. Observe the seat map.
**Expected outcome:** The event page shows a legend (Available / Selected /
Sold), and the seat map is broken into named sections, each with a
price-per-seat label and a grid of numbered seat buttons per row. Seats
already booked by another transaction show as "sold" and are disabled;
untouched seats show as "available" and are clickable.
**Evidence:** Snapshot of the ARS vs MCI event page showed headings "Lower
Tier" ($120 / seat, rows 1–4, seats 1–8) and "Club Level" ($45 / seat, rows
1–2, seats 1–6), each seat rendered as a button labelled e.g. "Row 1 seat
1, available". After booking Lower Tier Row 2 Seats 3–4 in a later
scenario, revisiting the page showed those exact two buttons as "Row 2
seat 3, sold" / "Row 2 seat 4, sold" with `[disabled]`.

### 3. Selecting seats updates a running total
**Preconditions:** Fresh/anonymous session, on an upcoming event's page.
**Steps:**
1. Click one available seat.
2. Observe the summary bar at the bottom of the seat map.
3. Click three more available seats in the same section.
4. Click one previously-selected seat again to deselect it.
**Expected outcome:**
- After step 1: summary reads "1 seat(s) selected" and the price total
  equals that seat's price (e.g. "$120.00" for a Lower Tier seat); the
  "Proceed to checkout" button becomes enabled (it starts disabled at 0
  seats).
- After step 3 (4 seats total in one section): the total updates to the
  sum of all 4 seat prices, and a secondary discounted total appears.
- After step 4 (back to 3 seats): the discounted-total line disappears and
  the total reverts to the 3-seat sum.
**Evidence:** Selecting Lower Tier Row 1 Seat 1 changed the summary from "0
seat(s) selected / $0.00" to "1 seat(s) selected · add 3 more for 10% off /
$120.00" and enabled "Proceed to checkout" (no longer `[disabled]`).
Selecting 4 Club Level seats showed "4 seat(s) selected / $180.00 / $162.00
10% group discount". Deselecting one seat (back to 3) reverted the summary
to "3 seat(s) selected · add 1 more for 10% off / $135.00" with no discount
line.

### 4. Checkout requires login; anonymous user is redirected to log in, and returns to checkout after logging in
**Preconditions:** Fresh/anonymous session (logged out), on an upcoming
event's page with at least one seat selected.
**Steps:**
1. Select one or more available seats.
2. Click "Proceed to checkout".
3. On the resulting login page, log in with a valid account.
**Expected outcome:**
- Step 2: the browser navigates to `/login` (not `/checkout`), with a
  `redirectTo` query parameter referencing the intended checkout
  destination (event + selected seats). The login form (Email, Password,
  "Log in" button) is shown.
- Step 3: after a successful login, the browser lands back on
  `/checkout?event=<id>&seats=<the same seat ids>`, and the checkout page
  renders those exact seats itemized with their prices and a total — the
  user does not need to re-select seats.
**Evidence:**
- Redirect-to-login (step 2) was directly observed twice in the original
  pass: clicking "Proceed to checkout" with 1 seat selected, then again
  with 4 seats selected, navigated to
  `/login?redirectTo=...` with the event/seat info embedded in the query
  string. Also confirmed this is a general auth gate, not
  checkout-specific: navigating directly to `/bookings` while logged out
  redirected to `/login?redirectTo=/bookings`.
- **Return-to-checkout (step 3) — re-verified after a fix.** This was
  originally REJECTED_UNSUPPORTED (see git history of
  `specs/rejected/GH-001-unsupported.md`): logging in used to drop the
  user on the home page (`/`), losing their seat selection, because
  `matchday/src/app/checkout/page.tsx` built the redirect URL as
  `` `/login?redirectTo=/checkout?event=${eventId}&seats=${seats}` `` —
  the `seats` value, appended after a raw `&`, was parsed as a separate
  top-level `/login` query param instead of part of `redirectTo`, so it
  was silently dropped.
  Confirmed the fix in source: the same file now builds this as
  ```
  const target = `/checkout?event=${eventId}&seats=${seats}`
  redirect(`/login?redirectTo=${encodeURIComponent(target)}`)
  ```
  which correctly percent-encodes the nested query string.
  Live re-verification: the app's DB had been reseeded and its logout
  endpoint (`POST /api/auth/logout`) is currently returning `500 Internal
  Server Error` (confirmed reproducibly, 3 attempts — see note below),
  which blocked reaching a genuine logged-out session through the UI in
  this pass. As a faithful proxy that exercises the *exact* client-side
  code path a real anonymous user hits, I manually navigated to
  `/login?redirectTo=%2Fcheckout%3Fevent%3Dcmrdg5atx001wzpkn1ejb6n01%26seats%3Dcmrdg5atz002dzpkntalz67yj%2Ccmrdg5atz002ezpkndqkzhr7j`
  — i.e. the exact URL the fixed server code now produces for an
  anonymous checkout attempt with 2 selected seats — and submitted valid
  login credentials (`fan@matchday.dev`). The browser landed on
  `/checkout?event=cmrdg5atx001wzpkn1ejb6n01&seats=cmrdg5atz002dzpkntalz67yj,cmrdg5atz002ezpkndqkzhr7j`,
  and the checkout page correctly rendered both seats itemized ("Lower
  Tier · Row 1, Seat 1 — $120.00", "Lower Tier · Row 1, Seat 2 —
  $120.00") with Total "$240.00" — seat selection fully preserved. This
  confirms the fix: `AuthForm.tsx`'s `router.push(redirectTo)` now
  receives the complete, correctly-decoded target.
  **Caveat for whoever runs this as an automated test:** this scenario
  should still be exercised as a true end-to-end anonymous flow (real
  logout or a fresh browser context) once the logout regression below is
  fixed, rather than relying on the manual-URL proxy used here.

### 5. Logged-in user can complete checkout and see the booking on My Bookings
**Preconditions:** A registered/seeded user is logged in. Start from an
upcoming event's page.
**Steps:**
1. Select 2 available seats in the "Lower Tier" section ($120 each).
2. Click "Proceed to checkout".
3. On the checkout page, verify each selected seat is itemized with its
   price and a total is shown.
4. Click "Confirm booking".
5. Observe the resulting page.
**Expected outcome:**
- Step 2: because the user is already authenticated, the browser goes
  straight to `/checkout?event=...&seats=...` (no login redirect).
- Step 3: checkout lists both seats as "Lower Tier · Row X, Seat Y — $120.00"
  each, with a Total of $240.00.
- Step 5: after confirming, the browser lands on `/bookings` with a
  `confirmed=<bookingId>` query param, a "Booking confirmed! Your tickets
  are below." message, and a booking card showing the event name, venue,
  date, the exact 2 seats booked, and the total price ($240.00). The seats
  just booked now show as "sold" if you return to the event page.
**Evidence:** Selected Lower Tier Row 2 Seat 3 and Row 2 Seat 4 while
logged in as `qa.planner.gh001@example.com`; "Proceed to checkout" went
directly to `/checkout?event=...&seats=...` (no login gate). Checkout page
listed "Lower Tier · Row 2, Seat 3 — $120.00" and "Lower Tier · Row 2, Seat
4 — $120.00", Total "$240.00". After "Confirm booking", landed on
`/bookings?confirmed=cmrdfo8n00002zpwydcgd7mdo` showing "Booking confirmed!
Your tickets are below." and a card with "ARS vs MCI", "Emirates Stadium,
London", both seats listed, and "$240.00". Returning to the event page
afterward showed those two seats as "sold"/`[disabled]`.

### 6. Booking 4+ seats applies a 10% group discount, shown before and after confirming
**Preconditions:** A registered/seeded user is logged in. Start from an
upcoming event's page with at least 4 available seats in one section.
**Steps:**
1. Select 4 available seats in the "Club Level" section ($45 each).
2. Observe the running total on the event page.
3. Click "Proceed to checkout" and observe the checkout page breakdown.
4. Click "Confirm booking" and observe the My Bookings entry.
**Expected outcome:**
- Step 2: summary shows "4 seat(s) selected", the pre-discount total
  ($180.00) struck through/shown alongside a discounted total ($162.00)
  labeled "10% group discount".
- Step 3: checkout itemizes all 4 seats at $45.00 each, then shows
  "Subtotal $180.00", "Group discount (10%, 4 seats) -$18.00", "Total
  $162.00".
- Step 4: the My Bookings entry for this booking shows the same 4 seats
  and the discounted total, $162.00 — not the pre-discount $180.00.
**Evidence:** Selected Club Level Row 1 Seats 1–4 as logged-in user; event
page summary showed "4 seat(s) selected / $180.00 / $162.00 10% group
discount". Checkout page showed itemized "$45.00" x4, "Subtotal $180.00",
"Group discount (10%, 4 seats) -$18.00", "Total $162.00". After confirming,
`/bookings` listed a card for "ARS vs MCI" with all 4 "Club Level" seats
and price "$162.00" (the discounted total), alongside the earlier,
non-discounted $240.00 booking from scenario 5 — confirming multiple
bookings accumulate correctly and each keeps its own correct total.

### 7. Booking under 4 seats does not apply the group discount
**Preconditions:** A registered/seeded user is logged in. Start from an
upcoming event's page.
**Steps:**
1. Select 2 available seats in any section.
2. Observe the running total.
**Expected outcome:** No discount line appears; the total is simply
`seats x price-per-seat`, and the hint text suggests how many more seats
are needed for the discount.
**Evidence:** Selecting 2 Lower Tier seats showed "2 seat(s) selected ·
add 2 more for 10% off / $240.00" with no discounted-total line — matches
the $120 x 2 = $240 math exactly, confirming the discount only kicks in at
4+.

## Notes for the Generator / next human reviewer

- Scenario 4's "return to checkout" half is now verified as fixed, but the
  live re-verification used a manually-constructed URL rather than a true
  click-through anonymous session, because of the logout bug below. A real
  end-to-end automated test (anonymous session → select seats → checkout →
  login → assert on `/checkout` with seats intact) should still work once
  that's resolved, but re-run it once to be sure the manual-URL proxy
  didn't paper over some other anonymous-session-specific difference.

## Newly discovered issue (out of scope for GH-001, flagged for awareness)

**`POST /api/auth/logout` currently returns `500 Internal Server Error`,
and the "Log out" button silently fails (session cookie is not cleared,
user stays logged in).** Reproduced 3 times in a row via the "Log out"
nav button, confirmed via `browser_network_requests`
(`POST http://localhost:3010/api/auth/logout => [500]`). Also observed
`GET /register` returning a plain "Internal Server Error" page (not the
registration form) during the same session, so registration may be
similarly affected — not fully isolated. GH-001 doesn't assert logout or
registration behavior directly, so no scenario was written for it here,
but it blocked the ideal re-verification method for scenario 4 above and
is worth a human's attention; it may be a transient dev-server issue
(e.g. stale build after the checkout fix landed) rather than a code
regression — worth confirming with a clean server restart before filing.
