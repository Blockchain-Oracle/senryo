# R7 — Games, Duel and Events as games (replan stage 7; finishes S8.8; rewritten 12 Oct, runs right after F)

**Goal:** every game runs full-screen with a game camera, physics, juice, its own sound and music, and a result
moment, on both apps:
- Line Rider (a sled riding the chart);
- Candle Hop (a coin through a candle canyon);
- Lucky (a physical machine);
- Warm-up (beat the coin);
- Duel, Events and Parlays get their drama.

**Why rewritten:** the owner's 12 Oct review: "you're not doing this as a real game"; Lucky and Line Rider need
sound, vibration, "hard physics", full screen and a better view; the cards are weak; Duel is mediocre; Events look
like slop. The 10 Oct R7 had no physics, no follow camera and no web full screen, and kept D-312's abbreviations. The
old R7.1 (games audio) moved to F1–F3.

**Authority:**
- `replan-2026-10-10.md` R7; D-295; D-315…D-318;
- research `10-feel-direction.md` §3–§5 (every number below), `02` §2.1–2.4 and §6 B12–B15, `06` §1 #2–#4, #7, #16,
  #19 and §7;
- port sources `../owarine/web/src/features/games/`:
  - `arcade/{useArcadeLoop,ride-draw,flap-draw,sprites,arcade-sfx,palette}.ts`;
  - `lucky/{LuckyReels,reel-sfx,LuckyResultModal}`;
  - `practice/{PracticeStage,PracticeWatch,PracticeResult}.tsx`;
  - `stage/{SwipeDeck.tsx,stage.css}`;
  - `duel/{DuelQueue,DuelLobby,DuelResultModal}.tsx`;
  - `{GameCard,GamesHub,GameProfileCard,SeasonBanner,AchievementsPlate,HowToSheet}.tsx`, `games.css`, `motion.ts`;
- port sources elsewhere: `../owarine/mobile/src/features/games/arcade/ArcadeFullScreen.tsx`; Mitoshi
  `components/ui/{confetti-burst,rolling-clock,fly-to-target}.tsx`;
- licences checked before shipping (`m6x11plus` attribution, Kenney CC0);
- 21st.dev first; Context7 for Skia, Reanimated, Gesture Handler and motion.

**Gate:**
- `pnpm gate` 0;
- **played through on the web (preview tools) and on the phone (one simulator pass on a Release build):**
  - a Line Rider run with landings and a wipeout;
  - a Candle Hop crash;
  - a Lucky spin to its real call;
  - a Warm-up to its result;
  - a duel and an event settled with their moments;
- the same Line Rider input tape replays to the same score on Node, Chrome and the simulator, and the server accepts
  it;
- no game screen leads with proof text (it sits behind ⓘ);
- api, keeper and web deployed; OTA.

## Steps

### The stage
- [ ] R7.1 One game stage on both apps:
  - *Progress 12 Oct (web arcade):*
    - *`ArcadeStage.tsx` (with `loop.ts`, `run.ts`, `StageParts.tsx`, `arcade.css`) takes the whole screen: the
      Fullscreen API with landscape asked inside the Play tap, and a fixed layer where the browser can't.*
    - *The run: a 3-2-1-GO with its beeps, then the games music; a 60 Hz loop with the device-pixel ratio capped at 2,
      stalls clamped to 100 ms, paused while hidden.*
    - *The HUD and controls: score, best and combo pop; sound, Pause (practice runs only) and Exit, each 44 px.*
    - *The page leaving: a ranked run ends unranked, a practice run pauses.*
    - *The game-over card: score, a NEW BEST stamp, the replay check and rank, the run's numbers, Play again, Share
      and Exit.*
    - *Candle Hop plays on the same stage (`flap-run.ts`) until R7.3.*
    - *Left: Lucky's and Warm-up's portrait stages, and the phone.*
  - **Entry:** Play removes the navigation.
  - **Full screen:**
    - web: the Fullscreen API with a viewport fallback;
    - phone: Skia, landscape for the arcade (Owarine's rotated `ArcadeFullScreen`, with a 1.5 s "turn your phone"
      cue), portrait for Lucky and Warm-up.
  - **Loop:** 60 Hz fixed step with drawing interpolated between steps (port `useArcadeLoop.ts`: DPR capped at 2,
    stalls clamped to 100 ms, paused while hidden).
  - **Controls:** 44 px Pause and Exit; a 3-2-1-GO countdown with its cues.
  - **HUD:** rolling score, combo heat, best, and the speaker control (F2).
  - **Game over:** a card with the score, best, rank, Share and Retry.
  - **Interruptions:** unranked runs pause; ranked runs end; money clocks keep running.

