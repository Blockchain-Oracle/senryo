# S5 — Mobile foundation: Expo 57 dev build, ported kit, D2 shell

**Goal:** `apps/mobile` (`@senryo/mobile`) builds as an Expo SDK 57 **dev build** app with the Agari kit ported and
re-tokenized to D2, NativeTabs navigation, and shell screens that render honest states from clearly labelled sample data.
Real data arrives in S6–S8.
- **Plan:** `00-plan.md` §1 (D-004, D-012, D-028/D-037, D-033), §2.4 (Mobile, iOS feel), §2.5 (screens, S5 flows F03 · F62 · F60 shell, feedback map), §4 (S5 row).
- **Open first:** `specs/client.md` (binding), `context/09-product/ux-product-feel.md` §A.2 + §B, `context/08-integrations/platforms-and-stores.md` §1, `packages/tokens/src/*`, Agari `mobile/src` at SHA `661a24ee`.
- **Docs read (Context7):** Expo `/websites/expo_dev` (monorepos, NativeTabs, glass-effect), victory-native XL `/formidablelabs/victory-native-xl` (Candlestick, Area/Line, useFont).
**D-number range:** D-070…D-079.

## Steps
- [x] S5.1 Stage file; scaffold from `create-expo-app --template default@sdk-57` (template demo code dropped); `@senryo/mobile` package with SDK-pinned deps (`expo install` versions), `expo-dev-client`, expo-router typedRoutes, React Compiler (limited to `apps/mobile/src`), Hermes; `app.config.ts` (iOS 18.0, Android minSdk 28, `arm64-v8a`, `xyz.senryo.app`, scheme `senryo`, secure-store `faceIDPermission`, associated domains from `src/lib/constants/app.ts`); metro singleton pinning; `eas.json` profiles; `.21st/design.json`
- [x] S5.2 Ported kit: `theme/` from `@senryo/tokens`; `feedback/{haptics,sound,fire}.ts` (8 events); states kit + `Reading<T>`; `Sheet` (BottomDrawer); `notify()` over sonner-native; `usePullRefresh`; `polyfills.ts`; root `_layout.tsx` headless hosts
- [x] S5.3 Navigation + shell: NativeTabs (Portfolio · Markets · Trade · Card · Fund, SF Symbols, Liquid Glass on iOS 26, solid on 18–25), D2 top strip, §2.5 routes + sheets, sample data in `src/lib/sample.ts` behind a PREVIEW DATA badge, loading/empty/error wired through the states kit; offline banner (F62); account/settings shell (F60)
- [x] S5.4 Charts: victory-native XL equity area (Portfolio) and candles (Trade)
- [x] S5.5 Gate: `expo export -p ios -p android`, `expo-doctor`, fast gate; decisions + references recorded
- [ ] **(user)** `eas init` + `eas credentials` (Android keystore SHA-256 → S6 assetlinks), dev build on the user's iPhone + Android — needs the user's Expo account
- [ ] **[OK?]** Android developer registration (free limited tier, D-017)

## Gate
`pnpm --filter @senryo/mobile exec expo export -p ios -p android` builds both bundles; `expo-doctor` clean (or every
remaining check explained); root `pnpm lint && pnpm invariants && pnpm typecheck` green. Device gate (dev build on
iPhone + Android) is the user's step above.

