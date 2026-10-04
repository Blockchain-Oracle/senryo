# Senryo reference follow-through — 4 October 2026

## Authority and approved direction

The user's latest feedback rejects the current Home/Card presentation, excessive explanatory text, the prominent `P$` treatment, missing entity marks, slow interactions, and roadmap omissions. They requested source-led work, study of eleven supplied files, and research into Monad prediction markets, on-ramping and Fomo-like notifications. This is implementation work as well as research; a successful source slice is not acceptance of the complete product.

The user selected **“Slush Home/Card + Fomo trading/social”** in this chat on 4 October. Phantom continues to supply the action fan. Senryo retains its name/seal, approved welcome artwork, actual contracts/account/services, five destinations, money integrity, and all retained roadmap capabilities. Arc in a reference funding list is not a requested Senryo network. The new selection supersedes conflicting Home/Card layout details in the [2 October contract](mobile-rebuild-2026-10-02.md); its lifecycle/security requirements remain.

Approaches considered:

| Approach | Trade-off | Decision |
|---|---|---|
| Slush Home/Card, Fomo Markets/Profile/Social, Phantom fan | Stronger wallet/card hierarchy; requires purposeful adaptation rather than copying one shell wholesale | User selected; implement |
| Fomo Home with Slush Card | Smaller Home change, but leaves the wallet/investment hierarchy that the new references improve | Not selected |
| Keep the current layout and polish details | Least source churn; does not address the user's rejected hierarchy | Not selected |

References are a **minimum experience baseline**, adapted to Senryo's genuine capabilities. Production logos/art come from the existing provenance registry and Senryo assets. Recording crops stay private. Static concepts and edited product videos do not prove live features, exact easing, fees, repayment, yield or reversible transfers.

## Concrete screen contract

### Home

- One clear balance at the top. Whole dollars dominate; cents are quieter. The existing Practice mode pill and an adjacent `Paper money` label carry mode truth; the Home hero does not use a giant `P$` prefix. Do not globally remove Practice identifiers from other money screens.
- Compact round icon actions: Add money, Send, Receive, Withdraw. Retain direct Withdraw and the complete fan; actions use the existing money routes and authentication/review guards.
- Group actual wallet/trading/inbox/pool components under an account/investment hierarchy. Read the same `useBalanceSheet` parts as the total, including any-asset holdings and Perpl equity; do not reconstruct the older portfolio model or count trading margin twice. The current sheet combines multiple query owners and does not promise one block-coherent snapshot. Card spending capacity is not an extra asset.
- Trading availability and pool investment remain reachable. Rows use authentic Monad/AUSD/USDC/Senryo identities where applicable, functional icons for actions, and concise values. Open positions and holdings remain on Home. Top Trades follows personal money content.
- Loading retains geometry. Missing prices remain partial/unavailable; zero means a known zero. Finality and stale-value acceptance remain in the Stage 14 flow book; a layout change does not establish synchronized query refresh.
- Details contain valuation basis, block age, haircuts, liabilities and integration explanations. The normal Home state does not repeat “View details” or offer paragraphs of implementation prose.

### Kinpaku

- Full card face precedes controls and amounts. Keep the original gold-leaf artwork; Slush supplies hierarchy/material, not its logo or magenta brand.
- Compact icon controls for Freeze, Limits and information. Only real supported controls are actionable. Unissued, locked, unavailable, active and frozen states remain distinct.
- Availability/held amounts form a compact pair when real account/card data permits. Preserve genuine card debt and its Repay flow. No invented borrowing, weekly spending chart, merchant/logo, account number or yield.
- Recent activity uses authenticated service events and existing receipts. Empty/loading/unavailable states stay distinct. Issuance, secure reveal and Wallet provisioning retain actual provider gates.
- Sandbox status is adjacent to the card. A Practice card amount can use ordinary dollar typography only inside explicit paper-money context. Card capacity remains an overlapping risk limit, not owned balance.

### Motion and source workflow