### The arcade (D-318)
- [ ] R7.2 Line Rider v2, a sled riding chart terrain:
  - *Progress 12 Oct (core, api, web):*
    - *Engine (`packages/core/src/games/arcade/sled.ts`, `sled-world.ts`; v1 `ride.ts` deleted):*
      - *two runners and a rider in a Verlet triangle, with six passes;*
      - *hold to crouch, release to hop (240–460 px/s, charged over 0.6 s), lean in the air;*
      - *the terrain is the tape's moves at a fixed scale, with leverage 1× → 2.2× over 90 s;*
      - *gaps after 10 s ("a gap down": the far side lower) that only a hop clears;*
      - *wipeouts: the rider touching the line, landing upside down, falling into a gap, or hitting its far wall.*
    - *Checked headless on today's BTC, ETH and SOL tapes:*
      - *an idle rider dies at 27–94 s, and a hop-and-level bot lives 26–90 s with combos up to 24×;*
      - *flips land;*
      - *every run replays to the same score and tick.*
    - *api: `arcade_tapes` plus a seed's `tape` and `engine` (0028); a ranked seed carries its tape; a guest gets one
      from `GET /v1/arcade/tape`; the board ranks only engine 2.*
    - *Web: the sled renderer (`sled-draw.ts`):*
      - *the camera at 30 %, with a minimum 420-unit width in portrait;*
      - *the line green where the price rose and coral where it fell, with the quarter-hour minutes along the floor;*
      - *lit gap edges, a trail, the sled, a glowing rider and the charge ring;*
      - *sparks, dust, fragments, floating words, speed streaks, combo heat, shake and flash.*
    - *Web: the driver (`sled-run.ts`) records the codes and plays the cues:*
      - *a scrape grain while pressing, the wing on a hop, landing thuds;*
      - *hit-stop and a 4 px shake on hard landings;*
      - *the comboStep, gap and milestone ladders, a surge on a flip;*
      - *on a wipeout, the crash, the flash and the music cut.*
  - **Camera:** side camera with the sled at 30 % of the width.
  - **Terrain:** neon, built from the server-recorded price tape with fixed normalisation. Emitted terrain never
    reshapes.
  - **Input:** hold compresses, release hops, drag leans (Space and the arrows on a keyboard).
  - **Speed:** 180 → 300 px/s.
  - **Physics:** 60 Hz fixed-point Verlet with two runners and a rider, six constraint passes, integer collision and
    integer square root. Inputs are quantised and recorded with the engine version.
  - **Juice:**
    - runner sparks, a 120-point trail, combo heat;
    - 30 ms landing hit-stop, 4 px landing / 8 px wipeout shake, a grip warning under 25 %;
    - a scrape loop following contact, landing thumps, combo notes, the bed cut on a wipeout;
    - haptics on landing, regained contact, milestones and the crash.
  - **Replaces** `packages/core/src/games/arcade/{ride,replay}.ts` together (engine v2, its own board). The engine's
    events (`impact`, `scored`, `crashed`, `regained`, `milestoneHit`) drive every effect.
- [ ] R7.3 Candle Hop v2, a coin through a candle canyon:
  - *Progress 12 Oct (core, web):*
    - *The engine (`flap.ts` v2, engine 2 with its own board) is the canyon built from the run's price tape:*
      - *one pair of candles a minute; the gap follows the price;*
      - *each pair is green or coral by its move, and the wicks grow with the move's size;*
      - *gravity 1,000 px/s², flap −310 px/s, the gap 120 → 88 px (calm: 100).*
    - *Collision is a circle against rectangles by squared distance. The seed picks the minute the run starts at
      (both games).*
    - *A centre-seeking bot lives 7–45 s on today's tapes, and every run replays exactly.*
    - *Web (`flap-run.ts`):*
      - *the coin squashes on the kick and stretches in the fall;*
      - *the wing on every flap; the gap ladder and sparks per candle passed;*
      - *the crash: 50 ms hit-stop, an 8 px shake, fragments, a flash, the impact haptic and the music cut.*
    - *Left: the phone (R7.6).*
  - **World:** real recent candles from the archive as the canyon, with solid bodies and dangerous wicks.
  - **Physics:** gravity 1,000 px/s², flap −310 px/s, gap 120 → 88 px; the same fixed-point discipline.
  - **Juice:** squash and stretch with a wing sound; sparks and rising notes per gap.
  - **Crash:** 50 ms hit-stop, 8 px shake over 300 ms, fragments, a heavy haptic.

### Lucky and Warm-up
- [ ] R7.4 Lucky, a physical machine:
  - **Machine:** three deep reel windows (market crest with its sparkline, bull/bear, the reach plate), and a lever
    pulled on a spring.
  - **Reels:** a continuous strip with inertia, contents frozen while moving.
  - **Stops:** after the verified draw, at 720/980/1240 ms with 180 ms deceleration and 4 px overshoot; three
    ascending thunks with light/medium/firm haptics.
  - **After the stops:**
    - a 480 ms lock, then "Place call · $5";
    - the call locks with its cue;
    - the win music waits for settlement;
    - a near-miss beat;
    - a result modal with the streak and confetti.
  - **Proof:** behind ⓘ.
