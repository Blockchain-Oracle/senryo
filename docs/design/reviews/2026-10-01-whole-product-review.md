# Senryo whole-product review — 1 October 2026

**Verdict: the concern about narrowing the product is supported.** Senryo has substantial working foundations and several recorded practice lifecycles. But some screens expose less capability than the underlying system supports, some reference requirements have no destination or data consumer, and the completion records disagree with both the code and newer acceptance entries. Treat this as a request to finish the agreed product, with explicit stages and evidence, rather than another cosmetic pass.

This review applies the user's broader concern to Senryo. The automation example came from another repository; it does not authorize adding an automation product here. Senryo's existing Aurora funding scope is retained because it is already in its own plan.

## Scope and evidence

- Baseline review of main at **37f3473a4aa6a74ac846d4c8652adfc79f65dbf1**, 1 October 2026; closing refresh at **bfa828ff2b5b8667df2d003d04839a14438a333e** credits the newer status and alert/primer changes. The [source snapshot](/Users/abu/dev/hackathon/metropolis/docs/design/reviews/2026-10-01-whole-product-evidence/snapshot.json) records baseline hashes, source line counts, and historical screenshot hashes. The [closing record](/Users/abu/dev/hackathon/metropolis/docs/design/reviews/2026-10-01-whole-product-evidence/closing-record.json) records the refresh.
- Read the original plan, approved v2 plan, decisions, stage checklists, parity ledger, acceptance log, architecture/specifications, transaction/query/account boundaries, representative mobile and web journeys, API/indexer consumers, and existing security assurance.
- Used the existing Solflare, Phantom, Fomo and Senryo image library. Also inspected **Tamion / Kawase**, the sibling Circle app the user identified, at 1278f5a5af40605b1a1b0ea2e01f1333ebbad6ad. Following the user's correction during review, the old Tamion USDC/form/gallery/receive images are excluded from the recommendations. Only its sheet source is used for a structural comparison.
- No new screenshots, account actions, deployments, funds movements, outreach or product-source edits were performed. This is a plan/source/visual review, not an independent security audit or a new device acceptance run.
- The workspace is active. Primer/alert changes, a status update and another review appeared during review; they were left untouched. The refresh found STATUS was the only changed source among the baseline snapshot files. Findings concern the reviewed sources, not an assumption that all concurrent work has stopped.
- Existing screenshots are **historical**. Newer source and acceptance entries take precedence. In particular, FX listing, Home's net-flow adjustment, new-order TP/SL, allowance Freeze, primers and push have advanced since some images.

**Evidence labels:** Confirmed = directly supported by current reviewed code; Recorded = an existing acceptance entry reports a run that this review did not repeat; Risk = source suggests a failure that needs runtime reproduction; Planned/Blocked = agreed work remains, without claiming the agent completed it. P1 = fix before funded use of the affected money journey; P2 = material behavior or delivery gap; P3 = finishing detail.

**Latest user direction:** the user likes and approves the onboarding pictures. Keep that imagery; do not reopen an illustration critique or propose replacement art. Reviews of account creation, permissions, resume behavior and accessibility concern the functioning of the flow, not the pictures. This direction supersedes any older pending-approval language about those pictures.

The [agent handoff](/Users/abu/dev/hackathon/metropolis/docs/design/reviews/2026-10-01-whole-product-agent-handoff.md) turns this report into ordered work and closure conditions.

An independently produced [expanded Senryo review](/Users/abu/dev/hackathon/metropolis/docs/design/reviews/2026-10-01-expanded-product-design-review.md) appeared in the shared workspace during this pass. It corroborates the amount/outcome/discovery/web gaps. It was not edited or treated as a replacement for the current user direction above.

## Foundations worth preserving

The practice loop is more than a mock-up. The [acceptance log](/Users/abu/dev/hackathon/metropolis/docs/plan/acceptance.md:48) records passkey account creation, a claim, an XAU trade, protection/removal/close, an LP deposit, withdraw/send, avatar saving, subsequent new-order protection, FX listing, primers and push taps. These are recorded simulator/testnet outcomes, not fresh mainnet or physical-device proof.

The architecture already provides pure bigint money/risk math, shared network/configuration and identity packages, account signing boundaries, conservative gas preflight, a persisted transaction journal and read-only recovery. [D-231](/Users/abu/dev/hackathon/metropolis/docs/plan/decisions.md:257) explicitly forbids recovery from rebroadcasting. TP/SL legs have separate outcomes. Existing [security assurance](/Users/abu/dev/hackathon/metropolis/docs/security/assurance.md) documents analysis and fixes; it should not be described as absent.

The seal, asset artwork, venue/provider marks, avatars and token system now give Senryo a deliberate identity. The old rejected D2 artwork is not a reason to restart that work. Social opt-in per network, moderation, and private sharing defaults are also valuable.

## Findings that can be acted on now

### WP-01 · P1 · Signed-but-unsettled sends are displayed as if nothing moved

**Confirmed logic defect; no duplicate payment or loss was executed in this review.**

