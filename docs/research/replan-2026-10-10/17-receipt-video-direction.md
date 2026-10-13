# 17 · The receipt and the replay video (Codex direction, 13 Oct 2026)

Asked of Codex (gpt-6.1-sol, xhigh, read-only) after the owner's review of the receipt (dark mode, filler rows) and the replay ("you should be able to download that video"; Fomo's branded card). Kept verbatim; decisions D-349…D-351; built in Q3 (`docs/plan/replan-q-quiet.md`). Where this direction lists receipt facts the owner rejected, D-351 wins.

Use **themed paper in the app, the existing light receipt with QR for PNG, and a fixed branded 4:5 card for MP4**. The video finishes on the chart and realised result.

I inspected all 17 Fomo frames and the supplied source files. Nothing was written. This spec follows [D-349–351](/Users/abu/dev/hackathon/metropolis/docs/plan/decisions.md:682) and [Q3](/Users/abu/dev/hackathon/metropolis/docs/plan/replan-q-quiet.md:60); it replaces research 14’s earlier slip-ending proposal.

**1. In-app receipt**

All dimensions here are CSS px on web and logical points on phone. Paper width is `min(360, viewport − 40)`, centred, with 20 padding, radius 12, and the existing receipt shadow.

| Material | Light | Dark |
|---|---|---|
| Surrounding ground | `#F5F5F5` | `#111111` |
| Paper | `#FFFFFF` | `#1C1C1C` |
| Main ink | `#000000` | `#F5F5F5` |
| Secondary ink | Existing receipt `#5C5C5C` | `#B8B8B8` |
| Perforation/rules | Existing receipt `#C8C8C8` | `#414141` |
| Positive figure/line | `#2F7A00` | `#B5F543` |
| Negative figure/line | `#C8283F` | `#FF647C` |
| Range geometry | `#00727E` | `#3FE0F0` |

The dark values are already defined in [RECEIPT_DARK](/Users/abu/dev/hackathon/metropolis/packages/tokens/src/marks.ts:51). Kinpaku stamp materials remain identical in both themes.

Top to bottom, at 360 width:

| Element | Exact composition |
|---|---|
| Header, y20–44 | Actual Senryo seal, 24 square at x20; outlined wordmark, 96×21 at x56. Folio right-aligned to x340, Inter 11/16. |
| Market, y60–92 | Authentic market mark, 28 square at x20; title at x60, Inter 17/22 semibold: `BTC · Up · 1m` or `BTC · Down · Ride`. |
| Figure, y108–208 | Label Inter 12/16. Amount Roboto Condensed Black 52/56, tabular figures; shrink to 40 only when necessary. Finished timestamp below, Inter 12/16. One 88-square stamp at the right. |
| Replay, y224–424 | A **200-high chart viewport**, using the film’s timeline and chart drawing. No extra replay heading or second PnL at rest. |
| Pins, y432–472 | **40-high horizontal event strip**: IN, partial exits, OUT, line print and close print. Small ticks and short names; no vertical transaction narrative. Touch targets extend to 44. |
| Facts, from y488 | Label left, value right. Inter 13/20; 8 between rows. Maximum three rows. |
| Perforation | 16 high, positioned 16 below the last fact. Existing side notches cut in the surrounding ground’s colour. |
| Stub | 44-high row: mode on the left, **`Proof ›`** on the right; 20 bottom padding. No in-app QR. |

Three facts give a paper height of 660; two give 632; one gives 604. Enlarged text increases height naturally.

Use these fact budgets:

| State | Figure | Facts |
|---|---|---|
| Finished call | **Realised** | **Stake**, **Held** |
| Finished ride | **Realised** | **Margin**, **Leverage**, **Fees** |
| Live call | **Unrealized PnL** | **Stake** |
| Live ride | **Unrealized PnL** | **Margin**, **Leverage**, **Fees** |

`Margin` means original booked margin. `Fees` means fees already charged, excluding an estimated future close fee. `Held` is fill → effective exit, excluding indexing or settlement-processing delay. Unknown values show `—`.

