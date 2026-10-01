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
- [x] S12b.1 Migration `0005_social`:
  - `profiles`: handle `[a-z0-9_]{4,20}` (case-insensitive unique), reserved/blocked lists, 30-day tombstone, display name, bio ≤ 160, avatar id, per-network `listed_*` / `public_trades_*`;
  - `follows` (with a cap);
  - `posts` (thesis | reply, parent, optional position/market, ≤ 280);
  - `likes`, `reports` (post | profile), `blocks`, `mutes`;
  - `feed_events`.
- [x] S12b.2 **Profile and handle routes**:
  - availability endpoint (checking / unavailable / invalid / available);
  - `PUT /v1/profile` (session for the same address);
  - `GET /v1/profile/:handleOrAddress`, which **never reveals an unlisted network's handle**;
  - @handle resolution per network (mainnet only when `listed_mainnet`).
- [x] S12b.3 **Follow routes**: follow/unfollow, followers/following, recommendations (the ranked floor only).
  - *Recommendations: `GET /v1/recommendations/follow?chainId` (session) = that network's 30d ranked floor minus you, accounts you follow and blocks either way; `reason: "top_30d"` per row; none preselected (client).*
- [x] S12b.4 **Feed poller**: ingests `Fill`/`Position` over indexer GraphQL after a cursor with a `chainId` filter, for opted-in accounts only; checks Hasura aggregates, else pages. Serves `GET /v1/feed?chainId&scope&market&cursor`; WS `feed:{chainId}` "New activity" with per-connection/IP caps.
  - *`services/api/src/social/feed-poller.ts` (3 s, `<block>:<fillId>` cursor in `feed_cursors`), `feed.ts` (read), WS `feed:{chainId}` in `ws.ts` (2 s conflation; 8 sockets per IP; 60 messages/min per socket, closed past 120). Fill rows carry their position (status + lifetime net PnL on closes), so `Position` is read through the fill.*
- [x] S12b.5 **Leaderboard**:
  - snapshots every 60 s per network: realized PnL after fees and funding (plus borrow when the column lands), rolling 24h from `Fill`, 7d/30d/All from UTC-day buckets;
  - anti-farming floor (minimum trades and notional);
  - "Not ranked", never 0;
  - Your rank;
  - weekly verified Top Trades.
  - *`social/leaderboard.ts` + pure `leaderboard-math.ts`; `GET /v1/leaderboard`, `GET /v1/top-trades`. Borrow is already in (see Findings).*
- [x] S12b.6 **Posts**: compose thesis/reply, like, report (weighted reporters + admin review), block/mute, content filter, visible contact point (App Store 1.2).
  - *Migration `0007_social_feed`; `/v1/posts` (+ `/:id`, `/:id/like`, `/:id/report`), `/v1/profile/:address/report`, `/v1/blocks`, `/v1/mutes`, operator `/v1/admin/reports` + `/v1/admin/reviews`; `/v1/config` → `contact`.*
- [x] S12b.7 **Search**: `GET /v1/search?q&kind=markets|tokens|traders` with recents on the client.
  - *Tokens answer `[]` with a TODO until a token list exists.*
- [x] S12b.8 **Delete my data** covers profile, posts, likes, follows, blocks and reports.
  - *`DELETE /v1/social`; keeps the 30-day handle hold (Q-022 default).*
- [x] S12b.9 **Checks** (targeted): handle race, unlisted-mainnet privacy, block/report, leaderboard window math against `UserDailyStats`/`Fill`, anti-farming floor, delete-data coverage.
  - *`pnpm --filter @senryo/api social-check` = 129/129 on local Postgres 16 (migrations 0001–0005 + 0007), run twice on the same scratch DB, zero rows left: identity (39, unchanged), posts + moderation (32), leaderboard (32: 11 pure window/floor/Top Trades + 21 service), feed + search (22), delete my data (4). The leaderboard and poller read `scripts/mock-indexer.ts`; the GraphQL documents were also run read-only against the live indexer (schema valid; aggregates refused).*
- [ ] S12b.10 **[OK?]** api deploy with the migration; smoke on production URLs.

## Gate
- Fast gate.
- Social checks pass.
- On 10143 from the phone: handle → follow → a public trade appears in Global and Friends → leaderboard rank → send-to-@handle review shows the resolved address.
- An unlisted mainnet account's handle is not resolvable.

