# Senryo v2 design direction — "Living Lacquer"

> Source: Codex CLI (gpt-6.1-sol, reasoning xhigh, read-only), consulted 30 Sep 2026 on `main@8f8acdd` with the
> `mobile-reference-study` and `reference-product-fidelity` skills, at the user's instruction (D-168). Verbatim below;
> the lead's corrections and the approved plan are in `docs/plan/v2-plan.md` (e.g. FT041/067/081/091/092/093 reclassified
> Adapted, §7). This file is the design authority together with `docs/design/reference-study-2026-09-30/`.

**Senryo 千両 — Living Lacquer**

Adopt **Fomo’s rounded trading interface and dark violet surfaces**, **Phantom’s contextual action fan**, and **Solflare’s illustrated onboarding and material artwork**. Senryo’s seal, gold leaf and lacquer provide the identity within that reference language.

This replaces D2 completely. It preserves the product breadth, including FX, crypto, equities and oil discovery.

This was a read-only review of local `main` at `8f8acdd`; no files changed. Evidence IDs below resolve through the [component catalog](../../../docs/design/reference-study-2026-09-30/05-components-and-agent-handoff.md), [feature inventory](../../../docs/design/reference-study-2026-09-30/09-feature-inventory.md), [identity register](../../../docs/design/reference-study-2026-09-30/08-logos-and-identity.md) and [motion study](../../../docs/design/reference-study-2026-09-30/04-motion-and-assets.md). S/P/F identify Solflare/Phantom/Fomo frames.

**1. Assign one authority to each surface**

| Surface | Authority | Decision and evidence |
|---|---|---|
| Core colours, amount hierarchy, rounded controls | **Fomo** | Use the observed violet-black, raised violet-gray, blue action system. F09–F12, F37–F42. |
| Primary navigation | **Fomo** | Five-destination floating dock with moving active region. C15, M09/M10. |
| Collapsing headers and categories | **Fomo** | Expanded content collapses while compact identity, balance and filters remain accessible. C16, M09. |
| Quick actions | **Phantom** | Strong live blur; four circles stagger into a **vertical right column**. C18, P19, M06. |
| Ordinary funding selectors | **Fomo** | Content-sized sheets over dimmed parents; explicit child back navigation. C33/C34, M12/M16. |
| Market detail | **Fomo** | Pushed page with candles, Holders/Feed/About and sticky Long/Short. F32–F35, FT095–FT100. |
| Shared position detail | **Fomo** | Tall sheet with person, instrument, chart, P&L, history and follow context. C25, F13/F14. |
| Onboarding | **Solflare** | Six scenes, large rounded clipped hero, independent artwork layers and fixed controls. C01, S01–S06, M01. |
| Authentication waiting state | **Phantom** | Artwork stays alive while the action shows pending; the OS owns authentication. P01/P04, OP10. |
| Completion material | **Solflare** | Moving foil/fabric and changing highlights, followed by precise status. C08, S13, M18. |
| Handle validation | **Phantom** | Stable checking/error/available slots, keyboard-aware action. C09, P05/P07/P08. |
| Follow, leaderboard and feed | **Fomo** | Distinct people, positions, ranks and event types. C27–C30, F06/F13–F16/F29/F30. |

The latest user decision overrides every historical “D2 approved” statement. The light theme, exact fonts and spring constants are **declared adaptations**: the recordings do not establish their source values.

**2. Use these tokens**

The first four dark tokens follow the study’s sampled Fomo colours. Remaining tokens complete the required semantic system; they are proposed Senryo values.

| Token / role | Dark default | Light |
|---|---|---|
| Background | `#0A0911` | `#F5F4F8` |
| Raised surface | `#13121A` | `#FFFFFF` |
| Sheet | `#191822` | `#FFFFFF` |
| Glass/dock tint¹ | `#201E2BD9` | `#FFFFFFD9` |
| Glass rim | `#FFFFFF24` | `#FFFFFFB3` |
| Divider/input boundary | `#2C2938` | `#DEDBE6` |
| Primary text | `#F5F4FA` | `#17151F` |
| Secondary text | `#B8B5C4` | `#5F5B6B` |
| Tertiary text | `#8F8B9F` | `#746F82` |
| Primary action fill | `#414EF4` | `#414EF4` |
| Text on primary action | `#FFFFFF` | `#FFFFFF` |
| Active/link text | `#8B95FF` | `#3643D8` |
| Up / positive | `#25CF68` | `#087F3C` |
| Down / negative | `#FF5A48` | `#C83225` |
| Warning | `#F2B85C` | `#8A5800` |
| Warning surface | `#332719` | `#FFF0D5` |
| Practice accent | `#B69DF8` | `#7049C8` |
| Practice surface | `#282038` | `#EEE7FF` |
| Mainnet accent | `#8B95FF` | `#3643D8` |
| Mainnet surface | `#1B2040` | `#E8EBFF` |
| Fan circle | `#C3B5F6` | `#D5C8FF` |
| Fan text/icon | `#211A31` | `#211A31` |
| Gold UI accent | `#D4AE5B` | `#89611F` |
| Silver UI accent | `#C9D0DD` | `#626D7E` |
| Ordinary sheet scrim¹ | `#00000066` | `#17151F38` |
| Fan scrim¹ | `#0A091180` | `#17151F55` |

¹ Eight-digit values use `#RRGGBBAA`.

Material ramps remain consistent across themes:

| Material | Shadow | Midtone | Highlight |
|---|---|---|---|
| Gold leaf | `#886426` | `#D4AE5B` | `#FFF0BC` |
| Silver | `#697383` | `#C9D0DD` | `#F4F6FB` |
| Lacquer object | `#17121B` | `#29212F` | `#514357` |

Keep Solflare’s changing onboarding colour fields as **artwork backgrounds**, using the study’s approximate yellow `#FAF543`, periwinkle `#7690ED`, lime `#C4DA78`, pink `#F58CE1`, orange `#F1803A` and gray `#B7BBC6`. They do not become trading semantics or general page backgrounds.

Gold identifies Senryo and Kinpaku. It does not mean “buy,” “profit,” “warning” or “mainnet.”

> **SUPERSEDED IN PART by D-196 (1 Oct 2026).** The user rejected the buttons, sheets and navigation built from §3–5.
> Where this text says pill buttons, radius-24 sheet tops, hairline surfaces, a labelled 64 pt dock or a plus above the
> dock, follow `controls-consult-2026-10-01.md` instead. Tokens (§2), type faces, motion families for the story, fan,
> ruler and charts, mode rules (§6) and everything from §7 on still stand.