Keep the paper hero authoritative while replaying a finished trade. Historical PnL appears only in the active scrub readout. A live receipt shows the current live-book valuation. Before fill, use **Signing…** or **Waiting for fill…** in the figure slot; no result or stamp. A partial close remains live.

Move these onto the chart and pins:

- Call: entry, exit, K/line, selected winning band and its boundaries.
- Ride: entry, exit, KO, Cap; timestamped partial exits and actual standing-exit changes.
- Exit reason belongs to the OUT pin: Manual, Trail, Stop, Take profit, Settled, KO or Cap.

Each pin opens its timestamp, exact booked price/value, provenance and transaction. **Proof ›** opens the consolidated evidence view. Preserve **“Archived; not posted on chain”** where applicable.

Use one Kinpaku stamp: 88 square, −4°, existing 3-wide foil frame, lacquer field and fine inner rule. Words:

- Calls: **Won / Lost / Cashed out / Refunded**.
- Rides: **Closed / Knocked out / Capped / Ended / Refunded**.

Remove the extra Gain/Loss or Up/Down line; the figure already communicates the sign. Press once on a newly observed authoritative completion: `1.12 → 0.98 → 1`, y `−8 → 0`, 220ms. History opens static. Reduce Motion uses a 100ms fade.

Outside the paper, 16 below it: **Share image · Save image · Video**, 48-high controls. Live receipts also have **Watch live**. The PNG retains its existing light paper, static stamp and QR to the trade page; the new chart stage does not get baked into that image.

**2. MP4 frame: 1080×1350**

Choose **`DARK.background #111111` for the full ground and brand band**, and **`DARK.card #1C1C1C` for the main card**. These are Senryo’s neutral brand surfaces. The gold seal supplies brand recognition; acid green and coral remain financial signals. Magenta stays with interactive controls.

Preserve Fomo’s fixed header, scrolling chart, fixed token panel and persistent footer. Remove its interior bordered panel and tooltip boxes.

Coordinates below are `(x, y, width, height)`.

| Element | Geometry and treatment |
|---|---|
| Ground | `(0,0,1080,1350)`, `#111111`. |
| Main card | `(12,12,1056,1154)`, radius 60, `#1C1C1C`; no stroke or shadow. |
| Trader portrait | `(48,48,144,144)`, circular crop of the selected authored portrait. |
| Handle | `(228,52,500,64)`, Inter semibold 52/64, `#F5F5F5`. Shrink to 38, then ellipsise in the header only. |
| Date | Right-aligned to x1032 at y60, Inter 34/42, `#B8B8B8`; `13 Oct 2026`, from the fill date. |
| Outcome stamp | `(228,124,104,104)`, same Kinpaku object and verdict as the receipt; −4°, words 24/26. Present from frame zero. |
| Mode | Right-aligned to x1032 at y132, Inter 28/36: `Practice · test dollars` or `Real · USDC`. |
| Chart region | `(36,244,1008,464)`. Detailed geometry below. |
| Token panel | `(48,728,984,408)`, same card ground. One horizontal hairline at y728; no inner card, border or rounded box. |
| Brand band | y1166–1350; ground remains `#111111`. |
| Brand lockup | Existing `brand/senryo-lockup.svg`, `(48,1214,325,88)`. Use its outlined seal and wordmark unchanged. |
| Referral text | x440, y1200, width 384: `Play with code`, Inter 30/40; `@handle` below at y1244, 42/52 semibold. Shrink the handle to 28 to fit; never truncate a code. |
| QR | `(888,1188,144,144)`, square black-on-white, four-module quiet zone, error correction M. Static throughout. |

For a guest without a handle, use **the existing address-stable authored avatar**, through `defaultAvatar`, and label the header **Guest**. Do not substitute initials, a fabricated photograph or another brand seal. The footer reads **Play on Senryo**; omit the referral parameter.

The QR opens the existing call or ride URL, including `chainId`. For a valid handle append `&r=handle`, without `@`. Referral capture must actually be connected before shipping that footer.

Chart:

