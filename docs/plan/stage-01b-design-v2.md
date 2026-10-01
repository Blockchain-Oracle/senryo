# S1b — Design v2 "Living Lacquer": real identity + the reference-led rebuild (wave C/D)

**Goal:** Senryo becomes the product the user's reference study describes. The study is Solflare, Phantom and Fomo, and it is
the minimum baseline (D-168/D-169).
- Every known entity shows its real mark.
- The D2 terminal look is gone.
- Every journey matches the reference's navigation, sheets, states and motion, adapted only where Senryo's money rules
  require it. Those adaptations are listed in the parity ledger.

It ships mobile first; web inherits the tokens and identity immediately and gets its layouts in S11b.
- **Plan:** `docs/plan/v2-plan.md`, specifically:
  - §1 authority record;
  - §5 direction;
  - §6 add-ons;
  - §7 ledger;
  - W3/W4.

  Also `00-plan.md` §2.4 (clients) and §2.5 flows, with ownership updated per v2-plan W0.
- **Open first:**
  - `docs/design/senryo-v2/direction.md` (tokens, navigation, motion, journeys, screen inventory);
  - `docs/design/reference-study-2026-09-30/`:
    - `README.md`, `03-fomo.md`, `02-phantom.md`, `01-solflare.md`, `04-motion-and-assets.md`;
    - `05-components-and-agent-handoff.md`, `08-logos-and-identity.md`, `09-feature-inventory.md`;
    - the evidence frames and motion clips (gallery: `python3 tools/serve.py`);
  - `~/.claude/skills/mobile-reference-study/SKILL.md`;
  - `~/.codex/skills/reference-product-fidelity/references/fidelity-contract.md`.
- **Ownership:**
  - `packages/identity` (new);
  - `packages/tokens`;
  - `apps/mobile` shell, screens, components and theme;
  - `apps/mobile/.21st/design.json`;
  - `brand/` (art masters);
  - `docs/design/senryo-v2/`;
  - `docs/design/reference-study-2026-09-30/PROJECT-HANDOFF.md`.
- **Not owned:** money logic (`packages/core`, `packages/chain`, `packages/query`), the social api (S12b) and contracts.

**D-number range:** D-190…D-209.

## Steps
- [x] S1b.1 **Identity registry** `packages/identity`:
  - canonical entity ids;
  - first-party SVG sources with URL, licence, date and sha256;
  - variants: colour disc / mono light/dark / symbol / wordmark;
  - codegen (SVG → react-native-svg + web) with arc-flag normalisation and no `<text>`;
  - an `EntityMark` with loading, failed and unidentified states;
  - invariant `identity-provenance`.
- [x] S1b.2 **Marks acquired** (first-party where the owner publishes one; otherwise fetched by `fetch-marks.ts`):
  - Monad (logomark, token, mono) and MON;
  - USDC (Circle), AUSD (`monad-crypto/token-list`/Agora);
  - BTC, ETH, SOL, HYPE, ZEC;
  - Base, Arbitrum, BNB, Tron, Polygon (as Aurora supports them);
  - Chainlink, Uniswap, Perpl, Aurora, Envio, DB-IP;
  - Coinbase, Binance, Kraken;
  - the passkey icon (Material Symbols, Apache-2.0; A4, bccf226);
  - FX flags (public domain).
- [x] S1b.3 **Original art masters** in SVG + Skia:
  - XAU koban (embossed 千), XAG chōgin, five FX flag-pair discs, the Senryo venue chip;
  - six onboarding scenes, completion foil, 12 default avatars.

  The seal geometry is kept and recoloured through the gold ramp. **Design-agent/illustrator review before J1** (B12
  open until passed).
- [ ] S1b.4 **Replace every placeholder** (v2-plan W3 list): the fake live-font 千 seals, TopStrip "MONAD" dot, market,
  ticket and position symbols, the "In Perpl" swatch, collateral/LP/fund text rows, StarterCard coins, provider and source
  names, CardFace art, and the web `TokenIcon`/`SealMark`. Delete `ASSET_HUE`/`CHAIN_HUE`.
- [x] S1b.5 **Handoff packet**:
  - `PROJECT-HANDOFF.md` (authority record, journeys with FT/C/M/LG IDs, ledger, Senryo rules, art tasks);
  - `docs/design/senryo-parity-ledger.json` (FT/C/M/LG rows with the fidelity-contract fields);
  - SUPERSEDED-by-D-168 banners on `design/DIRECTIONS.md`, the `d2-*` screenshots and the study's own D2 references (README:82, 05:89/104-105, 10:5, `reference-ledger.json`), recorded in `COPY-MANIFEST.json`;
  - `validate_study.py` passes.
- [x] S1b.6 **Tokens** (direction §2–4):
  - step 1 swaps values under the existing names (web stays green);
  - step 2 adds the new roles (practice/mainnet, glass, fan, materials) and retires the old names;
  - fonts: Inter, Inter Display (verify static SemiBold) and subset Noto Sans JP;
  - `lucide-react-native` for utility icons;
  - light text-3 contrast ≥ 4.5:1;
  - `.21st/design.json` rewritten per D-168 (evidence IDs, provenance, deviations).
