# Codex direction — five phone surfaces (12 Oct, gpt-6.1-sol, xhigh, read-only, with the five screenshots in shots/)

Senryo should feel like an arena with five distinct instruments: **Parlay builds a chain; Duel stages a confrontation; Earn shows ownership; Status proves health; Markets takes over the terminal.** Changing the buttons’ colours will not fix these screens.

Use Tradash’s chart prominence, Owarine’s competitive staging, Mitoshi’s leg-to-slip motion, and Canton S2’s explicit money outcomes. The local [reference studies](/Users/abu/dev/hackathon/metropolis/docs/research/replan-2026-10-10/00-synthesis.md) provide the behavioral foundation. Refero’s .SWOOSH direction contributes dark contrast and strong scale; Uniswap Cup contributes opposing seats and score hierarchy.

**Shared phone frame.** Dimensions below are logical points, excluding safe areas, targeting a 390-point-wide screen. Use 20-point gutters, a 56-point header, 44-point minimum targets, 56-point primary actions, 16-point card radii and 28-point sheet corners. Canvas `#0B0B0C`, cards `#18181A`, borders `#303034`; white primary text and `#AAAAAF` supporting text. Condensed display numerals at 44–52 points; Inter labels at 16/22, metadata at 13/18. Preserve the supplied direction colours with black labels; magenta identifies competition/selection, gold belongs to Lucky.

Guests can explore, select and calculate. The first commitment opens the passkey signing sequence **with the chosen configuration preserved**. Recheck quotes afterward. Persist submitted intents; an uncertain result exposes “Check status” and prevents duplicate submission.

**1. Parlay becomes a visible builder.**

Top to bottom:

- Header: “Parlay”, back, 44-point history action.
- An 80-point hero: four connected leg sockets, “Pick 2–4 calls. Every leg must come true.” Selected sockets carry real marks and direction arrows.
- A 44-point window selector; one 28-point round-status strip beneath it.
- A 48-point search field and horizontally scrolling asset-class filters.
- A vertical list of **140-point market cards**, separated by 8 points.
- A persistent 88-point slip bar above the bottom safe area, replacing the floating dock.

Each card shows a 32-point mark, symbol/name, live price, a 96×24-point **24h** sparkline, signed 24h change, and two 44-point buttons: `↑ Up · 1.82×` and `↓ Down · 1.94×`. Label these multipliers as indicative for the selected window. Never imply that the historical sparkline predicts the leg.

Tap selects; tapping again removes; the opposite direction replaces. No swipe-to-bet. One leg per market, maximum four. Existing legs retain their window when the selector changes; each socket displays its duration.

The slip exists before selection: “Choose your first leg.” After selection, show marks, leg count and the live combined multiplier. At one leg: “Add one more”; at two: **“Review parlay”** in the thumb zone.

Tap or drag expands the slip to 62%, then full available height. Order: leg list with remove controls; 44-point combined multiplier; stake presets; 48-point stake amount; 3×4 keypad with 56-point keys; possible return including stake; minimum accepted payout; pinned `Place parlay · $5`. Combined pricing comes from the shared quote engine, including correlation adjustment—never multiply the displayed leg odds.

Between rounds, keep prices and charts alive. One banner says “Round settling · next selection opens in 0:14.” Picks become explicitly labelled **next-round drafts**; they are repriced when a new window opens and require another deliberate Place action. No automatic submission. Calendar closures move into a collapsed “Closed markets” group.

Loading preserves card geometry with skeletons. Missing quotes show `—` and disable that side. No search results offers Clear filters. A stale selected leg remains visible with a repair action.

After placement, the chain becomes a settlement track: entry/closing prices and verdict per leg. Process actual arrivals individually; replay already-settled legs 420 ms apart. One miss marks the parlay lost while remaining legs continue reporting. Ties/voids show the engine’s dropped-leg or refund treatment.

**2. Duel becomes a two-seat arena.**

Top to bottom: header; a **220-point stage**; tier carousel; cost breakdown; recent results. Keep a 56-point `Find opponent · $40` action pinned at the bottom.

The stage has two opposing 72-point portraits, handles and ratings, separated by a large `VS`. Your seat is solid; the opponent seat is an outlined silhouette labelled “Opponent seat”. A horizontal line connects them through the prospective pot. Guest identity reads “Your seat”; rating reads “Unranked”.