- Plot bounds: **x48–824, y264–632**.
- Head pinned at **x594** throughout the run. History scrolls left; no unreplayed price line appears to its right.
- Main price stroke: **6px**, rounded ends. Head: **10px radius**. One 24px glow stroke at 14% opacity.
- Dot grid: 48px spacing, 1.5px radius, foreground at 6% opacity.
- Current-price rule: x48–824, 2px stroke, `12 on / 12 off`, tone at 40% opacity.
- Price pill: **184×56**, x848, centred on the head’s y; clamp its top to 264–576. Radius **10**, black ink, Inter bold **32/40**. If clamped, connect it to the true price level with a short leader.
- Pill displays the underlying market price, using the market’s correct unit and precision. No “MC” suffix for assets that are not market-cap instruments.
- Up to three y labels, right-aligned to x1032, Inter 28/36. Suppress labels within 40px of the pill or another level label.
- Three time ticks maximum, Inter 28/36, along y648. They show source-market time.

**The price pill is the sole annotation plate.** D-350 explicitly requests it, and it identifies the moving current price. IN/OUT, K, band edges, KO and Cap use plain text and leaders.

For calls:

- K is a neutral 2px dashed horizontal rule, labelled **Line**.
- Draw the selected winning zone at 7% opacity: acid green above K for Up; coral below K for Down; cyan between the actual Range bounds.
- Moonshot/Crash use their actual catalogue boundaries. Preserve inclusivity rules from the shared band model.
- The zone’s colour describes the selected call. The moving price line’s colour describes PnL.

For rides:

- Entry is neutral dashed ink.
- KO is coral, 2px solid; Cap acid green, 2px dashed.
- Labels are plain **KO** and **Cap** with the price.
- A distant level stays visible as a top/bottom edge label with ↑/↓; it must not flatten the price chart to fit.
- Down rides preserve their actual profitable and adverse sides.

IN/OUT markers:

- A 24px vertical notch attached to the booked price, with a 2px leader.
- **IN / OUT**, Roboto Condensed Black 30/36; caption Inter 26/32.
- IN caption: the fill time. OUT caption: reason and time, for example **Trail · 14:06:11**.
- Place the caption above a lower-half point and below an upper-half point; clamp inside the chart, maximum width 280.
- Fade in over 120ms. IN’s caption lasts 1.2s, then leaves its notch and IN label. OUT’s caption remains through the final hold.
- Partial exits use **OUT 25%**, with the actual fraction. Settlement is **OUT · Settled**; it is not presented as a sell.
- No autogenerated reaction sentences or invented trader notes.

Token panel:

| Element | Geometry/type |
|---|---|
| Authentic market mark | `(48,756,72,72)`; resolve through the identity registry. |
| Market name | x140, y756, Inter semibold 44/52. |
| Trade identity | x140, y816, Inter 30/38: `Up · 1m` or `Down · Ride · 5×`. |
| Figure label | x48, y864, Inter 28/32: **Open PnL**, **Estimated PnL**, or **Realised** according to provenance/phase. |
| PnL | `(48,896,660,124)`, Roboto Condensed Black **112/124**, −0.02em, tabular figures. Shrink to 88 if needed. |
| ROI | `(740,930,292,58)`, Inter semibold **46/58**, signed percentage, one decimal. No parentheses or extra triangle. |
| Three stats | Columns start x48, x376, x704. Labels y1040, Inter 30/38; values y1084, semibold 40/48. No enclosing cells. |

The three stats are:

| Film | Stats |
|---|---|
| Call | **Stake · Entry · Exit** |
| Ride | **Margin · Entry · Exit** |

For a settled call, the third label becomes **Close**. Before exit, its value remains `—`; do not reveal the final price early. Entry/exit prices live in these stats, so event captions carry time/reason rather than repeating the values.

ROI uses the existing share denominator: call stake; ride **original margin + open fee**. Freeze that denominator for the whole film. An unknown denominator gives `—`.

Use the vendored Roboto Condensed Black and Inter faces in both renderers. The brand wordmark remains its existing outlined SVG. Do not retype it in the display face.

**3. Motion and sound**

Keep the shell, portrait, token panel and footer fixed from frame zero. No title card.

Let `L` be the source interval in seconds and:

`R = clamp(L, 6, 12)`

