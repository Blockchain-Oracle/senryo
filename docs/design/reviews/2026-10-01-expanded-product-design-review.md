# Senryo: expanded product, design and architecture review

Reviewed 1 October 2026. Requested together with the [Kawase review](/Users/abu/dev/hackathon/tamion/plan/reviews/2026-10-01-expanded-product-design-review.md). See the [shared handoff](/Users/abu/dev/hackathon/tamion/plan/reviews/2026-10-01-two-project-review-handoff.md) for the common build-process correction.

**Verdict:** the present mobile app shows substantial progress toward the references: the ticket anatomy, compact sheets, entity artwork, real allowances, practice labeling, social surfaces and new primers are recognizable and coherent. The remaining problems are not solved by another visual reset. They include incomplete user control over amounts, unsafe transaction-outcome wording, reduced market discovery, web parity and stale completion records. Those are concrete ways a promising implementation can still fall short of the product agreed in the plan.

## Evidence and scope

- Authority: [master plan](/Users/abu/dev/hackathon/metropolis/docs/plan/00-plan.md), [v2 plan](/Users/abu/dev/hackathon/metropolis/docs/plan/v2-plan.md), [decisions](/Users/abu/dev/hackathon/metropolis/docs/plan/decisions.md), [current handoff](/Users/abu/dev/hackathon/metropolis/docs/design/senryo-v2/PROJECT-HANDOFF.md), Living Lacquer manifests and [parity ledger](/Users/abu/dev/hackathon/metropolis/docs/design/senryo-parity-ledger.json). D2 Desk is retired. D-196 supersedes earlier controls/sheet/navigation instructions where they disagree with the measured Fomo frames.
- The supplied Solflare/Phantom/Fomo evidence is the minimum baseline for the approved Senryo journeys. Senryo's actual passkeys, money, networks, venues, card and LP rules govern adaptations. Logos and material art are actual assets, not generic substitutes or cropped reference artwork.
- This is a plans/source/saved-image review. No new runtime captures, transactions, deployments, device runs or production checks were performed. Existing screenshot filenames and modification times identify captured builds; they do not establish current runtime behavior. Motion sequences and accessibility on physical devices remain outside fresh verification.
- Evidence snapshot HEAD: `bf52c2708520d5481cc29a8ace41691838170ad0`. Development continued during review; the immediately prior commit was `37f3473`. [Manifest, images and source snapshots](/Users/abu/dev/hackathon/metropolis/docs/design/reviews/2026-10-01-expanded-evidence/manifest.json) preserve the reviewed evidence. **Closing update:** `bfa828f` refreshes STATUS for practice FX, primers, push and deployment. The inspected S01/S02/S06 source is unchanged; the old next-action mismatch in S07 has been partly corrected.
- 21st scans completed with zero errors: mobile, 359 files, nine warnings/six suggestions; web, 116 files, two warnings/35 suggestions. [Mobile results](/Users/abu/dev/hackathon/metropolis/docs/design/reviews/2026-10-01-expanded-evidence/apps-mobile-src-21st.json), [web results](/Users/abu/dev/hackathon/metropolis/docs/design/reviews/2026-10-01-expanded-evidence/apps-web-src-21st.json). These shallow checks cannot validate financial outcomes, journey parity or native interaction. Autofocus warnings alone are not proof of bad focus behavior.
- The additional Circle web reference was not located; the user said its location did not matter. This report does not claim to have inspected it.

![Saved Senryo journey states](/Users/abu/dev/hackathon/metropolis/docs/design/reviews/2026-10-01-expanded-evidence/images/senryo-journeys-board.jpg)

## Prioritized findings

### S01 · P1 · Send and withdrawal can say “nothing moved” for an unknown signed outcome

**Proven source defect; financial truth and recovery.** The shared [trace classifier](/Users/abu/dev/hackathon/metropolis/packages/query/src/trace.ts:44) correctly separates `not-sent` from `unknown`: a failure after signing may still settle. [Trace execution](/Users/abu/dev/hackathon/metropolis/packages/query/src/trace.ts:201) appends a `failed` stage for caught errors and releases `running`. However, [SendToAddress](/Users/abu/dev/hackathon/metropolis/apps/mobile/src/features/withdraw/SendToAddress.tsx:154) and [WithdrawToSelf](/Users/abu/dev/hackathon/metropolis/apps/mobile/src/features/withdraw/WithdrawToSelf.tsx:99) look only at the last stage. Both turn `failed` into “That didn’t go through; nothing moved.” Their buttons are available again when the trace stops running, without an unresolved-outcome guard.

