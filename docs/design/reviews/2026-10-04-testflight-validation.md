# Slush Home/Card TestFlight continuation — 4 October 2026

## Source identity and release authority

The user explicitly selected Slush Home/Card + Fomo trading/social, then requested **Update TestFlight**. This work integrates the latest premium baseline `eb3533deb5564cb304b38f0165c97ade4cb08016` with the Slush pass, now consolidated in the primary checkout on `codex/senryo-unified` ([reconciliation/recovery map](../../plan/consolidation-2026-10-04.md)). The earlier branch's source pass and dirty continuation were preserved at `15ebab9`; its simulator/native checks are not evidence for this newer release.

Version/runtime: **0.2.1**. Bundle ID: `xyz.senryo.app`. EAS project: `2d424d4b-644e-4231-a156-a8c63d802e9c`. App Store Connect app ID `6818426846` was returned by the authenticated EAS status check. Before this upload, ASC reported only `0.1.0 (4)` as VALID / IN_BETA_TESTING; the newer 0.2.0 EAS builds were internal previews.

## Changes reviewed in source

- Home keeps the owning balance sheet, any-asset holdings, Perpl equity, liabilities and partial-value handling. Smaller quiet cents and explicit Paper money replace the large Practice currency prefix on these primary surfaces only. Round Add money/Send/Receive/Withdraw use existing routes and terms/account guards. Accounts and Investments disclose genuine assets/positions/pool, ahead of Top Trades. Existing saved Assets/Positions choice survives.
- Kinpaku keeps its original art, issuance, freeze/unfreeze, secure reveal, limits, actual debt/Repay, Wallet provider gate, simulated payment and authenticated payment history. Controls precede the Available/On hold pair. On hold uses the larger known risk/issuer hold; absent reads show unavailable, not an invented zero. Available remains capped risk capacity, not another owned asset.
- The shared Hide balances switch now covers the new primary amounts, debt line, payment amounts/hold detail and pool amount. Locked sessions cannot render cached issuer card/payment data or the private card sheets.
- Shared press travel respects Reduced Motion. Disclosure animates its chevron/content; financial values remain query facts. No transfer Undo, invented weekly spending, yield, merchants or prediction execution was added.

## Validation

Passed on the final source: mobile TypeScript check; scoped Biome check (15 changed/new source/config files); repository invariants (0 errors, 0 warnings); `git diff --check`; iOS and Android Expo/Hermes bundle export. Export emitted an existing `@noble/hashes/crypto.js` package-export fallback warning and non-blocking Node color warnings. Private check logs and source SHA-256 records are under `/tmp/senryo-slush-latest-*20261004*`. EAS production native build, ASC upload/processing and internal beta availability are distinct release stages; no stage is inferred merely from enqueueing the next one.

No new UI tests were introduced (repository invariant). No screenshot-per-edit loop was used. Physical phone, VoiceOver/large text, Android Back, audio, passkey restore/upgrade, real provider/funded transactions and notification delivery/taps remain acceptance work. [Complete work register](../../plan/reference-followthrough-2026-10-04.md) tracks retained scope. [Provider/notification evidence](../../plan/predictions-onramp-notifications-2026-10-04.md) distinguishes existing Ramp/followed-trade source from remaining integration work.

## Live service check

Read-only checks on 4 October: `https://api.senryo.xyz/health` returned 200 / `ok: true`; `/v1/config` returned Practice chain 10143 and `card: false`. Source `services/api/src/routes/info.ts` derives that flag from `CARD_URL`, so the live API does not advertise a connected card service. The new Card layout cannot establish provider readiness; an unavailable service remains a truthful unavailable state. No service environment or provider was changed as part of this binary upload.

## Release outcome

Native build [1b9b28b8-5516-4dce-816f-8b24a5e34900](https://expo.dev/accounts/0xabu/projects/senryo/builds/1b9b28b8-5516-4dce-816f-8b24a5e34900): `0.2.1 (5)`, source `d86cceffbd411c8eb0c065682e1e389bd0496642`, production profile/channel, normal priority. EAS native compilation finished successfully; Apple binary upload also finished successfully.

The first auto-submission request was rejected because optional `--what-to-test` maps to the Enterprise-only EAS changelog feature. No plan upgrade or duplicate build was requested. The same build was successfully scheduled without that optional field as submission `75edfcc3-f4aa-4ed7-bb97-b1c1e7054a8e`, now `FINISHED`.

Authenticated ASC status now reports **0.2.1 (5): VALID / IN_BETA_TESTING**, not expired, runtime `0.2.1`. Internal testers can install/update in TestFlight. External state is `READY_FOR_BETA_SUBMISSION`; no external beta review or production App Store promotion was performed.

## Consolidated JavaScript continuation

Source `4d399d44558eff69decd9ff5e5e95c77fc2fc8a1` adds compatible earlier fixes: once-only deferred account prompts, normalized internal URL targets with latest social mappings preserved, correct query merging for legacy funding links, Swap Back over a sheet, chart price-label clear space, real square-logo clear space and nested button contrast. Redirect-only QR/wallet routes remain current; older money/Home/Card models were not restored. This introduces no new native dependency or native app configuration change.

Passed: regenerated current Expo route declarations + mobile typecheck, scoped Biome on nine source files, invariants (0 errors/warnings), iOS/Android export and 15 actual-source deep-link cases. The first consolidation check identified an obsolete icon import and stale generated route declarations; these were corrected before release. Production iOS JavaScript update was successfully published to the existing `production` channel/branch for runtime **`0.2.1`**: group **`6e96ecac-67d0-4893-accc-6b4370a78e00`**, update `01a10607-b72a-7485-b2eb-8fddd6f55bdb`, source `4d399d44558eff69decd9ff5e5e95c77fc2fc8a1`. EAS exported and uploaded the bundle, computed fingerprints and confirmed publication. A separate authenticated `update:view` read confirmed the group, source hash, iOS platform and `0.2.1` runtime. Final iOS/Android export after the query fix also passed. The embedded binary remains `d86ccef`; this compatible continuation arrives through EAS Update on subsequent app launch. Device download/application has not been observed. The older `0.1.0` runtime cannot receive this update. No new Android binary/update was published as part of the TestFlight request.

No GitHub push was performed.
