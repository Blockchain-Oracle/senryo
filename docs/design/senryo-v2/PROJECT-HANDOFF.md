# Senryo adaptation packet — "Living Lacquer" (PROJECT-HANDOFF)

> Destination-specific handoff required by the `mobile-reference-study` skill and the `reference-product-fidelity` contract.
> Written 2026-10-01 for stage S1b (v2-plan W4.1, D-190). Two identical copies exist: the study's own
> `docs/design/reference-study-2026-09-30/PROJECT-HANDOFF.md` (the study folder is local and untracked until the user
> decides Q-021) and the tracked `docs/design/senryo-v2/PROJECT-HANDOFF.md`. Paths below are repo-root relative, written as
> code so they resolve from either copy. The machine ledger is `docs/design/senryo-parity-ledger.json` (216 rows).


> **Decisions 1 Oct 2026:** predictions/sports, NFTs, the dApp browser, travel/borrowing/virtual accounts/cashback and the tracking prompt are **Excluded by the user (D-194)**; a separate PIN/password is **Excluded (D-195)** — the passkey falls back to the phone's own lock. These get no screens and no reserved placeholders.

## 1. Authority record (reference-product-fidelity §1, v2-plan §1)

| Field | Value |
|---|---|
| Target | Senryo mobile app (`apps/mobile`), then web (`apps/web`) through the shared tokens (`packages/tokens`) and identity (`packages/identity`) packages |
| Reference artifacts | `docs/design/reference-study-2026-09-30/**`: recordings R1 Solflare, R2 Phantom and R3 Fomo (sha256 in `evidence/R*/metadata.json`); 97 screens, 18 motion clips, C01–C44, LG01–LG38, FT001–FT116, OP01–OP18. Bundled copy: `~/.claude/skills/mobile-reference-study/assets/reference-study-2026-09-30/` |
| Authority order | 1. the user's latest words; 2. the study's observed evidence (screens and motion); 3. the study's guides; 4. Senryo product rules in `docs/plan/00-plan.md` (money, passkeys, honesty) |
| Superseded | D2 Desk (D-004), `design/DIRECTIONS.md`, the `design/screens/d2-*` screenshots and the D2 `.21st/design.json` manifests are history only (D-168). The study's own D2 remarks carry SUPERSEDED banners (declared in the study's `COPY-MANIFEST.json`) |
| Design direction | `docs/design/senryo-v2/direction.md` (Codex, verbatim) and `docs/plan/v2-plan.md` §5 |
| Baseline strength | Minimum baseline for every journey the references show. Senryo-specific money semantics are Adapted, never faked |
| Allowed deviations | Brand name and our own logo (the 千 seal; colour treatment may change). Product rules: passkeys not OAuth, the practice/mainnet split, the oracle-priced RWA engine, no custody, D-041 no fiat ramp at launch (Blocked B3, not dropped) |
| Additions | Handles/avatars, leaderboard/follow, trade feed (observed in Fomo, so Adapted). Practice↔Mainnet toggle, Kinpaku card, LP vault, TP/SL |
| Missing evidence | Passkey ceremony, text password, successful funding/order/SL save, settings menu, send result (study `06-capture-gaps.md`). Senryo builds these to its own spec; the completed-outcome claim FT115 stays Blocked B1 until our own finalized lifecycles are in `docs/plan/acceptance.md` |
| Provenance | Evidence crops are not production logos. Every mark comes from a first-party kit or authoritative metadata with source URL, licence, date and sha256 (`packages/identity`, invariant `identity-provenance`) |
| Task boundary | Plan + implementation stage by stage (S1b.5–S1b.17). [OK?] steps (money, mainnet, deploys, outbound messages, EAS builds) wait for the user at that moment |

## 2. How to use this packet

1. Pick the journey slice (order: J4 → J3 → J6/J10 → J5 → J2 → J1 → J8 → J7/J9 → J11; v2-plan W4.5).
2. Open every evidence ID listed for it below in the study (`gallery.html`, or `python3 tools/serve.py` for clip seeking).
   Watch the M-clips; never design from settled frames alone.
3. Read the ledger rows (`docs/design/senryo-parity-ledger.json`, filter `journey`) for class, target module, data authority,
   failure/recovery and the acceptance evidence required.
4. Build with the tokens (`packages/tokens`: palette, type, radius, spacing, motion, materials) and real marks
   (`EntityMark`). Utility icons are Lucide; entities are never Lucide.
5. Record each component's port/reconstruction in `apps/mobile/.21st/design.json` with evidence IDs, provenance and
   declared deviations (D-033 as amended by D-168).
6. Accept per journey (S1b.17): 402×874 screenshots beside the reference frames, motion start/settle/exit against the clips,
   parent restoration with values kept, loading/empty/error/retry, reduced motion/transparency → `docs/plan/acceptance.md`.

## 3. Selected journeys and their evidence IDs

Every ID resolves through `screen-index.json`, `motion-index.json`, `asset-identity-register.json`,
`feature-inventory.json` and `reference-ledger.json` in the study. Blocked families are listed under RS (reserved) so
they never disappear.