## Findings
- **Privacy model (S12b.2/3).**
  - A profile is served for a network only when `listed_<network>` is on.
  - Unlisted and absent both answer 404 with the same body, so an address lookup can't tell them apart.
  - Lists, counts and `followsYou` include only accounts listed on the queried network (or the session's network).
  - A DB CHECK makes a network's public trades require its listing.
- **Handle states:** `available | taken | held | reserved | invalid` (`reason`: length, charset or blocked).
  - `held` = tombstoned, and carries `heldUntil`. Its previous owner may reclaim it.
  - Each account may hold at most 5 released handles per 30 days, which caps squatting by renaming (429 `RATE_LIMITED` with retry-after).
- **Claim concurrency:** in-process single-flight per account, plus transaction advisory locks:
  - per account;
  - per handle, sorted, so a release and a claim of the same handle serialise and the tombstone can't be raced.
  - The unique index `profiles_handle_key` on `lower(handle)` decides races → `HANDLE_TAKEN`.
- **Follows are account-level** (one address on both networks).
  - The target must be listed on at least one network.
  - `FOLLOWING_MAX` = 1,000 is exact under concurrency (per-follower advisory lock).
  - A block in either direction → 403 `BLOCKED`.
- **New API error codes:** `HANDLE_INVALID`, `HANDLE_RESERVED`, `HANDLE_TAKEN`, `HANDLE_HELD`, `CONTENT_BLOCKED`, `FOLLOW_LIMIT`, `BLOCKED`.
- **Migration id gap:** `0004` (the starter top-up) is W1's. The runner applies migrations by id in array order, so `0005` before `0004` is safe. When merging, list `m0004` before `m0005` in `MIGRATIONS`.
- **Migration `0007_social_feed` (S12b.4–8).** `0006` is the lead's `0006_inbox_watches` (S8.24); at merge `MIGRATIONS` reads `…, m0005, m0006, m0007`. It adds:
  - `profiles.hidden` (moderation);
  - `profiles.public_trades_<network>_since`, backfilled to the deploy moment for rows already sharing;
  - a `text_pattern_ops` handle-prefix index;
  - `moderation_reviews`;
  - indexes for reports by target, mutes by muted, feed rows by post, posts by author + chain.
- **Feed (S12b.4).**
  - One table, `feed_events`: fills become kind `position` (OPEN / CLOSE / LIQUIDATE / INVERT) or `fill` (INCREASE / DECREASE / TRIGGER / DELEVERAGE); a thesis writes kind `thesis` when posted. Replies live in the thread, not the feed.
  - **Sharing start:** turning a network's public trades on stamps `public_trades_<network>_since`. The poller writes, and the read shows, only fills at or after that instant. Turning sharing back on restarts the clock — earlier trades are never republished.
  - Visibility is decided at read time (listing, `hidden`, sharing, blocks either way, mutes, posts the viewer reported), so a privacy change hides rows at once.
  - The poller filters by `user_id _in` up to 500 sharers, else pages every fill and filters in-process. With no sharers on a network it waits (its cursor is safe: later sharers start at their own `since`). A fresh database starts ≤ 7 days back.
  - The closing fill carries its position's lifetime net PnL; status is derived from the fill, never the position's later state.
- **Indexer reads.** Hasura aggregates are **off** on our indexer: `ENVIO_HASURA_PUBLIC_AGGREGATE` is unset (Envio's `Hasura.res` grants `allow_aggregations` only to listed entities); probed live 2026-10-01 — `UserDailyStats_aggregate` "not found in query_root". The leaderboard therefore pages the day buckets (probe retried every 10 min; it switches to `daily_aggregate` on its own if aggregates are ever enabled). All social documents ran read-only against `indexer.senryo.xyz`: schema valid, `chainId` scoping holds, no fills indexed yet on either network.
- **Leaderboard metric includes borrow already.** `UserDailyStats.funding` is funding **+ borrow** (`indexer/src/lib/markets.ts` `recordTradeStats`), `Fill.borrow` and `User.borrowPaid` exist. So the published metric is `realized_pnl_after_fees_funding_borrow` on every period with no re-index. Perpl borrow is 0.
  - 24h = rolling fills (`now − 24h ≤ t`); 7d / 30d = UTC days with today included; All = the indexer's `User` lifetime totals, which the same handler keeps equal to Σ day buckets (one row per user instead of paging every day forever).
  - Floor (trades AND usd notional): 24h 3 / $100 · 7d 5 / $500 · 30d 10 / $1,000 · All 10 / $1,000.
  - Ties: more notional, then address. Below the floor: rank null, numbers shown. No activity: all null.
  - Unlisting, deletion or a moderation hide drops the account from the cached boards at once (`forget`), not at the next refresh.
  - Top Trades: the best closed position per trader in the UTC week (Monday 00:00), from accounts listed AND sharing, closed after their sharing start, net > 0, opened notional ≥ $100; up to 10, with the closing tx.
- **Moderation (S12b.6).**
  - Report weight is fixed at filing: 1 for a landed starter claim / voucher or a deposit on any served network, else 0.
  - A target is hidden exactly when an operator review says `hide` AND its (open + actioned) weight ≥ 3. Weight alone only queues it; a `hide` set first takes effect when the weight arrives. `keep` dismisses open reports and un-hides.
  - Decisions live in `moderation_reviews`: they survive "delete my data" and re-hide a new profile on the same address.
  - Operator routes need `API_ADMIN_SECRET` (≥ 32 bytes, constant-time compare); unset → 503.
  - Posting needs that network's listing (403 `NOT_LISTED`), the content filter and 30 posts per rolling hour (429 with retry-after). Replies are one level (a reply's parent is a thesis). An attached position must be the author's on that network, verified against the indexer (503 if it can't be checked).
  - A block deletes follows both ways under both accounts' follow locks, so a racing follow can't survive it. A mute is feed-only (search still finds the account).
