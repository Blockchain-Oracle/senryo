# Product feel: making the trading app feel like a product, not a demo

**Researched 29 Sep 2026.** Scope: Expo SDK 57 app (iOS, Android, web) for trading gold, stocks, FX and crypto from one balance. Sign-in and confirmation use Face ID passkeys (Mera), funding comes from any chain by QR (Aurora), and spending uses a card.
The owner's bar: premium iOS feel, top-notch motion, haptics and sound, native gestures. Mediocre is not accepted.

Sources:
- **A.** The owner's shipped app **Agari** (上がり). Source: `/Users/abu/dev/hackathon/agari-wt/mobile-takeover` (branch `codex/mobile-takeover`, last commit 2026-09-27, the newest and most complete worktree). APKs: `/Users/abu/dev/hackathon/agari-release`.
- **B.** Library docs via Context7 and the vendor pages (Expo, Reanimated, gorhom, Keyboard Controller), Apple HIG (scraped copies in the scratchpad `ux/hig-*.md`), and npm (versions checked 29 Sep 2026).
- **C.** Competitor front ends (Robinhood, Cash App, Revolut, Phantom, Rainbow, Coinbase/Base, Hyperliquid clients), with source URLs.

Legend: **(unverified)** = inference or not confirmed in a primary source. Related: [../08-integrations/mera.md](../08-integrations/mera.md), [../08-integrations/platforms-and-stores.md](../08-integrations/platforms-and-stores.md), [../08-integrations/aurora-intents.md](../08-integrations/aurora-intents.md).

---

## 0. The ten decisions this file drives

1. **Agari already solved the product scaffolding.** It has a single haptics module, a states kit, a one-at-a-time toast, one bottom-sheet primitive, pull-to-refresh everywhere, onboarding with sound, a faucet whose button label follows the stage, a first-credit celebration, push, a Live Activity and a widget. Port those patterns (A.2).
2. **Agari never built rolling numbers, price flashes, biometrics, universal links, an offline banner or Dynamic Type caps.** Those are the new work: NumberFlow, a Reanimated flash, Mera Face ID, AASA/assetlinks `applinks`, NetInfo, `maxFontSizeMultiplier`.
3. **Use native iOS chrome for this app:** NativeTabs + Liquid Glass on navigation only (HIG) and SF Symbols. Agari chose a custom dock for brand reasons; this brief asks for "iOS feel".
4. **Hold-to-confirm (500 ms, Rainbow) plus Face ID only when the session is locked.** The ticket survives a lock.
5. **A fixed haptic vocabulary** (`tick`/`press`/`snap`/`confirm`/`filled`/`warn`/`fail`/`liquidation`), mapped to Android haptics and routed through one module. Pulsar for UI-thread scrub ticks.
6. **Sound:** 4 to 5 short sounds (fill, deposit, send, unlock), `mixWithOthers`, respect the silent switch, and a Settings toggle. Trading peers treat sound as rare or opt-in. Never confetti.
7. **The zero-balance first run is our edge:** one-tap "claim starter funds" landing in about 1 s on Monad, then QR deposit (never the QR alone), wallet, card. Hyperliquid's faucet can't do this.
8. **Show liquidation distance live on the ticket and on every position,** with a 3-card risk explainer before the first leveraged trade.
9. **Live Activity only for bounded events** (resting order, deposit in flight, watched position ≤ 8 h), with P&L as %. None of the benchmark apps ships one for positions.
10. **Stale ≠ failed, never a fabricated $0.00,** reassuring error copy and crash-safe write recovery. Trust details matter more than animation in a money app.

---

## A. What Agari already solved (reuse, don't rediscover)

### A.1 Agari's documented UX decisions (plan and status docs)

| Decision | Where | Lesson for us |
|---|---|---|
| Story-first plan: "Ada is on the bus … slides her thumb along the confirm bar, and the phone buzzes softly. It's done: no wallet pop-up … Her Lock Screen shows 'TSLA ▲ 2:14 left' … push: 'TSLA closed Up. You won $16.12. Tap to collect.'" | `~/.claude/plans/agari-mobile-s26.md` ("The idea in one story") | Write our own one-paragraph story first. Every screen must serve it. |
| First open: splash, then **straight to Markets**. Browse with **no wallet**. "Connect" lives in the header. | same plan, "UX walkthrough" §1 | Don't gate browsing behind sign-up. Ask for Face ID at the first action that needs it. |
| Ticket is a **bottom sheet**: a spend-first keypad, `$5/$10/$25/Max` chips, live "Payout if right $16.12 (+61%)", **slide to confirm with haptic ticks**, pull up for limit orders and the book | plan §4 | Our trade ticket follows the same pattern: amount first, live outcome line, a deliberate confirm gesture. |
| Receipt then verdict: "the ticket turns into the cream receipt; at settlement the stamp lands with a **heavy haptic**; share renders a card image to the iOS share sheet" | plan §5 | A fill is a *moment*: morph ticket → receipt, one haptic, one sound, a share card. |
| Phone-only extras: push for fills/wins/losses/payouts/price alerts, **Live Activity** (Lock Screen + Dynamic Island), Android ongoing notification as its twin, haptics on every call, home-screen widget, deep links `useagari.xyz/markets/<id>` | plan §10 | Same extras list for us; see B.9 to B.11. |
| **Practice wallet**: "Try with a practice wallet" creates a devnet-only key in the Keychain, and **the faucet funds it**. It lets Apple's reviewers use every screen. | plan "How your wallet works"; D-128 in `agari-wt/s26/docs/plan/decisions.md:1420` | Our "claim starter funds" path. It is also the App Review path. |
| Tap trading: approve a spending grant once, then a **session key** in the Keychain (`expo-secure-store`, `WHEN_UNLOCKED_THIS_DEVICE_ONLY`) signs taps. "One Phantom trip to start, then taps." | D-128; `mobile/src/wallet/session-key-store.ts` | Maps directly to the Mera trading session (mera.md §5.3): one Face ID, then prompt-free trades within a cap. |
| **Reversal (owner, 25 Sep):** the plan said NativeTabs + Liquid Glass. The owner then chose "web's phone layout ported literally", with "web's floating pill dock", and **"No iOS glass header or system tab bar"**. | `mobile/TAKEOVER_STATUS.md` ("web's phone layout, mobile UX") | Brand identity beat stock iOS chrome for Agari. Decide early which we want (see B.5). Don't build both. |
| One shared `components/drawer/BottomDrawer.tsx` for ticket, Add funds, connect and account. "The placed call's receipt shows in the drawer." | TAKEOVER_STATUS.md | One sheet primitive, used everywhere, so every sheet moves the same way. |
| Invariants that caught polish bugs: gradient stop alpha (`mobile-svg-stop`), SVG never repaints on prop change (`mobile-svg-motion`), iOS clips `lineHeight < fontSize` (`mobile-tight-leading`), `mobile-design-literals` | TAKEOVER_STATUS.md; stage-26 plan 26.1 | Encode visual bugs as lint rules/invariants so they never come back. |
| Leaderboard says **"refreshing"** when data is only stale and **"retrying"** only when a read failed | TAKEOVER_STATUS.md; commit `c0794c62` | Stale ≠ failed. Never show an error for stale data. |
| "Unanswered reads show loading or unavailable states rather than **fabricated zeroes**." "Undeployed, paused, failed, and empty states must stay distinct." | TAKEOVER_STATUS.md, "Data and account boundaries" | A $0.00 balance while loading is a trust bug in a money app. |
| Pull to refresh on **every page**, "one accent spinner and one tick" (`usePullRefresh`) | commit `a7c14e94` | One refresh behaviour app-wide, with a haptic tick at the trigger point. |
| More is an **82 % side panel**, "the page still in view beside it" | commit `072934c6` | Keeps context; feels native. |
| Onboarding: brand intro (mark, AGARI, 上がり hanko + **chime**), four swipeable pages, ElevenLabs sounds `assets/sounds/onboard-*.mp3` | commit `04579d2b`; TAKEOVER_STATUS.md | A branded 5-second intro with sound earns "product" on first launch. |
| Remaining gates Agari itself named: haptic feel, silent switch, headset routing, interruption/resume, larger text, network errors all need a **physical device** | TAKEOVER_STATUS.md "Remaining gates" | Put these on our device test list from day one. |
| Review notes: "devnet, no real value, no fiat, no purchases"; store text avoids "bet/win money" | plan S26.8, "Risks" | Same framing for testnet funds in our store copy. |

### A.2 Agari's code patterns (from the source)

Paths: **`$M`** = `/Users/abu/dev/hackathon/agari-wt/mobile-takeover/mobile`, **`$W`** = `/Users/abu/dev/hackathon/agari-wt/mobile-takeover/web`. The repo root is `/Users/abu/dev/hackathon/agari-wt/mobile-takeover`.