Sequence: signed → receipt/watch error → failed stage → shared outcome `unknown`, but the screen says nothing moved and permits another action. A second send could be an additional payment if the first settles. This is a source-proven path, not a claim that a duplicate payment was observed on a device in this review.

Use the shared resolved outcome, including the journal, throughout money screens. While unknown, show the signed transaction being checked and disallow a replacement. Confirmed revert, proved abandonment and failure before signing need their own truthful copy; even a revert can consume gas. Keep the existing per-chain journal and recovery host.

**Acceptance:** exercise pre-sign failure, signed-watch failure, finalization, revert, app kill and foreground recovery. The unknown branch never claims no movement or offers a replacement payment. Bind the eventual receipt to the original amount/recipient/network.

### S02 · P1 · Users cannot send or withdraw an exact amount

**Proven scope/interaction limitation.** [SendToAddress](/Users/abu/dev/hackathon/metropolis/apps/mobile/src/features/withdraw/SendToAddress.tsx:68) computes `amount = maxWithdrawable × shareBps`; [WithdrawToSelf](/Users/abu/dev/hackathon/metropolis/apps/mobile/src/features/withdraw/WithdrawToSelf.tsx:45) does the same. The only amount controls are percentage presets. If the available balance is P$74.77, a user cannot simply choose to send P$10.00. The saved send screen visibly shows a percentage-derived amount.

The [approved send review surface](/Users/abu/dev/hackathon/metropolis/docs/design/senryo-v2/PROJECT-HANDOFF.md:249) and F23 require a deliberate amount/review journey, not only a share picker. Keep percentages as conveniences, but add exact token amount entry using integer base units and balance/withdrawable validation. Freeze the reviewed request through the passkey step; a balance refresh must not silently change an amount chosen for signing.

**Acceptance:** choose an exact amount, switch token, return from review, refresh balances and perform the passkey check. The submitted amount equals the explicitly reviewed amount. Percentage presets continue to work without becoming the only control.

### S03 · P1 · Broader discovery is reduced to non-interactive “Arriving” rows

**Current scope gap; execution staging is justified, discovery loss is not closed.** [Universe](/Users/abu/dev/hackathon/metropolis/apps/mobile/src/features/markets/universe.ts:45) puts crypto in “With Perpl trading” rows and lists only Nvidia in the equity group. [ArrivingMarketRow](/Users/abu/dev/hackathon/metropolis/apps/mobile/src/features/markets/MarketRow.tsx:114) intentionally has no price and no navigation. That prevents a user from viewing read-only chart, About or contextual information for those instruments.

The [v2 intended outcome](/Users/abu/dev/hackathon/metropolis/docs/plan/v2-plan.md:32) includes market breadth and honest indicative discovery while research gates execution. Missing execution authority should remain explicit, but it should not automatically remove supported read-only discovery. D-220 also records a much broader researched equity universe and differentiates calmer ETFs from blocked single-name execution. A single “Needs a live feed” Nvidia row does not express those distinctions.

Keep three separate states: discoverable with authoritative indicative data; executable on this mode/venue; unavailable data with a named reason. Preserve explicit wrapper identity for calculated tokenized-equity feeds. Do not fabricate prices, classify calculated prices as ordinary equity execution, or enable Perpl practice without its approved adapter.

**Acceptance:** each approved category has an explicit inventory and supported discovery state. A blocked trade can still have a truthful detail surface when authoritative read-only data exists. “Arriving” must identify the dependency and stage instead of becoming a permanent scope reduction.

### S04 · P1 milestone gap · Web parity is still a preview desk

**Planned unfinished work; not undisclosed fake execution.** The current [web TradeScreen](/Users/abu/dev/hackathon/metropolis/apps/web/src/components/screens/trade/trade-screen.tsx:13) imports sample markets/positions and generates sample candles. [Register](/Users/abu/dev/hackathon/metropolis/apps/web/src/components/screens/register.tsx:3) and [Ticket](/Users/abu/dev/hackathon/metropolis/apps/web/src/components/screens/trade/ticket.tsx:22) also consume sample values. The preview badge explicitly labels this, and web authentication has separate real work. The desk is therefore not yet equivalent to the native money product.

