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
- [ ] S1b.1 **Identity registry** `packages/identity`:
  - canonical entity ids;
  - first-party SVG sources with URL, licence, date and sha256;
  - variants: colour disc / mono light/dark / symbol / wordmark;
  - codegen (SVG → react-native-svg + web) with arc-flag normalisation and no `<text>`;
  - an `EntityMark` with loading, failed and unidentified states;
  - invariant `identity-provenance`.
- [ ] S1b.2 **Marks acquired** (first-party only):
  - Monad (logomark, token, mono) and MON;
  - USDC (Circle), AUSD (`monad-crypto/token-list`/Agora);
  - BTC, ETH, SOL, HYPE, ZEC;
  - Base, Arbitrum, BNB, Tron, Polygon (as Aurora supports them);
  - Chainlink, Uniswap, Perpl, Aurora, Envio, DB-IP;
  - Coinbase, Binance, Kraken;
  - the FIDO passkey icon (Q-019);
  - FX flags (public domain).
- [ ] S1b.3 **Original art masters** in SVG + Skia:
  - XAU koban (embossed 千), XAG chōgin, five FX flag-pair discs, the Senryo venue chip;
  - six onboarding scenes, completion foil, 12 default avatars.

  The seal geometry is kept and recoloured through the gold ramp. **Design-agent/illustrator review before J1** (B12
  open until passed).
- [ ] S1b.4 **Replace every placeholder** (v2-plan W3 list): the fake live-font 千 seals, TopStrip "MONAD" dot, market,
  ticket and position symbols, the "In Perpl" swatch, collateral/LP/fund text rows, StarterCard coins, provider and source
  names, CardFace art, and the web `TokenIcon`/`SealMark`. Delete `ASSET_HUE`/`CHAIN_HUE`.
- [ ] S1b.5 **Handoff packet**:
  - `PROJECT-HANDOFF.md` (authority record, journeys with FT/C/M/LG IDs, ledger, Senryo rules, art tasks);
  - `docs/design/senryo-parity-ledger.json` (FT/C/M/LG rows with the fidelity-contract fields);
  - SUPERSEDED-by-D-168 banners on `design/DIRECTIONS.md`, the `d2-*` screenshots and the study's own D2 references (README:82, 05:89/104-105, 10:5, `reference-ledger.json`), recorded in `COPY-MANIFEST.json`;
  - `validate_study.py` passes.
- [ ] S1b.6 **Tokens** (direction §2–4):
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

## Handoff