| Journey | Stage | Features (FT) | Components (C) | Motion (M) | Identity (LG) | Also reuses |
|---|---|---|---|---|---|---|
| **J1** Onboarding | S1b.13 | FT001, FT002, FT003, FT006, FT007, FT008, FT035, FT036, FT037, FT038, FT039, FT041, FT042, FT043, FT062, FT063, FT064, FT065, FT066, FT067, FT068, FT114 | C01, C02, C03, C04, C06, C07, C08, C09, C10, C11, C12 | M01, M05, M17, M18 | LG25, LG26, LG29, LG30, LG31 | FT044 mode explanation (scene 6), LG13 Monad, LG38 koban/chōgin in hero art |
| **J2** Add money | S1b.12 | FT011, FT012, FT013, FT014, FT015, FT016, FT017, FT018, FT019, FT056, FT057, FT060, FT087, FT088, FT091, FT093, FT094 | C32, C33, C34, C35, C37 | M04, M07, M12, M16 | LG04, LG05, LG08, LG09, LG10, LG11, LG12, LG13, LG14, LG15, LG23, LG24 | FT044 mode on receive/QR, FT061 parent restoration, C44, M06 (fan entry) |
| **J3** Markets | S1b.9 | FT032, FT033, FT045, FT048, FT071, FT072, FT095, FT096, FT097, FT098, FT099, FT100 | C14, C22, C26 | M08 | LG01, LG02, LG03, LG06, LG16, LG17, LG18, LG19, LG38 | FT046, C16 header + chips, C25 detail sheet, M09, LG07 venue chip, J11 tokens category |
| **J4** Ticket | S1b.8 | FT101, FT102, FT103, FT104, FT105, FT106, FT107, FT108, FT109, FT110, FT111, FT112 | C39, C40, C41, C42, C43 | M13, M14, M15 | LG07 | FT095 identity + venue, C26 chart, C44, M07/M08 sheet families, LG06/LG38 marks |
| **J5** Positions | S1b.11 | FT075 | C25 | — | — | FT074 shared-position anatomy, FT110–FT112 TP/SL child, C26 chart, C42, M08, M15 |
| **J6** Home | S1b.10 | FT009, FT046, FT069, FT070 | C19, C20, C23 | — | — | FT044 mode capsule, FT073 collapse, C16, C22 rows, C25 position sheet, M09, LG13 |
| **J7** Card | S1b.15 | FT022, FT023, FT024, FT092 | C21 | M03 | LG28 | C25 tall detail (authorization), C12 gate, M08 |
| **J8** Social | S1b.14 + S12b | FT058, FT059, FT074, FT076, FT077, FT078, FT079, FT083, FT085, FT086 | C27, C28, C29, C30, C31, C38 | M11 | LG32 | FT070 Top Trades, FT075 position chart, C23, C25, M10 |
| **J9** You | S1b.15 | FT010, FT080, FT081, FT082 | — | — | — | C28/C29 own profile, FT043/FT008 notification state, FT114 passkey management |
| **J10** LP | S1b.10 | FT026 | — | — | — | C20 vault tile, C39 ticket anatomy for deposit/redeem, C25 |
| **J11** Spot tokens | S1b.16 | — | — | — | LG20, LG21 | FT071 token rows, C22, C37, M07 |
| **SH** Navigation shell (S1b.7) | S1b.7 | FT034, FT044, FT055, FT061, FT073 | C13, C15, C16, C17, C18 | M02, M06, M09, M10 | — | C14 pill segments, C31 search entry, M07 (fan → sheet) |
| **RS** Reserved blocked families | reserved (no step until unblocked) | FT004, FT005, FT020, FT021, FT025, FT027, FT028, FT029, FT030, FT031, FT040, FT047, FT049, FT050, FT051, FT052, FT053, FT054, FT084, FT089, FT090, FT113 | C05, C24, C36 | — | LG22, LG27, LG33, LG34, LG35 | — |
| **X** Cross-journey | S1b.17 | FT115, FT116 | C44 | — | LG36, LG37 | every journey |

## 4. Ledger summary (Exact / Adapted / Additive / Blocked / Excluded)

Classes follow v2-plan §7 (Codex's triage with the lead's corrections). **Nothing is Excluded by a new decision:** the only
Excluded rows are binding existing rules (OAuth, D-029; recovery-phrase import). Codex's proposed exclusions stay Blocked
and reserved until the user answers Q-020.

| Class | Features | Components | Motion | Identity |
|---|---|---|---|---|
| **Exact** | 8: 010, 012, 018, 043, 045, 061, 102, 112 | 1: C44 | 0: — | 0: — |
| **Adapted** | 79: 001, 002, 006, 007, 008, 009, 011, 013, 014, 015, 016, 017, 019, 022, 023, 024, 026, 032, 033, 034, 035, 038, 039, 041, 042, 044, 046, 048, 055, 056, 057, 058, 059, 060, 062, 063, 065, 066, 067, 068, 069, 070, 071, 072, 073, 074, 075, 076, 077, 078, 079, 080, 081, 082, 083, 085, 086, 087, 088, 091, 092, 093, 094, 095, 096, 097, 098, 099, 100, 101, 103, 104, 105, 106, 107, 108, 109, 110, 111 | 40: C01, C02, C03, C04, C06, C07, C08, C09, C10, C11, C12, C13, C14, C15, C16, C17, C18, C19, C20, C21, C22, C23, C25, C26, C27, C28, C29, C30, C31, C32, C33, C34, C35, C37, C38, C39, C40, C41, C42, C43 | 18: M01, M02, M03, M04, M05, M06, M07, M08, M09, M10, M11, M12, M13, M14, M15, M16, M17, M18 | 23: LG01, LG02, LG03, LG04, LG06, LG07, LG09, LG10, LG13, LG16, LG17, LG19, LG20, LG21, LG23, LG24, LG29, LG30, LG31, LG32, LG36, LG37, LG38 |
| **Additive** | 2: 114, 116 | 0: — | 0: — | 0: — |
| **Blocked** | 25: 003, 004, 005, 020, 021, 025, 027, 028, 029, 030, 031, 036, 040, 047, 049, 050, 051, 052, 053, 054, 084, 089, 090, 113, 115 | 3: C05, C24, C36 | 0: — | 13: LG05, LG08, LG11, LG12, LG14, LG15, LG18, LG22, LG27, LG28, LG33, LG34, LG35 |
| **Excluded** | 2: 037, 064 | 0: — | 0: — | 2: LG25, LG26 |

