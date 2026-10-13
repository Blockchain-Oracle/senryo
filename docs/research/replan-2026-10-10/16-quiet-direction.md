# 16 · Quiet and alive: the product-wide pass (Codex direction, 13 Oct 2026)

Asked of Codex (gpt-6.1-sol, xhigh, read-only) after the owner's 13 Oct review and the density audit (`docs/research/review-2026-10-13/density-audit.md`). Keeps direction 15 (the position row). Kept verbatim below; decisions taken from it are D-344 onwards, built as stage Q (`docs/plan/replan-q-quiet.md`).

**Make Senryo’s figures do the explaining: draw risk, draw payoff, draw time, and let receipts replay what happened. Delete the surrounding narration.** No files edited.

Keep [direction 15’s position row](/Users/abu/dev/hackathon/metropolis/docs/research/replan-2026-10-10/15-position-row-direction.md) intact: authentic mark, recorded PnL trace, ticking ring, dollar PnL, exact-position navigation and Close. This pass replaces the dense settings and receipt sections of [11](/Users/abu/dev/hackathon/metropolis/docs/research/replan-2026-10-10/11-terminal-direction.md) and [12](/Users/abu/dev/hackathon/metropolis/docs/research/replan-2026-10-10/12-slip-direction.md), and the repeated clocks and preview grids in [13](/Users/abu/dev/hackathon/metropolis/docs/research/replan-2026-10-10/13-search-direction.md).

