# Senryo implementation handoff — whole-product review, 1 October 2026

Read the [review](/Users/abu/dev/hackathon/metropolis/docs/design/reviews/2026-10-01-whole-product-review.md) for evidence and scope. Findings are keyed WP-01…WP-16. This is an implementation checklist, not permission to deploy, spend funds, contact people or publish.

## User direction to preserve

- Keep Senryo's agreed product scope. The automation complaint was an analogy from another repository, not a request to add automation here.
- **The onboarding pictures are approved by the user. Keep them. Do not criticize or replace them.** Validate the account/permission flow independently of the artwork.
- **Do not use the old Tamion USDC/form/gallery/receive images as references.** The user rejected that use during this review. Tamion's sheet source can inform a structural comparison only; do not infer its images or live transactions are approved.
- Preserve the current authentic Senryo art/marks, passkey model, bigint money/risk boundaries, per-network privacy and practice/mainnet honesty.
- Apply D-194/D-195 and the existing OAuth/phrase-import exclusions. Do not revive removed reference-app products from stale handoff tables.
- Do not repeat resolved findings: new-order TP/SL, five FX pairs listed in Practice, Home's net-flow adjustment, real allowance/Freeze, primers and push registration/taps now have source/recorded progress.
- Distinguish reviewed source, recorded simulator/testnet proof, fresh device proof and funded-mainnet proof. Nothing becomes accepted merely because its parent screen is drawn.

## Pass 1 — money operations (WP-01/02)

Suggested owning area: shared query/transaction lifecycle, with every mobile consumer migrated in the same pass.

- [ ] Inventory send, withdraw, LP approve/deposit/redemption/claim, collateral swap, open, close, margin/size changes, protection legs/removal and allowance.
- [ ] Define operation scope using chain, account, action and target. Separate editable drafts from immutable submitted intents.
- [ ] Replace raw last-stage success/failure copy with journal-reconciled outcomes.
- [ ] Keep signed-but-unsettled operations visible and prevent blind retries while unknown.
- [ ] Restore the same operation on dismiss/reopen and relaunch; never rebroadcast through recovery.
- [ ] Partition draft/trace/local result state across account/mode changes. Replace card-allowance's global scope and the trade draft's missing account scope.
- [ ] Keep independent trace/outcome records for multi-transaction actions. An approval succeeding does not mean a deposit succeeded; one TP/SL leg succeeding does not protect the other.
- [ ] Record pre-sign failure, signed/watch failure, revert, abandonment and finalization.
- [ ] Verify mode/account switches and unmount during preflight/signing/watching; retain the original submission context.
- [ ] Confirm result copy names the actual submitted amount/token/recipient and offers a transaction/receipt path.

**Closure:** outcome correctness, no duplicate unresolved submission, and recovery evidence for each money-action family. Existing helper checks are useful but must cover consumers too. Update the relevant acceptance rows, not only the shared package.

## Pass 2 — complete the capability the UI already promises (WP-03/04/08/09/10)

Suggested owning areas: J2 funding/send, J10 LP, J7 card, shared forms/status.

- [ ] Add exact decimal-safe amount entry to send, withdraw and LP; preserve presets/Max as shortcuts.
- [ ] Add exact share/amount redemption where supported; preserve cooldown, liquidity and market-open restrictions.
- [ ] Complete recipient recents, saved contacts and scanning with permission and malformed/wrong-network states.
- [ ] Show the resolved handle/address, token, amount and mode before step-up; reject self-recipient consistently.
- [ ] Put “unavailable”/dependency truth on funding hub rows before a shell destination.
- [ ] Add the exchange chooser and exact supported token/network/address withdrawal instructions; no speculative exchange support.
- [ ] Remove manual Add-to-Wallet instructions for a card with no issued/revealed details.
- [ ] Keep real allowance/Freeze visibly distinct from sample card authorizations. Drive reveal/wallet actions from issuance/provider availability.
- [ ] Wire the existing status endpoint; keep unknown/degraded/down distinct and show check time/refresh.
- [ ] Complete LP request → delay → claim acceptance, including market-closed and insufficient-liquidity states.

**Closure:** arbitrary fractional amounts, all recipient entry paths, honest unavailable actions, a real status consumer, and the full supported LP lifecycle. Mainnet/provider work remains separately gated.

## Pass 3 — discovery must preserve the object selected (WP-05/06/07/11/12)

Suggested owning areas: indexer/API public adapters, shared routes, J3/J8/J9 consumers.

- [ ] Provide market Holders/Friends from chain-scoped indexed positions joined to permitted social identities.
- [ ] Create a read-only public position route keyed by network and position ID, including closed/history/revoked/private states.
- [ ] Route Top Trades and public holdings to the selected position. Route thesis items to the selected thread.
- [ ] Retain full equities/indices/oil discovery from W6; carry D-220's actual research status and feed provenance.
- [ ] Use one market discovery model in lists, search and details, including visible arriving/blocked items.
- [ ] Keep spot tokens/J11 as a named later dependency instead of an unexplained permanently empty search branch.
- [ ] Build opted-in per-trader period results/chart/history independent of whether the trader appears in the leaderboard.
- [ ] Build the agreed visual receipt/share artifact with optional identity/amounts and correct mode/outcome; preserve private defaults.
- [ ] Define canonical market/trader/position URLs with chainId and actual static-web fallback.
- [ ] Verify installed/uninstalled, cold-start, same/other-mode, invalid and opted-out links.
- [ ] Verify two-account follow/feed/reply/like/block/delete and visibility isolation on each network.
- [ ] Keep unavailable data distinct from legitimately empty lists; provide a quiet retry path.