**Partial rows and branches** (the row ships as shown; the branch keeps its class):

| Row | Ships as | Branch | Branch class |
|---|---|---|---|
| FT002 | Adapted | OAuth create/sign-in methods | Excluded (D-029) |
| FT002 | Adapted | Shield/hardware method | Blocked (B4) |
| FT003 | Blocked | recovery-phrase import | Excluded (D-029/D-169 binding) |
| FT032 | Adapted | fast equity execution | Blocked (B2) |
| FT032 | Adapted | competition card | Blocked (B5) |
| FT036 | Blocked | recovery-phrase import | Excluded (D-029/D-169 binding) |
| FT041 | Adapted | referral reward/incentive | Blocked (B5) |
| FT060 | Adapted | fiat 'Add Cash' branch | Blocked (B3) |
| FT063 | Adapted | tracking prompt | Excluded (D-194) |
| FT067 | Adapted | referral reward/incentive | Blocked (B5) |
| FT080 | Adapted | Google connected account | Excluded (D-029) |
| FT080 | Adapted | Link X | Blocked (B6) |
| FT082 | Adapted | Rewards | Blocked (B5) |
| FT086 | Adapted | Clans category | Blocked (B6) |
| FT091 | Adapted | fiat provider minimum | Blocked (B3) |
| FT092 | Adapted | fiat purchase verification | Blocked (B3) |
| FT093 | Adapted | fiat payment-method return | Blocked (B3) |
| C03 | Adapted | OAuth rows | Excluded (D-029) |
| C03 | Adapted | Shield/hardware/private-key rows | Blocked (B4) |
| C04 | Adapted | OAuth browser boundary | Excluded (D-029) |
| C07 | Adapted | tracking prompt | Excluded (D-194) |
| C10 | Adapted | referral reward | Blocked (B5) |
| C12 | Adapted | prediction insider attestation | Excluded (D-194) |
| C20 | Adapted | benefit tiles (travel/borrow/cashback) | Excluded (D-194) |
| C23 | Adapted | live presence/chat on cards | Blocked (B6) |
| C28 | Adapted | rewards utility | Blocked (B5) |
| C29 | Adapted | Google connected account | Excluded (D-029) |
| C29 | Adapted | Link X | Blocked (B6) |
| C30 | Adapted | clans | Blocked (B6) |
| C31 | Adapted | Clans tab | Blocked (B6) |
| C33 | Adapted | fiat row | Blocked (B3) |
| C37 | Adapted | prediction Buy Up ticket | Excluded (D-194) |

**Blocked rows by blocker:**

| Code | Scope | Rows | Unblocks when |
|---|---|---|---|
| B1 | FT115 completed lifecycles | FT115 | Our own finalized deposits/orders/TP-SL/close/send/spend, with receipts and recovery (acceptance.md) |
| B2 | Equities/oil execution | FT032·branch | W6 feed research passes (D-220), or Data Streams (Q-008) / Pyth (Q-014, paid → [OK?]) |
| B3 | Fiat purchase | FT020, FT021, FT089, FT090, C36, LG22, LG27, LG35, FT060·branch, FT091·branch, FT092·branch, FT093·branch, C33·branch | User decision + provider (Coinbase Onramp / Transak / MoonPay with Monad USDC, Q-018) + D-041 change + [OK?] |
| B4 | hardware/private-key import | FT003, FT036, FT002·branch, C03·branch | An explicit security model beside passkeys (PIN/password FT004, FT005, FT113, C05: Excluded, D-195) |
| B5 | Rewards, referrals, competitions, benefits | FT025, FT029, FT030, LG33, FT032·branch, FT041·branch, FT067·branch, FT082·branch, C10·branch, C20·branch, C28·branch | A defined programme (eligibility, accounting, payout) |
| B6 | News, chat, X link, clans | FT031, FT040, FT047, FT084, LG34, FT080·branch, FT086·branch, C23·branch, C29·branch, C30·branch, C31·branch | Real sources/services and moderation |
| ~~B7~~ | NFTs, dApp browser | FT027, FT028 | **Excluded (D-194, user 1 Oct)** |
| ~~B8~~ | Predictions | FT049, FT050, FT051, FT052, FT053, FT054, C24, C12·branch, C37·branch | **Excluded (D-194, user 1 Oct)** |
| ~~B9~~ | Tracking prompt | FT063·branch, C07·branch | **Excluded (D-194, user 1 Oct)** |
| B10 | Perpl practice + Perpl TP/SL | — | A funded testnet flow (Q-002) or a labelled paper adapter; Q-003 prerequisites |
| B11 | Real Kinpaku issuance/spend | LG28 | S10 provider evidence |
| B12 | Production logos + authored art | LG05, LG08, LG11, LG12, LG14, LG15, LG18 | First-party provenance plus material review (W3, v2-plan §5.10) |

**Where the lead corrected Codex's triage** (v2-plan §7):

| Row | Codex | Ledger | Correction |
|---|---|---|---|
| FT032 | Blocked | Adapted | Partial row: equity discovery ships Adapted (indicative, D-175/D-220). |
| FT041 | Blocked | Adapted | Lead correction (v2-plan §7): the code/Paste/'I don't have one'/skip pattern redeems a Senryo voucher (redeemVoucher + voucher route); semantic difference disclosed. |
| FT063 | Blocked | Adapted | Partial row: the notification primer ships (043 covers the native surface). |
| FT067 | Blocked | Adapted | Lead correction (v2-plan §7): Paste / no-code completion redeems a Senryo voucher; referral rewards stay B5. |
| FT081 | Blocked | Adapted | Lead correction (v2-plan §7): our own 24-word export under step-up already exists (S6 PhraseGrid, Account → Advanced, D-148). |
| FT091 | Blocked | Adapted | Lead correction (v2-plan §7): minimum-deposit validation already exists in the Aurora/QR deposit ('below min', F17/F21) and swap tickets. |
| FT092 | Blocked | Adapted | Lead correction (v2-plan §7): the identity-verification handoff pattern serves card KYC (Immersve hosted KYC, S10; real issuance B11). |
| FT093 | Blocked | Adapted | Lead correction (v2-plan §7): retained amount + fee lines already exist in the Aurora/QR deposit and swap tickets. |