The [density audit](/Users/abu/dev/hackathon/metropolis/docs/research/review-2026-10-13/density-audit.md) supplies the dominant references: Tradash’s chart levels, Fomo’s figure hierarchy, UGLYCASH’s disclosure, and Mitoshi’s rings and capacity bars. Supplemental Refero inspection reinforces a figure directly above its chart in [Copilot](https://refero.design/screens/e38db128-72c6-429f-bd68-7703ceed99fc), and activity communicated through a strip in [Clearful](https://refero.design/pages/cdc4c5de-79d5-460b-be08-64112e6e73a8).

Across both apps:

- Light ground `#F5F5F5`, white working surfaces, black ink; dark theme adapts the same hierarchy.
- Money: **Roboto Condensed Black**, hero **52pt phone / 64px web**, secondary figures 24–28. Inter labels 16; 12–14 only for timestamps and incidental metadata.
- Magenta `#FA00FF` belongs to selected controls and trade actions, with black text. Green/red belong to direction and PnL. Status, verification, capacity and timers use neutral contrast and shape.
- Phone sheets open at the 88% detent for these compositions; web uses a centred bottom sheet, maximum 448px. Use 20pt/24px gutters and a pinned 56-high action.
- Hide balances masks amounts, accessible names, tooltips and monetary geometry. Public market prices, identity and time remain usable.

**1. Ride settings: one multiple, one ruler, one fee disclosure**

At rest, in order:

1. Authentic BTC mark and **“Ride settings”**.
2. A 56-high amount control: **“Margin”**, **“$5.00”**, edit glyph. The keypad and presets appear when tapped.
3. **“10×”** as the 52/64 hero.
4. One marked leverage slider, 44-high touch area. Marks come from the market’s supported leverage values, including its actual cap. No selected-value chip repeating **10×**; the cap belongs on the final tick.
5. A **192-high risk ladder**.
6. A 56-high control: **“Trail”**, **“0.10%”**, chevron.
7. **“Open fee $0.03 ›”**, using the current quote.
8. **“Done”**.

The ladder has **two parallel rails sharing one ascending price axis**: **UP ↑** on the left, **DOWN ↓** on the right. Put a real market mark at the live price, a dashed transverse mark line, and four quote-derived levels: each side’s **KO** and **Cap**. KO uses a broken crossbar; Cap uses a solid terminal tick. Distances are proportional to actual price differences. Never arrange ticks into a prettier, false order.

Each level carries its exact price once. Tap a tick to expose its signed price distance. Keep the axis stable during a gesture. Changing leverage moves the brackets; rising leverage visibly brings KO closer. Preview levels reprice with the market; booked levels remain fixed after fill.

Trail opens one distance ruler with percentage marks. It sets the preference; **Done does not arm an exit**.

The fee chevron reveals the opening charge, the actual closing-fee calculation or labelled estimate, and applicable early-close terms. Never print `up.fee` again as an estimated closing fee.

**Delete:** Trade size, Margin at risk repeating Margin, After this, Max profit beside cap levels, Up capped/Down capped rows, duplicate fee rows, “Up to 40×” heading, leverage chips, the 90%-loss explainer and the trail explainer. Put risk mechanics behind one ⓘ.

Sources: [phone RideBody](/Users/abu/dev/hackathon/metropolis/apps/mobile/src/features/terminal/OrderSheet.tsx:155), [web RideSettings](/Users/abu/dev/hackathon/metropolis/apps/web/src/features/terminal/RideSettings.tsx:48), [quote geometry](/Users/abu/dev/hackathon/metropolis/packages/calls/src/ride-quote.ts:31).

**2. Call settings: stake changes the drawing**

At rest:

- **“Call settings”** and a three-way control: **“Up / Down”**, **“Range”**, **“Moonshot / Crash”**.
- **“Stake”** above the 52/64 amount hero. Tap it for the exact decimal editor and presets.
- A **216-high payoff drawing**.
- **“Trail 5¢ ›”**.
- One fee disclosure.
- **“Done”**.

Draw price vertically, with the actual **Line** across the middle, **Up** above and **Down** below. A live bead crosses between the zones. Alongside each zone, draw a horizontal pay bar labelled **“Pays $10.70”** or **“Pays $9.30”**.

The bars share one dollar scale. Increasing stake lengthens them. **Do not normalize each bar independently or rescale on every edit**, which would erase the visible effect of changing stake. Expand the common scale only when necessary; keep it fixed through a gesture.

Range draws its two edges and the winning interval. Moonshot/Crash draws the actual strict strikes. Boundary glyphs distinguish inclusive and strict edges.

Allow one sentence at rest for Up/Down: **“On the line refunds.”** Other modes use their actual boundary rule through the drawing and ⓘ.

Trail opens a **bid-cents** ruler, labelled **“Bid ¢”**, with the distance bracket behind the best bid. No percentage substitution.

Motion: stake digits roll for 160ms; pay bars resize over 180ms; the live bead follows price. A mode change redraws the zone over 180ms without animating the chart from zero.

**Delete:** Stake summary row, per-side payout rows, per-side fee rows, Settles at row, After this, the win-condition paragraph and trail sentence. Time appears once as a ring attached to the diagram.

Sources: [phone CallBody](/Users/abu/dev/hackathon/metropolis/apps/mobile/src/features/terminal/OrderSheet.tsx:215), [web CallSettings](/Users/abu/dev/hackathon/metropolis/apps/web/src/features/terminal/CallSettings.tsx:45).

**3. Terminal stack and captions: give each fact one home**

Replace the four tiny stack rows with a **160×88 edge-attached settings control**, retaining its bounded vertical drag:

| Instrument | First line | Second line |
|---|---|---|
| Call | **$5.00**, 28 condensed; stake glyph | **Up / Down**, trail glyph, settings chevron |
| Ride | **10×**, 32 condensed | **$5.00 margin**, 20 condensed; settings chevron |
| Held position | Compact instrument identity | Armed-exit glyph and settings chevron |

Fees live in settings. Call payouts live **inside the entry buttons**: **“UP”** over **“Pays $10.70”**; **“DOWN”** over **“Pays $9.30”**. Remove the multiplier caption from the stack and the second payout caption below each button.

Ride entry buttons have no KO sentence beneath them. Their preview draws the relevant KO and Cap on the chart.

For held trades:

- **TRAIL** shows **“+3¢ needed”** or **“+0.08% needed”** inside its disabled slot.
- Eligible: **“TRAIL”**, distance beneath.
- Armed: **“TRAILING”**; the stop is the chart tag.
- **CLOSE** contains its exact net receivable, at least 28 condensed.

Keep **Call | Ride** and one compact **“One-tap on/off”** control.

**Delete entirely:** “▲ $x above the line”, its bracketed percentage, the crowd sentence, “Up to 4 h a ride · no funding”, After this and all prose beneath enabled buttons. Move crowd to market information as a split bar; no sentence beside it.

Before entry, Ride gets a quiet clock glyph with **“4h max”**. Once held, replace it with its sole ticking lifetime display. Blocking states belong in the action slot: **“Window full”**, **“Quote unavailable”**, **“Settling…”**. An actionable recovery can accompany the blocker without becoming another explanation panel.

Sources: [web OrderStack](/Users/abu/dev/hackathon/metropolis/apps/web/src/features/terminal/OrderStack.tsx), [phone terminal captions](/Users/abu/dev/hackathon/metropolis/apps/mobile/src/features/terminal/TerminalScreen.tsx:232), [web TradeButtons](/Users/abu/dev/hackathon/metropolis/apps/web/src/features/terminal/TradeButtons.tsx), [Ride header](/Users/abu/dev/hackathon/metropolis/apps/mobile/src/features/terminal/TerminalTop.tsx:109).

**4. Exit sheets: drag levels; remove every hint sentence**

Use one **240-high vertical ruler** on both platforms, with 44-high grab targets. Web also supports arrow-key adjustment; tapping a value opens exact entry.

For calls, the axis is **bid cents**, bounded by executable bid limits. Show **Now**, B/E, and draggable **TP**, **Stop**, **Floor** handles. A trail bracket connects best bid to its stop. Selecting a handle exposes one dollar equivalent beside it; that amount follows privacy.

For rides, the axis is market price. Draw Entry, Now, B/E, KO and Cap; drag TP and Stop within valid bounds. A Down ride’s profitable levels sit below entry. The trail bracket is a price percentage; its B/E floor is visibly locked.

A single selector chooses **“Take profit” / “Stop” / “Trail”**. An **Off** control removes the selected level. Existing custom levels load at their exact values—even when they do not match a preset.

Footer: **“Set exit”**, **“Update exit”**, **“Setting…”** and **“Remove exit”**. Invalid drafts name the specific blocker in the action slot.

The ruler follows the finger. On release, settle over 120ms; never animate through invalid thresholds. Editing remains local until Set/Update.

**Delete:** title-plus-hint rows, chip-and-stepper combinations, “Worth now” description, “runs with the app closed”, “behind best”, the KO warning sentence and the final explanation paragraph. KO remains a hard drawn boundary.

Sources: [phone call exit](/Users/abu/dev/hackathon/metropolis/apps/mobile/src/features/terminal/ExitSheet.tsx:60), [phone ride exit](/Users/abu/dev/hackathon/metropolis/apps/mobile/src/features/terminal/RideExitSheet.tsx:63), [web call exit](/Users/abu/dev/hackathon/metropolis/apps/web/src/features/terminal/ExitModal.tsx), [web ride exit](/Users/abu/dev/hackathon/metropolis/apps/web/src/features/terminal/RideExitModal.tsx).

**5. Receipts: replay first, stamp once, four facts maximum**

Make one receipt composition serve live view, finished view and PNG export:

- Senryo seal, authentic market mark, identity and folio.
- One figure: **“Unrealized PnL”** while live; **“Realised”** when finished.
- A **200-high replay/chart stage**, spanning the receipt.
- One stamp when authoritatively finished.
- At most four facts.
- One **“Proof ›”** entry point.
- Share/Save actions outside the paper.

Live valuation unavailable: **“—”**. Pending: **“Signing…” / “Waiting for fill…”** in the same object, with no booked result or stamp. Partial closes remain live.

Use these fact budgets:

| Receipt | Facts at rest |
|---|---|
| Live call | Stake, booked payout, signing method |
| Finished call | Stake, Returned, Closed by, Signed with |
| Live ride | Original margin, leverage, fees paid |
| Finished ride | Original margin, leverage, fees paid, Returned |

Entry, exit, line/band, KO and Cap become **pins and tagged levels on the replay**. They disappear from the facts grid.

Replace the vertical transaction timeline with a **40-high pin strip** under the chart. A pin opens that event’s timestamp, booked value and transaction. Merge WindowProof’s Line/Close evidence into those pins. Preserve provenance: an archived print remains labelled **“Archived; not posted on chain”**, and gaps remain gaps.

Receipts open at the final frame. **Play** replays the recording in at most 12 seconds. The hero stays authoritative; recorded PnL appears only in the scrub cursor while interacting. Missing history says **“Replay unavailable”**; partial history says **“Partial recording”**.

Keep the −4° stamp and existing 220ms press. Apply it once to an observed completion. History and exports are static. The result host owns sound/haptics.

**Delete:** full slips embedded in position lists, repeated Open/verdict labels, Trade size, payout repeated as hero and fact, amount-bearing timeline sentences, “View transaction” on every row and the second proof link.

Mask owned amounts and PnL traces. Keep both export actions blocked with **“Show balances to share or save this receipt.”**

Sources: [shared slip](/Users/abu/dev/hackathon/metropolis/packages/calls/src/trade-slip.ts), [receipt facts/proof](/Users/abu/dev/hackathon/metropolis/packages/calls/src/receipt.ts), [web receipt assembly](/Users/abu/dev/hackathon/metropolis/apps/web/src/features/calls/CallReceipt.tsx:79), [Replay](/Users/abu/dev/hackathon/metropolis/apps/web/src/features/receipts/Replay.tsx), [recording contract](/Users/abu/dev/hackathon/metropolis/packages/calls/src/replay.ts).

**6. Events: the split is the figure; the committee is a quorum**

List card: approximately **224 high**, with two real team crests, question, one phase clock, a **28-high split bar**, and Yes/No actions. Put **“Yes 62%”** and **“No 38%”** directly at the bar’s ends. Use neutral fills and distinct patterns; Yes/No are not Up/Down.

No simultaneous pool-dollar rows, percentage rows and percentage bar. Pool totals appear on tap.

Detail enlarges this composition; **do not mount EventCard inside EventDetail**. Phone stacks question → split → quorum → timeline → pinned actions. Desktop uses that same main composition with a compact action column.

Committee: 36-high avatar/source-mark quorum. Use actual signer portraits when available; otherwise authentic source marks. Each has a pending, agree or disagree glyph. Show **“Quorum 2/2”** for agreed versus required; tapping exposes member names and statements. Any disagreement remains visible.

Draw a **48-high timeline strip** with **Calls close → Game → Answers → Decision**. Only the currently meaningful deadline counts down. Exact dated timestamps appear when a node is selected.

One **“Verified ›”** opens terms hash, statement checks and chain evidence. Until checks pass, use **“Pending”**, **“Unverified”** or **“Mismatch”**. Quorum agreement and hash verification remain separate states.

Motion: split boundary interpolates for 180ms; a confirmed answer fills its quorum slot over 180ms; the clock drains linearly.

**Delete:** repeated close times, duplicated question/card, rules paragraph at rest, committee sentence, repeated refund rule, visible hex and per-member “Statement re-hashed here”. **“Rules ›”** exposes the complete settlement rules.

Sources: [phone detail](/Users/abu/dev/hackathon/metropolis/apps/mobile/src/features/events/EventDetailScreen.tsx), [web detail](/Users/abu/dev/hackathon/metropolis/apps/web/src/features/events/EventDetail.tsx:65), [shared event semantics](/Users/abu/dev/hackathon/metropolis/packages/calls/src/event-words.ts).

**7. Earn: ownership, capacity and the next hour**

Keep **“Your share value”** as the hero, with the share-price chart directly beneath. Before ownership, use **“Value of one pool share”**. Keep 1D/7D/30D and the chart’s honest minimum span.

Below it:

- One **24-high capacity bar**, on a **0–100% pool-value scale**.
- Reserved capacity fills the bar; its configured exposure cap is a vertical tick.
- Labels attach to the drawing: **“Backing”**, **“Ready”**, **“Cap 30%”**. Dollar values appear on inspection.
- One **64×64 hour ring**, with **“Next hour”** and **“12:34”**.
- **Supply / Withdraw**.
- One ⓘ.

Pending requests become compact request objects: amount, state and **“Take back”** where allowed. Their pending state points to the same hour ring; it does not print another countdown. A withdrawal waiting for liquidity says **“Waiting for liquidity”**, without promising the next hour.

Risk behind ⓘ, once: **“Your share can fall, and withdrawals can wait.”** Further mechanics expand there.

Motion: hero rolls for 160ms; new chart observations append; capacity shifts for 180ms; hour ring drains continuously.

**Delete:** Pool/Available/Backing row stack, `% of pool` chains, repeated return captions, every duplicate settlement countdown, both inline risk blocks and zero-return lists.

Sources: [phone Earn](/Users/abu/dev/hackathon/metropolis/apps/mobile/src/features/earn/EarnScreen.tsx:176), [web Earn](/Users/abu/dev/hackathon/metropolis/apps/web/src/features/earn/EarnScreen.tsx:178), [capacity and share calculations](/Users/abu/dev/hackathon/metropolis/packages/calls/src/earn-words.ts:151).

**8. Duel: one pot meaning, visible contributions**

`pot` is each seat’s contribution. Therefore, for the current $10-contribution tier:

- Tile: **“$20 pot”**.
- Stage: **“$20 pot”**.
- Join review: **“$10 each”**.
- Three $10 calls plus that contribution: **“Join $40”**.

This matches [the configured escrow calculation](/Users/abu/dev/hackathon/metropolis/packages/config/src/duel.ts), while [tierTitle and potLine currently disagree](/Users/abu/dev/hackathon/metropolis/packages/calls/src/duel.ts:20).

Use 72-high seats with a **coin stack between them**, occupying a 96-wide centre. Before matching, the other contribution is an outline. On match, both contributions slide into the central pot over 240ms. Coins never imply money already received.

Tier tiles become **132×96**: combined pot, `3 × $10 calls`, queue count. Collapse the selected tile after queueing so the pot is not repeated beside the stage.

One phase clock: queue expiry, deck reveal or pick deadline. During picking, put a 56 ring around the central stage; cards have small progress sockets, no duplicate countdowns. Settlement uses per-card states, with no invented common deadline.

**“No pot”** replaces a zero stack; its calls still show their stakes.

**Delete:** commitment equation beneath the carousel, repeated “better total takes the pot”, four match countdowns, raw deck/seed text and decorative magenta stage lines. Put deck evidence behind **“Verified ›”**.

Sources: [phone tiers](/Users/abu/dev/hackathon/metropolis/apps/mobile/src/features/duel/TierCarousel.tsx), [web stage](/Users/abu/dev/hackathon/metropolis/apps/web/src/features/duel/DuelStage.tsx), [web match](/Users/abu/dev/hackathon/metropolis/apps/web/src/features/duel/DuelMatch.tsx).

**9. Calls: two numbers and a record strip**

Replace the six-cell grid with:

- **Lifetime PnL**, 52/64 condensed.
- **Win rate**, 40/44 condensed alongside.
- A **20-cell recent-outcome strip**, 8-high cells with 3 gaps. Wins rise, losses drop, refunds are hollow. Color supplements shape.
- **“Streak 4”** attached to the strip. Best streak, volume and trade count go behind **“Record ›”**.

Use the real denominator: refunds excluded from win rate. The current statistics span calls, rides, parlays and events, while history rows currently cover calls and rides. The strip must either obtain that complete chronology or explicitly read **“Recent calls & rides”**. Never synthesize it from aggregate streak counts.

History rows: **72 minimum height**, authentic mark, compact trade identity, date, one neutral verdict word and a neutral net figure. The word owns the verdict; remove outcome coloring and repeated status from the subtitle. Tap opens the receipt.

Keep the approved open-position group. Show each parlay once.

**Delete:** six cells, stake repeated in history subtitles, inline finished slips, repeated verdict words and “Every call, its result and its receipt” empty-state explanation. Empty: **“No calls yet”**, **“Open terminal”**.

Sources: [web StatsCard](/Users/abu/dev/hackathon/metropolis/apps/web/src/features/calls/StatsCard.tsx), [phone history](/Users/abu/dev/hackathon/metropolis/apps/mobile/src/features/calls/CallsScreen.tsx), [statistics scope](/Users/abu/dev/hackathon/metropolis/packages/calls/src/stats.ts), [history scope](/Users/abu/dev/hackathon/metropolis/packages/calls/src/use-call-rows.ts).

**10. Markets: one list clock; Home is personal**

Use one shared row contract for Home, Markets, picker and search: **mark → symbol/name → trace → price/24h move**. Minimum 72 high; mark 36, trace approximately 64×20, price 24 condensed. Exceptions may add **“Closed”**, **“Paused”** or **“Not listed”**.

Above the list, show one selected-cadence control and one ring: **“5m round”**, **“Calls close”**, **“3:42”**. During lockout: **“Next round”**, countdown. Default to an actually listed cadence.

This clock describes the shared round schedule. Per-market availability still comes from authoritative state. Opening a market resolves its own window; a global timer never grants admission.

Search’s Markets group gets the same single clock. Delete the four lane clocks from every result and the preview’s four countdown rows. The selected market’s nested view gets lane labels plus one clock for the selected lane.

**Home:** balance hero, approved open positions, then at most three favourites/recent markets. **“All markets ›”** opens Markets. Remove duplicate header balance when Home’s hero is visible.

**Markets:** full catalogue, filters, search, favourites and category grouping. No wallet hero or duplicated positions list.

Motion: figures roll; traces append; rows retain order while browsing. One clock subscription serves the list.

**Delete:** per-row 1m timers, repeated `name · clock` chains, cloned row implementations and Home’s full MarketList.

Sources: [phone row](/Users/abu/dev/hackathon/metropolis/apps/mobile/src/features/markets/MarketRow.tsx), [web row/list](/Users/abu/dev/hackathon/metropolis/apps/web/src/features/markets/MarketList.tsx), [shared clocks](/Users/abu/dev/hackathon/metropolis/packages/calls/src/use-market-session.ts), [phone Home](/Users/abu/dev/hackathon/metropolis/apps/mobile/src/features/home/HomeScreen.tsx), [web Home](/Users/abu/dev/hackathon/metropolis/apps/web/src/features/home/HomeScreen.tsx).

**11. The remaining surfaces**

| Surface | At rest and exact words | Motion and deletion |
|---|---|---|
| **Status** | One 52/64 verdict: **Live / Delayed / Unavailable / Unverified**. Component name, one state and history strip. **“Checked 8s ago”** once. | New readings update the affected strip over 120ms. Delete verdict sentence, tally pills, dot-plus-word duplication and uptime captions. Inspect a bar for measurements. Neutral shapes replace green/red health colors. |
| **Settings** | 56-high rows, icon, name and value. **“Sounds On”**, **“Appearance Light”**, **“Recovery Ready”** or **“Set up”**. Sound level controls appear inside Sounds. | 170ms state changes; play a sample only on volume release. Delete toggle detail sentences, recovery paragraphs at rest, rainbow icon tints and repeated account address. Recovery opens its real workflow. |
| **Everything / More** | Search plus 56-high icon-and-name navigation rows. One entry per destination absent from that platform’s primary navigation. | Native push / 170ms drawer-content entry. Delete 15 descriptions, “Every place in Senryo” and rail/dock duplicates. |
| **Wallet** | Balance hero and three 56-high actions: **Get test dollars / Receive / Withdraw** as available. | Amount rolls for 160ms; pending action changes in place. Delete locked Add-real-money rows and dead links. |
| **Receive** | One network/asset identity, **208-square QR**, grouped address, **Copy / Share / Explorer**. One necessary boundary: **“USDC on Monad only.”** | Copy becomes **Copied** for 1.2s. Delete duplicate full-address/copy-code presentations, repeated network paragraphs and “Sending from another chain?” until it opens a real destination. |
| **Toasts** | Authentic mark plus title; **“BTC Up opened”**, **“Realised +$1.24”**, **“Address copied”**. Description optional. | One ID morphs through the operation. Delete descriptions that restate titles. Keep genuinely additional recovery information and **Check status** actions for unresolved operations. |
| **Games hub** | Actual game scene, name and one real navigation control: **Play / Spin / Deal**. Group stake-free games under **No stakes** once. Lucky carries its actual call amount. | Only the visible/focused attract scene plays. Delete rule narration, repeated No stakes, fake Play pills and Lucky’s text summary of its reels. |
| **Parlay** | Sockets, connections, one round clock and one payout hero in the open slip. Empty sockets carry **2–4 legs**. Rules behind ⓘ: **“Every remaining leg must win.”** | Preserve the existing socket/track choreography. Delete rule sentences under sockets and slip bar, duplicate Pays and per-leg clocks when they share the round. Preserve distinct deadlines when genuinely different. |

Sources: [Status](/Users/abu/dev/hackathon/metropolis/apps/web/src/features/status/StatusBoard.tsx), [Settings](/Users/abu/dev/hackathon/metropolis/apps/web/src/components/shell/drawers/SettingsDrawer.tsx), [Everything](/Users/abu/dev/hackathon/metropolis/apps/web/src/components/shell/EverythingDrawer.tsx), [phone Settings](/Users/abu/dev/hackathon/metropolis/apps/mobile/src/features/profile/SettingsList.tsx), [Wallet](/Users/abu/dev/hackathon/metropolis/apps/mobile/src/features/wallet/WalletScreen.tsx), [Receive](/Users/abu/dev/hackathon/metropolis/apps/mobile/src/features/wallet/ReceiveCard.tsx), [toast contract](/Users/abu/dev/hackathon/metropolis/packages/calls/src/toast-run.ts), [Games](/Users/abu/dev/hackathon/metropolis/apps/web/src/features/games/GamesHub.tsx), [Parlay sockets](/Users/abu/dev/hackathon/metropolis/apps/mobile/src/features/parlay/LegSockets.tsx:81).

**12. Shared words: return facts with units and provenance**

Keep calculations and state semantics shared. Return structured values before formatting. Money remains bigint base units; prices E8; bids E6; distances bps; timestamps Unix seconds. Convert only final plotting coordinates to floating point.

| File and existing functions | Required value-first contract |
|---|---|
| [ride-quote.ts](/Users/abu/dev/hackathon/metropolis/packages/calls/src/ride-quote.ts): `knockOutWords`, `capWords`, `capText`, `rideTrailReady` | Level kind, `priceE8`, signed `moveBps`; trail `{ready, needBps}`. `rideQuote` already supplies the useful numeric geometry. Retire sentence helpers after both renderers migrate. |
| [quote.ts](/Users/abu/dev/hackathon/metropolis/packages/calls/src/quote.ts): `oddsLine`, `chanceOf`, `quoteNote`, `quoteTick` | `{payout, multipleE2, probE6, refusal}`; raw line distance and zone geometry. Remove `firstLine`, `secondLine`, `lineText`; return blocker codes rather than sentences. |
| [ride-tick.ts](/Users/abu/dev/hackathon/metropolis/packages/calls/src/ride-tick.ts): `rideTick` | Remove `upLine`, `downLine`, `trail.caption`. Return `{armed, ready, distanceBps, needBps, stopE8}` alongside existing quote/level values. |
| [stack-words.ts](/Users/abu/dev/hackathon/metropolis/packages/calls/src/stack-words.ts): `paysWords`, `feesWords`, `closeCostWords` | Side-indexed payouts/multiples, fee amounts or `{min,max}`, and close spread cost. No arrow/value strings or “incl.” strings. |
| [modes.ts](/Users/abu/dev/hackathon/metropolis/packages/calls/src/modes.ts): `offerOf` | Replace `where` with band edges, inclusivity and outcome semantics. Keep concise band labels. |
| [exits.ts](/Users/abu/dev/hackathon/metropolis/packages/calls/src/exits.ts): `exitLine`, `callTrailReady`, `callTrailCaption`, `exitProblem` | Exit thresholds, trail distance/stop, needed bid cents; validation `{code, min/max/current}`. Preserve the existing rounding and bounds calculations. |
| [receipt.ts](/Users/abu/dev/hackathon/metropolis/packages/calls/src/receipt.ts): `receiptFacts`, `receiptSteps`, `callWhere`, `crowdText`, `proofFacts` | Typed facts; events with kind/time/amount/price/tx; band geometry; crowd fractions; proof pins with source, posted/archived state and verification. |
| [trade-slip.ts](/Users/abu/dev/hackathon/metropolis/packages/calls/src/trade-slip.ts): `callSlip`, `rideSlip`, `maskedSlip` | Raw hero amount, typed fact IDs, lifecycle/outcome, pin data and privacy classification. Keep folio, link and stamp semantics. Stop packing money into `v`, `title` and `figure.text`. |
| [event-words.ts](/Users/abu/dev/hackathon/metropolis/packages/calls/src/event-words.ts): `statusLine`, `committeeLine`, `feeLine`, `callResultText`, `liveLine` | Phase/deadline, member identities/quorum/answers, fee bps, stake/returned/outcome, score/period. `yesShare`, `estimateFor`, `statementChecks` already return useful values. |
| [earn-words.ts](/Users/abu/dev/hackathon/metropolis/packages/calls/src/earn-words.ts): `earnWords`, `poolPanel`, `seriesReturn`, `estimateLine` | Ownership amounts, request states, reserved/liquid/total, cap bps, `nextRoll`, numeric return/range and estimated shares/proceeds. Risk stays a disclosure string. |
| [duel.ts](/Users/abu/dev/hackathon/metropolis/packages/calls/src/duel.ts): `tierTitle`, `tierLine`, `entryText`, `commitment`, `potLine`, `cardResultText`, `outcomeText` | One `{perSeatPot, combinedPot, cardStake, cards, entryCost}` model; result amounts and outcome codes. All pot renderers consume `combinedPot`. |
| [markets.ts](/Users/abu/dev/hackathon/metropolis/packages/calls/src/markets.ts), [use-market-session.ts](/Users/abu/dev/hackathon/metropolis/packages/calls/src/use-market-session.ts): `marketLine`, `closedWords`, `laneCells`, `useMarketLanes` | Session/availability codes, deadlines and numeric remaining seconds. Row state and shared round clock are separate models. |
| [status-words.ts](/Users/abu/dev/hackathon/metropolis/packages/calls/src/status-words.ts): `verdict`, `metricLine`, `barLabel`, `uptimeText` | State/tally, typed metrics, bucket timestamps/counts and measured uptime ratio. Labels remain short shared words. |
| [stats.ts](/Users/abu/dev/hackathon/metropolis/packages/calls/src/stats.ts), [use-call-rows.ts](/Users/abu/dev/hackathon/metropolis/packages/calls/src/use-call-rows.ts), [parlay.ts](/Users/abu/dev/hackathon/metropolis/packages/calls/src/parlay.ts) | Numeric win ratio; raw net result and outcome; raw multiplier, leg state, phase and deadline. Remove sentence-bearing `parlayHero`, `parlayStatus`, `roundLine`, `legClock` and `slipBarWords` contracts. |

Also give trade notifications typed amount fields. `maskedNote` currently finds money inside sentences with a regex; the new model should mask money before generating text.

Formatting helpers such as `dollars`, concise labels, folios and link builders can remain. **Do not make either app parse a display string to recover a number.**

**13. Eight checkable gate rules**

Extend the [existing invariant runner](/Users/abu/dev/hackathon/metropolis/scripts/invariants/run.mjs) with custom checks and a development-only surface inspector. Keep the checks scoped to these operational surfaces; legal documents, Help and explicitly opened details have different budgets.

| Rule | How to check with low false positives |
|---|---|
| **At most three segments in a ` · ` chain** | AST-check visible JSX strings, templates and `.join(" · ")`; flag more than two separators. Inspect generated strings in the development surface report. Exclude comments, accessibility-only text and legal/help content. |
| **At most four fact rows at rest** | Standardize typed `FactList` descriptors and inspect their rendered count. Controls/navigation rows do not count as fact rows. Open disclosure views have an explicit different surface role. |
| **One fact owner per visible surface** | Register `{entityKey,factId}` from figures, annotations and facts. Fail duplicate registrations after hidden/occluded content is excluded. Explicitly budget the position direction’s required row/chart PnL and Close presentations. Compare semantic IDs, never equal number strings. |
| **No control explainers** | Ban `hint`/`description` props and adjacent explanatory Text/paragraph nodes in the named settings and exit components. Allow labelled validation slots and ⓘ disclosure content. |
| **One clock per entity/deadline** | Require a shared countdown descriptor with `entityKey`, `deadlineKind`, `endsAt`, `durationSec`. The inspector flags repeated visible clocks for the same key. Different positions or genuinely different leg deadlines remain valid. |
| **Value-first drawing inputs** | Type/AST checks reject `lineText`, `upLine`, `downLine`, `caption` and sentence-valued geometry fields in the new models. Reject string parsing in ruler/bar/ring renderers. |
| **Privacy covers every money-bearing output** | Require money facts and money-derived geometry to declare sensitivity. The inspector reports unclassified amount/geometry nodes; hidden-mode simulator review checks tooltip/accessibility text and export blocking. Public price fields have a separate type. |
| **Every new live primitive has motion and reduced-motion behavior** | Require registered motion specifications for ruler, pay bar, ring, ticker and stamp. Flag missing reduced-motion policy. The simulator report records normal/reduced mode; no generic “animate everything” requirement. |

These are structural checks, not screenshot guesses. Keep any exception local, named and bounded.

**14. Build order: six complete cross-platform areas**

Each area lands shared data plus both renderers together, passes the existing gate, and gets **one scripted native simulator pass with matching web review**.

| Order | Shippable area | Pass demonstrates |
|---|---|---|
| **1** | Ride and Call settings; value-first quote models; amount disclosure | Leverage narrows the real KO distance; stake grows pay bars; network caps, missing quotes, exact entry and privacy work. |
| **2** | Terminal stack, buttons, captions, exit rulers and operation toasts | Call and Ride open → fill → trail → close; custom exits survive editing; exact-position selection; no repeated submission or narration. |
| **3** | Receipt/replay/proof composition and Calls record/history | Live, partial close, finished call and ride, refund, recording gap, reload, proof provenance and masked export. |
| **4** | Event cards/detail and Duel lobby/match | One phase clock; quorum/disagreement; verification failure; consistent pot/contribution/entry amount; queue-to-match transition. |
| **5** | Earn, Wallet/Receive, Settings/recovery and Status | Share/cap/hour drawings; delayed withdrawal; one QR; working destinations; compact recovery status; unknown health remains unknown. |
| **6** | Home/Markets/picker/search, Everything/More, Games and Parlay cleanup | One list clock; Home shortlist; exact-position search navigation; disabled market states; no dead rows; live game scene; one Parlay payout/rule owner. |

Search 21st.dev for these bases; use their primitive behavior and rebuild the native equivalent:

| Need | Search terms |
|---|---|
| Leverage and exit rulers | **“range slider with marks”**, **“multi thumb slider”**, **“vertical slider”** |
| Rings | **“radial progress”**, **“countdown ring”** |
| Money | **“number ticker”**, **“Animated Number”** |
| Payoff/capacity | **“animated progress bar”**, **“segmented progress bar”** |
| Receipt evidence/quorum | **“timeline scrubber”**, **“avatar group”** |
| Record strip | **“activity heatmap”**, **“Sparkline”** |

Promote their sizing, state and gesture behavior into Senryo’s tokens; strip demo cards, decorative gradients and unrelated accent colors. Every area’s pass includes hidden balances, reduced motion, a narrow phone and enlarged text.


