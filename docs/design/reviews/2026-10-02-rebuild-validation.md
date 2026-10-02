# Rebuild validation — 2 October 2026

Branch: `codex/mobile-quality-rebuild`; baseline: `6e2be72`. [Contract](../../plan/mobile-rebuild-2026-10-02.md).

Source implementation is committed on the branch in `73367db` (financial foundation), `36f35ce` (native foundation), `cb5d1e4` (money/trading) and `1c0ad7d` (card/profile/settings), after the plan reconciliation `86261a1`. These commits are not phone acceptance. Nothing has been released or deployed by this rebuild.

## Passed source and financial checks

| Check | Result / local evidence |
|---|---|
| Seven workspace typechecks | Chain, query, API, card, mobile, web and drive passed; `/tmp/senryo-rebuild-types-16.txt`. Final mobile-only check is recorded in `/tmp/senryo-rebuild-mobile-final.txt`. |
| Biome | 494 scoped files passed, no fixes needed; `/tmp/senryo-rebuild-biome-20.txt`. |
| Repository invariants | Zero errors/warnings in `/tmp/senryo-rebuild-invariants-16.txt`; final repeat `/tmp/senryo-rebuild-invariants-final-source.txt`. No UI test suite added. |
| Account security | 29 tests passed, zero failed; `/tmp/senryo-rebuild-account-check.txt`. |
| Social API | 145/145 checks passed, including actor filtering before pagination, private actor and network separation; `/tmp/senryo-rebuild-social-check-2.txt`. Used dedicated local database `senryo_rebuild_check_01a0fb6e`. |
| Recovery | Eight checks passed; uncertain signed transactions remain pending regardless of age, never rebroadcast; `/tmp/senryo-rebuild-recovery-check.txt`. |
| Network isolation | Six checks passed; `/tmp/senryo-rebuild-network-check.txt`. |
| Financial foundation | Immutable reviewed intent, partial approval, scoped history, unknown signed outcome, debt/holds/haircut valuation, missing prices and pinned reads passed; `/tmp/senryo-rebuild-foundation-check-3.txt`. |
| Review guard | Changed review before signing or after authentication causes no broadcast/journal write; reserved nonce released; `/tmp/senryo-rebuild-review-guard-check-3.txt`. |
| Portfolio local fork | Wallet → trading preserves ownership; indexer lag uses one older coherent block; pool deposit and active/escrowed shares reconcile to current share value; `/tmp/senryo-rebuild-portfolio-check-6.txt`. Pool share value changes over time; this does not assert an investment retains its deposit value. |
| Relay receipt | Pending duplicates, wrong account/chain/target/emitter/payer, nonfinality, reorg and insufficient actual credit rejected; actual `Deposited.amount` decoded; reverted receipt represented; `/tmp/senryo-rebuild-relay-check-2.txt`. |
| Expo export | iOS and Android Hermes/assets exported to `/tmp/senryo-rebuild-export`; `/tmp/senryo-rebuild-export-final.txt`. An earlier export was cancelled for build resource contention and is not evidence of success. |

## Native and simulator evidence

Release builds succeeded in `/tmp/senryo-rebuild-ios-release.txt`, `/tmp/senryo-rebuild-ios-final.txt` and `/tmp/senryo-rebuild-ios-verified.txt`. The final source bundle, including the shortened withdrawal rail and network-aware public share link, also passed: `/tmp/senryo-rebuild-ios-final-source.txt` ends with `BUILD SUCCEEDED`. Debug build failed with an RN precompiled Debug/ExpoDevLauncher `RCTPackagerConnection` linker error. Release succeeded without changing the native project to bypass that failure.

Binary: `/Users/abu/Library/Developer/Xcode/DerivedData/Senryo-ajxbdmogcytfgjerwbafwikarnqk/Build/Products/Release-iphonesimulator/Senryo.app`. App version 0.1.0 (1), runtime policy `appVersion`; local simulator binary, no accepted TestFlight/internal-store channel or OTA rollback identity established.

Observed on **A3 Senryo iPhone 17**, iOS 26.5, simulator `F0B5E224-2611-48F7-B64C-73BEAAEB9C93`, in an existing Practice account/session:

- Home: unobstructed total portfolio, direct Add money/Withdraw, separate availability, positions and pool holdings; five destinations/right-side fan retained.
- Add money → trading deposit QR: large QR, abbreviated/full-address control, substantial Copy/Share, contextual details. Follow-up source makes Trading account explicit, adds destination selection, corrects Mainnet wallet default and restores the method hub on Back. Those last changes still need review in the final binary.
- Card: restrained original art, locked connected-service state, no invented number, holder or authorization samples. Actual issuance/reveal was not exercised.
- Profile: identity/follows, Trading performance period chart, positions and real recent history; share/history/settings in the header.
- Settings: opened while session locked without Face ID; sound and haptic toggles separately enabled. Onboarding replay presented approved artwork and saved account choices; returning Home kept the account locked.
- Withdraw: own wallet/network identified. Entered P$1 and released a partial rail drag; thumb reset, review remained, no authentication/result was shown. Follow-up source shortens the truncated rail label. No withdrawal was submitted in this review.

Private screenshots: `/tmp/senryo-rebuild-evidence-20261002/release-initial.png`, `deposit-inbox.png`, `withdraw-partial-reset.png`. Reference footage/crops remain private and untracked per Q-021.

## Still pending

Fresh-install and restored-Keychain checks were prepared but **not exercised** before the user's handoff request. Disposable fresh simulator: `14AFB56A-E59F-424F-ABE2-45FB515DA3ED`; existing-account clone: `02B36473-07E8-4EA7-B755-EFB5BD641765`. The clone still contains the installed app/data; uninstall/reinstall there to test retained Keychain plus unseen welcome. Original A3 account is preserved.

No physical iPhone was attached. Physical phone acceptance, continuous gesture/performance measurements, successful slide release, cancellation/background/account/mode/quote scenarios, VoiceOver/large text/Reduced Motion, actual silent switch/audio quality, Android Back/keyboard and a complete recorded funding/trading lifecycle remain pending. Simulator navigation and targeted scripts do not replace these gates.

Mainnet funded lifecycle/Safe/assurance, Perpl account execution, issuer KYC/authorization/capture/refund/protected reveal/provisioning, Aurora routes and fiat programmes keep their existing prerequisites. API/card source changes are local and have not been deployed. Gray card reference remains absent. See the [current Claude continuation](2026-10-02-claude-code-handoff.md).
