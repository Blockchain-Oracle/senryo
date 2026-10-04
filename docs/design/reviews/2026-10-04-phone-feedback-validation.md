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

Coolify resource `bw3mwbxy5muoflqpumyq2btk` (`senryo-card`) runs existing image `ghcr.io/blockchain-oracle/senryo-api:sha-a5630db`, Practice chain 10143, 192 MiB limit. Its `/v1/card/*` route shares `api.senryo.xyz` without stripping the prefix. Lithic ASA and card-transaction event subscriptions are enrolled and signed. Readiness checks confirm database, finalized heads and ASA secret. The image's Node health check is retained; Coolify's generated curl/wget check was incompatible with this image and disabled.

Real sandbox acceptance through Senryo API: Practice SIWE login, summary, idempotent issuance with issuer last4, freeze to PAUSED, and unfreeze to ACTIVE passed. Daily spend allowance remains required. A signed simulated purchase correctly returned DECLINED / over_limit with its ASA ledger row. No real-money transaction or live card issuance occurred.

The main API now has `CARD_URL=http://senryo-card:3001`; its restarted config confirms `card: true` on 10143. Native TestFlight processing still needs final verification. Production issuer approval, Wallet provisioning, an approved hold/capture/refund cycle and physical-phone acceptance remain separate gates.

## Native distribution

The previous release `0.2.1 (5)` and its validation remain historical. The new 0.3.0 build must compile, upload, pass Apple processing and enter internal beta before the new native features are reported installable.

The first 0.3.0 attempt, build 6 (`d6ff7a54-c3bc-4d80-81b3-99252e20d7fc`), was canceled before submission to include the SDK's UIKit main-thread repair. Its queued submission is not evidence of an Apple upload.
