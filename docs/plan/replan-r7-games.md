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
  - **Table:** five big live cards (mark, mini chart, rolling price).
  - **Swipes** stamp Up/Down and flick away with a tick haptic.
  - **The 30 s watch:** five mini races against the coin's visible picks.
  - **Reveals:** 220 ms apart, each with its verdict sound, then the score and a fanfare.
- [ ] R7.6 Phone parity:
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