If a request is signed and the receipt watch subsequently fails, [traceOutcome](/Users/abu/dev/hackathon/metropolis/packages/query/src/trace.ts:53) correctly returns unknown. [settledOutcome](/Users/abu/dev/hackathon/metropolis/packages/query/src/trace.ts:76) can reconcile the same hash from the journal. However, [SendToAddress](/Users/abu/dev/hackathon/metropolis/apps/mobile/src/features/withdraw/SendToAddress.tsx:158) and [WithdrawToSelf](/Users/abu/dev/hackathon/metropolis/apps/mobile/src/features/withdraw/WithdrawToSelf.tsx:103) look only at the last raw stage and print “That didn’t go through; nothing moved.” [LP](/Users/abu/dev/hackathon/metropolis/apps/mobile/src/features/lp/LpScreen.tsx:186) has the equivalent “nothing changed” message.

The [hook](/Users/abu/dev/hackathon/metropolis/packages/query/src/trace.ts:201) sets running false after the failure, so those buttons can become actionable while the signed transaction is still unresolved. These flows also [omit a stable operation key](/Users/abu/dev/hackathon/metropolis/apps/mobile/src/features/withdraw/SendToAddress.tsx:65); the hook's default key belongs to a component instance. Dismissing and reopening can therefore lose the visible operation while its journal entry remains.

The [local logic demonstration](/Users/abu/dev/hackathon/metropolis/docs/design/reviews/2026-10-01-whole-product-evidence/unknown-send-proof.txt) feeds signed → failed through the actual shared helpers: both shared outcomes are unknown, while the screen branch would claim nothing moved.

**Required:** use the journal-reconciled outcome in every mutating consumer; retain an operation identity through remount/relaunch; show “Still checking” with the transaction link and prevent a blind replacement until that operation settles. Distinguish pre-sign failure, definite revert, abandonment and unknown. Preserve D-231's read-only recovery rule.

**Close with:** interrupted connection after signing; dismiss/reopen; app relaunch; finalized, reverted and abandoned reconciliation; correct receipt/result copy and no second submission while unresolved.

### WP-02 · P2 · Persistent action state is not consistently scoped to account and mode

**Confirmed key mismatch; incorrect-chain execution was not demonstrated.**

The [trade draft key](/Users/abu/dev/hackathon/metropolis/apps/mobile/src/features/trade/draft.ts:31) contains chain and market but no account. [Card allowance](/Users/abu/dev/hackathon/metropolis/apps/mobile/src/features/card/useCardAllowance.ts:35) uses the global key card-allowance, without either account or chain. Trace state lives in a module-level map. Local form/result state is separately held by screens.

Consequently an account or Practice/Mainnet change can inherit another context's draft or trace display. The ticket's existing async context guards are useful, but they do not establish one consistent contract for the other consumers.

**Required:** a shared operation scope containing chain, account and action/target; explicitly distinguish a reusable draft from an unresolved submission; reset or partition local result state on scope changes. Inventory send, withdraw, LP, swap, close, protection and allowance together.

Also distinguish the last completed receipt from a new draft: send retains its last submitted result while the current percentage amount changes with refreshed balances. A “Send another” transition can begin a fresh draft without making the previous receipt appear to describe the new amount.

**Close with:** mode and account switching before a request, during preflight and while a signed operation is pending. Each operation must retain its original context and never surface another account's result as the current one.

### WP-03 · P2 · Send, withdraw and LP expose presets instead of the full amount capability

**Confirmed product narrowing.**

[Send](/Users/abu/dev/hackathon/metropolis/apps/mobile/src/features/withdraw/SendToAddress.tsx:71) derives the amount from a percentage of the available balance; its [controls](/Users/abu/dev/hackathon/metropolis/apps/mobile/src/features/withdraw/SendToAddress.tsx:133) offer only the configured shares. [Withdraw](/Users/abu/dev/hackathon/metropolis/apps/mobile/src/features/withdraw/WithdrawToSelf.tsx:41) does the same. [LP deposit](/Users/abu/dev/hackathon/metropolis/apps/mobile/src/features/lp/LpScreen.tsx:105) offers [10, 25, 50](/Users/abu/dev/hackathon/metropolis/apps/mobile/src/features/lp/constants.ts:2) and Max; redemption is also restricted to percentage steps.

A person cannot choose an arbitrary exact payment such as P$5.23, or an LP deposit such as P$12.34 unless it happens to match a preset. The bigint request builders are not subject to that UI restriction. This is the clearest equivalent of the user's “the system can do more than this one narrow use” concern.

**Required:** editable token amount / share input with presets and Max as shortcuts, decimal-safe parsing, available-balance constraints, explicit token/network, and a review of the exact amount and recipient. Reuse the ticket's good amount-entry pattern where appropriate.

**Close with:** non-preset fractional amounts, empty/invalid inputs, precision limits, insufficient funds, Max while positions lock funds, and LP approve → deposit → request redemption → claim.

### WP-04 · P2 · Send's recipient journey is only partially implemented

**Confirmed omitted baseline, despite the parent stage being checked.**

