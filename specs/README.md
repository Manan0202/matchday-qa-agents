# Specs

Output of the Planner agent — one file per requirement it was pointed at.

- A plan here (`GH-XXX-plan.md`) means the Planner verified those scenarios
  against the live app and they're ready for human review before the
  Generator touches them.
- `rejected/` holds claims the Planner could not verify — read those before
  assuming a requirement is fully accurate.

Nothing in this directory is trusted automatically; a human approves a plan
before the Generator is allowed to act on it.
