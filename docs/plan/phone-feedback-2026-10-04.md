# Phone feedback continuation — 4 October 2026

The user requested continued implementation of the retained plan and supplied direct corrections after installing the unified release. This amends the Slush contract: the reference remains the experience baseline, while Senryo's existing fan must not be duplicated on Home.

## Implementation order and accepted behavior

1. Home: keep the balance/accounts/investments hierarchy. Replace duplicated Add money/Send/Receive shortcuts with Activity, Orders and Withdraw (Withdraw is not in the existing fan). Keep the fan's Send/Receive/Add money/Swap and their guards.
2. Money alignment and alerts: give currency punctuation and rolling digits identical line-box metrics; center prefix/input metrics. Use one clear Create alert action in the Alerts list, keep its picker/editor in the drawer, and return to the list after saving. Preserve network-specific oracle/notification truth.
3. Receipts: tapping a profile transaction opens the same detailed drawer as Activity. Explorer becomes an explicit secondary action. Export a branded PDF with the Senryo seal, title, status, network/paper-money context, exact time, known financial facts and transaction links. Pending/failed receipts cannot imply completion; export does not resend anything.
4. Tokens: browse the token's genuine network details while Practice remains active. Do not require a mode change just to view. Keep trading and money actions behind an explicit Mainnet slide with session lock/review invalidation. No automatic switch or claim of paper-token execution.
5. Deposit: replace the hosted browser handoff with Ramp's official React Native SDK. Purchase-created is not settled money; preserve wallet-arrival reconciliation. Bank/identity/payment providers may require their own app handoff, according to Ramp's contract. New native modules need a separate runtime and TestFlight build.
6. Card: verify live service readiness and available configuration. Connect the real sandbox service only with genuine issuer credentials and contract/operator prerequisites; do not turn an unavailable card into a local mock.
7. Continue the remaining Practice lifecycle, notification reliability/privacy, providers, predictions, web and deployment work in the [full register](reference-followthrough-2026-10-04.md). This feedback changes sequencing, not scope.

## Design decisions

Replacing Home's duplicate money buttons with distinct account utilities retains direct Withdraw and reduces repeated actions. Reusing one receipt body provides consistent facts across profile/history, rather than making a second receipt implementation. Token discovery uses an explicitly scoped read environment; signing still requires the active mode. PDF export and the official Ramp SDK are preferred over a text-only receipt and browser purchase link, as the user's feedback explicitly requests these behaviors.

Continue in the primary checkout on `codex/senryo-unified`; no new worktree is needed. Validate source, relevant pure financial/route boundaries, platform bundles and the new native build. No UI-test suite or screenshot-per-edit loop.

## Current integration evidence

Ramp's official [React Native SDK guide](https://docs.rampnetwork.com/mobile/react-native-sdk) documents in-app presentation, purchase-created/close events and return from third-party payment apps. Package `@ramp-network/react-native-sdk` is currently `1.0.3`; native compatibility and build configuration must be verified against the installed Expo/RN version. [SDK source](https://github.com/RampNetwork/ramp-sdk-rn).

The previous live API check advertised `card: false`; that means the issuer service is not connected, independently of Card UI. Reverify before deployment and retain the actual missing prerequisite.