Its manifest now names Living Lacquer, but the desk composition still documents D2 and retains that older screen structure. [S11b](/Users/abu/dev/hackathon/metropolis/docs/plan/00-plan.md:430) is an explicit later slice; this review does not call that slice abandoned. It must remain a high-visibility dependency before claiming “web complete,” production parity or a full judge path on web. Token changes alone cannot deliver route/state/data parity.

**Acceptance:** replace sample values screen by screen with the real reading model, data and transactions; provide the same guest, pending, unknown, failed, recovered and mode behavior; adapt the reference interaction purpose to desktop keyboard and layout. Keep the preview badge for any remaining sample section until that section is genuinely connected.

### S05 · P2 · Failed market reads become a loading-looking dead end

**Proven UI-state defect.** [EngineMarketRow](/Users/abu/dev/hackathon/metropolis/apps/mobile/src/features/markets/MarketRow.tsx:38) groups `unknown` and `failed`, renders a skeleton and a non-interactive View, and supplies no direct Retry. A read failure should not look indefinitely like a first load, and it currently also removes detail navigation. The handoff's [Markets state contract](/Users/abu/dev/hackathon/metropolis/docs/design/senryo-v2/PROJECT-HANDOFF.md:215) requires failure + Retry.

Separate loading, failed-without-cache and stale-with-cache. Preserve entity and meaningful navigation where safe, mark unavailable prices, and block trading through the actual price/policy conditions. Retry must have an accessible action and honest busy state.

### S06 · P2 · The next draft can share the screen with an old success receipt

**Observed saved state and current code confirmation.** [SendToAddress](/Users/abu/dev/hackathon/metropolis/apps/mobile/src/features/withdraw/SendToAddress.tsx:154) retains the last successful `sent` value while the current amount is recalculated from refreshed balances. The saved `af2.png` shows P$12.88 in the current entry/review and a P$17.17 finalized message immediately above an enabled Review and send button. The previous result is true, but its relationship to the current request is unclear. Withdraw has the same inline-result pattern.

Make completion a stable receipt of the executed request. A distinct “Send another” or “Withdraw again” transition should start a new draft and clear or archive the previous result. Never make a refreshed balance alter the apparent amount of the completed operation. S01's unresolved guard takes priority over this presentation fix.

**Acceptance:** after a balance refresh or input edit, there is no ambiguity between the last receipt and the next draft. Exact amount, destination, token and network stay attached to the operation that actually completed.

### S07 · P2 · The acceptance and status records do not describe the same revision

**Process/evidence gap, partly corrected during review.** At the evidence snapshot, the status next-action list still listed withdrawal, LP, light theme and primers as left to do, while later [stage findings](/Users/abu/dev/hackathon/metropolis/docs/plan/stage-01b-design-v2.md:254) documented built/checked versions. The closing [STATUS update](/Users/abu/dev/hackathon/metropolis/docs/plan/STATUS.md:13) removes that old queue and credits practice FX, primers and push. The remaining gap is requirement-level reconciliation: the parity ledger contains 216 rows; 178 still have acceptance status `pending`, including implemented behaviors. Older acquisition/asset comments also lag newer artwork.

Those numbers are **stale ledger status counts, not 178 missing features**. But a future agent using them cannot reliably decide what is absent, built, accepted or still blocked. Reconcile stage boxes, current status, requirement rows and acceptance artifacts after each merged slice. Link each accepted row to its actual revision and scenario; retain platform/outcome gaps as open.

Two examples show why this matters: old FX captures truncate currency names, but [current row code](/Users/abu/dev/hackathon/metropolis/apps/mobile/src/features/markets/MarketRow.tsx:79) now uses currency codes and pairs; older home captures show cash-flow-sized losses, while [current HomeHeader](/Users/abu/dev/hackathon/metropolis/apps/mobile/src/features/home/HomeHeader.tsx:40) adjusts the displayed change for inflows/outflows. These should be marked implemented fixes requiring matching acceptance evidence, rather than repeated as unchanged bugs.