- [x] S1b.7 **Navigation shell spike → build**:
  - five-tab floating dock Home · Markets · Card · Social · You on `expo-router/ui`, with stack/scroll restoration verified;
    fallback is NativeTabs on iOS 26 as an Adapted C15;
  - collapsing header with seal, balance and mode;
  - Phantom fan (Send · Receive · Add money · Swap; expo-blur);
  - sheet grammar (Gorhom 5.2.14 + formSheet);
  - route migration (Trade → market detail/ticket, Fund → Add money) with deep links remapped;
  - new native modules (expo-camera, expo-notifications, sharing) → **[OK?]** EAS dev-client build (user).
- [x] S1b.8 **J4 Ticket** (C39–C43, M14, FT102–FT112):
  - margin vs leveraged size, centred ruler, presets + keypad ↔ chart, candle settings;
  - liquidation info, SL/TP child with keyboard lift;
  - 500 ms hold pill (D-177), trace, receipt + share.

  Built and merged 1 Oct (583c93d); walked on the simulator (acceptance 08:32Z, 09:40Z, 14:23Z). Mainnet eligibility
  was in this step's scope and is not built: it moved to S1b.8b so this box stays true.
- [x] S1b.8a **SL/TP on a new order** ("open, then protect"; lead decision 1 Oct, review R05, C42 parity): the ticket
  takes stop-loss / take-profit levels for the order being entered; after the open finalizes, each level is placed as
  its own transaction for the resulting position size, with its own outcome (`useTriggerLegs`). Levels are validated
  against the previewed liquidation price. If a level fails, the position is open and unprotected at that level, and the
  receipt says so. Shipped 1 Oct (`52de228`: `PlannedTriggers`, `ProtectAfterOpen`, `planned-triggers.ts`; the plan is
  kept per network, account and market until it is placed). Checked on testnet: XAG long with SL and TP, then a gold
  long at 5× with a 3% stop at $4,047.97 — each level finalized, its line inside the receipt under "Quoted at your
  hold".
- [x] S1b.8b **Mainnet eligibility on the ticket** (FT101, M13; split out of S1b.8 on 1 Oct): the C12 eligibility
  checkbox sheet and pending gate before a Mainnet ticket (D-023/D-165). Built 1 Oct (`14f8aef`): before an account's
  first Mainnet ticket, `(sheets)/eligibility` names D-023's restricted regions, links the Terms and continues to the
  ticket after a short pending state; versioned per account; Practice never asks; the server's IP check stays the
  primary block. Wording is the lead's draft for the user's review. Acceptance on a real Mainnet ticket waits for the
  mainnet launch (the sheet itself was checked on the simulator).
- [x] S1b.9 **J3 Markets** (C22/C25/C26, FT071/072/095–101):
  - watchlist, categories (Commodities · FX · Crypto · Equities/Indices), filters, search;
  - detail with Holders / Feed / About, alerts;
  - sticky Short/Long.

  Built 1 Oct: dd08d0c (Markets, search, detail, price alerts), 08262bf (Holders), 0a8c915 (a row whose price can't
  be read), 185aedd (the dismissible perps intro, FT072), b838dc5 (chart pan, FT096). Two parts of this step's scope
  are still short: they moved to S1b.9a so this box stays true.