[SendToAddress](/Users/abu/dev/hackathon/metropolis/apps/mobile/src/features/withdraw/SendToAddress.tsx:100) provides address/@handle, Paste and resolution. There is no contacts/recipient-recents journey or scanner in the reviewed send path. [S1b.14](/Users/abu/dev/hackathon/metropolis/docs/plan/stage-01b-design-v2.md:117) explicitly includes recipient/contacts/scanner/review and is checked.

[Phantom P22](/Users/abu/dev/hackathon/metropolis/docs/design/reference-study-2026-09-30/evidence/R2/screens/P22.jpg) visibly provides the recipient surface, add-contact affordance and scan/search actions. It does not prove that its send completed. Senryo has a working typed-recipient path; it has not finished the agreed journey.

**Required:** saved recipients and successful-send recents with an empty state, scanner permission/denial/retry, validation of supported address/QR content and network, then a resolved-identity review. Never treat arbitrary scanned content as authorization.

**Close with:** address, handle, paste, recent, saved contact, scan, malformed QR, permission denied, self-recipient, wrong network, resolution failure and cancelled step-up.

### WP-05 · P2 · Market Holders was removed from implementation without closing the requirement

**Confirmed omission with an identified dependency, not an approved exclusion.**

[TradeScreen](/Users/abu/dev/hackathon/metropolis/apps/mobile/src/features/trade/TradeScreen.tsx:38) offers About and Feed. Its [comment](/Users/abu/dev/hackathon/metropolis/apps/mobile/src/features/trade/TradeScreen.tsx:52) explicitly omits Holders because a public-positions-by-market reader is unavailable. Yet [S1b.9](/Users/abu/dev/hackathon/metropolis/docs/plan/stage-01b-design-v2.md:98) is checked and includes Holders; [v2 W5](/Users/abu/dev/hackathon/metropolis/docs/plan/v2-plan.md:410) names Position as its source.

The constraint is real, but it is an API/query dependency to finish or track. The indexer already has Position entities and the social system has opt-in identities; neither alone is a privacy-safe Holders consumer.

**Required:** network-scoped market positions joined only to identities/trade visibility permitted by the user, with Friends, loading, empty, error, closed/stale and opt-out states. Use leveraged-position language, not ownership language. Until that adapter exists, retain an explicit blocked subrequirement and unblock task rather than checking the whole journey complete.

### WP-06 · P2 · Discovery opens a trader instead of the selected position or thesis

**Confirmed navigation narrowing.**

[Home Top Trades](/Users/abu/dev/hackathon/metropolis/apps/mobile/src/features/home/TopTrades.tsx:69) has a positionId but navigates only to the trader's watch route. The social Top Trades surface follows the same pattern. Public position rows lead toward a market; market feed items lead toward the trader. There is no shared destination that preserves the specific selected trade, especially after it closes.

[Fomo F13](/Users/abu/dev/hackathon/metropolis/docs/design/reference-study-2026-09-30/evidence/R3/screens/F13.jpg) visibly combines trader, follow, selected asset/status, chart ranges, invested/entry/result, sharing, thesis and transaction history. FT074/FT075 retain the adapted position anatomy; a generic profile is not equivalent.

**Required:** one read-only public-position route keyed by network and position ID, usable from Top Trades, feed, public holdings and shared links. Preserve closed results/history and visibility revocation. Thesis items should open their thread rather than silently replacing the destination with a profile. Keep follow separate from a trade action; no copy trading is implied.

### WP-07 · P2 · Market discovery and search represent only part of the approved universe

**Confirmed inventory mismatch; execution blockers remain valid.**

[The approved plan](/Users/abu/dev/hackathon/metropolis/docs/plan/v2-plan.md:448) retains Perpl crypto plus NVDA, SPY, QQQ, TSLA, SPCX, EWY and oil discovery/research. [The current arriving universe](/Users/abu/dev/hackathon/metropolis/apps/mobile/src/features/markets/universe.ts:68) includes only NVDA in the equities group. The API [returns no Perpl markets](/Users/abu/dev/hackathon/metropolis/services/api/src/routes/info.ts:119), and the crypto discovery rows do not yield a real Perpl ticket.

[Search](/Users/abu/dev/hackathon/metropolis/services/api/src/social/search.ts:85) queries the engine list and profiles, so it cannot find much of the arriving universe visible in Markets. The UI has [All/Markets/Traders](/Users/abu/dev/hackathon/metropolis/apps/mobile/src/features/search/SearchScreen.tsx:25), while tokens are always empty server-side. Tokens belong to the explicitly later J11 slice; record that dependency instead of implying that missing spot execution is a completed-stage regression.

[D-220](/Users/abu/dev/hackathon/metropolis/docs/plan/decisions.md:245) already contains equities research. Do not redo it or say all equities lack research: SPY/QQQ have a post-launch listing recommendation; the other wrapper feeds have a recorded execution blocker.

**Required:** one canonical discovery inventory for list/search/details with venue, mark, chain, availability, feed provenance and reason. Show blocked/indicative items honestly, without fabricated prices or enabling unsafe execution. Finish S7 for crypto trading; keep J11 separately owned.