Total duration is **R + 2 seconds**, therefore 8–14 seconds at 30fps.

| Film time | Behaviour |
|---|---|
| 0–0.6s | Short market context before IN, in neutral ink. Use available historical prices; unavailable context remains empty. |
| 0.6s | IN appears; entry and stake/margin become booked values. |
| 0.6s–R−0.4s | Fill → exit maps linearly into this interval. All events use that same mapping. |
| R−0.4s–R | Price stops at the authoritative exit. PnL rolls onto the authoritative realised result and settles. |
| R–R+2s | Entire last frame held still. It is also the poster. |

No slow-motion drawdown or peak beats. Captions get their own short visibility period without changing the chart’s time mapping.

The head interpolates between known adjacent price samples without overshooting them. Numbers acquire new targets at most every 100ms of film time, except fills/exits. Digits roll over 80ms using ease-out; punctuation stays fixed. On a seek, numbers snap directly to the requested frame.

Tone changes on the first frame whose displayed PnL crosses zero:

- Positive: `#B5F543`.
- Negative: `#FF647C`.
- Zero, unavailable, or before IN: neutral.

Line, head, rule, pill and PnL change together. No colour tween, bounce or additional flash. The final outcome stamp retains the known outcome throughout.

Precompute y-range motion at 30fps so seeking and export reproduce it exactly: 18% padding, expansion coefficient 0.35, contraction 0.06. Axis labels crossfade over 120ms when their tick set changes.

**The MP4 stamp does not press.** It is already present in the header. The ending is the OUT marker, the landed result and the two-second hold. The paper receipt alone gets the completion press.

Use existing cues only:

| Moment | Cue |
|---|---|
| IN | `open` |
| First crossing of +10%, +25%, +50%, +100% ROI | `profit`, ascending ladder steps; each threshold once, minimum 400ms spacing |
| First crossing below −10% | `adverse`, once |
| OUT | `close` |
| 240ms after OUT | `win`, `loss` or `refund`, from the authoritative net result |

Use existing cue gain tokens. No new clap, music bed, narration or card slam. Scrubbing produces no trade cues; resuming does not replay previously passed cues.

**4. Player and export on both apps**

The receipt’s 200-high stage is the chart projection of this film. **Video** opens the complete 4:5 card: a web dialog or native sheet. Both share one timeline and frame model; the full card is never squeezed into the 200-high receipt stage.

Receipt controls:

- Transparent 44-square Play/Pause control over the stage’s lower-right corner.
- Bottom scrub rail: 2px line, 12px thumb, 44-high interaction area.
- Finished receipt opens paused at the final frame. Play starts from the beginning.
- Tapping a pin pauses and seeks to that event.
- Web: Space toggles playback; arrows seek 0.1s; Home/End seek endpoints.
- Phone: horizontal scrub gesture; vertical movement remains receipt scrolling.
- No speed selector, autoplay loop or fast-forward gesture.

Full-card preview fits available width and height without cropping. Beneath it: Play/Pause, scrub, **Sound in video**, then **Save video / Share video**, each 48 high.

Opening Video freezes the source snapshot and starts encoding. Show **Making video 62%** with Cancel. Enable Save/Share when the file is ready, so the user’s tap can invoke the browser’s share sheet with a fresh activation.

- **Web:** Save video downloads the MP4. Share video uses file sharing where supported; otherwise download it and copy the trade link.
- **Phone:** Save video writes to Photos through `expo-media-library`, requesting add-only access on that tap. Share video uses `expo-sharing` with `video/mp4` and `public.mpeg-4`. A Photos denial leaves Share video available.
- A live film is a frozen **Live · time** snapshot: no OUT and no outcome stamp.
- Before fill, or without usable price history: **Replay unavailable**; image actions remain available.

Encode **1080×1350, 30fps, H.264 at approximately 6Mbps, AAC at 128kbps**. Render deterministic frames at `t=i/30`; never record the screen or UI animation loop.

