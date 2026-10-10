# R8 — Social and discovery (replan stage 8; was S8.1–S8.3)

**Goal:** a place people come back to:
- a leaderboard and public profiles;
- a live feed of calls;
- referral and alerts;
- Reels;
- the Trader Edge report;
- Takes and Rooms.

Everything is privacy-first (D-297).

**Authority:**
- `replan-2026-10-10.md` R8; D-297;
- `pivot-s8-social-games.md` S8.1–S8.3 (the original steps);
- research `02` §6 C16–C20 and `03` take 7;
- UGLYCASH U07;
- 21st.dev first.

**Gate:**
- `pnpm gate` 0;
- the leaderboard, a public profile and the ticker live on both apps;
- a referral paid on chain;
- a market-open push received;
- Reels scrolling live windows;
- one simulator pass.

## Steps
- [ ] R8.1 Leaderboard on both apps:
  - the podium, the field and a "you" bar;
  - day, week and all; category pills;
  - ranked by PnL and by ROI;
  - Practice and Real kept apart; listed accounts only;
  - rows link to profiles;
  - the rail's Leaderboard place.
- [ ] R8.2 Public profiles (`/u?h=` on the web, `/u/[handle]` on the phone):
  - identity, record, current and best streak, public calls;
  - profile editing on the web;
  - the share card says "by @handle" and carries `?r=`.
- [ ] R8.3 The recent-calls ticker on Home and Markets: the `markets` topic, first paint from the indexer, a per-call
  publish choice on top of the profile default.
- [ ] R8.4 Referral: `?r=` capture, claim, $100 test dollars to both on the first fill, the day's cap lifted, a push.
- [ ] R8.5 Notify me: an alerts table, the keeper `opens` job, a push on the phone and an in-tab notification on the web;
  the closed panel's button on both apps; the halt watch (R1.9's hysteresis).
- [ ] R8.6 Reels: a vertical snap feed of live windows. Only the near cards stream. It's a Markets mode on both apps,
  reusing the terminal chart at card size.
- [ ] R8.7 Trader Edge report: a curve, four metrics, session-hour bars and the payoff shape, from the indexer history.
- [ ] R8.8 Takes (signed, ≤ 240 characters, with cashtags) and Rooms (a per-market thread open to holders only).
- [ ] R8.9 People in ⌘K and phone search (R6.5); the settings hidden in R2.11 come back as their features land.

## Handoff
(written at the end of the stage)
