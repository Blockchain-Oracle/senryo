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
- [x] R2.3 A condensed display face (the phone's Roboto Condensed Black, via `next/font`) for money and headings; canvas
  text uses it too.
  - *As built (10 Oct):* the web self-hosts the phone's own vendored file, subset to the web's Latin ranges (34 KB
    WOFF2, tabular digits, every feature kept; fontTools 4.66.1; provenance in `packages/tokens/src/fonts.ts`, the
    `font-provenance` invariant passes) through `next/font/local`. `FONT.display` is Roboto Condensed, and the emitted
    CSS gives every display role (`text-num-*`, `text-display-*`, `text-page-title`) the display face, so money and
    page titles can't fall back to Inter by omission; the shell's word mark uses it too. On the canvas the price pill
    and tags use it; the axis stays Inter. The unused `DISPLAY_MIN_SIZE` is gone. Checked in the browser: the face
    loads, page titles and the chart pill render in it.
- [x] R2.4 The landing (`welcome.module.css`, `live-hero.css`) joins the same tokens, with the BTC mark on the live hero.
  - *As built (10 Oct):* the landing's own lavender palette is gone: its `--page-*` names point at the tokens (ink,
    text-2, ground, secondary, border) and every literal (focus outline, hovers, art plate, faint word mark, menu
    shadow, the entry band) is a token, so it follows light and dark. Headings use the condensed display face; the
    primary action is the app's black; the sign-in band scopes the dark tokens (a dark card on the light page, its
    buttons themed to match); the live hero is a dark card with the BTC mark beside "BTC · 1m". Checked in the
    browser top to bottom.
- [x] R2.5 `.21st/design.json` on both apps records UGLYCASH as the direction.
  - *As built (10 Oct):* both files name UGLYCASH (D-304, the 7 Oct plan) with Living Lacquer and D2 as history; colour
    mode light-default-with-dark; the colour table regenerated from `palette.ts`; the authority points at the UGLYCASH
    plan and study; a D-304 entry in each decision log.

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
- [x] R2.9 Engineering copy ("the next markets deploy") becomes plain states until R4 makes those screens live. Earn
  gets a failed state.
  - *As built (10 Oct):* Earn, Duels and Events on both apps say "… isn't open yet" / "… aren't open yet"; the shared
    "not here yet" diagnosis no longer says "deployed". Earn's failed read shows the app's error panel with Retry on
    both apps (the phone used to sit on its loading skeleton forever after a failed read).
- [x] R2.10 The phone Status screen reads `/status` (prices per source, relay, keeper), or the route goes.
  - *As built (10 Oct):* the placeholder is gone: Status (Settings → Status) reads `/v1/status` every 15 s through a new
    `useStatus()` — prices overall and per source (Pyth and the baskets with their marks; "7 live · 5 closed"), each
    network's connection with the latest block's age and how far history trails, and deposits; states in words
    (Working, Partly delayed, Down), failures with Retry. Relay and keeper aren't in `/status`, so the screen doesn't
    claim them. Found on the way: the api rolled "prices overall" up as the worst source, so RedStone's public gateway
    refusing (403, its keyless window, D-310) made the whole service read "down" with BTC live; overall now follows
    its own rule over every market (degraded). Simulator view waits for the simulator pass.
- [x] R2.11 Settings and copy for absent features are hidden until their stage: leaderboard, invites, price alerts,
  "a stock market you watch".
  - *As built (10 Oct):* the phone's notification settings show Call results and Money arrived only (the alerts and
    people channels stay in the saved choices for R8, and aren't registered as Android channels); the signed-out and
    permission copy, Help's Envio line and the web's username step no longer promise price alerts, invites or a
    leaderboard. Nothing else in either app mentions them.
- [x] R2.12 `docs/judges.md` (rendered at `/judges`), the landing and the Calls copy match the screens: 34 markets, what
  is live and what is Practice.
  - *As built (10 Oct):* the judge guide's last section said Range, Moonshot, stocks, baskets and Earn weren't shown
    ("nothing on screen is a placeholder"); it now says what is live in Practice (every call type on BTC, ETH and SOL —
    checked on chain: all twelve series carry the five-band menu), what is shown with live prices but not open for
    calls (the other 31), what isn't open (Earn, duels, events, parlays), RedStone's keyless window, and Real. The
    walkthrough names Range, Moonshot and Crash. The landing's "Real starts when you switch" reads "Real opens with
    mainnet". The Calls copy already matched ("Call the next move on BTC, ETH or SOL").
- [x] R2.13 Links:
  - AASA and asset links name the current routes (`/app/*`, `/call`, `/proof`, `/u`);
  - the phone's `share-link.ts`, recovery link and `/trade` deep link are fixed.
  - *As built (10 Oct):* the iOS link file names `/app`, `/app/*` and `/call` (it named the trading app's
    `/portfolio`, `/positions`, `/card`…), with the web's Settings carved out; Android's already hands over every
    `senryo.xyz` link. `/proof` stays on the web (the phone shows the proof inside each receipt) and `/u` waits for
    people (R8). The phone maps every web route onto its own: `/app/trade/eth/` → the terminal on ETH (the trade tab
    takes `?symbol=`), `/app/event?id=` → the event, web-only games → the hub, `/call?id=` → the receipt, the old
    `/trade/BTC` → BTC (checked: 12 URLs). The share button sends the address (the `/watch` page is gone;
    `share-link.ts` deleted). The recovery row pointed at the deleted `/account` page — and nothing on the web could
    add a backup passkey since the 8 Oct cleanup: Settings → Recovery is back on the web (backup passkey with the
    encrypted copy and the recovery file, the phrase export behind a step-up; the 21st encrypted-text reveal restored),
    and the phone opens it in an in-app browser (a link to its own domain would come straight back to the app).
