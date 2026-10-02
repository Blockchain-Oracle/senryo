# Claude Code continuation — Senryo rebuild, 2 October 2026

The user asked Codex to round off because their credit is nearly finished and explicitly asked for a detailed Claude Code handoff so Claude can continue. Continue the approved work in this repository. This is a source implementation handoff, **not a completed rebuild or release approval**.

## Read first

1. `docs/plan/mobile-rebuild-2026-10-02.md` — latest approved contract, overriding the earlier remediation design stage. The user's full original plan is the governing request in the Codex chat; this document captures its decisions, journey order and gates.
2. `docs/plan/v2-plan.md`, `docs/plan/decisions.md`, `docs/plan/STATUS.md` — broader retained roadmap and prerequisites.
3. `docs/design/reviews/2026-10-02-rebuild-validation.md` — exact passed checks, observed simulator states and unverified gates.
4. `docs/design/senryo-parity-ledger.json` and acceptance records — historical acceptance is not rebuild acceptance. Every retained row has pending rebuild acceptance.
5. `docs/design/reference-study-2026-09-30/README.md` and guides — private local Fomo/Phantom/Solflare evidence. Do not commit/reference-crop production assets. Approved Senryo onboarding artwork is retained; Gray Card recording is absent.
6. `AGENTS.md` and applicable repository instructions: bigint money, account signs/chain sends, <=400-line source files, no UI test suites, pnpm. Read installed Turbo docs before touching its configuration/commands. No framework migration or web wrapper.

## Git and completed source

Repository `/Users/abu/dev/hackathon/metropolis`, branch `codex/mobile-quality-rebuild`, baseline `6e2be72`.

| Commit | Source work |
|---|---|
| `86261a1` | Approved plan, decisions D-234–236, roadmap and acceptance reconciliation. |
| `73367db` | Versioned public operations extending journal/trace, immutable reviewed intent, individual finalized facts, unknown-outcome recovery, coherent portfolio, indexed own pool requests and actor-paginated feed. |
| `36f35ce` | Welcome/install separation and pending links, UI-thread rail and swipe, review guards, shared capture owner, quiet original WAVs and central outcome feedback, durable starter/voucher relays. |
| `cb5d1e4` | Portfolio-led Home, direct Withdraw, distinct wallet/inbox Receive, explicit wallet-to-trading, scoped Send and receipts, money/trading revalidation, partial protection truth, exact pool amounts. |
| `1c0ad7d` | Real card service summary/merchant/last4 capabilities, unissued/locked states, network-separated card service, Profile performance/history, actor-filtered public feed, separate Settings. |

Source checks passed as detailed in validation; 29 account tests, 145 social checks, eight recovery and six network checks, plus targeted foundation/guard/portfolio/receipt scripts. No live funds were used by the added fork checks. Android/iOS export succeeded. iOS Release built; Debug linker issue is documented. No production source deployment, EAS build/update/store rollout, provider credential setup or live money transaction was performed.

## First continuation checkpoint

1. Read the final build/export logs and verify their terminal statuses. Final native bundle finished successfully (`BUILD SUCCEEDED`); both platform exports also finished successfully. Run final source checks only if they failed, are incomplete or you change source; avoid repeating broad work without cause.
2. Install the final Release binary on the disposable test simulators. Reproduce **fresh install**, **uninstall/reinstall with retained Keychain hint**, update preservation, guest browse, cancelled auth/setup and deferred deep links. Do not erase the original A3 account or touch the separate Kawase simulator/session.
3. Review the final funding hub → Receive destination → Back, Mainnet wallet default, wallet-to-trading dependency state and shortened withdrawal rail at real phone scale. Recent source corrections postdate the first screenshot review. Review slider partial/cancel/background/changed-intent paths without submitting a live-money transaction.
4. Continue the complete money and trading journeys in approved stage order. Required recorded lifecycle: funding/finalized movement/cancel/relaunch; then claim/fund → open → protect → partial close → close. Use isolated local fork/test fixtures for destructive or repeatable financial checks. No UI suites. Phone acceptance requires a physical phone and release gesture evidence.
5. Update validation, parity and acceptance with observed revision/build/device/mode/reference/evidence. Keep unavailable integrations accurately gated. Only move to preview/internal distribution after its acceptance prerequisites; establish exact installed runtime/channel and concrete rollback target first.

The whole plan remains open until its phone and provider gates are met. Work on independently useful source/review tasks while prerequisites are unavailable; name actual dependencies instead of marking them complete. Kawase auth/voice and meme coins are outside immediate priorities.

## Important implementation details to preserve

