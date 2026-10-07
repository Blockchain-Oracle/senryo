# Senryo status for the revamp — 7 October 2026

This is the planning baseline, not a new acceptance of the whole app. Source inspected in `/Users/abu/dev/hackathon/metropolis`, branch `codex/senryo-unified`, HEAD `44d876ba5e2e8f4e812a2ad170eaef393e714845`. Preserve the existing dirty mobile prediction/card work, website work and documentation. No app source was changed during this study.

Later user clarification: prediction scope starts with **BTC/ETH**, all interaction stays **inside the native app**, and an original **Monad testnet contract using test MON** is an acceptable fallback if existing integrations cannot deliver that journey. Mainnet is a subsequent possibility with its own deployments/oracle/liquidity/assurance. No prediction contract has been implemented or deployed by this planning amendment. The existing pair-trading contracts are not proof of a binary prediction implementation. See the [execution amendment](../../plan/uglycash-revamp-2026-10-07.md#prediction-execution-amendment--native-app-and-owned-monad-fallback).

## What Senryo actually is

Mobile-first pair trading on Monad, predictions, money movement, Kinpaku and trader discovery, under a passkey account. Practice is the entry point. The browser remains a companion. Engine pairs are XAU/XAG and EUR/GBP/JPY/CHF/CAD against USD. Crypto discovery/Perpl, spot swaps, binary prediction markets and numerical contests are different products with different execution dependencies.

The [current product brief](../../product/current-product.md), [retained work register](../../plan/reference-followthrough-2026-10-04.md), [simulator validation](../reviews/2026-10-04-simulator-feature-validation.md) and [prediction build ledger](../reviews/2026-10-04-predictions-build.md) were read. Their dates matter. Existing design selections are superseded by the user's UGLYCASH direction; their unresolved capabilities are retained.

## Current read-only observations

At approximately **16:33–16:35 UTC on 7 October 2026**, unauthenticated reads of `https://api.senryo.xyz` returned:

| Check | Observed | What it establishes |
|---|---|---|
| `/health`, `/ready` | HTTP 200, `ok: true` | Public service responds; not proof of every feed/provider/device journey |
| `/v1/config` | Only chain **10143**, Practice, `deployed/starter/card: true`; empty feature overrides | Engine Mainnet is not advertised by this config. Card flag is not production issuer approval |
| `/v1/predictions?provider=polymarket&asset=BTC&window=5m&state=open` | HTTP 200, 33 returned markets | Bounded public discovery responds; no order, funded account or fill was tested |
| `/v1/predictions?provider=castora` | HTTP 200, 41 returned markets | Contest discovery responds; no entry, settlement or claim was tested |
| `wss://api.senryo.xyz/v1/ws`, `prices:XAU` / `prices:EUR`, 10143 | Connected and acknowledged both; one price event each during 12 seconds. Source timestamps **16:06:32 / 16:06:33 UTC** | The observations were about **29 minutes old** on receipt. This short sample does not establish outage duration or cause. Investigate source cadence, keeper/oracle/indexer and stale handling before live-chart acceptance |

The socket test subscribed only to public market channels and pinged; no account token, address, mutation or transaction was used. No current store-console, installed-device or deployed-image inspection was performed. The latest source commit is not assumed deployed.

## Capability and completion map

| Area | Source now / historical acceptance | Remaining completion gate |
|---|---|---|
| Native foundation | Expo 57, React Native 0.86.3; Reanimated, Skia, passkeys, LocalAuthentication, audio, native Ramp and receipt modules already present | UGLYCASH tokens/type/art/shell/sheets and all route states; fresh/upgrade/restore compatibility; physical accessibility/performance |
| Account/setup | Genuine passkeys, resumable per-account setup, terms, local biometric capability/authentication and foreground prompt coordination | Move Face ID primer over Home; migrate setup order; verify fresh/returning/guest/restored paths, cancel/deny/lockout, device secret access and real phones |
| Home/privacy | Actual balance sheet, holdings/positions/pool context; persisted hide-balances boolean | New composition and illustration privacy sheet; partial/stale/source-age handling; no double-counted margin/card capacity; VoiceOver/privacy previews |
| Pair trading | Chain risk snapshots plus existing shared EngineSocket/PriceStore, indexed candle chart, open/protect/reduce/close and journal source | Diagnose observed feed age; live chart presentation; full Practice execution/interruption/recovery and measured phone acceptance; Mainnet assurance/deploy/config/funding |
| Perpl/spot | Distinct discovery, wallet assets and quote/money-operation source | Provider enrollment/terms/region/account/funding; actual executable quote, swap/trade and recovery acceptance; no discovery-equals-execution assumption |
| Predict | `execution: "view-only"` in shared schema; real REST discovery/detail/history; **20-second polling**; SVG outcome-share-price chart | Streaming adapter, actual underlying/resolution data where supplied, rollover/freshness; then provider account/auth/quote/order/positions/exit/claim/settlement/recovery. Polymarket binary and Castora numeric contest stay distinct |
| Receive/send/funding/swap/cash-out | Native Ramp source and provider asset mappings; real QR/address and exact reviewed money operations; Practice AUSD/USDC swap support | Actual purchase-to-wallet delivery, review/sign/pending/final/unknown outcomes; existing draft-agreement acceptance; region/payment/bridge/refund constraints; phone share/save |
| Kinpaku | Lithic sandbox integration; simulator issuance, bounded allowance, freeze/unfreeze, reveal/Hide and receipts recorded 4 October | New visual treatment; repeat full lifecycle in new app; provider/device acceptance; production issuer approval/spend/Wallet remains unavailable |
| Pool | Real Practice overview and lifecycle source | Deposit/redeem/request/claim, escrow/variable value, interruptions and funded Mainnet acceptance |
| Social/profile/thesis | Public/private reads, follows, feed, ranking, moderation/privacy, position thesis and profile share source; prior simulator checks recorded | UGLYCASH hierarchy; genuine thesis edit contract if absent; authenticated cross-device mutation/privacy checks; owned trade-card renderer/permalink and share recovery |
| Clubs/programmes | Retained work; the new references specify actual membership/invites/ranks | Persistent clubs/roles/privacy/member controls/scoring/moderation; rewards/referrals/clans/competitions funding/eligibility/settlement. No sample memberships as production data |
| Notifications | Inbox, registration, receipt alerts, followed-trader/outbox source and prior checks | Physical APNs/FCM trigger/delivery/tap/mode/opt-out; momentum source/threshold/cooldown work; programme/club preferences |
| Sound/motion | Owned original cues; preload pool; persisted sound/haptic settings default on; respects silent switch and background; existing gestures | Extend event cues and optional live-position reactions; confirmed-event dedupe; background/audio interruptions; time-based chart interpolation, reduced effects and physical listening |
| Settings/recovery | Policies, fresh passkey recovery reveal, timed/background hide, no clipboard, protected storage source | Restyle without removing protection; recovery/deletion/relaunch/device-change acceptance and app-switcher cover |
| Long tail | Help/status, alerts, content/news/chat/X linking, widgets/Live Activities, platform/accessibility and programme work retained | Complete individual service/platform contracts and acceptance; a new palette does not close these rows |
| Companion/docs/stores | Existing browser source and historical release records; recorded TestFlight **0.3.0 (7)** and compatible prediction OTA | Current remote release state unverified; native runtime impact/new build, install/update/rollback, device review, accurate public captures/docs and companion parity |

## Dependencies that determine the order

1. Lock the visual system and route mapping; diagnose feed freshness while preparing the first reviewable Home/Face ID slice.
2. Rebuild complete Practice money and pair-trading journeys with the existing account, chain, risk and operation owners. Preserve receipt and recovery semantics.
3. Deliver the live read-only BTC/ETH prediction workspace and evaluate a genuinely native execution route. Use a compatible provider or the accepted original Monad-testnet contract fallback, covering oracle/liquidity/entry/position/exit/settlement/claim/recovery inside the app. Numerical contests remain separate, not a fallback binary market; Mainnet has separate deployment/readiness gates.
4. Implement social/share/club services and remaining card/pool/notification/programme surfaces; prerequisites can progress alongside the UI work, but every acceptance result is recorded separately.
5. Reconcile companion, docs, builds/stores and physical-device acceptance. Enable funded Mainnet/provider paths only after their actual dependencies and Practice acceptance.

The [revamp plan](../../plan/uglycash-revamp-2026-10-07.md) and [parity ledger](parity-ledger.csv) own the new sequence. Historical “done” status does not mean the new design or current runtime is accepted.
