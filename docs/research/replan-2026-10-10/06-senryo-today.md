# 06 — Senryo today: a surface-by-surface audit (10 Oct 2026)

Read-only audit of branch `codex/senryo-unified` at `b61d1932` ("wip(games): S8.8 engines, api and first screens").
Written for the replan after the owner's review of the web dev build. The owner likes: the sidebar (from Mitoshi),
Markets, the trade screen and the sounds. The owner dislikes: "the colour" (dark mode is fine, but it isn't the colour),
⌘K ("good but can be better"), the games ("don't feel like games", no logos, the spin looks bad, "slop"). Their rule:
logos everywhere.

**What I could not see.** This is a source audit. I did not run the web dev build, the phone simulator or any device,
and I took no screenshots. So the exact frames the owner saw, and runtime behaviour, are inferred from code and
config. Runtime claims are marked "unverified". One example: what the testnet does when a stock or basket market is
called, since its verifiers are not deployed. The sibling repo `../owarine` was read only for comparison.

Paths are relative to the repo root unless they start with `../`.

---

## 0. Verdict

The owner's three complaints share one cause. The web was built on the shared token package, and that package still
carries **Living Lacquer**: a Fomo-sampled indigo `#414EF4` on violet-black `#0A0911`, with a violet Practice
accent. The approved 7 Oct UGLYCASH plan retired that palette in so many words. The phone moved to UGLYCASH
(black/white, magenta `#FA00FF` accent, condensed display face); the web never did.

The games were ported as **mechanics without their presentation layer**:
- The real logic is there: engines, commit-reveal, replayed scores, contracts.
- What the reference (`../owarine`) puts on top was left out: art, reel sounds, result moments, music, logos.

So the reels are grey text, the arcade is a dot and some rectangles, and every game sound is a borrowed trading
"tap".

⌘K is a solid cmdk base: live prices and real marks on markets. But it is a static list with no recents, no
ranking, no previews and no trading actions, and the phone has no global search at all.

Outside those three, the most "unfinished" signals are:
- Duel, Events and Earn are dead ends on both apps, with engineering copy ("the next markets deploy").
- The judge guide says nothing on screen is a placeholder.
- The copy undersells the 34 markets as "BTC, ETH or SOL".
- Three of the four games are missing on the phone.

---

## 1. Top 20 problems, ranked by how unfinished or mediocre they make Senryo look

| # | Problem | Where (evidence) | Why a judge notices |
|---|---|---|---|
| 1 | **Web colour is the retired Living Lacquer, and web and phone look like two products.** Indigo `#414EF4` primary on violet-black `#0A0911`, violet Practice `#B69DF8`, indigo seal with an indigo glow. The phone uses black/white with a magenta `#FA00FF` seal, grey Practice and Roboto Condensed numbers. | `packages/tokens/src/palette.ts:91,97,123`; `packages/tokens/src/tokens.css:247-313`; `apps/web/src/app/layout.tsx:24` (`dark` hard-coded); `apps/web/src/styles/app-shell.css:97-107`; vs `apps/mobile/src/theme/native-palette.ts:4-104`, `apps/mobile/src/components/shell/Dock.tsx:150-154` | It's the owner's first complaint. The approved plan (`docs/plan/uglycash-revamp-2026-10-07.md:33`) says UGLYCASH "supersedes … dark-default Living Lacquer palette, violet/blue general action styling". |
| 2 | **Games have no art and no logos.** Lucky reels are grey text strings, Warm-up cards are a ticker in big text, the hub is text cards, and the arcade is a filled circle plus flat rectangles in a system font. | `apps/web/src/components/ui/slot-reel.tsx:97-112`; `apps/web/src/features/games/LuckyScreen.tsx:59-67`; `WarmUpScreen.tsx:57-65`; `GamesHub.tsx:18-43`; `arcade/draw.ts:22-26,94-111`; phone `apps/mobile/src/features/games/GamesScreen.tsx:33-57` | "Slop." The `EntityMark` logos used by Duel and Parlay are not used in any game. |
| 3 | **The Lucky spin is visibly broken as motion.** All three reels start and stop together (no stagger). Landing starts from rest on an ease-in-out, so it hitches. Landing distance is random. The strip reshuffles under a moving reel when `target`/`items` change. The loop jumps back every 2.4 s. The landed row only changes colour, and there is no reel sound. | `slot-reel.tsx:12-18,47-53,65-90`; phone `apps/mobile/src/components/kit/SlotReel.tsx` (same constants) | "The spin looks bad." The reference staggers its stops at 720/980/1240 ms, each with its own thunk, plus a 480 ms lock-in (`../owarine/web/src/features/games/lucky/LuckyReels.tsx`). |
| 4 | **No game-feel layer at all.** No game sounds: the cue set is trading-only, and on the phone ticks are silent by design. No result moment in any game, no new-best or streak celebration. The engine's `impact`, `scored`, `crashed`, `regained` and `milestoneHit` events are emitted and never read. | `packages/tokens/src/sound.ts:9,36-59`; `apps/mobile/src/feedback/sound.ts:11`; `packages/core/src/games/arcade/flap.ts:58-60,98-101,159`; `ride.ts:116-122`; no reader in `apps/**` | Owarine ships what's missing: `audio.ts` (10 CC0 effects plus a music bed in `bed.ts`), `lucky/reel-sfx.ts`, `art/PixelArt.tsx`, `arcade/sprites.ts`, `arcade-sfx.ts`, `LuckyResultModal.tsx`, `DuelResultModal.tsx`, `SeasonBanner.tsx` and `AchievementsPlate.tsx` (all under `../owarine/web/src/features/games/`). None of it was ported. |
| 5 | **Duel, Events and Earn are dead ends on the live network, on both apps,** with engineering copy. The Games hub links straight into them. | `apps/web/src/features/duel/DuelTiers.tsx:25-26`; `apps/web/src/features/events/EventsScreen.tsx:41-44`; `apps/web/src/features/earn/EarnScreen.tsx:59-61`; phone `DuelScreen.tsx:47`, `EventsScreen.tsx:43`, `EarnScreen.tsx:44`; testnet book `packages/contracts/src/addresses/10143.json` (only AccessManager, BandReserve, MarketCalendar, PythPrintVerifier, TestUSD, Windows) | "(the next markets deploy)" reads as unfinished. Earn has no failed state either. |
| 6 | **Logos missing where identity matters.** See the full list in §5. | QQQ/MSFT/AMZN gaps `packages/identity/src/entities.ts:247-261` show as a dashed ring with letters (`packages/identity/src/web/EntityMark.tsx:46-91`). Pyth has no art (`entities.ts:225`). RedStone, ESPN, theScore and the leagues aren't registered. No marks in Earn, web Wallet/Receive/Withdraw drawers, landing hero, `/proof/w`, toasts. Web has no avatars (`components/identity/avatar.tsx` is unused). | Violates the study's own acceptance rule: "no generic coin, dollar, hexagon or app-accent initial" (`docs/design/reference-study-2026-09-30/08-logos-and-identity.md:69-76`). |
| 7 | **The phone has 1 of the 4 games.** Warm-up, Line Rider and Candle Hop are filtered out; their phone routes in config resolve to Not Found, which redirects Home. | `apps/mobile/src/features/games/GamesScreen.tsx:13-14`; `packages/config/src/games.ts:33,41,49`; `apps/mobile/src/app/+not-found.tsx` | Asymmetric product. The plan wanted the arcade in Skia on the phone (`docs/plan/pivot-s8-social-games.md:96`). |
| 8 | **⌘K is a static list.** No recents or ranking, no previews, no trade actions. Its countdowns ignore market sessions, so closed stocks still show "closes in". It doesn't search events, calls or people. Its trigger is hidden on the terminal. The phone has no global search. | `apps/web/src/components/shell/CommandPalette.tsx:25-34,54-73,112-217`; `apps/web/src/styles/shell-parts.css:236-238`; the Markets list *is* session-aware (`features/markets/MarketList.tsx:4-5`) | The owner flagged it. Owarine's palette also lists events and opens from the phone's More search (`../owarine/web/src/components/shell/app/CommandPalette.tsx:15-33`). |
| 9 | **Public copy contradicts the product.** The judge guide says Range, Moonshot, stocks, baskets, Earn, proof, games and events are "not shown in the apps until they work — nothing on screen is a placeholder". The landing and Calls copy say BTC/ETH/SOL only. | `docs/judges.md:63-67` (rendered at `/judges`); `apps/web/src/app/page.tsx:118-119`; `apps/web/src/features/calls/CallsScreen.tsx:85`; `apps/mobile/src/features/calls/CallsScreen.tsx:107` | Judges read `/judges` first. |
| 10 | **Events look borrowed and explanatory.** Team logos are hot-linked from ESPN's feed outside the identity registry. League names are text, committee members are text, and "How it settles" plus terms hashes dominate. "Practice" is hard-coded. | `apps/web/src/features/events/TeamMark.tsx:10-31`; `services/keeper/src/events/sources/espn.ts:39,68-69`; `EventSide.tsx:13-38`; `EventDetail.tsx:66,70-164` | It reads as a feed wrapper, not a game. |
| 11 | **Three visual languages.** The landing is lavender-on-white (`#fdfcfe` paper, `#3c315b` ink, `#7463b6` focus, 400-weight headings at −0.055 em). The app is indigo on violet-black. The phone is UGLYCASH. | `apps/web/src/app/welcome.module.css:1-29`; `apps/web/src/features/landing/live-hero.css:1-16` | Landing → app → phone changes brand three times. |
| 12 | **Games and money places are hard to find.** The rail has 4 places (Home, Trade, Markets, Calls), but the plan said Trade · Markets · Calls · Games · Earn · Leaderboard. Games sits under Everything → Play. Game sub-pages have no Back. Phone guests can't reach Games, Events, Duel, Parlay, Earn or Wallet at all. | `packages/config/src/nav.ts:94-127`; plan `docs/plan/pivot-2026-10-08.md:241`; `apps/web/src/components/shell/nav.ts:73-75`; phone `apps/mobile/src/app/(tabs)/more/index.tsx:67-77` | The owner likes the sidebar; its content is thin. |
| 13 | **Settings and copy for features that don't exist:** leaderboard, invites, price alerts, "a stock market you watch". | `apps/web/src/features/setup/Setup.tsx:27`; `apps/mobile/src/app/account/notifications.tsx:29-38`; `apps/mobile/src/app/account/help.tsx:54`; S8.1–S8.3 unchecked (`docs/plan/pivot-s8-social-games.md:54-59`) | A switch for an absent feature is a tell. |
| 14 | **Phone Status is a placeholder screen:** "Service status arrives with the API". It is linked from More and Settings. | `apps/mobile/src/app/status.tsx:5-9`; `packages/config/src/nav.ts:54` | A literal placeholder. |
| 15 | **Broken links between web and phone.** Universal links still claim the old trading product's paths (`/portfolio`, `/positions`, `/card`, `/fund`, `/lp` …), so `/app/*` and `/call` don't open the app. The phone shares `${WEB_ORIGIN}/watch?…` and opens `${WEB_ORIGIN}/account/`, and neither page exists. A `/trade` deep link lands on Markets. | `apps/web/public/.well-known/apple-app-site-association` (dated 2 Oct); `apps/mobile/src/lib/share-link.ts:11`; `apps/mobile/src/app/account/recovery.tsx:111`; `apps/mobile/src/lib/deep-link.ts:21` | Shared receipts and profiles break. |
| 16 | **Duel has no opponent and no drama.** The opponent is a handle or short address with no avatar. Matchmaking is a text line. There is no versus intro, card flip or result moment. "Rating 1000" is hard-coded. | `apps/web/src/features/duel/DuelMatch.tsx:59-63,149-163`; `DuelScreen.tsx:79-99`; `DuelHistory.tsx:25`; phone `DuelScreen.tsx:144` | The match view has never rendered with real data ("unrendered until then", `pivot-s8-social-games.md:81`). |
| 17 | **Signed-out dead ends and silent disabled buttons.** Receive, One-tap and Withdraw drawers, Events and Lucky say "Sign in…" with no button. "Get test dollars", One-tap "Turn on", "Deal the cards", Max and Earn submit are disabled with no reason. | `apps/web/src/components/shell/drawers/ReceiveDrawer.tsx:36`; `OneTapDrawer.tsx:41,71`; `WithdrawDrawer.tsx:67`; `WalletDrawer.tsx:57`; `EventSide.tsx:46`; `LuckyScreen.tsx:163`; `WarmUpScreen.tsx:32`; `CallPanel.tsx:159`; `EarnScreen.tsx:186` | Each looks broken on a first visit. |
| 18 | **The web has no notifications inbox** (the phone has one with marks). Web result toasts are text-only sonner toasts with no market mark. | phone `apps/mobile/src/features/notifications/SubjectMark.tsx:15-46`; web `apps/web/src/lib/notify.ts:26-43`; `packages/calls/src/use-results.ts:74-87` | Results, the product's payoff, arrive as plain toasts. |
| 19 | **Game screens explain instead of play.** Lucky opens with "A sealed draw picks a market, a side and a reach · one real call" and exposes seal, server seed, client seed and digest. The arcade says "checked, not on chain · no money rides on them". Copy is joined with "·" throughout. | `LuckyScreen.tsx:57,181-209`; phone `LuckyScreen.tsx:132-137`; `ArcadeScreen.tsx:228-231`; `WarmUpScreen.tsx:27,99` | Proof belongs behind ⓘ (D-237: "no sentences on primary surfaces"). |
| 20 | **Dead code and stale design records.** 14 web components are imported nowhere (avatar, mark-cluster, number-flow, slide-to-confirm …). Both `.21st/design.json` files still name "Living Lacquer". The web theme provider cites the retired D2. The tracked-uppercase "SENRYO" breaks the type rule, and the arcade HUD uses `system-ui`. | §8 list; `apps/web/.21st/design.json`, `apps/mobile/.21st/design.json` (`direction.name`); `apps/web/src/components/shell/theme-provider.tsx:6`; `apps/web/src/styles/app-shell.css:111` vs `packages/tokens/src/scale.ts:5`; `arcade/draw.ts:21-22` | It breaks the owner's "one implementation per capability" and cleanup rules. Records that disagree mislead the next agent. |

Two more risks stayed out of the ranking because I couldn't verify them at runtime:
- **Calls on non-crypto markets.** The catalogue lists 34 markets, but the testnet has only the crypto
  `PythPrintVerifier`. Equity, basket and RedStone markets need verifiers that aren't deployed
  (`packages/config/src/pool-terms.ts:64-70`). A judge tapping NVDA or TECH could hit a failing or unpriced call.
- **No leaderboard or social layer exists yet** (S8.1).

---

## 2. Design foundations as shipped

### 2.1 Colour: three palettes in one product

| Surface | Source | Ground | Raised | Primary / action | Accent / mode | Default theme |
|---|---|---|---|---|---|---|
| **Web app, dark** | `packages/tokens/src/palette.ts:90-155` → `tokens.css:247` (`:root, .dark`) | `#0A0911` violet-black | card `#13121A`, popover `#191822`, secondary `#201E2B` | `#414EF4` indigo, pressed `#343ED3` | accent `#1B2040` / `#8B95FF`; link and ring `#8B95FF`; Practice `#B69DF8` violet; Mainnet `#8B95FF` blue; chart series blue · violet · cyan · rose · silver | **Dark**, forced: `layout.tsx:24` puts `dark` on `<html>`; `theme-provider.tsx:9-15` sets `defaultTheme="dark"` with no system follow |
| **Web app, light** | `palette.ts:158-223` → `tokens.css:313` (`.light`) | `#F5F4F8` lavender-grey | `#FFFFFF`, secondary `#ECE9F2` | `#414EF4` | accent `#E8EBFF` / `#3643D8`; Practice `#7049C8`; Mainnet `#3643D8` | Toggle in the top bar, Settings drawer and ⌘K |
| **Phone, light** | `apps/mobile/src/theme/native-palette.ts:4-47` (overrides the shared LIGHT) | `#F5F5F5` | `#FFFFFF`, secondary `#ECECEC` | **`#000000` black** | **`#FA00FF` magenta** (`NATIVE_SCENE.action`, `:93-104`); link `#99009C`; Practice `#666666` grey; Mainnet black | **Light** for new installs (`apps/mobile/src/theme/index.tsx:23-28`); splash and background `NATIVE_LIGHT` (`apps/mobile/app.config.ts:36,53,74`) |
| **Phone, dark** | `native-palette.ts:50-90` | `#111111` | `#1C1C1C`, secondary `#292929` | **`#F5F5F5` white** | magenta `#FA00FF`; link `#FF75FF`; Practice `#B8B8B8` | Kept as an explicit choice |
| **Landing `/`** | `apps/web/src/app/welcome.module.css:1-29` (local literals) | `#fdfcfe` paper | lavender `#e2dffe` | ink `#3c315b`, focus `#7463b6` | Live hero card forced to dark lacquer (`features/landing/live-hero.css:1-16`) | Light only; no toggle |

Shared across both apps: up `#25CF68`/`#087F3C`, down `#FF5A48`/`#C83225`, gold `#D4AE5B`. Kinpaku foil and lacquer
ramps and the welcome sky `#428FC8` live in `packages/tokens/src/marks.ts:7-42`. The share card uses the sky on both
apps.

**Where the indigo and violet come from.**
1. The 30 Sep reference study sampled Fomo: background ≈ `#0A0911`, blue action ≈ `#414EF4`
   (`docs/design/reference-study-2026-09-30/04-motion-and-assets.md:108`), and F09's Deposit button
   (`docs/design/senryo-v2/controls-consult-2026-10-01.md:37,45`).
2. `docs/design/senryo-v2/direction.md:10,20,37,50` adopted "Fomo's … dark violet surfaces" and the blue action as
   **Living Lacquer** (D-168). The Codex consult filled the rest (`tokens-consult.md:19`, D-191). D-172 made
   "practice = violet, mainnet = blue".
3. These values sit in `packages/tokens/src/palette.ts` (the "single source … for web and mobile") and are emitted to
   `tokens.css`.
4. `apps/web/src/app/globals.css:3,21` maps them to Tailwind. So `bg-primary` (26 uses in web TSX), `text-primary`,
   the rail and top-line seal disc with its glow (`app-shell.css:97-107`), the dock seal (`shell-parts.css:193-201`)
   and text selection (`globals.css:187-190`) are all indigo.
5. The phone escaped only because `apps/mobile/src/theme/native-palette.ts` overrides the shared palette locally. Its
   comment reads "Kept separate from the web's historical palette".

### 2.2 Do the colours follow the documents? Phone yes, web no

- **UGLYCASH plan, approved 7 Oct ("lgtm")**, `docs/plan/uglycash-revamp-2026-10-07.md`:
  - `:5`: "adopt the supplied UGLYCASH native visual and interaction system across Senryo … This includes the
    background colors."
  - `:33`: "UGLYCASH supersedes the conflicting … dark-default Living Lacquer palette, violet/blue general action
    styling …"
  - `:63-76`: canvas `#F5F5F5`, cards `#FFFFFF`, black primary, `#FA00FF` accent. The dark option is kept as an
    adaptation, and "old purple styling is not the target" (`:76`).
  - `:236`: stage 8 "Web companion parity … shared tokens".
  - `:242`: "trace all package/web consumers".
- **Pivot plan, approved 8 Oct**, `docs/plan/pivot-2026-10-08.md`: `:57` lists UGLYCASH as the reference for "Look
  and flows"; `:269` says "keep the UGLYCASH design direction"; `:261` says the phone keeps sheets "because UGLYCASH,
  the chosen reference, is built on them".
- **Tradash study**, `docs/design/reference-study-2026-10-07-uglycash/tradash.md:3`: "UGLYCASH owns Senryo's visual
  identity".
- **`docs/plan/decisions.md`:**
  - The only colour decisions are D-060 (old D2 marks), D-168 (Living Lacquer replaces D2) and D-191 (Living
    Lacquer tokens).
  - D-196 (`:207`) rebuilt controls from the Fomo frames, with "no border around cards …".
  - "UGLYCASH" appears once, in D-269 (`:371`), for phone sheets only.
  - **No decision applies UGLYCASH colour to the web, and none re-approves Living Lacquer for it after 7 Oct.** S6
    (`docs/plan/pivot-s6-web.md`) has no colour item, so the web simply inherited the shared package.
- **Design records are stale on both apps:**
  - `apps/web/.21st/design.json` and `apps/mobile/.21st/design.json` still say `direction.name: "Living Lacquer"`.
  - The phone code is UGLYCASH.
  - `docs/design/reference-study-2026-09-30/README.md:1-8` correctly marks itself superseded by D-168, but carries no
    banner pointing on to UGLYCASH.

**Verdict.** The phone follows the latest approved identity. The web app and the landing do not: the web shows the
palette the approved plan names as superseded, and the landing has a third, lavender palette of its own. The owner's
"it's not the colour" matches this exactly.

### 2.3 Typography

- **Web:** one Inter 4.1 variable file (Latin subset, 400–700). Its opsz axis gives Inter Display at large sizes
  (`apps/web/src/app/fonts.ts:3-17`), with Noto Sans JP subset (`:19-29`). There is no condensed display face.
- **Phone:** Inter 400–700, Inter Display SemiBold, and **Roboto Condensed Black for every `display` role**: balances,
  prices, page titles (`apps/mobile/src/theme/type.ts:21`, `apps/mobile/src/theme/fonts.ts:5-12`). It is declared as
  "not a claim of UGLYCASH's source font" (`packages/tokens/src/fonts.ts`). So the same number is condensed 900 on
  the phone and Inter Display 600 on the web.
- **Scale:** shared type roles live in `packages/tokens/src/scale.ts:31-75`: display balance 52, margin 64, price 40,
  page title 32, rows 16–17, meta 12, tabular lining figures for money. The rule is "sentence/title case with no
  tracked uppercase" (`:5`).
- **Exceptions to that rule and the font:**
  - The web rail word "SENRYO" is weight 800 with 0.14 em tracking (`apps/web/src/styles/app-shell.css:108-112`).
  - The landing uses weight-400 headings at −0.055 em (`welcome.module.css:22-28`).
  - The arcade HUD is drawn in `ui-sans-serif, system-ui` (`apps/web/src/features/games/arcade/draw.ts:21-22`).

### 2.4 Motion constants

- **Tokens:** `packages/tokens/src/scale.ts:121-204`, emitted as CSS variables in `tokens.css`.
  - Press 100 ms to scale 0.97, release 160 ms.
  - Selection 170, page push 320.
  - Sheets 480 in / 240 out on `cubic-bezier(0.32,0.72,0,1)`, with the parent stepping back to 0.96.
  - Stagger 40 ms per item, 320 ms per item, 10 pt rise.
  - Number change 160, chart reveal 750, completion foil 800, onboarding scene 850.
  - Ordinary ease `cubic-bezier(0.2,0.8,0.2,1)`.
  - Springs: compactSelector, tallDetail, fan/fanLead, dockActive, rulerSnap, sheetRelease, dockBubble.
  - Web layout: rail 248/88, drawers 384/560, drawer 380/240 ms.
- **Phone:** maps these to Reanimated 4 (`apps/mobile/src/theme/motion.ts`).
- **Web reduced motion:** cuts every animation to 0.01 ms (`globals.css:193-202`).
- **No game motion vocabulary:** no reel spin and stop, lock-in, win burst, shake, flash, count-up, versus intro or
  flip tokens. Each game hard-codes its own (`slot-reel.tsx:12-18`, `swipe-deck.tsx:13-27`).

### 2.5 Sound

- **Ten synthesised cues for both apps,** defined in `packages/tokens/src/sound.ts`: tap, open, close, win, loss,
  profit, adverse, slump, surge, mega. There is also a pentatonic profit ladder (`:78`). They are Tradash-measured
  contours on sine and triangle voices.
- **Web:** synthesises them live through Web Audio (`apps/web/src/lib/feedback/sound.ts`). One `fire()` entry point
  is loaded on idle (`apps/web/src/lib/feedback/index.ts:86-100`).
- **Phone:** plays rendered WAVs (`apps/mobile/assets/sounds/trade/*.wav`, including `profit-0…10`). It adds
  deposit, error, onboarding, scene, send and unlock sounds in three variants each, picked in Account → Sounds
  (`apps/mobile/src/features/sounds/SoundPicker.tsx`). Ticks and navigation are silent by design; haptics cover them
  (`apps/mobile/src/feedback/sound.ts:11`).
- **Gaps:** there are **no game cues** (spin-up, reel ratchet, reel stop, jackpot, near-miss, duel win/lose, flap,
  score, crash) and **no music bed**. Tradash has background music; Owarine has `bed.ts`.
- **Trading sounds are what the owner likes,** and they are well built. Games reuse them as `fire("tick", { cue:
  "tap" })` and `fire("filled", { cue: "open" })`.

---

## 3. Web inventory (`apps/web/src/app/**`)

**Shell:** `apps/web/src/app/app/layout.tsx` → `components/shell/AppShell.tsx:16-43`.
- **Rail** (`Rail.tsx`; Mitoshi S22, 21st animated-sidebar pill): seal and "SENRYO", Home · Trade · Markets · Calls
  on keys 1–4, and Everything on key 5. It is hidden under 768 px.
- **TopLine** (`TopLine.tsx`): Back (four places only), Search ⌘K, Health/Mode/Balance chips (`chips.tsx`), the `?`
  shortcuts modal, the theme toggle, and the session chip. On the terminal it is `display:none`
  (`styles/shell-parts.css:236-238`).
- **MobileDock** (`MobileDock.tsx`): Home · Markets · [seal = Trade] · Calls · More.
- **Overlays:** right drawers in the URL (`?d=`; `DrawerHost.tsx`, `drawers/{Account,Call,OneTap,Receive,Settings,
  Wallet,Withdraw}Drawer.tsx`) and Everything (`EverythingDrawer.tsx`, with its own nav search).
- **Hosts:** `LiveHost`, `ResultHost` (win/loss cue, confetti, toast), `ConfettiHost`, `ToasterHost` (sonner).

| Route | Shows | Main components | Logos | Unfinished signals |
|---|---|---|---|---|
| `/` | Landing: live BTC 1m hero with Up/Down odds, 3 "how it works" scenes (lacquer/gold art), Practice, Proof, FAQ, sign-in | `app/page.tsx`, `features/landing/LiveHero(Island).tsx`, `SignInIsland.tsx`, `components/public/landing-menu.tsx` | Seal image; hero says "BTC · 1m" in text (`LiveHero.tsx:32`) | "Bitcoin, Ethereum and Solana" (`page.tsx:118-119`); proof links to `/judges/`, not `/proof/` (`:212`); iPhone beta is a mailto; lavender palette |
| `/app` | Balance, one-tap chip, open calls, market list (signed out: "Call the next move" plus Create account) | `features/home/HomeScreen.tsx`, `OneTapChip.tsx`, `features/markets/MarketList.tsx` | Yes (`HomeScreen.tsx:41`, `MarketList.tsx:39`) | Signed out repeats "Call the next move" as h1 and h2; no games/events entry point |
| `/app/markets` | Search, kind filter, grouped rows (mark, symbol, session-aware line, live price), skeleton, retry | `MarketList.tsx`, `ui/segmented-control.tsx` | Yes, 40 px; QQQ/MSFT/AMZN show dashed letter rings | — (owner likes it) |
| `/app/trade/[symbol]` | Full-stage canvas chart, window tabs 1m–1h with countdown, call panel (Up/Down · Range · Moonshot, presets, keypad, Max), Cash out / part / exits, crowd split, basket members, reactions, confetti | `features/terminal/{TerminalScreen,TerminalTop,CallPanel,StakeModal,CashOutModal,ExitModal,CrowdLine,BasketMembers,ReactionOverlay}.tsx`, `chart/LiveChart.tsx` | Yes (`TerminalTop.tsx:42`, `BasketMembers.tsx:21`) | No top bar, so no visible search, theme or account; Max disabled without a reason (`CallPanel.tsx:159`) |
| `/app/calls` | Record line, filters, rows → receipt drawer (timeline, window proof, share card) | `features/calls/{CallsScreen,CallReceipt,CallTimeline,WindowProof,ShareCallButton}.tsx`, `share-card.ts` | Yes (rows, receipt, share card) | Empty state "BTC, ETH or SOL" (`CallsScreen.tsx:85`) |
| `/app/games` | 4 text cards (Lucky, Warm-up, Line Rider, Candle Hop) plus a text list for Duel, Parlay, Events | `features/games/GamesHub.tsx`, `packages/config/src/games.ts` | **None** | No art or icons; links into dead-end Duel and Events |
| `/app/games/lucky` | 3 text reels (Market, Side, Reach), deal panel, stake chips, Spin / Call it, proof `<details>`, "Your draws" | `LuckyScreen.tsx`, `ui/slot-reel.tsx`, `@senryo/calls` `useLuckyFlow` | **None** | Hard-coded fallback reel `["BTC","ETH","SOL","NVDA","XAU"]` (`:61`); "Sign in to spin." with no button; no Back |
| `/app/games/warm-up` | Deal 5 live cards, swipe Up/Down, watch, scored against a coin flip | `WarmUpScreen.tsx`, `ui/swipe-deck.tsx` | **None** (big ticker text) | Disabled "Deal the cards" with no reason; static result list |
| `/app/games/line-rider`, `/candle-hop` | 16:9 canvas run, score overlay, top-10 board | `arcade/ArcadeScreen.tsx`, `arcade/draw.ts`, engines `packages/core/src/games/arcade/*` | **None** | Dot and rectangles, system font; no Back |
| `/app/duel` | Tier rows, Find a duel, queue line, match (clock, swipe deck, card rows, totals), history and rating | `features/duel/{DuelScreen,DuelTiers,DuelMatch,DuelHistory}.tsx`, `ui/{swipe-deck,progress-bar}.tsx` | Cards yes (`DuelMatch.tsx:104,190`); players and tiers no | "Duels open when the arena is on chain (the next markets deploy)"; "Rating 1000" hard-coded |
| `/app/parlay` | Picker (window tabs, search, Up/Down per market), slip (legs, odds, stake, payout), your parlays | `features/parlay/{ParlayScreen,ParlayPicker,ParlaySlip,ParlayList}.tsx`, `ui/odds-display.tsx` | Yes (picker, slip, list) | No loading, error or no-match state in the picker; the list is empty for guests |
| `/app/events` | League line, question cards (Yes/No split), side panel "How it settles", your calls | `features/events/{EventsScreen,EventCard,EventSide,TeamMark}.tsx`, `ui/prediction-market-card.tsx` | ESPN `<img>` via `TeamMark` | "Events open when the event book is on chain (the next markets deploy)."; "Practice" hard-coded; "Sign in to call." with no button |
| `/app/event?id=` | Question, rule, dates, terms hash, committee statements with re-hash checks | `EventDetail.tsx` | Team marks only | A bad id shows one sentence with no link and no h1 |
| `/app/earn` | Share, pool stats, hour-by-hour, pending requests, supply/withdraw, risk | `features/earn/EarnScreen.tsx` | **None** (no USDC or pool mark) | Whole page is "Earn opens with the next deploy on this network." |
| `/app/setup` | Handle → terms → test dollars → first call → one-tap, with progress | `features/setup/Setup.tsx`, `HandleStep.tsx` | None | "…and the leaderboard" (`:27`): no leaderboard exists |
| `/call?id=` | Public receipt | `features/calls/PublicCall.tsx`, `components/public/public-header.tsx` | Receipt yes; header is a text wordmark | The header links only the judge guide |
| `/proof` | Window feed with calls | `features/proof/ProofFeed.tsx` | Market marks; no Pyth mark | Reachable only via Everything and receipts |
| `/proof/w` | Opening and closing prints with in-browser Re-verify, bands, calls | `features/proof/WindowPage.tsx` | **None** (text title) | Re-verify silently no-ops if the market is unknown (`:27-28`) |
| `/judges` | `docs/judges.md` rendered | `app/judges/page.tsx`, `components/public/markdown.tsx` | Text wordmark | The "5. Not yet" section contradicts the UI |
| `/privacy`, `/terms` | Legal documents | `components/legal/legal-document.tsx` | Text wordmark | — |

---

## 4. Phone inventory (`apps/mobile/src/app/**`)

**Navigation:** a custom icon-only glass `Dock` (`components/shell/Dock.tsx`) over hidden expo-router tabs:
Home · Markets · [magenta seal = Trade] · Calls · More (`app/(tabs)/_layout.tsx:13-38`). Everything else is a root
stack page that covers the dock. Sheets are `transparentModal` (`app/_layout.tsx:37,78-97`).

Games, Duel, Parlay, Events, Earn and Wallet are reachable only from More (`MORE_NAV`). More lists them only when
signed in (`(tabs)/more/index.tsx:67-77`). Home, Markets, Trade and Calls never link to them.

| Route | Shows | Logos | Unfinished signals |
|---|---|---|---|
| `(tabs)/home` | "Senryo" text title, mode capsule, bell, rolling balance, one-tap chip, setup resume, open calls, market list | Market rows yes; title is text, not the seal | — |
| `(tabs)/markets` | Search, kind filter, grouped rows | Yes | QQQ/MSFT/AMZN letter rings |
| `(tabs)/trade` | Terminal: top, Skia live chart, crowd line, basket members, call panel; Stake/CashOut/Exit/Markets sheets | Yes | — |
| `(tabs)/calls`, `calls/[ticketId]` | Record, filters, rows; receipt with timeline, window proof, share card | Yes | "BTC, ETH or SOL" (`CallsScreen.tsx:107`); bad id "No such call" with no action |
| `(tabs)/more` | Profile header (avatar, handle, bio) and the More list | Avatars yes; rows are generic glyphs | Guest line says "have a profile" but the button says "make a call" |
| `games/index` | **Lucky card only**, plus Duel, Parlay, Events rows | None | 3 of 4 games filtered (`GamesScreen.tsx:13-14`) |
| `games/lucky` | 3 text reels, deal, stakes, Spin / Call it, proof line, draws | None | Same reel defects as web; haptic-only spin |
| `duel` | Tiers, find, queue, match, history | Cards yes; opponent no | "…on chain (the next markets deploy)"; "Rating 1000" (`:144`) |
| `parlay` | Lane selector, search, rows with Up/Down, slip sheet, list | Yes | — |
| `events`, `events/[id]` | League line, cards, how it settles, your calls; detail with committee | ESPN logos via `expo-image` | "…on chain (the next markets deploy)."; "Practice" hard-coded (`:106`, `EventDetailScreen.tsx:49`) |
| `earn` | Share, pool, hour-by-hour, supply/withdraw | None | "Earn opens with the next deploy."; no failed state |
| `wallet` | "Practice · Test USD" balance, Get test dollars, Receive, Withdraw, 3 locked "Add real money" rows | **Generic glyphs even for USDC and MON** (`WalletScreen.tsx:76-78`) | Inert locked rows; "Practice · Test USD" hard-coded |
| `notifications` | Push banner, inbox Today/Earlier | **Yes** (`SubjectMark`: market, token, avatar, seal) | Renders `null` while loading |
| `status` | **Placeholder** "Service status arrives with the API" | — | Linked from More and Settings |
| `welcome` | Five layered authored scenes on the sky, Create / I have an account / Look around | Authored art, passkey glyph | — |
| `setup/*` | handle (text "SENRYO" wordmark, `body=""`), dollars, first-call (terminal plus coach), one-tap, notifications primers | Seal on one-tap | Empty step body (`setup/handle.tsx:117`) |
| sheets | account-required, network (chain marks), receive (chain mark, dotted QR), session, step-up, terms, withdraw | Chain marks on network and receive | "Sending from another chain? ›" pushes Home (`receive.tsx:36`); "Test USD to a Monad address" hard-coded (`WithdrawSheet.tsx:65`) |
| `account/*` | settings, preferences, sounds, notifications (4 channels), profile, identity, security, recovery, help, diagnostics, delete-data, legal | Help: seal, Pyth/Envio/DB-IP (Pyth shows a text fallback) | Channels for alerts, invites and leaderboard that don't exist; "Backup passkey" opens a web `/account/` page that doesn't exist |

**Parity gaps.**
- **Web only:** Warm-up, Line Rider, Candle Hop, `/proof` feed, `/proof/w` (the phone links out), `/judges`.
- **Phone only:** notifications inbox, status, profile/avatars, security, recovery, help, diagnostics, sound picker.
- **Deep links:** `/trade` maps to Markets (`apps/mobile/src/lib/deep-link.ts:21`), and AASA doesn't claim
  `/app/*`, `/call` or `/proof`.

---

## 5. Logos

### 5.1 How marks are sourced and rendered

- **Registry:** `packages/identity` (D-170). Entities are keyed by what they are (`src/ids.ts:16-37`: chain, token by
  chain and contract, `market:`, `equity:`, `fx:`, venue, provider, exchange, brand). Each points at one artwork
  record with provenance: first-party, public-domain, senryo-original, open-library or venue-metadata
  (`src/types.ts:45`).
- **Acquisition:** 57 source folders in `packages/identity/sources/`, fetched by script (`scripts/fetch-marks.ts`,
  `fetch-commons.ts`, `catalog.ts`). They go through an SVG pipeline and codegen into web and native components
  (`src/web/EntityMark.tsx`, `src/native/EntityMark.tsx`).
- **Invariant:** `identity-provenance` re-hashes each file. Commodity art is original (XAU koban, XAG chōgin), and
  FX uses flag pairs.
- **Market symbol to id:** `marketId(symbol)` (`src/lookup.ts:35-40`). It contains a hard-coded equity list, and EUR
  is the only FX entry.
- **Rendering:** `EntityMark` draws the art at a variant (disc, symbol, mono, wordmark), with a theme plate where
  contrast needs one. With no art, it draws a **dashed ring with up to N letters** (`src/web/EntityMark.tsx:46-91`;
  `src/theme.ts:35-38`). App wrappers: web `apps/web/src/components/identity/entity-mark.tsx`, phone
  `apps/mobile/src/components/identity/EntityMark.tsx` plus `theme/identity.ts`.
- **Event teams bypass the registry.** `TeamMark` loads ESPN's `logo` URL straight from the keeper's feed
  (`services/keeper/src/events/sources/espn.ts:39,68-69`), falling back to the abbreviation. That means no
  provenance, no hash and a runtime dependency on ESPN's CDN.
- **Docs:** `docs/design/reference-study-2026-09-30/08-logos-and-identity.md` sets the contract (asset-delivery
  rules at `:40-55`, acceptance at `:69-76`).

### 5.2 Registry gaps

| Gap | Effect |
|---|---|
| QQQ, MSFT, AMZN listed; no art. Researched dead ends are recorded in `entities.ts:243-262` | Dashed letter rings in Markets, ⌘K, Home, Parlay, Duel, receipts |
| Pyth: `org(ids.provider("pyth"), …, undefined, "first-party artwork via scripts/catalog.ts (S2)")` (`entities.ts:225`) | The oracle the whole product rests on has no mark; phone Help shows letters |
| RedStone, ESPN, theScore, NHL/MLB/NFL/EPL and leagues: not in the registry | Events and proof show these names as text |
| Baskets MAJORS, ALTS, METALS, TECH share one neutral `basket` glyph (`entities.ts:129-135`) | The basket rows look identical (members show on the terminal) |
| No game or illustration marks (dice, reel faces, bull/bear, coin, trophies, tiers) | Games have nothing to draw. Owarine has `art/PixelArt.tsx` (Bull, Bear, Coin) |

### 5.3 Where a logo should be, and isn't

| Surface | Web | Phone | Should show |
|---|---|---|---|
| Markets, Home rows, terminal, receipts, share card | Yes | Yes | — |
| ⌘K market rows | Yes | No palette | — |
| Parlay picker, slip and legs | Yes | Yes | — |
| Duel cards | Yes | Yes | Also opponent avatar and tier badge (both missing) |
| **Lucky reels and history** | **No** | **No** | Market mark on the market reel; bull/bear or arrow art on side; a reach plate |
| **Warm-up cards and result rows** | **No** | — | Market mark |
| **Games hub cards** | **No** | **No** | Game key art; the market marks a game uses |
| **Arcade** | **No** | — | The market whose candles you hop, as the "bird" or the stage |
| Events teams | ESPN hot-link | ESPN hot-link | Registry-backed team and league marks; committee source marks (ESPN, theScore, league) |
| **Earn** | **No** | **No** | USDC / Test USD mark, pool seal |
| **Wallet / Receive / Withdraw** | **No** (drawers) | Wallet **no** (generic glyphs); Receive yes (chain) | USDC / Test USD, Monad, MON |
| **Notifications / result toasts** | **No** (sonner text) | Yes (`SubjectMark`) | Market mark on every result |
| **Landing live hero** | **No** ("BTC · 1m" text) | — | BTC mark |
| **Proof window page** | **No** | Links out | Market mark and Pyth mark |
| **People** (duel opponent, handles) | **No** (`avatar.tsx` unused) | Avatars in More and Profile only | Avatar everywhere a person appears |

---

## 6. ⌘K

### 6.1 How it's built

- **Component:** `apps/web/src/components/shell/CommandPalette.tsx` (224 lines). It is 21st.dev 382
  `originui/command` (cmdk) inside a Radix Dialog, centred, 600 px wide at 12 vh (`styles/command.css`).
- **Loading:** lazy, on first open (`TopLine.tsx:19,111`).
- **Open keys:** ⌘K / Ctrl+K toggle, and `/` opens it (`TopLine.tsx:46-64`). `?` opens the shortcuts modal
  (`ShortcutsModal.tsx`).

### 6.2 What it searches and does

- **Markets:** every catalogue market, as a row with `EntityMark` (28 px), symbol, name, "1m · closes in m:ss" and
  the streaming price (`:54-73`).
- **Go to:** the 4 rail places (`:124-142`).
- **Every Everything section:** Play, Money, Records & proof, Account, Learn (`:143-163`).
- **Actions:** hide/show balances, sound, vibration, theme (`:164-217`).
- **Filter:** every typed word must appear somewhere in the row's value or keywords, scoring 1 or 0 (`:25-34`).

### 6.3 Gaps against a best-in-class palette

1. **No recents or frecency.** An empty query is a static dump: all 34 markets, then every place. There is no
   "last market", "open calls" or "continue". The UGLYCASH search study expects recents to be kept
   (`docs/design/reference-study-2026-10-07-uglycash/flows.md:59-63`).
2. **No ranking.** The binary score keeps group order fixed. There's no prefix or symbol boosting and no typo
   tolerance ("bitcon" finds nothing).
3. **Market rows are thin, and partly wrong.**
   - The countdown always uses the 1-minute lane and `windowCountdown` without the market calendar (`:56-57,65`). A
     closed stock shows "closes in"; the Markets list uses the session-aware `useMarketLine`.
   - No change %, direction colour or sparkline, no kind label or grouping (crypto / stocks / metals / FX / baskets),
     no closed state.
4. **No trading actions.** You can't "Call BTC Up $5", "Cash out all", "Switch to 5m", "Spin Lucky", "Copy my
   address", "Share last receipt", "Sign in" or "Turn on one-tap". The four actions are all preferences.
5. **Missing entities.** You can't search calls/receipts (by id or market), open calls, events (teams, leagues),
   duels, parlays, proof windows, people/handles or help. Owarine's palette includes events.
6. **No preview pane.** Nothing like a mini chart, odds or an open position for the highlighted market.
7. **Keyboard.** cmdk's ↑/↓/↵ with loop, and Esc. There are no per-row shortcut hints, no footer legend, no nested
   pages (market → window → side), no ⌘↵ alternate action, and no group jumping.
8. **Platform.**
   - The trigger reads "⌘K" even on Windows and Linux (`TopLine.tsx:87-89`).
   - The trigger is invisible on the terminal: the top bar is `display:none`, though the key still works.
   - **The phone has no global search.** UGLYCASH U10 defines one: a floating trigger, full-page search, grouped
     Tokens / Predictions / Users (`flows.md:59-63`). Owarine opens its palette from the phone More sheet.
9. **Two search systems on the web.** ⌘K, plus the Everything drawer's own `searchNav` (`EverythingDrawer.tsx:25`).

---

## 7. Games: generic versus game feel

The full per-game evidence is condensed here. For every mode below, the engine or contract is real and the
presentation is generic.

| Mode | Platforms | Engine (real?) | Art | Motion | Sound | Reward / juice |
|---|---|---|---|---|---|---|
| **Lucky** | Web and phone | Server commit-reveal (`services/api/src/games/lucky.ts`; `packages/core/src/games/lucky.ts:46-57`); one real call via relay (`packages/calls/src/use-lucky.ts:141-163`) | Text strings in a grey box; landed row turns primary | Defects listed in §1 #3 | Web: a "tap" on spin and "open" on place, nothing at land. Phone: haptics only, three overlapping ticks at land | Streak as a text line; history says only "called / not called" though win/loss is computed (`use-lucky.ts:166-171`); no reveal, near-miss or jackpot |
| **Warm-up** | Web only | Client vs FNV coin flip (`packages/core/src/games/warm-up.ts:88-99`) | Ticker text card | Swipe deck is the best motion here (spring 260/34, tilt 8°, stacked depth; `swipe-deck.tsx:13-27`) | A tap per swipe; nothing at result | "You beat the coin · 3–2" heading and rows |
| **Line Rider** | Web only | Deterministic engine plus server replay (`packages/core/src/games/arcade/ride.ts`, `services/api/src/games/arcade.ts`) | 3 px polyline, 7 px dot, a 120×6 grip bar | Fixed-step loop is solid; `regained` and `milestoneHit` ignored | Start tap; end is haptic only (silent on desktop) | Score overlay, text top-10 |
| **Candle Hop** | Web only | Same (`flap.ts`) | An 11 px dot as the "bird" (the engine defines 46×32); flat rects | `impact`, `scored` and `crashed` ignored, so no shake, flash or particles | Same as Line Rider | Same as Line Rider |
| **Duel** | Web and phone | `DuelArena` (not deployed) | Market marks on cards; players are text | Swipe deck and pick clock; queue is a text line | Trading cues only | "Rating 1000 · 0–0" text; no versus or result moment; no confetti, since arena-owned picks probably aren't the user's tickets (unverified) |
| **Parlay** | Web and phone | `ParlayBook` (not deployed) | Market marks | Colour transitions only; odds "flagged, never animated" (`odds-display.tsx:3`) | Trading cues | P&L text; no leg-by-leg reveal |
| **Events** | Web and phone | `EventBook` plus a three-signer committee (not deployed) | ESPN team logos | Card spring (300/30), split-bar width transition | "Open" cue | In-card receipt; no settlement moment |

**Root cause.** The reference these games were ported from already has the game layer; it was not brought over.
Owarine's `web/src/features/games/` has:
- `audio.ts`: Kenney CC0 effects through Web Audio, with separate effects and music sliders.
- `bed.ts`: a sequenced chip music bed.
- `lucky/reel-sfx.ts`: spin-up sweep, ratchet, a landing per reel climbing a chord, confirm, verdict stings.
- `lucky/LuckyReels.tsx`: CRT reel faces with asset discs and pixel Bull/Bear/Coin marks, staggered stops
  720/980/1240 ms, a 480 ms lock-in.
- `LuckyResultModal`, `DuelResultModal`, `SeasonBanner`, `AchievementsPlate`, `GameCard`, `GameProfileCard`,
  `HowToSheet`.
- `arcade/sprites.ts`, `arcade-sfx.ts`, `palette.ts`.

Senryo's port (`apps/web/src/features/games/`, about 730 lines) kept the hub, Lucky, Warm-up and one arcade screen.
Senryo also already owns illustrated lacquer and gold art (`apps/mobile/assets/onboarding/scene-*`,
`apps/web/public/brand/website/scene-*.webp`) that no game uses.

---

## 8. Consistency, dead ends and placeholder copy (beyond the top 20)

- **Mode identity differs by app.** Practice is violet `#B69DF8` on web and grey `#666666`/`#B8B8B8` on the phone;
  Mainnet is blue vs black/white. The web `HealthChip` uses a status dot (`chips.tsx:84`), against D-237's "no
  status dots".
- **Back navigation.** The web Back button resolves only the four rail places (`components/shell/nav.ts:73-75`), so
  Games sub-pages, Duel, Parlay, Events and Earn have none.
- **Hard-coded "Practice".** In Events (both apps), phone Wallet (`:61`), and phone Withdraw (`WithdrawSheet.tsx:65`).
- **Landing and judges.**
  - The landing never links `/proof/`.
  - `/judges` and `/call` use a text wordmark, not the seal.
  - Real mode "opens with mainnet" in several places.
- **Copy references unbuilt S8.1–S8.3 features:** leaderboard, invites, price alerts, market-open push.
- **Unused web components** (verified by import grep):
  - `components/kit/`: `action-circle`, `amount-hero`, `list-row`, `page-header`, `slide-to-confirm`
  - `components/ui/`: `alert-toast`, `input`, `interactive-empty-state`, `number-flow`, `reading`, `slider`,
    `vercel-tabs`
  - `components/identity/`: `avatar`, `mark-cluster`
  - `lib/copy/diagnosis.ts` "check back soon" is reachable only through the unused `reading.tsx`.
- **Stale comments and records.**
  - `apps/web/src/components/shell/theme-provider.tsx:6` ("D2 is dark by default"; D2 is retired).
  - Phone `welcome.tsx:19` ("six-scene", but there are five).
  - `scenes.ts:4`, `setup/_layout.tsx:7`, `lib/constants/routes.ts:3-4,49` (old routes), `SettingsList.tsx:3`.
  - `ROUTES.account = "/app/account/"` has no page (`apps/web/src/lib/constants/routes.ts:13`).
- **A11y and markup.** Signed-out web Home has two "Call the next move" headings and no h1 when signed in.
  `TeamMark.tsx` uses `useState` without `"use client"`.
- **No code markers.** No TODO, FIXME, lorem, TBD, mock or stub appears in either app. All the unfinished signals
  are user-visible deferral copy and dead ends, not markers.

---

## 9. Identity documents, and whether the code follows them

| Document | What it says the identity is | Code follows? |
|---|---|---|
| `docs/design/reference-study-2026-09-30/*` (Solflare/Phantom/Fomo; banner: superseded by D-168) | Minimum baseline for features, motion, sheets and identity. `08-logos-and-identity.md`: real marks for every known entity, no letter-in-circle stand-ins | Partly. The registry is strong; the surfaces in §5.3 and the QQQ/MSFT/AMZN/Pyth gaps break the acceptance rule |
| `docs/design/senryo-v2/direction.md`, `tokens-consult.md`, `controls-consult-2026-10-01.md` (D-168, D-191, D-196) | **Living Lacquer**: Fomo violet-black, `#414EF4` blue action, violet Practice; D-196's borderless filled surfaces | The web still ships it. On colour it is superseded |
| `docs/design/reference-study-2026-10-07-uglycash/*` and `docs/plan/uglycash-revamp-2026-10-07.md` (approved 7 Oct) | **UGLYCASH across Senryo**: `#F5F5F5` canvas, white cards, black CTA, `#FA00FF` accent, condensed display, light default, dark as an adaptation without "old purple styling"; phone sheets; one global search (U10) | **Phone yes, web no.** No global search on either app |
| `docs/design/reference-study-2026-10-07-uglycash/tradash.md` | "UGLYCASH owns Senryo's visual identity"; Tradash supplies live behaviour and sound | Sound and terminal behaviour yes; identity on web no |
| `docs/plan/pivot-2026-10-08.md` (approved 8 Oct; D-256…D-272) | UGLYCASH for "look and flows"; CWF S22 shell for the web (D-269); web rail of six places incl. Games, Earn, Leaderboard; ⌘K "finds places, live markets and actions (Owarine)" | Shell yes; rail has 4 places; ⌘K partial |
| `docs/plan/decisions.md` (grep "colour/color/UGLYCASH/D-196") | Colour decisions are only D-060 (D2, retired), D-168 and D-191 (Living Lacquer); UGLYCASH appears once, in D-269, for phone sheets | **Gap:** no decision records that the web adopts UGLYCASH colour, so the shared tokens never moved |

**Bottom line for the replan.** The colour authority is UGLYCASH (approved 7 Oct, reaffirmed 8 Oct), and the phone
implements it. The web and the landing are the outliers, and the shared `packages/tokens` palette that feeds them
still encodes the superseded Living Lacquer values. Every indigo and violet the owner sees traces to
`packages/tokens/src/palette.ts` plus the forced `dark` class in `apps/web/src/app/layout.tsx:24`.
