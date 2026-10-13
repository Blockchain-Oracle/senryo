# 15 · The open-position row (Codex direction, 13 Oct 2026)

Asked of Codex (gpt-6.1-sol, xhigh, read-only) after the owner's review of the phone's Home on 13 Oct: the expanded facts grid (Direction, Entry, Now, Knocked out at, Capped at, Margin, Fees) is "slop"; "ends 09:57" never counts down; a tap can't reach the trade; be premium. Kept verbatim below; decisions taken from it are D-343 in `docs/plan/decisions.md`, built as R5.26.

**Replace the accordion with a live position row: the trade’s identity, its movement, its remaining time, and a direct way back to the terminal.** Remove the expandable facts grid entirely.

The dominant reference stays Senryo’s house direction and Tradash’s live PnL/Close behavior. Borrow the compact identity → trace → figure alignment from [Apple Stocks](https://refero.design/screens/692967be-f0b3-4f5e-8c48-78a8ba38c849), without its colored value boxes. Both current rows explicitly implement tap-to-expand; this replaces that contract. [Phone row](/Users/abu/dev/hackathon/metropolis/apps/mobile/src/features/positions/PositionRow.tsx:129), [web row](/Users/abu/dev/hackathon/metropolis/apps/web/src/features/positions/PositionRow.tsx:108)

**1. The row at rest**

Phone composition:

```text
[mark + ring]  BTC ↑ · 10×                    +$0.0400
               3:42:18 left   [small trace]       +0.7%
```

For a call, the title becomes **“BTC ↑ · 5m”**. Down uses ↓; nonstandard calls retain their actual identity: **“BTC · Range · 5m”**, **“BTC · Moonshot · 5m”**, **“BTC · Crash · 5m”**.

The arrow and lane/leverage are compact identifiers, useful when several BTC trades coexist. They do not become a second “Direction” fact.

At rest, show only:

- Authentic market mark.
- Symbol, side/type, and lane or leverage.
- Ticking time remaining.
- This position’s recorded PnL trace.
- Dollar PnL first; ROI smaller beneath it.

**Do not show:** entry, current market price, margin/stake, fees, KO, cap, break-even, payout, “Worth now,” a “Live” badge, receipt number, or an expansion chevron. No individual row background, border, pill, shadow, or colored wash.

Use spacing to separate rows. A single neutral group surface may ground the entire Open positions section.

| Element | Phone, pt | Web, px |
|---|---:|---:|
| Normal row minimum height | 80 | 80 |
| Narrow terminal-column row, including Close | — | 96 |
| Market mark / outer countdown ring | 32 / 40 | 32 / 40 |
| Symbol and identifier | 16 / 20 leading | 15 / 20 |
| Dollar PnL | 24 / 28 | 24 / 28 |
| ROI | 12 / 16 | 12 / 16 |
| Countdown | 12 / 16 | 12 / 16 |
| Trace | 64 × 20 | 72 × 24 |
| Horizontal gap | 12 | 12 |
| Phone action target | ≥44 | Touch layouts ≥44 |

Money uses **Roboto Condensed Black**; labels use Inter. Reserve enough figure width for the formatted amount so digits never push the identity around. At 320pt or larger Dynamic Type, move the trace beneath the identity and let the row grow; keep money readable. These are proposed component sizes using the existing font and touch conventions. [Phone type](/Users/abu/dev/hackathon/metropolis/apps/mobile/src/theme/type.ts:10), [shared scale](/Users/abu/dev/hackathon/metropolis/packages/tokens/src/scale.ts:30), [phone layout](/Users/abu/dev/hackathon/metropolis/apps/mobile/src/theme/layout.ts:7)

**Countdown**

Use the synchronized server clock, with a display update every second independent of price ticks or book re-renders:

- Calls under one hour: **“4:32 left”**, **“0:09 left”**.
- Calls at or above one hour: **“1:00:00 left”**.
- Four-hour rides: always **“3:42:18 left”**, eventually **“0:00:09 left”**.
- Never display a negative duration. At expiry, replace the timer with **“Settling…”**.
- Missing expiry or unsynchronized clock: **“Time unavailable”**.
- Recalculate immediately on foreground/reconnect; do not resume a stale decrementing counter.

Use `ceil(endsAt − serverNow)` for the displayed seconds. The current `positionSub` formats a wall-clock endpoint, and the book deliberately suppresses unchanged snapshots—neither can drive the visible countdown alone. [Current words](/Users/abu/dev/hackathon/metropolis/packages/calls/src/book-words.ts:11), [book clock and updates](/Users/abu/dev/hackathon/metropolis/packages/calls/src/use-live-book.ts:209)

**Choose a ring around the mark.**

A 40pt/px ring, 2pt/px stroke, with a 32pt/px mark centered inside:

- Neutral low-contrast track; foreground arc starts at twelve o’clock and drains clockwise.
- Remaining fraction is `remaining / duration`, clamped to 0–1.
- Call duration is `call.cadenceSec`; a call entered partway through its window starts with a partially drained ring.
- Ride duration comes from its applicable lifetime terms—currently four hours.
- Linear movement between second boundaries. No pulsing, spinning, or breathing.
- Last ten seconds: thicken the remaining arc to 3pt/px and strengthen its neutral contrast. No red or magenta timer warning.
- Cash-out lock does **not** stop the ring: it still counts toward settlement.

Adapt the existing lane ring’s geometry and timing, removing its warning-color behavior for position rows. Do not add a draining bar as well. [CountdownRing](/Users/abu/dev/hackathon/metropolis/apps/web/src/features/terminal/CountdownRing.tsx:12), [ride lifetime](/Users/abu/dev/hackathon/metropolis/packages/config/src/ride-terms.ts:53)

**The trade’s own path**

Yes: show a small **recorded PnL sparkline**, rather than another BTC market chart. That makes its meaning consistent for Down, Range, and other calls.

- Read this episode’s recorded PnL samples; do not recompute historical PnL from today’s quote model.
- X is elapsed recorded time; Y is recorded PnL. Include a faint zero baseline.
- A 1.5pt/px line, no fill or glow, with a stationary 2pt/px endpoint.
- Color follows the position’s current PnL sign, independently of entry direction.
- Keep the first and latest samples; downsample to roughly one plotted point per horizontal pixel.
- Break the line across missing observations. Do not join a background gap into a fictional smooth journey.
- With fewer than two valid samples, leave the slot quiet; do not draw a fake flat history.
- Expanded replay belongs in the receipt, labeled **“Replay”**. Incomplete history says **“Partial recording”** there.

Recording begins when this device observes the priced position, which can be later than entry. Also, the current `useEpisode` returns finished episodes and append operations do not notify live subscribers. The build needs an **open-episode reader with a lightweight update signal**, while retaining the single recorder at the shell. [Replay samples and gaps](/Users/abu/dev/hackathon/metropolis/packages/calls/src/replay.ts:10), [recording](/Users/abu/dev/hackathon/metropolis/packages/calls/src/replay.ts:168), [current episode hook](/Users/abu/dev/hackathon/metropolis/packages/calls/src/use-replay.ts:31)

**Rolling PnL**

Make dollars the dominant figure. Roll only changed digits over **160ms**, toward the newest value without queuing intermediate ticks. Sign and color update immediately; never color by whether the latest tick rose.

Use the existing small-value precision consistently on both apps: four decimals below $10, two otherwise. ROI has one decimal. The close amount remains a separate quote: **never derive it from `cost + pnl` or `worth`**. [PnL/close-value contract](/Users/abu/dev/hackathon/metropolis/packages/calls/src/book.ts:39), [existing precision](/Users/abu/dev/hackathon/metropolis/apps/web/src/components/ui/odometer.tsx:20)

Hide balances replaces PnL, ROI, and close amounts with **“••••”**, including accessibility text. Suppress the monetary trace too. Keep identity and time usable.

**2. Tap, Close, Trail, and receipt**

**Tap opens the trade.** The row body is a navigation target, with accessibility label **“Open BTC position”**.

Carry symbol, instrument, lane, and `position=e.key` through D-340. Resolve that key into a durable selected position, restoring its actual call window/band or ride—not merely the current lane or newest ride.

This needs explicit attention: current call selection searches the current window; current ride selection chooses the newest ride in that symbol. A link to an older position must control that older position’s chart and actions. [D-340](/Users/abu/dev/hackathon/metropolis/docs/plan/decisions.md:646), [call selection](/Users/abu/dev/hackathon/metropolis/packages/calls/src/use-call-window.ts:31), [ride selection](/Users/abu/dev/hackathon/metropolis/apps/mobile/src/features/terminal/useRideSide.ts:38)

On arrival, show the target and ring its available close control for **six seconds**. The highlight expires; the selection persists. Navigation, search, held keys, and highlighting never execute. [Terminal-ready](/Users/abu/dev/hackathon/metropolis/packages/calls/src/terminal-ready.ts:1)

**Phone: swipe to reveal; explicit tap to execute.**

Swipe left reveals one trailing action:

- Call: **“Cash out”**, amount beneath.
- Ride: **“Close”**, amount beneath.
- Example: **“Close” / “$5.04”**.
- Minimum action width 112pt; height 44pt; magenta fill with black text, 8pt corners.

The swipe only reveals. No full-swipe execution. Require the finger to lift before the action becomes tappable; suppress row navigation after a recognized swipe. One explicit tap on that named control starts closing, using existing authorization.

Only one row stays revealed. Provide the accessibility action **“Show position actions”**. A first-session helper may say **“Swipe left for actions”** and disappear after successful use.

Long-press opens a simple menu with **“Position details”** and **“View receipt”**; it never closes money. D-340 may reveal the target’s action automatically so the ready ring is visible.

**Web: always-visible compact Close with amount.**

Use **“Cash out $5.04”** or **“Close $5.04”**, magenta with black text, 36px high and 8px corners. Keep it visible without hover. In the 22rem terminal column, place it on a lower line beside the trace; wider lists keep it trailing inline.

The navigation link and close button are sibling targets. Enter on the row opens the trade; a separately focused button closes. Consume key repeat and activation carried from search. Ordinary closing needs no additional design confirmation modal.

At activation, revalidate the latest quote, state, and position key; immediately disable repeat submission across every surface. Confirmed proceeds belong to the receipt, since execution happens at the next price. [Shared close actions](/Users/abu/dev/hackathon/metropolis/packages/calls/src/use-position-actions.ts:54)

**Trail stays in the terminal.** Keep its existing **TRAIL → Arming… → TRAILING** flow and call-versus-ride units. An armed row may carry a small trail icon with tooltip/accessibility label **“Trailing stop on”**. Do not add another row action or eligibility explanation. [Terminal direction](/Users/abu/dev/hackathon/metropolis/docs/research/replan-2026-10-10/11-terminal-direction.md:24)

**Share comes through “View receipt.”** The receipt offers **“Share”**, **“Save PNG”**, and **“Replay”**. An open receipt says **“Open”** and **“Unrealized PnL”**; it must not resemble a settled result. With balances hidden, use **“Show balances to share or save this receipt.”** [Slip direction](/Users/abu/dev/hackathon/metropolis/docs/research/replan-2026-10-10/12-slip-direction.md:47)

**3. The Unrealized header**

Keep one quiet summary at the top of the group:

- **“Unrealized PnL”**
- Rolling total, **32pt phone / 36px web**, condensed.
- Aggregate ROI at 12pt/px.
- When needed: **“1 unpriced”** / **“2 unpriced”**.

No separate nested header box, portfolio equity, margin total, or red Close-all pill. Unpriced positions remain excluded from PnL and its ROI denominator. If everything is unpriced, show **“—”** and **“No live value right now”**, never `$0.00`. [Book totals](/Users/abu/dev/hackathon/metropolis/packages/calls/src/book.ts:268)

Show a neutral text action only when at least two positions can close:

- Every position available: **“Close all (3)”**.
- Some unavailable: **“Close available (2)”**.

That action opens a small batch review with **“Close 2 positions”**, **“Estimated return $10.08”**, and, when applicable, **“1 position can’t close right now.”** Footer: **“Closes one at a time.”** Final trade control: **“Close 2 · $10.08”**.

Report partial completion accurately and leave unresolved rows present. Use explicit batch progress—**“Closing 1 of 2…”**—rather than inferring batch activity from two simultaneous closings; the existing operation is sequential. [Close-all sequencing](/Users/abu/dev/hackathon/metropolis/packages/calls/src/use-position-actions.ts:86)

Empty: remove the summary and show one unboxed **“No open positions”** row. Loading: **“Loading positions…”** with stable placeholder geometry. Pending-only trades do not create an Unrealized total.

**4. Where the facts go**

The terminal chart remains the immediate home for **Entry, B/E, KO, Cap, Line, TP, SL, and Trail**. Selecting a row selects those exact levels; tapping a level reveals its full value.

Add one terminal overflow item, **“Position details”**, opening plain key/value rows:

| Ride labels | Call labels |
|---|---|
| Entry | Entry |
| Knock-out price | Line / Range low / Range high / Strike |
| Cap price | Stake |
| Margin | Pays if right |
| Fees | Fees |
| Closes at | Settles at |

Use the full dated local timestamp here. Price labels and conditional outcomes remain accurate; monetary facts follow hide balances. The receipt retains the booked and final facts. This replaces the old expanded-row references in the terminal/slip directions. [Chart levels](/Users/abu/dev/hackathon/metropolis/docs/research/replan-2026-10-10/11-terminal-direction.md:34)

**5. State contract**

Exceptional state text may add a line; normal rows stay compact.

| State | Exact visible words | Figures and actions |
|---|---|---|
| Before signing completes | **“Signing…”** | No booked PnL or close action. |
| Opening, committed | **“Waiting for fill…”** | No invented entry/PnL. Countdown only to an authoritative supplied target. |
| Live | **“4:32 left”** / **“3:42:18 left”** | Rolling PnL, recorded trace, available close quote. |
| Closing | **“Cashing out…”** / **“Closing…”** | Freeze the last displayed figure, mute it, block duplicate actions. |
| Call locked | **“Cash out closed · settles in 0:20”** | PnL may continue; timer/ring continue; Close and Trail disabled. |
| `too-sure` | **“Cash out unavailable · settles in 4:32”** | Keep valid model PnL; no close amount. |
| Settling | **“Settling…”** | Empty ring; no close action or result stamp. |
| No price | **“No live price”** | PnL/ROI **“—”**; dim historical trace, remove live endpoint; known expiry still counts. |
| Authoritatively finished | **“Won”**, **“Lost”**, **“Refunded”**, **“Cashed out”**, **“Closed”**, **“Knocked out”**, **“Capped”**, or **“Ended”** | Realized result, static trace, opens receipt. |

Replace the current `too-sure` “pays $…” sentence: a refused cash-out quote does not establish a winning outcome. Preserve unresolved operations rather than turning them into success or failure. [Book states](/Users/abu/dev/hackathon/metropolis/packages/calls/src/book.ts:16), [current hold words](/Users/abu/dev/hackathon/metropolis/packages/calls/src/book-words.ts:30)

Keep the object’s identity through pending → open → finished. On confirmed completion, transfer it into **“Just finished”** without collapsing the list during a touch. Use a compact finished row in these lists; the full stamped slip opens on tap. Partial closing remains open.

**6. Motion and feedback**

- Digits: **160ms**, existing number-change timing.
- Countdown ring: continuous **linear** drain.
- Trace: append the newest observation with a restrained **120ms** endpoint transition; no replay of the whole line.
- Swipe: follows the finger; **180ms** settle after release.
- Fill transition: **180ms** crossfade.
- D-340: one **170ms** highlight entrance, held for six seconds; no perpetual pulse.
- Completion: **180ms** crossfade into finished state. Full receipt stamp retains its existing choreography.

Feedback pairs:

| Event | Haptic / sound cue |
|---|---|
| Open trade from row | `tick` / `tap` |
| Swipe reaches reveal threshold | `snap` / none |
| Open details or receipt sheet | `tick` / `sheetOpen` |
| Dismiss sheet | `tick` / `sheetClose` |
| Confirmed fill | `filled` / `open` |
| Confirmed close | `close` / `close` |
| Settled outcome | existing `win`, `loss`, or `refund` cue |
| Confirmed failure | `fail` / `error` |

Lifecycle/result hosts own trading cues once. Rows emit no duplicate result cue and no sound or haptic per price tick or countdown second. Keep the terminal’s profit/reaction sounds with the focused trade. [Sound names](/Users/abu/dev/hackathon/metropolis/packages/tokens/src/sound.ts:10), [haptic names](/Users/abu/dev/hackathon/metropolis/apps/mobile/src/feedback/haptics.ts:10)

**Reduce Motion:** digits replace immediately; ring steps once per second; trace updates without interpolation; transitions use a 100ms opacity fade; ready highlighting is static. Gestures remain usable. Sound/vibration retain their separate preferences. Screen readers announce meaningful state transitions, not every tick. [Motion tokens](/Users/abu/dev/hackathon/metropolis/packages/tokens/src/scale.ts:143)

**7. Placement across both apps**

| Surface | Treatment |
|---|---|
| Phone Home | One grounded Open positions group, summary + all compact rows; tap enters terminal; swipe reveals close. |
| Phone Calls | Same open group above finished history. No alternative expanded card. |
| Phone terminal positions sheet | Same rows. D-340 reveals/rings the target; tapping a row selects it and dismisses the sheet to the chart. |
| Web terminal column | Same content, 96px narrow layout, always-visible close amount. Row selection updates chart/actions without navigation reload. |
| Web Home / Calls | Wider inline layout; row opens terminal with exact position intent. |
| Web drawer | Same width-responsive rows. Selection closes the drawer and opens/selects the trade. Narrow touch web uses the phone reveal behavior. |

Share data, formatting, countdown semantics, and lifecycle state; keep platform rendering native. Extend the existing shared-list arrangement rather than create seven independently behaving cards. [Phone list](/Users/abu/dev/hackathon/metropolis/apps/mobile/src/features/positions/PositionsList.tsx:94), [web panel](/Users/abu/dev/hackathon/metropolis/apps/web/src/features/positions/PositionsPanel.tsx:78), [phone sheet](/Users/abu/dev/hackathon/metropolis/apps/mobile/src/features/positions/PositionsSheet.tsx:12)

For 21st.dev, try exactly **“Animated Number”** and **“Sparkline”**. Relevant bases exist: [Motion Primitives’ Animated Number](https://mcp.21st.dev/%40ibelick/components/animated-number) and [Appica’s Sparkline](https://mcp.21st.dev/%40appica-dev/components/sparkline). Use their primitive behavior for web and adapt the motion to RN; strip demo cards, decorative blur, gradients, and count-from-zero entrances.

Acceptance should include a stationary-price countdown, foreground after a recording gap, two BTC positions selecting independently, lockout while Close is revealed, hidden balances, and Reduce Motion. No files were edited.


