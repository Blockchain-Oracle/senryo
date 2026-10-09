# S6 — the web app (pivot plan "S6 Web app")

**Goal:** `senryo.xyz/app` is the same product as the phone on a desktop and a phone browser: the S22 shell (rail, top
line, one stage, the Everything drawer, ⌘K), the live terminal at `/app/trade/[symbol]` with Owarine's canvas chart and
Senryo's reactions, Markets, Calls with receipts and proof, the Wallet as right drawers (test dollars, Receive,
Withdraw), passkey sign-in on the rpId host, and a landing that sells predictions. A static export on Coolify.

**Authority:** `pivot-2026-10-08.md` (S6, the "Web" and "Navigation" sections), D-190 (web overlays are right drawers
and centred modals, never bottom sheets), D-268 (one nav source), D-272/D-280 (one stream, zero RPC from clients,
signing), D-281 (markets). Sources:
- Mitoshi (`../crypto-world-fair/web/src`): `components/shell/{AppShell,Rail,TopLine,MobileDock,EverythingHost,
  EverythingDrawer,ShortcutsModal,FeedbackPreload,NetworkPill}.tsx`, `styles/{app-shell,drawer}.css`,
  `lib/{drawer-param,feedback,idle,haptics,privacy,sound/trade}.ts`.
- Owarine (`../owarine/web/src/features/terminal`): `chart/*` (canvas `LiveChart`, engine, odometer, dot grid),
  `TerminalScreen.tsx`, `ui/{TradeButtons,ReactionOverlay,Chrome}.tsx`, `toasts.tsx`, `feedback/reactions.ts`.
- The phone (S5) for behaviour and copy: `features/{terminal,calls,wallet}`, `@senryo/core/market`, `@senryo/live`.
Every new component: 21st.dev search first, recorded in `apps/web/.21st/design.json`.

**Gate:** Lighthouse mobile median LCP ≤ 2.5 s, TBT ≤ 200 ms, CLS ≤ 0.05 · first-load JS ≤ 120 KB on `/` and ≤ 220 KB
on `/app` · the wallet chunk is 0 bytes before its click · ≤ 1 SSE per tab · a walked journey on the live site
(sign in → test dollars → a call → its receipt) · `pnpm gate` 0.

## Steps

### Ground
- [x] S6.1 Delete the web's trading-era leftovers (the journal sender, `marketRoomUsd6`, stale account pieces) and put
      the web on the pivot packages (`@senryo/live`, the markets and history hooks); the web builds and exports clean