### WP-08 · P2 · Funding is a hub plus Monad receive, not the full planned journey

**Confirmed partial implementation; S9 remains planned.**

[Add money](/Users/abu/dev/hackathon/metropolis/apps/mobile/src/app/(sheets)/add-money.tsx:32) advertises another-chain and wallet routes. [The QR family destination](/Users/abu/dev/hackathon/metropolis/apps/mobile/src/app/fund/qr/[family].tsx:6) implements Monad receive but returns a shell for the others. Wallet, deposit timeline and cash-out routes are also shells. The exchange chooser and precise Coinbase/Binance/Kraken withdrawal instructions required by J2 are absent; “from a wallet or exchange” in MonadInbox's comment is not that journey.

The Monad inbox/sweeper work is valuable and D-230 fixes first deposits into undeployed inboxes. It does not establish Aurora source-chain configuration, intent execution, deposit-and-open, refunds or cash-out.

**Required now:** disclose availability at the hub before a dead-end tap; finish the exchange chooser with exact token/network/address instructions. **Required in S9:** the full source-chain/asset → minimum/fees/ETA → QR or intent → persisted timeline → finalized credit/receipt → recovery/refund/cash-out sequence. Preserve the Studio-key/persistent-address constraint and existing user funding gates.

**Close S9 with:** the plan's three source-chain runs, depositAndOpen and a refund, including interrupted/restarted recovery. A QR rendering alone cannot close it.

### WP-09 · P2 · Kinpaku mixes real allowance controls with an unissued card journey

**Confirmed availability/copy contradiction; card service remains blocked.**

[The card root](/Users/abu/dev/hackathon/metropolis/apps/mobile/src/app/(tabs)/card/index.tsx:51) correctly explains in source that card details and authorizations are samples while Free to spend, limit and Freeze use the real onchain allowance. Those real controls must be preserved.

However, [Add to Wallet](/Users/abu/dev/hackathon/metropolis/apps/mobile/src/app/(tabs)/card/wallet.tsx:8) tells a person to add the card manually using revealed details, while [Reveal](/Users/abu/dev/hackathon/metropolis/apps/mobile/src/app/(sheets)/card-reveal.tsx:5) is only a statement about a future service. The root still offers the [Wallet action](/Users/abu/dev/hackathon/metropolis/apps/mobile/src/app/(tabs)/card/index.tsx:135). An unissued sample card cannot fulfill those actions.

**Required:** one coherent unissued/sandbox/issued/provisionable state model. Explain that an allowance change is real even when there is no issued card; label sample authorization data in place; offer only actions the current state supports. Retain S10's issuer/KYC/sandbox/simulation/reversal/provisioning work and acceptance gates. “Sandbox card · no charge” must not be mistaken for proof that issuance or settlement is wired.

### WP-10 · P2 · Service status is a shell even though the API already exists

**Confirmed consumer omission with no new provider dependency.**

[The screen](/Users/abu/dev/hackathon/metropolis/apps/mobile/src/app/status.tsx:5) says service status arrives with the API. [The API](/Users/abu/dev/hackathon/metropolis/services/api/src/routes/info.ts:44) already reads RPC, oracle ages, indexer lag and card readiness, and explicitly reports unknown for unconfigured S7/S9 providers. A typed client route exists.

**Required:** wire a network-aware consumer with last-check time, unknown/degraded/down states, refresh/retry and useful recovery links. Never convert unknown to green. This is an achievable near-term completion task, separate from the blocked providers.

### WP-11 · P2 · Receipts and profiles stop short of the agreed reference behavior

**Confirmed partial consumers.**

[SharePreview](/Users/abu/dev/hackathon/metropolis/apps/mobile/src/features/trade/TicketReceipt.tsx:114) displays text in a panel and [shares a message](/Users/abu/dev/hackathon/metropolis/apps/mobile/src/features/trade/TicketReceipt.tsx:161). It does not render/export the agreed visual receipt/share card. Optional amounts defaulting off is a good privacy choice and should stay.

[TraderStanding](/Users/abu/dev/hackathon/metropolis/apps/mobile/src/features/social/TraderStanding.tsx:26) finds a profile inside a leaderboard snapshot. It does not provide independent period results for an opt-in trader outside that board, or the reference profile chart/history. A person missing from a ranking is not necessarily a person with no trading result.

**Required:** an authentic visual receipt with correct mode, outcome, optional identity and amounts plus verifiable transaction; private defaults preserved. Build public-profile performance from the user's opted-in, network-scoped history with metric/window disclosure, chart and unranked/insufficient-data states. Share/profile scope belongs to FT074–FT078 and S1b, not an unrelated new feature.

### WP-12 · P2 · Shared URLs disagree with app/web routes and omit the mode

**Confirmed producer/resolver mismatch; live universal-link behavior was not retested.**

[Market sharing](/Users/abu/dev/hackathon/metropolis/apps/mobile/src/features/markets/MarketActions.tsx:10) generates /markets/XAU. Web exports a /markets list and /trade/[market] detail, not /markets/[market]. Its [nginx fallback](/Users/abu/dev/hackathon/metropolis/apps/web/deploy/nginx.conf:45) ends in 404 for an absent export.