## 5. Senryo rules every journey keeps

| Rule | Binding source | What it means on screen |
|---|---|---|
| Passkeys, not OAuth | D-007, D-029, D-150 | Create / I already have an account; the OS owns the ceremony; the art stays alive while it is pending (P01/P04). No Google/Apple/X sign-in; no seed import. Provider marks only when the OS identifies the provider; otherwise "Passkey" |
| Confirm = 500 ms hold | D-177, D-028/D-037 | Pill "Hold to open Long/Short" with linear progress; early release cancels; an expired quote resets; an accessible explicit review/confirm alternative exists; native auth and risk checks are distinct from submission. C43's slider is only ever shown disabled, so no slide-to-confirm |
| Success = finalized | D-114, D-163 | The trace distinguishes signing · checking · submitted · proposed · voted · finalized · failed · abandoned. Receipts, completion foil and "credited" states appear only after finalization. Nothing celebrates a submit |
| Mode honesty | D-172, F-80 | Mode capsule "Practice · Paper money" (violet) / "Mainnet · Real money" (blue) on every money surface; `P$` for paper; receipts carry their own mode; drafts keyed per (mode, market); Perpl practice only with a verified route (B10) |
| Money availability | D-178, `docs/plan/specs/risk-math.md:20` | Free to trade / Free to spend / Locked are overlapping capacities in three cells, never an additive bar |
| Honest data | D-020, D-064, D-175 | No fabricated prices or ticks; equities show "Indicative · Hourly calculated feed · Trading unavailable"; JPY/USD never silently inverted; unknown values are skeleton/stale/unavailable, never $0.00 |
| Real identity | D-170, invariant `identity-provenance` | Every known entity uses its first-party mark; gaps render a labelled neutral fallback; gold means Senryo/Kinpaku only |
| No custody, no fiat at launch | D-007, D-041 | Fiat purchase is reserved (B3); QR/voucher/other-chain/exchange routes ship |
| Accessibility | FT116, A01/A02 | 44 pt targets, VoiceOver labels, reduced motion (static art, ~100 ms crossfades), reduced transparency (opaque glass), restrained haptics (selection ticks, one on submit, one on the confirmed outcome), no sound by default |

## 6. Art tasks with provenance

Production art is SVG masters rendered with Skia/SVG + Reanimated; no Rive or Lottie (direction §10). Every file carries
source/author, licence, retrieval or authoring date and sha256 in `packages/identity/src/art/*` (marks) or `brand/` (originals).

| Asset | Direction | Status (2026-10-01) | Provenance record |
|---|---|---|---|
| XAU koban | Original gold koban, embossed 千, edge thickness, restrained foil (never Tether Gold, LG19/LG38) | First pass `brand/art/xau-koban*.svg` (S1b.3) | `packages/identity/src/art/originals.ts` (senryo-original) |
| XAG chōgin | Original silver chōgin bar, same viewpoint and optical scale | First pass `brand/art/xag-chogin*.svg` | same |
| FX flag-pair discs | EU/US, UK/US, JP/US, CH/US, CA/US with pair text always present | First pass `brand/art/fx-*.svg` | derivedFrom public-domain flags (licence flags: Euroflag, Canada prohibited mark, Swiss cross) |
| Senryo venue chip | Venue identity on ticket/position/receipt | First pass `brand/art/senryo-venue.svg` | senryo-original |
| Onboarding hero (6 scenes) | One balance · passkeys · commodities/FX/crypto · LP liquidity · Kinpaku · Practice↔Mainnet; lacquer card, koban/chōgin, passkey object, real market marks; anchored controls | **Open** — illustrator/design-agent review before J1 | to be recorded (senryo-original) |
| Completion foil | Gold leaf flexes; highlight crosses the 千 seal after the real outcome (M18) | **Open** | to be recorded |
| Default avatars ×12 | Original illustrated portraits, stable per account, editable | **Open** | to be recorded |
| Seal | Existing geometry, recoloured through the gold-leaf ramp | Kept (`brand/senryo-seal*.svg`) | D-065 (Zen Old Mincho outline, OFL) |
| Kinpaku card | Lacquer card with gold leaf | Current art `brand/kinpaku-card*.svg`; recolour via the material ramps | senryo-original |
| FIDO passkey icon | Every passkey surface (≥ 24 px, one flat colour, ≥ 3:1) | **Blocked** behind the FIDO form/agreement (Q-019, user [OK?]) | — |
| Missing third-party marks | BNB, Tron, Polygon, USDT, Robinhood Chain, Arc, NVDA/TSLA/SPY… company art, USDC Symbol vector, Perpl colour vector, Aurora B/W sign, mono Monad/Solana/Bitcoin | **B12 gaps** (stage-01b Findings S1b.2); labelled fallback until acquired | — |
| Licence flags for the user | Circle (USDC), Arbitrum/Uniswap/Chainlink written permission, Solana badge combination, Coinbase press-footer terms | Recorded in each art record | — |

B12 stays open until the user's design agent or illustrator reviews these pieces against the evidence (v2-plan §5.10).

