# The terminal for calls and rides: Codex direction (12 Oct 2026, R5-B)

Asked of the Codex CLI (gpt-6.1-sol, xhigh, read-only) per the project rule for design direction. Prompt: Call | Ride, the floating order stack and its sheet, the TRAIL / CLOSE morph for both instruments, chart levels, unavailable windows (R5.25), what to delete. Reference reading: `01-tradash.md` §1.2/1.5/1.6/§3, `07-ride-the-price.md` §2.2/2.6, D-299…D-320, the current terminals and Owarine's port sources. Answer verbatim below; R5-B builds it.

1. **Instrument and layout**
   - **Web ≥1024:** keep the 22rem rail: Unrealized → scrollable positions → pinned action group. Put a **“Call | Ride”** switch at the top of that action group.
   - **Web <1024 and phone:** chart → chart footer → **“View position” / “View N positions”** pill → the same switch → action buttons. Pin actions above the dock/safe area; let the chart absorb available height.
   - Call kinds live **inside order settings**, under **“Call type”**: **“Up/Down”**, **“Range”**, **“Moonshot/Crash”**. Show the current kind in the floating stack’s heading. No second segmented control outside the sheet.
   - Keep **1m / 5m / 15m / 1h** lanes beneath the market header in Call. Hide them in Ride; a held ride shows **“Closes in 3:42:18”** there.
   - Unsupported market: select Call; retain a muted, informational Ride segment. Tapping it explains **“Rides aren’t available on TSLA”**, with **“View ride markets”**.
   - Phone Real + Ride: show **“Rides are Practice-only on phone”** and **“Switch to Practice”**. Switching requires that tap; never change networks automatically.
   - Use [D-304/D-316](/Users/abu/dev/hackathon/metropolis/docs/plan/decisions.md:495): off-white canvas, white surfaces, condensed money/type; acid-green UP, coral DOWN, cyan RANGE, black labels. Magenta marks selected controls.

2. **Floating stack and settings**
   - On **all three layouts**, attach one settings button flush to the chart’s left edge, vertically centred. **160px/pt wide; four 28px/pt rows; 8px padding; 14px glyphs; 11px tabular values; 16px right corners.** Draggable vertically within the chart. Use Senryo’s light glass surface.
   - **Call rows:** Coins → **“$5.00”** *(Stake)*; Gauge → **“↑2.14× ↓1.86×”** *(Pays)*; BadgePercent → **“$0.18–0.20 incl.”** *(Fees)*; Crosshair → **“5¢ trail · Off”** *(Exit)*. Range has one payout; held calls show their fixed payout and **“$0.14 to close”**.
   - **Ride rows:** Coins → **“$5.00”** *(Margin)*; Gauge → **“40×”** *(Leverage)*; BadgePercent → **“$0.20 open”** *(Fees)*; TrendingDown → **“0.10% · Off”** *(Trail)*. Armed rows replace **“Off”** with **“Armed”**.
   - Tap opens **“BTC · Call settings”** or **“BTC · Ride settings”**. Use bottom sheets on web too: centred, maximum 28rem wide. Phone uses the root sheet host and 62%/88%/full detents; dock hides.
   - **Sizing:** move every stake chip into this sheet. Call: **$1 / $5 / $10 / $25 / Max**. Ride: **$5 / $10 / $25 / $50 / Max**, omitting amounts above the configured cap. Include decimal keypad/input, balance slider, **“Available $Y”**, **“N% of available”**, **“Remember last amount”**. Default $5; remember separately by instrument/network. Max accounts for fees and limits.
   - **Call:** kind selector; each side’s **“Pays 2.14× · $10.70”** and expiry condition. Up/Down copy: **“Up wins above $K at 20:00; Down wins below. Exactly on the line refunds.”** Range names inclusive edges; Moonshot/Crash name strict strikes. Trail presets **5¢ / 10¢ / 20¢**, custom **1–50¢**, caption **“Behind the best bid per share”**. Summary: **“Stake”**, **“Pays if right”**, **“Fees included”**, **“Settles at”**, **“After this”**.
   - **Ride:** leverage chips **2× / 5× / 10× / 20× / 40×**, filtered by market/network cap; append a missing cap such as **25×**. Default 10× or the lower cap. Show both sides’ risk, e.g. **“UP · Knocked out at $80,431 (−2.2%)”** and **“90% of margin lost”**. Trail presets **0.10% / 0.50% / 1.00% / 2.00%**, custom percentage input. Summary: **“Trade size”**, **“Margin at risk”**, **“Opening fee”**, **“Estimated closing fee”**, **“Early-close fee”**, **“Max profit”**, **“Cap price”**, **“Closes after 4h”**, **“After this”**. No funding/hold-fee row.
   - Preferences save with **“Done”**; setting an actual exit requires **“Set exit” / “Update exit”**. Filled position sizing/kind/leverage are read-only. Show **“After this: $Y”** above entry buttons; shortfall opens **“Add money”** or **“Get test dollars”**, prefilled with the gap.