### S08 · P2 acceptance gap · Real card and social/push outcomes remain broader than the visible screens

**Partial product completion, with honest boundaries.** D-198 correctly makes the limit and Freeze real onchain controls. [SpendLimit](/Users/abu/dev/hackathon/metropolis/apps/mobile/src/features/card/SpendLimit.tsx:1) reads the account allowance; card imagery, number and authorization examples remain Sample. A real allowance does not close card issuance, KYC, spend, holds/capture/refund or wallet integration.

The market detail source explicitly omits Holders because its indexer hook is absent. Social screens/backend and push have advanced significantly, including the reviewed commit's notification-aware alert footnote. Updated STATUS records current deployments but also an iOS push blocker: the development provisioning profile lacks push capability and Expo reports missing APNs credentials. Device delivery and lifecycle evidence remain required before corresponding parity rows close. Preserve sample labels and permission explanations. Do not substitute invented authorizations, holders, activity or notification delivery to fill the visual gaps.

## Full-product coverage and reminders

Senryo is not required to become Kawase's general automation system. It does have planned cross-chain funding, keepers, price alerts and TP/SL; those are distinct product responsibilities. The user's general point is to retain all agreed responsibilities while implementing slices.

| Area / promise | Evidence now | Work the builder must carry forward |
|---|---|---|
| Passkey/account/recovery | Substantial real implementation; new first-run setup/primers recorded | Clean-device restore, unsupported-provider/device paths, second-passkey/export and interrupted ceremony acceptance; F01–F09 |
| Practice/mainnet | Runtime toggle, separate chain identities, journal reads its entry's chain | Mainnet funding/deploy/cold start and mode-aware pushes/receipts; S8.17–24, F06/F49 |
| RWA engine | XAU/XAG; updated STATUS records five FX pairs live on Practice and related redeploys; trading/protection/close evidence recorded | Mainnet listing/deploy gates and full stale/closed/circuit/pause/risk outcomes; S8 |
| Perpl crypto | Real market registry and later S7 integration planned | Full funding/trade/reduce/close/liquidation paths and truthful practice limitation; S7/B10 |
| Wider market discovery | Category UI, researched feeds, arriving rows | S03: explicit whole inventory, indicative detail and per-instrument execution gates; W6/J3/J11 |
| Positions and TP/SL | Real ticket, existing-position triggers and open-then-protect pieces | Partial multi-step outcomes, cancellation/expiry, unknown/recovered and liquidation paths; J4/J5/F14 |
| Home balances/chart | Separate capacities, real risk reads and current cash-flow-adjusted change | Verify reconciliation against indexed flows and stable/cache/error states; do not confuse Free to trade and Free to spend with disjoint partitions |
| Direct receive | Monad inbox/QR and recorded decode evidence | Below-min, delayed credit, receipt attribution, arrival/credit interruptions and other-network labeling; J2 |
| Other-chain deposits | Explicit Aurora/intents plan, reserved routing UI | Supported families/assets, minimums/fees/ETA, persisted execution/resume, refund/late deposit, deposit-and-open and correct status; S9/F21 |
| Swaps | Mainnet collateral-swap path; practice lacks a pool and says so | Complete quote/refresh/minOut/error/recovery and final receipt acceptance; F22/F26 |
| Withdraw/send | Real signing path and recipient resolution | S01/S02/S06: exact amount, unknown outcome and stable receipt; verify own-wallet and third-party authority distinction |
| LP | Real deposit page and builder-recorded transaction | Full redeem request → wait → claim, closed-market block, pool caps/risks and recovered outcomes; F24/F25/J10 |
| Kinpaku | Real allowance and Freeze; labeled sample card/auths | Provider issuance/KYC, authorization/capture/refund/debt, reveal/wallet and expiry; S10/B11 |
| Social/search | Profile, follow, feed, moderation, leaderboard and avatar work | Deployment plus pagination/error/permissions, full metric truth, Holders indexer hook and accepted network-separated activity; S12b/J8/J9 |
| Alerts/notifications | Server-backed alerts, keeper/push changes and permission-aware UI | Fired/disabled/dead-token behavior on supported devices; network deep links, missed notification and settings coherence; S12 |
| Web/desktop | Honest preview desk plus authentication | S04: actual data/actions, current layout, keyboard/multi-tab state and full journey parity; S11b/F64/F65 |
| Delivery/docs/production | Existing services/runbooks; closing STATUS now records newer web/indexer/API/keeper deployments | Confirm production scenario outcomes; iOS push provisioning/credentials, store/device builds, docs, health/rollback, judge walkthrough and submission; S13–S17 |

