# Test Plan — GH-003: Follow favorite teams

Explored live against MatchDay at `http://localhost:3010` (Next.js dev
server, seeded SQLite DB) using the Playwright MCP browser tools, with
`browser_network_requests` used to capture the real network calls behind the
follow/unfollow button before writing anything below.

Test accounts used: seeded `fan@matchday.dev` / `password123` (display name
"Sample Fan", already following Arsenal and Mumbai Indians per the seed
data) and seeded `admin@matchday.dev` / `password123` (no follows).

**Environment note:** this dev server/browser session was noticeably
unstable during exploration — auth state flipped between anonymous, "Sample
Fan", and "Admin" without my requesting a change, and the browser
occasionally client-side-navigated to an unrelated event page
(`/events/cmrg4zg3p008uru5l4ebfj3a4`, "RMA vs BAR") mid-interaction. This
looks like shared/contended session state in the dev environment (possibly
another process/agent using the same server) rather than anything caused by
the follow feature itself, but it's worth knowing about if these scenarios
are flaky when automated: prefer fresh logins immediately before each
scenario and re-snapshot before every click rather than chaining actions on
stale element references.

**Correction (post-review):** an earlier pass of this plan rejected the
anonymous-follow acceptance criterion, reporting a 500 error and no login
prompt. That finding was re-verified independently in a clean, non-shared
browser session (logged out via the UI, confirmed anonymous nav state
immediately before clicking) and did **not** reproduce — see scenario 7
below for the actual, correct behavior, and `specs/rejected/GH-003-unsupported.md`
for the retraction and root-cause explanation (contended shared browser
state from three Planner agents running concurrently, not a MatchDay bug).
All six acceptance criteria in the requirement are verified and covered
below.

## Scenarios

### 1. Logged-in fan follows a team from the team page
**Layer:** API
**Preconditions:** Logged in as a fan account (e.g. `fan@matchday.dev` /
`password123`). The target team is not currently followed by this account.
**Steps:**
1. Log in and navigate to `/teams/<teamId>` for a team the account does not
   currently follow (verified with Liverpool, `cmrg4zg180008ru5lqjmt70rt`,
   which fan@matchday.dev does not follow by default).
2. Click the "+ Follow" button.
**Expected outcome:** The client sends `POST /api/teams/<teamId>/favorite`
and receives a `200 OK`. The button immediately updates to "✓ Following"
without a full page navigation/reload.
**Evidence:** Directly observed via `browser_network_requests`:
`POST http://localhost:3010/api/teams/cmrg4zg180008ru5lqjmt70rt/favorite =>
[200] OK` fired the moment "+ Follow" was clicked on Liverpool's team page
while logged in as `fan@matchday.dev`. The page URL stayed at
`/teams/cmrg4zg180008ru5lqjmt70rt` throughout (no navigation), the button's
accessible name changed from "+ Follow" to "✓ Following", and a
`status`-role live region announced "Following team". No console errors
were logged for this request (contrast with scenario 6 below, where the
equivalent anonymous request throws a client-side parse error). Reloading
the team page afterward showed "✓ Following" persisted.

### 2. Logged-in fan unfollows a team by clicking Follow again
**Layer:** API
**Preconditions:** Logged in as a fan account that is currently following
the target team (e.g. follow Liverpool first per scenario 1, or use an
account/team pair that already has a follow relationship, such as
`fan@matchday.dev` + Arsenal from seed data).
**Steps:**
1. Navigate to `/teams/<teamId>` for a team the account currently follows,
   confirming the button reads "✓ Following".
2. Click the "✓ Following" button.
**Expected outcome:** The client sends `POST /api/teams/<teamId>/favorite`
again and receives a `200 OK`. The button reverts to "+ Follow" and the team
is no longer marked as followed.
**Evidence:** Directly observed via `browser_network_requests`:
`POST http://localhost:3010/api/teams/cmrg4zg180008ru5lqjmt70rt/favorite =>
[200] OK` fired again when clicking "✓ Following" on the same Liverpool
page immediately after scenario 1's follow. The button's accessible name
reverted to "+ Follow" in the resulting snapshot, and reloading the team
page afterward confirmed "+ Follow" persisted (i.e. the unfollow was
durable, not just a client-side flicker).

### 3. Follow button updates without a full page reload
**Layer:** UI
**Preconditions:** Logged in as a fan account, on a team page for a team
not currently followed.
**Steps:**
1. Note the current page URL.
2. Click "+ Follow".
3. Immediately check the page URL and the button state.
**Expected outcome:** The URL is unchanged (no navigation occurred) and the
button's label/state updates in place.
**Evidence:** On Liverpool's team page (`/teams/cmrg4zg180008ru5lqjmt70rt`),
clicking "+ Follow" left the URL at the exact same path in the very next
snapshot, with the button now reading "✓ Following" and an
`alert`/`status`-role element announcing "Following team" — both signs of a
client-side state update rather than a server-rendered page navigation.

