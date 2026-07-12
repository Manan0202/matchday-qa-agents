# Test Plan — GH-004: Waitlist for sold-out events

## Scenarios

### 1. Sold-out event page hides the seat map and offers a waitlist instead
**Layer:** UI
**Preconditions:** Fresh/anonymous browser state is fine — this page renders
the same regardless of auth. Use the seeded sold-out event RMA vs BAR
(`/events/cmrg4zg3p008uru5l4ebfj3a4`, La Liga, "Real Madrid vs FC Barcelona").
**Steps:**
1. Navigate directly to `/events/cmrg4zg3p008uru5l4ebfj3a4`.
2. Wait for the event header ("Real Madrid vs FC Barcelona") to render.
3. Inspect the main content area.
**Expected outcome:** No seat-map grid, no "Available/Selected/Sold" legend,
and no "Proceed to checkout" control are present. Instead the page shows the
text "This event is sold out." and a button labeled "Join waitlist"
(`data-testid="join-waitlist"`).
**Evidence:** Live snapshot of the event page showed only:
`paragraph: "This event is sold out."` and `button "Join waitlist"` under the
event header — no seat-map elements at all (contrast with the non-sold-out
event in Scenario 6, which renders a full seat grid). The events list page
(`/`) also independently confirms this event's card is annotated
"Sold out — join waitlist" instead of "N seats available".

### 2. Logged-in fan joins the waitlist — API contract
**Layer:** API
**Preconditions:** Authenticated session as the seeded fan
(`fan@matchday.dev` / `password123`, USER role). Target the sold-out event
`cmrg4zg3p008uru5l4ebfj3a4` (RMA vs BAR). No assumption about prior waitlist
state — the endpoint is idempotent (see Scenario 3).
**Steps:**
1. As the authenticated fan, send `POST /api/events/cmrg4zg3p008uru5l4ebfj3a4/waitlist`
   (this is what the "Join waitlist" button's click handler calls — no request
   body was observed being sent; the user is identified via the session
   cookie).
**Expected outcome:** Response status `201 Created`.
**Evidence:** Captured directly via `browser_network_requests` after clicking
the "Join waitlist" button while logged in as Sample Fan:
`POST http://localhost:3010/api/events/cmrg4zg3p008uru5l4ebfj3a4/waitlist => [201] Created`.
Immediately after, the UI swapped the "Join waitlist" button for the text
"You're on the waitlist — we'll notify you if a seat opens up." (see
Scenario 4 for the UI-side assertion).

### 3. Joining the waitlist twice does not error — safe to click more than once
**Layer:** API
**Preconditions:** Authenticated session as the seeded fan. Target the
sold-out event `cmrg4zg3p008uru5l4ebfj3a4`. The fan may or may not already
have a waitlist entry for this event going in — the point of this test is
that it doesn't matter.
**Steps:**
1. `POST /api/events/cmrg4zg3p008uru5l4ebfj3a4/waitlist` as the fan.
2. Repeat the identical `POST /api/events/cmrg4zg3p008uru5l4ebfj3a4/waitlist`
   call as the same fan (simulating a second click, e.g. after a page
   reload).
**Expected outcome:** Both calls return `201 Created` with no error status
(no 409/400) and no server error. The endpoint upserts the fan's
`WaitlistEntry` rather than inserting a duplicate row.
**Evidence:** Reproduced live: reloaded the event page (which resets the
client-side "joined" banner back to a fresh "Join waitlist" button, since
that confirmation is client state, not re-fetched on load) and clicked
"Join waitlist" a second time as the same already-registered fan. Network
log showed the identical response both times:
`POST .../waitlist => [201] Created` — no error, no different status code
the second time. (Note: DB-level row uniqueness was not directly inspected
since no DB access was available during exploration; this scenario verifies
the observable API contract — repeated calls succeed identically — which is
the behavior the requirement describes as "safe to click more than once.")

### 4. Confirmation banner renders after joining
**Layer:** UI
**Preconditions:** Authenticated session as the seeded fan. Target the
sold-out event `cmrg4zg3p008uru5l4ebfj3a4`.
**Steps:**
1. Navigate to `/events/cmrg4zg3p008uru5l4ebfj3a4` while logged in.
2. Confirm the "Join waitlist" button (`data-testid="join-waitlist"`) is
   visible.
