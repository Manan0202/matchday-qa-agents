# GH-003: Follow favorite teams

**As a** fan
**I want to** follow my favorite teams
**So that** I get a personalized feed of their upcoming matches on the home
page without having to search for them every time

## Acceptance criteria

- On a team's page, a logged-in fan can follow the team with one click, and
  the button reflects the new state immediately without a full page reload.
- Clicking follow again unfollows the team, toggling back to the original
  state.
- An anonymous (logged-out) visitor is prompted to log in when they try to
  follow a team, rather than the follow silently failing or erroring.
- Once a fan follows at least one team, their home page shows a personalized
  section surfacing that team's upcoming matches.
- Following state persists across sessions (it's tied to the account, not
  browser/device-local state) — logging in again on a fresh session shows
  the same followed teams.
