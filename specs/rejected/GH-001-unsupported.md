# Rejected claims — GH-001: Successful ticket booking

**Status: resolved.** Everything below was originally rejected during the
first planning pass and has since been fixed and re-verified live. It's
kept here (rather than deleted) as an audit trail. The now-passing
scenario lives in `specs/GH-001-plan.md` (scenario 4); there are currently
no unresolved rejected claims for GH-001.

## "...an anonymous user is redirected to log in first and returned to checkout afterward" — RESOLVED

**Original claim (from the requirement):** After an anonymous visitor
selects seats, clicks checkout, is sent to log in, and logs in
successfully, they should land back on checkout with their seat selection
intact so they can finish booking.

**Original finding (first pass):** The redirect-to-login half worked. The
"returned to checkout afterward" half did not — tested twice live (1 seat,
4 seats), login always dropped the user on the home page (`/`), losing the
seat selection, with no error shown. Root cause found in
`matchday/src/app/checkout/page.tsx:21`:
```
redirect(`/login?redirectTo=/checkout?event=${eventId}&seats=${seats}`)
```
The `seats` value was appended after an unescaped `&` inside an otherwise
unescaped value, so the browser's query-string parser split it off as a
second top-level `/login` param instead of treating it as part of
`redirectTo`. `AuthForm.tsx` only reads `searchParams.get('redirectTo')`,
so it resolved to `/checkout?event=<id>` with no seats, and
`checkout/page.tsx` treats a checkout URL with no seats as invalid and
bounces it to `/`.

**Fix applied (confirmed in source on re-verification):**
```
const target = `/checkout?event=${eventId}&seats=${seats}`
redirect(`/login?redirectTo=${encodeURIComponent(target)}`)
```
The nested query string is now percent-encoded before being embedded in
`redirectTo`, so it survives the round trip intact.

**Re-verification (this pass):** Confirmed the fix live. The app's DB had
been reseeded since the first pass, and its `POST /api/auth/logout`
endpoint is currently returning `500 Internal Server Error` (reproduced 3
times), which blocked reaching a genuine anonymous session via the UI's
"Log out" button in this session. As a faithful proxy — exercising the
exact client-side code path a real anonymous user would hit — I navigated
directly to the exact URL the fixed server code now produces for an
anonymous 2-seat checkout attempt
(`/login?redirectTo=%2Fcheckout%3Fevent%3D...%26seats%3D...%2C...`) and
submitted valid credentials. The browser correctly landed on
`/checkout?event=...&seats=...` with both seats intact, and the checkout
page rendered them itemized with the correct total. See scenario 4 in
`specs/GH-001-plan.md` for full detail and the caveat that a true
click-through anonymous-session test should still be run once the logout
regression (noted there) is fixed, to rule out any anonymous-session-only
difference the manual-URL proxy might have missed.

**Verdict:** No longer rejected. Scenario 4 in the approved plan now
covers both halves of this claim (redirect-to-login and return-to-checkout).