[Profile sharing](/Users/abu/dev/hackathon/metropolis/apps/mobile/src/features/social/TraderProfile.tsx:81) emits /watch/?address=…; mobile uses /watch/[address], and the [legacy resolver](/Users/abu/dev/hackathon/metropolis/apps/mobile/src/lib/deep-link.ts:19) does not translate that query form. Both share producers omit chainId, even though [linkTarget](/Users/abu/dev/hackathon/metropolis/apps/mobile/src/lib/deep-link.ts:46) correctly offers a deliberate mode switch when a link includes it.

**Required:** canonical network-qualified market/trader/position URLs with web fallback and app resolution. Verify installed and uninstalled behavior, cold start, same/other mode, invalid and opted-out destinations. Shared config/route builders should own this contract.

### WP-13 · P2 · Web remains a prototype behind working authentication

**Confirmed deferred stage, with a current honesty gap on narrow layouts.**

[Web Ticket](/Users/abu/dev/hackathon/metropolis/apps/web/src/components/screens/trade/ticket.tsx:22) uses sample balances/markets. Its [trace](/Users/abu/dev/hackathon/metropolis/apps/web/src/components/screens/trade/ticket.tsx:46) advances by timeout; [hold confirmation](/Users/abu/dev/hackathon/metropolis/apps/web/src/components/screens/trade/ticket.tsx:120) starts that animation rather than a signed request. Portfolio, funding, card and watch surfaces likewise retain substantial preview behavior. Auth and the practice claim do not make these consumers live.

The ticket explicitly says no order is sent, which is good. But the shared [PreviewBadge](/Users/abu/dev/hackathon/metropolis/apps/web/src/components/shell/top-bar.tsx:32) is hidden below 22rem, so non-ticket sample surfaces can lose their global disclosure. D2's monospaced caps, borders and sample risk calculations remain in components despite the newer token system.

**Required now:** durable disclosure beside sample data across sizes; clear boundaries around simulated lifecycle output. **Required in S11b:** rebuild layout/components to the approved direction and consume the shared real account/query/sender/risk behavior. Do not ship a second version of money/risk logic based on the prototype.

**Close with:** web sign-in → claim/fund → actual signed trade/protection/close → receipt/recovery, both modes' honest states, keyboard navigation, narrow layouts and deployed static/deep-link fallback.

### WP-14 · P2 · Compact sheet keyboard bounds need a focused device check

**Source-derived risk, not a reproduced clipping defect.**

[Sheet](/Users/abu/dev/hackathon/metropolis/apps/mobile/src/components/sheet/Sheet.tsx:124) translates the panel up by keyboard height, but [its maximum height](/Users/abu/dev/hackathon/metropolis/apps/mobile/src/components/sheet/Sheet.tsx:156) remains a fraction of the full window. A sufficiently tall panel can therefore exceed the top safe area when the keyboard appears. [ChildSheet](/Users/abu/dev/hackathon/metropolis/apps/mobile/src/components/sheet/ChildSheet.tsx:81) already subtracts keyboard height and the top inset.

