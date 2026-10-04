# Slush Home/Card TestFlight continuation — 4 October 2026

## Source identity and release authority

The user explicitly selected Slush Home/Card + Fomo trading/social, then requested **Update TestFlight**. This work integrates the latest premium baseline `eb3533deb5564cb304b38f0165c97ade4cb08016` on `codex/slush-home-card-testflight`. The earlier branch's source pass and dirty continuation were preserved at `15ebab9`; its simulator/native checks are not evidence for this newer release.

Version/runtime: **0.2.1**. Bundle ID: `xyz.senryo.app`. EAS project: `2d424d4b-644e-4231-a156-a8c63d802e9c`. App Store Connect app ID `6818426846` was returned by the authenticated EAS status check. Before this upload, ASC reported only `0.1.0 (4)` as VALID / IN_BETA_TESTING; the newer 0.2.0 EAS builds were internal previews.

## Changes reviewed in source

- Home keeps the owning balance sheet, any-asset holdings, Perpl equity, liabilities and partial-value handling. Smaller quiet cents and explicit Paper money replace the large Practice currency prefix on these primary surfaces only. Round Add money/Send/Receive/Withdraw use existing routes and terms/account guards. Accounts and Investments disclose genuine assets/positions/pool, ahead of Top Trades. Existing saved Assets/Positions choice survives.
- Kinpaku keeps its original art, issuance, freeze/unfreeze, secure reveal, limits, actual debt/Repay, Wallet provider gate, simulated payment and authenticated payment history. Controls precede the Available/On hold pair. On hold uses the larger known risk/issuer hold; absent reads show unavailable, not an invented zero. Available remains capped risk capacity, not another owned asset.
- The shared Hide balances switch now covers the new primary amounts, debt line, payment amounts/hold detail and pool amount. Locked sessions cannot render cached issuer card/payment data or the private card sheets.
- Shared press travel respects Reduced Motion. Disclosure animates its chevron/content; financial values remain query facts. No transfer Undo, invented weekly spending, yield, merchants or prediction execution was added.

## Validation

Passed on the final source: mobile TypeScript check; scoped Biome check (15 changed/new source/config files); repository invariants (0 errors, 0 warnings); `git diff --check`; iOS and Android Expo/Hermes bundle export. Export emitted an existing `@noble/hashes/crypto.js` package-export fallback warning and non-blocking Node color warnings. Private check logs and source SHA-256 records are under `/tmp/senryo-slush-latest-*20261004*`. EAS production native build, ASC upload/processing and internal beta availability are distinct release stages; no stage is inferred merely from enqueueing the next one.

No new UI tests were introduced (repository invariant). No screenshot-per-edit loop was used. Physical phone, VoiceOver/large text, Android Back, audio, passkey restore/upgrade, real provider/funded transactions and notification delivery/taps remain acceptance work. [Complete work register](../../plan/reference-followthrough-2026-10-04.md) tracks retained scope. [Provider/notification evidence](../../plan/predictions-onramp-notifications-2026-10-04.md) distinguishes existing Ramp/followed-trade source from remaining integration work.

## Release outcome

Pending build/upload at this checkpoint. No GitHub push or production App Store promotion performed.