## 7. Screen inventory (98 surfaces) with states and parent restoration

Codex's inventory (direction "Full redesigned screen inventory") plus the v2-plan J1 voucher step and J11 token surfaces.
Presentation families follow the sheet grammar (direction §5): **tab root** · **page push** · **compact selector**
(content-sized, < 60 %, dim) · **tall detail** (90–94 %, sticky actions) · **full-height transaction** (fixed identity and
action zones) · **nested child** (explicit back, keyboard-aware) · **native handoff**. Every financial route carries mode;
every asynchronous route has loading, empty where applicable, failure, retry/cancel and restored-parent behaviour.

| # | Surface | Journey | Presentation | Components / evidence | States | Parent restoration |
|---|---|---|---|---|---|---|
| 1 | Story welcome | J1 | root page (signed out) | C01/C02, S01–S06, M01 | scenes 1–6 (swipe/auto), reduced-motion static scenes; hint absent → Create primary / hint present → Sign in primary (D-029); Browse markets | app entry; Browse markets returns here with the scene index kept |
| 2 | Create passkey | J1 | page push → native OS sheet | C04, P01/P04, FT114 | education · pending with living art · OS cancel · error (RequestFailed/BadConfiguration → web route, D-150) · created | cancel/error returns to this step with Retry; success continues to Handle setup |
| 3 | Returning sign-in | J1 | native discoverable get | FT114 | pending · cancelled · no credential · error · restored account | continues to the preserved destination (account-required origin) or Home |
| 4 | Account recovery / new-device guide | J1 | page push | FT114, D-148/D-153 | provider explanation · backup passkey (server vault / file) · help · error; no seed form | back returns to Returning sign-in |
| 5 | Handle setup | J1 | onboarding page, keyboard-aware | C09, P05/P07/P08, F04/F05 | empty · typing · checking · invalid (length/characters) · unavailable · held · available · submitting · error; Skip; privacy note (same address on both networks) | back keeps the typed handle; Skip continues without a profile |
| 6 | Follow setup | J1 | onboarding page | C11, F06 | skeleton · ranked list (none preselected, reason per row) · selection count · Show more · empty (no ranked traders on this network) · failure + Retry · Skip | back returns to Handle setup with the handle kept |
| 7 | Voucher code step | J1 | onboarding page, keyboard-aware | C10, P09/F07 (FT041/FT067 pattern) | empty · Paste · validating · invalid · already redeemed · redeeming · credited (finalized) · I don't have one | back returns to Follow setup with selections kept |
| 8 | Terms acknowledgment | J1 | compact selector over dim | C12, F08 | unchecked (disabled) · checked (enabled) · pending · error | dismiss returns to the previous step; acceptance recorded |
| 9 | Biometric primer | J1 | onboarding page → native permission | C06, S11/S12, P10 | enable · defer · OS prompt · denied (Settings link) · no biometrics on device | continues to the next step either way |
| 10 | Notification primer | J1 | onboarding page → native prompt | C07, S14, P11 | enable · defer · OS prompt · denied · already decided (skipped) | continues either way |
| 11 | Account completion | J1 | onboarding page | C08, S13, M18 | foil reveal only after the account exists (reduced motion: static foil) · precise completion copy · Continue | Continue goes to Home or the preserved destination; no back into the ceremony |
| 12 | Account required | J1 | compact selector | C03 | intended action named · Create / Sign in · pending | dismiss restores the originating surface; after auth the intended action resumes |
| 13 | Step-up / session locked | J1 | compact selector → native auth | D-028/D-142 | reason · pending · cancelled (nothing sent) · error + Retry · unlocked | returns to the originating action with its values intact |
| 14 | Home | J6 | tab root | C16/C19/C20/C23, F09/F12, M09 | skeleton · unfunded (funding routes) · funded · stale stamp · failure + Retry · collapsed header (seal, compact balance, mode) · Practice/Mainnet | tab root; scroll offset and header collapse restored on return |
| 15 | Balance details | J6 | tall detail | C19, D-178 | loading · reconciliation (At Perpl, LP allocation/redemption, unrealised, Locked → margin/holds) · stale · failure | dismiss restores Home at the same scroll |
| 16 | Mode selector / Mainnet acknowledgment | SH | compact selector | FT044, D-172 | two explained rows · current mode · 'Switch to real money' acknowledgment · Mainnet read-only before launch · switching (quotes invalidated) | returns to the originating surface; drafts per (mode, market) restored or discard asked |
| 17 | Positions | J6 | Home section + page push | C22/C25, FT075 | skeleton · empty · rows (instrument/venue/side, exposure, entry, P&L, liquidation, status) · stale · failure | back restores Home scroll |
| 18 | Own position detail | J5 | tall detail | C25/C26, F13/F14 | loading · chart reveal after data · live · stale · closed · failure; actions TP/SL, add margin, reduce, close | dismiss restores the list it came from (Home/Markets) with scroll |
| 19 | Orders / triggers | J5 | page push | FT110, D-034 | Pending/Completed/Cancelled · empty · edit · cancelling · failure | back restores the parent page |
| 20 | Activity history | J5 | page push | FT082 | filters · skeleton · paging · empty · failure + Retry; each row carries its own mode/venue | back restores the parent page and filter |
| 21 | Receipt | J5 | tall detail | FT115 (B1), OP16 | pending vs finalized (success only when finalized, D-114) · failed · abandoned · own mode carried | returns to the trace/activity/position it came from |
| 22 | Share preview | J5 | compact selector → native share | OP16 | rendering · ready · opt-in identity · shared/cancelled | returns to the receipt |
| 23 | Service status | J9 | page push | D-121/D-124 | network · oracle · indexer · Perpl · Aurora · card; last update; degraded/unknown | back to You/Help |
| 24 | Markets / Watchlist | J3 | tab root | C22/C23, F10/F11, M09 | All/Watchlist + Commodities · FX · Crypto · Equities chips · skeleton rows · empty watchlist (trending) · indicative/unavailable labels · stale · failure + Retry · first-use 'Go long or short' card | tab root; scroll and selected category restored |
| 25 | Market filters | J3 | compact selector | C22 | category/venue/availability · apply · reset | returns to Markets with filters applied |
| 26 | Market detail | J3 | page push | C22/C26, F32–F35, FT095–FT100 | chart loading → reveal · live · stale · session closed · indicative (equities) · tabs Holders/Feed/About · sticky Short/Long with disabled reasons | back restores Markets scroll + category |
| 27 | Market Holders tab | J3 | tab within market detail | FT098, F32/F33 | loading · empty · failure + Retry · Friends filter; leveraged positions of opted-in handles only | tab selection kept while the ticket opens/closes |
| 28 | Market Feed tab | J3 | tab within market detail | C27, F34 | loading · empty · failure + Retry · trade/thesis events linking to traders/positions | tab selection kept |
| 29 | Market About tab | J3 | tab within market detail | F35 | instrument type · session · feed/source/freshness · limits · venue · links | tab selection kept |
| 30 | Market history | J3 | page push | FT097 | periods · events/trades · empty · failure | back to market detail |
| 31 | Order eligibility | J4 | compact selector | C12, F36, M13 | unchecked · checked · pending · failure (Mainnet only) | accept continues to the ticket; dismiss restores market detail |
| 32 | Order ticket | J4 | full-height transaction | C39/C40/C43, F37–F42, M14 | enter amount · valid · insufficient · below minimum · blockers (session closed, stale price, no gas → staged top-up) · holding (500 ms) · quote expired → reset · signing → trace | dismiss restores market detail; draft kept per (mode, market) |
| 33 | Embedded ticket chart | J4 | region swap inside the ticket | C41/C26, F39 | keypad ↔ chart; amount/leverage retained | toggling never leaves the ticket |
| 34 | Candle settings | J4 | nested child | FT106, F40 | body/border/up/down/previous-close options · Cancel · Save (persisted) | returns to the ticket chart |
| 35 | Risk introduction / liquidation info | J4 | nested child | C42, F43 | market-specific explanation · examples · dismiss | returns to the ticket |
| 36 | TP/SL editor | J4 | nested child, keyboard-aware | C42, F44/F45, M15 | price/% pairs · side-aware invalid · suggestions · result preview · save/remove · pending | returns to the ticket or position detail with values kept (FT112 Exact) |
| 37 | Add margin / reduce / close | J5 | full-height transaction | C25/C39 | amount/% · quote/fees · review · hold · trace | returns to position detail |
| 38 | Execution trace | J4 | attached to the transaction sheet | D-163/D-177 | signing · checking · submitted · proposed · voted · finalized · failed · abandoned; reconciliation | stays attached to its transaction; leads to the receipt |
| 39 | Alerts list | J3 | page push | D-034 | skeleton · empty · active · triggered · failure | back to market detail / You |
| 40 | Alert editor | J3 | nested child | D-034 | price/condition · mode · notification permission · invalid · saving | returns to Alerts list |
| 41 | Add-money hub | J2 | compact selector | C33, F20, M12 | mode-aware rows: practice claim · voucher · other chain · Monad wallet · exchange · swap; fiat row reserved (B3) | dismiss restores Home or the fan origin |
| 42 | Practice claim | J2 | nested child | C44, OP12 | checking (never idle first) · claimable · pending · credited (finalized) · already claimed · error + Retry · Mainnet copy (voucher/deposit/MON) | back returns to the hub |
| 43 | Voucher | J2 | nested child, keyboard-aware | C10/C44 | code · scan · Paste · validating · invalid · already used · redeeming · credited | back returns to the hub with the code kept |
| 44 | Source-chain selector | J2 | nested child | C34, F21, M16 | authentic mono marks + full names · supported-state disclosure · selected | explicit back to its actual parent |
| 45 | Asset selector | J2 | nested child | C34, S27, F22 | real token art · search/Paste · restrictions · no results | explicit back to its parent |
| 46 | Other-chain funding primer | J2 | nested child | C35, S22 | route explanation · supported assets · requirements | back to the hub |
| 47 | Other-chain route configuration | J2 | tall detail | C35, S23–S26 | source/asset → Monad · fee/time · quote expiry · loading · failure + Try again | back keeps the selections |
| 48 | Other-chain deposit QR | J2 | page push | C32, S21, M04 | QR assembly (valid payload) · source network/asset · destination · warnings · copy/share | back returns to configuration |
| 49 | Monad receive QR | J2 | page push (fan: compact QR sheet) | C32, S21/P21, FT057 | Monad 143/10143 + mode · permitted asset · address · Copy/Share · warning | fan entry restores the page under the fan |
| 50 | Deposit status / detail | J2 | page push | C35 | received · processing · credited · expired · refund · resume/recovery | back to the hub or Activity |
| 51 | Monad-wallet funding instructions | J2 | page push | FT094 | asset/network/address · transfer requirements · app return · status | back to the hub |
| 52 | Exchange chooser | J2 | nested child | F28, LG23/LG24 | real exchange marks · search · supported destinations | back to the hub |
| 53 | Exchange withdrawal instructions | J2 | page push | FT094 | selected exchange · 'withdraw USDC on ⟨network⟩ to this address' · QR/copy · pending tracking | back to the chooser |
| 54 | Withdraw hub | J2 | compact selector | D-034 | send / cash-out destinations · withdrawable amount · mode | dismiss restores the origin |
| 55 | Send recipient | J8 | full-height transaction | C38, P22 | skeleton → no recents · @handle/address search · results · invalid · scan · contacts | dismiss restores the page under the fan |
| 56 | Contact creation | J8 | nested child | C38 | name/identity · validation · save/remove | back to Send recipient |
| 57 | QR scanner | J8 | full-screen modal + camera permission | C38 (expo-camera, new native module) | permission · framing · parsed network/asset · invalid · mismatch | returns to Send recipient with the parsed value |
| 58 | Send review | J8 | full-height transaction | C38, FT058/FT059 | recipient + address + asset + network + mode · amount/fees · hold · trace | back keeps the amount and recipient |
| 59 | Cash-out destination / review | J2 | full-height transaction | D-034 | supported exit route · amount · fees/limits · destination · trace | back to Withdraw hub |
| 60 | Swap ticket | J2 | full-height transaction | C37, P20, M07 | pay/receive selectors · quote loading · insufficient · slippage · review · hold · trace | dismiss restores the page under the fan |
| 61 | Swap route details | J2 | nested child | C37, D-122 | route + Uniswap attribution · minimum received · expiry | back to the swap ticket |
| 62 | Kinpaku first-use tutorial | J7 | page push | C21, S16/S17, M03 | authored card · capacity teaching · Next / Got it | lands on Card home |
| 63 | Card home | J7 | tab root | C20, S18, FT024 | lacquer card art · availability · Free to spend · controls · activity · Sandbox labels | tab root; scroll kept |
| 64 | Card reveal | J7 | compact selector + step-up | D-015 | protected reveal · issuer fields or sandbox equivalents · hide on background | dismiss restores Card home |
| 65 | Spend allowance | J7 | page push | D-032 | current limit · capacity · adjust · step-up · saving · saved | back to Card home |
| 66 | Freeze / unfreeze confirmation | J7 | compact selector | D-015 | current state · effect · confirm/cancel · resulting state | returns to Card home |
| 67 | Card wallet provisioning | J7 | native handoff | B11 | supported provider · added · unavailable · error | returns to Card home |
| 68 | Card activity | J7 | Card section + page push | D-120 | holds · captures · releases · refunds · declines with reasons | back to Card home |
| 69 | Authorization / spend detail | J7 | tall detail | D-120 | merchant · amount · hold/capture/refund timeline · reason · receipt | dismiss restores Card activity |
| 70 | Card simulation | J7 | tall detail | D-036 | explicit sandbox label · scenario · hold/release · 'No charge' | dismiss restores Card home |
| 71 | Card availability | J7 | Card state | FT024 | coming soon · unavailable · provider outage · next action | inline on Card home |
| 72 | LP vault | J10 | page push from the Home tile | FT026, OP03 | composition/risk · sourced performance · own shares · deposit/redeem | back restores Home |
| 73 | LP deposit review | J10 | full-height transaction | D-059 | amount · shares/valuation · fees/risk · hold · trace | returns to LP vault |
| 74 | LP redemption review | J10 | full-height transaction | D-059 | shares/amount · available liquidity · timing/queue · hold · trace | returns to LP vault |
| 75 | LP request detail / history | J10 | page push | D-059 | pending · redeemed · failed · valuation · timeline · receipt | back to LP vault |
| 76 | Social Feed | J8 | tab root (Feed segment) | C27, F15 | Global/Friends · event/thesis cards · New activity pill · composer entry · loading · empty · failure + Retry | tab root; segment and scroll kept |
| 77 | Post / thesis detail and replies | J8 | page push | C27, F14 | trader/market/position context · thread · like · reply · share · loading · empty · failure + Retry | back restores the feed position |
| 78 | Compose thesis | J8 | full-height sheet, keyboard-aware | C27 | instrument/optional position · text ≤ 280 · audience · preview · publishing · error | dismiss asks to keep/discard the draft |
| 79 | People | J8 | tab root (People segment) | C30, F30 | Friends · recommendations · follow/unfollow · empty | segment and scroll kept |
| 80 | Leaderboard | J8 | People segment | C30, F29 | period 24h/7d/30d/All · mode · definition · ranked rows · Your rank · Not ranked | segment/period kept |
| 81 | Trader profile / public watch | J8 | page push | C28, F16/F19 | identity · bio · public metrics · positions · periods · follow · empty | back restores the origin list |
| 82 | Followers / following | J8 | page push | C30 | identity rows · relation state · search · follow controls | back to profile |
| 83 | Profile editor | J8 | page push | C29, F17/F18, M11 | handle/name/bio · avatar/banner · validation · changed-state Save · saving · error | back asks before discarding changes |
| 84 | Avatar / banner picker | J8 | nested child | C29, LG32 | 12 original defaults · own image · crop/preview · upload error · save | returns to Profile editor |
| 85 | Global search | J8 | page push from the search entry | C31, F31 | All/Markets/Tokens/Traders · recents · search/Paste · loading · no results · failure · Clans reserved (B6) | back restores the origin; destination returns here |
| 86 | You | J9 | tab root | C28 | own profile · account · activity · security · preferences · support | tab root; scroll kept |
| 87 | Account identity / addresses | J9 | page push | FT010/FT080 | large identity · networks/addresses · Copy · mode | back to You |
| 88 | Security / passkey management | J9 | page push | FT114, D-148 | credentials/devices · add backup passkey · revoke · step-up · recovery | back to You |
| 89 | Session policy | J9 | page push | D-141 | lock state · permissions · thresholds · explicit change · save | back to You |
| 90 | Preferences | J9 | page push | D-061 | theme · display/format · persistence | back to You |
| 91 | Notification settings | J9 | page push | FT043 | trading/card/deposit/social · OS permission state | back to You |
| 92 | Advanced | J9 | page push | FT081, D-148 | 24-word export under step-up (screen capture blocked) · other protected utilities | back to You |
| 93 | Delete app data | J9 | page push | D-034, Q-022 | exact local/server scope · onchain records distinguished · acknowledgment · result | back to You |
| 94 | Help / support | J9 | page push | D-165 | guides · incident context · contact route · sources (DB-IP attribution) | back to You |
| 95 | Terms / privacy | J9 | page push | C12 | documents · acknowledgment history | back to You |
| 96 | Token list (Tokens category) | J11 | Markets category | FT071, LG20 | token-list art · price · holdings · loading · empty · failure + Retry | Markets scroll/category kept |
| 97 | Token detail | J11 | page push | FT071 | identity · price/chart · holdings · Buy/Sell | back to Markets |
| 98 | Token buy/sell ticket | J11 | full-height transaction | C37 | quote · slippage · insufficient · hold · trace | dismiss restores token detail |

