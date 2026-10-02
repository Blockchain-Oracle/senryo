# Stage 14 — Product interrogation, premium rebuild and feature completion (Claude Code lead, from 2 Oct 2026)

**Goal:** implement the [flow book](../product/README.md) end to end: every capability card works, every surface matches its §0.9 before → after, integrations ship real. Plan: `~/.claude/plans/jiggly-munching-island.md` (approved 2 Oct).

**Branch / worktrees:** `claude/premium-takeover` in `../metropolis-takeover`; agent branches `claude/{perpl,anyasset,card,notify,contracts}` in `../wt-*`, merged in the order below. The main folder (`codex/mobile-quality-rebuild`) belongs to Codex until it is stopped; its four-plus uncommitted files are then committed as Codex's work and merged.

Status words: **built** (source) · **accepted-sim** · **accepted-device** · **deployed** · **mainnet-verified** — never merged into one "done".

## Part 1 — Defects (correctness first)
- [x] 1 Over-cap opens step up with a passkey (built 924bd93)
- [ ] 2 Orphan TP/SL — keeper guard + touch rule built (924bd93, 2602ae2); close cancels leftovers (trading area); contract epoch (`claude/contracts`)
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
- [ ] Primitives sourced from 21st.dev: Text roles, Row, StatStrip, ActionCircle, AmountHero, GlassIconButton, InfoSheet, OperationStatus, SlideToConfirm (tone + busy), AssetPicker, ChainPicker, RecipientSearch, Keypad amount entry
- [ ] Runtime 0.2.0 with native additions (expo-image, expo-camera, expo-web-browser, share/snapshot)

## Areas (each = its flow-book cards + §0.9 surfaces)
- [ ] Home + asset model + balance sheet + mode + profile/settings (lead)
- [ ] Card / Social / Notifications
- [ ] Money (B1–B16)
- [ ] Trading (C1–C12) + Pool (D1–D2)
- [ ] Welcome + setup (A1–A3) smoothness and sounds

## Integrations
- [ ] D0 keeper testnet gas — 0.1 tMON sent 2 Oct (tx 0x921e…5838); faucet claim pending (browser); StarterDrip float is 0
- [ ] D1 Perpl chain layer (`claude/perpl`) → UI → live trade (needs funds)
- [ ] D2 Bridges (Relay/CCTP/Across in `claude/anyasset`) → UI → live runs; Aurora behind incident watch (needs Studio key)
- [ ] D3 Lithic sandbox card (`claude/card`) → deploy → live sandbox issue (needs key)
- [ ] D4 Mainnet core (needs funding + Safe owners) — includes the TP/SL epoch contract fix
- [ ] D5 Ramp buy (no key) / sell (support key)
- [ ] D6 Holdings + any↔any swap (`claude/anyasset`) — dedicated HyperSync token needed
- [ ] D7 Notifications inbox (`claude/notify`)
- [ ] D8 Wallet activity indexing
- [ ] D9 Deploy api/card/keeper changes before the first OTA
- [ ] D10 Web parity · D11 Submission (external TestFlight by ~9 Oct) · D12 Meme coins

## Handoff
Resume from STATUS.md → this file → the flow book. Accounts still needing the user's browser: Envio (second token), Aurora Studio, Lithic sandbox, Ramp support key, Alchemy, faucet claim.