Use 132×112-point tier tiles with snapping horizontal paging. Show pot contribution, stake per card and actual queued count for that tier. The selected tile gets a magenta edge. **Rename the existing “Free” tier “No pot”: it still requires $30 in call stakes.**

Below the tiles, spell out the selected commitment:

`3 × $10 calls + $10 pot contribution = $40`  
`Winner receives the $20 pot; call returns settle separately.`

Entry authorizes that amount; escrow occurs when the match opens. Queue cancellation must show the server-confirmed outcome, including a cancellation-versus-match race.

Queue transforms the empty seat into a searching ring. Show elapsed time, selected-tier queue count and the actual matching band. Unavailable counts read “Queue count unavailable”; zero reads “First in this tier”. After 30 seconds, offer other tiers without switching automatically. Cancel stays in the thumb zone.

The match is a full-screen scoreboard: persistent opposing portraits, pot and pick deadline above **three shared market lanes**, each approximately 128 points high. Each lane shows mark, live price, 24h sparkline, window and Up/Down payout buttons. Your confirmed choice locks into your side; the opponent’s side shows only confirmed progress until the protocol permits reveal.

Score the actual **sum of call profit/loss**, not the number of correct calls. During settlement, roll each seat’s total as its results arrive; mark totals provisional until complete.

Results occupy the stage: winner portrait, both totals, pot award, separate call returns, net result and confirmed rating change. Tie, refund and forfeit have distinct explanations. Bottom actions: Rematch and Share.

Warm-up retains the solo stacked deck and playful dealing. Duel uses opposing seats, fixed market lanes and score movement throughout. Empty history becomes one compact invitation to play; loading keeps the stage intact; unavailable Duels retain a labelled preview without an actionable entry.

**3. Earn becomes an ownership screen.**

Order: header; 152-point ownership hero; 180-point share-value chart; live pool panel; pending requests; collapsible settlement history. A bottom action tray contains 56-point Supply and Withdraw buttons.

Signed-in hero: **“Your share value”**, 52-point amount; below it, “Net earned” and ownership percentage. Net earned equals current position value plus settled withdrawals minus settled supplies; pending deposits remain separate.

Guest hero: **“Value of one pool share”**, the actual unit value and observed return. Show no fabricated personal `$0.00`.

Use **“30-day share return”**, calculated from unit share prices, as the APY-like headline. Never annualize a few quiet hours. With insufficient history, show “Since launch · 2 days”; without measurements, “Collecting history”. Negative returns remain visible.

Chart controls: 1D / 7D / 30D. Plot share value, so deposits do not masquerade as performance. Scrubbing displays timestamp, unit value and interval return. Flat measured history stays flat; absent history stays empty.

The pool panel shows total value, available liquidity, backing open calls, utilization and next settlement boundary. Withdrawals explicitly say they may wait for sufficient liquidity after calls settle.

Supply/Withdraw opens a **72%-height keypad sheet**: amount at 48 points; available balance or redeemable shares; presets; keypad; estimated shares/proceeds; settlement timing; pinned confirmation. Guests can enter an amount before signing. After authentication, validate against the actual balance.

Pending requests become 72-point receipts with amount, status, expected boundary and Cancel where allowed. Submission creates a queued receipt; only confirmed settlement changes ownership. Zero holdings keeps the chart and explanation visible. Closed Earn retains public evidence and explains availability. Loading uses chart/amount skeletons; errors retain labelled last-known values.

Keep the risk sentence next to the action tray: “The pool pays winning calls. Your share can fall, and withdrawals can wait.”

**4. Status becomes a live evidence board.**

Order: header; 96-point overall-health summary; Prices; Settlement; Networks; incident timeline. A 56-point “View incidents” action sits at the bottom.

The hero says “Live”, “Delayed”, “Unavailable” or “Unverified”, with affected-market count and last successful observation.

Use approximately 112-point component tiles:

- Feeds: mark, live/expected markets, latest tick age, source cadence and publish-to-ingest latency.
- Keeper: last successful settlement, overdue windows and oldest overdue age.
- Relay: confirmation latency, pending count and oldest pending request.
- Chain/indexer: block age, RPC latency and indexer lag.
- Deposits: measured service state, or “Not enabled in Practice”.