- [x] R2.14 Navigation:
  - Back on every sub-page (web `nav.ts` resolves every route's parent);
  - the rail reads Trade · Markets · Calls · Games · Earn · Leaderboard (Leaderboard appears in R8);
  - phone guests can reach Games, Events, Duel, Parlay, Earn and Wallet read-only.
  - *As built (10 Oct):* the rail is Trade · Markets · Calls · Games · Earn (keys 1–5, Everything 6), its seal Home;
    Games and Earn moved out of Everything; the small-screen dock keeps the phone's Home · Markets · Trade · Calls ·
    More. `backOf` gives every page a Back: deeper in a place to that place (Lucky → Games), Parlay, Duel and Events to
    Games (its hub lists them), an event to Events, setup to Home; none on a place's own page or on Trade. Checked in
    the browser. Phone: guests see the places open to them under the sign-up line (a `guest` flag in the shared nav:
    Games, Parlay, Duel, Events, Wallet, Earn, Status); the wallet is read-only for them (top-up, Receive and Withdraw
    ask for an account first, then come back), and its top-up row is no longer green.
- [x] R2.15 Signed-out drawers and screens get a Sign in button. Every disabled button says why.
  - *As built (10 Oct):* audited both apps (every drawer and screen signed out; every `disabled` in feature code).
    Web: a shared `SignInPrompt` replaces the bare sentences in Receive, Withdraw and One-tap, a guest's Settings, and
    Lucky, Events and the arcade; the phone's Lucky and Events get Sign in buttons, a guest's Settings a "Create
    account or sign in" row, and the session sheet a way in instead of an empty panel. Reasons: Withdraw and Earn say
    what Review waits for (`hint` beside `problem` in the shared checks: balance loading, address, amount, nothing
    supplied); the username field states the rule (`HANDLE_RULE`); Set exit says to set one first; Warm-up, One-tap
    (web and setup) and notifications setup say what is loading; the phone's account sheet says "Opening Senryo…",
    the profile editor "No changes yet", Share my trades "List your profile first", the one-tap chip "One moment…";
    Max shows only with a balance to spend (the phone's did nothing for a guest). Errors on Earn use `destructive`.
- [x] R2.16 Dead code: the 14 unused web components (06 §8), stale comments and route constants, and
  `lib/copy/diagnosis.ts` if still unused. The Everything drawer's search waits for R6.
  - *As built (10 Oct):* re-checked by import: 13 deleted (action-circle, amount-hero, list-row, page-header,
    slide-to-confirm, alert-toast, input, interactive-empty-state, number-flow, slider and its tooltip, vercel-tabs,
    mark-cluster — the basket cluster in `@senryo/identity` replaces it) with their three packages (`@number-flow/react`,
    `@radix-ui/react-slider`, `@radix-ui/react-tooltip`; the lockfile only loses them and what only they used).
    `reading.tsx` and `diagnosis.ts` are live again (Earn's failed state); `avatar.tsx` stays for R2.8's people. The
    web's `/app/account/` route constant (no page) is gone; the stale comments say what is true (five welcome scenes,
    the real setup order, the dock, the Settings rows).
- [x] R2.17 Web shell: splash, PWA install sheet and a "new version" toast (Owarine `Splash.tsx`, `InstallSheet.tsx`,
  `useAppUpdate.ts`).
  - *As built (10 Oct):* the splash on the first load of any `/app` page (the seal, SENRYO in the display face, a
    rising line in the accent; Tradash's 1.4 s / 3.5 s), with a CSS cap so it lifts even if the script never runs.
    Installable: `app/manifest.ts` (opens on `/app/`, the light ground, 192/512 icons from `brand/scripts/render.sh`)
    and an Install drawer (`?d=install`, in Everything → Account): the browser's prompt where held, else the steps for
    iOS or other browsers, or "Already installed". New version: the static export has no server routes, so the build
    writes `version.json` and the same id into the bundle (`scripts/build-id.mjs`); the page checks every five minutes
    and on return, and shows one persistent toast with Refresh when they differ. Checked: the export emits the
    manifest (linked from every page) and matching ids; the splash shows and lifts; the drawer opens.
- [x] R2.18 A11y: one h1 per page; `"use client"` where hooks are used; the HealthChip status dot replaced per D-237.
  - *As built (10 Oct):* every web route counted in the browser has exactly one h1 (20 routes): Home's duplicate
    "Call the next move" heading is "Markets" and a signed-in Home names itself; the terminal ("BTC · Bitcoin") and a
    shared call's page get a screen-reader h1 above their visual heroes. `TeamMark` was the one hook user without
    `"use client"`. The HealthChip is its word alone, toned ink / warn / muted — no dot, no pulse, never green.

## Handoff
(written at the end of the stage)