**Actual exclusions are respected.** D-194 removed predictions/sports, NFTs, dApp browser, travel/borrowing/virtual accounts/cashback and the tracking prompt. D-195 removed a separate Senryo PIN/password. OAuth and recovery-phrase import have binding product exclusions. Do not bring these back as “forgotten features.” Card/Apple Pay funding, rewards/referrals, clans/competitions and news/X integrations have separate blocked/deferred treatment; maintain their real dependency rather than inventing a working surface.

## Design review against the saved references

![Reference anatomy and identity roles](/Users/abu/dev/hackathon/metropolis/docs/design/reviews/2026-10-01-expanded-evidence/images/references-board.jpg)

**Preserve the progress.** Fomo's compact funding-selector grammar is visible in the current Add money sheet. The ticket has the asset/venue header, margin/leveraged-size distinction, leverage, keypad/chart switch and nested protection sheet. Primers now use authored material scenes rather than the earlier generic decorative shapes. Light and dark captures exist. Utility controls, provider identity and financial status usually occupy distinct roles.

| Surface | Review judgment and next correction |
|---|---|
| Add money | Good compact parent. Preserve its origin and selection when a child returns. A provider row must disclose current support before requesting money or routing to a blocked stage |
| Markets | Real metals/FX artwork and recognizable token identity are strong. Keep the current code/pair fix; verify it at default and large type. Fix failed-row states and wider discovery before adding more decoration |
| Ticket/TP-SL | Anatomy closely follows the reference purpose. Verify keyboard/back restoration, retained values, immutable reviewed operation and truthful partial/unknown outcomes. One successful protect flow does not close every two-leg failure |
| Send/withdraw | Materially incomplete amount control and outcome presentation; use S01/S02/S06 as acceptance requirements |
| Home | Clearer balance register and current flow-adjusted change. Explain overlapping capacities with the detail surface; chart/value/staleness must not communicate contradictory truths |
| Kinpaku | Keep the authored card and real allowance. Sample PAN/merchant examples need visible labeling; unavailable wallet/reveal/issued-card branches need an honest first action |
| Social/profile | Actual avatar and identity roles are appropriate. Empty, blocked/muted/private, stale and pagination states must have equal attention to the populated feed |
| Onboarding/primers | Gold material art and stable actions are progress. Static art approval is separate from motion and on-device acceptance; the pending-passkey and full first-run sequence still need matching evidence |
| Web | Keep updated brand tokens/real seal, but rebuild data and composition to the approved current behavior rather than treating a reskinned preview as parity |

**Logos versus icons:** native identity is not generally missing. The current market rows use real BTC/other token marks and authored metal/FX identities; network and venue roles are separate. Utility close, copy, alert, search and selection icons are appropriate. The uncompleted audit is a surface-by-surface identity sweep across web, blocked provider branches and accepted asset variants. An SVG in the registry proves acquisition, not that every consuming screen uses it correctly. Do not invent logos for asset classes or tint colored marks arbitrarily.

The saved captures cannot prove gesture feel, transition timing, focus restoration or reduced-motion behavior. Close motion acceptance with sequences against the reference clips, including reversal/interruption and restored parents. Close accessibility on the actual supported platforms, including VoiceOver/TalkBack, keyboard, text scaling and reduced transparency. Treat this as evidence owed, not a claim that all those behaviors are broken.

## Architecture assessment and agent handoff

The existing architecture has useful foundations: shared integer money/risk math, explicit Reading states, per-chain reads/nonces, persisted signed-transaction journal, narrowly scoped signing and real onchain allowance. The principal architecture defect found here is that new feature screens can bypass the shared outcome contract. S01 is a concrete example: the abstraction exists, but a consumer reinterprets a terminal-looking stage incorrectly.

Make the transaction presentation contract shared by all consumers: immutable request identity → policy/approval → signed hash → unknown/proposed/finalized/reverted/abandoned → receipt/recovery. A screen must not define financial truth from an ad hoc final-stage check. Keep read-only discovery separate from execution eligibility so backend staging does not silently remove the browsing product.

