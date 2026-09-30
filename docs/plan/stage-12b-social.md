# S12b — Social: handles, avatars, follow, leaderboard, trade feed (wave C/D)

**Goal:** the user-approved add-ons work end to end on both networks, with privacy and moderation that hold up to real money
and to App Store review (D-174). The add-ons are:
- optional @handles with authored avatars;
- follow and leaderboard (Friends / Leaderboard + Your rank);
- a trade feed (fills, position changes, theses with replies and likes; Weekly Top Trades);
- market Holders / Feed tabs;
- global search;
- send-to-@handle.
- **Plan:** `docs/plan/v2-plan.md` W5, §5.9 and §6. The screens are S1b.14.
- **Open first:**
  - `docs/design/senryo-v2/direction.md` §9 and the screen inventory;
  - the study: `03-fomo.md` (F04–F07, F13–F16, F29–F31), `02-phantom.md` (P05–P08) and `09-feature-inventory.md` FT038/039/065/066/070/074–086/098;
  - `indexer/schema.graphql` (`User`, `UserDailyStats`, `Fill`, `Position`);
  - `services/api/src/routes/*`, `services/common/migrations/*`, `packages/api-client`.
- **Ownership:**
  - `services/api` social routes, poller and snapshots;
  - `services/common/migrations/0005_social.ts`;
  - `packages/api-client` social endpoints;
  - `packages/query` social hooks.
- **Not owned:** indexer schema. The optional `borrow` column rides with the S8.20 mainnet indexer change.

**D-number range:** D-210…D-219.

## Steps
- [ ] S12b.1 Migration `0005_social`:
  - `profiles`: handle `[a-z0-9_]{4,20}` (case-insensitive unique), reserved/blocked lists, 30-day tombstone, display name, bio ≤ 160, avatar id, per-network `listed_*` / `public_trades_*`;
  - `follows` (with a cap);
  - `posts` (thesis | reply, parent, optional position/market, ≤ 280);
  - `likes`, `reports` (post | profile), `blocks`, `mutes`;
  - `feed_events`.
- [ ] S12b.2 **Profile and handle routes**:
  - availability endpoint (checking / unavailable / invalid / available);
  - `PUT /v1/profile` (session for the same address);
  - `GET /v1/profile/:handleOrAddress`, which **never reveals an unlisted network's handle**;
  - @handle resolution per network (mainnet only when `listed_mainnet`).
- [ ] S12b.3 **Follow routes**: follow/unfollow, followers/following, recommendations (the ranked floor only).
- [ ] S12b.4 **Feed poller**: ingests `Fill`/`Position` over indexer GraphQL after a cursor with a `chainId` filter, for opted-in accounts only; checks Hasura aggregates, else pages. Serves `GET /v1/feed?chainId&scope&market&cursor`; WS `feed:{chainId}` "New activity" with per-connection/IP caps.
- [ ] S12b.5 **Leaderboard**:
  - snapshots every 60 s per network: realized PnL after fees and funding (plus borrow when the column lands), rolling 24h from `Fill`, 7d/30d/All from UTC-day buckets;
  - anti-farming floor (minimum trades and notional);
  - "Not ranked", never 0;
  - Your rank;
  - weekly verified Top Trades.
- [ ] S12b.6 **Posts**: compose thesis/reply, like, report (weighted reporters + admin review), block/mute, content filter, visible contact point (App Store 1.2).
- [ ] S12b.7 **Search**: `GET /v1/search?q&kind=markets|tokens|traders` with recents on the client.
- [ ] S12b.8 **Delete my data** covers profile, posts, likes, follows, blocks and reports.
- [ ] S12b.9 **Checks** (targeted): handle race, unlisted-mainnet privacy, block/report, leaderboard window math against `UserDailyStats`/`Fill`, anti-farming floor, delete-data coverage.
- [ ] S12b.10 **[OK?]** api deploy with the migration; smoke on production URLs.

## Gate
- Fast gate.
- Social checks pass.
- On 10143 from the phone: handle → follow → a public trade appears in Global and Friends → leaderboard rank → send-to-@handle review shows the resolved address.
- An unlisted mainnet account's handle is not resolvable.

## Findings

## Handoff
