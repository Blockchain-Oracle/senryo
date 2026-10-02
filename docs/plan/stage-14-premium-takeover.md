# Stage 14 — Product interrogation, premium rebuild and feature completion (Claude Code lead, from 2 Oct 2026)

**Goal:** implement the [flow book](../product/README.md) end to end: every capability card works, every surface matches its §0.9 before → after, integrations ship real. Plan: `~/.claude/plans/jiggly-munching-island.md` (approved 2 Oct).

**Branch / worktrees:** `claude/premium-takeover` in `../metropolis-takeover`; agent branches `claude/{perpl,anyasset,card,notify,contracts}` in `../wt-*`, merged in the order below. The main folder (`codex/mobile-quality-rebuild`) belongs to Codex until it is stopped; its four-plus uncommitted files are then committed as Codex's work and merged.

Status words: **built** (source) · **accepted-sim** · **accepted-device** · **deployed** · **mainnet-verified** — never merged into one "done".

## Part 1 — Defects (correctness first)
- [x] 1 Over-cap opens step up with a passkey (built 924bd93)
- [ ] 2 Orphan TP/SL — keeper guard + touch rule built and **deployed** (924bd93, 2602ae2; api/keeper `sha-294f8a2`); contract epoch in the signed order built on `claude/contracts` (D-251, 52 forge tests) — **held** until the mainnet deploy / a testnet core redeploy (merging it breaks Practice TP/SL signatures on the current testnet core); close cancels leftovers (trading area)
- [x] 3 Opposite-side pre-slide blocker (built 924bd93)
- [ ] 4 Inbox removed from Receive; Mainnet dead ends routed; fee reserve
- [ ] 5 Send any asset; scanner; recipient checks; copy
- [ ] 6 Guest-sheet setup; terms gate; welcome-complete timing; kill resume
- [ ] 7 Explicit visibility; reserved-name copy; backup-passkey warning; watch link route + chainId
- [ ] 8 Card intro claim; unfreeze; card push sender
- [ ] 9 FX quantity units
- [ ] 10 Delete-data completeness + privacy notice
- [ ] 11 Push retry; blocked/muted list; alert cap per mode; alert edit
- [ ] 12 Period consistency; SwapTicket fee preflight; Practice MON in total; Practice money routing
- [ ] 13 Pool deposit above the move cap has no passkey route (found by the flow book, d-earn.md)

## Foundation
- [x] Native icons (2602ae2)
- [x] SlideToConfirm from 21st slide-action-button, toned by side, busy state (ed4b6b4)
- [x] One outcome surface (TradeTrace as OperationStatus) + AmountHero rolling digits (8127cba)
- [x] Sounds: ElevenLabs palette, by-ear picker, unlock/liquidation/error now sound (8e42c8e)
- [x] Runtime 0.2.0 natives (expo-image, expo-camera, expo-web-browser, expo-sharing, view-shot); welcome swipe ±2 window; preview builds on production APNs (294f8a2)
- [ ] Primitives sourced from 21st.dev: Text roles, Row, StatStrip, ActionCircle, AmountHero, GlassIconButton, InfoSheet, OperationStatus, SlideToConfirm (tone + busy), AssetPicker, ChainPicker, RecipientSearch, Keypad amount entry
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
- [ ] D1 Perpl chain layer built + merged (77e0133; simulated open/close on mainnet state) → UI → live trade (needs ≥10 AUSD + ~0.5 MON)
- [ ] D2 Bridges built + merged (8752f3f: Relay/CCTP/Across/LI.FI quotes, status, pinned targets) → UI (`claude/ui-money`) → live runs; Aurora behind incident watch (needs Studio key)
- [ ] D3 card service built + merged (38183de: issue, unfreeze, simulate, repay quote, decline reasons) → `senryo-card` resource + Lithic sandbox key → live sandbox issue
- [ ] D4 Mainnet core (needs funding + Safe owners) — includes the TP/SL epoch contract fix
- [ ] D5 Ramp buy (no key) / sell (support key)
- [ ] D6 holdings + any↔any swap built + merged (8752f3f) — dedicated HyperSync token needed (shared one is rate-limited by the indexer)
- [x] D7 notifications inbox built + merged (27123af) + **deployed** (api/keeper `sha-294f8a2`, KEEPER_JOBS += pushes)
- [ ] D8 Wallet activity indexing
- [ ] D9 api/keeper deployed `sha-294f8a2` (2 Oct 14:20 UTC); any-asset routes redeploy in progress; card service resource not created yet (needs Lithic key)
- [ ] D10 Web parity · D11 Submission (external TestFlight by ~9 Oct) · D12 Meme coins

## Builds and updates (2 Oct)
- iOS preview (ad hoc, runtime 0.2.0) build 141ef955 FINISHED — install from https://expo.dev/accounts/0xabu/projects/senryo/builds/141ef955-01b6-4245-be59-67b509c4f9e9 (the user's iPhone UDID 00008150-000E31212142401C is provisioned).
- EAS Update `preview` group 9b7caf82 (runtime 0.2.0) carries every merged area through 10a24c2. Rollback target: republish an earlier group or the embedded bundle.
- Android preview APK 1f595b80 queued; iOS simulator build 07d63644 queued (launch smoke test).
- api/keeper on Coolify at the latest pushed sha (holdings, swap/bridge quotes, notifications, standings, trade-post likes, card summary, delete-data completeness).

## Handoff
Resume from STATUS.md → this file → the flow book. Accounts still needing the user's browser: Envio (second token), Aurora Studio, Lithic sandbox, Ramp support key, Alchemy, faucet claim.
