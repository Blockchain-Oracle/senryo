# 10 — Feel direction (Codex, xhigh, 12 Oct 2026)

The owner's 12 Oct review of production (sound, prices, affordances, games, Duel, Events, the ticket, the network
switch, motion) was briefed to the Codex CLI (`gpt-6.1-sol`, reasoning xhigh, read-only) with the reference paths.
Its answer, verbatim below, is the design authority for stage F and the rewritten R7 (`docs/plan/replan-f-feel.md`,
`replan-r7-games.md`). Numbers are proposed tuning values, adjusted on device.

---

**Make Senryo feel like a market arcade:** tactile controls, vivid outcomes, physical cards, and games that occupy the screen. Use off-white/ink outside games; near-black arenas inside them. Acid green `#B5F543` means Up, hot coral `#FF647C` means Down, cyan means Range, pink means Play.

Build the ticket, price rows, and shared feedback first; then games, Duel, and Events. The numbers below are proposed tuning values.

Port paths below use **O** = `../owarine/web/src`, **M** = `../crypto-world-fair/web/src`.

**1. Terminal ticket**

Keep the chart dominant. Desktop ticket column: **320px**. Phone: pinned above the safe area, with **16px gutters**.

- Buttons: **52px high, 12px radius, 10px gap**, equal widths. Label only: **↑ UP**, **↓ DOWN**, **↔ RANGE**, **MOONSHOT**, **CRASH**. Condensed bold type, **16px**, no wrapping.
- Up/Down use acid green/coral with black labels and a **3px darker bottom edge**. Moonshot/Crash retain those directions, adding rocket/plunge symbols. Range uses an ink plate with a cyan band symbol.
- **Below each button:** “Pays 2.14×”. Selected quote gets a separate line: “$5 stake → $10.70 returned”, followed by fees. State that return includes stake.
- **On the chart:** opening line, shaded winning region, exact strikes, and “Above $X at close” or “Between $A–$B at close”. Hover/focus previews the corresponding region.
- Hover lifts **2px in 120ms**; press sinks **2px**, scale **0.98**, in **70ms**; release settles in **160ms**.
- Unpriced buttons become neutral recessed plates, retain their labels, and show **—** beneath. Put “Quote unavailable · retrying” outside the buttons. Closed, stale, and pending states each get their own sentence.
- Holding a position morphs controls to **TRAIL / CASH OUT** in **180ms**; cash-out value rolls separately.

Port **O/features/terminal/ui/TradeButtons.tsx** for the morph and state structure; **M/components/ui/prediction-ticket.tsx** for amount/return hierarchy. Adapt [Tradash’s flow spec](/Users/abu/dev/hackathon/canton-season3/context/13-revamp/tradash/SPEC-flow.md).

**2. Prices everywhere**

One shared row composition: **40px mark → symbol/name → sparkline → price/change → chevron**. Rows are **72px**, search results **56px**. Whole-row tint, pointer cursor, **2px focus ring**, and immediate press feedback establish clickability.

Sparkline: rolling **24 hours**, **96 fifteen-minute closes plus latest price**, **96×32px desktop / 64×24px phone**, **1.6px stroke**, faint **8% fill**. Draw a dashed baseline at the actual price 24 hours ago. Green above it, coral below, grey unchanged. Preserve gaps and extrema; never manufacture history from daily high/low.

Change chip: **“↑ +2.34% · 24h”**, **24px high**, matching that baseline. Terminal header keeps this miniature beside its rolling price; the main chart retains the selected trading window.

Roll changed digits only, **180ms**, at most **5 updates/second**. Freeze offscreen rows. Stale prices retain their timestamp.

Port [M’s sparkline](/Users/abu/dev/hackathon/crypto-world-fair/web/src/components/ui/sparkline.tsx), adapting its interactive scrubber into a passive row graphic; use Senryo’s existing odometers and Tradash `SPEC-chart.md §3.8`.

**3. Games**

**Lucky — a physical prediction machine.** Three deep reel windows dominate the view: large market crest, bull/bear, reach plate. Keep a continuous strip with inertia; freeze its contents during motion. After the verified draw arrives, stop at **720/980/1240ms**, with **180ms deceleration**, **4px overshoot**, three ascending thunks and light/medium/firm haptics. Hold **480ms**, then reveal **“Place call · $5”**. Execution gets a lock sound; winning music waits for settlement. Port **O/features/games/lucky/{LuckyReels.tsx,reel-sfx.ts,LuckyResultModal.tsx}**.

**Line Rider — yes, make it a sled riding chart terrain.** Side camera, sled at **30% screen width**, neon terrain, visible suspension and airborne landings. Hold compresses; release hops; horizontal drag leans. Keyboard equivalents: Space and arrows. Start around **180px/s**, rising toward **300px/s**.

Use **60Hz fixed-point Verlet**, two runners plus rider, **six fixed constraint passes**, integer collision math and integer square-root routines. Record quantized inputs, engine version, and the **server-recorded price tape with fixed normalization**. Terrain already emitted never reshapes. The current seeded engine is not live terrain; this is a replacement mechanic with a separate leaderboard.

Juice: runner sparks, **120-point trail**, combo heat, **30ms visual landing hit-stop**, **4px landing shake / 8px wipeout shake**, grip warning below **25%**. Scrape loop follows contact; landings thump; combos climb notes; wipeout cuts the bed. Haptics mark landing, regained contact, multiplier milestones, and crash. Port **O/features/games/arcade/{ride-draw.ts,arcade-sfx.ts}**; replace Senryo `ride.ts/replay.ts` physics together.