[Tamion's sheet](/Users/abu/dev/hackathon/tamion/packages/ui-native/src/components/sheet.tsx:98) provides a useful contract: dynamic sizing, scrolling, interactive keyboard, restoration, Android resize and explicit nested back/header slots. This is reference evidence, not an instruction to copy its package or replace Senryo's approved compact-sheet appearance.

**Required:** constrain available height consistently; verify focused fields, heading, back, action and dismissal with large text/keyboard. Verify parent draft/scroll restoration, Android hardware back, VoiceOver focus containment/return and reduced motion/transparency. Existing modal semantics and system-aware animations should be retained; their presence is not runtime acceptance.

### WP-15 · P3 · Authentic identity is mostly solved; finish the remaining entity placements

**Confirmed finishing detail, not a claim that all icons are wrong.**

The registry and its provenance checks are a major improvement. The [web network indicator](/Users/abu/dev/hackathon/metropolis/apps/web/src/components/shell/top-bar.tsx:38) still uses a coloured dot where the named chain can use its Monad mark. Market About identifies Chainlink by text; the approved identity placement includes the oracle/source mark.

**Required:** audit asset, network, venue, company, exchange and provider placements using the existing registry. Keep those roles distinguishable. Pair the authentic Chainlink mark with the oracle source/freshness information and the Monad mark with the network. Belonging to a chain is not the same as being issued by a provider.

Back, close, bell, search, scan, QR, settings and amount-entry symbols remain utility icons. Replacing them with logos would reduce clarity. Do not reintroduce historic fake marks or initials from older reference-board images.

### WP-16 · P2 · Completion tracking cannot currently prevent scope loss

**Confirmed documentation drift.**

At the baseline snapshot, STATUS still listed send/withdraw, LP, primers/push and FX run 2 as next work, although later source and acceptance entries recorded them. **The 13:55 UTC [STATUS update](/Users/abu/dev/hackathon/metropolis/docs/plan/STATUS.md:13) corrected that queue during review; credit that fix.** Its last-green pointer and M0/M1 milestone boxes still lag the recorded checks. Checked S1b.9/S1b.14 still contain Holders and recipient scanner/contact work that is absent.

The parity ledger has **216 rows**, but all **178 feature/component/motion acceptance fields are pending** in the reviewed snapshot. That does not mean 178 features are absent; it means the registry cannot tell implemented work from verified work. Some identity/art acceptance descriptions are stale too. [The handoff summary](/Users/abu/dev/hackathon/metropolis/docs/design/senryo-v2/PROJECT-HANDOFF.md:68) and ledger classification header still describe only the old exclusions, although D-194/D-195 and individual rows contain newer binding decisions.

**Required:** reconcile STATUS, stage checkboxes, parity.md, handoff and ledger against source and acceptance. Use independent implementation and acceptance states, plus explicit dependency/deferred/excluded fields. Parent stages close only when every retained child requirement is implemented or explicitly assigned a remaining dependency. Preserve the user's exclusions; stale handoff text cannot revive them.

The closing STATUS now records an iOS push provisioning/APNs credential blocker. Its “Pending on the user: real-money funding only” sentence should be reconciled with that newly recorded prerequisite. This review did not repeat the EAS build or verify credentials.

## Whole-plan coverage and work that must remain visible

This table records representative current evidence and the remaining product promise. A planned stage is not automatically a forgotten implementation defect.

| Area / stage | Current reviewed evidence | Remaining closure / disposition |
|---|---|---|
| S0–S6 foundations, contracts, API/indexer, auth | Shared packages, deployed-practice records, assurance, account and contract checks; real simulator passkey/session/claim | Physical-device clean-install sign-in, wrong network, expiry/recovery and deployment evidence stay required. This review did not revalidate live infrastructure. |
| S8 / W1–W2 practice and mode | Claim/trade/protect/close recorded; mode controls and deployment gates exist | Unknown/remount lifecycle consistency (WP-01/02), interrupted/reverted paths and full gate matrix. |
| S8.23 / W6 FX | Five FX pairs configured and recorded as listed in Practice | Do not repeat the stale “FX missing” task. Verify individual trade/gas/calendar/aggregate-risk behavior at the intended funded stage. |
| S8.17–21 / W7 funded mainnet | Mainnet runbook and staged preparation; practice cannot prove mainnet deployment | User funding, Safe owners, current assurance/deploy/seed/indexer/runbook gates and real finalized mainnet lifecycles. Real blocker, not permission inferred from this review. |
| S7 Perpl | Venue/asset marks, discovery, config/indexer scaffolding | Actual adapter/order/account initialization, vault↔Perpl moves, minimum, slippage, venue isolation, geo/down/rate-limit/close/liquidation states and phone acceptance. Depends on the funded core; retain the plan's S7 stage. |
| W6 equities/indices/oil | D-220 research completed; only NVDA discovery currently represented | Canonical full discovery with feed labels. Separate SPY/QQQ listing recommendation from B2-blocked names/oil. No fictional live quotes or premature execution. |
| J2 / S9 funding | Hub, practice claim/voucher, Monad receive/inbox, swap surface | WP-08 plus exchange instructions; full Aurora configuration, persisted execution/timeline, depositAndOpen, refunds/cash-out. Key/funding and live-run gates remain. |
| J10 LP | Actual practice faucet/deposit recorded; redemption request/claim code exists | Arbitrary amounts and outcome fixes; full redemption/claim/delay/closed-market/insufficient-liquidity proof. Deposit alone does not accept the vault lifecycle. |
| J3–J5 markets/ticket/positions | Own market detail, real ticket and own position actions, TP/SL, receipts | Holders, shared position destination, receipts/share output and all failure/recovery/fidelity states. Preserve implemented new-order protection. |
| J1 onboarding | User-approved pictures, story, passkeys, handle/follow/voucher/terms flow, primer/push records | Preserve the pictures. Verify account-bound resume, actual follow/voucher redemption and physical-device prompts; runtime accessibility/permission behavior remains separate from illustration approval. |
| J6/J8/J9 / S12b social/Home/You | Handle/avatar editor, network opt-in, feed/theses, moderation, leaderboard/follow and Top Trades | Shared public positions/profile metrics, complete search and recipient journey; real two-account follow/feed/reply/like/block/delete isolation; outage versus empty states. |
| J7 / S10 Kinpaku | Authentic card art, real Free to spend and allowance/Freeze; sample card/auth data | WP-09; provider service and coherent state model; the plan's Immersve/Lithic/Laso paths, latency/reversal/settlement and user KYC/purchase gates. |
| S11b web | Working auth/claim history with preview desk consumers and static hosting config | WP-12/13, real desk lifecycle and approved layout/components, durable mode/sample truth. |
| J11 spot tokens | Explicit later slice; token-search source absent | Token discovery/detail, real Uniswap route buy/sell, holdings, quote/fee/minimum/slippage/failed/recovered states; own stage checklist. Do not silently delete. |
| S12 polish | Haptics/motion utilities, recovery, primers and push registration/tap records; closing STATUS records an iOS provisioning/APNs blocker | Resolve the recorded native-build prerequisite, then device delivery/opt-out/revoked permission, sounds/silent mode, Live Activities/widgets, offline/stale/error/retry, share receipts and accessibility. A simulated push tap is not end-to-end notification delivery proof. |
| S13 docs / public stats | Internal plans/specs/assurance | Docs app/site, architecture/addresses/risk/session/funding/schema/public GraphQL/card honesty, AI disclosure, llms.txt, public /stats and link/build checks. apps/docs is absent in this snapshot. |
| S14 operations | Prior deployment and capacity records | Revalidate intended deployment revisions, rollback rehearsal, restarts/health/keeper funding/indexer lag and end-to-end production runs. Do not assume old STATUS health remains current. |
| S15 distribution | EAS/native work and simulator builds recorded; closing STATUS reports the current iOS dev-client push-profile build failed | Track the recorded push-capability/APNs prerequisite, current-module dev client, physical iPhone/Android clean installs, app association, update/min-version behavior, APK/QR and judge distribution. |
| S-GTM / S16 | Agreed continuous traction and sponsor-unblock plan | Tester target/story/waitlist, permissioned outreach and sponsor questions, usable metrics/tester evidence/quotes. This review does not authorize messaging or publication. |
| S17 submission | Requirements documented; docs/submission has no deliverables in this snapshot | README/local-run path, licence and third-party notices, AI/pre-existing-code disclosure, reproducible addresses/tx/GraphQL evidence, judge guide, actual-product demo, pitch/bounty fields/access check and user submission. |
| S18 after submission | Planned | Health/keeper/incident ownership and fix-only operations remain a future stage, not a new monitor created by this review. |

Many later stages exist only as rows of the original plan, without dedicated executable stage files. Split them into owned checklists before reaching them; otherwise completion of the current mobile pass can obscure the remaining cross-service deliverables.

**Binding exclusions to preserve:** D-194 removes predictions/sports, NFTs/collectibles, in-app dApp browsing, travel/borrowing/virtual accounts/cashback and the tracking prompt. D-195 removes a separate Senryo PIN/password. OAuth and recovery-phrase import remain excluded. Existing export/recovery and OS passcode fallback are separate capabilities. Fiat purchase, rewards/competitions, hardware/private-key methods and news/chat/X linking stay in their recorded blocked classes; do not build them from stale reference tables.

## What the existing images tell us about design

| Evidence inspected | Observed pattern | Senryo application / limit |
|---|---|---|
| [Fomo F09](/Users/abu/dev/hackathon/metropolis/docs/design/reference-study-2026-09-30/evidence/R3/screens/F09.jpg), [F13](/Users/abu/dev/hackathon/metropolis/docs/design/reference-study-2026-09-30/evidence/R3/screens/F13.jpg), [F32](/Users/abu/dev/hackathon/metropolis/docs/design/reference-study-2026-09-30/evidence/R3/screens/F32.jpg) | Discovery cards, a particular trader/position, and a compact market page with ranges and Holders/Friends form a coherent information system. F13 visibly includes result, entry, thesis and transaction history. | Finish destination/data continuity (WP-05/06/11). Do not replace it with attractive cards pointing to generic profiles. A frame proves layout, not transaction success or hidden navigation behavior. |
| [Phantom P22](/Users/abu/dev/hackathon/metropolis/docs/design/reference-study-2026-09-30/evidence/R2/screens/P22.jpg) | Send starts with finding a recipient; it exposes recents/contacts and scanning affordances. | Complete WP-04; typed address/@handle remains one useful entry path. |
| [Solflare S14](/Users/abu/dev/hackathon/metropolis/docs/design/reference-study-2026-09-30/evidence/R1/screens/S14.jpg) | A permission primer offers clear purpose, primary action and deferral. | Senryo's newer primer source/acceptance already exists, and its pictures are approved by the user. Verify permission/deferral and accessibility behavior; do not reopen the pictures or the earlier “primer absent” finding. |
| [Tamion sheet source](/Users/abu/dev/hackathon/tamion/packages/ui-native/src/components/sheet.tsx) | The implementation defines reusable keyboard, back and scroll behavior. | Use it only as a structural comparison. The old USDC/form/gallery/receive pictures are excluded by the user and are not a visual baseline for Senryo. |
| Existing Senryo [Home](/Users/abu/dev/hackathon/metropolis/docs/design/reference-study-2026-09-30/reviews/2026-10-01-senryo-mobile/rebuild/home.png), [Ticket](/Users/abu/dev/hackathon/metropolis/docs/design/reference-study-2026-09-30/reviews/2026-10-01-senryo-mobile/rebuild/ticket.png), [Welcome](/Users/abu/dev/hackathon/metropolis/docs/design/reference-study-2026-09-30/reviews/2026-10-01-senryo-mobile/rebuild/welcome.png) | Strong original art, large numeric hierarchy and recognizable asset/venue identity are already present. The ticket's amount keypad is a useful capability pattern. | Preserve that craft. The historical ticket's “SL/TP after opening” and Home's old cash-flow-sensitive change have newer fixes; they are not reopened defects here. Current fidelity needs matched-state acceptance, not more arbitrary styling. |
| Historical Senryo [Card](/Users/abu/dev/hackathon/metropolis/docs/design/reference-study-2026-09-30/reviews/2026-10-01-senryo-mobile/rebuild/card.png) | Card appearance and attractive action hierarchy cannot establish issuance or provisioning. | Judge current source availability states (WP-09). The old bright artwork and disabled Freeze were superseded; do not undo the newer art/real allowance work. |

**Design recommendation:** finish the relationship between information, action, outcome and recovery. That is why the references feel richer despite simple individual components. Retain deliberate imagery for Senryo's story and financial entities; use functional icons for actions. Current visual acceptance should pair the same state, viewport, theme and text size with the appropriate reference frame and motion evidence. A screenshot of a shell cannot accept the underlying journey.

## Architecture direction for the next implementation passes

The shared-package structure should be retained. The current weakness is that “shared function exists” does not enforce “all consumers obey its outcome, scope and availability rules.”

1. **One operation contract:** chain/account/action scope, immutable submitted intent, gas/preflight, step-up/session policy, journal identity, settled outcome, retry eligibility and receipt. Screens display it rather than reconstructing success from the last raw event.
2. **One capability inventory:** market/network/venue/provider availability drives list, search, detail, funding hub and card actions. Distinguish discoverable, indicative, executable, unconfigured and blocked. A navigation route's existence must not imply the capability is usable.
3. **One public-object contract:** opted-in trader, position and thesis IDs have canonical destinations/URLs and revoked/private/closed states. Indexer reads and profile joins always retain chain and consent boundaries.
4. **One sheet/form contract:** exact amounts, keyboard bounds, back/dismiss, focus restoration and parent draft retention, across compact/full/child variants. Preserve Senryo's existing approved shapes and animation choices.
5. **One closure record:** requirement → owner/stage → source + real data path → states/recovery → acceptance evidence → ledger status. A cosmetic screenshot or successful typecheck covers only part of that chain.

API outages should remain distinguishable from genuinely empty results. For example, [Home Top Trades](/Users/abu/dev/hackathon/metropolis/apps/mobile/src/features/home/TopTrades.tsx:29) disappears for both unavailable and empty data. A quiet unavailable/retry state can preserve the composition without fabricating traders or hiding a service failure.

## Validation performed

| Check | Result / evidence | What it does not prove |
|---|---|---|
| Repository typecheck | Pass, 17/17 tasks; [log](/Users/abu/dev/hackathon/metropolis/docs/design/reviews/2026-10-01-whole-product-evidence/typecheck.txt) | Device behavior, product completeness |
| Biome lint | Pass, 888 files; [log](/Users/abu/dev/hackathon/metropolis/docs/design/reviews/2026-10-01-whole-product-evidence/lint.txt) | Data/transaction lifecycle correctness |
| Repository invariants | 31 rules, zero errors/warnings; [log](/Users/abu/dev/hackathon/metropolis/docs/design/reviews/2026-10-01-whole-product-evidence/invariants.txt) | Exhaustive security analysis or every runtime boundary |
| Local contracts | 42 tests, 7 suites, zero failures; fork paths excluded; [log](/Users/abu/dev/hackathon/metropolis/docs/design/reviews/2026-10-01-whole-product-evidence/contracts.txt) | Fresh mainnet-fork, deployed or provider acceptance |
| Account package checks | 29 checks pass; [log](/Users/abu/dev/hackathon/metropolis/docs/design/reviews/2026-10-01-whole-product-evidence/account-check.txt) | Real-device biometrics/OS association |
| Existing trigger-outcome checks | Pass; [log](/Users/abu/dev/hackathon/metropolis/docs/design/reviews/2026-10-01-whole-product-evidence/trigger-outcome-check.txt) | Other money consumers already obeying those outcomes |
| Signed → failed helper demonstration | Unknown in actual shared helpers; [proof](/Users/abu/dev/hackathon/metropolis/docs/design/reviews/2026-10-01-whole-product-evidence/unknown-send-proof.txt) | A device/network reproduction or actual duplicate transfer |
| 21st mobile source review | 364 files, zero errors, 9 warnings, 6 suggestions; [JSON](/Users/abu/dev/hackathon/metropolis/docs/design/reviews/2026-10-01-whole-product-evidence/21st-mobile.json) | Warnings are not automatically defects; intentional autofocus needs its interaction context |
| 21st web source review | 116 files, zero errors, 2 warnings, 35 suggestions; [JSON](/Users/abu/dev/hackathon/metropolis/docs/design/reviews/2026-10-01-whole-product-evidence/21st-web-source.json) | One broader output scan flagged generated CSS; it was not promoted to a current source finding |

The green checks support preserving the foundations. They do not justify marking missing consumer behavior or unverified stages complete. The next work should close WP-01/02 first, then exact-amount and public-object continuity, then complete the existing staged funding/card/web promises with their dependencies intact.
