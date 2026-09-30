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
- [ ] S5.2 Ported kit: `theme/` from `@senryo/tokens`; `feedback/{haptics,sound,fire}.ts` (8 events); states kit + `Reading<T>`; `Sheet` (BottomDrawer); `notify()` over sonner-native; `usePullRefresh`; `polyfills.ts`; root `_layout.tsx` headless hosts
- [ ] S5.3 Navigation + shell: NativeTabs (Portfolio · Markets · Trade · Card · Fund, SF Symbols, Liquid Glass on iOS 26, solid on 18–25), D2 top strip, §2.5 routes + sheets, sample data in `src/lib/sample.ts` behind a PREVIEW DATA badge, loading/empty/error wired through the states kit; offline banner (F62); account/settings shell (F60)
- [ ] S5.4 Charts: victory-native XL equity area (Portfolio) and candles (Trade)
- [ ] S5.5 Gate: `expo export -p ios -p android`, `expo-doctor`, fast gate; decisions + references recorded
- [ ] **(user)** `eas init` + `eas credentials` (Android keystore SHA-256 → S6 assetlinks), dev build on the user's iPhone + Android — needs the user's Expo account
- [ ] **[OK?]** Android developer registration (free limited tier, D-017)

## Gate
`pnpm --filter @senryo/mobile exec expo export -p ios -p android` builds both bundles; `expo-doctor` clean (or every
remaining check explained); root `pnpm lint && pnpm invariants && pnpm typecheck` green. Device gate (dev build on
iPhone + Android) is the user's step above.

## Findings
- Expo 57 pins React 19.2.3; the workspace catalog pins 19.2.8 for Next. React Native refuses a React that differs from its renderer, so mobile takes React from the named catalog `mobile` (D-070).
- Tokens import with `.ts` extensions; the mobile tsconfig sets `allowImportingTsExtensions` (Metro resolves them natively).

## Handoff
See the S5.5 commit. Next: S6 (auth + rpId) plugs `packages/account` into `src/polyfills.ts` (quick-crypto already installed) and replaces `src/lib/sample.ts` reads screen by screen.
