# 18 · Replay and receipt actions, second pass (Codex direction, 13 Oct 2026)

Asked after the owner's second review of the first exported MP4 and the receipt's action stack (see
`docs/plan/decisions.md` D-352). Codex `gpt-6.1-sol`, xhigh, read-only, with four images: the receipt, the replay sheet,
the MP4's last frame and Fomo's last frame. Kept verbatim below; where the build differs, the deviations are listed at
the end.

Make **Replay the primary action**, keep the receipt intact, and give the film a magenta frame around a dark trading surface. This replaces direction 17’s action stack, header stamp and cue-only soundtrack. Nothing was written.

**A. Receipt actions**

Keep the receipt card exactly as shown. Add one action row **24 pt below it**, aligned to its width:

| Order | Icon | Label | Behaviour |
|---|---|---|---|
| 1 | Play triangle | Replay | Opens replay sheet/modal |
| 2 | Authentic X mark | Post | Opens existing text-and-link composer |
| 3 | Share | Share | Shares receipt PNG |
| 4 | Download | Save | Saves receipt PNG |

Use existing [ActionCircle](/Users/abu/dev/hackathon/metropolis/apps/mobile/src/components/kit/ActionCircle.tsx), already adapted from [21st’s Grid Button](https://21st.dev/@radiumcoders/components/grid-button): **56 pt/px discs, 24 icons, 8 label gap, 12/16 labels, 8 minimum slot gap**. Replay gets magenta fill and black icon; others use themed raised surfaces. No borders.

Fetch and pin the SVG through the asset script from [X’s official toolkit](https://about.x.com/en/who-we-are/brand-toolkit). Label it **Post**, with accessible name “Post on X”.

Delete the segmented control, all three full-width buttons, and every “Video” entry label. **Remove PnL/ROI/Both entirely:** exports always show PnL with smaller ROI. No inline poster; it would repeat the result and lengthen this screen. Live receipts retain their terminal entry.

**B. Replay sheet / web modal**

Title **Replay**, 20/24 semibold; close icon in a 44-square target. Theme follows the app.

Phone sheet height: **90% of safe viewport height**. Padding 16. Reserve **288 pt** for heading, controls, gaps and bottom safe area. Preview height:

`min((available width × 1.25), sheet height − 288)`

Preview width is height × 0.8, centred. Show the entire 4:5 film, including footer. Large text permits scrolling.

Web modal: **560 px maximum width**, viewport minus 48; preview maximum height **480 px**, further constrained by viewport height minus 328. Same composition.

Below preview, with 12 gaps:

- **48-high transport row:** transparent 44-square Play/Pause, flexible scrubber, 12/16 elapsed/total clock. Rail 2 thick; thumb 12; interaction height 44.
- **44-high sound row:** “Sound in replay” and existing kit Switch. Starts on; preview remains silent until Play.
- **32-high status slot:** actual progress as a 2-high rail, concise text, and transparent Cancel target.
- **80-high horizontal action row:** Share and Save ActionCircles. Share gets the magenta disc. Both disabled until ready.

Open paused on the final frame. Play starts from the beginning; seeking pauses and produces no cues. Retain web keyboard transport.

Exact state copy:

| State | Words/action |
|---|---|
| Preparing | “Preparing replay” |
| Making | “Making replay · 62%” / Cancel |
| Ready | “Ready” / Share / Save |
| Missing history | “Replay unavailable” |
| Unsupported encoder | “Can’t save replay here” |
| Failed | “Couldn’t make replay” / Retry |
| Hidden balances | “Balances hidden” / Show balances |
| Cancelled encoding | “Cancelled” / Make replay |
| Saved | “Saved to Photos” on phone; “Downloaded” on web |

Cancel leaves playback available. Hiding balances masks sensitive values, neutralises result colouring, stops sound, cancels encoding and discards ready files. Native sharing cancellation returns quietly to Ready.

**C. MP4 frame v2 — 1080 × 1350**

Use **#FA00FF for the 12-pixel outer ground and bottom band**; card **#111111**. Positive **#B5F543**, negative **#FF647C**, primary ink **#F5F5F5**, secondary **#B8B8B8**. Shared artwork keeps this single appearance.

All coordinates below are **text-box tops**, not font baselines. Inter for text; Roboto Condensed Black for PnL.

| Region | Exact geometry |
|---|---|
| Card | x12, y12, 1056×1154; radius 60; no stroke |
| Portrait | x48, y48, 144×144; authored avatar, circular |
| Handle | x228, y60, 440×64; 52/64, minimum 38 |
| Date | x736, y60, 296×42; 32/42, right aligned |
| Practice | x736, y132, 296×36; 28/36, right aligned |
| Provenance, when needed | x228, y132, 480×36; 24/36 |
| Upper level rail | x48, y216, 776×32 |
| Plot | x48, y264, 776×336 |
| Lower level rail | x48, y612, 776×32 |
| Time ticks | y656–692; maximum three, 28/36 |
| Panel separator | x48–1032, y728; 1-pixel rule |
| Centred market row | x48, y756, 984×60 |
| Figure label | x48, y852, 984×32; centred, 28/32 |
| PnL + ROI group | x48, y892, 984×116; centred together |
| Three stats | centres x212, x540, x868; labels y1030, values y1080 |
| Brand lockup | **x48, y1214, 325×88**; existing SVG |
| Footer copy | x440, width424; first line y1208, second y1250 |
| QR | **x888, y1188, 144×144**, including quiet zone |

Delete the header outcome badge/stamp entirely. Keep the seal only in the footer.

Chart stroke **8**, head diameter **20**, pinned at **x594**. Price plate x848, **184×56**, 32/40 type; clamp top to 264–544. At most three y labels, 28/36, right aligned to x1032; suppress any within 48 pixels of the plate.

Rides retain an **unlabelled entry rule**, KO and Cap. Put level text in the rails, never over the path: two **360-pixel slots**, x48 and x464. Off-range levels receive ↑/↓; never expand the chart to include distant risk levels. Calls retain Line and actual winning-zone geometry; range boundaries use numeric prices. Leaders connect rail labels to visible levels.

Moments use **48-pixel discs with I/O glyphs at 26 px**. A single opaque, borderless **200×96 tooltip** occupies the empty future at x632; its top clamps to 264–504. Title 24/30; booked amount 30/38. OPEN collapses into I after 1.2 seconds; exit tooltip and O remain through the hold.

Ride exit words: CLOSE, TRAIL, STOP, TAKE PROFIT, KO, CAP, END, REFUND. Calls: CASH OUT, SETTLED, REFUND. Remove “Manual · timestamp” captions.

Centre the authentic **60-square market mark**, name 46/56 and compact identity 28/36: “↑ 10×” or “↑ 1m”. PnL **104/116**, ROI **46/58**, gap24; shrink PnL to80 before compact formatting. No triangle or parentheses. Stats: Margin/Stake, Entry, Exit/Close; 30/38 labels, 40/48 values. Exit stays “—” until exit.

**Complete text inventory:** handle or “Guest”; date; “Practice”; conditional “Partial recording · {n}%” or “Rebuilt · 1-minute prices”; KO, Cap, Line and numeric boundaries; formatted price/time ticks; I/O; moment words above and booked amounts; market name; direction/multiple/cadence; Open PnL, Estimated PnL or Realised; signed PnL/ROI; Margin/Stake, Entry, Exit/Close and values; “—”; SVG SENRYO/千; “Play with code” + “@handle” once referral capture works, otherwise “Play at” + “senryo.xyz”.

**D. Soundtrack**

Total **6–12 seconds: 4–10 seconds running, then two seconds held**. Keep 0.6-second lead-in and 0.4-second result landing.

Feed `ReactionEngine` the original samples in **market time**, then map events through `filmTimeAt`. Never accelerate cue pitch or music tempo.

Use **arcade**, the terminal default, starting on its first bar. Preserve token gains. Profit ladder uses actual combo steps 0–10; adverse starts on the second adverse step. Coalesce cues into **160 ms film-time buckets**; strongest cue wins. Surge/mega/slump minimum spacing **800 ms**; they replace nearby steps. No queued catch-up sounds.

At ROI ≤−5%, filter the music to **900 Hz**, entering over **300 ms**, recovering over **250 ms**. Unknown ROI causes no tension.

Close at authoritative exit; verdict **240 ms later**. Duck music **6 dB over80 ms**, recover over400 ms. Fade the complete soundtrack to silence across the final **two-second hold**.

Connect this mix to both exporters and preview playback; the current exporters render cues without the music bed.



## Deviations in the build (and why)

- **Level text.** Off-range and in-range KO / Cap are short coloured tags in the price column at the right ("↑ Cap",
  "↓ KO", or "KO" at the level's height), never in rails with leaders over the plot: the column already holds the
  price labels, so a tag there can't meet the path or the tooltip, and the y labels near a tag are suppressed. Calls
  draw the line and the winning zone without numeric boundary labels.
- **Disc glyphs.** IN is a drawn ▲ / ▼ in the side's colour, OUT a drawn ■ in the result's colour: shapes rather than
  font letters, and they say the side and "stopped" without a word.
- **The X mark** is Simple Icons' `x` (CC0, pinned by version and sha256) through `packages/identity`'s fetch
  pipeline — the same glyph as X's toolkit, acquired by script with provenance, which the toolkit's zip doesn't allow.
- **The figure label** ("Realised" / "Open PnL") is left out, as in Fomo's card: the "—" under Exit says a film is
  still open.
- **No music.** §D's Arcade bed, tense filter, duck and fade were built, then removed the same day at the owner's
  word ("the sounds once you go up and down… not the sound as in music"). The soundtrack is the reaction cues, close
  and the verdict.
- **Sound in the transport.** "Sound in replay" is a speaker toggle in the transport row, not its own row, so the
  whole frame, the status line and the actions fit the 90 % sheet.