Each tile has 24h/90d history controls: 24 hourly bars or 90 daily bars. Scrub opens a timestamped detail bubble. Report measured availability and monitoring coverage; unknown intervals are grey. Scheduled market closure is a separate state, not downtime.

Pulse only when a new observation arrives. Stop pulsing when observations stop. Never animate simulated health.

Incidents include start time, affected functions, user consequence, latest update and resolution. “No incidents reported” is distinct from “Incident history unavailable”. This requires additional telemetry/history beyond today’s Status response.

**5. Markets becomes a terminal takeover.**

Use **`@gorhom/bottom-sheet` v5**: its integrated scrolling, keyboard handling and configurable snapping fit this searchable cross-platform overlay. Choose it over route-based form sheets because Markets is temporary terminal state with shared custom choreography. [Bottom Sheet documentation](https://gorhom.dev/react-native-bottom-sheet/).

Let `H` be screen height minus top safe inset and 8 points. Snap heights are `0.62H`, `0.88H`, `H`; open at 62%. Disable dynamic sizing so content cannot alter detents. Use `BottomSheetModal`, `BottomSheetSectionList` and `BottomSheetTextInput`; enable handle/content dragging and pan-down dismissal. [Configuration](https://gorhom.dev/react-native-bottom-sheet/props).

Mount above the navigation shell. Hide the dock and ticket immediately; disable underlying touches and accessibility exposure. Keep the chart visible beneath a 60% black scrim. Restore controls only after dismissal completes.

Sheet order: 24-point grab region; 48-point title/close row; 48-point search; 40-point category filters; grouped 76-point market rows. Each row contains a 32-point mark, symbol/name, 72×24 sparkline, price and signed 24h change.

Empty search shows Favourites, Recent, then Crypto / Stocks / FX / Metals; avoid duplicate rows. Star controls have 44-point targets. Guest favourites and recents persist locally.

Opening does not summon the keyboard. Search focus expands to `H` before focusing. At full height, content scrolls; downward dragging collapses only when the list is at its top. Android Back dismisses keyboard first, sheet second.

Selection updates the market beneath the overlay, dismisses, then restores the ticket. Missing data shows dashes; stale prices carry age labels. Verify keyboard-open dragging and slow dismissal on the actual Expo/Reanimated stack.

**Four signature motions govern the feel.**

| Moment | Motion | Sound and haptic |
|---|---|---|
| Parlay capture | Mark follows a 320 ms curved path into its socket; socket settles with spring mass 1, stiffness 420, damping 30 | Short selection tick; light impact on arrival |
| Opponent arrives | Portrait enters over 240 ms; VS compresses 1.12→1 with spring 1/360/26; lanes enter 70 ms apart | Match chord; one medium impact |
| Confirmed verdict | Stamp compresses 1.08→1 over 180 ms; totals roll over 260 ms | Existing win/loss cue; success or warning haptic, once per result |
| Sheet takeover | Open with spring 1/320/32; dismiss over 220 ms; scrim fades over 160 ms | Light detent haptic; selection tick when choosing a market |

Earn chart scrubbing uses quiet selection haptics; Status refresh uses one light tick and remains silent during background updates. Music follows existing preferences, ducks beneath match/verdict cues and pauses in background. Reduced Motion replaces travel, overshoot and rolling digits with immediate updates or 100 ms fades.

**Web shares the product logic and hierarchy.** At desktop widths, Parlay gets a fixed 360-pixel slip rail; Duel keeps opposing seats around the lanes; Earn places its chart beside a 360-pixel action panel; Status expands into a board; Markets becomes a 640-pixel searchable dialog. Mobile web follows the phone arrangement. Share quotes, receipts, states, cue events and guest progression.

Use 21st’s [Number Ticker](https://21st.dev/@danielpetho/components/basic-number-ticker) and [Number Pad](https://21st.dev/community/components/bankkroll/number-pad) as component references. Adapt [OpenStatus’s Status Bar](https://21st.dev/@openstatusHQ/components/status-bar) interaction pattern with independently built native bars; its published source is AGPL. RN uses native primitives, Reanimated and Skia.