**Candle Hop — a coin flying through a candle canyon.** Side camera, real coin sprite, substantial candle bodies and dangerous wicks. Starting tune: gravity **1,000px/s²**, flap **−310px/s**, gap **120→88px**. Tap gives squash/stretch and a wing sound; clearing gaps adds sparks and rising notes. Crash: **50ms visual hit-stop**, **8px shake over 300ms**, fragments, heavy haptic. Use the same deterministic arithmetic discipline. Port **O/arcade/{flap-draw.ts,sprites.ts,arcade-sfx.ts}** under `features/games`.

**Warm-up — beat the coin.** Portrait card table: five large live cards with marks, mini charts, and rolling prices. Swipes stamp Up/Down, flick away, and tick haptically. The **30-second watch** becomes five miniature races against visible coin picks. Reveal cards **220ms apart**, with individual verdict sounds, then the score and a short winner fanfare. Port **O/features/games/practice/{PracticeStage,PracticeWatch,PracticeResult}.tsx** and `stage/SwipeDeck.tsx`.

**Fullscreen:** Play removes navigation on both apps. Web requests fullscreen with a viewport fallback; phone uses Skia, landscape for arcade, portrait for Lucky/Warm-up. Keep **44px Pause/Exit** controls. Unranked arcade pauses; ranked live runs end on interruption. Financial clocks keep running.

**Hub:** **16:9 gameplay artwork**, **240px desktop cards**, full-width phone cards, explicit **Play**, best score/streak, and stakes. Show the sled, reel machine, candle canyon, and card table—not four interchangeable icons. Port **O/features/games/{GameCard,GamesHub,GameProfileCard}.tsx** structure.

**4. Duel**

Queue shows your avatar, selected stake, elapsed wait, and actual availability. A **2.4-second breathing search animation** ends with a match chord and firm haptic.

Versus lobby: **72px portraits**, handles, rating, pot, then a **700ms versus entrance** and three-card deal. Cards flip in **240ms**; swipes commit past **84px or 480px/s**, show a stamp after **24px**, and tilt up to **18°**. Always provide Up/Down buttons. Opponent picks stay concealed until permitted; the final **10 seconds** add restrained heartbeat urgency.

Confirmed card results unfold **600ms apart**, rolling returned totals. Finish with pot, rating change, win/tie/refund state, Share, and Play again.

Port **O/features/games/duel/{DuelQueue,DuelLobby,DuelResultModal}.tsx**, `stage/SwipeDeck.tsx`, and M’s `confetti-burst.tsx`.

**5. Events**

Use a sports scoreboard composition: league crest, **48px team crests**, team names, score/status, then the explicit question. Team colours occupy opposing **6px edge bands** and faint background washes.

Import and cache theme-matched logos and colours from [ESPN’s team feed](https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams), extending `services/keeper/src/events/sources/espn.ts` and replacing `TeamMark.tsx`’s initials fallback.

Board filters: **NHL / MLB / NFL / Premier League**, then Upcoming / Live / Settled. Use an **8px pool-split bar**, labelled “Pool split”, with payout estimates separately. Yes/No buttons: **44px high**, green/coral; team colours identify teams, not answers.

Countdown names **when calls close**. Settlement progresses through **“2/3 agreed · confirming” → Paid**, or Refunded on disagreement. Stamp and sound fire on confirmed settlement. Port M’s `rolling-clock.tsx` and verdict/confetti treatment.

**6. Practice ↔ Real**

Replace the passive chip with a **44px two-segment switch**: **Practice | Real**. Practice reads “Test dollars”; Real reads **“Live prices · trading opens with mainnet”**.

Switch instantly without login, preserve market/window, keep balances and positions separate, and persist the selection. Real remains fully browsable; its ticket offers **“Switch to Practice to play”**. No financial action is queued.

Port roy-chain’s `mode-switch.client.tsx` thumb/keyboard behaviour and **O/components/shell/app/environment.ts** transition. Adapt `ModeChip.tsx`’s stamp identity; its current account-determined behaviour does not fit Senryo.

**7. Sound, music, haptics**

Extend `packages/tokens/src/sound.ts` into one cue map for both apps:

- Select: dry click + light impact.
- Confirmed open: rising **220ms** cue + double impact.
- Confirmed win/loss/refund: distinct ascending/descending/neutral endings.
- Reel, swipe, landing, gap, combo, match-found, and crash: dedicated cues described above.

Port **O/lib/sound/{trade,music}.ts**, `lib/haptics.ts`, and **O/features/games/{audio,bed,feedback}.ts**. Web synthesizes; phone uses matching prerendered assets and native impacts.

Effects/haptics default on. Game music starts after Play at **20%**; terminal music defaults off. Beds: **112 BPM arcade**, **92 BPM terminal**, sparse Duel pulse. Duck music **6dB over 80ms** for verdicts; recover over **400ms**. Persist separate effects/music sliders, haptic intensity, and reduced motion. Show a speaker control in every game HUD.

**8. Remaining boring surfaces**

- **Home:** lead with a resumable live call or playable Warm-up, then movers.
- **Calls:** rolling cash-out values, outcome stamps, and **12-second replay**; port O’s `PositionsPanel.tsx` and `ReplaySheet.tsx`.
- **Parlay:** legs fly into the slip; settle individually. Port M’s `fly-to-target.ts`.
- **Earn:** share-value history, utilization bar, settlement clock, and withdrawal timeline.
- **Search/navigation:** Games gets a visible destination; search gets recents, previews, and phone parity. Every subpage gets Back.
- **Landing/onboarding:** demonstrate one playable prediction immediately.
- **Wallet/recovery:** exact amounts, clear progress, and persistent Check status—not celebratory animation while an outcome is unknown.