### 4. Home page shows a personalized "Your teams" section for teams a fan follows
**Layer:** UI
**Preconditions:** Logged in as a fan account that follows at least one
team (seeded `fan@matchday.dev` follows Arsenal and Mumbai Indians by
default).
**Steps:**
1. Log in as `fan@matchday.dev`.
2. Navigate to `/` (home page).
**Expected outcome:** A "⭐ Your teams" section appears above the general
"🔥 Trending this week" / event-list sections, containing one card per
followed team. Each card shows "Following <Team name> · <League>", the
upcoming/live fixture matchup (e.g. "MI vs CSK"), and a status/countdown
(e.g. "Starts in 23h 52m" or "LIVE"), and links to that fixture's event
page.
**Evidence:** Observed on `http://localhost:3010/` while logged in as
`fan@matchday.dev`: a "⭐ Your teams" heading followed by two cards —
"🏏 Following Mumbai Indians · IPL / MI vs CSK / Starts in 23h 52m" (linking
to `/events/cmrg4zg3t00bmru5le8mpti1j`) and "⚽ Following Arsenal · Premier
League / ARS vs MCI / Starts in 2d 23h" (linking to
`/events/cmrg4zg3f001wru5livpnjyky`). This was reproduced across multiple
independent logins during exploration, always showing the same two teams
for this account.

### 5. "Your teams" section updates immediately to reflect newly followed/unfollowed teams
**Layer:** UI
**Preconditions:** Logged in as a fan account.
**Steps:**
1. Follow a team not currently in the account's "Your teams" list (e.g.
   Liverpool, per scenario 1).
2. Navigate to `/`.
3. Unfollow that same team (per scenario 2).
4. Navigate to `/` again.
**Expected outcome:** After step 2, the newly followed team's card appears
in "⭐ Your teams" alongside any pre-existing follows. After step 4, that
card disappears again, leaving the pre-existing follows untouched.
**Evidence:** After following Liverpool, the home page's "⭐ Your teams"
section showed three cards: "⚽ Following Liverpool · Premier League / LIV
vs CHE / LIVE", plus the pre-existing Mumbai Indians and Arsenal cards.
After unfollowing Liverpool and revisiting `/`, the section reverted to
showing only the Mumbai Indians and Arsenal cards — Liverpool's card was
gone, and the other two were unaffected.

### 6. Following state is tied to the account, not the browser — persists across logins
**Layer:** UI
**Preconditions:** A fan account with at least one followed team.
**Steps:**
1. Log in as the fan account and follow (or confirm following) a team.
2. Log out.
3. Log back in as the same fan account.
4. Revisit that team's page and/or the home page.
**Expected outcome:** The follow state from step 1 is still present after
logging back in — it was not tied to browser-local storage that a fresh
session would lack.
**Evidence:** Performed this log-out/log-back-in cycle multiple times
during exploration as `fan@matchday.dev`. Each time, after logging back in
and navigating to a previously-followed team's page (or the home page),
the exact same follow state was shown: Liverpool's button read "✓
Following" immediately after a fresh login when it had been followed
before logging out, and "+ Follow" after a fresh login following an
unfollow — consistent across at least four separate login cycles. Because
this requires authentication to even see the "+ Follow"/"✓ Following"
distinction reflect a specific account (an anonymous visitor always sees
"+ Follow", per the team-page render observed in scenario 1's setup), and
the same browser showed *different* follow states for the same team
depending on which account was logged in (fan@matchday.dev showed "✓
Following" for Liverpool at one point; admin@matchday.dev, never having
followed it, showed "+ Follow" for the same team in the same browser), the
state is clearly keyed by account server-side rather than by
browser/device.

### 7. An anonymous visitor is redirected to log in when they try to follow a team
**Layer:** UI
**Preconditions:** Genuinely anonymous session — logged out via the UI
immediately beforehand, confirmed by the nav showing "Log in"/"Sign up"
(not "Log out (...)") right before the click.
**Steps:**
1. Navigate to a team page while logged out.
2. Click "+ Follow".
**Expected outcome:** The browser navigates to `/login`. No
`POST /api/teams/<teamId>/favorite` request is made — the redirect happens
client-side before any network call.
**Evidence:** Re-verified directly (not via a Planner subagent) in a clean
session: logged out via the "Log out" nav button, confirmed the nav showed
"Log in"/"Sign up" links and the page URL was still `/teams/cmrg4zg180006ru5lek1ec3en`,
then clicked "+ Follow". The browser navigated straight to `/login`;
`browser_network_requests` filtered for "favorite" showed zero matching
requests since the last navigation; the only console errors were benign
401s on `GET /api/me` (expected for an anonymous session). This matches
`FollowButton.tsx`'s `handleClick`, which checks a `loggedIn` prop and calls
`router.push('/login')` before ever calling `fetch` when it's false.

## Notes for the Generator / next human reviewer

- Scenarios 1 and 2 are tagged `Layer: API` per the toggle mechanics
  (`POST /api/teams/<teamId>/favorite`, 200 on success). The available
  network-inspection tooling exposed method/URL/status but not response
  bodies, so the exact `{ favorited: boolean }` shape could not be read
  byte-for-byte during this pass — only the status code and the resulting
  UI/persisted state (which is consistent with that contract) were directly
  observed. Whoever implements these as request-only tests should assert on
  status code and, if the real response body is inspectable in code (e.g.
  via `request.post(...)` in Playwright), also assert the `favorited` field
  flips as expected.
- Given the environment instability noted above, expect element references
  to go stale between a snapshot and a click more often than usual in this
  app; re-snapshot immediately before interacting with the follow button
  rather than reusing an older ref.
- **Do not dispatch multiple Planner (or Healer) agents concurrently against
  this app.** They share one Playwright MCP browser session — running them
  in parallel causes real cross-contamination (auth state flips, spontaneous
  navigation), which produced exactly one false-positive bug report in this
  plan's first pass (see `specs/rejected/GH-003-unsupported.md`). The
  Generator agent is unaffected by this — it drives its own isolated browser
  contexts via `npx playwright test`, not the shared MCP session — so
  Generator runs can still be parallelized safely.
