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
Planner agent explores MatchDay live via Playwright MCP
        ↓
specs/GH-XXX-plan.md (evidence-based; unsupported claims → specs/rejected/)
        ↓
Human reviews and approves the plan
        ↓
Generator agent writes tests/*.spec.ts (reusing pages/, fixtures/, test-data/)
        ↓
GitHub Actions runs the suite
        ↓
Pass → done.  Fail → Healer agent investigates and proposes the smallest fix
        ↓
Human reviews and approves the fix
```

## Project structure

```text
.claude/agents/          Planner, Generator, Healer subagent definitions
.mcp.json                Playwright MCP server config (browser control)
requirements/             Input: user stories + acceptance criteria (GH-XXX.md)
specs/                    Output of the Planner: approved test plans
specs/rejected/           Claims the Planner couldn't verify against the live app
pages/                    Page Object Model — one file per MatchDay screen
fixtures/                 Shared Playwright fixtures (auth, seeded state, ...)
test-data/                 Reusable sample data
tests/smoke/               Fast, critical-path specs
tests/regression/          Broader coverage
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