**Shell chrome** (S1b.7):

| Shell surface | Evidence | Contract | Restoration |
|---|---|---|---|
| Floating dock | C15, M09/M10 | Home · Markets · Card · Social · You; ~64 pt capsule, 16 pt inset, moving active region, visible labels; glass on iOS 26 (expo-glass-effect), blur+tint or opaque fallback; hidden during transaction entry | tab state, stack and scroll preserved; content inset so nothing sits under it |
| Action fan | C17/C18, P19, M06/M07 | plus → ×; Send · Receive · Add money · Swap circles (~48 pt, 72 pt spacing) in a right column, labels left, live blur (expo-blur) | dismiss/selection restores the page under it (FT061 Exact) |
| Collapsing header | C16, M09 | Home keeps seal, compact balance, mode; Markets keeps title, mode, chips; mode never scrolls away | collapse state follows scroll restoration |

**Reserved blocked families** (stay in the inventory; each shows its blocker until unblocked or the user excludes it):

| Reserved family | Blocker | Components required before completion |
|---|---|---|
| Fiat primer / provider choice | B3 | C20/C36, real provider identity, supported region/method |
| Fiat asset / amount / payment | B3 | C34/C36, search, keypad, minimum, quote, fee and method |
| Fiat verification / return / receipt | B3 | native/provider boundary, retained amount, decline/retry/refund/credit |
| Referral setup / redemption | B5 | C10, optional skip, valid/invalid code, terms, actual reward status |
| Rewards / campaigns | B5 | eligibility, provider identity, participation, redemption and payout (cashback: Excluded, D-194) |
| ~~Travel / borrowing / virtual accounts~~ | Excluded (D-194) | not built, no reserved screen |
| Competition | B5 | entry, period/scoring, rank, results and payout |
| Organization/news / live market chat | B6 | authentic sources/people, content, interactions, presence definitions |
| Clans list/detail/create/join | B6 | group identity, membership/permissions, scoring, leave/recovery |
| ~~Prediction discovery/detail/ticket~~ | Excluded (D-194) | not built, no reserved screen |
| ~~NFT collection/detail/transfer~~ | Excluded (D-194) | not built, no reserved screen |
| ~~dApp discovery/browser/connect~~ | Excluded (D-194) | not built, no reserved screen |
| X link/import | B6 | genuine authorization, cancel/error, confirmed account linkage |
| Shield/hardware/private-key setup | B4 | supported security model, native/device boundary, recovery/error |
| ~~PIN/password setup/recovery~~ | Excluded (D-195) | not built: phones without biometrics use the passkey with their own PIN/pattern/passcode |
| Protected export (beyond the existing 24-word export) | B4 | step-up, exact export capability, secure presentation and confirmation |

