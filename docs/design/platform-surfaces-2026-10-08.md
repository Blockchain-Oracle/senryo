# Widgets and Live Activities architecture — 8 October 2026

Architecture only; no implementation, native build, provisioning, device acceptance or distribution performed. The approved revamp and remaining-audit report retain both capabilities. Missing code is work to implement, not an external blocker.

## Decision

Implement a shared account-scoped projection/coordinator, iOS widgets with the current official `expo-widgets` package, and an Android native AppWidget adapter. For iOS Live Activities, the package is a viable minimal local-update implementation, but its documented `start(props,url)` / `update(props)` interface does not expose ActivityKit `staleDate`. Do not pretend a JS timer solves suspension. Either deliver explicitly timestamped, masked, local-update tracking with this limitation documented, or implement the small owned ActivityKit bridge/extension below for proper native staleness. **Recommend the owned ActivityKit bridge for the complete financial tracking contract; use Expo widgets for ordinary iOS widgets.** This is source work feasible now. APNs is only required for updates while the app cannot run, not local ActivityKit start/update/end.

## Observed owners and compatibility

- `apps/mobile/package.json`: Expo `~57.0.26`, React Native `0.86.3`; installed Expo resolves to `57.0.26` from the mobile workspace. Installed `expo/bundledNativeModules.json` maps `expo-widgets` to `~57.0.22` and `@expo/ui` to `~57.0.21`. Neither widget dependency is currently declared. Use the installed SDK mapping and lockfile resolution, not an unqualified latest install.
- `apps/mobile/app.config.ts` is the native config owner: already sets `NSSupportsLiveActivities: true`, but this alone creates no extension or implementation. No widget plugin is registered. Preserve its existing APNs profile selection and providers.
- `src/lib/constants/app.ts`: iOS floor 18.0, Android floor 28, bundle/package `xyz.senryo.app`, app scheme `senryo`, runtime policy `appVersion`, version `0.3.0`. Any added native module/target needs a new compatible binary/runtime version; an OTA to the old binary cannot install it.
- `apps/mobile/eas.json`: development, simulator, preview and production profiles already exist. No credentials or live portal state were inspected.
- `src/app/_layout.tsx`: mount proposed `PlatformSurfacesHost` beneath account, query and market providers.
- Real read owners: `packages/query/src/account.ts` (`useAccountRisk`, `usePositions`), `useMarket`, query environment and `features/positions/usePosition.ts`. Extract/read only the position projection; do not mount the trading hook merely to feed a widget, since it also owns signing/close traces and a two-second head poll.
- Privacy/scope boundaries: `src/lib/hide-balances.ts`, `src/lib/account/provider.tsx` (`lock`, `signOut`, account adoption), `src/lib/account/delete-data.ts`, `src/lib/network.ts` (`setActiveNetwork`), development workspace config/account, `src/lib/deep-link.ts` and `incoming-link.ts`. Current position paths are not in `incomingNeedsAccount`; a new widget dispatcher must explicitly enforce account checks.

## Current official platform evidence

