# MatchDay Agentic QA Framework

An AI-assisted quality engineering framework: three Claude Code subagents —
Planner, Generator, Healer — that plan, write, and fix Playwright tests for
[MatchDay](https://github.com/Manan0202/matchday), with a human approval gate
between planning and code generation, and an evidence-based guardrail against
the Planner hallucinating features that don't actually exist.

## Pipeline

```text
requirements/GH-XXX.md
        ↓
Planner agent explores MatchDay live via Playwright MCP, tagging each
scenario Layer: UI or Layer: API based on what it actually observed
        ↓
specs/GH-XXX-plan.md (evidence-based; unsupported claims → specs/rejected/)
        ↓
Human reviews and approves the plan
        ↓
Generator agent writes tests/*.spec.ts (reusing pages/, api/, fixtures/, test-data/)
        ↓
GitHub Actions runs the suite
        ↓
Pass → done.  Fail → Healer agent investigates and proposes the smallest fix
        ↓
Human reviews and approves the fix
```

**Hard rule:** never dispatch multiple Planner (or Healer) agents concurrently
— they share one Playwright MCP browser session, and running them in
parallel causes real cross-contamination (auth state flips, spontaneous
navigation). This produced one false-positive bug report during development
(see `specs/rejected/GH-003-unsupported.md`'s retraction). The Generator is
unaffected — it drives isolated browser/request contexts via
`npx playwright test`, not the shared MCP session — so Generator runs can
still be parallelized safely.

## Three test layers — a real testing pyramid, not just E2E

```text
tests/unit/         Pure functions, no server, no network — milliseconds.
                     Covers this repo's own oracles (utils/pricing.ts).
tests/api/           HTTP-only via Playwright's `request` fixture — no
                     browser. Covers MatchDay's REST contract directly:
                     status codes, response bodies, auth boundaries,
                     negative/edge cases, race conditions, data isolation.
tests/smoke/          Full browser E2E — critical-path user flows.
tests/regression/     Full browser E2E — broader coverage, including
                     network-interception tests (page.route()) that mock
                     backend failures to test frontend error handling
                     deterministically (error-handling.spec.ts), and a
                     test.beforeEach/afterEach-driven journey suite that
                     creates/tears down its own isolated fixture event via
                     the Admin API per test instead of sharing GH-001's
                     seeded event (full-booking-journey.spec.ts).
```

All three run as separate Playwright projects (`playwright.config.ts`) and
share one `npm test`. A single approved plan can produce a matched pair of
specs — one per layer — when a scenario is backed by both an observable API
call and user-visible UI behavior.

## Project structure

```text
.claude/agents/          Planner, Generator, Healer subagent definitions
.mcp.json                Playwright MCP server config (browser control)
requirements/             Input: user stories + acceptance criteria (GH-XXX.md)
specs/                    Output of the Planner: approved test plans
specs/rejected/           Claims the Planner couldn't verify against the live app
pages/                    Page Object Model — one class per MatchDay screen
api/                      API Object Model — one class per MatchDay REST
                          resource (AuthApi, EventsApi, BookingsApi,
                          FavoritesApi, WaitlistApi, AdminEventsApi,
                          AdminTeamsApi, AdminVenuesApi), the request-only
                          counterpart to pages/. Covers every HTTP verb
                          MatchDay exposes — GET, POST, PUT, DELETE.
fixtures/                 Shared Playwright fixtures (auth, seeded state, ...)
test-data/                 Reusable sample data (e.g. seeded account creds)
utils/                    Pure helpers with no network calls (pricing oracle,
                          currency formatting, test-user generation)
tests/unit/                Fast pure-function specs (no server)
tests/api/                 Request-only specs (no browser)
tests/smoke/               Fast, critical-path E2E specs
tests/regression/          Broader E2E coverage
```

## Why MatchDay, and why this matters

MatchDay is a real (if small) app with a real backend, so the Planner has to
actually explore it rather than pattern-match against a trivial demo site —
a seat map, a waitlist for sold-out events, an auth-gated checkout, group
discounts, an admin panel.

`requirements/GH-002-hallucination-challenge.md` is a deliberate test of the
Planner itself: it mixes a real feature (the waitlist) with three that don't
exist in MatchDay (in-app payment method selection, promo codes, and email
receipts). The Planner is expected to verify each claim against the live app
and reject the unsupported ones into `specs/rejected/`, rather than trusting
the requirement document at face value.

`GH-003`–`GH-005` cover following/favoriting teams, the sold-out-event
waitlist, and the role-gated admin analytics dashboard — chosen because each
exercises a different shape of coverage: a toggling API contract, an
idempotent join-with-auth-redirect flow, and a UI-only feature with no REST
route behind it at all (a Server Component doing direct Prisma queries),
which the Planner correctly recognized and tagged accordingly rather than
forcing an API scenario that doesn't exist.

## Running locally

MatchDay must be checked out as a sibling directory (`../matchday` by
default — override with `MATCHDAY_DIR` if yours lives elsewhere).
Playwright's `webServer` config starts it automatically against a local
SQLite database — nothing here ever touches MatchDay's production data.

```bash
npm install
npx playwright install chromium
npm test
```

## Running the agents

From Claude Code, in this directory:

1. Dispatch the **Planner** on a requirement, e.g. "use the
   playwright-test-planner agent on requirements/GH-001-successful-ticket-booking.md".
2. Read the resulting plan in `specs/` and approve or request changes.
3. Once approved, dispatch the **Generator** on that plan.
4. If a generated (or existing) test fails, dispatch the **Healer** on the
   failing spec.

Every step that writes code or claims a bug is fixed stops for human review
first — nothing in this pipeline auto-commits.
