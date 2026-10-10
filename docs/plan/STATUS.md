# Replan: Tradash at the core, two ways to play, one pool (10 October 2026, Claude Code)

**Current plan:** [replan-2026-10-10.md](replan-2026-10-10.md), approved by the user on 10 Oct. Decisions are D-298…D-310. It
replaces the open S8 steps (S8.1–S8.3, S8.8, S8.9) with stages, in order:

- R1 [prices that can't fail silently](replan-r1-prices.md)
- R2 [one look, real logos](replan-r2-look.md)
- R3 [contracts v3: rides, calibrated calls, fair Earn](replan-r3-contracts.md)
- R4 [activation](replan-r4-activation.md) (needs ~13 testnet MON on the deployer)
- R5 [the live loop](replan-r5-live-loop.md)
- R6 [⌘K and phone search](replan-r6-search.md)
- R7 [games](replan-r7-games.md)
- R8 [social](replan-r8-social.md)
- R9 [acceptance](replan-r9-acceptance.md), then S8b → S9 → S10 from the pivot plan

Parity: [parity-replan.md](parity-replan.md).

**Where we are:** R1.1–R1.5 done (process guards, RedStone body validation, `PrintFetcher`, `PrintWatch`, archive-only print route, Hermes hardening). R1.6 done (RedStone parse in a worker: loop stall 24 → 1.9 ms). R1.7 done (RedStone markets pause with the reason after 29 Oct without a key). R1.8 done (settlement plane complete). R1.9 done (`FeedState` end to end; RedStone read moved to +7 s). R1.10 done (prices never wait on the user's ticket). R1.11 done (5 s beat and silence, fast reconnects, nudge). R1.12 done (replay epochs, `reset`). R1.13 done (batched `pp`, sliced fan-out, caps; G1 measured). R1.14 done (`/latest`, charts open on real history, preconnect). R1.15 done (NTP-style clock). R1.16 built but **off** (no venue's free terms allow showing exchange prices — `09-display-terms.md`; owner chose to keep the line on Pyth, D-311). R1.19 done (24 h change from our archive). R1.20 done (honest chip, panel, frozen/dimmed chart; closed markets show their last session). D-311: the line stays on Pyth, exchange feed off, R1.17 dropped. R1.21 done (the line moves on every frame at 60–144 Hz on both apps). R1.22 done (surge/mega/slump fire at 1 Hz). R1.23 done (chaos G3 a–d and abuse G6 pass on the real price path; the first run found a cut's boundaries never back-filled and a 30 s reconnect after an outage — both fixed: live again 5.5 s after a 90 s cut). R1.24 done (markets not on chain yet — 31 of 34 on testnet until R4 — show a live price and "Not open for calls yet"; the api reads the listing from `Windows` and refuses them up front). **R1 deployed 10 Oct 13:00 UTC:** api + keeper `sha-2f667bf`, web `sha-4905dd2`; the stream now leaves Traefik uncompressed (the api's own compress middleware excludes `text/event-stream`). R1.18 measured: Pyth trails Bitfinex by 200–400 ms, so R3 keeps the 1 s fill delay (a weekday server run confirms BTC's). Next: the phone simulator pass, then its OTA; then R2.

**Not changed:** the pivot plan (product, stack, S8b–S10). The S8.8 games work in `b61d1932` (engines, api, first screens)
carries into R7. The half-finished markets v2 deploy is abandoned (D-309).

---

# Pivot to a real-time prediction market (8 October 2026, Claude Code)

**Plan:** [pivot-2026-10-08.md](pivot-2026-10-08.md), approved by the user on 8 Oct. Decisions are D-256…D-272 in [decisions.md](decisions.md).

Senryo is now live Up/Down calls on crypto and stock price windows, in dollars. A shared pool takes the other side; you can cash out any time; payouts land automatically. Practice runs on testnet with free test dollars, Real on mainnet with USDC. It ships on the phone (the existing Senryo app) and as a full web app. The trading product (perps, card, KYC, venues) is superseded.

**Stages, in order (one checkout, no worktrees):**
- S0 record
- S1 cleanup
- S1b native build 0.4.0 → TestFlight + Play internal
- S2 contracts
- S3 services
- S4 indexer
- S5 phone loop
- S6 web app
- S7 stocks, bands, Earn
- S8 social, games, exits, events
- S8b agents
- S9 mainnet + Aurora
- S10 ship
- CRE is optional, after S10.

**Where we are:** S0–S6 done; S7 built and committed; S8 under way ([pivot-s8-social-games.md](pivot-s8-social-games.md), D-291…D-297) — S7 and S8 go on chain together as markets v2 (D-291), which waits on ~25–30 testnet MON. S8.4 exits, S8.5 parlays, S8.6 duels and S8.7 events built (exits fire with the app closed; parlays of 2–4 legs paid by the shared pool, priced with a correlation floor per asset class; duels: a sealed deck of three, picks as real calls the arena owns, the better total takes the pot, Elo on the indexer; events: real games as Yes/No pools settled by a Senryo-run committee of three signers reading the league's feed, ESPN and theScore, 2 must agree, any dissent refunds; both apps) — 101 contract tests, gate green. Next: S8.8 games (Lucky, Warm-up, arcade), then S8.1–S8.3 social, then the S8.9 deploy.

**Done while planning:**
- Senryo's Pyth key is runtime-only on Coolify `senryo-api` (`lzumxcf5…`) and `senryo-keeper` (`cskiutyj…`), and in the gitignored `.env.local`.
- Agari's new key is live on `agari-ops`.
- Owarine's ops env now uses Senryo's key.

## S7 interim (9 Oct) — built, waiting to go on chain

- **Built and committed** (`pivot-s7-markets.md`, D-284…D-290): 34 markets / 136 series (Pyth, RedStone, four
  baskets), real trading hours (`MarketCalendar` from each feed's Pyth schedule; keeper keeps them current), Range and
  Moonshot on both apps, baskets in points, Earn (`PoolShares`: hourly rolls, relayed requests, keeper delivery),
  public Proof pages with in-browser re-verify. 61 contract tests; the gate is green.
- **Waiting on the user:** (1) **testnet MON** — the deployer `0x52d205731e97c90aab738ae66371449f585c0e6a` holds 0.94;
  listing everything (124 new series, five verifiers, `PoolShares`, calendars) needs ~15–16 MON at 104 gwei, so ~20 MON.
  Until then no service deploys (the catalogue names markets the chain doesn't have). (2) **A RedStone API key**
  (RedStone issues it on request) → `REDSTONE_GATEWAYS` on Coolify `senryo-api`; until 29 Oct the public gateways serve
  outside their refusal windows.
- **Then S7.9:** `KEEPER=0xf6a3… forge script script/AddMarkets.s.sol --broadcast` (idempotent — a partial run resumes),
  `pnpm contracts:export`, indexer with PoolShares, images, deploy api/keeper/indexer/web, phone OTA after a sim run,
  acceptance rows.

## S6 handoff (web app, 9 Oct)

- **Live:** `senryo.xyz` (landing with the live BTC line, `/judges`, the public `/call?id=` receipt) and `/app`: rail
  (Home · Trade · Markets · Calls, 5 = Everything), top line, ⌘K, the phone's dock under 768 px; the terminal
  `/app/trade/[symbol]` (Owarine's canvas chart with Senryo's rules, odds in words, presets + keypad, Up/Down → Cash
  out, lockout, reactions, confetti, sounds, one-tap line, crowd split); Calls with receipts, the window proof and
  the share card; passkey sign-in and setup in drawers; the wallet, Receive, Withdraw, one-tap and settings drawers
  (`?d=`). Static export on Coolify `senryo-web` (`2zeju5a5…`).
- **One call flow for both apps:** `@senryo/calls` (window, signing, one-tap, quote pass, reactions, `useCallFlow`,
  results, receipts, withdraw); shared words/clocks in `@senryo/core` market, sound and layout in `@senryo/tokens`
  (D-282). The phone runs on it (typecheck, bundle export); its OTA waits for S7's first phone change and a sim run.
- **Gate (acceptance.md, 9 Oct):** `pnpm gate` 0 · 1 SSE per tab · wallet chunks only on click · TBT ≤ 120 ms, CLS
  ≤ 0.01 · bundles per D-283 all within (`/` 143, `/app` 238, `/call` 217, terminal 277, after the drawing-table cut) · LCP **misses
  2.5 s**: `/` 2.64, `/app` 2.96, terminal 6.1–8.1 s (its LCP is live text that needs the first price).
- **Open on the user:** walk sign-in → setup → test dollars → a call → its receipt on senryo.xyz.
- **Fixed on the way:** pnpm's dangling `expo-modules-core` hoist (postinstall repair); the proof polled 404s for
  windows nobody called (now `null`); the first render asked for `load?expiry=60` before the clock synced; zod
  imported whole (namespace import, −144 KB).

## S5 handoff (phone loop, 8–9 Oct)

- **Shipped over the air** to runtime 0.4.0 (production channel): update groups `dc2be2eb…` (the loop) and
  `811a41f2…` (S5 complete). iOS build 11 and Android versionCode 5 pick them up on launch; no native change since.
- **The loop on the phone:** story (call · payout · passkey · pool · Practice/Real) → passkey → @handle → terms →
  $1,000 test dollars → "Try your first call" (watched through) → one-tap → notifications → Face ID. The live
  terminal: Skia chart (adaptive easing, K / entry levels, zone, rolling pill), odds in words with the pool-load
  surcharge, stake presets + keypad, Up/Down → Cash out (long-press 25/50/100 %), lockout and "result in", crowd
  split, Tradash reactions (callouts on the head, surge glow), confetti on wins, one-tap line. Calls: record,
  filters, receipts with every transaction and the window's proof; share cards. Wallet: test dollars, Receive,
  Withdraw (EIP-3009 relayed).
- **Gate (acceptance.md, 8 Oct):** 2 taps after the dollars step to a confirmed call (tap → open ≈ 2.0 s; one-tap
  tap → fill 1.26 s) · stateless test passed (reinstall → passkey → balance, record and calls rebuilt) · session
  expiry shows on Home and the terminal · renders once a second, none per tick · chart frame 1.23 ms avg (dev
  build; was 4.1) · 1 SSE, 0 RPC by construction.
- **Fixed on the way:** profile save / inbox / pushes read tables 0015 dropped (invariant `sql-no-dropped-tables`);
  the terms hand-off race; the withdraw sheet clipped in a page; results waited 30 s without the user topic
  (`useRefreshCaller`, close + 5 s look); a failed catalogue read stuck forever.
- **D-281 market universe:** the Pyth key streams BTC, ETH, SOL, DOGE, XRP, BNB, HYPE · TSLA, QQQ · XAU, XAG ·
  EUR/USD only; S7 lists all of them and prices a second source (RedStone vs a Pyth equities tier) for Mitoshi's
  nine stocks — a money choice for the user at S7.
- **Carried to S6+:** the web app (S6 removes the web's journal modules and `marketRoomUsd6`); the markets story
  scene returns at S7; the dock's first tap after the Face ID sheet was once ignored (not reproduced).

## S4 handoff (indexer, 8 Oct)

The markets' history is indexed on production and served by the api (`ids-and-txs.md` → "Indexer deploy (S4)").
Gate (`scripts/drive/src/indexer-parity-check.ts`, exit 0 on production, 23 tickets · 9 owners · 15 windows): every
ticket on chain equals what the api serves for its owner (status, band, window, remaining payout, entry print); for
every owner, Σ stakes equals the Test USD paid to the reserve and Σ returned equals what the reserve paid out plus
anything owed (Transfer logs over HyperSync, independent of the indexer); `/stats` agrees with the calls; each
window's call count equals its filled tickets. Two fresh S3 journeys passed on production with the indexer live; on
the final image every ticket event (commit, fill, cash-out, settlement, payout) was indexed 0–2 s after its block.
`pnpm gate` 0.

**Built (D-279):**
- `indexer/`: Envio 3.14 schema and handlers — windows and their prints, tickets with full timelines, accounts (pnl,
  wins, streaks), daily stats (pnl, calls, wins), markets, pool, sessions. A Docker Image app on the ledger Postgres
  (schema `envio`, its own role `senryo_indexer`), Hasura off; HyperSync backfills, Monad's public RPC follows the head
  (100-block requests); `start.mjs` re-indexes in place when a deploy changes the schema incompatibly (tested both
  ways locally).
- api: `/v1/markets/calls`, `/calls/:ticketId` (timeline with receipts), `/windows/:windowId` (proof prints + crowd
  split), `/leaderboard` (day / week / all, per network), `/stats` — `IndexerReader` over SQL, typed in
  `@senryo/api-client` (`routes/history.ts`). The S3 journey now reads a commit tx it missed from the timeline.
- Removed: the compose stack with its own Postgres and Hasura (Coolify resource `gafyrh7f…` and its volume deleted),
  the empty `packages/indexer-client`, unused indexer dependencies, the pre-pivot drive plumbing; the chain-filter
  invariant now checks the SQL reads.

**Found on the way (fixed and verified on production):**
- Under `NODE_ENV=production` Envio requires settings it otherwise defaults (throttles, Hasura settings even with
  Hasura off); the first image crash-looped.
- `node:24-slim` has no CA store: Envio's native RPC client failed TLS, so the indexer fell back to HyperSync, whose
  token allows 15 queries a minute — one ticket waited 48 s. With `ca-certificates` and 100-block requests (Monad's
  public `eth_getLogs` cap) the head runs on the RPC with no fallbacks.

**Carried forward:**
- The head depends on Monad's public RPC (`ENVIO_RPC_URL_10143` / `ENVIO_WS_URL_10143` override it); HyperSync stays
  the backfill and the fallback.
- Mainnet (143) joins the config at S9 with the mainnet deploy block.

## S3 handoff (services, 8 Oct)

The markets run end to end on Monad testnet through the deployed api and keeper (`ids-and-txs.md` → "Services
deploy (S3)"). The gate journey `scripts/drive/src/markets-public-check.ts` (a brand-new wallet, public api only)
passed three times — twice against local services, once against production: sign-in → Practice dollars → BTC 1m Up
with a gas-free permit → fill at the unique print (tap → fill 2.2 s on production, ~3.2 s from a laptop on a phone
hotspot) → half cash-out → Down → automatic settlement and payout → a capped session → a call signed by the session
key. `pnpm gate` 0.

**Built (D-278):**
- api: the one Pyth gateway (raw Hermes SSE, key in a header, watchdog, rotation, unique-print ring, `pyth_prints`
  archive of every minute boundary and every pending fill instant, 1-minute candles); the one `/v1/stream` (coalesced
  ticks serialised once, `prints`, ticketed `user:` topics, server-time beat, `Last-Event-ID` replay); the relay
  (digest-keyed intents queue, sponsor lanes with a Postgres journal, lazy windows in one Multicall3 tx, fills batched
  per print the moment it streams); session grant/revoke; Practice grant; catalogue, account, tickets, prices routes.
- keeper: `sync` (the ticket book follows the chain), `settle` (close print + resolve + settle + payouts in one tx,
  void and refund when no print), backup fills/expire, result pushes ("You won $x").
- `@senryo/chain` holds every market id, typed-data definition, calldata builder and receipt decoder (services never
  import viem).

**Carried forward:**
- One relay lane (the sponsor). A second (`SPONSOR_2_PK`) and ≥ 12 MON per lane need more testnet MON: sponsor 5.2,
  keeper ≈ 3.8, deployer ≈ 1.0 MON. Each call costs about 0.05 MON (commit + fill + its share of settlement).
- Container memory limits, the Cloudflare cache rule and the `/status` page's prices component wait for S10's ops
  pass; `/v1/stream` is behind Traefik only.
- History, leaderboard and crowd split come from the indexer (S4); the ticket book stays the keeper's work list.

## S1b handoff (native build 0.4.0, 8 Oct)

- One native build per platform on runtime 0.4.0 (Ramp, JitPack and `victory-native` out; Expo SDK 57 patch
  releases in), then over-the-air only (D-270). iOS build 11 is submitted to TestFlight, Android versionCode 5 to the
  Play internal track (`ids-and-txs.md`). Internal TestFlight testers install without review.
- Found on the way: an unanchored `.easignore` rule dropped `packages/contracts` from the upload; it is anchored now,
  checked by building the exact archive (`eas build:inspect`) and bundling iOS from it, and an invariant keeps
  `.easignore` covering every `.gitignore` rule.
- **Waiting on the user:** add testers to the internal TestFlight group and the Play internal testers list (Apple /
  Google consoles), then install. External Beta App Review is planned for a build after S5 (D-270).

## S2 handoff (contracts, 8 Oct)

The markets are live on Monad testnet (`ids-and-txs.md` → "Markets deploy (S2)"): `Windows`, `PythPrintVerifier`,
`BandReserve` (with `SessionGrants`) and `TestUSD`, ported from CWF `d7b576b` (windows, prints, range reserve, payouts)
and re-based on commit-then-fill at the unique Pyth print (D-261, D-275). Checked by exit code: `forge test` 35/35
(fill, settlement, sessions, plus a solvency invariant suite: 4,096 random opens/cash-outs/rolls, balance = liabilities,
exposure ≤ 60 %, band totals = tickets), `pnpm gate` 0. A real keyed Pyth print was recorded on chain through the
deployed verifier, and a mainnet keyed payload verified against both mainnet receivers (D-274).

**Built:**
- `packages/config/src/catalog.ts` (D-268): BTC/ETH/SOL × 1m/5m/15m/1h, Pyth ids, σ, band menus from σ√τ, pool terms
  and session ceilings per network; `scripts/catalog-export.mjs` → `contracts/script/catalog/<chainId>.json` →
  `contracts/script/DeployMarkets.s.sol`.
- ABIs for the six contracts in `@senryo/contracts`; `CONTRACT_ABIS` and the api's deployed check follow `BandReserve`.
- Test USD has its own neutral mark (Material Symbols `paid`, fetched by script), pinned by `PRACTICE_DOLLAR`.
- `PythBoundaryOracle` and `predictions/` are gone (one verifier).

**Carried forward on purpose:**
- The address book marks every contract `indexed: false` until S4 adds them to the indexer (the `address-drift` guard).
- Supplier shares ("Earn") are S7 (D-276); S2's pool is house-funded.
- Equities need their calendar weeks and a 50 bps verifier (S7); MON waits for S9.
- The relayer, keeper jobs, Test USD grant and `/v1/stream` are S3; the TypeScript pricing mirror with shared vectors
  lands with the client runtime (S3/S5).

## S1 handoff (cleanup, 8 Oct)

The trading product is gone from the code: perps, venues, swap, LP, card/KYC, social feed, discovery, the engine
contracts and their scripts and tests, the trading indexer handlers, `services/card`, `packages/indexer-client`, the
WsHub socket and the trading query modules. One implementation per capability is left. Checked by exit code:
`pnpm gate` 0 (typecheck, Biome, invariants), `forge build` OK, `packages/account` checks 13/13, web static export
builds (`/`, `/judges`, `/privacy`, `/terms`), iOS `expo export` bundles. An `rg` sweep finds no live reference to a
deleted module (old append-only migrations keep their history).

**Also in S1:**
- Migration `0015_prediction_pivot` drops the trading tables (runs when the S3 api deploys).
- Logos: 29 trading-only marks pruned (venues, card, swap aggregators, bridges, spot tokens) and codegen rerun; chain
  marks stay for S9's Aurora picker; Chainlink is a provider row (the MON market's labelled second source, D-258).
- Invariants: `risk-mirror-constants` dropped (the band-pricing mirror check comes with S2's test vectors);
  `identity-provenance` now checks Practice's Test USD once it is in the address book; the Pyth oracle's literals are
  named constants.
- Fixed while sweeping: the phone had lost its `QueryEnvProvider` mount, the operation-journal storage and the
  "review again if the account, network or app changed" guard when `lib/market-data.tsx` went. They are back as
  `apps/mobile/src/lib/query-env.tsx`.
- The Real-money region list on the phone matches the api's D-273 list (US, GB, CA, AU, BY, RU + CU, IR, KP, SY).
- Coolify: `senryo-card` deleted, the old indexer stopped, the old keeper limited to pushes/receipts/retention
  (ids-and-txs.md).

**Carried forward on purpose:**
- `QueryEnv.read` and the wallet balance poll stay until S5 moves balances onto the user's stream (D-272).
- The indexer is a placeholder until S4; Aurora's module was deleted and is rebuilt in S9 as `services/api/src/deposit/`.
- The session security check returns in S2 with the on-chain `SessionGrant` caps (D-267).
- `victory-native` and the Ramp pod/patch leave with the S1b native freeze (no screen imports them now).
- `services/api/src/single-flight.ts` stays for profile writes (it shares the in-flight promise; no 409).
- Copy: the landing (S6), `/judges` (S10) and the onboarding story (S5) still describe the old product; the live web
  is unchanged because images deploy manually. Don't redeploy web before S6.
- The sound palette keeps `liquidation` until S5's win/loss/refund result sounds replace it.

**Research notes:** [docs/research/pivot/](../research/pivot/).
**Product how-tree:** [docs/product/predictions/](../product/predictions/).
**Parity ledger:** [parity-predictions.md](parity-predictions.md).

**Waiting on the user:**
- an Aurora Studio API key (`AURORA_API_KEY`);
- finishing the CRE login in Codex (optional item);
- the mainnet pool seed plus about $30 for the Aurora demo (at S9).

# Real venues on Monad: Stage 1 (8 October 2026, Claude Code)

Perpl now works for real on public Monad testnet, through the app's own code. A brand-new wallet ran the whole journey:
- starter gift (gas) and **Get test money** (10,000 test AUSD, sponsor-paid);
- open BTC long $300 at 3×;
- close 50 %, close the rest, withdraw.

Evidence:
- `scripts/drive/src/perpl-public-check.ts`; transaction hashes in `acceptance.md`.
- api `sha-35e3257` deployed (`POST /v1/practice/perpl-funds`, migration 0014, Test AUSD listed).
- iOS OTA `1736175c-5d78-4b8b-b186-f48fa48ed359`.
- Simulator crash pass on the current UGLYCASH build: Money home, Add funds → Practice money, engine ticket → "Long EUR opened".

Moved to Stage 2, so they're built once on the unified ticket rather than twice:
- Perpl "pay with any token" on mainnet;
- Perpl inside the main Withdraw flow.

Phone acceptance is still owed by the user.

# Real venues on Monad: Stage 0 (8 October 2026, Claude Code)

**Current plan:** [real-venues-2026-10-08.md](real-venues-2026-10-08.md), approved by the user on 8 Oct.
- **Trading venues.** Senryo trades on real Monad venues with their own liquidity:
  - Perpl for crypto perps, on mainnet and testnet;
  - HelloTrade for gold, silver and stocks (invite code requested; Hyperliquid `xyz` is the fallback).
- **Our engine.** It stays a Practice-only market, used for FX. There is no Senryo-run mainnet pool.
- **How work runs.** Stages go one at a time in this checkout. No worktrees (user rule).

**Stage 0, done:**
- **D-255** (`e31d387`): Face ID step-up, plus a wait for the app to return to the foreground before signing.
- **`6316f36`**: card failures now name their cause; API sign-in is single-flight.
- **iOS OTA** published as group `06cc0818-5758-423d-909c-3135ee307d85` on runtime 0.3.0 (production). Codex's uncommitted prediction/card/binary files were stashed out of it and restored.
- **Keeper** topped up to 2.22 MON (about 1 day of runway). See the [MON runbook](../development/practice-mon-runbook.md).
- **Outreach drafts** for HelloTrade, Monad DevRel and Perpl: [outreach-2026-10-08.md](outreach-2026-10-08.md).

**Waiting on the user:**
- Retest on the phone after the update applies (launch, wait, relaunch).
- Send the HelloTrade and DevRel messages.
- Claim testnet MON to the keeper.

**Next:** Stage 1, completing Perpl on both networks.

**Preserved:** Codex's uncommitted 4C1b binary indexer, Predict UI, CardIssued and website work stays untouched in this checkout.

# Native development workspace and pricing repair — 2026-10-07, Codex

The latest user instruction adds fast native iteration to the approved whole-product plan. `pnpm dev:mobile` starts a separate-account/storage development workspace against a loopback Practice fork and Metro; native Home opens without OS sign-in. Actual contract long/short opens, finalized positions, controlled price changes, closes and reset passed in the local contract check. Release/development gate checks, Mobile/Drive typechecks, focused Biome, invariants and both Release Hermes exports passed. The final native dashboard shows the fixture account and P$100 without holdings/starter-relay errors; touch checks were interrupted by Mac locking and remain separate from the contract checks. [Runbook](../development/mobile-workspace.md), [verification record](../design/reviews/2026-10-07-native-dev-workspace.md).

Home's Mainnet failure used undeployed engine contracts; it now follows the direct Chainlink feed path, with source time, retry and last-good refresh failure states. Each market row observes its own feed, and non-open/expired socket ticks cannot be labelled live. All seven Mainnet feeds returned positive rounds during the direct read check, aged 92–266 seconds. This does not imply Mainnet trading is deployed. The full UGLYCASH journey/forms/social/real-time BTC/ETH prediction/provider roadmap remains open. No public-chain transaction or release upload occurred; generated local Release intermediates were cleared after disk exhaustion, preserving source and installed app binaries.

# Approved UGLYCASH implementation — 2026-10-07, Codex

The user approved the [whole-product revamp plan](uglycash-revamp-2026-10-07.md) with “lgtm”. First-slice source is implemented: native palette/type, three visible contexts over all retained stacks, Money Home, Display Balance/privacy and contextual Face ID. Mobile/Drive typechecks, setup migration checks, invariants, both Hermes exports and final iOS simulator-signed Release build pass. Guest contexts and privacy toggle/art/persistence are observed; signed auth reaches the native passkey UI, but no local credential is available, so authenticated Home and physical Face ID remain open. [Implementation and validation](../design/reviews/2026-10-07-uglycash-foundation.md) distinguishes source completion, static checks, simulator evidence and remaining device work. The full profile/onboarding/forms/money/social/prediction/functional completion roadmap remains open. No store/OTA upload, deployment or contract transaction has occurred in this slice. Existing unfinished prediction/CardIssued/web work is preserved.

# Planning continuation — 2026-10-07, Codex

**Second reference pass complete:** all 16 flows / 89 screens rechecked after the user's final feedback. [Detailed forms/states contract](../design/reference-study-2026-10-07-uglycash/forms-and-states.md) now covers every onboarding screen, username claim/edit, loading/error/keyboard, receive, profiles and sharing. Substantial cleanup of superseded presentation is authorized within the revamp; account/data/provider behavior and existing dirty work are preserved. This remains planning evidence, not implementation/device acceptance.

**Latest user clarification:** BTC/ETH predictions stay fully inside the mobile app. A Senryo-owned Monad-testnet prediction contract, working with test MON, is an acceptable fallback if current provider integrations cannot deliver the native experience. Mainnet is a subsequent possibility, with separate deployment/oracle/liquidity/assurance. [Updated execution plan](uglycash-revamp-2026-10-07.md#prediction-execution-amendment--native-app-and-owned-monad-fallback). This records the user's scope; no contract deployment occurred.

The user requests a whole-mobile UGLYCASH revamp and Tradash-style live behavior/sound, with the full project completion roadmap retained. **Research/planning only:** [proposed plan](uglycash-revamp-2026-10-07.md), [16-flow / 89-screen study](../design/reference-study-2026-10-07-uglycash/README.md), [current capability/dependency status](../design/reference-study-2026-10-07-uglycash/project-status.md), [Tradash/sibling fidelity contract](../design/reference-study-2026-10-07-uglycash/tradash.md). All 114 inventoried mobile/web entries are mapped; implementation and device acceptance remain open.

Source baseline `44d876b`, branch `codex/senryo-unified`, existing dirty app/web work preserved. Public API health/readiness and both prediction discovery reads returned 200 on 7 October. Config still advertises only Practice engine 10143. A short XAU/EUR socket sample connected but delivered source observations about 29 minutes old: diagnose feed age before claiming a live chart. Predictions remain schema-enforced view-only with 20-second polling. No new source implementation, build/upload/deployment, provider action or transaction occurred. Store/device/image facts below are historical until reverified.

# Previous continuation — 2026-10-04, Codex

**One current checkout:** `/Users/abu/dev/hackathon/metropolis`, branch `codex/senryo-unified`. Latest premium source `eb3533d` + Slush Home/Card `d86ccef` + compatible preserved continuation fixes `4d399d4`. The user selected Slush Home/Card + Fomo Markets/Profile/Social, requested TestFlight, then authorized source consolidation and unused agent-worktree cleanup. The 23 Senryo checkouts are now one; unique contracts and unfinished web work remain on saved branches with verified recovery bundles. [Consolidation and recovery map](consolidation-2026-10-04.md).

**TestFlight:** `0.3.0 (7)` is VALID / IN_BETA_TESTING, build `fafdcad2-81cf-4f97-9637-13e08ed3458b`, submission `0013344c-03f9-432a-a834-38f91c1d3621`, EAS snapshot `62b6678` including native repair `8e6a56b`. Runtime 0.3.0, production channel. [Current source/provider/release verification](../design/reviews/2026-10-04-phone-feedback-validation.md). The prior 0.2.1 (5) and its compatible OTA remain historical. Physical-phone acceptance remains open. No GitHub source push or App Store production promotion.

[Complete work register](reference-followthrough-2026-10-04.md) retains every requested capability; [reference evidence](../design/reference-study-2026-10-04/README.md) distinguishes older recordings and concepts from current behavior. [Provider/notification research](predictions-onramp-notifications-2026-10-04.md) preserves Ramp and recognizes the existing inbox/followed-trade implementation. API now runs `sha-fde67c6`; Card and keeper remain on `sha-34b2af3`. Health/readiness and prediction reads passed. Practice 10143 advertises `card: true`. Lithic sandbox issue/freeze/unfreeze, signed allowance, approval, capture and exact once-only refund passed in the earlier provider harness; this is not acceptance of the mobile passkey flow. Followed-trader ingest/privacy fixes remain deployed. Physical push, phone and production-card acceptance remain open.

**Latest simulator feedback:** [validation ledger](../design/reviews/2026-10-04-simulator-feature-validation.md) records source through `7714c36`: fresh card retry state, native passkey foreground timing, contextual payment drawers/receipt facts, profile amount layout, authenticated owner follows on both networks, swap values and BTC-to-WBTC return navigation. The current production iOS OTA group is `9ac6b4d1-e872-4d62-90f0-86f69bdd359a`, update `01a10714-67f2-74f1-891d-d7d87d9db486`, runtime 0.3.0, verified through the actual update manifest. Mainnet board now answers 200/empty rather than 503; private lists require owner authentication and do not require publishing the owner. Mainnet money capabilities were not enabled. 167 Social checks, six foreground lifecycle checks, affected typechecks, invariants and both Hermes exports passed. Actual simulator card issuance, P$100/day allowance, freeze/passkey unfreeze, reveal/Hide, decline handling, card and withdrawal receipt export/render, both-network Social/search, profile layouts, saved Practice alert, read-only markets/predictions and pool overview passed. Swap and Add money reach the draft Terms/Privacy gate; agreement confirmation is pending, so execution/funding remain open. Physical-phone acceptance and prediction execution remain unfinished. One checkout remains; approximately 6.4 GiB of this pass's native build files were reclaimed, with temporary export cleanup recorded in the validation ledger.

**Prediction continuation:** source `848ca5e`, iOS OTA group `a5f2ae78-147d-4dc4-af0c-c67556b1eea1`, verified by the actual production update manifest on runtime `0.3.0`. [Build/release ledger](../design/reviews/2026-10-04-predictions-build.md) records real BTC/ETH binary discovery, outcome history/rules, distinct Monad contest details, Watchlist/Search/Recents, affected typechecks, both Hermes exports and 23 API regression checks. The user delegated provider sequencing and retained the entire plan; quotes/orders, holdings, sale/claims, recovery and exact settlement-price chart remain open. Discovery is public in either money mode and does not establish trading support or broaden Senryo's money network configuration. Physical-phone installation/acceptance remains unobserved.

**Phone feedback pass:** [approved changes](phone-feedback-2026-10-04.md) and [validation](../design/reviews/2026-10-04-phone-feedback-validation.md) cover Home action deduplication, aligned money figures, Alerts, receipt drawers/PDFs, read-only token browsing and native Ramp. Native runtime `0.3.0` is available in TestFlight build 7; do not send these modules as an OTA to 0.2.1.

Historical source/deployment/device claims below are not new verification of this release.

# STATUS — 2026-10-02, Claude Code (lead)

Current work: **[Stage 14](stage-14-premium-takeover.md)** — product interrogated end to end ([flow book](../product/README.md)), then the premium rebuild and real integrations. Branch `claude/premium-takeover` (worktree `../metropolis-takeover`). **2 Oct evening:** every area (Home, money, trading+pool, card+notifications, identity/settings, social) built + merged; Perpl/any-asset/card/notifications backends merged; api/keeper deployed; iOS preview build 141ef955 + EAS Update `preview` 9b7caf82 ready for the phone; contract TP/SL epoch held on `claude/contracts` for the mainnet deploy. Waiting on the user: faucet (keeper ≈19:00 UTC), Chrome extension (dev accounts), real-money funding, stopping Codex.

# Rebuild status — 2026-10-02, Codex

Current work: [approved mobile rebuild](mobile-rebuild-2026-10-02.md), branch `codex/mobile-quality-rebuild`, baseline `6e2be72`. Foundation and journey source are committed through `1c0ad7d`; source checks, iOS Release and iOS/Android export passed. Current physical-phone acceptance and release runtime/channel verification are pending. Continue from [Claude Code handoff](../design/reviews/2026-10-02-claude-code-handoff.md) and [validation](../design/reviews/2026-10-02-rebuild-validation.md). No new production deployment is claimed. Retained Mainnet/Perpl/issuer/other-chain/programme dependencies remain in the contract. Previous status below is historical and has not been reverified for this rebuild.

# STATUS — updated 2026-10-01 18:10 UTC by claude (lead, Opus 5.5; expanded-review fixes S01/S02/S03/S05/S06, J11, Holders)

Current stage: **S8 RWA mainnet (wave C)** — `docs/plan/stage-08-rwa-mainnet.md` · **v2 plan approved 30 Sep** (`docs/plan/v2-plan.md`): phone-test fixes S8.16a–e first, then S8.22 Practice↔Mainnet toggle, S8.24 mainnet cold start + TxRecovery, mainnet S8.17–S8.21 on the fixed UI when funded; parallel S1b design v2 "Living Lacquer" (`stage-01b-design-v2.md`, D-168; D2 retired), S12b social (`stage-12b-social.md`), S8.23 FX markets (contracts track) · practice side done: S8.2–S8.13, S8.15 · S6 done · S3/S4 merged · Wave A done
Last green commit (gate passed): 1b3a0e5 "feat(S3.1/packages): @senryo/config + @senryo/core foundation; apps consume them"      Last commit: see git log
In-flight: none · merged 1 Oct: keeper-push, art-primers, holders-api, j11-data, discovery-data, ledger-reconcile, docs-cleanup, equity-marks, web-parity (S11b slice 1)
Done: — | Milestones: M0 repo builds [ ] · M1 testnet passkey trade [accepted on the simulator 1 Oct (acceptance.md 08:30Z, 08:32Z); physical device pending] · M2 mainnet end-to-end [ ] · M3 submitted [ ]
Clock: registration closes 06 Oct 23:59Z (registered: [x] 2026-09-30 — Track 01 + Agora Trading · Mera UX · Aurora · Envio) · code freeze 13 Oct 12:00Z · submit target 13 Oct 18:00Z · deadline 14 Oct 03:59Z
Blockers: none on the critical path · **Practice caps — fixed 2 Oct 04:26 UTC:** PracticeScale run 2 executed; the 10143 pool is P$1,000,000 (TVL cap P$4,000,000) and every absolute OI cap is ×4000 (gold P$600,000, EUR P$150,000…), so Practice takes real-sized orders · **Push:** iOS dev build f9b17239 has Push Notifications and an APNs key (1 Oct, user ran the Apple login) — install it on the iPhone; Android push wired through Firebase `senryo-app-xyz` + FCM v1 on EAS, Android dev build queued (D-233) · **Play:** app created and the release account invited (user, 1 Oct); 0.1.0 (2) is live on internal testing (sent by `eas submit`, rolled out through the Play API 2 Oct) — testers are added in Play Console; standalone APK ddf13930 for anyone off the list; Android dev APK 3bd03486 ready to install · mainnet needs the user: funding (Q-012) + Safe 2-of-3 owner addresses + [OK?] per step · testnet MON runway (1 Oct 14:56 UTC): keeper topped up to 0.95 tMON from the sponsor (2 Oct 04:30 UTC), burning ≈ 1.3/day with seven mirrored feeds → ≈ 28 h (to ~19:00 UTC 2 Oct); sponsor 0.92, deployer 0.57 can bridge a short gap; a faucet claim to the keeper `0xf6a3…3b10` keeps Practice prices fresh
Pending on the user: real-money funding only (mainnet S8.17). Deploys, server changes and testnet transactions proceed without asking (user, 1 Oct).
Env readiness (presence only): FIRECRAWL_API_KEY [x] · DEPLOYER_PK [ ] · SPONSOR_PK [ ] · OPERATOR_PK×2 [ ] · KEEPER_PK [ ] · AURORA_API_KEY [ ] · LITHIC_SANDBOX_KEY [ ] · ENVIO_API_TOKEN [x] (~/.config/senryo/envio.env; HyperSync 200 on 143 + 10143) · EXPO project linked @0xabu/senryo (dc2f824) · EXPO_TOKEN [ ] · APPLE_TEAM_ID [x] 86C6ZFJ6V6 (public)
Networks: testnet 10143 — core set redeployed 30 Sep (D-164; SenryoCore 0xA7EE…D8aD, block 66968850, all Sourcify exact_match) + reused AccessManager/calendar/mocks/mirrors · mainnet — none · indexer config: indexer/config.yaml (10143 ours + 143 Chainlink XAU/XAG + Perpl) — entities are already per chain (`disable_default_cross_chain`, composite `(id, chainId)` keys; D-173) — every document filters on chainId (`indexer-docs-chain-filter`, 1 Oct) — S8.20 adds the 143 config, no reset
Coolify: project `senryo` live (images read on the server 1 Oct 18:12 UTC) — senryo-web `sha-ddfdce2` (S11b slice 1, /terms + /privacy, assetlinks with the Play App Signing certificate; 2 Oct), senryo-api `sha-f9cd161` (token search), senryo-keeper `sha-d426a89` (Expo push delivery, 30-min liquidation-warning cooldown, KEEPER_JOBS += receipts), senryo-indexer `sha-ba4b5e2` (the six calculated equity feeds added; reset 18:02 UTC 1 Oct, both chains `isReady` by 18:50; the calculated feeds chart from indexed rounds), senryo-ledger; all healthy (ids-and-txs.md)
Next action: (0) **Expanded review (docs/design/reviews/2026-10-01-expanded-product-design-review.md, builder response at its end):** S01 unknown outcomes on every money screen, S02 exact send/withdraw amounts, S06 stable receipt, S05 failed market rows, Add-money disclosure, Kinpaku honesty, D-232 watchlist sync — all fixed and on main; S07 ledger merged; **S03 read-only discovery built and accepted on the simulator** (55f171b; marks 5f41fe9 with SPY/QQQ as recorded gaps; indexer serves the feeds' rounds, stage doc S1b.9a); S04 web parity: S11b slice 1 (reads) live on web sha-0027eb9 — web transactions, discovery and social still to come · Done 1 Oct afternoon (all checked on the simulator, rows in acceptance.md): **S1b.8a** open-then-protect (52de228); **S8.23 FX on Practice** — AddMarkets run 2 (11/11, `allMarketsOpen`), config lists FX on 10143, api/keeper/indexer/web redeployed, Markets shows EUR/GBP/JPY/CHF/CAD live (e91d5dd); **S1b.13 primers** — Face ID and notification primers in setup with the fūrin and ebi-jō art (22b0732, c70d1ca); **S1b.15 notifications** — registration with the api, You → Notifications switches, push taps open their screen in their own mode, keeper delivery through Expo (7db9389); Home's 24 h change net of transfers (5ae3106); **Holders** tab live (08262bf); **J11 spot tokens** — Markets → Tokens, token pages, the swap ticket and Mainnet Home holdings, every spot trade a passkey step-up (166181d, d949f6a). **Left in S1b:** a real spot swap (needs the user's mainnet USDC + MON), deposit status + other-chain deposits (Aurora), card reveal/wallet pages (an issued card), spoken VoiceOver pass, S1b.17 acceptance rows · (1) the user's Apple login for push (Blockers) · (2) the Terms of use and Privacy notice in `apps/mobile/src/features/legal/content.ts` are the lead's draft: the user reviews them before mainnet · (3) the phone runs today's code from the dev server (`http://192.168.18.5:8082`, the 30 Sep dev client; primers degrade honestly without the new modules) · then mainnet S8.17–S8.21 when funded
