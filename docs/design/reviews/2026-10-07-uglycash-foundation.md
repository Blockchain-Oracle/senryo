# UGLYCASH first slice — implementation and validation, 7 October 2026

The user approved the [whole-product plan](../../plan/uglycash-revamp-2026-10-07.md) with “lgtm”. This is the first reviewable native slice, not completion of the whole revamp. Baseline: branch `codex/senryo-unified`, HEAD `44d876ba5e2e8f4e812a2ad170eaef393e714845`, with existing dirty predictions, CardIssued, web and documentation preserved. No release upload, deployment, provider signup, contract deployment or financial transaction occurred.

## Reference and adaptation record

Authority: latest user decisions → the 16 supplied UGLYCASH ZIPs / 89 inspected screenshots → Senryo account/operation integrity → supplemental Refero metadata → older visual directions. See [flow study](../reference-study-2026-10-07-uglycash/README.md), [forms/states](../reference-study-2026-10-07-uglycash/forms-and-states.md), [parity ledger](../reference-study-2026-10-07-uglycash/parity-ledger.csv) and [current capability/dependency snapshot](../reference-study-2026-10-07-uglycash/project-status.md).

| Area | Implemented source | Fidelity / adaptation |
|---|---|---|
| Native foundation | `theme/native-palette.ts`, palette/provider, type/fonts, Button, Sheet, app.config | U04/U14 light canvas #F5F5F5, white groups, gray insets, black pills, magenta action/glow, edge-attached rounded-top sheets. Fresh installs start light; explicit light/dark/system choices survive. Dark remains an accessible adaptation because no native dark reference was supplied. Shared web colors remain unchanged. |
| Display type | Roboto Condensed Black, Inter utility text, Noto Sans JP | Condensed display character; reference font identity is unknown. Font is legally vendored from Google Fonts, pinned source, OFL, deterministic weight-900 instance and checksum in tokens provenance. No claim of exact typeface. |
| Navigation | Dock, ContextTabs, DockProvider, Markets query mapping | Approved three visible contexts over all five retained route stacks. Money: Home/Card/Activity/Pool/Profile; Trade: Pairs/Predict/Watchlist/Orders/Profile; Social: Feed/People/Profile. Clubs remain service work; no fictitious destination. Owned Senryo seal anchors Trade. Transaction screens/keyboard hide the dock. |
| Money Home | Home index/HomeBalance, retained HomeTabs/CardFace/TopTrades | U04 black identity header, overlapping white balance, quiet funding actions, white portfolio/magenta Trade. Retains actual balance accounting, Practice P$, partial/unavailable/loading distinction, native mode awareness, genuine profile identity and owned Kinpaku art. No invented APY/growth/cashback. |
| Display Balance | New sheet, PrivacyMark, BalanceDetails | U04 preview/toggle/expanding selector; existing hide-balances boolean retained. Three owned concealment illustrations replace competitor art. Breakdown values and accessibility labels also conceal. Whole-product privacy sweep remains open. |
| Face ID/setup | ContextualFaceId, SetupResume, versioned setup-order/progress, compatibility redirect, reactive TermsHost | U14 primer overlays Home; uses real platform biometric capability and scan. New accounts see terms before Face ID. Existing accounts retain remaining legacy order. Cancel/denied/lockout/failure/unavailable/old-build have truthful recovery. Repeated/stale callbacks cannot advance twice. Notifications require a separate tap after returning Home. |
| Native auth recovery | AuthFailure/AuthFlowSheet | Discovered existing error UI sent mobile users to the website. Native failures now offer retry or Keep browsing; unsupported builds/providers explain the native dependency. No authentication bypass or web migration. |
| Cleanup | Removed unused ActionFan and HomeGroups; removed obsolete fan geometry and button lift | Preserved Send/Receive/Add money/Swap through the new contextual Move money sheet and retained real action/terms guards. Pool, Card, rankings, search and prediction routes remain reachable. |

Old visual choices in historical files do not supersede the approved plan. Existing prediction and CardIssued edits are not authored or represented as complete by this slice.

## Verification

