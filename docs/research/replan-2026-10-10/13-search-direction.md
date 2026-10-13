# 13 · Search: the ⌘K palette and the phone's search (Codex direction, 13 Oct 2026)

Asked of Codex (gpt-6.1-sol, xhigh, read-only) for R6 (`docs/plan/replan-r6-search.md`): the web palette with a preview pane, the nested market page, row anatomy per group, the phone's floating launcher and full-page search, motion, cues and words. Sources it read: UGLYCASH U10 (`owarine-refs/uglycash/Searching`), Owarine's and Mitoshi's palettes, Senryo's palette, tokens and kits. Kept verbatim below; decisions taken from it are D-336 onwards in `docs/plan/decisions.md`.

Make search feel like a compact trading desk: aligned live figures, recognizable markets, visible time pressure, and a preview that explains the selected result. Use UGLYCASH’s phone journey and Senryo’s identity. The dimensions below are proposed build targets; no files were edited.

This follows [R6.1–R6.9 and the gate](/Users/abu/dev/hackathon/metropolis/docs/plan/replan-r6-search.md), [research 03 §2.5, §3 and take #3](/Users/abu/dev/hackathon/metropolis/docs/research/replan-2026-10-10/03-canton-s2-mitoshi.md:232), and [research 06 §6](/Users/abu/dev/hackathon/metropolis/docs/research/replan-2026-10-10/06-senryo-today.md:323).

**Shared visual rules.** Use these on both platforms:

| Element | Direction |
|---|---|
| Grounds | Light: `#F5F5F5`, white primary surface, `#ECECEC` recessed field. Dark: `#111111`, `#1C1C1C` surface, `#292929` field. Respect the saved theme. |
| Structure | One borderless palette surface; uninterrupted entity rows inside it. No row cards, outlined containers, badge pills, or shadows. |
| Accent | `#FA00FF` marks selected controls; text/glyphs on solid magenta are black. Direction colors appear only on direction arrows, changes, PnL, and charts. |
| Typography | Roboto Condensed Black for headings and money; Inter for names, body, metadata, and keys. Tabular figures for all changing numbers. |
| Identity | Real `EntityMark` assets and team crests. Utility icons for places/actions/help. Preserve logos’ original colors; never recolor them to indicate selection. |
| Change | Plain `↑ +2.34%` / `↓ −1.08%` text, without the current ChangeChip plate. Zero is neutral. |

The palette and fonts already exist in [shared palette](/Users/abu/dev/hackathon/metropolis/packages/tokens/src/palette.ts), [type/motion scale](/Users/abu/dev/hackathon/metropolis/packages/tokens/src/scale.ts), [font provenance](/Users/abu/dev/hackathon/metropolis/packages/tokens/src/fonts.ts), and [native type mapping](/Users/abu/dev/hackathon/metropolis/apps/mobile/src/theme/type.ts). Refero’s Uniswap Cup and Osmo studies support compact alignment, strong numerical hierarchy, and condensed headings; Senryo’s brief controls color and geometry.

**Ranking and result stability.** MiniSearch supplies relevance; device visits break comparable matches through frecency. Exact symbol beats prefix, prefix beats typo match, and frecency must not bury an exact match.

For every nonempty query:

- Show one **Top hit**, then groups ordered by their highest-scoring remaining hit. Remove the top hit’s duplicate from its original group.
- `bitcon` produces BTC without a correction dialog.
- `btc 5m` produces **BTC · 5m** as the top hit and exposes **Lanes**. Do not list 136 lane combinations for ordinary queries.
- Price ticks, countdowns, and queue updates never reorder results beneath the pointer or keyboard highlight.
- Record visits when something is opened, not when highlighted. Scope private positions and receipts to the account and network.
- Reserve the People adapter and row type for R8. Display no empty People heading or “coming soon” result in R6.

**Web geometry.** Replace the current 600px list with this layout:

| Viewport | Geometry |
|---|---|
| **≥1024px** | 960px wide. Center horizontally. Top = `clamp(24px, 10dvh, 72px)`. Height = lesser of 680px and available viewport height minus top offset and 24px bottom clearance. |
| Body | 600px results column + 360px preview column. Results have 16px horizontal gutters; preview has 24px padding. Separate by neutral surface contrast, without a border. |
| Chrome | 64px input header; 44px footer. Body takes the remaining height. Results scroll independently; preview scrolls only when necessary. Preserve panel height across results, loading, and no-match states. |
| **768–1023px** | 672px-wide single column, constrained to viewport minus 48px. Remove the preview pane. Nested market pages retain the detailed chart and facts. |
| **<768px** | Full-viewport search page, safe-area aware, radius 0. Back button in the input header. Hide the dock. Footer can wrap to 56px. |

Use 16px outer corners on the desktop dialog. Scrim uses the existing `sheetScrim`; remove the current palette’s sheet shadow. The existing starting point is [CommandPalette](/Users/abu/dev/hackathon/metropolis/apps/web/src/components/shell/CommandPalette.tsx) and [command.css](/Users/abu/dev/hackathon/metropolis/apps/web/src/styles/command.css).

**Web input and headings.** Inside the 64px header, inset the field 12px vertically and 16px horizontally: 40px filled rectangle, 8px corners, no border. Search icon 20px; gap 12px; Inter 17/22 input. Clear × is 18px inside a 40px target and remains available whenever text exists, including after focus moves to results. Clearing restores suggestions and focuses the field.

Placeholder: **“Search markets, positions, anything”**. Accessible label: **“Search Senryo”**.

Group headings: condensed 18/22, sentence case, 16px top space and 8px below. Counts sit alongside in Inter 12/16, plain text. Headings are not selectable or sticky.

**Web row anatomy.** All heights are minimums; longer event questions and help excerpts can grow. Rows use 12px gaps, 8px vertical padding, and square edges.

| Group | Height | Left | Middle | Right |
|---|---:|---|---|---|
| **Positions** | 76px | 36px market mark | Inter 16/20 **“BTC Up”**; 12/16 **“Call · 5m”** or **“Ride · 40×”**; **“Ends in 3:42”** | Condensed 22/24 live value; 14/18 **“+$1.42 · +8.6%”**. No executable Cash out button. |
| **Markets** | 88px | 36px mark | **“BTC”**, Inter 16/20 semibold; **“Bitcoin · Crypto”**, 12/16. Bottom line carries all four lane states. | 72×24 sparkline; 104px figures column with condensed 20/24 price and 12/16 signed 24h change; separate options chevron. |
| **Lanes** | 64px | 32px market mark | **“BTC · 5m”**; **“Closes in 3:42”**, or actual unavailable state | Current market price; **“Open terminal”** hint on highlight. |
| **Events** | 88px | Two 28px crests, 56px total identity area | Actual Yes/No question, maximum two lines; league and localized start time beneath | Upcoming: **“Today 19:30”**. Live: actual score and period/minute. Final line: **“Yes 62% · No 38%”** when quotes exist. Neutral quote text. |
| **Games** | 64px | 32px owned game art where available; otherwise a specific utility icon | Game name, 16/20; one description, 12/16 | **“12 waiting”**, **“0 waiting”**, or **“Queue unavailable”**. |
| **Places / Go to** | 52px | 20px utility icon | Place name; one-line description | Plain digit or external-link glyph. |
| **Actions** | 56px | 20px utility icon | State-aware action wording | Current state: **“On”**, **“Off”**, **“Light”**, **“Dark”**, or **“Open”**. No switch pill. |
| **Help** | 76px | 20px help icon | Actual FAQ question; two-line answer excerpt | **“Read answer”** on highlight. |
| **Receipts** | 72px | 24px receipt icon; market mark when resolved | **“Call #4815 · BTC Up”** / **“Ride #4815 · ETH Down”**; date and network | Result word and amount, privacy-aware. |

Market lane strip, aligned beneath the text:

**“1m closes in 0:42” · “5m 3:42” · “15m 8:42” · “1h 38:42”**

These are plain text cells, not chips. When the session is closed, replace the countdown strip with **“Opens Mon 09:30 ET”** and keep **“1m · 5m · 15m · 1h”** as muted availability labels. Paused markets say **“Paused · {actual reason}”**. Preserve **“Not open for calls yet”** for unlisted markets.

Important implementation detail: the current [useMarketLine](/Users/abu/dev/hackathon/metropolis/packages/calls/src/use-market-session.ts) supplies the correct session authority but still formats only 1m. R6 must extend that presentation to each cadence and its real availability, including lockout and skipped windows.

Reuse the data/geometry from [web MarketList](/Users/abu/dev/hackathon/metropolis/apps/web/src/features/markets/MarketList.tsx), [phone MarketRow](/Users/abu/dev/hackathon/metropolis/apps/mobile/src/features/markets/MarketRow.tsx), [SVG sparkline](/Users/abu/dev/hackathon/metropolis/apps/web/src/components/ui/sparkline.tsx), and [Skia sparkline](/Users/abu/dev/hackathon/metropolis/apps/mobile/src/components/kit/Sparkline.tsx). Preserve the 1.6px stroke, dashed baseline, and actual history gaps. Adapt [web ChangeChip](/Users/abu/dev/hackathon/metropolis/apps/web/src/components/ui/change-chip.tsx) and [phone ChangeChip](/Users/abu/dev/hackathon/metropolis/apps/mobile/src/components/kit/ChangeChip.tsx) to plain text here.

**Highlighted row.** Use a full-width neutral recessed fill: `#ECECEC` light / `#292929` dark. Add a 24×24 magenta **↵** tile with black glyph near the trailing edge. Keep direction colors and marks unchanged. Hover uses a lighter neutral wash; keyboard highlight owns the preview until the pointer actually moves.

The market options chevron is a separate 44×44 target, visually 16px. Tooltip and accessible name: **“BTC options”**. Clicking the row opens the terminal; clicking this chevron opens the nested market page.

**Empty query.** Order is fixed:

1. **Recents** — last three distinct opened entities; their normal row anatomy and current data.
2. **Open positions** — first three, earliest ending first; **“View all {n} positions”** when more exist.
3. **Hot movers** — three markets ranked by absolute 24h percentage move. Preserve the sign.
4. **Go to** — all five rail places.

Freeze Hot movers ordering for that search session. With no recents, show one quiet line: **“Your recent visits appear here.”** With no positions: **“No open positions.”** Markets and places remain available to guests.

The five current web keys are **1 Trade · 2 Markets · 3 Calls · 4 Games · 5 Earn**, sourced from [shared navigation](/Users/abu/dev/hackathon/metropolis/packages/config/src/nav.ts:97). Do not substitute the phone dock’s order.

**Nested market page.** Keep the dialog size and preview. Replace the root header with a 64px breadcrumb bar:

- 44px back target, 20px chevron.
- **“Search / BTC”**, Inter 16/20; Search is clickable.
- 28px BTC mark at the trailing edge.
- Beneath it, a 44px recessed local field: **“Search BTC actions”**.

Save the root query, highlight, and scroll position. Back restores all three. Escape returns to root first; another Escape closes. Backspace returns only when the child field is empty.

Child content remains rows:

| Heading | Rows and behavior |
|---|---|
| **Trade** | **“Up” — “Prepare an Up call”**; **“Down” — “Prepare a Down call”**; **“Ride” — “Open the ride terminal”**. Each is 56px. Opens the terminal with the chosen configuration, without placing anything. |
| **Lanes** | Four 48px rows: lane left, actual closing/reopening state right. Enter selects the lane locally; selection moves the highlight to Up. Selected lane gets a small magenta label with black text. |
| **Market** | **“View proof” — “Opening and closing price prints”**; **“Add BTC to favourites”** or **“Remove BTC from favourites”**. Favourite updates in place. |

Disable unsupported Ride with **“Rides unavailable on this market.”** Closed/paused trading rows retain their labels and show the real reason. Proof and favourites remain usable. Never infer availability from a timer reaching zero.

**Preview pane.** It is an inspection surface; it does not submit orders.

| Selected entity | Preview content |
|---|---|
| **Market** | 40px mark; condensed 24/28 symbol, Inter name/kind. Condensed 40/44 price; signed change followed by **“24h”**. A 312×144 chart using the shared day geometry. Four 40px lane rows with full countdown wording. Session line underneath: **“24/7”**, closing/opening time, or paused reason. Bottom hint: **“↵ Open terminal · ⌘↵ Market options”**. |
| **Position** | Mark, **“BTC Up”**, call/ride and lane/leverage. Label **“Live value”**, condensed 40/44 amount; signed PnL below. Facts: **“Entry”**, **“Now”**, **“Staked”** / **“Margin”**, **“Ends in”**, **“Cash out value”**. Bottom: **“↵ Open position · Cash out ready”** and **“Review on the terminal.”** |
| **Event** | Two 40px crests, question, league, full localized start time. Live score in condensed 40/44 with actual period/minute. Neutral Yes/No quotes; actual status and settlement-rule excerpt. |
| **Game** | Owned art/icon, condensed 24/28 title, one rule sentence, live queue count. Line Rider/Candle Hop may show a 160px-high existing attract loop. Lucky shows its actual reel identity. Bottom: **“Opens the lobby. Start there.”** |

For a held position, replace “Cash out ready” with its actual [position hold wording](/Users/abu/dev/hackathon/metropolis/packages/calls/src/book-words.ts): **“Cash-out closed · result at {time}”**, **“Settling…”**, or **“No live price right now”**. Label model-only value **“Estimated value”**; do not imply it is an executable quote.

Hide balances masks owned values and PnL in rows, previews, receipts, and accessibility text. Public market prices remain visible.

**Enter and alternate actions.** Show the alternate’s actual meaning in the footer.

| Entity | ↵ / tap | ⌘↵ / Ctrl+↵ |
|---|---|---|
| Market | Open terminal, remembered lane | Market options |
| Position | Open exact position and prepare Cash out review | Open receipt |
| Lane, root results | Open terminal on that lane | Market options with that lane selected |
| Lane, nested page | Select lane locally | Open terminal |
| Event | Open event detail | Read settlement rules |
| Game | Open lobby/game introduction | How to play |
| Place | Open destination | Open in new tab for page destinations; unavailable for drawers |
| Funding action | Open Add money/test-dollar entry | Funding help |
| Preference action | Apply the reversible preference in place | Relevant settings |
| One-tap | Open its configuration | Read one-tap help |
| Tour | Start tour | Read Help |
| Help | Read answer in search | Open full Help |
| Receipt | Open receipt | Explorer, only when a transaction hash exists |

Recents and Hot movers inherit their entity’s behavior. An unavailable alternate is visibly muted and does nothing.

Default footer: **“↵ Open · ⌘↵ Alternate · ↑↓ Move · esc Close”**. Replace Alternate contextually with **“Market options”**, **“Receipt”**, **“Rules”**, **“How to play”**, **“Settings”**, or **“Explorer”**. In the child page, Escape reads **“Back”**. Windows/Linux use **“Ctrl+↵”** and **“Ctrl+K”** throughout.

Digits are plain 12px hints on Go-to rows. They work when the results list has focus; while the input has focus, digits type into the query. Show **“Tab to use 1–5”** beside Go to. This keeps `1m`, numeric IDs, and hashes searchable.

Borrow digit placement and entity grouping from [Owarine’s palette](/Users/abu/dev/hackathon/owarine/web/src/components/shell/app/CommandPalette.tsx). Mitoshi’s [current palette](/Users/abu/dev/hackathon/crypto-world-fair/web/src/components/ui/command-palette.tsx) and [CSS](/Users/abu/dev/hackathon/crypto-world-fair/web/src/styles/command.css) currently omit the research’s footer; the footer above is an R6 addition. Its [RV-09 rule](/Users/abu/dev/hackathon/crypto-world-fair/docs/plan/revamp-parity.md:31) supplies the money boundary.

**Keyboard safety.** While search owns focus, terminal arrows, C, and one-tap handlers are suspended. Consume the selection key through release so held Enter cannot carry into the terminal. Every search trade-related action is navigation/configuration only—even with one-tap enabled.

A position selection resolves its symbol, instrument, and ID, opens the terminal, refreshes its exit quote, and presents Cash out review. It requires a separate terminal action to execute. Update [ShortcutsModal](/Users/abu/dev/hackathon/metropolis/apps/web/src/components/shell/ShortcutsModal.tsx) to describe this clearly; check the handoff against [existing terminal keys](/Users/abu/dev/hackathon/metropolis/apps/web/src/features/terminal/useTerminalKeys.ts).

**Web triggers.**

- **Terminal:** in the first `TerminalTop` row, after the asset/day-change area and before equity. Use a 124×36 borderless neutral rectangle, 8px corners: 18px search icon, **“Search”**, plain modifier hint. Maintain a 44px hit height. Below 768px, use a 44×44 icon target beside equity; accessibility label **“Search Senryo”**. Never put it over the plotted line.
- **Top line:** same control in the existing leading cluster, 160×36 where room permits; **“Search Senryo”** plus modifier. Compact to icon-only when necessary.
- **Everything:** its Search entry opens this same palette and closes the drawer first. Delete its separate filtering behavior.

This placement addresses [TerminalTop](/Users/abu/dev/hackathon/metropolis/apps/web/src/features/terminal/TerminalTop.tsx), [TopLine](/Users/abu/dev/hackathon/metropolis/apps/web/src/components/shell/TopLine.tsx), [EverythingDrawer](/Users/abu/dev/hackathon/metropolis/apps/web/src/components/shell/EverythingDrawer.tsx), and the [terminal top-line hiding rule](/Users/abu/dev/hackathon/metropolis/apps/web/src/styles/shell-parts.css:280).

**States and exact copy.** Keep useful results visible when one source fails.

| State | Presentation and words |
|---|---|
| Index loading | After 120ms, show three row-shaped skeletons with separate mark, text, and figure shapes. **“Loading search…”**. Never skeletonize places already available locally. |
| No matches | Condensed 24/28 **“No matches for “{query}””**. Inter 14/20 **“Try a symbol, team, game, or receipt ID.”** Plain action **“Clear search”**. |
| Group read failed | Under that heading: **“Positions didn’t load.”**, **“Events didn’t load.”**, etc.; **“Try again”**. Do not turn failure into no matches. |
| Price unavailable | Figure **“—”**; **“Price unavailable”**. Missing chart says **“24h chart unavailable”**; no invented flat line. |
| Stale price | Retain the last print with **“Last price · {age} ago”**. Do not present it as live. |
| Lookup in flight | Dedicated Receipts row, 16px spinner: **“Finding receipt…”**, then **“Transaction {shortHash}”**, **“Call #{id}”**, or **“Ride #{id}”**. Enter disabled. |
| Lookup found | **“Open receipt”**, with resolved market/type/network metadata. Selection opens it; merely pasting never navigates away. |
| Unknown hash | **“No Senryo receipt found”**; **“View transaction on explorer”**. Bind to the known network. |
| Unknown ID | **“No receipt found for Call #{id}”** / Ride. No explorer link without a resolved hash. |
| Lookup transport failed | **“Couldn’t look up this receipt.”** Actions **“Try again”** and, for a hash, **“View transaction on explorer”**. |
| Ambiguous bare ID | Show separate Call and Ride results when both exist. Never silently choose one. |

Local search responds immediately. Recognized complete IDs/hashes may start lookup after 180ms; changing the query cancels the previous lookup and prevents late results from replacing the current query.

**Action wording.** Use precisely:

- **“Add money”** in Real; **“Get test dollars”** in Practice. Both match `deposit`, `fund`, and `add money`. They open the funding entry.
- **“Hide balances” / “Show balances”**
- **“Turn sounds off / Turn sounds on”**
- **“Turn vibration off / Turn vibration on”**
- **“Use dark theme / Use light theme”**
- **“Take the tour”**
- **“Set up one-tap” / “Manage one-tap”**

Help uses the existing questions and answers from [shared Help](/Users/abu/dev/hackathon/metropolis/packages/config/src/help.ts), filtered by platform. Games are exactly **Lucky, Warm-up, Line Rider, Candle Hop, Parlay, Duel**. Queue counts require actual data; [Duel waiting](/Users/abu/dev/hackathon/metropolis/packages/query/src/duels.ts:52) provides a current source, not evidence that every game already has one.

**Phone entry.** Use U10’s floating Home launcher as the explicit capsule exception.

At the 402×874 reference size:

- Width **264pt**, height **44pt**, radius **22pt**, centered horizontally.
- Bottom edge **16pt above the dock’s highest visible edge**, including its central seal.
- Anchor to viewport/dock geometry, not scrolling content. Using the current dock footprint, launcher bottom clearance is `dockBottom(safeBottom) + 68 + 16`.
- White fill and black text in both themes. Search icon 20pt; 12pt gap; Inter 16/22 **“Search for anything”**.
- No shadow. The magenta halo belongs to **press/entry only**, preserving the selected-control color rule: an alpha-mask glow extending 18pt beyond the launcher, maximum opacity 0.24, fading to zero at its edge. No idle pulse.
- Keep it stationary during scroll. Add bottom content clearance through the launcher’s top plus 20pt so the last row can scroll completely above it.
- Hide it with the dock when an existing sheet or transaction surface owns the foreground.

In More, insert a **64pt Search row** immediately before the destination list: 24pt icon, **“Search Senryo”**, subtitle **“Markets, positions, games and receipts”**, trailing 16pt chevron. Both guest and signed-in versions receive it.

Sources: U10 [flow](/Users/abu/dev/hackathon/metropolis/docs/design/reference-study-2026-10-07-uglycash/flows.md:59), [S01 launcher](</Users/abu/dev/hackathon/owarine-refs/uglycash/Searching/step - 1.jpg>), [native dock geometry](/Users/abu/dev/hackathon/metropolis/apps/mobile/src/theme/layout.ts), [Dock](/Users/abu/dev/hackathon/metropolis/apps/mobile/src/components/shell/Dock.tsx), [Home](/Users/abu/dev/hackathon/metropolis/apps/mobile/src/features/home/HomeScreen.tsx), and [More](</Users/abu/dev/hackathon/metropolis/apps/mobile/src/app/(tabs)/more/index.tsx>).

**Phone full page.** Push a root search page; hide the dock for its entire lifetime, including after keyboard dismissal.

- Header starts **8pt below the top safe area**, height **52pt**.
- Back: 44×44pt target, left inset 12pt, 22pt chevron.
- Field: starts at x=64pt, ends 20pt from the right; height 44pt, 8pt corners, filled muted ground. Search icon 20pt, text Inter 17/22, clear × 18pt within a 44pt target.
- Placeholder **“Search for anything”**. Back accessibility label **“Back”**; clear **“Clear search”**.
- Results gutter **20pt**; first heading 20pt below header. Headings condensed **20/24**, with 8pt below and 24pt between groups.
- No filter chips. The current SearchField’s capsule geometry and FilterChips are disposable for global search.
- Focus on entry. Dragging results dismisses the keyboard interactively on iOS and on drag on Android. A result tap works with the keyboard showing.
- Keyboard Search dismisses the keyboard; it does not open the top hit.
- Back restores the originating screen and scroll position. Returning from a result restores query, highlight, and search scroll.

This adapts [S02 focused search](</Users/abu/dev/hackathon/owarine-refs/uglycash/Searching/step - 2.jpg>), [S03 clear/no-results](</Users/abu/dev/hackathon/owarine-refs/uglycash/Searching/step - 3.jpg>), [S04 grouped results](</Users/abu/dev/hackathon/owarine-refs/uglycash/Searching/step - 4.jpg>), and [S05 scrolled/keyboard-dismissed](</Users/abu/dev/hackathon/owarine-refs/uglycash/Searching/step - 5.jpg>). The kit starting points are [SearchField](/Users/abu/dev/hackathon/metropolis/apps/mobile/src/components/kit/SearchField.tsx) and [FilterChips](/Users/abu/dev/hackathon/metropolis/apps/mobile/src/components/kit/FilterChips.tsx).

**Phone row anatomy.** Keep the same content contracts; arrange them vertically instead of squeezing desktop columns.

| Group | Minimum height | Arrangement |
|---|---:|---|
| Positions | 84pt | 36pt mark; title/type/countdown at left. 104pt right figure column: condensed 22/24 live value, signed PnL beneath. Entire row opens the position. |
| Markets | 112pt | 36pt mark. Symbol and price on first line; name/kind and change on second. Session line on third, with a **56×20pt** sparkline alongside. Four plain lane cells on the bottom line. Separate trailing 44pt options target. |
| Lanes | 64pt | 32pt mark; market/lane plus live status; right price. |
| Events | 96pt | Paired 28pt crests; question up to two lines, league/start below. Right score/status; Yes/No quotes on the final line. |
| Games | 64pt | 32pt owned art/icon, name/description, right queue count. |
| Places / Actions | 56pt | 24pt utility icon, title/subtitle, right state or chevron. No digit hints on native phone. |
| Help | 88pt | Question and two-line excerpt; trailing chevron. |
| Receipts | 72pt | Identity/icon, type/ID plus date/network; right result and amount. |

Below 360pt width or above 1.2× text scale, market lane cells become two rows and the row grows to **132pt**. Preserve all four lanes. Ellipsize the market name before shortening money or status.

Empty query uses the same Recents → Open positions → Hot movers → Go to order. Apply the same no-match and lookup copy, without UGLYCASH’s repeated empty-group illustrations.

**Phone tap behavior.** Market body → terminal. Position → exact terminal position with Cash out review ready. Lane → terminal on that cadence. Event → detail. Game → lobby/introduction. Places → destination. Preferences → reversible setting change. Funding/one-tap → configuration entry. Help → answer. Receipt → receipt.

Choose the **trailing chevron**, not long-press, for market options: it is visible and accessible. Label it **“BTC options”**. Push a full-page nested view using the web child-page rows; add **“Search / BTC”** below the header and change the field placeholder to **“Search BTC actions”**. Back restores the search query and list position.

**Motion and feedback.** Motion is part of the specification, with no travel on live data reordering.

| Interaction | Motion | Existing feedback |
|---|---|---|
| Web open | Scrim fades over **170ms**. Panel enters from y=12px, opacity 0→1 over **240ms**, `cubic-bezier(0.2,0.8,0.2,1)`. Body follows after 40ms with a 170ms fade and 4px rise. | `sheetOpen` sound + `press` haptic once |
| Web close/cancel | Opacity out and y=8px over **160ms**, `cubic-bezier(0.4,0,1,1)` | `sheetClose` + `tick` |
| Highlight | Neutral fill changes over **100ms**. Preview identity/content crossfades over **100ms** after a 60ms dwell; reserve its geometry. | Silent |
| Nested page | Old content shifts −12px/fades over **100ms**; child enters from +16px over **170ms**, starting after 40ms | `tap` + `tick` |
| Phone launcher press | Scale 1→0.97 over **100ms**; release over **160ms**. Halo appears over 100ms, fades over 170ms during entry. | Entry feedback only; no extra tap |
| Phone page push | x=viewport width→0 over **320ms**, shared entrance curve. Dock fades out over 100ms. Keyboard uses OS timing. | `sheetOpen` + `press` |
| Phone back | Native interactive back; completed exit **240ms** | `sheetClose` + `tick` |
| Open result | Row neutral press wash; destination transition. Palette closes silently so cues do not stack. | `tap` + `press` |
| Favourite/preference | Selected state changes over **170ms** | `toggle` + `tick` |
| Clear / local lane selection | Immediate text change; 100ms state transition | `tick` haptic only |
| Explicit lookup transport failure | Replace pending row in place with **100ms** crossfade | `error` + `fail`, once |
| Live figures | Reserved-width numerical change over **160ms**; chart tail updates once per second; countdown digits change immediately | Silent |

No-match and unknown-hash results are silent. Browsing search never plays trading `open`, `close`, `profit`, `win`, `loss`, `matchFound`, or `eventLock` cues. They belong to actual product events.

Respect sound/vibration settings. Under Reduce Motion, remove translation, scale, halo animation, and preview autoplay; use crossfades of at most **100ms**. Skeleton breathing is **1200ms**, static under Reduce Motion.

Cue names come from [shared sound map](/Users/abu/dev/hackathon/metropolis/packages/tokens/src/sound.ts); dispatch through [web feedback](/Users/abu/dev/hackathon/metropolis/apps/web/src/lib/feedback/index.ts) and [phone fire](/Users/abu/dev/hackathon/metropolis/apps/mobile/src/feedback/fire.ts), using existing [native haptic words](/Users/abu/dev/hackathon/metropolis/apps/mobile/src/feedback/haptics.ts) and [native motion mapping](/Users/abu/dev/hackathon/metropolis/apps/mobile/src/theme/motion.ts).

**Acceptance.** In addition to R6’s `pnpm gate` and simulator pass, demonstrate `bitcon`, `deposit`, `btc 5m`, a known hash, an unknown hash, and a lookup failure on both surfaces. Check a closed stock, paused market, missing chart, and locked position. Verify Windows/Linux modifiers and the terminal trigger. With one-tap enabled, selecting a position or Up/Down must leave the trade count unchanged until the user separately acts on the terminal.