- `packages/query/src/operations.ts` and `operation-progress.ts`: public context before signing, stable account/chain/action identity, multi-step planned actions. Approval completion is not deposit completion; open completion is not protection completion. Do not mutate reviewed intent to fit a later quote. Root outcome and receipt facts derive from all steps.
- `packages/query/src/trace.ts`, mobile `lib/account/sender.ts`, chain `send.ts`/`recovery.ts`: before/after-auth scope/intent checks, same-operation recovery, no automatic broadcast/resume after relaunch, no age-based abandonment permitting duplicates. Signed unknown results remain pending. Receipt recovery can match journal step metadata if public hash persistence failed.
- `packages/chain/src/portfolio.ts` and `pinned-read.ts`: all money components use one finalized block. When the indexer is fully ready at an older block, select that block for **every** component. Unknown prices are Partial, never zero. Undo display haircuts while keeping authoritative risk/spending calculations, fees and debt. Pool value is actual conservative share valuation, can change between blocks; active and escrowed shares both count. Mainnet native MON is handled through the native spot token. Practice gas is not real-money value.
- `packages/query/src/lp-requests.ts`: query all own requests with pagination, including redeemed entities so older coherent snapshots still see escrow; verify ownership/unclaimed shares onchain. Local finalized redemption facts fill indexer lag. Do not restore the last-50-global assumption.
- `features/fund/useInboxCredit.ts`: durable observed arrival; empty inbox alone cannot mean credit. Verify canonical finalized Core `Deposited` events for user, inbox payer and supported tokens after observed block; sum the actual **amount** field (not `received`). Additional arrivals during one pending record merit review; do not infer amounts from current equity.
- `lib/account/relay-operation.ts`: write pending **before** relay POST. Lost responses cannot permit another signed request. Success requires canonical finalized StarterDrip receipt and sufficient actual Core credit for the account/payer. `useStarter`/`useVoucher` recover read-only and keep uncertainty pending. New `relay-receipt-check.ts` rejects wrong scope, finality, target/emitter/payer and insufficient credit.
- `components/trade/HoldToConfirm.tsx`: legacy filename/export now implements the 56pt/48pt **slide**, one commit after >=90% released travel; interruptions/intent changes reset. Explicit accessible review/confirm fallback. Never replace it with an immediate tap for ordinary gesture use.
- `lib/review-guard.ts`: background generation invalidates reviewed gestures even after returning active; iOS inactive during Face ID does not itself discard the review. Account/network and quote/balance/market checks remain required before signing and after auth/gas preparation.
- Quiet original bundled WAVs in `assets/sounds`, central `FeedbackHost`: finalized live financial outcomes only, once per operation outcome. Approval/nav/loading/auth cancellation silent, historical recovery does not replay a queue. Sound errors never affect sends. Real silent-switch/mixing/audio-quality acceptance is still pending.
- `lib/capture-protection.ts`: shared serialized reference-counted owner; protection awaited before reveal, hide on background and cleanup. Ordinary masked card art shareable. Card secrets/mobile wallet provisioning remain issuer/protected-view dependencies; no sample merchant, holder or number is ordinary activity.
- Settings browse requires no Face ID. External sends, spot swaps, allowance/security/recovery changes retain step-up; live scoped trading/self-withdrawal retains allowed policy.
- API/card source changes have not been deployed. Mainnet core is undeployed in current configuration, so wallet functions can exist separately from engine trading. Perpl/Aurora/issuer/fiat/rewards/clans/news/X keep explicit prerequisites from the roadmap.

## Local runtime and evidence

Logs live in `/tmp/senryo-rebuild-*.txt`; consult validation for exact names. Final export `/tmp/senryo-rebuild-export` includes metadata and both platforms. Release native build log `/tmp/senryo-rebuild-ios-final-source.txt`. Binary `/Users/abu/Library/Developer/Xcode/DerivedData/Senryo-ajxbdmogcytfgjerwbafwikarnqk/Build/Products/Release-iphonesimulator/Senryo.app`. Version 0.1.0 (1); local runtime `appVersion`, not accepted store-channel identity.

Simulator IDs: original A3 `F0B5E224-2611-48F7-B64C-73BEAAEB9C93` (account preserved), restored clone `02B36473-07E8-4EA7-B755-EFB5BD641765` (app/data not yet uninstalled), fresh `14AFB56A-E59F-424F-ABE2-45FB515DA3ED` (not installed). Clone/fresh tests were prepared but not executed before the user requested handoff. No physical phone attached. Simulator UI control can collide with another chat's Kawase work; verify the window title before acting.

Private source recording `/Users/abu/Downloads/ScreenRecording_10-02-2026 07-42-47_1.MP4`; inspected frames `/tmp/senryo-feedback-20261002`. Simulator screenshots `/tmp/senryo-rebuild-evidence-20261002`. The user's recording proves an existing-session Practice short open/close; it does not prove first-run onboarding or the new slider.

Own temporary processes: Metro on 8083 (`/tmp/senryo-rebuild-metro.txt`) and isolated Anvil on 18765 (`/tmp/senryo-rebuild-anvil.log`). The Anvil log contains ephemeral default keys: **do not print it**. Do not terminate unrelated Metro 8082 or Kawase build/simulator processes. Dedicated local social-check DB `senryo_rebuild_check_01a0fb6e` contains only this harness's scratch data; harness cleaned its own rows.

Useful checks from `scripts/drive`: `pnpm exec tsx src/mobile-foundation-check.ts`, `src/review-guard-check.ts`, `src/relay-receipt-check.ts`; `src/portfolio-check.ts` requires local fork 18765 and refuses public write RPCs. Workspace typechecks use direct filtered `pnpm ... typecheck`; invariants `node scripts/invariants/run.mjs`.

Do not start by redoing the design reset or replacing the stack. Start at the unfinished validation checkpoint, compare actual phone-scale states with the approved references, fix concrete defects, and make small reviewable commits.