"Protected export": the 24-word export already ships under You › Advanced behind step-up (FT081, lead correction); the
reserved family covers any export capability beyond it.

## 8. Study gaps → Senryo treatment

| Study gap | Senryo treatment |
|---|---|
| G01 passkey creation / sign-in | FT114 Additive: real OS ceremonies, built to our spec (S6) |
| G02 text password | B4 reserved |
| G03 successful funding + receipt | B1 until our own finalized deposits are recorded |
| G04 enabled order confirmation | D-177 hold; B1 for the completed-outcome claim |
| G05 phrase/private key/Shield/hardware | phrase import Excluded (binding); the rest B4 |
| G06 denied permissions / interrupted auth | Built to our spec: every primer has denied/deferred states |
| G07 saved TP/SL | Built to our spec (TriggerOrders, D-034); Perpl TP/SL B10 |
| G08 settings / account management / export | You journey (J9) to our spec; export exists (FT081) |
| G09 send review/completion | J8 send to @handle/address with review + trace |
| G10 copy/share/favorite results | Built to our spec; native share sheet |
| G11 social interaction/search results/clans | S12b routes; clans B6 |
| G12 dismiss gestures, exact springs/blur/easing | Declared adaptations in `packages/tokens` motion (direction §4) |
| G13 audio/haptics/source formats | No sound by default; restrained haptics (FT116) |
| X01–X03 | Not requirements; X03 (dock/deposit collision) is the defect our content inset fixes |
| A01–A03 | Additive: reduced motion/transparency, VoiceOver/keyboard parity, web/desktop adaptation (S11b) |

## 9. Validation

- Study packaging: `python3 ~/.claude/skills/mobile-reference-study/scripts/validate_study.py docs/design/reference-study-2026-09-30`
  (links, evidence IDs, registers, media, crop bounds, clip durations, and the `COPY-MANIFEST.json` integrity of every
  unadapted file).
- Repo: `pnpm invariants` (identity-provenance, design-literals, design-json-present, no-ui-tests).
- This packet does not prove live UI behaviour; journey acceptance does (S1b.17).