**3. Replace terminal typography and geometry**

- **UI:** Inter, weights 400/500/600/700.
- **Big numbers:** Inter Display SemiBold. Home balance `52/56`; ticket margin `64/68`; market price `40/44`.
- **Body:** `16/22`; rows `16/20`; supporting metadata `12/16`.
- **Japanese text:** Noto Sans JP. The seal remains vector artwork.
- Use lining, tabular figures for changing balances, quotes, fees and aligned financial columns. Precision comes from the instrument configuration.
- Use sentence case and title case. Remove tracked uppercase labels.
- Load static TTF/OTF font files through Expo Font. Inter and Noto Sans JP are available under the SIL Open Font License. [Inter](https://rsms.me/inter/), [Noto Sans JP licence](https://github.com/google/fonts/blob/main/ofl/notosansjp/OFL.txt), [Expo Font](https://docs.expo.dev/versions/latest/sdk/font/).

| Geometry | Decision |
|---|---|
| Radius scale | **8 / 12 / 16 / 24 / 32 / pill** |
| Usage | Small chips / inputs / action rows / cards and sheet tops / onboarding hero / buttons, dock, fan and avatars |
| Spacing | Four-point scale; default screen inset 20 |
| Rows | Usually 64 minimum height |
| Touch targets | At least 44 |
| Utility icons | **Lucide**, 22–24, consistent approximately 1.75–2 stroke |

Lucide identifies actions; actual logos identify entities. Its React Native package uses SVG, matching the installed substrate. [Lucide React Native](https://lucide.dev/guide/react-native), [licence](https://lucide.dev/license).

Keep content surfaces mostly opaque and quiet. Reserve glass for the dock and strong blur for the fan. Ordinary sheets dim their parents. Dock elevation starts at roughly `y=8`, blur `24`, black opacity `20%`; sheet elevation is subtler and upward. These are tuning values, not recovered source measurements.

**4. Give each interaction its own motion family**

Use `cubic-bezier(0.2, 0.8, 0.2, 1)` for ordinary decelerating transitions. Springs below use mass/stiffness/damping; durations indicate intended settling ranges.

| Interaction | Target | Evidence / qualification |
|---|---|---|
| Press feedback | 80–120 ms | Immediate response; no ornamental bounce |
| Selection, validation, small crossfade | 160–180 ms | Stable layout; error text replaces its reserved slot |
| Page push | About 320 ms | Horizontal page travel; M05/M11 |
| Compact selector | About 420 ms; spring `1/260/30` | M02 major rise approximately 400–500 ms |
| Tall detail / transaction entrance | 420–480 ms; `1/240/30` | Preserve vertical layering, M07/M08/M13 |
| Parent → differently sized child | About 600 ms | M16 observed exchange approximately 500–800 ms |
| Fan | 200 ms per item, 25 ms stagger; `1/420/30` | Overall approximately 275 ms; Send leads, small overshoot; M06 |
| Fan backdrop / plus → close | 160 / 180 ms | Concurrent with expansion |
| Fan exit | About 180 ms, short reverse stagger | Proposed exit; fully interrupted states must resolve |
| Dock active region | 240–280 ms; `1/500/36` | M10; exact source physics unknown |
| Header collapse | Scroll-driven over approximately first 120–144 points | M09; no fixed timer |
| Leverage ruler | Direct gesture; snap `1/500/40`, clamped | M14; preserve centered selection and edge fade |
| Number updates | 140–180 ms | Only when real values change |
| First chart reveal | 600–900 ms after data arrives | Separate data loading from sheet motion; M08 |
| Onboarding scene travel | About 850 ms | M01 observed approximately 800–1,000 ms |
| QR reveal | About 650 ms | M04 observed approximately 600–800 ms |
| Ambient artwork | Independent 6–10 second loops | Proposed; different phases and material behaviours |
| Completion foil | One 700–900 ms reveal, then restrained ambient movement | M18 material behaviour; target success choreography is additive |

The QR’s final payload must be valid and scannable. Do not animate through misleading alternate payloads. Charts must not manufacture ticks or replay their entrance on every update.

Reduced motion uses static artwork, direct chart presentation and approximately 100 ms crossfades. Reduced transparency uses opaque equivalents. Haptics are additive: selection ticks, one accepted-submit response and one confirmed-outcome response; no sound by default. FT116 does not establish competitor audio or haptics.

**5. Use a five-tab floating dock**

**Home · Markets · Card · Social · You**

| Destination | Contents |
|---|---|
| Home | Balance, availability, positions, funding, Kinpaku shortcut, LP vault, Top Trades |
| Markets | Watchlist, categories, search, market detail, alerts |
| Card | Kinpaku, spending controls, authorizations, history, availability |
| Social | **Feed / People**; Feed has Global/Friends; People has Friends/Leaderboard |
| You | Profile, account identity, activity, security, preferences, support |

Choose **C15’s custom floating dock**, replacing the NativeTabs visual shell while retaining Expo Router stacks and route continuity. NativeTabs cannot be the cross-platform visual authority for the recorded Fomo capsule and active region.

Use a capsule approximately 64 high, 16 horizontal inset, above the bottom safe area. Give every destination an accessible name and a visible short label. Preserve tab state and scroll position. Hide the dock during transaction entry. Pad content so primary actions never disappear beneath it—the observed Fomo overlap is a defect to fix.

Expo’s headless `expo-router/ui` is the appropriate custom-shell candidate, but is documented as **experimental**; verify its stack restoration in the installed SDK before adopting the adapter. This is a platform risk, not permission to weaken C15. [Expo custom tabs](https://docs.expo.dev/router/advanced/custom-tabs/).

The **Phantom fan** opens from a separate lower-right plus:

1. **Send**
2. **Receive**
3. **Add money**
4. **Swap**

Preserve approximately 48-point circles, 72-point vertical spacing, labels to their left, live blur and plus→close. “Swap” explicitly replaces Phantom’s ambiguous “Trade” label; Long/Short entry belongs to a selected market. C18/M06/OP07.

The collapsing Home header retains the **seal, compact balance and mode**. Markets retains its title, mode and category controls. Mode never disappears with promotional content.

**Sheet grammar**

| Family | Height/material | Navigation contract |
|---|---|---|
| Compact selector | Content-sized, normally below 60% usable height; opaque sheet, dim parent | Mode, methods, simple information; dismiss restores parent |
| Tall detail | Approximately 90–94%; scrollable body, sticky actions | Shared position and substantial contextual detail |
| Full-height transaction | Near-full height; fixed identity and action zones, keypad/chart region | Order, swap, send review; pending state remains attached |
| Nested child | Height follows content/keyboard; explicit back | Funding network/asset selectors and TP/SL return to their actual parent |

Use **page pushes** for market detail, profile edit, recovery and full receive instructions. Do not convert the entire app into sheets.

**6. Make Practice and Mainnet impossible to confuse**

Place a persistent, full-label mode capsule at the upper right:

- **Practice · Paper money** — violet.
- **Mainnet · Real money** — blue.

Tapping it opens a compact selector with two explanatory rows. Fresh accounts start in Practice. Entering Mainnet includes a deliberate **“Switch to real money”** action.

On every money surface:

| Surface | Required mode signal |
|---|---|
| Balance / positions | Persistent label; Practice amounts use `P$` and explain “paper money” |
| Order / TP/SL / close | Mode in the ticket header and confirmation |
| QR / receive | Mode, full network name, selected asset; chain ID available in details |
| Pending / receipt / share | Mode travels with the transaction; never inferred from current app mode |
| Card | Practice: **Sandbox card**. Mainnet sandbox: **Sandbox · No charge**, independently of account mode |
| Rankings / public positions | Separate Practice and Mainnet datasets |
| Notifications | Mode in the event text |

Practice is Monad testnet **10143**; Mainnet is **143**, following the supplied product contract.

Switching mode invalidates the current quote and restores a separately keyed draft, or asks the user to discard it. It never silently converts an order. An in-flight transaction keeps its original mode and status.

Do not imply that Perpl or Aurora has a working practice route merely because Senryo has Practice mode. Crypto practice requires a verified testnet lifecycle or an explicitly labelled Senryo paper simulator. Mock collateral must say **Mock/Test** alongside its identity.

**7. Keep one account view without inventing a balance partition**

Home should show:

**Balance → Free to trade / Free to spend / Locked → Positions → Kinpaku / LP vault → Top Trades**

The three labels are **not three quantities to add together**. The repo’s [risk model](../../../docs/plan/specs/risk-math.md:20) makes Free to trade and Free to spend overlapping capacities; it excludes Perpl collateral from Free to spend.

Therefore:

- Use three availability cells with explanations, not a stacked partition bar or pie chart.
- Define the headline valuation and reconcile it without double-counting.
- Show **“At Perpl — move back to spend”** within balance details.
- Show LP allocation and redemption status explicitly; it becomes available only through its real redemption path.
- Keep unrealized gains distinct from spendable money.
- Expand Locked into actual margin, holds and other supported encumbrances.

The interface can feel unified without pretending every venue’s collateral is immediately card-spendable. C19, FT069, OP03.

**8. Preserve the complete market universe and the reference ticket**

| Category | Instruments / treatment |
|---|---|
| Commodities | **XAU, XAG** on Senryo’s engine; oil remains discoverable with its feed blocker |
| FX | **EUR/USD, GBP/USD, JPY/USD, CHF/USD, CAD/USD** as first-class Senryo-engine markets |
| Crypto | **BTC, ETH, SOL, MON, HYPE, ZEC** through Perpl |
| Equities | **wNVDAx, wSPYx, wTSLAx, wQQQx, wSPCXx, wEWYx** with explicit tokenized-instrument identity |

Use **All / Watchlist**, then Commodities / FX / Crypto / Equities category chips. Oil belongs under Commodities.

Under the supplied feed constraints, hourly calculated equity prices are **indicative discovery data**, unsuitable for enabled fast execution. Show **“Indicative · Hourly calculated feed · Trading unavailable.”** Oil shows its precise feed dependency. Do not show invented live prices.

Do not retain the old blanket “FX soon” treatment. FX gets the active trading design; actual enablement still requires its market configuration, oracle freshness policy and risk parameters. Quote orientation must match the real feed—never silently invert JPY/USD.

Market detail preserves C22/C25/C26 and FT095–FT100:

**identity + venue → price/change/freshness → chart → Holders / Feed / About → sticky Short / Long.**

Keep market cap, open interest and volume distinct; display only metrics meaningful for that instrument and actually sourced.

The ticket follows C39–C43:

- Margin is the dominant number.
- Leveraged size is secondary and updates when leverage changes.
- A centered graduated ruler replaces D2’s detent/slider presentation.
- Keypad↔chart stays inside the ticket.
- Available funds, quantity, fees, liquidation estimate, session and price freshness remain visible.
- TP/SL is a keyboard-aware child with price/% fields, side-aware validation and retained parent state.

**Keep the 500 ms hold.** C43 demonstrates only disabled slider-shaped controls; it does not establish successful sliding. Use a pill **“Hold to open Long/Short”** with linear progress. Early release cancels. Expired quotes reset confirmation. Native authentication and risk checks remain distinct from submission. Provide an accessible explicit review/confirm alternative.

**9. Make social useful and accountable**

Use C09/C11/C27–C31, OP11/OP17 and FT070/FT077 as the primary contracts.

- **Handles:** propose 4–20 lowercase ASCII letters, digits and underscores; case-insensitive uniqueness. This is a declared adaptation combining Phantom’s validation anatomy with Fomo’s four-character minimum.
- **Onboarding follows:** none preselected. Show why each trader is suggested; Skip remains available.
- **Leaderboard:** default to net realized P&L after fees/funding; 24h/7d/30d/All filters. Publish the definition. Separate paper and real money. Missing coverage means **Not ranked**, not invented zero.
- **Top Trades:** verified positions/receipts with a defined weekly period; public sharing is opt-in.
- **Feed:** distinguish fills, position changes and authored theses. Follow is not copy trading.
- **Holders:** means indexed leveraged positions, not token ownership. Preserve leverage, side, average entry, exposure and P&L context.
- **Send to @handle:** resolve to immutable account identity, then show recipient, address, asset, network and mode in review. Selecting a handle never sends money.
- **Search:** All / Markets / Tokens / Traders; retain Clans as a blocked baseline branch pending its decision. Include loading, no results, failure, recents and destination restoration.

**Journey pattern table**

“Exact” applies to the demonstrated pattern with permitted identity/data substitution. It never claims an unrecorded successful outcome.

| Journey / part | Treatment | Chosen pattern and rationale | Study IDs |
|---|---|---|---|
| Story onboarding | Adapted | Solflare’s six-scene shell; Senryo product narrative and artwork | C01/C02, FT001/FT035/FT062, OP01/OP10 |
| Passkey creation / returning sign-in | Additive | Real OS ceremony; create/sign-in/cancel/error/recovery | FT114; C06 is supporting education only |
| Biometrics, notifications, completion | Adapted | Separate primers, OS prompts, confirmed account completion | C06–C08, M18 |
| Handle and optional follow | Adapted | Async handle validation, avatar, selected-trader list, Skip | C09/C11, FT038/039/065/066 |
| Referral | Blocked | Preserve optional code/skip route; voucher is a different product promise | C10, FT041/067 |
| Terms / eligibility | Adapted | Checkbox, links, disabled/enabled/pending states; target policy | C12, FT068/101 |
| Add-money hub | Adapted | Practice claim, voucher, other-chain QR, Monad wallet, exchange, swap; mode-aware rows | C33–C35, FT087/088/094, OP12 |
| Claim / voucher | Additive | Target rules, eligibility, pending/credited/error states | C44, OP12; no completed reference equivalent |
| Other-chain / Monad receive | Adapted | Separate QR families, chain/asset selectors, warnings, copy/share | C32/C34/C35, FT011–019/057 |
| Fiat funding | Blocked | Provider quote, amount, payment and verification remain reserved | C36, FT020/021/089–093 |
| Markets / detail | Adapted | Full categories, real identities, candles, contextual tabs, sticky actions | C22/C25/C26, FT095–FT100 |
| Equities / oil execution | Blocked | Discovery remains; execution awaits eligible fast feeds and engine support | FT032, OP02/OP06 |
| Order entry | Adapted | Fomo margin/exposure/ruler/keypad/chart anatomy; 500 ms hold | C39–C43, M14, OP08/OP09 |
| Positions / TP/SL | Adapted | Tall position detail, risk child, keyboard lift and retained context | C25/C42, FT074/075/110–112, OP14 |
| Portfolio home | Adapted | Large balance, collapse, availability cells, positions and rich feature tiles | C16/C19/C20, FT009/069/073 |
| LP vault | Adapted | Reference yield teaching applied to the actual LP product and redemption lifecycle | FT026, OP03; LP operations are target-specific |
| Kinpaku | Adapted | First-use teaching, authored card, actual availability and controls | C20/C21, FT022–024, M03 |
| Profile / handle / follow / ranking / feed | Adapted | Fomo social hierarchy; passkey account utilities | C27–C31, FT070/074–086, OP11/OP17 |
| Holders | Adapted | Public position rows and Friends filter with accurate semantics | FT098 |
| Search / recipient discovery | Adapted | Typed categories, recents, scan, contact and handle resolution | C31/C38, FT059/086 |
| Receipt / share | Additive | Recorded identity hierarchy, target-confirmed status and truthful values | FT075/097/115, OP13/OP16 |
| Parent restoration | Exact | Child dismissal returns to the original page/tab/scroll context | FT061/112, M07/M15/M16 |

**10. Commission original artwork in the reference’s material language**

| Asset | Direction | Author / runtime |
|---|---|---|
| XAU | Original **gold koban** with embossed 千, edge thickness and restrained foil highlights | Product illustrator; SVG master, SVG/Skia rendering |
| XAG | Original **silver chōgin bar**, matching viewpoint and optical scale | Product illustrator; SVG master, SVG/Skia rendering |
| FX | Overlapping flag-pair discs: EU/US, UK/US, JP/US, Switzerland/US, Canada/US; pair text always present | Illustrator; SVG |
| Onboarding hero | Rounded changing scenes containing lacquer card, koban/chōgin, passkey security object, authentic market marks and balance/LP teaching | Illustrator + motion designer; layered SVG/textures with Skia/Reanimated |
| Completion | Gold leaf flexes/unfolds; highlights cross the 千 seal after actual completion | Motion/material artist; Skia mesh/shader or authored texture sequence |
| Default avatars | Twelve original illustrated portraits with varied faces/hair/accessories; stable per account, editable | Character illustrator; SVG/static exports |

The six story scenes should cover **one balance, passkeys, commodities/FX/crypto, LP liquidity, Kinpaku and Practice↔Mainnet**. Keep create/sign-in controls anchored; add Browse markets as a secondary text action.

Use the existing seal geometry. Recolour it through the gold material ramp; emboss it into Kinpaku and foil artwork. Lacquer belongs to authored objects, not a terminal-like black interface.

Choose **SVG + Skia + Reanimated** as the production system. Do not introduce Rive or Lottie for these assets. An engineer integrates the artwork; a stock glyph or flat logo wobble cannot substitute for authored material work. OP01/OP02/OP10/OP13, LG29–LG32/LG38, M01/M05/M17/M18.

XAU is never Tether Gold. LG19 is an issuer-specific identity, not generic gold exposure.

**11. Amend component sourcing; choose libraries by the evidence contract**

Replace the governing sentence with:

> **Reference evidence first; 21st.dev first among component sources that preserve that evidence. RN ports and reference-native reconstructions are recorded in `apps/mobile/.21st/design.json`, with evidence IDs, provenance and declared deviations.**

Keep searching 21st before building general UI. Do not let an available component determine the layout, remove states or replace C40 with a plain slider. A custom RN reconstruction must be labelled as such, without fictitious 21st attribution. The old D2 manifest is superseded as design authority.

| Need | Choice |
|---|---|
| Simple standalone selectors / information | Expo Router `formSheet`; use `sheetAllowedDetents: 'fitToContents'` with explicit content sizing |
| Funding parent/child exchange, substantial detail, ticket and TP/SL | **@gorhom/bottom-sheet**, with one coordinated sheet stack, dynamic sizing and keyboard-aware inputs |
| Fan blur / fallback dock material | **expo-blur** |
| Native dock material on supported iOS | **expo-glass-effect**, with availability and reduced-transparency checks |
| Leverage ruler | Purpose-built Gesture Handler + Reanimated; SVG/Skia tick/fade rendering |
| Financial charts | Retain victory-native/Skia where they reproduce C26; separate candle and line data contracts |
| Next web | Same tokens, identity and route/state contracts; web components sourced conditionally from 21st |

Expo form sheets require explicit sizing for `fitToContents`; Android supports at most three numeric detents and has nested-stack/header limitations. Do not host a competing Gorhom sheet inside a native form sheet. [Expo form sheets](https://docs.expo.dev/router/advanced/modals/).

Gorhom **5.2.14** is the selected candidate: its declared peers admit Reanimated 4. That is not device acceptance for RN 0.86; keyboard, gesture and restoration behaviour still need verification. [Package requirements](https://github.com/gorhom/react-native-bottom-sheet/blob/master/package.json), [dynamic sizing](https://gorhom.dev/react-native-bottom-sheet/dynamic-sizing).

On Android, follow the current `BlurTargetView`/`blurTarget` API. On iOS, gate GlassView by runtime availability; other platforms receive blur+tint or the explicit opaque accessibility fallback. [Expo Blur](https://docs.expo.dev/versions/latest/sdk/blur-view/), [Expo GlassEffect](https://docs.expo.dev/versions/latest/sdk/glass-effect/).

Desktop may adapt the dock into persistent navigation and transactions into a contextual panel, while preserving every destination and state. That is an adaptation; no desktop fidelity is established by these phone recordings.

**12. Keep real logos and contextual badges separate**

Production logos must come from first-party assets with recorded provenance. Screenshot crops are evidence, not production files. Missing artwork is a named asset gap, not permission to use a generic coin.

| Identity | Primary presentation | Secondary contexts |
|---|---|---|
| **Monad / MON** | Official full-colour asset disc for MON market rows/detail | Authentic mono Monad silhouette in network chooser; network/environment text on QR and receipt. LG13 |
| **USDC** | Official blue token mark/disc in balances, asset pickers and swaps | Approved monochrome **symbol** only where appropriate; never a generic dollar. LG04 |
| **AUSD** | Official AUSD token artwork with “AUSD” and issuer identity | Collateral, Perpl funding and route review; do not substitute Agora’s corporate wordmark for token artwork |
| **BTC** | Orange disc with authentic white Bitcoin mark | Approved mono silhouette in compact network context. LG01 |
| **ETH** | Authentic faceted Ethereum mark in an appropriate disc | Approved mono mark in network selection. LG02 |
| **SOL** | Authentic gradient stripes in market/asset discs | Mono stripes in network selector. LG03 |
| **HYPE** | Official HYPE asset treatment | Hyperliquid context only when actually relevant; it is not Senryo’s execution venue |
| **ZEC** | Authentic gold/black Zcash disc | **Perpl** venue context on Senryo tickets. Never inherit Fomo’s Hyperliquid venue badge. LG06/LG07 |
| **Base** | Recorded/current official square treatment | Mono square in compact network rows; full-colour treatment in richer source-chain presentation. LG10 |
| **Arbitrum** | Official shield and blue/gray identity | Approved mono variant only; source-chain rows and funding review. LG09 |
| **Chainlink** | Official mark plus “Price source” in About/oracle details | Freshness/status is a separate labelled indicator; Chainlink is not the execution venue |
| **Uniswap** | Official mark in swap-route attribution | Only when the actual quote/route uses it |
| **Perpl** | Official venue mark and name in crypto detail, ticket, position and receipt | Legible venue chip; separate from asset, network and status |
| **Aurora** | Official mark in other-chain funding and route details | “Powered by Aurora” where the actual service performs the route |
| **iCloud Keychain** | Authentic provider identity when the system actually identifies that storage provider | Native chooser owns the ceremony; no “Continue with Apple” account button |
| **Google Password Manager** | Authentic Password Manager provider artwork when identified | Native chooser owns the ceremony; no Google OAuth button |

Across surfaces:

- **Market rows:** 32–40 asset discs; detail approximately 48.
- **Ticket/position/receipt:** recognizable asset plus explicit venue.
- **Network selector:** Fomo’s authentic mono silhouettes plus full names.
- **QR:** source network, asset and destination remain separate identities; any center logo must preserve scan reliability.
- **Status:** selected check, pending, stale, unavailable and verified are distinct from logos. Never invent verification authority.
- **Onboarding:** authentic full-colour entity badges coexist with original Senryo artwork.
- **Provider storage:** if the API does not reveal the provider, say **Passkey** and let the OS show the chooser; do not infer it from the device.

Circle specifies a minimum 32-pixel USDC token logo and distinguishes it from its monochrome symbol; design small rows accordingly. [Circle brand guidelines](https://www.circle.com/pressroom/).

The study does not supply production AUSD, Chainlink, Uniswap, Perpl, Aurora or password-manager assets. Their sourcing remains required.

**FT001–FT116 parity ledger**

**E** Exact · **A** Adapted · **+** Additive · **B** Blocked · **X** Excluded.

Classification describes the target treatment, not a claim that the repo already implements or completes it. Compound entries retain explicit branch decisions.

| FT | Class | Target treatment |
|---|---|---|
| 001 | A | Six-panel story shell; Senryo scenes and anchored passkey controls |
| 002 | A | Create/sign-in passkey selector; OAuth excluded; Shield reserved B4 |
| 003 | B | Supported non-seed recovery/hardware alternatives need security contract B4; phrase/OAuth branches X |
| 004 | B | Six-digit PIN setup pending explicit decision B4 |
| 005 | B | PIN confirmation/mismatch/recovery pending B4 |
| 006 | A | Biometric primer and native handoff; distinct from passkey creation |
| 007 | A | Gold-leaf completion and target consent |
| 008 | A | Notification education with enable/defer |
| 009 | A | Empty balance, identity and useful funding routes |
| 010 | E | Copy/ellipsis utility anatomy; opened menu remains target-specific |
| 011 | A | Pushed receive page and valid animated target QR |
| 012 | E | Identity plus separate Copy/Share controls |
| 013 | A | Explicit actual network/environment warning |
| 014 | A | Aurora first-use bridge education |
| 015 | A | Actual source/destination, fee/time/QR loading and warnings |
| 016 | A | Only configured source chains, authentic marks and selection |
| 017 | A | Actual supported assets and restrictions |
| 018 | E | Attached failure explanation and Try again state |
| 019 | A | Receive-asset search/Paste and real results |
| 020 | B | Fiat education/provider integration B3 |
| 021 | B | Real fiat quote/payment/credit lifecycle B3 |
| 022 | A | Kinpaku first-use tutorial |
| 023 | A | Teach actual controls; illustration does not act as settings |
| 024 | A | Honest card availability; real issuance proof B11 |
| 025 | B | Travel, borrowing and virtual accounts B5 |
| 026 | A | LP-vault teaching; no invented staking or fixed yield |
| 027 | B | Collectibles/NFT product and source gaps B7 |
| 028 | B | dApp browser/session/connection product gaps B7 |
| 029 | B | Campaign eligibility, destination and rewards B5 |
| 030 | B | Merchant cashback integration and payout B5 |
| 031 | B | Organization/news feed sources and interactions B6 |
| 032 | B | Equity discovery adapted; fast execution B2, competition B5 |
| 033 | A | Empty watchlist, trending and saved-state persistence |
| 034 | A | Five target tabs replace Solflare’s four |
| 035 | A | Living original artwork and real entity badges |
| 036 | B | Private-key/Ledger alternatives B4; recovery phrases X |
| 037 | X | Google/Apple OAuth forbidden by supplied account rule |
| 038 | A | Optional @handle/avatar form |
| 039 | A | Checking/unavailable/invalid/available; target 4–20 rule |
| 040 | B | X handle import authorization and outcome B6 |
| 041 | B | Referral mechanics, redemption and incentives B5 |
| 042 | A | Biometric education/native prompt; no passkey inference |
| 043 | E | Native notification permission surface |
| 044 | A | Strong Practice/Mainnet context throughout |
| 045 | E | Contextual fetching failure, placeholders and Retry |
| 046 | A | Home trading discovery and watchlist |
| 047 | B | Genuine presence/chat identities and interactions B6 |
| 048 | A | Favorites, categories, skeletons and persisted selection |
| 049 | B | Sports prediction markets and settlement B8 |
| 050 | B | Short-duration binary market grid/lifecycle B8 |
| 051 | B | Binary target/countdown/chart semantics B8 |
| 052 | B | Prediction chat/About/outcome actions B8 |
| 053 | B | Prediction-specific attestation policy B8 |
| 054 | B | Binary purchase, funds and settlement B8 |
| 055 | A | Phantom fan retained; destination labels adapted |
| 056 | A | Real swap pay/receive, quote and numeric ticket |
| 057 | A | Compact QR with actual network/environment |
| 058 | A | Send skeleton→no-recents state and useful actions |
| 059 | A | Handle/address lookup, scan and contacts |
| 060 | A | Add money shortcut opens method hub |
| 061 | E | Restore the discovery parent after action dismissal |
| 062 | A | Beveled seal/material welcome; passkey controls |
| 063 | B | Tracking purpose/decision B9; notifications covered by 043 |
| 064 | X | Google/Privy OAuth forbidden |
| 065 | A | Optional editable handle, generated suggestion, Skip |
| 066 | A | Follow selection; none prechecked |
| 067 | B | Referral Paste/no-code/redemption lifecycle B5 |
| 068 | A | Target terms/privacy checkbox and pending state |
| 069 | A | Large balance/change/Add money with honest valuation |
| 070 | A | Verified weekly Top Trades and shared-position destination |
| 071 | A | Market/token discovery, categories, stable data rows |
| 072 | A | Complete target categories and dismissible perps education |
| 073 | A | Collapse and floating dock; fix action overlap |
| 074 | A | Shared position identity/status/follow |
| 075 | A | Real position chart, P&L, statistics and history |
| 076 | A | Thesis, engagement and market action; no automatic copying |
| 077 | A | Global/Friends feed, event types, threads, new-activity notice |
| 078 | A | Profile, periods, public metrics and empty positions |
| 079 | A | Avatar/banner/name/handle/bio editing and save lifecycle |
| 080 | A | Address disclosure; Google branch X; X-link branch B6 |
| 081 | B | Protected export capability/security contract B4 |
| 082 | A | History/settings retained; rewards branch B5 |
| 083 | A | Leaderboard periods, ranking definition and Your rank |
| 084 | B | Clan membership, scoring and complete flows B6 |
| 085 | A | Friends, recommendations, follow/unfollow persistence |
| 086 | A | Typed search/results/recents; Clans branch B6 |
| 087 | A | Mode-aware funding hub with distinct routes |
| 088 | A | Nested source-chain selection and explicit back |
| 089 | B | Apple Pay asset choice and actual purchase B3 |
| 090 | B | Fiat amount/keypad/presets B3 |
| 091 | B | Provider-derived minimum validation B3 |
| 092 | B | Verification provider completion/decline/recovery B3 |
| 093 | B | Fiat amount retention, fees and payment-method return B3 |
| 094 | A | Exchange chooser plus actual withdrawal instructions |
| 095 | A | Asset/venue/cap/OI from real market configuration |
| 096 | A | Candles/current-price/pan/ranges from real data |
| 097 | A | History/favorite/share destinations and persistence |
| 098 | A | Indexed position “Holders” and Friends filter |
| 099 | A | Distinct market Feed/About, publishing and links |
| 100 | A | Sticky red Short / green Long actions |
| 101 | A | Target eligibility checkbox and pending gate |
| 102 | E | Margin preserved while leverage changes exposure |
| 103 | A | Centered ruler anatomy; target gesture/snap/caps |
| 104 | A | Actual presets, decimal/backspace and available-funds limits |
| 105 | A | In-ticket keypad/chart modes with retained values |
| 106 | A | Candle-style options, Cancel/OK and saved settings |
| 107 | A | Available funds, quantity and target liquidation calculation |
| 108 | A | Disabled reasons retained; 500 ms hold replaces slider |
| 109 | A | Target liquidation explanation |
| 110 | A | SL/TP price/% child, validation, save/edit/remove |
| 111 | A | Keyboard lift and valid side-aware suggestions |
| 112 | E | Risk→ticket→original market restoration |
| 113 | B | Text-password decision and missing ceremony B4 |
| 114 | + | Actual passkey create/sign-in/recovery; exact reference capture missing |
| 115 | B | Completed financial outcomes and reconciliation proof B1 |
| 116 | + | Accessibility, reduced motion/transparency and restrained haptics |

Only OAuth and seed/recovery-phrase branches are already excluded by the binding product rules.

**Proposed exclusions — none adopted by this consult**

| Proposal | FT IDs | Reason |
|---|---|---|
| Apple Pay/debit fiat purchase | 020/021/089–093 | Requires a separate provider/payment/verification product |
| Predictions and sports | 049–054 | Different market, expiry, settlement and policy model |
| Clans and competitions | 084; competition branch of 032 | Separate membership/scoring product beyond approved follows/ranking |
| NFTs | 027 | Ownership/transfer product not part of the supplied trading/card contract |
| dApp browser | 028 | Separate discovery, connection and transaction-permission surface |
| Travel, borrowing, virtual accounts, merchant cashback | 025/030 | Unverified financial/provider benefits |
| Campaign rewards and referrals | 029/041/067; rewards branch of 082 | No defined eligibility, incentive or payout contract |
| Organization/news feed and live market chat | 031/047 | Trade feed remains; these need separate sources and interaction services |
| X import/linking | 040; branch of 080 | Handles can work independently of external social authentication |
| Separate local PIN and text password | 004/005/113 | Adds another credential lifecycle beside passkeys |
| Tracking prompt | Tracking branch of 063 | No established feature requires it |

Recovery-phrase import and Google/Apple OAuth are **binding exclusions**, rather than proposals requiring a new decision.

**Blockers and resolutions**

| Code | Blocked scope | What unblocks it |
|---|---|---|
| **B1** | FT115; completed deposits, orders, TP/SL, send, close and spend | Target-specific lifecycle contract plus real successful/failure/recovery evidence. Additional recordings unblock claims of exact competitor fidelity. Animation alone proves neither |
| **B2** | Equity/oil execution | Eligible fast feed, freshness/circuit policy, market/risk configuration and verified execution path; hourly calculated feeds remain indicative |
| **B3** | Fiat purchase family | Explicit product decision plus provider eligibility, quote/minimum/fees, payment, verification, decline/refund and credited-funds integration |
| **B4** | PIN/password, Shield/hardware/private-key alternatives, protected export | Explicit security/account model compatible with passkeys, supported recovery/export semantics and complete ceremonies; prohibited seed/OAuth branches stay excluded |
| **B5** | Benefits, rewards, referrals, competitions | Defined program/provider, eligibility, accounting, redemption/payout and complete error states—or explicit exclusion |
| **B6** | News/chat/X/clans; social readiness | Real sources/services, canonical handles, identity resolution, follow persistence, fill indexing and ranking definitions. Missing search/follow/post outcomes need target contracts |
| **B7** | NFTs/dApp browser | Supported ownership/transfer or browser/connect/session contracts and evidence—or explicit exclusion |
| **B8** | Predictions | Market/expiry/outcome/settlement authority, policy and real purchase/settlement lifecycle—or explicit exclusion |
| **B9** | Tracking | Demonstrated product purpose and explicit decision; otherwise approve exclusion |
| **B10** | Practice Perpl; Perpl TP/SL integration | Funded verified testnet flow or labelled paper adapter; key enrollment/builder/geo prerequisites and complete trigger lifecycle. Repo records open prerequisites |
| **B11** | Real Kinpaku issuance/spend/wallet provisioning | Actual provider/network capabilities and authorization/capture/refund evidence. Mainnet sandbox release remains “No charge” |
| **B12** | Missing production logos and hero/material assets | First-party logo provenance and authored Senryo assets; static/motion/material review against evidence |

Blocked items remain in the target inventory. This document does not substitute disabled decoration for their completed product contracts.

**Full redesigned screen inventory**

The following includes pages, sheets and native handoffs. Grouped names represent distinct children/states sharing the stated anatomy. Every financial route carries mode; every asynchronous route has loading, empty where applicable, failure, retry/cancel and restored-parent behaviour.

| Screen / surface | Components |
|---|---|
| Story welcome | C01/C02, six progress segments, layered hero, create/sign-in, Browse |
| Create passkey | Passkey education, native chooser handoff, pending/cancel/error |
| Returning sign-in | Native discoverable sign-in, account restoration, destination continuation |
| Account recovery / new-device guide | Supported passkey recovery, provider explanation, help; no seed form |
| Handle setup | C09, avatar, @input, validation slot, clear, Skip, keyboard-aware Continue |
| Follow setup | C11, ranked people, performance context, explicit selection, Show more, Skip |
| Terms acknowledgment | C12, links, checkbox, enabled/pending action |
| Biometric primer | C06, original security art, enable/defer, native permission |
| Notification primer | C07, enable/defer, native prompt |
| Account completion | C08, foil seal, precise completion copy, continue |
| Account required | Intended action, create/sign-in, preserved destination |
| Step-up / session locked | Reason, native authentication, pending/error, cancel return |
| **Home** | C16/C19/C20/C23, balance, mode, availability, positions, funding, Kinpaku, vault, Top Trades |
| Balance details | Valuation explanation, overlapping capacities, holds/margin, Perpl and LP allocations |
| Mode selector / Mainnet acknowledgment | Two labelled modes, chain context, paper/real explanation, deliberate switch |
| Positions | Instrument/venue/side, exposure, entry, P&L, liquidation, status |
| Own position detail | C25/C26, chart, margin/exposure, fees/funding, TP/SL, reduce/close, history |
| Orders / triggers | Pending/completed/cancelled tabs, trigger conditions, edit/cancel/status |
| Activity history | Typed transactions, mode/venue, amount, timestamp, status, filters |
| Receipt | Asset/venue, exact event status, financial breakdown, identifier/explorer, share |
| Share preview | OP16 artwork, selected public identity, real values/status/mode, native share |
| Service status | Network, oracle, indexer, Perpl/Aurora/card status, last update |
| **Markets / Watchlist** | C22/C23, complete categories, search/filter, real marks, freshness, availability |
| Market filters | Category/venue/availability controls, apply/reset |
| Market detail | C22/C26, identity/venue/cap, chart, ranges, favorite/history/share, sticky Long/Short |
| Market Holders tab | FT098 position rows, Friends filter, loading/empty/error |
| Market Feed tab | C27 trade/thesis events, trader/position links |
| Market About tab | Instrument type, session, feed/source/freshness, limits, venue, useful links |
| Market history | Real event/price/trade history with periods and empty state |
| Order eligibility | C12, target policy, consent, pending, return |
| Order ticket | C39/C40, margin/exposure, ruler, presets/keypad/chart switch, risk, hold |
| Embedded ticket chart | C41/C26, retained order values, candle/range controls |
| Candle settings | FT106 body/border/up/down/previous-close options, Cancel/Save |
| Risk introduction / liquidation info | C42, market-specific explanation, understandable examples, dismiss |
| TP/SL editor | C42, price/% pairs, result preview, suggestions, clear/save/remove, keyboard lift |
| Add margin / reduce / close | Position context, amount/percentage, quote/fees, review/confirmation |
| Execution trace | Signing/checking/submitted/proposed/filled/settled distinctions, reconciliation |
| Alerts list | Instrument, condition, active/triggered state, edit/remove |
| Alert editor | Price/condition, mode, permission status, validation and save |
| Add-money hub | C33, mode-aware claim/voucher/other-chain/Monad/exchange/swap rows |
| Practice claim | Eligibility, paper amount, pending, credited/already-claimed/error |
| Voucher | Code/scan/Paste, validation, eligible mode/value, redemption status |
| Source-chain selector | C34, authentic network marks, supported-state disclosure, back |
| Asset selector | C34, actual token art, search/Paste, selection and restrictions |
| Other-chain funding primer | C35, route explanation, supported assets, requirements |
| Other-chain route configuration | Source/asset→Monad, fee/time/quote expiry, loading/retry |
| Other-chain deposit QR | C32, real generated QR/address, source network/asset, destination, warnings |
| Monad receive QR | C32, Monad 143/10143, permitted asset/address, Copy/Share, warning |
| Deposit status/detail | Route timeline, received/processing/credited/expired/refund states, resume/recovery |
| Monad-wallet funding instructions | Asset/network/address, transfer requirements, app return and status |
| Exchange chooser | Real provider marks, search, supported destinations |
| Exchange withdrawal instructions | Selected exchange, correct network/asset/address, QR/copy, pending tracking |
| Withdraw hub | Send/cash-out destinations, actual withdrawable amount, mode |
| Send recipient | C38, recents, @handle/address search, scan, contacts, no-recents art |
| Contact creation | Name/account identity, validation, save/remove |
| QR scanner | Camera permission, framing, parsed network/asset, invalid/mismatch recovery |
| Send review | Recipient/account/address, asset/network/mode, amount/fees, confirmation |
| Cash-out destination/review | Supported real exit route, amount, fees/limits, destination, trace |
| Swap ticket | C37, You pay/receive, token selectors, quote, slippage, fees, review |
| Swap route details | Actual route and Uniswap attribution where applicable, minimum received/expiry |
| **Kinpaku first-use tutorial** | C21, authored card, spending-capacity teaching, Next/Got it |
| **Card home** | Gold-leaf lacquer card, actual availability, Free to spend, controls, activity |
| Card reveal | Protected reveal, actual issuer fields or clear sandbox equivalents |
| Spend allowance | Current limit, available capacity, adjustment, step-up, save status |
| Freeze / unfreeze confirmation | Current card state, effect, confirm/cancel and resulting state |
| Card wallet provisioning | Actual supported wallet/provider, native handoff, added/unavailable/error |
| Card activity | Holds/captures/releases/refunds/declines, merchant identity, status |
| Authorization / spend detail | Merchant, amount, hold/capture/refund timeline, reason, receipt |
| Card simulation | Explicit sandbox label, amount/merchant scenario, hold/release, “No charge” |
| Card availability | Coming soon/unavailable/provider outage; actual next action |
| **LP vault** | Pool composition/risk, sourced performance, own shares, deposit/redeem |
| LP deposit review | Amount, shares/valuation, fees/risk, confirmation and status |
| LP redemption review | Shares/amount, available liquidity, timing/queue, confirmation |
| LP request detail / history | Pending/redeemed/failed states, valuation, timeline and receipt |
| **Social Feed** | C27, Global/Friends, event/thesis cards, new-activity pill, composer |
| Post/thesis detail and replies | Trader/market/position context, thread, engagement, reply, share |
| Compose thesis | Instrument/optional position, text, audience, preview, publish/error |
| **People** | C30, Friends, recommendations, follow/unfollow, empty state |
| Leaderboard | C30, period/mode, definition, ranked rows, Your rank, asset clusters |
| Trader profile / public watch | C28, identity, bio, public metrics, positions, periods, follow |
| Followers / following | Identity rows, relation state, search, follow controls |
| Profile editor | C29, handle/name/bio, avatar/banner, validation, changed-state Save |
| Avatar / banner picker | Original defaults or user image, crop/preview, upload/error, save |
| Global search | C31, All/Markets/Tokens/Traders, recents, search/Paste, real results |
| **You** | Own profile, account/security/activity/settings/support utilities |
| Account identity / addresses | Large account identity, actual networks/addresses, Copy, mode |
| Security / passkey management | Supported credentials/devices, add/replace/revoke, step-up and recovery |
| Session policy | Current lock/permissions/thresholds, explicit changes, save |
| Preferences | Theme, display/currency/format settings, persistence |
| Notification settings | Trading/card/deposit/social preferences, OS permission state |
| Advanced | Protected supported account utilities; export remains B4 |
| Delete app data | Exact local/server-data scope, acknowledgment, result; onchain records distinguished |
| Help / support | Relevant guides, incident context, supported contact route |
| Terms / privacy | Actual documents and acknowledgment history |

Reserved blocked screens remain part of the inventory:

| Reserved family | Components required before completion |
|---|---|
| Fiat primer / provider choice | C20/C36, real provider identity, supported region/method |
| Fiat asset / amount / payment | C34/C36, search, keypad, minimum, quote, fee and method |
| Fiat verification / return / receipt | Native/provider boundary, retained amount, decline/retry/refund/credit |
| Referral setup / redemption | C10, optional skip, valid/invalid code, terms, actual reward status |
| Rewards / campaigns / cashback | Eligibility, provider identity, participation, redemption and payout |
| Travel / borrowing / virtual accounts | Real provider, limits, terms, authorization and lifecycle |
| Competition | Entry, period/scoring, rank, results and payout where applicable |
| Organization/news / live market chat | Authentic sources/people, content, interactions, presence definitions |
| Clans list/detail/create/join | Group identity, membership/permissions, scoring, leave/recovery |
| Prediction discovery/detail/ticket | C24/C25/C37, expiry/outcome/target, policy, purchase and settlement |
| NFT collection/detail/transfer | Actual item identity/ownership, network, transfer review and receipt |
| dApp discovery/browser/connect | Destination identity, permissions/session, transaction review, disconnect |
| X link/import | Genuine authorization, cancel/error, confirmed account linkage |
| Shield/hardware/private-key setup | Supported security model, native/device boundary, recovery/error |
| PIN/password setup/recovery | C05 or documented password ceremony, mismatch/forgotten/reset |
| Protected export | Step-up, exact export capability, secure presentation and confirmation |

**Retire**

- D2’s terminal identity: pure-black page system, monospace amounts, signal-green/yellow primaries, four-pixel corners, hairline grids and tracked uppercase labels.
- The D2 `.21st/design.json` as visual authority.
- NativeTabs as the required visual shell.
- Gold/silver-only discovery and stale blanket “FX soon” treatment.
- Three availability values presented as an additive partition.
- Generic coins, initials or recoloured approximations replacing real identities.
- Universal blur on sheets, literal radial fan layouts and flat-logo “material” animation.
- Success flourishes triggered by signing/submission instead of the actual outcome.

**Keep**

- **Senryo 千両**, its own seal geometry and Kinpaku identity.
- Passkeys, seedless accounts and honest Practice/Mainnet separation.
- One account experience with correct money availability and venue allocation.
- The full market scope, LP vault, TP/SL and distinct funding families.
- Sound domain, risk, transaction-recovery and infrastructure code where it supports the new contract.
- Expo Router continuity, Reanimated, Skia, SVG and appropriate chart infrastructure.
- The reference’s complete state and navigation grammar, authentic identity, and approved handles, follows, leaderboard and trade feed.
- Every blocked baseline capability until it is completed or explicitly excluded.