## Findings
- Expo 57 pins React 19.2.3; the workspace catalog pins 19.2.8 for Next. React Native refuses a React that differs from its renderer, so mobile takes React from the named catalog `mobile` (D-070).
- Tokens import with `.ts` extensions; the mobile tsconfig sets `allowImportingTsExtensions` (Metro resolves them natively).
- `@shopify/react-native-skia` has a postinstall that copies its prebuilt xcframeworks/.so (from `react-native-skia-{apple,android}`, ~230 MB each) into `libs/`; allowed in `allowBuilds` after reading the script (no network). pnpm 11 hangs silently while `ERR_PNPM_IGNORED_BUILDS` is pending — the first installs looked like download stalls.
- pnpm 11's release-age policy added `minimumReleaseAgeExclude` entries for fresh Expo patch releases (`expo@57.0.26`, `expo-router@57.0.24`, …); kept (they are the SDK 57 pins).
- `expo-doctor` needed `expo-asset` (peer of expo-audio), `@types/react ~19.2.4` (catalog `mobile`) and a dedupe of expo-constants; now 21/21.
- `pnpm peers check` still lists `react-dom` for Radix/vaul — web-only deps of expo-router; there is no Expo web target (D-011).
- Font imports use per-weight subpaths; the package index bundled every weight and italic (≈3 MB saved).
- Gate evidence (2026-09-30): `expo export -p ios -p android` → iOS `index-*.hbc` 6.0 MB, Android 6.2 MB (Hermes bytecode); `expo config --type introspect` shows `NSFaceIDUsageDescription`, `associatedDomains` webcredentials/applinks `senryo.xyz`, Android `minSdkVersion 28`, `reactNativeArchitectures arm64-v8a`; `pnpm lint`, `pnpm invariants` (0 errors), `pnpm typecheck` green.

## What was ported vs rewritten (Agari `661a24ee`)
- **Ported (adapted):** `Sheet` ← BottomDrawer (same physics/gestures, D2 corners, `snap` haptic on open); states kit (Skeleton/LoadingState/EmptyState/ErrorState/ReadingView → the plan's 4-state `Reading<T>`); `usePullRefresh`; theme provider (MMKV + system); haptics → 8 semantic events; sound pool pattern; polyfills (quick-crypto, AbortSignal, bigint toJSON); metro singleton pinning; root headless hosts; `eas.json` profiles; no-flash first-run redirect.
- **Rewritten:** palette/type (from `@senryo/tokens`, no Agari colours), Button/Screen/Segmented/Panel (D2), toast (sonner-native behind `notify()`), navigation (NativeTabs instead of the custom dock), every screen.
- **Dropped:** Solana/wallet-adapter, web-reuse shims (localStorage, relative fetch, window events), Sora/Noto fonts, games/audio beds.

## Handoff
- **Routes:** tabs `portfolio · markets · trade (+[market]) · card (+wallet, allowance, auth/[id]) · fund (+qr/[family], wallet, swap, deposit/[id])`; root `positions/[id] · orders · activity · alerts · withdraw (+send, cash-out) · lp · account (+security, recovery, preferences, notifications, help, delete-data, mode) · status · watch/[address] · welcome`; sheets `(sheets)/{add-money, step-up, risk-explainer, receipt, session, card-reveal, account-required}`. Paths in `src/lib/constants/routes.ts`.
- **Live now:** theme switch, sounds/haptics toggles (Preferences), offline banner + TanStack `onlineManager` (F62), guest browsing (F03 → `account-required` sheet on any action), settings shell (F60).
- **Swap-in points:** every screen reads `useSample()` → replace with the real query hook and delete the matching `PreviewBadge`; `Reading<T>`/money move to `packages/core` (S3); `RP_ID` moves to `packages/config`; sound files go in `src/feedback/sound.ts` `SOURCES`; final icon/splash replace `assets/images/*` (S1).
- **Not done here:** market heatmap, keypad/hold-to-confirm/gauge (S8), number-flow tickers, QR code (S9), BottomAccessory only renders on iOS 26 (system API).
- **User steps:** `eas init` (writes `extra.eas.projectId`/`owner` — add to `app.config.ts`), `eas credentials` for the Android keystore SHA-256 (S6 assetlinks), then `eas build -p ios --profile development` / `-p android --profile development` on devices. Nothing here was run against EAS.
- Next: S6 (auth + rpId) plugs `packages/account` into the app (quick-crypto already installed via `src/polyfills.ts`).