- [x] S6.2 Layout tokens (`packages/tokens` `layout` group: rail 248/88, inset 16, stage radius 24, drawer 384/560,
      `--ease-drawer`, 380/240 ms) and the web nav from `packages/config/src/nav.ts` (rail places with digits, the
      Everything groups); the route-coverage invariant covers the web
      _Done: the rail is the phone dock's places (Home · Trade · Markets · Calls, key 5 = Everything); under 768 px the
      web dock is `DOCK_NAV` itself. Shared out of the phone so both apps read one copy: the sound cues
      (`@senryo/tokens` `sound.ts`; the phone's WAVs regenerate byte-identical), the window clock, price precision
      and the call words (`@senryo/core` `window-clock`, `price-format`, `call-format`)._

### Shell
- [x] S6.3 The S22 shell ported: Rail (digits 1–6, the active pill), TopLine (mode capsule, balance chip, health
      chip, account), one stage, MobileDock with the centre seal under 768 px, Everything drawer in the URL (`?d=`),
      the `?` shortcuts modal, sound and haptics preload, the privacy eye
      _Done: Radix right drawer (swipe to close on touch; no keyboard pop on phones), the vaul bottom sheet and
      `responsive-sheet` deleted (auth uses the centred `Modal`), the health chip on the one stream, the web's
      `fire()` with the phone's haptic words; `pnpm --filter @senryo/web dev:live` runs it on localhost against the
      live API through a dev-only CORS proxy (production CORS stays senryo.xyz)._
- [x] S6.4 ⌘K: places, live markets (price, countdown) and actions
      _Done: 21st #382 (cmdk), word-match filter, lazy on first open._

### The loop
- [x] S6.5 Terminal `/app/trade/[symbol]`: Owarine's canvas chart on `@senryo/live` (600 samples, adaptive easing,
      K / entry levels, zone, rolling pill, dot grid), window chips and countdown ring, odds in words with the load
      surcharge and capacity, presets + keypad, Up/Down → Cash out (partial), lockout, reactions and confetti,
      sounds, one-tap line, crowd split
      _Done: the call flow is one package for both apps, `@senryo/calls` (window, signing, one-tap, delegate keys,
      the per-tick `quoteTick`, the reaction engine, `useCallFlow` — the panel's states and guarded open / cash-out —
      and `useResults`, with each app's effects injected); the phone runs on it unchanged (bundles; typecheck 0).
      The web chart is Owarine's canvas engine with the phone's Senryo rules (zone on your side of K, K/entry tags
      clear of the pill and stacked at the edges, adaptive easing, 千両); odds, distance and cash-out paint from live
      values, never a render per tick; reactions and the win confetti are CSS/canvas, no motion runtime; keys ↑ ↓ C;
      the dock stays on the terminal under 768 px. The signed-in call from the web waits for S6.7's passkey sign-in._
- [x] S6.6 Markets, Calls (record, filters, receipt drawer with the timeline and the window proof, share card),
      Home/Overview
      _Done: Calls (record, the 21st segmented filters re-tokenized without the motion runtime, rows → the receipt in
      the wide drawer `?d=call&id=`), the receipt (facts, the cubby-ui timeline as plain markup, the window proof with
      its transactions), the share card drawn on a canvas at 1080 × 1350 (system share sheet, else saved with the
      link copied), the public `/call?id=&chainId=` page for shared links, Home (balance, one-tap chip, open calls,
      markets). Shared with the phone in `@senryo/calls`: `useCallRows`, `receipt.ts` (steps, facts, hero, share
      words, proof facts) and `callLink`; the welcome sky moved to `@senryo/tokens` `WELCOME`._
- [x] S6.7 Sign-in and money: passkey on the rpId host (create, sign in, recover), setup (handle, terms, test
      dollars), the Wallet drawers (test dollars, Receive, Withdraw via EIP-3009), one-tap grant/revoke; AppKit
      only behind a click (Real's wallet deposit arrives with S9)
      _Done: the account drawer `?d=account` (create → setup, sign in / continue / recover stay on the page), `/app/setup/`
      (handle with the first-save visibility, terms — the gate before any call, re-asked after a version bump — test
      dollars granted on arrival, the first call, one-tap), drawers for the wallet (balance, daily test dollars),
      Receive (dotted QR, copy), Withdraw (EIP-3009 through `@senryo/calls` `checkWithdraw` / `useWithdrawFlow`, the
      phone's too), one-tap (caps, turn on/off) and settings (sound, vibration, hide balances, theme, the session — the
      old session modal deleted; the chip opens settings). The signed-in journey is walked at S6.9 on the live site
      (a passkey prompt needs a person). No AppKit yet: Real's deposit is S9._

### Front door and ship
- [x] S6.8 The landing rewritten for predictions (hero with the live line, how it works, Practice → Real, proof,
      download), the judges page updated
      _Done: the hero is the live BTC line with this window's K, the countdown and what Up / Down pay on $5 (the
      terminal's own chart and quote pass, an island after first paint in a fixed-size frame); How it works in the
      story's art (call, payout, passkey), Practice → Real (the modes scene, its labels printed in by
      `apps/web/scripts/website-art.mjs`), Proof, questions, and sign-in at the foot. The trading-era landing, its art
      module, images and copy are gone; `docs/judges.md` (the /judges page) rewritten: a call in two minutes, how to
      check any call, the contracts from the live catalogue, how it is built, what is not yet._
- [ ] S6.9 Static export to Coolify (`senryo-web` image), the gate measured (Lighthouse, bundle sizes, SSE count),
      a walked journey on the live site, acceptance rows, STATUS handoff

## Handoff
(written at the end of the stage)