- Mobile TypeScript: passed on final source, including native auth-failure recovery.
- Drive TypeScript: passed after fixing the new setup check's indexed-value narrowing.
- New setup-order checks: new/legacy order, account isolation, duplicate and stale callbacks, completion, malformed persisted data passed.
- Existing auth-foreground and mobile-foundation checks passed (immutable intents, partial approval, durable scopes, unknown outcomes and coherent portfolio reads).
- Repository invariants: **0 errors, 0 warnings**, including font provenance, native color literals and text leading.
- Final-source iOS/Android Hermes export passed. Existing @noble/hashes package-export fallback and NO_COLOR/FORCE_COLOR warnings remain; no bundling error.
- Native iOS Release simulator build passed and installed. Guest navigation and Display Balance were inspected at 402×874 points (1206×2622 pixels). Final simulator-signed Release rebuild also passed, installed and launched. Generated native splash color is #F5F5F5; physical launch/flash acceptance remains open.

## Observed simulator flows

Device `723005B8-D4AB-4309-BCA5-0E9D0709BC15`, iOS 26.5, existing simulator named “Senryo Slush Returning Account Review”. Local source build, not the distributed TestFlight binary.

| Flow | Observed result | Evidence / limit |
|---|---|---|
| First launch → Look around → Money | New light canvas, black button, real public market rows and three-context dock render | Private artifact `implementation/guest-home.png`; authenticated Home hero remains unverified |
| Trade → Predict | Trade context top destinations render; Predict selects and opens the retained prediction view | AX selection changed to Predict; provider data/execution are not acceptance of this UI slice |
| Social → Profile | Social context remains selected; top selector becomes Feed/People/Profile with Profile selected | Real retained Profile route; guest empty state |
| Display Balance | Edge-attached native sheet, dashed preview and white grouped control render | Opened directly in guest mode to inspect anatomy; no fabricated account/balance |
| Privacy mode → Kitsune | Preview replaces the amount with owned art; native Switch becomes on; radio selection checked | Private artifact `implementation/privacy-hidden.png`; AX says “Balance hidden”, not an amount |
| Terminate → relaunch → reopen Display Balance | Hidden mode and Kitsune remain selected | Actual MMKV persistence verified across process restart |
| Passkey sign-in | Initial unsigned build returns a classified setup-unavailable failure | Native logs show missing Keychain entitlement on the initial unsigned build. The final simulator-signed build reaches the genuine iOS passkey UI; it asks for a passkey from another device and reports Bluetooth Off. No local credential was available; no account was created/adopted and no terms were accepted. This does not establish a backend outage or production failure. |

Private screenshot directory: `/Users/abu/.codex/artifacts/senryo-uglycash-2026-10-07/implementation/`. Reference screenshots remain in the user's original Downloads ZIPs and private study directory, not vendored into the app.

## Final-source checks and preservation

Final mobile/Drive typechecks, setup migration runtime checks, iOS/Android export, repository invariants (0 errors / 0 warnings), 38-file focused Biome check and staged whitespace check passed. Native Release build commands use `Senryo.xcworkspace`, scheme Senryo and the device ID above; the final build uses `CODE_SIGNING_ALLOWED=YES CODE_SIGN_IDENTITY=- ONLY_ACTIVE_ARCH=YES`. The final signed simulator displays a dark/Mainnet guest state; that observation is not acceptance of Mainnet services or a full dark-theme sweep. The earlier light guest/privacy screenshots show the reference presentation.

The approved plan/reference study is local commit `649bc0a`. Task-owned implementation is committed separately after validation. Pre-existing prediction, CardIssued, website and unrelated documentation changes remain outside this implementation commit. No source push or distributed-app update occurred. UI interaction stopped when the simulator was changed by the user; no further settings action was taken.

## Remaining acceptance and full roadmap

Authenticated Home and native Face ID on a physical device, denied/cancel/background recovery, small phones, large text, screen reader, dark-theme visual sweep, every retained route/Back/search/keyboard interaction and full-product concealment remain separate acceptance work until observed. New binary contract deployment or a true in-app provider order/position/exit/claim lifecycle is not delivered by this UI slice. Predictions remain view-only/polled; live price freshness and provider/native contract feasibility are retained work.

Next slice within the approved baseline: complete welcome/passkey/username/forms/loading and account/profile/recovery journeys with reference parity. Then money/receive/funding/receipts, trading and live BTC/ETH predictions, social/sharing/clubs, remaining states and physical/release acceptance as specified in the plan. Implementation sequencing does not remove any of those requirements.