- **Delete my data (S12b.8):** `DELETE /v1/social` removes the profile, follows both ways, the account's blocks and mutes, its likes, its reports and reports about its posts, its posts (replies, likes and feed rows cascade) and its feed rows. Kept: the 30-day handle hold (Q-022 default), other accounts' blocks / mutes of it, reports about its profile and moderation decisions.
- **API surface additions:** error code `NOT_LISTED`; `RouteAuth` gains `optional` (the client sends the token if it has one; the server reads an invalid one as anonymous) and `admin` (never sent by the app client); `/v1/config` gains `contact { email, url }` (`SUPPORT_EMAIL` default `support@senryo.xyz`, `SUPPORT_URL` optional).

## Handoff
- **Next: S12b.10 [OK?] deploy** (api only; migration `0007` runs at start). Before it:
  - set `API_ADMIN_SECRET` (≥ 32 random bytes) on `senryo-api` in Coolify, or the review queue answers 503;
  - create the `support@senryo.xyz` mailbox (or set `SUPPORT_EMAIL` / `SUPPORT_URL`), since `/v1/config` publishes it as the App Store 1.2 contact point;
  - the poller and leaderboard start only when `INDEXER_GRAPHQL_URL` is set (it is in production).
  - Smoke: `GET /v1/config` shows `contact`; `GET /v1/leaderboard?chainId=10143` answers 200 within ~60 s of boot; `GET /v1/feed?chainId=10143`; WS subscribe `feed:10143`.
- **Operator review:**
  - `curl -H "Authorization: Bearer $API_ADMIN_SECRET" https://api.senryo.xyz/v1/admin/reports` lists the queue;
  - `POST /v1/admin/reviews {targetKind, targetId, decision: hide|keep, note?}` decides.
- **Screens (S1b.14 / W4)** use `@senryo/query`:
  - `social-feed.ts`: `useFeed`, `useFeedActivity` (the "New activity" pill over `EngineSocket.onFeed`), `useLeaderboard`, `useTopTrades`, `useFollowRecommendations`, `useSearch` (recents stay on the client);
  - `social-posts.ts`: `useThread`, `useCreatePost`, `useDeletePost`, `useLikeToggle`, `useReport`, `useRelationToggle`, `useRelations`, `useDeleteSocialData`.
  - `account/delete-data` should call `DELETE /v1/social` alongside `DELETE /v1/prefs`, and say the handle stays held 30 days.
- **Not in this stage:**
  - market **Holders** (FT098) needs a `Position`-by-market document (status OPEN, `chainId`), which the screens can read straight from the indexer;
  - **tokens** search waits for a token list;
  - **send-to-@handle** uses the existing `GET /v1/profile/:handle?chainId` (mainnet resolves only listed profiles).
- **Optional:** enabling `ENVIO_HASURA_PUBLIC_AGGREGATE=["UserDailyStats"]` on the indexer lets the leaderboard sum buckets server-side. It also opens public aggregates to anyone, so paging stays the default.
- **Social check:** in-process through `@senryo/api-client` against a scratch Postgres (`DATABASE_URL`) with `scripts/mock-indexer.ts`. It migrates the DB, deletes only its own rows, and uses block numbers past any stored feed cursor, so it can re-run on the same database.