- [ ] R7.5 Warm-up, beat the coin (both apps):
  - *Progress 12 Oct (web and phone, one flow in `@senryo/calls` `useWarmUp`):*
    - *The table is dealt with five card sounds, and the deck is shuffled by the round's seed (it was the catalog's
      first five).*
    - *Big live cards in a taller deck: the mark, the rolling price, the 24 h line and change.*
    - *Down and Up sit on their direction fills (the shared web deck; Duel too).*
    - *Five slots, you against the coin: your pick, then the coin's flipping in (`coinOf`).*
    - *The 30 s watch: five live races, the move since your pick and who leads it (`warmUpLeader`); beeps in the
      last 5 s.*
    - *The reveal, 220 ms apart, with each verdict's sound, then the score and a fanfare (the jackpot and
      confetti when you win).*
    - *The phone gets the screen and its route; the hub lists every game; the deep-link fallback for web-only
      games is gone.*
  - **Table:** five big live cards (mark, mini chart, rolling price).
  - **Swipes** stamp Up/Down and flick away with a tick haptic.
  - **The 30 s watch:** five mini races against the coin's visible picks.
  - **Reveals:** 220 ms apart, each with its verdict sound, then the score and a fanfare.
- [ ] R7.6 Phone parity:
  - *Progress 12 Oct (Line Rider and Candle Hop on the phone):*
    - *The runs, their drawing and the canvas they draw on are one package, `@senryo/arcade`, with the feel
      injected.*
    - *The phone draws them through a 2D canvas over Skia's picture recorder (`skia-2d.ts`): fills and strokes with
      their glow, gradients, paths, arcs, round rects, text. Each frame is recorded on the JS thread and shown by a
      `<Picture>` from a shared value.*
    - *The phone stage (`ArcadeStage.tsx`) is turned a quarter turn by a transform: landscape with no native change,
      shipped by update.*
      - *A "turn your phone" cue rides the 3-2-1-GO.*
      - *Any finger holds; the half it touches leans.*
      - *Pause for practice runs; Back pauses; the app leaving pauses a practice run and ends a ranked one.*
      - *The game-over card with Share.*
    - *The page shows the game playing itself: the attract loop, the same engine on a real tape, steered by each
      run's autopilot.*
    - *Routes `/games/line-rider` and `/games/candle-hop`; the hub lists both.*
    - *Checked on a Release build in the simulator: the page, the attract loop, the stage, a press-and-hop.*
    - *Fixed on the way: Hermes has no `Intl.PluralRules`. The board's ordinal is plain arithmetic in
      `@senryo/arcade` `rankNote`, one helper for both apps.*
    - *Left: Warm-up on the phone (R7.5), and the `ON_PHONE` list goes once it has every game.*
  - all four games on the phone in Skia;
  - the config's phone routes become real;
  - delete `ON_PHONE` (`GamesScreen.tsx:28`) and the deep-link fallback (`lib/deep-link.ts:33`).

### The hub
- [ ] R7.7 Hub on both apps:
  - **Art:** 16:9 gameplay art per game (the sled, the reel machine, the candle canyon, the card table).
  - **Cards:** 240 px on desktop, full-width on the phone, each with:
    - an explicit Play button;
    - best score and streak;
    - stakes;
    - a live "N playing" line;
    - a checker background drifting over 12 s.
  - **Meta:** a season banner, achievements (indexer facts) and a profile card with Elo.
  - **"Pick up where you left off."**

### Duel, Events, Parlays
- [ ] R7.8 Duel:
  - **Queue:** your avatar, stake, wait time and availability; a 2.4 s breathing search; a match chord and a firm
    haptic.
  - **Lobby:** 72 px portraits, handles, rating and pot, a 700 ms versus entrance, then the three-card deal.
  - **Cards:**
    - each card flips in 240 ms and carries its live mini chart and rolling price;
    - swipes commit past 84 px or 480 px/s, with a stamp after 24 px and a tilt up to 18°, and Up/Down buttons
      always there;
    - opponent picks stay concealed until allowed;
    - a restrained heartbeat in the last 10 s;
    - the Duel music pulse.
  - **Results:** unfold 600 ms apart with rolling totals; the pot, rating change, win/tie/refund, Share and Play again.
- [ ] R7.9 Events as a scoreboard:
  - **Card:**
    - the league crest, 48 px team crests (F11), team names, then live score and status (F12), then the question;
    - team colours as opposing 6 px edge bands and faint washes;
    - an 8 px "Pool split" bar with payout estimates apart;
    - 44 px Yes/No buttons in the direction colours (team colours mark teams, not answers);
    - a rolling "calls close in" clock.
  - **Board:** filters by league, then Upcoming / Live / Settled.
  - **Settlement:** "2/3 agreed · confirming" → Paid, or Refunded on disagreement, with a stamp and the verdict cue.
  - **Proof:** the committee's statements behind ⓘ.
- [ ] R7.10 Parlays: legs fly into the slip (Mitoshi `fly-to-target.ts`) and settle leg by leg with their cues.

## Handoff
(written at the end of the stage)