3. **Morph and close**
   - Use two equal **64px/pt** action slots with a 12px gap. Entry: **UP / DOWN**; Call Range uses one full-width **RANGE**; Moonshot uses **MOONSHOT / CRASH**. Keep call payout captions beneath them.
   - On fill, crossfade out/in over **180ms**, translating 12px; morph to **TRAIL / CLOSE**. Reduced motion uses opacity only. The selected position controls the morph; selecting a book row restores its market, instrument, lane and kind.
   - **Ride TRAIL:** eligibility uses fee-inclusive executable B/E and the selected price distance, **not leveraged ROI**. Disabled caption shows the remaining favourable move: **“Need +0.08% to trail”**. Eligible caption: **“0.10% behind price”**.
   - **Call TRAIL:** yes—arm its bid-cents trail. Default 5¢; qualify only when current bid exceeds executable B/E bid by that distance. Caption: **“Need +3¢ bid to trail”**; eligible: **“5¢ behind best bid”**. Never use a price-percentage caption for calls.
   - One tap arms, preserves existing TP/SL, and uses B/E as the minimum floor. Show **“Arming…”**, then **“TRAILING”** with **“Stop 62¢ · runs with app closed”** for calls or **“Stop $82,140 · runs with app closed”** for rides. Tapping TRAILING opens its editor.
   - **CLOSE always contains the exact net current receivable quote**, rolling on its second line: **“CLOSE” / “$11.26”**. PnL stays on the chart/position surfaces. An unavailable quote shows **“—”** and disables close.
   - Hold CLOSE **450ms** → **“Close part”**, with **25% / 50% / 75%**, custom percentage and proceeds preview. Hold TRAIL → full **“Exit”** sheet; the stack’s Exit/Trail row and expanded position’s **“Exits” / “Reduce”** provide visible alternatives. Holding must suppress the release tap.
   - Exit units: calls use bid cents with dollar equivalents; rides use price-change percentages with dollar-price equivalents. Include TP, SL, trail, floor and **“Remove exit”**. Web **↑ / ↓ / C** obey D-308: Real requires one-tap on.

4. **Chart levels**
   - **Both:** pending **“Opening…”** entry at tap; confirmed **“Entry $X”** after fill; fee-inclusive **“B/E $X”**; armed **“TP”**, **“SL”**, **“Trail”**.
   - **Ride only:** fixed **“KO $X”** and **“Cap $X”** from the fill. Use “Knocked out” in explanatory copy; omit “Liq”.
   - **Call only:** **“Line $K”** always; **“Range low / Range high”** or **“Moonshot strike / Crash strike”** when relevant. No KO or linear cap.
   - Entry `[4,4]`; B/E amber `[1,3]`; TP/SL `[5,3]`; Trail **1.5px `[6,3]`**; KO coral `[2,3]`; cap cyan `[5,3]`; Line K neutral `[2,3]`.
   - Convert call B/E and exit bids into current spot levels through the quote function. Range draws both valid roots; no root means no fabricated line. Retain its exact bid threshold in settings.
   - Fill the area between the held position’s price path and entry with **22% → 2%** opacity. Line, head, pill and band follow **PnL sign**: loss immediately uses the loss colour. Stack off-screen level labels at chart edges.

5. **Unavailable windows and closed markets**
   - [R5.25](/Users/abu/dev/hackathon/metropolis/docs/plan/replan-r5-live-loop.md:85): unopened on chain after its admission period → selected lane reads **“Next 20:00”**; directly above disabled call buttons: **“No calls in this window · the next opens at 20:00”**. Other lanes and Ride remain selectable.
   - Ordinary last-20-second lockout: **“Calls closed · next opens in 0:20”**. Held call: **“Cash out closed · settles in 0:20”**; disable Trail/Close without implying settlement has completed.
   - Closed market: header badge **“Closed”**; chart badge **“Last session”**; above actions **“TSLA is closed · Opens Mon 09:30 ET”** and **“Showing the last session”**. Keep archived chart and positions visible; enable a held position’s close only when executable.
   - Real before S9 uses its distinct gate: **“Trading opens with mainnet”**, with **“Switch to Practice to play”**. Do not label it market closure.

6. **Delete from the current panel**
   - Inline call-kind segmented control, stake-chip row, standalone partial/crosshair buttons, and the long armed-exit sentence.
   - Replace the full one-tap line with a compact **“One-tap on / One-tap off”** control beside Call/Ride.
   - Move crowd, distance-to-line prose and basket details into market information. Keep payout captions, exact close amount and one contextual blocking sentence.