**Headline gaps to fix in ours:**
- **No number ticker, count-up or price flash** anywhere.
- No biometrics, no universal links, no NetInfo/offline banner.
- No Dynamic Type caps.
- `expo-glass-effect`, `expo-symbols`, FlashList and `react-native-sse` are installed but never imported.
- The "UI morph loop" is a marketing film made outside the repo (HyperFrames), not app code.

#### Architecture
- `$M/src/polyfills.ts`, loaded first from `$M/index.ts`: MMKV-backed `localStorage`, a `fetch` that rewrites relative `/api` calls, `AbortSignal.timeout/any`, and `react-native-quick-crypto` `install()` for WebCrypto in Hermes.
- `$M/metro.config.js` swaps in `$M/src/web-shims/*` (toast, visibility→AppState, session-key provider). Web hooks and copy are reused unchanged.
- React Compiler is on, limited to `/mobile/src/` (`$M/babel.config.js`).
- The root layout `$M/src/app/_layout.tsx` mounts "headless hosts" once: `FundingHost`, `Toaster`, `LifecycleWatcher`, `AlertsHost`, `WriteRecovery` …
- **Invariants** (`scripts/invariants/rules.mjs`): `mobile-design-literals`, `mobile-tight-leading`, `mobile-svg-motion`, `mobile-svg-stop`, `mobile-no-web-handoff`.

#### Onboarding (`04579d2b`)
Files: `$M/src/app/index.tsx`, `$M/src/features/onboarding/{OnboardingScreen,BrandIntro,OnboardingVisuals,onboarding-copy,onboarding-sound}.ts(x)`
- **No-flash first-run gate:** a synchronous MMKV read inside the redirect, `<Redirect href={storage.getBoolean("agari.mobile.onboarded.v1") ? "/markets" : "/onboarding"} />`. `finish()` also sets web's tutorial key, so the tip never shows twice.
- **`BrandIntro`** (~2.1 s; tap to skip; **skipped under Reduce Motion**):
  - The mark enters with `withSpring(1,{damping:14,stiffness:140})` from scale 0.6.
  - "AGARI" letter-spacing goes 18→6 over 620 ms, ease-out cubic.
  - The hanko stamp lands from 2.4× with `withSpring(1,{damping:11,stiffness:320,mass:0.7})` at −8°.
  - At 900 ms: `playOnboarding("intro")` + `haptic.heavy()`, then a 320 ms fade.
- **Four pages** in a paging `Animated.FlatList`:
  - Parallax: the visual moves ±45 % width and scales 0.86↔1; the text moves ±18 %.
  - Title words stagger with `FadeInDown.delay(120+i*70).duration(420)`.
  - A 2 pt accent progress bar with an "N of 4" counter; each page turn plays a sound + `haptic.select()`.
  - Skip sits top-right. The last page offers "Connect a wallet" / "Look around first".
- **Page 1 shows a real live market card** (`useLiveWindow()`), falling back to a plate.
- **Page 4 removes fear up front:** "Start with test money… get test tUSDC in one signature. No real money moves."

#### Faucet and blocker removal (the "claim test funds" pattern)
- **Funds sheet:** `$M/src/app/funds.tsx` (a `BottomDrawer`).
  - Address with tap-to-copy and "copied ✓" for 1.5 s.
  - Balance cells for the fee coin and the trading coin.
  - **One pill "Get test funds" whose label follows the stage.** When done it becomes "Trade from wallet →" + "Get more test funds".
- **Hook:** `$W/src/features/markets/faucet/useFaucet.ts`.
  - **One free message signature** covers both the gas top-up (only if below threshold) and the mint.
  - Per-address `running` guard; stale results dropped.
  - Stage labels (`$W/src/features/funding/gas-client.ts` `FUNDING_STAGE_LABEL`): "Checking balances…" → "Verify wallet — no fee" → "Adding SOL for fees…" → "Adding test tUSDC…".
- **Server:** `$W/src/app/api/faucet/{challenge/,}route.ts`: a challenge, then claim; geofence check first; per-IP hash; top-up to 0.02 SOL at most once per 24 h.
- **First-credit celebration:** `$M/src/components/funding/CreditWelcome.tsx`.
  - Only on an address's **first** credit.
  - `ZoomIn.delay(120).springify().damping(12).stiffness(240)` + `haptic.success()`, "On the house…", "Let's go →", and it closes itself after 8 s.
- **Funds open from anywhere:**
  - `openFunds()` emits `OPEN_FUNDS_EVENT` via `DeviceEventEmitter`, and `FundingHost` handles it.
  - `ErrorState` shows "Get test funds" for `out-of-gas` (`$M/src/components/kit/states.tsx`).
  - The ticket's `AccountGate.tsx` says "Top up to place this".
  - The header balance pill reads "Balance X. Tap to add money." (`HeaderAccount.tsx`).
- **Ordered blockers:** `$W/src/features/markets/faucet/faucet-blocker.ts` `deriveFaucetBlocker` (region → disconnected → wrong-chain → connecting → placing → out-of-gas). The copy is in `packages/core/src/copy/blockers.ts`. The CTA always names the **first fixable** problem.
- **Gas sponsor:** `$M/src/features/session-key/sponsor.ts`.
  - `useSponsorStatus` is cached 60 s and degrades to "unreachable" without throwing.
  - A per-install `deviceId()` drives the rate limit.
  - The last refusal is kept, so the UI can say why a fee was self-paid.

#### Keys and sessions (`$M/src/wallet`)
- Every secret goes to SecureStore with `WHEN_UNLOCKED_THIS_DEVICE_ONLY`.
- The session-key seed is zeroed after import (`session-key-store.ts`). It returns `null`, not a throw, when the Keychain is unavailable.
- Sends queue through a promise chain, so one key never has two writes in flight (`useKeySession`).
- Copy: "The key can never withdraw; only your wallet can."
- Wallet round trip (`link-port.ts`):
  - A 1.5 s AppState grace, then "The wallet did not return to Agari…"; a 45 s timeout.
  - Cancel says "Cancelled. Nothing was connected."
  - `$M/src/app/+native-intent.tsx` swallows wallet replies so they never navigate.
- The connect sheet remembers the most recent wallet. `haptic.success()` / `haptic.error()`, then a RETRY / INSTALL step (`WalletNotInstalledError(storeUrl)`).

#### States (`$M/src/components/kit/states.tsx`)
- **`Skeleton`:** opacity breathes 0.55↔1 over 900 ms and is static under Reduce Motion. Shapes: `line|row|plate|chart|list`, with `accessibilityRole="progressbar"`. Rule: *"a skeleton only where nothing was ever known, never an invented number."*
- **`EmptyState({why, detail, action})`:** always says why and names the next action.
- **`ErrorState({diagnosis, retry})`:**
  - Human copy from `packages/core/src/copy/diagnosis.ts`, e.g. rpc-down: *"We're rotating to the backup RPC. Last-good values stay on screen."*
  - A collapsible "▸ Technical details"; no Retry for `not-deployed`.
- **`ReadingView`:** a failed refresh keeps the value with the caption *"Showing the last good read; the latest refresh failed."* Refreshing vs retrying (`c0794c62`) is shown with an "Updated HH:MM" stamp in an `accessibilityLiveRegion="polite"`.
- **Error boundary** (`packages/core/src/copy/strings.ts` `ERROR_BOUNDARY`): *"A quiet moment on the floor… Your funds and positions are safe on-chain. This is only the screen."*
- **Crash-safe writes:** `$M/src/features/recovery/WriteRecovery.tsx` reconciles journaled writes against the chain once per session and toasts each outcome (landed, absent, reverted, expired). It never re-sends.
- **Background:** AppState → "document hidden" stops polls and streams (`$M/src/web-shims/visibility.ts`). There is no NetInfo.

#### Toasts (`$M/src/components/toast/{store.ts,Toaster.tsx}`; `3491006c`, `9a7bcdb7`)
- A `useSyncExternalStore` store; **one toast at a time**, 5 s.
- **Only two tones**, `neutral` and `warning`: *"no success/error toasts — neutral for records, warning for degraded truth"* (`$W/src/lib/toast.ts`).
- Look: bottom, just above the dock; a `BlurView intensity 40` plate.
- Motion: in with `withSpring(0,{damping:22,stiffness:300})`. Pan to dismiss: right past 60 pt or v > 600, down past 30 pt or v > 500.
- iOS: rendered in `FullWindowOverlay`, **mounted only while a toast exists** (an always-mounted overlay hides the app from VoiceOver).
- `LifecycleWatcher.tsx` raises toasts for fills, wins, losses and payouts new since mount, deduped against the push cursor.