- [ ] S1b.9a **J3, what S1b.9 left short** (split out on 1 Oct; ledger reconciliation §5):
  - equity and crypto discovery (FT032, review S03): **built and accepted on the simulator 1 Oct** (0d51e85 data,
    55f171b UI; acceptance.md 17:45Z). Perps lists Perpl's 15 crypto markets and the six D-220 calculated feeds as
    read-only rows with live prices; each opens a read-only page (price + basis, its own history, OI/volume/funding
    or the feed's facts and disclosure, the gate in plain words). Marks (5f41fe9): Tesla, SpaceX, iShares and an oil
    barrel fetched by script; SPY and QQQ are recorded gaps (no copyable SPDR file; Invesco's terms forbid copying its
    logo), so they draw their ticker in the gap circle. The indexer's `FeedW…X` config is deployed
    (sha-ba4b5e2, reset 18:02 UTC, ready 18:50): the feed charts read "indexed rounds". Still short: web parity is
    S11b; SPY/QQQ marks stay recorded gaps;
  - market history (FT097): built 1 Oct — F32's history utility now leads market detail's utilities (history ·
    alert · star · share) and opens your activity in that market (`/activity?market=XAU`, the indexer's `market_id`
    filter). The ledger row's deviation note is superseded.

  The reconciliation also found perps education (FT072) and chart pan (FT096) missing; both landed on main later on
  1 Oct (185aedd, b838dc5) and have no acceptance row yet.
- [ ] S1b.10 **J6 Home + J10 LP**:
  - balance, availability cells, balance details (D-178), positions;
  - Kinpaku/LP tiles, Top Trades;
  - mode capsule + selector (D-172);
  - LP vault/deposit/redemption.
- [x] S1b.11 **J5 Positions**: own position detail, add margin/reduce/close, orders/triggers, activity, receipts.
- [ ] S1b.12 **J2 Add money**:
  - hub, practice claim, voucher, source-chain/asset selectors;
  - other-chain primer/config/QR/status;
  - Monad receive (animated QR), exchange chooser + instructions;
  - swap + route details.
- [ ] S1b.13 **J1 Onboarding**:
  - six-scene story, passkey create/sign-in/recovery guide;
  - handle, follow, voucher code, terms;
  - Face ID and notification primers, completion foil, account-required, step-up.
- [x] S1b.14 **J8 Social screens** (with S12b):
  - feed, thesis detail/replies/compose, people, leaderboard;
  - trader profile, followers, profile/avatar editor;
  - global search, send recipient/contacts/scanner/review.
- [ ] S1b.15 **J7 Card + J9 You**:
  - card tutorial, home, reveal, allowance, freeze, wallet, activity, auth detail, simulation;
  - identity/addresses, security/passkeys, session policy, preferences, notifications, advanced, delete data, help, terms, status.
- [ ] S1b.16 **J11 Spot tokens:** token list and detail, buy/sell via the Uniswap v4 route, holdings in Home.
  - Built 1 Oct (agent j11-data: list, pools, prices, quotes, holdings, candles, swap builder, `fd2ffb7`; lead: the
    screens, `166181d`): Markets is Watchlist · Tokens · Perps (F10); Tokens lists the nine Monad tokens with a live
    hook-free v4 pool (real logos, onchain mid prices, GeckoTerminal 24 h change where honest); a token page (price,
    pool candles, facts, Sell / Buy, Practice offers the switch); the swap ticket (P20) with live quotes, impact, fees
    and the minimum. Every spot trade is a passkey step-up (the session's scope rejects router calls — deliberate, not
    widened).
  - Since then: Home on Mainnet lists the spot tokens you hold, with their worth (`d949f6a`); Search finds spot tokens
    (`f9cd161`); the swap ticket keeps the full outcome contract (`d623626`).
  - Open: a real swap. It needs the user's mainnet USDC and MON; acceptance 15:55Z is partial (quotes, no swap).
- [ ] S1b.17 **Fidelity acceptance per journey:**
  - 402×874 simulator screenshots next to the reference frames;
  - motion start/settle/exit against the M-clips;
  - parent restoration with values kept;
  - loading/empty/error/retry and reduced motion/transparency.

  Rows go in `acceptance.md`, and the ledger is updated.

## Gate
- Fast gate, `expo export`, web build.
- `identity-provenance` + `design-literals` + `design-json-present` pass.
- Every journey J1–J11 has its acceptance row with evidence.
- No known entity renders a placeholder.
- The parity ledger has no unrecorded Excluded row.

## Findings
- **S1b.1 (identity package):** `packages/identity` holds the canonical ids, the entity table, one provenance record per
  artwork (`src/art/*`), the platform-free planner and `EntityMark` for native and web. Codegen:
  `pnpm --filter @senryo/identity codegen [--rehash]`. The web keeps an owner's own drop shadows (MON token, Bitcoin
  disc), but native drops `<filter>` because SVGR has no native mapping for it. PNG-only owner files (Perpl kit,
  Coinbase/Binance site icons) render as images, unchanged. The optimised web SVGs match every source (worst RMSE 0.0018).
- **S1b.2 (marks), done 1 Oct — acquisition is now programmatic.** The user's rule: research the download route, never
  collect logos by hand. Docs were read through Context7 (`ctx7` CLI: `/0xa3k5/web3icons`, `/simple-icons/simple-icons`,
  `/logo-dev/docs.logo.dev`, `/llmstxt/brandfetch_llms_txt`, `/websites/coingecko`).
  - **How it works:** `packages/identity/scripts/catalog.ts` lists each mark as data (key, owner, source);
    `pnpm --filter @senryo/identity run fetch` downloads every entry over pinned HTTPS, stores the bytes in
    `sources/<key>/`, and writes the records (URL, sha256, viewBox, licence) to `src/art/generated/fetched.ts`; then
    `codegen`. Adding a mark = one catalog line + those two commands. No npm dependency was added.
  - **Sources chosen:**
    - **web3icons** (MIT, pinned to commit `ad3cbe0`): tokens, networks and exchanges as colour mark, white silhouette
      and brand-colour background. The background variant is clipped to a disc by codegen (`ArtFile.crop`); the dark
      silhouette is a recorded recolour (`ArtFile.derived`).
    - **Hyperliquid's per-coin icon** (`app.hyperliquid.xyz/coins/<COIN>.svg`): vector discs for assets the libraries
      don't carry yet (Lighter, Venice, Pump). web3icons' `LIT` is Litentry, a ticker collision, so it is not used.
    - **Simple Icons** (CC0, pinned to 16.33.0): company marks + brand hex for equity underlyings (NVDA).
  - **Rejected, with the reason:** logo.dev (key required; SVG is enterprise-only), Brandfetch (client id; hotlink
    terms), Parqet (free only with a visible attribution link on every page that shows a logo), CoinGecko (raster only).
    They stay options for a runtime long-tail token list (J11 spot tokens), where `monad-crypto/token-list` `logoURI`
    is the first source.
  - **What it filled:** NEAR, BNB, TRON and Polygon (all variants); Lighter, Venice and Pump discs; Nvidia; and, as
    `supplement` records behind the first-party ones, the mono silhouettes the owners don't publish (Monad, Bitcoin,
    Ethereum white, Solana, USDC, Aurora, Coinbase, Binance, Kraken) plus vector symbols for Bitcoin, USDC and Coinbase
    and a vector Binance disc. A first-party file always wins over its supplement, per variant.
  - 17 fetched records, 43 files; 106 generated marks per platform. No entity in the table has an artwork gap left.
  - **Licences are not a user ask.** Showing a project's mark beside its ticker to identify it is nominative use; each
    record quotes its licence or terms. The earlier "written permission" flags (Arbitrum, Uniswap, Chainlink, Solana,
    Circle, Coinbase, flags) are closed on that basis and stay documented in the records.