**Closure:** a selected object can be followed from discovery to its own detail/history/receipt, with consent and mode intact. Do not fake Holders or expose an unlisted profile to meet a visual baseline.

## Pass 4 — finish staged integrations without shrinking their acceptance

Create/update dedicated checklists before implementing these stages. They are larger retained commitments, not all immediate code regressions.

| Stage | Owner to assign | Required closure |
|---|---|---|
| S8.17–21 / W7 mainnet | contracts + operations lead | Current deploy/seed/Safe/assurance/indexer gates; funded user prerequisites; mainnet deposit → trade/protect/close and receipts. Preserve the plan's sequencing: funded core need not wait for unrelated cosmetic work. |
| S7 Perpl | chain adapter + API/query + ticket | Actual account/approve/order/close, vault↔Perpl moves, minimum/slippage/geo/rate-limit/outage/liquidation states and real phone acceptance. Discovery rows are insufficient. |
| S9 Aurora | integration + API persistence + J2 | Source/asset/minimum/fees/ETA, intent/QR, persisted timeline and recovery, depositAndOpen, three source chains, refund and cash-out; persistent-address/key constraint preserved. |
| S10 Kinpaku providers | card service + mobile | Explicit unissued/sandbox/issued states, issuer/KYC/provisioning, allowance/hold/capture/release/refund, simulation/latency and the original provider-route acceptance. |
| S11b web | web + shared query/account | Rebuild the approved desk consumers and wire real operations; replace prototype math/timeout traces; permanent sample/mode truth while unfinished. |
| J11 spot | discovery + swap/holdings | Token list/detail, real supported quote/route buy/sell, holdings, slippage/minimum/fees and recovery. |
| S12 polish | mobile/device | Accessibility, offline/stale/retry, physical push and opt-out, silent-mode sound/haptics, Live Activities/widgets where retained. Preserve approved onboarding imagery. |
| S13 docs/stats | documentation + indexer consumer | Docs site/local build/links, architecture/addresses/risk/session/funding/schema/public GraphQL/card honesty, AI disclosure, llms.txt and public /stats. |
| S14 operations | deployment lead | Current revisions, restarts/health/keeper funding/indexer lag, production lifecycle and rollback rehearsal. |
| S15 distribution | native/distribution | Current-module dev client, physical iPhone/Android clean installs/passkeys, app association, update/min-version, APK/QR and judge access. |
| S-GTM / S16 | product lead + user | Agreed tester goal/story/waitlist/metrics/evidence and sponsor-unblock tasks; outreach/publishing only within actual authorization. |
| S17 / S18 | submission/operations lead + user | README/local-run path, licence/third-party notices, AI/pre-existing disclosure, judge evidence/guide/demo/pitch/bounty/access/submission, then explicit post-submit ownership. |

Do not mark these done based on UI placeholders, old deployment health, a simulator capture or another stage's success.

## Pass 5 — current UI acceptance and final identity placements (WP-14/15)

- [ ] Validate compact/full/child sheet available-height bounds with keyboard, small viewport and large text.
- [ ] Verify nested back/dismiss, draft/scroll restoration and focus containment/return; Android hardware back included.
- [ ] Verify dark/light, large text, VoiceOver, reduced motion/transparency and interrupted/loading/empty/error states.
- [ ] Preserve approved onboarding pictures. Permission/sign-in/deferral/resume behavior can be tested without reopening artwork.
- [ ] Finish actual entity-mark placements using the existing registry, including network and oracle source.
- [ ] Keep action/utility icons as icons; distinguish token, chain, venue, issuer/provider and company.
- [ ] Use already available matched-state evidence first. Historical pictures do not override newer source or acceptance.
- [ ] Do not use the rejected old Tamion USDC/form/gallery/receive boards.

## Pass 6 — restore a completion system that can catch the next omission (WP-16)

- [ ] Update STATUS's current revision, stage, blockers and next actions from source and acceptance.
- [ ] Reconcile stage parent checkboxes against every retained child requirement. Explicitly retain Holders and send contacts/scanner until closed.
- [ ] Reconcile parity.md and PROJECT-HANDOFF with D-194/D-195 and later implementation.
- [ ] Update feature/component/motion acceptance fields in the parity ledger from actual evidence; pending is not synonymous with absent.
- [ ] Refresh stale identity/art acceptance descriptions without reopening user-approved onboarding pictures.
- [ ] Give the later original-plan stages dedicated checklists and an owner/dependency.
- [ ] Keep independent fields for implementation, acceptance, blocker, deferral/exclusion decision and evidence.

For each retained requirement record:

| Field | Required content |
|---|---|
| Requirement | Plan/flow/ledger ID and concrete user outcome |
| Owner/stage | Responsible area, dependency and next task |
| Implementation | Route/component and real data/transaction source |
| State coverage | Loading, empty, unavailable, error/retry, mode/account, permissions and cancellation |
| Money lifecycle | Signing, settlement, unknown/recovery, receipt and retry eligibility where applicable |
| Acceptance | Revision, platform/build/mode, scenario, outcome, screenshot/motion/log/transaction evidence |
| Closure | Implemented versus verified; unresolved dependency stays visible |
| Scope change | Explicit recorded user decision for exclusion; inherited blockers stay named |

The first implementation update should name the completed IDs, link evidence, and leave remaining dependencies visible. “Journeys rebuilt” alone cannot close the backlog.