#### Haptics (`$M/src/components/kit/haptics.ts`)
A single `haptic` object with five words; Android uses `performAndroidHapticsAsync`:

| Word | iOS | Android | Used for (call sites) |
|---|---|---|---|
| `select` | `selectionAsync()` | `Segment_Tick` | tabs, chips, sliders, page turns, pull-to-refresh (50) |
| `tap` | `impactAsync(Light)` | `Virtual_Key` | every kit `Button` (36) |
| `success` | `notificationAsync(Success)` | `Confirm` | connect, funded, share, claim (16) |
| `error` | `notificationAsync(Error)` | `Reject` | failures, warning toasts (6) |
| `heavy` | `impactAsync(Heavy)` | `Long_Press` | brand stamp, drop bell (3) |

Games route sound + haptic per cue through `$M/src/games/feedback.ts` `fireFeedback(cue,{haptics})`, with a user haptics switch.

#### Sound (`$M/assets/sounds`, expo-audio)
- Files: `onboard-{intro,page,done}.mp3`, `click`, `modal-open/close`, `swipe-up/down`, `card-win/loss`, `match-found`, `duel-win/lose`, `bed.wav`, and 26 arcade WAVs.
- Onboarding (`onboarding-sound.ts`):
  - ElevenLabs SFX levelled with ffmpeg; volumes `{intro:.55, page:.35, done:.6}`.
  - `preloadOnboardingSounds()` on mount and `player.remove()` on unmount; `seekTo(0)` + `play()`; errors swallowed.
  - **Follows the ringer switch.**
- Games (`$M/src/games/audio.ts`):
  - `setAudioModeAsync({playsInSilentMode:true, interruptionMode:"mixWithOthers"})`, so a podcast keeps playing.
  - **2 players per sample** so rapid cues overlap.
  - Persisted sfx (0.6) and music (0.3) sliders; the bed pauses on background.
- Gap: **no app-wide sound toggle** outside games.

#### Motion
- **Springs:**
  - Sheet `{damping:26, stiffness:260, mass:0.9, overshootClamping:true}`.
  - Toast `{damping:22, stiffness:300}`.
  - Swipe deck `{stiffness:260, damping:26}`; commits at 84 pt or 480 pt/s.
  - Receipt `ZoomIn.springify().damping(16)` (`$M/src/components/ticket/CallReceipt.tsx`).
- **One easing:** `Easing.bezier(0.22,1,0.36,1)` (`$M/src/features/desk/studio/kit-motion.ts`).
- **List stagger:** `FadeInDown.delay(Math.min(index,10)*35)`.
- **Reduced motion:** `useReducedMotion()` in about 20 files. The skeleton, live dot and marquee stand still; the drawer fades; the intro is skipped. `announceForAccessibility` announces results.
  - Gap: `LiveLine.tsx` `PulseRing` ignores it.
- **SVG gotcha (`be6629e7`, `c00ccb98`):** react-native-svg 15.15 on Fabric doesn't repaint on animated props. Agari's fix is `$M/src/components/ui/svg-clock.ts` (`useSvgClock`, `useSvgTween`, a 0.001 width nudge), plus `stopPaint()` for gradient alpha (`c99e2f83`). **For us: draw charts in Skia and avoid the problem.**

#### Numbers
- Tabular numerals everywhere (`fontVariant:["tabular-nums"]`, JetBrains Mono).
- `CountdownRing.tsx` turns the accent colour in the last 30 s.
- The Live Activity countdown is native (`Text timerInterval countsDown`).
- No rolling digits.

#### Pull to refresh (`a7c14e94`, `$M/src/components/kit/PullRefresh.tsx` `usePullRefresh`)
- Wired into `Screen` automatically.
- By default it invalidates **all** active queries.
- `haptic.select()` on pull; one accent spinner; stays until the refetch settles.

#### Links and share
- `scheme: "agari"`, typed routes.
- Notification paths are checked against a strict regex (`AlertsHost.isAppPath`).
- Widget and Live Activity rows link to `agari://markets/<id>`.
- **No universal links.**
- **Share card** (`$M/src/features/markets/share/ShareButton.tsx`): `captureRef(target,{format:"png",result:"tmpfile"})` → `Sharing.shareAsync(image,{mimeType:"image/png"})` → `haptic.success()`. It falls back to text `Share.share` and shows a "rendering" label meanwhile.
- `$M/src/lib/external.ts` opens a `WebBrowser` page sheet and **refuses the product's own domains**, so product pages always stay native.

#### Push, Live Activity, widget
- **Push** (`$M/src/features/alerts/{push.ts,usePushSettings.ts,copy.ts}`):
  - Android channel "activity", HIGH, vibration `[0,120,80,120]`; `getPermissionsAsync` before requesting.
  - Priming: *"Hear about your calls when Agari is closed…"*; denied: *"Notifications are off for Agari in Settings. Turn them on there, then try again."*
  - Three toggles: fills, results, payouts.
- **Foreground** (`AlertsHost.tsx`): fills land quietly in the list, while results and payouts show banners. `useLastNotificationResponse` handles the notification that cold-launched the app.
- **Live Activity** (`WindowActivity.tsx`, `useWindowActivity.ts`, `expo-widgets` `createLiveActivity`):
  - Follows the bet that closes soonest; adopts leftovers via `getInstances()`.
  - Updates at most every 4 s.
  - Ends at the verdict with a 15-minute linger.
  - The Dynamic Island always uses the dark palette.
- **Widget `NextWindow`** (S/M/L): `updateTimeline` writes one entry per lock time, rewritten only when its signature changes. Logos are pre-rendered at 3× with view-shot into the app-group folder, because the widget runtime can't draw SVG (`WidgetMarks.tsx`).
- **Build:** capabilities were set by hand with `EXPO_NO_CAPABILITY_SYNC=1`.

#### Navigation and theme
- **Tabs:** expo-router `Tabs` with `tabBar={() => null}` + a custom blurred floating pill dock (`$M/src/components/shell/BottomDock.tsx`, `BlurView 40` over a 72 % tint).
- **More:** an 82 % side panel (`NavDrawer.tsx`, 260 ms in / 220 ms out).
- **One `BottomDrawer`** (`$M/src/components/drawer/BottomDrawer.tsx`):
  - Content-sized.
  - Dismisses past 25 % of its height or 900 pt/s; upward drag is resisted (÷6).
  - Hands the gesture off to its inner ScrollView at scrollY 0.
  - `useAnimatedKeyboard`; Android back closes it; `useDrawerClose(after)` closes, then navigates.
- **Fonts:** Sora (display), Inter (body), JetBrains Mono (data). `useAppFonts` counts a font error as ready, so the splash never hangs.
- **Theme:** stored in MMKV, default dark, semantic tokens; a single root `<StatusBar>` (`6cf3f8e7`).
- **OTA:** expo-updates with `preview` / `production` channels.

**Agari's library list worth reusing:** expo-router, Reanimated 4.5, gesture-handler, react-native-screens (`FullWindowOverlay`), expo-blur, expo-haptics, expo-audio, expo-secure-store, react-native-mmkv, react-native-quick-crypto, expo-notifications, expo-widgets + `@expo/ui`, react-native-view-shot + expo-sharing, expo-clipboard, expo-splash-screen, TanStack Query.

---

## B. Best practice for a premium iOS-feel trading app (Expo SDK 57, 2026)

Versions below are the SDK 57 pins from [platforms-and-stores.md §1.1](../08-integrations/platforms-and-stores.md) or npm on 29 Sep 2026.

### B.1 Haptics: one module, a fixed vocabulary