- **S1b.7 + S1b.8 merged 1 Oct (583c93d), acceptance still owed.** Agent A3 left the shell and ticket uncommitted
  when its session ended; the lead committed it (5917f97), fixed the 1 Oct review's P1s and merged. What is in:
  five-tab dock, action fan, collapsing headers, route migration with old paths remapped, the ticket (margin, ruler,
  presets, keypad ↔ chart, candle settings, liquidation info, hold pill, trace, receipt, share) and the child sheets.
  - **Review P1s fixed** (R01, R02, R04, R05, R06, plus R08/R11/R14 partly): see
    `docs/design/reviews/2026-10-01-mobile-review-response.md` for what changed, where, and what was not verified.
  - **One outcome per transaction.** `packages/query` `traceOutcome`/`settledOutcome`: `not-sent` (nothing left the
    device) vs `unknown` (signed, result lost: settled from the send journal, never retried). TP/SL legs:
    `features/trade/useTriggerLegs.ts`. Check: `pnpm --filter @senryo/drive trigger-outcome-check` (24/24).
    The LP deposit (approve, then deposit) still shares one trace: fix it the same way in J10.
  - **Simulator workflow** (no dev-client rebuild): `cd apps/mobile && npx expo export:embed --platform ios --dev
    false --bytecode --entry-file index.ts --bundle-output "$APP/main.jsbundle" --assets-dest "$APP"`, where `$APP`
    is the installed `Senryo.app` on the "A3 Senryo iPhone 17" simulator; relaunch; deep links
    (`xcrun simctl openurl <sim> senryo://markets/XAU/ticket?side=long`) and `idb ui tap` drive it.
  - **Not done in S1b.7:** the new native modules (expo-camera, expo-notifications, sharing) and their dev-client
    build; Gorhom sheets (J2). **Not done in S1b.8:** S1b.8a, mainnet eligibility on the ticket, and every native
    acceptance row (S1b.17) — signed-in flows, VoiceOver, Reduce Motion, Android, motion clips.
    - Since then: expo-notifications and expo-local-authentication came with the primers (22b0732); expo-camera is
      still not in the app (no QR scan). D-196 replaced Gorhom with one custom Reanimated sheet host. S1b.8a shipped
      (52de228). Signed-in flows, light theme, large text and Reduce Motion have simulator rows in `acceptance.md`.
      Still owed: mainnet eligibility (S1b.8b), the spoken VoiceOver pass, Android and the motion clips.
- **Controls, sheets and navigation rebuilt after the user's 1 Oct rejection (D-196).** The user tested the build and
  rejected the buttons, the way sheets and the auth step appear, and the navigation ("learn from Fomo"). What changed:
  - **Authority:** the Fomo frames, measured (2 px per pt), plus a Codex consult stored verbatim with the lead's
    deviations at `docs/design/senryo-v2/controls-consult-2026-10-01.md`. `direction.md` §3–5 carry a superseded banner.
  - **Surface rule:** no borders on cards, groups, notes, chips or buttons. `components/kit/Surface.tsx` holds
    `SurfaceLevel`, `Panel` and `useGroupFill`: a surface is one step lighter than its ground, and what sits inside a
    group or a sheet is one level up. A sweep (agent `surface-sweep`) applied it to every remaining screen and removed
    the last tracked-uppercase labels.
  - **Kit:** `Button` (rounded rectangle, top highlight, 0.97 press, quiet disabled plate), `usePressScale`, `ChipRow`
    (bare labels, filled selection, optional leading control), `Segmented` (sliding plate), `ListRow` (no dividers).
  - **Sheets:** `Sheet` floats 8 pt from the edges with 38 pt corners and rises on the iOS drawer curve; `SheetHeading`
    and `SheetRow` (filled rows that stagger in) are the selector anatomy (mode selector, add money). `TransactionSheet`
    is the page ground with 38 pt top corners; `ChildSheet` matches.
  - **Auth:** `useAuthFlow` + `AuthFlowSheet`: the ceremony and its outcome are a sheet over the story; inside the
    account-required sheet they replace the invitation. `AuthCard` is a borderless centred layout.
  - **Shell:** icon-only dock with the plus beside it (`Dock`, `ActionFan`, `theme/layout.ts` `DOCK`/`FAN`/`dockBottom`);
    `Utilities.tsx` replaces the utility strip with round bar utilities; the session chip shows only for an account.
  - **Markets rows** are bare on the page with 48 pt marks (`features/markets/MarketRow.tsx`).
  - **Found on the way:** the receipt showed the engine's locked margin as "Margin" beside the chosen leverage (P$5 at
    5× for P$50). It now shows the entered margin and names the lock separately. The Kinpaku art overflowed its card
    (a bundled image keeps its pixel size unless given one); fixed.
  - **Checked on the simulator** (iPhone 17, iOS 26.5, dark): welcome, create account with a real passkey, Home, mode
    selector, fan, add money, Markets, market detail, ticket, risk explainer, receipt, position, Card, Social, You.
    Not checked: light theme, large text, VoiceOver, Reduce Motion, Android, the auth failure states on device.