- Read the components/state ownership first. Gesture tracking stays on Reanimated/UI-thread shared values; financial completion comes from operation facts.
- Round actions use the existing 100 ms press / 160 ms release. Reduced Motion removes travel. Investment disclosure animates its chevron/content with a short purposeful transition, without animating measured-money calculations.
- Retain the approved slide threshold/cancellation/review invalidation, fan layering and child Back behavior. Slush's visual “Undo” is not a valid onchain cancellation contract for Senryo.
- Do not animate fake changing balances, synthetic performance charts or loading values. Do not make a page wait for decorative entry.
- Verification: typecheck, scoped format/lint, invariants, platform bundle export, and one targeted native comparison when feasible. No screenshot-per-edit loop or new UI test suite. Physical-device/audio/provider acceptance is separate.

## Every feedback item has a work owner

| Request | Owning source / existing plan | State and acceptance needed |
|---|---|---|
| Home/Card fidelity and paper-money typography | `apps/mobile/src/features/home`, `/home`, `/card`, `features/card`; this contract | Immediate source slice; phone-scale review still required |
| Source-led motion, speed, icons/marks, concise copy | shell, kit, theme, identity registry, query cache; S1b/S12 | Immediate shared-control audit plus remaining chart/cold-start/release-device profiling; measure actual stalls before changing polling |
| Fresh/upgrade/restored/guest onboarding and deferred links | S5/S6; 2 October foundation checkpoint | Source exists; install/restore/update/cancel/relaunch acceptance pending |
| Money lifecycle, recovery, funding, send, withdrawal | S8/S9; operation journal, chain/query, fund/withdraw | Finality/cancellation/unknown outcome/gas/phone flow acceptance retained |
| Trade open/protect/reduce/close, orders, charts, receipts | S1b/J3–J5/S8 | Source exists; full phone lifecycle and interrupted protection acceptance retained |
| Mainnet RWA core and pool | S8.17–21, Q-012 | Live API currently advertises only 10143; Mainnet API configuration, funding, owners/Safe, assurance, deploy/seeding/indexer and funded phone lifecycle; no mainnet deployment implied by a wallet UI |
| Perpl crypto execution | S7, v2 W6, Q-002/Q-003 | Enrollment/builder/origin/geo and funding; price discovery does not establish tradability |
| Aurora cross-chain funding, refund, cash-out | S9, Q-004 | Provider key/route; quote/fee/expiry/status/failure/refund and three-chain acceptance |
| Fiat on-ramp | Stage 14 B4/B9; D-247; `features/money/ramp.ts` | Ramp hosted buying already exists; official Monad MON/USDC/AUSD/USDT0 coverage verified. Region/payment quote and purchase-to-wallet acceptance remain; bank cash-out needs the support-issued key |
| Existing notifications | D-249; `services/common/src/notifications.ts`, API social `notify.ts`, keeper delivery; mobile inbox/preferences | Server ledger/inbox, registration, receipt delivery, social/followed-trade and money alerts exist; physical APNs/FCM and tap-mode acceptance required |
| New token-momentum notifications | Token price/liquidity source + keeper/jobs + preference channel | New trigger/threshold/window/liquidity/freshness/cooldown design; ordinary price-level alerts do not implement this |
| New followed-trader notifications | API social feed/follows/moderation + durable notification outbox | Opt-in engine-open notifications already exist with chain dedupe, sharing cutoff, block/mute filters and age suppression. Delivery-time privacy and ingest-to-outbox recovery gaps require closure; actual spot purchases need a source |
| Prediction markets | New provider research; FT050–054/C24 reopened for evaluation | Research requested; execution remains gated on verified integration. Sports remains excluded unless separately selected |
| Issuer/card lifecycle | Stage 14 E1–E6; S10, Q-007 | New source includes test issuance, freeze, secure reveal, simulated auth/capture/refund, real debt/repay and payment history. Lithic sandbox is now connected to `senryo-card`; API issuance/freeze/unfreeze acceptance passed. Approved hold/capture/refund, production issuer approval, Wallet provisioning and full phone lifecycle remain; no sample activity |
| Social/profile/watchlist | S12b/J8/J9 | Handle/follow/leaderboard/feed/theses/send-handle/moderation/privacy and network acceptance retained |
| Pool lifecycle | S8/J10 | Exact deposit/redeem/request/claim, escrow continuity and variable value; delay/risk remain visible at review |
| Rewards/referrals/clans/competitions | Existing retained programme backlog | Programme funding, eligibility/scoring/abuse/settlement/moderation; no invented reward promises |
| News/chat and X linking | Existing retained content/OAuth backlog | Provider/moderation/privacy and secure linking requirements remain |
| Spot/meme tokens | J11/W6 | Real liquidity, identity, quote/slippage/security and funded swap; meme breadth follows core loop |
| Web parity | S11/S11b | Shared package compatibility plus independent desktop/mobile-web transaction/discovery/social acceptance; this selection is for native first |
| Accessibility/sound/haptics/widgets/Live Activities | S1b/S12 | VoiceOver, large text, Reduced Motion/Transparency, Android Back, silent-switch/mixing; widgets/Live Activities remain pending source work |
| Docs/stats/legal/traction/distribution/submission/operations | S13–18/S-GTM | Deploy/provider/store state must be reverified; truthful product docs, rollback, clean install, live metrics and user submission/outreach remain |