API (`expo-haptics ~57.0.3`): `impactAsync(Light|Medium|Heavy|Rigid|Soft)`, `notificationAsync(Success|Warning|Error)`, `selectionAsync()`, and Android-only `performAndroidHapticsAsync(AndroidHaptics.*)` (`Confirm`, `Reject`, `Segment_Tick`, `Segment_Frequent_Tick`, `Clock_Tick`, `Toggle_On/Off`, `Long_Press`, `Gesture_Start/End`, …). Source: [docs.expo.dev/versions/latest/sdk/haptics](https://docs.expo.dev/versions/latest/sdk/haptics/).
- iOS plays nothing in Low Power Mode, when the user has turned the Taptic Engine off, while the camera is active (**this matters on our QR scanner screen**), or during dictation (same page).
- Web: Vibration API only. Safari iOS has none, so treat it as a no-op there ([platforms-and-stores.md §1.5](../08-integrations/platforms-and-stores.md)).

Apple HIG rules ([Playing haptics](https://developer.apple.com/design/human-interface-guidelines/playing-haptics)):
- *"Use system-provided haptic patterns according to their documented meanings."*
- *"Use haptics consistently … build a clear, causal relationship between each haptic and the action that causes it."*
- *"Match the intensity and sharpness of a haptic with the intensity and sharpness of the animation it accompanies."* You can also sync sound with haptics.
- *"In most apps, prefer playing short haptics that complement discrete events."*
- *"Make haptics optional."*

**Our haptic map** (one `haptics.ts`, every call site uses a semantic name, never a raw style):

| Semantic event | iOS | Android | Notes |
|---|---|---|---|
| `tick` (keypad digit, chip, segmented control, chart scrub crossing a candle, slider step) | `selectionAsync()` | `Segment_Tick` (`Segment_Frequent_Tick` for scrubbing) | Throttle scrub ticks (e.g. ≤ 1 per 40 ms; unverified value, tune on device) |
| `press` (primary button down) | `impactAsync(Light)` | `Virtual_Key` | On press-in, not release, so it feels instant |
| `snap` (sheet reaches a detent, pull-to-refresh arms, slide-to-confirm reaches the end) | `impactAsync(Medium)` or `Rigid` | `Gesture_End` | |
| `confirm` (Face ID succeeded and the order is sent) | `impactAsync(Soft)` | `Confirm` | Then silence until the fill |
| `filled` (order filled, deposit arrived, card top-up done) | `notificationAsync(Success)` | `Confirm` | Paired with the fill sound (B.2) |
| `warn` (margin ratio crosses a warning, price moved beyond slippage, session about to lock) | `notificationAsync(Warning)` | `Reject` (unverified mapping) | |
| `fail` (rejected, insufficient funds, Face ID cancelled twice) | `notificationAsync(Error)` | `Reject` | Never on a plain cancel |
| `liquidation` | `notificationAsync(Error)`, then `impactAsync(Heavy)` | `Reject` | Rare; never reuse it for anything else (HIG) |

Richer option: **Pulsar** (`react-native-pulsar` 1.7.0, Software Mansion) runs Core Haptics patterns on iOS and Android. It has presets, a Pattern Composer, a gesture-driven Realtime Composer, Expo support, and calls that work inside Reanimated worklets ([github.com/software-mansion/pulsar](https://github.com/software-mansion/pulsar)). Rainbow uses `react-native-turbo-haptics` for the same reason (C.1). Use Pulsar for a signature "fill" pattern and for scrub ticks fired from the UI thread. Use `expo-haptics` everywhere else. Worklet support means no JS-thread hop during a chart scrub.

### B.2 Sound design (expo-audio) with a user toggle

- `expo-audio ~57.0.x`: `useAudioPlayer(require(...))` for screen-bound sounds, `createAudioPlayer()` for app-lifetime players (you must `release()` them). `setAudioModeAsync({ interruptionMode: 'mixWithOthers', playsInSilentMode: false })`. Docs: *"`mixWithOthers`: Audio plays alongside other apps without interrupting them … Best suited for sound effects, UI feedback, or short audio clips."* **Note that `playsInSilentMode` defaults to `true`.** A UI sound that plays with the ringer switch on silent feels broken, so set it to `false` explicitly. Source: [docs.expo.dev/versions/latest/sdk/audio](https://docs.expo.dev/versions/latest/sdk/audio).
- Preload the four or five UI sounds into `createAudioPlayer` instances at launch (a `SoundBank` singleton). To replay: `seekTo(0)` then `play()`. That avoids first-play latency (unverified; measure on device).
- **Palette** (kept tiny, each 80 to 400 ms, −18 to −14 LUFS, unverified targets): `fill` (a warm two-note rise, the "cha-ching" equivalent), `deposit` (a soft chime), `send/spend` (a short whoosh), `error` (a low muted thud, optional), `unlock` (a subtle click after Face ID). There is **no sound for ticks or navigation**; haptics own those. Generate with the `sound-effects` skill (ElevenLabs), as Agari did for `onboard-*.mp3`.
- **Toggle:** Settings → "Sounds" (default **on**) and "Haptics" (default **on**), persisted in MMKV. Also respect the silent switch. Competitor precedent is in section C.
- Web: `expo-audio` supports web `play()`. Browsers block audio until the first user gesture (standard autoplay policy), so the first sound must follow a tap.

### B.3 Motion: Reanimated 4 as the only animation engine

- SDK 57 pins `react-native-reanimated 4.5.1` + `react-native-worklets 0.10.1`.
- Reanimated 4 adds **CSS transitions/animations** (`transitionProperty`, `transitionDuration` on `Animated.View` style), plus worklets, layout animations (`entering`/`exiting`/`layout`), and shared element transitions (`sharedTransitionTag`, default 500 ms `withTiming`). Source: [Reanimated docs](https://docs.swmansion.com/react-native-reanimated/docs/css-transitions/overview).
- **Reduced motion:** `useReducedMotion()`, and `reduceMotion: ReduceMotion.System` on `withSpring`/`withTiming`/layout animations. With reduced motion on, *"entering, keyframe, and layout animations instantaneously reach their endpoints, while exiting animations and shared transitions are omitted"* ([accessibility guide](https://docs.swmansion.com/react-native-reanimated/docs/guides/accessibility)). Set it on every shared spring preset. Swap bounces for fades.
- **Moti:** `moti` 0.30.0 was last published Jan 2025. Its description says "powered by Reanimated 3", and its peer dependency is `react-native-reanimated: '*'`. It works on Reanimated 4 (unverified). **Recommendation: skip Moti.** Reanimated 4 CSS transitions now cover Moti's declarative use case with no extra dependency.
- **Spring presets** (one `motion.ts`): `snappy` for press feedback and chips; `sheet` for sheets and the ticket; `bouncy` for success stamps only. Use Reanimated's duration/dampingRatio spring form so designers can reason about them (exact values: tune on device; unverified). Press-scale 0.97 on every tappable card. Stagger list entry by 30 to 40 ms, and only on first mount, never on refresh.
- **Gestures:** `react-native-gesture-handler ~2.32.0`. Needed for slide-to-confirm, chart scrub (`Gesture.Pan().activateAfterLongPress(…)`), swipe-to-close on positions, and sheet drags. Run all gesture math in worklets.
- **Lightweight alternative:** `react-native-ease` 0.8.1 ("declarative animations powered by platform APIs", published 28 Sep 2026). It is too new to depend on (unverified maturity).

### B.4 Charts and number tickers (Skia)

| Need | Library | Notes |
|---|---|---|
| Portfolio/asset line with scrub, gradient, haptic ticks | **`react-native-graph`** 1.4.0 (Margelo, Skia) | Built for Robinhood-style scrubbing; peer dependency is reanimated `*` |
| Candles | **`react-native-wagmi-charts`** 3.0.1 on native; TradingView Lightweight Charts on web (DOM component) | See [platforms-and-stores.md §0](../08-integrations/platforms-and-stores.md) |
| Sparklines in lists, donuts, gauges | `@shopify/react-native-skia` (SDK pin 2.6.2; npm latest 2.13.1) or `victory-native` 42.0.1 | Skia on web costs 2.9 MB of gzipped CanvasKit, so load it lazily there |
| **Rolling digits** (balance, P&L, price) | **`number-flow-react-native`** 0.5.1 (Aug 2026): *"digit-by-digit rolling counter, currency ticker, … odometer with View-based and Skia"* renderers; peer dependency is reanimated ≥ 3 | Agari's plan picked it to match web's NumberFlow, but never built it (A.2). Use it for the balance hero and position P&L |
| Price flash | Reanimated `withSequence(withTiming(flashColor,120), withTiming(base,600))` on the text colour | Green up, red down. Reduced motion → no flash, colour only |

Rules for tickers:
- Tabular figures (`fontVariant: ['tabular-nums']`), so digits don't jiggle.
- Animate only changes the user caused, or a live price at ≤ 4 Hz. Coalesce stream ticks per frame (unverified rate; tune).
- Never animate a number *from 0* on refresh. Animate from the last known value.

### B.5 Navigation chrome: native tabs, sheets, blur, Liquid Glass

- **NativeTabs** (`expo-router/unstable-native-tabs`): the real UITabBar, with Liquid Glass on iOS 26 and Material on Android. SF Symbol icons come via `NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md=…`. **`NativeTabs.BottomAccessory`** is a floating accessory above the tab bar, with `usePlacement()` returning `'inline'` or `'regular'`. **That is the slot for an "open positions" mini-bar** (like a music mini-player): "3 positions · +$12.40". Source: [docs.expo.dev/router/advanced/native-tabs](https://docs.expo.dev/router/advanced/native-tabs).
- **Glass rules** (HIG [Materials](https://developer.apple.com/design/human-interface-guidelines/materials)): *"Don't use Liquid Glass in the content layer."* *"Use Liquid Glass effects sparingly."* *"Only use clear Liquid Glass for components that appear over visually rich backgrounds."* So: glass on the tab bar, the floating trade button and the sheet chrome. Cards stay solid.
- `expo-glass-effect` (57.0.4): `GlassView` (`glassEffectStyle 'regular'|'clear'`, `isInteractive`, `tintColor`, `colorScheme`) and `GlassContainer spacing` (merging glass). iOS only. Guard with `isGlassEffectAPIAvailable()` and fall back to `expo-blur` `BlurView`. Source: [docs.expo.dev/versions/latest/sdk/glass-effect](https://docs.expo.dev/versions/latest/sdk/glass-effect).
- Opt-out switch if the brand fights glass: `ios.infoPlist.UIDesignRequiresCompatibility: true` (dev build only; Expo calls it a temporary workaround).
- **The Agari lesson (A.1):** the owner rejected system chrome for Agari's brand. For a trading app that must "feel iOS", **use NativeTabs + glass**. Keep the brand in content, typography, colour, sound and motion.
- **Bottom sheets:**
  - `@gorhom/bottom-sheet` 5.2.14 is mature, with `BottomSheetModal`, `enableDynamicSizing`, `keyboardBehavior 'interactive'|'extend'|'fillParent'`, `BottomSheetTextInput`, custom backdrops driven by `animatedIndex`, and `detached` + `bottomInset` for floating cards. But npm's last publish was May 2026 (check Reanimated 4.5 compatibility; unverified).
  - The new **`@swmansion/react-native-bottom-sheet`** 0.16.2 (Sep 2026, Software Mansion) has `BottomSheet`/`ModalBottomSheet`, mixed `detents` (`'50%'`, `'content'`, programmatic-only detents), `scrimOpacities` and `nativeOverlay`, with peer deps only react/react-native.
  - Expo Router's native `formSheet` presentation with `sheetAllowedDetents` gives true native sheets for simple cases.
  - **Pick one primitive and wrap it** (Agari's `BottomDrawer` lesson). Suggested: `formSheet` for static sheets (receive QR, settings), and the SWM or gorhom sheet for the trade ticket, which needs a custom keypad and slide-to-confirm.
- **Toasts:** `sonner-native` 0.27.0 (Aug 2026), a port of Emil Kowalski's sonner. Swipe to dismiss, promise toasts (`toast.promise`), and peers on Reanimated 4/GH/Screens. `burnt` 0.13.0 (native SPIndicator/Android toast) was last published Mar 2025. Use sonner-native for in-app status ("Order sent" → "Filled"), and use native alerts for nothing.

### B.6 Keyboard handling

- Trading amounts use a **custom in-app keypad** (Robinhood/Cash App pattern), never the system keyboard. Pros: no layout jump, haptic per digit, `$`/decimal control, and the same behaviour on web.
- For real text input (address, search, card name), use **`react-native-keyboard-controller`** 1.22.5: wrap the app in `KeyboardProvider` (`preload` defaults to true, which removes first-focus lag). Also `KeyboardAwareScrollView bottomOffset`, `KeyboardStickyView` for a pinned "Continue" button, and `KeyboardToolbar` with Prev/Next/Done ([docs](https://kirillzyusko.github.io/react-native-keyboard-controller/docs/api/keyboard-provider)).
- Inside gorhom sheets use `BottomSheetTextInput` + `keyboardBehavior="interactive"`.

### B.7 Icons, type, accessibility

- **SF Symbols:** `expo-symbols` `SymbolView` (`name={{ ios, android, web }}`, `weight`, `type 'hierarchical'|'palette'`, `animationSpec` for bounce/pulse on iOS). Material Symbols are the fallback on Android/web. `expo-image` supports `sfEffect="bounce"` (iOS 17+). Use a symbol bounce on success checkmarks and on the bell when an alert fires. Source: [docs.expo.dev/versions/latest/sdk/symbols](https://docs.expo.dev/versions/latest/sdk/symbols).
- **Dynamic Type:**
  - Keep `allowFontScaling` on for body text and cap display numbers with `maxFontSizeMultiplier` (e.g. 1.3 on the balance hero; unverified value) so a 6-digit balance never wraps.
  - Read `useWindowDimensions().fontScale` to switch the dense layouts (order book, positions table) to a stacked layout at large sizes.
  - Agari listed "larger text" as an unfinished gate (A.1).
- **Reduced motion:** see B.3. **Reduce transparency:** `AccessibilityInfo.isReduceTransparencyEnabled()` → swap glass/blur for solid (standard RN API; unverified that `expo-glass-effect` handles it automatically).
- **VoiceOver:** every number gets an `accessibilityLabel` that reads naturally ("Up 2.4 percent today"), not the glyphs.
- **Colour:** don't rely on red/green alone. Add ▲▼ glyphs and signs (+/−).

### B.8 App icon, splash and launch

- **Icon:** Icon Composer `.icon` directory via `ios.icon: "./assets/app.icon"` (SDK 54+). It handles dark, tinted and clear variants for iOS 26 automatically. Otherwise use `ios.icon.{light,dark,tinted}` PNGs. Source: [Expo splash & icon guide](https://docs.expo.dev/develop/user-interface/splash-screen-and-app-icon). Android: adaptive icon + monochrome layer for themed icons.
- **Splash:** `expo-splash-screen`. Call `preventAutoHideAsync()` at module scope, and `hide()` once fonts, MMKV hydration and cached portfolio are ready. `setOptions({ duration, fade: true })` ([docs](https://docs.expo.dev/versions/latest/sdk/splash-screen)). The splash is a static mark on the brand colour.
- **Launch choreography** (unverified; our design): the splash fades into a first frame that already holds cached data (from MMKV/react-query persist), with the balance number in place, not a spinner. The mark animates only on the *very first* launch (the Agari brand intro + chime, A.1). Every later launch is instant.
- **Cold start budget:** avoid heavy imports before first frame; lazy-load Skia on web, chart screens and the QR scanner.

### B.9 Widgets and Live Activities

- **`expo-widgets` 57.0.x** (iOS only; dev build). Widgets: `createWidget(name, component)` with `'widget'`-directive components, `updateSnapshot`, `updateTimeline`, `reload`. Live Activities: `createLiveActivity(name, component)` → `start(props, url)`, `update(props)`, `end(dismissalPolicy, props, contentDate)`, `getInstances()`. Push: `addPushTokenListener()` (per activity) and `addPushToStartTokenListener()` (remote start, iOS 17.2+). Limits: the widget code runs in an isolated runtime with **no hooks, state or async**; it uses only `@expo/ui/swift-ui` components. Source: [docs.expo.dev/versions/latest/sdk/widgets](https://docs.expo.dev/versions/latest/sdk/widgets/). Agari already shipped a Live Activity and widget on this stack (A.1, A.2).
- Alternative: `expo-live-activity` 0.4.2 (Software Mansion Labs, June 2026); simpler, fixed template.
- HIG constraints that shape the design ([Live Activities](https://developer.apple.com/design/human-interface-guidelines/live-activities)):
  - *"Offer Live Activities for tasks and events that have a defined beginning and end … that don't exceed eight hours."* An open perp position has no end, so start the Live Activity for **a bounded thing**: a resting limit order until filled, a position the user explicitly "watches" (auto-end after 8 h), or a deposit in flight (Aurora QR → credited).
  - *"Avoid displaying sensitive information"* on the Lock Screen. Show P&L as % by default, with a setting to show amounts.
  - *"Update a Live Activity only when new content is available."* *"Alert people only for essential updates."* The only alerting update is **approaching liquidation**.
  - *"Make sure tapping the Live Activity opens your app at the right location."* It deep-links to the position.
  - *"Always end a Live Activity immediately when the task or event ends."*
- **Widgets:** "Portfolio" (small: balance + day change; medium: + top 3 positions) and "Watchlist" (gold, one stock, one FX pair, one crypto). Use `updateTimeline` from the app on foreground and from background push.
- **Android:** an ongoing notification with progress as the Live Activity twin (Agari did this, A.1). Android 16 "Live Updates" (progress-centric notifications) is the modern equivalent (unverified for Expo support).

### B.10 Push notifications (fills and liquidation warnings)

- `expo-notifications`:
  - Android channels are required (API 26+). Make separate channels so users can tune them: `fills` (high), `liquidation` (max, own sound), `price-alerts` (default), `deposits` (default), `card` (high).
  - iOS categories: `setNotificationCategoryAsync('position', [{identifier:'close', buttonTitle:'Close position'}, {identifier:'add-margin', …}])`. An action that moves money must open the app and ask for Face ID, never execute blind (our rule).
  - Custom sounds go through the plugin's `sounds: [...]`. Source: [docs.expo.dev/versions/latest/sdk/notifications](https://docs.expo.dev/versions/latest/sdk/notifications).
- iOS interruption level `time-sensitive` for liquidation warnings, so they break through Focus. This needs the Time Sensitive Notifications capability (APNs `interruption-level`; Expo push support for the field: unverified; send via APNs directly if needed).
- **Permission priming:** never ask at launch. Ask right after the first order fills: "Get told when orders fill and if a position is at risk?" [Turn on] [Not now]. Only then call `requestPermissionsAsync()`.
- **Copy templates:**
  - "Bought 0.25 oz Gold at $2,431.10"
  - "TSLA long filled · 2× · $250"
  - "⚠︎ ETH long is 8% from liquidation. Add margin or reduce."
  - "$120 arrived from Base. Ready to trade."
  - "Card: $4.50 at Blue Bottle · $812 left to spend"
- Agari lesson (A.1): the server words each push with the *same function* that writes the in-app alert, so the copy never drifts.

### B.11 Face ID: prompt copy and session UX

- `NSFaceIDUsageDescription` comes from the `expo-secure-store` plugin's `faceIDPermission` (mera.md §5.2). Copy: **"Face ID keeps your account and trades private to you."** (our copy; the Apple requirement is simply a clear reason.) Without it, iOS falls back to the passcode (`expo-local-authentication` docs).
- The SecureStore `authenticationPrompt` is the line under the Face ID glyph. Make it verb-first and name the action:
  - unlock: **"Unlock trading"** (mera.md §11)
  - trade: **"Confirm buy $250 Gold"**
  - withdraw: **"Confirm send $500 to 0x12…9aF"**
  - card: **"Show card number"**
  - Android: `BiometricPrompt` title/subtitle; same strings.
- **Button copy before the system sheet:** "Continue with Face ID" (sign in; discoverable passkey first, create only on "no credentials", mera.md §2). Never say "passkey", "PRF" or "wallet" on the first screen. Say "Face ID" on iOS, "fingerprint or screen lock" on Android and "passkey" on web (unverified phrasing choice).
- **Session chip:** "Trading unlocked · 24:10" with a lock button (mera.md §5.3). When the session expires mid-ticket, show one Face ID prompt and **keep the ticket intact**.
- Cancel is not an error. Return silently to the ticket. Only after a second failure show "Face ID didn't work. Try again or use your passcode."

### B.12 First run with no crypto

Order of options on the empty-balance home ("Add money" sheet), easiest first:
1. **Claim starter funds** (testnet): one button, a claim that lands in about 1 s on Monad (sponsor drip, mera.md §8 Route A), with the balance ticking up via NumberFlow + `filled` haptic + `deposit` sound. Label it honestly: "Test dollars · no real value". Agari's "practice wallet + faucet" is the precedent, and it doubles as the App Review path.
2. **Deposit from any chain by QR** (Aurora persistent deposit address).
   - Aurora rules: *"The QR code must never appear alone"* and *"The deposit address must never be rendered without its transfer requirements."* ([aurora-intents.md](../08-integrations/aurora-intents.md) §5)
   - Show network chips, min amount, ETA, a Copy button with a `tick` haptic + "Copied" toast, and a Share button. Then a live status timeline (`PENDING_DEPOSIT → PROCESSING → SUCCESS`) that stays open in the background, with a Live Activity and push on arrival.
3. **From a wallet** (Aurora Intents Connect, Face ID-signed).
4. **Card / Apple Pay top-up** (onramp; issuer-dependent; mobile-only per platforms-and-stores.md).

Never show a blank portfolio. Show the empty state with the four options and a "What can I trade?" preview of live markets, browsable before funding.

---

## C. What the best apps do (screens and flows, with sources)

**Context shifts in 2026:**
- Coinbase Wallet (renamed Base app in Jul 2025) **went back to "Coinbase Wallet" in Sep 2026** as a trading hub with Hyperliquid perps, tokenized stocks and prediction markets, and it **added Monad** ([The Block](https://www.theblock.co/news/defi/2026-09-10-coinbase-rebrands-base-app-back-to-coinbase-wallet-after-just-over-a-year-as-social-experiment-falls-short-414115)).
- Hyperliquid has an official **Android** app (Apr 2026) but **no iOS app**. iPhone users install the web app from Safari ([hyperliquidguide](https://hyperliquidguide.com/guides/getting-started/hyperliquid-mobile-app-2026)).
- Robinhood Wallet offers perps via Lighter on Robinhood Chain, but not in the US or UK ([Robinhood](https://robinhood.com/us/en/support/articles/robinhood-wallet-perpetual-futures/)).

### C.1 Per app

| App | What to take | Source |
|---|---|---|
| **Robinhood** | **Trade ticket:** asset → Buy/Sell → amount → Review → **"swipe up to submit"**, the same on every asset class. The 2025 redesign split Trade into Buy/Sell buttons showing live bid/ask, with Buy tinted green or red by the stock's direction. | [support](https://robinhood.com/us/en/support/articles/360001339423/), [Pratt critique](https://ixd.prattsi.org/2025/02/design-critique-robinhood-ios-app/) |
| | **Celebration:** confetti was **removed 31 Mar 2021** after gamification criticism and replaced with subtler "dynamic visual experiences" for milestones. | [CNBC](https://www.cnbc.com/2021/03/31/robinhood-gets-rid-of-confetti-feature-amid-scrutiny-over-gamification.html) |
| | **Price feel:** odometer number flips, a blinking trend line, chart scrub. | [Pratt](https://ixd.prattsi.org/2025/02/design-critique-robinhood-ios-app/), [Medium](https://medium.com/design-bootcamp/ux-tricks-from-robinhood-app-c485d6fba7a8) |
| | **Legend Charts on mobile** (Jun 2025): trade from the chart. | [newsroom](https://robinhood.com/us/en/newsroom/introducing-robinhood-legend-charts-on-mobile/) |
| | **Haptics synced to animation:** the rocket launch in the Fractional Shares announcement. | [Appcues](https://goodux.appcues.com/blog/robinhood-haptic-feature-announcement) |
| | **Hide balance:** double-tap the balance to hide it (Aug 2025). | [X](https://x.com/RobinhoodApp/status/1956022850126581975) |
| | **Alerts:** volatility alerts with a LESS/MORE rate limit, threaded per holding. | [support](https://robinhood.com/us/en/support/articles/notifications-and-messages/) |
| | **Widgets:** Portfolio and Lists (iOS 16+). No first-party Live Activity found. | [widgets](https://robinhood.com/us/en/support/articles/ios-widgets/) |
| | **Wallet:** biometric/PIN on every open. | [wallet security](https://robinhood.com/us/en/support/articles/protect-your-wallet/) |
| | **EU perps:** a leverage slider on contract details, up to 10x; gold, QQQ and EUR/USD perps from Jul 2026. | [EU help](https://robinhood.com/eu/en/support/articles/perpetual-futures-margin-tiers-and-leverage), [newsroom](https://robinhood.com/us/en/newsroom/robinhood-accelerates-global-expansion-robinhood-chain-mainnet-stock-tokens-agentic-trading/) |
| **Cash App** | **Sign-up:** one field per screen (phone/email → code → card → name → $Cashtag), 17 screens. | [Mobbin](https://mobbin.com/explore/flows/684fc6d8-a31e-4781-a665-0cd214ae1149) |
| | **Bitcoin buy:** preset chips **$10/$25/$50** or "…", then source → PIN/Touch ID → Confirm → "Purchase successful" (8 screens). | [help](https://cash.app/help/us/en-us/3101-buying-bitcoin), [Pageflows](https://pageflows.com/post/ios/buying-bitcoin/cash-app/) |
| | **2025 design language:** "custom motion + haptics", micro-animation, its own typeface. | [Abduzeedo](https://abduzeedo.com/node/88974) |
| | **Sound:** the "cha-ching" is iconic but tied to money *received*; its exact in-app behaviour is (unverified). | [TikTok](https://www.tiktok.com/discover/the-cash-app-notification-sound) |
| | **Security Lock:** "Require Face ID to transfer funds". | [help](https://cash.app/help/3120-enable-security-lock) |
| **Revolut** | **Crypto buy:** a **risk acknowledgment** before the first buy; fee tier shown on the confirm screen. | [Pageflows](https://pageflows.com/post/ios/buying-crypto-currency/revolut/) |
| | **Auto volatility alerts:** when price moves more than 2%. | [help](https://help.revolut.com/help/wealth/cryptocurrencies/getting-cryptocurrency-exposure/can-i-be-notified-of-price-volatility/) |
| | **Shake or flip the phone to blur balances**, on by default. | [help](https://help.revolut.com/help/profile-and-plan/security-and-personal-data/why-is-my-balance-blurry/) |
| **Phantom** | **Seedless sign-up:** email or Apple/Google → 4-digit PIN → Face ID. | [help](https://help.phantom.com/hc/en-us/articles/32775281256851) |
| | **Perps on the Home tab:** SOL deposit auto-converted to USDC in under a minute; Long/Short → amount → **leverage slider** → SL/TP → review. "Risk disclosures, educational modals, and opt-in confirmations". | [blog](https://phantom.com/learn/blog/phantom-perps) |
| | **Privacy mode:** long-press the balance. | [X](https://x.com/phantom/status/1569732862978715648) |
| | **Auto-lock:** from Immediately to 1 day. | [help](https://help.phantom.com/hc/en-us/articles/28951350406803) |
| | **Notification categories,** each toggleable. | [help](https://help.phantom.com/hc/en-us/articles/10859434520467) |
| **Rainbow** (open source, read directly) | **Stack:** Reanimated, Skia, RNGH, **`react-native-turbo-haptics`** (migrated from `react-native-haptic-feedback`), MMKV, FlashList, notifee, `react-native-widgetkit`, netinfo. | [package.json](https://github.com/rainbow-me/rainbow/blob/develop/package.json) |
| | **Haptic vocabulary:** keypad → `selection`; chart scrub → **one `soft` at long-press start**; slider hits 100% → `impactMedium`, hits 0% → `impactLight`, no balance → `notificationError`. | `SwapNumberPad.tsx`, `ChartPath.tsx`, `features/perps/components/Slider/Slider.tsx` |
| | **Hold-to-confirm:** **500 ms hold**, sin-eased fill, `notificationSuccess` on completion, spring back if released early. Labels: "Hold to Long / Short / Close / Deposit". | `src/components/buttons/useHoldToActivate.ts`, `hold-to-authorize/constants.ts`, `src/languages/en_US.json` |
| | **Named springs:** `priceChangeConfig {mass .8, stiffness 300, damping 30}`, `sheetTransition {.8, 680, 46}`, `sliderConfig {1.25, 450, 40}`. | `src/components/animations/animationConfigs.ts` |
| | **Error shake:** stiffness 1600, damping 28, 8 px. | `src/hooks/useShakeAnimation.ts` |
| | **Perps explainer (3 cards):** "Trade with Leverage — … Faster losses, and liquidation, when you're wrong." | `en_US.json` |
| | **Live liquidation line on the ticket:** "Liquidated at $X, N% from current price", or at 1x "No Liquidation Risk". | `en_US.json` |
| | **Empty balance:** "No Balance" → "Fund Wallet" / "Receive"; gas "Free". | `en_US.json` |
| | **Sound:** the only sound is an easter egg at launch. | `useHideSplashScreen.ts` |
| | **Offline:** a button state "Offline" plus a one-line alert. | [repo](https://github.com/rainbow-me/rainbow) |
| **Coinbase Wallet** | "Zero to trade in under a minute". | [App Store](https://apps.apple.com/us/app/coinbase-wallet-nfts-crypto/id1278383455) |
| | Sign-up with email/Google/Apple; passkey with cloud backup. | same listing |
| | Funding via "Apple Pay, bank account … cards. **No redirects**". | same listing |
| | "See it, trade it in two taps"; one-tap limit orders; sponsored USDC fees. | same listing |
| **Hyperliquid clients** | **Official Android app:** push for limit fills, TP triggers and liquidations. | [guide](https://hyperliquidguide.com/guides/getting-started/hyperliquid-mobile-app-2026) |
| | **Testnet faucet:** needs a **prior mainnet deposit**, so it can't bootstrap new users. | [docs](https://hyperliquid.gitbook.io/hyperliquid-docs/onboarding/testnet-faucet) |
| | **Dexari:** email/Apple/Google on enclave keys, Face ID/passkey protects sends, MoonPay card onramp. | [review](https://coincodecap.com/dexari-review) |
| | **Based:** HL trading plus a Visa card that spends the trading balance, the closest analogue to our card. | [docs](https://basedapp.gitbook.io/docs) |
| | **Lighter Mobile:** **opt-in audio fill notifications**, a lock-screen widget with deep link. | [App Store](https://apps.apple.com/us/app/lighter-mobile/id6752246796) |

### C.2 Cross-app conclusions

1. **Sign-up has at most 4 screens and no seed phrase.** Ours is shorter still: one "Continue with Face ID" (Mera). Recovery/export lives in Settings.
2. **A zero balance is never a dead end.** Show Fund and Receive side by side (Rainbow, Coinbase Wallet), and accept what the user holds and convert it (Phantom). **Our testnet "claim starter funds" beats Hyperliquid**, whose faucet needs a mainnet deposit.
3. **A risk explainer before the first leveraged trade** (Rainbow's 3 cards, Revolut's acknowledgment, Phantom's opt-in confirmations).
4. **Confirm is a deliberate gesture:** Rainbow's hold (500 ms) or Robinhood's swipe up. **We use hold-to-confirm, with Face ID as the final step** (the hold replaces a tap, and the Face ID sheet appears only when the session is locked). Offer a tap alternative for VoiceOver users: Robinhood's swipe gets accessibility complaints ([AppleVis](https://applevis.com/forum/ios-ipados/swipe-submit)).
5. **Liquidation distance lives on the ticket and on every position row.**
6. **Celebrate quietly.** Confetti is a regulatory/PR liability (Robinhood 2021). Use a success haptic, a crisp fill summary and a subtle sound. **Sound in trading apps is rare and opt-in** (Rainbow: easter egg only; Lighter: opt-in audio fills). Our fill sound should be tasteful and toggleable (B.2), defaulting **on** for the fill and deposit sounds only.
7. **Privacy gesture for balances:** long-press (Phantom), double-tap (Robinhood), flip (Revolut). Pick one: **long-press the balance**. Add biometric lock on open with a timeout.
8. **No first-party Live Activity for positions exists among these apps.** This is a differentiator for us, within HIG's bounded-activity rule (B.9).

---

## D. The "product, not demo" checklist, by moment

Each line: **detail** → *library/technique*. ☐ = to build.

### D.1 First launch
- ☐ **Instant first frame:** splash holds until fonts + MMKV + cached portfolio are ready, then fades (`expo-splash-screen` `preventAutoHideAsync`/`hide`, `setOptions({fade:true})`). A font error counts as ready, so the splash never hangs (Agari `useAppFonts`).
- ☐ **Branded intro, once:**
  - About 2 s: mark spring + wordmark tracking + one chime + `heavy` haptic. Tap to skip.
  - **Skipped under Reduce Motion.**
  - Flag in MMKV read synchronously in a `<Redirect>` (Agari `BrandIntro`, `index.tsx`).
- ☐ **3 to 4 onboarding pages at most:**
  - Parallax, staggered words, page-turn tick, Skip.
  - Page 1 shows a **live** market card (Agari `useLiveWindow`).
  - The last page says "Test dollars, no real money" and offers "Look around first" (Reanimated 4 + FlatList paging).
- ☐ **Browse without an account:** markets, charts and prices are live before sign-up (Agari plan §1).
- ☐ **App icon:** Icon Composer `.icon` (dark/tinted/clear); Android adaptive + monochrome.
- ☐ **Native tab bar:** NativeTabs with SF Symbols and Liquid Glass. An open-positions `BottomAccessory` mini-bar.

### D.2 Sign-up (Face ID passkey)
- ☐ **One button, "Continue with Face ID":** discoverable `getPasskeyPrfOutput` first, create only when there is no credential. The date-labelled passkey never double-creates (mera.md §2).
- ☐ **Plain words:** say Face ID / fingerprint, never "passkey", "PRF", "seed" or "wallet". `faceIDPermission`: "Face ID keeps your account and trades private to you."
- ☐ **The success moment:** the Face ID glyph morphs into a check (SF Symbol bounce via `expo-symbols`), `filled` haptic, the `unlock` sound, and the balance card slides up. No interstitial "Account created" screen.
- ☐ **Errors:**
  - Cancel is silent.
  - `PRF_UNAVAILABLE` shows Mera's copy plus the fix.
  - `RequestFailed` on first run is logged as association-file trouble (mera.md §2).
  - An orphaned passkey → "Continue with Face ID".
- ☐ **Fresh-device restore:** the same address and positions rebuild from chain/indexer. A skeleton shows, never $0.00 (Mera stateless test).

### D.3 Funding
- ☐ **Empty home = the "Add money" card** with 4 rows: Claim starter funds · Deposit by QR · From a wallet · Card/Apple Pay (B.12; Rainbow "No Balance → Fund / Receive").
- ☐ **Claim starter funds:**
  - One tap, sponsor drip + mint.
  - **The button label follows the stage** ("Checking…" → "Sending test dollars…" → "Ready").
  - Balance rolls up with NumberFlow; `filled` haptic + `deposit` sound.
  - A one-time "You're funded" sheet that closes itself after 8 s (Agari `useFaucet`, `CreditWelcome`).
  - Rate-limited per device (Agari `deviceId()` in MMKV).
- ☐ **QR deposit:**
  - Network chips, min amount, ETA and warnings shown **with** the QR, never the QR alone (Aurora rules).
  - Copy → `tick` haptic + "Copied" toast. Share sheet.
  - The status timeline survives app close: an in-flight Live Activity "Deposit arriving" and a push on credit.
- ☐ **Blocker-first CTAs:** every disabled button names the first fixable blocker ("Add money to trade", "Unlock with Face ID") and opens the fix (Agari `deriveFaucetBlocker`, `openFunds()` event).
- ☐ **Header balance pill** opens Add money ("Balance $X. Tap to add money." a11y label).

### D.4 First trade
- ☐ **3-card explainer before the first leveraged trade**, shown once (Rainbow copy pattern; Revolut risk acknowledgment).
- ☐ **Ticket in one sheet primitive:**
  - Custom keypad (`tick` per key), chips $10/$25/$50/Max, leverage slider with edge haptics (Rainbow).
  - Live "Liquidated at $X · N% away" line, or "No liquidation risk" at 1×.
  - Keypad inside the sheet; no system keyboard.
- ☐ **Hold to Buy / Hold to Long:**
  - 500 ms hold with a progress fill, `confirm` haptic at completion (Rainbow `useHoldToActivate`).
  - Face ID only if the session is locked, and the ticket is kept (mera.md §5.3).
  - A VoiceOver "activate" alternative.
- ☐ **Optimistic "Sending" state → fill in about 1 s on Monad:**
  - The ticket morphs into a receipt (`ZoomIn.springify()`).
  - `filled` haptic + `fill` sound + rolling position P&L.
  - A "Share" card via `react-native-view-shot` + `expo-sharing`.
  - **No confetti** (Robinhood 2021).
- ☐ **Ask for notifications right after the first fill**, with priming copy (B.10).
- ☐ **Price feel:**
  - Tabular numerals; green/red flash of 120 ms in, 600 ms out.
  - Chart scrub: a `soft` haptic at start, ticks on candle change (Rainbow `ChartPath`; `react-native-graph`).
  - `priceChangeConfig`-like spring for digits.

### D.5 Card
- ☐ **Card reveal:** tilt/flip with Reanimated; "Show card number" behind Face ID; copy with haptic + toast; auto-hide after 30 s (unverified value).
- ☐ **Spend push:** "Card: $4.50 at Blue Bottle · $812 left to spend". Tap opens the transaction.
- ☐ **Apple Pay:** `@expensify/react-native-wallet` `<AddToWalletButton>` when the issuer entitlement exists; otherwise honest copy "Add to Apple Pay (coming with card issuance)" (platforms-and-stores.md §3).
- ☐ **Spendable balance** shown as uncommitted collateral, with a clear explanation sheet.

### D.6 Errors
- ☐ **One `ErrorState` / `EmptyState` / `Skeleton` kit:**
  - Human headline + a next action + collapsible technical details.
  - Skeleton only where nothing was ever known.
  - **Never a fabricated zero** (Agari `states.tsx`).
- ☐ **Stale ≠ failed:** keep last-good values with "Updated 14:02 · refreshing" vs "· retrying" (Agari `c0794c62`).
- ☐ **Error boundary copy** that reassures: "Your funds and positions are safe on-chain. This is only the screen." (Agari `ERROR_BOUNDARY`).
- ☐ **Toasts:**
  - One at a time, swipe to dismiss, above the tab bar, VoiceOver-safe.
  - Neutral for records, warning for degraded truth (Agari toaster; or `sonner-native`).
- ☐ **Error shake + `fail` haptic** on invalid input (Rainbow `useShakeAnimation`: stiffness 1600, damping 28, 8 px).
- ☐ **Crash-safe writes:** a journal of sent txs, reconciled on relaunch, one toast per outcome, never re-sent (Agari `WriteRecovery`).

### D.7 Offline
- ☐ **NetInfo banner** (`@react-native-community/netinfo`) + TanStack Query `onlineManager`. Buttons read "Offline" and are disabled (Rainbow). Cached portfolio stays visible with its timestamp.
- ☐ **Pause streams and polls in the background** (AppState), and resume + refetch on foreground (Agari `visibility.ts`).
- ☐ **Pull to refresh on every screen:** one spinner, a `tick` at arm, held until the refetch settles (Agari `usePullRefresh`).

### D.8 Returning user
- ☐ **Launch shows the portfolio immediately** from ungated address + cache. Face ID only on the first trade (mera.md §5.2).
- ☐ **Session chip** "Trading unlocked · 24:10" + Lock. Idle and background lock (mera.md §5.3).
- ☐ **Hide balances:** long-press the balance (Phantom), persisted.
- ☐ **Widgets:** Portfolio (S/M) + Watchlist, via `expo-widgets` `updateTimeline`. Logos pre-rendered to the app group (Agari `WidgetMarks`).
- ☐ **Live Activity** for a bounded thing only (resting order, watched position ≤ 8 h, deposit in flight). % by default, liquidation-proximity alert, deep link to the position (HIG).
- ☐ **Push channels:** fills / liquidation (time-sensitive) / price alerts (rate-limited LESS/MORE like Robinhood) / deposits / card. Copy shared with the in-app alert (Agari).
- ☐ **Deep links and universal links** on the rpId host: `/.well-known` serves AASA `applinks` + `webcredentials`, and assetlinks `handle_all_urls` + `get_login_creds`. Notification paths are checked against a strict regex (Agari `isAppPath`). Agari never shipped universal links; we must.
- ☐ **Settings:** Sounds, Haptics, Hide balances, Notifications per channel, Auto-lock timeout (Phantom), Appearance. All in MMKV.
- ☐ **OTA fixes** via `expo-updates` channels (Agari).

### D.9 Always (every screen)
- ☐ Reduce Motion honoured (`ReduceMotion.System` on every preset), Reduce Transparency → solid, Dynamic Type with `maxFontSizeMultiplier` on hero numbers, VoiceOver labels on numbers, ▲▼ + sign as well as colour.
- ☐ A 44 pt minimum hit target, `press` haptic on press-in, press-scale 0.97.
- ☐ Invariant/lint rules for design literals, tight leading and haptic usage through `haptics.ts` only (Agari `scripts/invariants/rules.mjs`).
- ☐ **Physical-device QA list:**
  - Silent switch, Low Power Mode (no haptics), Bluetooth audio, interruption/resume.
  - Larger text, dark/light, the Android back button.
  - Camera active on the QR screen (no haptics).

---

## E. Library shortlist (SDK 57)

| Purpose | Package | Version (29 Sep 2026) | Status |
|---|---|---|---|
| Haptics | `expo-haptics` | ~57.0.3 | core |
| Rich haptics | `react-native-pulsar` | 1.7.0 | optional (signature patterns, worklets) |
| Sound | `expo-audio` | ~57.0.5 | core |
| Motion | `react-native-reanimated` / `react-native-worklets` | 4.5.1 / 0.10.1 | core |
| Gestures | `react-native-gesture-handler` | ~2.32.0 | core |
| Graphics | `@shopify/react-native-skia` | 2.6.2 (SDK pin) | core |
| Line chart + scrub | `react-native-graph` | 1.4.0 | core |
| Candles | `react-native-wagmi-charts` / Lightweight Charts (web) | 3.0.1 | core |
| Rolling numbers | `number-flow-react-native` | 0.5.1 | core |
| Sheets | `@swmansion/react-native-bottom-sheet` or `@gorhom/bottom-sheet` | 0.16.2 / 5.2.14 | pick one |
| Toasts | `sonner-native` | 0.27.0 | core |
| Keyboard | `react-native-keyboard-controller` | 1.22.5 | core |
| Tabs | `expo-router` NativeTabs | ~57.0.x | core |
| Glass / blur | `expo-glass-effect` / `expo-blur` | 57.0.4 / ~57.0.3 | core |
| Symbols | `expo-symbols` | 57.0.3 | core |
| Widgets + Live Activity | `expo-widgets` (+ `@expo/ui`) | 57.0.22 | iOS |
| Push | `expo-notifications` | ~57.0.20 | core |
| Lists | `@shopify/flash-list` v2 or `@legendapp/list` | 2.x / 3.5.0 | core |
| Persistence | `react-native-mmkv` + TanStack Query persist | 4.x | core |
| Share card | `react-native-view-shot` + `expo-sharing` | 5.1.0 | Agari-proven |
| Splash / icon | `expo-splash-screen`, Icon Composer `.icon` | ~57.0.9 | core |
| Skip | `moti` (Reanimated 3 era, last publish Jan 2025), `burnt` (Mar 2025) | | |