- **S1b.13, the first-run setup after the passkey (review R03, second half) — built 1 Oct.** Creating an account now
  continues into `app/setup`: handle → follow → voucher → terms → done → Home, each a page in the Fomo F04–F07 anatomy
  (`features/setup/SetupScreen.tsx`, `SetupField.tsx`, `FollowRow.tsx`).
  - Progress is versioned, bound to the account's address and resumable (`features/setup/progress.ts`; the launch gate
    in `app/index.tsx` reopens the owed step). An account that signs in on this phone skips it.
  - Handle: a suggestion derived from the address, checked as typed against the live API (`useHandleAvailability`),
    claimed with `useSaveProfile` over a SIWE session (`lib/account/use-session-runner.ts`).
  - Follow: `useFollowRecommendations`, none preselected; an empty board says so. Voucher: `useVoucher` signs
    `Voucher` and follows the relay to finalized (practice pays P$12 per code). Terms: three plain points and one
    checkbox; the acknowledged `LEGAL_VERSION` is stored per account.
  - **The Terms of use and the Privacy notice are a draft the lead wrote** (`features/legal/content.ts`, in-app pages
    `/account/terms`, `/account/privacy`; `senryo.xyz/terms` does not exist yet). They describe what the product does
    today and must be reviewed by the user before mainnet.
  - Checked on the simulator: all five steps; a real handle claim (`@swiftlantern86` on 10143) through to Home.
    Not checked: a voucher redemption (no code minted), following a ranked trader (the practice board is empty),
    resume after a kill, the keyboard-up layout (the simulator's software keyboard was off).
  - What was still open in J1 at this point is now on main: the notification and Face ID primers (22b0732; their art
    c70d1ca, merged in 7c01665), the completion foil and the twelve avatars (art package merged in d0e4917, in the app
    since 812fce3; the portrait picker is cb09307), and the seal's gold-leaf recolour (merged in 8fc1326). B12 stays
    open until the user's design review.
  - **Primers shipped 1 Oct (lead):** setup is now handle → follow → voucher → terms → Face ID → notifications → done.
    `PrimerScreen` (art in the middle, title and one sentence, a reserved outcome line, Turn on / Not now pinned):
    the Face ID primer asks iOS for Senryo's Face ID permission in context and does one real scan (unlocking already
    reads a Face ID–gated key; this never stands in for the passkey); the notification primer raises the OS prompt and
    registers the phone (`PUT /v1/push/token`, every channel on). Each says plainly when the phone has no Face ID,
    when the permission was refused (Open Settings), and when the build lacks the module. Both native modules are
    loaded lazily (`lib/native-modules.ts`), so a dev client built before them still runs today's bundle. Art: the
    gold fūrin and the ebi-jō lock (agent art-primers, c70d1ca, merged in 7c01665). Checked on the simulator
    (acceptance rows).
  - **Notifications (S1b.15):** You → Notifications has the permission state with the one action each needs and five
    switches (trades and stop losses, liquidation, price alerts, deposits, card) saved at once; `PushHost` shows a push
    as a banner in the app, opens its screen in its own mode on a tap (cold start included) and sends a registration
    the phone still owes at the next unlock; sign-out stops pushes to the phone. Delivery from the keeper through Expo
    (titled, deep-linked, receipts checked, dead tokens disabled) is agent keeper-push's 7db9389, merged in dd3a8b1.
    Delivery to a physical iPhone still needs the user's Apple login (STATUS Blockers).