The versioned [Expo SDK 57 widget documentation](https://docs.expo.dev/versions/v57.0.0/sdk/widgets/) supports iOS, development builds, a generated extension and shared App Group. Its widget components run in an isolated synchronous runtime; data must arrive as props. APIs include `createWidget`, `updateSnapshot`, `updateTimeline`, `reload`, and Live Activity `getInstances`, `start`, `update`, `end`. Home widget definitions belong in plugin `widgets[]`; Live Activities do not (the usage warning contradicts an older generated API sentence, so follow the explicit warning and verify installed source). Config uses nested `ios.supportedFamilies`. Android support is not documented for this SDK. Its current page recommends patch `~57.0.23`, slightly ahead of installed SDK mapping. The documented Live Activity update signature has no stale-date option. Do not infer API support from an unrelated upcoming SDK.

[Apple ActivityKit](https://developer.apple.com/documentation/activitykit/displaying-live-data-with-live-activities?changes=_6) separates local ActivityKit and remote push updates. An activity can run eight hours and remain on the Lock Screen up to four more; this is an upper bound, not a product refresh promise. Use native activity state and staleness, with earlier product expiry. [Apple widget privacy](https://developer.apple.com/documentation/WidgetKit/Creating-a-Widget-Extension?changes=_9) documents `privacySensitive` and complete Data Protection for hiding widgets when locked. OS redaction preferences alone do not establish Senryo's default privacy policy.

[Android AppWidget](https://developer.android.com/develop/ui/views/appwidgets) uses a provider, metadata and rendered widget resources. [Android update guidance](https://developer.android.com/develop/ui/views/appwidgets/advanced?authuser=371&hl=en) permits immediate app-driven updates and discourages expensive periodic work; `updatePeriodMillis` has a 30-minute minimum, or zero disables it. These are widgets, not ActivityKit Live Activities. Do not advertise Dynamic Island on Android or repurpose a permanent foreground service as a trading widget.

## Proposed source ownership and interfaces

All following new paths are proposals, not claims they exist.

`apps/mobile/src/features/platform-surfaces/`:

- `contract.ts`: validated versioned discriminated payloads and capability/result types.
- `projection.ts`: pure conversion from real query readings to safe snapshots; no network, signing or formatting guesses.
- `preferences.ts`: per-scope opt-in, selected position and privacy setting. Defaults: disabled, amounts hidden. Local hide-balances always overrides an explicit surface reveal.
- `coordinator.ts`: serialized lifecycle commands, native reconciliation, generation fencing, coalesced update scheduling.
- `PlatformSurfacesHost.tsx`: subscribe to existing account/network/query/foreground owners once; never create duplicate price sockets.
- `adapter.ios.ts`, `adapter.android.ts`, `adapter.ts`: platform exports prevent importing an iOS-only native module on Android/web. Capability reads distinguish unavailable binary, user-disabled and runtime errors.
- `SenryoAccountWidget.ios.tsx`: isolated Expo UI layout, small/medium and optional accessory rectangular variants. No account context or hooks inside the widget function.
- `PlatformSurfacesScreen.tsx`, route `src/app/account/widgets.tsx`, Settings row: genuine enable/disable, privacy preview, current source time, refresh, stop tracking, and OS add-widget instructions. Starting tracking belongs additionally on the held-position detail.

Proposed shared boundary:

```ts
type SurfaceScope = {
  accountKey: string; chainId: number;
  environment: 'release' | 'development'; generation: number;
};
type SurfaceSnapshot = {
  version: 1; scopeToken: string; sequence: number;
  modeLabel: 'Practice' | 'Mainnet' | 'Development Practice';
  state: 'hidden' | 'available' | 'stale' | 'unavailable' | 'ended';
  observedAt: number | null; expiresAt: number;
  title: string; amountText?: string; positionText?: string;
  routeToken: string;
};
// Native boundary; Promise rejection must reach retry/error UI.
interface SurfaceAdapter {
  capabilities(): Promise<SurfaceCapabilities>;
  replaceScope(scopeToken: string, generation: number): Promise<void>;
  publishWidget(snapshot: SurfaceSnapshot): Promise<void>;
  startTracking(snapshot: SurfaceSnapshot): Promise<string>;
  updateTracking(id: string, snapshot: SurfaceSnapshot): Promise<void>;
  stopTracking(id: string, reason: string): Promise<void>;
  clearAll(generation: number): Promise<void>;
  reconcile(): Promise<NativeSurfaceState>;
}
```

`SurfaceCapabilities` and `NativeSurfaceState` need explicit per-platform support, active IDs, generation and failures; no dummy successful implementation. Native acceptance requires sequence/generation checks too, not just React cleanup. Keep the address-to-opaque-token mapping inside the app; do not put addresses or authenticated URLs in widget links.

Permitted projection: the selected account's actually readable balance/equity or held pair position with instrument, direction, verified valuation and original source timestamp. Preserve Practice/Mainnet/development separation, decimal units, partial/error readings, conservative P&L semantics, and genuine zero versus unknown. No card PAN/CVV, credentials, recovery info, session material, execution buttons, fabricated predictions or inferred closed positions from failed queries. Prediction tracking requires its own implemented authenticated position/settlement owner before enabling it. Public profile-performance permission does not authorize a private home-screen widget or vice versa.

## Native configuration and module plan

1. Add SDK-compatible `expo-widgets` / `@expo/ui` and an `expo-widgets` entry in **app.config.ts**, with extension bundle `xyz.senryo.app.widgets`, App Group `group.xyz.senryo.app.widgets`, widget name `SenryoAccountWidget`, and small/medium families. Keep `enablePushNotifications: false` for the widget package if the owned ActivityKit target handles activities. Do not accidentally generate two activity owners.
2. Create local Expo module `apps/mobile/modules/senryo-surfaces/` using the [supported local-module pattern](https://docs.expo.dev/modules/get-started/): `expo-module.config.json`, `src/index.ts`, `ios/SenryoSurfacesModule.swift`, Android Kotlin module/provider/resources. Keep source under this stable directory; generated `ios/` and `android/` projects are outputs.
3. Add `apps/mobile/plugins/with-senryo-surfaces.ts`, invoked only from app.config.ts. It wires a separate owned `SenryoActivities` WidgetKit extension (`xyz.senryo.app.activities`) with shared `SenryoPositionAttributes.swift` and `SenryoPositionActivity.swift`. The Expo module calls `Activity<SenryoPositionAttributes>.request`, `update(ActivityContent(..., staleDate: ...))`, `end(..., dismissalPolicy: .immediate)`, checks authorization and reconciles `Activity.activities`. Keep encoded attributes/content bounded, with no persistent address or financial secrets. Set fixed expiry, source timestamp and `context.isStale` rendering. Activity layout uses UGLYCASH colors/owned seal and accessible contrast.
4. The same custom plugin adds Android `SenryoAccountWidgetProvider`, XML layout/metadata and explicit immutable app-opening PendingIntents. Use RemoteViews for this minimal snapshot (no Compose dependency necessary). Store only the redacted projection in app-private storage; enumerate/update all installed widget IDs after publish/clear. Configure `updatePeriodMillis=0` initially, use native action refresh to open authenticated app, and clean per-instance state on deletion. A later bounded worker may refresh authorized data; it must not store a signer or keep a session alive.
5. Declare app/extension App Group entitlements and register both extension targets with EAS credentials metadata where plugin generation requires it. [EAS extension guidance](https://docs.expo.dev/build-reference/app-extensions/) describes separate extension credentials and `extra.eas.build.experimental.ios.appExtensions` declarations. Inspect the installed Expo plugin's generated declarations before merging custom metadata; preserve existing `extra.eas.projectId` and avoid duplicate target entries. Use existing Apple team constant. Provision extension bundle IDs/App Group membership for each signed profile.

A fully owned WidgetKit account widget in the same custom extension is the fallback if generated Expo widgets conflict with privacy entitlements or duplicate ActivityConfiguration registration. This is a bounded native replacement, not a reason to drop widgets; verify the generated target before choosing it.

## Lifecycle, privacy and refresh contract

Default payloads contain **no amounts or identifiable position details at all**, including accessibility text and previews. Home-screen widgets are observable outside the app's authentication boundary. A user may explicitly permit external amounts, but the first implementation should retain hidden financial data on all lock-screen/Live Activity presentations. Treat that as a clear product preference, not a side effect of iOS notification settings. The native widget extension can additionally enforce complete Data Protection; verify App Group file protection. Do not assume React AppState fires before device locking or that Android launcher screenshots can be recalled. Android defaults remain masked regardless of launcher/lock-screen support.

Start: user selects a real held position and explicitly starts tracking; check scope, fresh available data, foreground state, authorization and native capability. No automatic restart on foreground, logout reversal or OS dismissal. Store native ID plus scope token; deduplicate starts and reconcile after process death.

Refresh: explicit in-app refresh invalidates actual account/market reads, waits for their outcome, then projects with original timestamps. Never replace observedAt with the clock merely because publish succeeded. Coalesce foreground changes (initial proposed maximum one widget publication/minute, one Activity update/15 seconds); immediate privacy/terminal transitions bypass throttling. These intervals are implementation proposals, not OS delivery guarantees. Show last checked time rather than promising a live financial quote.

Staleness: select TTL from underlying source freshness contracts, using the earliest constituent expiry. Unknown time means unavailable. Schedule an iOS widget stale timeline entry, use ActivityKit native staleDate, and always display source time on Android because background scheduling can be deferred. Expiry strips monetary detail. No close/settlement claim without authoritative terminal data. Local background-only activity cannot continuously refresh: stale presentation is truthful; remote push is a separate completion slice.

Stop/end: explicit stop, opt-out, account lock/privacy concealment, account removal, environment/network switch and confirmed position close end tracking immediately and replace all widget timelines with masked/empty content. End on data loss as a protective fallback rather than preserving exposed values. Cancel subscriptions/timers and remove mapping. During logout/delete/mode switch, first invalidate the shared generation and clear native surfaces, then finish scope replacement; serialize this boundary so an old async query/native publish cannot repopulate it. Native clear failures are reported and retried/reconciled; do not silently claim successful purge. Normal session expiry follows the same lock policy. On cold start reconcile and clear unknown/unowned native activity IDs.

Deep links: `senryo://platform-surface?token=<opaque>&chainId=<id>` dispatches through a proposed narrow route. Validate token/schema/expiry and account ownership after unlock, then reuse existing mode-confirmation routing to the position or Home. Never silently switch modes or open a market-ID collision in another account. An expired/unowned token goes to a neutral signed-in Home with an explanation. No trade is authorized by tapping a widget.

Remote updates: implement later in `services/api/src/routes/platform-surfaces.ts`, a persistent scoped activity registration/revocation store, and an APNs sender worker. Register only per-activity tokens after explicit local start, authenticate owner, rotate/revoke, expire registrations, reject old generation/sequence, and use actual read-only position data. No push-to-start by default. APNs token transport/storage must remain confidential. Existing Expo notification tokens are not ActivityKit activity tokens. Logout offline requires local clear plus durable server revocation retry; keep remote payloads masked so delayed pushes cannot leak financial detail.

## Feasible now versus external acceptance

**Source work now:** all adapters, projections, preferences, controls, routing, plugins, native resources, stale/end handling, persistent remote registration contract and worker implementation. Pure tests should cover scope changes during pending publish, source timestamps, hidden payload absence, stale expiry, ended positions, malformed links and retry/reconciliation. Local prebuild/native compile in a disposable output location can validate generated targets without resetting the shared checkout.

**External/physical gates:** Apple portal App Group and extension provisioning; newly signed binaries with matching entitlements; user-controlled Live Activity authorization; physical locked/unlocked/Always-On/Dynamic Island behavior and Android launcher/process-death/reboot acceptance. APNs credentials/environment and actual device delivery are required only for the remote-update slice. Their absence does not block local source or simulator implementation. No special financial-widget entitlement is evidenced; ordinary ActivityKit support, signing, App Groups and any enabled APNs capability are the relevant checks. Native build availability must be checked rather than presumed blocked.

Do not mark full platform scope complete with a settings toggle, Info.plist flag, JS export, simulated preview or a source-only test. Record local update acceptance and remote/device acceptance separately, while retaining both in the approved roadmap.
