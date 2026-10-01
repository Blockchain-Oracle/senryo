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
- [ ] S1b.3 **Original art masters** in SVG + Skia:
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
- [ ] S1b.7 **Navigation shell spike → build**:
  - five-tab floating dock Home · Markets · Card · Social · You on `expo-router/ui`, with stack/scroll restoration verified;
    fallback is NativeTabs on iOS 26 as an Adapted C15;
  - collapsing header with seal, balance and mode;
  - Phantom fan (Send · Receive · Add money · Swap; expo-blur);
  - sheet grammar (Gorhom 5.2.14 + formSheet);
  - route migration (Trade → market detail/ticket, Fund → Add money) with deep links remapped;
  - new native modules (expo-camera, expo-notifications, sharing) → **[OK?]** EAS dev-client build (user).
- [ ] S1b.8 **J4 Ticket** (C39–C43, M14, FT102–FT112):
  - margin vs leveraged size, centred ruler, presets + keypad ↔ chart, candle settings;
  - liquidation info, SL/TP child with keyboard lift;
  - mainnet eligibility;
  - 500 ms hold pill (D-177), trace, receipt + share.
- [ ] S1b.9 **J3 Markets** (C22/C25/C26, FT071/072/095–101):
  - watchlist, categories (Commodities · FX · Crypto · Equities/Indices), filters, search;
  - detail with Holders / Feed / About, history, alerts;
  - sticky Short/Long.
- [ ] S1b.10 **J6 Home + J10 LP**:
  - balance, availability cells, balance details (D-178), positions;
  - Kinpaku/LP tiles, Top Trades;
  - mode capsule + selector (D-172);
  - LP vault/deposit/redemption.
- [ ] S1b.11 **J5 Positions**: own position detail, add margin/reduce/close, orders/triggers, activity, receipts.
- [ ] S1b.12 **J2 Add money**:
  - hub, practice claim, voucher, source-chain/asset selectors;
  - other-chain primer/config/QR/status;
  - Monad receive (animated QR), exchange chooser + instructions;
  - swap + route details.
- [ ] S1b.13 **J1 Onboarding**:
  - six-scene story, passkey create/sign-in/recovery guide;
  - handle, follow, voucher code, terms;
  - Face ID and notification primers, completion foil, account-required, step-up.
- [ ] S1b.14 **J8 Social screens** (with S12b):
  - feed, thesis detail/replies/compose, people, leaderboard;
  - trader profile, followers, profile/avatar editor;
  - global search, send recipient/contacts/scanner/review.
- [ ] S1b.15 **J7 Card + J9 You**:
  - card tutorial, home, reveal, allowance, freeze, wallet, activity, auth detail, simulation;
  - identity/addresses, security/passkeys, session policy, preferences, notifications, advanced, delete data, help, terms, status.
- [ ] S1b.16 **J11 Spot tokens:** token list and detail, buy/sell via the Uniswap v4 route, holdings in Home.
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
    `pnpm --filter @senryo/identity fetch` downloads every entry over pinned HTTPS, stores the bytes in
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
- **S1b.3 (art), first pass complete, review open.** First-pass masters are in `brand/art/`: koban, chōgin, five FX
  pair discs, venue chip, and now the J1 package (`brand/scripts/onboarding.py`): six onboarding scenes, pending-passkey
  art, completion foil, twelve avatars, plus `labels.json` (native label anchors), all registered in
  `packages/identity/src/art/onboarding.ts`.
  - Codex reviewed the package over five rounds; in the closing round all nine pieces pass as static first-pass
    masters for the user's design review (`docs/design/reviews/2026-10-01-j1-art-review.md`, verbatim, with what
    still falls short).
  - Also redrawn in the same pass: the Kinpaku card face and back (the scene-5 card, flat; the Card tab's raster) and
    the seal through the gold-leaf ramp (geometry kept; app icon, splash seal and web copies refreshed by
    `brand/scripts/render.sh`). Codex: both pass as first-pass masters (same review file).
  - `brand/art/onboarding/layers.json` lists each master's layers (one per unit of motion) for the J1 story screen.
  - **B12 stays open:** the user's design review is the gate. Motion as implemented, on-device rendering and the
    pending screen's layout are unreviewed. Contact sheets and motion samples: `brand/scripts/sheets.py`, `motion.py`.
- **S1b.4, partial:**
  - Done: MarketRow, TradeHeader, PositionDetail, PositionsTable, BucketRegister, CollateralPanel, LpScreen, Fund,
    add-money, Onboarding/PrivacyPlate seal, recovery, help, CardFace, web `TokenIcon`/`SealMark`.
  - Remaining (the lead's files): TopStrip, StarterCard, Ticket, PositionsAccessory.
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
- **Lead files, open item:** `TopStrip` still draws the D2 "SENRYO/千両" wordmark in the system CJK face.
- **S1b.7 spike (D-193): headless tabs pass.** The run was on a separate iPhone 17 simulator, using the release app with
  this branch's Hermes bundle swapped in. All five probe checks pass: stack per tab, scroll (Home and Markets), the dock
  hiding during entry, and the content inset.
  - The spike lives at `src/app/dev-shell-spike/**` and `src/features/shell-spike/*`. It is dev-only and not linked
    from the app; `?probe=1` reruns the checks.
  - Screenshots (scratchpad): `shots/spike3/t01–t22.png` and `shots/compare/dock-vs-F12.png`.
  - The S1b.7 build itself (the lead's `(tabs)/_layout.tsx` migration, the fan, the header and the route remap) is
    still open, so S1b.7 stays unticked.
- **Visual check of the token swap** (scratchpad `shots/app`, `shots/compare`): every screen now shows the violet-black
  surfaces, blue primary and Inter. These D2-era features still show, because they come from their components, not
  the tokens; each is rebuilt in its journey:
  - uppercase button and segment labels (`kit/Button`, `kit/Segmented`);
  - the green eyebrow on the welcome;
  - the TopStrip wordmark;
  - the Kinpaku card PNG, which is still the D2 lemon gold (`brand/kinpaku-card*`): an art task to recolour through the
    gold-leaf ramp (S1b.3, B12).

## Handoff