- **J4/J5 walked end to end on the simulator (1 Oct).** Create → claim → open (hold) → receipt → position → TP and SL
  placed → both removed → close (hold): every step finalized (rows in `acceptance.md`). Screenshots (local, beside
  the review evidence): `docs/design/reference-study-2026-09-30/reviews/2026-10-01-senryo-mobile/rebuild/`.
  - Fixed on the way: a removed level stayed in the list until the indexer caught up, with no confirmation, and the
    place button read "Placing…" during a removal (`useTriggerLegs`, `trigger-legs.ts`, `TriggerPanel`).
  - Home and Positions were rebuilt by agent `j6-home` (merged): F09 hero, period chips, availability → balance
    details sheet, position rows, Kinpaku/LP tiles, Top Trades, real Orders and Activity lists. The lead removed its
    derived "Long 0.5×" multiple (cross-margin has no per-position leverage; it contradicted the ticket's 5×).
  - Open at this point: the close result was a trace and Done, with no summary of what was realised — the close
    summary shipped later the same day (69958c3). Still open: a newly placed level appears in the list only once the
    indexer has it (a few seconds).
- **1 Oct, afternoon — the journeys, merged and checked on the simulator** (lead + agents on Opus 5.5 after the Fable
  limit; screenshots in the local `reviews/2026-10-01-senryo-mobile/rebuild/` folder):
  - **J3 Markets** (agent j3-markets, `dd08d0c`): Watchlist · All underline tabs, category chips led by search, flat
    rows with the leverage badge and an "Arriving" group, a Search page (All / Markets / Traders, recents), market
    detail with alert / favourite / share utilities, a price block, candles with the current-price line and period
    chips, About and Feed tabs; real price alerts (no push at this merge: alerts showed "Triggered" in the list; push
    delivery came with 7db9389 and 22b0732). At this merge there was no Holders tab, because nothing listed public
    positions by market; Holders shipped later the same day (08262bf, below).
  - **J8 Social** (agent j8-social, `4a4bf0f`): Feed (Global / Friends) with verb plates, threads with replies, compose
    thesis, report / mute / block / delete, People (Following / Followers / Recommended), the leaderboard with Your
    rank and its metric explained, trader profiles. Seen live: the feed shows this simulator account's real trades.
  - **J9 You** (agent j9-you, `ad2a657`): the tab is a profile; the editor (username with availability, display name,
    bio, per-network listing and trade sharing) and, by the lead, a portrait picker for the twelve authored avatars
    (saved `avatar-11-kasa`, read back from the api). Delete-my-data now clears the server's social data too.
  - **J2 Add money** (lead): mode-aware hub with the practice claim in place, voucher sheet, receive QR with the Monad
    mark at its centre and a one-time reveal (decoded: it scans to the shown address), the swap page (P20 ticket on
    Mainnet, honest page in Practice: no pool on the test network) on a shared `useCollateralSwap`.
  - **J7 Kinpaku** (lead): hero card that settles in and catches light, the real Free to spend, sample data tagged,
    a three-step first-use tutorial.
  - **Art** (agent art-seal): the seal in gold leaf carved in lacquer and everything built from it (icon, splash,
    lockups, the Kinpaku card front and back), Codex-reviewed; the lemon-yellow D2 seal and card are gone.
  - **Later on 1 Oct (lead, all checked on the simulator with real testnet transactions):** LP vault page (faucet →
    P$25 deposit), withdraw to own wallet, send to an address or @handle behind a step-up (P$17.17 to our trader
    wallet), Kinpaku's real daily limit and Freeze on the onchain allowance (D-198), the portrait picker, the close
    summary, light theme, large text (control font cap, 7efcbd3) and Reduce Motion.
  - **Still open** (checked against main the same evening): deposit status and other-chain deposits (wait for Aurora
    intents); the card's reveal and wallet pages, which say no card is issued yet (c424a53) and wait for an issued
    card (B11); the spoken VoiceOver pass. Shipped since this list was written: the Face ID / notification primers and
    push (22b0732; keeper delivery 7db9389, merged in dd3a8b1), Holders (08262bf), and the authorization detail on the
    labelled sample record (cd80b65).
  - **Holders shipped 1 Oct** (agent holders-api + lead): the first market-detail tab (Holders · Feed · About, F32),
    open positions of people who share their trades on that network, largest first by notional at the accepted
    price, with side (no per-position leverage — cross margin), average entry, leveraged size and price-move P&L;
    Friends behind the session gate. Push and primers shipped the same afternoon (above).
- **S1b.9/S1b.10, first pieces:** every market row has its real identity (Perpl's nine markets, FX as pairs, Nvidia);
  guest Home shows the listed markets and one invitation.
- **S1b.3 (art), first pass complete, review open.** First-pass masters are in `brand/art/`: koban, chōgin, five FX
  pair discs, venue chip, and now the J1 package (`brand/scripts/onboarding.py`): six onboarding scenes, pending-passkey
  art, completion foil, twelve avatars, plus `labels.json` (native label anchors), all registered in
  `packages/identity/src/art/onboarding.ts`.
  - Codex reviewed the package over five rounds; in the closing round all nine pieces pass as static first-pass
    masters for the user's design review (`docs/design/reviews/2026-10-01-j1-art-review.md`, verbatim, with what
    still falls short).
  - Also redrawn in the same pass: the Kinpaku card face and back (the scene-5 card, flat; the Card tab's raster) and
    the seal through the gold-leaf ramp (geometry kept; app icon, splash seal and web copies refreshed by
    `brand/scripts/render.sh`). Codex: card front and back pass as first-pass masters; the seal passes at app sizes,
    and its large-size finish and inverse were fixed once after round 8 and not re-reviewed (same review file).
  - `brand/art/onboarding/layers.json` lists each master's layers (one per unit of motion) for the J1 story screen.
    The app's story still moves five bands: `apps/mobile/scripts/onboarding-art.mjs` composes them from those layers
    as contiguous runs (master stacking kept); moving the hero to per-layer depths is an app-side follow-up.
  - **B12 stays open:** the user's design review is the gate. Motion as implemented, on-device rendering and the
    pending screen's layout are unreviewed. Contact sheets and motion samples: `brand/scripts/sheets.py`, `motion.py`.
- **S1b.4, partial:**
  - Done: MarketRow, TradeHeader, PositionDetail, PositionsTable, BucketRegister, CollateralPanel, LpScreen, Fund,
    add-money, Onboarding/PrivacyPlate seal, recovery, help, CardFace, web `TokenIcon`/`SealMark`.
  - Remaining (the lead's files): TopStrip, StarterCard, Ticket, PositionsAccessory. TopStrip and PositionsAccessory
    were deleted in the shell rebuild (5917f97); StarterCard and the ticket were not re-checked in the 1 Oct records
    pass.
  - Remaining web: the chain dot in `swap/panel.tsx`, and the live-font 千 in `app/page.tsx` and `ui/credit-debit-card.tsx`.
  - `CHAIN_HUE` is still read by that chain dot. `ASSET_HUE` only feeds unused `--asset-*` CSS vars; delete both after the lead's token work lands.
- **S1b.5 (handoff packet, agent A2, D-190):**
  - `PROJECT-HANDOFF.md` is written twice, identically: in the study folder (local only, Q-021) and at
    `docs/design/senryo-v2/PROJECT-HANDOFF.md`. Its paths are code spans, so the study's link validator passes in either place.
  - The parity ledger `docs/design/senryo-parity-ledger.json` has 216 rows.
  - The study was briefly committed in 1137f57 and untracked again in 6d96a4d. The pre-edit hashes in its `COPY-MANIFEST.json`
    equal those blobs.
  - `validate_study.py` passes, including Pillow image/crop checks: run with a scratch `uv` venv, because the system Python
    has no Pillow.
- **S1b.6 (tokens), Codex consult:** Codex (gpt-6.1-sol, xhigh, read-only) gave every value that direction §2–4 leaves
  open. The answer is stored verbatim in `docs/design/senryo-v2/tokens-consult.md`. Highlights:
  - `mutedForeground` = Text 2. `secondary`/`muted` = #201E2B / #ECE9F2. `accent` = mainnet surface + link ink.
    `destructive` = Down. `ring` = link. Chart series run blue · violet · cyan · rose · silver; gold never means profit.
  - Light Text 3 = **#716C7F: 4.62:1 on #F5F4F8**, 5.06:1 on #FFFFFF (was #746F82 at 4.42:1). Ratios are computed with
    WCAG relative luminance by the same-hue OKLab darkening script. Dark Text 3 #8F8B9F is 6.00:1 on the background and
    5.32:1 on a sheet.
  - Kinpaku foil = the gold-leaf ramp with intermediates #AE8941 and #EACF8C; the lacquer body and edge come from the
    lacquer ramp.
  - Type: micro, label and caption are all 12/16; body 16/22; title 20/24; numSm 16/20; numMd 20/24; numTicker and
    numLg 40/44; numXl and numHero 52/56. Inter Display at ≥ 32 with −0.02 em tracking. No uppercase anywhere.
  - Radius: `sm` → 12 in step 1. Spacing names kept, plus `lgPlus`/`inset` 20.
  - Motion: press 100, selection 170, page push 320, easing (0.2, 0.8, 0.2, 1); springs per direction §4 with
    `overshootClamping` except the fan's Send.
- **S1b.6 step 2 (D-191):**
  - The new roles live in `palette.ts`, beside the shadcn names, so web CSS emits them as `--text-2`, `--glass-tint`, …
  - RN takes the 8-digit scrims directly; the old `withAlpha` cannot parse `#RRGGBBAA`.
  - Mobile springs live in `apps/mobile/src/theme/motion.ts`, which also takes over EASE/DURATION/PRESS_SCALE from
    `layout.ts`.
  - Retired: `CHAIN_HUE` and `ASSET_HUE`. The web swap panel's chain dot became an `EntityMark`, and the `colorVar`
    field left `sample.ts`/`fund-screen`.
  - Not yet using the new roles: screens (components still read the step-1 names); that changes per journey.
- **S1b.6 fonts and icons (D-192):**
  - Inter 4.1 is static and byte-for-byte on mobile; the web copies are Latin subsets. Inter Display SemiBold is
    verified in the release. Noto Sans JP is subset to 千両金箔.
  - Every font file carries provenance in `packages/tokens/src/fonts.ts`, checked by the `font-provenance` invariant.
  - `lucide-react-native` is JS + SVG only, so no dev-client rebuild is needed.
  - Fonts load through expo-font on mobile and next/font/local on web; no Google Fonts request remains.
  - `apps/mobile/.21st/design.json` is rewritten per D-168:
    - direction, authority, typography, radius, motion and materials;
    - must/avoid rules and the amended D-033;
    - reconstructions (EntityMark, venue chip, mark cluster);
    - planned C15/C16/C18/C39–C43;
    - D2 ports kept under `legacyD2`.

    The web record points to the same direction.
- **Lead files:** `TopStrip`, which drew the D2 "SENRYO/千両" wordmark in the system CJK face, was deleted in the
  shell rebuild (5917f97).
- **S1b.7 spike (D-193): headless tabs pass.** The run was on a separate iPhone 17 simulator, using the release app with
  this branch's Hermes bundle swapped in. All five probe checks pass: stack per tab, scroll (Home and Markets), the dock
  hiding during entry, and the content inset.
  - The spike lives at `src/app/dev-shell-spike/**` and `src/features/shell-spike/*`. It is dev-only and not linked
    from the app; `?probe=1` reruns the checks.
  - Screenshots (scratchpad): `shots/spike3/t01–t22.png` and `shots/compare/dock-vs-F12.png`.
  - The S1b.7 build itself (the lead's `(tabs)/_layout.tsx` migration, the fan, the header and the route remap) was
    still open at the spike. It was built and merged in 583c93d, and S1b.7 is ticked.
- **Visual check of the token swap** (scratchpad `shots/app`, `shots/compare`): every screen now shows the violet-black
  surfaces, blue primary and Inter. These D2-era features still show, because they come from their components, not
  the tokens; each is rebuilt in its journey:
  - uppercase button and segment labels (`kit/Button`, `kit/Segmented`);
  - the green eyebrow on the welcome;
  - the TopStrip wordmark;
  - the Kinpaku card PNG, which is still the D2 lemon gold (`brand/kinpaku-card*`): an art task to recolour through the
    gold-leaf ramp (S1b.3, B12).

  All four are gone on main: no `textTransform` is left in `apps/mobile/src` (the D-196 kit and the surface sweep),
  the welcome is the six-scene story (ba409c9), TopStrip was deleted (5917f97), and the card was redrawn through the
  gold-leaf ramp (3ac46c9, merged in 8fc1326).

## Handoff
- **Simulator loop (D-197):** the simulator can now do everything a phone can. Native build once:
  `cd apps/mobile && CI=1 npx expo prebuild -p ios --clean && xcodebuild -workspace ios/Senryo.xcworkspace -scheme
  Senryo -configuration Release -sdk iphonesimulator -destination 'id=<sim>' -derivedDataPath <dir> build`, then
  `xcrun simctl install <sim> <dir>/Build/Products/Release-iphonesimulator/Senryo.app`. JS only: re-embed the bundle
  (Findings, "Simulator workflow") and relaunch — about 40 s. Face ID: `xcrun simctl spawn <sim> notifyutil -s
  com.apple.BiometricKit.enrollmentChanged 1 && … -p com.apple.BiometricKit.enrollmentChanged` to enrol, `… -p
  com.apple.BiometricKit_Sim.pearl.match` to match. `apps/mobile/ios` is generated and ignored.
- **Resume here (updated 1 Oct evening against main; the morning list is done):**
  1. **Art package:** merged (d0e4917) and in the app (812fce3). The seal's gold-leaf recolour and the Kinpaku card
     front and back are redrawn (merged in 8fc1326), and the primer art is in (c70d1ca, merged in
     7c01665). B12 stays open until the user's design review.
  2. **J4 with an account:** walked on the simulator — claim, open, both levels placed and removed, close, and open
     then protect (acceptance 08:32Z, 09:40Z, 12:01Z, 14:23Z); S1b.8a shipped (52de228). Still owed: the motion clips
     and the S1b.17 fidelity rows.
  3. **J1** (review R03): the six-scene story (ba409c9, layers refreshed from the merged art in 812fce3) and the
     new-account sequence after the passkey are built: handle → follow → voucher → terms (3d44e5b) → Face ID →
     notifications (22b0732) → completion foil (812fce3). Progress is versioned, account-bound and resumable;
     returning accounts skip it. Not yet checked: resume after a kill, a voucher redemption, a real follow.
  4. **J3, J6 + J10, J5, J2:** built and merged — J3 dd08d0c; J6 ce856cb, J10 e7310b8; J5 69958c3; J2 05c2384,
     bd3e87f, ae9784d, cbf7937 and the outcome contract 9d22903.
  - **Next:** the open boxes in Steps. What each still owes is in the parity ledger (`acceptance_evidence.remaining`
    and `depends_on`; the 16 pending rows are listed in `docs/design/reviews/2026-10-01-ledger-reconciliation.md` §4)
    and in STATUS "Next action".
- **Logos:** adding a mark is one line in `packages/identity/scripts/catalog.ts`, then `pnpm --filter
  @senryo/identity run fetch` and `codegen`. Never collect one by hand.