No row is removed because another UI pass is underway. Built, accepted on simulator, accepted on device, deployed and mainnet-verified are separate states. Previous STATUS checkmarks are historical, not verification of today's branch.

## Execution order

1. Record the selected direction and new reference evidence. Preserve existing dirty work.
2. Implement Home/Card and shared concise icon controls against the actual data model.
3. Close the remaining Practice money/trade/install acceptance and measured performance defects.
4. Finish existing notification delivery acceptance; close followed-trader ingest/privacy gaps and add momentum triggers with explicit preferences and trustworthy sources.
5. Complete independently buildable provider adapters and discovery. Enable on-ramp, Aurora, issuer, Perpl and mainnet features only when their prerequisites are real.
6. Evaluate prediction-market venue compatibility in parallel with retained core work. A coming-soon message may state intent, not availability or a launch promise. Never substitute a price-pool contest for a binary Yes/No exchange without disclosure.
7. Finish web/accessibility/distribution/docs/submission and operation gates. Record every unresolved dependency and next action in the same register.

## Current boundaries

Canonical checkout: `/Users/abu/dev/hackathon/metropolis`, branch `codex/senryo-unified`. Release baseline `eb3533deb5564cb304b38f0165c97ade4cb08016` from `origin/claude/premium-takeover` + Slush pass `d86ccef` + compatible older continuation fixes `4d399d4`. The initial `codex/mobile-quality-rebuild` branch was older; its dirty work was preserved at `15ebab9` and selectively adapted without overwriting the newer money/card/native modules. R3/R4 depict older UI. The user also requested consolidation and storage cleanup: [reconciliation/recovery map](consolidation-2026-10-04.md) records integrated work, retained contract deployment work, unfinished web WIP and the reduction from 23 checkouts to one.

The user explicitly authorized updating **TestFlight** on 4 October. Release version/runtime `0.2.1` carries this source pass and the premium baseline's newer native modules; EAS remote build numbers auto-increment. Upload, processing and internal-beta availability must be recorded separately in validation. No GitHub push, App Store production release, live-money transaction or new paid service is implied. The user subsequently explicitly authorized provider signup and required key creation using Blockchain Oracle in Zen; Lithic sandbox setup is authorized. This latest continuation supersedes the older D-250 instruction that Codex had stopped; it preserves its source-led verification approach.

Reference inventory: [new study](../design/reference-study-2026-10-04/README.md). [Provider research and notification contract](predictions-onramp-notifications-2026-10-04.md) records evidence, compatibility limits and next implementation steps. Source/build/device validation is recorded separately; completion of this slice does not close the full register.

Latest phone corrections and native-runtime work: [approved amendment](phone-feedback-2026-10-04.md), [source and provider validation](../design/reviews/2026-10-04-phone-feedback-validation.md). Runtime 0.3.0 supersedes 0.2.1 for the new native Ramp/PDF features.