Web uses Mediabunny’s canvas source and MP4 output, with capability checks for the exact dimensions/codecs. Its current API supports that pipeline. [Mediabunny writing guide](https://mediabunny.dev/guide/writing-media-files), [capability check](https://mediabunny.dev/api/canEncodeVideo).

Phone uses the same imperative Skia drawing function for preview/export through `exportVideoComposition`. A generated soundtrack supplies audio items; the library documents compositions with drawn frames and audio without video-source items. This still needs Senryo’s device acceptance in a new binary. [Native encoder documentation](https://github.com/AzzappApp/react-native-skia-video), [drawn-frame example](https://azzappapp.github.io/react-native-skia-video/docs/example).

Do not silently substitute WebM for Save video. An unsupported encoder gets **Video unavailable here**, with the image action still available.

Privacy:

- Hidden balances mask PnL, ROI, stake, margin, fees and monetary accessibility text.
- Remove PnL-derived colouring; the public price path becomes neutral.
- Block every image/video export, including ROI mode.
- Recheck privacy immediately before handing out the file. Hiding balances during encoding cancels it and discards the cached output.
- Existing PnL/ROI/Both export modes remain. ROI mode hides owned dollar amounts throughout the film.

Reduce Motion opens still, disables digit rolling, grid drift, glow pulses and stamp scaling. Explicit Play remains available for the time-based chart. Export uses the specified film motion; the OS setting does not silently alter the posted artifact.

Provenance is visible in the stage and burned into the MP4 at x48, y700, Inter 24/28:

- **Partial recording · 84% recorded**
- **Rebuilt · 1-minute prices**

Recorded portions retain recorded PnL. Back-filled portions use a distinct dashed path. Rebuild from minute open/close anchors and authoritative prints; never invent the order in which a candle’s high and low occurred. Recomputed call valuations say **Estimated PnL**. Missing valuation remains `—`. The final realised result always comes from the trade record.

**5. Current code blockers**

Concurrent edits arrived during this review. The inspected source now includes the theme fix and `film.ts`/`film-frame.ts`; those are useful foundations. These are the remaining source-level gaps, rather than runtime acceptance claims.

| Blocker | Evidence and required change |
|---|---|
| Live fallback still uses banned copy; prices remain receipt facts | [trade-slip.ts:95](/Users/abu/dev/hackathon/metropolis/packages/calls/src/trade-slip.ts:95) retains “Pays if right”; [receipt.ts:70](/Users/abu/dev/hackathon/metropolis/packages/calls/src/receipt.ts:70) retains Wins if/Entry; [trade-slip.ts:135](/Users/abu/dev/hackathon/metropolis/packages/calls/src/trade-slip.ts:135) retains ride Entry. Apply the fact budgets and move geometry to pins. |
| Pending receipt can still show “Pays if right” | [use-call-flow.ts:193](/Users/abu/dev/hackathon/metropolis/packages/calls/src/use-call-flow.ts:193) passes that quoted row into both pending-paper renderers. Remove it at the shared source. |
| Receipt assembly still separates replay, timeline and proof | [web CallReceipt.tsx:65](/Users/abu/dev/hackathon/metropolis/apps/web/src/features/calls/CallReceipt.tsx:65), [mobile CallReceipt.tsx:65](/Users/abu/dev/hackathon/metropolis/apps/mobile/src/features/calls/CallReceipt.tsx:65); full timeline/proof remain below. Integrate the stage and pin strip, with one Proof entry. |
| Existing players still autoplay the old 160-high path | [web Replay.tsx:105](/Users/abu/dev/hackathon/metropolis/apps/web/src/features/receipts/Replay.tsx:105), [mobile Replay.tsx:101](/Users/abu/dev/hackathon/metropolis/apps/mobile/src/features/receipts/Replay.tsx:101). Wire the film model, final-frame initial state, privacy and Reduce Motion. |
| Missing/partial recordings disappear | [web Replay.tsx:98](/Users/abu/dev/hackathon/metropolis/apps/web/src/features/receipts/Replay.tsx:98), [mobile Replay.tsx:92](/Users/abu/dev/hackathon/metropolis/apps/mobile/src/features/receipts/Replay.tsx:92) return null. [replay.ts:140](/Users/abu/dev/hackathon/metropolis/packages/calls/src/replay.ts:140) rejects central gaps. Add labelled back-fill/rebuild states. |
| Recording interval and provenance are insufficient | [replay.ts:13](/Users/abu/dev/hackathon/metropolis/packages/calls/src/replay.ts:13) lacks event anchors, band/KO/Cap, original cost and segment provenance. [replay.ts:196](/Users/abu/dev/hackathon/metropolis/packages/calls/src/replay.ts:196) starts at observation time. Use actual fill/end anchors; calculate coverage over the full holding interval and account for intentional sample thinning. |
| Unknown PnL becomes zero | [replay.ts:162](/Users/abu/dev/hackathon/metropolis/packages/calls/src/replay.ts:162), [film.ts:123](/Users/abu/dev/hackathon/metropolis/packages/calls/src/film.ts:123), [film-frame.ts:73](/Users/abu/dev/hackathon/metropolis/packages/calls/src/film-frame.ts:73). Preserve null and neutral tone. Append an authoritative terminal sample instead of assigning the final result to an arbitrary last observed sample. |
| New film model drops off-screen levels and under-specifies ROI/source | [film-frame.ts:84](/Users/abu/dev/hackathon/metropolis/packages/calls/src/film-frame.ts:84) filters levels out; [film.ts:44](/Users/abu/dev/hackathon/metropolis/packages/calls/src/film.ts:44) has one numeric cost and a partial boolean. Add edge labels, nullable share-cost denominator and recorded/back-filled/rebuilt provenance. |
| Terminal engines cannot directly reproduce film frames | [web chart-engine.ts:205](/Users/abu/dev/hackathon/metropolis/apps/web/src/features/terminal/chart/chart-engine.ts:205), [mobile state.ts:164](/Users/abu/dev/hackathon/metropolis/apps/mobile/src/features/terminal/chart/state.ts:164) advance live state. Reuse their drawing primitives with film-supplied coordinates/time. Their filled level tags also need a plain-text film treatment. |
| Trade payloads cannot supply the complete branded film | [history.ts:21](/Users/abu/dev/hackathon/metropolis/packages/api-client/src/routes/history.ts:21) lacks owner identity and historical valuation inputs; [rides.ts:113](/Users/abu/dev/hackathon/metropolis/packages/api-client/src/routes/rides.ts:113) lacks a timestamped event sequence. Add authorised identity and exact event data; partial-ride reconstruction needs size changes. |
| Export actions are still PNG paths | [web SlipActions.tsx:31](/Users/abu/dev/hackathon/metropolis/apps/web/src/features/receipts/SlipActions.tsx:31), [mobile SlipShare.tsx:29](/Users/abu/dev/hackathon/metropolis/apps/mobile/src/features/receipts/SlipShare.tsx:29). Native encoder/media-library declarations are arriving, but neither receipt has the video workflow. Native delivery requires a new binary. |
| Privacy can leak ROI through the label | [share.ts:89](/Users/abu/dev/hackathon/metropolis/packages/calls/src/share.ts:89) puts ROI in the label; [trade-slip.ts:162](/Users/abu/dev/hackathon/metropolis/packages/calls/src/trade-slip.ts:162) masks the figure text only. Mask sensitive labels/percentages independently of the money flag. |
| Referral footer has an unfinished dependency | [call links](/Users/abu/dev/hackathon/metropolis/packages/calls/src/links.ts:7) and [ride links](/Users/abu/dev/hackathon/metropolis/packages/calls/src/trade-slip.ts:65) carry no referral; capture remains [R8.4](/Users/abu/dev/hackathon/metropolis/docs/plan/replan-r8-social.md:42). Connect the `r` capture needed by this footer in Q3. |
| Full receipts remain inline in finished-position lists | [web FinishedSlip.tsx:22](/Users/abu/dev/hackathon/metropolis/apps/web/src/features/receipts/FinishedSlip.tsx:22), [mobile FinishedSlip.tsx:23](/Users/abu/dev/hackathon/metropolis/apps/mobile/src/features/receipts/FinishedSlip.tsx:23). Replace with the compact result row and Receipt/Video entry. |


