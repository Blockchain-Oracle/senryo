# Stage 14 — Product interrogation, premium rebuild and feature completion (Claude Code lead, from 2 Oct 2026)

**Goal:** implement the [flow book](../product/README.md) end to end: every capability card works, every surface matches its §0.9 before → after, integrations ship real. Plan: `~/.claude/plans/jiggly-munching-island.md` (approved 2 Oct).

**Branch / worktrees:** `claude/premium-takeover` in `../metropolis-takeover`; agent branches `claude/{perpl,anyasset,card,notify,contracts}` in `../wt-*`, merged in the order below. The main folder (`codex/mobile-quality-rebuild`) belongs to Codex until it is stopped; its four-plus uncommitted files are then committed as Codex's work and merged.

Status words: **built** (source) · **accepted-sim** · **accepted-device** · **deployed** · **mainnet-verified** — never merged into one "done".

## Part 1 — Defects (correctness first)
- [x] 1 Over-cap opens step up with a passkey (built 924bd93)
- [ ] 2 Orphan TP/SL — keeper guard + touch rule built and **deployed** (924bd93, 2602ae2; api/keeper `sha-294f8a2`); contract epoch in the signed order built on `claude/contracts` (D-251, 52 forge tests) — **held** until the mainnet deploy / a testnet core redeploy (merging it breaks Practice TP/SL signatures on the current testnet core); close cancels leftovers (trading area)
- [x] 3 Opposite-side pre-slide blocker (built 924bd93)
- [x] 4 Inbox removed from Receive; Mainnet dead ends routed (built 10a24c2); fee reserve composed into every Mainnet operation (built 57d4eb0, fork check 37/37)
- [x] 5 Send any asset; scanner; recipient checks; copy (built 10a24c2)
- [x] 6 Guest-sheet setup; terms gate; welcome-complete timing; kill resume (built f563b2a, terms on every money entry 1f25dd9)
- [x] 7 Explicit visibility; reserved-name copy; backup-passkey warning; watch link route + chainId (built f563b2a; web /watch by chainId 3c9dba7)
- [x] 8 Card intro claim; unfreeze; card push sender (built 02729d3 + card service 38183de)
- [x] 9 FX quantity units (built 1113c5a)
- [x] 10 Delete-data completeness + privacy notice (built f563b2a)
- [x] 11 Push retry (keeper `pushes` job); blocked/muted list; alert cap per mode (`ALERTS_PER_MODE_MAX`); alert edit = replace (built 27123af, f563b2a, 1113c5a)
- [x] 12 Period consistency (D-249); swap fee preflight (B11, 57d4eb0); Practice MON listed under Assets at "No price" (testnet MON has no value, so it never inflates the total); Practice money routing — pool and ticket pull from wallet then trades in one operation (57d4eb0)
- [x] 13 Pool deposit above the move cap steps up with the passkey (built 1113c5a; composed legs b757b7e)

