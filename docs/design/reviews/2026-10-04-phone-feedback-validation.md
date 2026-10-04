# Phone feedback implementation and validation — 4 October 2026

Canonical branch: `codex/senryo-unified`. Accepted direction: Slush Home/Card, Fomo Markets/Profile/Social, Phantom money fan, amended by [phone feedback](../../plan/phone-feedback-2026-10-04.md). The full [retained register](../../plan/reference-followthrough-2026-10-04.md) remains open.

## Source changes

- Home uses Activity, Orders, Withdraw; the plus fan retains Send, Receive, Add money, Swap.
- Currency symbols, signs and rolling digits share scaled font/line metrics. Alert price inputs center their prefix and typed value.
- Alerts has one Create alert control; successful save returns to the list. Locked alerts stay hidden. Inbox visit state resets with account/network, and locked caches cannot mark notifications read or expose the bell count.
- Profile transaction rows open the receipt drawer. Indexed receipts re-read the exact event within account/network scope. The drawer offers branded PDF export, plain-text share and a secondary Explorer action. Card payment details also export a branded PDF, preserving simulated/payment status and omitting PAN/CVV. Temporary PDFs are removed after sharing.
- Token pages read the route's network without changing the active mode. Price/chart/identity/contract facts remain available in Practice; money actions require the explicit slide-left mode switch, which locks the signing session. Network-specific action deep links retain their switch gate.
- Ramp opens its official React Native SDK, constrains the selected Monad asset, verifies purchase recipient/asset, and rechecks account/mode after close. Purchase creation does not credit a balance or prove payment. Missing native modules and presentation failure are explicit states. The provider may still require a bank app handoff.
- Native runtime/version is `0.3.0`: new `expo-print` and Ramp modules must not be sent as an OTA to runtime `0.2.1`.
- Ramp RN 1.0.3 is patched to pin Android 4.0.1 and report iOS presentation/configuration failures instead of force-crashing. Android config omits unsafe debug logging, reads absent optional fields safely and reports missing/failed presentation. Its iOS pod is pinned to the official 4.0.1 tag. Source and compiled JS/type entries are patched together.
- iOS presenter lookup and presentation both run on the main thread. SDK initialization failures and malformed purchase callbacks are handled without leaving the flow busy.

## Validation completed

Mobile TypeScript, scoped Biome, repository invariants (0 errors, 0 warnings), and iOS/Android JS bundle exports pass. These do not establish physical-device visual, gesture, audio, payment or native provider acceptance. No UI tests were added.

## Card sandbox integration

The user explicitly authorized provider signup and key creation using Blockchain Oracle in Zen. Lithic sandbox was created through Google sign-in. API and signing credentials are stored outside the repository under `~/.config/senryo/providers` and applied as runtime-only variables.

Coolify resource `bw3mwbxy5muoflqpumyq2btk` (`senryo-card`) runs image `ghcr.io/blockchain-oracle/senryo-api:sha-34b2af3`, Practice chain 10143, 192 MiB limit. Its `/v1/card/*` route shares `api.senryo.xyz` without stripping the prefix. Lithic ASA and card-transaction event subscriptions are enrolled and signed. Readiness checks confirm database, finalized heads and ASA secret. The image's Node health check is retained; Coolify's generated curl/wget check was incompatible with this image and disabled.

Real sandbox acceptance through Senryo API: Practice SIWE login, summary, idempotent issuance with issuer last4, freeze to PAUSED, and unfreeze to ACTIVE passed. A signed simulated purchase correctly returned DECLINED / over_limit with its ASA ledger row. A separate Practice acceptance account claimed P$100 through the real starter relay and signed a P$20 daily allowance; that allowance finalized. The live service uses only the first authorized operator: the second configured shard lacked immediate placeHold permission and was removed without granting new privileges. Operators were funded with testnet MON. The new source also checks immediate placeHold permission before starting the service; live RPC checks accept the authorized shard and reject the unauthorized one. No real-money transaction or live card issuance occurred.

The main API now has `CARD_URL=http://senryo-card:3001`; its restarted config confirms `card: true` on 10143. Native TestFlight 0.3.0 (7) is VALID / IN_BETA_TESTING. The funded sandbox coffee purchase approved, reserved P$5.76 including its tip buffer, captured P$4.80 with zero debt, and refunded P$4.80. The final stable collateral is P$100 with zero card debt; the acceptance account’s allowance was revoked with its own signature and its card paused. Production issuer approval, Wallet provisioning and physical-phone acceptance remain separate gates.

## Native distribution

The previous release `0.2.1 (5)` and its validation remain historical. The new 0.3.0 build compiled, uploaded, passed Apple processing and entered internal beta. Installation and the native payment/PDF/gesture/audio experience on the physical phone remain unobserved.

The first 0.3.0 attempt, build 6 (`d6ff7a54-c3bc-4d80-81b3-99252e20d7fc`), was canceled before submission to include the SDK's UIKit main-thread repair. Its queued submission is not evidence of an Apple upload.