Device-only watchlists/searches are explicitly implemented in [device-store](/Users/abu/dev/hackathon/metropolis/apps/mobile/src/features/markets/device-store.ts:1); encrypted [preferences](/Users/abu/dev/hackathon/metropolis/packages/account/src/prefs.ts:14) currently carry session settings. This is a documented design choice, not proof that sync is broken. Settle whether users should expect favorites on a new device or after switching accounts, then state and implement that contract consistently with the stateless-restoration promise.

Completion order:

1. Fix S01; audit all money-screen consumers for the same last-stage shortcut. Prove unknown/recovered behavior with targeted existing integration seams.
2. Complete exact amount and stable receipt journeys, S02/S06.
3. Reconcile status and ledger evidence, S07, so the next agent can follow an accurate queue.
4. Preserve mobile design improvements; correct failed states and wider discovery, S03/S05. Complete keyboard, restored-parent, large-text and native acceptance.
5. Continue S7/S9/S10/S11b and mainnet/deployment work with explicit blockers. A native screenshot cannot close web, provider issuance, cross-chain execution or mainnet readiness.

Use one requirement record with decision source, flow/reference ID, module, mode/platform, failure/recovery, accepted revision, remaining work and owner/dependency. “Built,” “accepted on simulator,” “accepted on physical device,” “deployed” and “mainnet verified” are different facts. Retaining that distinction is how the full product survives successive implementation sessions.

## Builder response (1 Oct, 16:00–17:10 UTC, lead)

| Finding | State | Evidence |
|---|---|---|
| S01 unknown outcome on money screens | **Fixed.** Send and Withdraw use the journal-backed `useSettledOutcome`; a signed send the watch lost reads "not confirmed yet · don't send it again" and the screen offers no new draft until it settles. The same contract (`OutcomeNote` / `useOutcome`) now covers LP, the card limit, the collateral swap and the spot-token swap, and each locks its actions while unresolved; `TradeTrace` takes the operation's words. Audit: no money screen reads the trace's last stage for failure copy any more. | `9d22903`, `d623626` |
| S02 exact amount | **Fixed.** Send and Withdraw take an exact typed amount (cents, integer usd6); 25 % / 50 % / All fill the field, All is exact; over the limit says so. The request is built before the passkey check and frozen. | `9d22903`; acceptance 16:50Z (exact P$1.25 send, finalized 0xc811…c273) |
| S06 receipt vs next draft | **Fixed.** Once sent, the screen is the receipt of the signed request (amount, token, to, network, money) over its trace; "Send another" / "Withdraw again" opens an empty draft. | `9d22903` |
| S05 failed market rows | **Fixed.** Failed reads show "Price unavailable" with an accessible Retry (busy state) and still open market detail. | `0a8c915` |
| S03 wider discovery | **In progress.** Agent `discovery-data` is building read-only data for Perpl crypto and the D-220 calculated equity feeds (price, change, history, explicit execution state); the screens follow. | branch `stage/S1b-discovery-data` |
| S07 records | **In progress.** Agent `ledger-reconcile` is reconciling all 216 ledger rows to one vocabulary (pending · built · accepted-simulator · accepted-device · deployed · mainnet-verified · blocked · excluded) with revision and remaining work. Holders shipped since the snapshot (`08262bf`), so S08's Holders note is closed. | branch `stage/S1b-ledger` |
| S04 web parity | **Open, planned (S11b).** The web prefs writer now merges (so it can't erase the phone's synced watchlist); data/route parity is still the S11b slice. | `39f7b98` |
| S08 card / push device evidence | **Open with named blockers.** Kinpaku now leads with its real control and says no card is issued on Wallet and reveal (`c424a53`); iOS push needs the user's Apple login for the APNs key and push capability. | `c424a53` |
| Add money disclosure | **Fixed.** Routes not open on this network say so in the row before a tap ("Soon · arrives with cross-chain intents", "Mainnet only"). | `fc4bad1` |
| Device-only watchlist | **Settled (D-232).** The watchlist follows the account through the encrypted prefs (last writer wins); recent searches stay on the phone; every prefs writer merges. | `39f7b98` |
