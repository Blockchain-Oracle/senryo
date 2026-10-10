# R2 — One look, real logos, no unfinished tells (replan stage 2)

**Goal:** the web, the landing and the phone look like one product (UGLYCASH). Every entity that has an identity shows
its real mark. Nothing on screen reads like engineering notes or a dead end.

**Authority:**
- `replan-2026-10-10.md` R2; D-304;
- `docs/plan/uglycash-revamp-2026-10-07.md`;
- research `06-senryo-today.md` (§1 top 20, §2, §5, §8, §9) and `03` take 1;
- logos fetched by script (memory: research the download route, Context7 / ctx7, never by hand) through
  `packages/identity`, with provenance;
- 21st.dev first for every new component.

**Gate:**
- `pnpm gate` 0 (incl. `identity-provenance`);
- web screenshots light and dark at desktop and phone width with no indigo or violet left (grep the tokens: no
  `#414EF4`, `#0A0911`, `#B69DF8`);
- one simulator pass;
- web deployed and phone OTA.

## Steps

### Colour and type
- [x] R2.1 `@senryo/tokens`:
  - `NATIVE_LIGHT`/`NATIVE_DARK` move in as the one palette and are emitted as CSS vars for the web;
  - Living Lacquer roles deleted from `palette.ts` and `tokens.css`;
  - the phone imports the shared palette (`apps/mobile/src/theme/native-palette.ts` becomes a re-export or is
    deleted).
  - *As built (10 Oct):* `palette.ts` is generated from the phone's merged values (the phone looks the same) and is the
    one source: `LIGHT` the default, `DARK` the adaptation; ten roles nobody used are gone (the Phantom fan's six,
    `silver`, `chart1`, `chart5`, `chartCandleDown`) with the fan's motion and type tokens; the dark theme's violet ink
    `#17151F` on up/down/destructive fills is black; a `seal` role (black in both) for the web's brand disc.
    `native-palette.ts` is gone: the phone's theme and `app.config.ts` read `@senryo/tokens`, its scene roles live in
    `theme/scene.ts`. `tokens.css` emits `:root, .light` and `.dark`. No `#414EF4` / `#B69DF8` / `#0A0911` in tokens;
    the landing hero (R2.4) and the generated avatar/scene art (R2.8) still carry them.
- [x] R2.2 Web:
  - light by default (next-themes, D-304), with the forced `dark` removed from `apps/web/src/app/layout.tsx:24`;
  - the theme provider's stale D2 comment goes;
  - `#FA00FF` with a black label on trade, selected and publish controls only;
  - green and red only for direction;
  - a black seal disc with no glow;
  - one Practice/Real tint shared with the phone.
  - *As built (10 Oct):* light by default (no forced `dark`; next-themes `light`, `light dark` colour scheme; the D2
    comment gone); `EntityMark` resolves light before hydration and takes the phone's `ground`. Magenta as on the
    phone: the dock's Trade seal (`#FA00FF`, black-ground mark, the phone's 40 % glow), the focus ring and selected-row
    tint; selected chips stay ink (black in light, white in dark), as the phone's. The rail and top-line brand seal is a
    black disc with no glow. Green and red mean direction only, on both apps: errors use `destructive` (same red, right
    meaning), success lines and countdown clocks read in ink, settings toggles are primary like the phone's switches.
    Practice/Real tints are the shared palette's. Checked in the browser: light `#F5F5F5`, dark `#111`, rail seal
    black, dock seal magenta; the one violet left in the rail is Monad's own logo in the Practice capsule.
- [ ] R2.3 A condensed display face (the phone's Roboto Condensed Black, via `next/font`) for money and headings; canvas
  text uses it too.
- [ ] R2.4 The landing (`welcome.module.css`, `live-hero.css`) joins the same tokens, with the BTC mark on the live hero.
- [ ] R2.5 `.21st/design.json` on both apps records UGLYCASH as the direction.

### Logos
- [ ] R2.6 Registry gaps by script:
  - QQQ, MSFT, AMZN;
  - Pyth, RedStone;
  - ESPN, theScore;
  - NHL, MLB, NFL, EPL and their teams;
  - distinct basket glyphs (MAJORS, ALTS, METALS, TECH);
  - game art slots (bull, bear, coin, reach plate).
- [ ] R2.7 `TeamMark` reads the registry (no ESPN hot-links); the keeper sends team keys, not image URLs.
- [ ] R2.8 Marks on every surface in 06 §5.3: Earn, the web wallet / Receive / Withdraw drawers, result toasts, the
  landing hero, `/proof/w`, Lucky and Warm-up, the hub cards, and people (web avatars from `avatar.tsx`).

### Tells and dead ends
- [ ] R2.9 Engineering copy ("the next markets deploy") becomes plain states until R4 makes those screens live. Earn
  gets a failed state.
- [ ] R2.10 The phone Status screen reads `/status` (prices per source, relay, keeper), or the route goes.
- [ ] R2.11 Settings and copy for absent features are hidden until their stage: leaderboard, invites, price alerts,
  "a stock market you watch".
- [ ] R2.12 `docs/judges.md` (rendered at `/judges`), the landing and the Calls copy match the screens: 34 markets, what
  is live and what is Practice.
- [ ] R2.13 Links:
  - AASA and asset links name the current routes (`/app/*`, `/call`, `/proof`, `/u`);
  - the phone's `share-link.ts`, recovery link and `/trade` deep link are fixed.
- [ ] R2.14 Navigation:
  - Back on every sub-page (web `nav.ts` resolves every route's parent);
  - the rail reads Trade · Markets · Calls · Games · Earn · Leaderboard (Leaderboard appears in R8);
  - phone guests can reach Games, Events, Duel, Parlay, Earn and Wallet read-only.
- [ ] R2.15 Signed-out drawers and screens get a Sign in button. Every disabled button says why.
- [ ] R2.16 Dead code: the 14 unused web components (06 §8), stale comments and route constants, and
  `lib/copy/diagnosis.ts` if still unused. The Everything drawer's search waits for R6.
- [ ] R2.17 Web shell: splash, PWA install sheet and a "new version" toast (Owarine `Splash.tsx`, `InstallSheet.tsx`,
  `useAppUpdate.ts`).
- [ ] R2.18 A11y: one h1 per page; `"use client"` where hooks are used; the HealthChip status dot replaced per D-237.

## Handoff
(written at the end of the stage)