Native 0.3.0 (7): EAS build `fafdcad2-81cf-4f97-9637-13e08ed3458b` FINISHED at 09:34:03 UTC; auto-submission `0013344c-03f9-432a-a834-38f91c1d3621` FINISHED at 09:34:19 UTC. Apple reports VALID / IN_BETA_TESTING, not expired. EAS records snapshot `62b6678dc01b08c71d0ea0409791e9ae77d38b02`, which includes the native repair at `8e6a56b`; there are no mobile/patch/lockfile changes between those commits. Native fingerprint: `02a36e4747eb112b55c3513367b4649727020616`. Runtime 0.3.0; production channel. This is an internal TestFlight release, with no App Store production promotion.

## Refund correction

The real sandbox RETURN arrived with legacy `amount: -480`, `amounts.cardholder.amount: 0`, and `amounts.settlement.amount: 480` (USD). The old handler selected the zero cardholder value, queued a zero refund and skipped it. CLEARING and RETURN now use the settlement amount/currency, and unsupported settlement currencies fail instead of being booked as USD. Five regression checks cover this payload, clearing, legacy credit, known zero and a foreign settlement currency. Card typecheck, scoped Biome and invariants pass. This follows Lithic's [transaction-flow ledger model](https://docs.lithic.com/docs/transaction-flow). The original skipped test refund was recovered after deployment. The SQL transaction required the exact Practice chain/account/event/reference, SKIPPED status, zero amount, no signed sends/hash, and the stored USD 480-cent settlement payload. It corrected the event and requeued the existing outbox row/reference; no second issuer refund was created. The row is DONE with one signed transaction, `0xbbb3a68c63437280bff97e52e27f697644ce72b232cccadabe416d595d2ba90a`. After this recovery, onchain captured/refunded counters both read 4,800,000 USD6. The reference is used, and a duplicate read-only call reverts `RefundUsed`. The original reference has exactly one balanced refund group, D = C = 4,800,000; `ledger_unbalanced` is empty.

A fresh, distinct sandbox coffee cycle then passed against the deployed handler without any repair: DECLINED/over_limit with a zero allowance, signed allowance, APPROVED authorization, FINALIZED P$5.76 hold, CAPTURED P$4.80 with zero debt, and automatic P$4.80 refund. Its RETURN again had cardholder amount zero and settlement 480 cents; `card_events.amount_cents` is 480 and its outbox row is DONE with one signed transaction, `0x59ab77abe8a1921975b8d56543ba6370248e41ab1f8bc16d0a6828a46fc67703`. Final captured/refunded counters both read 9,600,000 USD6. Stable collateral is P$100, debt zero; the own-account allowance revocation finalized and the issuer card is PAUSED. Both independent refund references remain distinct; no second refund of the original payment was submitted.

Unused gas from the disabled unauthorized operator shard was moved to the authorized shard on chain 10143, with a chain/address guard and retained fee reserve. No new contract permission was granted and no mainnet funds were used.

## Backend deployment and notification validation

API, Card and keeper run immutable image `ghcr.io/blockchain-oracle/senryo-api:sha-34b2af3`, OCI revision `34b2af3d2d73d77906941870e386219ffdbdfe8c`, registry digest `sha256:9e8316d77a98326806679b38bd4ff8d64a0099621e00a889a2dfdce3bc1bba38`. Service bundles were compiled locally with the existing bundle script and packaged locally in the existing OrbStack engine as a COPY-only layer over previous runtime digest `sha256:9ffa1efd9a2cda8aa4d4274d4c6b8d10cdc886b0ab7524a213e6e97f6416eb23`. No source/dependency build ran on the server. This local artifact path replaced CI for this release without pushing a Git branch; the previous `sha-a5630db` tag remains the rollback target.

| Service | Coolify resource | Deployment | Verification |
|---|---|---|---|
| Card | `bw3mwbxy5muoflqpumyq2btk` | `zdxc5qvamz8cdxjyw8ee6phm` | Healthy; `/ready` 200, DB/heads/ASA secret true; real sandbox cycle above |
| API | `lzumxcf5i0hvzv2k5gpzvfdr` | `lkhupt19io5sodmvzmbjknss` | Healthy; public status Card ok, config Practice 10143 Card true |
| Keeper | `cskiutyjlluqkfupj4bixxs3` | `ifykdl2ffhbnngs2ihpe5vjy` | Healthy; `/ready` 200, DB/heads true |

Followed-trade ingest now commits notifications with feed/cursor state, and delivery plus inbox paths recheck current sharing/follow/block/mute/moderation eligibility. The checks passed 32 notification cases and 161 social cases against scratch Postgres, using fake Expo transport. API/common/Card/keeper typechecks, scoped Biome and invariants passed. These fixes are deployed; actual APNs/FCM delivery, killed-app taps and exact public trade-detail routing remain open. Spot-purchase events and token momentum still need their genuine producing sources.

The later Aurora key setup attempt could not proceed because Zen computer control returned ScreenCaptureKit error -3812 on reconnect/state capture. This is a computer-control failure, not evidence of provider refusal or an additional permission requirement. Aurora still has no configured key or served quote adapter; Perpl and coordinated mainnet deployment remain separate work in the full register.