## Foundation
- [x] Native icons (2602ae2)
- [x] SlideToConfirm from 21st slide-action-button, toned by side, busy state (ed4b6b4)
- [x] One outcome surface (TradeTrace as OperationStatus) + AmountHero rolling digits (8127cba)
- [x] Sounds: ElevenLabs palette, by-ear picker, unlock/liquidation/error now sound (8e42c8e)
- [x] Runtime 0.2.0 natives (expo-image, expo-camera, expo-web-browser, expo-sharing, view-shot); welcome swipe ±2 window; preview builds on production APNs (294f8a2)
- [x] Primitives sourced from 21st.dev or recorded as "searched, none fit": 25 ports indexed in `apps/mobile/.21st/design.json` (SlideToConfirm 29304, AmountHero 21513, Keypad 3711, DottedQr 12248, ActionCircle 13564/1051, ChainGrid 1963, SearchField 1645, Disclosure 851, BridgeTimeline 29815, inbox 27135, …); per-area detail in docs/product/provenance/*.md
- [x] Runtime 0.2.0 with native additions (294f8a2)

## Areas (each = its flow-book cards + §0.9 surfaces)
- [x] Home: Total hero, Positions · Assets · Earn tabs (bb76518) — Assets moves to any-asset holdings in `claude/ui-money`
- [x] Money (B1–B16) — built + merged (10a24c2): any-asset holdings, asset page, single-address receive, add money (Ramp buy, other chains quote), send any asset + scan + recipient checks, withdraw Monad/other chain (bank pending Ramp key), any↔any swap with impact rule, activity, balance sheet
- [x] Identity / profile / settings / mode — built + merged (f563b2a): defects 6, 7, 10, 11 (blocked/muted); terms gate (`useTermsGate`) wired on Home + fan (1f25dd9), trading/money call sites pending their merges
- [x] Card + Notifications — built + merged (02729d3, glyphs da7f655, details reveal dde70bc) · Social — built + merged (d718d25: trade-post likes/replies migration 0011, standings route, search)
- [x] Card service outbox fixes — merged (1f848e3), fault-injection check `card-outbox-check`
- [x] Trading (C1–C12) + Pool (D1–D2) — built + merged (1113c5a): defects 2 (close cancels leftovers), 9, 13; TP/SL replace; pause blockers; markets/detail/ticket/position/orders/pool rebuilt
- [ ] Welcome + setup (A1–A3) smoothness and sounds

## Integrations
- [ ] D0 keeper testnet gas — 0.1 tMON sent 2 Oct (tx 0x921e…5838); faucet claim pending (browser); StarterDrip float is 0
- [ ] D1 Perpl: chain layer (77e0133) + app UI (a925a0f: markets, detail, ticket, outcome from decoded fills, positions, move back) built + merged + OTA; **live acceptance waits for mainnet funds: 25 AUSD + 1.5 MON on the account** — script in the Perpl agent report (docs/product/provenance/perpl.md has provenance; acceptance steps recorded in stage notes when run)
- [ ] D2 Bridges built + merged (8752f3f: Relay/CCTP/Across/LI.FI quotes, status, pinned targets) → UI (`claude/ui-money`) → live runs; Aurora behind incident watch (needs Studio key)
- [ ] D3 card service built + merged (38183de: issue, unfreeze, simulate, repay quote, decline reasons) → `senryo-card` resource + Lithic sandbox key → live sandbox issue
- [ ] D4 Mainnet core (needs funding + Safe owners) — includes the TP/SL epoch contract fix
- [ ] D5 Ramp buy (no key) / sell (support key)
- [x] D6 holdings + any↔any swap built + merged (8752f3f); live discovery on the app's own HyperSync token (3 Oct)
- [x] D7 notifications inbox built + merged (27123af) + **deployed** (api/keeper `sha-294f8a2`, KEEPER_JOBS += pushes)
- [x] D8 Wallet activity — built + merged (claude/activity): HyperSync scan stores transfers + native MON (migration 0013), `GET /v1/activity/wallet` folds per transaction (received / sent / swapped), one Activity model in `@senryo/query` for phone and web. **Live since 3 Oct 14:40 UTC on the app's own HyperSync token** (user-provided; in the git-ignored `.env` and Coolify `senryo-api`): Practice holdings complete via HyperSync (AUSD, MON, sLP) and wallet Activity complete with received/swap rows; Mainnet discovery answers. Budget is per token and the indexer spends all of its own, so the indexer's token is never shared. Services run on node:24-slim (8031a70) because Alpine's musl failed HyperSync's DNS inside Docker
- [x] Practice swap (D-252, UNDEFINED-6) — PracticeSwap `0x1D75507fde3680af51f0d11A8A40B59a93399e6A` on 10143, live check at par both ways (0x2899…c505, 0x8c81…25f1), forge 12/12; phone swap + pool pay-with in Practice. Web Practice swap still locked (web follow-up)
- [ ] D9 api/keeper deployed `sha-294f8a2` (2 Oct 14:20 UTC); any-asset routes redeploy in progress; card service resource not created yet (needs Lithic key)
- [ ] D10 Web parity round 1 merged (3c9dba7: Home, Add money/Receive/voucher, any-asset Send/Withdraw on Monad, asset page, markets, ticket with step-up, position reduce/close/TP-SL, social, watch by chainId, setup + terms, card locks; provenance docs/product/provenance/web.md). Round 2 merged (dfbf8a9: pool, activity + inbox, TP/SL replace, swaps, bridges, social actions, saved destinations, settings, scan via jsQR, landing 371→197 KB gz). **Signed acceptance on testnet** (localhost dev rpId, virtual PRF authenticator, account 0xC108…F529): claim 0x90e7…b3d6, send with step-up 0xc633…d6f6, withdraw 0xb39d…56f2, pool deposit (3 steps, one operation) 0xd961…0545, redeem request 0x436a…6266. **Trading steps pending the market reopen (Sun ~22:00 UTC)**. Fixes from the run: Home Total source, reopened moves, Save as…, sLP 12 decimals (phone too, 8336e3e), claim shown twice (b817e6c)
- [x] Mainnet composition merged (57d4eb0): B11 fee reserve ("~$0.50 → MON" step), Pay with any asset on ticket + pool, B4 Relay deposit addresses (EVM origins keyless; Solana/Bitcoin need RELAY_API_KEY). Ticket Details lists the composed steps before the slide (Steps row). Open, part of D4 acceptance: the Mainnet ticket plans its network fee before the slide (`usePreparedOperation`, as send/withdraw do) so a MON shortfall shows pre-slide; zero-MON wallet needs the mainnet sponsor top-up. Proven on a 143 fork; live once SenryoCore/LpVault are on 143 (D4)
- [x] Submission docs: README, LICENSE (MIT), THIRD_PARTY_NOTICES, docs/judges.md (d764bef); public /stats (D-022, live indexer counters cross-checked against row counts) and /judges with a landing "Judge? Start here" (F90) — merged (claude/stats)
- [x] Web round 3 merged (claude/web3): Practice swap at par on web (live 0x8768…539a), deposit address + timeline + Arriving, Pay with any asset on ticket and pool (pool live with test USDC 0xf38b…89ce), fee plan before the slide; shared money model/fee plan/pay-with/deposit addresses moved into `@senryo/query`. Fixed in both apps: pull-from-trades step refused as changed intent, pay-with shortfall (spread + buffer), multi-step operation stopped by its own earlier steps
- [ ] Web Mainnet mode + Perpl on web (web is Practice-only today: `ACTIVE_NETWORK = TESTNET`)
- [ ] D11 Submission (external TestFlight by ~9 Oct) · D12 Meme coins

## Builds and updates (2 Oct)
- iOS preview (ad hoc, runtime 0.2.0) build 141ef955 FINISHED — install from https://expo.dev/accounts/0xabu/projects/senryo/builds/141ef955-01b6-4245-be59-67b509c4f9e9 (the user's iPhone UDID 00008150-000E31212142401C is provisioned).
- EAS Update `preview` group 9b7caf82 (runtime 0.2.0) carries every merged area through 10a24c2. Rollback target: republish an earlier group or the embedded bundle.
- Android preview APK 1f595b80 FINISHED (runtime 0.2.0): https://expo.dev/artifacts/eas/QT0s9Zj8MY0RFhJeKx3zPn8m6709ABJLrXj0oNvcNvo.apk. iOS simulator build 07d63644 passed the launch smoke test.
- api/keeper on Coolify at the latest pushed sha (holdings, swap/bridge quotes, notifications, standings, trade-post likes, card summary, delete-data completeness).

## Handoff
Resume from STATUS.md → this file → the flow book. Accounts still needing the user's browser: Envio (second token), Aurora Studio, Lithic sandbox, Ramp support key, Alchemy, faucet claim.