3. Click "Join waitlist".
**Expected outcome:** The button disappears and is replaced by the text
"You're on the waitlist — we'll notify you if a seat opens up." A toast/status
region also announces "You're on the waitlist!".
**Evidence:** Directly observed in a live snapshot immediately after
clicking: `generic: "You're on the waitlist — we'll notify you if a seat
opens up."` replacing the sold-out paragraph and button, plus a separate
`status: "You're on the waitlist!"` element. Reloading the page afterward
reverts to showing the "Join waitlist" button again (this confirmation is
client-side post-click state, not persisted/re-fetched on page load — worth
noting so the Generator doesn't assert on it surviving a reload).

### 5. Anonymous visitor is sent to log in, then completes the join afterward
**Layer:** UI
**Preconditions:** Fresh/anonymous (logged-out) browser session. Target the
sold-out event `cmrg4zg3p008uru5l4ebfj3a4`.
**Steps:**
1. As an anonymous visitor, navigate to `/events/cmrg4zg3p008uru5l4ebfj3a4`.
2. Confirm the "Join waitlist" button is visible (sold-out UI renders the
   same regardless of auth).
3. Click "Join waitlist".
4. On the resulting login page, fill Email with `fan@matchday.dev`
   (`data-testid="email-input"`) and Password with `password123`
   (`data-testid="password-input"`), then submit
   (`data-testid="submit-button"`).
5. Observe the redirect target.
6. Once back on the event page, click "Join waitlist" again.
**Expected outcome:** Step 3 redirects to
`/login?redirectTo=%2Fevents%2Fcmrg4zg3p008uru5l4ebfj3a4` (URL-encoded path
back to the event). After a successful login, the app redirects back to
`/events/cmrg4zg3p008uru5l4ebfj3a4`. The page still shows the "Join
waitlist" button at that point — login alone does not auto-complete the
join. Clicking it again (step 6) succeeds and shows the same confirmation
as Scenario 4.
**Evidence:** Reproduced live end-to-end. Clicking "Join waitlist" while
anonymous fired `POST /api/events/cmrg4zg3p008uru5l4ebfj3a4/waitlist =>
[401] Unauthorized` in the background and the browser URL changed to
`http://localhost:3010/login?redirectTo=%2Fevents%2Fcmrg4zg3p008uru5l4ebfj3a4`.
After submitting valid credentials, network log showed
`POST /api/auth/login => [200] OK` followed by a navigation back to
`/events/cmrg4zg3p008uru5l4ebfj3a4`, where the sold-out page still displayed
the "Join waitlist" button (not yet joined). Clicking it produced
`POST .../waitlist => [201] Created` and the same "You're on the waitlist"
confirmation as Scenario 4.

### 6. Non-sold-out event shows no waitlist UI — seat map/checkout only
**Layer:** UI
**Preconditions:** Fresh/anonymous browser state is sufficient to view the
page (seat selection itself requires login per GH-001, but that's out of
scope here — this scenario only checks that no waitlist UI renders). Use an
upcoming event with seats remaining, e.g. ARS vs MCI
(`/events/cmrg4zg3f001wru5livpnjyky`, Premier League, "38 seats available"
on the events list).
**Steps:**
1. Navigate to `/events/cmrg4zg3f001wru5livpnjyky`.
2. Inspect the main content area.
**Expected outcome:** The page renders the full seat map (an
"Available / Selected / Sold" legend, per-section seat grids with
individually clickable seat buttons, a running "N seat(s) selected" /
price total, and a "Proceed to checkout" button). No "sold out" text and no
"Join waitlist" button appear anywhere on the page.
**Evidence:** Live snapshot of this event page showed sections "Lower Tier"
($120/seat) and "Club Level" ($45/seat) with individual seat buttons labeled
e.g. "Row 1 seat 2, available" / "Row 1 seat 1, sold" [disabled], a legend
row (Available/Selected/Sold), footer text "0 seat(s) selected" / "$0.00",
and a disabled "Proceed to checkout" button — with no occurrence of
"sold out" or "waitlist" text anywhere in the page tree. Contrast directly
with Scenario 1's sold-out rendering of the same page template for a
sold-out event.

## Rejected claims (if any)
None. All five acceptance criteria in the requirement were reproduced live
against the running app (using the seeded sold-out event RMA vs BAR,
`cmrg4zg3p008uru5l4ebfj3a4`, and the non-sold-out event ARS vs MCI,
`cmrg4zg3f001wru5livpnjyky`) and are covered by Scenarios 1–6 above.
